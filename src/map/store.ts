import type { MapFile } from './format'
import { parseMapFile } from './format'

const DB_NAME = 'puzzlec'
const DB_VERSION = 1
const STORE_NAME = 'maps'

let dbPromise: Promise<IDBDatabase | null> | null = null

/** 打开（并缓存）数据库连接；不可用或失败返回 null */
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'manifest.id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        console.warn('[puzzlec] open IndexedDB failed', req.error)
        resolve(null)
      }
    } catch (err) {
      console.warn('[puzzlec] open IndexedDB threw', err)
      resolve(null)
    }
  })
  return dbPromise
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 全部地图，按 meta.updatedAt 降序；结构非法的记录跳过 */
export async function listMaps(): Promise<MapFile[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const records = await request(tx.objectStore(STORE_NAME).getAll() as IDBRequest<unknown[]>)
    const maps: MapFile[] = []
    for (const record of records) {
      const { map } = parseMapFile(record)
      if (map) maps.push(map)
    }
    maps.sort((a, b) => b.meta.updatedAt - a.meta.updatedAt)
    return maps
  } catch (err) {
    console.warn('[puzzlec] listMaps failed', err)
    return []
  }
}

export async function loadMap(id: string): Promise<MapFile | null> {
  const db = await openDb()
  if (!db) return null
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const record = await request(tx.objectStore(STORE_NAME).get(id) as IDBRequest<unknown>)
    const { map } = parseMapFile(record)
    return map
  } catch (err) {
    console.warn('[puzzlec] loadMap failed', err)
    return null
  }
}

/** put 整份地图（含 manifest.id） */
export async function saveMap(map: MapFile): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await request(tx.objectStore(STORE_NAME).put(map as unknown as Record<string, unknown>))
    return true
  } catch (err) {
    console.warn('[puzzlec] saveMap failed', err)
    return false
  }
}

export interface StorageEstimate {
  /** 已用字节 */
  usage: number
  /** 配额字节 */
  quota: number
}

/** 浏览器存储用量估算（字节）；`navigator.storage.estimate()` 不可用或失败返回 null */
export async function estimateStorage(): Promise<StorageEstimate | null> {
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (!storage || typeof storage.estimate !== 'function') return null
    const estimate = await storage.estimate()
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    return { usage: num(estimate.usage), quota: num(estimate.quota) }
  } catch (err) {
    console.warn('[puzzlec] estimateStorage failed', err)
    return null
  }
}

export async function deleteMap(id: string): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await request(tx.objectStore(STORE_NAME).delete(id))
    return true
  } catch (err) {
    console.warn('[puzzlec] deleteMap failed', err)
    return false
  }
}
