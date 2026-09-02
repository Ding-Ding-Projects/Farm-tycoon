// effects.js — transient world-space juice: coin bursts, +XP floaters, harvest sparkles,
// placement bounce. Effects are particle pools with easing, pruned when done. No per-frame
// allocation once warmed up: pooled objects are reused via free-list splicing.

import * as motion from '../motion.js';

const particles = []; // { kind, x, y, born, life, ...kind-specific }
const bounces = new Map(); // objectId -> { born, life }

// ONE clock, shared with the frame loop. renderer.drawFrame hands tickAndDraw() main.js's
// Date.now(); particles used to be stamped with performance.now() instead, so every one of them
// was born ~1.7e12 ms "ago" and pruned on its first frame - which is why no coin burst was ever
// seen. Both sides now read Date.now().
const now_ = () => Date.now();

// Glyph size follows the camera so a burst over a zoomed-out farm is not a hail of boulders.
let zoomRef = 1;
export function setZoom(z) { zoomRef = Math.max(0.5, Math.min(2.5, z || 1)); }

function push(p) { particles.push(p); }

/**
 * Spawn a coin burst at a world tile (screen-space x,y expected — caller resolves tile).
 *
 * Suppressed entirely under reduced motion, along with the other particle spawners below. These
 * are the clearest case in the game for it: a burst of ten objects flying outward under gravity is
 * pure decoration and carries no information a player would otherwise lose - the coins have
 * already been added and the HUD counter says so. Dropping them at the SPAWNER rather than in the
 * draw loop also means no pooled object is created in the first place.
 */
export function coinBurst(x, y, amount) {
  if (motion.isReduced()) return;
  const n = Math.min(10, 4 + Math.floor(Math.log2(Math.max(1, amount || 1))));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 60 + Math.random() * 60;
    push({
      kind: 'coin', x, y, born: now_(), life: 700 + Math.random() * 200,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 90,
    });
  }
}

/** Floating "+N XP" text. */
export function xpFloater(x, y, amount) {
  if (motion.isReduced()) return;
  push({ kind: 'xp', x, y, born: now_(), life: 900, amount: amount || 0 });
}

/** Harvest sparkle shower. */
export function sparkle(x, y) {
  if (motion.isReduced()) return;
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 14;
    push({
      kind: 'sparkle', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
      born: now_(), life: 450 + Math.random() * 150,
    });
  }
}

/** Elastic bounce applied to a newly placed object. Read via bounceScale(objectId, now). */
export function placeBounce(objectId) {
  if (motion.isReduced()) return;
  bounces.set(objectId, { born: now_(), life: 380 });
}

/** Current scale multiplier for a placed object mid-bounce (1 when no bounce is active). */
export function bounceScale(objectId, now) {
  const b = bounces.get(objectId);
  if (!b) return 1;
  const t = ((now ?? now_()) - b.born) / b.life;
  if (t >= 1) { bounces.delete(objectId); return 1; }
  // overshoot-and-settle: scale bounces above 1 then eases back
  const damped = Math.exp(-6 * t) * Math.cos(t * Math.PI * 3);
  return 1 + damped * 0.22;
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

/** Advance + draw all live effects (called by renderer.drawFrame). Prunes expired particles. */
export function tickAndDraw(ctx, now) {
  const t = now ?? now_();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const age = t - p.born;
    if (age >= p.life) { particles.splice(i, 1); continue; }
    const f = age / p.life;

    const z = 0.7 + zoomRef * 0.3;   // glyphs follow zoom gently, never shrinking below 0.85x
    if (p.kind === 'coin') {
      const dt = age / 1000;
      const px = p.x + p.vx * dt;
      const py = p.y + p.vy * dt + 0.5 * 260 * dt * dt; // gravity
      ctx.save();
      ctx.globalAlpha = 1 - easeOutCubic(f);
      ctx.fillStyle = '#f0b52e';
      ctx.beginPath(); ctx.arc(px, py, 6 * z, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a87c1e'; ctx.lineWidth = 1.5 * z; ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,180,0.7)';
      ctx.beginPath(); ctx.arc(px - 2 * z, py - 2 * z, 2 * z, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'xp') {
      ctx.save();
      ctx.globalAlpha = 1 - easeOutCubic(f);
      ctx.font = `bold ${Math.round(15 * z)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3 * z;
      ctx.strokeStyle = 'rgba(40,24,8,0.75)';
      ctx.strokeText(`+${p.amount} XP`, p.x, p.y - f * 34);
      ctx.fillStyle = '#9fe8ff';
      ctx.fillText(`+${p.amount} XP`, p.x, p.y - f * 34);
      ctx.restore();
    } else if (p.kind === 'sparkle') {
      ctx.save();
      ctx.globalAlpha = 1 - f;
      ctx.fillStyle = '#fffaea';
      const r = (3 * (1 - f) + 1) * z;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

/** Test/debug hook: current live particle count. */
export function particleCount() { return particles.length; }
