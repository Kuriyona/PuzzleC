# Repository Guidelines

Repo root: `@Kuriyona/PuzzleC` (package name `puzzlec`, UI title PuzzleC).

## Project Overview

Single-package Vue 3 + Vite SPA: a keyboard-driven "light point" maze game. The player moves freely through a
procedurally generated maze; a geometric visibility solver decides what is lit, and everything outside the lit
region is pure black with radial brightness falloff.

Hard rules come from `task.md` (the only product doc, Chinese, 7 lines):

- Tooling is mandated: pnpm + Vite + Vue ("使用 pnpm Vite Vue").
- Start menu + in-game settings screen, with animation.
- Visual style: minimal, pure black/white/gray, heavy color inversion as hover.
- Algorithmic random maze generation; player is a light point moved by keyboard to a goal.
- Visible range computed from player light point vs. maze walls; outside it is pure black.
- Brightness inside the visible range decays with distance (brightest at player, very dim at the far edge).

`task.md` states no acceptance criteria, versions, or numeric parameters; movement feel, radius tiers and
HUD metrics were chosen during implementation (see the approved plan, not in-repo).

## Architecture & Data Flow

```
main.ts ── createApp(App).mount('#app')                     (imports styles/base.css)
App.vue  [screen, settings, seed, levelIndex, uiTheme, mazeTheme, locale]  watch(settings, deep) -> saveSettings()
  ├─ MenuScreen      props{settings}             emits start, settings
  ├─ SettingsScreen  v-model<Settings>           emits back
  ├─ OverlayPanel    首次开始游戏的主题引导（plain，选择游玩模式）
  └─ GameScreen      props{settings,seed,levelIndex,mazeTheme}  emits next, exit
        │   owns: single rAF loop, 250ms HUD timer, window key/listeners, physics, trail recording
        ├─ HudBar       props{levelIndex,sizeHint,radius,distance,elapsedMs,seed} emits pause, restart
        ├─ MazeCanvas   props{level,radius,animations,theme}  exposes renderFrame(now,dt,pos)
        ├─ OverlayPanel props{title,lines,actions}      (paused / won overlays)
        └─ ReviewMap    props{level,points,times,theme}  (won → 全图回顾：按时间回放)

src/render/walls.ts —— MazeCanvas 与 ReviewMap 共用的墙体绘制（实体墙几何 + 连续亮度渐变）
src/render/palette.ts —— Canvas 配色（CANVAS_PALETTES：深色 = 黑底白光 / 浅色 = 白底黑墨）
src/i18n/messages.ts —— 四种界面语言的完整消息表（zh-Hans 为键集合真源）+ translate()
src/i18n/useI18n.ts —— provideLocale() / useT()：注入语言 ref，模板里调用即自动响应式
```

- `App.vue` is the only screen state machine; `screen` toggles `menu | settings | game`. `startGame()`/`nextLevel()` mint a new `randomSeed()`; `levelIndex` increments on next level. It also resolves both theme axes and puts the UI one on its root element (`'theme-light': uiTheme === 'light'`), passing the resolved maze theme down to `GameScreen`; see the theme section below. It is likewise the single owner of the UI language: it provides `settings.locale` as a ref and syncs `document.documentElement.lang`; see the localization section below.
- `GameStatus` = `playing | paused | won | review`; `review` is a GameScreen-internal state (not an `App` screen). Reached only from the win overlay ("查看回顾"); it keeps `level`/`pos`/trail alive and replays the recorded timeline on `ReviewMap` (play/pause, 0.5/1/2/4× speed, draggable seek bar). Playback time `reviewPlayMs` is a plain value advanced in `frame()` (ms * speed, clamped to `reviewDuration`); only the clock/seek-bar read `reviewMs` (ref), so no per-frame reactive state. 下一关/重玩本关/返回菜单 exit it.
- Exactly **one** `requestAnimationFrame` loop exists, owned by `GameScreen.frame()` (`src/screens/GameScreen.vue:142`). It self-reschedules, computes `dt` (first frame 16ms, capped 50ms), advances physics only when `status === 'playing'`, and calls `canvasRef.value?.renderFrame(now, dt, pos)` unless paused. `MazeCanvas` never owns a loop — it draws on demand.
- Physics per frame: read `pressed` set → camera-relative input axes (diagonal scaled by `Math.SQRT1_2`) → velocity exponential approach (`SPEED=3.2` cells/s, `ACCEL_TAU=0.06s`) → `moveWithCollision` into a reused `next` object → win check within `WIN_R=0.3`.
- Elapsed time: `performance.now() - startedAt - pausedAccumMs`; HUD refresh is a separate 250ms `setInterval`.
- Rendering per frame (`MazeCanvas.renderFrame`): measure/DPR → clear → camera clamp + exponential ease → `computeVisibility` → **one world-space `c.save(); c.translate(ox,oy)`** wrapping fan fill, walls, goal and player → clip to the fan polygon and fill a radial gradient → stroke **the visible portion of each wall edge** (see `lit` below) as **thick, round-capped/joined solid walls** whose brightness comes from a radial gradient (`wallGradient`) — continuous falloff, **no brightness tiers** → goal diamond + player dot.
- Wall geometry/thickness is shared by both canvases via `src/render/walls.ts`: `wallLineWidth(tile) = max(1.25px, tile*WALL_THICKNESS)`, `addLevelWalls` (all walls, for the review map) and `addLitWalls` (`lit` = each edge's visible portions only). `MazeCanvas` paints a per-player gradient; `ReviewMap` paints a uniform stroke. Rounded corners/ends fall out of `lineCap/lineJoin = 'round'`.

Level creation: `GameScreen.resetLevel()` calls `generateMaze(cells, cells, props.seed)`, positions `pos` at `level.start`, and zeroes velocity/traveled. `watch(() => props.seed, resetLevel)` makes `App` the owner of level identity.

## Key Directories

| Path | Purpose |
|---|---|
| `src/game/` | Pure, framework-free game logic: `maze.ts` (generation + wall accessors + BFS), `visibility.ts` (raycast/fan), `collision.ts` (movement resolution), `settings.ts` (options + localStorage), `rng.ts` (seeded PRNG), `trail.ts` (轨迹采样：`createTrail` 记录 `points`+`times`，位移 ≥ `TRAIL_STEP` 才记录；`sampleTrail` 按时间插值) |
| `src/components/` | Presentational Vue SFCs: canvas renderer, HUD bar, overlay dialog, review map |
| `src/render/` | Framework-free Canvas 2D helpers shared by the canvases: `walls.ts` (solid-wall geometry, thickness, continuous brightness gradient), `palette.ts` (`CanvasPalette`, `CANVAS_PALETTES` per `ThemeId`, `inkRgba`) |
| `src/i18n/` | Localization: `messages.ts` (pure `MESSAGES` catalogue + `translate`, `LOCALE_OPTIONS`/`LOCALE_TAGS`, `MessageKey`) and `useI18n.ts` (Vue-only `provideLocale`/`useT`) |
| `src/screens/` | Screen-level SFCs: menu, settings editor, game loop owner |
| `src/styles/` | `base.css`: CSS variables, dark `:root` + `.theme-light` palette, `.interactive` inverted hover, transitions |
| `src/types.ts` | All shared types (no runtime code) |
| `tests/` | Vitest suites + `helpers.ts` fixtures; mirrors `src/game/` |
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
- Accessor argument order is **line index first**: `hasVWall(lineX, row)`, `hasHWall(lineY, col)`. Out-of-range returns `true` (outer ring is a wall).
- Continuous→pixel conversion happens only in the render layer: `MazeCanvas.vue`, `ReviewMap.vue` and their shared helper `src/render/walls.ts`. `src/game/visibility.ts` and `collision.ts` must never reference `tile` or pixels.

**Module patterns.**

- `src/game/*` is pure and side-effect free (only `settings.ts` touches `localStorage`, guarded and try/caught, never throws). New logic belongs here, not in SFCs.
- No-allocation hot paths: functions write into caller-provided `out` params and reuse module-level buffers. `computeVisibility(level, pos, radius, out: Visibility)` resets `out.fan/lit/angles.length = 0` and pushes — keep this shape; do not allocate per frame.
- Kept-out-of-Vue-reactivity state is deliberate: `pos`, `vel`, `next`, `pressed` in `GameScreen.vue` and `ctx`/`cam`/`vis` in `MazeCanvas.vue` are plain module-scope values. Only template-consumed values are `ref`/`computed`. Do not convert per-frame data to refs, and do not reintroduce a "grid pos vs render pos" dual track.
- `verbatimModuleSyntax` is on: type-only imports **must** use `import type { Level, Vec2 } from '../types'`.
- Options tables use `as const satisfies readonly {...}[]` (see `SIZE_OPTIONS`, `RADIUS_OPTIONS`); display text is never stored there — each entry carries a `labelKey: MessageKey` resolved through `t()` at render time.
- Types are named and imported from their owning module; do not publish contracts as `ReturnType<typeof fn>`.

**Vue SFC conventions.** `<script setup lang="ts">`; props via `defineProps<{...}>()`, emits via `defineEmits<{name:[args]}>()`; two-way binding through `defineModel<Settings>({ required: true })` and whole-object replacement (`{ ...model.value, ...patch }`). `defineExpose({ renderFrame })` is the imperative canvas API. Every mutable listener/timer is torn down in `onUnmounted`.

**Style conventions.** Code comments and the `zh-Hans` source strings are Chinese (shared vocabulary: 格, 墙段, 连续坐标, 贴墙滑动); every user-facing string goes through the i18n catalogue (see Localization below) — no literal UI text in SFCs. Global CSS variables live in `src/styles/base.css` (`--bg`, `--fg`, `--fg-dim`, `--fg-faint`, `--line`, `--panel`, `--inv-bg`, `--inv-fg`, `--scrim`, `--ease`, `--dur`, `--font-ui`, `--font-mono`); every clickable element carries the `interactive` class (inverted hover), `.is-active` means inverted, `.rise` is the entrance animation, and `.no-anim` on the App root disables all animation when `settings.animations === false`. Component styles are `scoped`. `MenuScreen` is a full-viewport panel that **follows the UI theme**: `.menu` is `position: fixed; inset: 0`, takes its surface/ink from the global variables (no local palette), and lays out title top-left / buttons bottom-left with `justify-content: space-between`. Its `.item` only nulls the border (`border-color: transparent`) and bleeds left (`margin-left: -16px`) so button text aligns with the title; the shared `.interactive` hover inversion re-colors itself, and the decorative backdrop uses theme-neutral values (`var(--line)` dots, mid-grey orb) so it works on both surfaces.

**Two independent theme axes** — do not collapse them back into one:

- `Settings.uiTheme` (`light | dark | system`, default **`light`**) resolves through `prefers-color-scheme` into a `ThemeId`; `App.vue` subscribes via `subscribeSystemScheme` (unsubscribed in `onUnmounted`) and the result only toggles `.theme-light` on the App root — every DOM screen follows. `:root` is the dark palette, so dark needs no class.
- `Settings.mazeTheme` (`dark | light | ui`, default `ui`) resolves to a `ThemeId` — `App.vue` passes it as `GameScreen`'s `mazeTheme` prop, `GameScreen` forwards it as the `theme` prop of `MazeCanvas`/`ReviewMap`, and those read `CANVAS_PALETTES` (`src/render/palette.ts`). `深色` = 迷宫纯黑底、墙体/光点白色. The canvases' CSS fallback is bound inline (`:style="{ background: paper }"`) so it follows the **maze** theme and never `var(--bg)` (the UI theme) — otherwise UI-light + maze-dark flashes white before the first frame.

Light is a straight channel inversion (paper black↔white, ink white↔black, **identical alpha ramps**), so the near-player/edge relation flips with it.

First start: `startGame()` intercepts the **first** 开始游戏 and shows the shared `OverlayPanel` (title 选择游玩模式, dark recommended, `plain` — two transparent buttons carrying their mode description as a `hint` second line) *instead of* switching screens; choosing writes `mazeTheme`, marks `INTRO_KEY` (`puzzlec.intro.v1`, deliberately **outside** the settings blob so 恢复默认 does not re-trigger it) and only then enters the game. Every later start goes straight in. `OverlayPanel` actions are `{ label, hint?, active?, primary?, onClick }`: `primary` = auto-focus (modal focus lands in the dialog), `active` = 反色实心高亮, and `plain` on the panel suppresses the filled look entirely — a focused plain button is indicated by its border instead (its hover still inverts like every other `.interactive`).

Gotcha: `body { color: var(--fg); background: var(--bg) }` only ever sees the `:root` values, so descendants that merely inherit (e.g. the overlay panel's text) are re-coloured by `.app`'s own `background`/`color` declaration — re-declaring the variables alone is not enough. Never hardcode `#000`/`#fff`/`rgba(255,255,255,…)` in a screen or canvas: use the variables or `inkRgba`.

**Localization** — four locales (`zh-Hans | zh-Hant | en | ja`), orthogonal to the theme axes:

- `Settings.locale` (default `zh-Hans`) is the single source. `App.vue` derives `locale = computed(() => settings.value.locale)`, calls `provideLocale(locale)`, and mirrors it to `document.documentElement.lang` via `LOCALE_TAGS`.
- `src/i18n/messages.ts` is pure and framework-free. `MESSAGES` is typed `Record<LocaleId, Record<MessageKey, string>>` where `MessageKey` is the key union of the `zh-Hans` object — so a missing or stray key in any other locale is a **compile error**. `translate(locale, key, params)` fills `{name}` placeholders, falls back to `zh-Hans` for an unknown locale, and returns the key itself for an unknown key (never throws). `LOCALE_OPTIONS` holds native-language labels (identical strings in every locale); `isLocaleId` validates persisted values.
- Components call `const t = useT()` (`src/i18n/useI18n.ts`), which injects the provided locale ref and returns a plain function; reading `locale.value` inside a template records it as a render dependency, so switching language re-renders everything with no extra plumbing (`tests/…` verified this over provide/inject). Because `inject` only walks *parent* provides, the provider (`App.vue`) cannot inject from itself — it builds `t` directly from `translate(locale.value, …)`.
- Option tables (`SIZE_OPTIONS`, `UI_THEME_OPTIONS`, `MAZE_THEME_OPTIONS`, `RADIUS_OPTIONS`) carry `labelKey: MessageKey` instead of display text; SFCs render `t(opt.labelKey)`. Numeric `hint`/`value` stay literal. The `SettingsScreen` language row patches `Settings.locale` exactly like the other rows.
- Rules: no literal UI text in SFCs (add keys to the catalogue); 恢复默认 resets the language too (it is part of the settings blob).

**Error handling.** Gameplay code does not throw; invalid input is clamped or ignored (out-of-range walls, `Math.min/Math.max` clamps, `loadSettings` validating every field and falling back to fresh defaults).

## Important Files

| File | Why it matters |
|---|---|
| `src/main.ts` | Entry point; mounts `App` into `#app`, imports global CSS |
| `src/App.vue` | Screen state machine, settings watch/persist, seed + level index ownership, **theme resolution**（uiTheme/mazeTheme → `ThemeId`，订阅系统配色）与**语言 provide**（`settings.locale` → `document.documentElement.lang`）, first-run theme chooser |
| `src/types.ts` | `Level` = grid + wall segments; all cross-module contracts |
| `src/game/maze.ts` | `generateMaze` (iterative backtracker, perfect maze), `hasVWall`/`hasHWall`, `bfs`, `farthestCell` |
| `src/game/visibility.ts` | `castRay`, `createVisibility`/`computeVisibility`, `isVisible`; `lit` = 每条边的**可见部分**（`pushVisibleSpans` 采样 + 二分细化），固定顺序被测试断言 |
| `src/game/collision.ts` | `PLAYER_R = 0.18`, `moveWithCollision` (substep ≤ `radius/2`, resolve X then Y) |
| `src/game/settings.ts` | `SETTINGS_KEY`/`INTRO_KEY`, `DEFAULT_SETTINGS`, `UI_THEME_OPTIONS`/`MAZE_THEME_OPTIONS`/`RADIUS_OPTIONS`（`labelKey` 而非文案）, `sizeCells`, `radiusValue`, `load/saveSettings`（逐字段校验，含 `locale` 的 `isLocaleId`）, `loadIntroSeen`/`markIntroSeen`, `prefersDarkScheme`/`subscribeSystemScheme` |
| `src/i18n/messages.ts` | 四语言 `MESSAGES`（`zh-Hans` 定义 `MessageKey`，缺键/多键编译报错）、`translate`、`LOCALE_OPTIONS`/`LOCALE_TAGS`/`isLocaleId` |
| `src/i18n/useI18n.ts` | `LOCALE_KEY`、`provideLocale(locale)`、`useT()`（inject → 模板里调用即响应式；provider 自身不能 inject） |
| `src/game/trail.ts` | `TRAIL_STEP`, `createTrail` → `{ points, times, reset(x,y,t), push(x,y,t) }` (flat `[x,y,...]` + parallel `times`, reused buffers), `sampleTrail(points,times,t,out)` → 二分+线性插值 |
| `src/components/MazeCanvas.vue` | DPR/camera/pixel math + canvas paint order; walls via `src/render/walls.ts`; `theme` prop → `CANVAS_PALETTES` |
| `src/components/ReviewMap.vue` | Full-map overview canvas: all walls (shared geometry) at uniform brightness, full trail (dim) + traversed portion (bright) + player dot; `renderFrame(ms)` replayed imperatively from the game loop; `theme` prop → `CANVAS_PALETTES` |
| `src/render/walls.ts` | `WALL_THICKNESS`, `wallLineWidth`, `wallGradient(ctx,x,y,r,ink,peak?)` (32-stop continuous falloff; `ink` = 亮度色 rgb 文本，随主题反色), `addLevelWalls`, `addLitWalls` — shared by both canvases |
| `src/render/palette.ts` | `CANVAS_PALETTES` / `CanvasPalette`（`paper` 底色 + `ink` 亮度色）+ `inkRgba`；两个 canvas 都按它取色 |
| `src/screens/GameScreen.vue` | Only rAF loop, input handling, physics, trail recording, playback, win/pause/review transitions |
| `index.html` | `#app` mount point + module script `/src/main.ts` |
| `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` | Strict-TS constraints, build target, test include pattern |
| `task.md` | Original product brief (constraints) |

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
- Baseline: **6 files / 54 passing cases in ~0.5s** (`tests/maze.test.ts` 10, `tests/visibility.test.ts` 11, `tests/collision.test.ts` 6, `tests/trail.test.ts` 11, `tests/walls.test.ts` 7, `tests/i18n.test.ts` 9). Keep it green; `pnpm test` runs one-shot (CI-style).
- Scope: only the pure modules `src/game/{maze,visibility,collision,trail}.ts`, `src/render/walls.ts`, `src/i18n/messages.ts` (+ `src/types.ts`) are covered. Vue components, `settings.ts` persistence, `src/render/palette.ts`, `src/i18n/useI18n.ts`, and `rng.ts` have **no** tests — add them deliberately if behavior changes there.
  - `tests/i18n.test.ts` pins: identical key sets across the four locales, non-empty values, identical `{placeholder}` sets per key, `LOCALE_TAGS`/`LOCALE_OPTIONS` ↔ `LocaleId` parity, placeholder substitution, unknown-locale/unknown-key fallbacks, and that every option table's `labelKey` resolves in every locale.
- `tests/helpers.ts` is a plain module (not matched as a test). It exports `LevelSpec`, `makeLevel(spec): Level`, and `visibleMask(level, pos, radius): string[]`.
  - `makeLevel({ cols, rows, v: [[lineX, row], ...], h: [[lineY, col], ...], start?, goal? })` builds levels with the outer ring always walled and the interior open except for explicitly listed segments — so visibility/collision can be asserted against hand-computed geometry, independent of `generateMaze`.
  - `visibleMask` renders an `isVisible` grid as `'#'`/`'.'` strings for readable assertions.
- Conventions: relative imports (`../src/...`), Chinese `it(...)` descriptions, fixed seeds for determinism, exact array assertions over typed arrays (`expect(Array.from(level.hWalls)).toEqual(...)`), `toBeCloseTo(x, 9)` for collision coordinates and `toBeCloseTo(x, 12)` for ray distances.
- Key pinned behavior (do not re-pin incidental values, but do keep these contracts): perfect-maze invariant `open interior segments === n*n - 1`; `start === {x:0,y:0}` and `goal` is the BFS-farthest cell with ties broken by smallest index; hand-computed mask `['###', '#..', '#..']`; the exact 1×1 `vis.lit` array in fixed order; per-portion wall spans — a fully visible edge stays one entry, while a partly occluded edge yields only its visible sub-interval(s) with hand-computed occlusion boundaries (5/6, `sqrt(0.24)`); collision stop at `0.32` for wall line `x = 0.5` with `PLAYER_R = 0.18`; diagonal wall-slide; no tunneling on large deltas.
- Before yielding: `pnpm run typecheck` (exit 0) and `pnpm test` (all green). For build/preview changes, also `pnpm run build` and check `dist/index.html` references `./assets/index-*.js` + `./assets/index-*.css`.
