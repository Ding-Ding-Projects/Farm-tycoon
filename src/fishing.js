// fishing.js — the pond mini-area: cast, timing minigame, fish/chest loot.
// Flow: cast() starts FISHING.castTime; when ready, the UI shows a moving marker —
// reel(accuracy 0..1) decides catch quality; rollCatch() picks species by rarity weight
// (or a treasure chest at FISHING.chestChance).

/** Start a cast; fails if one is already in progress. */
export function cast() { /* Phase B */ }

/** Is the cast ready for the reel minigame? */
export function isReady(now) { /* Phase B */ }

/** Resolve the reel minigame: accuracy 0..1 from the timing bar. Returns {item, qty} or {chest}. */
export function reel(accuracy) { /* Phase B */ }

/** Open a treasure chest: rolls FISHING.chestLoot. */
export function openChest() { /* Phase B */ }
