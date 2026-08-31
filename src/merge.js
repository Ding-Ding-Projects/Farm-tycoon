// merge.js — Merge Meadow: the Township-style merge minigame (L11).
// Own 7×9 board in a full-screen sheet panel; drag-merge two identical items into the
// next tier of their chain (MERGE.chains). Generators spawn tier-1 items for energy;
// energy regenerates on wall-clock time (persists offline like all timers).
// Rewards (coins/diamonds/vouchers/tools) pay into the main farm economy.
//
// Board state in state.merge: { cells: [{chain, tier} | {generator} | null] * cols*rows,
//   energy, energyUpdatedAt }

/** Ensure the board exists (first open): place starting generators + a few tier-1 items. */
export function initBoard() { /* Phase B */ }

/** Current energy, applying regen since energyUpdatedAt (never exceeds max). */
export function currentEnergy(now) { /* Phase B */ }

/** Tap a generator: spend energy, spawn spawnBatch tier-1 items into free cells. */
export function spawnFrom(cellIndex) { /* Phase B */ }

/** Can cells a and b merge (same chain + tier, not top tier)? */
export function canMerge(a, b) { /* Phase B */ }

/** Merge item at `from` onto `to`: next-tier item at `to`, rolls MERGE.mergeBonus. */
export function merge(from, to) { /* Phase B */ }

/** Move an item to a free cell (plain drag). */
export function moveItem(from, to) { /* Phase B */ }

/** Claim a claimable/top-tier item: removes it, pays its reward into the farm economy. */
export function claim(cellIndex) { /* Phase B */ }

/** Reward definition for a cell (from chain claims/topReward), or null if not claimable. */
export function claimableReward(cellIndex) { /* Phase B */ }
