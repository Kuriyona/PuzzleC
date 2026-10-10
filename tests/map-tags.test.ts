import { describe, expect, it } from 'vitest'
import { compareVersion, formatVersion, parseTag } from '../src/map/tags'
import { checkTags, findFeature } from '../src/map/features'

describe('parseTag', () => {
  it('解析带版本号的标签', () => {
    expect(parseTag('game:0.1')).toEqual({
      raw: 'game:0.1',
      path: 'game',
      segments: ['game'],
      version: { major: 0, minor: 1 },
    })
    expect(parseTag('text-tag/font/size:1.0')?.segments).toEqual(['text-tag', 'font', 'size'])
  })

  it('无版本后缀时 version 为 null', () => {
    const parsed = parseTag('editor')
    expect(parsed).not.toBeNull()
    expect(parsed?.version).toBeNull()
    expect(parsed?.path).toBe('editor')
  })

  it('非法标签返回 null', () => {
    for (const bad of ['text-tag:1', 'text-tag:1.0.0', ':1.0', '', 'Bad Tag', 'text-tag/', '/font']) {
      expect(parseTag(bad), bad).toBeNull()
    }
  })
})

describe('formatVersion / compareVersion', () => {
  it('格式化版本号', () => {
    expect(formatVersion({ major: 1, minor: 0 })).toBe('1.0')
  })

  it('比较版本号', () => {
    expect(compareVersion({ major: 1, minor: 0 }, { major: 1, minor: 0 })).toBe(0)
    expect(compareVersion({ major: 1, minor: 0 }, { major: 2, minor: 0 })).toBe(-1)
    expect(compareVersion({ major: 1, minor: 2 }, { major: 1, minor: 0 })).toBe(1)
  })
})

describe('findFeature', () => {
  it('主标签与多级副标签都能查到', () => {
    expect(findFeature(['game'])?.version).toEqual({ major: 0, minor: 1 })
    expect(findFeature(['text-tag', 'font', 'size'])?.version).toEqual({ major: 1, minor: 0 })
  })

  it('未知路径返回 null（含挂在未知主标签下）', () => {
    expect(findFeature(['nope'])).toBeNull()
    expect(findFeature(['text-tag', 'nope'])).toBeNull()
    expect(findFeature(['game', 'wall'])).toBeNull()
    expect(findFeature([])).toBeNull()
  })
})

describe('checkTags', () => {
  it('已知标签且版本兼容 → 无问题', () => {
    expect(checkTags(['game:0.1', 'text-tag/font/size:1.0'])).toEqual([])
    // 未写版本号不产生问题；更低版本无问题
    expect(checkTags(['game:0.0', 'editor'])).toEqual([])
  })

  it('未知标签 → 严重问题', () => {
    const issues = checkTags(['text-tag/nope:1.0'])
    expect(issues).toHaveLength(1)
    expect(issues[0].key).toBe('map.warn.unknownTag')
    expect(issues[0].params).toEqual({ tag: 'text-tag/nope:1.0' })
    expect(issues[0].severity).toBe('major')
  })

  it('主版本不同 → 严重问题并给出支持版本', () => {
    const issues = checkTags(['wall:2.0'])
    expect(issues).toHaveLength(1)
    expect(issues[0].key).toBe('map.warn.majorVersion')
    expect(issues[0].severity).toBe('major')
    expect(issues[0].params).toEqual({ tag: 'wall:2.0', supported: '1.0' })
  })

  it('次版本更高 → 提示级问题', () => {
    const issues = checkTags(['wall:1.9'])
    expect(issues).toHaveLength(1)
    expect(issues[0].key).toBe('map.warn.higherVersion')
    expect(issues[0].severity).toBe('minor')
    expect(issues[0].params).toEqual({ tag: 'wall:1.9', supported: '1.0' })
  })

  it('重复标签只检查一次，顺序按首次出现', () => {
    const issues = checkTags(['wall:2.0', 'wall:2.0', 'start:5.0'])
    expect(issues.map((i) => i.key)).toEqual(['map.warn.majorVersion', 'map.warn.majorVersion'])
    expect(issues.map((i) => i.params?.tag)).toEqual(['wall:2.0', 'start:5.0'])
  })
})
