import type { LevelLabel, TextAlignId, TextSizeId } from '../types'
import { textSizeScale } from '../map/format'

/** 文字标签字体栈（与界面字体一致） */
export const LABEL_FONT_STACK = "'Inter', 'Segoe UI', 'Noto Sans SC', system-ui, sans-serif"

/** 按标签预设设置 ctx.font（字号 = max(1, round(scale * tile)) px）、textAlign、textBaseline */
function applyLabelFont(
  ctx: CanvasRenderingContext2D,
  size: TextSizeId,
  align: TextAlignId,
  tile: number,
): void {
  const px = Math.max(1, Math.round(textSizeScale(size) * tile))
  ctx.font = `${px}px ${LABEL_FONT_STACK}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
}

/**
 * 依次绘制文字标签：位置 = 标签连续坐标的像素坐标 ((c + 0.5) * tile)。
 * fillStyle 由调用方预先设置（主题色或距离渐变）；坐标为世界像素。
 */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: LevelLabel[],
  tile: number,
): void {
  for (const label of labels) {
    if (label.text === '') continue
    applyLabelFont(ctx, label.size, label.align, tile)
    ctx.fillText(label.text, (label.pos.x + 0.5) * tile, (label.pos.y + 0.5) * tile)
  }
}
