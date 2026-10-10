import { describe, expect, it } from 'vitest'
import {
  NAV_INITIAL_DELAY_MS,
  NAV_REPEAT_MS,
  PAD_BUTTON,
  STICK_DEADZONE,
  createPadTracker,
  emptyPadSnapshot,
  readPad,
} from '../src/input/gamepad'
import type { PadSnapshot } from '../src/input/gamepad'

/** 造一个只关心给定按键 / 轴的手柄快照 */
function makePad(options: {
  buttons?: number[]
  axes?: [number, number]
}): Gamepad {
  const pressed = new Set(options.buttons ?? [])
  const buttons = Array.from({ length: 17 }, (_, i) => ({
    pressed: pressed.has(i),
    touched: pressed.has(i),
    value: pressed.has(i) ? 1 : 0,
  }))
  const axes = [options.axes?.[0] ?? 0, options.axes?.[1] ?? 0]
  return { buttons, axes } as unknown as Gamepad
}

/** 直接构造快照，便于测跟踪器 */
function snapshot(patch: Partial<PadSnapshot>): PadSnapshot {
  return { ...emptyPadSnapshot(), connected: true, ...patch }
}

describe('readPad', () => {
  it('无设备时清零快照', () => {
    const out = readPad(null, emptyPadSnapshot())
    expect(out).toEqual(emptyPadSnapshot())
    expect(out.connected).toBe(false)
  })

  it('死区内轴读数归零，死区外线性重标定', () => {
    const out = readPad(makePad({ axes: [0.1, -0.05] }), emptyPadSnapshot())
    expect(out.x).toBe(0)
    expect(out.y).toBe(0)

    const half = readPad(makePad({ axes: [0.5, 0] }), emptyPadSnapshot())
    expect(half.x).toBeCloseTo((0.5 - STICK_DEADZONE) / (1 - STICK_DEADZONE), 12)
  })

  it('十字键同时驱动合成轴与方向标志', () => {
    const out = readPad(
      makePad({ buttons: [PAD_BUTTON.right, PAD_BUTTON.down] }),
      emptyPadSnapshot(),
    )
    expect(out.x).toBe(1)
    expect(out.y).toBe(1)
    expect(out.right).toBe(true)
    expect(out.down).toBe(true)
    expect(out.left).toBe(false)
    expect(out.up).toBe(false)
  })

  it('摇杆越过阈值才置方向标志，但轴保持模拟量', () => {
    const out = readPad(makePad({ axes: [0.8, 0] }), emptyPadSnapshot())
    expect(out.right).toBe(true)
    expect(out.x).toBeGreaterThan(0)
    expect(out.x).toBeLessThan(1)
  })

  it('功能键按下状态', () => {
    const out = readPad(
      makePad({ buttons: [PAD_BUTTON.confirm, PAD_BUTTON.start, PAD_BUTTON.select] }),
      emptyPadSnapshot(),
    )
    expect(out.confirm).toBe(true)
    expect(out.start).toBe(true)
    expect(out.select).toBe(true)
    expect(out.back).toBe(false)
  })
})

describe('createPadTracker', () => {
  it('首帧不产生事件', () => {
    const tracker = createPadTracker()
    const events = tracker.update(snapshot({ confirm: true, up: true }), 0)
    expect(events).toEqual({
      nav: null,
      confirm: false,
      back: false,
      secondary: false,
      start: false,
      select: false,
    })
  })

  it('功能键只在按下那一帧触发一次', () => {
    const tracker = createPadTracker()
    tracker.update(snapshot({}), 0)
    expect(tracker.update(snapshot({ confirm: true }), 16).confirm).toBe(true)
    expect(tracker.update(snapshot({ confirm: true }), 32).confirm).toBe(false)
    expect(tracker.update(snapshot({}), 48).confirm).toBe(false)
    expect(tracker.update(snapshot({ confirm: true }), 64).confirm).toBe(true)
  })

  it('方向键按下立刻产生一次导航', () => {
    const tracker = createPadTracker()
    tracker.update(snapshot({}), 0)
    expect(tracker.update(snapshot({ down: true }), 16).nav).toBe('down')
    expect(tracker.update(snapshot({ down: true }), 32).nav).toBeNull()
  })

  it('方向键长按按延迟与间隔重复', () => {
    const tracker = createPadTracker()
    tracker.update(snapshot({}), 0)
    tracker.update(snapshot({ up: true }), 0)
    // 延迟内不重复
    expect(tracker.update(snapshot({ up: true }), NAV_INITIAL_DELAY_MS - 1).nav).toBeNull()
    // 到达延迟即重复一次
    expect(tracker.update(snapshot({ up: true }), NAV_INITIAL_DELAY_MS).nav).toBe('up')
    // 间隔内不再重复
    expect(
      tracker.update(snapshot({ up: true }), NAV_INITIAL_DELAY_MS + NAV_REPEAT_MS - 1).nav,
    ).toBeNull()
    expect(tracker.update(snapshot({ up: true }), NAV_INITIAL_DELAY_MS + NAV_REPEAT_MS).nav).toBe(
      'up',
    )
  })

  it('松开后再按立刻重新触发导航', () => {
    const tracker = createPadTracker()
    tracker.update(snapshot({}), 0)
    tracker.update(snapshot({ left: true }), 16)
    tracker.update(snapshot({}), 32)
    expect(tracker.update(snapshot({ left: true }), 48).nav).toBe('left')
  })
})
