import { inject, onMounted, onUnmounted, provide, readonly, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import { createPadTracker, emptyPadSnapshot, readPad } from './gamepad'
import type { NavDir, PadEvents, PadSnapshot } from './gamepad'

/** 手柄事件：方向导航 / 确认(A) / 返回(B) / 次要动作(X) / 主要动作(Start) / 暂停(Select) */
export type PadEvent =
  | { type: 'nav'; dir: NavDir }
  | { type: 'confirm' }
  | { type: 'back' }
  | { type: 'secondary' }
  | { type: 'start' }
  | { type: 'select' }

/** 返回 true 表示事件已被消费，不再传给下层处理器 */
export type PadHandler = (event: PadEvent) => boolean | void

export interface GamepadAxes {
  x: number
  y: number
}

export interface GamepadContext {
  /** 最近一次输入是否来自手柄：只有手柄模式才显示焦点环与按键标志 */
  mode: Readonly<Ref<boolean>>
  /** 是否有手柄接入 */
  connected: Readonly<Ref<boolean>>
  /** 每帧刷新的合成轴；普通对象，渲染热路径直接读，不进入响应式 */
  axes: GamepadAxes
  /** 注册事件处理器（后注册的在上层，先收到事件）；返回注销函数 */
  onEvent(handler: PadHandler): () => void
  /**
   * useNav 专用：把当前界面的焦点环登记为「最上层」。
   * 只有最上层显示焦点环，浮层打开时下层界面自然隐藏。
   */
  pushNavScope(): { id: number; off: () => void }
  /** 最上层焦点环的 id（无则为 -1） */
  navTop: Readonly<Ref<number>>
}

export const GAMEPAD_KEY: InjectionKey<GamepadContext> = Symbol('puzzlec.gamepad')

function firstPad(): Gamepad | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null
  const pads = navigator.getGamepads()
  for (const pad of pads) if (pad) return pad
  return null
}

/** 快照里是否有「用户正在动手柄」的迹象（任意键按住 / 摇杆偏移） */
function hasActivity(snapshot: PadSnapshot): boolean {
  return (
    snapshot.x !== 0 ||
    snapshot.y !== 0 ||
    snapshot.up ||
    snapshot.down ||
    snapshot.left ||
    snapshot.right ||
    snapshot.confirm ||
    snapshot.back ||
    snapshot.secondary ||
    snapshot.start ||
    snapshot.select
  )
}

/**
 * 建立全局手柄上下文并在 App 里 provide。
 * 用一个常驻 rAF 轮询 `navigator.getGamepads()`（浏览器不会派发按键事件，必须轮询）；
 * 键盘 / 鼠标一动就退出「手柄模式」，据此切换焦点环与按键标志的显示。
 */
export function provideGamepad(): GamepadContext {
  const mode = ref(false)
  const connected = ref(false)
  const axes: GamepadAxes = { x: 0, y: 0 }
  const handlers: PadHandler[] = []
  const tracker = createPadTracker()
  const snapshot = emptyPadSnapshot()
  const navTop = ref(-1)
  const navScopes: number[] = []
  let navSeq = 0

  let rafId = 0

  function fire(event: PadEvent): void {
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i](event) === true) return
    }
  }

  function dispatch(events: PadEvents): void {
    if (events.nav) fire({ type: 'nav', dir: events.nav })
    if (events.confirm) fire({ type: 'confirm' })
    if (events.back) fire({ type: 'back' })
    if (events.secondary) fire({ type: 'secondary' })
    if (events.start) fire({ type: 'start' })
    if (events.select) fire({ type: 'select' })
  }

  function poll(now: number): void {
    rafId = window.requestAnimationFrame(poll)
    readPad(firstPad(), snapshot)
    axes.x = snapshot.x
    axes.y = snapshot.y
    if (snapshot.connected) connected.value = true
    if (snapshot.connected && hasActivity(snapshot)) mode.value = true
    dispatch(tracker.update(snapshot, now))
  }

  const onConnected = (): void => {
    connected.value = true
  }
  const onDisconnected = (): void => {
    if (!firstPad()) connected.value = false
  }
  /** 键盘 / 鼠标一动作就退出「手柄模式」（焦点环与按键标志随之隐藏） */
  const onHumanInput = (): void => {
    mode.value = false
  }

  onMounted(() => {
    rafId = window.requestAnimationFrame(poll)
    window.addEventListener('gamepadconnected', onConnected)
    window.addEventListener('gamepaddisconnected', onDisconnected)
    window.addEventListener('keydown', onHumanInput)
    window.addEventListener('mousedown', onHumanInput)
  })

  onUnmounted(() => {
    window.cancelAnimationFrame(rafId)
    window.removeEventListener('gamepadconnected', onConnected)
    window.removeEventListener('gamepaddisconnected', onDisconnected)
    window.removeEventListener('keydown', onHumanInput)
    window.removeEventListener('mousedown', onHumanInput)
  })

  const context: GamepadContext = {
    mode: readonly(mode),
    connected: readonly(connected),
    axes,
    navTop: readonly(navTop),
    onEvent(handler) {
      handlers.push(handler)
      return () => {
        const index = handlers.indexOf(handler)
        if (index >= 0) handlers.splice(index, 1)
      }
    },
    pushNavScope() {
      const id = ++navSeq
      navScopes.push(id)
      navTop.value = id
      return {
        id,
        off: () => {
          const index = navScopes.indexOf(id)
          if (index >= 0) navScopes.splice(index, 1)
          navTop.value = navScopes.length ? navScopes[navScopes.length - 1] : -1
        },
      }
    },
  }
  provide(GAMEPAD_KEY, context)
  return context
}

export function useGamepad(): GamepadContext {
  const context = inject(GAMEPAD_KEY)
  if (!context) throw new Error('useGamepad() 必须在 App 调用了 provideGamepad() 之后使用')
  return context
}

export interface NavItem {
  /** 确认（A）时执行 */
  select?: () => void
  /** 不可聚焦（跳过） */
  disabled?: boolean
  /** 进入该组时优先聚焦本项（未设则聚焦首个可用项） */
  initial?: boolean
}

export interface NavGroup {
  items: NavItem[]
  /** 组内用左右移动；默认用上下移动（跨组则用另一个轴） */
  horizontal?: boolean
}

export interface NavOptions {
  /** B：返回 / 取消 */
  onBack?: () => void
  /** Start：界面主要动作（开始 / 下一步等） */
  onStart?: () => void
  /** 没有可聚焦项时按确认（A）执行 */
  onConfirm?: () => void
  /** 吞掉所有手柄事件（浮层用，避免落到下层界面） */
  consumeAll?: boolean
}

export interface NavControls {
  /** 该组该项当前是否处于手柄焦点（仅手柄模式下为真） */
  isFocused(group: number, item: number): boolean
  /** 重新计算初始焦点 */
  reset(): void
}

function firstEnabled(items: NavItem[]): number {
  const index = items.findIndex((item) => !item.disabled)
  return index < 0 ? 0 : index
}

/** 在 `from` 基础上按 `delta` 环绕查找下一个可用项；全不可用则原地不动 */
function stepEnabled(items: NavItem[], from: number, delta: number): number {
  const count = items.length
  if (count === 0) return -1
  let index = from
  for (let i = 0; i < count; i++) {
    index = (index + delta + count) % count
    if (!items[index].disabled) return index
  }
  return from
}

/**
 * 手柄焦点环：按「组」组织可聚焦项，组内沿自身轴移动，跨组沿另一轴移动。
 * 与真实 DOM 焦点无关，只把 `.gp-focus` 类挂在当前项上（外描边高亮）。
 */
export function useNav(getGroups: () => NavGroup[], options: NavOptions = {}): NavControls {
  const gamepad = useGamepad()
  const groupIndex = ref(0)
  const itemIndex = ref(0)

  function reset(): void {
    const groups = getGroups()
    groupIndex.value = 0
    itemIndex.value = 0
    if (groups.length === 0) return
    for (let g = 0; g < groups.length; g++) {
      const items = groups[g].items
      const preferred = items.findIndex((item) => item.initial && !item.disabled)
      if (preferred >= 0) {
        groupIndex.value = g
        itemIndex.value = preferred
        return
      }
    }
    itemIndex.value = firstEnabled(groups[0].items)
  }

  function ensureValid(): void {
    const groups = getGroups()
    if (groups.length === 0) return
    if (groupIndex.value >= groups.length) groupIndex.value = groups.length - 1
    const items = groups[groupIndex.value].items
    if (items.length === 0) return
    if (itemIndex.value >= items.length || items[itemIndex.value].disabled) {
      itemIndex.value = firstEnabled(items)
    }
  }

  function move(dir: NavDir): void {
    const groups = getGroups()
    if (groups.length === 0) return
    ensureValid()
    const group = groups[groupIndex.value]
    const alongGroup = group.horizontal
      ? dir === 'left' || dir === 'right'
      : dir === 'up' || dir === 'down'
    const forward = dir === 'right' || dir === 'down'

    if (alongGroup) {
      const next = stepEnabled(group.items, itemIndex.value, forward ? 1 : -1)
      if (next >= 0) itemIndex.value = next
      return
    }
    if (groups.length < 2) return
    let next = groupIndex.value
    for (let i = 0; i < groups.length; i++) {
      next = (next + (forward ? 1 : -1) + groups.length) % groups.length
      if (groups[next].items.some((item) => !item.disabled)) break
    }
    groupIndex.value = next
    itemIndex.value = firstEnabled(groups[next].items)
  }

  function activate(): void {
    const groups = getGroups()
    if (groups.length === 0) {
      options.onConfirm?.()
      return
    }
    ensureValid()
    const item = groups[groupIndex.value].items[itemIndex.value]
    if (item && !item.disabled) item.select?.()
    else options.onConfirm?.()
  }

  function handle(event: PadEvent): boolean | void {
    if (event.type === 'nav') {
      move(event.dir)
      return true
    }
    if (event.type === 'confirm') {
      activate()
      return true
    }
    if (event.type === 'back') {
      if (options.onBack) {
        options.onBack()
        return true
      }
      return options.consumeAll === true
    }
    if (event.type === 'start') {
      if (options.onStart) {
        options.onStart()
        return true
      }
      return options.consumeAll === true
    }
    return options.consumeAll === true
  }

  reset()

  const scope = gamepad.pushNavScope()
  const off = gamepad.onEvent(handle)
  onUnmounted(() => {
    off()
    scope.off()
  })

  return {
    isFocused: (group, item) =>
      gamepad.mode.value &&
      gamepad.navTop.value === scope.id &&
      groupIndex.value === group &&
      itemIndex.value === item,
    reset,
  }
}
