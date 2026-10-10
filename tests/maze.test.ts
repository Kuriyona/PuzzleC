import { describe, expect, it } from 'vitest'
import { bfs, farthestCell, generateMaze, hasHWall, hasVWall } from '../src/game/maze'
import { makeLevel } from './helpers'

const SIZES = [6, 10, 15] as const

describe('generateMaze', () => {
  it('同种子结果确定', () => {
    const a = generateMaze(6, 6, 12345)
    const b = generateMaze(6, 6, 12345)
    expect(Array.from(a.hWalls)).toEqual(Array.from(b.hWalls))
    expect(Array.from(a.vWalls)).toEqual(Array.from(b.vWalls))
  })

  it('不同种子结果不同', () => {
    const a = generateMaze(6, 6, 1)
    const b = generateMaze(6, 6, 2)
    let diff = 0
    for (let i = 0; i < a.vWalls.length; i++) {
      if (a.vWalls[i] !== b.vWalls[i]) diff++
    }
    expect(diff).toBeGreaterThan(0)
  })

  for (const n of SIZES) {
    it(`${n}×${n} 结构正确`, () => {
      const level = generateMaze(n, n, 777)
      expect(level.cols).toBe(n)
      expect(level.rows).toBe(n)
      expect(level.hWalls.length).toBe((n + 1) * n)
      expect(level.vWalls.length).toBe(n * (n + 1))

      // 外圈墙恒存在
      for (let x = 0; x < n; x++) {
        expect(level.hWalls[x]).toBe(1)
        expect(level.hWalls[n * n + x]).toBe(1)
      }
      for (let y = 0; y < n; y++) {
        expect(level.vWalls[y * (n + 1)]).toBe(1)
        expect(level.vWalls[y * (n + 1) + n]).toBe(1)
      }

      // 完美迷宫：内部开放墙段数 = cols*rows - 1
      let open = 0
      for (let k = 1; k <= n - 1; k++) {
        for (let x = 0; x < n; x++) if (level.hWalls[k * n + x] === 0) open++
      }
      for (let y = 0; y < n; y++) {
        for (let k = 1; k <= n - 1; k++) if (level.vWalls[y * (n + 1) + k] === 0) open++
      }
      expect(open).toBe(n * n - 1)

      expect(level.start).toEqual({ x: 0, y: 0 })
    })

    it(`${n}×${n} 连通且 goal 为最远格`, () => {
      const level = generateMaze(n, n, 4242)
      const dist = bfs(level, level.start)
      for (let i = 0; i < dist.length; i++) expect(dist[i]).toBeGreaterThanOrEqual(0)
      const goalIndex = level.goal.y * level.cols + level.goal.x
      expect(dist[goalIndex]).toBeGreaterThan(0)
      let max = 0
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] > max) max = dist[i]
      }
      expect(dist[goalIndex]).toBe(max)
    })
  }

  it('hasVWall / hasHWall 越界与外圈为 true', () => {
    const level = generateMaze(6, 6, 9)
    expect(hasVWall(level, -1, 0)).toBe(true)
    expect(hasVWall(level, level.cols + 1, 0)).toBe(true)
    expect(hasVWall(level, 0, -1)).toBe(true)
    expect(hasVWall(level, 0, level.rows)).toBe(true)
    expect(hasVWall(level, 0, 0)).toBe(true)
    expect(hasHWall(level, -1, 0)).toBe(true)
    expect(hasHWall(level, level.rows + 1, 0)).toBe(true)
    expect(hasHWall(level, 0, -1)).toBe(true)
    expect(hasHWall(level, 0, level.cols)).toBe(true)
    expect(hasHWall(level, 0, 0)).toBe(true)
  })

  it('farthestCell 并列取最小索引', () => {
    // (1,1) 四邻全通、其余全堵：四个叶子距离同为 1，索引 1 < 3 < 5 < 7 → 取 (1,0)
    const level = makeLevel({
      cols: 3,
      rows: 3,
      v: [
        [1, 0],
        [1, 2],
        [2, 0],
        [2, 2],
      ],
      h: [
        [1, 0],
        [1, 2],
        [2, 0],
        [2, 2],
      ],
    })
    expect(farthestCell(level, { x: 1, y: 1 })).toEqual({ x: 1, y: 0 })
  })
})
