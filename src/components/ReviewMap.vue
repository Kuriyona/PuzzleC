<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Level, ThemeId, Vec2 } from '../types'
import { sampleTrail } from '../game/trail'
import { PLAYER_R } from '../game/collision'
import { addLevelWalls, wallLineWidth } from '../render/walls'
import { CANVAS_PALETTES, inkRgba } from '../render/palette'
import { useT } from '../i18n/useI18n'

const props = defineProps<{
  level: Level
  points: number[]
  times: number[]
  theme: ThemeId
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const t = useT()
/** 元素底色用迷宫主题的 paper（不是 --bg，那是 UI 主题）：首帧之前不留异色底 */
const paper = computed(() => CANVAS_PALETTES[props.theme].paper)

let ctx: CanvasRenderingContext2D | null = null
let side = 0
let dpr = 1
let observer: ResizeObserver | null = null
const dot: Vec2 = { x: 0, y: 0 }

function measure(): void {
  const cvs = canvasRef.value
  if (!cvs) return
  const rect = cvs.getBoundingClientRect()
  side = Math.max(1, Math.floor(Math.min(rect.width, rect.height)))
  dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  cvs.width = Math.round(side * dpr)
  cvs.height = Math.round(side * dpr)
}

/**
 * 全图绘制：无遮挡、无衰减，所有墙段等亮度。
 * 完整轨迹画淡色，按 ms 已走过的部分画亮色，并在插值位置画光点。
 */
function renderFrame(ms: number): void {
  const cvs = canvasRef.value
  const c = ctx
  if (!cvs || !c || side <= 0) return
  const { level, points, times } = props
  const pal = CANVAS_PALETTES[props.theme]

  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.fillStyle = pal.paper
  c.fillRect(0, 0, side, side)

  const margin = Math.max(3, side * 0.015)
  const tile = Math.min((side - margin * 2) / level.cols, (side - margin * 2) / level.rows)
  const ox = (side - level.cols * tile) / 2
  const oy = (side - level.rows * tile) / 2

  c.save()
  c.translate(ox, oy)
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.lineWidth = wallLineWidth(tile)

  // 全部墙段：与游戏内一致的实体墙几何（连续坐标 c → 像素 (c + 0.5) * tile）
  c.strokeStyle = inkRgba(pal.ink, 0.55)
  c.beginPath()
  addLevelWalls(c, level, tile)
  c.stroke()

  const n = times.length
  if (n > 0) {
    // 完整轨迹（淡）
    c.strokeStyle = inkRgba(pal.ink, 0.16)
    c.lineWidth = Math.max(1.5, tile * 0.1)
    c.beginPath()
    c.moveTo((points[0] + 0.5) * tile, (points[1] + 0.5) * tile)
    for (let i = 1; i < n; i++) {
      c.lineTo((points[2 * i] + 0.5) * tile, (points[2 * i + 1] + 0.5) * tile)
    }
    c.stroke()

    // 已走过的部分（亮）+ 末端插值点
    const idx = sampleTrail(points, times, ms, dot)
    c.strokeStyle = inkRgba(pal.ink, 0.9)
    c.beginPath()
    c.moveTo((points[0] + 0.5) * tile, (points[1] + 0.5) * tile)
    for (let i = 1; i <= idx; i++) {
      c.lineTo((points[2 * i] + 0.5) * tile, (points[2 * i + 1] + 0.5) * tile)
    }
    if (idx < n - 1) c.lineTo((dot.x + 0.5) * tile, (dot.y + 0.5) * tile)
    c.stroke()

    // 光点
    c.fillStyle = inkRgba(pal.ink, 1)
    c.beginPath()
    c.arc((dot.x + 0.5) * tile, (dot.y + 0.5) * tile, tile * PLAYER_R, 0, Math.PI * 2)
    c.fill()
  }

  // 起点：空心小圆
  c.strokeStyle = inkRgba(pal.ink, 0.6)
  c.lineWidth = Math.max(1, tile * 0.06)
  c.beginPath()
  c.arc((level.start.x + 0.5) * tile, (level.start.y + 0.5) * tile, tile * 0.16, 0, Math.PI * 2)
  c.stroke()

  // 终点：菱形（与游戏内标记一致）
  c.save()
  c.translate((level.goal.x + 0.5) * tile, (level.goal.y + 0.5) * tile)
  c.rotate(Math.PI / 4)
  const r = tile * 0.28
  c.strokeStyle = inkRgba(pal.ink, 0.95)
  c.lineWidth = Math.max(1.5, tile * 0.07)
  c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6)
  c.restore()

  c.restore()
}

defineExpose({ renderFrame })

watch(
  () => props.level,
  () => renderFrame(0),
  { immediate: true },
)

onMounted(() => {
  const cvs = canvasRef.value
  if (cvs) ctx = cvs.getContext('2d')
  measure()
  renderFrame(0)
  if (cvs && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      measure()
      renderFrame(props.times.length ? props.times[props.times.length - 1] : 0)
    })
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
    class="overview"
    :style="{ background: paper }"
    :aria-label="t('game.reviewMap')"
  ></canvas>
</template>

<style scoped>
.overview {
  display: block;
  width: min(92vw, 58vh, 820px);
  height: min(92vw, 58vh, 820px);
  border: 1px solid var(--line);
}
</style>
