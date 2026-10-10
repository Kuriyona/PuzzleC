<script setup lang="ts">
import type { Settings } from '../types'
import { MAZE_THEME_OPTIONS, UI_THEME_OPTIONS, DEFAULT_SETTINGS } from '../game/settings'
import { LOCALE_OPTIONS } from '../i18n/messages'
import type { NavGroup } from '../input/useGamepad'
import { useNav } from '../input/useGamepad'
import { useT } from '../i18n/useI18n'
import GpKey from '../components/GpKey.vue'

const model = defineModel<Settings>({ required: true })
const emit = defineEmits<{ back: [] }>()

const t = useT()

// 每一行是一个横向组；上下切换行、左右切换行内选项，B = 返回
const nav = useNav(
  (): NavGroup[] => [
    { horizontal: true, items: LOCALE_OPTIONS.map((opt) => ({ select: () => apply({ locale: opt.id }) })) },
    {
      horizontal: true,
      items: UI_THEME_OPTIONS.map((opt) => ({ select: () => apply({ uiTheme: opt.id }) })),
    },
    {
      horizontal: true,
      items: MAZE_THEME_OPTIONS.map((opt) => ({ select: () => apply({ mazeTheme: opt.id }) })),
    },
    {
      horizontal: true,
      items: [
        { select: () => apply({ animations: true }) },
        { select: () => apply({ animations: false }) },
      ],
    },
    { horizontal: true, items: [{ select: restoreDefaults }] },
  ],
  { onBack: () => emit('back') },
)

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
      <h2>{{ t('settings.title') }}</h2>
      <button class="interactive back" @click="$emit('back')">
        {{ t('settings.back') }}
        <GpKey k="B" />
      </button>
    </header>

    <div class="rows">
      <div class="row">
        <span class="label">{{ t('settings.language') }}</span>
        <div class="seg">
          <button
            v-for="(opt, i) in LOCALE_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.locale === opt.id, 'gp-focus': nav.isFocused(0, i) }"
            @click="apply({ locale: opt.id })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="row">
        <span class="label">{{ t('settings.uiTheme') }}</span>
        <div class="seg">
          <button
            v-for="(opt, i) in UI_THEME_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.uiTheme === opt.id, 'gp-focus': nav.isFocused(1, i) }"
            @click="apply({ uiTheme: opt.id })"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>

      <div class="row">
        <span class="label">{{ t('settings.mazeTheme') }}</span>
        <div class="seg">
          <button
            v-for="(opt, i) in MAZE_THEME_OPTIONS"
            :key="opt.id"
            class="interactive seg-btn"
            :class="{ 'is-active': model.mazeTheme === opt.id, 'gp-focus': nav.isFocused(2, i) }"
            @click="apply({ mazeTheme: opt.id })"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>

      <div class="row">
        <span class="label">{{ t('settings.animations') }}</span>
        <div class="seg">
          <button
            class="interactive seg-btn"
            :class="{ 'is-active': model.animations, 'gp-focus': nav.isFocused(3, 0) }"
            @click="apply({ animations: true })"
          >
            {{ t('common.on') }}
          </button>
          <button
            class="interactive seg-btn"
            :class="{ 'is-active': !model.animations, 'gp-focus': nav.isFocused(3, 1) }"
            @click="apply({ animations: false })"
          >
            {{ t('common.off') }}
          </button>
        </div>
      </div>
    </div>

    <footer class="foot">
      <button
        class="interactive reset"
        :class="{ 'gp-focus': nav.isFocused(4, 0) }"
        @click="restoreDefaults"
      >
        {{ t('settings.reset') }}
      </button>
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
