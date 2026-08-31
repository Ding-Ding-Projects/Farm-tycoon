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

// ---- Events (data.js EVENTS: weekend point events, weekday mini-events, Farm Fair, holidays)
// All scheduling is deterministic from the local calendar: ISO week number picks the
// weekend/mini rotation entry; the Fair runs the first full week of each month (L15+);
// holidays key off the month. Event state: state.event { id, kind, endsAt, points,
// claimedTiers }, plus state.fair { tasks, progress, ribbonsClaimed } and lifetime
// state.fairPass { goldRibbons }. Invariants: points never negative; each tier/ribbon
// claimable exactly once; expired events settle unclaimed tiers as lost (like Hay Day).

/** Advance/settle the event calendar; starts and expires events. Called from the game loop. */
export function tickEvents(now) { /* Phase B */ }

/** The active weekend or mini event descriptor + live points, or null. */
export function activeWeekendEvent() { /* Phase B */ }

/** Merged passive-buff object from the active event + holiday ({} when none) —
 *  consumed by economy/fishing/mine/boat/merge. */
export function activeEventEffect() { /* Phase B */ }

/** Score event points for a themed action (called by trackStat routing); shows a floater. */
export function addEventPoints(stat, amount) { /* Phase B */ }

/** Claim a reached tier ('bronze'|'silver'|'gold') of the active event; idempotent. */
export function claimEventTier(tier) { /* Phase B */ }

/** The active Farm Fair (task list + per-task progress + ribbon state), or null. */
export function activeFair() { /* Phase B */ }

/** Progress fraction for one fair task (from stat deltas since the fair started). */
export function fairTaskProgress(taskId) { /* Phase B */ }

/** Claim the earned ribbon at fair end; updates fairPass and unlocks trophy decorations. */
export function claimFairRibbon() { /* Phase B */ }

/** The active holiday season descriptor (tint, flags, limited decorations), or null. */
export function activeHoliday() { /* Phase B */ }
