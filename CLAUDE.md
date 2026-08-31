# CLAUDE.md — Farm Tycoon

A Hay Day-style farm management game: vanilla JS + Canvas, packaged for Windows with
Electron. **Read `PLAN.md` first** — it is the full game design (content, systems,
balance, delivery phases). `DESIGN_BRIEF.md` is the UI design contract.

## Current status

**Phase A (scaffold) is done; Phase B (full implementation) has not started.**
`src/data.js` is complete, final content. Every other `src/` module is a documented
API contract with `/* Phase B */` stub bodies — implement to those contracts.

## Running

- **Browser (all dev iteration happens here):** `npm run serve` (static server on :8123),
  open `http://localhost:8123`. No build step, no bundler — plain ES modules.
- **Electron:** `npm install` then `npm start`. Windows installer: `npm run dist`.
- **Headless check:** Playwright with the preinstalled Chromium at `/opt/pw-browsers/chromium`
  (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). See `.claude/skills/run-game`.

## Architecture map (who owns what)

| Module | Owns |
|---|---|
| `src/main.js` | boot order, rAF game loop, autosave, `window.__farmDebug` hook |
| `src/state.js` | THE state object, save/load/migrate (localStorage), export/import |
| `src/data.js` | ALL content: crops, animals, goods, buildings/recipes, levels, tuning |
| `src/economy.js` | coins, XP/levels, unlock checks, sell values, diamond skips |
| `src/farm.js` | grid, placement/footprints, expansion zones |
| `src/production.js` | every timer: crops, animal pens, building queues, offline catch-up |
| `src/orders.js` | order board + truck |
| `src/boat.js` | boat crates + vouchers |
| `src/shop.js` | roadside shop listings |
| `src/fishing.js` | cast + reel minigame, chests |
| `src/mine.js` | digs + ore yields (smelting is a normal building recipe) |
| `src/merge.js` | Merge Meadow: merge-board minigame (chains, energy, claims) |
| `src/extras.js` | achievements, daily wheel, visitors, pets, events (weekend/mini/Farm Fair/holidays) |
| `src/render/renderer.js` | camera, iso tile math, frame drawing, DPR scaling |
| `src/render/sprites.js` | ALL vector art draw functions (no image assets, ever) |
| `src/render/effects.js` | particles: coin bursts, XP floaters, sparkles |
| `src/ui.js` | all DOM: HUD, dock, sheet panels, radial menu, toasts, modals |
| `src/input.js` | pointer handling: pick/pan/zoom/drag-plant/placement ghost |
| `src/audio.js` | WebAudio-synthesized SFX (no audio files) |
| `src/tutorial.js` | guided-intro step machine |

## Hard conventions

- **No dependencies, no build step** in the game itself (Electron/electron-builder are the
  only devDeps). No frameworks. DOM for menus, canvas for the world.
- **No binary assets.** All art is canvas vector code in `sprites.js`; all sound is
  synthesized in `audio.js`.
- **Timers are absolute wall-clock `readyAt` timestamps** (ms). Never store countdowns.
  Offline progress must resolve on load via `production.tick(now)`.
- **Save format:** single JSON blob, `SAVE_VERSION` in `state.js`. Any shape change bumps
  the version and adds a migration in `load()`. Never break existing saves.
- **UI class names and CSS tokens** in `index.html`/`styles.css` are a contract with
  `DESIGN_BRIEF.md` — don't rename them; restyle by changing token values.
- **World ground renders as a continuous meadow** (mottling, tufts, flowers) — grid
  squares are drawn only during placement/edit mode. Fields/buildings are raised slabs.
- Economy invariants: coins/diamonds never negative; silo/barn caps always respected;
  harvest returns 2x seeds; every consume-then-fail path must refund.

## Adding content

New crop/good/recipe/building/decoration = one entry in the right `data.js` table + one
draw function in `sprites.js` + (if gated) a `LEVELS.unlocks` entry. Systems pick it up
from data — no other code changes should be needed. Full recipe: `.claude/skills/add-content`.

## Verifying changes

Run the smoke playtest in `.claude/skills/playtest`: boot with zero console errors,
plant→harvest wheat via `window.__farmDebug.timeSkip()`, check economy invariants,
save→reload→deep-equal state. Do this before every commit that touches gameplay.
