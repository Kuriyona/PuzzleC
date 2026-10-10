<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useNav } from '../input/useGamepad'
import GpKey from './GpKey.vue'

interface Action {
  label: string
  /** 反色高亮（实心），与是否聚焦无关 */
  active?: boolean
  /** 主操作：挂载后自动聚焦（键盘）＋手柄初始焦点 */
  primary?: boolean
  /** 手柄按键标志（如 'B'） */
  badge?: string
  onClick: () => void
}

const props = defineProps<{ title: string; lines: string[]; actions: Action[] }>()
const emit = defineEmits<{ back: [] }>()

const primaryButton = ref<HTMLButtonElement | null>(null)

function capturePrimary(el: unknown, action: Action): void {
  if (action.primary) primaryButton.value = (el as HTMLButtonElement | null) ?? null
}

// 浮层置顶接管手柄：吞掉全部事件，方向在按钮间移动，B 触发 back
useNav(
  () => [{ items: props.actions.map((a) => ({ select: a.onClick, initial: a.primary })) }],
  { onBack: () => emit('back'), consumeAll: true },
)

onMounted(async () => {
  await nextTick()
  primaryButton.value?.focus()
})
</script>

<template>
  <div class="overlay">
    <div class="panel rise" role="dialog" aria-modal="true" :aria-label="title">
      <h2 class="title">{{ title }}</h2>
      <ul v-if="lines.length" class="lines">
        <li v-for="(line, i) in lines" :key="i">{{ line }}</li>
      </ul>
      <div class="actions">
        <button
          v-for="(action, i) in actions"
          :key="i"
          :ref="(el) => capturePrimary(el, action)"
          class="interactive act"
          :class="{ 'is-active': action.active }"
          @click="action.onClick()"
        >
          {{ action.label }}
          <GpKey v-if="action.badge" :k="action.badge" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--scrim);
  z-index: 10;
}

.panel {
  min-width: min(88vw, 360px);
  border: 1px solid var(--line);
  background: var(--panel);
  padding: 26px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.title {
  margin: 0;
  font-weight: 300;
  font-size: 18px;
  letter-spacing: 0.3em;
}

.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.act {
  padding: 11px 14px;
  font-size: 13px;
  letter-spacing: 0.16em;
  text-align: left;
}
</style>
