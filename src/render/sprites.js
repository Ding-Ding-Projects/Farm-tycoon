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
  soil: '#9c6432', soilLight: '#b87c40', soilDark: '#6f4218', soilRow: 'rgba(58,37,16,0.44)',
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
};

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

/** Ground shadow ellipse, offset away from the sun (upper-right source). */
function groundShadow(ctx, x, y, rx, ry, T = 104) {
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(x + T * 0.10, y + T * 0.05, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Deterministic pseudo-random in [0,1) — stable across frames for foliage/tuft scatter. */
function prand(i, salt = 0) {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function applyDerelictFilter(ctx, derelict) {
  if (derelict) ctx.filter = 'saturate(0.45)';
}
function clearFilter(ctx) { ctx.filter = 'none'; }

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
export function drawGoldenHour(ctx, w, h) {
  const sun = ctx.createRadialGradient(w * 0.72, -h * 0.18, 0, w * 0.72, -h * 0.18, h * 1.15);
  sun.addColorStop(0, PALETTE.sun); sun.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);

  const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.34, w / 2, h * 0.5, h * 1.02);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, PALETTE.vignette);
  ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------------------
// Terrain (ground rule: continuous meadow — grid squares only in placement/edit mode)
// ---------------------------------------------------------------------------------------

/** Continuous meadow base fill + low-frequency mottling. Call once per frame, full canvas. */
export function drawMeadow(ctx, w, h) {
  const field = ctx.createLinearGradient(0, 0, 0, h);
  field.addColorStop(0, PALETTE.grassLight);
  field.addColorStop(0.55, PALETTE.grass);
  field.addColorStop(1, PALETTE.grassDark);
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 18; i++) {
    const px = prand(i, 1) * w, py = prand(i, 2) * h;
    const rx = (0.09 + prand(i, 3) * 0.17) * w, ry = rx * (0.32 + prand(i, 4) * 0.2);
    const g = ctx.createRadialGradient(px, py, 0, px, py, rx);
    g.addColorStop(0, i % 2 ? PALETTE.grassMottleLight : PALETTE.grassMottleDark);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, ry / rx);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** Sparse grass tufts + tiny flowers scattered across a screen-space rect. */
export function drawGroundDetail(ctx, w, h, topClear = 90) {
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const px = prand(i, 5) * w, py = topClear + prand(i, 6) * (h - topClear);
    ctx.strokeStyle = 'rgba(58,37,16,0.34)';
    ctx.lineWidth = 2.2;
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(px + dx, py + 5);
      ctx.quadraticCurveTo(px + dx * 1.4, py - 2, px + dx * 1.9, py - 8);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 16; i++) {
    const px = prand(i, 7) * w, py = topClear + prand(i, 8) * (h - topClear);
    ctx.fillStyle = i % 3 === 0 ? PALETTE.flowerWhite : i % 3 === 1 ? PALETTE.flowerYellow : PALETTE.flowerPink;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * 4.2, py + Math.sin(a) * 4.2, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(px, py, 2.3, 0, Math.PI * 2); ctx.fill();
  }
}

/** Placement/edit-mode grid diamond outline for one tile. Never drawn during normal play. */
export function drawGrassTile(ctx, x, y, size = 1) {
  const T = 104 * size;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + T, y + T / 2);
  ctx.lineTo(x, y + T); ctx.lineTo(x - T, y + T / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Raised-slab soil plot for a field/crop tile: side thickness + top face + furrows. */
export function drawSoilPlot(ctx, x, y, size = 1) {
  const T = 104 * size, D = 11;
  const dia = (yOff, k = 1) => {
    ctx.beginPath();
    ctx.moveTo(x, y + yOff); ctx.lineTo(x + T * k, y + T / 2 + yOff);
    ctx.lineTo(x, y + T * k + yOff); ctx.lineTo(x - T * k, y + T / 2 + yOff);
    ctx.closePath();
  };
  groundShadow(ctx, x, y + T / 2 + D, T * 1.0, T * 0.36, T);
  dia(D); ctx.fillStyle = PALETTE.soilDark; ctx.fill();
  dia(0);
  const sg = ctx.createLinearGradient(x, y, x, y + T);
  sg.addColorStop(0, PALETTE.soilLight); sg.addColorStop(1, PALETTE.soil);
  ctx.fillStyle = sg; ctx.fill();
  ctx.save(); dia(0); ctx.clip();
  ctx.strokeStyle = PALETTE.soilRow; ctx.lineWidth = 3.5;
  for (let f = 0.22; f < 1; f += 0.26) {
    ctx.beginPath(); ctx.moveTo(x - T, y + T * f); ctx.lineTo(x + T, y + T * f); ctx.stroke();
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
  ctx.lineWidth = 2;
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
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const yy = y - 26 + i * 17, ww = 30 + (i % 2) * 26;
    ctx.beginPath(); ctx.moveTo(x - ww - i * 12, yy);
    ctx.quadraticCurveTo(x - ww / 2 - i * 12, yy - 5, x - i * 12, yy); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#4f9c26'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = -0.5 + i * 0.42;
    const bx = x + Math.cos(a) * rx * 1.02, by = y - 4 + Math.sin(a) * ry * 1.02;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 3, by - 16, bx - 2, by - 30); ctx.stroke();
  }
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

/** Crop id → draw function, for callers that only have the data.js id string. */
export const CROP_DRAW = {
  wheat: drawWheat, corn: drawCorn, carrot: drawCarrot, soybean: drawSoybean,
  sugarcane: drawSugarcane, cotton: drawCotton, tomato: drawTomato, potato: drawPotato,
  strawberry: drawStrawberry, pumpkin: drawPumpkin, indigo: drawIndigo, chili: drawChili,
  coffee: drawCoffee, grapes: drawGrapes, rice: drawRice, olive: drawOlive,
  lavender: drawLavender, tea_leaf: drawTeaLeaf, bell_pepper: drawBellPepper,
  peony: drawPeony, watermelon: drawWatermelon, mint: drawMint,
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

/** Fenced pen enclosure (animal home) — footprint scales with penType via `size`. */
export function drawPen(ctx, x, y, size = 2, penType) {
  const T = 104;
  const w = T * size * 0.94, h = T * size * 0.5;
  groundShadow(ctx, x, y + h * 0.55, w * 0.52, h * 0.3, T);
  ctx.fillStyle = PALETTE.soilLight;
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.3); ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x, y + h * 0.3); ctx.lineTo(x - w * 0.5, y);
  ctx.closePath(); ctx.fill();
  outline(ctx, T, 0.6);
  ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = 4;
  const posts = 8;
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const px = x - w * 0.5 + t * w, py = y + (t < 0.5 ? -h * 0.3 * (1 - t * 2) : h * 0.3 * (t - 0.5) * 2);
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(px - 2, py - 18, 4, 20);
    ctx.strokeRect(px - 2, py - 18, 4, 20);
  }
  ctx.fillStyle = PALETTE.trimLight;
  ctx.beginPath(); ctx.roundRect(x - 14, y - 8, 28, 14, 3); ctx.fill();
  outline(ctx, T, 0.4);
  if (penType) {
    // small label plaque accent so the pen reads as a distinct animal type
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath(); ctx.roundRect(x - 20, y + h * 0.32, 40, 12, 3); ctx.fill();
  }
}

// ---------------------------------------------------------------------------------------
// Buildings — production recipe buildings. One shared shape generator, keyed by category.
// ---------------------------------------------------------------------------------------

const BUILDING_CONFIG = {
  feed_mill:   { roof: PALETTE.roofAlt, accent: 'blades' },
  bakery:      { roof: PALETTE.roof, accent: 'smoke' },
  dairy:       { roof: '#4a8fd4', accent: 'churn' },
  sugar_mill:  { roof: PALETTE.roofAlt, accent: 'blades' },
  popcorn_pot: { roof: PALETTE.roof, accent: 'pot' },
  grill:       { roof: PALETTE.roofDark, accent: 'smoke' },
  ice_cream_maker: { roof: PALETTE.trimLight, accent: 'churn' },
  soup_kitchen: { roof: PALETTE.roof, accent: 'pot' },
  flower_shop: { roof: PALETTE.roofAlt, accent: 'blades' },
  sauce_maker: { roof: PALETTE.roofDark, accent: 'pot' },
  cake_oven: { roof: PALETTE.roofAlt, accent: 'smoke' },
  pie_oven:    { roof: PALETTE.roof, accent: 'smoke' },
  loom:        { roof: '#9a6fd0', accent: 'wheel' },
  sewing_machine: { roof: '#e05548', accent: 'wheel' },
  juice_press: { roof: '#f0862e', accent: 'pot' },
  jam_maker:   { roof: '#c9382e', accent: 'pot' },
  coffee_kiosk: { roof: '#6a3a20', accent: 'smoke' },
  candy_machine: { roof: '#f48ab0', accent: 'wheel' },
  tropical_cafe: { roof: '#4f9c26', accent: 'smoke' },
  smelter:     { roof: '#5a5a5a', accent: 'smoke' },
  oil_press:   { roof: '#7a8f3a', accent: 'pot' },
  tea_house:   { roof: '#7fae4a', accent: 'smoke' },
  sushi_bar:   { roof: '#4a8fd4', accent: 'pot' },
  perfumery:   { roof: '#9a6fd0', accent: 'pot' },
  salad_bar:   { roof: '#5fae2e', accent: 'pot' },
  pasta_kitchen: { roof: '#f0b52e', accent: 'smoke' },
  fondue_pot:  { roof: '#e05548', accent: 'pot' },
  preservation_station: { roof: '#4a8fd4', accent: 'pot' },
  jeweler:     { roof: '#9a6fd0', accent: 'wheel' },
  yogurt_maker: { roof: '#fffaea', accent: 'churn' },
  build_workshop: { roof: PALETTE.roofDark, accent: 'wheel' },
};

/** Any production building: box + gable roof + doorway + one category accent. */
export function drawBuilding(ctx, x, y, size, buildingType, opts = {}) {
  const derelict = !!opts.derelict;
  const T = 104 * size;
  const cfg = BUILDING_CONFIG[buildingType] || { roof: PALETTE.roof, accent: 'smoke' };
  const roofColor = derelict ? PALETTE.derelictRoof : cfg.roof;
  const wallColor = derelict ? PALETTE.derelictWall : PALETTE.wall;
  const BW = T * 0.86, BH = T * 0.52;
  const yy = y - T * 0.08;

  groundShadow(ctx, x, yy + BH * 0.7, BW * 0.6, BH * 0.2, T);

  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = wallColor;
  ctx.beginPath(); ctx.roundRect(x - BW / 2, yy - BH * 0.16, BW, BH, T * 0.06); ctx.fill();
  outline(ctx, T);

  const tilt = derelict ? 0.06 : 0;
  ctx.save();
  if (derelict) { ctx.translate(x, yy); ctx.rotate(-tilt); ctx.translate(-x, -yy); }
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(x - BW * 0.58, yy - BH * 0.12);
  if (derelict) ctx.lineTo(x - BW * 0.22, yy - BH * 0.6);
  else ctx.lineTo(x - BW * 0.2, yy - BH * 0.78);
  ctx.lineTo(x + BW * 0.2, yy - BH * 0.78);
  ctx.lineTo(x + BW * 0.58, yy - BH * 0.12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PALETTE.trimLight; ctx.lineWidth = 3.6 * size; ctx.stroke();
  outline(ctx, T);
  ctx.restore();
  clearFilter(ctx);

  if (!derelict) rimLight(ctx, T);

  applyDerelictFilter(ctx, derelict);
  ctx.fillStyle = derelict ? '#6a7860' : PALETTE.window;
  const windowOmit = derelict; // "omit one window" per §6
  if (!windowOmit) {
    ctx.beginPath(); ctx.roundRect(x - BW * 0.3, yy + BH * 0.02, BW * 0.18, BH * 0.24, T * 0.02); ctx.fill();
    outline(ctx, T, 0.4);
  }
  ctx.fillStyle = PALETTE.wood;
  ctx.beginPath(); ctx.roundRect(x + BW * 0.06, yy + BH * 0.06, BW * 0.22, BH * 0.42, T * 0.02); ctx.fill();
  outline(ctx, T, 0.4);
  clearFilter(ctx);

  // category accent
  if (!derelict) {
    if (cfg.accent === 'smoke') {
      ctx.fillStyle = roofColor;
      ctx.fillRect(x + BW * 0.28, yy - BH * 0.82, T * 0.06, T * 0.14);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + BW * 0.31 + i * 3 * size, yy - BH * 0.9 - i * 10 * size, (5 - i) * size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (cfg.accent === 'blades') {
      ctx.save();
      ctx.translate(x, yy - BH * 0.78);
      ctx.strokeStyle = PALETTE.trimLight; ctx.lineWidth = 4 * size;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -T * 0.16); ctx.stroke();
      }
      ctx.restore();
    } else if (cfg.accent === 'wheel') {
      ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = 3 * size;
      ctx.beginPath(); ctx.arc(x - BW * 0.36, yy + BH * 0.14, T * 0.09, 0, Math.PI * 2); ctx.stroke();
    } else if (cfg.accent === 'pot') {
      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath(); ctx.ellipse(x - BW * 0.32, yy + BH * 0.2, T * 0.08, T * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      outline(ctx, T, 0.3);
    } else if (cfg.accent === 'churn') {
      ctx.fillStyle = PALETTE.silo;
      ctx.beginPath(); ctx.roundRect(x - BW * 0.34, yy + BH * 0.08, T * 0.1, T * 0.16, T * 0.02); ctx.fill();
      outline(ctx, T, 0.3);
    }
  } else {
    derelictDebris(ctx, x, yy + BH * 0.3, T);
  }
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
  const bg = ctx.createLinearGradient(x - BW / 2, 0, x + BW / 2, 0);
  bg.addColorStop(0, roofColor); bg.addColorStop(1, roofDark);
  ctx.fillStyle = bg;
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
  const g = ctx.createLinearGradient(x - SW / 2, 0, x + SW / 2, 0);
  g.addColorStop(0, derelict ? PALETTE.derelictWall : PALETTE.siloLight);
  g.addColorStop(0.5, derelict ? '#a89878' : PALETTE.silo);
  g.addColorStop(1, derelict ? '#8a7f68' : PALETTE.siloDark);
  ctx.fillStyle = g; ctx.fillRect(x - SW / 2, yy - SH, SW, SH);
  ctx.strokeStyle = 'rgba(58,37,16,0.26)'; ctx.lineWidth = 2;
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
  ctx.strokeStyle = 'rgba(58,37,16,0.3)'; ctx.lineWidth = 2;
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
  ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = 3;
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
  const wg = ctx.createLinearGradient(x, yy - ry, x, yy + ry);
  wg.addColorStop(0, PALETTE.waterLight); wg.addColorStop(1, PALETTE.water);
  ctx.fillStyle = wg; ctx.fill();
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
  ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = 3;
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
  ctx.strokeStyle = PALETTE.wood; ctx.lineWidth = 5;
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
    ctx.fillRect(px - 3, yy - h * 0.6, 6, h * 0.7);
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
  ctx.fillStyle = PALETTE.outline;
  ctx.font = `${Math.round(T * 0.16)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ZOO', x, yy - T * 0.42);
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
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * 3.4, py + Math.sin(a) * 3.4, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill();
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
    ctx.fillRect(px - 1.4, py - 4, 2.8, 6);
    ctx.fillStyle = '#c9382e';
    ctx.beginPath(); ctx.arc(px, py - 5, 3.6, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff8ee';
    for (const dx of [-1.2, 1.2]) { ctx.beginPath(); ctx.arc(px + dx, py - 6, 0.7, 0, Math.PI * 2); ctx.fill(); }
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
  ctx.beginPath(); ctx.arc(x + T * 0.17, yy - T * 0.11, 1.6, 0, Math.PI * 2); ctx.fill();
}

export function drawDog(ctx, x, y, size, idleFrame) {
  drawPetBody(ctx, x, y, size, idleFrame, '#c08a4e', 'floppy');
}
export function drawCat(ctx, x, y, size, idleFrame) {
  drawPetBody(ctx, x, y, size, idleFrame, '#8a7f68', 'pointy');
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
