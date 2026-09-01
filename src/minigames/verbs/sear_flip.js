// sear_flip.js — "Sear and Flip". The grill's playable item.
//
// Family: rhythm, and the third. tie_bouquet is a metronome you keep time with; dip_wick is a
// fixed pattern you keep the shape of. Both tell you when the beat is. This one does not: the
// meat is ready when it is ready, the interval varies every time, and the only thing you can go
// on is the sizzle building. You are reading a signal, not counting.
//
// So the three rhythm verbs are: keep time, keep a shape, and read when. A player who has learned
// to count gets nothing from counting here.

export const id = 'sear_flip';

const FLIPS = 7;
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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.9 : 1);
  // The window either side of "done" that still counts. Assist widens it; it does NOT make the
  // intervals predictable, because unpredictability is the verb.
  const window_ = assist ? 420 : 230;

  const rng = mulberry32(seed);
  const cooks = [];
  for (let i = 0; i < FLIPS; i++) cooks.push(900 + rng() * 1100);   // wildly uneven on purpose

  let elapsed = 0;
  let onSide = 0;      // ms this side has been down
  let flips = 0;
  let quality = 0;
  let burnt = 0;
  let finished = false;
  let lastResult = null;

  const wanted = () => cooks[Math.min(flips, FLIPS - 1)];

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;
      onSide += dt;

      const taps = (input && Array.isArray(input.taps)) ? input.taps.length : 0;
      if (taps > 0) {
        const want = wanted();
        const off = Math.abs(onSide - want);
        if (off <= window_) {
          quality += 1 - (off / window_) * 0.45;
          lastResult = 'seared';
        } else if (onSide < want) {
          lastResult = 'flipped early - still raw';
        } else {
          lastResult = 'left too long - catching';
        }
        flips += 1;
        onSide = 0;
        if (flips >= FLIPS) finished = true;
        return;
      }

      // Leaving it far too long burns that side; the run keeps moving so it can never stall.
      if (onSide > wanted() + window_ * 3) {
        burnt += 1;
        flips += 1;
        onSide = 0;
        lastResult = 'burnt';
        if (flips >= FLIPS) finished = true;
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const s = quality / FLIPS - Math.min(0.25, burnt * 0.05);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, flips / FLIPS); },
    done() { return finished; },

    snapshot() {
      const want = wanted();
      // The ONLY cue: how far along this side is, which the view shows as a sizzle building.
      // The number itself is never revealed, so it cannot be counted, only read.
      return {
        sizzle: Math.max(0, Math.min(1.4, onSide / want)),
        ready: Math.abs(onSide - want) <= window_,
        over: onSide > want + window_,
        flips,
        need: FLIPS,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-sear');
  host.innerHTML = '';

  const pan = doc.createElement('div');
  pan.className = 'pan';
  const steak = doc.createElement('span'); steak.className = 'steak';
  pan.appendChild(steak);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(pan, status);

  let lastWord = '';
  return {
    render(snap) {
      // Sizzle is shown as the steak browning, so the cue is visual AND stated in words.
      const b = Math.min(1, snap.sizzle);
      steak.style.filter = `saturate(${(0.6 + b * 0.9).toFixed(2)}) brightness(${(1.15 - b * 0.45).toFixed(2)})`;
      steak.classList.toggle('ready', snap.ready);
      const word = snap.over ? 'Catching - flip it now'
        : snap.ready ? 'Seared - flip it' : 'Still searing';
      status.textContent = `${word} - ${snap.flips} of ${snap.need}`;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-sear'); host.innerHTML = ''; },
  };
}
