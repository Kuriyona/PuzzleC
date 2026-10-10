/**
 * 轨迹采样（纯逻辑，无副作用）。
 * points 交替存放 x,y 连续坐标；位移小于阈值时不记录，避免逐帧堆积冗余点。
 */

/** 采样阈值（格）：相邻记录点至少相隔该距离 */
export const TRAIL_STEP = 0.06

export interface Trail {
  /** 交替存放 x,y 的连续坐标点；首点恒为重置位置 */
  points: number[]
  /** 清空并以 (x,y) 作为新起点 */
  reset(x: number, y: number): void
  /** 距上一点位移达到阈值时追加 */
  push(x: number, y: number): void
}

export function createTrail(): Trail {
  const points: number[] = []
  const stepSq = TRAIL_STEP * TRAIL_STEP
  return {
    points,
    reset(x: number, y: number): void {
      points.length = 0
      points.push(x, y)
    },
    push(x: number, y: number): void {
      const n = points.length
      if (n === 0) {
        points.push(x, y)
        return
      }
      const dx = x - points[n - 2]
      const dy = y - points[n - 1]
      if (dx * dx + dy * dy < stepSq) return
      points.push(x, y)
    },
  }
}
