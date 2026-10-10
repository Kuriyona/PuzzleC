import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GEN_PARAMS,
  MAX_MAZE_SIZE,
  MAX_RADIUS,
  MIN_MAZE_SIZE,
  MIN_RADIUS,
  clampMazeSize,
  clampRadius,
  mazeSizeOf,
  parseSeed,
  radiusOf,
} from '../src/game/gen'

describe('随机迷宫生成参数', () => {
  it('默认参数解析为中号迷宫与普通视野', () => {
    expect(mazeSizeOf(DEFAULT_GEN_PARAMS)).toBe(10)
    expect(radiusOf(DEFAULT_GEN_PARAMS)).toBe(3)
  })

  it('预设取预设表的数值，自定义取自定义数值', () => {
    expect(mazeSizeOf({ ...DEFAULT_GEN_PARAMS, sizePreset: 'small' })).toBe(6)
    expect(mazeSizeOf({ ...DEFAULT_GEN_PARAMS, sizePreset: 'large' })).toBe(15)
    expect(mazeSizeOf({ ...DEFAULT_GEN_PARAMS, sizePreset: 'custom', sizeCustom: 23 })).toBe(23)
    expect(radiusOf({ ...DEFAULT_GEN_PARAMS, radiusPreset: 'wide' })).toBe(4)
    expect(radiusOf({ ...DEFAULT_GEN_PARAMS, radiusPreset: 'custom', radiusCustom: 7 })).toBe(7)
  })

  it('自定义数值会被 clamp 到允许范围内并取整', () => {
    expect(clampMazeSize(1)).toBe(MIN_MAZE_SIZE)
    expect(clampMazeSize(999)).toBe(MAX_MAZE_SIZE)
    expect(clampMazeSize(12.6)).toBe(13)
    expect(clampRadius(0)).toBe(MIN_RADIUS)
    expect(clampRadius(99)).toBe(MAX_RADIUS)
    const huge = { ...DEFAULT_GEN_PARAMS, sizePreset: 'custom' as const, sizeCustom: 999 }
    expect(mazeSizeOf(huge)).toBe(MAX_MAZE_SIZE)
    const negative = { ...DEFAULT_GEN_PARAMS, radiusPreset: 'custom' as const, radiusCustom: -3 }
    expect(radiusOf(negative)).toBe(MIN_RADIUS)
  })

  it('种子留空（含纯空白）表示随机', () => {
    expect(parseSeed('')).toBeNull()
    expect(parseSeed('   ')).toBeNull()
  })

  it('纯数字种子按字面数值，并截断到 32 位', () => {
    expect(parseSeed('42')).toBe(42)
    expect(parseSeed(' 12345 ')).toBe(12345)
    expect(parseSeed('0')).toBe(0)
    expect(parseSeed('4294967297')).toBe(1)
  })

  it('其它文本按内容映射成稳定种子', () => {
    const seed = parseSeed('puzzlec')
    expect(seed).toBe(parseSeed('puzzlec'))
    expect(seed).toBe(parseSeed('  puzzlec  '))
    expect(seed).not.toBe(parseSeed('puzzleC'))
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThanOrEqual(0xffffffff)
  })
})
