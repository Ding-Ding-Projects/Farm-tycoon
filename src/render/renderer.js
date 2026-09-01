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
// tickCamera() clamps EVERY FRAME, before drawFrame — so whatever bounds it clamps against are
// the real, permanent ceiling on what the player can ever pan to, no matter how generous a
// one-off boot()/focusTile() call was. It gets those bounds from a caller-registered provider
// (see setBoundsProvider() below), not by importing state.js/farm.js itself — this module stays
// free of game-logic imports and only knows FARM's static tile-space geometry via data.js.
//
// worldBounds()/clampCamera()/focusTile()/sortedObjects()/tileToScreen()/screenToTile() below
// are REAL implementations (not Phase B stubs) — this module is a live defect fix, not a
// content-stub contract. init() and drawFrame() stay stubs: they need a live canvas and the
// sprite draw functions from sprites.js, neither of which exist yet.

import { FARM } from '../data.js';
import * as sprites from './sprites.js';
import * as effects from './effects.js';

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
 * THIS IS THE FIX for the ceiling documented in the module header above and in tickCamera()'s
 * own comment: tickCamera() runs every frame before drawFrame — before any pixel is ever
 * painted — so whatever richer bounds boot() computed for its one-off focusTile() call used to
 * get silently discarded on frame 1 and every frame after, because clampCamera(viewportW,
 * viewportH) with no third argument always re-derives the bare default. Registering a provider
 * here means every clamp call in this module (not just boot's one-shot focusTile) shares boot's
 * real domain.
 *
 * A PROVIDER FUNCTION, not a one-shot bounds object, and registered rather than imported,
 * because of two constraints together: (1) this module deliberately has no game-logic imports —
 * it knows FARM's static tile-space geometry via data.js, but not which expansions a save has
 * actually unlocked, which lives in state.js/farm.js; importing state.js here to look that up
 * itself would break that boundary. (2) The unlocked set genuinely changes during play — an
 * expansion unlocking must widen the clamp's domain immediately, not just at the next boot — so
 * a snapshot bounds object captured once at boot would go stale the moment a player unlocks
 * anything. A provider closing over live state, called fresh every time it's needed, keeps the
 * domain current without either problem.
 *
 * Unset (the default, and the state every test in tools/test-camera.mjs runs under, since none
 * of them register one) falls back to clampCamera()'s own bare default — safe because that
 * default still fully enforces the void-protection contract, just over a smaller domain.
 */
let boundsProvider = null;

/**
 * Register the function tickCamera()/resizeToWindow() call to get the live camera bounds. Pass
 * a function, or null/undefined to clear it back to the bare default. See `boundsProvider`'s own
 * comment above for why this is a provider rather than a stored bounds object.
 */
export function setBoundsProvider(fn) {
  boundsProvider = typeof fn === 'function' ? fn : null;
}

/**
 * Current bounds from the registered provider, or undefined (letting clampCamera fall back to
 * its own bare default). Wrapped so a throwing provider degrades to that safe bare clamp instead
 * of breaking the render loop — the void-protection contract must hold even if a caller's
 * provider is broken.
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
 * THE NORTH/SOUTH SPLIT IS NOT SYMMETRIC, and treating it as if it were is a defect this
 * function used to have. tileToScreen puts the camera's OWN target tile at
 * `oy = viewportH * OY_RATIO` — near the TOP of the screen, since OY_RATIO = 0.2375 — so only
 * a sliver of the viewport sits north of the target and most of it sits south. Averaging the
 * two into one symmetric half-extent (as this function used to, via `half = (dx+dy)/2`)
 * overstates how close the camera can get to the north edge of `bounds` (so panning could
 * never bring anything planted north of the camera target — e.g. the starting fields, planted
 * at FARM.startZone.y + 3, north of the start zone's own centre — into view) and understates
 * how close it can get to the south/east edge (so panning that way could reveal empty void
 * beyond `bounds`). Both directions are derived exactly below from tileToScreen's own algebra,
 * not approximated.
 */
export function clampCamera(viewportW = 1280, viewportH = 800, bounds = worldBounds()) {
  const T = TILE_BASE * camera.zoom;
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
  if (worldW <= halfNorth + halfSouth) {
    camera.x = (bounds.minX + bounds.maxX) / 2 + (halfNorth - halfSouth) / 2;
  } else {
    camera.x = Math.min(Math.max(camera.x, bounds.minX + halfNorth), bounds.maxX - halfSouth);
  }

  if (worldH <= halfNorth + halfSouth) {
    camera.y = (bounds.minY + bounds.maxY) / 2 + (halfNorth - halfSouth) / 2;
  } else {
    camera.y = Math.min(Math.max(camera.y, bounds.minY + halfNorth), bounds.maxY - halfSouth);
  }

  return camera;
}

/**
 * Point the camera at a tile, then clamp. Used by input.js when teleporting to a structure,
 * and by main.js on boot to look at the start zone.
 *
 * "Point at" is deliberate, not "centre": camera.x/camera.y is the tile tileToScreen renders
 * at (viewportW/2, viewportH*OY_RATIO) — horizontally centred but, because OY_RATIO = 0.2375,
 * placed near the TOP of the screen rather than the middle (design/handoff/SPRITE-NOTES.md §8
 * — this keeps the target tile itself clear of the 76px HUD rail). So focusTile(tx, ty) does
 * NOT put (tx, ty) in the visual middle of the viewport; it puts it just below the HUD, with
 * most of the viewport opening up south of it. clampCamera() then pulls that point back inside
 * `bounds` if the raw target would show void or hide content behind the HUD.
 */
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

/**
 * Linear grow fraction 0..1 for a field object still carrying its raw cropId/plantedAt/readyAt
 * (rather than main.js's buildWorld(), which already resolves that into a precomputed
 * {kind:'crop', growProgress} object). Lives here, not in production.js, so the renderer never
 * needs a game-logic import to answer "how grown is this" — no crop.growTime lookup required.
 */
function fieldGrowProgress(obj, now) {
  const t = typeof now === 'number' ? now : Date.now();
  if (!obj.plantedAt || !obj.readyAt || obj.readyAt <= obj.plantedAt) return 1;
  return Math.max(0, Math.min(1, (t - obj.plantedAt) / (obj.readyAt - obj.plantedAt)));
}

// kind -> dispatch fn(ctx, x, y, size, obj, now). Keeps drawFrame() a plain loop instead of a
// growing if/else ladder; add a new kind here, not inline below.
const KIND_DISPATCH = {
  // Bare soil plot — buildWorld() pushes exactly this for an unplanted field (kind:'field',
  // no cropId). Defensive: if a caller ever hands a field object that still carries its raw
  // cropId/plantedAt/readyAt instead of buildWorld's {kind:'crop', growProgress} translation,
  // draw the crop growing on the soil rather than falling through to drawPlaceholder.
  field: (ctx, x, y, size, obj, now) => {
    sprites.drawSoilPlot(ctx, x, y, size);
    if (obj.cropId) {
      const fn = sprites.CROP_DRAW[obj.cropId];
      if (fn) fn(ctx, x, y, size, fieldGrowProgress(obj, now));
      else sprites.drawPlaceholder(ctx, x, y, size, obj.cropId);
    }
  },
  crop: (ctx, x, y, size, obj) => {
    const fn = sprites.CROP_DRAW[obj.type];
    if (fn) fn(ctx, x, y, size, obj.growProgress ?? 1);
    else sprites.drawPlaceholder(ctx, x, y, size, obj.type);
  },
  animal: (ctx, x, y, size, obj) => {
    const fn = sprites.ANIMAL_DRAW[obj.type];
    if (fn) fn(ctx, x, y, size, obj.idleFrame ?? 0);
    else sprites.drawPlaceholder(ctx, x, y, size, obj.type);
  },
  pen: (ctx, x, y, size, obj) => sprites.drawPen(ctx, x, y, size, obj.type),
  building: (ctx, x, y, size, obj) => sprites.drawBuilding(ctx, x, y, size, obj.type, { derelict: !!obj.derelict }),
  structure: (ctx, x, y, size, obj) => sprites.drawStructure(ctx, obj.type, x, y, size, { derelict: !!obj.derelict }),
  forage: (ctx, x, y, size, obj) => {
    const fn = sprites.FORAGE_DRAW[obj.type];
    if (fn) fn(ctx, x, y, size);
    else sprites.drawPlaceholder(ctx, x, y, size, obj.type);
  },
  decoration: (ctx, x, y, size, obj) => sprites.drawDecoration(ctx, x, y, size, obj.type),
  pet: (ctx, x, y, size, obj) => {
    const fn = obj.type === 'cat' ? sprites.drawCat : sprites.drawDog;
    fn(ctx, x, y, size, obj.idleFrame ?? 0);
  },
};

/**
 * Kinds this dispatch table can actually draw. Exported so tests/tools can prove every kind
 * main.js's buildWorld() emits (field/crop/pen/building/decoration/structure) has a real entry
 * here — an unlisted kind silently falls through to drawPlaceholder's magenta debug circle,
 * which is exactly how every starting field rendered before the 'field' entry above existed.
 */
export const DISPATCH_KINDS = Object.freeze(Object.keys(KIND_DISPATCH));

/**
 * Draw one frame: ground → sorted objects (via sprites.js) → progress rings → effects →
 * the two lighting gradients (SPRITE-NOTES §3/§4).
 *
 * `world` is optional so this is callable (and useful for smoke-testing) before farm.js/
 * state.js are wired up: { objects, showGrid, unlockedExpansionIds }. `objects` items are
 * { id, kind, type, tx, ty, growProgress?, idleFrame?, derelict?, progress? } — the same
 * shape farm.js documents objects in (kind/type/x/y), read here as tx/ty (tile coords).
 */
export function drawFrame(now, world = {}) {
  if (!ctxRef) return;
  const ctx = ctxRef;
  const { objects = [], showGrid = false } = world;
  const w = viewportW, h = viewportH;

  ctx.clearRect(0, 0, w, h);

  // ground: continuous meadow, never a grid, except explicit placement/edit mode
  sprites.drawMeadow(ctx, w, h);
  sprites.drawGroundDetail(ctx, w, h);

  if (showGrid) {
    for (const obj of objects) {
      const [x, y] = tileToScreen(obj.tx, obj.ty, w, h);
      sprites.drawGrassTile(ctx, x, y, camera.zoom);
    }
  }

  // sorted objects, back-to-front
  const ordered = sortedObjects(objects);
  for (const obj of ordered) {
    const [x, y] = tileToScreen(obj.tx, obj.ty, w, h);
    const size = camera.zoom * (obj.scale ?? 1);
    const dispatch = KIND_DISPATCH[obj.kind];
    if (dispatch) dispatch(ctx, x, y, size, obj, now);
    else sprites.drawPlaceholder(ctx, x, y, size, obj.type || obj.kind);

    if (typeof obj.progress === 'number' && obj.progress < 1) {
      sprites.drawProgressRing(ctx, x, y - TILE_BASE * size * 0.4, TILE_BASE * size * 0.14, obj.progress);
    }
  }

  // world-space particle effects (coin bursts, XP floaters, sparkles)
  effects.tickAndDraw(ctx, now ?? 0);

  // golden hour: two full-canvas gradients, after entities, before UI/DOM overlays
  sprites.drawGoldenHour(ctx, w, h);
}

/**
 * Smoothly ease camera pan/zoom toward targets, then clamp; called each frame.
 *
 * Clamps against liveBounds() — the caller-registered bounds provider (see setBoundsProvider()
 * above) — rather than always taking clampCamera()'s bare start-zone-only default. Without this,
 * whatever richer bounds boot() computed for its initial focusTile() call was discarded on the
 * very next frame: this function runs before drawFrame, every frame, so its own unconditional
 * bare clamp used to be the last word on where the camera could go, permanently.
 */
export function tickCamera(dt) {
  const t = Math.min(1, (dt ?? 1 / 60) * EASE);
  camera.x += (cameraTarget.x - camera.x) * t;
  camera.y += (cameraTarget.y - camera.y) * t;
  cameraTarget.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cameraTarget.zoom));
  camera.zoom += (cameraTarget.zoom - camera.zoom) * t;
  clampCamera(viewportW, viewportH, liveBounds());
  return camera;
}
