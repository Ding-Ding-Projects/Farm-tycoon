// renderer.js — camera + world drawing. The farm world is canvas; all menus are DOM (ui.js).
// Isometric-look 2:1 diamond tiles, devicePixelRatio-scaled for crisp high-DPI output.
//
// Draw order (design/handoff/SPRITE-NOTES.md §4): ground layer first — field, mottling, pond,
// road, tufts, plots, fences — then placed objects SORTED BACK-TO-FRONT, then the two lighting
// gradients, then DOM chrome on top.
//
// DEPTH SORTING IS NOT OPTIONAL any more. The old fixed call order was fine while nothing
// overlapped, but STRUCTURES places 22 objects across a 40x40 grid and the moment one building
// sits south of another the fixed order draws them in the wrong sequence. Sort by (tx + ty)
// each frame, tie-broken by tx.
//
// CAMERA CLAMPING IS A LIVE REQUIREMENT, not a nicety. At T = 104 a 1280-wide canvas shows
// about 12 tiles; FARM.gridSize is 40. Without panning and clamping to the placed-object
// bounding box, roughly half the farm is unreachable — the expansions exist in data and the
// player can never look at them.

export const camera = { x: 0, y: 0, zoom: 1 }; // zoom clamped [0.5, 2.5], eased toward targets

/** Attach to the canvas, size to window * devicePixelRatio, listen for resize. */
export function init(canvas) { /* Phase B */ }

/** World tile coords → screen px (through the camera). */
export function tileToScreen(tx, ty) { /* Phase B */ }

/** Screen px → world tile coords (for input picking). */
export function screenToTile(sx, sy) { /* Phase B */ }

/**
 * The tile-space rectangle the camera may travel over: the bounding box of everything placed,
 * padded by a tile. Derived from unlocked zones + STRUCTURES, so it grows as the farm does
 * rather than being a constant that silently stops matching the world.
 */
export function worldBounds() { /* Phase B */ }

/**
 * Clamp the camera so the viewport stays inside worldBounds(). Called after every pan, zoom
 * and resize — a zoom-out can put the camera out of bounds without any pan happening, which is
 * the case that gets missed.
 */
export function clampCamera() { /* Phase B */ }

/** Centre the camera on a tile, clamped. Used by input.js when teleporting to a structure. */
export function focusTile(tx, ty) { /* Phase B */ }

/**
 * Placed objects sorted back-to-front for this frame: (a.tx + a.ty) - (b.tx + b.ty), then
 * a.tx - b.tx. Sorted once per frame, not per object.
 */
export function sortedObjects() { /* Phase B */ }

/** Draw one frame: ground, sorted objects (via sprites.js), progress rings, effects, lighting. */
export function drawFrame(now) { /* Phase B */ }

/** Smoothly ease camera pan/zoom toward targets, then clamp; called each frame. */
export function tickCamera(dt) { /* Phase B */ }
