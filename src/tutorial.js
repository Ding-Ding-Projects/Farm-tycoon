// tutorial.js — guided first minutes: a step machine driven by data.js TUTORIAL.steps.
// Each step: move the .tutorial-spotlight cutout + .tutorial-arrow to the step's target
// (resolved per the target semantics documented on TUTORIAL), show its text in
// .tutorial-bubble, then wait for the step's completion event via notify().
// While a step has a world/dock target, input is gated: only clicks inside the spotlight
// pass through (isGating() + a hit test in input.js). Steps with target null show a
// centered bubble with a Continue button that fires notify('dismissed').
// Progress (current step index / completed flag) persists in state; skippable from
// settings. Finishing pays TUTORIAL.finishReward and fires a celebration toast.

/** Start or resume the tutorial if not completed; wires the overlay DOM. */
export function init() { /* Phase B */ }

/** Notify the tutorial of a game event ('planted', 'harvested', 'placed:chicken',
 *  'panel_opened:inventory', ...); advances when it matches the current step's event. */
export function notify(event) { /* Phase B */ }

/** Is the tutorial currently gating input to the highlighted target only? */
export function isGating() { /* Phase B */ }

/** Screen-space rect of the current step's spotlight target (input.js hit test). */
export function gateRect() { /* Phase B */ }

/** Skip the whole tutorial (settings panel); marks complete without the finish reward. */
export function skip() { /* Phase B */ }
