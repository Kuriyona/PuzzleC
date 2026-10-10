export type Screen = 'menu' | 'settings' | 'game'
export type SizeId = 'small' | 'medium' | 'large'
export type RadiusId = 'narrow' | 'normal' | 'wide'
/** 界面主题：system = 跟随系统配色 */
export type UiThemeId = 'light' | 'dark' | 'system'
/** 迷宫（canvas）主题：ui = 跟随已解析的界面主题 */
export type MazeThemeId = 'light' | 'dark' | 'ui'
/** 解析后的实际主题：深色 = 迷宫纯黑底、其余元素白色 */
export type ThemeId = 'light' | 'dark'

export interface Settings {
  size: SizeId
  radius: RadiusId
  animations: boolean
  uiTheme: UiThemeId
  mazeTheme: MazeThemeId
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
