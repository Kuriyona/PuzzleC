import type { Cell, Vec2 } from '../types'
import { hasHWall, hasVWall } from '../game/maze'
import type { EditorDraft } from './draft'

export type EditorTool = 'wall' | 'start' | 'goal' | 'text'

/** 墙段引用：axis 'v' → 竖线 k、行 i；'h' → 横线 k、列 i */
export interface WallTarget {
  axis: 'v' | 'h'
  k: number
  i: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 最近的整数，平局取下（等价于四舍五入但 .5 向小取） */
function roundHalfDown(v: number): number {
  const lo = Math.floor(v)
  return v - lo <= 0.5 ? lo : lo + 1
}

/** 取最近的一条网格线（连续坐标，格单位）；距离相等时取竖线；k/i 均 clamp 到合法范围 */
export function snapWall(fx: number, fy: number, cols: number, rows: number): WallTarget {
  const tV = fx + 0.5
  const tH = fy + 0.5
  const kv = roundHalfDown(tV)
  const kh = roundHalfDown(tH)
  const dv = Math.abs(tV - kv)
  const dh = Math.abs(tH - kh)
  if (dv <= dh) {
    return { axis: 'v', k: clamp(kv, 0, cols), i: clamp(Math.floor(fy), 0, rows - 1) }
  }
  return { axis: 'h', k: clamp(kh, 0, rows), i: clamp(Math.floor(fx), 0, cols - 1) }
}

/** 最近的格中心（四舍五入 + clamp） */
export function snapCell(fx: number, fy: number, cols: number, rows: number): Cell {
  return { x: clamp(Math.round(fx), 0, cols - 1), y: clamp(Math.round(fy), 0, rows - 1) }
}

/** 1/10 格精度：round(v * 10) / 10，再 clamp 到 [0, cols] / [0, rows] */
export function snapText(fx: number, fy: number, cols: number, rows: number): Vec2 {
  return {
    x: clamp(Math.round(fx * 10) / 10, 0, cols),
    y: clamp(Math.round(fy * 10) / 10, 0, rows),
  }
}

/** 外圈段（v: k=0 或 k=cols；h: k=0 或 k=rows）不可编辑 */
export function isBorderWall(t: WallTarget, cols: number, rows: number): boolean {
  return t.axis === 'v' ? t.k === 0 || t.k === cols : t.k === 0 || t.k === rows
}

export function hasWall(draft: EditorDraft, t: WallTarget): boolean {
  return t.axis === 'v' ? hasVWall(draft, t.k, t.i) : hasHWall(draft, t.k, t.i)
}

export function setWall(draft: EditorDraft, t: WallTarget, on: boolean): void {
  if (isBorderWall(t, draft.cols, draft.rows)) return
  if (t.axis === 'v') draft.vWalls[t.i * (draft.cols + 1) + t.k] = on ? 1 : 0
  else draft.hWalls[t.k * draft.cols + t.i] = on ? 1 : 0
}

/** 同格已有目标则移除，否则追加 */
export function toggleGoal(draft: EditorDraft, cell: Cell): void {
  const index = draft.goals.findIndex((g) => g.x === cell.x && g.y === cell.y)
  if (index >= 0) draft.goals.splice(index, 1)
  else draft.goals.push({ ...cell })
}
