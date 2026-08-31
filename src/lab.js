// lab.js — the Laboratory (L54): permanent research, not Township's timed boosters.
//
// researchedEffect() is the SINGLE merge point for every permanent multiplier in the game.
// economy.js, production.js, farm.js, mine.js and fishing.js all read their multipliers through
// it, merged with minigame results and co-op perks, so three systems that grant bonuses cannot
// drift into three different opinions about what a bonus means.
// State: state.lab { built, researched: [nodeId], active: { id, readyAt } | null }

/** Build the laboratory; consumes LAB.buildCost. */
export function build() { /* Phase B */ }

/** Nodes whose prerequisites are met and which are not yet researched. */
export function availableNodes() { /* Phase B */ }

/** Whether this node's prerequisites, coins, items and materials are all satisfied. */
export function canResearch(id) { /* Phase B */ }

/** Start researching; consumes cost. Only LAB.slots may run at once. */
export function startResearch(id) { /* Phase B */ }

/** Cancel active research. Refunds in full - a cancelled project must not cost anything. */
export function cancelResearch() { /* Phase B */ }

/**
 * The merged effect of everything researched, as { effectKey: value }. Keys come from
 * EFFECT_KEYS. Returns a complete object with neutral values rather than a sparse one, so
 * callers never branch on a missing key.
 */
export function researchedEffect() { /* Phase B */ }

/** Complete finished research; called from the game loop. */
export function tick(now) { /* Phase B */ }
