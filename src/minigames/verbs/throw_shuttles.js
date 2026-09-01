// throw_shuttles.js — "Throw the Shuttles". The loom's playable item.
//
// Family: dual. The model sees {left, right}: two independent 0..1 values held at the same time,
// one per hand. Two shuttles run the weave from opposite sides and each wants its own tension,
// and the two asks drift APART, so there is no single position that satisfies both.
//
// That is what separates it from balance: pour_tin is one point in two dimensions, and one hand
// can hold it. This cannot be held by one hand at all, which is the whole game.

export const id = 'throw_shuttles';

const DURATION_MS = 13000;

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
  const tolerance = assist ? 0.24 : 0.13;
  const spread = assist ? 0.6 : 1;   // assist keeps the two asks closer together

  const rng = mulberry32(seed);
  const pl = rng() * Math.PI * 2, pr = rng() * Math.PI * 2;
  const sl = 0.5 + rng() * 0.4, sr = 0.45 + rng() * 0.4;

  let elapsed = 0;
  let bothGood = 0;
  let oneGood = 0;
  let samples = 0;
  let finished = false;

  const wantLeft = (t) => 0.5 + Math.sin(pl + (t / 1000) * sl) * 0.32 * spread;
  const wantRight = (t) => 0.5 + Math.cos(pr + (t / 1000) * sr) * 0.32 * spread;

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      const l = input && typeof input.left === 'number' ? input.left : 0;
      const r = input && typeof input.right === 'number' ? input.right : 0;
      const okL = Math.abs(l - wantLeft(elapsed)) <= tolerance;
      const okR = Math.abs(r - wantRight(elapsed)) <= tolerance;

      if (okL && okR) bothGood += 1;
      else if (okL || okR) oneGood += 1;
      samples += 1;

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (samples === 0) return 0;
      // Holding one side right is worth something, but the weave only comes out even when both
      // are, so a half-credit term keeps it from being all-or-nothing without making it easy.
      const s = (bothGood + oneGood * 0.3) / samples;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, elapsed / limitMs); },
    done() { return finished; },

    snapshot() {
      return {
        wantLeft: wantLeft(elapsed), wantRight: wantRight(elapsed),
        tolerance, woven: samples > 0 ? bothGood / samples : 0,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-dual');
  host.innerHTML = '';

  const mk = (cls) => {
    const col = doc.createElement('div'); col.className = `rail ${cls}`;
    const want = doc.createElement('span'); want.className = 'want';
    col.appendChild(want);
    return { col, want };
  };
  const L = mk('left'), R = mk('right');
  const status = doc.createElement('span'); status.className = 'status';
  host.append(L.col, status, R.col);

  let lastWord = '';
  return {
    render(snap) {
      L.want.style.bottom = `${Math.round(snap.wantLeft * 100)}%`;
      R.want.style.bottom = `${Math.round(snap.wantRight * 100)}%`;
      const word = 'Hold both marks: Q/A left, P/L right';
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-dual'); host.innerHTML = ''; },
  };
}
