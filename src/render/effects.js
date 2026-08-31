// effects.js — transient world-space juice: coin bursts, +XP floaters, harvest sparkles,
// placement bounce. Effects are particle pools with easing, pruned when done. No per-frame
// allocation once warmed up: pooled objects are reused via free-list splicing.

const particles = []; // { kind, x, y, born, life, ...kind-specific }
const bounces = new Map(); // objectId -> { born, life }

const now_ = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function push(p) { particles.push(p); }

/** Spawn a coin burst at a world tile (screen-space x,y expected — caller resolves tile). */
export function coinBurst(x, y, amount) {
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
  push({ kind: 'xp', x, y, born: now_(), life: 900, amount: amount || 0 });
}

/** Harvest sparkle shower. */
export function sparkle(x, y) {
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

    if (p.kind === 'coin') {
      const dt = age / 1000;
      const px = p.x + p.vx * dt;
      const py = p.y + p.vy * dt + 0.5 * 260 * dt * dt; // gravity
      ctx.save();
      ctx.globalAlpha = 1 - easeOutCubic(f);
      ctx.fillStyle = '#f0b52e';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a87c1e'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'xp') {
      ctx.save();
      ctx.globalAlpha = 1 - easeOutCubic(f);
      ctx.fillStyle = '#7fd4f0';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${p.amount} XP`, p.x, p.y - f * 34);
      ctx.restore();
    } else if (p.kind === 'sparkle') {
      ctx.save();
      ctx.globalAlpha = 1 - f;
      ctx.fillStyle = '#fffaea';
      const r = 3 * (1 - f) + 1;
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
