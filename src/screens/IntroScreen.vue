<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import type { Settings } from '../types'
import { MAZE_THEME_OPTIONS, UI_THEME_OPTIONS } from '../game/settings'
import type { MessageKey } from '../i18n/messages'
import { LOCALE_OPTIONS } from '../i18n/messages'
import { useT } from '../i18n/useI18n'

const model = defineModel<Settings>({ required: true })
const emit = defineEmits<{ finish: [] }>()

const t = useT()

/** 首次启动引导的步骤顺序（每一步都有标题与“下一步”） */
const STEPS = ['language', 'welcome', 'guide', 'uiTheme', 'mazeTheme', 'ready'] as const
type StepId = (typeof STEPS)[number]

const TITLE_KEYS: Record<StepId, MessageKey> = {
  language: 'intro.language',
  welcome: 'intro.welcome',
  guide: 'intro.guide',
  uiTheme: 'intro.uiTheme',
  mazeTheme: 'intro.mazeTheme',
  ready: 'intro.ready',
}

/** 介绍页正文：玩法概述 / 操作 / 三条特色 */
const GUIDE_KEYS: readonly MessageKey[] = [
  'intro.guide.basic',
  'intro.controls',
  'intro.guide.feature.visibility',
  'intro.guide.feature.editor',
  'intro.guide.feature.review',
]

const stepIndex = ref(0)
const step = computed<StepId>(() => STEPS[stepIndex.value])
const isLast = computed(() => stepIndex.value === STEPS.length - 1)

const nextButton = ref<HTMLButtonElement | null>(null)

/** 游戏全靠键盘操作：每步都把“下一步”聚焦，Enter / 空格即可继续 */
async function focusNext(): Promise<void> {
  await nextTick()
  nextButton.value?.focus()
}

// 首屏没有进入动画，靠挂载钩子；换步则由 Transition 的 after-enter 触发
// （mode="out-in" 会先卸载旧按钮，不能用 watch(stepIndex) 抢在卸载前聚焦）
onMounted(focusNext)

function apply(patch: Partial<Settings>): void {
  model.value = { ...model.value, ...patch }
}

function advance(): void {
  if (isLast.value) {
    emit('finish')
    return
  }
  stepIndex.value++
}
</script>

<template>
  <section class="intro">
    <Transition name="screen" mode="out-in" @after-enter="focusNext">
      <div :key="step" class="card">
        <h2 class="step-title">{{ t(TITLE_KEYS[step]) }}</h2>

        <div v-if="step === 'welcome'" class="welcome">
          <p class="wordmark">PuzzleC</p>
          <!-- 作者手记：按需求硬编码，不进 i18n 目录 -->
          <p class="note">
            为什么会编写这么一个无聊的迷宫游戏并取这个名字呢，其实和我小学/初中的一段经历和想法有关。
          </p>
        </div>

        <ul v-else-if="step === 'guide'" class="lines">
          <li v-for="key in GUIDE_KEYS" :key="key">{{ t(key) }}</li>
        </ul>

        <div v-else-if="step === 'language'" class="options">
          <button
            v-for="opt in LOCALE_OPTIONS"
            :key="opt.id"
            class="interactive opt"
            :class="{ 'is-active': model.locale === opt.id }"
            @click="apply({ locale: opt.id })"
          >
            {{ opt.label }}
          </button>
        </div>

        <div v-else-if="step === 'uiTheme'" class="options">
          <button
            v-for="opt in UI_THEME_OPTIONS"
            :key="opt.id"
            class="interactive opt"
            :class="{ 'is-active': model.uiTheme === opt.id }"
            @click="apply({ uiTheme: opt.id })"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>

        <div v-else-if="step === 'mazeTheme'" class="options">
          <button
            v-for="opt in MAZE_THEME_OPTIONS"
            :key="opt.id"
            class="interactive opt"
            :class="{ 'is-active': model.mazeTheme === opt.id }"
            @click="apply({ mazeTheme: opt.id })"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>

        <p v-else-if="step === 'ready'" class="ready">{{ t('intro.readyLine') }}</p>

        <footer class="foot">
          <span class="dots" aria-hidden="true">
            <i v-for="(id, i) in STEPS" :key="id" :class="{ 'is-on': i === stepIndex }"></i>
          </span>
          <button ref="nextButton" class="interactive next" @click="advance">
            {{ t(isLast ? 'intro.finish' : 'intro.next') }}
          </button>
        </footer>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
/* 首启引导跟随界面主题：主题步骤一改，本页立刻给出反馈 */
.intro {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: clamp(20px, 5vh, 48px) clamp(18px, 5vw, 40px);
  background: var(--bg);
  color: var(--fg);
}

.card {
  width: min(92vw, 560px);
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px 26px;
  border: 1px solid var(--line);
  background: var(--panel);
}

.step-title {
  margin: 0;
  font-weight: 300;
  font-size: 20px;
  letter-spacing: 0.24em;
}

.welcome {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wordmark {
  margin: 0;
  font-weight: 200;
  font-size: clamp(34px, 8vw, 56px);
  letter-spacing: 0.34em;
  text-indent: 0.34em;
}

.note {
  margin: 0;
  color: var(--fg-dim);
  font-size: 12px;
  line-height: 1.9;
}

.lines,
.ready {
  margin: 0;
  color: var(--fg-dim);
  font-size: 13px;
  line-height: 1.8;
}

.lines {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 首行是玩法概述，比后面跟着的操作 / 特色行亮一档 */
.lines li:first-child {
  color: var(--fg);
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.opt {
  padding: 10px 16px;
  font-size: 13px;
  letter-spacing: 0.16em;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 4px;
}

.dots {
  display: flex;
  gap: 6px;
}

.dots i {
  width: 6px;
  height: 6px;
  background: var(--line);
}

.dots i.is-on {
  background: var(--fg);
}

.next {
  padding: 11px 22px;
  font-size: 13px;
  letter-spacing: 0.2em;
}
</style>
