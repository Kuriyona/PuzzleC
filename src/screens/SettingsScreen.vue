<script setup lang="ts">
import type { Settings } from '../types'
import { SIZE_OPTIONS } from '../game/maze'
import { MAZE_THEME_OPTIONS, RADIUS_OPTIONS, UI_THEME_OPTIONS, DEFAULT_SETTINGS } from '../game/settings'

const model = defineModel<Settings>({ required: true })
defineEmits<{ back: [] }>()

function apply(patch: Partial<Settings>): void {
  model.value = { ...model.value, ...patch }
}

function restoreDefaults(): void {
  model.value = { ...DEFAULT_SETTINGS }
}
</script>

<template>
  <section class="settings rise">
    <header class="head">
      <h2>设置</h2>
      <button class="interactive back" @click="$emit('back')">返回</button>
    </header>

    <div class="rows">
      <div class="row">
        <span class="label">界面主题</span>
        <div class="seg">
          <button
            v-for="opt in UI_THEME_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.uiTheme === opt.id }"
            @click="apply({ uiTheme: opt.id })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="row">
        <span class="label">迷宫主题</span>
        <div class="seg">
          <button
            v-for="opt in MAZE_THEME_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.mazeTheme === opt.id }"
            @click="apply({ mazeTheme: opt.id })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="row">
        <span class="label">迷宫尺寸</span>
        <div class="seg">
          <button
            v-for="opt in SIZE_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.size === opt.id }"
            @click="apply({ size: opt.id })"
          >
            {{ opt.label }} · {{ opt.hint }}
          </button>
        </div>
      </div>

      <div class="row">
        <span class="label">视野半径</span>
        <div class="seg">
          <button
            v-for="opt in RADIUS_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.radius === opt.id }"
            @click="apply({ radius: opt.id })"
          >
            {{ opt.label }} · {{ opt.value }}
          </button>
        </div>
      </div>

      <div class="row">
        <span class="label">动画效果</span>
        <div class="seg">
          <button
            class="interactive seg-btn"
            :class="{ 'is-active': model.animations }"
            @click="apply({ animations: true })"
          >
            开
          </button>
          <button
            class="interactive seg-btn"
            :class="{ 'is-active': !model.animations }"
            @click="apply({ animations: false })"
          >
            关
          </button>
        </div>
      </div>
    </div>

    <footer class="foot">
      <button class="interactive reset" @click="restoreDefaults">恢复默认</button>
    </footer>
  </section>
</template>

<style scoped>
.settings {
  width: min(92vw, 620px);
  display: flex;
  flex-direction: column;
  gap: 28px;
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
  gap: 8px;
  flex-wrap: wrap;
}

.seg-btn {
  padding: 9px 14px;
  font-size: 12px;
  letter-spacing: 0.1em;
}

.foot {
  display: flex;
  justify-content: flex-end;
}

.reset {
  padding: 10px 16px;
  font-size: 12px;
  letter-spacing: 0.16em;
}
</style>
