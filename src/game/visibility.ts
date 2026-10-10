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
  /** 可见墙段的**可见部分**，每 4 个数一条 (x0,y0,x1,y1)（连续坐标）；整条可见时即整条 */
  lit: number[]
  /** 内部复用缓冲：待投射角度 */
  angles: number[]
}

export function createVisibility(): Visibility {
  return { fan: [], lit: [], angles: [] }
}

/** 基础采样角度数：只在没有任何墙段的方向才会用到半径边缘。 */
const BASE_ANGLES = 24

/** 墙段可见性采样数（含两端）：用于把一整条边按可见部分切分 */
const SPAN_SAMPLES = 16
/** 可见 / 遮挡边界二分细化次数 */
const SPAN_REFINE = 8
/** 可见碎片短于该长度（格，墙段长 1 格）就不输出：多为一整条边只剩角点可见，圆头笔画会画成斑点 */
const SPAN_MIN_CELLS = 1 / 64

/** 复用缓冲：一条墙段各采样点的可见性（0/1） */
const spanLit = new Uint8Array(SPAN_SAMPLES + 1)

/** 墙段上的点是否在视野内、且未被别的墙挡住（点自身所在的墙不算遮挡） */
function pointLit(level: Level, pos: Vec2, radius: number, px: number, py: number): boolean {
  const dx = px - pos.x
  const dy = py - pos.y
  const d = Math.hypot(dx, dy)
  if (d > radius) return false
  if (d <= 1e-6) return true
  return castRay(level, pos, dx / d, dy / d, d + 1e-6) >= d - 1e-6
}

/** 二分细化可见 / 遮挡边界：hidden 侧被挡、visible 侧可见，返回可见侧边界（t 沿墙段归一化） */
function refineSpanBoundary(
  level: Level,
  pos: Vec2,
  radius: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  tHidden: number,
  tVisible: number,
): number {
  let hidden = tHidden
  let visible = tVisible
  for (let i = 0; i < SPAN_REFINE; i++) {
    const mid = (hidden + visible) / 2
    if (pointLit(level, pos, radius, ax + (bx - ax) * mid, ay + (by - ay) * mid)) visible = mid
    else hidden = mid
  }
  return visible
}

/**
 * 把墙段 (ax,ay)-(bx,by) 的可见部分写入 lit。
 * 整条可见 → 原样写入整条；只可见一部分 → 写入细化的可见子区间（沿墙段升序）。
 */
function pushVisibleSpans(
  level: Level,
  pos: Vec2,
  radius: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: number[],
): void {
  let all = true
  let any = false
  for (let j = 0; j <= SPAN_SAMPLES; j++) {
    const t = j / SPAN_SAMPLES
    const v = pointLit(level, pos, radius, ax + (bx - ax) * t, ay + (by - ay) * t)
    spanLit[j] = v ? 1 : 0
    if (v) any = true
    else all = false
  }
  if (!any) return
  if (all) {
    out.push(ax, ay, bx, by)
    return
  }
  for (let j = 0; j <= SPAN_SAMPLES; j++) {
    if (spanLit[j] === 0) continue
    let k = j
    while (k < SPAN_SAMPLES && spanLit[k + 1] === 1) k++
    const t0 =
      j === 0
        ? 0
        : refineSpanBoundary(level, pos, radius, ax, ay, bx, by, (j - 1) / SPAN_SAMPLES, j / SPAN_SAMPLES)
    const t1 =
      k === SPAN_SAMPLES
        ? 1
        : refineSpanBoundary(level, pos, radius, ax, ay, bx, by, (k + 1) / SPAN_SAMPLES, k / SPAN_SAMPLES)
    if (t1 - t0 >= SPAN_MIN_CELLS) {
      out.push(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1)
    }
    j = k
  }
}

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

  // 4. 可见墙段：按**可见部分**切分——整条没被挡住则整条写入，
  //    只露出一部分 / 只被挡住一部分时写入对应的子区间。
  //    顺序固定：先垂直段 k 升序 / y 升序（子区间沿 y 升序），再水平段 k 升序 / x 升序。
  for (let k = kLoV; k <= kHiV; k++) {
    const lineX = k - 0.5
    for (let y = yLoV; y <= yHiV; y++) {
      if (level.vWalls[y * (cols + 1) + k] !== 1) continue
      const cy = Math.min(Math.max(pos.y, y - 0.5), y + 0.5)
      const dx = lineX - pos.x
      const dy = cy - pos.y
      if (dx * dx + dy * dy > r2) continue
      pushVisibleSpans(level, pos, radius, lineX, y - 0.5, lineX, y + 0.5, lit)
    }
  }
  for (let k = kLoH; k <= kHiH; k++) {
    const lineY = k - 0.5
    for (let x = xLoH; x <= xHiH; x++) {
      if (level.hWalls[k * cols + x] !== 1) continue
      const cx = Math.min(Math.max(pos.x, x - 0.5), x + 0.5)
      const dx = cx - pos.x
      const dy = lineY - pos.y
      if (dx * dx + dy * dy > r2) continue
      pushVisibleSpans(level, pos, radius, x - 0.5, lineY, x + 0.5, lineY, lit)
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
