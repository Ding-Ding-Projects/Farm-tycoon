# CLAUDE.md — Farm Tycoon

A farm-and-town management game — **Hay Day + Township combined**: vanilla JS + Canvas,
packaged for Windows with Electron. **Read `PLAN.md` first** — it is the full game design
(content, systems, balance, delivery phases). `DESIGN_BRIEF.md` is the UI design contract.

## Current status & handoff

**Phase A (scaffold) is COMPLETE and lives on `main`; Phase B (full implementation) has
not started.** State of the world for whoever picks this up:

- `src/data.js` is **complete, final content** (validated by `npm test`): 22 crops,
  12 animals, 26 buildings / 128 recipes, 192 goods, 23 construction materials in four
  purpose-scoped sets, Merge Meadow, full event system (weekend/mini/Farm Fair/holidays),
  Township layer (town, trains, airport, zoo, islands, market), the expansion subsystems
  (workshop kits, per-factory minigames, mine depths, artifacts + museum, expeditions,
  laboratory, helicopter, co-op, regatta, foraging, newspaper, collections, mastery),
  22 placed world structures, tutorial steps, and **95 levels** with an unlock at every one.
- **Two mechanics distinguish this from its sources.** Buildings are *crafted*, not bought:
  the Building Workshop turns materials into components, components into a kit, and the kit
  places the factory. And every production building has *its own* minigame with an effect
  only that factory has — optional, a bonus layer, never a gate, because gating a recipe on
  hand-eye skill would break the idle contract.
- **Systems open from world objects, never the HUD or dock.** `STRUCTURES` gives each a
  footprint and position; `input.js` resolves a pick to a structure id. Locked ones are
  derelict but still clickable from level 1. The dock keeps only what has no place in the
  world: settings, achievements, co-op/regatta, and decorating mode.
- `design/` holds the checked-in visual overhaul: four HUD directions, the screen board, a
  reference renderer, and `handoff/SPRITE-NOTES.md`, which is the brief for rewriting
  `src/render/sprites.js`. **Not yet integrated.** Read `design/README.md` first — it records
  the one real defect (the handoff CSS names two fonts it does not ship, so the page silently
  falls back to system-ui with no error).
- Every other `src/` module is a **documented API contract** with `/* Phase B */` stub
  bodies — implement to those contracts; do not redesign them casually.
- `index.html`/`styles.css` carry the real DOM structure + Hay Day-style theme (wood/
  parchment/gloss). The splash in `main.js` is placeholder art that Phase B's renderer
  replaces.
- **Expected sequence:** (1) the user may land a Claude Design UI pass that restyles
  tokens/classes per `DESIGN_BRIEF.md` — absorb it, don't fight it; (2) when the user
  says **"start developing"**, execute Phase B as ONE complete pass (see PLAN.md
  "One-shot delivery requirement"): implement every module fully — no stubs or TODOs
  left — on branch **`claude/windows-hay-day-game-cfctdb`**, verified with the
  `playtest` skill, pushed, with a **draft PR**. Scaffold work so far was pushed
  straight to `main` at the user's explicit request; Phase B goes through the branch+PR.

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
| `src/town.js` | Town: houses, population/cap, milestones (materials economy sink) |
| `src/trains.js` | trains + airport: goods out, construction materials in |
| `src/zoo.js` | zoo enclosures, souvenirs, visitor income, zoo orders |
| `src/extras.js` | achievements, daily wheel, visitors, pets, events (weekend/mini/Farm Fair/holidays) |
| `src/render/renderer.js` | camera, iso tile math, frame drawing, DPR scaling |
| `src/render/sprites.js` | ALL vector art draw functions (no image assets, ever) |
| `src/render/effects.js` | particles: coin bursts, XP floaters, sparkles |
| `src/ui.js` | all DOM: HUD, dock, sheet panels, radial menu, toasts, modals |
| `src/input.js` | pointer handling: pick/pan/zoom/drag-plant/placement ghost |
| `src/audio.js` | WebAudio-synthesized SFX (no audio files) |
| `src/tutorial.js` | guided-intro step machine |
| `src/workshop.js` | Building Workshop: materials → components → kits → placeable buildings |
| `src/minigames.js` | per-factory minigames; results merge through `EFFECT_KEYS` |
| `src/neighbours.js` | THE simulated-player pool; co-op, regatta and newspaper all read it |
| `src/coop.js` | co-op membership, daily tasks, perks, and the request board |
| `src/regatta.js` | weekly race vs simulated crews whose scores advance on wall-clock time |
| `src/expeditions.js` | crew hire, site launches, loot; artifacts route to `museum.js` |
| `src/museum.js` | artifacts (in `state.museum`, NOT the barn) and exhibit completion |
| `src/lab.js` | permanent research; `researchedEffect()` is the one multiplier merge point |
| `src/helicopter.js` | third transport; the fastest materials channel |
| `src/islands.js` | island voyages (split out of `boat.js`, which keeps crates + vouchers) |
| `src/foraging.js` | free respawning world nodes — the short-gap filler |
| `src/newspaper.js` | browse neighbours' shops; also the supply valve for a blocked recipe |
| `src/collections.js` | collection books (entries *derived*, never listed) + building mastery |
| `src/decorate.js` | decorating mode and photo mode |

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
