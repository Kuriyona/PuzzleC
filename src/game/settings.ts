import type { MazeThemeId, RadiusId, Settings, SizeId, UiThemeId } from '../types'
import { SIZE_OPTIONS } from './maze'

export const UI_THEME_OPTIONS = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'system', label: '系统' },
] as const satisfies readonly { id: UiThemeId; label: string }[]

export const MAZE_THEME_OPTIONS = [
  { id: 'dark', label: '深色' },
  { id: 'light', label: '浅色' },
  { id: 'ui', label: '跟随UI' },
] as const satisfies readonly { id: MazeThemeId; label: string }[]

export const RADIUS_OPTIONS = [
  { id: 'narrow', label: '窄', value: 2 },
  { id: 'normal', label: '中', value: 3 },
  { id: 'wide', label: '宽', value: 4 },
] as const satisfies readonly { id: RadiusId; label: string; value: number }[]

export const SETTINGS_KEY = 'puzzlec.settings.v1'
/** 首次进入游戏的主题引导是否已看过：与设置分开存，免得“恢复默认”把它重置回未看过 */
export const INTRO_KEY = 'puzzlec.intro.v1'

function mediaMatches(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches === true
  )
}

/** 系统是否偏好深色；无 matchMedia（如 SSR/测试环境）时按浅色处理 */
export function prefersDarkScheme(): boolean {
  return mediaMatches('(prefers-color-scheme: dark)')
}

/** 订阅系统配色变化，返回取消订阅函数（无 matchMedia 时为空操作） */
export function subscribeSystemScheme(onChange: (dark: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent): void => onChange(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

export const DEFAULT_SETTINGS: Settings = {
  size: 'medium',
  radius: 'normal',
  animations: !mediaMatches('(prefers-reduced-motion: reduce)'),
  uiTheme: 'light',
  mazeTheme: 'ui',
}

export function sizeCells(id: SizeId): number {
  return (SIZE_OPTIONS.find((o) => o.id === id) ?? SIZE_OPTIONS[1]).cells
}

export function radiusValue(id: RadiusId): number {
  return (RADIUS_OPTIONS.find((o) => o.id === id) ?? RADIUS_OPTIONS[1]).value
}

export function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS }
  let raw: unknown = null
  try {
    raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '')
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS }

  const parsed = raw as Partial<Record<keyof Settings, unknown>>
  const size = SIZE_OPTIONS.some((o) => o.id === parsed.size)
    ? (parsed.size as SizeId)
    : DEFAULT_SETTINGS.size
  const radius = RADIUS_OPTIONS.some((o) => o.id === parsed.radius)
    ? (parsed.radius as RadiusId)
    : DEFAULT_SETTINGS.radius
  const animations =
    typeof parsed.animations === 'boolean' ? parsed.animations : DEFAULT_SETTINGS.animations
  const uiTheme = UI_THEME_OPTIONS.some((o) => o.id === parsed.uiTheme)
    ? (parsed.uiTheme as UiThemeId)
    : DEFAULT_SETTINGS.uiTheme
  const mazeTheme = MAZE_THEME_OPTIONS.some((o) => o.id === parsed.mazeTheme)
    ? (parsed.mazeTheme as MazeThemeId)
    : DEFAULT_SETTINGS.mazeTheme
  return { size, radius, animations, uiTheme, mazeTheme }
}

export function saveSettings(s: Settings): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
}

/** 是否已经看过首次进入游戏的主题引导 */
export function loadIntroSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(INTRO_KEY, '1')
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
}
