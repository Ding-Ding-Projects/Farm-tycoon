// mine.js — the mine (L24): spend a pickaxe or dynamite to dig; yields ore/gems per the
// weight tables of the CURRENT DEPTH (event gold_rush doubles). Ore refines in the Smelter
// building (a normal production building — see production.js/enqueue).
//
// The mine now has five tiered depths (MINE.depths). Each is opened with coins and materials,
// yields richer ore than the last, and only depths below the surface seam drop artifacts —
// which go to museum.js, never to the barn.
//
// MINE.tools is a live getter onto depths[0].tools, kept so dig() and the validator keep
// working unchanged. Read it for the surface seam only; anything depth-aware goes through
// digAt() instead.
// State: state.mine { depthUnlocked: [depthId], currentDepth, digs }

/** Dig with a tool ('pickaxe'|'dynamite') at the surface seam. Sugar for digAt(depth 1). */
export function dig(tool) { /* Phase B */ }

/** Dig at a specific unlocked depth; consumes the tool, rolls that depth's yield table. */
export function digAt(depthId, tool) { /* Phase B */ }

/** Every depth, with its unlock state and requirements (for the mine panel). */
export function depths() { /* Phase B */ }

/** The depth the player is currently working. */
export function currentDepth() { /* Phase B */ }

/** Open a new depth; consumes its coins and materials. */
export function unlockDepth(depthId) { /* Phase B */ }

/** Tools the player currently owns (for the mine panel UI). */
export function availableTools() { /* Phase B */ }
