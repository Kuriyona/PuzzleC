export type Screen = 'menu' | 'settings' | 'game'
export type SizeId = 'small' | 'medium' | 'large'
export type RadiusId = 'narrow' | 'normal' | 'wide'

export interface Settings {
  size: SizeId
  radius: RadiusId
  animations: boolean
}

/** 格索引（0..cols-1 / 0..rows-1）；格中心连续坐标 = (x,y) */
export interface Cell {
  x: number
  y: number
}

/** 连续坐标（格单位）；世界像素 = (c + 0.5) * tile */
export interface Vec2 {
  x: number
  y: number
}

export interface Level {
  seed: number
  cols: number
  rows: number
  /** 水平墙段，长度 (rows+1)*cols：[lineY*cols + col] */
  hWalls: Uint8Array
  /** 垂直墙段，长度 rows*(cols+1)：[row*(cols+1) + lineX] */
  vWalls: Uint8Array
  start: Cell
  goal: Cell
}

export type GameStatus = 'playing' | 'paused' | 'won' | 'review'
