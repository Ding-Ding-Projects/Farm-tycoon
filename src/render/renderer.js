// renderer.js — camera + world drawing. The farm world is canvas; all menus are DOM (ui.js).
// Isometric-look 2:1 diamond tiles, devicePixelRatio-scaled for crisp high-DPI output.
// Draw order: terrain → zone edges → objects sorted by (y + x) → effects → clouds/day tint.

export const camera = { x: 0, y: 0, zoom: 1 }; // zoom clamped [0.5, 2.5], eased toward targets

/** Attach to the canvas, size to window * devicePixelRatio, listen for resize. */
export function init(canvas) { /* Phase B */ }

/** World tile coords → screen px (through the camera). */
export function tileToScreen(tx, ty) { /* Phase B */ }

/** Screen px → world tile coords (for input picking). */
export function screenToTile(sx, sy) { /* Phase B */ }

/** Draw one frame: terrain, objects (via sprites.js draw functions), progress rings, effects. */
export function drawFrame(now) { /* Phase B */ }

/** Smoothly ease camera pan/zoom toward targets; called each frame. */
export function tickCamera(dt) { /* Phase B */ }
