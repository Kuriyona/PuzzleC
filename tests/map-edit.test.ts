import { describe, expect, it } from 'vitest'
import { hasWall, isBorderWall, setWall, snapCell, snapText, snapWall, toggleGoal } from '../src/map/edit'
import { createDraft } from '../src/map/draft'

describe('snapWall', () => {
  it('取最近的网格线（距离相等取竖线）', () => {
    expect(snapWall(0.6, 3.4, 10, 10)).toEqual({ axis: 'v', k: 1, i: 3 })
    // 距竖线 k=0 与横线 k=0 等距 → 竖线
    expect(snapWall(0, 0, 10, 10)).toEqual({ axis: 'v', k: 0, i: 0 })
  })

  it('更靠近横线时取横线', () => {
    expect(snapWall(4.2, 2.5, 10, 10)).toEqual({ axis: 'h', k: 3, i: 4 })
  })

  it('k / i clamp 到合法范围', () => {
    expect(snapWall(-5, -5, 10, 10)).toEqual({ axis: 'v', k: 0, i: 0 })
    expect(snapWall(99, 99, 10, 10)).toEqual({ axis: 'v', k: 10, i: 9 })
  })

  it('外圈段识别', () => {
    expect(isBorderWall({ axis: 'v', k: 0, i: 3 }, 10, 10)).toBe(true)
    expect(isBorderWall({ axis: 'v', k: 10, i: 3 }, 10, 10)).toBe(true)
    expect(isBorderWall({ axis: 'v', k: 1, i: 3 }, 10, 10)).toBe(false)
    expect(isBorderWall({ axis: 'h', k: 0, i: 3 }, 10, 10)).toBe(true)
    expect(isBorderWall({ axis: 'h', k: 10, i: 3 }, 10, 10)).toBe(true)
    expect(isBorderWall({ axis: 'h', k: 1, i: 3 }, 10, 10)).toBe(false)
  })
})

describe('snapCell', () => {
  it('取最近格中心并 clamp', () => {
    expect(snapCell(1.4, 2.6, 10, 10)).toEqual({ x: 1, y: 3 })
    expect(snapCell(-3, 99, 10, 10)).toEqual({ x: 0, y: 9 })
  })
})

describe('snapText', () => {
  it('1/10 格精度', () => {
    expect(snapText(2.34, 5.06, 10, 10)).toEqual({ x: 2.3, y: 5.1 })
  })

  it('clamp 到 [0, cols] × [0, rows]', () => {
    expect(snapText(-1, 12, 10, 10)).toEqual({ x: 0, y: 10 })
    expect(snapText(50, -50, 10, 10)).toEqual({ x: 10, y: 0 })
  })
})

describe('setWall / hasWall / toggleGoal', () => {
  it('外圈墙不可编辑', () => {
    const draft = createDraft(4, 4, 0)
    setWall(draft, { axis: 'v', k: 0, i: 0 }, false)
    expect(hasWall(draft, { axis: 'v', k: 0, i: 0 })).toBe(true)
    setWall(draft, { axis: 'h', k: 4, i: 2 }, false)
    expect(hasWall(draft, { axis: 'h', k: 4, i: 2 })).toBe(true)
  })

  it('内部墙段可增可删', () => {
    const draft = createDraft(4, 4, 0)
    setWall(draft, { axis: 'v', k: 1, i: 2 }, true)
    expect(hasWall(draft, { axis: 'v', k: 1, i: 2 })).toBe(true)
    setWall(draft, { axis: 'v', k: 1, i: 2 }, false)
    expect(hasWall(draft, { axis: 'v', k: 1, i: 2 })).toBe(false)

    setWall(draft, { axis: 'h', k: 2, i: 1 }, true)
    expect(hasWall(draft, { axis: 'h', k: 2, i: 1 })).toBe(true)
    setWall(draft, { axis: 'h', k: 2, i: 1 }, false)
    expect(hasWall(draft, { axis: 'h', k: 2, i: 1 })).toBe(false)
  })

  it('toggleGoal 同格两次相互抵消', () => {
    const draft = createDraft(4, 4, 0)
    toggleGoal(draft, { x: 2, y: 3 })
    expect(draft.goals).toEqual([{ x: 2, y: 3 }])
    toggleGoal(draft, { x: 2, y: 3 })
    expect(draft.goals).toHaveLength(0)
  })

  it('多个目标可共存', () => {
    const draft = createDraft(4, 4, 0)
    toggleGoal(draft, { x: 0, y: 1 })
    toggleGoal(draft, { x: 3, y: 2 })
    expect(draft.goals).toEqual([
      { x: 0, y: 1 },
      { x: 3, y: 2 },
    ])
  })
})
