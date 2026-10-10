import type { RadiusId, Settings, SizeId } from '../types'
import { SIZE_OPTIONS } from './maze'

export const RADIUS_OPTIONS = [
  { id: 'narrow', label: '窄', value: 2 },
  { id: 'normal', label: '中', value: 3 },
  { id: 'wide', label: '宽', value: 4 },
] as const satisfies readonly { id: RadiusId; label: string; value: number }[]

export const SETTINGS_KEY = 'maze-lumen.settings.v1'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches === true

export const DEFAULT_SETTINGS: Settings = {
  size: 'medium',
  radius: 'normal',
  animations: !prefersReducedMotion,
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
  return { size, radius, animations }
}

export function saveSettings(s: Settings): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
}
