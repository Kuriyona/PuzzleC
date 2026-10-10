<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Level, ThemeId, Vec2 } from '../types'
import { computeVisibility, createVisibility, isVisible } from '../game/visibility'
import { PLAYER_R } from '../game/collision'
import { addLitWalls, wallGradient, wallLineWidth } from '../render/walls'
import { CANVAS_PALETTES, inkRgba } from '../render/palette'

const props = defineProps<{ level: Level; radius: number; animations: boolean; theme: ThemeId }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
/** 元素底色用迷宫主题的 paper（不是 --bg，那是 UI 主题）：首帧之前不留异色底 */
const paper = computed(() => CANVAS_PALETTES[props.theme].paper)

let ctx: CanvasRenderingContext2D | null = null
let side = 0
let dpr = 1
let camReady = false
let observer: ResizeObserver | null = null
const cam = { x: 0, y: 0 }
const vis = createVisibility()

function measure(): void {
  const cvs = canvasRef.value
  if (!cvs) return
  const rect = cvs.getBoundingClientRect()
  side = Math.max(1, Math.floor(Math.min(rect.width, rect.height)))
  dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  cvs.width = Math.round(side * dpr)
  cvs.height = Math.round(side * dpr)
}

/** 每格的世界像素边长：小迷宫铺满画布，大迷宫按视野窗口取格宽。 */
function tileSize(): number {
  const span = Math.min(2 * props.radius + 1, Math.max(props.level.cols, props.level.rows))
  return side / span
}

function renderFrame(now: number, dt: number, player: Vec2): void {
  const cvs = canvasRef.value
  const c = ctx
  if (!cvs || !c) return
  const level = props.level
  const pal = CANVAS_PALETTES[props.theme]
  const tile = tileSize()
  const worldW = level.cols * tile
  const worldH = level.rows * tile

  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.fillStyle = pal.paper
  c.fillRect(0, 0, side, side)

  const pxw = (player.x + 0.5) * tile
  const pyw = (player.y + 0.5) * tile
  const camTargetX = worldW <= side ? worldW / 2 : Math.min(Math.max(pxw, side / 2), worldW - side / 2)
  const camTargetY = worldH <= side ? worldH / 2 : Math.min(Math.max(pyw, side / 2), worldH - side / 2)
  if (!camReady) {
    cam.x = camTargetX
    cam.y = camTargetY
    camReady = true
  } else if (props.animations) {
    const a = 1 - Math.exp(-dt / 60)
    cam.x += (camTargetX - cam.x) * a
    cam.y += (camTargetY - cam.y) * a
  } else {
    cam.x = camTargetX
    cam.y = camTargetY
  }
  const camRx = Math.round(cam.x)
  const camRy = Math.round(cam.y)
  const ox = Math.round(side / 2 - camRx)
  const oy = Math.round(side / 2 - camRy)

  // 视野：从玩家精确位置对墙线段做几何遮挡
  computeVisibility(level, player, props.radius, vis)
  const R = props.radius * tile
  const fan = vis.fan
  c.save()
  c.translate(ox, oy)

  // 视野 / 墙体 / 目标 / 光点统一在世界坐标系绘制（单次相机偏移，避免漏加导致漂移）
  const grad = c.createRadialGradient(pxw, pyw, 0, pxw, pyw, R)
  grad.addColorStop(0, inkRgba(pal.ink, 0.42))
  grad.addColorStop(0.25, inkRgba(pal.ink, 0.27))
  grad.addColorStop(0.5, inkRgba(pal.ink, 0.15))
  grad.addColorStop(0.75, inkRgba(pal.ink, 0.05))
  grad.addColorStop(1, inkRgba(pal.ink, 0))

  // 裁剪单独 save/restore：墙体正好压在扇形边界上，共用会被削掉一半
  c.save()
  if (fan.length >= 6) {
    c.beginPath()
    c.moveTo((fan[0] + 0.5) * tile, (fan[1] + 0.5) * tile)
    for (let i = 2; i < fan.length; i += 2) {
      c.lineTo((fan[i] + 0.5) * tile, (fan[i + 1] + 0.5) * tile)
    }
    c.closePath()
    c.clip()
  }
  c.fillStyle = grad
  c.fillRect(-tile, -tile, worldW + 2 * tile, worldH + 2 * tile)
  c.restore()

  // 墙体：有厚度的实体墙（圆角端 / 连接），亮度随距玩家的距离由径向渐变连续衰减
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.lineWidth = wallLineWidth(tile)
  c.strokeStyle = wallGradient(c, pxw, pyw, R, pal.ink)
  c.beginPath()
  addLitWalls(c, vis.lit, tile)
  c.stroke()

  if (isVisible(level, player, level.goal, props.radius)) {
    const dGoal = Math.hypot(level.goal.x - player.x, level.goal.y - player.y)
    const gl = Math.max(0, 1 - dGoal / props.radius)
    const alpha = Math.min(1, Math.max(0.3, gl * 5))
    const pulse = props.animations
      ? 0.27 + 0.03 * Math.sin((now / 1000) * ((Math.PI * 2) / 1.6))
      : 0.28
    const r = tile * pulse
    c.save()
    c.translate((level.goal.x + 0.5) * tile, (level.goal.y + 0.5) * tile)
    c.rotate(Math.PI / 4)
    c.strokeStyle = inkRgba(pal.ink, alpha)
    c.lineWidth = Math.max(1.5, tile * 0.06)
    c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6)
    c.restore()
  }

  const rr =
    tile *
    PLAYER_R *
    (props.animations ? 1 + 0.07 * Math.sin((now / 1000) * ((Math.PI * 2) / 1.6)) : 1)
  c.fillStyle = inkRgba(pal.ink, 1)
  c.beginPath()
  c.arc(pxw, pyw, rr, 0, Math.PI * 2)
  c.fill()

  c.restore() // 关闭世界坐标系
}

defineExpose({ renderFrame })

watch(
  () => props.level,
  () => {
    camReady = false
  },
  { immediate: true },
)

onMounted(() => {
  const cvs = canvasRef.value
  if (cvs) ctx = cvs.getContext('2d')
  measure()
  if (cvs && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    observer.observe(cvs)
  }
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <canvas ref="canvasRef" class="maze" :style="{ background: paper }"></canvas>
</template>

<style scoped>
.maze {
  display: block;
  width: min(92vw, 74vh, 860px);
  height: min(92vw, 74vh, 860px);
  border: 1px solid var(--line);
}
</style>
