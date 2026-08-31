// islands.js — island voyages (ISLANDS, L36). Split out of boat.js, which keeps crates and
// vouchers: with expeditions.js now in the codebase, "the boat module also does voyages" was a
// confusion waiting to be had, and the two systems have nothing in common but water.
// State: state.islands { voyage: { islandId, readyAt } | null, unlocked: [islandId] }

/** Destinations unlocked at the player's level. */
export function destinations() { /* Phase B */ }

/** Whether a voyage can start - island unlocked and no voyage already at sea. */
export function canSail(islandId) { /* Phase B */ }

/** Send the boat. One voyage at a time. */
export function sail(islandId) { /* Phase B */ }

/** Cargo waiting to be collected, or null if the boat is still out. */
export function pendingCargo() { /* Phase B */ }

/** Collect the cargo into the barn. */
export function collect() { /* Phase B */ }

/** Advance the voyage timer; called from the game loop. */
export function tick(now) { /* Phase B */ }
