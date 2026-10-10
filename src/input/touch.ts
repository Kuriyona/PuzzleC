import type { Vec2 } from '../types'

/** 虚拟摇杆的径向死区（相对摇杆半径的比例） */
export const TOUCH_STICK_DEADZONE = 0.15

export interface StickSample {
  /** 归一化轴向（-1..1）：径向死区内为 0，死区外按 (m-D)/(1-D) 重标定，幅度 ≤ 1 */
  x: number
  y: number
  /** 限幅到摇杆半径内的旋钮像素偏移（不做死区，跟手） */
  knobX: number
  knobY: number
}

/**
 * 把指针相对摇杆中心的位移换算成方向向量与旋钮偏移，写入 `out`（复用缓冲，避免逐帧分配）。
 * 半径非法或没有位移时全部清零。
 */
export function sampleStick(dx: number, dy: number, radius: number, out: StickSample): StickSample {
  out.x = 0
  out.y = 0
  out.knobX = 0
  out.knobY = 0
  if (!(radius > 0)) return out

  const distance = Math.hypot(dx, dy)
  if (!Number.isFinite(distance) || distance === 0) return out

  const scale = distance > radius ? radius / distance : 1
  out.knobX = dx * scale
  out.knobY = dy * scale

  const magnitude = Math.min(1, distance / radius)
  if (magnitude <= TOUCH_STICK_DEADZONE) return out

  const gain = (magnitude - TOUCH_STICK_DEADZONE) / (1 - TOUCH_STICK_DEADZONE)
  out.x = (dx / distance) * gain
  out.y = (dy / distance) * gain
  return out
}

/** 摇杆轴向写入点：与手柄轴共用同一个 Vec2 形状 */
export type StickVector = Vec2
