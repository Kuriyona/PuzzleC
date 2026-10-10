<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useGamepad } from '../input/useGamepad'
import { sampleStick } from '../input/touch'
import type { StickSample } from '../input/touch'

const input = useGamepad()

const baseRef = ref<HTMLDivElement | null>(null)
const knobRef = ref<HTMLDivElement | null>(null)
const active = ref(false)

/** 复用缓冲：指针移动只写 DOM，不进响应式热路径 */
const sample: StickSample = { x: 0, y: 0, knobX: 0, knobY: 0 }
let pointerId: number | null = null

/** 旋钮位置直接写 style，避免每次移动都产生响应式更新 */
function setKnobOffset(x: number, y: number): void {
  const knob = knobRef.value
  if (knob) knob.style.transform = `translate(${x}px, ${y}px)`
}

function update(event: PointerEvent): void {
  const base = baseRef.value
  if (!base) return
  const rect = base.getBoundingClientRect()
  const radius = rect.width / 2
  sampleStick(event.clientX - rect.left - radius, event.clientY - rect.top - radius, radius, sample)
  setKnobOffset(sample.knobX, sample.knobY)
  input.setTouchAxes(sample.x, sample.y)
}

function onDown(event: PointerEvent): void {
  if (pointerId !== null) return
  pointerId = event.pointerId
  active.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  update(event)
  event.preventDefault()
}

function onMove(event: PointerEvent): void {
  if (event.pointerId === pointerId) update(event)
}

function release(event: PointerEvent): void {
  if (event.pointerId !== pointerId) return
  pointerId = null
  active.value = false
  setKnobOffset(0, 0)
  input.setTouchAxes(0, 0)
}

// 摇杆卸载（暂停、离开游戏界面）时必须归零，否则残余轴会一直推动玩家
onUnmounted(() => input.setTouchAxes(0, 0))
</script>

<template>
  <div
    ref="baseRef"
    class="stick"
    :class="{ 'is-active': active }"
    role="presentation"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="release"
    @pointercancel="release"
  >
    <div ref="knobRef" class="knob"></div>
  </div>
</template>

<style scoped>
/* 中灰半透明：迷宫画布可能是纯黑或纯白底，只能用两套主题都能看见的中性色 */
.stick {
  position: fixed;
  left: max(18px, env(safe-area-inset-left));
  bottom: max(18px, env(safe-area-inset-bottom));
  width: min(38vw, 148px);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid rgba(128, 128, 128, 0.55);
  background: rgba(128, 128, 128, 0.12);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  z-index: 20;
}

.stick.is-active {
  border-color: rgba(128, 128, 128, 0.85);
  background: rgba(128, 128, 128, 0.2);
}

.knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 44%;
  height: 44%;
  margin: -22% 0 0 -22%;
  border-radius: 50%;
  border: 2px solid rgba(128, 128, 128, 0.85);
  background: rgba(128, 128, 128, 0.45);
  pointer-events: none;
}
</style>
