// input.js — mouse/touch: click-select (radial menu), drag-to-plant across plots,
// drag-pan the camera, wheel/pinch zoom, edit-mode object dragging.
// Click vs drag disambiguated by a small movement threshold.

/** Attach listeners to the canvas; routes picks through renderer.screenToTile + farm.objectAt. */
export function init(canvas) { /* Phase B */ }

/** Enter/exit edit (move) mode for rearranging objects. */
export function setEditMode(on) { /* Phase B */ }

/** Enter placement mode with a ghost preview for a build-menu selection. */
export function beginPlacement(kind, type) { /* Phase B */ }

// ---- World-object dispatch ----
// Every system with a physical presence opens by CLICKING ITS STRUCTURE IN THE WORLD, never
// from a HUD or dock button: the truck, the boat dock, the station, the airport, the helipad,
// the mine, the workshop, the museum, the laboratory, the camp, the order board, the lake, the
// meadow, the market stall, the mailbox, the shelf, the tripod, and the town and zoo gates.
// STRUCTURES in data.js gives each a footprint and a position, so a pick resolves to exactly
// one structure id and that id names the panel to open.
//
// The HUD keeps only ambient state (currencies, level, storage meters). The dock keeps only
// what has no place in the world: settings, achievements, co-op and regatta, and decorating
// mode - which is a mode rather than a place, and is the one declared exception.
//
// Locked structures are DERELICT AND STILL CLICKABLE from level 1, showing their unlock
// requirement. That is what makes a level-90 system discoverable at level 5.

/** Resolve a world pick to a structure id, or null if the pick hit ground or a plot. */
export function structureAt(tx, ty) { /* Phase B */ }

/** Open the panel a structure owns, or its locked/derelict explanation if not yet unlocked. */
export function openStructure(structureId) { /* Phase B */ }
