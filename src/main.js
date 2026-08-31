// main.js — boot + game loop.
// Boot order: state.load() → renderer.init → ui.init → input.init → audio.init (deferred to
// first gesture) → tutorial.init → resolve offline progress (production.tick(now)) → rAF loop.
// Loop each frame: production/shop/orders/boat/event ticks → camera tick → drawFrame → updateHud.
// Autosave every state.settings.autosaveInterval seconds and on beforeunload.
//
// Debug hook (used by the playtest skill; harmless in production):
//   window.__farmDebug = { timeSkip(ms), state, give(itemId, qty) }

import * as state from './state.js';
import { PALETTE } from './render/sprites.js';

/**
 * Scaffold splash — a Hay Day-style vista. Per the ground rule in sprites.js: the meadow is
 * continuous (no visible grid), fields are raised slabs, soft blob shadows everywhere.
 * Phase B replaces this with renderer.drawFrame. Iso helper kept for object placement only.
 */
function drawSplash(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const T = Math.max(56, w / 18);
  const ox = w / 2, oy = h * 0.3;
  const iso = (tx, ty) => [ox + (tx - ty) * T, oy + (tx + ty) * (T / 2)];
  // deterministic pseudo-random so the scene is stable across resizes
  const rand = (i, salt = 0) => {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // ---- continuous meadow (no grid) ----
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, w, h);

  // low-frequency tonal mottling: large soft elliptical patches in two tones
  for (let i = 0; i < 14; i++) {
    const px = rand(i, 1) * w, py = rand(i, 2) * h;
    const rx = (0.1 + rand(i, 3) * 0.16) * w, ry = rx * (0.35 + rand(i, 4) * 0.2);
    const g = ctx.createRadialGradient(px, py, 0, px, py, rx);
    const tone = i % 2 ? PALETTE.grassMottleLight : PALETTE.grassMottleDark;
    g.addColorStop(0, tone);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, ry / rx);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- dirt road (soft-edged diagonal band along the iso axis) ----
  {
    const [ax, ay] = iso(-8, 2.5), [bx, by] = iso(20, 2.5);
    ctx.save();
    ctx.lineCap = 'round';
    // soft outer edge, then body, then a lighter worn center line
    ctx.strokeStyle = 'rgba(160, 120, 70, 0.35)';
    ctx.lineWidth = T * 1.25;
    ctx.beginPath(); ctx.moveTo(ax, ay + T / 2); ctx.lineTo(bx, by + T / 2); ctx.stroke();
    ctx.strokeStyle = '#d9b072';
    ctx.lineWidth = T * 1.0;
    ctx.beginPath(); ctx.moveTo(ax, ay + T / 2); ctx.lineTo(bx, by + T / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(238, 205, 140, 0.7)';
    ctx.lineWidth = T * 0.3;
    ctx.beginPath(); ctx.moveTo(ax, ay + T / 2); ctx.lineTo(bx, by + T / 2); ctx.stroke();
    ctx.restore();
  }

  // grass tufts + tiny flowers, sparse, avoiding the top HUD strip
  for (let i = 0; i < 60; i++) {
    const px = rand(i, 5) * w, py = 90 + rand(i, 6) * (h - 110);
    ctx.strokeStyle = 'rgba(70, 130, 30, 0.55)';
    ctx.lineWidth = 2;
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(px + dx, py + 5);
      ctx.quadraticCurveTo(px + dx * 1.4, py - 2, px + dx * 1.8, py - 7);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 8; i++) {
    const px = rand(i, 7) * w, py = 100 + rand(i, 8) * (h - 130);
    ctx.fillStyle = i % 2 ? PALETTE.flowerWhite : PALETTE.flowerYellow;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * 4, py + Math.sin(a) * 4, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f5a623';
    ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  // ---- raised-slab field plots (rounded diamond top + darker side thickness) ----
  const plot = (tx, ty, kind) => {
    const [x, y] = iso(tx, ty);
    const R = T * 0.13, D = 8; // corner rounding, slab depth
    const top = [[x, y], [x + T, y + T / 2], [x, y + T], [x - T, y + T / 2]];
    const roundedDiamond = (yOff) => {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const [cx, cy] = top[i], [nx, ny] = top[(i + 1) % 4];
        const len = Math.hypot(nx - cx, ny - cy);
        const ux = (nx - cx) / len, uy = (ny - cy) / len;
        if (i === 0) ctx.moveTo(cx + ux * R, cy + yOff + uy * R);
        else ctx.lineTo(cx + ux * R, cy + yOff + uy * R);
        ctx.lineTo(nx - ux * R, ny + yOff - uy * R);
        ctx.quadraticCurveTo(nx, ny + yOff, ...(() => {
          const [mx2, my2] = top[(i + 2) % 4];
          const l2 = Math.hypot(mx2 - nx, my2 - ny);
          return [nx + ((mx2 - nx) / l2) * R, ny + yOff + ((my2 - ny) / l2) * R];
        })());
      }
      ctx.closePath();
    };
    // soft ground shadow
    ctx.fillStyle = 'rgba(40, 70, 20, 0.18)';
    ctx.beginPath(); ctx.ellipse(x, y + T / 2 + D + 6, T * 1.02, T * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    // side thickness
    roundedDiamond(D);
    ctx.fillStyle = PALETTE.soilDark;
    ctx.fill();
    // top face
    roundedDiamond(0);
    const soil = ctx.createLinearGradient(x, y, x, y + T);
    soil.addColorStop(0, '#a97a48');
    soil.addColorStop(1, PALETTE.soil);
    ctx.fillStyle = soil;
    ctx.fill();
    // light top-edge highlight
    ctx.strokeStyle = 'rgba(255, 230, 180, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // furrows clipped to the top face
    ctx.save();
    roundedDiamond(0);
    ctx.clip();
    ctx.strokeStyle = 'rgba(90, 55, 25, 0.5)';
    ctx.lineWidth = 3;
    for (let f = 0.25; f < 1; f += 0.25) {
      ctx.beginPath();
      ctx.moveTo(x - T, y + T * f);
      ctx.lineTo(x + T, y + T * f);
      ctx.stroke();
    }
    ctx.restore();
    if (kind === 'wheat') {
      for (let i = 0; i < 12; i++) {
        const px = x + (Math.sin(i * 2.7) * 0.7) * T * 0.7;
        const py = y + T * 0.25 + ((i % 4) / 4) * T * 0.55;
        ctx.strokeStyle = PALETTE.wheatGold;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(px, py + 12);
        ctx.quadraticCurveTo(px + 3, py + 2, px, py - 8);
        ctx.stroke();
        ctx.fillStyle = '#f7d268';
        ctx.beginPath(); ctx.ellipse(px, py - 10, 3.5, 7, 0.15, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'sprout') {
      for (let i = 0; i < 7; i++) {
        const px = x + Math.sin(i * 2.1) * T * 0.55;
        const py = y + T * 0.35 + ((i % 3) / 3) * T * 0.4;
        ctx.fillStyle = '#5fae2e';
        ctx.beginPath(); ctx.ellipse(px, py, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  };
  plot(2, 5, 'wheat');
  plot(3, 5, 'wheat');
  plot(2, 6, 'sprout');
  plot(3, 6, 'empty');

  // ---- fence beside the field (posts + rails) ----
  {
    const posts = [];
    for (let i = 0; i < 6; i++) posts.push(iso(1 + i * 0.7, 4.35));
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 4;
    for (let i = 0; i < posts.length - 1; i++) {
      for (const railY of [-16, -8]) {
        ctx.beginPath();
        ctx.moveTo(posts[i][0], posts[i][1] + railY);
        ctx.lineTo(posts[i + 1][0], posts[i + 1][1] + railY);
        ctx.stroke();
      }
    }
    for (const [fx, fy] of posts) {
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(fx - 3.5, fy - 24, 7, 26);
      ctx.strokeStyle = PALETTE.woodDark;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fx - 3.5, fy - 24, 7, 26);
    }
  }

  // ---- tree ----
  {
    const [tx0, ty0] = iso(1.0, 0.2);
    ctx.fillStyle = 'rgba(30,50,20,0.2)';
    ctx.beginPath(); ctx.ellipse(tx0, ty0 + T * 0.5, T * 0.55, T * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(tx0 - 7, ty0 - T * 0.5, 14, T);
    for (const [oxx, oyy, r] of [[-24, -T * 0.75, 34], [24, -T * 0.75, 34], [0, -T * 1.05, 40]]) {
      ctx.fillStyle = '#5aa032';
      ctx.beginPath(); ctx.arc(tx0 + oxx, ty0 + oyy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(tx0 - 10, ty0 - T * 1.15, 24, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Hay Day-style gambrel barn ----
  {
    const [bx, by] = iso(5.2, 4.8);
    const BW = T * 1.9, BH = T * 1.15;
    ctx.fillStyle = 'rgba(30,50,20,0.22)';
    ctx.beginPath(); ctx.ellipse(bx, by + BH * 0.62, BW * 0.72, BH * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    const body = ctx.createLinearGradient(bx - BW / 2, 0, bx + BW / 2, 0);
    body.addColorStop(0, PALETTE.roof);
    body.addColorStop(1, PALETTE.roofDark);
    ctx.fillStyle = body;
    ctx.fillRect(bx - BW / 2, by - BH * 0.35, BW, BH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.strokeRect(bx - BW / 2, by - BH * 0.35, BW, BH);
    ctx.fillStyle = '#8a4a3a';
    ctx.beginPath();
    ctx.moveTo(bx - BW * 0.62, by - BH * 0.32);
    ctx.lineTo(bx - BW * 0.34, by - BH * 0.85);
    ctx.lineTo(bx, by - BH * 1.0);
    ctx.lineTo(bx + BW * 0.34, by - BH * 0.85);
    ctx.lineTo(bx + BW * 0.62, by - BH * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx, by - BH * 0.62, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.woodDark;
    ctx.beginPath(); ctx.arc(bx, by - BH * 0.62, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 24, by + BH * 0.13, 48, BH * 0.52);
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(bx - 20, by + BH * 0.17, 18, BH * 0.44);
    ctx.fillRect(bx + 2, by + BH * 0.17, 18, BH * 0.44);
  }

  // ---- roadside shop stand hint on the road edge ----
  {
    const [sx, sy] = iso(9.5, 1.6);
    ctx.fillStyle = 'rgba(30,50,20,0.2)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 34, 52, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(sx - 42, sy - 12, 84, 44);
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx - 42, sy - 12, 84, 44);
    // striped awning
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : PALETTE.roof;
      ctx.beginPath();
      ctx.moveTo(sx - 48 + i * 16, sy - 34);
      ctx.lineTo(sx - 32 + i * 16, sy - 34);
      ctx.lineTo(sx - 32 + i * 16, sy - 16);
      ctx.lineTo(sx - 48 + i * 16, sy - 16);
      ctx.closePath();
      ctx.fill();
    }
  }

  // soft cloud shadows
  ctx.fillStyle = 'rgba(40, 80, 30, 0.08)';
  for (const [sx, sy, r] of [[0.3, 0.75, 90], [0.65, 0.6, 70], [0.15, 0.55, 60]]) {
    ctx.beginPath(); ctx.ellipse(w * sx, h * sy, r * 1.6, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function boot() {
  state.load();
  const canvas = document.getElementById('world');
  drawSplash(canvas);
  window.addEventListener('resize', () => drawSplash(canvas));
  const el = document.getElementById('boot-status');
  if (el) el.textContent = 'Scaffold build — gameplay arrives in Phase B';
}

window.addEventListener('DOMContentLoaded', boot);
