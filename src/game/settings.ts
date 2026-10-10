import type { MazeThemeId, RadiusId, Settings, SizeId, UiThemeId } from '../types'
import type { MessageKey } from '../i18n/messages'
import { DEFAULT_LOCALE, isLocaleId } from '../i18n/messages'
import { SIZE_OPTIONS } from './maze'

export const UI_THEME_OPTIONS = [
  { id: 'light', labelKey: 'opt.uiTheme.light' },
  { id: 'dark', labelKey: 'opt.uiTheme.dark' },
  { id: 'system', labelKey: 'opt.uiTheme.system' },
] as const satisfies readonly { id: UiThemeId; labelKey: MessageKey }[]

export const MAZE_THEME_OPTIONS = [
  { id: 'dark', labelKey: 'opt.mazeTheme.dark' },
  { id: 'light', labelKey: 'opt.mazeTheme.light' },
  { id: 'ui', labelKey: 'opt.mazeTheme.ui' },
] as const satisfies readonly { id: MazeThemeId; labelKey: MessageKey }[]

export const RADIUS_OPTIONS = [
  { id: 'narrow', labelKey: 'opt.radius.narrow', value: 2 },
  { id: 'normal', labelKey: 'opt.radius.normal', value: 3 },
  { id: 'wide', labelKey: 'opt.radius.wide', value: 4 },
] as const satisfies readonly { id: RadiusId; labelKey: MessageKey; value: number }[]

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
  locale: DEFAULT_LOCALE,
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
  const locale = isLocaleId(parsed.locale) ? parsed.locale : DEFAULT_SETTINGS.locale
  return { size, radius, animations, uiTheme, mazeTheme, locale }
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
