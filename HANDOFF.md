# Handoff

State of the repository as of commit `14d067f` on `main`. Written to be read by whoever picks
this up next, so it records what is *not* done as carefully as what is.

## Where the project actually is

**Phase A is complete and then some. Phase B has not started.** `src/data.js` is real, final,
validated content. Everything else in `src/` is a documented contract with `/* Phase B */` stub
bodies — 238 of them. `src/main.js` paints a placeholder splash. **The game does not play yet.**

That distinction matters more than any other line in this document: the content is finished, the
game is not.

## What landed in the content expansion

Nine commits, sourced from the Hay Day and Township community wikis.

| | Before | Now |
|---|---|---|
| Crops / animals | 14 / 7 | 22 / 12 |
| Buildings / recipes | 15 / 52 | 26 / 128 |
| Goods / materials | 85 / 9 | 192 / 23 (four purpose-scoped sets) |
| Town houses / community | 10 / 6 | 16 / 10 |
| Zoo enclosures / islands | 8 / 4 | 14 / 8 |
| Levels / achievements | 50 / 21 | 95 / 39 |

New systems, all data-complete with module contracts: Building Workshop and kits, per-factory
minigames, simulated neighbours, co-op with a request board, weekly regatta, expeditions,
artifacts and museum, permanent research laboratory, helicopter, tiered mine depths, foraging,
newspaper, collection books, building mastery, decorating and photo mode, plus 22 placed world
structures.

### The two mechanics that make this not a clone

1. **Buildings are crafted, not bought.** Materials → components → a building kit → the factory.
   Both source games sell factories for coins, which leaves their material economies shallow.
2. **Every production building has its own minigame**, with an effect only that factory has.
   Optional bonus layer, never a gate — gating a recipe on hand-eye skill would break the idle
   contract and punish offline play.

Plus one interaction rule: **systems open by clicking their structure in the world**, never from
the HUD or dock. Locked structures are derelict but still clickable from level 1, so the map is
the roadmap.

## Verification state

`npm test` (`tools/validate-data.mjs`) is green and now enforces roughly thirty rule families.
**Every rule was broken on purpose and watched go red before being trusted.** Several found real
defects the moment they first ran: four materials being spent on nothing, a co-op perk using an
effect key outside the shared set, the laboratory placed on top of the museum, and a newspaper
"bargain" band topping out at exactly the ordinary price floor.

The game was loaded in a browser at the verified commit: canvas present, zero console errors, all
192 goods and 28 research nodes resolving at runtime.

## Corrections on the record

Three balance conclusions in this session were wrong, each because the metric was wrong:

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

## Packaging and fonts — done since the first draft of this file

- **The Windows installer is Squirrel.Windows**, not NSIS, and it is a *proven* build rather
  than a validated config: `dist/squirrel-windows/` holds a 119 MB `Setup.exe`, `RELEASES` and
  the full `.nupkg`. Verified `NotSigned` with no signer certificate, which is the permanent
  policy, and the unknown-publisher warning that follows from it is expected.
- **There is a real application icon.** `tools/make-icon.mjs` generates it in pure code — no
  downloaded art, consistent with the project's vector-art convention — and emits a genuine
  multi-size `.ico` (magic `00 00 01 00`, five images at 16/32/48/128/256) plus a 512 px master.
  Note `build/` is globally ignored, so the two icon files are explicit `!` exceptions in
  `.gitignore`; without that the icon reference breaks on a fresh checkout.
- **The two design fonts are vendored locally**, 27 faces / 947 KiB, via `tools/vendor-fonts.mjs`.
  It is a script rather than a manual download because one family query returns 27 `@font-face`
  blocks across weights and `unicode-range` subsets; hand-vendoring "two fonts" would ship two
  files and silently drop every non-latin subset.
- **`index.html` no longer loads Google Fonts over the network.** It had done so since the
  scaffold, against this project's own no-CDN rule — a pre-existing defect found while verifying
  the vendoring.

Two verification lessons from that work, recorded because both produce false confidence:
`document.fonts.check()` returned `true` for all eight weights while **zero** faces were
registered, so it cannot be trusted alone; and a `FontFace` probe reported a network error only
because the filename had been guessed rather than read off disk.

## Audit findings — read this before trusting the content

An adversarial audit ran 99 mutation probes against the validator. **51 guards fired correctly**,
including every one named in the commit messages: material sets, expansion geometry, storage
trios, kit integrity, minigame integrity, the orphan/sink audit, the museum bijection in both
directions, expedition loot arity, mine depths, lab acyclicity, structure placement, and the
co-op/regatta pools. The `MINE.tools` identity check is genuinely load-bearing — the audit's own
deep clone tripped it on the first control run.

It also found real defects, ranked:

1. **Nine of 23 materials had no source anywhere** — the whole expansion set (`shovel`, `axe`,
   `saw`) and the whole storage set (`bolt`, `plank`, `duct_tape`, `screw`, `wood_panel`,
   `bracket`). `TRAINS`, `AIRPORT` and `HELICOPTER` carry material *counts* with no pool naming
   which material arrives. Consequence: **every farm expansion and every storage upgrade was
   permanently unbuyable, so the farm could never grow past the start zone.** Independently
   confirmed before being acted on.
2. **No structure stood on land the player owns.** `barn` and `silo` sat on row 22 — inside
   `expansion_2`, which unlocks at level 13 — so a level-1 player could not reach their own barn.
   `workshop_yard` unlocked at 6 and sat in level-35 land. Two structures straddled zone
   boundaries.
3. **The guard for #1 lied.** `tools/validate-data.mjs` said "a material with no source is a
   wall" while implementing only the spend side. That comment is worse than none: it tells the
   next reader a check exists, so nobody looks again. This is the second time in this project a
   comment has asserted a safety property that was never implemented.
4. `checkMaterials` accepts a `requiredSet` but is called with `null` for houses, community
   buildings, zoo enclosures and milestones — so 4 of 6 consumers are unchecked.
5. Three buildings are inert on the level they unlock (`build_workshop` for 15 levels,
   `tea_house` 6, `oil_press` 3), and 70 recipes are unlockable before their inputs are. Recipes
   carry no `unlockLevel` of their own, so they are gated only by input availability.
6. 45 of 128 recipes have a non-positive margin, and the Building Workshop's two halves disagree
   in sign: components destroy value while late kits print it.

Verified TRUE by the audit: the 16 rects tile the grid to exactly 100% with zero gaps and zero
overlaps; 22 structures; every crop has a sink; 26 factories with 26 distinct minigame effects;
no duplicate ids; no recipe input cycles; `unlockLevel` agrees with `LEVELS.unlocks` everywhere.

**Items 1–4 are fixed** (`895e7a6`, `5b56e2e`, `1f92a99`), each with a guard watched red then
green, and both fixes re-verified here by independent computation rather than taken on trust:
zero unsourced materials, zero structures on land that unlocks too late, zero straddles.

- Trains, the airport and the helicopter now carry weighted `materialPool` tables in the same
  shape the expedition loot already used. Trains supply building + expansion sets, the airport
  expansion + storage, the helicopter is storage-led and quick. The `advanced` set stays
  expedition-only, honouring the Tool Exchange note.
- All 22 structures were misplaced, not the four the audit named — `mine_entrance` opened at 24
  while standing on level-39 land, and `train_station` at 30 on level-54 land. Ten early
  structures now hug the start zone's edges, leaving rows y12–20 clear for fields.
- The earn-side guard now exists, so the comment that promised it is finally true. It is
  correctly *not* fooled by removing a material from one of its two pools.

**5 and 6 remain open** and are design questions rather than bugs:

- 70 recipes are unlockable before their inputs are. The Feed Mill opens at level 5 with recipes
  blocked until 51–77, so a new player sees five entries they cannot explain. Recipes carry no
  `unlockLevel` of their own, so fixing this means either adding that field or reordering.
- 45 of 128 recipes have a non-positive margin, and the Building Workshop's halves disagree in
  sign: components destroy value while late kits print it. Since kits are ordinary goods with a
  sell price, the intended loop is invertible — craft components at a loss, sell the kit for
  ~9,800 rather than placing it. Either kits should not be sellable, or the margins need
  rebalancing.

## Not done — the honest list

- **The visual overhaul is only partly integrated.** Fonts and the icon are done. The palette,
  outlines, golden-hour lighting, depth sorting and the eight new structure sprites from
  `design/handoff/SPRITE-NOTES.md` are not.
- **Camera clamping is a live gap, not a future risk.** `FARM.gridSize` is 40 and a canvas at the
  shipped tile size shows about twelve tiles. The contract is written in `renderer.js` but not
  implemented, so roughly **half the farm exists in data and cannot be looked at**. This is the
  first thing to fix.
- **No CI.** There is no `.github/workflows` directory, so no remote verdict exists for any
  commit.
- **No release has ever been published**, and none should be until the game runs. An installer
  now builds, but it would install a program that draws a placeholder splash.
- Regatta league reward tables, Township community buildings past level 70, and per-expansion
  cost numbers were never verified — they are image-only on the wiki.

## Why a release-grade shutdown could not complete

A `yum tong` pass was attempted and stopped at the gates rather than being weakened to fit. The
blocking evidence, all verified rather than assumed:

- No CI exists, so no green remote verdict is obtainable.
- No release and no tag has ever been published.
- The gate requires driving the complete built UI with a capture after every click. With 238 stub
  bodies there is no UI to drive.
- The gate requires a per-surface capture matrix in the README. There was no README at all.

Cleanup, by contrast, was already complete before the pass began: one branch (`main`, level with
the remote), one working tree, no stashes, no tags. There was nothing to delete.

## Suggested order for the next session

1. Camera pan + clamp — the live gap above.
2. Vendor the two fonts properly, then verify with `document.fonts.check` against the running
   page rather than by reading the CSS.
3. Depth sorting, then the palette, outlines and golden-hour pass from `SPRITE-NOTES.md`.
4. The eight new structure sprites, each with its derelict variant.
5. Only then Phase B proper: the system modules, in the dependency order their contracts imply.
