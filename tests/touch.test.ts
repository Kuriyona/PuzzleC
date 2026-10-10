import { describe, expect, it } from 'vitest'
import { TOUCH_STICK_DEADZONE, sampleStick } from '../src/input/touch'
import type { StickSample } from '../src/input/touch'

function empty(): StickSample {
  return { x: 0, y: 0, knobX: 0, knobY: 0 }
}

describe('sampleStick', () => {
  it('半径非法或没有位移时全部清零', () => {
    expect(sampleStick(0, 0, 100, empty())).toEqual(empty())
    expect(sampleStick(30, 40, 0, empty())).toEqual(empty())
    expect(sampleStick(30, 40, -5, empty())).toEqual(empty())
  })

  it('径向死区内轴向为零，但旋钮仍跟手', () => {
    const radius = 100
    const out = sampleStick(radius * TOUCH_STICK_DEADZONE * 0.9, 0, radius, empty())
    expect(out.x).toBe(0)
    expect(out.y).toBe(0)
    expect(out.knobX).toBeCloseTo(radius * TOUCH_STICK_DEADZONE * 0.9, 9)
  })

  it('死区外按比例重标定，方向保持单位向量', () => {
    const radius = 100
    const out = sampleStick(0, 60, radius, empty())
    const magnitude = 0.6
    expect(out.y).toBeCloseTo((magnitude - TOUCH_STICK_DEADZONE) / (1 - TOUCH_STICK_DEADZONE), 12)
    expect(out.x).toBe(0)
    expect(out.knobY).toBeCloseTo(60, 9)
  })

  it('拖出半径外：轴向幅度封顶为 1，旋钮限幅到半径', () => {
    const radius = 100
    const out = sampleStick(300, 400, radius, empty()) // 位移 500，方向 (0.6, 0.8)
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1, 12)
    expect(out.x).toBeCloseTo(0.6, 12)
    expect(out.y).toBeCloseTo(0.8, 12)
    expect(Math.hypot(out.knobX, out.knobY)).toBeCloseTo(radius, 9)
  })

  it('恰好达到半径时为满幅', () => {
    const radius = 64
    const out = sampleStick(radius, 0, radius, empty())
    expect(out.x).toBeCloseTo(1, 12)
    expect(out.y).toBe(0)
    expect(out.knobX).toBeCloseTo(radius, 9)
  })
})
