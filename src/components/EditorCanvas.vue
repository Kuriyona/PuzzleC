<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Cell, LevelLabel, LocaleId, ThemeId, Vec2 } from '../types'
import type { EditorDraft } from '../map/draft'
import type { MapLabel } from '../map/format'
import type { EditorTool, WallTarget } from '../map/edit'
import { hasWall, isBorderWall, snapCell, snapText, snapWall } from '../map/edit'
import { resolveLocalized, textSizeScale } from '../map/format'
import { CANVAS_PALETTES, inkRgba } from '../render/palette'
import { addLevelWalls, wallLineWidth } from '../render/walls'
import { LABEL_FONT_STACK, drawLabels } from '../render/labels'
import { translate } from '../i18n/messages'

const props = defineProps<{
  draft: EditorDraft
  tool: EditorTool
  /** 父组件每次改动自增，用于触发重绘 */
  rev: number
  selectedLabelId: string | null
  theme: ThemeId
  locale: LocaleId
}>()

const emit = defineEmits<{
  'wall-set': [payload: { target: WallTarget; on: boolean }]
  'cell-pick': [payload: { cell: Cell }]
  'label-place': [payload: { pos: Vec2 }]
  'label-pick': [payload: { id: string }]
  'label-move': [payload: { id: string; pos: Vec2 }]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const paper = computed(() => CANVAS_PALETTES[props.theme].paper)

let ctx: CanvasRenderingContext2D | null = null
let side = 0
let dpr = 1
let tile = 1
let ox = 0
let oy = 0
let observer: ResizeObserver | null = null

// 指针交互状态（不进响应式）
let active = false
let paintOn = false
let lastTarget: WallTarget | null = null
let draggingId: string | null = null
let hover: Vec2 | null = null

function measure(): void {
  const cvs = canvasRef.value
  if (!cvs) return
  const rect = cvs.getBoundingClientRect()
  side = Math.max(1, Math.floor(Math.min(rect.width, rect.height)))
  dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  cvs.width = Math.round(side * dpr)
  cvs.height = Math.round(side * dpr)
  const margin = Math.max(3, side * 0.015)
  tile = (side - margin * 2) / Math.max(props.draft.cols, props.draft.rows)
  ox = (side - props.draft.cols * tile) / 2
  oy = (side - props.draft.rows * tile) / 2
}

/** 屏幕坐标 → 连续坐标（格单位） */
function toWorld(e: PointerEvent): Vec2 {
  const cvs = canvasRef.value
  if (!cvs) return { x: 0, y: 0 }
  const rect = cvs.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left - ox) / tile - 0.5,
    y: (e.clientY - rect.top - oy) / tile - 0.5,
  }
}

/** 设置字体并按字号返回像素高度 */
function applyFont(label: MapLabel): number {
  const px = Math.max(1, Math.round(textSizeScale(label.size) * tile))
  if (ctx) {
    ctx.font = `${px}px ${LABEL_FONT_STACK}`
    ctx.textAlign = label.align
    ctx.textBaseline = 'middle'
  }
  return px
}

/** 该标签在当前界面语言下显示的文本（空文本用占位文案） */
function displayText(label: MapLabel): string {
  const text = resolveLocalized(label.text, props.locale)
  return text.trim() === '' ? translate(props.locale, 'editor.label.placeholder') : text
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 标签的文本测量框 + 内边距（世界像素） */
function labelBox(label: MapLabel): Box {
  const fontPx = applyFont(label)
  const width = ctx ? ctx.measureText(displayText(label)).width : fontPx
  const pad = tile * 0.08
  const cx = (label.pos[0] + 0.5) * tile
  const cy = (label.pos[1] + 0.5) * tile
  let x0 = cx
  let x1 = cx + width
  if (label.align === 'right') {
    x0 = cx - width
    x1 = cx
  } else if (label.align === 'center') {
    x0 = cx - width / 2
    x1 = cx + width / 2
  }
  return { x0: x0 - pad, y0: cy - fontPx / 2 - pad, x1: x1 + pad, y1: cy + fontPx / 2 + pad }
}

/** 命中最后一个覆盖该点的标签（后绘制的在上） */
function hitTestLabel(fx: number, fy: number): string | null {
  const wx = (fx + 0.5) * tile
  const wy = (fy + 0.5) * tile
  const labels = props.draft.labels
  for (let i = labels.length - 1; i >= 0; i--) {
    const box = labelBox(labels[i])
    if (wx >= box.x0 && wx <= box.x1 && wy >= box.y0 && wy <= box.y1) return labels[i].id
  }
  return null
}

function strokeTarget(c: CanvasRenderingContext2D, target: WallTarget): void {
  if (target.axis === 'v') {
    c.moveTo(target.k * tile, target.i * tile)
    c.lineTo(target.k * tile, (target.i + 1) * tile)
  } else {
    c.moveTo(target.i * tile, target.k * tile)
    c.lineTo((target.i + 1) * tile, target.k * tile)
  }
}

function drawHover(c: CanvasRenderingContext2D, fx: number, fy: number): void {
  const { cols, rows } = props.draft
  const pal = CANVAS_PALETTES[props.theme]
  if (props.tool === 'wall') {
    const target = snapWall(fx, fy, cols, rows)
    if (isBorderWall(target, cols, rows)) return
    const removing = hasWall(props.draft, target)
    c.save()
    c.lineCap = 'round'
    c.lineJoin = 'round'
    if (removing) {
      c.strokeStyle = pal.paper
      c.lineWidth = wallLineWidth(tile) * 1.6
    } else {
      c.strokeStyle = inkRgba(pal.ink, 0.35)
      c.lineWidth = wallLineWidth(tile)
    }
    c.beginPath()
    strokeTarget(c, target)
    c.stroke()
    c.restore()
    return
  }
  if (props.tool === 'start' || props.tool === 'goal') {
    const cell = snapCell(fx, fy, cols, rows)
    const cx = (cell.x + 0.5) * tile
    const cy = (cell.y + 0.5) * tile
    c.save()
    c.strokeStyle = inkRgba(pal.ink, 0.35)
    if (props.tool === 'start') {
      c.lineWidth = Math.max(1, tile * 0.06)
      c.beginPath()
      c.arc(cx, cy, tile * 0.16, 0, Math.PI * 2)
      c.stroke()
    } else {
      c.translate(cx, cy)
      c.rotate(Math.PI / 4)
      const r = tile * 0.28
      c.lineWidth = Math.max(1.5, tile * 0.07)
      c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6)
    }
    c.restore()
    return
  }
  // 文字工具：十字准星
  const pos = snapText(fx, fy, cols, rows)
  const cx = (pos.x + 0.5) * tile
  const cy = (pos.y + 0.5) * tile
  const a = tile * 0.15
  c.save()
  c.strokeStyle = inkRgba(pal.ink, 0.35)
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(cx - a, cy)
  c.lineTo(cx + a, cy)
  c.moveTo(cx, cy - a)
  c.lineTo(cx, cy + a)
  c.stroke()
  c.restore()
}

function draw(): void {
  const c = ctx
  if (!c || side <= 0) return
  const pal = CANVAS_PALETTES[props.theme]
  const draft = props.draft

  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.fillStyle = pal.paper
  c.fillRect(0, 0, side, side)

  c.save()
  c.translate(ox, oy)

  // 网格线
  c.strokeStyle = inkRgba(pal.ink, 0.12)
  c.lineWidth = 1
  c.beginPath()
  for (let k = 0; k <= draft.cols; k++) {
    c.moveTo(k * tile, 0)
    c.lineTo(k * tile, draft.rows * tile)
  }
  for (let k = 0; k <= draft.rows; k++) {
    c.moveTo(0, k * tile)
    c.lineTo(draft.cols * tile, k * tile)
  }
  c.stroke()

  // 墙（实体墙几何，与游戏内一致）
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.lineWidth = wallLineWidth(tile)
  c.strokeStyle = inkRgba(pal.ink, 0.75)
  c.beginPath()
  addLevelWalls(c, draft, tile)
  c.stroke()

  // 起点：空心圆
  c.strokeStyle = inkRgba(pal.ink, 0.6)
  c.lineWidth = Math.max(1, tile * 0.06)
  c.beginPath()
  c.arc((draft.start.x + 0.5) * tile, (draft.start.y + 0.5) * tile, tile * 0.16, 0, Math.PI * 2)
  c.stroke()

  // 目标：菱形（与游戏内标记一致）
  for (const goal of draft.goals) {
    c.save()
    c.translate((goal.x + 0.5) * tile, (goal.y + 0.5) * tile)
    c.rotate(Math.PI / 4)
    const r = tile * 0.28
    c.strokeStyle = inkRgba(pal.ink, 0.95)
    c.lineWidth = Math.max(1.5, tile * 0.07)
    c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6)
    c.restore()
  }

  // 文字标签
  if (draft.labels.length > 0) {
    c.fillStyle = inkRgba(pal.ink, 0.85)
    drawLabels(c, labelsForDraw(), tile)
  }

  // 选中框 + 锚点
  const selected = draft.labels.find((l) => l.id === props.selectedLabelId)
  if (selected) {
    const box = labelBox(selected)
    c.save()
    c.setLineDash([4, 3])
    c.strokeStyle = inkRgba(pal.ink, 0.5)
    c.lineWidth = 1
    c.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)
    c.restore()

    const px = (selected.pos[0] + 0.5) * tile
    const py = (selected.pos[1] + 0.5) * tile
    const a = tile * 0.12
    c.strokeStyle = inkRgba(pal.ink, 0.5)
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(px - a, py)
    c.lineTo(px + a, py)
    c.moveTo(px, py - a)
    c.lineTo(px, py + a)
    c.stroke()
  }

  if (hover) drawHover(c, hover.x, hover.y)

  c.restore()
}

/** 空文本标签在编辑器里以占位文案参与绘制（与命中测试一致） */
function labelsForDraw(): LevelLabel[] {
  return props.draft.labels.map((l) => ({
    pos: { x: l.pos[0], y: l.pos[1] },
    text: displayText(l),
    size: l.size,
    align: l.align,
  }))
}

function redraw(): void {
  measure()
  draw()
}

function onPointerDown(e: PointerEvent): void {
  const cvs = canvasRef.value
  if (!cvs) return
  cvs.setPointerCapture(e.pointerId)
  active = true
  const p = toWorld(e)
  const { cols, rows } = props.draft

  if (props.tool === 'wall') {
    const target = snapWall(p.x, p.y, cols, rows)
    if (!isBorderWall(target, cols, rows)) {
      paintOn = !hasWall(props.draft, target)
      lastTarget = target
      emit('wall-set', { target, on: paintOn })
    } else {
      lastTarget = null
    }
  } else if (props.tool === 'start' || props.tool === 'goal') {
    emit('cell-pick', { cell: snapCell(p.x, p.y, cols, rows) })
  } else {
    const id = hitTestLabel(p.x, p.y)
    if (id) {
      draggingId = id
      emit('label-pick', { id })
    } else {
      emit('label-place', { pos: snapText(p.x, p.y, cols, rows) })
    }
  }
  draw()
}

function onPointerMove(e: PointerEvent): void {
  const p = toWorld(e)
  hover = p
  const { cols, rows } = props.draft

  if (active && props.tool === 'wall' && lastTarget) {
    const target = snapWall(p.x, p.y, cols, rows)
    const changed =
      !lastTarget || target.axis !== lastTarget.axis || target.k !== lastTarget.k || target.i !== lastTarget.i
    if (changed && !isBorderWall(target, cols, rows)) {
      lastTarget = target
      emit('wall-set', { target, on: paintOn })
    }
  } else if (active && draggingId) {
    emit('label-move', { id: draggingId, pos: snapText(p.x, p.y, cols, rows) })
  }
  draw()
}

function endStroke(e: PointerEvent): void {
  const cvs = canvasRef.value
  if (cvs && cvs.hasPointerCapture(e.pointerId)) cvs.releasePointerCapture(e.pointerId)
  active = false
  lastTarget = null
  draggingId = null
}

function onPointerLeave(): void {
  hover = null
  draw()
}

defineExpose({ draw })

watch(
  [
    () => props.draft,
    () => props.rev,
    () => props.tool,
    () => props.selectedLabelId,
    () => props.theme,
    () => props.locale,
  ],
  redraw,
)

onMounted(() => {
  const cvs = canvasRef.value
  if (cvs) ctx = cvs.getContext('2d')
  measure()
  draw()
  if (cvs && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => redraw())
    observer.observe(cvs)
  }
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="editor-canvas"
    :style="{ background: paper }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endStroke"
    @pointercancel="endStroke"
    @pointerleave="onPointerLeave"
  ></canvas>
</template>

<style scoped>
.editor-canvas {
  display: block;
  width: min(92vw, 62vh, 720px);
  height: min(92vw, 62vh, 720px);
  border: 1px solid var(--line);
  touch-action: none;
}
</style>
