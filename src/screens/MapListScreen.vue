<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { MapFile } from '../map/format'
import { isPlayable, mapByteSize, parseMapFile, resolveLocalized, serializeMap } from '../map/format'
import type { TagIssue } from '../map/features'
import { checkTags } from '../map/features'
import type { StorageEstimate } from '../map/store'
import { deleteMap, estimateStorage, listMaps, saveMap } from '../map/store'
import { newId } from '../map/draft'
import { LOCALE_TAGS } from '../i18n/messages'
import { useLocale, useT } from '../i18n/useI18n'
import OverlayPanel from '../components/OverlayPanel.vue'

interface DialogAction {
  label: string
  active?: boolean
  primary?: boolean
  onClick: () => void
}

interface Dialog {
  title: string
  lines: string[]
  actions: DialogAction[]
}

const emit = defineEmits<{ play: [map: MapFile]; edit: [id: string]; back: [] }>()

const t = useT()
const locale = useLocale()

const maps = ref<MapFile[]>([])
const fileRef = ref<HTMLInputElement | null>(null)
const dialog = ref<Dialog | null>(null)
/** 资源管理器视图 */
const explorer = ref(false)
const storageInfo = ref<StorageEstimate | null>(null)
const storageLoading = ref(false)
const selectedIds = ref<Set<string>>(new Set())

/** 每张地图的估算占用（导出体积的 UTF-8 字节数） */
const sizeById = computed(() => {
  const out = new Map<string, number>()
  for (const map of maps.value) out.set(map.manifest.id, mapByteSize(map))
  return out
})
const totalBytes = computed(() => {
  let sum = 0
  for (const size of sizeById.value.values()) sum += size
  return sum
})
const selectedCount = computed(() => selectedIds.value.size)
const allSelected = computed(
  () => maps.value.length > 0 && selectedIds.value.size === maps.value.length,
)
const usagePercent = computed(() => {
  const info = storageInfo.value
  if (!info || info.quota <= 0) return 0
  return Math.min(100, (info.usage / info.quota) * 100)
})

async function refresh(): Promise<void> {
  maps.value = await listMaps()
  const alive = new Set(maps.value.map((m) => m.manifest.id))
  for (const id of [...selectedIds.value]) {
    if (!alive.has(id)) selectedIds.value.delete(id)
  }
}

async function loadEstimate(): Promise<void> {
  storageLoading.value = true
  storageInfo.value = await estimateStorage()
  storageLoading.value = false
}

function openExplorer(): void {
  explorer.value = true
  void loadEstimate()
}

function closeExplorer(): void {
  explorer.value = false
}

function formatBytes(bytes: number): string {
  const tag = LOCALE_TAGS[locale.value]
  const units = [
    { limit: 1024 ** 3, key: 'unit.gigabyte' as const },
    { limit: 1024 ** 2, key: 'unit.megabyte' as const },
    { limit: 1024, key: 'unit.kilobyte' as const },
  ]
  for (const unit of units) {
    if (bytes >= unit.limit) {
      const value = (bytes / unit.limit).toLocaleString(tag, { maximumFractionDigits: 1 })
      return `${value} ${t(unit.key)}`
    }
  }
  return `${bytes.toLocaleString(tag)} ${t('unit.byte')}`
}

function toggleSelect(id: string): void {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

function toggleSelectAll(): void {
  if (allSelected.value) selectedIds.value.clear()
  else selectedIds.value = new Set(maps.value.map((m) => m.manifest.id))
}

function confirmDeleteSelected(): void {
  const ids = [...selectedIds.value]
  if (ids.length === 0) return
  dialog.value = {
    title: t('maps.deleteTitle'),
    lines: [t('maps.deleteSelectedConfirm', { count: ids.length })],
    actions: [
      {
        label: t('maps.delete'),
        primary: true,
        onClick: async () => {
          dialog.value = null
          for (const id of ids) await deleteMap(id)
          await refresh()
          if (explorer.value) await loadEstimate()
        },
      },
      { label: t('common.cancel'), onClick: () => (dialog.value = null) },
    ],
  }
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(LOCALE_TAGS[locale.value], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapName(map: MapFile): string {
  return resolveLocalized(map.meta.name, locale.value) || t('maps.untitled')
}

/** 兼容性问题警示行（严重项带前缀） */
function issueLines(issues: TagIssue[]): string[] {
  return issues.map((issue) => {
    const message = t(issue.key, issue.params)
    return issue.severity === 'major' ? `${t('map.warn.severePrefix')} · ${message}` : message
  })
}

/** 有兼容性问题时先警告，用户忽略后才继续 */
function guard(map: MapFile, proceed: () => void): void {
  const issues = checkTags(map.manifest.tags)
  if (issues.length === 0) {
    proceed()
    return
  }
  dialog.value = {
    title: t('map.warn.title'),
    lines: issueLines(issues),
    actions: [
      {
        label: t('map.warn.ignore'),
        primary: true,
        onClick: () => {
          dialog.value = null
          proceed()
        },
      },
      { label: t('common.back'), onClick: () => (dialog.value = null) },
    ],
  }
}

function confirmDelete(map: MapFile): void {
  dialog.value = {
    title: t('maps.deleteTitle'),
    lines: [t('maps.deleteConfirm', { name: mapName(map) })],
    actions: [
      {
        label: t('maps.delete'),
        primary: true,
        onClick: async () => {
          dialog.value = null
          await deleteMap(map.manifest.id)
          await refresh()
        },
      },
      { label: t('common.cancel'), onClick: () => (dialog.value = null) },
    ],
  }
}

function exportName(map: MapFile): string {
  const base = resolveLocalized(map.meta.name, locale.value)
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
  return base || map.manifest.id.slice(0, 8)
}

function exportMap(map: MapFile): void {
  const url = URL.createObjectURL(new Blob([serializeMap(map)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${exportName(map)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function showError(lines: string[]): void {
  dialog.value = {
    title: t('map.err.title'),
    lines,
    actions: [{ label: t('common.back'), primary: true, onClick: () => (dialog.value = null) }],
  }
}

function pickFile(): void {
  fileRef.value?.click()
}

async function persistImported(map: MapFile, input: HTMLInputElement): Promise<void> {
  const fresh: MapFile = {
    ...map,
    manifest: { ...map.manifest, id: newId() },
    meta: { ...map.meta, updatedAt: Date.now() },
  }
  const ok = await saveMap(fresh)
  input.value = ''
  if (!ok) {
    showError([t('map.err.save')])
    return
  }
  await refresh()
}

async function onImportFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  let text: string
  try {
    text = await file.text()
  } catch {
    showError([t('map.err.read')])
    input.value = ''
    return
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    showError([t('map.err.json')])
    input.value = ''
    return
  }

  const { map, errors } = parseMapFile(raw)
  if (!map) {
    showError(errors.map((issue) => t(issue.key, issue.params)))
    input.value = ''
    return
  }

  const issues = checkTags(map.manifest.tags)
  if (issues.length === 0) {
    await persistImported(map, input)
    return
  }
  dialog.value = {
    title: t('map.warn.title'),
    lines: issueLines(issues),
    actions: [
      {
        label: t('map.warn.ignore'),
        primary: true,
        onClick: () => {
          dialog.value = null
          void persistImported(map, input)
        },
      },
      {
        label: t('common.back'),
        onClick: () => {
          dialog.value = null
          input.value = ''
        },
      },
    ],
  }
}

onMounted(refresh)
</script>

<template>
  <section class="maps rise">
    <header class="head">
      <h2>{{ t('maps.title') }}</h2>
      <div class="head-actions">
        <button v-if="explorer" class="interactive act" @click="closeExplorer">
          {{ t('maps.explorerClose') }}
        </button>
        <template v-else>
          <button class="interactive act" @click="openExplorer">{{ t('maps.explorer') }}</button>
          <button class="interactive act" @click="pickFile">{{ t('maps.import') }}</button>
        </template>
        <button class="interactive act" @click="$emit('back')">{{ t('common.back') }}</button>
      </div>
    </header>

    <input
      ref="fileRef"
      class="file"
      type="file"
      accept="application/json,.json"
      @change="onImportFile"
    />

    <template v-if="explorer">
      <section class="storage">
        <div class="storage-row">
          <span class="storage-title">{{ t('maps.storageEstimate') }}</span>
          <span v-if="storageLoading" class="storage-value">{{ t('maps.loading') }}</span>
          <span v-else-if="storageInfo" class="storage-value">
            {{
              t('maps.storageUsage', {
                used: formatBytes(storageInfo.usage),
                quota: formatBytes(storageInfo.quota),
              })
            }}
          </span>
          <span v-else class="storage-value">{{ t('maps.storageUnavailable') }}</span>
        </div>
        <div v-if="storageInfo && storageInfo.quota > 0" class="bar" aria-hidden="true">
          <i :style="{ width: `${usagePercent}%` }"></i>
        </div>
        <div class="storage-controls">
          <label class="check">
            <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
            <span>{{ t('maps.selectAll') }}</span>
          </label>
          <span class="note">{{ t('maps.selectedCount', { count: selectedCount }) }}</span>
          <span class="note">{{ t('maps.storageTotal', { count: maps.length, size: formatBytes(totalBytes) }) }}</span>
          <button
            class="interactive act"
            :disabled="selectedCount === 0"
            @click="confirmDeleteSelected"
          >
            {{ t('maps.deleteSelected') }}
          </button>
        </div>
      </section>

      <p v-if="maps.length === 0" class="empty">{{ t('maps.empty') }}</p>
      <ul v-else class="list">
        <li v-for="map in maps" :key="map.manifest.id" class="item">
          <label class="check grow">
            <input
              type="checkbox"
              :checked="selectedIds.has(map.manifest.id)"
              @change="toggleSelect(map.manifest.id)"
            />
            <span class="name">{{ mapName(map) }}</span>
          </label>
          <span class="meta">{{ formatBytes(sizeById.get(map.manifest.id) ?? 0) }}</span>
        </li>
      </ul>
    </template>

    <template v-else>
      <p v-if="maps.length === 0" class="empty">{{ t('maps.empty') }}</p>

      <ul v-else class="list">
        <li v-for="map in maps" :key="map.manifest.id" class="item">
          <div class="info">
            <span class="name">{{ mapName(map) }}</span>
            <span class="meta">
              {{ t('maps.size', { cols: map.meta.cols, rows: map.meta.rows }) }} ·
              {{ t('maps.updated', { time: formatTime(map.meta.updatedAt) }) }}
            </span>
          </div>
          <div class="actions">
            <button
              class="interactive act"
              :disabled="!isPlayable(map)"
              @click="guard(map, () => emit('play', map))"
            >
              {{ t('maps.play') }}
            </button>
            <span v-if="!isPlayable(map)" class="note">{{ t('maps.noGoal') }}</span>
            <button class="interactive act" @click="guard(map, () => emit('edit', map.manifest.id))">
              {{ t('maps.edit') }}
            </button>
            <button class="interactive act" @click="exportMap(map)">{{ t('maps.export') }}</button>
            <button class="interactive act" @click="confirmDelete(map)">{{ t('maps.delete') }}</button>
          </div>
        </li>
      </ul>
    </template>

    <OverlayPanel
      v-if="dialog"
      :title="dialog.title"
      :lines="dialog.lines"
      :actions="dialog.actions"
    />
  </section>
</template>

<style scoped>
.maps {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: min(92vw, 760px);
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
  gap: 8px;
}

.file {
  display: none;
}

.empty {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fg-faint);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  border: 1px solid var(--line);
  padding: 14px 16px;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.name {
  font-size: 14px;
  letter-spacing: 0.06em;
}

.meta {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.act {
  padding: 7px 10px;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.act:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.note {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--fg-faint);
}

.storage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--line);
  padding: 14px 16px;
}

.storage-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.storage-title {
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--fg-dim);
}

.storage-value {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
}

.bar {
  height: 4px;
  background: var(--line);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--fg);
}

.storage-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.check input {
  accent-color: var(--fg);
  cursor: pointer;
}

.grow {
  flex: 1;
  min-width: 0;
}
</style>
