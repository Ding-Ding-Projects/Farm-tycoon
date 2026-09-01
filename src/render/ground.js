// ground.js — the world's ground plane.
//
// The meadow used to be painted in SCREEN space: a full-canvas gradient, eighteen mottle blobs
// and ninety tufts scattered by loop index, all re-created every frame. Panning slid the farm
// underneath a texture that never moved, and zooming changed nothing about it. Everything here
// is anchored to WORLD tiles instead:
//
//   1. A cached ground texture (one offscreen canvas per land kind, built once, tileable) is
//      applied as a canvas pattern under the SAME affine map tileToScreen uses, so it pans and
//      zooms with the farm for the cost of a handful of fillRect calls. Land the player has not
//      bought yet gets a rougher, darker texture, so the edge of the farm is visible on the ground
//      itself rather than only implied.
//   2. Upright detail — grass tufts, flowers, pebbles, ferns — is scattered per VISIBLE tile from
//      a hash of the tile coordinate, sized in tile units, and batched into a few strokes.
//
// Nothing here runs under Node's test harness (renderer.drawFrame returns before it without a
// live context), but every entry point still degrades to flat fills when there is no document.

import { PALETTE, prand, tileHash } from './sprites.js';

const PATCH_TILES = 8;     // one texture covers 8x8 tiles of ground plane
const PATCH_PX = 1024;     // texture resolution: 128 px per tile, 1.6x the on-screen tile at zoom 1
const BASE_PX = 256;       // the low-frequency octaves are built at this size and upscaled

const KINDS = {
  meadow: { dark: [109, 168, 40], mid: [142, 203, 54], light: [168, 220, 82], warm: [185, 201, 76], dirt: [140, 122, 70], grain: 9, seed: 0 },
  rough: { dark: [72, 112, 30], mid: [96, 140, 42], light: [122, 166, 58], warm: [138, 138, 60], dirt: [110, 95, 56], grain: 16, seed: 50 },
};

const FLAT = { meadow: PALETTE.grass, rough: '#628f2c' };

function makeLattice(n, seed) {
  const a = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) a[i] = prand(i + 1, seed);
  return a;
}

/** Periodic bilinear value noise on an n x n lattice; (u, v) in lattice units, wraps at n. */
function sampleLattice(lat, n, u, v) {
  const x0 = Math.floor(u), y0 = Math.floor(v);
  let fx = u - x0, fy = v - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const xa = ((x0 % n) + n) % n, ya = ((y0 % n) + n) % n;
  const xb = (xa + 1) % n, yb = (ya + 1) % n;
  const a = lat[ya * n + xa], b = lat[ya * n + xb], c = lat[yb * n + xa], d = lat[yb * n + xb];
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

function lerp3(dark, mid, light, t) {
  // 0..0.5 dark->mid, 0.5..1 mid->light
  if (t < 0.5) { const k = t * 2; return [dark[0] + (mid[0] - dark[0]) * k, dark[1] + (mid[1] - dark[1]) * k, dark[2] + (mid[2] - dark[2]) * k]; }
  const k = (t - 0.5) * 2;
  return [mid[0] + (light[0] - mid[0]) * k, mid[1] + (light[1] - mid[1]) * k, mid[2] + (light[2] - mid[2]) * k];
}

const textures = {};

/** Build (once) the tileable texture for a land kind. Returns null without a document. */
function texture(kind) {
  if (textures[kind] !== undefined) return textures[kind];
  if (typeof document === 'undefined' || !document.createElement) { textures[kind] = null; return null; }
  const cfg = KINDS[kind] || KINDS.meadow;
  let out = null;
  try {
    // Low-frequency octaves at BASE_PX, upscaled with bilinear smoothing.
    const base = document.createElement('canvas');
    base.width = base.height = BASE_PX;
    const bctx = base && typeof base.getContext === 'function' ? base.getContext('2d') : null;
    if (!bctx || typeof bctx.createImageData !== 'function') { textures[kind] = null; return null; }
    const img = bctx.createImageData(BASE_PX, BASE_PX);
    const d = img.data;
    const octaves = [[4, 0.42], [8, 0.26], [16, 0.18], [32, 0.14]].map(([n, w], i) => ({ n, w, lat: makeLattice(n, 17 + i + cfg.seed) }));
    const patchLat = makeLattice(3, 99 + cfg.seed);
    for (let y = 0; y < BASE_PX; y++) {
      for (let x = 0; x < BASE_PX; x++) {
        let n = 0;
        for (const o of octaves) n += o.w * sampleLattice(o.lat, o.n, (x * o.n) / BASE_PX, (y * o.n) / BASE_PX);
        const p = sampleLattice(patchLat, 3, (x * 3) / BASE_PX, (y * 3) / BASE_PX);
        let [r, g, b] = lerp3(cfg.dark, cfg.mid, cfg.light, Math.max(0, Math.min(1, n)));
        if (p > 0.6) {                       // sun-dried patch
          const k = Math.min(0.55, (p - 0.6) * 2.2);
          r += (cfg.warm[0] - r) * k; g += (cfg.warm[1] - g) * k; b += (cfg.warm[2] - b) * k;
        }
        if (p < 0.24 && n < 0.5) {           // bare earth showing through thin grass
          const k = Math.min(1, (0.24 - p) * 6) * Math.min(1, (0.5 - n) * 3);
          r += (cfg.dirt[0] - r) * k; g += (cfg.dirt[1] - g) * k; b += (cfg.dirt[2] - b) * k;
        }
        const i = (y * BASE_PX + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);

    const tex = document.createElement('canvas');
    tex.width = tex.height = PATCH_PX;
    const tctx = tex.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(base, 0, 0, PATCH_PX, PATCH_PX);

    // Fine octave + grain at full resolution, so the blades read as blades when zoomed in.
    const fine = tctx.getImageData(0, 0, PATCH_PX, PATCH_PX);
    const f = fine.data;
    const fineLat = makeLattice(64, 31 + cfg.seed);
    for (let y = 0; y < PATCH_PX; y++) {
      for (let x = 0; x < PATCH_PX; x++) {
        const nf = sampleLattice(fineLat, 64, (x * 64) / PATCH_PX, (y * 64) / PATCH_PX) - 0.5;
        const h = tileHash(x + cfg.seed, y);
        const grain = ((h % 1000) / 1000 - 0.5) * cfg.grain;
        const delta = nf * 22 + grain;
        const i = (y * PATCH_PX + x) * 4;
        f[i] = Math.max(0, Math.min(255, f[i] + delta));
        f[i + 1] = Math.max(0, Math.min(255, f[i + 1] + delta * 1.15));
        f[i + 2] = Math.max(0, Math.min(255, f[i + 2] + delta * 0.6));
      }
    }
    tctx.putImageData(fine, 0, 0);
    out = tex;
  } catch (e) {
    console.error(e);
    out = null;
  }
  textures[kind] = out;
  return out;
}

/** Test seam: has the texture for `kind` been built (or been found unbuildable)? */
export function textureState(kind) { return textures[kind] === undefined ? 'unbuilt' : textures[kind] ? 'built' : 'unavailable'; }

// THE PERIODICITY TRICK. Filling the screen with the ground texture through the iso transform is
// correct but expensive: a sheared, rotated pattern is sampled pixel by pixel. The iso lattice,
// though, is itself periodic in SCREEN space - shifting the world by (K, K) tiles moves the
// picture straight down by K*T px, and by (K, -K) moves it right by 2*K*T px - so a K-periodic
// world texture is also periodic on screen over an axis-aligned cell of 2KT x KT. One such cell
// is pre-projected per zoom (nine drawImage calls, once), and every frame after that is an
// ordinary axis-aligned pattern fill anchored at the world origin, the cheapest fill a canvas
// has. Above ZOOM_CAP the cell is rendered at the cap and scaled, so it never grows past
// ~1.9 MP however far the player zooms in.
const ZOOM_CAP = 1.5;
const screenCells = new WeakMap();   // ctx -> { zq, meadow: {pattern}, rough: {pattern} }

function screenCell(ctx, zoom) {
  const zq = Math.round(Math.min(zoom, ZOOM_CAP) * 200) / 200;
  let per = screenCells.get(ctx);
  if (per && per.zq === zq) return per;
  const Tq = 104 * zq, K = PATCH_TILES;
  const build = (kind) => {
    const tex = texture(kind);
    if (!tex || typeof document === 'undefined' || typeof ctx.createPattern !== 'function') return null;
    try {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(2 * K * Tq));
      c.height = Math.max(1, Math.round(K * Tq));
      const x = c.getContext('2d');
      if (!x) return null;
      x.imageSmoothingEnabled = true;
      x.transform(Tq, Tq / 2, -Tq, Tq / 2, 0, 0);       // tile space -> cell px, world origin at (0,0)
      x.scale(K / PATCH_PX, K / PATCH_PX);              // texture px -> tiles
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) x.drawImage(tex, i * PATCH_PX, j * PATCH_PX);
      const pattern = ctx.createPattern(c, 'repeat');
      return pattern ? { pattern } : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };
  per = { zq, Tq, K, meadow: build('meadow'), rough: build('rough') };
  screenCells.set(ctx, per);
  return per;
}

/**
 * Fill the whole visible ground: rough land everywhere, meadow on every rect the player owns.
 *
 * `view` = { T, ox, oy, minTx, maxTx, minTy, maxTy } from renderer.viewGeometry(); (ox, oy) is
 * the screen position of world tile (0, 0), which is where the pre-projected cell's origin is
 * pinned (modulo its period), so the texture never slides against the farm.
 */
export function drawGround(ctx, view, unlockedRects = []) {
  const { T, ox, oy, w, h } = view;
  const zoom = T / 104;
  const cell = screenCell(ctx, zoom);
  const s = zoom / cell.zq;                                     // 1 unless zoomed past the cap
  const px = 2 * cell.K * cell.Tq * s, py = cell.K * cell.Tq * s; // screen period
  const ex = ((ox % px) + px) % px, ey = ((oy % py) + py) % py;

  const withPattern = (pattern, fallback, fillPath) => {
    ctx.save();
    if (pattern) { ctx.translate(ex, ey); ctx.scale(s, s); ctx.fillStyle = pattern; }
    else ctx.fillStyle = fallback;
    fillPath();
    ctx.restore();
  };
  // rough land: the whole viewport (an axis-aligned rect, in the pattern's own space)
  withPattern(cell.rough && cell.rough.pattern, FLAT.rough, () => {
    if (cell.rough) ctx.fillRect(-ex / s, -ey / s, (w + 2) / s, (h + 2) / s);
    else ctx.fillRect(0, 0, w, h);
  });
  // owned land: the diamonds, built in screen space BEFORE the pattern transform (a path keeps the
  // coordinates it was given; only the fill style is mapped through the CTM)
  ctx.beginPath();
  for (const r of unlockedRects) {
    const p = (u, v) => [ox + (u - v) * T, oy + (u + v) * (T / 2)];
    const a = p(r.x, r.y), b = p(r.x + r.w, r.y), c = p(r.x + r.w, r.y + r.h), d = p(r.x, r.y + r.h);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  }
  withPattern(cell.meadow && cell.meadow.pattern, FLAT.meadow, () => ctx.fill());
}

/** Screen position of a point on the ground plane, in tile units. */
function project(view, u, v) {
  return [view.ox + (u - v) * view.T, view.oy + (u + v) * (view.T / 2)];
}

/**
 * Tufts, flowers, pebbles and (on unowned land) ferns, per visible tile. Positions come from the
 * tile hash so nothing shimmers between frames; counts fall with zoom so a zoomed-out farm does
 * not pay for detail it cannot show. Batched by class into one stroke/fill each.
 */
export function drawGroundDetail(ctx, view, isUnlocked, zoom = 1, topClear = 0) {
  const { T, minTx, maxTx, minTy, maxTy, w, h } = view;
  // Tufts per tile fall with zoom; below 0.65 only every other tile (by hash) carries one at all,
  // so a zoomed-out farm draws a few hundred blades, not a few thousand.
  const perTile = zoom >= 1.5 ? 4 : zoom >= 0.9 ? 3 : zoom >= 0.65 ? 2 : 1;
  const sparse = zoom < 0.65;
  const bw = T * 0.03, hgt = T * 0.12;
  const tuftDark = [], tuftLight = [], ferns = [], pebbles = [];
  const flowers = [[], [], []];
  const inView = (px, py) => py >= topClear - hgt && py <= h + hgt && px >= -T && px <= w + T;

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const owned = isUnlocked ? isUnlocked(tx, ty) : true;
      const hb = tileHash(tx, ty);
      if (sparse && (hb & 1)) continue;
      const n = owned ? perTile : perTile + 1;
      for (let k = 0; k < n; k++) {
        const u = prand(hb, 21 + k), v = prand(hb, 41 + k);
        const [px, py] = project(view, tx + u, ty + v);
        if (!inView(px, py)) continue;
        const hh = hgt * (0.75 + prand(hb, 61 + k) * 0.5);
        (prand(hb, 81 + k) < (owned ? 0.35 : 0.15) ? tuftLight : tuftDark).push(px, py, hh);
      }
      if (owned && prand(hb, 91) < 0.22 && zoom >= 0.6) {
        const [px, py] = project(view, tx + prand(hb, 92), ty + prand(hb, 93));
        if (inView(px, py)) flowers[hb % 3].push(px, py);
      }
      if (prand(hb, 94) < (owned ? 0.08 : 0.16)) {
        const [px, py] = project(view, tx + prand(hb, 95), ty + prand(hb, 96));
        if (inView(px, py)) pebbles.push(px, py, 0.6 + prand(hb, 97) * 0.8);
      }
      if (!owned && prand(hb, 98) < 0.3) {
        const [px, py] = project(view, tx + prand(hb, 99), ty + prand(hb, 100));
        if (inView(px, py)) ferns.push(px, py, 0.8 + prand(hb, 101) * 0.6);
      }
    }
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, T * 0.022);
  const strokeTufts = (list, color) => {
    if (!list.length) return;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i < list.length; i += 3) {
      const px = list[i], py = list[i + 1], hh = list[i + 2];
      for (const dx of [-1, 0, 1]) {
        ctx.moveTo(px + dx * bw, py);
        ctx.quadraticCurveTo(px + dx * 1.7 * bw, py - hh * 0.55, px + dx * 2.6 * bw, py - hh);
      }
    }
    ctx.stroke();
  };
  strokeTufts(tuftDark, 'rgba(52,96,22,0.5)');
  strokeTufts(tuftLight, 'rgba(200,236,120,0.55)');
  if (ferns.length) {
    ctx.strokeStyle = 'rgba(40,72,22,0.6)';
    ctx.lineWidth = Math.max(1, T * 0.026);
    ctx.beginPath();
    for (let i = 0; i < ferns.length; i += 3) {
      const px = ferns[i], py = ferns[i + 1], sc = ferns[i + 2];
      for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.sin(a) * T * 0.08 * sc, py - T * 0.1 * sc, px + Math.sin(a) * T * 0.16 * sc, py - T * 0.16 * sc * Math.cos(a * 0.5));
      }
    }
    ctx.stroke();
  }
  if (pebbles.length) {
    ctx.fillStyle = 'rgba(150,150,140,0.75)';
    ctx.beginPath();
    for (let i = 0; i < pebbles.length; i += 3) {
      const px = pebbles[i], py = pebbles[i + 1], sc = pebbles[i + 2];
      ctx.moveTo(px + T * 0.03 * sc, py);
      ctx.ellipse(px, py, T * 0.03 * sc, T * 0.017 * sc, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  const petal = T * 0.02, ring = T * 0.03;
  const colours = [PALETTE.flowerWhite, PALETTE.flowerYellow, PALETTE.flowerPink];
  for (let c = 0; c < 3; c++) {
    const list = flowers[c];
    if (!list.length) continue;
    ctx.fillStyle = colours[c];
    ctx.beginPath();
    for (let i = 0; i < list.length; i += 2) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const fx = list[i] + Math.cos(a) * ring, fy = list[i + 1] + Math.sin(a) * ring * 0.7;
        ctx.moveTo(fx + petal, fy);
        ctx.arc(fx, fy, petal, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
  const centres = flowers[0].concat(flowers[1], flowers[2]);
  if (centres.length) {
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    for (let i = 0; i < centres.length; i += 2) {
      ctx.moveTo(centres[i] + petal * 0.8, centres[i + 1]);
      ctx.arc(centres[i], centres[i + 1], petal * 0.8, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Placement-mode grid over every visible tile the player owns — the one moment the player is
 * thinking in tiles rather than scenery (CLAUDE.md). Top-vertex convention, like every sprite.
 */
export function drawGrid(ctx, view, isUnlocked) {
  const { T, minTx, maxTx, minTy, maxTy } = view;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = Math.max(1, T * 0.014);
  ctx.beginPath();
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (isUnlocked && !isUnlocked(tx, ty)) continue;
      const [x, y] = project(view, tx, ty);
      ctx.moveTo(x, y); ctx.lineTo(x + T, y + T / 2); ctx.lineTo(x, y + T); ctx.lineTo(x - T, y + T / 2); ctx.closePath();
    }
  }
  ctx.stroke();
  ctx.restore();
}
