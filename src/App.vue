<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { LocaleId, Screen, Settings, ThemeId } from './types'
import {
  loadIntroSeen,
  loadSettings,
  markIntroSeen,
  prefersDarkScheme,
  saveSettings,
  subscribeSystemScheme,
} from './game/settings'
import { LOCALE_TAGS, translate } from './i18n/messages'
import type { TranslateFn } from './i18n/useI18n'
import { provideLocale } from './i18n/useI18n'
import { randomSeed } from './game/rng'
import OverlayPanel from './components/OverlayPanel.vue'
import MenuScreen from './screens/MenuScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'
import GameScreen from './screens/GameScreen.vue'

const screen = ref<Screen>('menu')
const settings = ref<Settings>(loadSettings())
const seed = ref<number>(randomSeed())
const levelIndex = ref<number>(1)

watch(settings, () => saveSettings(settings.value), { deep: true })

// 界面语言：注入给所有后代组件；同时同步 <html lang> 让浏览器选对字体与断行规则
const locale = computed<LocaleId>(() => settings.value.locale)
provideLocale(locale)
// App 自身是 provide 的源头，不能靠 inject 拿翻译（inject 只看父级 provides），直接调 translate
const t: TranslateFn = (key, params) => translate(locale.value, key, params)
watch(
  locale,
  (value) => (document.documentElement.lang = LOCALE_TAGS[value]),
  { immediate: true },
)

// 系统配色：uiTheme === 'system' 时跟着它走（媒体查询变化要能实时反映）
const systemDark = ref(prefersDarkScheme())
onUnmounted(subscribeSystemScheme((dark) => (systemDark.value = dark)))

/** UI 主题解析：'system' → 系统配色，否则就是所选值 */
const uiTheme = computed<ThemeId>(() =>
  settings.value.uiTheme === 'system'
    ? systemDark.value
      ? 'dark'
      : 'light'
    : settings.value.uiTheme,
)
/** 迷宫主题解析：'ui' → 跟随上面解析出的 UI 主题 */
const mazeTheme = computed<ThemeId>(() =>
  settings.value.mazeTheme === 'ui' ? uiTheme.value : settings.value.mazeTheme,
)

// 首次开始游戏时的主题引导：选一次即记档，之后只在设置里改
const introSeen = ref(loadIntroSeen())
const askingIntro = ref(false)
const introLines = computed(() => [t('intro.line')])
const introActions = computed(() => [
  {
    label: t('intro.dark'),
    hint: t('intro.darkHint'),
    primary: true,
    onClick: () => chooseMazeTheme('dark'),
  },
  {
    label: t('intro.light'),
    hint: t('intro.lightHint'),
    onClick: () => chooseMazeTheme('light'),
  },
])

function chooseMazeTheme(theme: ThemeId): void {
  settings.value = { ...settings.value, mazeTheme: theme }
  markIntroSeen()
  introSeen.value = true
  askingIntro.value = false
  beginGame()
}

function startGame(): void {
  if (!introSeen.value) {
    askingIntro.value = true
    return
  }
  beginGame()
}

function beginGame(): void {
  seed.value = randomSeed()
  levelIndex.value = 1
  screen.value = 'game'
}

function nextLevel(): void {
  seed.value = randomSeed()
  levelIndex.value++
}
</script>

<template>
  <div
    class="app"
    :class="{ 'no-anim': !settings.animations, 'theme-light': uiTheme === 'light' }"
  >
    <Transition name="screen" mode="out-in">
      <MenuScreen
        v-if="screen === 'menu'"
        :settings="settings"
        @start="startGame"
        @settings="screen = 'settings'"
      />
      <SettingsScreen
        v-else-if="screen === 'settings'"
        v-model="settings"
        @back="screen = 'menu'"
      />
      <GameScreen
        v-else
        :settings="settings"
        :seed="seed"
        :level-index="levelIndex"
        :maze-theme="mazeTheme"
        @next="nextLevel"
        @exit="screen = 'menu'"
      />
    </Transition>

    <OverlayPanel
      v-if="askingIntro"
      :title="t('intro.title')"
      plain
      :lines="introLines"
      :actions="introActions"
    />
  </div>
</template>

<style scoped>
.app {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
  /* 主题变量在 .app 上（.theme-light）就地解析：body 上的 var() 只认 :root 的值，
     不重新声明的话浅色主题下所有“继承 body 颜色”的文字仍是深色主题的色值 */
  background: var(--bg);
  color: var(--fg);
}
</style>
