// tutorial.js — guided first minutes: a step machine with arrow + highlight overlay.
// Steps: plant wheat → harvest → buy chicken coop → make feed... → bake bread → first order.
// Progress persists in state; skippable from settings.

/** Start or resume the tutorial if not completed. */
export function init() { /* Phase B */ }

/** Notify the tutorial of a game event ('planted'|'harvested'|'fed'|...); advances steps. */
export function notify(event) { /* Phase B */ }

/** Is the tutorial currently gating input to the highlighted target only? */
export function isGating() { /* Phase B */ }
