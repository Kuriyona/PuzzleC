<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Level, Vec2 } from '../types'
import { computeVisibility, createVisibility, isVisible } from '../game/visibility'
import { PLAYER_R } from '../game/collision'

const props = defineProps<{ level: Level; radius: number; animations: boolean }>()

/** 墙线亮度档数（同一档的线段合并为一次 stroke） */
const LEVELS = 16

const canvasRef = ref<HTMLCanvasElement | null>(null)

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
  const tile = tileSize()
  const worldW = level.cols * tile
  const worldH = level.rows * tile

  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.fillStyle = '#000'
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
  const grad = c.createRadialGradient(pxw, pyw, 0, pxw, pyw, R)
  grad.addColorStop(0, 'rgba(255,255,255,0.42)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.27)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.15)')
  grad.addColorStop(0.75, 'rgba(255,255,255,0.05)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')

  const fan = vis.fan
  c.save()
  c.translate(ox, oy)
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

  // 墙线：只画可见墙段，亮度由线段中点到玩家的距离决定
  c.save()
  c.translate(ox, oy)
  c.lineWidth = Math.max(1, tile * 0.07)
  const lit = vis.lit
  for (let b = 1; b < LEVELS; b++) {
    const v = Math.round(255 * 0.95 * (b / (LEVELS - 1)))
    c.strokeStyle = `rgb(${v},${v},${v})`
    c.beginPath()
    for (let i = 0; i < lit.length; i += 4) {
      const x0 = lit[i]
      const y0 = lit[i + 1]
      const x1 = lit[i + 2]
      const y1 = lit[i + 3]
      const d = Math.hypot((x0 + x1) / 2 - player.x, (y0 + y1) / 2 - player.y)
      const p = 1 - d / props.radius
      if (p <= 0) continue
      if (Math.round(Math.pow(p, 0.8) * (LEVELS - 1)) !== b) continue
      c.moveTo((x0 + 0.5) * tile, (y0 + 0.5) * tile)
      c.lineTo((x1 + 0.5) * tile, (y1 + 0.5) * tile)
    }
    c.stroke()
  }

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
    c.strokeStyle = `rgba(255,255,255,${alpha})`
    c.lineWidth = Math.max(1.5, tile * 0.06)
    c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6)
    c.restore()
  }

  const rr =
    tile *
    PLAYER_R *
    (props.animations ? 1 + 0.07 * Math.sin((now / 1000) * ((Math.PI * 2) / 1.6)) : 1)
  c.fillStyle = '#fff'
  c.beginPath()
  c.arc(pxw, pyw, rr, 0, Math.PI * 2)
  c.fill()

  c.restore()
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
  <canvas ref="canvasRef" class="maze"></canvas>
</template>

<style scoped>
.maze {
  display: block;
  width: min(92vw, 74vh, 860px);
  height: min(92vw, 74vh, 860px);
  background: #000;
  border: 1px solid var(--line);
}
</style>
