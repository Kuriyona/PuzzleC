<script setup lang="ts">
import type { Settings } from '../types'
import { SIZE_OPTIONS } from '../game/maze'
import { radiusValue } from '../game/settings'

const props = defineProps<{ settings: Settings }>()
defineEmits<{ start: []; settings: [] }>()

const sizeOption = () => SIZE_OPTIONS.find((o) => o.id === props.settings.size) ?? SIZE_OPTIONS[1]
</script>

<template>
  <section class="menu">
    <div class="backdrop" aria-hidden="true">
      <div class="dots"></div>
      <div class="orb"></div>
    </div>

    <div class="content">
      <header class="title">
        <h1 class="rise" style="animation-delay: 0ms">光点迷宫</h1>
        <p class="sub rise" style="animation-delay: 80ms">LUMEN MAZE</p>
        <div class="rule rise" style="animation-delay: 160ms"></div>
      </header>

      <nav class="actions">
        <button
          class="interactive item rise"
          style="animation-delay: 240ms"
          @click="$emit('start')"
        >
          开始游戏
        </button>
        <button
          class="interactive item rise"
          style="animation-delay: 310ms"
          @click="$emit('settings')"
        >
          设置
        </button>
      </nav>

      <footer class="foot rise" style="animation-delay: 380ms">
        <p>方向键 / WASD 移动 · ESC 暂停 · 抵达白色菱形即通关</p>
        <p>
          迷宫 {{ sizeOption().hint }} · 视野 {{ radiusValue(settings.radius) }} · 动画
          {{ settings.animations ? '开' : '关' }}
        </p>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.menu {
  position: relative;
  width: min(92vw, 520px);
  isolation: isolate;
}

.backdrop {
  position: absolute;
  inset: -24px;
  pointer-events: none;
  overflow: hidden;
  z-index: -1;
}

.dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #171717 1px, transparent 1px);
  background-size: 26px 26px;
  -webkit-mask-image: radial-gradient(circle at 50% 42%, #000 0 28%, transparent 72%);
  mask-image: radial-gradient(circle at 50% 42%, #000 0 28%, transparent 72%);
  animation: drift 24s linear infinite;
}

.orb {
  position: absolute;
  left: 50%;
  top: 38%;
  width: 520px;
  height: 520px;
  margin: -260px 0 0 -260px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.06), transparent 70%);
  animation: breathe 16s ease-in-out infinite alternate;
}

@keyframes drift {
  to {
    background-position: 26px 26px;
  }
}

@keyframes breathe {
  from {
    transform: scale(0.42) translateY(30px);
  }
  to {
    transform: scale(1) translateY(-20px);
  }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 34px;
}

.title h1 {
  margin: 0;
  font-weight: 200;
  letter-spacing: 0.34em;
  font-size: clamp(38px, 7vw, 64px);
  text-indent: 0.34em;
}

.sub {
  margin: 10px 0 0;
  font-size: 11px;
  letter-spacing: 0.5em;
  color: var(--fg-faint);
}

.rule {
  margin-top: 22px;
  height: 1px;
  background: var(--line);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  padding: 14px 18px;
  text-align: left;
  letter-spacing: 0.16em;
  font-size: 15px;
}

.item:hover,
.item:focus-visible {
  transform: translateX(6px);
}

.foot {
  border-top: 1px solid var(--line);
  padding-top: 16px;
  color: var(--fg-dim);
  font-size: 12px;
  line-height: 1.9;
}

.foot p {
  margin: 0;
}
</style>
