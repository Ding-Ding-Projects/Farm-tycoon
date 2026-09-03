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
- [x] Dock reduced to placeless surfaces only: decorate, achievements, co-op/regatta,
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
- [x] HUD direction alternatives B/C/D (`design/HUD-B-*`, `HUD-C-*`, `HUD-D-*`) and the
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

## Bug hunt and realism pass (2026-09-02)

Eight commits, each pushed to `main` as it landed; `HANDOFF.md` carries the evidence.

- [x] **Objects stand on their plots.** Footprint-aware anchors, scale and depth sort; a 2x2
      building fills its 2x2; pens draw a fenced floor with animals in it; the placement ghost
      tints the tiles it validates.
- [x] **The ground belongs to the world.** A tileable noise pattern mapped through the iso
      transform, per-tile tufts and flowers, woodland and a signpost on unowned land.
- [x] **Storage caps refuse instead of destroying.** `src/storage.js`; every claim path stores
      what fits and pays the rest, or refuses before consuming; silo and barn upgrades reachable.
- [x] **Exploits closed.** Newspaper and market per unit; kits and components never in orders,
      shops, trains or planes; mine depths gated; pens charge for their animals; a missed regatta
      season is not a won one.
- [x] **Every counter counts.** Eleven dead stats tracked, collection books fill, research and
      event effects consumed, the event banner and its claims wired; a table guard pins it.
- [x] **Everything data.js describes is reachable.** Expansions, decorations, every crop, the
      early build gate, the tutorial's targets and texts, modal and gesture correctness, the XP
      ring, reduced-motion fishing, v1 saves loading complete, `timeSkip` over the real timers.
- [x] **Hay Day interactions.** Drag a building out of the catalog, a recipe onto its factory,
      feed or the basket onto a pen, a seed or the basket across the fields. Tap paths remain.
- [x] **Realism on the art.** One light over the farm with slabs, shaded faces, glass, loam and
      living water; a sprite for every decoration with joining fences; the day following the
      clock with a bounded night, haze and drifting cloud shadows; crops in rows with per-stem
      variation.
- [x] `npm test`: validator + economy audit + 19 suites, **771 passed, 0 failed**;
      `tools/test-render.mjs` is new.

## Yum tong pass (2026-09-02)

- [x] **Selling waits for a buyer.** There was no selling mechanic, only a payout: a `Sell for
      🪙4` button in the silo and barn made the roadside stand - which already listed at a chosen
      price and sold on a timer - a slower way to do the same thing. One way to sell now, and it
      is the stand, with a dialog that states the price/wait trade before you commit.
- [x] **Orders travel by road.** Handing in a crate used to take the goods and pay in the same
      instant, with the delivery truck parked outside doing nothing. Loading an order now
      dispatches a delivery; the coins and XP arrive when the truck does. Drive time scales with
      the size of the load and is capped.
- [x] **The Truck Bay travels too.** It was the last place in the game where handing goods over
      paid instantly - per bundle, so the truck "departed" with nothing left to wait for. The
      bundles are cargo now: a full load sets off on the same road as the order board and the
      whole payment, bundle payouts plus the completion bonus, arrives with it. An uncollected
      load never blocks the next truck.
- [x] **The boat sails with her cargo.** Claiming a full boat used to pay the bonus, the XP and
      the vouchers in the instant the last crate went in, and then the boat "sailed" with
      nothing left to wait for. She now casts off carrying the whole payout and pays when she
      docks - a fixed 15-minute route, because a boat sails the same way whatever is in her
      six crates. The vouchers are rolled at departure and carried aboard, so the number the
      player was told is the number that arrives.
- [x] **One road for every vessel.** `orders.addDelivery()` is the single door onto it, so the
      order board, the truck bay and the boat dock share one list, one arrival clock and one
      collection path instead of three that drift apart.

- [x] **The tutorial can be moved through.** Ten of its twelve steps waited on a game event with
      no way past, and the other two advanced only if you clicked the bubble, with nothing saying
      so. Every step now has a 44px Next, a Skip and a step counter.
- [x] **The map drags.** `clampCamera` clamped the eased camera and never the pan target, so a
      drag into an edge sent the target far outside the legal box while the camera stood still,
      and dragging back did nothing until the target had walked home. `clampCameraTarget` clamps
      it against the TARGET zoom, so a simultaneous pan-and-zoom still reaches where it legally can.
- [x] **The silo and barn open from their HUD pills**, which show a number and previously refused
      to open. Same panels, same Sell buttons, as the world structures.
- [x] **The Download page is visible on the documentation site** - a filled button in the app bar
      on every page, rather than the thirteenth item in a scrolling rail behind "More".
- [x] **The dev server sends `no-store`.** `python3 -m http.server` let the browser cache ES
      modules and produce a MIXED module graph, which surfaces as an import error naming an
      export that is plainly in the file. Two verification passes were lost to it.
- [x] **The release notes stopped lying.** Every release since Phase B landed claimed the game
      was "not yet playable", a scaffold with "stub bodies" and a "placeholder splash screen",
      and quoted content counts (14 crops, 50 levels) that were never true again. The status
      paragraph is rewritten and its numbers now come from the generated counts module.
- [x] **`build.bat`, `build-installer.bat` and `download-dependencies.bat`** at the repository
      root, each with a `/s` silent mode, proven end to end on this machine.
- [x] **`social-preview.png` at the repository root**, byte-identical to the docs site's
      `og:image`, with a guard that fails when the two drift.

- [ ] **Upload the social preview** - Settings -> General -> Social preview -> Upload an image,
      pointing at `social-preview.png` at the repository root. It cannot be scripted: the REST
      API does not expose it, so it stays open until the owner does it by hand.

## Shared surface contracts this game does NOT implement

Audited 2026-09-02 against the game and the documentation site, by grep and by reading, not from
memory. These are absent rather than partial, and they are listed so the gap is a decision on
record rather than an oversight the next person rediscovers:

- [ ] Three language modes (English / Cantonese / bilingual) - settings shows a fixed
      `Language: English`
- [ ] Both funny-level sliders
- [ ] The "show emojis in dialogs" toggle
- [ ] School mode, its rename, and its unlock credential
- [ ] The TTS narrator and its per-language voice pickers
- [ ] Scheduled language / appearance settings
- [ ] The dim sum startup surprise (the release *code names* use the catalog; the in-game
      surprise does not exist)
- [ ] A regex builder on every search bar - `src/panelsearch.js` has a regex toggle on one
      search, with no builder
- [ ] Notification history
- [ ] Per-element appearance editing, the infinite colour picker and the font picker
- [ ] Tabbed navigation with pinning, grouping and the four tab searches
- [ ] The command palette on Ctrl+Shift+F
- [ ] The two-key-plus-slider destructive confirmation (there is a single confirm dialog)
- [ ] Local Git-backed version history
- [ ] A changelog viewer with a date picker and commit links
- [ ] External-editor handoff
- [ ] Multi-format export and bulk actions (there is a single JSON save export)
- [ ] Toy locks and Support Tickets
- [ ] The unlock ladder
- [ ] The built-in authenticator and QR TOTP registration
- [ ] ADHD modes
- [ ] The local personal-vocabulary JSON upload
- [ ] App-logo customization
- [ ] The universal file converter
- [ ] The local Ollama suite manager
- [ ] Status Hub registration and reporting
- [ ] The browser-extension download-capture dialogs
- [ ] Version and updated-at, with seconds and timezone, on the first screen before navigation

## Open items

- [x] **Every control is at least 44x44.** A sweep of all 25 panels found 33 below it, and every
      single one was in the panel search bar added earlier this session - the rest of the game was
      already clean. Fixed there; the sweep now returns zero.

- [ ] **Deliberately left after the 2026-09-02 pass** (details in `HANDOFF.md`): decorate.js
      rotate/undo/redo/stickers have no UI; `farm.remove()` has no caller for its kit refund; the
      helicopter has no per-crate manifest UI; crops overhang their plot's north edge; the haze
      and cloud shadows have no toggle; the new pen and market prices follow `data.js`'s intent
      and are untuned against the level curve; every drag was verified with synthetic pointer
      events, not a thumb.

- [ ] **White button text sits at 1.5 to 2.6 against its own fill, where AA wants 4.5.** Measured
      against the real gradients rather than guessed, worst stop per variant: default green
      **1.77**, gold **1.47**, gem **1.89**, danger **2.57**. The `quiet` variant is fine at
      **7.08** once its translucent fill is composited against the panel behind it - the first
      measurement said 1.19 because it compared against the overlay rather than the result.

      NOT fixed here, deliberately, because unlike everything else in this sweep it is not a
      defect with one obvious repair - it is the art direction. Two options and they pull opposite
      ways:

      - **Darken the fills** until white passes. Greens are luminous, so this needs roughly
        `#3E7A19` or darker throughout, which turns a candy-bright button into a forest-green one.
      - **Switch the label to the dark outline brown** and LIGHTEN the fills. Measured at
        `#7AC93F` this gives **7.06**, and it makes buttons brighter rather than duller, so it
        preserves the palette better - but every button in the game changes from white text to
        dark.

      Both change the look the design brief asked for, so the choice belongs to the owner. The
      numbers are here so it is a decision rather than a rediscovery.


- [x] **Reduced motion reaches the canvas, not just the stylesheet.** `styles.css` had honoured
      `prefers-reduced-motion` from early on with a blanket rule flattening every CSS animation
      and transition, which made it look handled. It was not: the world is a canvas, so the
      machinery on every working factory, the coin bursts, the XP floaters, the sparkles and the
      camera easing are drawn frame by frame in JavaScript where no stylesheet can reach. Only the
      minigame shell read the preference, and only for itself.

      `src/motion.js` is now the one answer for the whole game, with a `matchMedia` listener so
      turning the setting on mid-session takes effect immediately rather than at the next reload -
      which is exactly when somebody reaches for it. Particles are suppressed at the SPAWNER, the
      camera snaps instead of gliding, and building animation freezes at one instant.

      Nothing loses information: `working` stays true and only the clock stops, so a busy factory
      keeps its lit lantern, orange firebox and four-puff plume against an idle one's single wisp.
      That is asserted, not assumed - forcing `working` false at `drawBuilding` turns the guard red.


- [x] **Visible focus, everywhere.** The whole game had FOUR focus rules and three of them were on
      the panel search, added days after everything else - so every dock button, card, menu item
      and all 63 merge cells relied on whatever ring the browser draws by default. On an interface
      already outlined in near-black at 3px, that default lands on top of a border it cannot be
      told apart from. Interactive chrome now gets a two-ring `:focus-visible` indicator (pale
      inside, dark outside) so one of the two has contrast on cream, brown, green or the world
      behind the HUD. Verified with a real Tab press, since programmatic focus never sets
      `:focus-visible`.

- [x] **Merge selection and keyboard focus are no longer the same visual.** Selection was an inline
      `style.outline`, and an inline style beats the stylesheet - so it would have swallowed the
      focus ring on the one cell where knowing both matters most: the one you have picked up and
      are still standing on. Selection is now a class with a filled amber cast; focus is the ring.

- [x] **Hints stopped running into each other.** `hintEl` returned a `<span>`, which was invisible
      while every panel appended exactly one and produced "Energy: 99/100Tap a generator..." the
      moment two went in. Four panels were doing it. Fixed in the helper rather than at five call
      sites; the inline uses of the class are raw spans in card templates and are untouched.

- [x] **Dock buttons have names, and the docs stopped claiming there are four of them.** Their only
      text is an emoji, so without a label a reader announces "star button". Five documents said
      the dock carries "exactly four" buttons - true of `index.html`, false of the running game,
      which appends a fifth for the daily wheel at boot. The guard asserts every button has a name
      and deliberately does NOT assert the count, since pinning it would move the same drift into
      the test suite.


- [x] **Merge Meadow is playable without a mouse or a screen.** A sweep of all 28 panels for
      controls with no accessible name found one offender and it was severe: 57 of the merge
      board's 63 cells had no name at all, so a screen reader read "button" fifty-seven times with
      no way to tell them apart or know where on the board you were - on a system whose entire
      mechanic is which cell a thing is in. The selection was an outline and nothing else, and all
      63 cells were tab stops.

      Every cell now names its position and contents, the picked-up cell carries `aria-pressed`,
      the board is one tab stop with arrow-key navigation, and focus returns to the cell that was
      acted on so keyboard play is continuous across the panel rebuild. The other 27 panels were
      clean.


- [x] **The gate now explains itself, once.** Nothing told a player that roughly one recipe in
      three can ONLY be collected by making it by hand - the card carries a 🎮 and the queue says
      "Ready to make", which is enough to work out if you already know the rule and not enough to
      teach it. The tutorial ends at the order board, several levels before the first playable
      recipe (cookie, bakery, level 8) can come up. A one-time note now fires the first time a
      craft is waiting to be played, covering the three things a player would otherwise worry
      about: it will not spoil, they are not stuck with it, and Assist mode exists.

      The flag lives on `state.minigames` and is never initialised, so its absence reads as
      "not explained yet" - no SAVE_VERSION bump, and an existing save gets the explanation too,
      which is right, because that player has never seen it either.


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
