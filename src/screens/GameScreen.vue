<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { GameStatus, Level, Settings, Vec2 } from '../types'
import { SIZE_OPTIONS, generateMaze } from '../game/maze'
import { radiusValue, sizeCells } from '../game/settings'
import { PLAYER_R, moveWithCollision } from '../game/collision'
import { seedLabel } from '../game/rng'
import { createTrail } from '../game/trail'
import MazeCanvas from '../components/MazeCanvas.vue'
import HudBar from '../components/HudBar.vue'
import OverlayPanel from '../components/OverlayPanel.vue'
import ReviewMap from '../components/ReviewMap.vue'

const props = defineProps<{ settings: Settings; seed: number; levelIndex: number }>()
const emit = defineEmits<{ next: []; exit: [] }>()

const SPEED = 3.2 // 格/秒
const ACCEL_TAU = 0.06 // 秒
const WIN_R = 0.3 // 距目标中心的通关半径（格）
const MOVE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'a',
  's',
  'd',
  'W',
  'A',
  'S',
  'D',
])

const canvasRef = ref<InstanceType<typeof MazeCanvas> | null>(null)

const cells = computed(() => sizeCells(props.settings.size))
const radius = computed(() => radiusValue(props.settings.radius))
const sizeHint = computed(
  () => SIZE_OPTIONS.find((o) => o.id === props.settings.size)?.hint ?? String(cells.value),
)

const level = ref<Level>(generateMaze(cells.value, cells.value, props.seed))
const status = ref<GameStatus>('playing')
const startedAt = ref(performance.now())
const pausedAccumMs = ref(0)
const pausedAt = ref(0)
const elapsedMs = ref(0)
const traveled = ref(0)

const pressed = new Set<string>()
const pos: Vec2 = { x: 0, y: 0 }
const vel: Vec2 = { x: 0, y: 0 }
const next: Vec2 = { x: 0, y: 0 }
const trail = createTrail()

let rafId = 0
let tickId = 0
let last = 0

function elapsedNow(): number {
  return performance.now() - startedAt.value - pausedAccumMs.value
}

function resetLevel(): void {
  level.value = generateMaze(cells.value, cells.value, props.seed)
  pos.x = level.value.start.x
  pos.y = level.value.start.y
  vel.x = 0
  vel.y = 0
  trail.reset(pos.x, pos.y)
  traveled.value = 0
  status.value = 'playing'
  startedAt.value = performance.now()
  pausedAccumMs.value = 0
  pausedAt.value = 0
  elapsedMs.value = 0
  pressed.clear()
}

function pauseGame(): void {
  if (status.value !== 'playing') return
  status.value = 'paused'
  pausedAt.value = performance.now()
  pressed.clear()
  vel.x = 0
  vel.y = 0
}

function resumeGame(): void {
  if (status.value !== 'paused') return
  pausedAccumMs.value += performance.now() - pausedAt.value
  status.value = 'playing'
}

function togglePause(): void {
  if (status.value === 'playing') pauseGame()
  else if (status.value === 'paused') resumeGame()
}

function onKeyDown(e: KeyboardEvent): void {
  if (MOVE_KEYS.has(e.key)) {
    pressed.add(e.key)
    e.preventDefault()
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    togglePause()
    return
  }
  if (e.key === 'r' || e.key === 'R') {
    if (status.value !== 'won') resetLevel()
  }
}

function onKeyUp(e: KeyboardEvent): void {
  pressed.delete(e.key)
}

function onBlur(): void {
  pressed.clear()
}

function frame(now: number): void {
  rafId = window.requestAnimationFrame(frame)
  const dt = last === 0 ? 16 : Math.min(50, now - last)
  last = now

  if (status.value === 'playing') {
    const dtSec = dt / 1000
    const right = pressed.has('ArrowRight') || pressed.has('d') || pressed.has('D')
    const left = pressed.has('ArrowLeft') || pressed.has('a') || pressed.has('A')
    const down = pressed.has('ArrowDown') || pressed.has('s') || pressed.has('S')
    const up = pressed.has('ArrowUp') || pressed.has('w') || pressed.has('W')
    let ax = (right ? 1 : 0) - (left ? 1 : 0)
    let ay = (down ? 1 : 0) - (up ? 1 : 0)
    if (ax !== 0 && ay !== 0) {
      ax *= Math.SQRT1_2
      ay *= Math.SQRT1_2
    }
    const tvx = ax * SPEED
    const tvy = ay * SPEED
    if (props.settings.animations) {
      const a = 1 - Math.exp(-dtSec / ACCEL_TAU)
      vel.x += (tvx - vel.x) * a
      vel.y += (tvy - vel.y) * a
    } else {
      vel.x = tvx
      vel.y = tvy
    }
    moveWithCollision(level.value, pos, vel.x * dtSec, vel.y * dtSec, PLAYER_R, next)
    traveled.value += Math.hypot(next.x - pos.x, next.y - pos.y)
    pos.x = next.x
    pos.y = next.y
    trail.push(pos.x, pos.y)
    if (Math.hypot(pos.x - level.value.goal.x, pos.y - level.value.goal.y) < WIN_R) {
      vel.x = 0
      vel.y = 0
      elapsedMs.value = elapsedNow()
      status.value = 'won'
    }
  }

  if (status.value !== 'paused') canvasRef.value?.renderFrame(now, dt, pos)
}

function formatTime(ms: number): string {
  const mm = String(Math.floor(ms / 60000)).padStart(2, '0')
  const ss = String(Math.floor(ms / 1000) % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const pausedActions = computed(() => [
  { label: '继续', primary: true, onClick: resumeGame },
  { label: '重开本关', onClick: resetLevel },
  { label: '返回菜单', onClick: () => emit('exit') },
])

const wonActions = computed(() => [
  { label: '查看回顾', primary: true, onClick: () => (status.value = 'review') },
  { label: '下一关', onClick: () => emit('next') },
  { label: '返回菜单', onClick: () => emit('exit') },
])

const statsLines = computed(() => [
  `用时 ${formatTime(elapsedMs.value)}`,
  `距离 ${traveled.value.toFixed(1)}`,
  `迷宫 ${sizeHint.value} · 视野 ${radius.value}`,
  `种子 ${seedLabel(props.seed)}`,
])

watch(
  () => props.seed,
  () => resetLevel(),
)

onMounted(() => {
  resetLevel()
  last = 0
  rafId = window.requestAnimationFrame(frame)
  tickId = window.setInterval(() => {
    if (status.value === 'playing') elapsedMs.value = elapsedNow()
    else if (status.value === 'paused') {
      elapsedMs.value = pausedAt.value - startedAt.value - pausedAccumMs.value
    }
  }, 250)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
})

onUnmounted(() => {
  window.cancelAnimationFrame(rafId)
  window.clearInterval(tickId)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
})
</script>

<template>
  <section class="game">
    <template v-if="status === 'review'">
      <header class="review-head">
        <h2 class="rise">轨迹回顾</h2>
        <ul class="stats rise" style="animation-delay: 80ms">
          <li v-for="(line, i) in statsLines" :key="i">{{ line }}</li>
        </ul>
      </header>
      <ReviewMap class="rise" style="animation-delay: 140ms" :level="level" :path="trail.points" />
      <nav class="review-actions rise" style="animation-delay: 200ms">
        <button class="interactive act is-active" @click="emit('next')">下一关</button>
        <button class="interactive act" @click="resetLevel">重玩本关</button>
        <button class="interactive act" @click="emit('exit')">返回菜单</button>
      </nav>
    </template>
    <template v-else>
      <HudBar
        :level-index="levelIndex"
        :size-hint="sizeHint"
        :radius="radius"
        :distance="traveled"
        :elapsed-ms="elapsedMs"
        :seed="seed"
        @pause="togglePause"
        @restart="resetLevel"
      />
      <div class="stage">
        <MazeCanvas
          ref="canvasRef"
          :level="level"
          :radius="radius"
          :animations="settings.animations"
        />
        <OverlayPanel
          v-if="status === 'paused'"
          key="paused"
          title="已暂停"
          :lines="[]"
          :actions="pausedActions"
        />
        <OverlayPanel
          v-else-if="status === 'won'"
          key="won"
          title="通关"
          :lines="statsLines"
          :actions="wonActions"
        />
      </div>
      <p class="hint">ESC 暂停 · R 重开</p>
    </template>
  </section>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.review-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  text-align: center;
}

.review-head h2 {
  margin: 0;
  font-weight: 300;
  font-size: 18px;
  letter-spacing: 0.3em;
}

.stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
}

.review-actions {
  display: flex;
  gap: 8px;
}

.act {
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.12em;
}

.stage {
  position: relative;
  display: grid;
  place-items: center;
}

.hint {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--fg-faint);
}
</style>
