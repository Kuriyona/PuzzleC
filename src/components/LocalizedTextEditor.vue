<script setup lang="ts">
import type { LocaleId } from '../types'
import type { LocalizedText } from '../map/format'
import { LOCALE_OPTIONS } from '../i18n/messages'
import { useT } from '../i18n/useI18n'

const model = defineModel<LocalizedText>({ required: true })
defineProps<{ title: string }>()

const t = useT()

function fromInput(e: Event): string {
  return (e.target as HTMLInputElement).value
}

function setText(value: string): void {
  model.value = { ...model.value, text: value }
}

function setTranslation(id: LocaleId, value: string): void {
  model.value = { ...model.value, i18n: { ...(model.value.i18n ?? {}), [id]: value } }
}

function enableI18n(): void {
  model.value = { ...model.value, i18n: {} }
}

/** 丢弃已填翻译，回到只有默认文本的状态 */
function disableI18n(): void {
  model.value = { text: model.value.text }
}
</script>

<template>
  <div class="lte">
    <label class="row">
      <span class="lbl">{{ title }}</span>
      <input class="interactive field" :value="model.text" @input="setText(fromInput($event))" />
    </label>

    <div class="translations">
      <template v-if="model.i18n">
        <label v-for="loc in LOCALE_OPTIONS" :key="loc.id" class="row">
          <span class="lbl">{{ loc.label }}</span>
          <input
            class="interactive field"
            :value="model.i18n?.[loc.id] ?? ''"
            @input="setTranslation(loc.id, fromInput($event))"
          />
        </label>
        <button class="interactive toggle" @click="disableI18n">
          {{ t('editor.label.i18nOff') }}
        </button>
      </template>
      <button v-else class="interactive toggle" @click="enableI18n">
        {{ t('editor.label.i18nOn') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.lte {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lbl {
  width: 84px;
  flex: none;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--fg-dim);
}

.field {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  font-size: 12px;
}

.field:focus-visible {
  background: transparent;
  color: var(--fg);
}

.translations {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle {
  align-self: flex-start;
  padding: 6px 10px;
  font-size: 11px;
  letter-spacing: 0.1em;
}
</style>
