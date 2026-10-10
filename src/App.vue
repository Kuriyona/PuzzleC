<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Screen, Settings } from './types'
import { loadSettings, saveSettings } from './game/settings'
import { randomSeed } from './game/rng'
import MenuScreen from './screens/MenuScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'
import GameScreen from './screens/GameScreen.vue'

const screen = ref<Screen>('menu')
const settings = ref<Settings>(loadSettings())
const seed = ref<number>(randomSeed())
const levelIndex = ref<number>(1)

watch(settings, () => saveSettings(settings.value), { deep: true })

function startGame(): void {
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
  <div class="app" :class="{ 'no-anim': !settings.animations }">
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
        @next="nextLevel"
        @exit="screen = 'menu'"
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
}
</style>
