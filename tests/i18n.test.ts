import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  LOCALE_IDS,
  LOCALE_OPTIONS,
  LOCALE_TAGS,
  MESSAGES,
  isLocaleId,
  translate,
} from '../src/i18n/messages'
import { MAZE_THEME_OPTIONS, RADIUS_OPTIONS, UI_THEME_OPTIONS } from '../src/game/settings'
import { SIZE_OPTIONS } from '../src/game/maze'
import { TEXT_ALIGN_OPTIONS, TEXT_SIZE_OPTIONS } from '../src/map/format'

const total = 4

describe('本地化消息表', () => {
  it('四种语言的键集合完全一致', () => {
    const reference = Object.keys(MESSAGES['zh-Hans']).sort()
    expect(Object.keys(MESSAGES)).toHaveLength(total)
    for (const locale of LOCALE_IDS) {
      expect(Object.keys(MESSAGES[locale]).sort()).toEqual(reference)
    }
  })

  it('每条消息在所有语言下都非空', () => {
    for (const locale of LOCALE_IDS) {
      for (const [key, value] of Object.entries(MESSAGES[locale])) {
        expect(value.trim(), `${locale} / ${key}`).not.toBe('')
      }
    }
  })

  it('占位符集合跨语言一致', () => {
    const placeholders = (s: string): string[] =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const reference = Object.fromEntries(
      Object.entries(MESSAGES['zh-Hans']).map(([k, v]) => [k, placeholders(v)]),
    )
    for (const locale of LOCALE_IDS) {
      for (const [key, value] of Object.entries(MESSAGES[locale])) {
        expect(placeholders(value), `${locale} / ${key}`).toEqual(reference[key])
      }
    }
  })

  it('语言代码与语言标签一一对应', () => {
    expect(Object.keys(LOCALE_TAGS).sort()).toEqual([...LOCALE_IDS].sort())
    expect(LOCALE_OPTIONS.map((o) => o.id)).toEqual(LOCALE_IDS)
  })
})

describe('translate', () => {
  it('替换 {占位符}，值转为字符串', () => {
    expect(translate('zh-Hans', 'game.stats.time', { time: '01:23' })).toBe('用时 01:23')
    expect(translate('en', 'game.hud.level', { level: 3 })).toBe('Level 3')
  })

  it('保留缺失的占位符，不做破坏性替换', () => {
    expect(translate('en', 'game.stats.seed', {})).toBe('Seed {seed}')
  })

  it('未知语言回落到默认语言', () => {
    expect(translate('xx' as never, 'menu.start')).toBe(MESSAGES[DEFAULT_LOCALE]['menu.start'])
  })

  it('每个选项标签键在所有语言下都有对应消息', () => {
    const labelKeys = [
      ...UI_THEME_OPTIONS,
      ...MAZE_THEME_OPTIONS,
      ...RADIUS_OPTIONS,
      ...SIZE_OPTIONS,
      ...TEXT_SIZE_OPTIONS,
      ...TEXT_ALIGN_OPTIONS,
    ].map((o) => o.labelKey)
    expect(labelKeys.length).toBeGreaterThan(0)
    for (const locale of LOCALE_IDS) {
      for (const key of labelKeys) {
        expect(translate(locale, key)).not.toBe(key)
      }
    }
  })
})

describe('isLocaleId', () => {
  it('只接受已知语言代码', () => {
    for (const id of LOCALE_IDS) expect(isLocaleId(id)).toBe(true)
    expect(isLocaleId('zh')).toBe(false)
    expect(isLocaleId(42)).toBe(false)
    expect(isLocaleId(null)).toBe(false)
  })
})
