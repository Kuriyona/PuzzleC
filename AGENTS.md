# Repository Guidelines

Repo root: `@Kuriyona/PuzzleC` (package name `puzzlec`, UI title PuzzleC).

## Project Overview

Single-package Vue 3 + Vite SPA: a keyboard-driven "light point" maze game. The player moves freely through a
procedurally generated maze; a geometric visibility solver decides what is lit, and everything outside the lit
region is pure black with radial brightness falloff.

Hard rules from the original product brief:

- Tooling is mandated: pnpm + Vite + Vue ("使用 pnpm Vite Vue").
- Start menu + in-game settings screen, with animation.
- Visual style: minimal, pure black/white/gray, heavy color inversion as hover.
- Algorithmic random maze generation; player is a light point moved by keyboard to a goal.
- Visible range computed from player light point vs. maze walls; outside it is pure black.
- Brightness inside the visible range decays with distance (brightest at player, very dim at the far edge).

The brief states no acceptance criteria, versions, or numeric parameters; movement feel, radius tiers and
HUD metrics were chosen during implementation.

A later requirement added custom maps: the main menu carries **加载地图** (load a saved map and play it) and
**地图编辑器** (visually author one). Maps are JSON documents stored in IndexedDB, with an in-app JSON import/export and a
storage manager (browser quota estimate + per-map footprint, multi-select batch delete); a map may place
walls, a start, several goals and text labels (position + preset size/align +
optional per-locale text). Text labels resolve against the current UI language while playing. This is the
`src/map/` subsystem; see "Custom maps" below for the file format and compatibility rules.

## Architecture & Data Flow

```
main.ts ── createApp(App).mount('#app')                     (imports styles/base.css)
App.vue  [screen, settings, gen, run, seed, levelIndex, uiTheme, mazeTheme, locale, playingMap, editingMapId]  watch(settings, deep) -> saveSettings()
  ├─ IntroScreen     首次启动引导（语言 → 欢迎 → 游戏介绍 → 界面主题 → 迷宫主题 → 一切就绪；每步都有标题 + 下一步）
  ├─ MenuScreen      props{settings}             emits start, maps, editor, settings
  ├─ StartScreen     v-model<GenParams>          emits start, back   开始游戏：模式（仅随机迷宫）+ 生成参数
  ├─ SettingsScreen  v-model<Settings>           emits back
  ├─ MapListScreen   emits play(map), edit(id), back   已存地图列表 / 导入导出 JSON / 删除
  ├─ EditorScreen    props{mapId, mazeTheme}     emits back
  │     ├─ EditorCanvas        props{draft,tool,rev,selectedLabelId,theme,locale}
  │     │                      emits wall-set, cell-pick, label-place, label-pick, label-move
  │     └─ LocalizedTextEditor v-model<LocalizedText>
  └─ GameScreen      props{settings,seed,levelIndex,mazeSize,radius,mazeTheme,map}  emits next, exit
        │   owns: single rAF loop, 250ms HUD timer, window key/listeners, physics, trail recording
        │   关卡来源：props.map ? mapToLevel(map, locale) : generateMaze(mazeSize, mazeSize, seed)
        ├─ HudBar       props{levelIndex,sizeHint,radius,distance,elapsedMs,seed,mapName} emits pause, restart
        ├─ MazeCanvas   props{level,radius,animations,theme}  exposes renderFrame(now,dt,pos)
        ├─ OverlayPanel props{title,lines,actions}      (paused / won overlays)
        └─ ReviewMap    props{level,points,times,theme}  (won → 全图回顾：按时间回放)

src/render/walls.ts —— MazeCanvas 与 ReviewMap 共用的墙体绘制（实体墙几何 + 连续亮度渐变）
src/render/labels.ts —— 地图文字标签绘制（字号预设 → px、水平对齐、基线垂直居中）
src/render/palette.ts —— Canvas 配色（CANVAS_PALETTES：深色 = 黑底白光 / 浅色 = 白底黑墨）
src/i18n/messages.ts —— 四种界面语言的完整消息表（zh-Hans 为键集合真源）+ translate()
src/i18n/useI18n.ts —— provideLocale() / useT() / useLocale()：注入语言 ref，模板里调用即自动响应式
src/map/format.ts —— v1 地图文件格式（manifest/meta/data 三段）读写、预设表、mapToLevel()
src/map/tags.ts + features.ts —— 特性标签语法（`主标签[/副特性]:主版本.次版本`）与特性表 / 兼容性检查
src/map/draft.ts + edit.ts —— 编辑器草稿（定长 Uint8Array 工作副本）、尺寸裁剪、吸附与墙 / 目标编辑
src/map/store.ts —— IndexedDB 地图存储（唯一触碰 indexedDB 的模块；全部 try/catch，失败返回兜底值）
```

- `App.vue` is the only screen state machine; `screen` toggles `menu | start | settings | game | maps | editor`. `startRandom()`/`nextLevel()` mint a new `randomSeed()`; `levelIndex` increments on next level. `gen` (`GenParams` — 尺寸/视野/种子，`v-model` 给 `StartScreen`) is per-session state that is **not** persisted and **not** part of `Settings`; `App.startRandom()` resolves it into `run = { size, radius }` (`src/game/gen.ts`) plus the seed (`parseSeed(...) ?? randomSeed()`), so `GameScreen` receives plain numbers and custom maps just inherit the configured `radius`. It also resolves both theme axes and puts the UI one on its root element (`'theme-light': uiTheme === 'light'`), passing the resolved maze theme down to `GameScreen`/`EditorScreen`; see the theme section below. It is likewise the single owner of the UI language: it provides `settings.locale` as a ref and syncs `document.documentElement.lang`; see the localization section below. It also owns which custom map is being played (`playingMap`) and which is being edited (`editingMapId`) — `playingMap` is cleared whenever a generated game starts.
- `GameStatus` = `playing | paused | won | review`; `review` is a GameScreen-internal state (not an `App` screen). Reached only from the win overlay ("查看回顾"); it keeps `level`/`pos`/trail alive and replays the recorded timeline on `ReviewMap` (play/pause, 0.5/1/2/4× speed, draggable seek bar). Playback time `reviewPlayMs` is a plain value advanced in `frame()` (ms * speed, clamped to `reviewDuration`); only the clock/seek-bar read `reviewMs` (ref), so no per-frame reactive state. 下一关/重玩本关/返回菜单 exit it.
- Exactly **one** `requestAnimationFrame` loop exists, owned by `GameScreen.frame()`. It self-reschedules, computes `dt` (first frame 16ms, capped 50ms), advances physics only when `status === 'playing'`, and calls `canvasRef.value?.renderFrame(now, dt, pos)` unless paused. `MazeCanvas` never owns a loop — it draws on demand.
- Physics per frame: read `pressed` set → camera-relative input axes (diagonal scaled by `Math.SQRT1_2`) → velocity exponential approach (`SPEED=3.2` cells/s, `ACCEL_TAU=0.06s`) → `moveWithCollision` into a reused `next` object → win check `level.goals.some((g) => dist < WIN_R=0.3)` (custom maps may have several goals).
- Elapsed time: `performance.now() - startedAt - pausedAccumMs`; HUD refresh is a separate 250ms `setInterval`.
- Rendering per frame (`MazeCanvas.renderFrame`): measure/DPR → clear → camera clamp + exponential ease → `computeVisibility` → **one world-space `c.save(); c.translate(ox,oy)`** wrapping fan fill, walls, goals, labels and player → clip to the fan polygon (`clipFan`) and fill a radial gradient → stroke **the visible portion of each wall edge** (see `lit` below) as **thick, round-capped/joined solid walls** whose brightness comes from a radial gradient (`wallGradient`, also hoisted to `wallGrad` and reused for labels) — continuous falloff, **no brightness tiers** → one diamond per `level.goals` entry + player dot → map text labels (`drawLabels`) drawn under a **second** `clipFan` (`src/render/labels.ts`).
- Wall geometry/thickness is shared by both canvases via `src/render/walls.ts`: `wallLineWidth(tile) = max(1.25px, tile*WALL_THICKNESS)`, `addLevelWalls` (all walls, for the review map) and `addLitWalls` (`lit` = each edge's visible portions only). `MazeCanvas` paints a per-player gradient; `ReviewMap` paints a uniform stroke. Rounded corners/ends fall out of `lineCap/lineJoin = 'round'`.

Level creation: `GameScreen.resetLevel()` calls `buildLevel()` — `props.map ? mapToLevel(props.map, locale) : generateMaze(props.mazeSize, props.mazeSize, props.seed)` — positions `pos` at `level.start`, and zeroes velocity/traveled. `watch(() => props.seed, resetLevel)` makes `App` the owner of generated level identity; a second `watch(() => props.map, resetLevel)` does the same for custom maps. `resetLevel` is idempotent.

Custom maps: `src/map/format.ts` defines the v1 JSON shape (`manifest` = identity + feature tags, `meta` = size/name/description, `data` = start/goals/walls/labels), `parseMapFile` (tolerant: invalid items dropped / clamped, only a broken section yields `map === null`) and `serializeMap` (stable, sorted). `mapToLevel` always re-adds the outer ring. The editor works on an `EditorDraft` (`src/map/draft.ts`, fixed-length `Uint8Array` walls) and `mapFromDraft` normalizes it back into a file. Maps persist in IndexedDB via `src/map/store.ts` (keyPath `manifest.id`), and compatibility of `manifest.tags` is checked by `checkTags` against the `MAIN_TAGS` feature table — problems are warned about but ignorable.

## Key Directories

| Path | Purpose |
|---|---|
| `src/game/` | Pure, framework-free game logic: `maze.ts` (generation + wall accessors + BFS), `visibility.ts` (raycast/fan), `collision.ts` (movement resolution), `settings.ts` (global options + localStorage), `gen.ts` (按局的生成参数：尺寸/视野预设 + 自定义边界 + `parseSeed`), `rng.ts` (seeded PRNG), `trail.ts` (轨迹采样：`createTrail` 记录 `points`+`times`，位移 ≥ `TRAIL_STEP` 才记录；`sampleTrail` 按时间插值) |
|`src/components/`|Presentational Vue SFCs: canvas renderer, HUD bar, overlay dialog, review map, editor canvas, localizable-text editor|
|`src/render/`|Framework-free Canvas 2D helpers shared by the canvases: `walls.ts` (solid-wall geometry, thickness, continuous brightness gradient), `labels.ts` (`drawLabels`, font stack / size presets), `palette.ts` (`CanvasPalette`, `CANVAS_PALETTES` per `ThemeId`, `inkRgba`)|
|`src/map/`|Custom-map subsystem (pure, framework-free except `store.ts`): `format.ts` (v1 file shape, parse/serialize, presets, `mapToLevel`, `isPlayable`), `tags.ts`/`features.ts` (tag grammar + `MAIN_TAGS` + `checkTags`), `draft.ts` (editor draft, resize/normalize), `edit.ts` (snapping + wall/goal edits), `store.ts` (IndexedDB)|
| `src/i18n/` | Localization: `messages.ts` (pure `MESSAGES` catalogue + `translate`, `LOCALE_OPTIONS`/`LOCALE_TAGS`, `MessageKey`) and `useI18n.ts` (Vue-only `provideLocale`/`useT`/`useLocale`) |
|`src/screens/`|Screen-level SFCs: first-run wizard, menu, start-game config, settings editor, map list, editor, game loop owner|
| `src/styles/` | `base.css`: CSS variables, dark `:root` + `.theme-light` palette, `.interactive` inverted hover, transitions |
| `src/types.ts` | All shared types (no runtime code): `Level` = `WallGrid` + `seed`/`start`/`goals`/`labels` |
| `tests/` | Vitest suites + `helpers.ts` fixtures; mirrors `src/game/` and `src/map/` |
| `dist/` | Build output (gitignored; does exist on disk) |

## Development Commands

Run from the repo root (Windows Git-Bash path: `/c/Users/Kuriyona/Documents/Development/Projects/@Kuriyona/PuzzleC`).

```bash
pnpm install
pnpm dev              # vite dev server, http://127.0.0.1:5173 (no --host by default)
pnpm run build        # vue-tsc --noEmit && vite build  -> dist/
pnpm run preview      # serve dist/, http://127.0.0.1:4173
pnpm run typecheck    # vue-tsc --noEmit
pnpm test             # vitest run (one-shot)
pnpm test:watch       # vitest (watch)
pnpm exec vitest run tests/maze.test.ts                 # single file
pnpm exec vitest run -t "同种子结果确定"                  # single test by name substring
```

There is **no** `lint` or `format` script (see Runtime/Tooling Preferences). `typecheck` is the de facto gate and is already wired into `build`.

## Code Conventions & Common Patterns

**Coordinate system — single source of truth.** Get this wrong and everything breaks.

- Continuous coordinates are in **cell units**: cell `(cx,cy)` has its center at continuous `(cx,cy)`; world pixels = `(c + 0.5) * tile`. World spans `[0, cols*tile] × [0, rows*tile]`.
- Player cell = `(Math.round(pos.x), Math.round(pos.y))`.
- Wall segment line index ↔ coordinate: `line = k - 0.5`. Vertical segment `v(k,y)` occupies `x = k-0.5, y ∈ [y-0.5, y+0.5]`; horizontal `h(k,x)` occupies `y = k-0.5, x ∈ [x-0.5, x+0.5]`.
- Array indexing contract: `vWalls[y*(cols+1) + k]` with length `rows*(cols+1)`; `hWalls[k*cols + x]` with length `(rows+1)*cols`. `1 = wall`, `0 = open`.
- Accessor argument order is **line index first**: `hasVWall(lineX, row)`, `hasHWall(lineY, col)`; both accept any `WallGrid` (a `Level` is one). Out-of-range returns `true` (outer ring is a wall).
- Continuous→pixel conversion happens only in the render layer: `MazeCanvas.vue`, `ReviewMap.vue` and their shared helper `src/render/walls.ts`. `src/game/visibility.ts` and `collision.ts` must never reference `tile` or pixels.

**Module patterns.**

- `src/game/*` is pure and side-effect free (only `settings.ts` touches `localStorage`, guarded and try/caught, never throws). `src/map/*` follows the same rule except `store.ts`, the only module touching `indexedDB` (also fully guarded, never throws). New logic belongs here, not in SFCs.
- No-allocation hot paths: functions write into caller-provided `out` params and reuse module-level buffers. `computeVisibility(level, pos, radius, out: Visibility)` resets `out.fan/lit/angles.length = 0` and pushes — keep this shape; do not allocate per frame.
- Kept-out-of-Vue-reactivity state is deliberate: `pos`, `vel`, `next`, `pressed` in `GameScreen.vue` and `ctx`/`cam`/`vis` in `MazeCanvas.vue` are plain module-scope values. Only template-consumed values are `ref`/`computed`. Do not convert per-frame data to refs, and do not reintroduce a "grid pos vs render pos" dual track.
- `verbatimModuleSyntax` is on: type-only imports **must** use `import type { Level, Vec2 } from '../types'`.
- Options tables use `as const satisfies readonly {...}[]` (see `SIZE_OPTIONS`, `RADIUS_OPTIONS`, `TEXT_SIZE_OPTIONS`, `TEXT_ALIGN_OPTIONS`); display text is never stored there — each entry carries a `labelKey: MessageKey` resolved through `t()` at render time.
- Types are named and imported from their owning module; do not publish contracts as `ReturnType<typeof fn>`.

**Vue SFC conventions.** `<script setup lang="ts">`; props via `defineProps<{...}>()`, emits via `defineEmits<{name:[args]}>()`; two-way binding through `defineModel<Settings>({ required: true })` and whole-object replacement (`{ ...model.value, ...patch }`). `defineExpose({ renderFrame })` is the imperative canvas API. Every mutable listener/timer is torn down in `onUnmounted`.

**Style conventions.** Code comments and the `zh-Hans` source strings are Chinese (shared vocabulary: 格, 墙段, 连续坐标, 贴墙滑动); every user-facing string goes through the i18n catalogue (see Localization below) — no literal UI text in SFCs. Global CSS variables live in `src/styles/base.css` (`--bg`, `--fg`, `--fg-dim`, `--fg-faint`, `--line`, `--panel`, `--inv-bg`, `--inv-fg`, `--scrim`, `--ease`, `--dur`, `--font-ui`, `--font-mono`); every clickable element carries the `interactive` class (inverted hover), `.is-active` means inverted, `.rise` is the entrance animation, and `.no-anim` on the App root disables all animation when `settings.animations === false`. Component styles are `scoped`. `MenuScreen` is a full-viewport panel that **follows the UI theme**: `.menu` is `position: fixed; inset: 0`, takes its surface/ink from the global variables (no local palette), and lays out title top-left / buttons bottom-left with `justify-content: space-between`. Its `.item` only nulls the border (`border-color: transparent`) and bleeds left (`margin-left: -16px`) so button text aligns with the title; the shared `.interactive` hover inversion re-colors itself, and the decorative backdrop uses theme-neutral values (`var(--line)` dots, mid-grey orb) so it works on both surfaces. The menu footer carries only the animation state (`menu.anim`) — the tutorial line moved into the first-run wizard (`intro.controls`) and the maze size/vision radius are no longer global settings. Narrow viewports (`@media (max-width: 640px)`) collapse the menu to a centred column (title + buttons centred) and reveal the bordered `menu.portrait` hint line under the title (`建议横屏或将窗口拉宽游玩`); `MenuScreen` holds no other state.

**Two independent theme axes** — do not collapse them back into one:

- `Settings.uiTheme` (`light | dark | system`, default **`light`**) resolves through `prefers-color-scheme` into a `ThemeId`; `App.vue` subscribes via `subscribeSystemScheme` (unsubscribed in `onUnmounted`) and the result only toggles `.theme-light` on the App root — every DOM screen follows. `:root` is the dark palette, so dark needs no class.
- `Settings.mazeTheme` (`dark | light | ui`, default `ui`) resolves to a `ThemeId` — `App.vue` passes it as `GameScreen`'s (and `EditorScreen`'s) `mazeTheme` prop, `GameScreen` forwards it as the `theme` prop of `MazeCanvas`/`ReviewMap`, and those (plus `EditorCanvas`) read `CANVAS_PALETTES` (`src/render/palette.ts`). `深色` = 迷宫纯黑底、墙体/光点白色. The canvases' CSS fallback is bound inline (`:style="{ background: paper }"`) so it follows the **maze** theme and never `var(--bg)` (the UI theme) — otherwise UI-light + maze-dark flashes white before the first frame.

Light is a straight channel inversion (paper black↔white, ink white↔black, **identical alpha ramps**), so the near-player/edge relation flips with it.

First start: while `loadIntroSeen()` is false, `App.vue` renders `IntroScreen` **instead of** the menu — a six-step wizard (语言 → 欢迎 → 游戏介绍 → 界面主题 → 迷宫主题 → 一切就绪) where every step carries a title plus a 下一步 button and the last one's button is 完成. It edits `settings` in place (language + both theme axes), so the theme steps preview on the wizard itself and the choice is persisted by the usual `watch(settings, deep)`; only the final button marks `INTRO_KEY` (`puzzlec.intro.v1`, deliberately **outside** the settings blob so 恢复默认 does not re-trigger it) and drops back to the menu (`finishIntro()` only flips `introSeen`; the wizard never mints a level), so reloading mid-wizard starts it over and 开始游戏 stays the player's own move. The step list/order lives in `IntroScreen.vue` (`STEPS` + `TITLE_KEYS`), each step focuses its own 下一步 button (`Enter` continues) via `@after-enter` (a `watch(stepIndex)` would fire before the `mode="out-in"` swap drops the old button and lose focus), and the step body is a `v-if`/`v-else-if` chain switched by `<Transition name="screen" mode="out-in" :key="step">`. `OverlayPanel` actions are `{ label, active?, primary?, onClick }`: `primary` = auto-focus (modal focus lands in the dialog), `active` = 反色实心高亮.

Gotcha: `body { color: var(--fg); background: var(--bg) }` only ever sees the `:root` values, so descendants that merely inherit (e.g. the overlay panel's text) are re-coloured by `.app`'s own `background`/`color` declaration — re-declaring the variables alone is not enough. Never hardcode `#000`/`#fff`/`rgba(255,255,255,…)` in a screen or canvas: use the variables or `inkRgba`.

**Localization** — four locales (`zh-Hans | zh-Hant | en | ja`), orthogonal to the theme axes:

- `Settings.locale` (default `zh-Hans`) is the single source. `App.vue` derives `locale = computed(() => settings.value.locale)`, calls `provideLocale(locale)`, and mirrors it to `document.documentElement.lang` via `LOCALE_TAGS`.
- `src/i18n/messages.ts` is pure and framework-free. `MESSAGES` is typed `Record<LocaleId, Record<MessageKey, string>>` where `MessageKey` is the key union of the `zh-Hans` object — so a missing or stray key in any other locale is a **compile error**. `translate(locale, key, params)` fills `{name}` placeholders, falls back to `zh-Hans` for an unknown locale, and returns the key itself for an unknown key (never throws). `LOCALE_OPTIONS` holds native-language labels (identical strings in every locale); `isLocaleId` validates persisted values.
- Components call `const t = useT()` (`src/i18n/useI18n.ts`), which injects the provided locale ref and returns a plain function; reading `locale.value` inside a template records it as a render dependency, so switching language re-renders everything with no extra plumbing (`tests/…` verified this over provide/inject). Non-template code that needs the raw language (e.g. `EditorScreen`/`MapListScreen` formatting timestamps) uses `useLocale()`, which returns the same injected ref. Because `inject` only walks *parent* provides, the provider (`App.vue`) cannot inject from itself — it builds `t` directly from `translate(locale.value, …)`.
- Option tables (`UI_THEME_OPTIONS`, `MAZE_THEME_OPTIONS`, `SIZE_OPTIONS`, `RADIUS_OPTIONS`, `TEXT_SIZE_OPTIONS`, `TEXT_ALIGN_OPTIONS`) carry `labelKey: MessageKey` instead of display text; SFCs render `t(opt.labelKey)`. Numeric `value`/`cells`/`scale` stay literal. The `SettingsScreen` language row patches `Settings.locale` exactly like the other rows; `SIZE_OPTIONS`/`RADIUS_OPTIONS` live in `src/game/gen.ts` (per-run generation presets, not settings), the theme tables in `src/game/settings.ts`.
- Rules: no literal UI text in SFCs (add keys to the catalogue); 恢复默认 resets the language too (it is part of the settings blob). One deliberate exception: the welcome step's author's note in `IntroScreen.vue` is hardcoded at the product owner's request and stays out of the catalogue (marked by a comment in place).

**Error handling.** Gameplay code does not throw; invalid input is clamped or ignored (out-of-range walls, `Math.min/Math.max` clamps, `loadSettings` validating every field and falling back to fresh defaults).

## Important Files

| File | Why it matters |
|---|---|
| `src/main.ts` | Entry point; mounts `App` into `#app`, imports global CSS |
| `src/App.vue` | Screen state machine, settings watch/persist, `gen`/`run` (按局生成参数与解析结果) + seed + level index + `playingMap`/`editingMapId` ownership, **theme resolution**（uiTheme/mazeTheme → `ThemeId`，订阅系统配色）与**语言 provide**（`settings.locale` → `document.documentElement.lang`）, first-run wizard gating (`introSeen`: `IntroScreen` 代替菜单) |
|`src/types.ts`|`WallGrid`（墙格）+ `Level` = `WallGrid` + `seed`/`start`/`goals[]`/`labels[]`; all cross-module contracts|
|`src/game/maze.ts`|`generateMaze` (iterative backtracker, perfect maze; returns 1 goal + no labels), `hasVWall`/`hasHWall` (take any `WallGrid`), `bfs`, `farthestCell`; 尺寸预设表不在这里（见 `gen.ts`）|
|`src/game/gen.ts`|按局的生成参数：`SIZE_OPTIONS`/`RADIUS_OPTIONS` 预设、`MIN/MAX_MAZE_SIZE`/`MIN/MAX_RADIUS` 边界、`DEFAULT_GEN_PARAMS`、`clampMazeSize`/`clampRadius`、`mazeSizeOf`/`radiusOf`、`parseSeed`（空白 → null；纯数字按数值、其它文本 FNV-1a 哈希）|
| `src/game/visibility.ts` | `castRay`, `createVisibility`/`computeVisibility`, `isVisible`; `lit` = 每条边的**可见部分**（`pushVisibleSpans` 采样 + 二分细化），固定顺序被测试断言 |
| `src/game/collision.ts` | `PLAYER_R = 0.18`, `moveWithCollision` (substep ≤ `radius/2`, resolve X then Y) |
|`src/game/settings.ts`|`SETTINGS_KEY`/`INTRO_KEY`, `DEFAULT_SETTINGS`（仅 animations / uiTheme / mazeTheme / locale）, `UI_THEME_OPTIONS`/`MAZE_THEME_OPTIONS`（`labelKey` 而非文案）, `load/saveSettings`（逐字段校验，含 `locale` 的 `isLocaleId`；忽略旧版残留的 size/radius）, `loadIntroSeen`/`markIntroSeen`, `prefersDarkScheme`/`subscribeSystemScheme`|
| `src/i18n/messages.ts` | 四语言 `MESSAGES`（`zh-Hans` 定义 `MessageKey`，缺键/多键编译报错）、`translate`、`LOCALE_OPTIONS`/`LOCALE_TAGS`/`isLocaleId` |
| `src/i18n/useI18n.ts` | `LOCALE_KEY`、`provideLocale(locale)`、`useT()`（inject → 模板里调用即响应式；provider 自身不能 inject） |
| `src/game/trail.ts` | `TRAIL_STEP`, `createTrail` → `{ points, times, reset(x,y,t), push(x,y,t) }` (flat `[x,y,...]` + parallel `times`, reused buffers), `sampleTrail(points,times,t,out)` → 二分+线性插值 |
| `src/components/MazeCanvas.vue` | DPR/camera/pixel math + canvas paint order; walls via `src/render/walls.ts`; `theme` prop → `CANVAS_PALETTES` |
| `src/components/ReviewMap.vue` | Full-map overview canvas: all walls (shared geometry) at uniform brightness, full trail (dim) + traversed portion (bright) + player dot; `renderFrame(ms)` replayed imperatively from the game loop; `theme` prop → `CANVAS_PALETTES` |
| `src/render/walls.ts` | `WALL_THICKNESS`, `wallLineWidth`, `wallGradient(ctx,x,y,r,ink,peak?)` (32-stop continuous falloff; `ink` = 亮度色 rgb 文本，随主题反色), `addLevelWalls`, `addLitWalls` — shared by both canvases |
|`src/render/palette.ts`|`CANVAS_PALETTES` / `CanvasPalette`（`paper` 底色 + `ink` 亮度色）+ `inkRgba`；两个 canvas 都按它取色|
|`src/render/labels.ts`|`drawLabels` + `LABEL_FONT_STACK`：按 `size`/`align` 预设设置字体并绘制关卡文字标签|
|`src/map/format.ts`|v1 地图格式：`MapFile`/`MapData`/`LocalizedText`、`parseMapFile`（容忍：丢弃 / clamp，仅整段非法才 `null`）、`serializeMap`（稳定 + 排序）、`createMapFile`、`computeManifestTags`、`mapToLevel`、`isPlayable`、`mapByteSize`（导出的 UTF-8 字节数，资源管理器的占用估算）、预设表|
|`src/map/tags.ts`|`parseTag` / `formatVersion` / `compareVersion`：`路径[:主.次]` 语法（非法返回 null）|
|`src/map/features.ts`|`MAIN_TAGS` 特性表 + `findFeature` + `checkTags`（unknownTag / majorVersion = 严重，higherVersion = 提示）|
|`src/map/draft.ts`|`EditorDraft`（定长 `Uint8Array` 墙）、`createDraft`/`draftFromMap`/`mapFromDraft`（归一化 i18n + 重算 tags）、`countOutOfRange`/`resizeDraft`、`newId`|
|`src/map/edit.ts`|`snapWall`/`snapCell`/`snapText`、`isBorderWall`（外圈不可编辑）、`hasWall`/`setWall`/`toggleGoal`|
|`src/map/store.ts`|IndexedDB（`puzzlec`/`maps`，keyPath `manifest.id`）`listMaps`/`loadMap`/`saveMap`/`deleteMap` + `estimateStorage`（`navigator.storage.estimate()`，不可用或失败返回 `null`）；全部 try/catch，永不抛错|
|`src/components/EditorCanvas.vue`|编辑器画布：网格 / 墙 / 起点 / 目标 / 标签绘制 + 指针交互（吸附放置、拖动、悬停预览、标签命中测试）|
|`src/components/LocalizedTextEditor.vue`|`v-model<LocalizedText>`：默认文本行 + 可选四语言翻译行（整对象替换写回）|
|`src/screens/EditorScreen.vue`|编辑器状态机：`draft`（普通对象）+ `rev`/`dirty`、工具、尺寸确认、标签检查器、保存 / 放弃确认|
|`src/screens/StartScreen.vue`|开始游戏界面：`v-model<GenParams>`；模式（当前版本只有随机迷宫，摆成单选样式）、尺寸/视野的预设 + 自定义数值（`@change` clamp 并回写输入框）、种子输入（留空随机）、底部实时摘要与「开始随机游戏」；`emit('start')` 由 App 解析参数开局；面板高于视口时自身滚动（`max-height: calc(100vh - 48px)`，`.app` 的 min-height 让百分比 max-height 解析不出来）|
|`src/screens/IntroScreen.vue`|首次启动引导：`STEPS`（language / welcome / guide / uiTheme / mazeTheme / ready）+ `TITLE_KEYS`，每步标题 + 下一步（末步为完成）；直接改写 `settings`（语言 + 两个主题轴），`emit('finish')` 由 App 记档并回到主界面；欢迎页作者手记按需求硬编码|
|`src/screens/MapListScreen.vue`|已存地图列表：游玩 / 编辑 / 删除、JSON 导入导出、`checkTags` 兼容性警告（可忽略）；资源管理器视图：`estimateStorage` 顶部用量条 + `mapByteSize` 逐图占用 + 全选 / 批量删除|
| `src/screens/GameScreen.vue` | Only rAF loop, input handling, physics, trail recording, playback, win/pause/review transitions; level source = `props.map ? mapToLevel : generateMaze`; win = `goals.some(within WIN_R)` |
| `index.html` | `#app` mount point + module script `/src/main.ts` |
| `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` | Strict-TS constraints, build target, test include pattern |

Critical paint-order gotcha: in `MazeCanvas.renderFrame` everything (fan fill, walls, goal, player) is drawn inside **one** `c.save(); c.translate(ox, oy)` world-space block, closed by the final `c.restore()`. Do **not** re-apply `ox/oy` inside it, and never drop that outer transform: a light point drawn without the camera offset stays at raw world pixels while the camera scrolls, so it appears to drift away from the (correctly centred) lit area. The fan **clip** keeps its own nested `save()/restore()` (`MazeCanvas.vue:90-102`) — wall strokes sit exactly on the clip boundary, so leaving the clip active clips half of every wall line.

Visibility gotchas: `prev` in the angle dedup must be initialized to `-Infinity` (not `Infinity`); `lit` holds the **visible portion** of each wall edge (a fully visible edge stays one entry; a partly occluded one is split) in a fixed order — vertical by `k` then `y`, then horizontal by `k` then `x`, spans in ascending position — and is asserted by tests; `castRay` must not apply "out-of-range = wall" lookups, since it relies on outer-ring segments existing and being `1`. Per-edge visibility is *not* decided by a single ray to the nearest point: `pushVisibleSpans` samples the edge (`SPAN_SAMPLES`), bisects each visible/occluded boundary (`SPAN_REFINE`) and drops degenerate slivers (`SPAN_MIN_CELLS`), so a wall poking past a corner is not drawn into shadow and a sliver peeking around one still is.

## Runtime/Tooling Preferences

- **Package manager: pnpm** (evidenced by `pnpm-lock.yaml`, lockfile v9). Do not add npm/yarn lockfiles.
- Runtime: modern Node (ES2022 target, `"type": "module"`; ESM only, no CJS). No `.nvmrc`/`.npmrc`/engines pin — nothing enforces a Node version.
- Versions are new majors: **Vite 8, Vitest 5, vue-tsc 3, TypeScript 5.9, Vue 3.5**. Do not assume Vite 5/6 or Vitest ≤4 docs apply.
- `tsconfig.json` (single flat config, no path aliases, `include: src/**/*.ts, src/**/*.vue, tests/**/*.ts, vite.config.ts, vitest.config.ts`): `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`, `verbatimModuleSyntax`, `noEmit`, `jsx: preserve`, `moduleResolution: bundler`, `types: ["vite/client"]`. `noUncheckedIndexedAccess` is **off**.
  - Consequence: unused locals/params fail `typecheck` and therefore `build`. Deleting a symbol's last caller requires deleting the import too.
- `vite.config.ts`: `base: './'` (relative asset URLs — verify `dist/index.html` uses `./assets/...`), `vue()` plugin only, `build.target: es2022`.
- Import with relative paths (`../types`, `../game/maze`) — there is no alias setup.
- **Absent tooling (verify before assuming it exists):** no ESLint, no Prettier, no Biome, no `.editorconfig`, no CI (`.github/` does not exist), no active git hooks (`.git/hooks` holds only the default `.sample` files), no Makefile/scripts dir, no README/LICENSE. A git repo **does** exist (`.git/`, branch `main`, remote `origin` = `git@github.com:Kuriyona/PuzzleC.git`), so `git` commands work in this root.
- Match existing style manually (2-space indent, single quotes, no semicolons, ~100 col width, Chinese comments).

## Testing & QA

- Framework: **Vitest 5**, `vitest.config.ts` → `{ test: { environment: 'node', include: ['tests/**/*.test.ts'] } }`. `globals` is **off**: every file imports `{ describe, expect, it } from 'vitest'` explicitly. No setup files, no coverage config, no DOM environment.
- Baseline: **12 files / 112 passing cases in ~0.8s** (`tests/maze.test.ts` 10, `tests/visibility.test.ts` 11, `tests/collision.test.ts` 6, `tests/trail.test.ts` 11, `tests/walls.test.ts` 7, `tests/gen.test.ts` 6, `tests/i18n.test.ts` 9, `tests/map-tags.test.ts` 12, `tests/map-format.test.ts` 19, `tests/map-draft.test.ts` 7, `tests/map-edit.test.ts` 11, `tests/map-store.test.ts` 3). Keep it green; `pnpm test` runs one-shot (CI-style).
- Scope: only the pure modules `src/game/{maze,visibility,collision,trail,gen}.ts`, `src/render/walls.ts`, `src/i18n/messages.ts`, `src/map/{tags,features,format,draft,edit,store}.ts` (+ `src/types.ts`) are covered. Vue components, `settings.ts` persistence, `src/render/palette.ts`, `src/render/labels.ts`, `src/i18n/useI18n.ts`, and `rng.ts` have **no** tests — add them deliberately if behavior changes there.
  - `tests/map-store.test.ts` needs IndexedDB in the node environment: it starts with `import 'fake-indexeddb/auto'` (the only `fake-indexeddb` consumer, a devDependency). If that dependency ever breaks, drop the file rather than weakening `store.ts`.
  - `tests/i18n.test.ts` pins: identical key sets across the four locales, non-empty values, identical `{placeholder}` sets per key, `LOCALE_TAGS`/`LOCALE_OPTIONS` ↔ `LocaleId` parity, placeholder substitution, unknown-locale/unknown-key fallbacks, and that every option table's `labelKey` (including `TEXT_SIZE_OPTIONS`/`TEXT_ALIGN_OPTIONS` from `src/map/format.ts`) resolves in every locale.
- `tests/helpers.ts` is a plain module (not matched as a test). It exports `LevelSpec`, `makeLevel(spec): Level`, and `visibleMask(level, pos, radius): string[]`.
  - `makeLevel({ cols, rows, v: [[lineX, row], ...], h: [[lineY, col], ...], start?, goals? })` builds levels with the outer ring always walled and the interior open except for explicitly listed segments — so visibility/collision can be asserted against hand-computed geometry, independent of `generateMaze`. `goals` defaults to a single goal on the start cell; `labels` is always `[]`.
  - `visibleMask` renders an `isVisible` grid as `'#'`/`'.'` strings for readable assertions.
- Conventions: relative imports (`../src/...`), Chinese `it(...)` descriptions, fixed seeds for determinism, exact array assertions over typed arrays (`expect(Array.from(level.hWalls)).toEqual(...)`), `toBeCloseTo(x, 9)` for collision coordinates and `toBeCloseTo(x, 12)` for ray distances.
- Key pinned behavior (do not re-pin incidental values, but do keep these contracts): perfect-maze invariant `open interior segments === n*n - 1`; `start === {x:0,y:0}` and `goals[0]` is the BFS-farthest cell with ties broken by smallest index; hand-computed mask `['###', '#..', '#..']`; the exact 1×1 `vis.lit` array in fixed order; per-portion wall spans — a fully visible edge stays one entry, while a partly occluded edge yields only its visible sub-interval(s) with hand-computed occlusion boundaries (5/6, `sqrt(0.24)`); collision stop at `0.32` for wall line `x = 0.5` with `PLAYER_R = 0.18`; diagonal wall-slide; no tunneling on large deltas.
- Before yielding: `pnpm run typecheck` (exit 0) and `pnpm test` (all green). For build/preview changes, also `pnpm run build` and check `dist/index.html` references `./assets/index-*.js` + `./assets/index-*.css`.
