import type { ThemeId } from '../types'

/**
 * Canvas 绘制配色（纯数据，不涉及 Vue）。
 * 浅色主题是深色主题的直接反色：底色黑↔白、亮度色白↔黑；
 * 各处的 alpha 衰减曲线完全一致，只交换颜色通道，所以“亮心/边缘”的观感整体翻转。
 */
export interface CanvasPalette {
  /** 可见范围之外的底色：深色主题纯黑，浅色主题纯白 */
  paper: string
  /** 亮度色 rgb 分量文本，交给 inkRgba 拼成 rgba */
  ink: string
}

export const CANVAS_PALETTES: Record<ThemeId, CanvasPalette> = {
  dark: { paper: '#000', ink: '255,255,255' },
  light: { paper: '#fff', ink: '0,0,0' },
}

/** 把亮度色按 alpha 拼成 CSS 颜色（rgba 第四位） */
export function inkRgba(ink: string, alpha: number): string {
  return `rgba(${ink},${alpha})`
}
