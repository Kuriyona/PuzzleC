import type { Level, Vec2 } from '../types'
import { hasHWall, hasVWall } from './maze'

/** 玩家碰撞半径（格）；光点绘制半径使用同一常量 */
export const PLAYER_R = 0.18

/** 子步进 + 分轴解算（先 X 后用新 X 解 Y）→ 自然贴墙滑动；写入 out，不分配。 */
export function moveWithCollision(
  level: Level,
  from: Vec2,
  dx: number,
  dy: number,
  radius: number,
  out: Vec2,
): void {
  const dist = Math.hypot(dx, dy)
  if (dist <= 1e-9) {
    out.x = from.x
    out.y = from.y
    return
  }
  const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)))
  const sx = dx / steps
  const sy = dy / steps
  let px = from.x
  let py = from.y
  for (let i = 0; i < steps; i++) {
    px = resolveX(level, px, py, px + sx, radius)
    py = resolveY(level, px, py, py + sy, radius)
  }
  out.x = px
  out.y = py
}

function resolveX(level: Level, px: number, py: number, nx: number, radius: number): number {
  const kLo = Math.max(0, Math.floor(nx - radius + 0.5))
  const kHi = Math.min(level.cols, Math.ceil(nx + radius + 0.5))
  const yLo = Math.max(0, Math.floor(py - radius + 0.5))
  const yHi = Math.min(level.rows - 1, Math.ceil(py + radius + 0.5))
  for (let k = kLo; k <= kHi; k++) {
    const lineX = k - 0.5
    if (Math.abs(nx - lineX) >= radius) continue
    for (let y = yLo; y <= yHi; y++) {
      if (!hasVWall(level, k, y)) continue
      const cy = Math.min(Math.max(py, y - 0.5), y + 0.5)
      if (Math.abs(py - cy) >= radius) continue
      nx = px <= lineX ? lineX - radius : lineX + radius
      break
    }
  }
  return nx
}

function resolveY(level: Level, px: number, py: number, ny: number, radius: number): number {
  const kLo = Math.max(0, Math.floor(ny - radius + 0.5))
  const kHi = Math.min(level.rows, Math.ceil(ny + radius + 0.5))
  const xLo = Math.max(0, Math.floor(px - radius + 0.5))
  const xHi = Math.min(level.cols - 1, Math.ceil(px + radius + 0.5))
  for (let k = kLo; k <= kHi; k++) {
    const lineY = k - 0.5
    if (Math.abs(ny - lineY) >= radius) continue
    for (let x = xLo; x <= xHi; x++) {
      if (!hasHWall(level, k, x)) continue
      const cx = Math.min(Math.max(px, x - 0.5), x + 0.5)
      if (Math.abs(px - cx) >= radius) continue
      ny = py <= lineY ? lineY - radius : lineY + radius
      break
    }
  }
  return ny
}
