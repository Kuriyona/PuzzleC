import type { Cell, Level, SizeId, WallGrid } from '../types'
import type { MessageKey } from '../i18n/messages'
import { mulberry32 } from './rng'

export const SIZE_OPTIONS = [
  { id: 'small', labelKey: 'opt.size.small', cells: 6, hint: '6×6' },
  { id: 'medium', labelKey: 'opt.size.medium', cells: 10, hint: '10×10' },
  { id: 'large', labelKey: 'opt.size.large', cells: 15, hint: '15×15' },
] as const satisfies readonly {
  id: SizeId
  labelKey: MessageKey
  cells: number
  hint: string
}[]

/** 越界 → true（外圈即墙）。 */
export function hasVWall(level: WallGrid, lineX: number, row: number): boolean {
  if (lineX < 0 || lineX > level.cols || row < 0 || row >= level.rows) return true
  return level.vWalls[row * (level.cols + 1) + lineX] === 1
}

/** 越界 → true（外圈即墙）。 */
export function hasHWall(level: WallGrid, lineY: number, col: number): boolean {
  if (lineY < 0 || lineY > level.rows || col < 0 || col >= level.cols) return true
  return level.hWalls[lineY * level.cols + col] === 1
}

/**
 * 迭代式递归回溯生成完美迷宫（唯一通路）。
 * 格 (cx,cy) 是一个方形房间；墙是格与格之间的一条线段（网格的边）。
 */
export function generateMaze(cols: number, rows: number, seed: number): Level {
  const hWalls = new Uint8Array((rows + 1) * cols).fill(1)
  const vWalls = new Uint8Array(rows * (cols + 1)).fill(1)
  const rng = mulberry32(seed)
  const visited = new Uint8Array(cols * rows)
  const stack: number[] = [0]
  visited[0] = 1

  while (stack.length > 0) {
    const cur = stack[stack.length - 1]
    const cx = cur % cols
    const cy = (cur - cx) / cols

    const neighbors: number[] = []
    if (cy > 0 && visited[cur - cols] === 0) neighbors.push(cur - cols)
    if (cy < rows - 1 && visited[cur + cols] === 0) neighbors.push(cur + cols)
    if (cx > 0 && visited[cur - 1] === 0) neighbors.push(cur - 1)
    if (cx < cols - 1 && visited[cur + 1] === 0) neighbors.push(cur + 1)

    if (neighbors.length === 0) {
      stack.pop()
      continue
    }

    const next = neighbors[Math.floor(rng() * neighbors.length)]
    const nx = next % cols
    const ny = (next - nx) / cols
    if (ny === cy) vWalls[cy * (cols + 1) + Math.max(cx, nx)] = 0 // 竖线 x = max(cx,nx) - 0.5
    else hWalls[Math.max(cy, ny) * cols + cx] = 0 // 横线 y = max(cy,ny) - 0.5
    visited[next] = 1
    stack.push(next)
  }

  const start: Cell = { x: 0, y: 0 }
  const level: Level = { seed, cols, rows, hWalls, vWalls, start, goals: [], labels: [] }
  level.goals.push(farthestCell(level, start))
  return level
}

/** 从 from 出发的步数场；不可达 = -1；长度 cols*rows。 */
export function bfs(level: Level, from: Cell): Int32Array {
  const dist = new Int32Array(level.cols * level.rows).fill(-1)
  const queue = new Int32Array(level.cols * level.rows)
  let head = 0
  let tail = 0
  const startIndex = from.y * level.cols + from.x
  if (startIndex < 0 || startIndex >= dist.length) return dist
  dist[startIndex] = 0
  queue[tail++] = startIndex

  while (head < tail) {
    const cur = queue[head++]
    const x = cur % level.cols
    const y = (cur - x) / level.cols
    const d = dist[cur] + 1
    if (!hasHWall(level, y, x) && dist[cur - level.cols] === -1) {
      dist[cur - level.cols] = d
      queue[tail++] = cur - level.cols
    }
    if (!hasHWall(level, y + 1, x) && dist[cur + level.cols] === -1) {
      dist[cur + level.cols] = d
      queue[tail++] = cur + level.cols
    }
    if (!hasVWall(level, x, y) && dist[cur - 1] === -1) {
      dist[cur - 1] = d
      queue[tail++] = cur - 1
    }
    if (!hasVWall(level, x + 1, y) && dist[cur + 1] === -1) {
      dist[cur + 1] = d
      queue[tail++] = cur + 1
    }
  }
  return dist
}

/** 最大 BFS 步数；并列取最小下标。 */
export function farthestCell(level: Level, from: Cell): Cell {
  const dist = bfs(level, from)
  let bestIndex = from.y * level.cols + from.x
  let best = -1
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > best) {
      best = dist[i]
      bestIndex = i
    }
  }
  const x = bestIndex % level.cols
  return { x, y: (bestIndex - x) / level.cols }
}
