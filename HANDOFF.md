# Handoff

State of the repository as of commit `013509a` on `main`. Written to be read by whoever picks
this up next, so it records what is *not* done as carefully as what is.

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
- The dock (`index.html`) carries exactly four buttons: decorate, achievements, co-op/regatta
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
data.js OK - 24 crops, 12 animals, 44 buildings, 195 recipes, 259 goods, 3 merge
chains, 43 achievements, 95 levels all with unlocks, 10 weekend events + 6
mini-events + 25 fair tasks + 6 holidays, town: 16 houses + 10 community, 14 zoo
enclosures, 8 islands, 23 materials
playable share: 39/136 recipes (1 in 3.5), 41 verbs - at the 1-in-3 target
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
   recipe also 6 — was inert for 15 levels). `tea_house` (unlocks 56, first recipe 62) and
   `oil_press` (unlocks 52, first recipe 55) still open several levels before their first usable
   recipe — a 6-level and 3-level gap respectively, unchanged from the original finding and not
   covered by any guard. This narrower point is real, current, and small; it is not the "70
   recipes" problem, which is closed.
6. **Non-positive recipe margins.** Recomputed directly against the current data with the same
   sell-value logic the validator uses **as of the 128-recipe content set**: 0 of 128 had a
   non-positive margin among
   non-sink recipes** (was 45). Every Building Workshop component and kit recipe (41 of them) is
   now explicitly tagged `sink: true` and exempted from the margin check by design — a sink is a
   (The corpus has since grown to 195 recipes across 44 buildings. That audit has NOT been re-run
   over the newer content, so treat the figure above as a result about the set it was measured
   on, not a standing property of the game.)
   good meant to be consumed, not resold, exactly like feed. Checking those 41 sink recipes
   directly against a single-hop raw-input-cost comparison (cost to buy the recipe's direct inputs
   at their own sell price, vs. the recipe's own sell price), 40 of 41 now cost more to craft than
   they would fetch selling directly; one, `shingle` in `build_workshop`, still nets a small +5.
   **This single-hop check does not rule out a multi-step arbitrage across the full chain** (raw
   materials → components → kit, summing real material cost rather than component resale price),
   which was not re-simulated end to end here. Flag this as reduced and very likely closed, not
   proven eliminated — the original "craft components at a loss, sell the kit for ~9,800" scenario
   specifically was not re-run.

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

All 44 factories used to be one box, one gable roof and one of five accents, keyed only by roof
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
  taken straight off an Android device with `adb exec-out screencap`. A screen RECORDING is still
  missing and is still required. The old text below is kept because its warning has not expired -
  a reference to a file that isn't in the tree is worse than no image.
- **The two open audit points above** (tea_house/oil_press unlock-inert gap; unverified multi-hop
  kit arbitrage) are real, small, and unaddressed.
- Regatta league reward tables, Township community buildings past level 70, and per-expansion
  cost numbers were never independently verified against the wiki — they were sourced from
  wiki text and images and taken at face value.
- Phase B's original plan (see `CLAUDE.md`'s history and `PLAN.md`) called for the implementation
  to land on branch `claude/windows-hay-day-game-cfctdb` with a draft PR. That did not happen —
  every Phase B commit landed directly on `main`, the same way the scaffold did. Recorded here so
  nobody goes looking for a branch or PR that does not exist; `git branch -a` on this checkout
  shows only `main`.

## Suggested order for the next session

1. Capture matrix — screenshots/recordings of the real running game for the README and the
   GitHub Pages site, once the in-flight capture pass lands (or pick that up if it hasn't).
2. The `tea_house`/`oil_press` unlock-inert gap (small; see "Audit findings" #5).
3. Re-simulate the full component→kit chain end to end for the Building Workshop to settle the
   multi-hop arbitrage question definitively (see "Audit findings" #6).
4. Re-derive the regatta league reward tables, post-level-70 Township buildings, and expansion
   costs directly from primary sources rather than wiki text/images, if that matters for release.
