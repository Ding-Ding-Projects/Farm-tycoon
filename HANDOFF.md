# Handoff

State of the repository as of commit `8e9c190` on `main` (this section is the newest; older sections are kept as written). Written to be read by whoever picks
this up next, so it records what is *not* done as carefully as what is.

## Session of 2026-09-03 (latest): the coach card, the shop panel, the HUD under the title bar

Three player-facing poke guys, all found by driving the real built application rather than by
reading the source, and all of the same family: something that looked entirely correct and was not.

**1. Next and Skip tutorial did nothing.** `checkAutoEvents()` runs on every animation frame and,
for any step anchored to a world object, called `render()`, which rewrote `bubble.innerHTML`. Both
buttons were destroyed and recreated roughly sixty times a second, so a `pointerdown` and the
`pointerup` after it landed on two different DOM nodes and the browser generated no `click` event
at all. Step 1 is not world-anchored, which is exactly why the first Next worked and nothing after
it did. `render()` now repositions freely and repaints only when the step actually changed, behind
`paintedIndex !== currentIndex`.

Measured with real dispatched clicks through the Chrome DevTools protocol, same script both sides:

| build | clicks that advanced the step |
| --- | --- |
| shipped build `v0.1.0-build84` | 1 of 6 (dead from step 2 onward) |
| after the fix, dev shell | 6 of 6 |
| after the fix, installed artifact | 6 of 6 |

Nothing else could see this. The hit test reported the button as the topmost element at those
coordinates on every frame, and a unit test that calls `advance()` directly passes either way.

**2. The Roadside Shop panel looked disabled.** `.sheet-panel` declared no `z-index` at all, so it
rendered below `.tutorial-overlay` (50) and the spotlight's `box-shadow: 0 0 0 9999px` dark ring
painted over the whole panel the tutorial had just told the player to open. It is now `z-index: 55`:
above the spotlight, still below `.modal-backdrop` (60). Its Sell button was mechanically fine and
opens the sell modal on a real dispatched click.

**3. The Electron title bar sat on top of the HUD.** `body.is-desktop { padding-top: 34px }` moves
normal flow and does not move a `position: fixed` element, and only `#world` had been compensated.
Measured in the built app before the fix: the bar covered **28px of the 62px level badge** and
**21px of every HUD pill**, and `document.elementFromPoint` at the top of the badge returned
`.title-bar-name`, which is a `-webkit-app-region: drag` region, so a click there moved the window
instead of doing anything. After adding `body.is-desktop .hud-top { top: 34px }` (and shifting
`.event-banner` to 130px so it still clears the HUD), the same measurement reports **0px covered**
on both and the hit test returns `.level-badge`.

**Also fixed, from the same audit:** `openRadial()` placed the ring at the raw tap point with no
clamping, so a structure near an edge threw half its options off-screen and one near the
bottom-right corner dropped the ring onto the dock, where the ring's own buttons take the clicks
meant for the dock's. The centre is now clamped into the viewport with room for the ring, its 52px
buttons and the label strip. `.radial-menu` also declares `z-index: 58` rather than winning only
by being later in `index.html` than the dock, which was nobody's decision.

**Guarded, and each guard was watched failing first.** `tools/test-tutorial-clicks.mjs` holds ten
assertions covering all of the above. Nine deliberate breakages were applied one at a time
(unconditional repaint, dropped `paintedIndex` assignment, removed reset-on-hide, removed sheet
z-index, removed HUD shift, removed event-banner shift, removed each radial clamp, removed the
radial z-index); every one turned the suite red and every restore turned it green.

**What the audit cleared.** A separate lane traced every function reachable from the
`requestAnimationFrame` loop looking for more instances of the rebuild-during-click defect and
found none: `updateHud` writes `ring.innerHTML` but behind a change guard and with no interactive
children, the minigame verbs build their controls once behind a `built` flag and afterwards only
mutate `classList`/`style`/`textContent`, and there is no `setInterval` anywhere in `src/`.

**Still open, deliberately.** The update banner (`z-index: 9100`, bottom-right) and the dock
(bottom-right) can overlap in the desktop build while an update is ready. It is real, it is rare,
and it is left as recorded rather than quietly patched, because the banner is the more urgent
surface and moving either one is a design call rather than a defect fix.

## Session of 2026-09-03: the Squirrel installer actually installs, and the game opens after it

Commit `5f7a200` (the merge carrying the fix) repaired three lines in `electron/main.cjs` that
made the Windows installer fail in two ways at once, and this pass then verified the repair
against a real built artifact rather than against the source.

**What was wrong.** The Squirrel guard read:

```js
if (process.argv.some((a) => a.startsWith('--squirrel-'))) app.quit();
```

`app.quit()` is asynchronous. Execution fell straight through the rest of the module, so
`app.whenReady()` still fired and a full 1280x800 game window opened *during the install*.
Squirrel waits about fifteen seconds for that process to exit, then abandons the install, which
is why an install could appear to finish with nothing in the Start Menu. Separately, the same
condition matched `--squirrel-firstrun`, the launch Squirrel performs the instant an install
completes, so the first launch was suppressed by the identical three lines. One mistake, two
symptoms, and neither of them names the other.

**What it does now.** Each event is handled by name. `--squirrel-install` and `--squirrel-updated`
invoke `Update.exe --createShortcut "<exe>" -l Desktop,StartMenu`; `--squirrel-uninstall` invokes
`--removeShortcut` with the same arguments; `--squirrel-obsolete` does nothing. All of them end
with `app.exit(0)` (immediate, unlike `quit`) followed by a top-level `return`, which is legal
because CommonJS modules are function-wrapped, so nothing downstream in the file runs at all.
`--squirrel-firstrun` deliberately falls through and boots the game like any other launch.
`build/icon.ico` was also added to `build.files`; `ICON_PATH` had been resolving to a path inside
`app.asar` that was never packaged.

**Verification, from the built artifact.**

- `npm run dist` clean: exit 0. `dist/squirrel-windows/` holds `Farm Tycoon-Setup-0.1.0.exe`
  (119,483,904 bytes), `RELEASES`, and `farm-tycoon-0.1.0-full.nupkg` (118,626,877 bytes). No
  delta package, which is correct for a first build at this version.
- `(Get-AuthenticodeSignature ...).Status` returns `NotSigned`. Code signing is permanently out of
  scope; the artifact is unsigned on purpose and will raise an unknown-publisher warning.
- The setup executable was run with `--silent` on this machine. It installed to
  `%LOCALAPPDATA%\farm-tycoon` with `app-0.1.0`, `packages`, `Update.exe`, `app.ico` and
  `Farm Tycoon.exe`.
- Shortcuts were created, and were checked on disk rather than only in the log:
  `Farm Tycoon.lnk` on the Desktop, and
  `Start Menu\Programs\Farm Tycoon Contributors\Farm Tycoon.lnk`. `SquirrelSetup.log` records both
  creations with the correct target and working directory.
- The installed `Farm Tycoon.exe` was then launched on an off-screen Windows desktop through the
  cheap headless route. It produced a window titled `Farm Tycoon`, class `Chrome_WidgetWin_1`,
  1280x800, and a `PrintWindow` capture shows the real game running: the frameless Material title
  bar, the coin/diamond/silo/barn HUD pills, the isometric farm, and the tutorial coach card at
  step 6 of 12. The capture lives in the session scratchpad and is not committed, because this
  repository holds no binary assets.

**One honest reading of that capture, so nobody files it as a defect.** The footer says
`v0.1.0 build date unavailable`. That is correct for a locally built artifact: `src/build-info.js`
ships `builtAt: null`, and only the release workflow's stamping step overwrites it, so a local
`npm run dist` is genuinely unstamped and the HUD says so rather than inventing a time. The
published installer carries a real stamp.

**Left installed.** The verification install was not removed, so the Desktop and Start Menu
shortcuts are still present on this machine. To remove it:
`& "$env:LOCALAPPDATA\farm-tycoon\Update.exe" --uninstall`.

**Numbers re-measured this pass**, replacing stale ones carried by the previous section and by the
documentation site: `npm test` summed across every suite reports **806 passed, 0 failed** (the
previous section said 799 at `c1dd36e`). The repository holds **269 commits**, **98 JavaScript
modules under `src/`** (43 at the top level, 46 verb modules, 4 minigame modules, 5 renderer
modules), and **71 published releases**. `docs/content/changelog.js` had been claiming 116
commits, 37 modules, 171 assertions and 28 releases; those four are now corrected. Its fifth tile
claimed 57 captures of the real build, and no capture directory exists anywhere in the tree or in
the docs site, so that tile was removed rather than restated with a number nothing backs.

## Session of 2026-09-02 — desktop shell catches up: title bar, auto-updater, two visible fixes

Commit `c1dd36e1e9764b370d00511248b6faf0b1ba1e36` added four things, all of them things the game
already claimed to do and did not:

1. **A custom frameless title bar for the Electron desktop build.** `electron/main.cjs` sets
   `frame: false`; `src/desktop.js` builds the bar itself — minimise, maximise/restore with a
   glyph driven by the real window state (pushed from the main process on every
   `maximize`/`unmaximize`, so an OS snap or a double-click on the bar is reflected correctly
   rather than assumed), a drag region, and the running app version.
2. **A Squirrel.Windows auto-updater.** Checks a stable GitHub release feed
   (`/releases/latest/download`, so nothing pins a tag) at boot and every six hours, and
   surfaces a ready update as a non-blocking banner with Restart/Later. The banner states
   plainly that the build is unsigned — code signing is permanently out of scope for this
   project, and a banner implying a verified publisher would misrepresent the one thing being
   asked of the user.
3. **The crop grow ring fills while the crop grows.** `src/main.js` now passes `progress` for a
   growing crop; previously the ring appeared only once the crop was already ready, directly
   contradicting the tutorial line that tells the player to watch it fill.
4. **A modal no longer shares the screen with the tutorial coach card.** `src/ui.js` adds
   `body.modal-open`; `styles.css` hides `.tutorial-overlay` while it is set.

**What this pass corrected in this document (previous claims that had gone stale):** the earlier
top-of-file state line below claimed 783 assertions across 20 suites at commit `17d205e`. A fresh
`npm test` run against this checkout at `c1dd36e` reports **799 passed, 0 failed** — summed from
the per-suite `N passed, 0 failed` lines, not read off the tail of the output, which only shows
the last suite. Nothing else in that older section needed correcting; the new total simply
reflects the assertions this commit's own test changes added.

**The installer verification gap above is now closed, with one exact piece left open.** A
separate verification lane launched the real Electron artifact headlessly on an off-screen
Windows desktop and confirmed, from captured images and a CDP session: the window is frameless
with our own title bar showing the icon, "Farm Tycoon" and "v0.1.0" plus three working window
buttons (window class `Chrome_WidgetWin_1`, 1280x800); the canvas and HUD render below the bar
with no clipping; the only console entry was Electron's own dev-mode insecure-CSP advisory, no
app errors and no exceptions; and the update banner correctly stays hidden on boot in an
unpackaged run, where the updater reports `unsupported`. The capture is committed at
`screenshots/11-desktop-title-bar.png`. The update feed itself was proven at the network layer
separately: `https://github.com/Ding-Ding-Projects/Farm-tycoon/releases/latest/download/RELEASES`
returns HTTP 200 with a real manifest naming `farm-tycoon-0.1.0-full.nupkg`, and that `.nupkg`
resolves HTTP 200 from the same base, so the stable feed URL the app uses does resolve.

**What remains genuinely unproven** is an end-to-end upgrade: no build has yet been installed
and then updated to a newer one. That is the one piece of this feature still open.

## Build stamp on the front screen

`index.html` now carries a `.build-stamp` element on the front screen, before navigation,
settings or the tutorial: the running version and when that exact build was made. `src/build-info.js`
holds the provenance (`version`, `builtAt`, `commit`) and formats it for display; `src/main.js`
paints it; `tools/stamp-build-info.mjs` rewrites `src/build-info.js` with the real version, the
UTC build instant and the commit, and the release workflow runs the stamper immediately before
packaging.

The behaviour worth understanding is the honesty rule, not the wiring. A source checkout is not
stamped, so it displays "build date unavailable" rather than falling back to launch time or a
file's mtime, because a fabricated build time answers the reader's question confidently and
wrongly. A stamped build shows the local date and time down to the second with the timezone
named, and the commit in the element's `title` attribute.

Covered by `tools/test-buildstamp.mjs`, 7 assertions wired into `npm test`, each proven by
deliberately breaking the thing it guards and watching it go red before restoring it. The full
suite now reports **806 passed, 0 failed**.

## Session of 2026-09-02 (later) — yum tong: five player-facing poke guys, then a release pass

Started from five complaints about the running game and the documentation site, then ran the
repository through a full close-out. Every figure below was read out of a real run, not recalled.

**State: 783 assertions across 20 suites plus the validator, zero failures · the game boots with
zero console errors · release `v0.1.0-build74+17d205ee910f` published from `17d205e` with a green
CI verdict · the local Squirrel installer rebuilds to 119,464,960 bytes and reports `NotSigned`.**

### The five complaints, and what each actually was

1. **"Tutorial clunky and no next button."** True and worse than it sounded. Ten of the twelve
   steps waited on a game event with no manual way past, and the other two advanced only if the
   player happened to click the bubble itself, with nothing on screen saying so. Every step now
   carries a 44px Next, a Skip and an `n/12` counter, and Next works on every step.
2. **"Poke guys preventing it from progressing."** Same cause as (1) - the steps that looked
   broken were the ones whose event the player could not find a way to fire.
3. **"Can't drag the map."** `clampCamera` clamped the eased camera and never the pan target
   that `input.js` writes. A drag into an edge kept pushing the target outside the legal box
   while the camera stood still, so the next drag back did nothing until the target had walked
   all the way home. Measured after the fix: eight drags into the east wall leave the target
   pinned at exactly 18.083 (the clamp limit) and the very next reverse drag moves.
   `clampCameraTarget` judges against the TARGET zoom - using the current one pins a
   simultaneous pan-and-zoom to the wide view's tighter box, and 12 of 22 structures become
   unreachable through the frame loop.
4. **"Can't open silo or barn to sell."** The HUD pills showed a number and were `<div>`s. They
   are buttons now and open the same panels, with the same Sell buttons, as the world structures.
5. **"Download page not visible."** It existed; it was the thirteenth item in a scrolling rail
   behind "More". It is a filled button in the documentation site's app bar on every page.

### What else this pass changed

- **`tools/serve.mjs` replaced `python3 -m http.server`.** That server sends no cache directives,
  so the browser heuristically cached every ES module and served a MIXED module graph - new
  modules linked against old ones. It surfaces as `The requested module './sprites.js' does not
  provide an export named 'prand'` for an export sitting plainly in the file, and as
  `economy.bonus is not a function` for a function that is right there. Two verification passes
  went chasing that ghost. If either symptom returns, suspect the cache before the code.
- **The release notes stopped lying.** Every release since Phase B landed described the game as
  "not yet playable", a scaffold whose renderer "is not implemented", installing to a
  "placeholder splash screen", with counts (14 crops, 7 animals, 50 levels) that were never true
  again. The status paragraph is rewritten and its numbers are now loaded from the generated
  `docs/content/data-counts.js`, whose own guard keeps it in step with `src/data.js`.
- **`build.bat`, `build-installer.bat`, `download-dependencies.bat`** at the repository root,
  each with `/s`. Proven end to end here: `build.bat /s` reports `771 passed, 0 failed` and exits
  0; `build-installer.bat /s` packages in 32 s and asserts `NotSigned` on the result.
- **`social-preview.png` at the root**, byte-identical to the docs `og:image`, guarded.
- **`tools/test-repo-surfaces.mjs`** - a hand-written inventory, because a rule-shaped check
  passes cleanly on a repository that has none of the files it checks. Watched red three times
  (remove build.bat; drift the preview by one byte; reinstate the stale release claim) and green
  again after each.

### Deliberately not done, with the reason

- **Vertical panning is about one tile at the boot zoom.** Raising `worldBounds`' `PAD` from 1
  does widen it and genuinely improves structure reachability, but it breaks the fits-branch
  guarantee that both diagonal bounds corners stay on screen - at `PAD = 2`, corner (8,8) lands
  at screen y = -16. Five camera tests encode that contract deliberately. The whole world already
  fits vertically at that zoom, so nothing is hidden; this is the framing guarantee working.
  Treat a pad change as a design decision, not a poke-guy fix.
- **The shared cross-project surface contracts are absent from this game.** Audited by grep and
  by reading: the three language modes, both funny-level sliders, School mode, the narrator,
  scheduled settings, the command palette, per-element appearance editing, toy locks and Support
  Tickets, the unlock ladder, the authenticator, ADHD modes, the personal-vocabulary upload,
  app-logo customization, the file converter, the Ollama manager, Status Hub reporting and the
  browser-extension download surfaces. `ROADMAP.md` carries the full list. This is the honest
  reason this close-out cannot claim a complete pass against those gates.

## Session of 2026-09-02 — bug hunt, realistic graphics, Hay Day drags

Eight commits on `claude/bug-fixes-realistic-graphics-j7gg1j`, each pushed to `main` as it
landed (the user asked for that cadence; see "Git" below for the release bot's part in it).
Every figure below was read out of a real run at `a220e43`.

**State: `SAVE_VERSION` 5 · 771 assertions across 19 suites plus the validator and the economy
audit, zero failures · game boots with zero console errors · median `drawFrame` 4.7 ms at zoom
0.5 on a 609-object farm in headless Chromium, 1.8 ms at zoom 1.7.**

### What landed, in order

1. **Renderer foundations** (`9a0c94c`). Every render object carries its footprint; a 2x2 bakery
   fills its plot instead of sitting as an 89 px hut on its north-west tile. One shared
   `farm.footprintOf`. The ground is a world-anchored pattern (`src/render/ground.js`, an 8x8-tile
   noise patch mapped through the iso transform) with per-tile tufts and flowers, so panning moves
   the meadow. Locked land is woodland with a for-sale signpost per expansion. Pens emit animals
   (`min(capacity, 5)`), owned pets appear by the barn. Effects fire on one clock. The placement
   ghost tints the tile it validates. Frustum culling, save/restore around each sprite, measured
   frame delta into the camera glide.
2. **Economy, storage, counters** (`e52e749`). `src/storage.js` is the one door into the silo and
   barn: capacity with research/co-op bonuses, room, add-or-pay-the-shortfall, take, and the
   `STORAGE` upgrade ladder with an Upgrade card in each panel. Every "no room" path refuses
   before consuming (harvest keeps the crop, merge keeps the cell, the mine keeps the tool,
   foraging keeps the node, fishing keeps the cast). Newspaper and market charge per unit (the
   6.6x coin exploit is closed) and never list kits or components; orders, boat, trains and
   planes never demand them. Mine depths respect their level gates. Pens cost
   `penCost + animalCost × capacity`. A player who misses regatta seasons no longer wins them.
   Eleven dead stat counters are incremented at their real action points, collection books fill
   from real actions, every research and event effect has a consumer, and the event banner is
   wired with a per-tier claim panel. `tools/test-tables.mjs` guards that every `stat:` and
   `pointsFor:` key in `data.js` is tracked somewhere in `src/`.
3. **Reachability, UI and input** (`0314780`). Land expansions are bought by tapping the woodland
   or its signpost; decorations are sold from a grid in the workshop panel; every unlocked crop
   is plantable (radial shows seven plus "More…", which opens the `plant` sheet); the workshop
   yard opens at level 2 with pens and coin-only buildings always offered, so the chicken coop,
   bakery and feed mill are buildable when they unlock; the tutorial targets world objects and
   describes the real interactions, with a guarded finish and a Skip in Settings. `openModal`
   has `role=dialog`, Escape closes the top-most modal first, and leaving a minigame mid-stage
   tears it down through its own shell. `pointercancel` never commits a placement, the key
   handler ignores editable targets, a third-finger lift re-seeds the pinch. The XP ring is
   live (`--xp`), fishing has a steady mode under reduced motion, mastery cards show building
   names, the panel search box survives `refreshPanel`. `load()` default-fills every key a v1
   save lacks; `debugTimeSkip` shifts the real timer fields of every system.
4. **Hay Day drags** (`bb6193c`). See "The drag model" below.
5. **Art, four commits.** `7493b5b`: one light over the farm — raised slabs under buildings and
   structures, lit and shaded wall faces, ambient occlusion at the base, roof gradients, glass
   with a reflection, loam soil with wavy furrows and clods, water with depth, ripples and a
   specular streak on the frame clock. `9465bc9`: every one of the 54 decoration ids has its own
   sprite family, fountains and windmills and carousels animate, fences join their same-type
   neighbours into continuous runs. `028ada2`: the day follows the player's clock
   (`src/render/daylight.js`: dawn, noon, dusk, a night bounded at 0.3 alpha with lit windows
   and glowing lamps; the Settings toggle off restores the fixed golden hour exactly), a cool
   distance haze, and three cloud shadows drifting in world space, frozen under reduced motion.
   `a220e43`: crops stand in rows along the furrows, each stem with its own height, lean and hue,
   two-tone ripe heads, continuous growth.

### The drag model

`src/drag.js` is one layer for three kinds of drag, fed by the existing `window` pointer
handlers in `src/input.js` (`input.handlers` is exported so the contract suite can feed it
synthetic events):

- **`place`** — a catalog card in the workshop panel (`ui.draggablePlaceCard`). A press that
  never moves past the tap threshold (6 px) is the card's own click, so tap-to-place still works.
  Once it moves, `placement.begin` runs, the sheet closes and the canvas ghost follows the
  pointer. Release on a legal tile commits (charged exactly there, with a bounce); release on a
  blocked tile leaves the ghost up for tap-to-place and charges nothing, so a crafted kit is
  never lost. `pointercancel` abandons with nothing spent.
- **`item`** — a recipe card dragged onto its own factory (`ui.recipeDragSpec`), or the pen
  ring's Feed/Collect dragged onto a pen (`actions.feedDragSpec` / `collectDragSpec`). A floating
  DOM icon (`#drag-ghost`) follows the finger; the renderer tints the footprint under it green or
  red exactly as the placement ghost does (`world.dropTarget`). Factories draw their queue as
  slot pips above them so there is a visible slot to drop into.
- **`sweep`** — a seed or the basket pulled off a field's ring (`actions.plantSweepSpec` /
  `harvestSweepSpec`): every eligible field the stroke crosses is sown or harvested, one toast
  and sparkle per field; release does nothing by itself, so a stroke that crossed nothing costs
  nothing. A plain tap on the ring option still acts on that one field.

Nine gesture tests in `tools/test-ui-contracts.mjs` pin all of it (press/move/release helpers at
the top of that block). The tutorial texts in `data.js` describe the drags with the tap
alternative in the same sentence.

### Verification

- `npm test` at `a220e43`: validator + economy audit + 19 suites, **771 passed, 0 failed**
  (`test-ui-contracts` 148, `test-render` 32, `test-core` 40, the rest as printed). Two suites
  are new this session: `tools/test-render.mjs` (footprints, sorting, the ghost, ground fallbacks,
  scenery, effects clock, every sprite on the fake context, decoration families and joins, the
  day/night cycle, cloud shadows, water, crops, and two source guards) and the WS3/WS5 blocks
  in `test-ui-contracts`.
- Headless Chromium probes, all with zero console errors, live in the session scratchpad and
  are not committed (they need a running `python3 -m http.server 8123` and the preinstalled
  Chromium): harvest → effects → reload; land offer, plant sheet, silo upgrade, workshop at L3,
  event banner, tutorial anchoring; the four drags; art screenshots at three zooms plus a
  building contact sheet, a decorations contact sheet (all 54 at two clock values), nine crops
  at three stages, noon/dawn/dusk/night and a pinned cloud (grass under it 14% darker); and
  the timing probe quoted above (3–4 gradient allocations per frame; the p95 spikes are
  headless rasterizer flushes, not drawing).

### Git, and the release bot

`.github/workflows/release.yml` runs on every push to `main`, builds the Windows installer, and
then **commits a line to `RELEASE-CODENAMES.md` on `main`**. So every push to main is followed
minutes later by a bot commit, and the next `git push origin HEAD:main` is rejected as
non-fast-forward until that commit is merged into the branch. The sequence that works: commit
→ `git fetch origin main` → `git merge --no-edit origin/main` → quick test → push the branch →
push `HEAD:main`. Three such merges are in this branch's history. Earlier in the session two
pushes to main were rejected this way and misread as successful; check `origin/main` after
every push rather than trusting the local ref.

### Traps worth not rediscovering

- `npm test` run from any other directory (the scratchpad has its own `package.json`) reports
  "no test specified" with exit 1 — that is not a failing suite.
- `tools/test-motion.mjs` drives `drawBuilding` through a Proxy context whose every method
  returns `undefined`; every gradient must go through `linearGradient` / `radialGradient` /
  `fillUnit`, which fall back to a flat colour. `test-render` guards that no bare
  `createLinearGradient` survives in `sprites.js`, and that no `lineWidth = <number>;` literal
  does either (sizes are in `T` units so they scale with zoom).
- `tools/test-placement.mjs` parses `BUILDING_CONFIG` as text: one line per entry, and a new
  `form`/`accent` name has to be added to its lists.
- `tools/test-ui-contracts.mjs` fakes the DOM by hand: `innerHTML` is a string, and the selector
  fake only resolves a single `.class`, `#id` or tag, so `panelsearch` never attaches there.
  Search-memory tests live in `tools/test-panelsearch.mjs` with their own DOM fake.
- In a probe, `renderer.focusTile` alone is undone by the camera glide on the next frame; set
  `renderer.cameraTarget` instead. `window.__farmDebug.setHour(h)` pins the day/night cycle.
- The daylight keyframes are sampled at whole minutes so the cached lighting layer repaints
  once a minute; interpolating per frame would repaint a full-canvas offscreen layer every frame.

### Not done — deliberately

- `decorate.js` rotate/undo/redo/stickers: no UI reaches them and `rotation` is not rendered.
- `farm.remove()` kit refund: no caller.
- The verb-load failure button in `minigames/shell.js`: defence in depth, all 46 verbs load.
- A per-crate helicopter manifest UI: only the exclusion fix (never auto-load a kit) landed.
- Crops are not clipped to their plot; like Hay Day's they overhang the north edge a little.
- The haze and cloud shadows have no toggle; only the day/night cycle does.
- The white-on-green button contrast finding from the previous session is unchanged.
- Balance of the new prices (pens at `penCost + animalCost × capacity`, per-unit market and
  newspaper) follows `data.js`'s documented intent and was not re-tuned against progression.

### Suggested order for the next session

1. Play it by hand on a touch device. Every drag was verified with synthetic pointer events in
   headless Chromium; a thumb on a phone is the real test of the 6 px threshold and the sheet
   closing mid-drag.
2. Re-tune the prices above against the level curve if they feel wrong in play.
3. The items in "Not done", in the order listed.

## Session of 2026-09-01 — content completion, then an accessibility sweep

Twelve commits on `input-families`, all dewed. Every figure below was read out of a real run at
`683e95d`, not carried over from the previous handoff.

**State: 49 buildings · 215 recipes · 279 goods · 46 verbs · 44/151 playable (1 in 3.4) ·
674 assertions across 19 suites, zero failures.**

### What landed

**The wiki factory roster is closed.** The last five arrived: net maker (30), lobster pool (44),
duck salon (50), doner kebab stand (54), pasta maker (67). Two levels deliberately differ from the
wikis, and both are supply-chain decisions rather than transcription: the kebab stand is at 54
because lamb does not exist here until 53, and the pasta maker sits UPSTREAM of the level-72 pasta
kitchen, extruding dry shapes the kitchen then cooks — which is also why it cannot take
`fresh_pasta` as an input.

Five new verbs, each earning its slot against the neighbours in a family that already had two to
five members. `batch_dies` is the one that nearly failed the way `work_rush` did: at the duration
first written, first-come-first-served TIED batching on nine seeds of twelve. The clock came down
to 13500ms, and the gap is now a guard — if it ever closes again the verb should be cut, not tuned.

**Both open audit findings are closed.** The `tea_house`/`oil_press` inert-unlock gap is fixed and
structurally guarded, and the multi-hop kit arbitrage is proven dead: `tools/test-economy.mjs`
expands all 46 kits to raw leaves following the cheapest producing recipe at each step, and the
best kit margin in the game is `kit_paper_mill` at **minus 35 coins**.

**23 dead recipes revived.** Syrup turned 76 coins of sugar into 78 over a full hour. Each was
lifted by the smallest amount clearing both a coins-per-second floor and the project's own
documented 1.6x rule, iterated to a fixed point because butter, cheese and sugar are inputs to
other recipes. Worst margin in the game went from 0.0006 to 0.010 per second.

**Three new player-facing surfaces.** The Bake Book (every playable recipe, best tier, and which
VERBS remain unmastered — skill is per verb while quality is recorded per recipe). A search bar on
every panel with six or more cards, attached from one line at the end of `renderPanelContent` so
new panels get it for free. And a one-time explanation of the playable-item gate, because nothing
told a player that roughly one recipe in three cannot be collected any other way.

### The accessibility sweep, which found the most

Swept all 28 panels for controls with no accessible name. **Merge Meadow had 57 of 63 unnamed** —
every cell a bare button, empty ones with no text, no title and no label. Selection was an outline
and nothing else, and all 63 cells were tab stops. Now: every cell names its position and contents,
`aria-pressed` on the picked-up one, one tab stop with arrow keys, and focus returns to the cell
that was acted on.

**The whole game had four focus rules and three were mine from earlier the same day.** Everything
else relied on the browser default, on an interface where nearly every control already carries a
3px near-black border for that ring to hide against. Interactive chrome now gets a two-ring
`:focus-visible` indicator.

**Reduced motion never reached the canvas.** `styles.css` had honoured it from early on, which made
it look handled; the world is a canvas, so the factory machinery, coin bursts, XP floaters,
sparkles and camera easing all ignored it. `src/motion.js` is now the single answer, with a
`matchMedia` listener so mid-session changes take effect at once. `working` stays true and only the
clock freezes, so a busy factory keeps its lit lantern and four-puff plume rather than going idle.

**Touch targets: 33 controls under 44x44, every one of them in the search bar I had added hours
earlier.** The rest of the game was already clean.

### The one thing measured and deliberately NOT fixed

White button text sits at **1.77** against the light end of the default green gradient, **1.47** on
gold, **1.89** on gem, **2.57** on danger. AA wants 4.5. The `quiet` variant is fine at **7.08**
once its translucent fill is composited properly — it first measured 1.19 because the comparison
was against the overlay rather than the result.

Unlike everything else in the sweep this has no repair without a cost: darkening the fills until
white passes needs roughly `#3E7A19` throughout and turns a candy button forest-green, while
switching to dark labels and lightening the fill measures 7.06 and keeps them bright but changes
every button in the game. Both rewrite the look the design brief asked for, so it is the owner's
call. Numbers and both routes are in `ROADMAP.md`.

### Traps worth not rediscovering

- **`timeSkip` is milliseconds.** Cost time twice in one session, once producing a recording where
  every harvest said "Still growing".
- **A `.modal-card` element exists empty at all times**, so "a modal is present" is true before
  anything opens. Check its text, not its existence.
- **Cache-busting an import gives a DIFFERENT module instance** from the one the app's modules
  hold, so a test flag set on one has no effect on the other. Verify module-level state in Node.
- **`test()` here is synchronous**, so returning a promise from it marks the test passed before the
  assertion runs. One guard was written that way and could never have failed.
- **Guards anchored to a substring pass on a commented-out line.** Anchor to the start of a line.
- **`localStorage.clear()` does not give a fresh save** — autosave rewrites it.

### Not done

- The release keystore and a signed APK. The Gradle config is wired and the build script injects
  it; only the key is missing, and it is a credential the owner should generate.
- The GitHub Pages site still carries neither the screenshots nor either recording, though both
  recordings are committed and linked from the README.
- The button contrast decision above.

## Where the project actually is

**Phase B is complete.** Every module contract in `src/` now has a real implementation body.
`grep -r "/\* Phase B \*/" src/` — the exact marker earlier drafts of this file counted — returns
nothing across all 37 files. The handful of remaining textual mentions of "Phase B" in the source
(`src/main.js`, `src/state.js`, `src/ui.js`, `src/render/renderer.js`) are historical/contextual
comments, not stub markers; quoted here so the next reader doesn't have to re-derive that:

- `src/main.js:80` — `/** Run every timer/tick module's tick(now), defensively — Phase B stubs are
  safe no-ops. */` (defensive comment; there are no stubs left to be safe against)
- `src/render/renderer.js:19` — a comment noting the camera fix is a *real* implementation, not a
  stub, contrasted with the old state
- `src/state.js:33,88,168` — describing why the state shape was seeded ahead of the modules that
  would fill it in

**What the built application actually does, verified by loading it at commit `013509a`, in a
browser, at `http://127.0.0.1:8123`** (use the loopback address — a stale server bound to IPv6
`localhost` will otherwise serve a cached older page, which cost real time to notice):

- Zero console errors.
- `window.__farmDebug` exists and exposes `{ state, timeSkip, give }` against the live,
  mutating game object — not a static readout. Observed on a fresh load: level 1, 150 coins,
  6 diamonds, a silo holding 7/50 wheat seeds, an empty 0/50 barn, and 6 farm objects.
- `styles.css` at the repository root is the "Sunlit Homestead" overhaul — byte-identical to
  `design/handoff/styles.css` apart from line endings (root is CRLF, the design reference is LF).
  The design pass is applied to the running game, not sitting unintegrated in `design/`.
- The dock carries five placeless surfaces. FOUR are in `index.html` - decorate, achievements,
  co-op/regatta
  (hidden until unlocked), settings — matching the "systems open from their world structure"
  interaction rule.
- `SAVE_VERSION` is **3**. `newGameState()` seeds every subsystem key — `workshop`, `minigames`,
  `neighbours`, `coop`, `regatta`, `expeditions`, `museum`, `lab`, `helicopter`, `islands`, `mine`,
  `town`, `zoo`, `merge`, `trains`, `airport`, `foraging`, `newspaper`, `collections`, `decorate`,
  `photo` — so no module ever has to branch on whether a state key exists, only on whether it holds
  anything yet. Two migrations exist and were read, not assumed: `1→2` defaults `merge`/`trains`/
  `airport` for a save that predates them; `2→3` defaults `town`/`zoo`/`market` the same way. Both
  leave every other key on the object untouched.

## Verification state

`npm test` runs the content validator (`tools/validate-data.mjs`) followed by eight gameplay-logic
suites. Real output from this checkout:

```
data.js OK - 24 crops, 12 animals, 49 buildings, 215 recipes, 279 goods, 3 merge
chains, 43 achievements, 95 levels all with unlocks, 10 weekend events + 6
mini-events + 25 fair tasks + 6 holidays, town: 16 houses + 10 community, 14 zoo
enclosures, 8 islands, 23 materials
playable share: 44/151 recipes (1 in 3.4), 46 verbs - at the 1-in-3 target
```

followed by eight suites (`test-camera`, `test-core`, `test-logistics`, `test-crafting`,
`test-township`, `test-research`, `test-deadtime`, `test-social`) reporting `13`, `27`, `19`, `23`,
`10`, `15`, `16`, and `24` passed respectively — **147 passed, 0 failed**, `npm test` exits 0.
These exercise the real running modules, not just `data.js` shape: planting/harvesting through
`production.tick`, offline catch-up, save/load round-trips, the merge board, workshop crafting,
trains/town/zoo, research, and the neighbours/co-op/regatta social layer.

World-structure placement was independently re-verified here rather than only trusted from the
suite: all 22 entries in `STRUCTURES` resolve to themselves from their own tile, across 101
occupied tiles, with zero overlaps and every panel id unique. Twenty of the twenty-two are locked
at level 1 and still present/clickable — confirmed against `LEVELS.unlocks`.

CI (`.github/workflows/release.yml`) is real and green for this exact commit: `gh run list`
reports `conclusion: success` for the workflow run against SHA `013509a...`. The latest published
release, `v0.1.0-build18+013509a4a7f6`, is `isDraft: false`, `isPrerelease: false`, targets this
exact commit, and carries a genuine `Farm.Tycoon-Setup-0.1.0.exe` (119,255,552 bytes), the full
`.nupkg`, and a `RELEASES` index — checked via `gh release view --json assets`, not assumed from
the workflow's own "success" label. CI does not run tests as a release gate; that is this
project's standing policy (see the comment in `release.yml`), not an oversight — `npm test` is the
local gate, run before every push.

## What landed in the content expansion

Nine commits, sourced from the Hay Day and Township community wikis. Unchanged since the last
handoff — `src/data.js` has had only unlock-ordering and margin fixes since (see "Audit findings"
below), not further content growth.

| | Before | Now |
|---|---|---|
| Crops / animals | 14 / 7 | 22 / 12 |
| Buildings / recipes | 15 / 52 | 26 / 128 |
| Goods / materials | 85 / 9 | 192 / 23 (four purpose-scoped sets) |
| Town houses / community | 10 / 6 | 16 / 10 |
| Zoo enclosures / islands | 8 / 4 | 14 / 8 |
| Levels / achievements | 50 / 21 | 95 / 39 |

New systems, all now implemented behind their module contracts: Building Workshop and kits,
per-factory minigames, simulated neighbours, co-op with a request board, weekly regatta,
expeditions, artifacts and museum, permanent research laboratory, helicopter, tiered mine depths,
foraging, newspaper, collection books, building mastery, decorating and photo mode, plus 22 placed
world structures.

### The two mechanics that make this not a clone

1. **Buildings are crafted, not bought.** Materials → components → a building kit → the factory.
   Both source games sell factories for coins, which leaves their material economies shallow.
2. **Every production building has its own minigame**, with an effect only that factory has.
   Optional bonus layer, never a gate — gating a recipe on hand-eye skill would break the idle
   contract and punish offline play.

Plus one interaction rule: **systems open by clicking their structure in the world**, never from
the HUD or dock. Locked structures are derelict but still clickable from level 1, so the map is
the roadmap.

## Corrections on the record

Three balance conclusions in an earlier session were wrong, each because the metric was wrong.
Kept verbatim because the reasoning, not just the number, is the useful part:

1. A claimed **20x mid-game grind wall** — an artefact of weighting one crop field like one
   building slot. Corrected: 129 h / 721 h / 1883 h across the three bands, an ordinary curve.
2. The **piecewise XP curve** was justified as making the endgame reachable. It saves 5%. The
   number of levels dominates, not the exponent. The curve stays because it is harmless, but it
   is not the fix it was sold as.
3. **"Wheat-spam breaks late crops"** — true only for a player tapping every two minutes. At any
   real check-in cadence late crops win by 4–14x. No values were changed; the reasoning is
   recorded above `CROPS` in `data.js` so it is not re-derived wrongly a fourth time.

Commit `ceed28b` still carries the wrong 20x figure. A commit message cannot be fixed without
rewriting history, so it stays wrong and this document is the correction.

## Packaging and fonts

- **The Windows installer is Squirrel.Windows**, not NSIS, and it is now a *shipped* build, not
  just a validated config: the published release above carries a real 119,255,552-byte
  `Setup.exe`, `RELEASES`, and the full `.nupkg`, built by the same `npm run dist` command anyone
  can run locally. Verified `NotSigned` with no signer certificate, which is the permanent policy,
  and the unknown-publisher warning that follows from it is expected.
- **There is a real application icon.** `tools/make-icon.mjs` generates it in pure code — no
  downloaded art, consistent with the project's vector-art convention — and emits a genuine
  multi-size `.ico` (magic `00 00 01 00`, five images at 16/32/48/128/256) plus a 512 px master.
  `build/` is globally ignored, so the two icon files are explicit `!` exceptions in `.gitignore`;
  without that the icon reference breaks on a fresh checkout.
- **The two design fonts are vendored locally**, 27 faces / 947 KiB, via `tools/vendor-fonts.mjs`,
  used by both the game (`fonts/`) and the GitHub Pages site (`docs/fonts/`, imported via
  `docs/styles.css`'s local `@import`, no CDN). It is a script rather than a manual download
  because one family query returns 27 `@font-face` blocks across weights and `unicode-range`
  subsets; hand-vendoring "two fonts" would ship two files and silently drop every non-latin
  subset.
- **`index.html` and `docs/index.html` load no fonts over the network.** `index.html` had done so
  since the scaffold, against this project's own no-CDN rule — a pre-existing defect found while
  verifying the vendoring and fixed since.

Two verification lessons from that work, worth keeping because both produce false confidence:
`document.fonts.check()` returned `true` for all eight weights while **zero** faces were
registered, so it cannot be trusted alone; and a `FontFace` probe reported a network error only
because the filename had been guessed rather than read off disk.

## Audit findings — read this before trusting the content

An adversarial audit ran 99 mutation probes against the validator, several sessions ago. **51
guards fired correctly**, including material sets, expansion geometry, storage trios, kit
integrity, minigame integrity, the orphan/sink audit, the museum bijection in both directions,
expedition loot arity, mine depths, lab acyclicity, structure placement, and the co-op/regatta
pools. The `MINE.tools` identity check is genuinely load-bearing — the audit's own deep clone
tripped it on the first control run.

It also found real defects, all fixed and re-verified independently rather than taken on trust:

1. **Nine of 23 materials had no source anywhere.** Fixed in `895e7a6` — trains, the airport and
   the helicopter now carry weighted `materialPool` tables. Re-verified: zero unsourced materials.
2. **No structure stood on land the player owns.** Fixed in `5b56e2e` — all 22 structures were
   misplaced, not the four originally named; ten early structures now hug the start zone's edges.
   Re-verified: zero structures on land that unlocks too late, zero straddles.
3. **The guard for #1 originally lied** — it claimed to check both the spend side and the earn
   side of the material economy while only implementing the spend side. The earn-side guard now
   exists and is correctly not fooled by removing a material from one of its two pools.
4. `checkMaterials` accepted a `requiredSet` but was called with `null` for houses, community
   buildings, zoo enclosures and milestones. Fixed — all six consumers are now checked.

Two further findings from that audit were still open as of the previous handoff. Both have since
been substantially addressed by commits `ce58198`, `9cea1c9`, `9e672ca`, and `523ae84` — verified
here directly, by recomputation against the current `src/data.js`, not by re-reading commit
messages:

5. **Recipes unlockable before their inputs, and buildings inert on unlock.** Every recipe now
   carries its own `unlockLevel`, and `tools/validate-data.mjs` rejects any recipe whose
   `unlockLevel` sits before the true earliest availability of its inputs (0 violations on the
   current data — this is what the audit's "70 recipes" count was measuring, and it is now
   structurally guarded, not just fixed once). Re-checking the three buildings the audit named
   directly: `build_workshop` no longer sits inert on unlock (unlock level 6, earliest usable
   recipe also 6 — was inert for 15 levels). `tea_house` and `oil_press` are now fixed too.
   Both opened before the crop they exist to process, and in both cases the recipes were correctly
   gated on their inputs while the BUILDING arrived early: the oil press three levels before
   olives, the tea house six before tea leaves. Both moved to meet their first usable recipe (oil
   press 52 → 55, tea house 56 → 62) rather than dragging the crops forward, because a crop's
   level is part of its own balance and has other consumers. `validate-data.mjs` now refuses ANY
   building whose earliest recipe outranks its own unlock level, so this cannot come back;
   reintroducing the oil press defect turns it red with the exact original numbers. It is not the
   "70
   recipes" problem, which is closed.
6. **Non-positive recipe margins.** Recomputed directly against the current data with the same
   sell-value logic the validator uses **as of the 128-recipe content set**: 0 of 128 had a
   non-positive margin among
   non-sink recipes** (was 45). Every Building Workshop component and kit recipe (41 of them) is
   now explicitly tagged `sink: true` and exempted from the margin check by design — a sink is a
   (The corpus has since grown to 215 recipes across 49 buildings. That audit has NOT been re-run
   over the newer content, so treat the figure above as a result about the set it was measured
   on, not a standing property of the game.)
   good meant to be consumed, not resold, exactly like feed. Checking those 41 sink recipes
   directly against a single-hop raw-input-cost comparison (cost to buy the recipe's direct inputs
   at their own sell price, vs. the recipe's own sell price), 40 of 41 now cost more to craft than
   they would fetch selling directly; one, `shingle` in `build_workshop`, still nets a small +5.
   **RESOLVED.** `tools/test-economy.mjs` now expands every kit to its raw leaves, following the
   CHEAPEST producing recipe at each step so an exploit cannot hide behind an expensive sibling.
   The best kit margin in the game is `kit_paper_mill` at **-35 coins** (raw 555, sells 520), and
   nothing is profitable even with every input bought at the market's 1.4x. The original ~9,800
   scenario is re-run by name on every `npm test`. Nothing is underwater on direct inputs or on
   fully expanded raw inputs either.

   What the same tool DID surface is a balance gap rather than an exploit: coins per second of
   queue time spans twelve to one, and `syrup` turns 76 coins of inputs into 78 over a full hour.
   That is printed on every run and recorded in `ROADMAP.md`; it is a design decision, so the
   tool reports it instead of failing on it.

Verified TRUE by the original audit and unaffected by any of the above: the 16 rects tile the grid
to exactly 100% with zero gaps and zero overlaps; 22 structures; every crop has a sink; 26
factories with 26 distinct minigame effects; no duplicate ids; no recipe input cycles;
`unlockLevel` agrees with `LEVELS.unlocks` everywhere.

## The building system, and Android

Two large pieces landed after the content expansion above. Both are described here because neither
is discoverable from the code alone: each fixed something that looked correct in source and was
wrong in the running application.

### Buildings are placed by the player now

`ui.js`'s `buildAt()` used to call `findFreeTile()` and drop each new building on the first fitting
tile it scanned. Nobody chose. Once the start zone filled front-to-back you got "No free space" with
no way to rearrange, because `decorate.js` had shipped `select`/`move`/`rotate`/`undo`/`redo` with
**zero callers** while the dock toggled a mode and toasted "drag decorations to arrange your farm".

`src/placement.js` is the missing half. It is DOM-free, so `input.js` drives it and `renderer.js`
draws its ghost, and nothing in it touches the document. Legality is never colour-only: the
footprint tints, the outline goes dashed, and a cross paints over a blocked one. Arrow keys nudge,
Enter places, Escape cancels, which matters more than usual because the automatic path it replaced
is gone. A blocked tile is a no-op rather than a failure, so a mis-tap cannot throw away a crafted
kit.

`tools/verify-placement.mjs` drives the real running app for this, because a rules module tested
through its own API says nothing about whether anything calls it.

### Buildings look different, and look busy

All 49 factories used to be one box, one gable roof and one of five accents, keyed only by roof
colour. They now pick a roof form (gable, hip, flat, domed, sawtooth, pagoda, barrel, kiosk, tower)
and hang real furniture off it, and `drawBuilding` takes `{ working, now }` so a factory animates
ONLY while a craft is genuinely running. An idle one is completely still, which makes "is that one
busy?" answerable from across the farm without opening a panel.

`tools/capture-buildings.mjs` renders all 44 idle and working side by side. That contact sheet is
what found floating flat roofs, detached silos, spike towers and crescent pagodas, none of which
were visible from the code.

### Android

The app builds, installs, launches and plays on an emulator. `node tools/build-android.mjs` is one
command; add `--release` once a keystore exists. Read `ANDROID.md` before touching any of it: its
header records three traps that each cost real time because the error message pointed elsewhere,
and one dead end (a spaced repository path) that was suspected, investigated and turned out to be
innocent.

The single largest fix there is invisible from the game: `capacitor.config.json` had `webDir` set
to `"."`, the repository root, so the APK would have shipped `node_modules` (639 MB), `.git`,
`design/` and `screenshots/` to anyone who installed it. `tools/build-web.mjs` stages the four
things the game actually loads, at 1.8 MB, and refuses to continue if either ever reappears.

Three defects were found only by running it on a device, because `env(safe-area-inset-*)` is zero
everywhere else and a desktop window narrowed to phone width still has a mouse:

- There was **no pinch handler at all**, and a phone has no wheel, so the camera could not be
  zoomed by any means on an isometric world that does not fit a 390px screen.
- The HUD counters overflowed at six-digit coin values, which is ordinary mid-game play.
- Every minigame stage was exposed to the WebView's own scroll and pinch, either of which fires
  `pointercancel` and ENDS a run. Drag, path, balance and steer verbs are all "a finger dragging
  across a stage", so that was most of the library.

### What the verification tools are for

Three suites run against a real built artifact rather than the source tree, and are deliberately not
counted in the `npm test` total because they need an app to drive:

| tool | what it proves |
|---|---|
| `verify-placement.mjs` | the ghost is wired into ui/input/renderer, not merely implemented |
| `verify-touch.mjs` | 26 gesture and layout checks, run against the real Android WebView |
| `verify-persistence.mjs` | the save survives the process being killed, across two app launches |

`verify-persistence.mjs` is deliberately not a page reload: a reload keeps the renderer and its
storage cache alive and therefore proves nothing about a kill. Writing it turned up that
`localStorage` commits lazily, so a force-quit seconds after a save loses it and the game reloads
the previous one. `main.js` now saves on `pagehide` and `visibilitychange` as well as
`beforeunload`, which is documented as frequently never firing on Android at all.

## Newly closed since the last handoff

Two items that were open problems in the previous version of this document:

- **The state-shape gap.** `merge`/`trains`/`airport`/`town`/`zoo`/`market` are now seeded by
  `newGameState()` directly rather than left to be lazily created by each module's own
  `ensureState()` helper on first use. `SAVE_VERSION` bumped to 3 with the two migrations
  described above. This closes a real class of bug: a module reading `state.town` before anything
  had called its own lazy initializer would previously have hit `undefined`.
- **The CI ledger race.** The release workflow's "Publish GitHub Release" step now runs before its
  "Commit updated release code-name ledger" step (previously the reverse). A failure in the
  bookkeeping commit — a transient git/network error, a merge conflict on the ledger file — can no
  longer prevent a release that already built successfully from existing. Verified by reading the
  step order in `.github/workflows/release.yml` (`Publish GitHub Release` at the step before
  `Commit updated release code-name ledger`) and by the real release history: `v0.1.0-build18` and
  `v0.1.0-build17` both exist and are non-draft.

## Not done — the honest list

- **Screenshots exist now, and a recording still does not.** `screenshots/` holds real captures
  from the built artifacts: the 44-building contact sheet, the placement ghost mid-drag, and four
  taken straight off an Android device with `adb exec-out screencap`. A screen recording now
  exists too: `screenshots/farm-tycoon-android.mp4`, 25s of the installed APK being played by real
  touch on an Android 14 device. The old text below is kept because its warning has not expired -
  a reference to a file that isn't in the tree is worse than no image.
- **Both of the audit points above are now closed.** The tea_house/oil_press unlock-inert gap is
  fixed and structurally guarded, and the multi-hop kit arbitrage is proven dead by
  `tools/test-economy.mjs` (best kit margin -35 coins). What replaced them is a balance finding
  rather than a defect: coins per second of queue time spans twelve to one, and the bottom of the
  table is not worth crafting. That is printed on every run and tracked in `ROADMAP.md`.
- Regatta league reward tables, Township community buildings past level 70, and per-expansion
  cost numbers were never independently verified against the wiki — they were sourced from
  wiki text and images and taken at face value.
- Phase B's original plan (see `CLAUDE.md`'s history and `PLAN.md`) called for the implementation
  to land on branch `claude/windows-hay-day-game-cfctdb` with a draft PR. That did not happen —
  every Phase B commit landed directly on `main`, the same way the scaffold did. Recorded here so
  nobody goes looking for a branch or PR that does not exist; `git branch -a` on this checkout
  shows only `main`.

## Suggested order for the next session

1. The GitHub Pages site still shows neither the screenshots nor either recording, although both
   recordings are committed and linked from the README.

   Worth knowing before touching the UI: `panelsearch.attach(container)` at the end of
   `renderPanelContent` is the ONLY thing giving every panel a search bar. It is one line, and
   deleting or commenting it removes search from twenty-nine panels at once with nothing on screen
   to say so, which is why `tools/test-panelsearch.mjs` anchors it to the start of a line rather
   than checking for the substring - a commented-out call still contains the text.
2. The coins-per-second balance gap (see `ROADMAP.md`): nothing is broken, but a recipe nobody
   would ever choose is dead content, and six of them earn under a hundredth of a coin a second.
3. Phase 6 integration — per-family audio, a Bake Book from `state.minigames.best`, and
   Masterpiece achievements — which is the last unbuilt piece of the playable-item system.
4. Re-derive the regatta league reward tables, post-level-70 Township buildings, and expansion
   costs directly from primary sources rather than wiki text/images, if that matters for release.
