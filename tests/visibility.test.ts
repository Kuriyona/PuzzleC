import { describe, expect, it } from 'vitest'
import { generateMaze } from '../src/game/maze'
import { castRay, computeVisibility, createVisibility, isVisible } from '../src/game/visibility'
import { makeLevel, visibleMask } from './helpers'

describe('isVisible', () => {
  it('手算可视掩码（雾战核心行为）', () => {
    const level = makeLevel({
      cols: 3,
      rows: 3,
      v: [
        [1, 1],
        [2, 1],
      ],
      h: [
        [1, 1],
        [2, 1],
      ],
    })
    expect(visibleMask(level, { x: 0, y: 0 }, 6)).toEqual(['###', '#..', '#..'])
  })

  it('半径裁剪：超出半径的格恒不可见', () => {
    const level = generateMaze(10, 10, 2024)
    const radius = 3
    const pos = { x: level.start.x, y: level.start.y }
    for (let y = 0; y < level.rows; y++) {
      for (let x = 0; x < level.cols; x++) {
        if (Math.hypot(x - pos.x, y - pos.y) > radius) {
          expect(isVisible(level, pos, { x, y }, radius)).toBe(false)
        }
      }
    }
    expect(isVisible(level, pos, level.start, radius)).toBe(true)
  })

  it('与几何一致：被墙挡住的对角格不可见，同排的通路可见', () => {
    const level = makeLevel({
      cols: 3,
      rows: 3,
      v: [
        [1, 1],
        [2, 1],
      ],
      h: [
        [1, 1],
        [2, 1],
      ],
    })
    expect(isVisible(level, { x: 0, y: 0 }, { x: 1, y: 1 }, 6)).toBe(false)
    expect(isVisible(level, { x: 0, y: 0 }, { x: 2, y: 0 }, 6)).toBe(true)
  })
})

describe('castRay', () => {
  it('命中最近的墙段', () => {
    const level = makeLevel({ cols: 3, rows: 1, v: [[1, 0]] })
    expect(castRay(level, { x: 0, y: 0 }, 1, 0, 5)).toBeCloseTo(0.5, 12)
  })

  it('无墙时返回 maxT', () => {
    const level = makeLevel({ cols: 3, rows: 1 })
    // 外边界在 x = 2.5；maxT 更小则射线在半径处停下
    expect(castRay(level, { x: 0, y: 0 }, 1, 0, 2)).toBe(2)
  })
})

describe('computeVisibility', () => {
  it('1×1 关卡的可见墙段精确值', () => {
    const level = makeLevel({ cols: 1, rows: 1 })
    const vis = createVisibility()
    computeVisibility(level, { x: 0, y: 0 }, 2, vis)
    expect(vis.lit).toEqual([
      -0.5, -0.5, -0.5, 0.5, // 垂直 k=0
      0.5, -0.5, 0.5, 0.5, // 垂直 k=1
      -0.5, -0.5, 0.5, -0.5, // 水平 k=0
      -0.5, 0.5, 0.5, 0.5, // 水平 k=1
    ])
  })

  it('扇形顶点全部落在墙线或半径圆上', () => {
    const level = makeLevel({ cols: 1, rows: 1 })
    const vis = createVisibility()
    computeVisibility(level, { x: 0, y: 0 }, 2, vis)
    expect(vis.fan.length).toBeGreaterThanOrEqual(6)
    for (let i = 0; i < vis.fan.length; i += 2) {
      const x = vis.fan[i]
      const y = vis.fan[i + 1]
      const onWall = Math.abs(Math.abs(x) - 0.5) < 1e-6 || Math.abs(Math.abs(y) - 0.5) < 1e-6
      const onCircle = Math.abs(Math.hypot(x, y) - 2) < 1e-6
      expect(onWall || onCircle).toBe(true)
    }
  })

  it('被遮挡的墙段不进入 lit', () => {
    const level = makeLevel({
      cols: 3,
      rows: 3,
      v: [
        [1, 1],
        [2, 1],
      ],
      h: [
        [1, 1],
        [2, 1],
      ],
    })
    const vis = createVisibility()
    computeVisibility(level, { x: 0, y: 0 }, 6, vis)
    const segs: number[][] = []
    for (let i = 0; i < vis.lit.length; i += 4) {
      segs.push(vis.lit.slice(i, i + 4))
    }
    expect(segs).toContainEqual([-0.5, -0.5, 0.5, -0.5])
    expect(segs).not.toContainEqual([1.5, 1.5, 1.5, 2.5])
  })
})
