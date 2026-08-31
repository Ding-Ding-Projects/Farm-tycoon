// effects.js — transient world-space juice: coin bursts, +XP floaters, harvest sparkles,
// placement bounce, ready-checkmark pops. Effects are particles with easing, pruned when done.

/** Spawn a coin burst at a world tile. */
export function coinBurst(tx, ty, amount) { /* Phase B */ }

/** Floating "+N XP" text. */
export function xpFloater(tx, ty, amount) { /* Phase B */ }

/** Harvest sparkle shower. */
export function sparkle(tx, ty) { /* Phase B */ }

/** Elastic bounce applied to a newly placed object. */
export function placeBounce(objectId) { /* Phase B */ }

/** Advance + draw all live effects (called by renderer.drawFrame). */
export function tickAndDraw(ctx, now) { /* Phase B */ }
