// pin_brim.js — "True the Brim". The hat maker's playable item.
//
// Family: sequence, and the third one, so again the distinction has to be real. press_cutter is
// REACTION: hit whichever is lit. place_decor is RECALL: remember an order and repeat it. This is
// SYMMETRY: nothing is ever lit and there is nothing to remember, but every pin you place demands
// its opposite number across the brim, or the hat sits crooked.
//
// The board is fully visible the whole time. It is a reasoning game played with the same one-pad
// input, which is exactly what a family is supposed to allow.

export const id = 'pin_brim';

const PINS = 12;              // positions around the brim, so the opposite of i is i + 6
const OPPOSITE = PINS / 2;
const PAIRS = 4;              // how many pairs to true
const DURATION_MS = 15000;

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 2 : 1);

  // Some pins are pre-set and their partners are the ones you owe. Assist marks the partner.
  const rng = mulberry32(seed);
  const seeded = [];
  while (seeded.length < PAIRS) {
    const p = Math.floor(rng() * PINS);
    if (!seeded.includes(p) && !seeded.includes((p + OPPOSITE) % PINS)) seeded.push(p);
  }

  const pinned = new Set(seeded);
  let trued = 0;
  let wrong = 0;
  let elapsed = 0;
  let finished = false;
  let lastResult = null;

  const owed = () => seeded.map((p) => (p + OPPOSITE) % PINS).filter((p) => !pinned.has(p));

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && typeof input.padIndex === 'number') {
        const p = input.padIndex;
        if (p >= 0 && p < PINS && !pinned.has(p)) {
          if (owed().includes(p)) { pinned.add(p); trued += 1; lastResult = 'true'; }
          else { wrong += 1; lastResult = 'crooked'; }
        }
      }

      if (trued >= PAIRS || elapsed >= limitMs) finished = true;
    },

    score() {
      const s = trued / PAIRS - Math.min(0.3, wrong * 0.07);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, trued / PAIRS); },
    done() { return finished; },

    snapshot() {
      return {
        pins: PINS,
        pinned: [...pinned],
        owed: assist ? owed() : [],   // assist shows the partners; it does not shorten the job
        trued, need: PAIRS, wrong,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-brim');
  host.innerHTML = '';

  const ring = doc.createElement('div'); ring.className = 'ring';
  const pins = [];
  for (let i = 0; i < PINS; i++) {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'pin';
    b.dataset.pad = String(i);
    const a = (i / PINS) * Math.PI * 2 - Math.PI / 2;
    b.style.left = `${50 + Math.cos(a) * 42}%`;
    b.style.top = `${50 + Math.sin(a) * 42}%`;
    b.setAttribute('aria-label', `Pin ${i + 1}, opposite pin ${((i + OPPOSITE) % PINS) + 1}`);
    ring.appendChild(b);
    pins.push(b);
  }
  const status = doc.createElement('span'); status.className = 'status';
  host.append(ring, status);

  let announced = -1;
  return {
    render(snap) {
      for (let i = 0; i < pins.length; i++) {
        pins[i].classList.toggle('set', snap.pinned.includes(i));
        pins[i].classList.toggle('owed', snap.owed.includes(i));
      }
      status.textContent = `${snap.trued} of ${snap.need} pairs trued`;
      if (ctx.announce && snap.trued !== announced) {
        announced = snap.trued;
        ctx.announce(status.textContent);
      }
    },
    unmount() { host.classList.remove('stage-brim'); host.innerHTML = ''; },
  };
}
