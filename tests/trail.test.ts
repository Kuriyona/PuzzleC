import { describe, expect, it } from 'vitest'
import { TRAIL_STEP, createTrail } from '../src/game/trail'

describe('createTrail', () => {
  it('reset 写入起点', () => {
    const trail = createTrail()
    trail.reset(1, 2)
    expect(trail.points).toEqual([1, 2])
  })

  it('未达到阈值的位移被忽略', () => {
    const trail = createTrail()
    trail.reset(0, 0)
    trail.push(TRAIL_STEP * 0.5, 0)
    trail.push(0, TRAIL_STEP * 0.5)
    expect(trail.points).toEqual([0, 0])
  })

  it('达到阈值的位移被记录且按 x,y 交替', () => {
    const trail = createTrail()
    trail.reset(0, 0)
    trail.push(TRAIL_STEP, 0)
    trail.push(TRAIL_STEP * 2, TRAIL_STEP * 2)
    expect(trail.points).toEqual([0, 0, TRAIL_STEP, 0, TRAIL_STEP * 2, TRAIL_STEP * 2])
  })

  it('阈值按到上一点的直线距离判定（斜向）', () => {
    const trail = createTrail()
    trail.reset(0, 0)
    // 单轴分量均小于阈值，但合位移等于阈值 → 记录
    trail.push(TRAIL_STEP * Math.SQRT1_2, TRAIL_STEP * Math.SQRT1_2)
    expect(trail.points.length).toBe(4)
  })

  it('reset 清空旧轨迹', () => {
    const trail = createTrail()
    trail.reset(0, 0)
    trail.push(5, 5)
    trail.reset(3, 4)
    expect(trail.points).toEqual([3, 4])
  })

  it('未 reset 时首个 push 作为起点', () => {
    const trail = createTrail()
    trail.push(7, 8)
    expect(trail.points).toEqual([7, 8])
  })
})
