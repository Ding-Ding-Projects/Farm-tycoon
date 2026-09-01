# Roadmap

A checklist view of what has shipped and what has not. Ticked items are verified — either by
`npm test`, by loading the running game, or by direct inspection of the source — not just
implemented-and-assumed-working. See `HANDOFF.md` for the full evidence behind each tick and
`ROADMAP.md`'s own "Open items" section below for what remains.

## Phase A — Scaffold

- [x] Full repo skeleton: `index.html`, `styles.css`, all `src/` module files with public API
      contracts (exported signatures + JSDoc)
- [x] `electron/` wrapper, `package.json`
- [x] `src/data.js` populated with real content tables (crops, animals, recipes, levels)
- [x] `PLAN.md`, `CLAUDE.md`, `README.md`, `.claude/skills/` (`run-game`, `add-content`,
      `playtest`)
- [x] `DESIGN_BRIEF.md` — the Claude Design handoff document

## Phase B — Full implementation

- [x] All 37 `src/` modules implemented — zero `/* Phase B */` stub markers remain
      (`grep -r "/\* Phase B \*/" src/` returns nothing)
- [x] Game boots in a browser with zero console errors; `window.__farmDebug` exposes real,
      mutating state (not a static HUD)
- [x] `npm test` passes: content validator + twelve gameplay-logic suites, 592 assertions
      across 13 files, 0 failures. Three further suites drive a real built artifact and are not
      in that count: `verify-placement.mjs` (10), `verify-touch.mjs` (26, against the Android
      WebView) and `verify-persistence.mjs` (9, across two app launches)
- [x] Save format round-trips: `SAVE_VERSION` 3, with migrations from both prior shapes
      (`1→2` for `merge`/`trains`/`airport`, `2→3` for `town`/`zoo`/`market`)
- [x] All 22 world structures placed with zero overlaps across their occupied tiles; every
      panel id unique
- [x] Twenty of twenty-two structures locked at level 1, still present/clickable (derelict-
      but-visible rule) — confirmed against `LEVELS.unlocks`
- [x] Dock reduced to exactly four placeless surfaces: decorate, achievements, co-op/regatta,
      settings — every other system opens from its world structure
- [x] Camera pan + clamp (`src/render/renderer.js`) — was flagged as the single most urgent
      gap in an earlier handoff; now implemented and covered by `tools/test-camera.mjs`

## Visual design overhaul

- [x] "Sunlit Homestead" stylesheet (`design/handoff/styles.css`) integrated at the repository
      root — verified byte-identical aside from line endings
- [x] Palette, outline treatment, golden-hour lighting pass, and depth sorting from
      `design/handoff/SPRITE-NOTES.md` implemented in `src/render/sprites.js` and
      `src/render/renderer.js`
- [x] Derelict-state rendering for locked structures
- [x] All 22 `STRUCTURES` ids have sprite handling in `src/render/sprites.js` (verified by
      direct id cross-reference, not assumed)
- [x] Two design fonts vendored locally (27 faces / 947 KiB via `tools/vendor-fonts.mjs`),
      used by both the game and the GitHub Pages site — zero CDN requests
- [x] Real application icon generated in pure code (`tools/make-icon.mjs`), no downloaded art
- [ ] HUD direction alternatives B/C/D (`design/HUD-B-*`, `HUD-C-*`, `HUD-D-*`) and the
      interactive prototype remain reference-only by design — direction A shipped, the others
      were never meant to ship alongside it

## Packaging and release

- [x] Windows installer target is Squirrel.Windows (`electron-builder --win squirrel`),
      producing `Setup.exe`, `RELEASES`, and the full `.nupkg`
- [x] Installer verified `NotSigned` — permanent no-signing policy, not a missing credential
- [x] CI (`.github/workflows/release.yml`) builds, packages, and publishes a release on every
      push; does not run tests as a gate (standing project policy — `npm test` is the local
      gate before every push)
- [x] A real, non-draft, non-prerelease GitHub Release is published and verified against the
      exact commit it was built from, carrying a genuine `Setup.exe`, `.nupkg`, and `RELEASES`
      index (checked via `gh release view --json assets`, not assumed)
- [x] Release publish step now runs before the release code-name ledger commit step, so a
      bookkeeping failure can no longer prevent an already-built release from existing

## Playable items

- [x] Per-item minigame gate: a recipe carrying a `play` chain can only be collected by playing
      it through. Save v4 with a migration that grandfathers crafts queued before it existed
- [x] Quality tiers resolved once at collect into yield / XP / a coin tip, with a worst-stage cap
      so a chain cannot be farmed by sandbagging its hard stage
- [x] Shell plus twelve input families, keyboard parity in the shared normaliser
- [x] Fourteen verbs, every family in use, `verbWord` uniqueness enforced by test
- [x] Cake Oven (level 21) with a five-stage cake maker: whisk, pour, oven, pipe, decorate
- [x] Four more factories: Ice Cream Maker, Soup Kitchen, Sauce Maker, Flower Shop
- [x] Assist mode and an opt-in auto-finish, both reachable from Settings
- [x] Both release valves: playable goods buyable from a neighbour, and a jammed craft
      discardable for half its inputs back
- [x] Verified in the packaged Windows app, including that dynamic `import()` resolves over
      `file://` - without which every playable craft would be unreachable once installed
- [x] **The wiki factory roster is complete.** All five that were missing have landed: net maker
      (30), lobster pool (44), duck salon (50), doner kebab stand (54) and pasta maker (67). The
      doner stand is at 54 rather than the wiki level 32 because lamb does not arrive here until
      53, and a factory that cannot cook anything for twenty-one levels is not an unlock. Net
      maker feeds the lobster pool, and the pasta maker sits UPSTREAM of the level-72 pasta
      kitchen: it extrudes the dry shapes, the kitchen cooks dishes out of them.
- [x] **The playable share reached its 1-in-3 design target.** 44 of 151 recipes are playable
      across 46 verbs in 12 input families. `npm test` prints the real figure on every run, so
      the ratio cannot drift out of sight in either direction
- [x] **Three verbs were designed, measured and CUT rather than shipped thin**, and their reasons are
      recorded in `src/minigames/registry.js` so nobody rebuilds them: `work_rush`, because with
      uniform item value and a capped number of actions triage is mathematically irrelevant, and
      `steady_spindle`, because a saturating actuator makes high-gain reaction beat anticipation
      on an inverted pendulum. A third, `test_set`, was cut earlier for the same class of reason.
      A fourth was cut before a line of it was written: a pasta extruder whose output lagged the
      crank is a re-skin of `jar_fill`, which already owns input dead time
- [x] **Phase 6 integration is complete.** Per-family audio and the Masterpiece achievements
      already existed and were already wired - `audio.js` carries a distinct hit sound for all
      twelve input families, and `minigames.js` increments `masterpiecesMade`, which both
      achievements read. The Bake Book was the one genuinely missing piece and now ships in
      `src/bakebook.js`: every playable recipe, the best tier reached on each, and which VERBS
      are still unmastered, since skill is per verb while quality is recorded per recipe. It opens
      from Achievements rather than the dock, which is contractually four buttons.

## Android

- [x] Capacitor declared, config written, npm scripts, keystore lines in `.gitignore`
- [x] Launcher icons generated in code across five densities, verified by PNG signature
- [x] Mobile layout pass: the minigame modal was clipped on a 320px phone and is not now
- [x] Android SDK, JDK 21 and a Pixel 6 / Android 14 emulator installed user-scoped, with the
      owner's explicit authorisation for Google's SDK licence
- [x] **A debug APK built, installed and PLAYED on an emulator.** `tools/build-android.mjs` is
      one command; `tools/build-web.mjs` stages 1.8 MB instead of the 639 MB the original
      `webDir: "."` would have shipped
- [x] Pinch-zoom and two-finger pan, without which the game could not zoom at all on a phone
- [x] A gated craft queued, its minigame played by real touch, and the goods collected
- [x] 26 touch checks run against the REAL Android WebView over a forwarded devtools socket
- [ ] Release keystore, created by the owner and never by an agent or CI. The Gradle signing
      config is already wired and injected by the build script; only the key is missing
- [ ] A signed release APK, and testing on real hardware. Emulated touch proves the code path,
      not finger occlusion, palm rejection or feel. See `ANDROID.md`

## Open items

- [x] **Screenshots and recordings.** Both recordings are committed and linked from the
      README: `screenshots/farm-tycoon-android.mp4` from the emulator and
      `screenshots/farm-tycoon-desktop.mp4` from the Windows build, the latter captured from the
      app's own renderer over the DevTools protocol rather than from a screen. The GitHub Pages
      site still does not carry them.
- [x] **`tea_house` and `oil_press` unlock-inert gap, fixed and guarded.** Both opened before
      the crop they exist to process: the oil press three levels before olives, the tea house six
      before tea leaves. The recipes were right and the BUILDINGS were early, so both moved to
      meet their first usable recipe (oil press 52 → 55, tea house 56 → 62) rather than dragging
      the crops forward. `validate-data.mjs` now refuses any building whose earliest recipe
      outranks its own unlock level; reintroducing the oil press defect turns it red with the
      exact original numbers.
- [x] **Multi-hop Building Workshop arbitrage, closed and proven.** `tools/test-economy.mjs`
      expands all 46 kits to their raw leaves, following the CHEAPEST producing recipe at each
      step so an exploit cannot hide behind an expensive sibling. The best kit margin in the game
      is `kit_paper_mill` at **-35 coins** (raw 555, sells 520); nothing is profitable even when
      every input is bought at the market's 1.4x. The original ~9,800 scenario is re-run by name.
      Nothing is underwater on direct inputs or on fully expanded raw inputs either.
- [x] **Every panel has a search field now, from one wiring line.** `src/panelsearch.js` is
      attached at the end of `renderPanelContent`, so it filters the cards a panel actually
      rendered rather than the data behind them - which means every panel gets it, including ones
      nobody has written yet, and there is one implementation to keep correct instead of
      twenty-nine. Plain text is the default and matches literally; a `.*` toggle switches to a
      real regular expression with a token palette anchored beside the field, a case toggle, live
      validation and a running count. A half-typed pattern matches everything rather than nothing,
      because a person mid-keystroke has not made a mistake yet.

      It appears on any panel holding six or more cards, which is a RULE rather than a per-panel
      judgement: below six the whole list is on screen and there is nothing to find. Verified live
      across 22 panels - 11 above the threshold have it, 11 below do not.

- [x] **The dead tail is gone; the spread is still wide and that is fine.** 23 recipes earned
      under 0.010 coins per second of queue time - syrup turned 76 coins of sugar into 78 over a
      full hour, which selling the sugar beat. Each was lifted by the SMALLEST amount clearing both
      that floor and the project own documented 1.6x output-over-inputs rule, iterated to a fixed
      point because butter and cheese and sugar are inputs to other recipes and lifting one lifts
      its consumers. The worst margin in the game went from 0.0006 to 0.010 per second.

      `tools/test-economy.mjs` now FAILS below 0.008 rather than reporting it, so the tail cannot
      grow back. The remaining 11x spread between median and best is untouched on purpose: where a
      recipe sits between decent and excellent is a design opinion, and a guard on that would be a
      guard on taste. No migration was needed - prices are read from data.js and never written into
      a save, so existing games picked up the new values on load.

- [x] **The hand-transcribed tables are now checked for coherence, though NOT against the wikis.**
      `tools/test-tables.mjs` covers the regatta placement and league ladders, the community
      buildings and the expansion costs. It deliberately proves shape rather than value: a
      hand-typed table goes wrong by a slipped digit, and a slipped digit does not look like
      anything until you ask whether the curve is smooth. All eight checks were watched failing on
      the exact slips they exist to catch.

      Stated plainly because it matters: this does not verify the numbers against their sources,
      and re-deriving them from the wikis would be the wrong target anyway - those describe a
      different game and several figures have deliberately diverged since (the doner kebab stand
      is at 54 here, not the wiki's 32, because lamb does not arrive until 53). If exact wiki
      agreement is ever wanted, it is a separate job with a different tool.
