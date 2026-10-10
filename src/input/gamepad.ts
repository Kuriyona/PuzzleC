/**
 * 手柄输入：设备快照读取 + 按键边沿 / 长按重复跟踪。
 * 纯逻辑、无 DOM 副作用（只在 readPad 里读传入的 Gamepad 快照），便于单测。
 */

/** 标准映射下的按键索引（非标准手柄按同一套索引尝试，绝大多数仍一致） */
export const PAD_BUTTON = {
  /** 确认（A / ×） */
  confirm: 0,
  /** 返回 / 取消（B / ○） */
  back: 1,
  /** 次要动作（X / □） */
  secondary: 2,
  /** 备用（Y / △） */
  alt: 3,
  /** Select / Back（游玩中 = 暂停） */
  select: 8,
  /** Start（界面主要动作） */
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const

/** 左摇杆死区（绝对值小于它的轴读数按 0 处理） */
export const STICK_DEADZONE = 0.18
/** 摇杆当作方向键使用时的阈值 */
export const NAV_THRESHOLD = 0.6

export type NavDir = 'up' | 'down' | 'left' | 'right'

export interface PadSnapshot {
  /** 本轮是否拿到手柄设备 */
  connected: boolean
  /** 合成轴（左摇杆 + 十字键），已去死区并重标定到 [-1, 1]；供游戏移动使用 */
  x: number
  y: number
  /** 方向「按住」：十字键，或摇杆越过阈值；供界面导航使用 */
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  /** 功能键「按住」状态 */
  confirm: boolean
  back: boolean
  secondary: boolean
  start: boolean
  select: boolean
}

export function emptyPadSnapshot(): PadSnapshot {
  return {
    connected: false,
    x: 0,
    y: 0,
    up: false,
    down: false,
    left: false,
    right: false,
    confirm: false,
    back: false,
    secondary: false,
    start: false,
    select: false,
  }
}

/** 死区外线性重标定：避免刚出死区就跳到较大值，手感更连续 */
function axisValue(value: number): number {
  const magnitude = Math.abs(value)
  if (!Number.isFinite(value) || magnitude <= STICK_DEADZONE) return 0
  const scaled = (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE)
  return Math.sign(value) * Math.min(1, scaled)
}

export function clampUnit(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value
}

function isPressed(pad: Gamepad, index: number): boolean {
  return pad.buttons[index]?.pressed === true
}

/**
 * 读取一个手柄快照并写入 `out`（复用调用方缓冲，避免逐帧分配）。
 * `pad` 为空表示本轮没有设备：快照被清零（含 connected = false）。
 */
export function readPad(pad: Gamepad | null | undefined, out: PadSnapshot): PadSnapshot {
  if (!pad) {
    out.connected = false
    out.x = 0
    out.y = 0
    out.up = false
    out.down = false
    out.left = false
    out.right = false
    out.confirm = false
    out.back = false
    out.secondary = false
    out.start = false
    out.select = false
    return out
  }

  const sx = axisValue(pad.axes[0] ?? 0)
  const sy = axisValue(pad.axes[1] ?? 0)
  const dUp = isPressed(pad, PAD_BUTTON.up)
  const dDown = isPressed(pad, PAD_BUTTON.down)
  const dLeft = isPressed(pad, PAD_BUTTON.left)
  const dRight = isPressed(pad, PAD_BUTTON.right)

  out.connected = true
  out.x = clampUnit(sx + (dRight ? 1 : 0) - (dLeft ? 1 : 0))
  out.y = clampUnit(sy + (dDown ? 1 : 0) - (dUp ? 1 : 0))
  out.up = dUp || sy <= -NAV_THRESHOLD
  out.down = dDown || sy >= NAV_THRESHOLD
  out.left = dLeft || sx <= -NAV_THRESHOLD
  out.right = dRight || sx >= NAV_THRESHOLD
  out.confirm = isPressed(pad, PAD_BUTTON.confirm)
  out.back = isPressed(pad, PAD_BUTTON.back)
  out.secondary = isPressed(pad, PAD_BUTTON.secondary)
  out.start = isPressed(pad, PAD_BUTTON.start)
  out.select = isPressed(pad, PAD_BUTTON.select)
  return out
}

export interface PadEvents {
  /** 本帧新产生的方向事件（含长按重复）；无则 null */
  nav: NavDir | null
  confirm: boolean
  back: boolean
  secondary: boolean
  start: boolean
  select: boolean
}

/** 长按导航：首次重复前的延迟与之后的重复间隔（毫秒） */
export const NAV_INITIAL_DELAY_MS = 400
export const NAV_REPEAT_MS = 120

const DIRS: readonly NavDir[] = ['up', 'down', 'left', 'right']

export interface PadTracker {
  /** 传入本帧快照与时间戳，返回本帧产生的事件（对象被复用，勿长期持有） */
  update(next: PadSnapshot, now: number): PadEvents
}

/**
 * 边沿检测：功能键与方向键只在「按下那一帧」触发；方向键另带长按重复。
 * 第一次 update（prev 未知）不产生任何事件，避免挂载瞬间把「已按住」当成新按下。
 */
export function createPadTracker(): PadTracker {
  let prev: PadSnapshot | null = null
  const heldSince: Record<NavDir, number> = { up: -1, down: -1, left: -1, right: -1 }
  const lastNav: Record<NavDir, number> = { up: -1, down: -1, left: -1, right: -1 }
  const events: PadEvents = {
    nav: null,
    confirm: false,
    back: false,
    secondary: false,
    start: false,
    select: false,
  }

  return {
    update(next, now) {
      events.nav = null
      events.confirm = false
      events.back = false
      events.secondary = false
      events.start = false
      events.select = false

      if (prev) {
        events.confirm = next.confirm && !prev.confirm
        events.back = next.back && !prev.back
        events.secondary = next.secondary && !prev.secondary
        events.start = next.start && !prev.start
        events.select = next.select && !prev.select

        for (const dir of DIRS) {
          if (next[dir] && !prev[dir]) {
            heldSince[dir] = now
            lastNav[dir] = now
            if (!events.nav) events.nav = dir
          } else if (!next[dir]) {
            heldSince[dir] = -1
          }
        }

        if (!events.nav) {
          for (const dir of DIRS) {
            if (!next[dir] || heldSince[dir] < 0) continue
            if (now - heldSince[dir] < NAV_INITIAL_DELAY_MS) continue
            if (now - lastNav[dir] < NAV_REPEAT_MS) continue
            lastNav[dir] = now
            events.nav = dir
            break
          }
        }
      }

      prev = { ...next }
      return events
    },
  }
}
