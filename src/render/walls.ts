import type { Level } from '../types'

/**
 * 墙体渲染（纯几何 + 渐变构造，只依赖 Canvas 2D 接口，不涉及 Vue）。
 * 墙体 = 有厚度的实体墙段，圆角端 / 连接；亮度由径向渐变随距离连续衰减，无亮度档。
 * 坐标空间：调用方已把 ctx translate 到世界原点，坐标单位为像素（像素 = (连续坐标 + 0.5) * tile）。
 */

/** 墙厚（格宽比例） */
export const WALL_THICKNESS = 0.12

/** 最小墙线宽（CSS 像素）：大迷宫下墙格很小时避免退化成发丝线 */
const MIN_WALL_PX = 1.25

/** 亮度随距离的衰减指数与峰值（与玩家光照一致） */
const WALL_FALLOFF = 0.8
const WALL_PEAK = 0.95

/** 径向渐变的分数段数：分段线性近似衰减曲线，视觉连续（不存在离散亮度档） */
const WALL_STOPS = 32

/** 当前格宽下的墙线宽 */
export function wallLineWidth(tile: number): number {
  return Math.max(MIN_WALL_PX, tile * WALL_THICKNESS)
}

/** 供墙段描边使用的径向渐变：亮心在 (x,y)，半径 r 处衰减为 0。 */
export function wallGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  peak: number = WALL_PEAK,
): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  for (let i = 0; i <= WALL_STOPS; i++) {
    const t = i / WALL_STOPS
    g.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, WALL_FALLOFF) * peak})`)
  }
  return g
}

/** 把 level 的全部墙段（含外圈）写入当前路径。 */
export function addLevelWalls(ctx: CanvasRenderingContext2D, level: Level, tile: number): void {
  const { cols, rows, vWalls, hWalls } = level
  for (let k = 0; k <= cols; k++) {
    const x = k * tile
    for (let y = 0; y < rows; y++) {
      if (vWalls[y * (cols + 1) + k] !== 1) continue
      ctx.moveTo(x, y * tile)
      ctx.lineTo(x, (y + 1) * tile)
    }
  }
  for (let k = 0; k <= rows; k++) {
    const y = k * tile
    for (let x = 0; x < cols; x++) {
      if (hWalls[k * cols + x] !== 1) continue
      ctx.moveTo(x * tile, y)
      ctx.lineTo((x + 1) * tile, y)
    }
  }
}

/** 把可见墙段（visibility.lit，每 4 个连续坐标一条）写入当前路径。 */
export function addLitWalls(ctx: CanvasRenderingContext2D, lit: number[], tile: number): void {
  for (let i = 0; i < lit.length; i += 4) {
    ctx.moveTo((lit[i] + 0.5) * tile, (lit[i + 1] + 0.5) * tile)
    ctx.lineTo((lit[i + 2] + 0.5) * tile, (lit[i + 3] + 0.5) * tile)
  }
}
