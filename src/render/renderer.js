// renderer.js — camera + world drawing. The farm world is canvas; all menus are DOM (ui.js).
// Isometric-look 2:1 diamond tiles, devicePixelRatio-scaled for crisp high-DPI output.
//
// Draw order (design/handoff/SPRITE-NOTES.md §4): ground layer first — the world-anchored ground
// texture (render/ground.js), per-tile tufts and flowers, the placement grid when a ghost is up —
// then every object SORTED BACK-TO-FRONT, then progress rings, the ghost, particles, and the two
// lighting gradients; DOM chrome sits on top of all of it.
//
// THE ANCHOR CONVENTION, stated once because every sprite depends on it: tileToScreen(tx, ty)
// returns the TOP vertex of tile (tx, ty)'s diamond. A tile is 2T wide and T tall, its centre is
// (x, y + T/2), and drawGrassTile/drawSoilPlot/screenToTile all agree on that. Objects bigger
// than one tile are anchored at the top vertex of their footprint's CENTRAL virtual tile
// (objectAnchor below) and scaled by their footprint, so a 2x2 bakery stands in the middle of
// its 2x2 plot at 2x scale rather than as a one-tile hut in the plot's north-west corner - which
// is what every building, pen and structure used to do, while the hit area (farm.objectAt /
// input.js structureAt) covered the whole footprint.
//
// DEPTH SORTING IS NOT OPTIONAL: STRUCTURES places 22 objects across a 40x40 grid, so objects
// overlap, and a multi-tile object's depth is its footprint's FAR corner (depthOf), not its anchor.
//
// CAMERA CLAMPING IS A LIVE REQUIREMENT. At T = 104 a 1280-wide canvas shows about 12 tiles;
// FARM.gridSize is 40. tickCamera() clamps EVERY FRAME, before drawFrame, against bounds from a
// caller-registered provider (setBoundsProvider) - this module has no game-logic imports and
// only knows FARM's static tile-space geometry via data.js.

import { FARM } from '../data.js';
import * as sprites from './sprites.js';
import * as ground from './ground.js';
import * as effects from './effects.js';
import * as motion from '../motion.js';

// Base tile size in px at zoom 1 (see design/handoff/SPRITE-NOTES.md §8: T = 104).
export const TILE_BASE = 104;
// oy ratio that clears the 76px HUD rail at 800px viewport height (§8).
const OY_RATIO = 0.2375;

/**
 * Height (CSS px) of the fixed top HUD rail (styles.css `.hud-top`). A tile positioned above
 * this line on screen is behind opaque chrome — technically inside the canvas, but not
 * actually visible to the player. Uses the wider of the two declared heights (76px normal,
 * 64px under the narrow-viewport media query in styles.css).
 *
 * Deliberately NOT folded into clampCamera()'s bounds-protection math below. That math answers
 * a different question — "does the visible viewport show tile-space the farm doesn't have" —
 * and the canvas still legitimately owns every pixel under the HUD; shrinking the protected
 * region there would let the clamp show real void (content past `bounds`) precisely where a
 * human reviewer can't see it happening, which is a worse failure mode than the one this fix
 * exists to close. HUD_INSET_PX answers the separate question "is this particular tile
 * actually visible", which is what callers (and this module's tests) should check a specific
 * tile's tileToScreen() result against, rather than hard-coding the 76 again.
 */
export const HUD_INSET_PX = 76;

export const camera = { x: 0, y: 0, zoom: 1 }; // zoom clamped [0.5, 2.5], eased toward targets
// Pan/zoom targets that input.js writes to; tickCamera eases camera.{x,y,zoom} toward these.
export const cameraTarget = { x: 0, y: 0, zoom: 1 };
const ZOOM_MIN = 0.5, ZOOM_MAX = 2.5;
const EASE = 10; // higher = snappier

let canvasRef = null;
let ctxRef = null;
let viewportW = 1280;
let viewportH = 800;

/**
 * Optional function returning the live camera bounds {minX,minY,maxX,maxY}, registered by the
 * caller (main.js's boot()) via setBoundsProvider() below. tickCamera() and resizeToWindow() —
 * every call site that clamps without an explicit `bounds` argument from its own caller — read
 * this each time they run, instead of always falling back to clampCamera()'s bare worldBounds()
 * default (start zone only).
 *
 * A PROVIDER FUNCTION, not a one-shot bounds object, and registered rather than imported: this
 * module deliberately has no game-logic imports (it knows FARM's static tile-space geometry via
 * data.js, but not which expansions a save has unlocked), and the unlocked set genuinely changes
 * during play — an expansion unlocking must widen the clamp's domain immediately.
 *
 * Unset (the default, and the state every test in tools/test-camera.mjs runs under) falls back
 * to clampCamera()'s own bare default — safe because that default still fully enforces the
 * void-protection contract, just over a smaller domain.
 */
let boundsProvider = null;

/**
 * Register the function tickCamera()/resizeToWindow() call to get the live camera bounds. Pass
 * a function, or null/undefined to clear it back to the bare default.
 */
export function setBoundsProvider(fn) {
  boundsProvider = typeof fn === 'function' ? fn : null;
}

/**
 * Current bounds from the registered provider, or undefined (letting clampCamera fall back to
 * its own bare default). Wrapped so a throwing provider degrades to that safe bare clamp instead
 * of breaking the render loop.
 */
function liveBounds() {
  if (!boundsProvider) return undefined;
  try {
    return boundsProvider();
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

function resizeToWindow() {
  if (!canvasRef) return;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const w = (typeof window !== 'undefined' && window.innerWidth) || viewportW;
  const h = (typeof window !== 'undefined' && window.innerHeight) || viewportH;
  viewportW = w; viewportH = h;
  canvasRef.width = Math.round(w * dpr);
  canvasRef.height = Math.round(h * dpr);
  canvasRef.style.width = `${w}px`;
  canvasRef.style.height = `${h}px`;
  ctxRef = canvasRef.getContext('2d');
  ctxRef.setTransform(dpr, 0, 0, dpr, 0, 0);
  clampCamera(viewportW, viewportH, liveBounds());
}

/** Attach to the canvas, size to window * devicePixelRatio, listen for resize. */
export function init(canvas) {
  canvasRef = canvas;
  resizeToWindow();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resizeToWindow);
  }
  return ctxRef;
}

/** Current live 2d context, if init() has run (used by input.js for hit-testing helpers). */
export function getContext() { return ctxRef; }
/** Current viewport size in CSS px (post-resize). */
export function getViewport() { return { w: viewportW, h: viewportH }; }

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
 * Everything the ground pass needs about this frame's view: the tile size T, the screen offset
 * (ox, oy) of tile-space origin — the same numbers tileToScreen uses, so `screen = [ox +
 * (tx - ty) T, oy + (tx + ty) T/2]` — and the integer tile box that covers the whole viewport
 * (from screenToTile at the four corners, padded by one tile).
 */
export function viewGeometry(viewportW = 1280, viewportH = 800) {
  const T = TILE_BASE * camera.zoom;
  const ox = viewportW / 2 - (camera.x - camera.y) * T;
  const oy = viewportH * OY_RATIO - (camera.x + camera.y) * (T / 2);
  let minTx = Infinity, maxTx = -Infinity, minTy = Infinity, maxTy = -Infinity;
  for (const [sx, sy] of [[0, 0], [viewportW, 0], [0, viewportH], [viewportW, viewportH]]) {
    const [tx, ty] = screenToTile(sx, sy, viewportW, viewportH);
    minTx = Math.min(minTx, tx); maxTx = Math.max(maxTx, tx);
    minTy = Math.min(minTy, ty); maxTy = Math.max(maxTy, ty);
  }
  return {
    T, ox, oy, w: viewportW, h: viewportH,
    minTx: Math.floor(minTx) - 1, maxTx: Math.ceil(maxTx) + 1,
    minTy: Math.floor(minTy) - 1, maxTy: Math.ceil(maxTy) + 1,
  };
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
 *
 * THE NORTH/SOUTH SPLIT IS NOT SYMMETRIC: tileToScreen puts the camera's OWN target tile at
 * `oy = viewportH * OY_RATIO` — near the TOP of the screen — so only a sliver of the viewport
 * sits north of the target and most of it sits south. Both directions are derived exactly from
 * tileToScreen's own algebra below, not approximated.
 */
export function clampCamera(viewportW = 1280, viewportH = 800, bounds = worldBounds()) {
  const p = clampPoint(camera.x, camera.y, camera.zoom, viewportW, viewportH, bounds);
  camera.x = p.x;
  camera.y = p.y;
  return camera;
}

/**
 * Clamp the PAN TARGET too, not just the eased camera.
 *
 * input.js pans by moving cameraTarget; only camera was ever clamped. So a drag that ran into
 * an edge kept pushing the target further and further outside the legal box while the camera
 * stood still — and then dragging back the other way did nothing at all until the target had
 * travelled all the way back inside. That dead zone is exactly what "the map will not drag"
 * feels like from the player side. Clamping the target keeps the two in the same world.
 */
export function clampCameraTarget(viewportW = 1280, viewportH = 800, bounds = worldBounds()) {
  // Clamp against the TARGET zoom, not the current one: a pan and a zoom-in often arrive
  // together, and judging the destination by the zoom being left behind pins the target to the
  // wide view's tighter box, so the camera can never reach where a zoomed-in view could legally go.
  const p = clampPoint(cameraTarget.x, cameraTarget.y, cameraTarget.zoom, viewportW, viewportH, bounds);
  cameraTarget.x = p.x;
  cameraTarget.y = p.y;
  return cameraTarget;
}

/** The shared geometry behind both clamps: where may a camera point sit, given this zoom? */
function clampPoint(x, y, zoom, viewportW, viewportH, bounds) {
  const T = TILE_BASE * zoom;
  // Half-range of (tx - ty) visible: symmetric, because tileToScreen centres the camera
  // target horizontally (ox = viewportW/2 - ...).
  const dx = (viewportW / 2) / T;

  // Range of (tx + ty) visible north vs. south of the camera target (see tileToScreen: sy=0 is
  // `oy` tile-rows north of the target's row, sy=viewportH is `viewportH-oy` rows south of it).
  // Deliberately based on the FULL raw canvas (sy=0..viewportH), not shrunk by HUD_INSET_PX —
  // see that constant's comment for why the HUD stays out of this specific calculation.
  const northSpan = (viewportH * OY_RATIO) / (T / 2);       // (tx+ty) visible north of target
  const southSpan = (viewportH * (1 - OY_RATIO)) / (T / 2); // (tx+ty) visible south of target

  // tx and ty share the same pair of offsets from camera.x/camera.y: tileToScreen's (a,b) axes
  // mix tx and ty symmetrically (tx=(a+b)/2, ty=(b-a)/2), so a rectangular a/b viewport maps to
  // tx and ty ranges that are each [camera - halfNorth, camera + halfSouth].
  const halfNorth = (dx + northSpan) / 2;
  const halfSouth = (dx + southSpan) / 2;

  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;

  // When `bounds` is small enough to fit entirely inside the visible span either way, there is
  // a whole RANGE of camera positions that show all of it (not just one exact centre) — the
  // feasible range is [bounds.maxX - halfSouth, bounds.minX + halfNorth], and its midpoint is
  // offset from the plain bounds-centre by (halfNorth - halfSouth) / 2. Since halfSouth is
  // always the bigger of the two (most of the viewport sits south of the camera target),
  // that offset always shifts the picked position NORTH of plain centre — the same direction
  // the fix above needed, and for the same reason: plain centring puts the camera-target row
  // further south on screen than the asymmetric projection can afford to spare, so content
  // north of centre (again: the starting fields) can end up hidden even when the whole bounds
  // box would technically "fit".
  const outX = worldW <= halfNorth + halfSouth
    ? (bounds.minX + bounds.maxX) / 2 + (halfNorth - halfSouth) / 2
    : Math.min(Math.max(x, bounds.minX + halfNorth), bounds.maxX - halfSouth);

  const outY = worldH <= halfNorth + halfSouth
    ? (bounds.minY + bounds.maxY) / 2 + (halfNorth - halfSouth) / 2
    : Math.min(Math.max(y, bounds.minY + halfNorth), bounds.maxY - halfSouth);

  return { x: outX, y: outY };
}

/**
 * Point the camera at a tile, then clamp. Used by input.js when teleporting to a structure,
 * and by main.js on boot to look at the start zone.
 *
 * "Point at" is deliberate, not "centre": camera.x/camera.y is the tile tileToScreen renders
 * at (viewportW/2, viewportH*OY_RATIO) — horizontally centred but, because OY_RATIO = 0.2375,
 * placed near the TOP of the screen rather than the middle (design/handoff/SPRITE-NOTES.md §8
 * — this keeps the target tile itself clear of the 76px HUD rail).
 */
export function focusTile(tx, ty, viewportW = 1280, viewportH = 800, bounds = worldBounds()) {
  camera.x = tx;
  camera.y = ty;
  return clampCamera(viewportW, viewportH, bounds);
}

// ---------------------------------------------------------------------------------------------
// Footprints: where a render object is drawn, how big, and how deep.
// ---------------------------------------------------------------------------------------------

/** Sprite scale for a footprint: a 2x2 building draws at twice a 1x1 field's size. */
export function footprintScale(fw = 1, fh = 1) {
  return Math.max(1, fw || 1, fh || 1);
}

/**
 * Screen anchor + sprite scale for a render object { tx, ty, fw?, fh?, scale? }: the top vertex
 * of the footprint's central virtual tile, and zoom times the footprint scale (or an explicit
 * `scale` override). Every sprite draws relative to this point in its own T = 104 * size units,
 * so a 1x1 object is unchanged from before and a bigger one is centred on its plot.
 */
export function objectAnchor(obj, viewportW = 1280, viewportH = 800) {
  const fw = obj.fw || 1, fh = obj.fh || 1;
  const [sx, sy] = tileToScreen(obj.tx + (fw - 1) / 2, obj.ty + (fh - 1) / 2, viewportW, viewportH);
  const size = camera.zoom * (typeof obj.scale === 'number' ? obj.scale : footprintScale(fw, fh));
  return [sx, sy, size];
}

/**
 * Painter's depth: the footprint's FAR corner (tx + fw - 1) + (ty + fh - 1), or an explicit
 * `depth` override (animals inside a pen sit just after the pen floor and before its front
 * rails). A {tx, ty}-only object sorts exactly as it always did.
 */
export function depthOf(obj) {
  if (typeof obj.depth === 'number') return obj.depth;
  return (obj.tx + (obj.fw || 1) - 1) + (obj.ty + (obj.fh || 1) - 1);
}

/**
 * Placed objects sorted back-to-front for this frame by depthOf(), tie-broken by tx. Pure —
 * returns a new array, never mutates `objects`. Sort once per frame, not per object.
 */
export function sortedObjects(objects = []) {
  return [...objects].sort((a, b) => {
    const depth = depthOf(a) - depthOf(b);
    if (depth !== 0) return depth;
    return a.tx - b.tx;
  });
}

/**
 * Linear grow fraction 0..1 for a field object still carrying its raw cropId/plantedAt/readyAt
 * (rather than main.js's buildWorld(), which already resolves that into a precomputed
 * {kind:'crop', growProgress} object). readyAt is the end of the bar, not plantedAt + growTime,
 * so a timer that was skipped with diamonds reads as ready the moment it is.
 */
function fieldGrowProgress(obj, now) {
  const t = typeof now === 'number' ? now : Date.now();
  if (!obj.plantedAt || !obj.readyAt || obj.readyAt <= obj.plantedAt) return 1;
  return Math.max(0, Math.min(1, (t - obj.plantedAt) / (obj.readyAt - obj.plantedAt)));
}

// The frame's light ({ sun, vignette, night }) from main.js's day/night cycle; buildings read
// `night` to light their windows. Set at the top of drawFrame, empty when no cycle is running.
let frameLight = {};

// kind -> dispatch fn(ctx, x, y, size, obj, now). Keeps drawFrame() a plain loop instead of a
// growing if/else ladder; add a new kind here, not inline below.
const KIND_DISPATCH = {
  // Bare soil plot — buildWorld() pushes exactly this for an unplanted field (kind:'field',
  // no cropId). Defensive: if a caller ever hands a field object that still carries its raw
  // cropId/plantedAt/readyAt, draw the crop growing on the soil rather than falling through.
  field: (ctx, x, y, size, obj, now) => {
    sprites.drawSoilPlot(ctx, x, y, size);
    if (obj.cropId) {
      const fn = sprites.CROP_DRAW[obj.cropId];
      if (fn) fn(ctx, x, y, size, fieldGrowProgress(obj, now));
      else sprites.drawPlaceholder(ctx, x, y, size, obj.cropId);
    }
  },
  // A planted field keeps its soil slab: crops grow out of tilled earth, not out of the lawn.
  crop: (ctx, x, y, size, obj) => {
    sprites.drawSoilPlot(ctx, x, y, size);
    const fn = sprites.CROP_DRAW[obj.type];
    if (fn) fn(ctx, x, y, size, obj.growProgress ?? 1);
    else sprites.drawPlaceholder(ctx, x, y, size, obj.type);
  },
  animal: (ctx, x, y, size, obj) => {
    const fn = sprites.ANIMAL_DRAW[obj.type];
    if (fn) fn(ctx, x, y, size, obj.idleFrame ?? 0);
    else sprites.drawPlaceholder(ctx, x, y, size, obj.type);
  },
  // The pen is two render objects: the floor, shelter and far fence ('pen'), then the animals,
  // then the near fence ('penfront') so the animals stand behind the rails, not on them.
  pen: (ctx, x, y, size, obj) => sprites.drawPen(ctx, x, y, size, obj.type, {
    fw: obj.fw, fh: obj.fh, part: 'back', fed: !!obj.fed, ready: !!obj.ready,
  }),
  penfront: (ctx, x, y, size, obj) => sprites.drawPen(ctx, x, y, size, obj.type, {
    fw: obj.fw, fh: obj.fh, part: 'front',
  }),
  // `now` and `working` are what make an animated building possible at all: drawBuilding has no
  // clock of its own, so a frame that forgets to pass them renders a permanently idle factory.
  building: (ctx, x, y, size, obj, now) => sprites.drawBuilding(ctx, x, y, size, obj.type, {
    // `working` stays TRUE under reduced motion; only the clock freezes. A state must never be
    // signalled by motion alone, any more than by colour alone: the lantern, firebox and plume
    // are static working signals, so a frozen factory still reads as busy from across the farm.
    derelict: !!obj.derelict, working: !!obj.working, now: motion.phase(now), fw: obj.fw, fh: obj.fh,
    night: frameLight.night || 0,
  }),
  structure: (ctx, x, y, size, obj, now) => sprites.drawStructure(ctx, obj.type, x, y, size, {
    derelict: !!obj.derelict, now: motion.phase(now), fw: obj.fw, fh: obj.fh, night: frameLight.night || 0,
  }),
  forage: (ctx, x, y, size, obj) => {
    const fn = sprites.FORAGE_DRAW[obj.type];
    if (fn) fn(ctx, x, y, size);
    else sprites.drawPlaceholder(ctx, x, y, size, obj.type);
  },
  decoration: (ctx, x, y, size, obj, now) => sprites.drawDecoration(ctx, x, y, size, obj.type, {
    now: motion.phase(now), fw: obj.fw, fh: obj.fh, joins: obj.joins, night: frameLight.night || 0,
  }),
  pet: (ctx, x, y, size, obj) => {
    const fn = obj.type === 'cat' ? sprites.drawCat : sprites.drawDog;
    fn(ctx, x, y, size, obj.idleFrame ?? 0);
  },
  scenery: (ctx, x, y, size, obj) => sprites.drawScenery(ctx, x, y, size, obj),
  signpost: (ctx, x, y, size, obj) => sprites.drawSignpost(ctx, x, y, size, {
    level: obj.level, locked: !!obj.locked, cost: obj.cost,
  }),
};

/**
 * Kinds this dispatch table can actually draw. Exported so tests/tools can prove every kind
 * main.js's buildWorld() emits has a real entry here — an unlisted kind silently falls through
 * to drawPlaceholder's magenta debug circle, which is exactly how every starting field rendered
 * before the 'field' entry above existed.
 */
export const DISPATCH_KINDS = Object.freeze(Object.keys(KIND_DISPATCH));

/** Tile test built from a list of owned rects — cheaper than asking farm.js per tile per frame. */
function makeTileTest(rects) {
  return (tx, ty) => {
    for (const r of rects) {
      if (tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h) return true;
    }
    return false;
  };
}

/**
 * The placement ghost: the footprint tinted by legality, plus a translucent preview of the thing
 * being placed.
 *
 * Green/red alone would fail anyone who cannot separate those two hues, so legality is ALSO
 * carried by the outline (solid versus dashed) and by a cross drawn over a blocked footprint.
 *
 * The tinted diamonds use the TOP-VERTEX convention like drawGrassTile/drawSoilPlot and the pick
 * math; they used to be centred on the anchor instead, which put the legality tint half a tile
 * north of the tiles placement.confirm() was actually about to occupy.
 */
function drawPlacementGhost(ctx, ghost, now, w, h) {
  const { tx, ty, w: gw, h: gh, legal } = ghost;
  const pulse = 0.5 + 0.5 * Math.sin((motion.phase(now) ?? 0) / 260);
  const T = TILE_BASE * camera.zoom;

  ctx.save();
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const [sx, sy] = tileToScreen(tx + i, ty + j, w, h);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + T, sy + T / 2);
      ctx.lineTo(sx, sy + T);
      ctx.lineTo(sx - T, sy + T / 2);
      ctx.closePath();
      ctx.fillStyle = legal
        ? `rgba(120,220,90,${0.28 + 0.16 * pulse})`
        : `rgba(226,72,58,${0.30 + 0.16 * pulse})`;
      ctx.fill();
      ctx.strokeStyle = legal ? 'rgba(40,120,30,0.9)' : 'rgba(150,30,20,0.95)';
      ctx.lineWidth = Math.max(1.5, T * 0.02);
      ctx.setLineDash(legal ? [] : [6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // A translucent preview of the actual object, through the real sprite functions at the SAME
  // anchor and the SAME scale the placed object will use (objectAnchor), so what you see is what
  // you get.
  const preview = { id: 'ghost', kind: ghost.kind, type: ghost.type, tx, ty, fw: gw, fh: gh, working: false };
  const [cx, cy, size] = objectAnchor(preview, w, h);
  ctx.globalAlpha = 0.62;
  if (ghost.kind === 'pen') {
    sprites.drawPen(ctx, cx, cy, size, ghost.type, { fw: gw, fh: gh, part: 'all' });
  } else {
    const dispatch = KIND_DISPATCH[ghost.kind];
    if (dispatch) dispatch(ctx, cx, cy, size, preview, now);
    else sprites.drawPlaceholder(ctx, cx, cy, size, ghost.type);
  }
  ctx.globalAlpha = 1;

  if (!legal) {
    const [mx, my] = tileToScreen(tx + gw / 2, ty + gh / 2, w, h);   // footprint centre
    ctx.strokeStyle = 'rgba(150,30,20,0.95)';
    ctx.lineWidth = Math.max(2, T * 0.04);
    const r = T * 0.34;
    ctx.beginPath();
    ctx.moveTo(mx - r, my - r); ctx.lineTo(mx + r, my + r);
    ctx.moveTo(mx + r, my - r); ctx.lineTo(mx - r, my + r);
    ctx.stroke();
  }
  ctx.restore();
}

/** The footprint of whatever an item drag hovers, green when it takes the drop, red when not. */
function drawDropTarget(ctx, target, now, w, h) {
  const { tx, ty, fw = 1, fh = 1, ok } = target;
  const pulse = 0.5 + 0.5 * Math.sin((motion.phase(now) ?? 0) / 220);
  const T = TILE_BASE * camera.zoom;
  const [cx, cy] = objectAnchor({ tx, ty, fw, fh }, w, h);
  ctx.save();
  sprites.footprintPath(ctx, cx, cy, fw, fh, T);
  ctx.fillStyle = ok ? `rgba(120,220,90,${0.22 + 0.14 * pulse})` : `rgba(226,72,58,${0.18 + 0.12 * pulse})`;
  ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(40,120,30,0.9)' : 'rgba(150,30,20,0.9)';
  ctx.lineWidth = Math.max(1.5, T * 0.025);
  ctx.setLineDash(ok ? [] : [6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Draw one frame: ground → sorted objects (via sprites.js) → progress rings → ghost → effects →
 * the two lighting gradients (SPRITE-NOTES §3/§4).
 *
 * `world` = { objects, showGrid, ghost, unlockedRects, isUnlocked } from main.js's buildWorld().
 * `objects` items are { id, kind, type, tx, ty, fw?, fh?, scale?, depth?, growProgress?,
 * idleFrame?, derelict?, working?, progress?, ready? }. Everything is optional so this is
 * callable (and useful for smoke-testing) with a bare { objects }.
 */
export function drawFrame(now, world = {}) {
  if (!ctxRef) return;
  const ctx = ctxRef;
  const { objects = [], showGrid = false } = world;
  const unlockedRects = world.unlockedRects || [FARM.startZone];
  const isUnlocked = typeof world.isUnlocked === 'function' ? world.isUnlocked : makeTileTest(unlockedRects);
  const w = viewportW, h = viewportH;
  const view = viewGeometry(w, h);
  effects.setZoom(camera.zoom);
  frameLight = world.light || {};

  // ground: world-anchored texture, never a grid, except explicit placement/edit mode
  ground.drawGround(ctx, view, unlockedRects);
  ground.drawGroundDetail(ctx, view, isUnlocked, camera.zoom, HUD_INSET_PX * 0.5);
  if (showGrid) ground.drawGrid(ctx, view, isUnlocked);

  // sorted objects, back-to-front, culled to the viewport
  const ordered = sortedObjects(objects);
  const rings = [];
  const pips = [];
  for (const obj of ordered) {
    const [x, y, size] = objectAnchor(obj, w, h);
    const reach = TILE_BASE * size * 1.6;   // tall sprites extend well above their anchor
    if (x < -reach || x > w + reach || y < -reach || y > h + reach) continue;
    const dispatch = KIND_DISPATCH[obj.kind];
    ctx.save();
    if (dispatch) dispatch(ctx, x, y, size * effects.bounceScale(obj.id, now), obj, now);
    else sprites.drawPlaceholder(ctx, x, y, size, obj.type || obj.kind);
    ctx.restore();

    if (typeof obj.progress === 'number' && obj.progress < 1) rings.push(x, y, size, obj.progress);
    else if (obj.ready) rings.push(x, y, size, 1);
    if (obj.kind === 'building' && obj.slots > 0) pips.push(obj, x, y, size);
  }
  // Rings in their own pass, so a building drawn later can never paint over an earlier one's ring.
  for (let i = 0; i < rings.length; i += 4) {
    const size = rings[i + 2];
    sprites.drawProgressRing(ctx, rings[i], rings[i + 1] - TILE_BASE * size * 0.55, TILE_BASE * Math.min(size, 1.4) * 0.14, rings[i + 3]);
  }

  // Queue slot pips above every factory, after the objects so a taller neighbour cannot cover them.
  for (let i = 0; i < pips.length; i += 4) {
    const obj = pips[i], size = pips[i + 3];
    sprites.drawQueuePips(ctx, pips[i + 1], pips[i + 2] - TILE_BASE * size * 0.72, TILE_BASE * camera.zoom, obj.slots, obj.queue || []);
  }

  // Cloud shadows drift over the farm in world space (frozen under reduced motion), over the
  // objects they pass but under the effects, the ghost and the light.
  for (const c of cloudShadows(now, w, h)) sprites.drawCloudShadow(ctx, c.x, c.y, c.r);

  // The drop target of a live item drag (a recipe over its factory, feed over a pen, a seed over
  // a field): the footprint tinted the way the placement ghost tints legality.
  if (world.dropTarget) drawDropTarget(ctx, world.dropTarget, now, w, h);

  // Placement ghost, on top of the world so it is never hidden behind what it might replace,
  // but under the golden-hour wash so it still sits in the same light as everything else.
  if (world.ghost) drawPlacementGhost(ctx, world.ghost, now, w, h);

  // world-space particle effects (coin bursts, XP floaters, sparkles)
  effects.tickAndDraw(ctx, now ?? Date.now());

  // golden hour (or whatever the day/night cycle says the light is): two full-canvas gradients,
  // after entities, before UI/DOM overlays
  sprites.drawGoldenHour(ctx, w, h, frameLight);
}

// Three clouds, each drifting along its own row of the world on the frame clock (a tile a
// dozen seconds or so: a lazy afternoon). Positions are in tile space so the shadows pan with
// the farm; the drift wraps over CLOUD_SPAN tiles starting west of the world, so the wrap always
// happens off-screen. The lanes cross the start zone and the expansions, so a cloud is over the
// farm a good part of the time.
const CLOUDS = [
  { tx0: 2, ty: 13, r: 2.6, vx: 0.09 },
  { tx0: 20, ty: 17, r: 3.4, vx: 0.07 },
  { tx0: 34, ty: 22, r: 2.1, vx: 0.11 },
];
const CLOUD_SPAN = 44;
const CLOUD_WEST = -6;

/**
 * The cloud shadows visible this frame, as screen-space { x, y, r }. Pure in (now, camera): the
 * drift comes from motion.phase(now), so reduced motion holds every cloud still.
 */
export function cloudShadows(now, w = viewportW, h = viewportH) {
  const t = motion.phase(now) / 1000;
  const wrap = (v) => ((v % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN + CLOUD_WEST;
  const out = [];
  for (const c of CLOUDS) {
    const [x, y] = tileToScreen(wrap(c.tx0 + t * c.vx), c.ty, w, h);
    const r = TILE_BASE * camera.zoom * c.r;
    if (x < -r * 2 || x > w + r * 2 || y < -r || y > h + r) continue;
    out.push({ x, y, r });
  }
  return out;
}

/**
 * Smoothly ease camera pan/zoom toward targets, then clamp; called each frame with the real
 * frame delta in seconds (main.js measures it), so the glide takes the same time at any frame
 * rate.
 *
 * Clamps against liveBounds() — the caller-registered bounds provider — rather than always taking
 * clampCamera()'s bare start-zone-only default.
 */
export function tickCamera(dt) {
  // motion.ease() returns 1 under prefers-reduced-motion, which turns the glide into a snap. The
  // player still arrives exactly where they asked to; they just do not travel there.
  const t = motion.ease(Math.min(1, (dt ?? 1 / 60) * EASE));
  cameraTarget.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cameraTarget.zoom));
  clampCameraTarget(viewportW, viewportH, liveBounds());
  camera.x += (cameraTarget.x - camera.x) * t;
  camera.y += (cameraTarget.y - camera.y) * t;
  camera.zoom += (cameraTarget.zoom - camera.zoom) * t;
  clampCamera(viewportW, viewportH, liveBounds());
  return camera;
}
