// production.js — all timed work: crop growth, animal feeding/collection, building queues.
// Every timer is an absolute `readyAt` timestamp; tick() resolves anything past due,
// including everything that finished while the game was closed (resolved on load).

/** Plant a crop on a field plot (consumes 1 seed from the silo). */
export function plant(fieldId, cropId) { /* Phase B */ }

/** Growth stage 0..3 for rendering, derived from plantedAt/growTime. */
export function growthStage(field) { /* Phase B */ }

/** Harvest a ready field: +2x seeds to silo (capacity permitting), +XP, sparkle effect. */
export function harvest(fieldId) { /* Phase B */ }

/** Feed an animal pen (consumes feed items from barn); starts its produce timer. */
export function feedPen(penId) { /* Phase B */ }

/** Collect ready animal products into the barn. */
export function collectPen(penId) { /* Phase B */ }

/** Enqueue a recipe on a production building (consumes inputs immediately, Hay Day-style). */
export function enqueue(buildingId, recipeId) { /* Phase B */ }

/** Collect a finished queue slot's output into the barn. */
export function collectBuilding(buildingId) { /* Phase B */ }

/** Skip a timer with diamonds (uses economy.skipCost). */
export function skipTimer(target) { /* Phase B */ }

/** Advance all timers; called every frame and once on load with offline elapsed time. */
export function tick(now) { /* Phase B */ }
