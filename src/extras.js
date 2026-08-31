// extras.js — achievements, daily wheel, NPC visitors, pets, seasonal events, diamonds sinks.

/** Check all ACHIEVEMENTS against state.stats; unlock + toast + award diamonds for new ones. */
export function checkAchievements() { /* Phase B */ }

/** Is the daily spin available (once per calendar day, streak tracked)? */
export function canSpin(now) { /* Phase B */ }

/** Spin the wheel: returns the landed DAILY_WHEEL segment (streak boosts coin segments). */
export function spin() { /* Phase B */ }

/** Maybe spawn an NPC visitor offering to buy an owned item at a premium (from shop.tick). */
export function maybeSpawnVisitor(now) { /* Phase B */ }

/** Accept/decline the current visitor offer. */
export function resolveVisitor(accept) { /* Phase B */ }

/** Buy a pet; feedPet() once per day for PETS[x].feedXp. */
export function buyPet(petId) { /* Phase B */ }
export function feedPet(petId) { /* Phase B */ }

/** Rotating seasonal event: pick/advance the active EVENTS entry (~3 days each). */
export function tickEvent(now) { /* Phase B */ }

/** The active event's effect object ({} when none) — consumed by economy/fishing/mine. */
export function activeEventEffect() { /* Phase B */ }
