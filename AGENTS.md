# Repository Guidelines

Repo root: `@Kuriyona/PuzzleC` (package name `maze-lumen`, UI title 光点迷宫 / Lumen Maze).

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
App.vue  [screen, settings, seed, levelIndex]  watch(settings, deep) -> saveSettings()
  ├─ MenuScreen      props{settings}             emits start, settings
  ├─ SettingsScreen  v-model<Settings>           emits back
  └─ GameScreen      props{settings,seed,levelIndex}  emits next, exit
        │   owns: single rAF loop, 250ms HUD timer, window key/listeners, physics, trail recording
        ├─ HudBar       props{levelIndex,sizeHint,radius,distance,elapsedMs,seed} emits pause, restart
        ├─ MazeCanvas   props{level,radius,animations}  exposes renderFrame(now,dt,pos)
        ├─ OverlayPanel props{title,lines,actions}      (paused / won overlays)
        └─ ReviewMap    props{level,points,times}        (won → 全图回顾：按时间回放)

src/render/walls.ts —— MazeCanvas 与 ReviewMap 共用的墙体绘制（实体墙几何 + 连续亮度渐变）
```

- `App.vue` is the only screen state machine; `screen` toggles `menu | settings | game`. `startGame()`/`nextLevel()` mint a new `randomSeed()`; `levelIndex` increments on next level.
- `GameStatus` = `playing | paused | won | review`; `review` is a GameScreen-internal state (not an `App` screen). Reached only from the win overlay ("查看回顾"); it keeps `level`/`pos`/trail alive and replays the recorded timeline on `ReviewMap` (play/pause, 0.5/1/2/4× speed, draggable seek bar). Playback time `reviewPlayMs` is a plain value advanced in `frame()` (ms * speed, clamped to `reviewDuration`); only the clock/seek-bar read `reviewMs` (ref), so no per-frame reactive state. 下一关/重玩本关/返回菜单 exit it.
- Exactly **one** `requestAnimationFrame` loop exists, owned by `GameScreen.frame()` (`src/screens/GameScreen.vue:125`). It self-reschedules, computes `dt` (first frame 16ms, capped 50ms), advances physics only when `status === 'playing'`, and calls `canvasRef.value?.renderFrame(now, dt, pos)` unless paused. `MazeCanvas` never owns a loop — it draws on demand.
- Physics per frame: read `pressed` set → camera-relative input axes (diagonal scaled by `Math.SQRT1_2`) → velocity exponential approach (`SPEED=3.2` cells/s, `ACCEL_TAU=0.06s`) → `moveWithCollision` into a reused `next` object → win check within `WIN_R=0.3`.
- Elapsed time: `performance.now() - startedAt - pausedAccumMs`; HUD refresh is a separate 250ms `setInterval`.
- Rendering per frame (`MazeCanvas.renderFrame`): measure/DPR → clear → camera clamp + exponential ease → `computeVisibility` → **one world-space `c.save(); c.translate(ox,oy)`** wrapping fan fill, walls, goal and player → clip to the fan polygon and fill a radial gradient → stroke visible wall segments as **thick, round-capped/joined solid walls** whose brightness comes from a radial gradient (`wallGradient`) — continuous falloff, **no brightness tiers** → goal diamond + player dot.
- Wall geometry/thickness is shared by both canvases via `src/render/walls.ts`: `wallLineWidth(tile) = max(1.25px, tile*WALL_THICKNESS)`, `addLevelWalls` (all walls, for the review map) and `addLitWalls` (visible segments only). `MazeCanvas` paints a per-player gradient; `ReviewMap` paints a uniform stroke. Rounded corners/ends fall out of `lineCap/lineJoin = 'round'`.

Level creation: `GameScreen.resetLevel()` calls `generateMaze(cells, cells, props.seed)`, positions `pos` at `level.start`, and zeroes velocity/traveled. `watch(() => props.seed, resetLevel)` makes `App` the owner of level identity.

## Key Directories

| Path | Purpose |
|---|---|
| `src/game/` | Pure, framework-free game logic: `maze.ts` (generation + wall accessors + BFS), `visibility.ts` (raycast/fan), `collision.ts` (movement resolution), `settings.ts` (options + localStorage), `rng.ts` (seeded PRNG), `trail.ts` (轨迹采样：`createTrail` 记录 `points`+`times`，位移 ≥ `TRAIL_STEP` 才记录；`sampleTrail` 按时间插值) |
| `src/components/` | Presentational Vue SFCs: canvas renderer, HUD bar, overlay dialog, review map |
| `src/render/` | Framework-free Canvas 2D helpers shared by the canvases: `walls.ts` (solid-wall geometry, thickness, continuous brightness gradient) |
| `src/screens/` | Screen-level SFCs: menu, settings editor, game loop owner |
| `src/styles/` | `base.css`: CSS variables, `.interactive` inverted hover, transitions |
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
- Options tables use `as const satisfies readonly {...}[]` (see `SIZE_OPTIONS`, `RADIUS_OPTIONS`).
- Types are named and imported from their owning module; do not publish contracts as `ReturnType<typeof fn>`.

**Vue SFC conventions.** `<script setup lang="ts">`; props via `defineProps<{...}>()`, emits via `defineEmits<{name:[args]}>()`; two-way binding through `defineModel<Settings>({ required: true })` and whole-object replacement (`{ ...model.value, ...patch }`). `defineExpose({ renderFrame })` is the imperative canvas API. Every mutable listener/timer is torn down in `onUnmounted`.

**Style conventions.** UI text and code comments are Chinese (shared vocabulary: 格, 墙段, 连续坐标, 贴墙滑动). Global CSS variables live in `src/styles/base.css` (`--bg`, `--fg`, `--fg-dim`, `--fg-faint`, `--line`, `--panel`, `--inv-bg`, `--inv-fg`, `--ease`, `--dur`, `--font-ui`, `--font-mono`); every clickable element carries the `interactive` class (inverted hover), `.is-active` means inverted, `.rise` is the entrance animation, and `.no-anim` on the App root disables all animation when `settings.animations === false`. Component styles are `scoped`.

**Error handling.** Gameplay code does not throw; invalid input is clamped or ignored (out-of-range walls, `Math.min/Math.max` clamps, `loadSettings` validating every field and falling back to fresh defaults).

## Important Files

| File | Why it matters |
|---|---|
| `src/main.ts` | Entry point; mounts `App` into `#app`, imports global CSS |
| `src/App.vue` | Screen state machine, settings watch/persist, seed + level index ownership |
| `src/types.ts` | `Level` = grid + wall segments; all cross-module contracts |
| `src/game/maze.ts` | `generateMaze` (iterative backtracker, perfect maze), `hasVWall`/`hasHWall`, `bfs`, `farthestCell` |
| `src/game/visibility.ts` | `castRay`, `createVisibility`/`computeVisibility`, `isVisible`; fixed `lit` ordering relied on by tests |
| `src/game/collision.ts` | `PLAYER_R = 0.18`, `moveWithCollision` (substep ≤ `radius/2`, resolve X then Y) |
| `src/game/settings.ts` | `SETTINGS_KEY`, `DEFAULT_SETTINGS`, `sizeCells`, `radiusValue`, `load/saveSettings` |
| `src/game/trail.ts` | `TRAIL_STEP`, `createTrail` → `{ points, times, reset(x,y,t), push(x,y,t) }` (flat `[x,y,...]` + parallel `times`, reused buffers), `sampleTrail(points,times,t,out)` → 二分+线性插值 |
| `src/components/MazeCanvas.vue` | DPR/camera/pixel math + canvas paint order; walls via `src/render/walls.ts` |
| `src/components/ReviewMap.vue` | Full-map overview canvas: all walls (shared geometry) at uniform brightness, full trail (dim) + traversed portion (bright) + player dot; `renderFrame(ms)` replayed imperatively from the game loop |
| `src/render/walls.ts` | `WALL_THICKNESS`, `wallLineWidth`, `wallGradient` (32-stop continuous falloff), `addLevelWalls`, `addLitWalls` — shared by both canvases |
| `src/screens/GameScreen.vue` | Only rAF loop, input handling, physics, trail recording, playback, win/pause/review transitions |
| `index.html` | `#app` mount point + module script `/src/main.ts` |
| `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` | Strict-TS constraints, build target, test include pattern |
| `task.md` | Original product brief (constraints) |

Critical paint-order gotcha: in `MazeCanvas.renderFrame` everything (fan fill, walls, goal, player) is drawn inside **one** `c.save(); c.translate(ox, oy)` world-space block, closed by the final `c.restore()`. Do **not** re-apply `ox/oy` inside it, and never drop that outer transform: a light point drawn without the camera offset stays at raw world pixels while the camera scrolls, so it appears to drift away from the (correctly centred) lit area. The fan **clip** keeps its own nested `save()/restore()` (`MazeCanvas.vue:86-96`) — wall strokes sit exactly on the clip boundary, so leaving the clip active clips half of every wall line.

Visibility gotchas: `prev` in the angle dedup must be initialized to `-Infinity` (not `Infinity`); `lit` order is fixed (vertical by `k` then `y`, then horizontal by `k` then `x`) and asserted by tests; `castRay` must not apply "out-of-range = wall" lookups, since it relies on outer-ring segments existing and being `1`.

## Runtime/Tooling Preferences

- **Package manager: pnpm** (evidenced by `pnpm-lock.yaml`, lockfile v9). Do not add npm/yarn lockfiles.
- Runtime: modern Node (ES2022 target, `"type": "module"`; ESM only, no CJS). No `.nvmrc`/`.npmrc`/engines pin — nothing enforces a Node version.
- Versions are new majors: **Vite 8, Vitest 5, vue-tsc 3, TypeScript 5.9, Vue 3.5**. Do not assume Vite 5/6 or Vitest ≤4 docs apply.
- `tsconfig.json` (single flat config, no path aliases, `include: src/**/*.ts, src/**/*.vue, tests/**/*.ts, vite.config.ts, vitest.config.ts`): `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`, `verbatimModuleSyntax`, `noEmit`, `jsx: preserve`, `moduleResolution: bundler`, `types: ["vite/client"]`. `noUncheckedIndexedAccess` is **off**.
  - Consequence: unused locals/params fail `typecheck` and therefore `build`. Deleting a symbol's last caller requires deleting the import too.
- `vite.config.ts`: `base: './'` (relative asset URLs — verify `dist/index.html` uses `./assets/...`), `vue()` plugin only, `build.target: es2022`.
- Import with relative paths (`../types`, `../game/maze`) — there is no alias setup.
- **Absent tooling (verify before assuming it exists):** no ESLint, no Prettier, no Biome, no `.editorconfig`, no CI (`.github/` does not exist), no git hooks, no Makefile/scripts dir, no README/LICENSE. There is **no `.git` directory at all** — `git` commands fail in this root.
- Match existing style manually (2-space indent, single quotes, no semicolons, ~100 col width, Chinese comments).

## Testing & QA

- Framework: **Vitest 5**, `vitest.config.ts` → `{ test: { environment: 'node', include: ['tests/**/*.test.ts'] } }`. `globals` is **off**: every file imports `{ describe, expect, it } from 'vitest'` explicitly. No setup files, no coverage config, no DOM environment.
- Baseline: **5 files / 42 passing cases in ~0.7s** (`tests/maze.test.ts` 10, `tests/visibility.test.ts` 8, `tests/collision.test.ts` 6, `tests/trail.test.ts` 11, `tests/walls.test.ts` 7). Keep it green; `pnpm test` runs one-shot (CI-style).
- Scope: only the pure modules `src/game/{maze,visibility,collision,trail}.ts`, `src/render/walls.ts` (+ `src/types.ts`) are covered. Vue components, `settings.ts` persistence, and `rng.ts` have **no** tests — add them deliberately if behavior changes there.
- `tests/helpers.ts` is a plain module (not matched as a test). It exports `LevelSpec`, `makeLevel(spec): Level`, and `visibleMask(level, pos, radius): string[]`.
  - `makeLevel({ cols, rows, v: [[lineX, row], ...], h: [[lineY, col], ...], start?, goal? })` builds levels with the outer ring always walled and the interior open except for explicitly listed segments — so visibility/collision can be asserted against hand-computed geometry, independent of `generateMaze`.
  - `visibleMask` renders an `isVisible` grid as `'#'`/`'.'` strings for readable assertions.
- Conventions: relative imports (`../src/...`), Chinese `it(...)` descriptions, fixed seeds for determinism, exact array assertions over typed arrays (`expect(Array.from(level.hWalls)).toEqual(...)`), `toBeCloseTo(x, 9)` for collision coordinates and `toBeCloseTo(x, 12)` for ray distances.
- Key pinned behavior (do not re-pin incidental values, but do keep these contracts): perfect-maze invariant `open interior segments === n*n - 1`; `start === {x:0,y:0}` and `goal` is the BFS-farthest cell with ties broken by smallest index; hand-computed mask `['###', '#..', '#..']`; the exact 1×1 `vis.lit` array in fixed order; collision stop at `0.32` for wall line `x = 0.5` with `PLAYER_R = 0.18`; diagonal wall-slide; no tunneling on large deltas.
- Before yielding: `pnpm run typecheck` (exit 0) and `pnpm test` (all green). For build/preview changes, also `pnpm run build` and check `dist/index.html` references `./assets/index-*.js` + `./assets/index-*.css`.
