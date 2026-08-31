# Farm Tycoon

A farm-and-town management game combining Hay Day's crop/animal/production loop with
Township's town-building layer. Built with vanilla JavaScript and Canvas — no framework,
no bundler, no build step — and packaged for Windows with Electron. Read `PLAN.md` for the
full game design and `DESIGN_BRIEF.md` for the UI design contract before making changes.

## Status: it plays

The game boots and runs. Every `src/` module is implemented — the `/* Phase B */` stub
markers that once covered most of the codebase are gone, checked by grep against this
checkout (`grep -r "/\* Phase B \*/" src/` returns nothing). Loaded in a browser at
`http://127.0.0.1:8123`, it produces zero console errors and a live `window.__farmDebug`
hook exposing real, mutating game state — a starting farm with real coins, diamonds, a
seeded silo, an empty barn, and six farm objects, not a static HUD reading `0`.

`npm test` runs the content validator plus eight gameplay-logic suites — camera, core
economy, logistics, crafting, township, research, dead-time systems, and the
neighbours/co-op/regatta social layer — for **147 passing assertions across nine files**,
with zero failures. The content layer, unchanged since the last handoff and re-validated by
that same run:

> data.js OK — 22 crops, 12 animals, 26 buildings, 128 recipes, 192 goods, 3 merge
> chains, 39 achievements, 95 levels all with unlocks, 10 weekend events + 6
> mini-events + 25 fair tasks + 6 holidays, town: 16 houses + 10 community, 14 zoo
> enclosures, 8 islands, 23 materials

All 22 world structures are placed with zero overlaps across their occupied tiles, and
every panel id is unique. Twenty of the twenty-two are locked at level 1 — and, per the
game's own interaction rule below, still present in the world, derelict, and clickable.
The save format round-trips correctly: `SAVE_VERSION` is 3, with migrations covering both
prior shapes, so an old save is never broken by a newer build.

A Windows release is published from every push. The latest at the time of writing
(`v0.1.0-build18+013509a4a7f6`, built from this exact commit) is a non-draft, non-prerelease
GitHub Release carrying a genuine unsigned `Setup.exe` (~114 MB), the full `.nupkg`, and a
`RELEASES` index — see "Getting started" for how the installer is built and why it is
unsigned. CI does not run tests as a release gate (a standing project policy — see
`.github/workflows/release.yml`); `npm test` is the local gate, run before every push.

<details>
<summary><strong>What is not done yet</strong></summary>

- **There are no screenshots or recordings in this README yet.** A separate pass is
  capturing the real, running, built application right now; this document gains its
  capture matrix once that lands. Until then, run it yourself — see "Getting started" — or
  read `HANDOFF.md` for the full verification record.
- Two design/balance questions from the last content audit are still being worked through:
  a small unlock-order rough edge on two buildings, and an unverified multi-step
  crafting-arbitrage question in the Building Workshop. Both are recorded precisely, with
  the numbers behind them, in `HANDOFF.md`.
- Regatta league reward tables, Township community buildings past level 70, and
  per-expansion cost numbers were sourced from wiki text and images and have never been
  independently re-derived.

</details>

See `HANDOFF.md` for the complete verification record — what was checked, how, and with
what real command output — and `ROADMAP.md` for a checklist view of what has shipped.

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
unlocked it. The dock itself carries exactly four placeless surfaces — decorate,
achievements, co-op/regatta, and settings — because everything else has a home in the
world. (See "Where it disagreed with the content plan" in `design/README.md` for how this
rule reshaped an earlier HUD dock design.)

## Getting started

<details open>
<summary><strong>Browser (recommended for all development)</strong></summary>

```
npm run serve
```

Then open `http://127.0.0.1:8123` (use the loopback address, not `localhost` — a stale
server bound to IPv6 `localhost` can otherwise serve an older cached page). No build step,
no bundler — plain ES modules served directly.

</details>

<details>
<summary><strong>Electron (Windows desktop shell)</strong></summary>

```
npm install
npm start
```

To build a Windows installer: `npm run dist` (`electron-builder --win squirrel`) — the
target is **Squirrel.Windows**, producing `Setup.exe`, a `RELEASES` index, and the full
`.nupkg` under `dist/squirrel-windows/`. Code signing is permanently out of scope for this
project (standing policy, not a missing credential): the installer is unsigned, and Windows
will show an "unknown publisher" warning, which is expected rather than a sign the file is
broken.

</details>

<details>
<summary><strong>Full test suite</strong></summary>

```
npm test
```

Runs `tools/validate-data.mjs` — which checks `src/data.js` for internal consistency:
every unlock references a level that exists, every recipe references goods that exist,
every recipe's `unlockLevel` sits at or after the true earliest availability of its own
inputs, non-sink recipes clear a positive margin, every good/animal/crop id is unique, and
roughly thirty other rule families in total — followed by eight gameplay-logic suites
(`tools/test-camera.mjs`, `test-core.mjs`, `test-logistics.mjs`, `test-crafting.mjs`,
`test-township.mjs`, `test-research.mjs`, `test-deadtime.mjs`, `test-social.mjs`) that
exercise the actual running modules: planting and harvesting, offline catch-up, save/load
round-trips, the merge board, workshop crafting, trains/town/zoo, research, and the
simulated-neighbours social layer. 147 assertions, all passing, as of this checkout.

</details>

<details>
<summary><strong>Line count</strong></summary>

```
npm run count
```

Runs `tools/count-lines.mjs`, the committed line counter — the source of truth for this
project's size and authorship split. Never hand-count with `wc -l` or a throwaway script;
this is the number every release and this README defer to.

</details>

## Architecture

Every module in `src/` owns one part of the game — 37 files in total (34 directly in
`src/`, 3 under `src/render/`). Systems are driven entirely by the content tables in
`data.js` — adding a new crop, building, or recipe should not require touching logic
elsewhere. See `CLAUDE.md` for the authoritative module map with per-module detail; this is
the complete list.

<details>
<summary><strong>Core loop and state</strong></summary>

| Module | Owns |
|---|---|
| `src/main.js` | boot order, `requestAnimationFrame` game loop, autosave, `window.__farmDebug` hook |
| `src/state.js` | the state object, save/load/migrate (`localStorage`), export/import |
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
| `src/mine.js` | digs + ore yields (smelting is a normal building recipe) |
| `src/merge.js` | Merge Meadow: merge-board minigame (chains, energy, claims) |
| `src/workshop.js` | Building Workshop: materials → components → kits → placeable buildings |
| `src/minigames.js` | per-factory minigames; results merge through `EFFECT_KEYS` |
| `src/foraging.js` | free respawning world nodes — the short-gap filler |
| `src/expeditions.js` | crew hire, site launches, loot; artifacts route to `museum.js` |
| `src/museum.js` | artifacts (in `state.museum`, not the barn) and exhibit completion |
| `src/lab.js` | permanent research; `researchedEffect()` is the one multiplier merge point |
| `src/helicopter.js` | third transport; the fastest materials channel |

</details>

<details>
<summary><strong>Town layer and progression</strong></summary>

| Module | Owns |
|---|---|
| `src/town.js` | Town: houses, population/cap, milestones (materials economy sink) |
| `src/trains.js` | trains + airport: goods out, construction materials in |
| `src/zoo.js` | zoo enclosures, souvenirs, visitor income, zoo orders |
| `src/islands.js` | island voyages (split out of `boat.js`, which keeps crates + vouchers) |
| `src/neighbours.js` | the simulated-player pool; co-op, regatta and newspaper all read it |
| `src/coop.js` | co-op membership, daily tasks, perks, and the request board |
| `src/regatta.js` | weekly race vs simulated crews whose scores advance on wall-clock time |
| `src/collections.js` | collection books (entries *derived*, never listed) + building mastery |
| `src/newspaper.js` | browse neighbours' shops; also the supply valve for a blocked recipe |
| `src/extras.js` | achievements, daily wheel, visitors, pets, events (weekend/mini/Farm Fair/holidays) |
| `src/decorate.js` | decorating mode and photo mode |
| `src/tutorial.js` | guided-intro step machine |

</details>

<details>
<summary><strong>Rendering, input, audio</strong></summary>

| Module | Owns |
|---|---|
| `src/render/renderer.js` | camera (pan/zoom/clamp), iso tile math, depth-sorted frame drawing, DPR scaling |
| `src/render/sprites.js` | all vector art draw functions — there are no image assets |
| `src/render/effects.js` | particles: coin bursts, XP floaters, sparkles |
| `src/ui.js` | all DOM: HUD, dock, sheet panels, radial menu, toasts, modals |
| `src/input.js` | pointer handling: pick/pan/zoom/drag-plant/placement ghost |
| `src/audio.js` | WebAudio-synthesized sound effects — there are no audio files |

</details>

All art is canvas vector code and all sound is synthesized at runtime — the project ships
with no image or audio assets.

## Design reference

The `design/` folder holds a checked-in visual overhaul produced by a separate design
pass: HUD direction boards, a full screen board, an interactive prototype, a reference
renderer, and an implementation handoff (`design/handoff/`) with sprite notes, an
overhauled stylesheet, and an icon sheet. **It is now integrated, not just a reference.**
`styles.css` at the repository root is a byte-for-byte match of `design/handoff/styles.css`
(aside from line endings), and the implementation brief in `design/handoff/SPRITE-NOTES.md`
— palette, outline treatment, golden-hour lighting, depth sorting, and derelict-state
rendering — is implemented in `src/render/sprites.js` and `src/render/renderer.js`. See
`design/README.md` for the full inventory of what's in the folder and its recorded (now
closed) known gaps.

## Repository guide

| Path | What it is |
|---|---|
| `PLAN.md` | The full game design document — read this first |
| `CLAUDE.md` | Architecture map and conventions for agents working on this codebase |
| `HANDOFF.md` | Current state, verification evidence, and what remains genuinely open |
| `ROADMAP.md` | Checklist view of what has shipped and what has not |
| `DESIGN_BRIEF.md` | The UI design contract: tokens, components, screens |
| `design/` | Checked-in visual overhaul and its implementation handoff (now integrated) |
| `src/data.js` | Every crop, animal, recipe, structure, level and tuning number |
| `src/` | 37 game modules — see "Architecture" above |
| `electron/` | The Windows wrapper |
| `tools/validate-data.mjs` | The content validator that `npm test` runs first |
| `tools/test-*.mjs` | The eight gameplay-logic suites `npm test` runs after the validator |
| `tools/count-lines.mjs` | The committed line counter behind `npm run count` |
| `tools/make-icon.mjs`, `tools/vendor-fonts.mjs` | Generate the app icon and vendor fonts locally — no downloaded art, no CDN |
| `docs/` | The GitHub Pages landing page, served with zero remote requests |
| `.github/workflows/release.yml` | Build, package, and publish a Windows release on every push |
| `.claude/skills/` | Agent skills: `run-game`, `add-content`, `playtest` |

Progress saves automatically to `localStorage` and continues while the game is closed —
crops keep growing, because every timer is an absolute timestamp rather than a countdown,
and `production.tick(now)` resolves the gap on load.

## Conventions worth knowing before contributing

- No runtime dependencies and no build step for the game itself — only Electron and
  electron-builder are devDependencies.
- No binary assets, ever. Art is vector code in `sprites.js`; sound is synthesized in
  `audio.js`.
- Timers are stored as absolute wall-clock `readyAt` timestamps, never countdowns, so
  offline progress resolves correctly on load.
- The save format is a single JSON blob with a `SAVE_VERSION`; any shape change must bump
  the version and add a migration — existing saves must never break. Current version: 3,
  with migrations from both prior shapes.
- The world ground renders as a continuous meadow; the tile grid is only shown during
  placement/edit mode.

See `CLAUDE.md` for the full set of hard conventions and the current handoff state.
