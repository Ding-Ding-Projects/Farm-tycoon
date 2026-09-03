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

`npm test` runs the content validator, the economy audit and nineteen suites — camera, core
economy, logistics, crafting, township, research, dead-time systems, the neighbours/co-op/regatta
social layer, playables and verbs, the UI contracts (including the drag gestures) and the
renderer — for **771 passing assertions**, with zero failures. The content layer, re-validated
by that same run:

> data.js OK - 24 crops, 12 animals, 49 buildings, 215 recipes, 279 goods, 3 merge
> chains, 43 achievements, 95 levels all with unlocks, 10 weekend events + 6
> mini-events + 25 fair tasks + 6 holidays, town: 16 houses + 10 community, 14 zoo
> enclosures, 8 islands, 23 materials
> playable share: 44/151 recipes (1 in 3.4), 46 verbs - at the 1-in-3 target

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

## Screenshots

Every image below is a real capture of the real built Windows artifact
(`dist/win-unpacked/Farm Tycoon.exe`, unsigned per the no-signing policy above), driven end to
end over the Chrome DevTools Protocol against the app's own live modules — never a mockup,
never a dev-server capture, never a design file. Captured from commit
[`7dc0f14`](https://github.com/Ding-Ding-Projects/Farm-tycoon/commit/7dc0f145cab587f3dd1e36ecd6d1aa749fddd29d)
by `tools/capture-screenshots.mjs`, whose full method, a documented known-constraint history, and
every image's exact state and alt text live in `screenshots/manifest.json`. Seven surfaces this
build genuinely cannot reach yet — a per-factory minigame UI, the Co-op dock panel, dark theme,
and four structure panels whose backend module is implemented but not wired into `ui.js`'s panel
switch — are recorded there with the reason, rather than faked here.

One honest caveat that applies to nearly every image below: `itemIcon()` in `src/ui.js` falls back
to a "❔" glyph for every single item, because `src/data.js` defines no `icon` field on any crop,
good, animal, or material — grepping the whole file for the literal text `icon:` returns zero
matches. This is a separate, pre-existing gap this capture pass found while working, not one of
the fixes below, and out of this pass's scope to fix. The world-canvas radial menus (planting,
harvesting, feeding) are unaffected — they resolve icons a different way.

<details open>
<summary><strong>First boot</strong></summary>

**Cold boot, level 1, fresh save.** Six pre-placed empty fields, the level/coins/diamonds/silo/barn
HUD, and the guided tutorial overlay auto-started.

![Farm Tycoon at first launch: an isometric meadow with six empty field plots, the top HUD showing level 1, and a tutorial speech bubble overlay.](screenshots/01-boot-tutorial.png)

</details>

<details>
<summary><strong>Screen recording, on a phone</strong></summary>

**[screenshots/farm-tycoon-android.mp4](screenshots/farm-tycoon-android.mp4)** — 25 seconds, 575 KB,
recorded off an Android 14 device with `adb shell screenrecord` from the installed debug APK.

Stills are proof a surface exists; only a recording proves the thing MOVES. This one shows a fresh
farm, wheat planted by touch, the crop growing, a harvest, and the tutorial advancing as the silo
fills — all driven by real touch events, not by calling functions.

![Three frames from the recording: wheat growing on the field plots, then a "Harvested crop!" toast with the seed counter having gone from 4/50 to 6/50 and the silo from 0 to 6, and the tutorial advancing to say the crops are stored in the silo.](screenshots/android-recording-frames.png)

Two honest notes. The frame rate is low, around 5fps, because the emulator runs software rendering
with `-gpu swiftshader_indirect`; the app itself is not this choppy. And it captures the DEVICE
screen, never the host monitor, so nothing of whoever recorded it is in the file.

**[screenshots/farm-tycoon-desktop.mp4](screenshots/farm-tycoon-desktop.mp4)** — 22 seconds, 99 KB,
the Windows build at a full 12fps. Produced by `tools/capture-recording.mjs`, which captures the
app's own renderer frame by frame over the DevTools protocol and drives it with real pointer events
while it does. It records the page's pixels rather than a screen, so there is no window to
accidentally include and no desktop behind it.

It shows the loop: three fields planted through the radial menu, the crops growing, and all three
harvested, with the seed counter running 6 to 3 and back up to 9 as each harvest returns double.

![Four frames from the desktop recording: a "Planted Wheat." toast with the seed counter at 5/50, then 3/50 with three plots sown, then two "Harvested crop!" toasts with seeds back up to 7/50, and finally 9/50 with the plots empty again.](screenshots/desktop-recording-frames.png)

The first attempt at this recording is worth knowing about: it used `KEYCODE_BACK` to close panels,
the app has no back handler, so the key exited it and 25 seconds of the Android home screen were
recorded instead. That was caught by extracting frames and looking at them rather than trusting the
duration and file size, which were both perfectly plausible.

</details>

<details>
<summary><strong>Locked structures across the unlock curve</strong></summary>

Every one of the 22 world structures is present and clickable from level 1 — locked ones render
derelict and answer a tap with a red "unlocks at level N" toast instead of opening their panel.
Six of these seven (town gate, mine entrance, zoo gate, airport, laboratory, museum) previously
sat outside the camera's reachable bounds and could only be proven by opening their panel with the
structure itself off-screen; the fixes below (`c1b74e4`, `bb4524e`) put every one of them on
screen too, confirmed here by direct comparison against the prior capture pass.

| | | |
|---|---|---|
| ![The world view with a weathered, derelict-looking workshop yard and a red toast notification reading that it unlocks at level 6.](screenshots/02-locked-workshop_yard.png) Workshop (L6) | ![The world view with a weathered, derelict-looking town gate and a red toast notification reading that it unlocks at level 20.](screenshots/02b-locked-town_gate.png) Town Gate (L20) | ![The world view with a weathered, derelict-looking mine entrance and a red toast notification reading that it unlocks at level 24.](screenshots/02c-locked-mine_entrance.png) Mine Entrance (L24) |
| ![The world view with a weathered, derelict-looking zoo gate and a red toast notification reading that it unlocks at level 34.](screenshots/02d-locked-zoo_gate.png) Zoo Gate (L34) | ![The world view with a weathered, derelict-looking airport and a red toast notification reading that it unlocks at level 38.](screenshots/02e-locked-airport.png) Airport (L38) | ![The world view with a weathered, derelict-looking laboratory and a red toast notification reading that it unlocks at level 54.](screenshots/02f-locked-laboratory.png) Laboratory (L54) |
| ![The world view with a weathered, derelict-looking museum hall and a red toast notification reading that it unlocks at level 60.](screenshots/02g-locked-museum_hall.png) Museum (L60) | | |

</details>

<details>
<summary><strong>The core farm loop: growth stages, planting, harvesting</strong></summary>

Wheat rendered at all four growth bands side by side, fixed by commit
[`1c117c5`](https://github.com/Ding-Ding-Projects/Farm-tycoon/commit/1c117c57bcf0c690412cf7313b40cb1a21c2bea5) —
every field used to fall through to a magenta placeholder circle stamped "field" because
`renderer.js`'s `KIND_DISPATCH` had no entry for `kind:'field'` at all.

![A farm showing wheat at four different growth stages side by side — bare seeded soil, small sprouts, a growing stem, and a fully grown ready-to-harvest head — next to two empty tilled plots.](screenshots/03-world-growth-stages.png)

| | |
|---|---|
| ![A circular radial menu floating over an empty field plot, offering a wheat crop icon to plant.](screenshots/04-plant-radial-menu.png) Plant | ![A circular radial menu over a fully grown wheat field, offering a single harvest basket icon.](screenshots/05-harvest-radial-menu.png) Harvest |

![A green success toast reading "Harvested Wheat!" over the farm, with the previously-ready field now empty again.](screenshots/06-harvest-success-toast.png)

</details>

<details>
<summary><strong>Dock panels: decorate, achievements, settings, reset</strong></summary>

The dock carries five placeless surfaces — four in the markup plus the daily wheel, which
`ui.js` appends at boot. Everything else lives in the world.

| | |
|---|---|
| ![A sliding bottom sheet panel titled Decorate with a single "Enter Decorate Mode" button.](screenshots/07-dock-decorate-off.png) Decorate (off) | ![The Decorate panel closed with an info toast reading that decorate mode is on and the player can drag decorations to arrange the farm, though no such dragging exists yet.](screenshots/07b-dock-decorate-on.png) Decorate (on) |
| ![A sliding bottom sheet panel titled Achievements reading "0 achievements unlocked so far."](screenshots/08-dock-achievements-panel.png) Achievements | ![A sliding bottom sheet panel titled Settings with a Sound toggle, a language line, and Export save / Reset game buttons.](screenshots/09-dock-settings-panel.png) Settings |

![A modal dialog asking to confirm resetting the farm, warning that it deletes all progress and cannot be undone, with Cancel and Reset buttons.](screenshots/09b-confirm-reset-dialog.png)
<br>Reset confirmation — Cancel was clicked afterward; this run's save was never actually reset.

</details>

<details>
<summary><strong>Animal pens: build, feed, collect</strong></summary>

A chicken pen placed the same way the Workshop's own Build button does (`farm.place('pen', ...)`),
then fed and collected through the real radial menu.

| | | |
|---|---|---|
| ![A fenced chicken pen sitting on the farm.](screenshots/10-pen-built.png) Built | ![A radial menu over a chicken pen offering a single feed icon.](screenshots/10b-pen-radial-feed.png) Feed | ![A radial menu over a chicken pen offering a single collect icon.](screenshots/10c-pen-radial-collect.png) Collect |

</details>

<details>
<summary><strong>Building queue: real recipe names and a real Collect action (Feed Mill)</strong></summary>

Before commit `2b33dec`, every production building's queue panel read its `recipes` array with
`Object.entries()` as though it were a keyed object — cards showed the numeric array index ("0"
through "9") with no way to collect finished output at all. Both are fixed: cards now read the
real recipe id, and `renderQueue()` shows a live progress bar plus a working Collect button.

| | | |
|---|---|---|
| ![A building queue panel showing a Chicken Feed card with a question-mark icon and a partially filled progress bar with the label Crafting.](screenshots/11-building-queue-panel.png) Queued | ![A building queue panel showing a Chicken Feed card with a full progress bar, the label Ready to collect, and a Collect button.](screenshots/11b-building-queue-ready.png) Ready | ![A building queue panel with an empty queue and a green toast reading Collected Chicken Feed, over the farm.](screenshots/11c-building-queue-collected.png) Collected |

</details>

<details>
<summary><strong>All 22 structure panels</strong></summary>

Nine have real content; the rest fall through to a generic "being built — check back soon"
placeholder because their backend module (mine.js, merge.js, fishing.js, trains.js, and more —
each genuinely implemented and exercised by `tools/test-*.mjs`) is never called from `ui.js`'s
panel switch. Shown as-is, honestly.

**Real content:**

| | |
|---|---|
| ![A sliding panel titled Barn with the empty-state text "No goods in the barn yet — cook something up!"](screenshots/12-panel-barn.png) Barn | ![A sliding panel titled Silo showing a wheat item card with quantity and a sell button.](screenshots/13-panel-silo.png) Silo |

*(The Building Workshop, also real content, has its own section below.)*

**Generic fallback (backend implemented, not wired into the panel switch):**

| | | |
|---|---|---|
| ![A sliding panel titled Orders reading that the order board is being built — check back soon.](screenshots/14-panel-order_board.png) Order Board | ![A sliding panel titled Truck reading that the Truck Bay is being built — check back soon.](screenshots/15-panel-truck_bay.png) Truck Bay | ![A sliding panel titled Shop reading that the roadside shop is being built — check back soon.](screenshots/16-panel-shop_stand.png) Roadside Shop |
| ![A sliding panel titled Boat reading that the Boat Dock is being built — check back soon.](screenshots/17-panel-boat_dock.png) Boat Dock | ![A sliding panel titled Fishing reading that the Fishing Lake is being built — check back soon.](screenshots/18-panel-lake.png) Fishing Lake | ![A sliding panel titled Mine reading that the Mine Entrance is being built — check back soon.](screenshots/19-panel-mine_entrance.png) Mine Entrance |
| ![A sliding panel titled Merge reading that the Merge Meadow is being built — check back soon.](screenshots/20-panel-merge_plot.png) Merge Meadow | ![A sliding panel titled Market reading that the Market Stall is being built — check back soon.](screenshots/21-panel-market_stall.png) Market Stall | ![A sliding panel titled Trains reading that the Train Station is being built — check back soon.](screenshots/22-panel-train_station.png) Train Station |
| ![A sliding panel titled Airport reading that the Airport is being built — check back soon.](screenshots/23-panel-airport.png) Airport | ![A sliding panel titled Helicopter reading that the Helicopter Pad is being built — check back soon.](screenshots/24-panel-helipad.png) Helicopter Pad | ![A sliding panel titled Museum reading that the Museum is being built — check back soon.](screenshots/26-panel-museum_hall.png) Museum |
| ![A sliding panel titled Laboratory reading that the Laboratory is being built — check back soon.](screenshots/27-panel-laboratory.png) Laboratory | ![A sliding panel titled Expeditions reading that the Expedition Camp is being built — check back soon.](screenshots/28-panel-expedition_camp.png) Expedition Camp | ![A sliding panel titled Town reading that the Road to Town is being built — check back soon.](screenshots/29-panel-town_gate.png) Road to Town |
| ![A sliding panel titled Zoo reading that the Road to the Zoo is being built — check back soon.](screenshots/30-panel-zoo_gate.png) Road to the Zoo | ![A sliding panel titled Newspaper reading that the Mailbox is being built — check back soon.](screenshots/31-panel-mailbox.png) Mailbox | ![A sliding panel titled Collections reading that the Collections Shelf is being built — check back soon.](screenshots/32-panel-bookshelf.png) Collections Shelf |
| ![A sliding panel titled Photo Mode reading that the Camera Tripod is being built — check back soon.](screenshots/33-panel-tripod.png) Camera Tripod | | |

</details>

<details>
<summary><strong>The Building Workshop crafting flow: materials → components → kit → building</strong></summary>

This is the mechanic that makes the game different from a plain Hay Day clone (see "What makes it
different" above) — and until commit
[`2b33dec`](https://github.com/Ding-Ding-Projects/Farm-tycoon/commit/2b33dec084ee0b43c2bddbca635784113742c39d),
the panel never called `workshop.js` at all: every building sold outright for coins, bypassing the
materials economy entirely. Every step below is a real click firing the real `src/ui.js` handler,
which calls the real `workshop.js`/`production.js` functions — never called directly and presented
as what the UI shows. Raw materials for one component (1 slab + 1 nails) and, after that
component's real craft/collect cycle had already run once, the remaining inputs for one kit recipe
were granted directly into the barn — the same "inventory bump" convention this script uses
throughout (`window.__farmDebug.give()` does the same thing) — rather than spending another dozen
captures crafting every intermediate component from scratch. Both the component tier and the kit
tier are crafted and collected through the real queue UI.

**1. Not yet built** — tapping the structure before the Workshop exists shows only its own
coin-cost Build card:

![A sliding panel titled Workshop with one card offering to build the Workshop itself for coins.](screenshots/25-panel-workshop_yard.png)

**2. Materials → component.** Built for real, materials granted, then a Roof Shingle crafted,
queued, and collected — the exact same real progress-bar/Collect UI the Feed Mill queue above
uses, just backed by `workshop.collect()` instead of `production.collectBuilding()`:

| | | |
|---|---|---|
| ![A Workshop panel showing a grid of craftable components and kits with question-mark icons, most disabled with a note listing which materials are missing, one (Roof Shingle) enabled.](screenshots/25b-workshop-craft-available.png) Craftable | ![A Workshop panel showing a Roof Shingle card with a progress bar partway full and the label Crafting.](screenshots/25c-workshop-craft-in-progress.png) Crafting | ![A Workshop panel showing a Roof Shingle card with a full progress bar, the label Ready to collect, and a Collect button.](screenshots/25d-workshop-craft-ready.png) Ready |

![A Workshop panel with an empty crafting queue and a green toast reading Collected Roof Shingle.](screenshots/25e-workshop-component-collected.png)
<br>Collected.

**3. Component → kit.** A Dairy Kit crafted from 2 Timber Frame + 2 Wall Panel + 3 Roof Shingle —
the kit tier of the same chain, one level up from the component tier above:

![A Workshop panel showing a Dairy Kit card with a full progress bar, the label Ready to collect, and a Collect button.](screenshots/25f-workshop-kit-ready.png)

**4. Kit → building.** With 1 Dairy Kit held, the Dairy card shows a checked kit and an enabled
Build button — while every other kit-gated building on the same list still shows the ❌ gate and
stays disabled. This is the gate commit `2b33dec` added: `BUILDINGS[x].kit` held
(`workshop.hasKitFor`) before Build is ever clickable, consumed only on a successful placement:

![A Workshop panel Build section: the Dairy card shows a checked kit and an enabled Build button, while other building cards show an unchecked kit requirement and are disabled.](screenshots/25g-workshop-build-gate.png)

![A Workshop panel Build section with a green toast reading Built Dairy, and no Dairy card left in the list.](screenshots/25h-workshop-building-placed.png)
<br>Built. Farm.place() placed it, workshop.consumeKit('dairy') consumed the kit.

**5. The payoff** — the real placed Dairy building, rendered in the world:

![A dairy building sitting on the farm, freshly placed.](screenshots/25i-workshop-dairy-in-world.png)

</details>

<details>
<summary><strong>World at different zoom levels</strong></summary>

| | |
|---|---|
| ![A wide, zoomed-out view of the farm showing the meadow, several fields and nearby buildings together.](screenshots/34-world-zoom-out.png) 0.5x (ZOOM_MIN) | ![A close-up, zoomed-in view of a few farm fields and ground texture.](screenshots/35-world-zoom-in.png) 2.5x (ZOOM_MAX) |

</details>

<details>
<summary><strong>Responsive layout: documented minimum vs. default window size</strong></summary>

| | |
|---|---|
| ![The game at its minimum supported window size, 1024 by 640 pixels, with a compact HUD and the Workshop panel open.](screenshots/36-narrow-width-layout.png) 1024×640 (documented minimum) | ![The game at its default window size, 1280 by 800 pixels, with the full HUD, dock, and the Workshop panel open.](screenshots/37-wide-width-layout.png) 1280×800 (real default) |

</details>


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
unlocked it. The dock itself carries five placeless surfaces — the daily wheel, appended at
boot by `ui.js`, plus four in the markup: decorate,
achievements, co-op/regatta, and settings — because everything else has a home in the
world. (See "Where it disagreed with the content plan" in `design/README.md` for how this
rule reshaped an earlier HUD dock design.)

## Getting started

<details open>
<summary><strong>One click, from a machine with nothing installed</strong></summary>

```
build.bat
```

It installs Node if the machine has none (user-scoped, through winget), runs `npm ci`, runs the
whole test chain, and then offers to launch the game. `build-installer.bat` does the same and
additionally packages the unsigned Squirrel.Windows installer, verifying afterwards that the
setup executable exists, that `RELEASES` was produced, and that the signature status really is
`NotSigned`. `download-dependencies.bat` is the dependency half on its own, though neither build
script needs you to run it first - they call it themselves.

Every one of them takes `/s` (or `--silent`) for an unattended run: no prompt, no launch offer,
and a non-zero exit on the first real failure, so CI or a script can branch on it.

</details>

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
roughly thirty other rule families in total — followed by the economy audit and nineteen
suites (`tools/test-camera.mjs`, `test-core.mjs`, `test-logistics.mjs`, `test-crafting.mjs`,
`test-township.mjs`, `test-research.mjs`, `test-deadtime.mjs`, `test-social.mjs`,
`test-ui-contracts.mjs`, `test-render.mjs` and the rest listed in `package.json`) that
exercise the actual running modules: planting and harvesting, offline catch-up, save/load
round-trips, the merge board, workshop crafting, trains/town/zoo, research, and the
simulated-neighbours social layer, the playable-item gate and all 46 verbs. 674 assertions
across 13 suites, all passing, as of this checkout.

Three further suites run against a REAL built artifact rather than the source tree and are not
counted in that figure, because they need an app to drive: `tools/verify-placement.mjs` (10
checks), `tools/verify-touch.mjs` (26, run against the Android WebView over a forwarded
devtools socket) and `tools/verify-persistence.mjs` (9, across two separate app launches so a
force-quit is actually tested rather than a page reload).

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
| `tools/capture-screenshots.mjs` | Drives the real built Windows artifact over CDP and captures the "Screenshots" section above, plus `screenshots/manifest.json` |
| `screenshots/` | The captured PNGs shown in "Screenshots" above, and their honest per-image manifest |
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

