<script setup lang="ts">
import { computed } from 'vue'
import type { GenParams } from '../types'
import {
  MAX_MAZE_SIZE,
  MAX_RADIUS,
  MIN_MAZE_SIZE,
  MIN_RADIUS,
  RADIUS_OPTIONS,
  SIZE_OPTIONS,
  clampMazeSize,
  clampRadius,
  mazeSizeOf,
  parseSeed,
  radiusOf,
} from '../game/gen'
import { useT } from '../i18n/useI18n'

const model = defineModel<GenParams>({ required: true })
defineEmits<{ start: []; back: [] }>()

const t = useT()

function apply(patch: Partial<GenParams>): void {
  model.value = { ...model.value, ...patch }
}

/** 自定义输入：写入前 clamp，并把 clamp 后的值回写到输入框（输入 999 会立刻显示上限） */
function onCustomSize(event: Event): void {
  const input = event.target as HTMLInputElement
  const raw = Number(input.value)
  const next = clampMazeSize(Number.isFinite(raw) ? raw : model.value.sizeCustom)
  input.value = String(next)
  apply({ sizeCustom: next })
}

function onCustomRadius(event: Event): void {
  const input = event.target as HTMLInputElement
  const raw = Number(input.value)
  const next = clampRadius(Number.isFinite(raw) ? raw : model.value.radiusCustom)
  input.value = String(next)
  apply({ radiusCustom: next })
}

/** 这局实际会用的参数（含自定义与 clamp 结果），留空的种子显示为「随机」 */
const summary = computed(() => {
  const size = mazeSizeOf(model.value)
  return t('start.summary', {
    size: `${size}×${size}`,
    radius: radiusOf(model.value),
    seed: parseSeed(model.value.seed) === null ? t('start.seedRandom') : model.value.seed.trim(),
  })
})
</script>

<template>
  <section class="start rise">
    <header class="head">
      <h2>{{ t('start.title') }}</h2>
      <button class="interactive back" @click="$emit('back')">{{ t('common.back') }}</button>
    </header>

    <div class="rows">
      <div class="row">
        <span class="label">{{ t('start.mode') }}</span>
        <div class="seg">
          <!-- 当前版本只有这一个模式，先按单选按钮的样子摆出来，后面加模式不用改版式 -->
          <button class="interactive seg-btn is-active">{{ t('start.mode.random') }}</button>
        </div>
      </div>

      <p class="hint">{{ t('start.mode.randomHint') }}</p>

      <div class="row">
        <span class="label">{{ t('start.size') }}</span>
        <div class="seg">
          <button
            v-for="opt in SIZE_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.sizePreset === opt.id }"
            @click="apply({ sizePreset: opt.id })"
          >
            {{ t(opt.labelKey) }} · {{ opt.cells }}
          </button>
          <button
            class="interactive seg-btn"
            :class="{ 'is-active': model.sizePreset === 'custom' }"
            @click="apply({ sizePreset: 'custom' })"
          >
            {{ t('start.custom') }}
          </button>
          <span v-if="model.sizePreset === 'custom'" class="amount">
            <input
              class="interactive field"
              type="number"
              :min="MIN_MAZE_SIZE"
              :max="MAX_MAZE_SIZE"
              :value="model.sizeCustom"
              @change="onCustomSize"
            />
            <span class="unit">{{ t('start.cells') }}</span>
          </span>
        </div>
      </div>

      <div class="row">
        <span class="label">{{ t('start.radius') }}</span>
        <div class="seg">
          <button
            v-for="opt in RADIUS_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.radiusPreset === opt.id }"
            @click="apply({ radiusPreset: opt.id })"
          >
            {{ t(opt.labelKey) }} · {{ opt.value }}
          </button>
          <button
            class="interactive seg-btn"
            :class="{ 'is-active': model.radiusPreset === 'custom' }"
            @click="apply({ radiusPreset: 'custom' })"
          >
            {{ t('start.custom') }}
          </button>
          <span v-if="model.radiusPreset === 'custom'" class="amount">
            <input
              class="interactive field"
              type="number"
              :min="MIN_RADIUS"
              :max="MAX_RADIUS"
              :value="model.radiusCustom"
              @change="onCustomRadius"
            />
            <span class="unit">{{ t('start.cells') }}</span>
          </span>
        </div>
      </div>

      <div class="row">
        <span class="label">{{ t('start.seed') }}</span>
        <div class="seg seed-row">
          <input
            class="interactive field seed"
            type="text"
            :value="model.seed"
            :placeholder="t('start.seedPlaceholder')"
            @input="apply({ seed: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>

      <p class="hint">{{ t('start.seedHint') }}</p>
    </div>

    <footer class="foot">
      <span class="summary">{{ summary }}</span>
      <button class="interactive go" @click="$emit('start')">{{ t('start.go') }}</button>
    </footer>
  </section>
</template>

<style scoped>
.start {
  width: min(92vw, 620px);
  /* 矮窗口下内容比视口高：让本面板自己滚动，别被 body 的 overflow: hidden 裁掉底部按钮
     （.app 的高度由 min-height 决定，百分比 max-height 解析不出来，所以按视口算，减去 .app 的 24px 内边距） */
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head h2 {
  margin: 0;
  font-weight: 300;
  font-size: 20px;
  letter-spacing: 0.3em;
}

.back {
  padding: 8px 16px;
  font-size: 12px;
  letter-spacing: 0.16em;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--line);
  padding: 14px 16px;
}

.label {
  width: 120px;
  flex: none;
  font-size: 13px;
  letter-spacing: 0.14em;
  color: var(--fg-dim);
}

.seg {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.seg-btn {
  padding: 9px 14px;
  font-size: 12px;
  letter-spacing: 0.1em;
}

.amount {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field {
  padding: 7px 10px;
  width: 96px;
  min-width: 0;
  font-size: 12px;
}

.seed-row {
  flex: 1;
}

.seed {
  flex: 1;
  min-width: 160px;
}

.unit {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
}

.hint {
  margin: -4px 0 0;
  padding-left: 136px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--fg-faint);
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.summary {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
}

.go {
  padding: 11px 20px;
  font-size: 13px;
  letter-spacing: 0.2em;
}
</style>
