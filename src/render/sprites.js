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

/** Warm rim-light stroke on the sun-facing (upper-right) edge of big structures only. */
function rimLight(ctx, T = 104) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,225,150,0.5)';
  ctx.lineWidth = outlineWidth(T) * 0.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
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
function paintLighting(ctx, w, h, sunColor, vignetteColor) {
  const sun = radialGradient(ctx, w * 0.72, -h * 0.18, 0, w * 0.72, -h * 0.18, h * 1.15,
    [[0, sunColor], [1, 'rgba(0,0,0,0)']], null);
  if (sun) { ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h); }
  const vig = radialGradient(ctx, w / 2, h * 0.45, h * 0.34, w / 2, h * 0.5, h * 1.02,
    [[0, 'rgba(0,0,0,0)'], [1, vignetteColor]], null);
  if (vig) { ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h); }
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
  const key = `${w}x${h}|${sunColor}|${vignetteColor}`;
  if (typeof document !== 'undefined' && typeof ctx.drawImage === 'function') {
    let layer = lightLayers.get(ctx);
    if (!layer || layer.key !== key) {
      try {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
        const lctx = c.getContext('2d');
        if (lctx && typeof lctx.createRadialGradient === 'function') {
          paintLighting(lctx, w, h, sunColor, vignetteColor);
          layer = { key, canvas: c };
          lightLayers.set(ctx, layer);
        } else layer = null;
      } catch { layer = null; }
    }
    if (layer) { ctx.drawImage(layer.canvas, 0, 0, w, h); return; }
  }
  paintLighting(ctx, w, h, sunColor, vignetteColor);
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
  dia(0);
  ctx.fillStyle = linearGradient(ctx, x, y, x, y + T, [[0, PALETTE.soilLight], [1, PALETTE.soil]], PALETTE.soil);
  ctx.fill();
  // Furrows run along the tile's OWN axis, not horizontally across it.
  //
  // Horizontal lines drawn over an isometric diamond meet its edges at the wrong angle, so they
  // read as plank divisions rather than ploughed rows, and a 3x2 block of plots turned into what
  // looked like a wooden boardwalk laid across the meadow. Following the top-right edge instead
  // makes them read as furrows immediately, and each dark groove gets a light ridge alongside it
  // so the soil has some relief rather than being a flat brown lozenge.
  ctx.save(); dia(0); ctx.clip();
  ctx.lineWidth = Math.max(1.6, T * 0.026);
  for (let f = 0.12; f < 1; f += 0.16) {
    const sx = x - f * T, sy = y + (f * T) / 2;
    const ex = x + T - f * T, ey = y + T / 2 + (f * T) / 2;
    const inset = 0.10;   // stop short of both edges so plots do not join into planks
    const ax = sx + (ex - sx) * inset, ay = sy + (ey - sy) * inset;
    const bx = ex - (ex - sx) * inset, by = ey - (ey - sy) * inset;
    ctx.strokeStyle = PALETTE.soilRow;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = 'rgba(196,142,86,0.26)';
    const lift = T * 0.020;
    ctx.beginPath(); ctx.moveTo(ax, ay - lift); ctx.lineTo(bx, by - lift); ctx.stroke();
  }

  // Clods. Turned earth is lumpy, and a few irregular specks do more to sell that than any
  // amount of groove work. Positions come from prand() so a plot never shimmers between frames.
  for (let i = 0; i < 7; i++) {
    const u = prand(i, 3), v = prand(i, 7);
    const cxp = x + (u - 0.5) * T * 1.25;
    const cyp = y + T * 0.5 + (v - 0.5) * T * 0.62;
    ctx.fillStyle = i % 2 ? 'rgba(40,24,8,0.30)' : 'rgba(170,122,72,0.28)';
    ctx.beginPath();
    ctx.ellipse(cxp, cyp, T * (0.016 + u * 0.014), T * (0.009 + v * 0.008), u * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  dia(0);
  outline(ctx, T, 0.7);
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

/** Soft, non-outlined water edge — pond/lake perimeter reeds and ripple highlight. */
export function drawWaterEdge(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y - 4, rx, ry, -0.08, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1.5, ry * 0.07); ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const yy = y - 26 + i * 17, ww = 30 + (i % 2) * 26;
    ctx.beginPath(); ctx.moveTo(x - ww - i * 12, yy);
    ctx.quadraticCurveTo(x - ww / 2 - i * 12, yy - 5, x - i * 12, yy); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#4f9c26'; ctx.lineWidth = Math.max(1.5, ry * 0.07); ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = -0.5 + i * 0.42;
    const bx = x + Math.cos(a) * rx * 1.02, by = y - 4 + Math.sin(a) * ry * 1.02;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 3, by - 16, bx - 2, by - 30); ctx.stroke();
  }
  ctx.restore();
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
export function drawCropStage(ctx, x, y, size, growProgress, config) {
  const T = 104 * size;
  const g = Math.max(0, Math.min(1, growProgress || 0));
  const { head = PALETTE.wheatGold, leaf = '#5fae2e', shape = 'round' } = config || {};

  if (g <= 0) {
    // Planted: 6-8 dark seed dots scattered in the furrows
    ctx.fillStyle = PALETTE.soilDark;
    for (let i = 0; i < 7; i++) {
      const px = x + Math.sin(i * 2.6) * T * 0.5;
      const py = y + T * 0.3 + ((i % 3) / 3) * T * 0.45;
      ctx.beginPath(); ctx.arc(px, py, 2.4 * size, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }

  if (g < 0.5) {
    // Sprout: two small leaf ellipses per dot
    const n = Math.round(6 + g * 4);
    for (let i = 0; i < n; i++) {
      const px = x + Math.sin(i * 2.4) * T * 0.5;
      const py = y + T * 0.36 + ((i % 3) / 3) * T * 0.36;
      ctx.fillStyle = leaf;
      ctx.beginPath(); ctx.ellipse(px - 4 * size, py, 5.5 * size, 3.4 * size, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + 4 * size, py, 5.5 * size, 3.4 * size, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = leaf; ctx.lineWidth = 2.2 * size;
      ctx.beginPath(); ctx.moveTo(px, py + 7 * size); ctx.lineTo(px, py - 1 * size); ctx.stroke();
    }
    return;
  }

  // Growing (0.5-1) and Ready (1): stem + head, height scales toward full at g==1.
  const heightScale = g >= 1 ? 1 : 0.7;
  if (shape === 'conifer' || shape === 'tree') {
    // Three young trees on the plot, growing to a little over half a tile tall when ready.
    const s = size * (g >= 1 ? 0.5 : 0.36);
    for (const [u, v, k] of [[0.5, 0.35, 0.3], [0.22, 0.62, 0.7], [0.74, 0.66, 0.5]]) {
      const px = x + (u - v) * T, py = y + (u + v) * (T / 2);
      drawTree(ctx, px, py - 104 * s * 0.5, s, { kind: shape === 'conifer' ? 'pine' : (g >= 1 ? 'fruit' : 'oak'), variant: k });
    }
    return;
  }
  const n = 9;
  for (let i = 0; i < n; i++) {
    const px = x + Math.sin(i * 2.7) * T * 0.6;
    const py = y + T * 0.28 + ((i % 4) / 4) * T * 0.5;
    const stemLen = 16 * size * heightScale;
    ctx.strokeStyle = leaf; ctx.lineWidth = 3.2 * size;
    ctx.beginPath();
    ctx.moveTo(px, py + 12 * size);
    ctx.quadraticCurveTo(px + 3 * size, py + 2 * size, px, py - stemLen);
    ctx.stroke();

    const headColor = g >= 1 ? head : mix(head, leaf, 0.45);
    ctx.fillStyle = headColor;
    ctx.beginPath();
    switch (shape) {
      case 'blade':
      case 'root':
      case 'spike':
        ctx.ellipse(px, py - stemLen - 4 * size, 3.6 * size, 8 * size, 0.15, 0, Math.PI * 2);
        break;
      case 'ear':
        ctx.ellipse(px, py - stemLen - 6 * size, 4.4 * size, 9 * size, 0, 0, Math.PI * 2);
        break;
      case 'cluster':
      case 'berry':
        for (const [ox, oy] of [[0, 0], [-3, 4], [3, 4]]) {
          ctx.moveTo(px + (ox + 4) * size, (py - stemLen - 4 * size) + oy * size);
          ctx.arc(px + ox * size, (py - stemLen - 4 * size) + oy * size, 3.6 * size, 0, Math.PI * 2);
        }
        break;
      case 'orb':
        ctx.arc(px, py - stemLen + 2 * size, 8 * size * heightScale, 0, Math.PI * 2);
        break;
      case 'pod':
        ctx.ellipse(px, py - stemLen - 2 * size, 3.2 * size, 9 * size, -0.2, 0, Math.PI * 2);
        break;
      case 'puff':
        ctx.arc(px, py - stemLen - 4 * size, 5.5 * size, 0, Math.PI * 2);
        break;
      case 'star':
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          const hx = px + Math.cos(a) * 5 * size, hy = (py - stemLen - 4 * size) + Math.sin(a) * 5 * size;
          if (k === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        break;
      default:
        ctx.ellipse(px, py - stemLen - 4 * size, 4 * size, 8 * size, 0.15, 0, Math.PI * 2);
    }
    ctx.fill();
    if (g >= 0.85) outline(ctx, T, 0.32);
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
  ctx.fill();
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
  const T = 104 * size;
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

  groundShadow(ctx, x, y - T * 0.08 + BH * 0.7, BW * 0.6, BH * 0.2, T);

  // Behind the shell.
  drawExtras(ctx, x, yy, BW, BH, T,
    extras.filter((e) => e === 'silo' || e === 'pipes'), cfg, derelict, size, t, working);

  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = wallColor;
  ctx.beginPath(); ctx.roundRect(x - BW / 2, yy - BH * 0.16, BW, BH, T * 0.06); ctx.fill();
  outline(ctx, T);

  ctx.save();
  if (derelict) { ctx.translate(x, yy); ctx.rotate(-0.06); ctx.translate(-x, -yy); }
  drawRoofForm(ctx, x, yy, BW, BH, T, cfg.form || 'gable', roofColor, derelict, size);
  ctx.restore();
  clearFilter(ctx);

  if (!derelict) rimLight(ctx, T);

  drawExtras(ctx, x, yy, BW, BH, T,
    extras.filter((e) => e === 'chimney'), cfg, derelict, size, t, working);

  // Windows: cool when idle, warm and gently pulsing when a craft is running.
  applyDerelictFilter(ctx, derelict);
  if (!derelict) {
    const glow = working ? 0.55 + 0.25 * Math.sin(t * 2.6) : 0;
    ctx.fillStyle = working
      ? 'rgb(' + Math.round(127 + 128 * glow) + ',' + Math.round(212 + 18 * glow) + ',' + Math.round(240 - 100 * glow) + ')'
      : PALETTE.window;
    ctx.beginPath();
    ctx.roundRect(x - BW * 0.30, yy + BH * 0.02, BW * 0.18, BH * 0.24, T * 0.02);
    ctx.fill();
    outline(ctx, T, 0.4);
    if (working) {
      ctx.fillStyle = 'rgba(255,214,120,' + (0.20 * glow).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x - BW * 0.21, yy + BH * 0.14, T * 0.11, 0, Math.PI * 2); ctx.fill();
    }
  }
  // A derelict building omits its window entirely (SPRITE-NOTES §6), so there is deliberately
  // no else-branch here - only the door is drawn.
  ctx.fillStyle = derelictColor(PALETTE.wood);
  ctx.beginPath();
  ctx.roundRect(x + BW * 0.06, yy + BH * 0.06, BW * 0.22, BH * 0.42, T * 0.02);
  ctx.fill();
  outline(ctx, T, 0.4);
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
  groundShadow(ctx, x, y + h * 0.66, w * 0.62, h * 0.2, T);
}

export function drawBarn(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, BW = T * 1.7, BH = T * 1.0, yy = y - T * 0.08;
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
  if (!derelict) rimLight(ctx, T);
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
  groundShadow(ctx, x, yy + 6, SW * 0.72, T * 0.13, T);
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
  if (!derelict) rimLight(ctx, T);
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
  const T = 104 * size, rx = T * 1.4, ry = T * 0.6, yy = y;
  ctx.beginPath(); ctx.ellipse(x, yy, rx, ry, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#2f6f96'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, yy - 4, rx * 0.97, ry * 0.93, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = linearGradient(ctx, x, yy - ry, x, yy + ry, [[0, PALETTE.waterLight], [1, PALETTE.water]], PALETTE.water);
  ctx.fill();
  outline(ctx, T);
  drawWaterEdge(ctx, x, yy, rx * 0.97, ry * 0.93);
}
export const drawLake = drawPond;

export function drawMineEntrance(ctx, x, y, size, opts = {}) {
  const derelict = !!opts.derelict, T = 104 * size, yy = y - T * 0.06;
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
  const w = T * 1.8, h = T * 0.62;
  groundShadow(ctx, x, yy + h * 0.6, w * 0.55, h * 0.25, T);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = derelict ? PALETTE.derelictWall : PALETTE.wall;
  ctx.beginPath(); ctx.roundRect(x - w / 2, yy - h * 0.1, w, h * 0.6, T * 0.06); ctx.fill();
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
  const w = T * 1.1, h = T * 0.4;
  groundShadow(ctx, x, yy + h * 0.7, w * 0.6, h * 0.24, T);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = derelict ? PALETTE.derelictWall : PALETTE.wall;
  ctx.beginPath(); ctx.roundRect(x - w / 2, yy - h * 0.1, w, h * 0.6, T * 0.05); ctx.fill();
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
  const w = T * 1.3, h = T * 0.5;
  groundShadow(ctx, x, yy + h * 0.7, w * 0.6, h * 0.22, T);
  applyDerelictFilter(ctx, derelict);
  const wall = derelict ? PALETTE.derelictWall : PALETTE.cream;
  ctx.fillStyle = wall;
  ctx.beginPath(); ctx.roundRect(x - w / 2, yy - h * 0.06, w, h * 0.6, T * 0.03); ctx.fill();
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
  const w = T * 0.7, h = T * 0.42;
  groundShadow(ctx, x, yy + h * 0.6, w * 0.6, h * 0.24, T);
  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = derelict ? PALETTE.derelictWall : PALETTE.wall;
  ctx.beginPath(); ctx.roundRect(x - w / 2, yy - h * 0.1, w, h * 0.6, T * 0.04); ctx.fill();
  outline(ctx, T);
  clearFilter(ctx);
  if (!derelict) rimLight(ctx, T);
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

const DECO_SHAPES = ['flowerbed', 'statue', 'lamp', 'bench', 'fountain'];
function decoShapeFor(decoId) {
  let h = 0;
  for (let i = 0; i < decoId.length; i++) h = (h * 31 + decoId.charCodeAt(i)) >>> 0;
  return DECO_SHAPES[h % DECO_SHAPES.length];
}

/** Generic decoration prop: shape chosen deterministically from decoId, since decorations
 *  are cosmetic-only and do not need bespoke per-id art. */
export function drawDecoration(ctx, x, y, size, decoId) {
  const T = 104 * size;
  const shape = decoShapeFor(String(decoId || 'flowerbed'));
  groundShadow(ctx, x, y + T * 0.14, T * 0.22, T * 0.07, T);
  if (shape === 'flowerbed') {
    ctx.fillStyle = PALETTE.soilDark;
    ctx.beginPath(); ctx.ellipse(x, y, T * 0.2, T * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    outline(ctx, T, 0.4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.fillStyle = [PALETTE.flowerPink, PALETTE.flowerYellow, PALETTE.flowerWhite][i % 3];
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * T * 0.12, y + Math.sin(a) * T * 0.05, T * 0.025, 0, Math.PI * 2); ctx.fill();
    }
  } else if (shape === 'statue') {
    ctx.fillStyle = '#c9c0a8';
    ctx.beginPath(); ctx.roundRect(x - T * 0.1, y - T * 0.02, T * 0.2, T * 0.1, T * 0.02); ctx.fill(); outline(ctx, T, 0.5);
    ctx.beginPath(); ctx.roundRect(x - T * 0.06, y - T * 0.24, T * 0.12, T * 0.24, T * 0.02); ctx.fill(); outline(ctx, T, 0.5);
  } else if (shape === 'lamp') {
    ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = T * 0.025;
    ctx.beginPath(); ctx.moveTo(x, y + T * 0.1); ctx.lineTo(x, y - T * 0.2); ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(x, y - T * 0.24, T * 0.06, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.4);
  } else if (shape === 'bench') {
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath(); ctx.roundRect(x - T * 0.2, y - T * 0.02, T * 0.4, T * 0.05, 2); ctx.fill(); outline(ctx, T, 0.4);
    ctx.fillRect(x - T * 0.17, y - T * 0.13, T * 0.03, T * 0.11);
    ctx.fillRect(x + T * 0.14, y - T * 0.13, T * 0.03, T * 0.11);
  } else {
    ctx.fillStyle = PALETTE.water;
    ctx.beginPath(); ctx.ellipse(x, y, T * 0.16, T * 0.08, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, T, 0.4);
    ctx.fillStyle = PALETTE.waterLight;
    ctx.beginPath(); ctx.arc(x, y - T * 0.1, T * 0.03, 0, Math.PI * 2); ctx.fill();
  }
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
export function drawCloudShadow(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(40,80,30,0.08)';
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
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
