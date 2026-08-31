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
//
// worldBounds()/clampCamera()/focusTile()/sortedObjects()/tileToScreen()/screenToTile() below
// are REAL implementations (not Phase B stubs) — this module is a live defect fix, not a
// content-stub contract. init() and drawFrame() stay stubs: they need a live canvas and the
// sprite draw functions from sprites.js, neither of which exist yet.

import { FARM } from '../data.js';

// Base tile size in px at zoom 1 (see design/handoff/SPRITE-NOTES.md §8: T = 104).
export const TILE_BASE = 104;
// oy ratio that clears the 76px HUD rail at 800px viewport height (§8).
const OY_RATIO = 0.2375;

export const camera = { x: 0, y: 0, zoom: 1 }; // zoom clamped [0.5, 2.5], eased toward targets

/** Attach to the canvas, size to window * devicePixelRatio, listen for resize. */
export function init(canvas) { /* Phase B: needs a live DOM canvas + resize listener */ }

/**
 * World tile coords → screen px (through the camera).
 * viewportW/viewportH default to a 1280x800 canvas (the shipped baseline in SPRITE-NOTES.md
 * §8) so this is callable without a live canvas — e.g. from tests, or from input.js/ui.js
 * which know the real canvas size and should pass it explicitly.
 */
export function tileToScreen(tx, ty, viewportW = 1280, viewportH = 800) {
  const T = TILE_BASE * camera.zoom;
  const ox = viewportW / 2 - (camera.x - camera.y) * T;
  const oy = viewportH * OY_RATIO - (camera.x + camera.y) * (T / 2);
  return [ox + (tx - ty) * T, oy + (tx + ty) * (T / 2)];
}

/** Screen px → world tile coords (for input picking). Exact inverse of tileToScreen. */
export function screenToTile(sx, sy, viewportW = 1280, viewportH = 800) {
  const T = TILE_BASE * camera.zoom;
  const ox = viewportW / 2 - (camera.x - camera.y) * T;
  const oy = viewportH * OY_RATIO - (camera.x + camera.y) * (T / 2);
  const a = (sx - ox) / T;        // tx - ty
  const b = ((sy - oy) * 2) / T;  // tx + ty
  return [(a + b) / 2, (b - a) / 2];
}

/**
 * The tile-space rectangle {minX,minY,maxX,maxY} the camera may travel over: the bounding box
 * of the start zone, every unlocked expansion, and every placed structure, padded by one tile.
 *
 * Takes the unlocked-zone list as an argument rather than assuming everything is unlocked —
 * bounds grow as the farm does. `unlockedExpansionIds` is an iterable of FARM.expansions[].id
 * (e.g. state.expansions, a Set, or an array). `structures` is an optional array of
 * { pos: {x,y}, size: [w,h] } — pass Object.values(STRUCTURES) filtered to placed/unlocked
 * ones, or omit to bound on the farm grid alone.
 */
export function worldBounds(unlockedExpansionIds = [], structures = []) {
  const unlocked = unlockedExpansionIds instanceof Set
    ? unlockedExpansionIds
    : new Set(unlockedExpansionIds);

  const rects = [FARM.startZone];
  for (const exp of FARM.expansions) {
    if (unlocked.has(exp.id)) rects.push(exp.rect);
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  for (const s of structures) {
    const [w, h] = s.size || [1, 1];
    const p = s.pos || { x: s.tx, y: s.ty };
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + w);
    maxY = Math.max(maxY, p.y + h);
  }

  const PAD = 1;
  return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD };
}

/**
 * Clamp camera.x/camera.y so the visible viewport stays inside `bounds` (tile space). Called
 * after every pan, zoom and resize — a zoom-out can put the camera out of bounds without any
 * pan happening at all, which is the case that gets missed.
 *
 * `bounds` defaults to worldBounds() with nothing unlocked (start zone only) so this is safe
 * to call with just a viewport size; pass the real bounds from worldBounds(unlocked, structs)
 * once the caller knows the unlocked set.
 */
export function clampCamera(viewportW = 1280, viewportH = 800, bounds = worldBounds()) {
  const T = TILE_BASE * camera.zoom;
  // Half-extent of the screen-space viewport, converted to tile-space (tx-ty) / (tx+ty) axes.
  const dx = (viewportW / 2) / T;       // half-range of (tx - ty) visible
  const dy = (viewportH / 2) / (T / 2); // half-range of (tx + ty) visible
  // The diamond-shaped visible region's bounding box on the tx and ty axes individually is
  // exactly (dx + dy) / 2 in both directions (tx = ((tx-ty)+(tx+ty))/2, and symmetrically ty).
  const half = (dx + dy) / 2;

  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;

  if (worldW <= half * 2) {
    camera.x = (bounds.minX + bounds.maxX) / 2;
  } else {
    camera.x = Math.min(Math.max(camera.x, bounds.minX + half), bounds.maxX - half);
  }

  if (worldH <= half * 2) {
    camera.y = (bounds.minY + bounds.maxY) / 2;
  } else {
    camera.y = Math.min(Math.max(camera.y, bounds.minY + half), bounds.maxY - half);
  }

  return camera;
}

/** Centre the camera on a tile, then clamp. Used by input.js when teleporting to a structure. */
export function focusTile(tx, ty, viewportW = 1280, viewportH = 800, bounds = worldBounds()) {
  camera.x = tx;
  camera.y = ty;
  return clampCamera(viewportW, viewportH, bounds);
}

/**
 * Placed objects sorted back-to-front for this frame: (a.tx + a.ty) - (b.tx + b.ty), then
 * a.tx - b.tx. Pure — returns a new array, never mutates `objects`. Sort once per frame, not
 * per object.
 */
export function sortedObjects(objects = []) {
  return [...objects].sort((a, b) => {
    const depth = (a.tx + a.ty) - (b.tx + b.ty);
    if (depth !== 0) return depth;
    return a.tx - b.tx;
  });
}

/** Draw one frame: ground, sorted objects (via sprites.js), progress rings, effects, lighting. */
export function drawFrame(now) { /* Phase B: needs a live canvas ctx + sprites.js draw fns */ }

/** Smoothly ease camera pan/zoom toward targets, then clamp; called each frame. */
export function tickCamera(dt) { /* Phase B: needs pan/zoom target state from input.js */ }
