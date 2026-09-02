// sprites.js — pure vector art. Every entity is a draw function using canvas paths,
// gradients and rounded shapes — no image assets, anti-aliased, modern flat style with
// soft shadows. Contract: draw<Thing>(ctx, x, y, size, stageOrFrame) where (x,y) is the
// tile anchor in screen space and `size` the tile width scale factor (1 == full tile).
//
// GROUND RULE (Hay Day reference): the world ground renders as a CONTINUOUS soft meadow —
// base green with low-frequency tonal mottling, sparse tufts and tiny flowers. The logical
// placement grid is NEVER drawn during normal play; grid squares appear only in placement /
// edit mode. Fields/buildings are free-standing raised slabs with a lighter top edge and
// darker side thickness.
//
// Reference implementation read as executable pseudo-code while building this file:
// design/farm-world.js (same drawing model — iso helper, palette object, per-entity fns).

import { NIGHT_MAX_ALPHA, NIGHT_TINT } from './daylight.js';

export const PALETTE = {
  // ground — pushed up in saturation without going neon
  grass: '#8ecb36', grassLight: '#a8dc52', grassDark: '#6da828',
  grassMottleLight: 'rgba(206,238,124,0.45)', grassMottleDark: 'rgba(96,152,40,0.34)',
  flowerWhite: '#fff8ee', flowerYellow: '#ffd94d', flowerPink: '#f48ab0',
  soil: '#7a4f28', soilLight: '#95643a', soilDark: '#4d2f14', soilRow: 'rgba(40,24,8,0.52)',
  water: '#3fb0e0', waterLight: '#86d8f2',
  road: '#e6bd7c', roadEdge: '#a87c42', roadLight: 'rgba(255,231,178,0.72)',
  wood: '#c08a4e', woodDark: '#7a4a18', woodLight: '#dca868',
  roof: '#e05548', roofDark: '#b83a2c', roofTop: '#a03426', roofAlt: '#4a8fd4',
  wall: '#fbeccb', window: '#7fd4f0', trimLight: '#fffaea',
  silo: '#e8dcc0', siloLight: '#fffaea', siloDark: '#bfae8c',
  gold: '#f0b52e', cream: '#fffaf0', wheatGold: '#f2c94c',
  shadow: 'rgba(58,37,16,0.26)',

  outline: '#3a2510',
  outlineWidth: 3.5,
  sun: 'rgba(255,196,104,0.34)',
  vignette: 'rgba(72,44,14,0.38)',
  haze: 'rgba(176,206,238,0.13)',   // cool distance haze over the far (upper) third of the view

  // derelict fixed palette (SPRITE-NOTES §6) — distinct washed-out pair, not darkened PALETTE
  derelictRoof: '#8a7f68', derelictWall: '#c9b89a',

  fruitRed: '#e8574a',
  // scenery on unexpanded land
  trunk: '#6b4423', trunkDark: '#47301a', canopy: '#4f9c26', canopyDark: '#3a7a22', canopyLight: '#7bc542',
  pine: '#2f6b33', pineLight: '#4a8f45', birchBark: '#e9e4d6', birchLeaf: '#9ccc4a',
  rock: '#9a9a90', rockDark: '#6e6e66', rockLight: '#c2c2b8',
  // One light vector for the whole world: the sun sits upper-RIGHT (drawGoldenHour), so every
  // shadow leans down and to the LEFT (SPRITE-NOTES §3). groundShadow reads this; nothing else
  // should hard-code an offset.
  light: { dx: -0.10, dy: 0.05 },
};

/**
 * Gradients that degrade to a flat colour. tools/test-motion.mjs drives drawBuilding through a
 * Proxy context whose every method returns undefined, so a bare createLinearGradient(...).
 * addColorStop() would throw there; these return `fallback` whenever the context cannot make a
 * real gradient (fake ctx, or a runtime without them). Every sprite that shades a surface goes
 * through here rather than calling create*Gradient itself.
 */
export function linearGradient(ctx, x0, y0, x1, y1, stops, fallback) {
  let g = null;
  try { g = ctx.createLinearGradient(x0, y0, x1, y1); } catch { g = null; }
  if (!g || typeof g.addColorStop !== 'function') return fallback;
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}
export function radialGradient(ctx, x0, y0, r0, x1, y1, r1, stops, fallback) {
  let g = null;
  try { g = ctx.createRadialGradient(x0, y0, Math.max(0, r0), x1, y1, Math.max(0.01, r1)); } catch { g = null; }
  if (!g || typeof g.addColorStop !== 'function') return fallback;
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

// ---------------------------------------------------------------------------------------
// Lighting helpers. One light, from the upper right (PALETTE.light): a face toward it is lit, a
// face away from it is shaded, and every gradient below is made ONCE per context in unit space
// and mapped onto its box through the transform - the canvas maps the fill style through the
// CTM but leaves the already-built path alone, which is what lets fifty buildings share three
// gradients instead of allocating three each, every frame.
// ---------------------------------------------------------------------------------------

/** '#rrggbb', '#rgb' or 'rgb(r,g,b)' -> [r, g, b], or null. */
function parseColor(color) {
  if (typeof color !== 'string') return null;
  if (color[0] === '#') return parseHex(color);
  const m = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const tintCache = new Map();
function tint(color, k) {
  const key = `${color}|${k}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const p = parseColor(color);
  if (!p) return color;
  const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  const out = `rgb(${f(p[0])},${f(p[1])},${f(p[2])})`;
  tintCache.set(key, out);
  return out;
}
/** A colour in shadow (darkened by k) / in sun (lightened by k). Cached; safe on rgb() strings. */
export function shade(color, k = 0.18) { return tint(color, -Math.abs(k)); }
export function lighten(color, k = 0.18) { return tint(color, Math.abs(k)); }

const unitGradients = new WeakMap();   // ctx -> Map(key -> gradient | null)
/** A gradient in unit space, cached per context and key: 'v' runs top to bottom, 'h' left to
 *  right, 'd' from the lower-left corner to the upper-right (the light's direction), 'r' radial
 *  from the centre. Null where the context cannot make gradients (the tests' Proxy context). */
function unitGradient(ctx, key, dir, stops) {
  let m = unitGradients.get(ctx);
  if (!m) { m = new Map(); unitGradients.set(ctx, m); }
  if (m.has(key)) return m.get(key);
  let g = null;
  if (dir === 'h') g = linearGradient(ctx, 0, 0, 1, 0, stops, null);
  else if (dir === 'd') g = linearGradient(ctx, 0, 1, 1, 0, stops, null);
  else if (dir === 'r') g = radialGradient(ctx, 0.5, 0.5, 0, 0.5, 0.5, 0.5, stops, null);
  else g = linearGradient(ctx, 0, 0, 0, 1, stops, null);
  m.set(key, g);
  return g;
}

/**
 * Fill the CURRENT path with the cached unit gradient `key` stretched over the box (x, y, w, h),
 * or flat `fallback` where gradients are unavailable. The path must already be built; nothing
 * here starts a new one.
 */
export function fillUnit(ctx, key, dir, stops, x, y, w, h, fallback) {
  const g = unitGradient(ctx, key, dir, stops);
  if (!g) { ctx.fillStyle = fallback; ctx.fill(); return; }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(1e-3, w), Math.max(1e-3, h));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------------------

/** Outline width scaled to the current tile size. T is the current tile px width. */
export function outlineWidth(T = 104) {
  return PALETTE.outlineWidth * (T / 104);
}

/**
 * Stroke the CURRENT ctx path as the sprite silhouette. Call after fill(); path must still
 * be the active path (do not beginPath() between fill and this call).
 */
export function outline(ctx, T = 104, scale = 1) {
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = outlineWidth(T) * scale;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/**
 * Warm rim-light on the sun-facing (upper-right) edge of a big structure. With `box`
 * [x, y, w, h] (the sprite's bounding box) the stroke fades out toward the lower-left, so it reads
 * as a lit edge rather than a halo round the whole silhouette; the gradient is a cached unit one
 * under a UNIFORM scale, so the pen stays round. Strokes the current path.
 */
function rimLight(ctx, T = 104, box = null) {
  ctx.save();
  ctx.lineJoin = 'round';
  const s = box ? Math.max(box[2], box[3], 1) : 0;
  const g = box ? unitGradient(ctx, `rim:${(box[2] / s).toFixed(2)}x${(box[3] / s).toFixed(2)}`, 'd',
    [[0, 'rgba(255,225,150,0)'], [0.45, 'rgba(255,225,150,0)'], [1, 'rgba(255,225,150,0.6)']]) : null;
  if (g && box) {
    ctx.translate(box[0], box[1]);
    ctx.scale(s, s);
    ctx.strokeStyle = g;
    ctx.lineWidth = (outlineWidth(T) * 0.6) / s;
  } else {
    ctx.strokeStyle = 'rgba(255,225,150,0.4)';
    ctx.lineWidth = outlineWidth(T) * 0.6;
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The plot a building or structure stands on: a packed-earth slab on its REAL footprint, with
 * the dark side thickness of a raised slab and a scatter of stones, so the thing sits on
 * something rather than hovering over the lawn. `tile` is one tile in px at this zoom.
 */
export function drawSlab(ctx, x, y, fw, fh, tile, derelict = false) {
  const c = footprintCorners(x, y, fw, fh, tile);
  const D = tile * 0.08;
  groundShadow(ctx, c.centre[0], c.centre[1] + D, tile * fw * 0.98, tile * fh * 0.46, tile, 0.15);
  footprintPath(ctx, x, y, fw, fh, tile, D);
  ctx.fillStyle = derelict ? '#6f6552' : '#6e4d2c';
  ctx.fill();
  footprintPath(ctx, x, y, fw, fh, tile);
  const bx = c.west[0], by = c.top[1], bw = c.east[0] - c.west[0], bh = c.south[1] - c.top[1];
  fillUnit(ctx, derelict ? 'slab:derelict' : 'slab', 'v',
    derelict ? [[0, '#b0a58a'], [1, '#8a7f68']] : [[0, '#cfae74'], [0.55, '#b8934f'], [1, '#9a7538']],
    bx, by, bw, bh, derelict ? '#a89878' : '#b8934f');
  outline(ctx, tile, 0.5);
  // Lit edge toward the sun (upper right), shaded edge away from it.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,236,196,0.5)';
  ctx.lineWidth = Math.max(1, tile * 0.02);
  ctx.beginPath(); ctx.moveTo(c.top[0], c.top[1] + tile * 0.02); ctx.lineTo(c.east[0] - tile * 0.04, c.east[1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(58,37,16,0.28)';
  ctx.beginPath(); ctx.moveTo(c.west[0] + tile * 0.04, c.west[1]); ctx.lineTo(c.south[0], c.south[1] - tile * 0.02); ctx.stroke();
  ctx.restore();
  // Stones, inside the plot by construction (no clip).
  const pt = (u, v) => [c.top[0] + (u - v) * tile, c.top[1] + (u + v) * (tile / 2)];
  for (let i = 0; i < 4 + fw * fh * 2; i++) {
    const u = 0.2 + prand(i, 91) * (fw - 0.4), v = 0.2 + prand(i, 92) * (fh - 0.4);
    const [px, py] = pt(u, v);
    ctx.fillStyle = i % 3 ? 'rgba(255,240,210,0.22)' : 'rgba(58,37,16,0.18)';
    ctx.beginPath(); ctx.ellipse(px, py, tile * (0.02 + prand(i, 93) * 0.03), tile * 0.012, prand(i, 94) * 3, 0, Math.PI * 2); ctx.fill();
  }
}

// One unit-radius shadow gradient per context, reused for every shadow in the frame: drawn under
// a translate/scale it becomes any ellipse, so no gradient is ever allocated per sprite per frame.
const shadowGradients = new WeakMap();
function shadowGradient(ctx) {
  let g = shadowGradients.get(ctx);
  if (g === undefined) {
    g = radialGradient(ctx, 0, 0, 0, 0, 0, 1,
      [[0, 'rgba(58,37,16,0.36)'], [0.55, 'rgba(58,37,16,0.26)'], [1, 'rgba(58,37,16,0)']], null);
    shadowGradients.set(ctx, g);
  }
  return g;
}

/**
 * Soft ground shadow ellipse, offset AWAY from the sun along PALETTE.light. `height` (in tile
 * units, optional) stretches the shadow further along the light vector for tall objects, so a
 * silo casts longer than a hay bale.
 */
export function groundShadow(ctx, x, y, rx, ry, T = 104, height = 0) {
  const stretch = 1 + height * 0.6;
  const cx = x + T * PALETTE.light.dx * stretch, cy = y + T * PALETTE.light.dy * stretch;
  const g = shadowGradient(ctx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(1, rx * (1 + height * 0.25)), Math.max(1, ry));
  ctx.fillStyle = g || PALETTE.shadow;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Deterministic pseudo-random in [0,1) — stable across frames for foliage/tuft scatter. */
export function prand(i, salt = 0) {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Stable integer hash of a tile coordinate, for per-tile scatter that never shimmers. */
export function tileHash(tx, ty) {
  let h = Math.imul(tx | 0, 73856093) ^ Math.imul(ty | 0, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The four screen corners of a footprint diamond, relative to the anchor the renderer hands every
 * sprite: (x, y) is the TOP vertex of the footprint's central virtual tile
 * (tx + (fw-1)/2, ty + (fh-1)/2), so a 1x1 footprint returns the familiar tile diamond
 * top (x,y) / east (x+T, y+T/2) / south (x, y+T) / west (x-T, y+T/2).
 *
 * Every multi-tile sprite that wants to sit ON its plot rather than float over its north-west
 * corner builds its ground plate from this, so the art and the hit area (farm.objectAt /
 * input.js structureAt, which both test the whole footprint) finally agree.
 */
export function footprintCorners(x, y, fw = 1, fh = 1, T = 104) {
  const du0 = -(fw - 1) / 2, dv0 = -(fh - 1) / 2;   // tile-space offset of the NW tile's vertex
  const pt = (du, dv) => [x + (du - dv) * T, y + (du + dv) * (T / 2)];
  return {
    top: pt(du0, dv0),
    east: pt(du0 + fw, dv0),
    south: pt(du0 + fw, dv0 + fh),
    west: pt(du0, dv0 + fh),
    centre: pt(du0 + fw / 2, dv0 + fh / 2),
  };
}

/** Trace the footprint diamond as the current path (no fill, no stroke). */
export function footprintPath(ctx, x, y, fw, fh, T, yOff = 0) {
  const c = footprintCorners(x, y, fw, fh, T);
  ctx.beginPath();
  ctx.moveTo(c.top[0], c.top[1] + yOff);
  ctx.lineTo(c.east[0], c.east[1] + yOff);
  ctx.lineTo(c.south[0], c.south[1] + yOff);
  ctx.lineTo(c.west[0], c.west[1] + yOff);
  ctx.closePath();
}

// Derelict desaturation used to be `ctx.filter = 'saturate(0.45)'` around each locked
// structure. Measured in Chromium: a canvas filter costs on the order of 5 ms PER DRAW CALL, and
// twenty derelict structures with a dozen fills each held every frame at 100-350 ms - the single
// largest cost in the renderer, at every zoom. The same look now comes from the palette: while
// a derelict sprite is being drawn, derelictColor() washes any colour it is handed toward warm
// grey, and the parts that already carry their own derelict colours are untouched.
let derelictTint = false;
function applyDerelictFilter(ctx, derelict) { derelictTint = !!derelict; }
function clearFilter() { derelictTint = false; }

/** A colour as a derelict structure wears it (washed toward grey); unchanged when not derelict. */
export function derelictColor(color) {
  if (!derelictTint) return color;
  const p = parseHex(color);
  if (!p) return color;
  const grey = p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
  const k = 0.55;
  return `rgb(${Math.round(p[0] + (grey - p[0]) * k)},${Math.round(p[1] + (grey - p[1]) * k)},${Math.round(p[2] + (grey - p[2]) * k)})`;
}

/** Loose planks + a weed tuft at the base of a derelict structure. */
function derelictDebris(ctx, x, y, T) {
  ctx.save();
  ctx.strokeStyle = PALETTE.woodDark;
  ctx.lineWidth = 4 * (T / 104);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - T * 0.5, y + T * 0.42);
  ctx.lineTo(x - T * 0.24, y + T * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + T * 0.18, y + T * 0.52);
  ctx.lineTo(x + T * 0.44, y + T * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#6a8a3c';
  ctx.lineWidth = 2.4 * (T / 104);
  for (const dx of [-0.3, 0.35]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * T, y + T * 0.5);
    ctx.quadraticCurveTo(x + dx * T + 4, y + T * 0.38, x + dx * T - 3, y + T * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------
// Golden hour lighting pass (SPRITE-NOTES §3). Called once per frame by renderer.js after
// all entities are drawn and before UI/DOM overlays.
// ---------------------------------------------------------------------------------------
function paintLighting(ctx, w, h, sunColor, vignetteColor, hazeColor = PALETTE.haze, nightAlpha = 0) {
  const sun = radialGradient(ctx, w * 0.72, -h * 0.18, 0, w * 0.72, -h * 0.18, h * 1.15,
    [[0, sunColor], [1, 'rgba(0,0,0,0)']], null);
  if (sun) { ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h); }
  // Distance haze: far tiles are higher on screen, so a cool wash over the top third of the view
  // reads as atmosphere between the player and the horizon.
  const haze = linearGradient(ctx, 0, 0, 0, h * 0.35, [[0, hazeColor], [1, 'rgba(0,0,0,0)']], null);
  if (haze) { ctx.fillStyle = haze; ctx.fillRect(0, 0, w, h * 0.35); }
  const vig = radialGradient(ctx, w / 2, h * 0.45, h * 0.34, w / 2, h * 0.5, h * 1.02,
    [[0, 'rgba(0,0,0,0)'], [1, vignetteColor]], null);
  if (vig) { ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h); }
  if (nightAlpha > 0) {
    ctx.fillStyle = `rgba(${NIGHT_TINT[0]},${NIGHT_TINT[1]},${NIGHT_TINT[2]},${nightAlpha})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// The two full-canvas gradients are the same picture every frame until the window or the light
// changes, so they are painted once into a layer and composited with a single drawImage after
// that. Keyed per context so a recreated context (resize) rebuilds its own.
const lightLayers = new WeakMap();

/**
 * Golden hour: the warm low sun from the upper right and the vignette that pulls the eye into the
 * farm. opts: { sun, vignette } override the palette colours (a day/night cycle passes its own).
 */
export function drawGoldenHour(ctx, w, h, opts = {}) {
  const sunColor = opts.sun || PALETTE.sun;
  const vignetteColor = opts.vignette || PALETTE.vignette;
  const hazeColor = opts.haze || PALETTE.haze;
  // The night overlay is bounded: the farm never drops below ~70% brightness.
  const nightAlpha = Math.round(Math.max(0, Math.min(1, opts.night || 0)) * NIGHT_MAX_ALPHA * 1000) / 1000;
  const key = `${w}x${h}|${sunColor}|${vignetteColor}|${hazeColor}|${nightAlpha}`;
  if (typeof document !== 'undefined' && typeof ctx.drawImage === 'function') {
    let layer = lightLayers.get(ctx);
    if (!layer || layer.key !== key) {
      try {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
        const lctx = c.getContext('2d');
        if (lctx && typeof lctx.createRadialGradient === 'function') {
          paintLighting(lctx, w, h, sunColor, vignetteColor, hazeColor, nightAlpha);
          layer = { key, canvas: c };
          lightLayers.set(ctx, layer);
        } else layer = null;
      } catch { layer = null; }
    }
    if (layer) { ctx.drawImage(layer.canvas, 0, 0, w, h); return; }
  }
  paintLighting(ctx, w, h, sunColor, vignetteColor, hazeColor, nightAlpha);
}

// ---------------------------------------------------------------------------------------
// Terrain (ground rule: continuous meadow — grid squares only in placement/edit mode)
// ---------------------------------------------------------------------------------------

/** Continuous meadow base fill + low-frequency mottling. Call once per frame, full canvas. */
export function drawMeadow(ctx, w, h) {
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h,
    [[0, PALETTE.grassLight], [0.55, PALETTE.grass], [1, PALETTE.grassDark]], PALETTE.grass);
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 18; i++) {
    const px = prand(i, 1) * w, py = prand(i, 2) * h;
    const rx = (0.09 + prand(i, 3) * 0.17) * w, ry = rx * (0.32 + prand(i, 4) * 0.2);
    const g = radialGradient(ctx, px, py, 0, px, py, rx,
      [[0, i % 2 ? PALETTE.grassMottleLight : PALETTE.grassMottleDark], [1, 'rgba(0,0,0,0)']], null);
    if (!g) break;
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, ry / rx);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// The per-frame meadow detail (tufts, flowers, pebbles) moved to render/ground.js, where it is
// scattered per WORLD tile rather than per screen pixel, so it pans and zooms with the farm.

/** Placement/edit-mode grid diamond outline for one tile. Never drawn during normal play. */
export function drawGrassTile(ctx, x, y, size = 1) {
  const T = 104 * size;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, T * 0.015);
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + T, y + T / 2);
  ctx.lineTo(x, y + T); ctx.lineTo(x - T, y + T / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Raised-slab soil plot for a field/crop tile: side thickness + top face + furrows. */
/**
 * Queue slot pips above a factory: one per queue slot, empty (pale), cooking (amber), ready
 * (green) or waiting to be played (blue). The visible target for a recipe dragged onto the
 * building. Sized from T so they scale with the zoom.
 */
export function drawQueuePips(ctx, x, y, T, slots, states = []) {
  const n = Math.max(0, Math.min(8, slots | 0));
  if (!n) return;
  const r = Math.max(3, T * 0.055);
  const gap = r * 2.6;
  const x0 = x - ((n - 1) * gap) / 2;
  ctx.save();
  ctx.lineWidth = Math.max(1, T * 0.012);
  for (let i = 0; i < n; i++) {
    const st = states[i];
    ctx.beginPath();
    ctx.arc(x0 + i * gap, y, r, 0, Math.PI * 2);
    ctx.fillStyle = st === 'ready' ? '#8ed653' : st === 'cooking' ? '#f0b52e' : st === 'play' ? '#6ec8ea' : 'rgba(255,250,234,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,37,16,0.85)';
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSoilPlot(ctx, x, y, size = 1) {
  const T = 104 * size, D = T * 0.105;   // slab side thickness, in tile units so it zooms
  const dia = (yOff, k = 1) => {
    ctx.beginPath();
    ctx.moveTo(x, y + yOff); ctx.lineTo(x + T * k, y + T / 2 + yOff);
    ctx.lineTo(x, y + T * k + yOff); ctx.lineTo(x - T * k, y + T / 2 + yOff);
    ctx.closePath();
  };
  groundShadow(ctx, x, y + T / 2 + D, T * 1.0, T * 0.36, T);
  dia(D); ctx.fillStyle = PALETTE.soilDark; ctx.fill();
  // Turned earth: dry and pale at the rim, dark and moist toward the middle.
  dia(0);
  fillUnit(ctx, 'soil', 'r', [[0, '#5e3b1c'], [0.55, PALETTE.soil], [1, PALETTE.soilLight]], x - T, y, 2 * T, T, PALETTE.soil);

  // Furrows run along the tile's OWN axis (following the top-right edge), soft and slightly
  // uneven, with a faint dry crest beside each groove. Hard, evenly spaced lines with a bright
  // ridge each read as plank divisions and turned a 3x2 block of plots into a boardwalk.
  ctx.save(); dia(0); ctx.clip();
  ctx.lineCap = 'round';
  for (let f = 0.16; f < 0.96; f += 0.17) {
    const sx = x - f * T, sy = y + (f * T) / 2;
    const ex = x + T - f * T, ey = y + T / 2 + (f * T) / 2;
    const inset = 0.12;
    const ax = sx + (ex - sx) * inset, ay = sy + (ey - sy) * inset;
    const bx = ex - (ex - sx) * inset, by = ey - (ey - sy) * inset;
    const wob = (prand(Math.round(f * 100), 5) - 0.5) * T * 0.02;
    ctx.strokeStyle = 'rgba(40,24,8,0.34)';
    ctx.lineWidth = Math.max(1.4, T * 0.024);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + wob, bx, by); ctx.stroke();
    ctx.strokeStyle = 'rgba(214,170,110,0.16)';
    ctx.lineWidth = Math.max(1, T * 0.016);
    ctx.beginPath(); ctx.moveTo(ax, ay - T * 0.024); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - T * 0.024 + wob, bx, by - T * 0.024); ctx.stroke();
  }
  // Clods and grit: lumpy, varied, and stable between frames.
  for (let i = 0; i < 14; i++) {
    const u = prand(i, 3), v = prand(i, 7);
    const cxp = x + (u - 0.5) * T * 1.3;
    const cyp = y + T * 0.5 + (v - 0.5) * T * 0.66;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(40,24,8,0.32)' : i % 3 === 1 ? 'rgba(178,128,74,0.30)' : 'rgba(120,80,40,0.28)';
    ctx.beginPath();
    ctx.ellipse(cxp, cyp, T * (0.012 + u * 0.018), T * (0.007 + v * 0.009), u * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  dia(0);
  outline(ctx, T, 0.6);
  // The slab's lit rim toward the sun, and its shaded rim away from it.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,230,190,0.32)';
  ctx.lineWidth = Math.max(1, T * 0.018);
  ctx.beginPath(); ctx.moveTo(x + T * 0.04, y + T * 0.02); ctx.lineTo(x + T * 0.96, y + T / 2 - T * 0.01); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,24,8,0.3)';
  ctx.beginPath(); ctx.moveTo(x - T * 0.96, y + T / 2 + T * 0.02); ctx.lineTo(x - T * 0.04, y + T - T * 0.02); ctx.stroke();
  ctx.restore();
}

/** Locked expansion tile: greyed, hatched, no outline (it is terrain, not an object). */
export function drawLockedTile(ctx, x, y, size = 1) {
  const T = 104 * size;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + T, y + T / 2);
  ctx.lineTo(x, y + T); ctx.lineTo(x - T, y + T / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(90,90,90,0.38)';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(50,50,50,0.3)';
  ctx.lineWidth = Math.max(1, T * 0.02);
  for (let i = -2; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - T + i * T * 0.4, y);
    ctx.lineTo(x + i * T * 0.4, y + T);
    ctx.stroke();
  }
  ctx.restore();
}

/** Dirt road band along the iso axis, from (ax,ay) to (bx,by) in screen space. */
export function drawPath(ctx, ax, ay, bx, by, T = 104) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = PALETTE.roadEdge; ctx.lineWidth = T * 1.16;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = PALETTE.road; ctx.lineWidth = T * 0.94;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = PALETTE.roadLight; ctx.lineWidth = T * 0.26;
  ctx.beginPath(); ctx.moveTo(ax, ay - 6); ctx.lineTo(bx, by - 6); ctx.stroke();
  ctx.fillStyle = 'rgba(58,37,16,0.26)';
  for (let i = 0; i < 26; i++) {
    const t = prand(i, 9);
    const sx = ax + (bx - ax) * t, sy = ay + (by - ay) * t + (prand(i, 10) - 0.5) * T * 0.7;
    ctx.beginPath(); ctx.ellipse(sx, sy, 4 + prand(i, 11) * 3, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/**
 * The surface of a pond or lake: a sky reflection toward the far bank, ripples that drift with
 * `t` (seconds; frozen under reduced motion by the caller), a specular streak along the light,
 * and reeds and lily pads at the bank. One clip for the whole surface.
 */
export function drawWaterSurface(ctx, x, y, rx, ry, T = 104, t = 0) {
  const k = T / 104;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y - 4 * k, rx, ry, -0.08, 0, Math.PI * 2); ctx.clip();
  // Sky reflection: paler toward the far (upper) bank, deeper near the front.
  ctx.beginPath(); ctx.ellipse(x - rx * 0.12, y - ry * 0.42, rx * 0.62, ry * 0.36, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220,244,255,0.22)'; ctx.fill();
  // Ripples, drifting slowly across the surface.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1.2, ry * 0.06); ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const drift = Math.sin(t * 0.55 + i * 1.7) * rx * 0.06;
    const yy = y - ry * 0.55 + i * ry * 0.26 + Math.sin(t * 0.8 + i) * ry * 0.03;
    const ww = rx * (0.28 + (i % 2) * 0.2);
    const sx = x + drift - ww - i * rx * 0.08;
    ctx.beginPath(); ctx.moveTo(sx, yy);
    ctx.quadraticCurveTo(sx + ww / 2, yy - ry * 0.08, sx + ww, yy); ctx.stroke();
  }
  // Specular streak along the light vector (upper right -> lower left).
  const glint = 0.3 + 0.1 * Math.sin(t * 1.3);
  ctx.fillStyle = `rgba(255,255,240,${glint.toFixed(3)})`;
  ctx.beginPath(); ctx.ellipse(x + rx * 0.28, y - ry * 0.3, rx * 0.2, ry * 0.05, -0.55, 0, Math.PI * 2); ctx.fill();
  // Lily pads near the front bank.
  ctx.fillStyle = '#5fae2e';
  for (let i = 0; i < 3; i++) {
    const px = x + (prand(i, 61) - 0.5) * rx * 1.2, py = y + ry * (0.25 + prand(i, 62) * 0.4);
    const r = rx * 0.06;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, r, 0.3, Math.PI * 2 - 0.3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Reeds at the bank.
  ctx.save();
  ctx.strokeStyle = '#4f9c26'; ctx.lineWidth = Math.max(1.5, ry * 0.07); ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = -0.5 + i * 0.42;
    const bx = x + Math.cos(a) * rx * 1.02, by = y - 4 * k + Math.sin(a) * ry * 1.02;
    const sway = Math.sin(t * 1.1 + i) * 2 * k;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 3 * k + sway, by - 16 * k, bx - 2 * k + sway, by - 30 * k); ctx.stroke();
  }
  ctx.restore();
}

/** Soft, non-outlined water edge — kept for callers that only want the still surface. */
export function drawWaterEdge(ctx, x, y, rx, ry) {
  drawWaterSurface(ctx, x, y, rx, ry, ry * 1.7, 0);
}

// ---------------------------------------------------------------------------------------
// §7 — crop growth stages, one shared stem/head routine driven by growProgress (0..1).
// Crop identity is carried entirely by head shape + colour, configured per crop id below.
// ---------------------------------------------------------------------------------------

const CROP_CONFIG = {
  wheat:       { shape: 'blade',   head: PALETTE.wheatGold, leaf: '#82ce3c' },
  corn:        { shape: 'ear',     head: '#f7d43e',         leaf: '#4f9c26' },
  carrot:      { shape: 'root',    head: '#f0862e',         leaf: '#4f9c26' },
  soybean:     { shape: 'cluster', head: '#c9df6a',          leaf: '#5fae2e' },
  sugarcane:   { shape: 'tall',    head: '#d8c85a',          leaf: '#6dab2c' },
  cotton:      { shape: 'puff',    head: '#fdfdf8',          leaf: '#4f9c26' },
  tomato:      { shape: 'round',   head: '#e8574a',          leaf: '#5fae2e' },
  potato:      { shape: 'root',    head: '#c99a52',          leaf: '#4f9c26' },
  strawberry:  { shape: 'berry',   head: '#e0334a',          leaf: '#5fae2e' },
  pumpkin:     { shape: 'orb',     head: '#f0862e',          leaf: '#6dab2c' },
  indigo:      { shape: 'blade',   head: '#4a5fd0',          leaf: '#3f7a2e' },
  chili:       { shape: 'pod',     head: '#e0503f',          leaf: '#4f9c26' },
  coffee:      { shape: 'berry',   head: '#6a3a20',          leaf: '#3f7a2e' },
  grapes:      { shape: 'cluster', head: '#7a4fae',          leaf: '#4f9c26' },
  rice:        { shape: 'blade',   head: '#f5efc8',          leaf: '#5fae2e' },
  olive:       { shape: 'berry',   head: '#7a8f3a',          leaf: '#8faa4a' },
  lavender:    { shape: 'spike',   head: '#9a6fd0',          leaf: '#6dab2c' },
  tea_leaf:    { shape: 'puff',    head: '#7fae4a',          leaf: '#4f9c26' },
  bell_pepper: { shape: 'pod',     head: '#e05548',          leaf: '#4f9c26' },
  peony:       { shape: 'star',    head: '#f48ab0',          leaf: '#5fae2e' },
  watermelon:  { shape: 'orb',     head: '#4f9c26',          leaf: '#5fae2e' },
  mint:        { shape: 'puff',    head: '#7fd49a',          leaf: '#4f9c26' },
  // Tree crops (L40/L44): saplings that grow into small trees rather than stems with heads. They
  // had no sprite at all before, so a planted pine rendered as the magenta placeholder.
  pine:        { shape: 'conifer', head: '#2f6b33',          leaf: '#4a8f45' },
  rubber_tree: { shape: 'tree',    head: '#4f9c26',          leaf: '#3f7a2e' },
};

/** Shared stem/head routine for every crop. growProgress: 0 planted → 1 ready. */
/**
 * One routine for every crop (CROP_CONFIG gives the head/leaf colours and head shape). Plants
 * stand in rows along the soil plot's furrows (constant v, the same five offsets drawSoilPlot
 * uses), each stem with its own height, lean and hue from a stable per-stem hash; heads are
 * two-tone with a sun-side highlight and a contact shadow at the base. Growth is continuous:
 * seeds, then sprouts filling in row by row, then stems that rise toward full height at g = 1.
 */
export function drawCropStage(ctx, x, y, size, growProgress, config) {
  const T = 104 * size;
  const g = Math.max(0, Math.min(1, growProgress || 0));
  const { head = PALETTE.wheatGold, leaf = '#5fae2e', shape = 'round' } = config || {};
  const pt = (u, v) => [x + (u - v) * T, y + (u + v) * (T / 2)];
  const rows = [0.16, 0.33, 0.5, 0.67, 0.84];
  // Fewer stems when the plot is small on screen: nothing under a few pixels is worth drawing.
  const cols = size < 0.75 ? 3 : 4;
  const stems = [];
  rows.forEach((v, r) => {
    for (let c = 0; c < cols; c++) {
      const h = prand(r * 7 + c * 13 + 1, 3), h2 = prand(r * 7 + c * 13 + 2, 3), h3 = prand(r * 7 + c * 13 + 3, 3);
      const u = 0.12 + ((c + 0.5) / cols) * 0.76 + (h - 0.5) * 0.06;
      const [px, py] = pt(u, v + (h2 - 0.5) * 0.04);
      stems.push({ px, py, i: r * cols + c, hv: h, lean: (h2 - 0.5) * 0.09, hue: (h3 - 0.5) * 0.3 });
    }
  });

  if (g <= 0) {
    // Planted: a seed at every stem position, sitting in its furrow.
    ctx.fillStyle = PALETTE.soilDark;
    for (const st of stems) { ctx.beginPath(); ctx.arc(st.px, st.py, T * 0.022, 0, Math.PI * 2); ctx.fill(); }
    return;
  }

  if (g < 0.5) {
    // Sprouts fill in row by row: two leaves and a nub of stem each.
    const n = Math.max(2, Math.round(stems.length * (0.3 + g * 1.4)));
    for (const st of stems.slice(0, n)) {
      const k = (0.6 + st.hv * 0.4) * (0.6 + g * 0.8);
      ctx.fillStyle = leaf;
      ctx.beginPath(); ctx.ellipse(st.px - T * 0.036 * k, st.py - T * 0.02 * k, T * 0.05 * k, T * 0.03 * k, -0.55, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(st.px + T * 0.036 * k, st.py - T * 0.02 * k, T * 0.05 * k, T * 0.03 * k, 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = leaf; ctx.lineWidth = Math.max(1, T * 0.02 * k);
      ctx.beginPath(); ctx.moveTo(st.px, st.py + T * 0.04 * k); ctx.lineTo(st.px, st.py - T * 0.05 * k); ctx.stroke();
    }
    return;
  }

  if (shape === 'conifer' || shape === 'tree') {
    // Three young trees on the plot, growing to a little over half a tile tall when ready.
    const s = size * (g >= 1 ? 0.5 : 0.36);
    for (const [u, v, k] of [[0.5, 0.35, 0.3], [0.22, 0.62, 0.7], [0.74, 0.66, 0.5]]) {
      const [px, py] = pt(u, v);
      drawTree(ctx, px, py - 104 * s * 0.5, s, { kind: shape === 'conifer' ? 'pine' : (g >= 1 ? 'fruit' : 'oak'), variant: k });
    }
    return;
  }

  // Growing (0.5..1) and ready: stems rise toward full height, heads ripen from leaf-green.
  const rise = 0.55 + 0.45 * ((g - 0.5) / 0.5);
  const ripe = g >= 1;
  const headColor = ripe ? head : mix(head, leaf, 0.45 * (1 - (g - 0.5) / 0.5) + 0.1);
  const detail = size >= 0.8;   // highlights and contact shadows only when they can be seen
  for (const st of stems) {
    const hs = rise * (0.85 + st.hv * 0.3);
    const stemLen = T * 0.16 * hs;
    const lean = st.lean * T;
    const topX = st.px + lean, topY = st.py - stemLen;
    if (detail) {
      ctx.fillStyle = 'rgba(58,37,16,0.16)';
      ctx.beginPath(); ctx.ellipse(st.px - T * 0.01, st.py + T * 0.018, T * 0.05, T * 0.018, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = leaf; ctx.lineWidth = Math.max(1, T * 0.028);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(st.px, st.py + T * 0.02);
    ctx.quadraticCurveTo(st.px + lean * 0.3, st.py - stemLen * 0.5, topX, topY);
    ctx.stroke();
    if (shape === 'tall' || shape === 'blade' || shape === 'spike') {
      // A leaf blade off the stem, on alternating sides.
      ctx.lineWidth = Math.max(1, T * 0.02);
      ctx.beginPath();
      const side = st.i % 2 ? 1 : -1;
      ctx.moveTo(st.px + lean * 0.2, st.py - stemLen * 0.35);
      ctx.quadraticCurveTo(st.px + side * T * 0.05, st.py - stemLen * 0.55, st.px + side * T * 0.07, st.py - stemLen * 0.85);
      ctx.stroke();
    }

    const hueShift = st.hue;
    const hc = hueShift > 0 ? lighten(headColor, hueShift * 0.5) : shade(headColor, -hueShift * 0.5);
    ctx.fillStyle = hc;
    const hy = topY - T * 0.04;
    const rH = T * 0.077 * (0.85 + st.hv * 0.3);
    ctx.beginPath();
    switch (shape) {
      case 'blade':
      case 'root':
      case 'spike':
        ctx.ellipse(topX, hy, T * 0.035, rH, 0.15 + st.lean, 0, Math.PI * 2);
        break;
      case 'tall':
        ctx.ellipse(topX, hy - T * 0.02, T * 0.03, rH * 1.15, 0.05 + st.lean, 0, Math.PI * 2);
        break;
      case 'ear':
        ctx.ellipse(topX, hy - T * 0.02, T * 0.042, rH * 1.15, st.lean * 0.5, 0, Math.PI * 2);
        break;
      case 'cluster':
      case 'berry':
        for (const [ox, oy] of [[0, 0], [-0.03, 0.04], [0.03, 0.04]]) {
          ctx.moveTo(topX + (ox + 0.035) * T, hy + oy * T);
          ctx.arc(topX + ox * T, hy + oy * T, T * 0.035, 0, Math.PI * 2);
        }
        break;
      case 'orb':
        ctx.arc(topX, topY + T * 0.02, rH * rise, 0, Math.PI * 2);
        break;
      case 'pod':
        ctx.ellipse(topX, hy + T * 0.02, T * 0.031, rH * 1.1, -0.2 + st.lean, 0, Math.PI * 2);
        break;
      case 'puff':
        ctx.arc(topX, hy, T * 0.053 * (0.85 + st.hv * 0.3), 0, Math.PI * 2);
        break;
      case 'star':
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          const sx = topX + Math.cos(a) * T * 0.048, sy = hy + Math.sin(a) * T * 0.048;
          if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        break;
      default:
        ctx.ellipse(topX, hy, T * 0.04, rH, 0.15 + st.lean, 0, Math.PI * 2);
    }
    ctx.fill();
    if (g >= 0.85) outline(ctx, T, 0.32);
    if (detail && ripe) {
      // Sun-side highlight (upper right, where the light comes from).
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(topX + T * 0.018, hy - rH * 0.35, T * 0.014, rH * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function mix(hexA, hexB, t) {
  const a = parseHex(hexA), b = parseHex(hexB);
  if (!a || !b) return hexA;
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const gg = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${gg},${bl})`;
}
function parseHex(hex) {
  if (typeof hex !== 'string' || hex[0] !== '#') return null;
  const h = hex.slice(1);
  const n = h.length === 3
    ? h.split('').map((c) => parseInt(c + c, 16))
    : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => parseInt(c, 16));
  return n.length === 3 && n.every((v) => !Number.isNaN(v)) ? n : null;
}

function makeCropDrawFn(id) {
  const config = CROP_CONFIG[id];
  return (ctx, x, y, size, growProgress) => drawCropStage(ctx, x, y, size, growProgress, config);
}

export const drawWheat = makeCropDrawFn('wheat');
export const drawCorn = makeCropDrawFn('corn');
export const drawCarrot = makeCropDrawFn('carrot');
export const drawSoybean = makeCropDrawFn('soybean');
export const drawSugarcane = makeCropDrawFn('sugarcane');
export const drawCotton = makeCropDrawFn('cotton');
export const drawTomato = makeCropDrawFn('tomato');
export const drawPotato = makeCropDrawFn('potato');
export const drawStrawberry = makeCropDrawFn('strawberry');
export const drawPumpkin = makeCropDrawFn('pumpkin');
export const drawIndigo = makeCropDrawFn('indigo');
export const drawChili = makeCropDrawFn('chili');
export const drawCoffee = makeCropDrawFn('coffee');
export const drawGrapes = makeCropDrawFn('grapes');
export const drawRice = makeCropDrawFn('rice');
export const drawOlive = makeCropDrawFn('olive');
export const drawLavender = makeCropDrawFn('lavender');
export const drawTeaLeaf = makeCropDrawFn('tea_leaf');
export const drawBellPepper = makeCropDrawFn('bell_pepper');
export const drawPeony = makeCropDrawFn('peony');
export const drawWatermelon = makeCropDrawFn('watermelon');
export const drawMint = makeCropDrawFn('mint');
export const drawPine = makeCropDrawFn('pine');
export const drawRubberTree = makeCropDrawFn('rubber_tree');

/** Crop id → draw function, for callers that only have the data.js id string. */
export const CROP_DRAW = {
  wheat: drawWheat, corn: drawCorn, carrot: drawCarrot, soybean: drawSoybean,
  sugarcane: drawSugarcane, cotton: drawCotton, tomato: drawTomato, potato: drawPotato,
  strawberry: drawStrawberry, pumpkin: drawPumpkin, indigo: drawIndigo, chili: drawChili,
  coffee: drawCoffee, grapes: drawGrapes, rice: drawRice, olive: drawOlive,
  lavender: drawLavender, tea_leaf: drawTeaLeaf, bell_pepper: drawBellPepper,
  peony: drawPeony, watermelon: drawWatermelon, mint: drawMint,
  pine: drawPine, rubber_tree: drawRubberTree,
};

// ---------------------------------------------------------------------------------------
// Animals — shared body routine + per-species config (SPRITE-NOTES-adjacent, mirrors §7).
// idleFrame: 0..1, a slow idle bob/blink cycle; callers pass performance.now()-derived phase.
// ---------------------------------------------------------------------------------------

const ANIMAL_CONFIG = {
  chicken: { body: '#fffaea', accent: '#e05548', beak: '#f5a623', kind: 'bird', scale: 0.5 },
  duck:    { body: '#f5f0d8', accent: '#f5a623', beak: '#e8a51e', kind: 'bird', scale: 0.55 },
  quail:   { body: '#c9a878', accent: '#7a5a3a', beak: '#3a2a16', kind: 'bird', scale: 0.42 },
  turkey:  { body: '#8a6a4a', accent: '#e05548', beak: '#f5a623', kind: 'bird', scale: 0.6 },
  bee:     { body: '#f0c02e', accent: '#3a2a16', beak: null,      kind: 'bee',  scale: 0.3 },
  cow:     { body: '#fffaea', spot: '#4a3728', muzzle: '#f2b8b0', kind: 'quad', scale: 1.0 },
  pig:     { body: '#f2b8b0', spot: null, muzzle: '#e0827a', kind: 'quad', scale: 0.82 },
  sheep:   { body: '#faf6ea', spot: null, muzzle: '#e0827a', kind: 'wool', scale: 0.85 },
  lamb:    { body: '#fffaf0', spot: null, muzzle: '#f2b8b0', kind: 'wool', scale: 0.6 },
  goat:    { body: '#e8dcc0', spot: '#bfae8c', muzzle: '#8a7f68', kind: 'quad', scale: 0.8 },
  alpaca:  { body: '#e8d8b8', spot: null, muzzle: '#8a7f68', kind: 'quad', scale: 0.9 },
  otter:   { body: '#7a5a3a', spot: '#a88a5c', muzzle: '#e8d8b8', kind: 'quad', scale: 0.65 },
};

function drawQuadBody(ctx, x, y, T, s, cfg, idlePhase) {
  const bob = Math.sin(idlePhase * Math.PI * 2) * 2 * s;
  const yy = y + bob;
  groundShadow(ctx, x, yy + T * 0.24, T * 0.42, T * 0.11, T);
  ctx.fillStyle = PALETTE.woodDark;
  for (const dx of [-0.23, -0.08, 0.10, 0.24]) ctx.fillRect(x + dx * T, yy + T * 0.08, 7 * s, 18 * s);
  ctx.fillStyle = cfg.body;
  ctx.beginPath();
  ctx.roundRect(x - T * 0.32, yy - T * 0.17, T * 0.64, T * 0.3, T * 0.13);
  ctx.fill(); outline(ctx, T, 0.55);
  if (cfg.spot) {
    ctx.fillStyle = cfg.spot;
    ctx.beginPath(); ctx.ellipse(x - T * 0.12, yy - T * 0.05, 11 * s, 8 * s, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + T * 0.13, yy + T * 0.02, 8 * s, 6 * s, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = cfg.body;
  ctx.beginPath();
  ctx.roundRect(x + T * 0.25, yy - T * 0.31, T * 0.28, T * 0.25, T * 0.1);
  ctx.fill(); outline(ctx, T, 0.55);
  ctx.fillStyle = cfg.muzzle;
  ctx.beginPath();
  ctx.roundRect(x + T * 0.42, yy - T * 0.19, T * 0.16, T * 0.12, T * 0.05);
  ctx.fill(); outline(ctx, T, 0.4);
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath(); ctx.arc(x + T * 0.37, yy - T * 0.23, 2.2 * s, 0, Math.PI * 2); ctx.fill();
}

function drawWoolBody(ctx, x, y, T, s, cfg, idlePhase) {
  const bob = Math.sin(idlePhase * Math.PI * 2) * 2 * s;
  const yy = y + bob;
  groundShadow(ctx, x, yy + T * 0.2, T * 0.38, T * 0.1, T);
  ctx.fillStyle = PALETTE.woodDark;
  for (const dx of [-0.18, -0.03, 0.14]) ctx.fillRect(x + dx * T, yy + T * 0.05, 6 * s, 14 * s);
  const puffs = [[-0.16, -0.12, 0.16], [0, -0.18, 0.19], [0.17, -0.1, 0.15], [-0.02, -0.05, 0.17]];
  ctx.fillStyle = cfg.body;
  for (const [dx, dy, r] of puffs) {
    ctx.beginPath(); ctx.arc(x + dx * T, yy + dy * T, r * T, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath();
  for (const [dx, dy, r] of puffs) { ctx.moveTo(x + dx * T + r * T, yy + dy * T); ctx.arc(x + dx * T, yy + dy * T, r * T, 0, Math.PI * 2); }
  outline(ctx, T, 0.55);
  ctx.fillStyle = cfg.muzzle;
  ctx.beginPath(); ctx.roundRect(x + T * 0.2, yy - T * 0.14, T * 0.13, T * 0.1, T * 0.04); ctx.fill();
  outline(ctx, T, 0.35);
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath(); ctx.arc(x + T * 0.16, yy - T * 0.16, 1.8 * s, 0, Math.PI * 2); ctx.fill();
}

function drawBirdBody(ctx, x, y, T, s, cfg, idlePhase) {
  const bob = Math.sin(idlePhase * Math.PI * 2) * 1.6 * s;
  const yy = y + bob;
  groundShadow(ctx, x, yy + T * 0.15, T * 0.19, T * 0.06, T);
  ctx.fillStyle = cfg.body;
  ctx.beginPath(); ctx.ellipse(x, yy, T * 0.19, T * 0.15, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.5);
  ctx.beginPath(); ctx.arc(x + T * 0.13, yy - T * 0.15, T * 0.1, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.5);
  ctx.fillStyle = cfg.accent;
  ctx.beginPath(); ctx.arc(x + T * 0.11, yy - T * 0.24, T * 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + T * 0.23, yy - T * 0.15); ctx.lineTo(x + T * 0.32, yy - T * 0.12); ctx.lineTo(x + T * 0.23, yy - T * 0.09);
  ctx.closePath(); ctx.fillStyle = cfg.beak; ctx.fill();
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath(); ctx.arc(x + T * 0.16, yy - T * 0.17, 1.8 * s, 0, Math.PI * 2); ctx.fill();
}

function drawBeeBody(ctx, x, y, T, s, cfg, idlePhase) {
  const hover = Math.sin(idlePhase * Math.PI * 4) * 6 * s;
  const yy = y - T * 0.3 + hover;
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#fff';
  for (const dx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * T * 0.09, yy - T * 0.02, T * 0.09, T * 0.04, dx * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = cfg.body;
  ctx.beginPath(); ctx.ellipse(x, yy, T * 0.1, T * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  outline(ctx, T, 0.35);
  ctx.strokeStyle = cfg.accent; ctx.lineWidth = T * 0.02;
  for (const dx of [-0.03, 0.02]) {
    ctx.beginPath(); ctx.moveTo(x + dx * T, yy - T * 0.06); ctx.lineTo(x + dx * T, yy + T * 0.06); ctx.stroke();
  }
}

/** Idle-bob animal body: species config selects quad/wool/bird/bee body plan. */
export function drawAnimal(ctx, x, y, size, idleFrame, speciesId) {
  const T = 104 * size;
  const cfg = ANIMAL_CONFIG[speciesId] || ANIMAL_CONFIG.chicken;
  const s = size * cfg.scale;
  const phase = typeof idleFrame === 'number' ? idleFrame % 1 : 0;
  if (cfg.kind === 'quad') drawQuadBody(ctx, x, y, T, s, cfg, phase);
  else if (cfg.kind === 'wool') drawWoolBody(ctx, x, y, T, s, cfg, phase);
  else if (cfg.kind === 'bee') drawBeeBody(ctx, x, y, T, s, cfg, phase);
  else drawBirdBody(ctx, x, y, T, s, cfg, phase);
}

function makeAnimalDrawFn(id) {
  return (ctx, x, y, size, idleFrame) => drawAnimal(ctx, x, y, size, idleFrame, id);
}

export const drawChicken = makeAnimalDrawFn('chicken');
export const drawCow = makeAnimalDrawFn('cow');
export const drawPig = makeAnimalDrawFn('pig');
export const drawSheep = makeAnimalDrawFn('sheep');
export const drawGoat = makeAnimalDrawFn('goat');
export const drawBee = makeAnimalDrawFn('bee');
export const drawDuck = makeAnimalDrawFn('duck');
export const drawLamb = makeAnimalDrawFn('lamb');
export const drawQuail = makeAnimalDrawFn('quail');
export const drawAlpaca = makeAnimalDrawFn('alpaca');
export const drawOtter = makeAnimalDrawFn('otter');
export const drawTurkey = makeAnimalDrawFn('turkey');

export const ANIMAL_DRAW = {
  chicken: drawChicken, cow: drawCow, pig: drawPig, sheep: drawSheep, goat: drawGoat,
  bee: drawBee, duck: drawDuck, lamb: drawLamb, quail: drawQuail, alpaca: drawAlpaca,
  otter: drawOtter, turkey: drawTurkey,
};

// What stands in each species' pen besides the animals. hut: a small wooden house with a ramp;
// shed: an open roof on posts; pond: water; hive: a box hive on a stand.
const PEN_SHELTER = {
  chicken: 'hut', quail: 'hut', turkey: 'hut', pig: 'hut',
  cow: 'shed', sheep: 'shed', lamb: 'shed', goat: 'shed', alpaca: 'shed',
  duck: 'pond', otter: 'pond', bee: 'hive',
};

/** Posts and two rails along one fence edge from A to B, `tiles` tiles long. */
function fenceEdge(ctx, A, B, tiles, T) {
  const n = Math.max(1, Math.round(tiles * 2));
  const postH = T * 0.2, postW = Math.max(2, T * 0.045);
  const rail = (frac) => {
    ctx.beginPath();
    ctx.moveTo(A[0], A[1] - postH * frac);
    ctx.lineTo(B[0], B[1] - postH * frac);
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = PALETTE.outline; ctx.lineWidth = T * 0.05;
  rail(0.82); rail(0.42);
  ctx.strokeStyle = PALETTE.wood; ctx.lineWidth = T * 0.026;
  rail(0.82); rail(0.42);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t;
    ctx.fillStyle = PALETTE.woodDark;
    ctx.beginPath(); ctx.roundRect(px - postW / 2, py - postH, postW, postH + T * 0.01, postW * 0.3); ctx.fill();
    outline(ctx, T, 0.4);
    ctx.fillStyle = PALETTE.woodLight;
    ctx.fillRect(px - postW / 2 + 1, py - postH + 1, Math.max(1, postW * 0.35), postH * 0.7);
  }
  ctx.restore();
}

function drawPenShelter(ctx, kind, sx, sy, T, cfg) {
  if (kind === 'pond') {
    const rx = T * 0.46, ry = T * 0.22;
    ctx.fillStyle = '#2f6f96';
    ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = linearGradient(ctx, sx, sy - ry, sx, sy + ry, [[0, PALETTE.waterLight], [1, PALETTE.water]], PALETTE.water);
    ctx.beginPath(); ctx.ellipse(sx, sy - T * 0.02, rx * 0.94, ry * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    outline(ctx, T, 0.5);
    ctx.fillStyle = '#5fae2e';
    for (const [dx, dy] of [[-0.2, 0.05], [0.24, -0.04], [0.05, 0.1]]) {
      ctx.beginPath(); ctx.ellipse(sx + dx * T, sy + dy * T, T * 0.05, T * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  if (kind === 'hive') {
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(sx - T * 0.12, sy - T * 0.02, T * 0.24, T * 0.05);
    for (const dx of [-0.09, 0.07]) ctx.fillRect(sx + dx * T, sy, T * 0.03, T * 0.12);
    ctx.fillStyle = '#e8c860';
    ctx.beginPath(); ctx.roundRect(sx - T * 0.13, sy - T * 0.3, T * 0.26, T * 0.28, T * 0.02); ctx.fill();
    outline(ctx, T, 0.5);
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(sx - T * 0.15, sy - T * 0.34, T * 0.3, T * 0.05);
    ctx.fillRect(sx - T * 0.05, sy - T * 0.08, T * 0.1, T * 0.03);
    return;
  }
  if (kind === 'shed') {
    const w = T * 0.62, h = T * 0.34;
    ctx.fillStyle = PALETTE.woodDark;
    for (const dx of [-0.42, 0.42]) ctx.fillRect(sx + dx * w - T * 0.02, sy - h * 0.5, T * 0.04, h * 0.5 + T * 0.04);
    ctx.fillStyle = 'rgba(58,37,16,0.18)';
    ctx.beginPath(); ctx.ellipse(sx, sy + T * 0.03, w * 0.5, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cfg.roof || PALETTE.roofDark;
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.55, sy - h * 0.45); ctx.lineTo(sx + w * 0.55, sy - h * 0.45);
    ctx.lineTo(sx + w * 0.42, sy - h * 0.95); ctx.lineTo(sx - w * 0.42, sy - h * 0.95);
    ctx.closePath(); ctx.fill(); outline(ctx, T, 0.6);
    ctx.fillStyle = PALETTE.wheatGold;
    ctx.beginPath(); ctx.ellipse(sx, sy - T * 0.02, w * 0.3, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // hut: a small board house with a slanted roof and a ramp down to the yard
  const w = T * 0.42, h = T * 0.3;
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath(); ctx.roundRect(sx - w / 2, sy - h, w, h, T * 0.015); ctx.fill();
  outline(ctx, T, 0.6);
  ctx.fillStyle = cfg.roof || PALETTE.roof;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.6, sy - h); ctx.lineTo(sx + w * 0.6, sy - h);
  ctx.lineTo(sx + w * 0.45, sy - h * 1.42); ctx.lineTo(sx - w * 0.45, sy - h * 1.42);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.6);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.beginPath(); ctx.roundRect(sx - w * 0.16, sy - h * 0.62, w * 0.32, h * 0.62, T * 0.01); ctx.fill();
  ctx.fillStyle = PALETTE.woodLight;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.16, sy); ctx.lineTo(sx + w * 0.16, sy);
  ctx.lineTo(sx + w * 0.3, sy + T * 0.1); ctx.lineTo(sx - w * 0.02, sy + T * 0.1);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.3);
}

const PEN_ROOFS = {
  chicken: PALETTE.roof, quail: '#c9a86a', turkey: '#b83a2c', pig: '#a87c42',
  cow: '#b83a2c', sheep: '#7a4a18', lamb: '#7a4a18', goat: '#6f6552', alpaca: '#4a8fd4',
};

/**
 * Fenced pen enclosure on its REAL footprint. (x, y) is the renderer's footprint anchor (see
 * footprintCorners), so the fence traces the plot the pen actually occupies at every zoom, and
 * animals (separate render objects) stand inside it.
 *
 * opts: { fw, fh, part: 'back'|'front'|'all', fed, ready }
 *   part 'back'  - ground plate, shelter, trough and the two far fence edges
 *   part 'front' - the two near fence edges, drawn AFTER the animals so they stand behind rails
 *   fed          - feed shows in the trough while the animals are producing
 */
export function drawPen(ctx, x, y, size = 1, penType, opts = {}) {
  const fw = opts.fw || 2, fh = opts.fh || 2;
  const T = (104 * size) / Math.max(fw, fh);          // one tile in px at this zoom
  const c = footprintCorners(x, y, fw, fh, T);
  const part = opts.part || 'all';
  const cfg = { ...(ANIMAL_CONFIG[penType] || ANIMAL_CONFIG.chicken), roof: PEN_ROOFS[penType] };
  const shelter = PEN_SHELTER[penType] || 'hut';
  const pt = (u, v) => [c.top[0] + (u - v) * T, c.top[1] + (u + v) * (T / 2)];   // footprint tile coords

  if (part !== 'front') {
    groundShadow(ctx, c.centre[0], c.centre[1] + T * 0.06, T * fw * 0.98, T * fh * 0.46, T);
    footprintPath(ctx, x, y, fw, fh, T);
    ctx.fillStyle = radialGradient(ctx, c.centre[0], c.centre[1], 0, c.centre[0], c.centre[1], T * Math.max(fw, fh) * 0.85,
      [[0, PALETTE.soilLight], [0.5, '#a5804c'], [1, '#79a83a']], PALETTE.soilLight);
    ctx.fill();
    // Hoof-worn earth: a few darker scuffs, deterministic so the yard never shimmers.
    ctx.fillStyle = 'rgba(70,45,20,0.16)';
    for (let i = 0; i < 6; i++) {
      const [sx, sy] = pt(0.3 + prand(i, 71) * (fw - 0.6), 0.3 + prand(i, 72) * (fh - 0.6));
      ctx.beginPath(); ctx.ellipse(sx, sy, T * (0.08 + prand(i, 73) * 0.1), T * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    }
    footprintPath(ctx, x, y, fw, fh, T);
    outline(ctx, T, 0.35);

    fenceEdge(ctx, c.top, c.west, fh, T);
    fenceEdge(ctx, c.top, c.east, fw, T);

    // Shelter at the far corner (behind the animals), pond a little further in.
    const [shx, shy] = shelter === 'pond' ? pt(fw * 0.55, fh * 0.42) : pt(fw * 0.5, fh * 0.32);
    drawPenShelter(ctx, shelter, shx, shy, T, cfg);

    // Trough near the front-left, with feed in it while the animals are working on a batch.
    if (shelter !== 'hive' && shelter !== 'pond') {
      const [tx0, ty0] = pt(0.42, fh - 0.42);
      ctx.fillStyle = PALETTE.woodDark;
      ctx.beginPath(); ctx.roundRect(tx0 - T * 0.16, ty0 - T * 0.09, T * 0.32, T * 0.1, T * 0.02); ctx.fill();
      outline(ctx, T, 0.4);
      ctx.fillStyle = opts.fed ? PALETTE.wheatGold : 'rgba(40,24,8,0.5)';
      ctx.beginPath(); ctx.roundRect(tx0 - T * 0.13, ty0 - T * 0.08, T * 0.26, T * 0.045, T * 0.01); ctx.fill();
    }
  }
  if (part !== 'back') {
    fenceEdge(ctx, c.west, c.south, fw, T);
    fenceEdge(ctx, c.east, c.south, fh, T);
  }
}

// ---------------------------------------------------------------------------------------
// Buildings - production buildings.
//
// This used to be one box + gable roof + one of five accents, keyed only by roof colour, so
// forty-odd factories all read as the same hut in different paint. Three things changed:
//
//   1. FORM. Each building picks a roof form (gable/hip/flat/domed/sawtooth/pagoda/barrel/
//      kiosk/tower), which changes the silhouette rather than the palette. Silhouette is what
//      you actually recognise at farm zoom, where the roof is twelve pixels tall.
//   2. FURNITURE. Chimneys, silos, awnings, barrels, crates, vents, pipes, lanterns and
//      planters hang off the shell, so a smelter reads as industrial and a tea house does not.
//   3. WORK. drawBuilding now takes { working, now } and animates only while a craft is
//      actually running: smoke rises and fades, wheels and blades turn, churns bob, pots
//      bubble, forge sparks fly, and the windows warm up. Idle buildings are still, which is
//      the point - "is this factory busy?" becomes readable from across the farm without
//      opening a panel.
//
// Everything is drawn from code. No image assets, ever (CLAUDE.md).
// ---------------------------------------------------------------------------------------

const BUILDING_CONFIG = {
  // grain + baking
  feed_mill:   { roof: PALETTE.roofAlt, form: 'gable',    accent: 'blades', extras: ['silo'] },
  bakery:      { roof: PALETTE.roof,    form: 'gable',    accent: 'smoke',  extras: ['chimney', 'awning'], sign: '#f2c94c' },
  cake_oven:   { roof: PALETTE.roofAlt, form: 'domed',    accent: 'smoke',  extras: ['chimney', 'awning'], sign: '#f48ab0' },
  pie_oven:    { roof: PALETTE.roof,    form: 'domed',    accent: 'smoke',  extras: ['chimney'] },
  sugar_mill:  { roof: PALETTE.roofAlt, form: 'gable',    accent: 'blades', extras: ['silo', 'crates'] },
  pasta_kitchen: { roof: '#f0b52e',     form: 'hip',      accent: 'steam',  extras: ['awning'] },
  donut_maker: { roof: PALETTE.trimLight, form: 'kiosk',  accent: 'churn',  extras: ['awning', 'lantern'], sign: '#f48ab0' },

  // dairy + cold
  dairy:       { roof: '#4a8fd4',       form: 'gable',    accent: 'churn',  extras: ['silo', 'planter'] },
  ice_cream_maker: { roof: PALETTE.trimLight, form: 'kiosk', accent: 'churn', extras: ['awning'], sign: '#7fd4f0' },
  yogurt_maker: { roof: '#fffaea',      form: 'barrel',   accent: 'churn',  extras: ['crates'] },
  milkshake_bar: { roof: '#f48ab0',     form: 'kiosk',    accent: 'churn',  extras: ['awning', 'lantern'] },

  // hot food
  grill:       { roof: PALETTE.roofDark, form: 'flat',    accent: 'sparks', extras: ['chimney', 'vents'] },
  soup_kitchen: { roof: PALETTE.roof,   form: 'hip',      accent: 'pot',    extras: ['chimney', 'barrels'] },
  sandwich_bar: { roof: PALETTE.roof,   form: 'kiosk',    accent: 'pot',    extras: ['awning'] },
  taco_kitchen: { roof: PALETTE.roofDark, form: 'kiosk',  accent: 'sparks', extras: ['awning', 'lantern'], sign: '#f0862e' },
  salad_bar:   { roof: '#5fae2e',       form: 'kiosk',    accent: 'pot',    extras: ['awning', 'planter'] },
  sushi_bar:   { roof: '#4a8fd4',       form: 'pagoda',   accent: 'pot',    extras: ['lantern'] },
  fondue_pot:  { roof: '#e05548',       form: 'barrel',   accent: 'pot',    extras: ['chimney'] },
  popcorn_pot: { roof: PALETTE.roof,    form: 'kiosk',    accent: 'pot',    extras: ['awning'] },
  hot_dog_stand: { roof: '#e05548',     form: 'kiosk',    accent: 'steam',  extras: ['awning'] },
  omelet_station: { roof: '#f0b52e',    form: 'kiosk',    accent: 'sparks', extras: ['awning'] },

  // drinks
  coffee_kiosk: { roof: '#6a3a20',      form: 'kiosk',    accent: 'steam',  extras: ['awning', 'lantern'], sign: '#c08a4e' },
  tea_house:   { roof: '#7fae4a',       form: 'pagoda',   accent: 'steam',  extras: ['lantern', 'planter'] },
  juice_press: { roof: '#f0862e',       form: 'barrel',   accent: 'wheel',  extras: ['barrels', 'crates'] },
  tropical_cafe: { roof: '#4f9c26',     form: 'pagoda',   accent: 'steam',  extras: ['awning', 'planter'] },
  smoothie_mixer: { roof: '#f48ab0',    form: 'kiosk',    accent: 'churn',  extras: ['awning'] },

  // tackle
  lure_workbench: { roof: '#4a8fd4',   form: 'gable',    accent: 'wheel',  extras: ['crates', 'barrels'] },

  // apiary
  honey_extractor: { roof: '#f0b52e',   form: 'barrel',   accent: 'wheel',  extras: ['crates', 'planter'], sign: '#f2c94c' },
  net_maker:      { roof: '#3f7f6f',   form: 'sawtooth', accent: 'wheel',  extras: ['crates', 'barrels'] },
  doner_stand:    { roof: '#c94f3d',   form: 'kiosk',    accent: 'smoke',  extras: ['awning', 'lantern'], sign: '#f2a03d' },
  lobster_pool:   { roof: '#2f6f9f',   form: 'flat',     accent: 'drips',  extras: ['barrels', 'pipes'] },
  duck_salon:     { roof: '#e8a0c0',   form: 'pagoda',   accent: 'steam',  extras: ['awning', 'planter'], sign: '#f7d6e6' },
  pasta_maker:    { roof: '#d9b45c',   form: 'hip',      accent: 'gear',   extras: ['silo', 'vents'], sign: '#f2e2b0' },

  // preserves + pressing
  jam_maker:   { roof: '#c9382e',       form: 'barrel',   accent: 'pot',    extras: ['crates'] },
  preservation_station: { roof: '#4a8fd4', form: 'barrel', accent: 'pot',   extras: ['barrels', 'crates'] },
  oil_press:   { roof: '#7a8f3a',       form: 'gable',    accent: 'wheel',  extras: ['barrels', 'pipes'] },
  sauce_maker: { roof: PALETTE.roofDark, form: 'barrel',  accent: 'pot',    extras: ['barrels'] },

  // craft + textile
  loom:        { roof: '#9a6fd0',       form: 'sawtooth', accent: 'wheel',  extras: ['crates'] },
  sewing_machine: { roof: '#e05548',    form: 'sawtooth', accent: 'wheel',  extras: ['crates'] },
  hat_maker:   { roof: PALETTE.roofAlt, form: 'hip',      accent: 'wheel',  extras: ['awning'], sign: '#9a6fd0' },
  candle_maker: { roof: PALETTE.roofAlt, form: 'gable',   accent: 'drips',  extras: ['chimney'] },
  perfumery:   { roof: '#9a6fd0',       form: 'tower',    accent: 'drips',  extras: ['planter'] },
  jeweler:     { roof: '#9a6fd0',       form: 'tower',    accent: 'gear',   extras: ['lantern'], sign: '#f0b52e' },
  flower_shop: { roof: PALETTE.roofAlt, form: 'kiosk',    accent: 'blades', extras: ['awning', 'planter'] },
  candy_machine: { roof: '#f48ab0',     form: 'flat',     accent: 'gear',   extras: ['pipes', 'vents'] },

  // heavy industry
  smelter:     { roof: '#5a5a5a',       form: 'tower',    accent: 'sparks', extras: ['chimney', 'pipes', 'vents'] },
  rubber_factory: { roof: PALETTE.roof, form: 'sawtooth', accent: 'smoke',  extras: ['chimney', 'pipes'] },
  paper_mill:  { roof: PALETTE.roofDark, form: 'sawtooth', accent: 'wheel', extras: ['pipes', 'crates'] },
  build_workshop: { roof: PALETTE.roofDark, form: 'flat', accent: 'gear',   extras: ['crates', 'vents'] },
};

const FALLBACK_CFG = { roof: PALETTE.roof, form: 'gable', accent: 'smoke', extras: [] };

/** Deterministic 0..1 from a string, so a building without a config still looks consistent. */
function strHash(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * The roof. `form` decides the silhouette; everything else is shared.
 *
 * A derelict roof sags (SPRITE-NOTES §6) whatever its form, so the sag is applied here once
 * rather than being re-derived per form and drifting between them.
 */
function drawRoofForm(ctx, x, yy, BW, BH, T, form, color, derelict, size) {
  const sag = derelict ? 0.18 : 0;
  ctx.fillStyle = color;
  ctx.beginPath();

  if (form === 'flat') {
    ctx.moveTo(x - BW * 0.60, yy - BH * (0.66 - sag * 0.3));
    ctx.lineTo(x + BW * 0.60, yy - BH * (0.66 - sag * 0.3));
    ctx.lineTo(x + BW * 0.56, yy - BH * 0.14);
    ctx.lineTo(x - BW * 0.56, yy - BH * 0.14);
  } else if (form === 'hip') {
    ctx.moveTo(x - BW * 0.58, yy - BH * 0.12);
    ctx.lineTo(x - BW * 0.30, yy - BH * (0.80 - sag));
    ctx.lineTo(x + BW * 0.30, yy - BH * (0.80 - sag));
    ctx.lineTo(x + BW * 0.58, yy - BH * 0.12);
  } else if (form === 'domed') {
    ctx.moveTo(x - BW * 0.56, yy - BH * 0.12);
    ctx.quadraticCurveTo(x, yy - BH * (1.34 - sag * 1.4), x + BW * 0.56, yy - BH * 0.12);
  } else if (form === 'barrel') {
    ctx.moveTo(x - BW * 0.56, yy - BH * 0.12);
    ctx.quadraticCurveTo(x - BW * 0.30, yy - BH * (0.98 - sag), x, yy - BH * (0.98 - sag));
    ctx.quadraticCurveTo(x + BW * 0.30, yy - BH * (0.98 - sag), x + BW * 0.56, yy - BH * 0.12);
  } else if (form === 'sawtooth') {
    // Factory north-light roof: three steep teeth. Reads as "industrial" instantly.
    ctx.moveTo(x - BW * 0.58, yy - BH * 0.12);
    for (let i = 0; i < 3; i++) {
      const x0 = x - BW * 0.58 + (BW * 1.16 * i) / 3;
      const x1 = x - BW * 0.58 + (BW * 1.16 * (i + 1)) / 3;
      ctx.lineTo(x0, yy - BH * (0.78 - sag));
      ctx.lineTo(x1, yy - BH * (0.30 - sag * 0.4));
    }
    ctx.lineTo(x + BW * 0.58, yy - BH * 0.12);
  } else if (form === 'pagoda') {
    // Upswept eaves with a flick at each end.
    ctx.moveTo(x - BW * 0.66, yy - BH * 0.04);
    ctx.quadraticCurveTo(x - BW * 0.34, yy - BH * (0.56 - sag), x, yy - BH * (0.60 - sag));
    ctx.quadraticCurveTo(x + BW * 0.34, yy - BH * (0.56 - sag), x + BW * 0.66, yy - BH * 0.04);
    ctx.quadraticCurveTo(x + BW * 0.30, yy - BH * (0.26 - sag), x, yy - BH * (0.28 - sag));
    ctx.quadraticCurveTo(x - BW * 0.30, yy - BH * (0.26 - sag), x - BW * 0.66, yy - BH * 0.04);
  } else if (form === 'kiosk') {
    // Shallow shop canopy - wide, low, welcoming.
    ctx.moveTo(x - BW * 0.66, yy - BH * 0.16);
    ctx.lineTo(x - BW * 0.44, yy - BH * (0.62 - sag));
    ctx.lineTo(x + BW * 0.44, yy - BH * (0.62 - sag));
    ctx.lineTo(x + BW * 0.66, yy - BH * 0.16);
  } else if (form === 'tower') {
    ctx.moveTo(x - BW * 0.56, yy - BH * 0.12);
    ctx.lineTo(x - BW * 0.10, yy - BH * (1.06 - sag));
    ctx.lineTo(x + BW * 0.10, yy - BH * (1.06 - sag));
    ctx.lineTo(x + BW * 0.56, yy - BH * 0.12);
  } else { // gable
    ctx.moveTo(x - BW * 0.58, yy - BH * 0.12);
    ctx.lineTo(x - BW * 0.20, yy - BH * (0.78 - sag));
    ctx.lineTo(x + BW * 0.20, yy - BH * (0.78 - sag));
    ctx.lineTo(x + BW * 0.58, yy - BH * 0.12);
  }

  ctx.closePath();
  // Lit at the ridge, darker toward the eave: the roof is the biggest face the sun hits.
  fillUnit(ctx, `roof:${color}`, 'v', [[0, lighten(color, 0.16)], [0.55, color], [1, shade(color, 0.2)]],
    x - BW * 0.66, yy - BH * 1.34, BW * 1.32, BH * 1.3, color);
  ctx.strokeStyle = derelictColor(PALETTE.trimLight);
  ctx.lineWidth = 3.6 * size;
  ctx.stroke();
  outline(ctx, T);

  // The pagoda's upper tier is a second pass, so drawRoofForm's main path stays one shape.
  if (form === 'pagoda' && !derelict) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - BW * 0.42, yy - BH * 0.52);
    ctx.quadraticCurveTo(x - BW * 0.18, yy - BH * 1.02, x, yy - BH * 1.06);
    ctx.quadraticCurveTo(x + BW * 0.18, yy - BH * 1.02, x + BW * 0.42, yy - BH * 0.52);
    ctx.quadraticCurveTo(x + BW * 0.18, yy - BH * 0.72, x, yy - BH * 0.74);
    ctx.quadraticCurveTo(x - BW * 0.18, yy - BH * 0.72, x - BW * 0.42, yy - BH * 0.52);
    ctx.closePath();
    ctx.fill();
    outline(ctx, T);
  }
}

/** Bolt-on furniture. Purely silhouette work: these are what stop factories reading alike. */
function drawExtras(ctx, x, yy, BW, BH, T, extras, cfg, derelict, size, t, working) {
  const has = (k) => extras.includes(k);

  if (has('silo')) {
    const sx = x - BW * 0.52, sh = BH * 1.5;
    ctx.fillStyle = derelict ? PALETTE.derelictWall : PALETTE.silo;
    ctx.beginPath();
    ctx.roundRect(sx - T * 0.09, yy - sh * 0.62, T * 0.18, sh * 0.94, T * 0.05);
    ctx.fill(); outline(ctx, T, 0.7);
    ctx.fillStyle = derelict ? PALETTE.derelictRoof : cfg.roof;
    ctx.beginPath();
    ctx.ellipse(sx, yy - sh * 0.62, T * 0.095, T * 0.05, 0, Math.PI, 0);
    ctx.fill(); outline(ctx, T, 0.7);
  }

  if (has('chimney')) {
    ctx.fillStyle = derelict ? PALETTE.derelictWall : PALETTE.woodDark;
    ctx.beginPath();
    ctx.roundRect(x + BW * 0.26, yy - BH * 1.06, T * 0.085, T * 0.24, T * 0.015);
    ctx.fill(); outline(ctx, T, 0.6);
    ctx.fillStyle = derelict ? PALETTE.derelictRoof : PALETTE.wood;
    ctx.fillRect(x + BW * 0.245, yy - BH * 1.10, T * 0.115, T * 0.035);
  }

  if (has('awning') && !derelict) {
    // Striped shop awning. The stripes are what make it read as a shop rather than a ledge.
    const ax = x - BW * 0.56, aw = BW * 1.12, ay = yy - BH * 0.04, ah = T * 0.075;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? PALETTE.trimLight : (cfg.sign || cfg.roof);
      ctx.beginPath();
      ctx.moveTo(ax + (aw * i) / 6, ay);
      ctx.lineTo(ax + (aw * (i + 1)) / 6, ay);
      ctx.lineTo(ax + (aw * (i + 1)) / 6, ay + ah);
      ctx.lineTo(ax + (aw * i) / 6, ay + ah);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = outlineWidth(T) * 0.55;
    ctx.strokeRect(ax, ay, aw, ah);
  }

  if (has('barrels')) {
    for (let i = 0; i < 2; i++) {
      const bx = x + BW * (0.46 + i * 0.16), by = yy + BH * 0.36;
      ctx.fillStyle = derelict ? PALETTE.derelictWall : PALETTE.wood;
      ctx.beginPath(); ctx.roundRect(bx - T * 0.055, by - T * 0.10, T * 0.11, T * 0.15, T * 0.025);
      ctx.fill(); outline(ctx, T, 0.55);
      ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = 1.6 * size;
      ctx.beginPath();
      ctx.moveTo(bx - T * 0.055, by - T * 0.045);
      ctx.lineTo(bx + T * 0.055, by - T * 0.045);
      ctx.stroke();
    }
  }

  if (has('crates')) {
    const cx = x - BW * 0.52, cy = yy + BH * 0.38;
    ctx.fillStyle = derelict ? PALETTE.derelictWall : PALETTE.woodLight;
    ctx.beginPath(); ctx.roundRect(cx - T * 0.07, cy - T * 0.10, T * 0.14, T * 0.13, T * 0.015);
    ctx.fill(); outline(ctx, T, 0.55);
    ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = 1.6 * size;
    ctx.beginPath();
    ctx.moveTo(cx - T * 0.07, cy - T * 0.035); ctx.lineTo(cx + T * 0.07, cy - T * 0.035);
    ctx.moveTo(cx, cy - T * 0.10); ctx.lineTo(cx, cy + T * 0.03);
    ctx.stroke();
  }

  if (has('pipes')) {
    ctx.strokeStyle = derelict ? PALETTE.derelictWall : '#8a8f96';
    ctx.lineWidth = T * 0.045;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - BW * 0.42, yy + BH * 0.30);
    ctx.lineTo(x - BW * 0.42, yy - BH * 0.02);
    ctx.lineTo(x - BW * 0.18, yy - BH * 0.02);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  if (has('vents')) {
    ctx.fillStyle = derelict ? PALETTE.derelictWall : '#8a8f96';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x - BW * 0.12 + i * T * 0.08, yy - BH * 0.30, T * 0.026, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (has('lantern') && !derelict) {
    // Lit only while working - a dark lantern on an idle shop is a real signal, not decoration.
    const lx = x + BW * 0.44, ly = yy - BH * 0.10;
    ctx.fillStyle = working
      ? 'rgba(255,214,120,' + (0.55 + 0.35 * Math.sin(t * 3)).toFixed(3) + ')'
      : 'rgba(120,110,90,0.5)';
    ctx.beginPath(); ctx.arc(lx, ly, T * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = outlineWidth(T) * 0.45;
    ctx.stroke();
  }

  if (has('planter') && !derelict) {
    const px = x - BW * 0.34, py = yy + BH * 0.40;
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath(); ctx.roundRect(px - T * 0.07, py - T * 0.04, T * 0.14, T * 0.06, T * 0.012);
    ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = PALETTE.grassDark;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(px - T * 0.04 + i * T * 0.04, py - T * 0.055, T * 0.026, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.flowerPink;
    ctx.beginPath(); ctx.arc(px, py - T * 0.075, T * 0.014, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * The working accent. `t` is seconds; when the building is idle every motion is frozen, which
 * is the whole point - a still farm means nothing is cooking.
 */
function drawAccent(ctx, x, yy, BW, BH, T, accent, cfg, size, t, working) {
  const spin = working ? t : 0;

  if (accent === 'smoke' || accent === 'steam') {
    const warm = accent === 'steam';
    const ox = x + BW * 0.30;
    const oy = yy - BH * (warm ? 0.62 : 1.10);
    if (!working) {
      // A single thin resting wisp, so the chimney does not look broken.
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.arc(ox, oy - T * 0.03, T * 0.032, 0, Math.PI * 2); ctx.fill();
      return;
    }
    for (let i = 0; i < 4; i++) {
      const life = (t * 0.55 + i * 0.25) % 1;             // 0..1 rise
      const rise = life * T * 0.42;
      const grow = 0.030 + life * 0.055;
      const fade = (1 - life) * (warm ? 0.55 : 0.62);
      ctx.fillStyle = warm
        ? 'rgba(255,250,238,' + fade.toFixed(3) + ')'
        : 'rgba(255,255,255,' + fade.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(ox + Math.sin(life * 4 + i) * T * 0.035, oy - rise, T * grow, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (accent === 'blades') {
    ctx.save();
    ctx.translate(x, yy - BH * 0.86);
    ctx.rotate(spin * 1.6);
    ctx.strokeStyle = PALETTE.trimLight;
    ctx.lineWidth = 4 * size;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * T * 0.16, Math.sin(a) * T * 0.16);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath(); ctx.arc(0, 0, T * 0.030, 0, Math.PI * 2); ctx.fill();
    outline(ctx, T, 0.5);
    ctx.restore();
    return;
  }

  if (accent === 'wheel') {
    ctx.save();
    ctx.translate(x + BW * 0.40, yy + BH * 0.06);
    ctx.rotate(spin * 1.1);
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath(); ctx.arc(0, 0, T * 0.115, 0, Math.PI * 2); ctx.fill();
    outline(ctx, T, 0.6);
    ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = 2.4 * size;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * T * 0.10, Math.sin(a) * T * 0.10);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (accent === 'gear') {
    // Two counter-rotating gears - the clearest "machine is running" read there is.
    const drawGear = (gx, gy, r, dir, teeth) => {
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(spin * dir * 1.3);
      ctx.fillStyle = '#8a8f96';
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (Math.PI / teeth) * i;
        const rr = i % 2 ? r : r * 1.28;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); outline(ctx, T, 0.5);
      ctx.fillStyle = PALETTE.wall;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    drawGear(x + BW * 0.34, yy - BH * 0.10, T * 0.075, 1, 8);
    drawGear(x + BW * 0.50, yy + BH * 0.06, T * 0.055, -1, 7);
    return;
  }

  if (accent === 'churn') {
    const bob = working ? Math.sin(t * 5) * T * 0.028 : 0;
    ctx.fillStyle = PALETTE.siloDark;
    ctx.beginPath();
    ctx.roundRect(x + BW * 0.30, yy - BH * 0.06, T * 0.13, T * 0.18, T * 0.025);
    ctx.fill(); outline(ctx, T, 0.6);
    ctx.strokeStyle = PALETTE.wood;
    ctx.lineWidth = 4 * size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + BW * 0.365, yy - BH * 0.06 + bob);
    ctx.lineTo(x + BW * 0.365, yy - BH * 0.30 + bob);
    ctx.stroke();
    ctx.lineCap = 'butt';
    return;
  }

  if (accent === 'pot') {
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.roundRect(x + BW * 0.26, yy - BH * 0.02, T * 0.17, T * 0.13, T * 0.03);
    ctx.fill(); outline(ctx, T, 0.6);
    if (working) {
      // Bubbles break the surface and pop; the lid lifts on the beat.
      const lid = Math.sin(t * 6) * T * 0.012;
      ctx.fillStyle = PALETTE.trimLight;
      ctx.beginPath();
      ctx.ellipse(x + BW * 0.345, yy - BH * 0.03 + lid, T * 0.075, T * 0.02, 0, 0, Math.PI * 2);
      ctx.fill(); outline(ctx, T, 0.4);
      for (let i = 0; i < 3; i++) {
        const life = (t * 0.9 + i * 0.33) % 1;
        ctx.fillStyle = 'rgba(255,255,255,' + ((1 - life) * 0.6).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x + BW * (0.30 + i * 0.05), yy - BH * 0.08 - life * T * 0.14, T * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (accent === 'sparks') {
    ctx.fillStyle = working ? '#ff8c2e' : '#5a4638';
    ctx.beginPath();
    ctx.roundRect(x + BW * 0.24, yy + BH * 0.04, T * 0.16, T * 0.10, T * 0.02);
    ctx.fill(); outline(ctx, T, 0.6);
    if (working) {
      for (let i = 0; i < 5; i++) {
        const life = (t * 1.5 + i * 0.2) % 1;
        const a = -Math.PI / 2 + (i - 2) * 0.34;
        ctx.fillStyle = 'rgba(255,' + (180 - i * 14) + ',80,' + ((1 - life) * 0.9).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(
          x + BW * 0.32 + Math.cos(a) * life * T * 0.16,
          yy + BH * 0.04 + Math.sin(a) * life * T * 0.16,
          T * 0.012 * (1 - life * 0.5), 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }
    return;
  }

  if (accent === 'drips') {
    ctx.fillStyle = PALETTE.siloLight;
    ctx.beginPath();
    ctx.roundRect(x + BW * 0.28, yy - BH * 0.10, T * 0.11, T * 0.20, T * 0.02);
    ctx.fill(); outline(ctx, T, 0.6);
    if (working) {
      for (let i = 0; i < 2; i++) {
        const life = (t * 1.1 + i * 0.5) % 1;
        ctx.fillStyle = 'rgba(255,240,200,' + (1 - life).toFixed(3) + ')';
        ctx.beginPath();
        ctx.ellipse(x + BW * 0.335, yy + BH * 0.10 + life * T * 0.12, T * 0.014, T * 0.020, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Any production building.
 *
 * opts: { derelict, working, now }
 *   working - a craft is actually running right now; drives every animation and the warm windows
 *   now     - ms timestamp from the frame loop; the ONLY time source here, so this function has
 *             no hidden clock and renders identically for a given `now`
 */
export function drawBuilding(ctx, x, y, size, buildingType, opts = {}) {
  const derelict = !!opts.derelict;
  const working = !derelict && !!opts.working;
  const night = !derelict && (opts.night || 0) > 0.3;   // windows lit after dusk (day/night cycle)
  const T = 104 * size;
  const fw = opts.fw || 1, fh = opts.fh || 1;
  const cfg = BUILDING_CONFIG[buildingType] || FALLBACK_CFG;
  const extras = cfg.extras || [];
  const roofColor = derelict ? PALETTE.derelictRoof : cfg.roof;
  const wallColor = derelict ? PALETTE.derelictWall : PALETTE.wall;

  // Per-building phase offset so a row of identical bakeries does not puff in lockstep.
  const t = (opts.now ?? 0) / 1000 + strHash(buildingType) * 6.283;

  const BW = T * 0.86, BH = T * 0.52;
  // While working the shell breathes very slightly. Small enough to read as life, not as a bug.
  const bob = working ? Math.sin(t * 2.2) * T * 0.008 : 0;
  const yy = y - T * 0.08 + bob;

  // The plot it stands on, when the renderer told us the footprint (the contact-sheet tool
  // draws bare buildings). Then the cast shadow, longer for the taller forms.
  if (fw > 1 || fh > 1) drawSlab(ctx, x, y, fw, fh, T / Math.max(fw, fh), derelict);
  groundShadow(ctx, x, y - T * 0.08 + BH * 0.7, BW * 0.6, BH * 0.2, T, cfg.form === 'tower' ? 0.9 : 0.4);

  // Behind the shell.
  drawExtras(ctx, x, yy, BW, BH, T,
    extras.filter((e) => e === 'silo' || e === 'pipes'), cfg, derelict, size, t, working);

  applyDerelictFilter(ctx, derelict);
  // The wall: shaded on the left (away from the light), lit on the right, with a band of
  // ambient occlusion where it meets the ground.
  const wallX = x - BW / 2, wallY = yy - BH * 0.16;
  ctx.beginPath(); ctx.roundRect(wallX, wallY, BW, BH, T * 0.06);
  fillUnit(ctx, `wall:${wallColor}`, 'h',
    [[0, shade(wallColor, 0.17)], [0.32, wallColor], [0.82, lighten(wallColor, 0.07)], [1, shade(wallColor, 0.06)]],
    wallX, wallY, BW, BH, wallColor);
  outline(ctx, T);
  ctx.beginPath(); ctx.roundRect(wallX, wallY + BH * 0.7, BW, BH * 0.3, T * 0.03);
  fillUnit(ctx, 'ao', 'v', [[0, 'rgba(58,37,16,0)'], [1, 'rgba(58,37,16,0.3)']], wallX, wallY + BH * 0.7, BW, BH * 0.3, 'rgba(58,37,16,0.1)');
  // The eave's shadow across the top of the wall, under the roof.
  ctx.fillStyle = 'rgba(58,37,16,0.16)';
  ctx.fillRect(wallX + T * 0.02, yy - BH * 0.12, BW - T * 0.04, BH * 0.1);

  ctx.save();
  if (derelict) { ctx.translate(x, yy); ctx.rotate(-0.06); ctx.translate(-x, -yy); }
  drawRoofForm(ctx, x, yy, BW, BH, T, cfg.form || 'gable', roofColor, derelict, size);
  ctx.restore();
  clearFilter(ctx);

  if (!derelict) rimLight(ctx, T, [x - BW * 0.66, yy - BH * 1.34, BW * 1.32, BH * 2.2]);

  drawExtras(ctx, x, yy, BW, BH, T,
    extras.filter((e) => e === 'chimney'), cfg, derelict, size, t, working);

  // Windows: glass with a sky reflection when idle, warm and gently pulsing when a craft is
  // running, lamplit after dusk.
  applyDerelictFilter(ctx, derelict);
  if (!derelict) {
    const glow = working ? 0.55 + 0.25 * Math.sin(t * 2.6) : 0;
    const wx = x - BW * 0.30, wy = yy + BH * 0.02, ww = BW * 0.18, wh = BH * 0.24;
    ctx.beginPath();
    ctx.roundRect(wx, wy, ww, wh, T * 0.02);
    if (working) {
      ctx.fillStyle = 'rgb(' + Math.round(127 + 128 * glow) + ',' + Math.round(212 + 18 * glow) + ',' + Math.round(240 - 100 * glow) + ')';
      ctx.fill();
    } else if (night) {
      fillUnit(ctx, 'glass:night', 'v', [[0, '#ffe7a8'], [1, '#f0b040']], wx, wy, ww, wh, '#f7cf6a');
    } else {
      fillUnit(ctx, 'glass', 'v', [[0, '#cdeffb'], [0.5, PALETTE.window], [1, '#4aa6cc']], wx, wy, ww, wh, PALETTE.window);
    }
    outline(ctx, T, 0.4);
    // A reflection streak across the pane, and the sill beneath it.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, T * 0.014);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(wx + ww * 0.22, wy + wh * 0.82); ctx.lineTo(wx + ww * 0.6, wy + wh * 0.18); ctx.stroke();
    ctx.fillStyle = shade(wallColor, 0.22);
    ctx.fillRect(wx - T * 0.012, wy + wh, ww + T * 0.024, Math.max(1, T * 0.018));
    if (working || night) {
      ctx.fillStyle = 'rgba(255,214,120,' + (working ? 0.20 * glow : 0.12).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x - BW * 0.21, yy + BH * 0.14, T * 0.11, 0, Math.PI * 2); ctx.fill();
    }
  }
  // A derelict building omits its window entirely (SPRITE-NOTES §6), so there is deliberately
  // no else-branch here - only the door is drawn.
  const dx = x + BW * 0.06, dy = yy + BH * 0.06, dw = BW * 0.22, dh = BH * 0.42;
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, T * 0.02);
  fillUnit(ctx, `door:${derelictColor(PALETTE.wood)}`, 'h', [[0, shade(derelictColor(PALETTE.wood), 0.2)], [1, derelictColor(PALETTE.wood)]], dx, dy, dw, dh, derelictColor(PALETTE.wood));
  outline(ctx, T, 0.4);
  // Plank lines, a knob and a doorstep.
  ctx.strokeStyle = 'rgba(58,37,16,0.35)';
  ctx.lineWidth = Math.max(1, T * 0.01);
  ctx.beginPath(); ctx.moveTo(dx + dw * 0.5, dy + T * 0.01); ctx.lineTo(dx + dw * 0.5, dy + dh - T * 0.01); ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath(); ctx.arc(dx + dw * 0.68, dy + dh * 0.55, Math.max(1, T * 0.012), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(wallColor, 0.3);
  ctx.fillRect(dx - T * 0.02, dy + dh, dw + T * 0.04, Math.max(1, T * 0.022));
  clearFilter(ctx);

  // Signboard: a small painted plaque, only where the config asks for one.
  if (cfg.sign && !derelict) {
    ctx.fillStyle = cfg.sign;
    ctx.beginPath();
    ctx.roundRect(x - BW * 0.16, yy - BH * 0.16, BW * 0.30, T * 0.055, T * 0.014);
    ctx.fill();
    outline(ctx, T, 0.45);
  }

  // In front of the shell.
  drawExtras(ctx, x, yy, BW, BH, T,
    extras.filter((e) => e !== 'silo' && e !== 'pipes' && e !== 'chimney'),
    cfg, derelict, size, t, working);

  if (!derelict) drawAccent(ctx, x, yy, BW, BH, T, cfg.accent, cfg, size, t, working);

  if (derelict) derelictDebris(ctx, x, yy + BH * 0.3, T);
}

// ---------------------------------------------------------------------------------------
// Structures — placed, clickable landmark objects (SPRITE-NOTES §5). Each accepts a
// { derelict } option per §6; only order_board/truck_bay/market_stall/small props are
// never actually lockable so `derelict` is accepted but usually unused for them.
// ---------------------------------------------------------------------------------------

function structureBase(ctx, x, y, w, h, T, derelict) {
  groundShadow(ctx, x, y + h * 0.66, w * 0.62, h * 0.2, T, 0.5);
}

/** The slab under a structure whose footprint the renderer passed (fw/fh), before its sprite. */
function structureSlab(ctx, x, y, size, opts) {
  const fw = opts.fw || 1, fh = opts.fh || 1;
  if (fw <= 1 && fh <= 1) return;
  drawSlab(ctx, x, y, fw, fh, (104 * size) / Math.max(fw, fh), !!opts.derelict);
}

/** A wall box shaded away from the light, with its ground band. Leaves the path for outline(). */
function shadedWall(ctx, wx, wy, ww, wh, radius, color) {
  ctx.beginPath(); ctx.roundRect(wx, wy, ww, wh, radius);
  fillUnit(ctx, `wall:${color}`, 'h',
    [[0, shade(color, 0.17)], [0.32, color], [0.82, lighten(color, 0.07)], [1, shade(color, 0.06)]],
    wx, wy, ww, wh, color);
  ctx.beginPath(); ctx.roundRect(wx, wy + wh * 0.7, ww, wh * 0.3, radius * 0.5);
  fillUnit(ctx, 'ao', 'v', [[0, 'rgba(58,37,16,0)'], [1, 'rgba(58,37,16,0.3)']], wx, wy + wh * 0.7, ww, wh * 0.3, 'rgba(58,37,16,0.1)');
  ctx.beginPath(); ctx.roundRect(wx, wy, ww, wh, radius);
}

export function drawBarn(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, BW = T * 1.7, BH = T * 1.0, yy = y - T * 0.08;
  structureSlab(ctx, x, y, size, opts);
  structureBase(ctx, x, yy, BW, BH, T, derelict);
  applyDerelictFilter(ctx, derelict);
  const roofColor = derelict ? PALETTE.derelictRoof : PALETTE.roof;
  const roofDark = derelict ? '#6f6552' : PALETTE.roofDark;
  ctx.fillStyle = linearGradient(ctx, x - BW / 2, 0, x + BW / 2, 0, [[0, roofColor], [1, roofDark]], roofColor);
  ctx.beginPath(); ctx.roundRect(x - BW / 2, yy - BH * 0.3, BW, BH, T * 0.06); ctx.fill();
  ctx.strokeStyle = PALETTE.trimLight; ctx.lineWidth = T * 0.06; ctx.stroke();
  outline(ctx, T);
  const roofTop = derelict ? '#5a5244' : PALETTE.roofTop;
  ctx.fillStyle = roofTop;
  ctx.save();
  if (derelict) { ctx.translate(x, yy - BH * 0.55); ctx.rotate(-0.05); ctx.translate(-x, -(yy - BH * 0.55)); }
  ctx.beginPath();
  ctx.moveTo(x - BW * 0.6, yy - BH * 0.27); ctx.lineTo(x - BW * 0.33, yy - BH * (derelict ? 0.7 : 0.84));
  ctx.lineTo(x, yy - BH * 1.0); ctx.lineTo(x + BW * 0.33, yy - BH * 0.84);
  ctx.lineTo(x + BW * 0.6, yy - BH * 0.27); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PALETTE.trimLight; ctx.lineWidth = T * 0.05; ctx.stroke();
  outline(ctx, T);
  ctx.restore();
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T, [x - BW * 0.6, yy - BH * 1.0, BW * 1.2, BH * 1.7]);
  // Ambient occlusion where the barn meets its plot.
  ctx.beginPath(); ctx.roundRect(x - BW / 2, yy + BH * 0.42, BW, BH * 0.28, T * 0.03);
  fillUnit(ctx, 'ao', 'v', [[0, 'rgba(58,37,16,0)'], [1, 'rgba(58,37,16,0.3)']], x - BW / 2, yy + BH * 0.42, BW, BH * 0.28, 'rgba(58,37,16,0.1)');
  ctx.fillStyle = PALETTE.trimLight;
  ctx.beginPath(); ctx.arc(x, yy - BH * 0.6, T * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.woodDark;
  ctx.beginPath(); ctx.arc(x, yy - BH * 0.6, T * 0.095, 0, Math.PI * 2); ctx.fill();
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = PALETTE.trimLight;
  ctx.beginPath(); ctx.roundRect(x - T * 0.29, yy + BH * 0.1, T * 0.58, BH * 0.56, T * 0.04); ctx.fill();
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath(); ctx.roundRect(x - T * 0.24, yy + BH * 0.14, T * 0.21, BH * 0.48, T * 0.03); ctx.fill();
  if (!derelict) { ctx.beginPath(); ctx.roundRect(x + T * 0.03, yy + BH * 0.14, T * 0.21, BH * 0.48, T * 0.03); ctx.fill(); }
  outline(ctx, T, 0.8);
  clearFilter(ctx);
  if (derelict) derelictDebris(ctx, x, yy + BH * 0.55, T);
}

export function drawSilo(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, SW = T * 0.5, SH = T * 1.4, yy = y - T * 0.08;
  structureSlab(ctx, x, y, size, opts);
  groundShadow(ctx, x, yy + 6 * (T / 104), SW * 0.72, T * 0.13, T, 1.2);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = linearGradient(ctx, x - SW / 2, 0, x + SW / 2, 0, [
    [0, derelict ? PALETTE.derelictWall : PALETTE.siloLight],
    [0.5, derelict ? '#a89878' : PALETTE.silo],
    [1, derelict ? '#8a7f68' : PALETTE.siloDark],
  ], derelict ? '#a89878' : PALETTE.silo);
  ctx.fillRect(x - SW / 2, yy - SH, SW, SH);
  ctx.strokeStyle = 'rgba(58,37,16,0.26)'; ctx.lineWidth = Math.max(1, T * 0.02);
  for (let i = 1; i < 7; i++) {
    const py = yy - SH + (SH / 7) * i;
    ctx.beginPath(); ctx.moveTo(x - SW / 2, py); ctx.lineTo(x + SW / 2, py); ctx.stroke();
  }
  ctx.beginPath(); ctx.rect(x - SW / 2, yy - SH, SW, SH); outline(ctx, T, 0.8);
  ctx.fillStyle = derelict ? PALETTE.derelictRoof : PALETTE.roofTop;
  ctx.beginPath();
  ctx.moveTo(x - SW * 0.62, yy - SH); ctx.quadraticCurveTo(x, yy - SH - T * 0.5, x + SW * 0.62, yy - SH);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.7);
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T, [x - SW * 0.62, yy - SH - T * 0.5, SW * 1.24, SH + T * 0.5]);
  if (derelict) derelictDebris(ctx, x, yy + SH * 0.02, T);
}

export function drawOrderBoard(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.06;
  groundShadow(ctx, x, yy + T * 0.36, T * 0.34, T * 0.1, T);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(x - T * 0.03, yy - T * 0.05, T * 0.06, T * 0.42);
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath(); ctx.roundRect(x - T * 0.3, yy - T * 0.4, T * 0.6, T * 0.4, T * 0.04); ctx.fill();
  outline(ctx, T, 0.7);
  ctx.fillStyle = PALETTE.trimLight;
  ctx.beginPath(); ctx.roundRect(x - T * 0.24, yy - T * 0.34, T * 0.48, T * 0.28, T * 0.03); ctx.fill();
  ctx.strokeStyle = 'rgba(58,37,16,0.3)'; ctx.lineWidth = Math.max(1, T * 0.02);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(x - T * 0.2, yy - T * 0.28 + i * T * 0.08); ctx.lineTo(x + T * 0.2, yy - T * 0.28 + i * T * 0.08); ctx.stroke();
  }
}

export function drawTruckBay(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.06;
  groundShadow(ctx, x, yy + T * 0.24, T * 0.5, T * 0.13, T);
  ctx.fillStyle = PALETTE.road;
  ctx.beginPath(); ctx.roundRect(x - T * 0.44, yy + T * 0.02, T * 0.88, T * 0.16, T * 0.02); ctx.fill();
  ctx.fillStyle = '#4a8fd4';
  ctx.beginPath(); ctx.roundRect(x - T * 0.3, yy - T * 0.24, T * 0.4, T * 0.28, T * 0.04); ctx.fill();
  outline(ctx, T, 0.7);
  ctx.fillStyle = PALETTE.trimLight;
  ctx.beginPath(); ctx.roundRect(x - T * 0.08, yy - T * 0.16, T * 0.16, T * 0.2, T * 0.04); ctx.fill();
  outline(ctx, T, 0.5);
  ctx.fillStyle = '#3a3a3a';
  for (const dx of [-0.24, 0.16]) { ctx.beginPath(); ctx.arc(x + dx * T, yy + T * 0.16, T * 0.06, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.4); }
}

export function drawShopStand(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.06;
  groundShadow(ctx, x, yy + T * 0.38, T * 0.5, T * 0.15, T);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath(); ctx.roundRect(x - T * 0.4, yy - T * 0.1, T * 0.8, T * 0.42, T * 0.04); ctx.fill();
  outline(ctx, T, 0.7);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? PALETTE.trimLight : (derelict ? PALETTE.derelictRoof : PALETTE.roof);
    ctx.beginPath();
    ctx.moveTo(x - T * 0.45 + i * T * 0.155, yy - T * 0.34);
    ctx.lineTo(x - T * 0.3 + i * T * 0.155, yy - T * 0.34);
    ctx.lineTo(x - T * 0.3 + i * T * 0.155, yy - T * 0.17);
    ctx.lineTo(x - T * 0.375 + i * T * 0.155, yy - T * 0.1);
    ctx.lineTo(x - T * 0.45 + i * T * 0.155, yy - T * 0.17);
    ctx.closePath(); ctx.fill(); outline(ctx, T, 0.4);
  }
  ctx.fillStyle = PALETTE.woodDark;
  ctx.beginPath(); ctx.roundRect(x - T * 0.26, yy - T * 0.05, T * 0.23, T * 0.18, T * 0.02); ctx.fill();
  outline(ctx, T, 0.4);
  clearFilter(ctx);
  if (derelict) derelictDebris(ctx, x, yy + T * 0.3, T);
}

export function drawBoatDock(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.02;
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath(); ctx.roundRect(x - T * 0.5, yy - T * 0.06, T, T * 0.16, T * 0.02); ctx.fill();
  outline(ctx, T, 0.7);
  ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = Math.max(1, T * 0.03);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(x - T * 0.44 + i * T * 0.22, yy - T * 0.06); ctx.lineTo(x - T * 0.44 + i * T * 0.22, yy + T * 0.1); ctx.stroke();
  }
  ctx.fillStyle = PALETTE.waterLight;
  ctx.beginPath(); ctx.ellipse(x + T * 0.1, yy + T * 0.16, T * 0.24, T * 0.08, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawPond(ctx, x, y, size, opts = {}) {
  const T = 104 * size, rx = T * 1.4, ry = T * 0.6, yy = y, k = T / 104;
  const t = (opts.now || 0) / 1000;
  // A sandy bank, then the deep edge, then the surface: shallow and pale at the far side, deep
  // and blue toward the front.
  ctx.beginPath(); ctx.ellipse(x, yy + T * 0.03, rx * 1.06, ry * 1.1, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#c9b27a'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, yy, rx, ry, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#2f6f96'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, yy - 4 * k, rx * 0.97, ry * 0.93, -0.08, 0, Math.PI * 2);
  fillUnit(ctx, 'water', 'v', [[0, '#b9ecfb'], [0.4, PALETTE.waterLight], [1, '#2a8cc0']], x - rx, yy - ry, 2 * rx, 2 * ry, PALETTE.water);
  outline(ctx, T);
  drawWaterSurface(ctx, x, yy, rx * 0.97, ry * 0.93, T, t);
}
export const drawLake = drawPond;

export function drawMineEntrance(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.06;
  structureSlab(ctx, x, y, size, opts);
  groundShadow(ctx, x, yy + T * 0.32, T * 0.5, T * 0.14, T);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath();
  ctx.moveTo(x - T * 0.4, yy + T * 0.3); ctx.lineTo(x - T * 0.32, yy - T * 0.32);
  ctx.lineTo(x - T * 0.14, yy - T * 0.42); ctx.lineTo(x + T * 0.14, yy - T * 0.42);
  ctx.lineTo(x + T * 0.32, yy - T * 0.32); ctx.lineTo(x + T * 0.4, yy + T * 0.3);
  ctx.closePath(); ctx.fill(); outline(ctx, T);
  ctx.fillStyle = '#100b06';
  ctx.beginPath(); ctx.ellipse(x, yy + T * 0.08, T * 0.2, T * 0.3, 0, 0, Math.PI); ctx.fill();
  outline(ctx, T, 0.55);
  ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = Math.max(1, T * 0.03);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(x - T * 0.36 + i * T * 0.02, yy + T * 0.3); ctx.lineTo(x + T * 0.36 - i * T * 0.02, yy + T * 0.3); ctx.stroke();
  }
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T);
  if (derelict) derelictDebris(ctx, x, yy + T * 0.3, T);
}

export function drawMergePlot(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.02;
  const w = T * 0.9, h = T * 0.45;
  groundShadow(ctx, x, yy + h * 0.5, w * 0.5, h * 0.24, T);
  ctx.fillStyle = PALETTE.grassLight;
  ctx.beginPath();
  ctx.moveTo(x, yy - h * 0.3); ctx.lineTo(x + w * 0.5, yy);
  ctx.lineTo(x, yy + h * 0.3); ctx.lineTo(x - w * 0.5, yy);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.7);
  ctx.strokeStyle = PALETTE.wood; ctx.lineWidth = Math.max(1.5, T * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, yy - h * 0.3); ctx.lineTo(x + w * 0.5, yy);
  ctx.lineTo(x, yy + h * 0.3); ctx.lineTo(x - w * 0.5, yy);
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle = PALETTE.flowerPink;
  for (const [dx, dy] of [[0, -0.06], [-0.08, 0.02], [0.09, 0.03]]) {
    ctx.beginPath(); ctx.arc(x + dx * T, yy + dy * T, T * 0.045, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath(); ctx.roundRect(x - T * 0.05, yy - h * 0.28, T * 0.1, T * 0.05, 2); ctx.fill();
}

export function drawMarketStall(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.06;
  groundShadow(ctx, x, yy + T * 0.34, T * 0.48, T * 0.14, T);
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath(); ctx.roundRect(x - T * 0.38, yy - T * 0.06, T * 0.76, T * 0.36, T * 0.03); ctx.fill();
  outline(ctx, T, 0.7);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.moveTo(x - T * 0.42, yy - T * 0.32); ctx.lineTo(x + T * 0.42, yy - T * 0.32);
  ctx.lineTo(x + T * 0.3, yy - T * 0.08); ctx.lineTo(x - T * 0.3, yy - T * 0.08);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.7);
  ctx.fillStyle = PALETTE.fruitRed || '#e8574a';
  for (const dx of [-0.14, 0, 0.14]) { ctx.beginPath(); ctx.arc(x + dx * T, yy + T * 0.06, T * 0.05, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.3); }
}

export function drawTrainStation(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.08;
  structureSlab(ctx, x, y, size, opts);
  const w = T * 1.6, h = T * 0.4;
  groundShadow(ctx, x, yy + h * 0.7, w * 0.55, h * 0.3, T);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = PALETTE.roadEdge;
  ctx.beginPath(); ctx.roundRect(x - w / 2, yy + h * 0.1, w, h * 0.3, T * 0.02); ctx.fill();
  outline(ctx, T, 0.6);
  ctx.strokeStyle = derelict ? PALETTE.derelictRoof : PALETTE.roofAlt; ctx.lineWidth = T * 0.05;
  ctx.beginPath(); ctx.moveTo(x - w * 0.46, yy - h * 0.6); ctx.lineTo(x + w * 0.46, yy - h * 0.6); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const px = x - w * 0.4 + i * w * 0.2;
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(px - T * 0.03, yy - h * 0.6, T * 0.06, h * 0.7);
    outline(ctx, T, 0.3);
  }
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T);
  if (derelict) derelictDebris(ctx, x, yy + h * 0.4, T);
}

export function drawAirport(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.08;
  structureSlab(ctx, x, y, size, opts);
  const w = T * 1.8, h = T * 0.62;
  groundShadow(ctx, x, yy + h * 0.6, w * 0.55, h * 0.25, T);
  applyDerelictFilter(ctx, derelict);
  shadedWall(ctx, x - w / 2, yy - h * 0.1, w, h * 0.6, T * 0.06, derelict ? PALETTE.derelictWall : PALETTE.wall);
  outline(ctx, T);
  ctx.fillStyle = derelict ? PALETTE.derelictRoof : PALETTE.roofAlt;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.54, yy - h * 0.08); ctx.lineTo(x - w * 0.2, yy - h * 0.6);
  ctx.lineTo(x + w * 0.2, yy - h * 0.6); ctx.lineTo(x + w * 0.54, yy - h * 0.08);
  ctx.closePath(); ctx.fill(); outline(ctx, T);
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T);
  ctx.fillStyle = PALETTE.window;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.roundRect(x - w * 0.36 + i * w * 0.2, yy + h * 0.02, w * 0.12, h * 0.2, T * 0.02); ctx.fill();
    outline(ctx, T, 0.35);
  }
  if (derelict) derelictDebris(ctx, x, yy + h * 0.5, T);
}

export function drawHelipad(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.03;
  const rx = T * 0.5, ry = T * 0.24;
  groundShadow(ctx, x, yy + ry * 0.3, rx * 0.9, ry * 0.5, T);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = derelict ? '#5a5a5a' : '#3a3a3a';
  ctx.beginPath(); ctx.ellipse(x, yy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.8);
  ctx.strokeStyle = PALETTE.trimLight; ctx.lineWidth = T * 0.03;
  ctx.beginPath(); ctx.ellipse(x, yy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = PALETTE.trimLight;
  ctx.beginPath(); ctx.roundRect(x - T * 0.02, yy - ry * 0.5, T * 0.04, ry, T * 0.01); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x - rx * 0.4, yy - T * 0.02, rx * 0.8, T * 0.04, T * 0.01); ctx.fill();
  for (const [dx, dy] of [[-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6]]) {
    ctx.fillStyle = derelict ? '#8a7f68' : PALETTE.gold;
    ctx.beginPath(); ctx.arc(x + dx * rx * 0.85, yy + dy * ry * 0.85, T * 0.02, 0, Math.PI * 2); ctx.fill();
  }
  clearFilter(ctx);
}

export function drawWorkshopYard(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.08;
  structureSlab(ctx, x, y, size, opts);
  const w = T * 1.1, h = T * 0.4;
  groundShadow(ctx, x, yy + h * 0.7, w * 0.6, h * 0.24, T);
  applyDerelictFilter(ctx, derelict);
  shadedWall(ctx, x - w / 2, yy - h * 0.1, w, h * 0.6, T * 0.05, derelict ? PALETTE.derelictWall : PALETTE.wall);
  outline(ctx, T);
  ctx.fillStyle = derelict ? PALETTE.derelictRoof : PALETTE.roofDark;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.56, yy - h * 0.08); ctx.lineTo(x - w * 0.3, yy - h * 0.4);
  ctx.lineTo(x + w * 0.3, yy - h * 0.4); ctx.lineTo(x + w * 0.56, yy - h * 0.08);
  ctx.closePath(); ctx.fill(); outline(ctx, T);
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T);
  ctx.save();
  ctx.strokeStyle = derelict ? '#6a6a6a' : PALETTE.woodDark;
  ctx.lineWidth = T * 0.02; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - T * 0.05, yy - h * 0.02); ctx.lineTo(x + T * 0.05, yy - h * 0.14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - T * 0.02, yy - h * 0.02); ctx.lineTo(x - T * 0.09, yy - h * 0.13);
  ctx.stroke();
  ctx.restore();
  if (derelict) derelictDebris(ctx, x, yy + h * 0.45, T);
}

export function drawMuseumHall(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.08;
  structureSlab(ctx, x, y, size, opts);
  const w = T * 1.3, h = T * 0.5;
  groundShadow(ctx, x, yy + h * 0.7, w * 0.6, h * 0.22, T);
  applyDerelictFilter(ctx, derelict);
  const wall = derelict ? PALETTE.derelictWall : PALETTE.cream;
  shadedWall(ctx, x - w / 2, yy - h * 0.06, w, h * 0.6, T * 0.03, wall);
  outline(ctx, T);
  ctx.fillStyle = derelict ? PALETTE.derelictRoof : '#e0d6ba';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.56, yy - h * 0.06); ctx.lineTo(x, yy - h * 0.5);
  ctx.lineTo(x + w * 0.56, yy - h * 0.06); ctx.closePath(); ctx.fill(); outline(ctx, T);
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = wall;
    ctx.beginPath(); ctx.roundRect(x - w * 0.38 + i * w * 0.25, yy + h * 0.02, w * 0.08, h * 0.5, T * 0.01); ctx.fill();
    outline(ctx, T, 0.35);
  }
  if (derelict) derelictDebris(ctx, x, yy + h * 0.5, T);
}

export function drawLaboratory(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.06;
  structureSlab(ctx, x, y, size, opts);
  const w = T * 0.7, h = T * 0.42;
  groundShadow(ctx, x, yy + h * 0.6, w * 0.6, h * 0.24, T);
  applyDerelictFilter(ctx, derelict);
  shadedWall(ctx, x - w / 2, yy - h * 0.1, w, h * 0.6, T * 0.04, derelict ? PALETTE.derelictWall : PALETTE.wall);
  outline(ctx, T);
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T, [x - w / 2, yy - h * 0.1, w, h * 0.7]);
  // flask silhouette
  ctx.fillStyle = derelict ? '#5a6a5a' : '#7fd4c0';
  ctx.beginPath();
  ctx.moveTo(x - T * 0.05, yy - h * 0.4); ctx.lineTo(x - T * 0.05, yy - h * 0.1);
  ctx.lineTo(x - T * 0.14, yy + h * 0.14); ctx.quadraticCurveTo(x, yy + h * 0.24, x + T * 0.14, yy + h * 0.14);
  ctx.lineTo(x + T * 0.05, yy - h * 0.1); ctx.lineTo(x + T * 0.05, yy - h * 0.4);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.6);
  ctx.fillStyle = derelict ? '#3a4a3a' : 'rgba(120,220,200,0.55)';
  ctx.beginPath(); ctx.ellipse(x, yy + h * 0.1, T * 0.1, T * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  if (derelict) derelictDebris(ctx, x, yy + h * 0.4, T);
}

export function drawExpeditionCamp(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.02;
  structureSlab(ctx, x, y, size, opts);
  groundShadow(ctx, x, yy + T * 0.3, T * 0.5, T * 0.15, T);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = derelict ? '#8a7f68' : '#c9382e';
  ctx.beginPath();
  ctx.moveTo(x - T * 0.28, yy + T * 0.26); ctx.lineTo(x, yy - T * 0.32);
  ctx.lineTo(x + T * 0.28, yy + T * 0.26); ctx.closePath(); ctx.fill();
  outline(ctx, T);
  ctx.fillStyle = derelict ? '#5a5044' : '#8a1a1a';
  ctx.beginPath();
  ctx.moveTo(x - T * 0.06, yy + T * 0.26); ctx.lineTo(x, yy - T * 0.04); ctx.lineTo(x + T * 0.06, yy + T * 0.26);
  ctx.closePath(); ctx.fill();
  clearFilter(ctx);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.beginPath(); ctx.roundRect(x + T * 0.3, yy + T * 0.14, T * 0.16, T * 0.12, 2); ctx.fill(); outline(ctx, T, 0.4);
  if (!derelict) {
    ctx.fillStyle = '#f0862e';
    ctx.beginPath(); ctx.arc(x - T * 0.32, yy + T * 0.24, T * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,180,80,0.6)';
    ctx.beginPath(); ctx.arc(x - T * 0.32, yy + T * 0.16, T * 0.03, 0, Math.PI * 2); ctx.fill();
  }
  if (derelict) derelictDebris(ctx, x, yy + T * 0.28, T);
}

export function drawTownGate(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.08;
  groundShadow(ctx, x, yy + T * 0.4, T * 0.5, T * 0.14, T);
  ctx.fillStyle = PALETTE.wood;
  for (const dx of [-0.32, 0.32]) {
    ctx.beginPath(); ctx.roundRect(x + dx * T - T * 0.05, yy - T * 0.5, T * 0.1, T * 0.7, T * 0.02); ctx.fill();
    outline(ctx, T, 0.6);
  }
  ctx.fillStyle = PALETTE.roofAlt;
  ctx.beginPath();
  ctx.moveTo(x - T * 0.4, yy - T * 0.42); ctx.lineTo(x, yy - T * 0.68); ctx.lineTo(x + T * 0.4, yy - T * 0.42);
  ctx.lineTo(x + T * 0.32, yy - T * 0.4); ctx.lineTo(x, yy - T * 0.58); ctx.lineTo(x - T * 0.32, yy - T * 0.4);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.6);
}

export function drawZooGate(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.08;
  groundShadow(ctx, x, yy + T * 0.4, T * 0.5, T * 0.14, T);
  ctx.fillStyle = '#4a8fd4';
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath(); ctx.roundRect(x + dx * T - T * 0.045, yy - T * 0.46, T * 0.09, T * 0.66, T * 0.02); ctx.fill();
    outline(ctx, T, 0.6);
  }
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.moveTo(x - T * 0.36, yy - T * 0.38); ctx.lineTo(x, yy - T * 0.6); ctx.lineTo(x + T * 0.36, yy - T * 0.38);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.6);
  ctx.save();
  ctx.fillStyle = PALETTE.outline;
  ctx.font = `${Math.round(T * 0.16)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ZOO', x, yy - T * 0.42);
  ctx.restore();
}

export function drawMailbox(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.02;
  groundShadow(ctx, x, yy + T * 0.12, T * 0.14, T * 0.05, T);
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(x - T * 0.015, yy - T * 0.02, T * 0.03, T * 0.16);
  ctx.fillStyle = '#4a8fd4';
  ctx.beginPath(); ctx.roundRect(x - T * 0.08, yy - T * 0.16, T * 0.16, T * 0.1, T * 0.03); ctx.fill();
  ctx.beginPath(); ctx.arc(x, yy - T * 0.11, T * 0.08, Math.PI, 0); ctx.fill();
  outline(ctx, T, 0.4);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath(); ctx.roundRect(x + T * 0.06, yy - T * 0.15, T * 0.02, T * 0.05, 1); ctx.fill();
}

export function drawBookshelf(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.04;
  groundShadow(ctx, x, yy + T * 0.2, T * 0.2, T * 0.07, T);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.beginPath(); ctx.roundRect(x - T * 0.16, yy - T * 0.22, T * 0.32, T * 0.42, T * 0.02); ctx.fill();
  outline(ctx, T, 0.5);
  const colors = ['#e05548', '#4a8fd4', '#f0b52e', '#5fae2e', '#9a6fd0'];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x - T * 0.14 + i * T * 0.058, yy - T * 0.18, T * 0.05, T * 0.16);
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = colors[(i + 2) % colors.length];
    ctx.fillRect(x - T * 0.14 + i * T * 0.07, yy + T * 0.02, T * 0.06, T * 0.14);
  }
}

export function drawTripod(ctx, x, y, size, opts = {}) {
  const T = 104 * size, yy = y - T * 0.02;
  groundShadow(ctx, x, yy + T * 0.18, T * 0.18, T * 0.06, T);
  ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = T * 0.02; ctx.lineCap = 'round';
  for (const dx of [-0.1, 0, 0.1]) {
    ctx.beginPath(); ctx.moveTo(x, yy - T * 0.14); ctx.lineTo(x + dx * T, yy + T * 0.18); ctx.stroke();
  }
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath(); ctx.roundRect(x - T * 0.06, yy - T * 0.22, T * 0.12, T * 0.1, T * 0.02); ctx.fill();
  outline(ctx, T, 0.4);
  ctx.fillStyle = PALETTE.window;
  ctx.beginPath(); ctx.arc(x, yy - T * 0.17, T * 0.03, 0, Math.PI * 2); ctx.fill();
}

/** Structure id → draw function, so callers with only the data.js id string can dispatch. */
export const STRUCTURE_DRAW = {
  order_board: drawOrderBoard, truck_bay: drawTruckBay, barn: drawBarn, silo: drawSilo,
  shop_stand: drawShopStand, boat_dock: drawBoatDock, lake: drawLake,
  mine_entrance: drawMineEntrance, merge_plot: drawMergePlot, market_stall: drawMarketStall,
  train_station: drawTrainStation, airport: drawAirport, helipad: drawHelipad,
  workshop_yard: drawWorkshopYard, museum_hall: drawMuseumHall, laboratory: drawLaboratory,
  expedition_camp: drawExpeditionCamp, town_gate: drawTownGate, zoo_gate: drawZooGate,
  mailbox: drawMailbox, bookshelf: drawBookshelf, tripod: drawTripod,
};

/** Generic dispatcher used by renderer.js: drawStructure(ctx, id, x, y, size, {derelict}). */
export function drawStructure(ctx, id, x, y, size, opts = {}) {
  const fn = STRUCTURE_DRAW[id];
  if (fn) fn(ctx, x, y, size, opts);
  else drawPlaceholder(ctx, x, y, size, id);
}

// ---------------------------------------------------------------------------------------
// Foraging nodes — small world pickups, no outlined rim (they read as terrain features).
// ---------------------------------------------------------------------------------------

export function drawWildflowerPatch(ctx, x, y, size = 0.5) {
  const T = 104 * size;
  for (let i = 0; i < 5; i++) {
    const px = x + Math.sin(i * 2.1) * T * 0.5, py = y + ((i % 3) / 3) * T * 0.3;
    ctx.fillStyle = [PALETTE.flowerWhite, PALETTE.flowerYellow, PALETTE.flowerPink][i % 3];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * T * 0.065, py + Math.sin(a) * T * 0.065, T * 0.042, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(px, py, T * 0.035, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawBerryBush(ctx, x, y, size = 0.6) {
  const T = 104 * size;
  groundShadow(ctx, x, y + T * 0.14, T * 0.24, T * 0.07, T);
  ctx.fillStyle = '#4f9c26';
  ctx.beginPath(); ctx.arc(x, y - T * 0.02, T * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a1a2e';
  for (const [dx, dy] of [[-0.06, -0.02], [0.05, -0.06], [0.02, 0.05], [-0.08, 0.04]]) {
    ctx.beginPath(); ctx.arc(x + dx * T, y + dy * T, T * 0.03, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawDriftwoodPile(ctx, x, y, size = 0.5) {
  const T = 104 * size;
  ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = T * 0.06; ctx.lineCap = 'round';
  for (const [a] of [[0.2], [-0.3], [0.5]]) {
    ctx.beginPath();
    ctx.moveTo(x - T * 0.24 * Math.cos(a), y - T * 0.08 * Math.sin(a));
    ctx.lineTo(x + T * 0.24 * Math.cos(a), y + T * 0.08 * Math.sin(a));
    ctx.stroke();
  }
}

export function drawMushroomRing(ctx, x, y, size = 0.5) {
  const T = 104 * size;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * T * 0.22, py = y + Math.sin(a) * T * 0.1;
    ctx.fillStyle = '#e8d8b8';
    ctx.fillRect(px - T * 0.027, py - T * 0.077, T * 0.054, T * 0.115);
    ctx.fillStyle = '#c9382e';
    ctx.beginPath(); ctx.arc(px, py - T * 0.096, T * 0.069, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff8ee';
    for (const dx of [-0.023, 0.023]) { ctx.beginPath(); ctx.arc(px + dx * T, py - T * 0.115, T * 0.0135, 0, Math.PI * 2); ctx.fill(); }
  }
}

export function drawBirdsNest(ctx, x, y, size = 0.5) {
  const T = 104 * size;
  ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = T * 0.03;
  ctx.beginPath(); ctx.ellipse(x, y, T * 0.2, T * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#c9e0f0';
  for (const dx of [-0.06, 0, 0.06]) { ctx.beginPath(); ctx.ellipse(x + dx * T, y - T * 0.02, T * 0.045, T * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
}

export function drawWildHive(ctx, x, y, size = 0.55) {
  const T = 104 * size;
  groundShadow(ctx, x, y + T * 0.16, T * 0.16, T * 0.05, T);
  ctx.fillStyle = '#e8b84a';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y + T * 0.08 - i * T * 0.09, T * (0.16 - i * 0.02), T * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  outline(ctx, T, 0.4);
}

export const FORAGE_DRAW = {
  wildflower_patch: drawWildflowerPatch, berry_bush: drawBerryBush,
  driftwood_pile: drawDriftwoodPile, mushroom_ring: drawMushroomRing,
  birds_nest: drawBirdsNest, wild_hive: drawWildHive,
};

// ---------------------------------------------------------------------------------------
// Decorations, pets, misc overlays
// ---------------------------------------------------------------------------------------

// Every DECORATIONS id has its own sprite, by family: a fence joins its neighbours, a fountain
// throws water on the frame clock, a windmill turns, string lights twinkle, a pond is water.
// Fifty-four ids used to collapse onto five hashed shapes (an oak could render as a lamp).
// (x, y) is the footprint anchor the renderer hands every sprite; the ground contact point is the
// centre of the footprint diamond, half a tile below it.
const DECO = {
  fence_wood: { fam: 'fence', color: PALETTE.wood },
  fence_stone: { fam: 'fence', color: '#a09a8c', stone: true },
  fence_white: { fam: 'fence', color: '#fffaea' },
  bunting_fence: { fam: 'fence', color: PALETTE.wood, bunting: true },
  flowerbed: { fam: 'flowerbed' },
  path_stone: { fam: 'path' },
  tree_oak: { fam: 'tree', kind: 'oak' }, tree_pine: { fam: 'tree', kind: 'pine' },
  cherry_blossom: { fam: 'tree', kind: 'blossom' }, orchard_row: { fam: 'orchard' },
  hay_bale: { fam: 'bale' }, pumpkin_pile: { fam: 'pumpkins' }, harvest_wagon: { fam: 'wagon' },
  scarecrow: { fam: 'scarecrow' }, gnome: { fam: 'gnome' }, snowman: { fam: 'snowman' },
  fountain: { fam: 'fountain', stone: '#c9c0a8' }, crystal_fountain: { fam: 'fountain', stone: '#d8f0f6', crystal: true },
  wishing_well: { fam: 'well' },
  windmill: { fam: 'windmill' }, weather_vane: { fam: 'vane' },
  golden_statue: { fam: 'statue', color: PALETTE.gold, shape: 'cow' },
  golden_town_statue: { fam: 'statue', color: PALETTE.gold, shape: 'figure' },
  trophy_bronze: { fam: 'trophy', color: '#cd7f32' }, trophy_silver: { fam: 'trophy', color: '#d8d8d8' },
  trophy_gold: { fam: 'trophy', color: PALETTE.gold, big: true }, prize_trophy: { fam: 'trophy', color: PALETTE.gold },
  relic_plinth: { fam: 'plinth' },
  lily_pond: { fam: 'pond', lilies: true }, koi_pond: { fam: 'pond', koi: true }, duck_pond_deco: { fam: 'pond', duck: true },
  topiary: { fam: 'topiary' }, hedge_maze: { fam: 'maze' },
  string_lights: { fam: 'lights', color: '#ffd94d' }, lantern_string: { fam: 'lights', color: '#e05548', lantern: true },
  lamp_post: { fam: 'lamp' },
  stone_arch: { fam: 'arch', color: '#b8b0a0' }, marble_arch: { fam: 'arch', color: '#f0ece4' },
  flower_arch: { fam: 'arch', color: '#5fae2e', flowers: true }, stone_bridge: { fam: 'bridge' },
  clock_tower: { fam: 'clock' }, sun_dial: { fam: 'sundial' },
  picnic_set: { fam: 'picnic' }, beach_chair: { fam: 'beach' },
  festival_tent: { fam: 'tent', color: PALETTE.roof }, fair_carousel: { fam: 'carousel' },
  banner_wall: { fam: 'banner' }, balloon_cluster: { fam: 'balloons' },
  ribbon_pole: { fam: 'pole', ribbons: true }, maypole: { fam: 'pole', ribbons: true, may: true },
  coop_flagpole: { fam: 'pole', flag: true }, regatta_buoy: { fam: 'buoy' },
  glass_house: { fam: 'glasshouse' }, fossil_display: { fam: 'fossil' },
};
const DECO_FALLBACK_FAMS = ['flowerbed', 'statue', 'lamp', 'bale', 'fountain'];

function decoConfigFor(decoId) {
  if (DECO[decoId]) return DECO[decoId];
  let h = 0;
  const id = String(decoId || 'flowerbed');
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return { fam: DECO_FALLBACK_FAMS[h % DECO_FALLBACK_FAMS.length] };
}

/** A vertical post: dark wood with a lit face. */
function decoPost(ctx, x, top, w, h, T, color = PALETTE.woodDark) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x - w / 2, top, w, h, w * 0.3); ctx.fill();
  outline(ctx, T, 0.4);
  ctx.fillStyle = 'rgba(255,240,210,0.28)';
  ctx.fillRect(x + w * 0.1, top + w * 0.3, Math.max(1, w * 0.3), Math.max(1, h - w * 0.6));
}

/** A stone or earthen plate on the footprint, for the bigger ornaments. */
function decoPlate(ctx, x, y, fw, fh, tile, color, ring = null) {
  footprintPath(ctx, x, y, fw, fh, tile, tile * 0.05);
  ctx.fillStyle = shade(color, 0.35); ctx.fill();
  footprintPath(ctx, x, y, fw, fh, tile);
  ctx.fillStyle = color; ctx.fill();
  outline(ctx, tile, 0.45);
  if (ring) {
    const c = footprintCorners(x, y, fw, fh, tile);
    ctx.strokeStyle = ring; ctx.lineWidth = Math.max(1, tile * 0.03);
    ctx.beginPath(); ctx.ellipse(c.centre[0], c.centre[1], tile * fw * 0.36, tile * fh * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

const DECO_DRAW = {
  /**
   * Fences join up (Hay Day's continuous runs): rails go from the tile centre toward each
   * same-type neighbour (`opts.joins`, computed by buildWorld). A lone piece is one short run
   * along the tile's east-west axis. Stone is a low dry-stone wall on the same segments.
   */
  fence(ctx, x, by, T, tile, fw, fh, cfg, _t, opts = {}) {
    const y = by - tile / 2;
    const pt = (dx, dy) => [x + (dx - dy) * T, y + (dx + dy) * T / 2];
    const C = pt(0.5, 0.5), N = pt(0.5, 0), E = pt(1, 0.5), S = pt(0.5, 1), W = pt(0, 0.5);
    const j = opts.joins || {};
    const segs = [];
    if (!j.n && !j.e && !j.s && !j.w) segs.push([W, E, 1]);
    else {
      if (j.n && j.s) segs.push([N, S, 1]); else if (j.n) segs.push([N, C, 0.5]); else if (j.s) segs.push([C, S, 0.5]);
      if (j.w && j.e) segs.push([W, E, 1]); else if (j.w) segs.push([W, C, 0.5]); else if (j.e) segs.push([C, E, 0.5]);
    }
    if (cfg.stone) {
      for (const [A, B] of segs) {
        ctx.beginPath();
        ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(B[0], B[1] - T * 0.16); ctx.lineTo(A[0], A[1] - T * 0.16); ctx.closePath();
        ctx.fillStyle = cfg.color; ctx.fill(); outline(ctx, T, 0.45);
        ctx.strokeStyle = 'rgba(58,37,16,0.3)'; ctx.lineWidth = Math.max(1, T * 0.012);
        for (let i = 1; i < 4; i++) {
          const k = i / 4;
          ctx.beginPath(); ctx.moveTo(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k); ctx.lineTo(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k - T * 0.16); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(A[0], A[1] - T * 0.08); ctx.lineTo(B[0], B[1] - T * 0.08); ctx.stroke();
      }
      return;
    }
    for (const [A, B, len] of segs) fenceEdge(ctx, A, B, len, T);
    if (cfg.color === '#fffaea') {
      // Picket: paint the rails white over the wood.
      ctx.save(); ctx.strokeStyle = cfg.color; ctx.lineWidth = T * 0.022; ctx.lineCap = 'round';
      for (const [A, B] of segs) {
        for (const f of [0.82, 0.42]) { ctx.beginPath(); ctx.moveTo(A[0], A[1] - T * 0.2 * f); ctx.lineTo(B[0], B[1] - T * 0.2 * f); ctx.stroke(); }
      }
      ctx.restore();
    }
    if (cfg.bunting) {
      const flags = [PALETTE.roof, PALETTE.gold, '#4a8fd4', PALETTE.flowerPink];
      for (const [A, B, len] of segs) {
        const n = Math.max(2, Math.round(5 * len));
        for (let i = 0; i < n; i++) {
          const k = (i + 0.5) / n;
          const px = A[0] + (B[0] - A[0]) * k, py = A[1] + (B[1] - A[1]) * k - T * 0.2 * 0.82;
          ctx.fillStyle = flags[i % flags.length];
          ctx.beginPath(); ctx.moveTo(px - T * 0.03, py); ctx.lineTo(px + T * 0.03, py); ctx.lineTo(px, py + T * 0.06); ctx.closePath(); ctx.fill();
        }
      }
    }
  },
  flowerbed(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.3, T * 0.1, T);
    ctx.fillStyle = PALETTE.soilDark;
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.04, T * 0.3, T * 0.14, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.4);
    ctx.fillStyle = PALETTE.soil;
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.06, T * 0.26, T * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = i % 3 ? 0.18 : 0.08;
      const px = x + Math.cos(a) * T * r, py = by - T * 0.08 + Math.sin(a) * T * r * 0.42;
      ctx.strokeStyle = '#4f9c26'; ctx.lineWidth = Math.max(1, T * 0.014);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - T * 0.07); ctx.stroke();
      ctx.fillStyle = [PALETTE.flowerPink, PALETTE.flowerYellow, PALETTE.flowerWhite, PALETTE.fruitRed][i % 4];
      ctx.beginPath(); ctx.arc(px, py - T * 0.09, T * 0.042, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.3);
      ctx.fillStyle = 'rgba(255,220,80,0.9)';
      ctx.beginPath(); ctx.arc(px, py - T * 0.09, T * 0.014, 0, Math.PI * 2); ctx.fill();
    }
  },
  path(ctx, x, by, T, tile, fw, fh) {
    footprintPath(ctx, x, by - tile / 2, fw, fh, tile);
    ctx.fillStyle = '#c9b89a'; ctx.fill();
    ctx.strokeStyle = 'rgba(58,37,16,0.35)'; ctx.lineWidth = Math.max(1, T * 0.018); ctx.stroke();
    ctx.fillStyle = 'rgba(58,37,16,0.16)';
    for (let i = 0; i < 6; i++) {
      const u = 0.2 + prand(i, 101) * 0.6, v = 0.2 + prand(i, 102) * 0.6;
      const px = x + (u - v) * tile, py = by - tile / 2 + (u + v) * (tile / 2);
      ctx.beginPath(); ctx.ellipse(px, py, tile * 0.09, tile * 0.05, prand(i, 103), 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,245,225,0.32)';
    for (let i = 0; i < 6; i++) {
      const u = 0.2 + prand(i, 104) * 0.6, v = 0.2 + prand(i, 105) * 0.6;
      const px = x + (u - v) * tile, py = by - tile / 2 + (u + v) * (tile / 2) - tile * 0.015;
      ctx.beginPath(); ctx.ellipse(px, py, tile * 0.08, tile * 0.04, prand(i, 106), 0, Math.PI * 2); ctx.fill();
    }
  },
  tree(ctx, x, by, T, tile, fw, fh, cfg) {
    if (cfg.kind === 'blossom') {
      drawTree(ctx, x, by - T * 0.5, T / 104, { kind: 'oak', variant: 0.5 });
      // Pink over the canopy: the oak's puffs, re-tinted.
      ctx.fillStyle = 'rgba(248,170,200,0.78)';
      const s = 1.0, baseY = by;
      for (const [px, py, r] of [[0, -0.6, 0.26], [-0.22, -0.48, 0.2], [0.23, -0.5, 0.21], [-0.1, -0.78, 0.18], [0.13, -0.8, 0.17]]) {
        ctx.beginPath(); ctx.arc(x + px * T * s, baseY + py * T * s, r * T * s * 0.94, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,235,245,0.7)';
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(x + (prand(i, 111) - 0.5) * T * 0.7, by - T * (0.45 + prand(i, 112) * 0.45), T * 0.025, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    drawTree(ctx, x, by - T * 0.5, T / 104, { kind: cfg.kind, variant: 0.55 });
  },
  orchard(ctx, x, by, T, tile, fw, fh) {
    const n = fw;
    for (let i = 0; i < n; i++) {
      const u = i + 0.5, v = 0.5;
      const px = x + (u - v - (fw - 1) / 2) * tile, py = by - tile / 2 + (u + v - (fw - 1) / 2) * (tile / 2);
      drawTree(ctx, px, py - tile * 0.5, (tile / 104) * 0.9, { kind: 'fruit', variant: 0.3 + i * 0.25 });
    }
  },
  bale(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.3, T * 0.1, T, 0.2);
    ctx.beginPath(); ctx.roundRect(x - T * 0.26, by - T * 0.32, T * 0.52, T * 0.3, T * 0.05);
    fillUnit(ctx, 'bale', 'v', [[0, '#f5d76a'], [1, '#c99a34']], x - T * 0.26, by - T * 0.32, T * 0.52, T * 0.3, PALETTE.wheatGold);
    outline(ctx, T, 0.55);
    ctx.strokeStyle = 'rgba(120,80,20,0.5)'; ctx.lineWidth = Math.max(1, T * 0.014);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - T * 0.24, by - T * 0.3 + i * T * 0.055 + T * 0.03); ctx.lineTo(x + T * 0.24, by - T * 0.3 + i * T * 0.055 + T * 0.015); ctx.stroke(); }
    ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = Math.max(1, T * 0.02);
    for (const dx of [-0.1, 0.1]) { ctx.beginPath(); ctx.moveTo(x + dx * T, by - T * 0.32); ctx.lineTo(x + dx * T, by - T * 0.02); ctx.stroke(); }
  },
  pumpkins(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.32, T * 0.1, T, 0.2);
    const pumpkin = (px, py, r) => {
      ctx.fillStyle = '#f0862e';
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45);
      ctx.strokeStyle = 'rgba(160,70,10,0.45)'; ctx.lineWidth = Math.max(1, T * 0.012);
      for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(px + k * r * 0.6, py, r * 0.35, r * 0.8, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#4f9c26'; ctx.fillRect(px - r * 0.08, py - r * 0.95, r * 0.16, r * 0.25);
    };
    pumpkin(x - T * 0.16, by - T * 0.1, T * 0.13);
    pumpkin(x + T * 0.15, by - T * 0.09, T * 0.11);
    pumpkin(x, by - T * 0.26, T * 0.12);
  },
  wagon(ctx, x, by, T, tile, fw) {
    groundShadow(ctx, x, by, T * 0.4, T * 0.12, T, 0.25);
    ctx.fillStyle = '#3a3a3a';
    for (const dx of [-0.3, 0.26]) { ctx.beginPath(); ctx.arc(x + dx * T, by - T * 0.06, T * 0.09, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45); }
    ctx.beginPath(); ctx.roundRect(x - T * 0.42, by - T * 0.34, T * 0.84, T * 0.24, T * 0.02);
    fillUnit(ctx, 'wagon', 'v', [[0, PALETTE.woodLight], [1, PALETTE.wood]], x - T * 0.42, by - T * 0.34, T * 0.84, T * 0.24, PALETTE.wood);
    outline(ctx, T, 0.55);
    ctx.fillStyle = PALETTE.wheatGold;
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.36, T * 0.34, T * 0.1, 0, Math.PI, 0); ctx.fill(); outline(ctx, T, 0.4);
    ctx.fillStyle = '#f0862e';
    for (const dx of [-0.2, 0, 0.18]) { ctx.beginPath(); ctx.arc(x + dx * T, by - T * 0.4, T * 0.05, 0, Math.PI * 2); ctx.fill(); }
  },
  scarecrow(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.16, T * 0.06, T, 0.6);
    decoPost(ctx, x, by - T * 0.6, T * 0.05, T * 0.6, T);
    ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = T * 0.04; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - T * 0.24, by - T * 0.42); ctx.lineTo(x + T * 0.24, by - T * 0.42); ctx.stroke();
    ctx.fillStyle = '#4a8fd4';
    ctx.beginPath(); ctx.roundRect(x - T * 0.1, by - T * 0.48, T * 0.2, T * 0.26, T * 0.03); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath(); ctx.arc(x, by - T * 0.55, T * 0.085, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = PALETTE.wheatGold;
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.63, T * 0.14, T * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - T * 0.07, by - T * 0.63); ctx.lineTo(x, by - T * 0.72); ctx.lineTo(x + T * 0.07, by - T * 0.63); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.4);
    ctx.fillStyle = PALETTE.outline;
    for (const dx of [-0.03, 0.03]) { ctx.beginPath(); ctx.arc(x + dx * T, by - T * 0.56, Math.max(1, T * 0.012), 0, Math.PI * 2); ctx.fill(); }
  },
  gnome(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.12, T * 0.05, T, 0.3);
    ctx.fillStyle = '#4a8fd4';
    ctx.beginPath(); ctx.roundRect(x - T * 0.07, by - T * 0.2, T * 0.14, T * 0.2, T * 0.03); ctx.fill(); outline(ctx, T, 0.4);
    ctx.fillStyle = '#fffaea';
    ctx.beginPath(); ctx.arc(x, by - T * 0.2, T * 0.06, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#f2b8b0';
    ctx.beginPath(); ctx.arc(x, by - T * 0.23, T * 0.05, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.35);
    ctx.fillStyle = PALETTE.roof;
    ctx.beginPath(); ctx.moveTo(x - T * 0.07, by - T * 0.25); ctx.lineTo(x + T * 0.02, by - T * 0.42); ctx.lineTo(x + T * 0.07, by - T * 0.25); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.4);
  },
  snowman(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.2, T * 0.07, T, 0.4);
    ctx.fillStyle = '#fbfdff';
    for (const [dy, r] of [[-0.14, 0.16], [-0.36, 0.12], [-0.53, 0.09]]) { ctx.beginPath(); ctx.arc(x, by + dy * T, r * T, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45); }
    ctx.fillStyle = 'rgba(160,190,220,0.35)';
    for (const [dy, r] of [[-0.14, 0.16], [-0.36, 0.12]]) { ctx.beginPath(); ctx.arc(x - r * T * 0.3, by + dy * T + r * T * 0.3, r * T * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f0862e';
    ctx.beginPath(); ctx.moveTo(x + T * 0.02, by - T * 0.54); ctx.lineTo(x + T * 0.12, by - T * 0.52); ctx.lineTo(x + T * 0.02, by - T * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.outline;
    for (const [dx, dy] of [[-0.03, -0.56], [0.01, -0.57], [0, -0.38], [0, -0.32], [0, -0.16]]) { ctx.beginPath(); ctx.arc(x + dx * T, by + dy * T, Math.max(1, T * 0.012), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = PALETTE.roof;
    ctx.beginPath(); ctx.roundRect(x - T * 0.1, by - T * 0.46, T * 0.2, T * 0.04, T * 0.01); ctx.fill();
  },
  fountain(ctx, x, by, T, tile, fw, fh, cfg, t) {
    decoPlate(ctx, x, by - tile / 2, fw, fh, tile, cfg.stone);
    const basinRx = T * 0.36, basinRy = T * 0.16;
    ctx.fillStyle = shade(cfg.stone, 0.25);
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.06, basinRx, basinRy, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.5);
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.08, basinRx * 0.86, basinRy * 0.8, 0, 0, Math.PI * 2);
    fillUnit(ctx, cfg.crystal ? 'water:crystal' : 'water', 'v', cfg.crystal ? [[0, '#e8fbff'], [1, '#7fd4f0']] : [[0, '#b9ecfb'], [0.4, PALETTE.waterLight], [1, '#2a8cc0']], x - basinRx, by - T * 0.2, basinRx * 2, basinRy * 1.6, PALETTE.water);
    ctx.fillStyle = cfg.stone;
    ctx.beginPath(); ctx.roundRect(x - T * 0.05, by - T * 0.4, T * 0.1, T * 0.34, T * 0.02); ctx.fill(); outline(ctx, T, 0.45);
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.4, T * 0.14, T * 0.05, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45);
    // The jet and its falling arcs, on the frame clock.
    ctx.strokeStyle = 'rgba(200,240,255,0.85)'; ctx.lineWidth = Math.max(1, T * 0.02); ctx.lineCap = 'round';
    const jet = T * (0.22 + 0.03 * Math.sin(t * 5));
    ctx.beginPath(); ctx.moveTo(x, by - T * 0.4); ctx.lineTo(x, by - T * 0.4 - jet); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + t * 0.8;
      const ex = x + Math.cos(a) * T * 0.2, ey = by - T * 0.12 + Math.sin(a) * T * 0.06;
      ctx.beginPath(); ctx.moveTo(x, by - T * 0.4 - jet); ctx.quadraticCurveTo(x + Math.cos(a) * T * 0.22, by - T * 0.55, ex, ey); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(ex, ey, T * 0.02, 0, Math.PI * 2); ctx.fill();
    }
    if (cfg.crystal) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 5; i++) { const s = 0.5 + 0.5 * Math.sin(t * 3 + i); ctx.beginPath(); ctx.arc(x + (prand(i, 121) - 0.5) * T * 0.5, by - T * (0.2 + prand(i, 122) * 0.4), T * 0.014 * s, 0, Math.PI * 2); ctx.fill(); }
    }
  },
  well(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.24, T * 0.08, T, 0.4);
    ctx.fillStyle = '#a09a8c';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.1, T * 0.22, T * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.rect(x - T * 0.22, by - T * 0.3, T * 0.44, T * 0.2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.3, T * 0.22, T * 0.1, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = '#1f3a4a';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.3, T * 0.15, T * 0.065, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(58,37,16,0.3)'; ctx.lineWidth = Math.max(1, T * 0.012);
    for (const dx of [-0.14, 0, 0.14]) { ctx.beginPath(); ctx.moveTo(x + dx * T, by - T * 0.3); ctx.lineTo(x + dx * T, by - T * 0.12); ctx.stroke(); }
    decoPost(ctx, x - T * 0.18, by - T * 0.66, T * 0.04, T * 0.36, T);
    decoPost(ctx, x + T * 0.18, by - T * 0.66, T * 0.04, T * 0.36, T);
    ctx.fillStyle = PALETTE.roof;
    ctx.beginPath(); ctx.moveTo(x - T * 0.28, by - T * 0.62); ctx.lineTo(x, by - T * 0.8); ctx.lineTo(x + T * 0.28, by - T * 0.62); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(x - T * 0.18, by - T * 0.5, T * 0.36, T * 0.02);
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath(); ctx.roundRect(x - T * 0.05, by - T * 0.48, T * 0.1, T * 0.1, T * 0.01); ctx.fill(); outline(ctx, T, 0.35);
  },
  windmill(ctx, x, by, T, tile, fw, fh, cfg, t) {
    groundShadow(ctx, x, by, T * 0.3, T * 0.1, T, 1.4);
    ctx.beginPath();
    ctx.moveTo(x - T * 0.22, by); ctx.lineTo(x + T * 0.22, by); ctx.lineTo(x + T * 0.12, by - T * 0.7); ctx.lineTo(x - T * 0.12, by - T * 0.7); ctx.closePath();
    fillUnit(ctx, 'wall:windmill', 'h', [[0, shade('#e8dcc0', 0.2)], [0.5, '#e8dcc0'], [1, lighten('#e8dcc0', 0.06)]], x - T * 0.22, by - T * 0.7, T * 0.44, T * 0.7, '#e8dcc0');
    outline(ctx, T, 0.6);
    ctx.fillStyle = PALETTE.roofDark;
    ctx.beginPath(); ctx.moveTo(x - T * 0.16, by - T * 0.7); ctx.lineTo(x, by - T * 0.86); ctx.lineTo(x + T * 0.16, by - T * 0.7); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = PALETTE.woodDark;
    ctx.beginPath(); ctx.roundRect(x - T * 0.05, by - T * 0.22, T * 0.1, T * 0.2, T * 0.02); ctx.fill();
    ctx.fillStyle = PALETTE.window;
    ctx.beginPath(); ctx.arc(x, by - T * 0.5, T * 0.04, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.3);
    ctx.save();
    ctx.translate(x, by - T * 0.66);
    ctx.rotate(t * 0.9);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate((Math.PI / 2) * i);
      ctx.fillStyle = 'rgba(255,250,234,0.85)';
      ctx.beginPath(); ctx.roundRect(-T * 0.03, -T * 0.42, T * 0.08, T * 0.36, T * 0.01); ctx.fill(); outline(ctx, T, 0.4);
      ctx.strokeStyle = 'rgba(58,37,16,0.3)'; ctx.lineWidth = Math.max(1, T * 0.01);
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-T * 0.03, -T * 0.42 + k * T * 0.09); ctx.lineTo(T * 0.05, -T * 0.42 + k * T * 0.09); ctx.stroke(); }
      ctx.restore();
    }
    ctx.fillStyle = PALETTE.woodDark;
    ctx.beginPath(); ctx.arc(0, 0, T * 0.035, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.4);
    ctx.restore();
  },
  vane(ctx, x, by, T, tile, fw, fh, cfg, t) {
    groundShadow(ctx, x, by, T * 0.1, T * 0.04, T, 0.7);
    decoPost(ctx, x, by - T * 0.6, T * 0.03, T * 0.6, T, '#5a5a5a');
    ctx.strokeStyle = '#5a5a5a'; ctx.lineWidth = Math.max(1, T * 0.02); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - T * 0.1, by - T * 0.44); ctx.lineTo(x + T * 0.1, by - T * 0.44); ctx.moveTo(x, by - T * 0.34); ctx.lineTo(x, by - T * 0.54); ctx.stroke();
    ctx.save();
    ctx.translate(x, by - T * 0.62);
    ctx.rotate(Math.sin(t * 0.7) * 0.6);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.moveTo(-T * 0.16, 0); ctx.lineTo(T * 0.02, -T * 0.06); ctx.lineTo(T * 0.16, 0); ctx.lineTo(T * 0.02, T * 0.06); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.4);
    ctx.beginPath(); ctx.ellipse(-T * 0.02, -T * 0.09, T * 0.05, T * 0.04, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.35);
    ctx.restore();
  },
  statue(ctx, x, by, T, tile, fw, fh, cfg) {
    decoPlate(ctx, x, by - tile / 2, fw, fh, tile, '#c9c0a8');
    ctx.fillStyle = '#a09a8c';
    ctx.beginPath(); ctx.roundRect(x - T * 0.2, by - T * 0.2, T * 0.4, T * 0.14, T * 0.02); ctx.fill(); outline(ctx, T, 0.5);
    ctx.beginPath(); ctx.roundRect(x - T * 0.16, by - T * 0.28, T * 0.32, T * 0.1, T * 0.02); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = cfg.color;
    if (cfg.shape === 'cow') {
      ctx.beginPath(); ctx.roundRect(x - T * 0.16, by - T * 0.44, T * 0.32, T * 0.14, T * 0.05); ctx.fill(); outline(ctx, T, 0.5);
      ctx.beginPath(); ctx.roundRect(x + T * 0.12, by - T * 0.52, T * 0.14, T * 0.12, T * 0.04); ctx.fill(); outline(ctx, T, 0.45);
      for (const dx of [-0.12, -0.02, 0.06]) ctx.fillRect(x + dx * T, by - T * 0.31, T * 0.04, T * 0.05);
    } else {
      ctx.beginPath(); ctx.roundRect(x - T * 0.08, by - T * 0.6, T * 0.16, T * 0.32, T * 0.04); ctx.fill(); outline(ctx, T, 0.5);
      ctx.beginPath(); ctx.arc(x, by - T * 0.66, T * 0.07, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45);
      ctx.strokeStyle = cfg.color; ctx.lineWidth = T * 0.04; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + T * 0.07, by - T * 0.55); ctx.lineTo(x + T * 0.2, by - T * 0.72); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(x + T * 0.04, by - T * 0.5, T * 0.04, T * 0.02, -0.6, 0, Math.PI * 2); ctx.fill();
  },
  trophy(ctx, x, by, T, tile, fw, fh, cfg) {
    const k = cfg.big ? 1.3 : 1;
    groundShadow(ctx, x, by, T * 0.16 * k, T * 0.06, T, 0.4);
    ctx.fillStyle = '#5a4638';
    ctx.beginPath(); ctx.roundRect(x - T * 0.12 * k, by - T * 0.08 * k, T * 0.24 * k, T * 0.07 * k, T * 0.01); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = cfg.color;
    ctx.beginPath(); ctx.roundRect(x - T * 0.03 * k, by - T * 0.2 * k, T * 0.06 * k, T * 0.12 * k, T * 0.01); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - T * 0.12 * k, by - T * 0.44 * k); ctx.quadraticCurveTo(x - T * 0.12 * k, by - T * 0.16 * k, x, by - T * 0.18 * k);
    ctx.quadraticCurveTo(x + T * 0.12 * k, by - T * 0.16 * k, x + T * 0.12 * k, by - T * 0.44 * k); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.45);
    ctx.strokeStyle = cfg.color; ctx.lineWidth = T * 0.025 * k;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * T * 0.16 * k, by - T * 0.36 * k, T * 0.06 * k, s > 0 ? Math.PI * 1.4 : Math.PI * 0.6, s > 0 ? Math.PI * 0.6 : Math.PI * 1.4, s > 0); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(x - T * 0.05 * k, by - T * 0.36 * k, T * 0.02 * k, T * 0.05 * k, 0.2, 0, Math.PI * 2); ctx.fill();
  },
  /** The museum's fossil display: a sandstone slab etched with an ammonite and a rib cage, roped off. */
  fossil(ctx, x, by, T, tile, fw, fh) {
    decoPlate(ctx, x, by - tile / 2, fw, fh, tile, '#c9c0a8', 'rgba(58,37,16,0.18)');
    const w = T * 0.44, h = T * 0.32, top = by - h - T * 0.14;
    ctx.fillStyle = '#b5ab93';
    ctx.beginPath(); ctx.roundRect(x - w / 2 - T * 0.04, by - T * 0.16, w + T * 0.08, T * 0.1, T * 0.02); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = '#d9c9a2';
    ctx.beginPath(); ctx.roundRect(x - w / 2, top, w, h, T * 0.03); ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = 'rgba(58,37,16,0.14)'; ctx.fillRect(x - w / 2, top, T * 0.05, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + w / 2 - T * 0.05, top + T * 0.02, T * 0.03, h - T * 0.04);
    ctx.strokeStyle = '#6f5a3c'; ctx.lineWidth = Math.max(1, T * 0.014); ctx.lineCap = 'round';
    // Ammonite: a spiral opening outward on the slab's left half.
    const cx = x - w * 0.22, cy = top + h * 0.5;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 5; a += 0.25) {
      const r = T * 0.01 + a * T * 0.0062;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Rib cage: a sloping spine with five curved ribs on the right half.
    const sx = x + w * 0.06, sy = top + h * 0.3;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + w * 0.34, sy + h * 0.3); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const k = i / 4, px = sx + w * 0.32 * k, py = sy + h * 0.28 * k;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px - T * 0.012, py + T * 0.07, px + T * 0.025, py + T * 0.09); ctx.stroke();
    }
    // Rope posts at the front corners.
    const postH = T * 0.16, postW = Math.max(2, T * 0.03);
    for (const dx of [-0.5, 0.5]) decoPost(ctx, x + dx * T * 0.62, by + T * 0.02 - postH, postW, postH, T, '#8a6b3d');
    ctx.strokeStyle = '#b8342e'; ctx.lineWidth = Math.max(1, T * 0.016);
    ctx.beginPath(); ctx.moveTo(x - T * 0.31, by + T * 0.02 - postH * 0.85); ctx.quadraticCurveTo(x, by + T * 0.02 - postH * 0.45, x + T * 0.31, by + T * 0.02 - postH * 0.85); ctx.stroke();
  },
  plinth(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.16, T * 0.06, T, 0.4);
    ctx.fillStyle = '#c9c0a8';
    ctx.beginPath(); ctx.roundRect(x - T * 0.14, by - T * 0.34, T * 0.28, T * 0.32, T * 0.02); ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = 'rgba(58,37,16,0.16)'; ctx.fillRect(x - T * 0.14, by - T * 0.34, T * 0.06, T * 0.32);
    ctx.fillStyle = '#8a1a2e';
    ctx.beginPath(); ctx.roundRect(x - T * 0.09, by - T * 0.5, T * 0.18, T * 0.16, T * 0.06); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(x, by - T * 0.42, T * 0.035, 0, Math.PI * 2); ctx.fill();
  },
  pond(ctx, x, by, T, tile, fw, fh, cfg, t) {
    const rx = T * 0.42, ry = T * 0.2, cy = by - T * 0.02;
    ctx.beginPath(); ctx.ellipse(x, cy + T * 0.02, rx * 1.08, ry * 1.12, 0, 0, Math.PI * 2); ctx.fillStyle = '#c9b27a'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = '#2f6f96'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, cy - T * 0.015, rx * 0.95, ry * 0.9, 0, 0, Math.PI * 2);
    fillUnit(ctx, 'water', 'v', [[0, '#b9ecfb'], [0.4, PALETTE.waterLight], [1, '#2a8cc0']], x - rx, cy - ry, rx * 2, ry * 2, PALETTE.water);
    outline(ctx, T, 0.6);
    drawWaterSurface(ctx, x, cy, rx * 0.95, ry * 0.9, T * 0.5, t);
    if (cfg.lilies) {
      ctx.fillStyle = PALETTE.flowerPink;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + (prand(i, 131) - 0.5) * rx * 1.2, cy + (prand(i, 132) - 0.3) * ry * 0.8, T * 0.03, 0, Math.PI * 2); ctx.fill(); }
    }
    if (cfg.koi) {
      for (let i = 0; i < 3; i++) {
        const a = t * 0.6 + i * 2.1;
        ctx.fillStyle = i % 2 ? '#f0862e' : '#fffaea';
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rx * 0.5, cy + Math.sin(a) * ry * 0.5, T * 0.05, T * 0.02, a, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (cfg.duck) drawAnimal(ctx, x + rx * 0.2, cy - T * 0.05, T / 104 * 0.7, (t / 1.4) % 1, 'duck');
  },
  topiary(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.2, T * 0.07, T, 0.4);
    ctx.fillStyle = '#a09a8c';
    ctx.beginPath(); ctx.roundRect(x - T * 0.14, by - T * 0.12, T * 0.28, T * 0.1, T * 0.02); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = PALETTE.canopyDark;
    ctx.beginPath();
    ctx.ellipse(x, by - T * 0.34, T * 0.14, T * 0.12, 0, 0, Math.PI * 2);
    ctx.moveTo(x + T * 0.22, by - T * 0.44); ctx.arc(x + T * 0.13, by - T * 0.44, T * 0.09, 0, Math.PI * 2);
    ctx.moveTo(x + T * 0.13, by - T * 0.5); ctx.arc(x + T * 0.12, by - T * 0.5, T * 0.03, 0, Math.PI * 2);
    ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = 'rgba(140,215,90,0.5)';
    ctx.beginPath(); ctx.ellipse(x + T * 0.04, by - T * 0.38, T * 0.07, T * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.canopyDark;
    for (const dx of [-0.08, -0.02, 0.05]) ctx.fillRect(x + dx * T, by - T * 0.26, T * 0.04, T * 0.14);
  },
  maze(ctx, x, by, T, tile, fw, fh) {
    footprintPath(ctx, x, by - tile / 2, fw, fh, tile);
    ctx.fillStyle = PALETTE.grassLight; ctx.fill(); outline(ctx, tile, 0.4);
    const pt = (u, v) => [x + (u - v - (fw - 1) / 2) * tile + 0, by - tile / 2 + (u + v - (fw - 1) / 2 - (fh - 1) / 2 + (fw - 1) / 2 + (fh - 1) / 2) * (tile / 2)];
    const hedge = (u0, v0, u1, v1) => {
      const [ax, ay] = pt(u0, v0), [bx, by2] = pt(u1, v1);
      ctx.strokeStyle = PALETTE.canopyDark; ctx.lineWidth = tile * 0.22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay - tile * 0.12); ctx.lineTo(bx, by2 - tile * 0.12); ctx.stroke();
      ctx.strokeStyle = 'rgba(140,215,90,0.45)'; ctx.lineWidth = tile * 0.09;
      ctx.beginPath(); ctx.moveTo(ax, ay - tile * 0.2); ctx.lineTo(bx, by2 - tile * 0.2); ctx.stroke();
    };
    hedge(0.3, 0.3, fw - 0.3, 0.3); hedge(0.3, 0.3, 0.3, fh - 0.3); hedge(fw - 0.3, 0.3, fw - 0.3, fh - 0.3);
    hedge(0.3, fh - 0.3, fw * 0.55, fh - 0.3); hedge(1.0, 1.0, fw - 1.0, 1.0); hedge(1.0, 1.0, 1.0, fh - 0.9);
    hedge(fw - 1.0, 1.0, fw - 1.0, fh - 1.2); hedge(1.7, 1.7, fw - 1.0, 1.7);
  },
  lights(ctx, x, by, T, tile, fw, fh, cfg, t, opts = {}) {
    const night = Math.max(0, Math.min(1, opts.night || 0));
    decoPost(ctx, x - T * 0.36, by - T * 0.6, T * 0.04, T * 0.6, T);
    decoPost(ctx, x + T * 0.36, by - T * 0.6, T * 0.04, T * 0.6, T);
    ctx.strokeStyle = PALETTE.outline; ctx.lineWidth = Math.max(1, T * 0.012);
    ctx.beginPath(); ctx.moveTo(x - T * 0.36, by - T * 0.58); ctx.quadraticCurveTo(x, by - T * 0.42, x + T * 0.36, by - T * 0.58); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const k = (i + 0.5) / 7;
      const px = x - T * 0.36 + k * T * 0.72;
      const py = by - T * 0.58 + (1 - Math.pow(2 * k - 1, 2)) * T * 0.16 * 0.5 + T * 0.02;
      const glow = (0.6 + 0.4 * Math.sin(t * 4 + i * 1.3)) * (1 + 1.2 * night);
      if (cfg.lantern) {
        ctx.fillStyle = cfg.color;
        ctx.beginPath(); ctx.ellipse(px, py + T * 0.04, T * 0.035, T * 0.045, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.3);
        ctx.fillStyle = `rgba(255,214,120,${(0.35 * glow).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(px, py + T * 0.04, T * 0.07, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,220,90,${(0.25 * glow).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(px, py + T * 0.02, T * 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = [cfg.color, '#e05548', '#4a8fd4', '#8ed653'][i % 4];
        ctx.beginPath(); ctx.arc(px, py + T * 0.02, T * 0.022, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.25);
      }
    }
  },
  lamp(ctx, x, by, T, tile, fw, fh, cfg, t, opts = {}) {
    const night = Math.max(0, Math.min(1, opts.night || 0));
    groundShadow(ctx, x, by, T * 0.1, T * 0.04, T, 0.7);
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.02, T * 0.08, T * 0.035, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.4);
    decoPost(ctx, x, by - T * 0.62, T * 0.035, T * 0.6, T, '#3a3a3a');
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.moveTo(x - T * 0.08, by - T * 0.62); ctx.lineTo(x, by - T * 0.74); ctx.lineTo(x + T * 0.08, by - T * 0.62); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.4);
    // The lamp is always lit a little; after dusk its halo grows and brightens.
    ctx.fillStyle = `rgba(255,214,120,${(0.35 + 0.1 * Math.sin(t * 3) + 0.35 * night).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, by - T * 0.66, T * (0.11 + 0.14 * night), 0, Math.PI * 2); ctx.fill();
    if (night > 0.3) {
      ctx.fillStyle = `rgba(255,200,90,${(0.16 * night).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, by, T * 0.34, T * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffe7a8';
    ctx.beginPath(); ctx.roundRect(x - T * 0.045, by - T * 0.72, T * 0.09, T * 0.1, T * 0.01); ctx.fill(); outline(ctx, T, 0.35);
  },
  arch(ctx, x, by, T, tile, fw, fh, cfg) {
    groundShadow(ctx, x, by, T * 0.4, T * 0.1, T, 0.8);
    ctx.strokeStyle = cfg.color; ctx.lineWidth = T * 0.1; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(x - T * 0.32, by); ctx.lineTo(x - T * 0.32, by - T * 0.4); ctx.arc(x, by - T * 0.4, T * 0.32, Math.PI, 0); ctx.lineTo(x + T * 0.32, by); ctx.stroke();
    ctx.strokeStyle = PALETTE.outline; ctx.lineWidth = Math.max(1, T * 0.02);
    ctx.beginPath(); ctx.moveTo(x - T * 0.37, by); ctx.lineTo(x - T * 0.37, by - T * 0.4); ctx.arc(x, by - T * 0.4, T * 0.37, Math.PI, 0); ctx.lineTo(x + T * 0.37, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - T * 0.27, by); ctx.lineTo(x - T * 0.27, by - T * 0.4); ctx.arc(x, by - T * 0.4, T * 0.27, Math.PI, 0); ctx.lineTo(x + T * 0.27, by); ctx.stroke();
    if (cfg.flowers) {
      for (let i = 0; i < 12; i++) {
        const a = Math.PI + (i / 11) * Math.PI;
        ctx.fillStyle = [PALETTE.flowerPink, PALETTE.flowerWhite, PALETTE.fruitRed][i % 3];
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * T * 0.32, by - T * 0.4 + Math.sin(a) * T * 0.32, T * 0.028, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(58,37,16,0.25)'; ctx.lineWidth = Math.max(1, T * 0.01);
      for (const dy of [0.1, 0.25]) { ctx.beginPath(); ctx.moveTo(x - T * 0.37, by - T * dy); ctx.lineTo(x - T * 0.27, by - T * dy); ctx.moveTo(x + T * 0.27, by - T * dy); ctx.lineTo(x + T * 0.37, by - T * dy); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(x + T * 0.1, by - T * 0.68, T * 0.05, 0, Math.PI * 2); ctx.fill();
    }
  },
  bridge(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.4, T * 0.1, T, 0.3);
    ctx.fillStyle = '#b8b0a0';
    ctx.beginPath(); ctx.moveTo(x - T * 0.44, by); ctx.quadraticCurveTo(x, by - T * 0.34, x + T * 0.44, by); ctx.lineTo(x + T * 0.44, by + T * 0.02); ctx.lineTo(x - T * 0.44, by + T * 0.02); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = '#2f6f96';
    ctx.beginPath(); ctx.moveTo(x - T * 0.2, by); ctx.quadraticCurveTo(x, by - T * 0.14, x + T * 0.2, by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = Math.max(1, T * 0.02);
    ctx.beginPath(); ctx.moveTo(x - T * 0.4, by - T * 0.1); ctx.quadraticCurveTo(x, by - T * 0.42, x + T * 0.4, by - T * 0.1); ctx.stroke();
    for (const k of [-0.4, -0.2, 0, 0.2, 0.4]) { const py = by - T * (0.02 + (1 - k * k * 6.25) * 0.16); ctx.beginPath(); ctx.moveTo(x + k * T, py); ctx.lineTo(x + k * T, py - T * 0.1); ctx.stroke(); }
  },
  clock(ctx, x, by, T, tile, fw, fh, cfg, t) {
    groundShadow(ctx, x, by, T * 0.22, T * 0.08, T, 1.6);
    ctx.beginPath(); ctx.roundRect(x - T * 0.16, by - T * 0.9, T * 0.32, T * 0.9, T * 0.02);
    fillUnit(ctx, 'wall:clock', 'h', [[0, shade('#e0d6ba', 0.2)], [0.5, '#e0d6ba'], [1, lighten('#e0d6ba', 0.06)]], x - T * 0.16, by - T * 0.9, T * 0.32, T * 0.9, '#e0d6ba');
    outline(ctx, T, 0.6);
    ctx.fillStyle = PALETTE.roofAlt;
    ctx.beginPath(); ctx.moveTo(x - T * 0.2, by - T * 0.9); ctx.lineTo(x, by - T * 1.12); ctx.lineTo(x + T * 0.2, by - T * 0.9); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = '#fffaea';
    ctx.beginPath(); ctx.arc(x, by - T * 0.7, T * 0.1, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45);
    ctx.strokeStyle = PALETTE.outline; ctx.lineWidth = Math.max(1, T * 0.016); ctx.lineCap = 'round';
    const h = (t / 60) % 1, m = (t / 5) % 1;
    ctx.beginPath(); ctx.moveTo(x, by - T * 0.7); ctx.lineTo(x + Math.sin(h * Math.PI * 2) * T * 0.05, by - T * 0.7 - Math.cos(h * Math.PI * 2) * T * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, by - T * 0.7); ctx.lineTo(x + Math.sin(m * Math.PI * 2) * T * 0.08, by - T * 0.7 - Math.cos(m * Math.PI * 2) * T * 0.08); ctx.stroke();
    ctx.fillStyle = PALETTE.woodDark;
    ctx.beginPath(); ctx.roundRect(x - T * 0.06, by - T * 0.24, T * 0.12, T * 0.22, T * 0.03); ctx.fill(); outline(ctx, T, 0.35);
    ctx.fillStyle = PALETTE.window;
    ctx.beginPath(); ctx.roundRect(x - T * 0.04, by - T * 0.5, T * 0.08, T * 0.1, T * 0.01); ctx.fill(); outline(ctx, T, 0.3);
  },
  sundial(ctx, x, by, T, tile, fw, fh, cfg, t) {
    groundShadow(ctx, x, by, T * 0.16, T * 0.06, T, 0.3);
    ctx.fillStyle = '#a09a8c';
    ctx.beginPath(); ctx.roundRect(x - T * 0.06, by - T * 0.26, T * 0.12, T * 0.24, T * 0.02); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = '#c9c0a8';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.27, T * 0.17, T * 0.075, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45);
    ctx.strokeStyle = 'rgba(58,37,16,0.4)'; ctx.lineWidth = Math.max(1, T * 0.01);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * T * 0.12, by - T * 0.27 + Math.sin(a) * T * 0.05); ctx.lineTo(x + Math.cos(a) * T * 0.15, by - T * 0.27 + Math.sin(a) * T * 0.065); ctx.stroke(); }
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.moveTo(x - T * 0.02, by - T * 0.27); ctx.lineTo(x + T * 0.02, by - T * 0.27); ctx.lineTo(x + T * 0.06, by - T * 0.4); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.35);
    ctx.fillStyle = 'rgba(58,37,16,0.25)';
    ctx.beginPath(); ctx.moveTo(x, by - T * 0.27); ctx.lineTo(x - T * 0.1, by - T * 0.31); ctx.lineTo(x - T * 0.07, by - T * 0.25); ctx.closePath(); ctx.fill();
  },
  picnic(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.36, T * 0.1, T, 0.3);
    ctx.fillStyle = '#e05548';
    ctx.beginPath(); ctx.moveTo(x, by - T * 0.3); ctx.lineTo(x + T * 0.42, by - T * 0.1); ctx.lineTo(x, by + T * 0.06); ctx.lineTo(x - T * 0.42, by - T * 0.1); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.4);
    ctx.strokeStyle = 'rgba(255,250,234,0.7)'; ctx.lineWidth = Math.max(1, T * 0.012);
    for (const k of [-0.2, 0, 0.2]) { ctx.beginPath(); ctx.moveTo(x + k * T - T * 0.22, by - T * 0.1 + k * T * 0.5 - T * 0.11); ctx.lineTo(x + k * T + T * 0.22, by - T * 0.1 + k * T * 0.5 + T * 0.11); ctx.stroke(); }
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath(); ctx.roundRect(x - T * 0.12, by - T * 0.26, T * 0.2, T * 0.12, T * 0.02); ctx.fill(); outline(ctx, T, 0.35);
    ctx.fillStyle = PALETTE.fruitRed;
    for (const dx of [-0.08, -0.02, 0.04]) { ctx.beginPath(); ctx.arc(x + dx * T, by - T * 0.27, T * 0.025, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fffaea';
    ctx.beginPath(); ctx.arc(x + T * 0.18, by - T * 0.1, T * 0.045, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.3);
  },
  beach(ctx, x, by, T) {
    groundShadow(ctx, x, by, T * 0.22, T * 0.07, T, 0.3);
    ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = Math.max(1, T * 0.022); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - T * 0.16, by); ctx.lineTo(x - T * 0.06, by - T * 0.26); ctx.moveTo(x + T * 0.14, by); ctx.lineTo(x + T * 0.02, by - T * 0.26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - T * 0.14, by - T * 0.12); ctx.lineTo(x + T * 0.12, by - T * 0.12); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#fffaea' : '#4a8fd4';
      ctx.beginPath(); ctx.moveTo(x - T * 0.14 + i * T * 0.065, by - T * 0.12); ctx.lineTo(x - T * 0.075 + i * T * 0.065, by - T * 0.12); ctx.lineTo(x - T * 0.005 + i * T * 0.065, by - T * 0.4); ctx.lineTo(x - T * 0.07 + i * T * 0.065, by - T * 0.4); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = PALETTE.outline; ctx.lineWidth = Math.max(1, T * 0.014);
    ctx.beginPath(); ctx.moveTo(x - T * 0.14, by - T * 0.12); ctx.lineTo(x + T * 0.12, by - T * 0.12); ctx.lineTo(x + T * 0.19, by - T * 0.4); ctx.lineTo(x - T * 0.07, by - T * 0.4); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.moveTo(x + T * 0.22, by - T * 0.2); ctx.lineTo(x + T * 0.24, by - T * 0.62); ctx.lineTo(x + T * 0.26, by - T * 0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e05548';
    ctx.beginPath(); ctx.ellipse(x + T * 0.24, by - T * 0.62, T * 0.22, T * 0.08, 0, Math.PI, 0); ctx.fill(); outline(ctx, T, 0.4);
  },
  tent(ctx, x, by, T, tile, fw, fh, cfg) {
    decoPlate(ctx, x, by - tile / 2, fw, fh, tile, '#c9b27a');
    groundShadow(ctx, x, by, T * 0.4, T * 0.12, T, 0.8);
    ctx.beginPath(); ctx.moveTo(x - T * 0.44, by); ctx.lineTo(x, by - T * 0.66); ctx.lineTo(x + T * 0.44, by); ctx.closePath();
    fillUnit(ctx, `tent:${cfg.color}`, 'h', [[0, shade(cfg.color, 0.2)], [0.5, cfg.color], [1, lighten(cfg.color, 0.08)]], x - T * 0.44, by - T * 0.66, T * 0.88, T * 0.66, cfg.color);
    outline(ctx, T, 0.6);
    ctx.fillStyle = 'rgba(255,250,234,0.85)';
    for (const k of [-0.28, 0, 0.28]) { ctx.beginPath(); ctx.moveTo(x + k * T * 0.5, by - T * 0.66 + Math.abs(k) * T * 0.75); ctx.lineTo(x + k * T * 1.2, by); ctx.lineTo(x + k * T * 1.2 + T * 0.08, by); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = shade(cfg.color, 0.45);
    ctx.beginPath(); ctx.moveTo(x - T * 0.08, by); ctx.lineTo(x, by - T * 0.22); ctx.lineTo(x + T * 0.08, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.moveTo(x, by - T * 0.66); ctx.lineTo(x, by - T * 0.8); ctx.lineTo(x + T * 0.1, by - T * 0.76); ctx.closePath(); ctx.fill();
  },
  carousel(ctx, x, by, T, tile, fw, fh, cfg, t) {
    decoPlate(ctx, x, by - tile / 2, fw, fh, tile, '#c9c0a8', 'rgba(58,37,16,0.2)');
    ctx.fillStyle = '#fffaea';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.08, T * 0.38, T * 0.16, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = PALETTE.roof;
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.6, T * 0.42, T * 0.17, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.5);
    ctx.beginPath(); ctx.moveTo(x - T * 0.42, by - T * 0.6); ctx.quadraticCurveTo(x, by - T * 0.95, x + T * 0.42, by - T * 0.6); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.5);
    ctx.fillStyle = PALETTE.gold;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * T * 0.38, by - T * 0.6 + Math.sin(a) * T * 0.15, T * 0.02, 0, Math.PI * 2); ctx.fill(); }
    decoPost(ctx, x, by - T * 0.6, T * 0.05, T * 0.52, T, PALETTE.gold);
    for (let i = 0; i < 4; i++) {
      const a = t * 0.9 + (i / 4) * Math.PI * 2;
      const px = x + Math.cos(a) * T * 0.28, py = by - T * 0.1 + Math.sin(a) * T * 0.11;
      const bob = Math.sin(t * 3 + i) * T * 0.03;
      ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = Math.max(1, T * 0.014);
      ctx.beginPath(); ctx.moveTo(px, py - T * 0.5); ctx.lineTo(px, py - T * 0.12 + bob); ctx.stroke();
      ctx.fillStyle = ['#fffaea', '#f48ab0', '#4a8fd4', '#8ed653'][i];
      ctx.beginPath(); ctx.ellipse(px, py - T * 0.2 + bob, T * 0.08, T * 0.045, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.35);
      ctx.beginPath(); ctx.arc(px + T * 0.07, py - T * 0.26 + bob, T * 0.035, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.3);
    }
  },
  banner(ctx, x, by, T) {
    decoPost(ctx, x - T * 0.4, by - T * 0.6, T * 0.04, T * 0.6, T);
    decoPost(ctx, x + T * 0.4, by - T * 0.6, T * 0.04, T * 0.6, T);
    ctx.beginPath(); ctx.roundRect(x - T * 0.38, by - T * 0.56, T * 0.76, T * 0.3, T * 0.02);
    fillUnit(ctx, 'banner', 'v', [[0, '#5aa0e0'], [1, '#2a70b8']], x - T * 0.38, by - T * 0.56, T * 0.76, T * 0.3, '#4a8fd4');
    outline(ctx, T, 0.45);
    ctx.fillStyle = PALETTE.gold;
    for (let i = 0; i < 3; i++) { const px = x - T * 0.2 + i * T * 0.2, py = by - T * 0.41; ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; const r = T * 0.05; ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); ctx.lineTo(px + Math.cos(a + Math.PI / 5) * r * 0.45, py + Math.sin(a + Math.PI / 5) * r * 0.45); } ctx.closePath(); ctx.fill(); }
  },
  balloons(ctx, x, by, T, tile, fw, fh, cfg, t) {
    groundShadow(ctx, x, by, T * 0.1, T * 0.04, T, 0.2);
    ctx.fillStyle = '#5a4638';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.02, T * 0.05, T * 0.025, 0, 0, Math.PI * 2); ctx.fill();
    const colors = ['#e05548', '#4a8fd4', '#f0b52e', '#8ed653', '#f48ab0'];
    for (let i = 0; i < 5; i++) {
      const sway = Math.sin(t * 1.4 + i) * T * 0.03;
      const px = x + (i - 2) * T * 0.11 + sway, py = by - T * (0.5 + prand(i, 141) * 0.2);
      ctx.strokeStyle = 'rgba(58,37,16,0.5)'; ctx.lineWidth = Math.max(1, T * 0.008);
      ctx.beginPath(); ctx.moveTo(x, by - T * 0.03); ctx.quadraticCurveTo(px * 0.5 + x * 0.5, py * 0.5 + by * 0.5, px, py + T * 0.08); ctx.stroke();
      ctx.fillStyle = colors[i];
      ctx.beginPath(); ctx.ellipse(px, py, T * 0.07, T * 0.085, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.35);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(px - T * 0.02, py - T * 0.03, T * 0.018, T * 0.03, 0.4, 0, Math.PI * 2); ctx.fill();
    }
  },
  pole(ctx, x, by, T, tile, fw, fh, cfg, t) {
    groundShadow(ctx, x, by, T * 0.1, T * 0.04, T, 0.9);
    decoPost(ctx, x, by - T * 0.88, T * 0.04, T * 0.88, T, cfg.may ? PALETTE.woodLight : PALETTE.woodDark);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(x, by - T * 0.9, T * 0.03, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.3);
    if (cfg.flag) {
      const wave = Math.sin(t * 3) * T * 0.03;
      ctx.fillStyle = '#4a8fd4';
      ctx.beginPath(); ctx.moveTo(x + T * 0.02, by - T * 0.86); ctx.quadraticCurveTo(x + T * 0.2, by - T * 0.84 + wave, x + T * 0.34, by - T * 0.82); ctx.lineTo(x + T * 0.32, by - T * 0.66); ctx.quadraticCurveTo(x + T * 0.18, by - T * 0.66 - wave, x + T * 0.02, by - T * 0.68); ctx.closePath(); ctx.fill(); outline(ctx, T, 0.35);
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.arc(x + T * 0.17, by - T * 0.76, T * 0.035, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const colors = cfg.may ? ['#e05548', '#f0b52e', '#4a8fd4', '#8ed653', '#f48ab0', '#fffaea'] : ['#e05548', '#f0b52e', '#4a8fd4'];
    for (let i = 0; i < colors.length; i++) {
      const a = (i / colors.length) * Math.PI * 2 + t * 0.4;
      const ex = x + Math.cos(a) * T * 0.3, ey = by + Math.sin(a) * T * 0.1 - T * (cfg.may ? 0 : 0.5);
      ctx.strokeStyle = colors[i]; ctx.lineWidth = Math.max(1, T * 0.02); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, by - T * 0.86); ctx.quadraticCurveTo(x + Math.cos(a) * T * 0.1, by - T * 0.5, ex, ey); ctx.stroke();
    }
  },
  buoy(ctx, x, by, T, tile, fw, fh, cfg, t) {
    const bob = Math.sin(t * 1.6) * T * 0.02;
    ctx.fillStyle = 'rgba(63,176,224,0.5)';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.02, T * 0.24, T * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e05548';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.14 + bob, T * 0.13, T * 0.11, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.45);
    ctx.fillStyle = '#fffaea';
    ctx.beginPath(); ctx.ellipse(x, by - T * 0.14 + bob, T * 0.13, T * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    decoPost(ctx, x, by - T * 0.5 + bob, T * 0.03, T * 0.28, T, '#5a5a5a');
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(x, by - T * 0.52 + bob, T * 0.035, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.3);
  },
  glasshouse(ctx, x, by, T, tile, fw, fh) {
    decoPlate(ctx, x, by - tile / 2, fw, fh, tile, '#c9c0a8');
    groundShadow(ctx, x, by, T * 0.36, T * 0.1, T, 0.5);
    ctx.beginPath(); ctx.roundRect(x - T * 0.36, by - T * 0.34, T * 0.72, T * 0.32, T * 0.02);
    fillUnit(ctx, 'glass:house', 'v', [[0, 'rgba(205,239,251,0.8)'], [1, 'rgba(74,166,204,0.7)']], x - T * 0.36, by - T * 0.34, T * 0.72, T * 0.32, 'rgba(127,212,240,0.75)');
    outline(ctx, T, 0.5);
    ctx.beginPath(); ctx.moveTo(x - T * 0.4, by - T * 0.34); ctx.lineTo(x, by - T * 0.58); ctx.lineTo(x + T * 0.4, by - T * 0.34); ctx.closePath();
    fillUnit(ctx, 'glass:roof', 'v', [[0, 'rgba(230,250,255,0.85)'], [1, 'rgba(127,212,240,0.75)']], x - T * 0.4, by - T * 0.58, T * 0.8, T * 0.24, 'rgba(180,230,245,0.8)');
    outline(ctx, T, 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, T * 0.012);
    for (const k of [-0.24, -0.08, 0.08, 0.24]) { ctx.beginPath(); ctx.moveTo(x + k * T, by - T * 0.34); ctx.lineTo(x + k * T, by - T * 0.02); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x - T * 0.36, by - T * 0.18); ctx.lineTo(x + T * 0.36, by - T * 0.18); ctx.stroke();
    ctx.fillStyle = '#5fae2e';
    for (const dx of [-0.24, -0.08, 0.08, 0.24]) { ctx.beginPath(); ctx.arc(x + dx * T, by - T * 0.12, T * 0.05, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = PALETTE.flowerPink;
    for (const dx of [-0.16, 0.16]) { ctx.beginPath(); ctx.arc(x + dx * T, by - T * 0.16, T * 0.02, 0, Math.PI * 2); ctx.fill(); }
  },
};

/**
 * Any decoration. opts: { now, fw, fh }. (x, y) is the footprint anchor; the sprite stands on the
 * footprint's centre, half a tile below it.
 */
export function drawDecoration(ctx, x, y, size, decoId, opts = {}) {
  const T = 104 * size;
  const cfg = decoConfigFor(decoId);
  const fw = opts.fw || 1, fh = opts.fh || 1;
  const tile = T / Math.max(fw, fh);
  const by = y + tile / 2;
  const t = (opts.now || 0) / 1000;
  const fn = DECO_DRAW[cfg.fam] || DECO_DRAW.flowerbed;
  fn(ctx, x, by, T, tile, fw, fh, cfg, t, opts);
}

function drawPetBody(ctx, x, y, size, idleFrame, color, earShape) {
  const T = 104 * size;
  const bob = Math.sin((idleFrame || 0) * Math.PI * 2) * 2;
  const yy = y + bob;
  groundShadow(ctx, x, yy + T * 0.14, T * 0.2, T * 0.06, T);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x, yy, T * 0.16, T * 0.11, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.5);
  ctx.beginPath(); ctx.arc(x + T * 0.14, yy - T * 0.1, T * 0.08, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.5);
  ctx.fillStyle = color;
  if (earShape === 'pointy') {
    ctx.beginPath();
    ctx.moveTo(x + T * 0.08, yy - T * 0.16); ctx.lineTo(x + T * 0.1, yy - T * 0.26); ctx.lineTo(x + T * 0.15, yy - T * 0.16);
    ctx.closePath(); ctx.fill(); outline(ctx, T, 0.35);
  } else {
    ctx.beginPath(); ctx.ellipse(x + T * 0.08, yy - T * 0.15, T * 0.035, T * 0.06, 0.4, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.35);
  }
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath(); ctx.arc(x + T * 0.17, yy - T * 0.11, Math.max(1, T * 0.016), 0, Math.PI * 2); ctx.fill();
}

export function drawDog(ctx, x, y, size, idleFrame) {
  drawPetBody(ctx, x, y, size, idleFrame, '#c08a4e', 'floppy');
}
export function drawCat(ctx, x, y, size, idleFrame) {
  drawPetBody(ctx, x, y, size, idleFrame, '#8a7f68', 'pointy');
}

// ---------------------------------------------------------------------------------------
// Scenery on unexpanded land: trees, bushes, rocks, stumps, boundary rails and the for-sale
// signpost. renderer/main emit these as ordinary depth-sorted objects (kind 'scenery' /
// 'signpost'), so a tree south of a barn draws in front of it like anything else.
// ---------------------------------------------------------------------------------------

/**
 * A tree. opts: { kind: 'oak'|'pine'|'birch'|'fruit', variant: 0..1 }.
 * Canopy puffs are filled, then outlined ONCE as a union (SPRITE-NOTES §2), then shaded: a
 * lighter fill on the sun side and a darker one down-left, both clipped to the canopy.
 */
export function drawTree(ctx, x, y, size = 1, opts = {}) {
  const T = 104 * size;
  const kind = opts.kind || 'oak';
  const v = typeof opts.variant === 'number' ? opts.variant : 0.5;
  const s = 0.85 + v * 0.3;                          // per-tree size jitter
  const lean = (v - 0.5) * 0.08;
  const baseY = y + T * 0.5;                          // stands on the tile centre

  if (kind === 'pine') {
    groundShadow(ctx, x, baseY, T * 0.3 * s, T * 0.1 * s, T, 1.1);
    ctx.fillStyle = PALETTE.trunkDark;
    ctx.beginPath(); ctx.roundRect(x - T * 0.035 * s, baseY - T * 0.22 * s, T * 0.07 * s, T * 0.24 * s, T * 0.01); ctx.fill();
    ctx.beginPath();
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const ty = baseY - T * (0.18 + i * 0.26) * s;
      const hw = T * (0.36 - i * 0.08) * s;
      const th = T * 0.36 * s;
      ctx.moveTo(x - hw, ty); ctx.lineTo(x + lean * T + (i === tiers - 1 ? 0 : 0), ty - th); ctx.lineTo(x + hw, ty); ctx.closePath();
    }
    ctx.fillStyle = PALETTE.pine; ctx.fill();
    outline(ctx, T, 0.55);
    // Sun-side highlight and a shaded skirt on each tier, drawn inside the tier by construction
    // (no clip: clipping a path is the most expensive thing a software rasteriser does per tree).
    ctx.fillStyle = 'rgba(120,190,90,0.45)';
    for (let i = 0; i < tiers; i++) {
      const ty = baseY - T * (0.18 + i * 0.26) * s, hw = T * (0.36 - i * 0.08) * s, th = T * 0.36 * s;
      ctx.beginPath(); ctx.moveTo(x + T * 0.02, ty - th * 0.1); ctx.lineTo(x + T * 0.01, ty - th * 0.92); ctx.lineTo(x + hw * 0.8, ty - th * 0.1); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,50,20,0.35)';
    for (let i = 0; i < tiers; i++) {
      const ty = baseY - T * (0.18 + i * 0.26) * s, hw = T * (0.36 - i * 0.08) * s;
      ctx.beginPath(); ctx.moveTo(x - hw * 0.9, ty - T * 0.01 * s); ctx.lineTo(x - hw * 0.2, ty - T * 0.09 * s); ctx.lineTo(x + hw * 0.5, ty - T * 0.01 * s); ctx.closePath(); ctx.fill();
    }
    return;
  }

  const birch = kind === 'birch';
  const fruit = kind === 'fruit';
  groundShadow(ctx, x, baseY, T * 0.34 * s, T * 0.12 * s, T, 1.0);
  // trunk
  ctx.fillStyle = birch ? PALETTE.birchBark : PALETTE.trunk;
  ctx.beginPath();
  ctx.moveTo(x - T * 0.06 * s, baseY);
  ctx.lineTo(x + T * 0.06 * s, baseY);
  ctx.lineTo(x + T * (0.035 + lean) * s, baseY - T * 0.42 * s);
  ctx.lineTo(x - T * (0.035 - lean) * s, baseY - T * 0.42 * s);
  ctx.closePath(); ctx.fill(); outline(ctx, T, 0.45);
  if (birch) {
    ctx.fillStyle = 'rgba(58,37,16,0.55)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse(x + (prand(i, 81) - 0.5) * T * 0.05, baseY - T * (0.08 + i * 0.09) * s, T * 0.025, T * 0.008, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // canopy puffs: union outline, sun-side highlight, down-left shade
  const puffs = birch
    ? [[0, -0.62, 0.2], [-0.18, -0.5, 0.16], [0.19, -0.52, 0.17], [0, -0.8, 0.14], [-0.1, -0.7, 0.13]]
    : [[0, -0.6, 0.26], [-0.22, -0.48, 0.2], [0.23, -0.5, 0.21], [-0.1, -0.78, 0.18], [0.13, -0.8, 0.17]];
  const canopy = birch ? PALETTE.birchLeaf : PALETTE.canopy;
  const puffPath = () => {
    ctx.beginPath();
    for (const [px, py, r] of puffs) {
      ctx.moveTo(x + (px + lean) * T * s + r * T * s, baseY + py * T * s);
      ctx.arc(x + (px + lean) * T * s, baseY + py * T * s, r * T * s, 0, Math.PI * 2);
    }
  };
  puffPath();
  ctx.fillStyle = canopy; ctx.fill();
  outline(ctx, T, 0.6);
  // Shading without a clip: each highlight/shade disc is small enough, and offset little enough,
  // to stay inside its own puff (offset < r - r_inner), so nothing leaks past the outline.
  ctx.fillStyle = birch ? 'rgba(220,240,150,0.55)' : 'rgba(140,215,90,0.6)';
  ctx.beginPath();
  for (const [px, py, r] of puffs) {
    const rr = r * 0.66, ox2 = r * 0.24, oy2 = -r * 0.22;
    ctx.moveTo(x + (px + lean + ox2) * T * s + rr * T * s, baseY + (py + oy2) * T * s);
    ctx.arc(x + (px + lean + ox2) * T * s, baseY + (py + oy2) * T * s, rr * T * s, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(30,70,20,0.42)';
  ctx.beginPath();
  for (const [px, py, r] of puffs) {
    const rr = r * 0.6, ox2 = -r * 0.24, oy2 = r * 0.3;
    ctx.moveTo(x + (px + lean + ox2) * T * s + rr * T * s, baseY + (py + oy2) * T * s);
    ctx.arc(x + (px + lean + ox2) * T * s, baseY + (py + oy2) * T * s, rr * T * s, 0, Math.PI * 2);
  }
  ctx.fill();
  if (fruit) {
    ctx.fillStyle = PALETTE.fruitRed;
    for (let i = 0; i < 6; i++) {
      const [px, py, r] = puffs[i % puffs.length];
      ctx.beginPath();
      ctx.arc(x + (px + lean + (prand(i, 83) - 0.5) * r) * T * s, baseY + (py + (prand(i, 84) - 0.5) * r) * T * s, T * 0.03 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawBush(ctx, x, y, size = 1, opts = {}) {
  const T = 104 * size, v = opts.variant ?? 0.5, s = 0.8 + v * 0.4;
  const baseY = y + T * 0.5;
  groundShadow(ctx, x, baseY, T * 0.22 * s, T * 0.08 * s, T, 0.3);
  const puffs = [[-0.12, -0.1, 0.13], [0.12, -0.1, 0.13], [0, -0.2, 0.15], [0, -0.06, 0.12]];
  const path = () => {
    ctx.beginPath();
    for (const [px, py, r] of puffs) { ctx.moveTo(x + px * T * s + r * T * s, baseY + py * T * s); ctx.arc(x + px * T * s, baseY + py * T * s, r * T * s, 0, Math.PI * 2); }
  };
  path(); ctx.fillStyle = PALETTE.canopyDark; ctx.fill(); outline(ctx, T, 0.45);
  ctx.fillStyle = 'rgba(140,215,90,0.5)';
  ctx.beginPath(); ctx.arc(x + T * 0.04 * s, baseY - T * 0.21 * s, T * 0.11 * s, 0, Math.PI * 2); ctx.fill();
  if (v > 0.6) {
    ctx.fillStyle = '#8a1a2e';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + (prand(i, 85) - 0.5) * T * 0.24 * s, baseY - T * (0.08 + prand(i, 86) * 0.16) * s, T * 0.022 * s, 0, Math.PI * 2); ctx.fill(); }
  }
}

export function drawRock(ctx, x, y, size = 1, opts = {}) {
  const T = 104 * size, v = opts.variant ?? 0.5, s = 0.7 + v * 0.6;
  const baseY = y + T * 0.5;
  groundShadow(ctx, x, baseY, T * 0.2 * s, T * 0.07 * s, T, 0.15);
  ctx.beginPath();
  ctx.moveTo(x - T * 0.2 * s, baseY);
  ctx.lineTo(x - T * 0.16 * s, baseY - T * 0.13 * s);
  ctx.lineTo(x - T * 0.02 * s, baseY - T * 0.2 * s);
  ctx.lineTo(x + T * 0.14 * s, baseY - T * 0.15 * s);
  ctx.lineTo(x + T * 0.2 * s, baseY - T * 0.02 * s);
  ctx.closePath();
  ctx.fillStyle = PALETTE.rock; ctx.fill(); outline(ctx, T, 0.45);
  ctx.fillStyle = PALETTE.rockLight;
  ctx.beginPath(); ctx.moveTo(x - T * 0.01 * s, baseY - T * 0.18 * s); ctx.lineTo(x + T * 0.12 * s, baseY - T * 0.14 * s); ctx.lineTo(x + T * 0.04 * s, baseY - T * 0.08 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(40,40,36,0.35)';
  ctx.beginPath(); ctx.moveTo(x - T * 0.17 * s, baseY - T * 0.02 * s); ctx.lineTo(x - T * 0.14 * s, baseY - T * 0.11 * s); ctx.lineTo(x - T * 0.04 * s, baseY - T * 0.04 * s); ctx.lineTo(x + T * 0.16 * s, baseY - T * 0.02 * s); ctx.closePath(); ctx.fill();
}

export function drawStump(ctx, x, y, size = 1) {
  const T = 104 * size, baseY = y + T * 0.5;
  groundShadow(ctx, x, baseY, T * 0.14, T * 0.05, T, 0.1);
  ctx.fillStyle = PALETTE.trunkDark;
  ctx.beginPath(); ctx.roundRect(x - T * 0.1, baseY - T * 0.14, T * 0.2, T * 0.14, T * 0.01); ctx.fill(); outline(ctx, T, 0.4);
  ctx.fillStyle = PALETTE.woodLight;
  ctx.beginPath(); ctx.ellipse(x, baseY - T * 0.14, T * 0.1, T * 0.045, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.4);
  ctx.strokeStyle = 'rgba(107,68,35,0.6)'; ctx.lineWidth = Math.max(1, T * 0.012);
  ctx.beginPath(); ctx.ellipse(x, baseY - T * 0.14, T * 0.06, T * 0.027, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, baseY - T * 0.14, T * 0.03, T * 0.013, 0, 0, Math.PI * 2); ctx.stroke();
}

/**
 * Boundary rail on the edges of an owned tile that face unowned land. opts.sides is a string of
 * N/E/S/W; each letter draws that edge of the tile diamond. (x, y) is the tile's top vertex.
 */
export function drawRail(ctx, x, y, size = 1, opts = {}) {
  const T = 104 * size;
  const sides = opts.sides || '';
  const c = footprintCorners(x, y, 1, 1, T);
  if (sides.includes('N')) fenceEdge(ctx, c.top, c.east, 1, T);
  if (sides.includes('W')) fenceEdge(ctx, c.top, c.west, 1, T);
  if (sides.includes('S')) fenceEdge(ctx, c.west, c.south, 1, T);
  if (sides.includes('E')) fenceEdge(ctx, c.east, c.south, 1, T);
}

/** "For sale" post on a locked expansion. opts: { level, locked, cost }. */
export function drawSignpost(ctx, x, y, size = 1, opts = {}) {
  const T = 104 * size, baseY = y + T * 0.5;
  groundShadow(ctx, x, baseY, T * 0.16, T * 0.06, T, 0.5);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.beginPath(); ctx.roundRect(x - T * 0.03, baseY - T * 0.52, T * 0.06, T * 0.54, T * 0.01); ctx.fill(); outline(ctx, T, 0.4);
  ctx.fillStyle = opts.locked ? PALETTE.derelictWall : PALETTE.trimLight;
  ctx.beginPath(); ctx.roundRect(x - T * 0.26, baseY - T * 0.66, T * 0.52, T * 0.26, T * 0.03); ctx.fill(); outline(ctx, T, 0.5);
  ctx.save();
  ctx.fillStyle = opts.locked ? '#6f6552' : PALETTE.outline;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(6, Math.round(T * 0.09))}px sans-serif`;
  ctx.fillText(opts.locked ? `LEVEL ${opts.level ?? '?'}` : 'FOR SALE', x, baseY - T * 0.57);
  ctx.font = `${Math.max(5, Math.round(T * 0.075))}px sans-serif`;
  ctx.fillText(opts.locked ? 'not yet' : `🪙${opts.cost ?? ''}`, x, baseY - T * 0.47);
  ctx.restore();
}

/** Scenery dispatcher for renderer.js: obj = { type, variant, species, sides }. */
export function drawScenery(ctx, x, y, size, obj = {}) {
  switch (obj.type) {
    case 'tree': return drawTree(ctx, x, y, size, { kind: obj.species, variant: obj.variant });
    case 'bush': return drawBush(ctx, x, y, size, { variant: obj.variant });
    case 'rock': return drawRock(ctx, x, y, size, { variant: obj.variant });
    case 'stump': return drawStump(ctx, x, y, size);
    case 'rail': return drawRail(ctx, x, y, size, { sides: obj.sides });
    default: return drawBush(ctx, x, y, size, { variant: obj.variant });
  }
}

/** Circular building/animal progress ring — fraction 0..1, drawn above the sprite. */
export function drawProgressRing(ctx, x, y, r, fraction) {
  const f = Math.max(0, Math.min(1, fraction || 0));
  ctx.save();
  ctx.strokeStyle = 'rgba(58,37,16,0.28)';
  ctx.lineWidth = r * 0.26;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = f >= 1 ? PALETTE.gold : '#7fd4f0';
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** Soft moving cloud shadow, screen-space ellipse. */
/**
 * The shadow of a passing cloud: three soft overlapping blobs, each a radial fall-off through the
 * cached unit gradient (a flat wash on a context that cannot make gradients). renderer.js places
 * them in world space so they drift over the farm and pan with it.
 */
export function drawCloudShadow(ctx, x, y, r) {
  const stops = [[0, 'rgba(30,60,20,0.17)'], [0.55, 'rgba(30,60,20,0.11)'], [1, 'rgba(30,60,20,0)']];
  for (const [dx, dy, kx, ky] of [[0, 0, 1.7, 0.55], [-0.9, 0.25, 1.1, 0.4], [0.95, -0.2, 1.2, 0.42]]) {
    const cx = x + dx * r, cy = y + dy * r * 0.5, rx = r * kx, ry = r * ky;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    fillUnit(ctx, 'cloudShadow', 'r', stops, cx - rx, cy - ry, rx * 2, ry * 2, 'rgba(30,60,20,0.05)');
  }
}

export function drawPlaceholder(ctx, x, y, size, label) {
  const T = 104 * size;
  ctx.fillStyle = 'rgba(255,0,255,0.5)';
  ctx.beginPath(); ctx.arc(x, y, T * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(T * 0.14)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(label || '?'), x, y + T * 0.04);
}
