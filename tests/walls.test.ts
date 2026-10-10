import { describe, expect, it } from 'vitest'
import {
  WALL_THICKNESS,
  addLevelWalls,
  addLitWalls,
  wallGradient,
  wallLineWidth,
} from '../src/render/walls'
import { makeLevel } from './helpers'

interface Seg {
  m: [number, number]
  l: [number, number]
}

function segmentRecorder(): { ctx: CanvasRenderingContext2D; segs: Seg[] } {
  const segs: Seg[] = []
  let cur: [number, number] = [0, 0]
  const ctx = {
    moveTo(x: number, y: number) {
      cur = [x, y]
    },
    lineTo(x: number, y: number) {
      segs.push({ m: cur, l: [x, y] })
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, segs }
}

function gradientRecorder(): { ctx: CanvasRenderingContext2D; stops: { offset: number; color: string }[] } {
  const stops: { offset: number; color: string }[] = []
  const ctx = {
    createRadialGradient() {
      return {
        addColorStop(offset: number, color: string) {
          stops.push({ offset, color })
        },
      }
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, stops }
}

function alphaOf(color: string): number {
  return Number(color.slice(color.lastIndexOf(',') + 1, -1))
}

describe('wallLineWidth', () => {
  it('大格宽按比例增厚', () => {
    expect(wallLineWidth(100)).toBeCloseTo(100 * WALL_THICKNESS, 9)
  })

  it('小格宽钳到最小像素宽，不退化成发丝线', () => {
    expect(wallLineWidth(1)).toBeGreaterThanOrEqual(1.25)
    expect(wallLineWidth(0)).toBe(1.25)
  })
})

describe('addLevelWalls', () => {
  it('1×1 外圈写下四条墙段', () => {
    const level = makeLevel({ cols: 1, rows: 1 })
    const { ctx, segs } = segmentRecorder()
    addLevelWalls(ctx, level, 10)
    expect(segs).toEqual([
      { m: [0, 0], l: [0, 10] },
      { m: [10, 0], l: [10, 10] },
      { m: [0, 0], l: [10, 0] },
      { m: [0, 10], l: [10, 10] },
    ])
  })

  it('通路（非墙）不写入', () => {
    // cols=2：内部竖线 k=1 未设墙 → 不应出现 x=10 的竖段
    const level = makeLevel({ cols: 2, rows: 1 })
    const { ctx, segs } = segmentRecorder()
    addLevelWalls(ctx, level, 10)
    expect(segs).toHaveLength(6)
    const middleVertical = segs.filter((s) => s.m[0] === 10 && s.l[0] === 10)
    expect(middleVertical).toEqual([])
  })

  it('内部墙段会写入', () => {
    const level = makeLevel({ cols: 2, rows: 1, v: [[1, 0]] })
    const { ctx, segs } = segmentRecorder()
    addLevelWalls(ctx, level, 10)
    expect(segs).toHaveLength(7)
    expect(segs).toContainEqual({ m: [10, 0], l: [10, 10] })
  })
})

describe('addLitWalls', () => {
  it('按连续坐标 + 0.5 偏移换算为像素', () => {
    const { ctx, segs } = segmentRecorder()
    // 竖段 k=0、行 0：连续坐标 (-0.5,-0.5) → (-0.5,0.5)
    addLitWalls(ctx, [-0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5], 10)
    expect(segs).toEqual([
      { m: [0, 0], l: [0, 10] },
      { m: [10, 0], l: [10, 10] },
    ])
  })
})

describe('wallGradient', () => {
  it('渐变从亮心连续衰减到 0，无跳动（深浅两套墨色都走通道）', () => {
    for (const ink of ['255,255,255', '0,0,0']) {
      const { ctx, stops } = gradientRecorder()
      wallGradient(ctx, 0, 0, 100, ink)
      expect(stops[0].offset).toBe(0)
      expect(alphaOf(stops[0].color)).toBeCloseTo(0.95, 9)
      expect(stops[stops.length - 1].offset).toBe(1)
      expect(alphaOf(stops[stops.length - 1].color)).toBe(0)
      for (let i = 0; i < stops.length; i++) {
        expect(stops[i].color.startsWith(`rgba(${ink},`)).toBe(true)
        if (i === 0) continue
        expect(stops[i].offset).toBeGreaterThan(stops[i - 1].offset)
        const a = alphaOf(stops[i].color)
        expect(Number.isNaN(a)).toBe(false)
        expect(a).toBeLessThanOrEqual(alphaOf(stops[i - 1].color))
      }
    }
  })
})
