import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { deleteMap, estimateStorage, listMaps, loadMap, saveMap } from '../src/map/store'
import { createMapFile, parseMapFile, serializeMap } from '../src/map/format'
import type { MapFile } from '../src/map/format'

function canonical(map: MapFile): MapFile {
  const { map: parsed } = parseMapFile(JSON.parse(serializeMap(map)))
  if (!parsed) throw new Error('canonical failed')
  return parsed
}

describe('地图存储', () => {
  it('保存 → 列出（按 updatedAt 降序）→ 读取 → 删除', async () => {
    for (const existing of await listMaps()) await deleteMap(existing.manifest.id)

    const a = canonical(createMapFile(3, 3, 100))
    const b = canonical(createMapFile(3, 3, 200))
    expect(await saveMap(a)).toBe(true)
    expect(await saveMap(b)).toBe(true)

    const listed = await listMaps()
    expect(listed.map((m) => m.manifest.id)).toEqual([b.manifest.id, a.manifest.id])

    expect(await loadMap(b.manifest.id)).toEqual(b)
    expect(await loadMap('missing-id')).toBeNull()

    expect(await deleteMap(a.manifest.id)).toBe(true)
    expect(await deleteMap(b.manifest.id)).toBe(true)
    expect(await listMaps()).toEqual([])
  })

  it('同 id 再次保存会覆盖', async () => {
    for (const existing of await listMaps()) await deleteMap(existing.manifest.id)

    const map = canonical(createMapFile(4, 4, 10))
    await saveMap(map)
    const updated: MapFile = { ...map, meta: { ...map.meta, updatedAt: 500 } }
    expect(await saveMap(updated)).toBe(true)

    const listed = await listMaps()
    expect(listed).toHaveLength(1)
    expect(listed[0].meta.updatedAt).toBe(500)
  })

  it('存储估算：可用时读出用量，缺失字段归零，不可用或抛错返回 null', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const setNavigator = (value: unknown): void => {
      Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })
    }
    try {
      setNavigator({ storage: { estimate: async () => ({ usage: 123, quota: 456 }) } })
      expect(await estimateStorage()).toEqual({ usage: 123, quota: 456 })

      setNavigator({ storage: { estimate: async () => ({}) } })
      expect(await estimateStorage()).toEqual({ usage: 0, quota: 0 })

      setNavigator({})
      expect(await estimateStorage()).toBeNull()

      setNavigator({
        storage: {
          estimate: async () => {
            throw new Error('nope')
          },
        },
      })
      expect(await estimateStorage()).toBeNull()
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })
})
