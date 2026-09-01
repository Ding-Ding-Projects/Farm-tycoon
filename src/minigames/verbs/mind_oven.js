// mind_oven.js — "Mind the Oven". The bake. Weighted heaviest in a cake chain, because it is
// the stage that decides whether the thing is a cake.
//
// Family: sustain. The model sees {held, heldMs}. Heat RISES while you hold the door shut and
// FALLS when you let go, and the band you are trying to sit in drifts, so it cannot be played
// by jamming the button down — overshooting burns exactly as badly as going cold.
//
// This is the one verb where doing nothing is visibly wrong rather than merely unscored: heat
// decays to nothing and the score reflects a raw cake. It still ENDS, though, on its own clock.

export const id = 'mind_oven';

const DURATION_MS = 12000;
const RISE_PER_S = 0.55;
const FALL_PER_S = 0.42;

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
  const halfBand = assist ? 0.17 : 0.10;   // assist widens the target, it does not slow the bake
  const drift = assist ? 0 : 0.055;        // and removes the drift entirely

  const rng = mulberry32(seed);
  const phase = rng() * Math.PI * 2;
  const wobble = 0.7 + rng() * 0.6;

  let elapsed = 0;
  let heat = 0.12;
  let inBand = 0;
  let samples = 0;
  let scorched = 0;
  let finished = false;

  function bandCentre(t) {
    return 0.55 + Math.sin(phase + (t / 1000) * wobble) * drift;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;
      const secs = dt / 1000;

      const held = !!(input && input.held);
      heat += held ? RISE_PER_S * secs : -FALL_PER_S * secs;
      heat = Math.max(0, Math.min(1, heat));

      const c = bandCentre(elapsed);
      const off = Math.abs(heat - c);
      if (off <= halfBand) inBand += 1;
      else if (heat > c + halfBand * 2.2) scorched += 1; // running it far too hot is its own fault
      samples += 1;

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (samples === 0) return 0;
      const kept = inBand / samples;
      const burn = Math.min(0.35, (scorched / samples) * 0.7);
      const s = Math.max(0, kept - burn);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, elapsed / limitMs); },
    done() { return finished; },

    snapshot() {
      const c = bandCentre(elapsed);
      return {
        heat,
        bandLow: Math.max(0, c - halfBand),
        bandHigh: Math.min(1, c + halfBand),
        inBand: Math.abs(heat - c) <= halfBand,
        remaining: Math.max(0, 1 - elapsed / limitMs),
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-gauge');
  host.innerHTML = '';

  const column = doc.createElement('div'); column.className = 'column';
  const band = doc.createElement('span'); band.className = 'band';
  const level = doc.createElement('span'); level.className = 'level';
  const needle = doc.createElement('span'); needle.className = 'needle';
  column.append(band, level, needle);

  const side = doc.createElement('div');
  side.style.flex = '1';
  const state = doc.createElement('span');
  state.className = 'status';
  side.appendChild(state);

  host.append(column, side);

  let lastState = '';
  return {
    render(snap) {
      level.style.height = `${Math.round(snap.heat * 100)}%`;
      needle.style.bottom = `${Math.round(snap.heat * 100)}%`;
      band.style.bottom = `${Math.round(snap.bandLow * 100)}%`;
      band.style.height = `${Math.round((snap.bandHigh - snap.bandLow) * 100)}%`;
      // Never colour-only: the state is spelled out as words as well as shown on the gauge.
      const word = snap.inBand ? 'Just right — hold it there'
        : snap.heat > snap.bandHigh ? 'Too hot — let it off'
          : 'Too cool — hold to heat';
      state.textContent = word;
      if (ctx.announce && word !== lastState) { lastState = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-gauge'); host.innerHTML = ''; },
  };
}
