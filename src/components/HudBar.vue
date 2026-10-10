<script setup lang="ts">
import { seedLabel } from '../game/rng'
import { useT } from '../i18n/useI18n'

defineProps<{
  levelIndex: number
  sizeHint: string
  radius: number
  distance: number
  elapsedMs: number
  seed: number
}>()

defineEmits<{ pause: []; restart: [] }>()

const t = useT()

function formatTime(ms: number): string {
  const mm = String(Math.floor(ms / 60000)).padStart(2, '0')
  const ss = String(Math.floor(ms / 1000) % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
</script>

<template>
  <header class="hud">
    <div class="stats">
      <span>{{ t('game.hud.level', { level: levelIndex }) }}</span>
      <i></i><span>{{ t('game.stats.distance', { distance: distance.toFixed(1) }) }}</span>
      <i></i><span>{{ t('game.stats.time', { time: formatTime(elapsedMs) }) }}</span>
      <i></i><span>{{ t('game.hud.maze', { size: sizeHint }) }}</span>
      <i></i><span>{{ t('game.hud.radius', { radius }) }}</span>
      <i></i><span>{{ t('game.stats.seed', { seed: seedLabel(seed) }) }}</span>
    </div>
    <div class="controls">
      <button class="interactive btn" @click="$emit('pause')">{{ t('game.hud.pause') }}</button>
      <button class="interactive btn" @click="$emit('restart')">{{ t('game.hud.restart') }}</button>
    </div>
  </header>
</template>

<style scoped>
.hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.stats {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stats i {
  display: inline-block;
  width: 1px;
  height: 12px;
  background: var(--line);
}

.controls {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 7px 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
}
</style>
