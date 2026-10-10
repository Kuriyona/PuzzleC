import { describe, expect, it } from 'vitest'
import {
  MAP_MAX_SIDE,
  computeManifestTags,
  createMapFile,
  isPlayable,
  isTextAlignId,
  isTextSizeId,
  mapByteSize,
  mapToLevel,
  parseMapFile,
  resolveLocalized,
  serializeMap,
  textSizeScale,
} from '../src/map/format'
import type { MapData, MapFile } from '../src/map/format'

/** 经由序列化往返，得到规范化地图（用于比较） */
function canonical(map: MapFile): MapFile {
  const { map: parsed } = parseMapFile(JSON.parse(serializeMap(map)))
  if (!parsed) throw new Error('canonical failed')
  return parsed
}

/** 直方形的 JSON 深拷贝，用于制造“非法结构”输入 */
function clone(raw: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(raw))
}

describe('createMapFile / mapToLevel', () => {
  it('空白地图的外圈墙齐备，无目标不可游玩', () => {
    const map = createMapFile(3, 3, 0)
    expect(map.data.goals).toEqual([])
    expect(isPlayable(map)).toBe(false)

    const level = mapToLevel(canonical(map), 'en')
    expect(level.vWalls.length).toBe(3 * 4)
    expect(level.hWalls.length).toBe(4 * 3)
    for (let y = 0; y < 3; y++) {
      expect(level.vWalls[y * 4]).toBe(1)
      expect(level.vWalls[y * 4 + 3]).toBe(1)
    }
    for (let x = 0; x < 3; x++) {
      expect(level.hWalls[x]).toBe(1)
      expect(level.hWalls[3 * 3 + x]).toBe(1)
    }
    expect(level.goals).toEqual([])
    expect(level.labels).toEqual([])
    expect(level.start).toEqual({ x: 0, y: 0 })
  })

  it('外圈墙无视文件内容恒补齐', () => {
    const map = createMapFile(2, 2, 0)
    map.data.walls = { v: [], h: [] }
    const level = mapToLevel(map, 'en')
    for (let y = 0; y < 2; y++) {
      expect(level.vWalls[y * 3]).toBe(1)
      expect(level.vWalls[y * 3 + 2]).toBe(1)
    }
    for (let x = 0; x < 2; x++) {
      expect(level.hWalls[x]).toBe(1)
      expect(level.hWalls[2 * 2 + x]).toBe(1)
    }
  })

  it('多目标与标签按语言解析', () => {
    const map = createMapFile(3, 3, 0)
    map.data.goals = [
      [1, 1],
      [2, 2],
    ]
    map.data.labels = [
      {
        id: 'l-1',
        pos: [1.5, 0.4],
        text: { text: '目标', i18n: { en: 'Goal' } },
        size: 'large',
        align: 'right',
      },
    ]
    const en = mapToLevel(map, 'en')
    expect(en.goals).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
    expect(en.labels).toEqual([
      { pos: { x: 1.5, y: 0.4 }, text: 'Goal', size: 'large', align: 'right' },
    ])
    expect(mapToLevel(map, 'zh-Hans').labels[0].text).toBe('目标')
  })
})

describe('parseMapFile 结构错误', () => {
  const base = createMapFile(3, 3, 0)

  it('三段各自报出对应 section', () => {
    expect(parseMapFile(null).map).toBeNull()
    expect(parseMapFile(null).errors[0].params).toEqual({ section: 'manifest' })

    const badManifest = clone(base)
    badManifest.manifest = { id: '', tags: [] }
    expect(parseMapFile(badManifest).errors[0].params).toEqual({ section: 'manifest' })

    const badMeta = clone(base)
    ;(badMeta.meta as Record<string, unknown>).cols = MAP_MAX_SIDE + 1
    expect(parseMapFile(badMeta).errors[0].params).toEqual({ section: 'meta' })

    const badData = clone(base)
    ;(badData.data as Record<string, unknown>).start = [9, 9]
    expect(parseMapFile(badData).errors[0].params).toEqual({ section: 'data' })
  })

  it('合法文件可解析', () => {
    const { map, errors } = parseMapFile(clone(base))
    expect(errors).toEqual([])
    expect(map?.meta.cols).toBe(3)
  })

  it('时间戳非有限数回退为 0', () => {
    const raw = clone(base)
    ;(raw.meta as Record<string, unknown>).createdAt = 'nope'
    const { map } = parseMapFile(raw)
    expect(map?.meta.createdAt).toBe(0)
  })
})

describe('parseMapFile 容忍与丢弃', () => {
  function withData(patch: Partial<MapData>): unknown {
    const raw = clone(createMapFile(4, 4, 0))
    Object.assign(raw.data as object, patch)
    return raw
  }

  it('非法目标丢弃、重复去重、按 [x,y] 升序', () => {
    const raw = withData({
      goals: [
        [2, 1],
        [2, 1],
        [9, 9],
        'bad',
        [0, 3],
      ] as never,
    })
    const map = parseMapFile(raw).map
    expect(map?.data.goals).toEqual([
      [0, 3],
      [2, 1],
    ])
  })

  it('非法墙段丢弃、按 [k,i] 升序', () => {
    const raw = withData({
      walls: { v: [[4, 3], [1, 0], [5, 0], [0, 9], 'x'], h: [[2, 1], [4, 0]] } as never,
    })
    const map = parseMapFile(raw).map
    expect(map?.data.walls.v).toEqual([
      [1, 0],
      [4, 3],
    ])
    expect(map?.data.walls.h).toEqual([
      [2, 1],
      [4, 0],
    ])
  })

  it('标签：非法 pos 丢弃，越界 clamp + 0.1 取整，非法枚举回退', () => {
    const raw = withData({
      labels: [
        { id: 'a', pos: [1.24, 5.06], text: { text: 'x' }, size: 'huge', align: 'top' },
        { id: 'b', pos: [99, -5], text: { text: 'y' } },
        { pos: 'nope', text: { text: 'z' } },
      ] as never,
    })
    const labels = parseMapFile(raw).map?.data.labels ?? []
    expect(labels).toHaveLength(2)
    expect(labels[0]).toMatchObject({ id: 'a', pos: [1.2, 4], size: 'medium', align: 'center' })
    expect(labels[1]).toMatchObject({ id: 'b', pos: [4, 0] })
  })

  it('缺失 id 会生成一个', () => {
    const raw = withData({
      labels: [{ pos: [1, 1], text: { text: 'x' } }] as never,
    })
    const labels = parseMapFile(raw).map?.data.labels ?? []
    expect(typeof labels[0].id).toBe('string')
    expect(labels[0].id.length).toBeGreaterThan(0)
  })

  it('i18n 丢弃未知语言键与空白值，全空则去掉字段', () => {
    const raw = withData({
      labels: [
        { id: 'a', pos: [1, 1], text: { text: 'x', i18n: { en: 'E', xx: 'X', ja: '  ' } } },
        { id: 'b', pos: [1, 1], text: { text: 'y', i18n: { ja: ' ' } } },
      ] as never,
    })
    const labels = parseMapFile(raw).map?.data.labels ?? []
    expect(labels[0].text.i18n).toEqual({ en: 'E' })
    expect(labels[1].text.i18n).toBeUndefined()
  })
})

describe('serializeMap', () => {
  it('序列化 → 解析 → 序列化 稳定（含 tag 与墙 / 目标排序）', () => {
    const map = createMapFile(3, 3, 1000)
    map.manifest.tags = ['wall:1.0', 'game:0.1', 'text-tag:1.0']
    map.data.goals = [
      [2, 2],
      [0, 1],
    ]
    map.data.walls.h.push([1, 1])
    map.data.walls.v.push([1, 1])
    map.data.labels = [
      {
        id: 'l-1',
        pos: [1.5, 0.4],
        text: { text: '目标', i18n: { en: 'Goal' } },
        size: 'medium',
        align: 'center',
      },
    ]
    const once = serializeMap(map)
    const round = serializeMap(parseMapFile(JSON.parse(once)).map!)
    expect(round).toBe(once)

    // game 置首，其余按路径字典序
    const parsed = JSON.parse(once)
    expect(parsed.manifest.tags).toEqual([
      'game:0.1',
      'text-tag:1.0',
      'wall:1.0',
    ])
    expect(parsed.data.goals).toEqual([
      [0, 1],
      [2, 2],
    ])
  })
})

describe('computeManifestTags', () => {
  const empty: MapData = { start: [0, 0], goals: [], walls: { v: [], h: [] }, labels: [] }

  it('无目标无标签', () => {
    expect(computeManifestTags(empty)).toEqual([
      'game:0.1',
      'editor:0.1',
      'wall:1.0',
      'start:1.0',
    ])
  })

  it('有目标', () => {
    expect(computeManifestTags({ ...empty, goals: [[1, 1]] })).toEqual([
      'game:0.1',
      'editor:0.1',
      'wall:1.0',
      'start:1.0',
      'goal:1.0',
    ])
  })

  it('有标签（含 i18n）', () => {
    const label = {
      id: 'l',
      pos: [0, 0] as [number, number],
      text: { text: 'a', i18n: { en: 'A' } },
      size: 'medium' as const,
      align: 'center' as const,
    }
    expect(computeManifestTags({ ...empty, labels: [label] })).toEqual([
      'game:0.1',
      'editor:0.1',
      'wall:1.0',
      'start:1.0',
      'text-tag:1.0',
      'text-tag/font/size:1.0',
      'text-tag/font/align:1.0',
      'text-tag/i18n:1.0',
    ])
    expect(computeManifestTags({ ...empty, labels: [{ ...label, text: { text: 'a' } }] })).toEqual(
      [
        'game:0.1',
        'editor:0.1',
        'wall:1.0',
        'start:1.0',
        'text-tag:1.0',
        'text-tag/font/size:1.0',
        'text-tag/font/align:1.0',
      ],
    )
  })
})

describe('mapByteSize', () => {
  it('等于序列化结果的 UTF-8 字节数（非 ASCII 按字节计）', () => {
    const map = createMapFile(2, 2, 0)
    map.data.labels = [
      { id: 'l', pos: [0.5, 0.5], text: { text: '目标' }, size: 'medium', align: 'center' },
    ]
    const text = serializeMap(map)
    expect(mapByteSize(map)).toBe(new TextEncoder().encode(text).length)
    expect(mapByteSize(map)).toBeGreaterThan(text.length)
  })
})

describe('预设与本地化', () => {
  it('字号 / 对齐枚举校验与回退', () => {
    expect(isTextSizeId('small')).toBe(true)
    expect(isTextSizeId('huge')).toBe(false)
    expect(isTextAlignId('center')).toBe(true)
    expect(isTextAlignId('top')).toBe(false)
    expect(textSizeScale('small')).toBe(0.25)
    expect(textSizeScale('nope' as never)).toBe(0.4)
  })

  it('resolveLocalized 空覆盖回落到默认文本', () => {
    const text = { text: 'A', i18n: { en: '  ', ja: 'B' } }
    expect(resolveLocalized(text, 'en')).toBe('A')
    expect(resolveLocalized(text, 'ja')).toBe('B')
    expect(resolveLocalized(text, 'zh-Hans')).toBe('A')
  })

  it('isPlayable 需要至少一个目标', () => {
    const map = createMapFile(3, 3, 0)
    expect(isPlayable(map)).toBe(false)
    map.data.goals = [[1, 1]]
    expect(isPlayable(map)).toBe(true)
  })
})
