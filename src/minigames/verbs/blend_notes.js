// blend_notes.js — "Blend the Notes". The perfumery's playable item.
//
// Family: dual, and the third. throw_shuttles chases two marks that drift apart; roll_press keeps
// two rollers equal while driving both. This is ZERO-SUM: the two notes share one fixed quantity,
// so raising the top note LOWERS the base by exactly as much. Only the ratio between them exists
// at all, and the absolute amounts are not scored.
//
// The other two dual verbs let you improve one side without touching the other. This one never
// does, which is the whole difference.

export const id = 'blend_notes';

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
  const tolerance = assist ? 0.15 : 0.07;

  const rng = mulberry32(seed);
  const target = 0.28 + rng() * 0.44; // the share the TOP note should hold

  let elapsed = 0;
  let held = 0;
  let samples = 0;
  let finished = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      const l = input && typeof input.left === 'number' ? Math.max(0, input.left) : 0;
      const r = input && typeof input.right === 'number' ? Math.max(0, input.right) : 0;
      const total = l + r;
      // Zero-sum by construction: only the RATIO is scored, never the absolute amounts, so there
      // is no way to fix one note without moving the other.
      const share = total <= 1e-6 ? 0 : l / total;

      if (total > 0.1) {
        if (Math.abs(share - target) <= tolerance) held += 1;
        samples += 1;
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (samples === 0) return 0;
      const s = held / samples;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, elapsed / limitMs); },
    done() { return finished; },

    snapshot() {
      return { target, tolerance, blended: samples > 0 ? held / samples : 0 };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-dual');
  host.innerHTML = '';

  const rail = (cls) => {
    const c = doc.createElement('div');
    c.className = `rail ${cls}`;
    const w = doc.createElement('span');
    w.className = 'want';
    c.appendChild(w);
    return { c, w };
  };
  const L = rail('left');
  const R = rail('right');
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(L.c, status, R.c);

  let lastWord = '';
  return {
    render(snap) {
      L.w.style.bottom = `${Math.round(snap.target * 100)}%`;
      R.w.style.bottom = `${Math.round((1 - snap.target) * 100)}%`;
      const word = `Top note ${Math.round(snap.target * 100)}% of the blend - raising one lowers the other`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-dual'); host.innerHTML = ''; },
  };
}
