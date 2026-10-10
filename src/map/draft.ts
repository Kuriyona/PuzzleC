import type { Cell, LocaleId, TextAlignId, TextSizeId } from '../types'
import { isLocaleId } from '../i18n/messages'
import type { LocalizedText, MapFile, MapLabel, MapWalls } from './format'
import { computeManifestTags } from './format'
import { newId } from './format'

export { newId }

/** 编辑器工作副本：与文件同形，但墙用定长 Uint8Array */
export interface EditorDraft {
  id: string
  name: LocalizedText
  description: LocalizedText
  cols: number
  rows: number
  createdAt: number
  updatedAt: number
  vWalls: Uint8Array
  hWalls: Uint8Array
  start: Cell
  goals: Cell[]
  labels: MapLabel[]
}

/** 空墙格（长度按尺寸，外圈恒为墙） */
function emptyWalls(cols: number, rows: number): { vWalls: Uint8Array; hWalls: Uint8Array } {
  const vWalls = new Uint8Array(rows * (cols + 1))
  const hWalls = new Uint8Array((rows + 1) * cols)
  for (let y = 0; y < rows; y++) {
    vWalls[y * (cols + 1)] = 1
    vWalls[y * (cols + 1) + cols] = 1
  }
  for (let x = 0; x < cols; x++) {
    hWalls[x] = 1
    hWalls[rows * cols + x] = 1
  }
  return { vWalls, hWalls }
}

function copyLocalized(text: LocalizedText): LocalizedText {
  return text.i18n ? { text: text.text, i18n: { ...text.i18n } } : { text: text.text }
}

/** 归一化：剔除 i18n 空串 / 未知语言键；全空则去掉 i18n 字段 */
function normalizeLocalized(text: LocalizedText): LocalizedText {
  const i18n = text.i18n
  if (!i18n) return { text: text.text }
  const out: Partial<Record<LocaleId, string>> = {}
  let count = 0
  for (const [key, value] of Object.entries(i18n)) {
    if (!isLocaleId(key) || typeof value !== 'string' || value.trim() === '') continue
    out[key] = value
    count++
  }
  return count > 0 ? { text: text.text, i18n: out } : { text: text.text }
}

export function createDraft(cols: number, rows: number, now: number): EditorDraft {
  const { vWalls, hWalls } = emptyWalls(cols, rows)
  return {
    id: newId(),
    name: { text: '' },
    description: { text: '' },
    cols,
    rows,
    createdAt: now,
    updatedAt: now,
    vWalls,
    hWalls,
    start: { x: 0, y: 0 },
    goals: [],
    labels: [],
  }
}

export function draftFromMap(map: MapFile): EditorDraft {
  const { cols, rows } = map.meta
  const { vWalls, hWalls } = emptyWalls(cols, rows)
  for (const [k, y] of map.data.walls.v) {
    if (k < 0 || k > cols || y < 0 || y >= rows) continue
    vWalls[y * (cols + 1) + k] = 1
  }
  for (const [k, x] of map.data.walls.h) {
    if (k < 0 || k > rows || x < 0 || x >= cols) continue
    hWalls[k * cols + x] = 1
  }
  return {
    id: map.manifest.id,
    name: copyLocalized(map.meta.name),
    description: copyLocalized(map.meta.description),
    cols,
    rows,
    createdAt: map.meta.createdAt,
    updatedAt: map.meta.updatedAt,
    vWalls,
    hWalls,
    start: { x: map.data.start[0], y: map.data.start[1] },
    goals: map.data.goals.map(([x, y]) => ({ x, y })),
    labels: map.data.labels.map((l) => ({
      id: l.id,
      pos: [l.pos[0], l.pos[1]],
      text: copyLocalized(l.text),
      size: l.size,
      align: l.align,
    })),
  }
}

/** 归一化后输出为地图文件（i18n 收敛、tags 重算、updatedAt = now） */
export function mapFromDraft(draft: EditorDraft, now: number): MapFile {
  const { cols, rows } = draft
  const walls: MapWalls = { v: [], h: [] }
  for (let k = 0; k <= cols; k++) {
    for (let y = 0; y < rows; y++) {
      if (draft.vWalls[y * (cols + 1) + k] === 1) walls.v.push([k, y])
    }
  }
  for (let k = 0; k <= rows; k++) {
    for (let x = 0; x < cols; x++) {
      if (draft.hWalls[k * cols + x] === 1) walls.h.push([k, x])
    }
  }
  walls.v.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
  walls.h.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))

  const goals = draft.goals
    .map((g) => [g.x, g.y] as [number, number])
    .sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))

  const labels: MapLabel[] = draft.labels.map((l) => ({
    id: l.id,
    pos: [l.pos[0], l.pos[1]],
    text: normalizeLocalized(l.text),
    size: l.size as TextSizeId,
    align: l.align as TextAlignId,
  }))

  const data = {
    start: [draft.start.x, draft.start.y] as [number, number],
    goals,
    walls,
    labels,
  }
  return {
    manifest: { id: draft.id, tags: computeManifestTags(data) },
    meta: {
      name: normalizeLocalized(draft.name),
      description: normalizeLocalized(draft.description),
      cols,
      rows,
      createdAt: draft.createdAt,
      updatedAt: now,
    },
    data,
  }
}

function wallInRange(axis: 'v' | 'h', k: number, i: number, cols: number, rows: number): boolean {
  return axis === 'v' ? k <= cols && i < rows : k <= rows && i < cols
}

/** 缩小到 (cols, rows) 会移除的越界原件数 */
export function countOutOfRange(draft: EditorDraft, cols: number, rows: number): number {
  let count = 0
  const { vWalls, hWalls } = draft
  for (let k = 0; k <= draft.cols; k++) {
    for (let y = 0; y < draft.rows; y++) {
      if (vWalls[y * (draft.cols + 1) + k] === 1 && !wallInRange('v', k, y, cols, rows)) count++
    }
  }
  for (let k = 0; k <= draft.rows; k++) {
    for (let x = 0; x < draft.cols; x++) {
      if (hWalls[k * draft.cols + x] === 1 && !wallInRange('h', k, x, cols, rows)) count++
    }
  }
  for (const g of draft.goals) {
    if (g.x >= cols || g.y >= rows) count++
  }
  for (const l of draft.labels) {
    if (l.pos[0] > cols || l.pos[1] > rows) count++
  }
  if (draft.start.x >= cols || draft.start.y >= rows) count++
  return count
}

/** 应用尺寸：重建墙数组（补新外圈、保留范围内旧墙），越界目标 / 标签删除，起点越界则重置 */
export function resizeDraft(draft: EditorDraft, cols: number, rows: number): void {
  const oldCols = draft.cols
  const oldRows = draft.rows
  const oldV = draft.vWalls
  const oldH = draft.hWalls
  const { vWalls, hWalls } = emptyWalls(cols, rows)

  for (let k = 0; k <= oldCols; k++) {
    for (let y = 0; y < oldRows; y++) {
      if (oldV[y * (oldCols + 1) + k] !== 1) continue
      if (!wallInRange('v', k, y, cols, rows)) continue
      vWalls[y * (cols + 1) + k] = 1
    }
  }
  for (let k = 0; k <= oldRows; k++) {
    for (let x = 0; x < oldCols; x++) {
      if (oldH[k * oldCols + x] !== 1) continue
      if (!wallInRange('h', k, x, cols, rows)) continue
      hWalls[k * cols + x] = 1
    }
  }

  draft.cols = cols
  draft.rows = rows
  draft.vWalls = vWalls
  draft.hWalls = hWalls
  draft.goals = draft.goals.filter((g) => g.x < cols && g.y < rows)
  draft.labels = draft.labels.filter((l) => l.pos[0] <= cols && l.pos[1] <= rows)
  if (draft.start.x >= cols || draft.start.y >= rows) draft.start = { x: 0, y: 0 }
}
