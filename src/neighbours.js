// neighbours.js — the one pool of simulated players (NEIGHBOURS). The game is single-player
// and offline-first, so every "other player" anywhere in it comes from here: co-op members,
// regatta crews, newspaper farms, request posters.
//
// It is deliberately ONE system. Left to themselves, coop.js, regatta.js and newspaper.js would
// each roll their own roster and the same neighbour would appear as three different people in
// three screens.
//
// Generated ONCE from state.createdAt and persisted, never re-rolled per load: a neighbour who
// helped yesterday is the same neighbour, with the same farm, in this week's regatta. Their
// activity advances on wall-clock elapsed time, not on ticks the player watched.
//
// They are never presented as real people online.
// State: state.neighbours { roster: [{ id, first, last, farm, level, profile }], seed }

/** The roster, generating it deterministically on first call and persisting it. */
export function roster() { /* Phase B */ }

/** One neighbour by id. */
export function get(id) { /* Phase B */ }

/** A stable pseudo-random subset, for a co-op roster or a newspaper issue. */
export function sample(count, seedKey) { /* Phase B */ }

/** Simulated progress for a neighbour over an elapsed period, from their activity profile. */
export function simulate(id, elapsedSeconds) { /* Phase B */ }

/** Re-level the roster against the player so rivals stay inside NEIGHBOURS.levelBand. */
export function rebalance(playerLevel) { /* Phase B */ }
