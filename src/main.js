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
 * Scaffold splash — a hand-drawn meadow vista so the scaffold boots to something
 * pleasant. Phase B replaces this with renderer.drawFrame's real farm world.
 */
function drawSplash(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#8fd3ff');
  sky.addColorStop(1, '#dff3ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.55);

  // sun
  ctx.fillStyle = 'rgba(255, 236, 160, 0.9)';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.16, 46, 0, Math.PI * 2);
  ctx.fill();

  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [cx, cy, s] of [[0.18, 0.14, 1], [0.45, 0.22, 0.7], [0.68, 0.1, 0.85]]) {
    for (const [ox, oy, r] of [[-38, 0, 26], [0, -12, 34], [36, 0, 24]]) {
      ctx.beginPath();
      ctx.arc(w * cx + ox * s, h * cy + oy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // rolling hills
  const hill = (yBase, bulge, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, yBase);
    ctx.quadraticCurveTo(w * 0.5, yBase - bulge, w, yBase);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  hill(h * 0.52, h * 0.1, PALETTE.grassDark);
  hill(h * 0.58, h * 0.14, PALETTE.grass);
  hill(h * 0.72, h * 0.08, '#8ed45e');

  // tilled field patch
  ctx.save();
  ctx.translate(w * 0.24, h * 0.78);
  ctx.rotate(-0.04);
  ctx.fillStyle = PALETTE.soil;
  ctx.fillRect(-110, -34, 220, 68);
  ctx.fillStyle = PALETTE.soilDark;
  for (let i = -96; i < 100; i += 24) ctx.fillRect(i, -30, 9, 60);
  ctx.restore();

  // little barn
  ctx.save();
  ctx.translate(w * 0.7, h * 0.68);
  ctx.fillStyle = 'rgba(30,50,20,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, 44, 74, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.roof;
  ctx.fillRect(-60, -10, 120, 52);
  ctx.fillStyle = '#c94b40';
  ctx.beginPath();
  ctx.moveTo(-70, -8);
  ctx.lineTo(0, -52);
  ctx.lineTo(70, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  ctx.fillRect(-14, 8, 28, 34);
  ctx.restore();
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
