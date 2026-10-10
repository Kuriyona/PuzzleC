import type { GenParams, RadiusId, SizeId } from '../types'
import type { MessageKey } from '../i18n/messages'

/** 随机迷宫边长（格）的可自定义范围 */
export const MIN_MAZE_SIZE = 4
export const MAX_MAZE_SIZE = 40
/** 视野半径（格）的可自定义范围 */
export const MIN_RADIUS = 1
export const MAX_RADIUS = 10

/** 迷宫尺寸预设（随机迷宫恒为方形，边长 = 格数） */
export const SIZE_OPTIONS = [
  { id: 'small', labelKey: 'opt.size.small', cells: 6 },
  { id: 'medium', labelKey: 'opt.size.medium', cells: 10 },
  { id: 'large', labelKey: 'opt.size.large', cells: 15 },
] as const satisfies readonly { id: SizeId; labelKey: MessageKey; cells: number }[]

/** 视野半径预设（格） */
export const RADIUS_OPTIONS = [
  { id: 'narrow', labelKey: 'opt.radius.narrow', value: 2 },
  { id: 'normal', labelKey: 'opt.radius.normal', value: 3 },
  { id: 'wide', labelKey: 'opt.radius.wide', value: 4 },
] as const satisfies readonly { id: RadiusId; labelKey: MessageKey; value: number }[]

export const DEFAULT_GEN_PARAMS: GenParams = {
  sizePreset: 'medium',
  sizeCustom: 10,
  radiusPreset: 'normal',
  radiusCustom: 3,
  seed: '',
}

export function clampMazeSize(n: number): number {
  return Math.min(MAX_MAZE_SIZE, Math.max(MIN_MAZE_SIZE, Math.round(n)))
}

export function clampRadius(n: number): number {
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(n)))
}

/** 解析出实际边长（格）：预设查表，自定义取 clamp 后的数值 */
export function mazeSizeOf(p: GenParams): number {
  if (p.sizePreset === 'custom') return clampMazeSize(p.sizeCustom)
  return (SIZE_OPTIONS.find((o) => o.id === p.sizePreset) ?? SIZE_OPTIONS[1]).cells
}

/** 解析出实际视野半径（格）：预设查表，自定义取 clamp 后的数值 */
export function radiusOf(p: GenParams): number {
  if (p.radiusPreset === 'custom') return clampRadius(p.radiusCustom)
  return (RADIUS_OPTIONS.find((o) => o.id === p.radiusPreset) ?? RADIUS_OPTIONS[1]).value
}

/**
 * 种子文本 → 种子数：空白返回 null（调用方自行随机）；
 * 纯数字按字面数值截断到 32 位，其它文本按 FNV-1a 哈希，
 * 于是同一段文本总是同一座迷宫，而随便写几个字也照样能用。
 */
export function parseSeed(text: string): number | null {
  const value = text.trim()
  if (value === '') return null
  if (/^\d+$/.test(value)) return Number(value) >>> 0
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
