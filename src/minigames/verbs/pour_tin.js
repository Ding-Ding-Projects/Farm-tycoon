// pour_tin.js — "Pour the Tin". Stage 2 of a cake.
//
// Family: balance. The model sees {ax, ay} in -1..1 and nothing else. The tin fills at a fixed
// rate; your job is to keep it LEVEL while it does, against a lean that keeps building to one
// side. Let it tip and the batter runs to one edge, and a cake poured off-level bakes lopsided.
//
// It is the only verb that scores a two-axis hold rather than a position, a tempo or a target.

export const id = 'pour_tin';

const DURATION_MS = 9000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const tolerance = assist ? 0.42 : 0.24;
  const leanRate = assist ? 0 : 0.34;   // assist removes the drift rather than slowing it

  const rng = mulberry32(seed);
  const phaseX = rng() * Math.PI * 2;
  const phaseY = rng() * Math.PI * 2;
  const speedX = 0.6 + rng() * 0.5;
  const speedY = 0.5 + rng() * 0.5;

  let elapsed = 0;
  let level = 0;      // how much time was spent level
  let samples = 0;
  let spill = 0;
  let finished = false;

  // The lean the tin takes on its own; the player counters it with their own tilt.
  function lean(t) {
    const s = t / 1000;
    return {
      x: Math.sin(phaseX + s * speedX) * leanRate,
      y: Math.cos(phaseY + s * speedY) * leanRate,
    };
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const l = lean(elapsed);
      const ax = (input && typeof input.ax === 'number') ? input.ax : 0;
      const ay = (input && typeof input.ay === 'number') ? input.ay : 0;
      // Net tilt is the tin's own lean plus whatever the player is doing about it.
      const netX = l.x + ax * 0.5;
      const netY = l.y + ay * 0.5;
      const off = Math.hypot(netX, netY);

      if (off <= tolerance) level += 1;
      else if (off > tolerance * 2) spill += 1;
      samples += 1;

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (samples === 0) return 0;
      const s = Math.max(0, (level / samples) - Math.min(0.3, (spill / samples) * 0.6));
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, elapsed / limitMs); },
    done() { return finished; },

    snapshot() {
      const l = lean(elapsed);
      return {
        leanX: l.x,
        leanY: l.y,
        fill: Math.min(1, elapsed / limitMs),
        level: samples > 0 ? level / samples : 0,
        tolerance,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-pour');
  host.innerHTML = '';

  const tin = doc.createElement('div'); tin.className = 'tin';
  const batter = doc.createElement('span'); batter.className = 'batter';
  const bubble = doc.createElement('span'); bubble.className = 'bubble';
  tin.append(batter, bubble);

  const status = doc.createElement('span');
  status.className = 'status';

  host.append(tin, status);

  let lastWord = '';
  return {
    render(snap) {
      batter.style.height = `${Math.round(snap.fill * 100)}%`;
      // The whole tin tips, and the spirit-level bubble rides against it.
      tin.style.transform = `rotate(${(snap.leanX * 9).toFixed(2)}deg)`;
      bubble.style.left = `${50 + snap.leanX * 40}%`;
      bubble.style.top = `${50 + snap.leanY * 40}%`;
      const word = Math.hypot(snap.leanX, snap.leanY) <= snap.tolerance
        ? 'Level — keep it there' : 'Tipping — steady it';
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-pour'); host.innerHTML = ''; },
  };
}
