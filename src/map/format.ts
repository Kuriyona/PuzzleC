import type { Level, LevelLabel, LocaleId, TextAlignId, TextSizeId } from '../types'
import type { MessageKey } from '../i18n/messages'
import { isLocaleId } from '../i18n/messages'
import { findFeature } from './features'
import { formatVersion } from './tags'

/** 地图边长上限 / 下限；默认新地图尺寸 */
export const MAP_MIN_SIDE = 1
export const MAP_MAX_SIDE = 64
export const DEFAULT_MAP_SIDE = 15

/** 可本地化文本：`text` 为回退文本，`i18n` 存在即表示启用国际化 */
export interface LocalizedText {
  text: string
  i18n?: Partial<Record<LocaleId, string>>
}

/** 地图身份 + 用到的原子化特性（多级标签） */
export interface MapManifest {
  id: string
  tags: string[]
}

export interface MapMeta {
  name: LocalizedText
  description: LocalizedText
  cols: number
  rows: number
  createdAt: number
  updatedAt: number
}

/** 墙体：`v` = [线索引 k, 行 y]，`h` = [线索引 k, 列 x] */
export interface MapWalls {
  v: [number, number][]
  h: [number, number][]
}

export interface MapLabel {
  id: string
  pos: [number, number]
  text: LocalizedText
  size: TextSizeId
  align: TextAlignId
}

export interface MapData {
  start: [number, number]
  goals: [number, number][]
  walls: MapWalls
  labels: MapLabel[]
}

export interface MapFile {
  manifest: MapManifest
  meta: MapMeta
  data: MapData
}

export const TEXT_SIZE_OPTIONS = [
  { id: 'small', labelKey: 'opt.textSize.small', scale: 0.25 },
  { id: 'medium', labelKey: 'opt.textSize.medium', scale: 0.4 },
  { id: 'large', labelKey: 'opt.textSize.large', scale: 0.6 },
] as const satisfies readonly { id: TextSizeId; labelKey: MessageKey; scale: number }[]

export const TEXT_ALIGN_OPTIONS = [
  { id: 'left', labelKey: 'opt.textAlign.left' },
  { id: 'center', labelKey: 'opt.textAlign.center' },
  { id: 'right', labelKey: 'opt.textAlign.right' },
] as const satisfies readonly { id: TextAlignId; labelKey: MessageKey }[]

/** 字号 → 格高比例（未命中回退 medium） */
export function textSizeScale(id: TextSizeId): number {
  return (TEXT_SIZE_OPTIONS.find((o) => o.id === id) ?? TEXT_SIZE_OPTIONS[1]).scale
}

export function isTextSizeId(v: unknown): v is TextSizeId {
  return TEXT_SIZE_OPTIONS.some((o) => o.id === v)
}

export function isTextAlignId(v: unknown): v is TextAlignId {
  return TEXT_ALIGN_OPTIONS.some((o) => o.id === v)
}

/** 唯一含副作用的函数：生成标识；crypto.randomUUID 不可用时回退 */
export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** 当前语言的文本：i18n 命中且 trim 后非空则用它，否则 text */
export function resolveLocalized(text: LocalizedText, locale: LocaleId): string {
  const value = text.i18n?.[locale]
  if (typeof value === 'string' && value.trim() !== '') return value
  return text.text
}

/** 依据 data 重算 manifest.tags（版本号取自特性表） */
export function computeManifestTags(data: MapData): string[] {
  const tags: string[] = []
  const push = (path: string): void => {
    const node = findFeature(path.split('/'))
    if (node) tags.push(`${path}:${formatVersion(node.version)}`)
  }
  push('game')
  push('editor')
  push('wall')
  push('start')
  if (data.goals.length > 0) push('goal')
  if (data.labels.length > 0) {
    push('text-tag')
    push('text-tag/font/size')
    push('text-tag/font/align')
    if (data.labels.some((l) => l.text.i18n && Object.keys(l.text.i18n).length > 0)) {
      push('text-tag/i18n')
    }
  }
  return tags
}

// ---------- 解析 ----------

export interface MapParseResult {
  map: MapFile | null
  errors: { key: MessageKey; params?: Record<string, string | number> }[]
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function structureError(section: 'manifest' | 'meta' | 'data'): MapParseResult {
  return { map: null, errors: [{ key: 'map.err.structure', params: { section } }] }
}

/** 读取时可本地化文本：i18n 丢弃未知语言键与空白值；全空则去掉 i18n 字段 */
function parseLocalized(v: unknown): LocalizedText | null {
  if (!isObj(v)) return null
  const text = typeof v.text === 'string' ? v.text : ''
  if (isObj(v.i18n)) {
    const i18n: Partial<Record<LocaleId, string>> = {}
    let count = 0
    for (const [key, value] of Object.entries(v.i18n)) {
      if (!isLocaleId(key) || typeof value !== 'string' || value.trim() === '') continue
      i18n[key] = value
      count++
    }
    if (count > 0) return { text, i18n }
  }
  return { text }
}

function parseManifest(v: unknown): MapManifest | null {
  if (!isObj(v)) return null
  const id = v.id
  if (typeof id !== 'string' || id.length === 0) return null
  if (!Array.isArray(v.tags) || !v.tags.every((t) => typeof t === 'string')) return null
  return { id, tags: v.tags as string[] }
}

function parseMeta(v: unknown): MapMeta | null {
  if (!isObj(v)) return null
  const name = parseLocalized(v.name)
  const description = parseLocalized(v.description)
  if (!name || !description) return null
  const cols = v.cols
  const rows = v.rows
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) return null
  const c = cols as number
  const r = rows as number
  if (c < MAP_MIN_SIDE || c > MAP_MAX_SIDE || r < MAP_MIN_SIDE || r > MAP_MAX_SIDE) return null
  const createdAt = Number.isFinite(v.createdAt) ? (v.createdAt as number) : 0
  const updatedAt = Number.isFinite(v.updatedAt) ? (v.updatedAt as number) : 0
  return { name, description, cols: c, rows: r, createdAt, updatedAt }
}

/** [x,y] 两个整数 */
function parseCell(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length < 2) return null
  const [x, y] = v
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null
  return [x as number, y as number]
}

function parseData(v: unknown, cols: number, rows: number): MapData | null {
  if (!isObj(v)) return null

  const start = parseCell(v.start)
  if (!start || start[0] < 0 || start[0] >= cols || start[1] < 0 || start[1] >= rows) return null

  const goals: [number, number][] = []
  const goalSeen = new Set<string>()
  if (Array.isArray(v.goals)) {
    for (const item of v.goals) {
      const cell = parseCell(item)
      if (!cell) continue
      if (cell[0] < 0 || cell[0] >= cols || cell[1] < 0 || cell[1] >= rows) continue
      const key = `${cell[0]},${cell[1]}`
      if (goalSeen.has(key)) continue
      goalSeen.add(key)
      goals.push(cell)
    }
  }
  goals.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))

  const walls: MapWalls = { v: [], h: [] }
  const rawWalls = isObj(v.walls) ? v.walls : {}
  const vSeen = new Set<string>()
  if (Array.isArray(rawWalls.v)) {
    for (const item of rawWalls.v) {
      const seg = parseCell(item)
      if (!seg) continue
      const [k, y] = seg
      if (k < 0 || k > cols || y < 0 || y > rows - 1) continue
      const key = `${k},${y}`
      if (vSeen.has(key)) continue
      vSeen.add(key)
      walls.v.push(seg)
    }
  }
  const hSeen = new Set<string>()
  if (Array.isArray(rawWalls.h)) {
    for (const item of rawWalls.h) {
      const seg = parseCell(item)
      if (!seg) continue
      const [k, x] = seg
      if (k < 0 || k > rows || x < 0 || x > cols - 1) continue
      const key = `${k},${x}`
      if (hSeen.has(key)) continue
      hSeen.add(key)
      walls.h.push(seg)
    }
  }
  walls.v.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
  walls.h.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))

  const labels: MapLabel[] = []
  if (Array.isArray(v.labels)) {
    for (const item of v.labels) {
      const label = parseLabel(item, cols, rows)
      if (label) labels.push(label)
    }
  }

  return { start, goals, walls, labels }
}

function clampRound1(value: number, max: number): number {
  const rounded = Math.round(value * 10) / 10
  return Math.min(max, Math.max(0, rounded))
}

function parseLabel(v: unknown, cols: number, rows: number): MapLabel | null {
  if (!isObj(v)) return null
  const rawPos = v.pos
  if (!Array.isArray(rawPos) || rawPos.length < 2) return null
  const [px, py] = rawPos
  if (typeof px !== 'number' || !Number.isFinite(px)) return null
  if (typeof py !== 'number' || !Number.isFinite(py)) return null

  const text = parseLocalized(v.text) ?? { text: '' }
  return {
    id: typeof v.id === 'string' && v.id.length > 0 ? v.id : newId(),
    pos: [clampRound1(px, cols), clampRound1(py, rows)],
    text,
    size: isTextSizeId(v.size) ? v.size : 'medium',
    align: isTextAlignId(v.align) ? v.align : 'center',
  }
}

/**
 * 解析地图文件。结构不合法（manifest / meta / data 任一段）→ map = null，
 * errors 含一条 `map.err.structure`（params.section 指明段名）。
 */
export function parseMapFile(raw: unknown): MapParseResult {
  if (!isObj(raw)) return structureError('manifest')
  const manifest = parseManifest(raw.manifest)
  if (!manifest) return structureError('manifest')
  const meta = parseMeta(raw.meta)
  if (!meta) return structureError('meta')
  const data = parseData(raw.data, meta.cols, meta.rows)
  if (!data) return structureError('data')
  return { map: { manifest, meta, data }, errors: [] }
}

// ---------- 序列化 ----------

function tagPath(tag: string): string {
  const colon = tag.indexOf(':')
  return colon === -1 ? tag : tag.slice(0, colon)
}

function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const pa = tagPath(a)
    const pb = tagPath(b)
    if (pa === 'game' && pb !== 'game') return -1
    if (pb === 'game' && pa !== 'game') return 1
    if (pa !== pb) return pa < pb ? -1 : 1
    return a < b ? -1 : a > b ? 1 : 0
  })
}

function serializeLocalized(text: LocalizedText): Record<string, unknown> {
  const out: Record<string, unknown> = { text: text.text }
  const i18n = text.i18n
  if (i18n && Object.keys(i18n).length > 0) out.i18n = { ...i18n }
  return out
}

/** 稳定序列化：2 空格缩进；tags 与墙 / 目标按 §1 排序 */
export function serializeMap(map: MapFile): string {
  const { manifest, meta, data } = map
  const goals = [...data.goals].sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
  const v = [...data.walls.v].sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
  const h = [...data.walls.h].sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
  const payload = {
    manifest: { id: manifest.id, tags: sortTags(manifest.tags) },
    meta: {
      name: serializeLocalized(meta.name),
      description: serializeLocalized(meta.description),
      cols: meta.cols,
      rows: meta.rows,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    },
    data: {
      start: data.start,
      goals,
      walls: { v, h },
      labels: data.labels.map((l) => ({
        id: l.id,
        pos: l.pos,
        text: serializeLocalized(l.text),
        size: l.size,
        align: l.align,
      })),
    },
  }
  return JSON.stringify(payload, null, 2)
}

/** 序列化后的 UTF-8 字节数（IndexedDB 无逐条占用查询，用导出体积作为估算） */
export function mapByteSize(map: MapFile): number {
  return new TextEncoder().encode(serializeMap(map)).length
}

// ---------- 构建 ----------

/** 外圈墙段（编辑器与运行时共用的补齐逻辑） */
export function borderWalls(cols: number, rows: number): MapWalls {
  const v: [number, number][] = []
  const h: [number, number][] = []
  for (let y = 0; y < rows; y++) {
    v.push([0, y], [cols, y])
  }
  for (let x = 0; x < cols; x++) {
    h.push([0, x], [rows, x])
  }
  return { v, h }
}

/** 新建空白地图：外圈墙齐备、起点 (0,0)、无目标无标签 */
export function createMapFile(cols: number, rows: number, now: number): MapFile {
  const walls = borderWalls(cols, rows)
  const data: MapData = { start: [0, 0], goals: [], walls, labels: [] }
  return {
    manifest: { id: newId(), tags: computeManifestTags(data) },
    meta: { name: { text: '' }, description: { text: '' }, cols, rows, createdAt: now, updatedAt: now },
    data,
  }
}

/** 由地图构建运行时关卡（永不抛错；goals 可为空；外圈墙恒补齐） */
export function mapToLevel(map: MapFile, locale: LocaleId): Level {
  const { cols, rows } = map.meta
  const hWalls = new Uint8Array((rows + 1) * cols)
  const vWalls = new Uint8Array(rows * (cols + 1))

  for (const [k, y] of map.data.walls.v) {
    if (k < 0 || k > cols || y < 0 || y >= rows) continue
    vWalls[y * (cols + 1) + k] = 1
  }
  for (const [k, x] of map.data.walls.h) {
    if (k < 0 || k > rows || x < 0 || x >= cols) continue
    hWalls[k * cols + x] = 1
  }
  for (let y = 0; y < rows; y++) {
    vWalls[y * (cols + 1)] = 1
    vWalls[y * (cols + 1) + cols] = 1
  }
  for (let x = 0; x < cols; x++) {
    hWalls[x] = 1
    hWalls[rows * cols + x] = 1
  }

  const start = { x: map.data.start[0], y: map.data.start[1] }
  const goals = map.data.goals.map(([x, y]) => ({ x, y }))
  const labels: LevelLabel[] = map.data.labels.map((l) => ({
    pos: { x: l.pos[0], y: l.pos[1] },
    text: resolveLocalized(l.text, locale),
    size: l.size,
    align: l.align,
  }))

  return { seed: 0, cols, rows, hWalls, vWalls, start, goals, labels }
}

/** 有至少一个目标才可游玩 */
export function isPlayable(map: MapFile): boolean {
  return map.data.goals.length > 0
}
