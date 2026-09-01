// crimp_edge.js — "Crimp the Edge". The pie oven's playable item.
//
// Family: sequence, and the fifth. The others are reaction, recall, symmetry and escalating
// tolerance. This is SPACING: every crimp must sit an even distance from the last one, all the way
// round the rim. No single position is right or wrong on its own, and there is nothing to
// remember or react to. What is judged is the GAP between your choices, so the first crimp you
// place decides what every later one has to be.
//
// It is the only verb here where a move is scored against your own previous move rather than
// against anything the game chose.

export const id = 'crimp_edge';

const NOTCHES = 16;      // positions round the rim
const CRIMPS = 6;
const DURATION_MS = 15000;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 2 : 1);
  const slack = assist ? 1.6 : 0.8;   // notches of drift allowed per gap

  const placed = [];
  let elapsed = 0;
  let quality = 0;
  let judged = 0;
  let finished = false;
  let lastResult = null;

  // The gap the rim wants: whatever the FIRST two crimps set, held for the rest.
  const wantedGap = () => (placed.length >= 2 ? gapBetween(placed[0], placed[1]) : null);

  function gapBetween(a, b) {
    const d = (b - a + NOTCHES) % NOTCHES;
    return d === 0 ? NOTCHES : d;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && typeof input.padIndex === 'number' && placed.length < CRIMPS) {
        const p = input.padIndex;
        if (p >= 0 && p < NOTCHES && !placed.includes(p)) {
          if (placed.length >= 2) {
            const want = wantedGap();
            const got = gapBetween(placed[placed.length - 1], p);
            const off = Math.abs(got - want);
            quality += Math.max(0, 1 - off / (slack + 1));
            judged += 1;
            lastResult = off <= slack ? 'even' : 'uneven';
          } else if (placed.length === 1) {
            // The second crimp sets the spacing, so it cannot be wrong - it defines the answer.
            lastResult = 'spacing set';
          } else {
            lastResult = 'started';
          }
          placed.push(p);
          if (placed.length >= CRIMPS) finished = true;
        }
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (judged === 0) return 0;
      const completion = placed.length / CRIMPS;
      const s = (quality / judged) * 0.75 + completion * 0.25;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, placed.length / CRIMPS); },
    done() { return finished; },

    snapshot() {
      return {
        notches: NOTCHES,
        placed: placed.slice(),
        gap: wantedGap(),
        crimps: placed.length,
        need: CRIMPS,
        slack,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-brim');
  host.innerHTML = '';

  const ring = doc.createElement('div');
  ring.className = 'ring';
  const pins = [];
  for (let i = 0; i < NOTCHES; i++) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'pin';
    b.dataset.pad = String(i);
    const a = (i / NOTCHES) * Math.PI * 2 - Math.PI / 2;
    b.style.left = `${50 + Math.cos(a) * 42}%`;
    b.style.top = `${50 + Math.sin(a) * 42}%`;
    b.setAttribute('aria-label', `Notch ${i + 1}`);
    ring.appendChild(b);
    pins.push(b);
  }
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(ring, status);

  let lastWord = '';
  return {
    render(snap) {
      for (let i = 0; i < pins.length; i++) pins[i].classList.toggle('set', snap.placed.includes(i));
      const word = snap.gap === null
        ? `Crimp ${snap.crimps + 1} - the first two set the spacing`
        : `Keep every gap at ${snap.gap} notches - ${snap.crimps} of ${snap.need}`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-brim'); host.innerHTML = ''; },
  };
}
