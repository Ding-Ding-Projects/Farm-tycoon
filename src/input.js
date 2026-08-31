// input.js — mouse/touch: click-select (radial menu), drag-to-plant across plots,
// drag-pan the camera, wheel/pinch zoom, edit-mode object dragging.
// Click vs drag disambiguated by a small movement threshold.

/** Attach listeners to the canvas; routes picks through renderer.screenToTile + farm.objectAt. */
export function init(canvas) { /* Phase B */ }

/** Enter/exit edit (move) mode for rearranging objects. */
export function setEditMode(on) { /* Phase B */ }

/** Enter placement mode with a ghost preview for a build-menu selection. */
export function beginPlacement(kind, type) { /* Phase B */ }
