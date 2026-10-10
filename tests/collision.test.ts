import { describe, expect, it } from 'vitest'
import { moveWithCollision, PLAYER_R } from '../src/game/collision'
import type { Level, Vec2 } from '../src/types'
import { makeLevel } from './helpers'

const R = PLAYER_R

function run(level: Level, from: Vec2, dx: number, dy: number): Vec2 {
  const out: Vec2 = { x: 0, y: 0 }
  moveWithCollision(level, from, dx, dy, R, out)
  return out
}

describe('moveWithCollision', () => {
  const wallX = () => makeLevel({ cols: 2, rows: 1, v: [[1, 0]] })

  it('正面撞墙被挡在墙前', () => {
    const out = run(wallX(), { x: 0, y: 0 }, 0.6, 0)
    expect(out.x).toBeCloseTo(0.32, 9)
    expect(out.y).toBe(0)
  })

  it('斜向撞击时沿墙滑动', () => {
    const out = run(wallX(), { x: 0, y: 0 }, 0.6, 0.2)
    expect(out.x).toBeCloseTo(0.32, 9)
    expect(out.y).toBeCloseTo(0.2, 9)
  })

  it('大位移不穿透', () => {
    const out = run(wallX(), { x: 0, y: 0 }, 3, 0)
    expect(out.x).toBeCloseTo(0.32, 9)
  })

  it('相邻行的墙不阻挡', () => {
    const level = makeLevel({ cols: 2, rows: 2, v: [[1, 1]] })
    const out = run(level, { x: 0, y: 0 }, 0.4, 0)
    expect(out.x).toBeCloseTo(0.4, 9)
    expect(out.y).toBe(0)
  })

  it('无墙时自由移动', () => {
    const level = makeLevel({ cols: 1, rows: 1 })
    const still = run(level, { x: 0, y: 0 }, 0, 0)
    expect(still).toEqual({ x: 0, y: 0 })
    const moved = run(level, { x: 0, y: 0 }, 0.25, -0.25)
    expect(moved.x).toBeCloseTo(0.25, 9)
    expect(moved.y).toBeCloseTo(-0.25, 9)
  })

  it('角落双向阻挡', () => {
    const level = makeLevel({ cols: 2, rows: 2, v: [[1, 0]], h: [[1, 0]] })
    const out = run(level, { x: 0, y: 0 }, 0.5, 0.5)
    expect(out.x).toBeCloseTo(0.32, 9)
    expect(out.y).toBeCloseTo(0.32, 9)
  })
})
