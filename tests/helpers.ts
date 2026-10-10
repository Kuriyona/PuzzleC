import type { Cell, Level, Vec2 } from '../src/types'
import { isVisible } from '../src/game/visibility'

export interface LevelSpec {
  cols: number
  rows: number
  /** 垂直墙段：[线索引, 行]（线 x = k-0.5） */
  v?: [number, number][]
  /** 水平墙段：[线索引, 列]（线 y = k-0.5） */
  h?: [number, number][]
  start?: Cell
  goals?: Cell[]
}

/** 外圈墙恒存在；其余墙段仅由 v/h 指定。 */
export function makeLevel(spec: LevelSpec): Level {
  const { cols, rows } = spec
  const hWalls = new Uint8Array((rows + 1) * cols)
  const vWalls = new Uint8Array(rows * (cols + 1))
  for (let x = 0; x < cols; x++) {
    hWalls[x] = 1
    hWalls[rows * cols + x] = 1
  }
  for (let y = 0; y < rows; y++) {
    vWalls[y * (cols + 1)] = 1
    vWalls[y * (cols + 1) + cols] = 1
  }
  for (const [lineX, row] of spec.v ?? []) vWalls[row * (cols + 1) + lineX] = 1
  for (const [lineY, col] of spec.h ?? []) hWalls[lineY * cols + col] = 1
  const start: Cell = spec.start ?? { x: 0, y: 0 }
  return {
    seed: 0,
    cols,
    rows,
    hWalls,
    vWalls,
    start,
    goals: spec.goals ?? [{ ...start }],
    labels: [],
  }
}

/** 逐格 '#'（可见）/ '.'，第 0 行对应 y=0。 */
export function visibleMask(level: Level, pos: Vec2, radius: number): string[] {
  const lines: string[] = []
  for (let y = 0; y < level.rows; y++) {
    let line = ''
    for (let x = 0; x < level.cols; x++) {
      line += isVisible(level, pos, { x, y }, radius) ? '#' : '.'
    }
    lines.push(line)
  }
  return lines
}
