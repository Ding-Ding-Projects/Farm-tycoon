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
- [x] `npm test` passes: content validator + eight gameplay-logic suites, 147 assertions
      across nine files, 0 failures
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
- [ ] The remaining wiki factories. 35 of roughly 67 exist; Township and Hay Day between them
      still have about 32 absent
- [ ] **The playable share is 1 in 7.5, and the design target is 1 in 3.** 15 of 112 eligible
      recipes are playable; reaching the target needs 23 more, each wanting a verb that is a
      genuinely new mechanic rather than a re-skin. `npm test` prints the real figure on every
      run so the gap cannot drift out of sight
- [ ] Per-family audio, a Bake Book from `state.minigames.best`, Masterpiece achievements

## Android

- [x] Capacitor declared, config written, npm scripts, keystore lines in `.gitignore`
- [x] Launcher icons generated in code across five densities, verified by PNG signature
- [x] Mobile layout pass: the minigame modal was clipped on a 320px phone and is not now
- [ ] Android SDK on the build machine (needs Google's licences accepted by the owner)
- [ ] Release keystore, created by the owner and never by an agent or CI
- [ ] A built APK, and any device testing at all. See `ANDROID.md`

## Open items

- [ ] **Screenshots and recordings.** None exist in the README or on the GitHub Pages site
      yet. A capture pass is required before either surface can show the real running game.
- [ ] **`tea_house` and `oil_press` unlock-inert gap.** Both buildings still open several
      levels before their first usable recipe (6-level and 3-level gaps respectively). Small,
      real, and not covered by any validator guard. See `HANDOFF.md` → "Audit findings" #5.
- [ ] **Multi-hop Building Workshop arbitrage, unverified.** The single-hop margin check
      passes (0 of 128 non-sink recipes underwater), but the full raw-material → component →
      kit chain was not re-simulated end to end, so the original "craft components at a loss,
      sell the kit for ~9,800" scenario specifically was not re-run. See `HANDOFF.md` →
      "Audit findings" #6.
- [ ] Regatta league reward tables, Township community buildings past level 70, and
      per-expansion cost numbers were sourced from wiki text/images and never independently
      re-derived.
