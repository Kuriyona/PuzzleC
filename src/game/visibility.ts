import type { Cell, Level, Vec2 } from '../types'

/** 数值容差（单位：格） */
const EPS = 1e-9

/**
 * 从 from 朝 (dx,dy) 投射一条射线，返回最近命中的墙段参数 t（t 与 maxT 同尺度，
 * 方向无需归一化）；未命中则返回 maxT。
 *
 * 墙段恰好占据一条格线的一段（长度 1 格），因此命中点所在格索引 = round(命中坐标)。
 */
export function castRay(level: Level, from: Vec2, dx: number, dy: number, maxT: number): number {
  let best = maxT

  if (dx !== 0) {
    const kLo = Math.max(0, Math.floor(from.x - maxT + 0.5))
    const kHi = Math.min(level.cols, Math.ceil(from.x + maxT + 0.5))
    for (let k = kLo; k <= kHi; k++) {
      const t = (k - 0.5 - from.x) / dx
      if (t <= EPS || t > best) continue
      const y = Math.round(from.y + dy * t)
      if (y < 0 || y >= level.rows) continue
      if (level.vWalls[y * (level.cols + 1) + k] === 1) best = t
    }
  }

  if (dy !== 0) {
    const kLo = Math.max(0, Math.floor(from.y - maxT + 0.5))
    const kHi = Math.min(level.rows, Math.ceil(from.y + maxT + 0.5))
    for (let k = kLo; k <= kHi; k++) {
      const t = (k - 0.5 - from.y) / dy
      if (t <= EPS || t > best) continue
      const x = Math.round(from.x + dx * t)
      if (x < 0 || x >= level.cols) continue
      if (level.hWalls[k * level.cols + x] === 1) best = t
    }
  }

  return best
}

export interface Visibility {
  /** 扇形多边形顶点，交替 x,y（连续坐标，格单位） */
  fan: number[]
  /** 可见墙段，每 4 个数一条 (x0,y0,x1,y1)（连续坐标） */
  lit: number[]
  /** 内部复用缓冲：待投射角度 */
  angles: number[]
}

export function createVisibility(): Visibility {
  return { fan: [], lit: [], angles: [] }
}

/** 基础采样角度数：只在没有任何墙段的方向才会用到半径边缘。 */
const BASE_ANGLES = 24

export function computeVisibility(level: Level, pos: Vec2, radius: number, out: Visibility): void {
  const { cols, rows } = level
  const fan = out.fan
  const lit = out.lit
  const angles = out.angles
  fan.length = 0
  lit.length = 0
  angles.length = 0

  const kLoV = Math.max(0, Math.floor(pos.x - radius + 0.5))
  const kHiV = Math.min(cols, Math.ceil(pos.x + radius + 0.5))
  const yLoV = Math.max(0, Math.floor(pos.y - radius + 0.5))
  const yHiV = Math.min(rows - 1, Math.ceil(pos.y + radius + 0.5))
  const kLoH = Math.max(0, Math.floor(pos.y - radius + 0.5))
  const kHiH = Math.min(rows, Math.ceil(pos.y + radius + 0.5))
  const xLoH = Math.max(0, Math.floor(pos.x - radius + 0.5))
  const xHiH = Math.min(cols - 1, Math.ceil(pos.x + radius + 0.5))

  // 1. 基础角度
  for (let i = 0; i < BASE_ANGLES; i++) angles.push((i / BASE_ANGLES) * Math.PI * 2)

  // 2. 墙段端点角度
  const r2 = radius * radius
  for (let k = kLoV; k <= kHiV; k++) {
    for (let y = yLoV; y <= yHiV; y++) {
      if (level.vWalls[y * (cols + 1) + k] !== 1) continue
      const ex = k - 0.5
      for (let e = 0; e < 2; e++) {
        const ey = e === 0 ? y - 0.5 : y + 0.5
        const ddx = ex - pos.x
        const ddy = ey - pos.y
        if (ddx * ddx + ddy * ddy > r2) continue
        const a = Math.atan2(ddy, ddx)
        angles.push(a - 0.0006, a, a + 0.0006)
      }
    }
  }
  for (let k = kLoH; k <= kHiH; k++) {
    for (let x = xLoH; x <= xHiH; x++) {
      if (level.hWalls[k * cols + x] !== 1) continue
      const ey = k - 0.5
      for (let e = 0; e < 2; e++) {
        const ex = e === 0 ? x - 0.5 : x + 0.5
        const ddx = ex - pos.x
        const ddy = ey - pos.y
        if (ddx * ddx + ddy * ddy > r2) continue
        const a = Math.atan2(ddy, ddx)
        angles.push(a - 0.0006, a, a + 0.0006)
      }
    }
  }

  // 3. 排序去重 → 扇形
  angles.sort((a, b) => a - b)
  let prev = -Infinity
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i]
    if (a <= prev + 1e-6) continue
    prev = a
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const t = castRay(level, pos, ca, sa, radius)
    fan.push(pos.x + ca * t, pos.y + sa * t)
  }

  // 4. 可见墙段（顺序固定：先垂直段 k 升序 / y 升序，再水平段 k 升序 / x 升序）
  for (let k = kLoV; k <= kHiV; k++) {
    const lineX = k - 0.5
    for (let y = yLoV; y <= yHiV; y++) {
      if (level.vWalls[y * (cols + 1) + k] !== 1) continue
      const cy = Math.min(Math.max(pos.y, y - 0.5), y + 0.5)
      const dx = lineX - pos.x
      const dy = cy - pos.y
      const d = Math.hypot(dx, dy)
      if (d > radius) continue
      if (d > 1e-6) {
        const t = castRay(level, pos, dx / d, dy / d, d + 1e-6)
        if (t < d - 1e-6) continue
      }
      lit.push(lineX, y - 0.5, lineX, y + 0.5)
    }
  }
  for (let k = kLoH; k <= kHiH; k++) {
    const lineY = k - 0.5
    for (let x = xLoH; x <= xHiH; x++) {
      if (level.hWalls[k * cols + x] !== 1) continue
      const cx = Math.min(Math.max(pos.x, x - 0.5), x + 0.5)
      const dx = cx - pos.x
      const dy = lineY - pos.y
      const d = Math.hypot(dx, dy)
      if (d > radius) continue
      if (d > 1e-6) {
        const t = castRay(level, pos, dx / d, dy / d, d + 1e-6)
        if (t < d - 1e-6) continue
      }
      lit.push(x - 0.5, lineY, x + 0.5, lineY)
    }
  }
}

/** 目标格中心是否可见（半径裁剪 + 一条射线的遮挡判定）。 */
export function isVisible(level: Level, pos: Vec2, target: Cell, radius: number): boolean {
  const px = Math.round(pos.x)
  const py = Math.round(pos.y)
  if (px === target.x && py === target.y) return true
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const d = Math.hypot(dx, dy)
  if (d > radius) return false
  return castRay(level, pos, dx / d, dy / d, d + 1e-6) >= d - 1e-6
}
