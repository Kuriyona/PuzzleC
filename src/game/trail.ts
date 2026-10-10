import type { Vec2 } from '../types'

/**
 * 轨迹采样（纯逻辑，无副作用）。
 * points 交替存放 x,y 连续坐标，times 与之一一对应（毫秒，相对本关开始，暂停时间不计）；
 * 位移小于阈值时不记录，避免逐帧堆积冗余点。
 */

/** 采样阈值（格）：相邻记录点至少相隔该距离 */
export const TRAIL_STEP = 0.06

export interface Trail {
  /** 交替存放 x,y 的连续坐标点；首点恒为重置位置 */
  points: number[]
  /** 每个记录点的时间戳（毫秒）；与 points 等长且升序 */
  times: number[]
  /** 清空并以 (x,y,t) 作为新起点 */
  reset(x: number, y: number, t: number): void
  /** 距上一点位移达到阈值时追加 */
  push(x: number, y: number, t: number): void
}

export function createTrail(): Trail {
  const points: number[] = []
  const times: number[] = []
  const stepSq = TRAIL_STEP * TRAIL_STEP
  return {
    points,
    times,
    reset(x: number, y: number, t: number): void {
      points.length = 0
      times.length = 0
      points.push(x, y)
      times.push(t)
    },
    push(x: number, y: number, t: number): void {
      const n = times.length
      if (n === 0) {
        points.push(x, y)
        times.push(t)
        return
      }
      const dx = x - points[n * 2 - 2]
      const dy = y - points[n * 2 - 1]
      if (dx * dx + dy * dy < stepSq) return
      points.push(x, y)
      times.push(t)
    },
  }
}

/**
 * 取时间 t 处的插值位置，写入 out；返回其所在段的起点索引（0..n-1）。
 * t 早于起点返回首点，晚于终点返回末点。points 长度为 times 的两倍。
 */
export function sampleTrail(points: number[], times: number[], t: number, out: Vec2): number {
  const n = times.length
  if (n === 0) {
    out.x = 0
    out.y = 0
    return 0
  }
  if (t <= times[0]) {
    out.x = points[0]
    out.y = points[1]
    return 0
  }
  if (t >= times[n - 1]) {
    out.x = points[2 * n - 2]
    out.y = points[2 * n - 1]
    return n - 1
  }
  // 二分：最大的 i 使 times[i] <= t
  let lo = 0
  let hi = n - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= t) lo = mid
    else hi = mid
  }
  const i = lo
  const span = times[i + 1] - times[i]
  const f = span > 0 ? (t - times[i]) / span : 0
  out.x = points[2 * i] + (points[2 * i + 2] - points[2 * i]) * f
  out.y = points[2 * i + 1] + (points[2 * i + 3] - points[2 * i + 1]) * f
  return i
}
