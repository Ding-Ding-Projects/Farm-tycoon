// decorate.js — decorating mode and photo mode (DECORATE, PHOTO).
//
// Decorating is a MODE over the world rather than a place, which makes it the single declared
// exception to the rule that systems open by clicking their structure: it toggles from the dock,
// because there is no building called "rearranging things".
//
// The filler that never runs out, because the player supplies the goal. No timers, no resource
// cost, nothing to collect.
// State: state.decorate { active, selection: [objectId], history: [], historyIndex }
//        state.photo { frame, stickers: [{ id, x, y }] }

/** Enter decorating mode. */
export function enter() { /* Phase B */ }

/** Leave it, committing placements. */
export function exit() { /* Phase B */ }

/** Select an object, optionally adding to the current selection. */
export function select(objectId, additive) { /* Phase B */ }

/** Move the selection by a tile delta, snapping and refusing invalid placements. */
export function move(dx, dy) { /* Phase B */ }

/** Rotate the selection through DECORATE.rotations steps. */
export function rotate() { /* Phase B */ }

/** Undo / redo, bounded by DECORATE.undoDepth. */
export function undo() { /* Phase B */ }
export function redo() { /* Phase B */ }

/** Photo mode: choose a frame, place stickers, and render the current view. */
export function setFrame(frameId) { /* Phase B */ }
export function addSticker(id, x, y) { /* Phase B */ }
export function capture() { /* Phase B */ }
