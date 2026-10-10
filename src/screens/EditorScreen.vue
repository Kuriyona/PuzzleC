<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Cell, ThemeId, Vec2 } from '../types'
import type { EditorTool, WallTarget } from '../map/edit'
import { setWall, toggleGoal } from '../map/edit'
import type { EditorDraft } from '../map/draft'
import { countOutOfRange, createDraft, draftFromMap, mapFromDraft, newId, resizeDraft } from '../map/draft'
import type { LocalizedText } from '../map/format'
import {
  DEFAULT_MAP_SIDE,
  MAP_MAX_SIDE,
  MAP_MIN_SIDE,
  TEXT_ALIGN_OPTIONS,
  TEXT_SIZE_OPTIONS,
} from '../map/format'
import { loadMap, saveMap } from '../map/store'
import type { MessageKey } from '../i18n/messages'
import { LOCALE_TAGS } from '../i18n/messages'
import { useLocale, useT } from '../i18n/useI18n'
import EditorCanvas from '../components/EditorCanvas.vue'
import LocalizedTextEditor from '../components/LocalizedTextEditor.vue'
import OverlayPanel from '../components/OverlayPanel.vue'

const props = defineProps<{ mapId: string | null; mazeTheme: ThemeId }>()
const emit = defineEmits<{ back: [] }>()

const t = useT()
const locale = useLocale()

const TOOL_OPTIONS = [
  { id: 'wall', labelKey: 'editor.tool.wall' },
  { id: 'start', labelKey: 'editor.tool.start' },
  { id: 'goal', labelKey: 'editor.tool.goal' },
  { id: 'text', labelKey: 'editor.tool.text' },
] as const satisfies readonly { id: EditorTool; labelKey: MessageKey }[]

const draft = ref<EditorDraft>(createDraft(DEFAULT_MAP_SIDE, DEFAULT_MAP_SIDE, Date.now()))
const rev = ref(0)
const dirty = ref(false)
const tool = ref<EditorTool>('wall')
const selectedLabelId = ref<string | null>(null)
const savedAt = ref(0)
const saveFailed = ref(false)
const loadFailed = ref(false)
const sizeCols = ref(draft.value.cols)
const sizeRows = ref(draft.value.rows)
const pendingResize = ref<{ cols: number; rows: number; count: number } | null>(null)
const discardOpen = ref(false)

function touch(): void {
  rev.value++
  dirty.value = true
}

const selectedLabel = computed(
  () => draft.value.labels.find((l) => l.id === selectedLabelId.value) ?? null,
)

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(LOCALE_TAGS[locale.value], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function syncSize(): void {
  sizeCols.value = draft.value.cols
  sizeRows.value = draft.value.rows
}

watch(
  () => [draft.value.cols, draft.value.rows],
  () => syncSize(),
)

// ---- 画布事件 ----

function onWallSet(payload: { target: WallTarget; on: boolean }): void {
  setWall(draft.value, payload.target, payload.on)
  touch()
}

function onCellPick(payload: { cell: Cell }): void {
  if (tool.value === 'start') draft.value.start = { ...payload.cell }
  else toggleGoal(draft.value, payload.cell)
  touch()
}

function onLabelPlace(payload: { pos: Vec2 }): void {
  const id = newId()
  draft.value.labels.push({
    id,
    pos: [payload.pos.x, payload.pos.y],
    text: { text: '' },
    size: 'medium',
    align: 'center',
  })
  selectedLabelId.value = id
  touch()
}

function onLabelPick(payload: { id: string }): void {
  selectedLabelId.value = payload.id
  touch()
}

function onLabelMove(payload: { id: string; pos: Vec2 }): void {
  const label = draft.value.labels.find((l) => l.id === payload.id)
  if (!label) return
  label.pos = [payload.pos.x, payload.pos.y]
  touch()
}

// ---- 尺寸 ----

function clampSide(value: number, fallback: number): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAP_MAX_SIDE, Math.max(MAP_MIN_SIDE, n))
}

function applySize(): void {
  const cols = clampSide(sizeCols.value, draft.value.cols)
  const rows = clampSide(sizeRows.value, draft.value.rows)
  sizeCols.value = cols
  sizeRows.value = rows
  if (cols === draft.value.cols && rows === draft.value.rows) return
  const count = countOutOfRange(draft.value, cols, rows)
  if (count > 0) pendingResize.value = { cols, rows, count }
  else {
    resizeDraft(draft.value, cols, rows)
    touch()
  }
}

const resizeActions = computed(() => {
  const pending = pendingResize.value
  if (!pending) return []
  return [
    {
      label: t('editor.shrinkOk'),
      primary: true,
      onClick: () => {
        resizeDraft(draft.value, pending.cols, pending.rows)
        pendingResize.value = null
        syncSize()
        touch()
      },
    },
    {
      label: t('common.cancel'),
      onClick: () => {
        pendingResize.value = null
        syncSize()
      },
    },
  ]
})

// ---- 文本 ----

function setName(value: LocalizedText): void {
  draft.value.name = value
  touch()
}

function setDescription(value: LocalizedText): void {
  draft.value.description = value
  touch()
}

function setLabelText(value: LocalizedText): void {
  if (!selectedLabel.value) return
  selectedLabel.value.text = value
  touch()
}

function setLabelSize(id: (typeof TEXT_SIZE_OPTIONS)[number]['id']): void {
  if (!selectedLabel.value) return
  selectedLabel.value.size = id
  touch()
}

function setLabelAlign(id: (typeof TEXT_ALIGN_OPTIONS)[number]['id']): void {
  if (!selectedLabel.value) return
  selectedLabel.value.align = id
  touch()
}

function deleteLabel(): void {
  const id = selectedLabelId.value
  if (!id) return
  draft.value.labels = draft.value.labels.filter((l) => l.id !== id)
  selectedLabelId.value = null
  touch()
}

// ---- 保存 / 返回 ----

async function save(): Promise<void> {
  if (draft.value.goals.length === 0) return
  const ok = await saveMap(mapFromDraft(draft.value, Date.now()))
  if (ok) {
    dirty.value = false
    savedAt.value = Date.now()
    saveFailed.value = false
  } else {
    saveFailed.value = true
  }
}

function onBack(): void {
  if (dirty.value) discardOpen.value = true
  else emit('back')
}

const discardActions = computed(() => [
  {
    label: t('editor.discardOk'),
    primary: true,
    onClick: () => {
      discardOpen.value = false
      emit('back')
    },
  },
  { label: t('editor.discardCancel'), onClick: () => (discardOpen.value = false) },
])

const loadFailedActions = computed(() => [
  { label: t('common.back'), primary: true, onClick: () => emit('back') },
])

onMounted(async () => {
  if (props.mapId === null) return
  const map = await loadMap(props.mapId)
  if (!map) {
    loadFailed.value = true
    return
  }
  draft.value = draftFromMap(map)
  savedAt.value = map.meta.updatedAt
  syncSize()
  rev.value++
})
</script>

<template>
  <section class="editor rise">
    <header class="head">
      <h2>{{ t('editor.title') }}</h2>
      <div class="head-actions">
        <span v-if="saveFailed" class="status err">{{ t('editor.saveFailed') }}</span>
        <span v-else-if="savedAt > 0 && !dirty" class="status">
          {{ t('editor.saved', { time: formatTime(savedAt) }) }}
        </span>
        <span v-if="draft.goals.length === 0" class="status">{{ t('editor.needGoal') }}</span>
        <button
          class="interactive act"
          :disabled="draft.goals.length === 0"
          @click="save"
        >
          {{ t('editor.save') }}
        </button>
        <button class="interactive act" @click="onBack">{{ t('common.back') }}</button>
      </div>
    </header>

    <div class="body">
      <div class="stage">
        <EditorCanvas
          :draft="draft"
          :tool="tool"
          :rev="rev"
          :selected-label-id="selectedLabelId"
          :theme="mazeTheme"
          :locale="locale"
          @wall-set="onWallSet"
          @cell-pick="onCellPick"
          @label-place="onLabelPlace"
          @label-pick="onLabelPick"
          @label-move="onLabelMove"
        />
        <p class="hint">{{ t('editor.hint') }}</p>
      </div>

      <aside class="side">
        <section class="block">
          <h3 class="block-title">{{ t('editor.tool') }}</h3>
          <div class="seg">
            <button
              v-for="opt in TOOL_OPTIONS"
              :key="opt.id"
              class="interactive seg-btn"
              :class="{ 'is-active': tool === opt.id }"
              @click="tool = opt.id"
            >
              {{ t(opt.labelKey) }}
            </button>
          </div>
        </section>

        <section class="block">
          <h3 class="block-title">{{ t('editor.size') }}</h3>
          <div class="size-row">
            <input
              v-model.number="sizeCols"
              class="interactive field"
              type="number"
              :min="MAP_MIN_SIDE"
              :max="MAP_MAX_SIDE"
              @change="applySize"
            />
            <span class="x">×</span>
            <input
              v-model.number="sizeRows"
              class="interactive field"
              type="number"
              :min="MAP_MIN_SIDE"
              :max="MAP_MAX_SIDE"
              @change="applySize"
            />
          </div>
        </section>

        <section class="block">
          <LocalizedTextEditor
            :title="t('editor.name')"
            :model-value="draft.name"
            @update:model-value="setName"
          />
          <LocalizedTextEditor
            :title="t('editor.description')"
            :model-value="draft.description"
            @update:model-value="setDescription"
          />
        </section>

        <section class="block">
          <h3 class="block-title">{{ t('editor.label.title') }}</h3>
          <template v-if="selectedLabel">
            <LocalizedTextEditor
              :title="t('editor.label.text')"
              :model-value="selectedLabel.text"
              @update:model-value="setLabelText"
            />
            <div class="field-row">
              <span class="label">{{ t('editor.label.size') }}</span>
              <div class="seg">
                <button
                  v-for="opt in TEXT_SIZE_OPTIONS"
                  :key="opt.id"
                  class="interactive seg-btn"
                  :class="{ 'is-active': selectedLabel.size === opt.id }"
                  @click="setLabelSize(opt.id)"
                >
                  {{ t(opt.labelKey) }}
                </button>
              </div>
            </div>
            <div class="field-row">
              <span class="label">{{ t('editor.label.align') }}</span>
              <div class="seg">
                <button
                  v-for="opt in TEXT_ALIGN_OPTIONS"
                  :key="opt.id"
                  class="interactive seg-btn"
                  :class="{ 'is-active': selectedLabel.align === opt.id }"
                  @click="setLabelAlign(opt.id)"
                >
                  {{ t(opt.labelKey) }}
                </button>
              </div>
            </div>
            <button class="interactive act" @click="deleteLabel">
              {{ t('editor.label.delete') }}
            </button>
          </template>
          <p v-else class="empty">{{ t('editor.inspectorEmpty') }}</p>
        </section>
      </aside>
    </div>

    <OverlayPanel
      v-if="pendingResize"
      :title="t('editor.shrinkTitle')"
      :lines="[t('editor.shrinkLine', { cols: pendingResize.cols, rows: pendingResize.rows, count: pendingResize.count })]"
      :actions="resizeActions"
    />
    <OverlayPanel
      v-if="discardOpen"
      :title="t('editor.discardTitle')"
      :lines="[t('editor.discardLine')]"
      :actions="discardActions"
    />
    <OverlayPanel
      v-if="loadFailed"
      :title="t('map.err.title')"
      :lines="[t('map.err.load')]"
      :actions="loadFailedActions"
    />
  </section>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: min(96vw, 1100px);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.head h2 {
  margin: 0;
  font-weight: 300;
  font-size: 20px;
  letter-spacing: 0.3em;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}

.status.err {
  color: var(--fg);
}

.body {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.hint {
  margin: 0;
  max-width: min(92vw, 62vh, 720px);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--fg-faint);
  text-align: center;
}

.side {
  width: min(92vw, 300px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--line);
  padding: 14px;
}

.block-title {
  margin: 0;
  font-weight: 400;
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--fg-dim);
}

.seg {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.seg-btn {
  padding: 7px 10px;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.size-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field {
  padding: 7px 10px;
  width: 100%;
  min-width: 0;
  font-size: 12px;
}

.size-row .field {
  flex: 1;
}

.x {
  color: var(--fg-dim);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.label {
  width: 48px;
  flex: none;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--fg-dim);
}

.act {
  padding: 8px 12px;
  font-size: 12px;
  letter-spacing: 0.1em;
}

.act:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.empty {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--fg-faint);
}
</style>
