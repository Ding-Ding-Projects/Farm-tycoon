// coop.js — the co-op and its request board (L52). Members come from neighbours.js; this
// module generates nobody.
//
// The request board is the supply valve: when one missing input blocks a recipe, asking a
// neighbour beats waiting out a grow timer. Filling others' requests earns co-op points, which
// buy permanent perks whose effects flow through EFFECT_KEYS like everything else.
// State: state.coop { points, perksUnlocked, dailyTasks, tasksRefreshedAt,
//                     requests: [{ id, item, qty, filled, postedAt, readyAt, byNeighbourId }],
//                     ownRequestCooldownUntil }

/** Co-op members for this save, drawn from neighbours.roster(). */
export function members() { /* Phase B */ }

/** Today's three tasks, refreshing at COOP.dailyTasks.refreshHourLocal. */
export function dailyTasks() { /* Phase B */ }

/** Claim a completed daily task's reward. */
export function claimTask(taskId) { /* Phase B */ }

/** The open request board, including the player's own posts. */
export function requests() { /* Phase B */ }

/** Post a request for an item. Bounded by ownRequestSlots and the cooldown. */
export function postRequest(item, qty) { /* Phase B */ }

/** Cancel one of the player's own requests. */
export function cancelRequest(id) { /* Phase B */ }

/** Collect a request a neighbour has filled. */
export function collectRequest(id) { /* Phase B */ }

/** Fill a neighbour's request from the barn; pays coins, XP and co-op points. */
export function helpRequest(id) { /* Phase B */ }

/** Lifetime co-op points. */
export function contributionPoints() { /* Phase B */ }

/** Merged effect object from every unlocked perk, for the shared multiplier merge point. */
export function activePerkEffect() { /* Phase B */ }

/** Advance neighbour fill timers and refresh the board; called from the game loop. */
export function tick(now) { /* Phase B */ }
