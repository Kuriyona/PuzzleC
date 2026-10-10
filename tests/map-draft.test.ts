import { describe, expect, it } from 'vitest'
import {
  countOutOfRange,
  createDraft,
  draftFromMap,
  mapFromDraft,
  newId,
  resizeDraft,
} from '../src/map/draft'
import { computeManifestTags, createMapFile, parseMapFile, serializeMap } from '../src/map/format'
import type { MapFile } from '../src/map/format'
import { setWall } from '../src/map/edit'

function canonical(map: MapFile): MapFile {
  const { map: parsed } = parseMapFile(JSON.parse(serializeMap(map)))
  if (!parsed) throw new Error('canonical failed')
  return parsed
}

describe('newId', () => {
  it('生成非空且互不相同的 id', () => {
    const a = newId()
    const b = newId()
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
  })
})

describe('createDraft', () => {
  it('外圈墙齐备、内部开放', () => {
    const draft = createDraft(3, 4, 0)
    expect(draft.vWalls.length).toBe(4 * 4)
    expect(draft.hWalls.length).toBe(5 * 3)
    for (let y = 0; y < 4; y++) {
      expect(draft.vWalls[y * 4]).toBe(1)
      expect(draft.vWalls[y * 4 + 3]).toBe(1)
    }
    for (let x = 0; x < 3; x++) {
      expect(draft.hWalls[x]).toBe(1)
      expect(draft.hWalls[4 * 3 + x]).toBe(1)
    }
    // 内部一格竖线 / 横线都是开放的
    expect(draft.vWalls[1 * 4 + 1]).toBe(0)
    expect(draft.hWalls[1 * 3 + 1]).toBe(0)
    expect(draft.start).toEqual({ x: 0, y: 0 })
    expect(draft.goals).toEqual([])
    expect(draft.labels).toEqual([])
  })
})

describe('draftFromMap / mapFromDraft', () => {
  it('往返数据一致，updatedAt 与 tags 重算', () => {
    const map = createMapFile(3, 3, 5)
    map.data.goals = [[1, 1]]
    map.data.walls.h.push([1, 2])
    map.data.labels = [
      {
        id: 'l-1',
        pos: [1.5, 0.4],
        text: { text: '目标', i18n: { en: 'Goal' } },
        size: 'large',
        align: 'right',
      },
    ]

    const draft = draftFromMap(map)
    const back = mapFromDraft(draft, 999)

    expect(back.manifest.id).toBe(map.manifest.id)
    expect(back.meta.createdAt).toBe(5)
    expect(back.meta.updatedAt).toBe(999)
    expect(back.data).toEqual(canonical(map).data)
    expect(back.manifest.tags).toEqual(computeManifestTags(back.data))
  })

  it('剔除空 i18n 条目，全空则去掉 i18n 字段', () => {
    const map = createMapFile(2, 2, 0)
    map.data.goals = [[0, 0]]
    map.data.labels = [
      { id: 'a', pos: [1, 1], text: { text: 'a', i18n: { en: 'A', ja: '  ' } }, size: 'medium', align: 'left' },
      { id: 'b', pos: [0, 1], text: { text: 'b', i18n: { en: '' } }, size: 'small', align: 'center' },
    ]
    const draft = draftFromMap(map)
    const back = mapFromDraft(draft, 1)
    expect(back.data.labels[0].text.i18n).toEqual({ en: 'A' })
    expect(back.data.labels[1].text.i18n).toBeUndefined()
    expect(back.manifest.tags).toContain('text-tag/i18n:1.0')
  })
})

describe('countOutOfRange / resizeDraft', () => {
  function buildDraft() {
    const draft = createDraft(3, 3, 0)
    draft.goals = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]
    draft.labels = [
      { id: 'a', pos: [2.5, 2.5], text: { text: 'a' }, size: 'medium', align: 'center' },
      { id: 'b', pos: [0.5, 0.5], text: { text: 'b' }, size: 'medium', align: 'center' },
    ]
    draft.start = { x: 2, y: 2 }
    setWall(draft, { axis: 'v', k: 1, i: 1 }, true)
    return draft
  }

  it('预测的越界数量与实际删除一致', () => {
    const draft = buildDraft()
    const count = countOutOfRange(draft, 2, 2)
    const goalsBefore = draft.goals.length
    const labelsBefore = draft.labels.length

    resizeDraft(draft, 2, 2)

    const removedGoals = goalsBefore - draft.goals.length
    const removedLabels = labelsBefore - draft.labels.length
    const removedStart = draft.start.x === 0 && draft.start.y === 0 ? 1 : 0
    // 越界墙段数 = 总数 - 目标 - 标签 - 起点
    const removedWalls = count - removedGoals - removedLabels - removedStart
    expect(removedGoals).toBe(1)
    expect(removedLabels).toBe(1)
    expect(removedStart).toBe(1)
    // 越界墙段 = 旧外圈 4 条（k=3 竖线全 3 条 + k=3 横线全 3 条）
    // + 边线残留（v k=0,y=2；h k=0,x=2）→ 见下方具体断言
    expect(removedWalls).toBe(8)
  })

  it('缩小后墙数组为新尺寸、新外圈齐备、范围内墙保留、原件裁剪', () => {
    const draft = buildDraft()
    resizeDraft(draft, 2, 2)

    expect(draft.cols).toBe(2)
    expect(draft.rows).toBe(2)
    expect(draft.vWalls.length).toBe(2 * 3)
    expect(draft.hWalls.length).toBe(3 * 2)
    for (let y = 0; y < 2; y++) {
      expect(draft.vWalls[y * 3]).toBe(1)
      expect(draft.vWalls[y * 3 + 2]).toBe(1)
    }
    for (let x = 0; x < 2; x++) {
      expect(draft.hWalls[x]).toBe(1)
      expect(draft.hWalls[2 * 2 + x]).toBe(1)
    }
    // 范围内的内部竖墙保留（k=1, i=1 → y*(cols+1)+k = 4）
    expect(draft.vWalls[4]).toBe(1)
    expect(draft.goals).toEqual([{ x: 1, y: 1 }])
    expect(draft.labels.map((l) => l.id)).toEqual(['b'])
    expect(draft.start).toEqual({ x: 0, y: 0 })
  })

  it('放大时不删除任何内容', () => {
    const draft = buildDraft()
    expect(countOutOfRange(draft, 6, 6)).toBe(0)
    resizeDraft(draft, 6, 6)
    expect(draft.vWalls.length).toBe(6 * 7)
    expect(draft.goals).toHaveLength(2)
    expect(draft.labels).toHaveLength(2)
    expect(draft.start).toEqual({ x: 2, y: 2 })
  })
})
