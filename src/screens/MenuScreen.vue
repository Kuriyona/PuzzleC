<script setup lang="ts">
import type { Settings } from '../types'
import { SIZE_OPTIONS } from '../game/maze'
import { radiusValue } from '../game/settings'
import { useT } from '../i18n/useI18n'

const props = defineProps<{ settings: Settings }>()
defineEmits<{ start: []; settings: []; maps: []; editor: [] }>()

const t = useT()

const sizeOption = () => SIZE_OPTIONS.find((o) => o.id === props.settings.size) ?? SIZE_OPTIONS[1]
</script>

<template>
  <section class="menu">
    <div class="backdrop" aria-hidden="true">
      <div class="dots"></div>
      <div class="orb"></div>
    </div>

    <header class="title">
      <h1 class="rise" style="animation-delay: 0ms">PuzzleC</h1>
      <div class="rule rise" style="animation-delay: 80ms"></div>
      <p class="hint">{{ t('menu.portrait') }}</p>
    </header>

    <div class="bottom">
      <nav class="actions">
        <button
          class="interactive item rise"
          style="animation-delay: 160ms"
          @click="$emit('start')"
        >
          {{ t('menu.start') }}
        </button>
        <button
          class="interactive item rise"
          style="animation-delay: 230ms"
          @click="$emit('maps')"
        >
          {{ t('menu.maps') }}
        </button>
        <button
          class="interactive item rise"
          style="animation-delay: 300ms"
          @click="$emit('editor')"
        >
          {{ t('menu.editor') }}
        </button>
        <button
          class="interactive item rise"
          style="animation-delay: 370ms"
          @click="$emit('settings')"
        >
          {{ t('menu.settings') }}
        </button>
        <a
          class="interactive item rise"
          style="animation-delay: 440ms"
          href="https://github.com/Kuriyona/PuzzleC"
          target="_blank"
          rel="noreferrer"
        >
          Github
        </a>
      </nav>

      <footer class="foot rise" style="animation-delay: 510ms">
        <p>
          {{
            t('menu.stats', {
              size: sizeOption().hint,
              radius: radiusValue(settings.radius),
              anim: settings.animations ? t('common.on') : t('common.off'),
            })
          }}
        </p>
      </footer>
    </div>
  </section>
</template>

<style scoped>
/* 主界面跟随界面主题（.app 上的 .theme-light / :root 深色），自身不再固定配色 */
.menu {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 32px;
  padding: clamp(28px, 6vh, 64px) clamp(28px, 5vw, 72px);
  background: var(--bg);
  color: var(--fg);
  isolation: isolate;
  overflow: hidden;
}

.backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: -1;
}

.dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, var(--line) 1px, transparent 1px);
  background-size: 26px 26px;
  -webkit-mask-image: radial-gradient(circle at 18% 22%, #000 0 22%, transparent 68%);
  mask-image: radial-gradient(circle at 18% 22%, #000 0 22%, transparent 68%);
  animation: drift 24s linear infinite;
}

.orb {
  position: absolute;
  left: 50%;
  top: 38%;
  width: 520px;
  height: 520px;
  margin: -260px 0 0 -260px;
  background: radial-gradient(circle, rgba(128, 128, 128, 0.1), transparent 70%);
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

.title h1 {
  margin: 0;
  font-weight: 200;
  letter-spacing: 0.34em;
  font-size: clamp(34px, 6vw, 56px);
  text-indent: 0.34em;
}

.rule {
  margin-top: 20px;
  width: 76px;
  height: 1px;
  background: var(--fg);
}

.bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  flex-wrap: wrap;
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

/* 文本与标题左对齐，hover 色块向左溢出，保持“纯净文字按钮”观感 */
.item {
  display: block;
  width: fit-content;
  padding: 12px 16px;
  margin-left: -16px;
  border-color: transparent;
  font-size: 15px;
  letter-spacing: 0.16em;
  text-align: left;
  text-decoration: none;
}

.item:hover,
.item:focus-visible {
  transform: translateX(6px);
}

.foot {
  color: var(--fg-dim);
  font-size: 12px;
  line-height: 1.9;
  text-align: right;
}

.foot p {
  margin: 0;
}

/* 窄屏（近似移动端）：标题与按钮整体居中，并在标题下方提示横屏 / 拉宽窗口 */
.hint {
  display: none;
  width: fit-content;
  margin: 20px auto 0;
  padding: 6px 12px;
  border: 1px solid var(--line);
  color: var(--fg-dim);
  font-size: 12px;
  letter-spacing: 0.08em;
}

@media (max-width: 640px) {
  .menu {
    align-items: center;
    justify-content: center;
    gap: 28px;
  }

  .title {
    text-align: center;
  }

  .rule {
    margin-inline: auto;
  }

  .hint {
    display: block;
  }

  .bottom {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
  }

  .actions {
    align-items: center;
  }

  .item {
    margin-left: 0;
    text-align: center;
  }

  .foot {
    text-align: center;
  }
}
</style>
