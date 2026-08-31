// farm-world.js — palette-driven isometric farm scene painter.
// Pure canvas vector art (no image files), mirroring the constraints of
// Farm-tycoon/src/render/sprites.js.

/** The shipped direction: A (Sunlit Homestead) + grafts —
 *  C's thick outlines & saturation, D's golden-hour light and vignette. */
export const GOLDEN = {
  grassLight: '#a8dc52', grass: '#8ecb36', grassDark: '#6da828',
  mottleLight: 'rgba(206,238,124,0.45)', mottleDark: 'rgba(96,152,40,0.34)',
  tuft: 'rgba(58,37,16,0.42)',
  flowerA: '#fff8ee', flowerB: '#ffd94d', flowerC: '#f48ab0', flowerHeart: '#f5a623',
  soilLight: '#b87c40', soil: '#9c6432', soilDark: '#6f4218', soilRow: 'rgba(58,37,16,0.44)', soilRim: '#3a2510',
  road: '#e6bd7c', roadEdge: '#a87c42', roadLight: 'rgba(255,231,178,0.72)', roadPebble: 'rgba(58,37,16,0.26)',
  water: '#3fb0e0', waterLight: '#86d8f2', waterEdge: '#3a2510', reed: '#4f9c26',
  wood: '#c08a4e', woodDark: '#7a4a18', woodLight: '#dca868',
  roof: '#e05548', roofDark: '#b83a2c', roofTop: '#a03426', roofAlt: '#4a8fd4',
  trimLight: '#fffaea', wall: '#fbeccb', window: '#7fd4f0', chimney: '#b06a4a',
  silo: '#e8dcc0', siloLight: '#fffaea', siloDark: '#bfae8c', siloRib: 'rgba(58,37,16,0.26)',
  awning: '#e05548', crate: '#b8823c', fruit: '#e8574a',
  trunk: '#7a4a18', canopy: '#54a028', canopyLight: 'rgba(198,240,124,0.55)',
  leaf: '#4f9c26', leafLight: '#82ce3c', wheat: '#f2c94c', wheatStem: '#d4a32e', corn: '#f7d43e',
  chicken: '#fffaea', comb: '#e05548', beak: '#f5a623',
  cow: '#fffaea', cowSpot: '#5b3a1e', muzzle: '#f2b8b0',
  shadow: 'rgba(58,37,16,0.26)', outline: '#3a2510', outlineWidth: 3.5,
  sun: 'rgba(255,196,104,0.34)', vignette: 'rgba(72,44,14,0.38)',
};


export function drawWorld(canvas, p, opts = {}) {
  const w = opts.w || 1280, h = opts.h || 800, dpr = opts.dpr || 2;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const T = opts.tile || 104;
  const ox = w * 0.5, oy = h * 0.2375;
  const iso = (tx, ty) => [ox + (tx - ty) * T, oy + (tx + ty) * (T / 2)];
  const rnd = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  const OW = p.outlineWidth || 0;
  const ol = () => { if (!OW) return false; ctx.strokeStyle = p.outline; ctx.lineWidth = OW; ctx.lineJoin = 'round'; return true; };

  // ── ground ─────────────────────────────────────────────────────────────
  const field = ctx.createLinearGradient(0, 0, 0, h);
  field.addColorStop(0, p.grassLight); field.addColorStop(0.55, p.grass); field.addColorStop(1, p.grassDark);
  ctx.fillStyle = field; ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 18; i++) {
    const px = rnd(i, 1) * w, py = rnd(i, 2) * h;
    const rx = (0.09 + rnd(i, 3) * 0.17) * w, ry = rx * (0.32 + rnd(i, 4) * 0.2);
    const g = ctx.createRadialGradient(px, py, 0, px, py, rx);
    g.addColorStop(0, i % 2 ? p.mottleLight : p.mottleDark); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.translate(px, py); ctx.scale(1, ry / rx);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // ── pond ───────────────────────────────────────────────────────────────
  {
    const [px, py] = iso(2.6, 6.6);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(px, py, T * 1.5, T * 0.66, -0.08, 0, Math.PI * 2);
    ctx.fillStyle = p.waterEdge || p.soilDark; ctx.fill();
    ctx.beginPath(); ctx.ellipse(px, py - 4, T * 1.36, T * 0.56, -0.08, 0, Math.PI * 2);
    const wg = ctx.createLinearGradient(px, py - T * 0.6, px, py + T * 0.6);
    wg.addColorStop(0, p.waterLight || p.water); wg.addColorStop(1, p.water);
    ctx.fillStyle = wg; ctx.fill();
    if (ol()) ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(px, py - 4, T * 1.36, T * 0.56, -0.08, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const yy = py - 26 + i * 17, ww = 30 + (i % 2) * 26;
      ctx.beginPath(); ctx.moveTo(px - ww - i * 12, yy);
      ctx.quadraticCurveTo(px - ww / 2 - i * 12, yy - 5, px - i * 12, yy); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = p.reed || '#4f8f2c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = -0.5 + i * 0.42, rx2 = T * 1.44, ry2 = T * 0.6;
      const bx = px + Math.cos(a) * rx2, by = py - 4 + Math.sin(a) * ry2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 3, by - 16, bx - 2, by - 30); ctx.stroke();
    }
    ctx.restore();
  }

  // ── road ───────────────────────────────────────────────────────────────
  {
    const [ax, ay] = iso(-9, 1.15), [bx, by] = iso(22, 1.15);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = p.roadEdge; ctx.lineWidth = T * 1.16;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = p.road; ctx.lineWidth = T * 0.94;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = p.roadLight; ctx.lineWidth = T * 0.26;
    ctx.beginPath(); ctx.moveTo(ax, ay - 6); ctx.lineTo(bx, by - 6); ctx.stroke();
    ctx.fillStyle = p.roadPebble || 'rgba(120,90,50,0.35)';
    for (let i = 0; i < 26; i++) {
      const t = rnd(i, 9), sx = ax + (bx - ax) * t, sy = ay + (by - ay) * t + (rnd(i, 10) - 0.5) * T * 0.7;
      ctx.beginPath(); ctx.ellipse(sx, sy, 4 + rnd(i, 11) * 3, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── grass tufts + flowers ──────────────────────────────────────────────
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const px = rnd(i, 5) * w, py = h * 0.2 + rnd(i, 6) * h * 0.8;
    ctx.strokeStyle = p.tuft; ctx.lineWidth = 2.4;
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath(); ctx.moveTo(px + dx, py + 5);
      ctx.quadraticCurveTo(px + dx * 1.4, py - 2, px + dx * 1.9, py - 8); ctx.stroke();
    }
  }
  for (let i = 0; i < 16; i++) {
    const px = rnd(i, 7) * w, py = h * 0.22 + rnd(i, 8) * h * 0.74;
    ctx.fillStyle = i % 3 === 0 ? p.flowerA : i % 3 === 1 ? p.flowerB : p.flowerC;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * 4.2, py + Math.sin(a) * 4.2, 2.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = p.flowerHeart;
    ctx.beginPath(); ctx.arc(px, py, 2.3, 0, Math.PI * 2); ctx.fill();
  }

  // ── plots ──────────────────────────────────────────────────────────────
  const plot = (tx, ty, kind) => {
    const [x, y] = iso(tx, ty), D = 11;
    const dia = (yOff, k = 1) => {
      ctx.beginPath();
      ctx.moveTo(x, y + yOff); ctx.lineTo(x + T * k, y + T / 2 + yOff);
      ctx.lineTo(x, y + T * k + yOff); ctx.lineTo(x - T * k, y + T / 2 + yOff); ctx.closePath();
    };
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + T / 2 + D + 7, T * 1.0, T * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    dia(D); ctx.fillStyle = p.soilDark; ctx.fill();
    dia(0);
    const sg = ctx.createLinearGradient(x, y, x, y + T);
    sg.addColorStop(0, p.soilLight); sg.addColorStop(1, p.soil);
    ctx.fillStyle = sg; ctx.fill();
    ctx.save(); dia(0); ctx.clip();
    ctx.strokeStyle = p.soilRow; ctx.lineWidth = 3.5;
    for (let f = 0.22; f < 1; f += 0.26) { ctx.beginPath(); ctx.moveTo(x - T, y + T * f); ctx.lineTo(x + T, y + T * f); ctx.stroke(); }
    ctx.restore();
    dia(0);
    ctx.strokeStyle = p.soilRim; ctx.lineWidth = OW ? OW : 2.5; ctx.stroke();

    if (kind === 'wheat') {
      for (let i = 0; i < 14; i++) {
        const px = x + Math.sin(i * 2.7) * T * 0.62, py = y + T * 0.28 + ((i % 4) / 4) * T * 0.5;
        ctx.strokeStyle = p.wheatStem; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(px, py + 13); ctx.quadraticCurveTo(px + 3, py + 2, px, py - 9); ctx.stroke();
        ctx.fillStyle = p.wheat;
        ctx.beginPath(); ctx.ellipse(px, py - 12, 4, 8, 0.15, 0, Math.PI * 2); ctx.fill();
        if (OW) { ctx.strokeStyle = p.outline; ctx.lineWidth = 1.6; ctx.stroke(); }
      }
    } else if (kind === 'corn') {
      for (let i = 0; i < 9; i++) {
        const px = x + Math.sin(i * 2.1) * T * 0.5, py = y + T * 0.3 + ((i % 3) / 3) * T * 0.42;
        ctx.strokeStyle = p.leaf; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(px, py + 16); ctx.lineTo(px, py - 14); ctx.stroke();
        ctx.strokeStyle = p.leafLight; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(px, py + 2); ctx.quadraticCurveTo(px + 12, py - 4, px + 15, py - 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py - 2); ctx.quadraticCurveTo(px - 12, py - 8, px - 15, py - 18); ctx.stroke();
        ctx.fillStyle = p.corn;
        ctx.beginPath(); ctx.ellipse(px, py - 14, 4.6, 9, 0, 0, Math.PI * 2); ctx.fill();
        if (OW) { ctx.strokeStyle = p.outline; ctx.lineWidth = 1.6; ctx.stroke(); }
      }
    } else if (kind === 'sprout') {
      for (let i = 0; i < 8; i++) {
        const px = x + Math.sin(i * 2.4) * T * 0.5, py = y + T * 0.36 + ((i % 3) / 3) * T * 0.36;
        ctx.fillStyle = p.leafLight;
        ctx.beginPath(); ctx.ellipse(px - 4, py, 5.5, 3.4, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + 4, py, 5.5, 3.4, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = p.leaf; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(px, py + 7); ctx.lineTo(px, py - 1); ctx.stroke();
      }
    }
  };
  plot(0.6, 3.0, 'wheat'); plot(1.6, 3.0, 'corn');
  plot(0.6, 4.0, 'sprout'); plot(1.6, 4.0, 'empty');

  // ── fence ──────────────────────────────────────────────────────────────
  {
    const posts = [];
    for (let i = 0; i < 7; i++) posts.push(iso(-0.5 + i * 0.62, 2.2));
    ctx.strokeStyle = p.woodDark; ctx.lineWidth = 5;
    for (let i = 0; i < posts.length - 1; i++) for (const ry of [-20, -10]) {
      ctx.beginPath(); ctx.moveTo(posts[i][0], posts[i][1] + ry); ctx.lineTo(posts[i + 1][0], posts[i + 1][1] + ry); ctx.stroke();
    }
    for (const [fx, fy] of posts) {
      ctx.fillStyle = p.wood; ctx.fillRect(fx - 4, fy - 30, 8, 32);
      ctx.strokeStyle = p.woodDark; ctx.lineWidth = OW ? 2.4 : 1.6; ctx.strokeRect(fx - 4, fy - 30, 8, 32);
    }
  }

  // ── trees ──────────────────────────────────────────────────────────────
  const tree = (tx, ty, s) => {
    const [x, y] = iso(tx, ty);
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + 52 * s, 62 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.trunk; ctx.beginPath();
    ctx.moveTo(x - 9 * s, y + 50 * s); ctx.lineTo(x - 6 * s, y - 30 * s);
    ctx.lineTo(x + 6 * s, y - 30 * s); ctx.lineTo(x + 9 * s, y + 50 * s); ctx.closePath(); ctx.fill();
    if (ol()) ctx.stroke();
    const puffs = [[-30, -58, 36], [30, -58, 36], [0, -96, 42], [-16, -30, 30], [18, -32, 28]];
    for (const [dx, dy, r] of puffs) {
      ctx.fillStyle = p.canopy;
      ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
    }
    if (OW) {
      ctx.strokeStyle = p.outline; ctx.lineWidth = OW;
      ctx.beginPath();
      for (const [dx, dy, r] of puffs) { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); }
      ctx.stroke();
    }
    ctx.fillStyle = p.canopyLight;
    ctx.beginPath(); ctx.arc(x - 14 * s, y - 104 * s, 24 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.fruit || 'rgba(0,0,0,0)';
    for (const [dx, dy] of [[-26, -66], [22, -50], [4, -88]]) {
      ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 6 * s, 0, Math.PI * 2); ctx.fill();
    }
  };

  // ── buildings ──────────────────────────────────────────────────────────
  const barn = (tx, ty, s) => {
    const [x, y0] = iso(tx, ty), BW = 210 * s, BH = 128 * s, y = y0 - 10;
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + BH * 0.66, BW * 0.66, BH * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    const bg = ctx.createLinearGradient(x - BW / 2, 0, x + BW / 2, 0);
    bg.addColorStop(0, p.roof); bg.addColorStop(1, p.roofDark);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x - BW / 2, y - BH * 0.3, BW, BH, 6 * s); ctx.fill();
    ctx.strokeStyle = p.trimLight; ctx.lineWidth = 6 * s; ctx.stroke();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.roofTop;
    ctx.beginPath();
    ctx.moveTo(x - BW * 0.6, y - BH * 0.27); ctx.lineTo(x - BW * 0.33, y - BH * 0.84);
    ctx.lineTo(x, y - BH * 1.0); ctx.lineTo(x + BW * 0.33, y - BH * 0.84);
    ctx.lineTo(x + BW * 0.6, y - BH * 0.27); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = p.trimLight; ctx.lineWidth = 5 * s; ctx.stroke();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.trimLight; ctx.beginPath(); ctx.arc(x, y - BH * 0.6, 15 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.woodDark; ctx.beginPath(); ctx.arc(x, y - BH * 0.6, 10 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.trimLight;
    ctx.beginPath(); ctx.roundRect(x - 30 * s, y + BH * 0.1, 60 * s, BH * 0.56, 4 * s); ctx.fill();
    ctx.fillStyle = p.wood;
    ctx.beginPath(); ctx.roundRect(x - 25 * s, y + BH * 0.14, 22 * s, BH * 0.48, 3 * s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + 3 * s, y + BH * 0.14, 22 * s, BH * 0.48, 3 * s); ctx.fill();
    if (ol()) { ctx.strokeStyle = p.outline; ctx.lineWidth = OW * 0.8; ctx.stroke(); }
  };

  const silo = (tx, ty, s) => {
    const [x, y0] = iso(tx, ty), SW = 62 * s, SH = 178 * s, y = y0 - 10;
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + 6, SW * 0.72, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(x - SW / 2, 0, x + SW / 2, 0);
    g.addColorStop(0, p.siloLight); g.addColorStop(0.5, p.silo); g.addColorStop(1, p.siloDark);
    ctx.fillStyle = g; ctx.fillRect(x - SW / 2, y - SH, SW, SH);
    ctx.strokeStyle = p.siloRib; ctx.lineWidth = 2.4;
    for (let i = 1; i < 7; i++) { const yy = y - SH + (SH / 7) * i; ctx.beginPath(); ctx.moveTo(x - SW / 2, yy); ctx.lineTo(x + SW / 2, yy); ctx.stroke(); }
    if (ol()) ctx.strokeRect(x - SW / 2, y - SH, SW, SH);
    ctx.fillStyle = p.roofTop;
    ctx.beginPath(); ctx.moveTo(x - SW * 0.62, y - SH); ctx.quadraticCurveTo(x, y - SH - 52 * s, x + SW * 0.62, y - SH); ctx.closePath(); ctx.fill();
    if (ol()) ctx.stroke();
  };

  const house = (tx, ty, s) => {
    const [x, y0] = iso(tx, ty), HW = 168 * s, HH = 96 * s, y = y0 - 8;
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + HH * 0.72, HW * 0.62, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.wall;
    ctx.beginPath(); ctx.roundRect(x - HW / 2, y - HH * 0.2, HW, HH, 6 * s); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.roofAlt;
    ctx.beginPath();
    ctx.moveTo(x - HW * 0.6, y - HH * 0.16); ctx.lineTo(x, y - HH * 0.92);
    ctx.lineTo(x + HW * 0.6, y - HH * 0.16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = p.trimLight; ctx.lineWidth = 4 * s; ctx.stroke();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.window;
    for (const dx of [-46, 46]) { ctx.beginPath(); ctx.roundRect(x + dx * s - 16 * s, y + HH * 0.06, 32 * s, 30 * s, 4 * s); ctx.fill(); if (ol()) ctx.stroke(); }
    ctx.fillStyle = p.wood;
    ctx.beginPath(); ctx.roundRect(x - 20 * s, y + HH * 0.24, 40 * s, HH * 0.56, 4 * s); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.chimney || p.roofDark;
    ctx.fillRect(x + HW * 0.3, y - HH * 0.86, 22 * s, 40 * s);
  };

  const stand = (tx, ty, s) => {
    const [x, y0] = iso(tx, ty), y = y0 - 6;
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + 40 * s, 66 * s, 16 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.wood;
    ctx.beginPath(); ctx.roundRect(x - 52 * s, y - 14 * s, 104 * s, 54 * s, 5 * s); ctx.fill();
    ctx.strokeStyle = p.woodDark; ctx.lineWidth = OW ? OW : 3; ctx.stroke();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? p.trimLight : p.awning;
      ctx.beginPath();
      ctx.moveTo(x - 58 * s + i * 20 * s, y - 44 * s); ctx.lineTo(x - 38 * s + i * 20 * s, y - 44 * s);
      ctx.lineTo(x - 38 * s + i * 20 * s, y - 22 * s); ctx.lineTo(x - 48 * s + i * 20 * s, y - 14 * s);
      ctx.lineTo(x - 58 * s + i * 20 * s, y - 22 * s); ctx.closePath(); ctx.fill();
      if (ol()) ctx.stroke();
    }
    ctx.fillStyle = p.crate || p.woodDark;
    ctx.beginPath(); ctx.roundRect(x - 34 * s, y - 6 * s, 30 * s, 24 * s, 3 * s); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.fruit || p.flowerA;
    for (const dx of [8, 24, 16]) { ctx.beginPath(); ctx.arc(x + dx * s, y + (dx === 16 ? -2 : 8) * s, 8 * s, 0, Math.PI * 2); ctx.fill(); if (ol()) ctx.stroke(); }
  };

  // ── animals ────────────────────────────────────────────────────────────
  const chicken = (tx, ty, s) => {
    const [x, y] = iso(tx, ty);
    ctx.fillStyle = p.shadow; ctx.beginPath(); ctx.ellipse(x, y + 16 * s, 20 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.chicken || '#fff8ee';
    ctx.beginPath(); ctx.ellipse(x, y, 20 * s, 16 * s, 0, 0, Math.PI * 2); ctx.fill(); if (ol()) ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 14 * s, y - 16 * s, 11 * s, 0, Math.PI * 2); ctx.fill(); if (ol()) ctx.stroke();
    ctx.fillStyle = p.comb || '#e0503f';
    ctx.beginPath(); ctx.arc(x + 12 * s, y - 26 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 24 * s, y - 16 * s); ctx.lineTo(x + 33 * s, y - 13 * s); ctx.lineTo(x + 24 * s, y - 10 * s); ctx.closePath();
    ctx.fillStyle = p.beak || '#f5a623'; ctx.fill();
    ctx.fillStyle = p.outline || '#3a2a16';
    ctx.beginPath(); ctx.arc(x + 17 * s, y - 18 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  };

  const cow = (tx, ty, s) => {
    const [x, y] = iso(tx, ty);
    ctx.fillStyle = p.shadow; ctx.beginPath(); ctx.ellipse(x, y + 26 * s, 44 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.woodDark;
    for (const dx of [-24, -8, 12, 26]) ctx.fillRect(x + dx * s, y + 8 * s, 8 * s, 18 * s);
    ctx.fillStyle = p.cow || '#fff8ee';
    ctx.beginPath(); ctx.roundRect(x - 34 * s, y - 18 * s, 70 * s, 32 * s, 14 * s); ctx.fill(); if (ol()) ctx.stroke();
    ctx.fillStyle = p.cowSpot || '#4a3728';
    ctx.beginPath(); ctx.ellipse(x - 12 * s, y - 6 * s, 11 * s, 8 * s, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 14 * s, y + 2 * s, 8 * s, 6 * s, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.cow || '#fff8ee';
    ctx.beginPath(); ctx.roundRect(x + 26 * s, y - 34 * s, 32 * s, 28 * s, 11 * s); ctx.fill(); if (ol()) ctx.stroke();
    ctx.fillStyle = p.muzzle || '#f2b8b0';
    ctx.beginPath(); ctx.roundRect(x + 44 * s, y - 20 * s, 18 * s, 14 * s, 6 * s); ctx.fill(); if (ol()) ctx.stroke();
    ctx.fillStyle = p.outline || '#3a2a16';
    ctx.beginPath(); ctx.arc(x + 38 * s, y - 24 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
  };

  const haybale = (tx, ty, s) => {
    const [x, y] = iso(tx, ty);
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + 20 * s, 32 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(x - 28 * s, 0, x + 28 * s, 0);
    g.addColorStop(0, p.wheat); g.addColorStop(1, p.wheatStem);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x - 28 * s, y - 24 * s, 56 * s, 44 * s, 12 * s); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.strokeStyle = 'rgba(58,37,16,0.3)'; ctx.lineWidth = 2.4 * s;
    for (const dy of [-10, 2, 12]) { ctx.beginPath(); ctx.moveTo(x - 24 * s, y + dy * s); ctx.lineTo(x + 24 * s, y + dy * s); ctx.stroke(); }
  };

  const windmill = (tx, ty, s) => {
    const [x, y0] = iso(tx, ty), y = y0 - 8, TW = 58 * s, TH = 150 * s;
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + 8, TW * 0.8, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.wall;
    ctx.beginPath();
    ctx.moveTo(x - TW * 0.6, y); ctx.lineTo(x - TW * 0.34, y - TH);
    ctx.lineTo(x + TW * 0.34, y - TH); ctx.lineTo(x + TW * 0.6, y); ctx.closePath(); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.roofTop;
    ctx.beginPath(); ctx.moveTo(x - TW * 0.44, y - TH); ctx.lineTo(x, y - TH - 34 * s); ctx.lineTo(x + TW * 0.44, y - TH); ctx.closePath(); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.save(); ctx.translate(x, y - TH * 0.86); ctx.rotate(0.5);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.trimLight;
      ctx.beginPath(); ctx.roundRect(6 * s, -5 * s, 52 * s, 11 * s, 3 * s); ctx.fill();
      if (ol()) ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = p.woodDark;
    ctx.beginPath(); ctx.arc(x, y - TH * 0.86, 7 * s, 0, Math.PI * 2); ctx.fill();
  };

  const shed = (tx, ty, s, roofColor) => {
    const [x, y0] = iso(tx, ty), y = y0 - 8, SW = 138 * s, SH = 84 * s;
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + SH * 0.7, SW * 0.62, 15 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.wall;
    ctx.beginPath(); ctx.roundRect(x - SW / 2, y - SH * 0.18, SW, SH, 6 * s); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.fillStyle = roofColor || p.roofAlt;
    ctx.beginPath();
    ctx.moveTo(x - SW * 0.58, y - SH * 0.14); ctx.lineTo(x - SW * 0.2, y - SH * 0.78);
    ctx.lineTo(x + SW * 0.2, y - SH * 0.78); ctx.lineTo(x + SW * 0.58, y - SH * 0.14);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = p.trimLight; ctx.lineWidth = 4 * s; ctx.stroke();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.window;
    ctx.beginPath(); ctx.roundRect(x - 40 * s, y + SH * 0.08, 30 * s, 26 * s, 4 * s); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.fillStyle = p.wood;
    ctx.beginPath(); ctx.roundRect(x + 6 * s, y + SH * 0.06, 34 * s, SH * 0.6, 4 * s); ctx.fill();
    if (ol()) ctx.stroke();
  };

  const pig = (tx, ty, s) => {
    const [x, y] = iso(tx, ty);
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + 20 * s, 34 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.woodDark;
    for (const dx of [-18, -4, 10, 20]) ctx.fillRect(x + dx * s, y + 6 * s, 7 * s, 14 * s);
    ctx.fillStyle = p.muzzle || '#f2b8b0';
    ctx.beginPath(); ctx.roundRect(x - 26 * s, y - 14 * s, 54 * s, 26 * s, 12 * s); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + 20 * s, y - 24 * s, 26 * s, 24 * s, 10 * s); ctx.fill();
    if (ol()) ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x + 40 * s, y - 12 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.outline || '#3a2510';
    ctx.beginPath(); ctx.arc(x + 30 * s, y - 17 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
  };

  // depth order: back → front
  if (p.rich || opts.rich) {
    plot(-0.4, 3.0, 'wheat'); plot(-0.4, 4.0, 'corn');
    plot(2.6, 3.0, 'sprout'); plot(2.6, 4.0, 'wheat');
    windmill(-2.0, 1.2, 0.92);
    shed(0.6, -0.5, 0.92, p.roofAlt);
    shed(5.4, 0.9, 0.86, p.roof);
    haybale(-1.4, 2.4, 0.9);
    haybale(-1.0, 2.8, 0.78);
    pig(5.4, 2.6, 0.9);
  }
  tree(-0.4, 0.4, 1.0);
  house(2.6, -0.1, 1.0);
  silo(3.9, 0.5, 1.0);
  barn(3.4, 2.2, 1.0);
  tree(6.4, 1.6, 0.9);
  stand(5.6, 3.4, 0.95);
  cow(3.8, 3.4, 1.0);
  chicken(4.4, 2.8, 0.9);
  chicken(4.9, 3.1, 0.8);
  tree(0.2, 5.0, 1.1);

  // ── light + vignette ───────────────────────────────────────────────────
  if (p.sun) {
    const sg = ctx.createRadialGradient(w * 0.72, -h * 0.18, 0, w * 0.72, -h * 0.18, h * 1.15);
    sg.addColorStop(0, p.sun); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
  }
  if (p.vignette) {
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.34, w / 2, h * 0.5, h * 1.02);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, p.vignette);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }
}
