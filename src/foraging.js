// foraging.js — free respawning world nodes (FORAGING, from L1).
//
// The most important short-gap filler in the game, and free is the entire point: every other
// activity has a price (the mine wants tools, the meadow wants energy, fishing has cooldowns),
// which left a player with two idle minutes nothing to do. Nodes cost nothing and are simply
// tapped.
//
// Respawns are absolute readyAt timestamps, and offlineRespawnCap bounds what accrues while
// away so a fortnight's absence does not carpet the farm in free goods.
// State: state.foraging { nodes: [{ id, type, x, y, readyAt }] }

/** Nodes currently placed in the world, ready or not. */
export function nodes() { /* Phase B */ }

/** Nodes ready to collect right now. */
export function ready(now) { /* Phase B */ }

/** Collect one node: rolls its yield table, pays XP, and sets its next readyAt. */
export function collectNode(nodeId, now) { /* Phase B */ }

/** Place and respawn nodes, honouring maxActive, globalMaxActive and offlineRespawnCap. */
export function tick(now) { /* Phase B */ }
