<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Level } from '../types'

const props = defineProps<{ level: Level; path: number[] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let side = 0
let dpr = 1
let observer: ResizeObserver | null = null

function measure(): void {
  const cvs = canvasRef.value
  if (!cvs) return
  const rect = cvs.getBoundingClientRect()
  side = Math.max(1, Math.floor(Math.min(rect.width, rect.height)))
  dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  cvs.width = Math.round(side * dpr)
  cvs.height = Math.round(side * dpr)
}

/** 全图绘制：无遮挡、无衰减，所有墙段等亮度；叠加轨迹与起终点。 */
function draw(): void {
  const cvs = canvasRef.value
  const c = ctx
  if (!cvs || !c || side <= 0) return
  const { level, path } = props

  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.fillStyle = '#000'
  c.fillRect(0, 0, side, side)

  const margin = Math.max(2, side * 0.012)
  const tile = Math.min((side - margin * 2) / level.cols, (side - margin * 2) / level.rows)
  const ox = (side - level.cols * tile) / 2
  const oy = (side - level.rows * tile) / 2

  c.save()
  c.translate(ox, oy)
  c.lineWidth = Math.max(1, tile * 0.07)
  c.lineCap = 'round'
  c.lineJoin = 'round'

  // 全部墙段（连续坐标 c → 像素 (c + 0.5) * tile；墙线索引 k 落在像素 k * tile）
  const { cols, rows, vWalls, hWalls } = level
  c.strokeStyle = 'rgba(255,255,255,0.55)'
  c.beginPath()
  for (let k = 0; k <= cols; k++) {
    const x = k * tile
    for (let y = 0; y < rows; y++) {
      if (vWalls[y * (cols + 1) + k] !== 1) continue
      c.moveTo(x, y * tile)
      c.lineTo(x, (y + 1) * tile)
    }
  }
  for (let k = 0; k <= rows; k++) {
    const y = k * tile
    for (let x = 0; x < cols; x++) {
      if (hWalls[k * cols + x] !== 1) continue
      c.moveTo(x * tile, y)
      c.lineTo((x + 1) * tile, y)
    }
  }
  c.stroke()

  // 轨迹折线
  if (path.length >= 4) {
    c.strokeStyle = 'rgba(255,255,255,0.9)'
    c.lineWidth = Math.max(1.5, tile * 0.11)
    c.beginPath()
    c.moveTo((path[0] + 0.5) * tile, (path[1] + 0.5) * tile)
    for (let i = 2; i < path.length; i += 2) {
      c.lineTo((path[i] + 0.5) * tile, (path[i + 1] + 0.5) * tile)
    }
    c.stroke()
  }

  // 起点：空心小圆
  c.strokeStyle = 'rgba(255,255,255,0.6)'
  c.lineWidth = Math.max(1, tile * 0.06)
  c.beginPath()
  c.arc((level.start.x + 0.5) * tile, (level.start.y + 0.5) * tile, tile * 0.16, 0, Math.PI * 2)
  c.stroke()

  // 终点：菱形（与游戏内标记一致）
  c.save()
  c.translate((level.goal.x + 0.5) * tile, (level.goal.y + 0.5) * tile)
  c.rotate(Math.PI / 4)
  const r = tile * 0.28
  c.strokeStyle = 'rgba(255,255,255,0.95)'
  c.lineWidth = Math.max(1.5, tile * 0.07)
  c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6)
  c.restore()

  c.restore()
}

watch(
  () => props.level,
  () => draw(),
  { immediate: true },
)

onMounted(() => {
  const cvs = canvasRef.value
  if (cvs) ctx = cvs.getContext('2d')
  measure()
  draw()
  if (cvs && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      measure()
      draw()
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
  <canvas ref="canvasRef" class="overview" aria-label="迷宫全图与轨迹"></canvas>
</template>

<style scoped>
.overview {
  display: block;
  width: min(92vw, 62vh, 820px);
  height: min(92vw, 62vh, 820px);
  background: #000;
  border: 1px solid var(--line);
}
</style>
