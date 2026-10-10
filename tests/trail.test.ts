import { describe, expect, it } from 'vitest'
import { TRAIL_STEP, createTrail, sampleTrail } from '../src/game/trail'
import type { Vec2 } from '../src/types'

describe('createTrail', () => {
  it('reset 写入起点与时间', () => {
    const trail = createTrail()
    trail.reset(1, 2, 0)
    expect(trail.points).toEqual([1, 2])
    expect(trail.times).toEqual([0])
  })

  it('未达到阈值的位移被忽略（时间也不记录）', () => {
    const trail = createTrail()
    trail.reset(0, 0, 0)
    trail.push(TRAIL_STEP * 0.5, 0, 100)
    trail.push(0, TRAIL_STEP * 0.5, 200)
    expect(trail.points).toEqual([0, 0])
    expect(trail.times).toEqual([0])
  })

  it('达到阈值的位移被记录且 points/times 等长', () => {
    const trail = createTrail()
    trail.reset(0, 0, 0)
    trail.push(TRAIL_STEP, 0, 100)
    trail.push(TRAIL_STEP * 2, TRAIL_STEP * 2, 250)
    expect(trail.points).toEqual([0, 0, TRAIL_STEP, 0, TRAIL_STEP * 2, TRAIL_STEP * 2])
    expect(trail.times).toEqual([0, 100, 250])
  })

  it('阈值按到上一点的直线距离判定（斜向）', () => {
    const trail = createTrail()
    trail.reset(0, 0, 0)
    trail.push(TRAIL_STEP * Math.SQRT1_2, TRAIL_STEP * Math.SQRT1_2, 10)
    expect(trail.points.length).toBe(4)
    expect(trail.times.length).toBe(2)
  })

  it('reset 清空旧轨迹', () => {
    const trail = createTrail()
    trail.reset(0, 0, 0)
    trail.push(5, 5, 500)
    trail.reset(3, 4, 0)
    expect(trail.points).toEqual([3, 4])
    expect(trail.times).toEqual([0])
  })

  it('未 reset 时首个 push 作为起点', () => {
    const trail = createTrail()
    trail.push(7, 8, 42)
    expect(trail.points).toEqual([7, 8])
    expect(trail.times).toEqual([42])
  })
})

describe('sampleTrail', () => {
  const points = [0, 0, 10, 0, 10, 10]
  const times = [0, 1000, 2000]
  const out: Vec2 = { x: 0, y: 0 }

  it('空轨迹返回原点索引 0', () => {
    expect(sampleTrail([], [], 500, out)).toBe(0)
    expect(out).toEqual({ x: 0, y: 0 })
  })

  it('早于起点返回首点', () => {
    expect(sampleTrail(points, times, -10, out)).toBe(0)
    expect(out).toEqual({ x: 0, y: 0 })
  })

  it('段内按时间线性插值', () => {
    expect(sampleTrail(points, times, 500, out)).toBe(0)
    expect(out).toEqual({ x: 5, y: 0 })
    expect(sampleTrail(points, times, 1500, out)).toBe(1)
    expect(out).toEqual({ x: 10, y: 5 })
  })

  it('恰在记录点返回该点', () => {
    expect(sampleTrail(points, times, 1000, out)).toBe(1)
    expect(out).toEqual({ x: 10, y: 0 })
  })

  it('晚于终点返回末点与末索引', () => {
    expect(sampleTrail(points, times, 9999, out)).toBe(2)
    expect(out).toEqual({ x: 10, y: 10 })
  })
})
