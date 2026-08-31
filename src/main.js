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
 * Scaffold splash — an isometric Hay Day-style vista so the scaffold boots to something
 * that already reads as the real game. Phase B replaces this with renderer.drawFrame.
 * Iso projection: 2:1 diamonds; tile (tx,ty) → screen (ox + (tx-ty)*T, oy + (tx+ty)*T/2).
 */
function drawSplash(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // ---- isometric ground (Hay Day gameplay view: grass fills the whole screen) ----
  const T = Math.max(56, w / 18);            // half-width of a tile diamond
  const ox = w / 2, oy = h * 0.3;            // grid origin (top corner of tile 0,0)
  const iso = (tx, ty) => [ox + (tx - ty) * T, oy + (tx + ty) * (T / 2)];
  const N = 12;

  // base grass fill so the checker never shows gaps at screen edges
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, w, h);

  const diamond = (tx, ty, fill) => {
    const [x, y] = iso(tx, ty);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + T, y + T / 2);
    ctx.lineTo(x, y + T);
    ctx.lineTo(x - T, y + T / 2);
    ctx.closePath();
    ctx.fill();
  };

  // grass checker with tonal variation (wide range so tiles cover every screen corner)
  for (let ty = -8; ty < N + 8; ty++)
    for (let tx = -8; tx < N + 8; tx++)
      diamond(tx, ty, (((tx + ty) % 2) + 2) % 2 ? PALETTE.grass : PALETTE.grassLight);

  // dirt path running down-right
  for (let i = -8; i < N + 8; i++) diamond(i, 3, '#d9b072');

  // ---- tilled plots (2 ready wheat, 1 growing, 1 empty) ----
  const plot = (tx, ty, kind) => {
    const [x, y] = iso(tx, ty);
    diamond(tx, ty, PALETTE.soil);
    // furrow rows, clipped to the plot diamond
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + T, y + T / 2);
    ctx.lineTo(x, y + T);
    ctx.lineTo(x - T, y + T / 2);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = PALETTE.soilRow;
    ctx.lineWidth = 3;
    for (let f = 0.25; f < 1; f += 0.25) {
      ctx.beginPath();
      ctx.moveTo(x - T, y + T * f);
      ctx.lineTo(x + T, y - T + T * f + T);
      ctx.stroke();
    }
    ctx.restore();
    if (kind === 'wheat') {
      // golden wheat tufts
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

  // ---- fence beside the field (posts + rails so it reads as a fence) ----
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

  // ---- Hay Day-style gambrel barn (front-facing iso block) ----
  {
    const [bx, by] = iso(5.2, 4.8);
    const BW = T * 1.9, BH = T * 1.15;
    ctx.fillStyle = 'rgba(30,50,20,0.22)';
    ctx.beginPath(); ctx.ellipse(bx, by + BH * 0.62, BW * 0.72, BH * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    // body
    const body = ctx.createLinearGradient(bx - BW / 2, 0, bx + BW / 2, 0);
    body.addColorStop(0, PALETTE.roof);
    body.addColorStop(1, PALETTE.roofDark);
    ctx.fillStyle = body;
    ctx.fillRect(bx - BW / 2, by - BH * 0.35, BW, BH);
    // white trim
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.strokeRect(bx - BW / 2, by - BH * 0.35, BW, BH);
    // gambrel roof (two-slope silhouette)
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
    // hayloft window + doors
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

  // soft cloud shadows on the grass
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
