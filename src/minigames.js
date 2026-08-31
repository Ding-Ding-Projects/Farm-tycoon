// minigames.js — per-factory minigames. Every production building has exactly one, and each
// does something only that factory would plausibly do (MINIGAMES in data.js): the bakery
// kneads dough for extra yield, the smelter works the bellows for purity, the workshop lines
// up a frame to save material. Not one minigame reskinned sixteen times.
//
// They are an OPTIONAL BONUS LAYER, and that is load-bearing rather than a nicety: production
// runs to completion whether or not the player ever opens one. Gating a recipe behind hand-eye
// skill would break the idle contract and punish offline play, which the absolute-readyAt
// timestamp model exists to protect. A player who never touches a minigame is playing the
// game correctly, just without the bonus.
//
// Each result contributes one EFFECT_KEYS entry, the same closed set the Laboratory and
// building Mastery use, so every multiplier in the game merges through one code path.
// MINIGAMES[id].cap bounds a perfect run, so no bonus is farmable without limit.
//
// State: state.minigames { pending: { buildingId: { gameId, seed, expiresAt } },
//                          results: { buildingId: { effect, amount, appliedAt } },
//                          played: { gameId: count } }

/** The minigame for a building, or null if it has none. */
export function forBuilding(buildingId) { /* Phase B */ }

/** True when this building has a queued batch a minigame could still improve. */
export function isAvailable(buildingId, now) { /* Phase B */ }

/**
 * Begin a run. Returns a seeded, deterministic setup so the same seed always produces the
 * same board — a replayed seed must not reroll into an easier round.
 */
export function start(buildingId, now) { /* Phase B */ }

/**
 * Finish a run with a 0..1 score. Returns { effect, amount } where amount is
 * score * MINIGAMES[gameId].cap, never more. Scores outside 0..1 are clamped rather than
 * trusted: the caller is UI code and a bad score must not become a bad bonus.
 */
export function finish(buildingId, score) { /* Phase B */ }

/** Abandon a run without penalty. Skipping a minigame is always free. */
export function cancel(buildingId) { /* Phase B */ }

/**
 * The pending bonus for a building, consumed when its batch is collected. Returns a zeroed
 * effect rather than null when nothing is pending, so callers never branch on absence.
 */
export function pendingBonus(buildingId) { /* Phase B */ }

/** Expire stale runs; called from the game loop. */
export function tick(now) { /* Phase B */ }
