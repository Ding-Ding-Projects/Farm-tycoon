// split_press.js — "Split the Press". The juice press's playable item.
//
// Family: route, and the second. sort_chillies is MATCHING: each pepper has one correct chute and
// the only question is whether you opened it in time. This is ALLOCATION: every bottle is a legal
// destination for every drop, there is one fixed pressing to divide, and the bottles want
// DIFFERENT amounts. Nothing is ever wrong on its own; a choice is only wrong relative to how you
// spend the rest.
//
// So one verb asks "which one is correct" and this one asks "how should the whole be divided".
// A player who solves the first by reacting fast gets nothing from that here.

export const id = 'split_press';

const BOTTLES = 3;
const DURATION_MS = 14000;

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
  const tolerance = assist ? 0.18 : 0.09;

  // Targets sum to 1: the pressing is fixed, so filling one bottle generously necessarily
  // shorts another. Assist evens them out rather than shortening the run.
  const rng = mulberry32(seed);
  const raw = [];
  for (let i = 0; i < BOTTLES; i++) raw.push(assist ? 1 : 0.4 + rng());
  const sum = raw.reduce((a, b) => a + b, 0);
  const targets = raw.map((v) => v / sum);

  const filled = new Array(BOTTLES).fill(0);
  let poured = 0;      // fraction of the pressing spent
  let elapsed = 0;
  let finished = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const lane = input && typeof input.lane === 'number' ? input.lane : -1;
      // Juice only flows while a bottle is actually selected, so standing idle spends nothing
      // and simply runs the clock down with the pressing unspent.
      if (lane >= 0 && lane < BOTTLES && poured < 1) {
        const give = Math.min(1 - poured, (dt / 1000) * 0.28);
        filled[lane] += give;
        poured += give;
      }

      if (poured >= 1 || elapsed >= limitMs) finished = true;
    },

    score() {
      // Scored on how close each bottle came to its share, plus how much of the pressing was
      // actually used - a tidy split of a third of the juice is still a wasted pressing.
      let accuracy = 0;
      for (let i = 0; i < BOTTLES; i++) {
        const off = Math.abs(filled[i] - targets[i]);
        accuracy += Math.max(0, 1 - off / Math.max(tolerance * 3, 1e-6));
      }
      accuracy /= BOTTLES;
      const s = accuracy * 0.7 + poured * 0.3;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, poured); },
    done() { return finished; },

    snapshot() {
      return {
        bottles: BOTTLES,
        targets,
        filled: filled.slice(),
        poured,
        tolerance,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-split');
  host.innerHTML = '';

  const row = doc.createElement('div');
  row.className = 'bottles';
  const bottles = [];
  for (let i = 0; i < BOTTLES; i++) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'bottle';
    b.dataset.pad = String(i);
    const want = doc.createElement('span'); want.className = 'want';
    const juice = doc.createElement('span'); juice.className = 'juice';
    b.append(want, juice);
    b.setAttribute('aria-label', `Bottle ${i + 1}`);
    row.appendChild(b);
    bottles.push({ b, want, juice });
  }
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(row, status);

  let lastWord = '';
  return {
    render(snap) {
      for (let i = 0; i < bottles.length; i++) {
        bottles[i].want.style.bottom = `${Math.round(snap.targets[i] * 100)}%`;
        bottles[i].juice.style.height = `${Math.round(Math.min(1, snap.filled[i]) * 100)}%`;
      }
      const word = `${Math.round(snap.poured * 100)}% of the pressing spent - the bottles want different amounts`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-split'); host.innerHTML = ''; },
  };
}
