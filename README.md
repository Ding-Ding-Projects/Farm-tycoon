# Farm Tycoon

A farm-and-town management game combining Hay Day's crop/animal/production loop with
Township's town-building layer. Built with vanilla JavaScript and Canvas — no framework,
no bundler, no build step — and packaged for Windows with Electron. Read `PLAN.md` for the
full game design and `DESIGN_BRIEF.md` for the UI design contract before making changes.

## Current status: content-complete scaffold, not yet playable

This is honest, so read it before opening an issue about a blank screen: **the game does
not play yet.** `src/main.js` currently draws a static placeholder splash scene, not the
real world.

- **`src/data.js` is complete, final content**, validated by `npm test`. Running the
  validator against this checkout reports:

  > data.js OK — 22 crops, 12 animals, 26 buildings, 128 recipes, 192 goods, 3 merge
  > chains, 39 achievements, 95 levels all with unlocks, 10 weekend events + 6
  > mini-events + 25 fair tasks + 6 holidays, town: 16 houses + 10 community, 14 zoo
  > enclosures, 8 islands, 23 materials

- **Every other `src/` module is a documented API contract with stub bodies.** As of this
  checkout there are 238 `/* Phase B */` stub markers across the codebase — functions
  whose signatures, parameters, and doc comments are final, but whose implementations are
  not written yet. Nothing runs the game loop, draws the world, or lets you plant a crop.
- `index.html` and `styles.css` carry the real DOM structure and a Hay Day-style
  wood/parchment/gloss theme, but the canvas itself only ever shows a placeholder vista
  drawn directly in `main.js`.
- There are **no screenshots or recordings in this README**, and there won't be any until
  the renderer stops being a stub — a picture of the placeholder splash would misrepresent
  what the project is.

Implementation of the real systems (Phase B) has not started. See `CLAUDE.md` for the
exact handoff state and the sequencing plan for that work.

## What makes it different from its two inspirations

<details>
<summary><strong>Buildings are crafted, not bought</strong></summary>

Every production building is unlocked through the Building Workshop rather than being
purchased outright: gather raw construction materials, craft them into components,
assemble a kit, and only then does the finished building/factory go up. This construction
chain is itself a small economy — it consumes the "materials" goods produced by the town
layer (trains, mine, town milestones) rather than only coins.

</details>

<details>
<summary><strong>Every production building has its own minigame</strong></summary>

Fishing, mining, the merge board, expeditions, foraging, and more are each tied to a
specific structure and produce an effect unique to that structure (bonus yield, rare
materials, faster queues). These minigames are always an **optional bonus layer** — never
a gate on production. A building's timers run and complete on their own whether or not you
ever play its minigame, and offline progress is never penalized for skipping it.

</details>

Systems are opened by **clicking their structure in the world** — never from the HUD or
dock. A locked structure still exists in the world in a derelict/unbuilt state and is
still clickable from level 1, so players can see and plan around content before they've
unlocked it. (See "Where it disagreed with the content plan" in `design/README.md` for how
this rule reshaped an earlier HUD dock design.)

## Getting started

<details open>
<summary><strong>Browser (recommended for all development)</strong></summary>

```
npm run serve
```

Then open `http://localhost:8123`. No build step, no bundler — plain ES modules served
directly.

</details>

<details>
<summary><strong>Electron (Windows desktop shell)</strong></summary>

```
npm install
npm start
```

To build a Windows installer: `npm run dist` (electron-builder, NSIS target).

</details>

<details>
<summary><strong>Data validator</strong></summary>

```
npm test
```

Runs `tools/validate-data.mjs`, which checks `src/data.js` for internal consistency —
every unlock references a level that exists, every recipe references goods that exist,
every good/animal/crop id is unique, and so on — and prints the content counts shown
above. This is the only automated check in the repository today; there is no test suite
for gameplay logic because the gameplay logic isn't implemented yet.

</details>

## Architecture

Every module in `src/` owns one part of the game. Systems are driven entirely by the
content tables in `data.js` — adding a new crop, building, or recipe should not require
touching logic elsewhere. See `CLAUDE.md` for the authoritative, up-to-date module map
(kept current as new subsystem files are added); a summary as of this checkout:

<details>
<summary><strong>Core loop and state</strong></summary>

| Module | Owns |
|---|---|
| `src/main.js` | boot order, game loop, autosave, debug hook |
| `src/state.js` | the state object, save/load/migrate (localStorage), export/import |
| `src/data.js` | all content: crops, animals, goods, buildings/recipes, levels, tuning |
| `src/economy.js` | coins, XP/levels, unlock checks, sell values, diamond skips |
| `src/farm.js` | grid, placement/footprints, expansion zones |
| `src/production.js` | every timer: crops, animal pens, building queues, offline catch-up |

</details>

<details>
<summary><strong>Farm-side systems and minigames</strong></summary>

| Module | Owns |
|---|---|
| `src/orders.js` | order board + truck |
| `src/boat.js` | boat crates + vouchers |
| `src/shop.js` | roadside shop listings |
| `src/fishing.js` | cast + reel minigame, chests |
| `src/mine.js` | digs + ore yields |
| `src/merge.js` | Merge Meadow: merge-board minigame |
| `src/workshop.js` | Building Workshop: materials → components → kit → factory |
| `src/coop.js`, `src/foraging.js`, `src/expeditions.js`, `src/helicopter.js`, `src/lab.js`, `src/museum.js`, `src/regatta.js` | additional production/minigame subsystems tied to their own structures |

</details>

<details>
<summary><strong>Town layer and progression</strong></summary>

| Module | Owns |
|---|---|
| `src/town.js` | Town: houses, population/cap, milestones (materials economy sink) |
| `src/trains.js` | trains + airport: goods out, construction materials in |
| `src/zoo.js` | zoo enclosures, souvenirs, visitor income, zoo orders |
| `src/islands.js` | island unlocks and content |
| `src/neighbours.js` | neighbour/social systems |
| `src/collections.js`, `src/newspaper.js` | collection tracking and the newspaper/order feed |
| `src/extras.js` | achievements, daily wheel, visitors, pets, timed events |
| `src/decorate.js` | decoration placement |
| `src/tutorial.js` | guided-intro step machine |

</details>

<details>
<summary><strong>Rendering, input, audio</strong></summary>

| Module | Owns |
|---|---|
| `src/render/renderer.js` | camera, iso tile math, frame drawing, DPR scaling |
| `src/render/sprites.js` | all vector art draw functions — there are no image assets |
| `src/render/effects.js` | particles: coin bursts, XP floaters, sparkles |
| `src/ui.js` | all DOM: HUD, dock, sheet panels, radial menu, toasts, modals |
| `src/input.js` | pointer handling: pick/pan/zoom/drag-plant/placement ghost |
| `src/audio.js` | WebAudio-synthesized sound effects — there are no audio files |
| `src/minigames.js` | shared minigame scaffolding used by the per-structure minigames above |

</details>

All art is canvas vector code and all sound is synthesized at runtime — the project ships
with no image or audio assets.

## Design reference

The `design/` folder holds a checked-in visual overhaul produced by a separate design
pass: HUD direction boards, a full screen board, an interactive prototype, a reference
renderer, and an implementation handoff (`design/handoff/`) with sprite notes, an
overhauled stylesheet, and an icon sheet. **It is a reference for what the renderer is
being built to match, not something the running game currently loads** — nothing in
`design/` is imported by `src/` today. See `design/README.md` for what's in the folder and
its recorded known gaps (missing vendored fonts, a network-loaded font link in the design
tool's own preview wrapper that must not be copied into the game).

## Repository guide

| Path | What it is |
|---|---|
| `PLAN.md` | The full game design document — read this first |
| `CLAUDE.md` | Architecture map and conventions for agents working on this codebase |
| `HANDOFF.md` | Current state, what is deliberately not done, and the suggested next steps |
| `DESIGN_BRIEF.md` | The UI design contract: tokens, components, screens |
| `design/` | Checked-in visual overhaul and its implementation handoff |
| `src/data.js` | Every crop, animal, recipe, structure, level and tuning number |
| `src/` | Game modules — documented API contracts, bodies still stubbed |
| `electron/` | The Windows wrapper |
| `tools/validate-data.mjs` | The content validator that `npm test` runs |
| `.claude/skills/` | Agent skills: `run-game`, `add-content`, `playtest` |

Progress is intended to save automatically to `localStorage` and continue while the game is
closed — crops keep growing, because every timer is an absolute timestamp rather than a
countdown. That behaviour is specified and contracted but, like the rest of the systems, not
yet implemented.

## Conventions worth knowing before contributing

- No runtime dependencies and no build step for the game itself — only Electron and
  electron-builder are devDependencies.
- No binary assets, ever. Art is vector code in `sprites.js`; sound is synthesized in
  `audio.js`.
- Timers are stored as absolute wall-clock `readyAt` timestamps, never countdowns, so
  offline progress resolves correctly on load.
- The save format is a single JSON blob with a `SAVE_VERSION`; any shape change must bump
  the version and add a migration — existing saves must never break.
- The world ground renders as a continuous meadow; the tile grid is only shown during
  placement/edit mode.

See `CLAUDE.md` for the full set of hard conventions and the current handoff state.
