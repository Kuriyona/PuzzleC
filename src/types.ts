export type Screen = 'menu' | 'start' | 'settings' | 'game' | 'editor' | 'maps'
export type SizeId = 'small' | 'medium' | 'large'
export type RadiusId = 'narrow' | 'normal' | 'wide'
/** 界面主题：system = 跟随系统配色 */
export type UiThemeId = 'light' | 'dark' | 'system'
/** 迷宫（canvas）主题：ui = 跟随已解析的界面主题 */
export type MazeThemeId = 'light' | 'dark' | 'ui'
/** 解析后的实际主题：深色 = 迷宫纯黑底、其余元素白色 */
export type ThemeId = 'light' | 'dark'
/** 界面语言 */
export type LocaleId = 'zh-Hans' | 'zh-Hant' | 'en' | 'ja'

export interface Settings {
  animations: boolean
  uiTheme: UiThemeId
  mazeTheme: MazeThemeId
  locale: LocaleId
}

/** 随机迷宫的生成参数：在「开始游戏」界面按局配置，不属于全局设置 */
export interface GenParams {
  /** 尺寸预设；'custom' 时用 sizeCustom */
  sizePreset: SizeId | 'custom'
  /** 自定义边长（格），仅 sizePreset === 'custom' 时生效 */
  sizeCustom: number
  /** 视野半径预设；'custom' 时用 radiusCustom */
  radiusPreset: RadiusId | 'custom'
  /** 自定义视野半径（格），仅 radiusPreset === 'custom' 时生效 */
  radiusCustom: number
  /** 种子文本；空串 = 每次随机 */
  seed: string
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

/** 墙格：编辑器与运行时共享的墙体存储（外圈恒为墙） */
export interface WallGrid {
  cols: number
  rows: number
  /** 水平墙段，长度 (rows+1)*cols：[lineY*cols + col] */
  hWalls: Uint8Array
  /** 垂直墙段，长度 rows*(cols+1)：[row*(cols+1) + lineX] */
  vWalls: Uint8Array
}

/** 文字标签预设字号 */
export type TextSizeId = 'small' | 'medium' | 'large'
/** 文字标签预设水平对齐（基线固定垂直居中） */
export type TextAlignId = 'left' | 'center' | 'right'

/** 运行时文字标签：i18n 已在构建关卡时按当前语言解析 */
export interface LevelLabel {
  pos: Vec2
  text: string
  size: TextSizeId
  align: TextAlignId
}

export interface Level extends WallGrid {
  seed: number
  start: Cell
  /** 目标格（可多个；生成的迷宫恒为 1 个） */
  goals: Cell[]
  /** 地图文字标签（生成的迷宫为空数组） */
  labels: LevelLabel[]
}

export type GameStatus = 'playing' | 'paused' | 'won' | 'review'
