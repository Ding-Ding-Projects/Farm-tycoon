---
name: add-content
description: Step-by-step recipe for adding a crop, animal, good, recipe, production building, or decoration to Farm Tycoon — which data tables, unlock placement, sprite contract, and balance formulas.
---

# Adding content

All content is data-driven from `src/data.js`; systems pick new entries up automatically.
A content addition should touch **only** `data.js`, `sprites.js`, and (if level-gated)
`LEVELS.unlocks` — if you're editing system code, something is wrong.

## Balance formulas (keep the economy sane)

- **Crop:** `sellPrice ≈ seedCost + growTimeMinutes * 1.5` (early crops cheaper per minute,
  long crops better per tap). `xp ≈ sellPrice / 5`, min 1. Harvest always returns 2x seeds.
- **Good/recipe:** output sellPrice ≈ **1.6–2.2x** the summed sellPrice of inputs
  (longer recipes get the higher multiplier). `xp ≈ time-in-minutes / 6`, min 2.
- **Building cost:** roughly `150 * 1.45^(unlockLevel-3)`, rounded to a friendly number.
- **Unlock level:** slot into a level with few unlocks (check `LEVELS.unlocks`) — the
  design goal is an unlock at *every* level 1–40.

## Steps by type

1. **Crop** — add to `CROPS` (id, name, unlockLevel, growTime seconds, seedCost, sellPrice,
   xp); add `drawX(ctx, x, y, size, stage)` in `sprites.js` with 4 growth stages; add the id
   to `LEVELS.unlocks[level]`.
2. **Good** — add to `GOODS` with sellPrice. Goods store in the barn; crops in the silo.
3. **Recipe** — add to the building's `recipes` array: `{id, inputs: {itemId: qty}, time, xp}`.
   The `id` must exist in `GOODS`.
4. **Building** — add to `BUILDINGS` (name, unlockLevel, cost, size [2,2], queueSlots,
   recipes); add a distinct look in `sprites.js` `drawBuilding`; gate in `LEVELS.unlocks`.
5. **Animal** — add to `ANIMALS` (feed must be a feed-mill recipe id or null); product must
   exist in `GOODS`; draw function + pen visual; gate in `LEVELS.unlocks`.
6. **Decoration** — add to `DECORATIONS` (cost or voucherCost, size); add to
   `drawDecoration` switch.
7. **Fish** — add `fish_*` to `GOODS` with `rarity`, append to `FISHING.species`.

## After adding

- Orders/truck/boat generators must not request locked items — they draw from unlocked
  content only; verify a new high-level item doesn't appear in low-level orders.
- Run the `playtest` skill; visually check the new sprite at all zoom levels via `run-game`.
