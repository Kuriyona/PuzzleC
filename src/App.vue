<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { GenParams, LocaleId, Screen, Settings, ThemeId } from './types'
import {
  loadIntroSeen,
  loadSettings,
  markIntroSeen,
  prefersDarkScheme,
  saveSettings,
  subscribeSystemScheme,
} from './game/settings'
import { DEFAULT_GEN_PARAMS, mazeSizeOf, parseSeed, radiusOf } from './game/gen'
import { LOCALE_TAGS } from './i18n/messages'
import { provideLocale } from './i18n/useI18n'
import { randomSeed } from './game/rng'
import IntroScreen from './screens/IntroScreen.vue'
import MenuScreen from './screens/MenuScreen.vue'
import StartScreen from './screens/StartScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'
import GameScreen from './screens/GameScreen.vue'
import MapListScreen from './screens/MapListScreen.vue'
import EditorScreen from './screens/EditorScreen.vue'
import type { MapFile } from './map/format'

const screen = ref<Screen>('menu')
const settings = ref<Settings>(loadSettings())
/** 「开始游戏」界面按局配置的生成参数（不持久化，也不属于全局设置） */
const gen = ref<GenParams>({ ...DEFAULT_GEN_PARAMS })
/** 本局实际使用的生成参数：随机迷宫用 size，自定义地图只用 radius */
const run = ref({ size: mazeSizeOf(DEFAULT_GEN_PARAMS), radius: radiusOf(DEFAULT_GEN_PARAMS) })
const seed = ref<number>(randomSeed())
const levelIndex = ref<number>(1)
/** 正在游玩的自定义地图；null = 生成迷宫 */
const playingMap = ref<MapFile | null>(null)
/** 编辑器要打开的地图 id；null = 新建 */
const editingMapId = ref<string | null>(null)

watch(settings, () => saveSettings(settings.value), { deep: true })

// 界面语言：注入给所有后代组件；同时同步 <html lang> 让浏览器选对字体与断行规则
const locale = computed<LocaleId>(() => settings.value.locale)
provideLocale(locale)
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

// 首次打开时的引导（语言 / 欢迎 / 介绍 / 主题）：走完才记档，中途刷新会重来
const introSeen = ref(loadIntroSeen())

function finishIntro(): void {
  markIntroSeen()
  introSeen.value = true
  // 引导只负责设置与介绍：走完停在主界面（screen 本就是 'menu'），由玩家自己按开始游戏
}

/** 「开始游戏」界面按当前配置开局：尺寸/半径取解析值，种子留空则随机 */
function startRandom(): void {
  run.value = { size: mazeSizeOf(gen.value), radius: radiusOf(gen.value) }
  seed.value = parseSeed(gen.value.seed) ?? randomSeed()
  levelIndex.value = 1
  playingMap.value = null
  screen.value = 'game'
}

function nextLevel(): void {
  seed.value = randomSeed()
  levelIndex.value++
}

function playMap(map: MapFile): void {
  playingMap.value = map
  screen.value = 'game'
}

function openEditor(id: string | null): void {
  editingMapId.value = id
  screen.value = 'editor'
}
</script>

<template>
  <div
    class="app"
    :class="{ 'no-anim': !settings.animations, 'theme-light': uiTheme === 'light' }"
  >
    <Transition name="screen" mode="out-in">
      <IntroScreen
        v-if="!introSeen"
        key="intro"
        v-model="settings"
        @finish="finishIntro"
      />
      <MenuScreen
        v-else-if="screen === 'menu'"
        :settings="settings"
        @start="screen = 'start'"
        @maps="screen = 'maps'"
        @editor="openEditor(null)"
        @settings="screen = 'settings'"
      />
      <StartScreen
        v-else-if="screen === 'start'"
        v-model="gen"
        @start="startRandom"
        @back="screen = 'menu'"
      />
      <SettingsScreen
        v-else-if="screen === 'settings'"
        v-model="settings"
        @back="screen = 'menu'"
      />
      <GameScreen
        v-else-if="screen === 'game'"
        :settings="settings"
        :seed="seed"
        :level-index="levelIndex"
        :maze-size="run.size"
        :radius="run.radius"
        :maze-theme="mazeTheme"
        :map="playingMap"
        @next="nextLevel"
        @exit="screen = 'menu'"
      />
      <MapListScreen
        v-else-if="screen === 'maps'"
        @play="playMap"
        @edit="openEditor"
        @back="screen = 'menu'"
      />
      <EditorScreen
        v-else-if="screen === 'editor'"
        :map-id="editingMapId"
        :maze-theme="mazeTheme"
        @back="screen = 'menu'"
      />
    </Transition>
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
