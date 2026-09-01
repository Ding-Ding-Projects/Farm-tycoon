// guide_dough.js — "Guide the Sheet". The pasta kitchen's playable item.
//
// Family: steer. The model sees {steer, throttle}: a heading you correct and a throttle you hold
// to keep the sheet moving. The sheet has MOMENTUM, so a correction takes effect a moment after
// you make it, and it drifts on its own besides.
//
// That lag is the whole difference from balance. pour_tin answers your hand immediately, so it is
// a holding game; this one answers late, so it is an anticipation game: you steer for where the
// sheet is about to be, not where it is.

export const id = 'guide_dough';

const DURATION_MS = 14000;
const LENGTH = 1;

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.7 : 1);
  const corridor = assist ? 0.30 : 0.16;
  const drift = assist ? 0.10 : 0.30;
  const inertia = assist ? 0.75 : 0.45;   // higher = answers your hand faster

  const rng = mulberry32(seed);
  const phase = rng() * Math.PI * 2;
  const wobble = 0.55 + rng() * 0.5;

  let elapsed = 0;
  let fed = 0;          // how much sheet has gone through
  let pos = 0;          // lateral position of the sheet, -1..1
  let vel = 0;
  let onTrack = 0;
  let samples = 0;
  let finished = false;

  const centre = (t) => Math.sin(phase + (t / 1000) * wobble) * 0.42;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      const secs = dt / 1000;
      elapsed += dt;

      const steer = input && typeof input.steer === 'number' ? Math.max(-1, Math.min(1, input.steer)) : 0;
      const throttle = input && typeof input.throttle === 'number' ? Math.max(0, Math.min(1, input.throttle)) : 0;

      // Momentum: your steer moves a VELOCITY, not the position, so corrections land late.
      vel += (steer * 1.6 - vel) * inertia * secs * 6;
      vel += (rng() - 0.5) * drift * secs;
      pos = Math.max(-1, Math.min(1, pos + vel * secs));

      fed = Math.min(LENGTH, fed + throttle * secs * 0.09);

      if (throttle > 0.05) {
        if (Math.abs(pos - centre(elapsed)) <= corridor) onTrack += 1;
        samples += 1;
      }

      if (fed >= LENGTH || elapsed >= limitMs) finished = true;
    },

    score() {
      if (samples === 0) return 0;
      // Both halves again: a sheet held perfectly on line but never fed through is not pasta.
      const straight = onTrack / samples;
      const s = straight * 0.6 + (fed / LENGTH) * 0.4;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return fed / LENGTH; },
    done() { return finished; },

    snapshot() {
      return { pos, centre: centre(elapsed), corridor, fed: fed / LENGTH, moving: samples > 0 };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-steer');
  host.innerHTML = '';

  const track = doc.createElement('div'); track.className = 'track';
  const lane = doc.createElement('span'); lane.className = 'lane';
  const sheet = doc.createElement('span'); sheet.className = 'sheet';
  track.append(lane, sheet);

  const fedBar = doc.createElement('div'); fedBar.className = 'fed';
  const fill = doc.createElement('span'); fill.className = 'fill';
  fedBar.appendChild(fill);

  const status = doc.createElement('span'); status.className = 'status';
  host.append(track, fedBar, status);

  let lastWord = '';
  return {
    render(snap) {
      lane.style.left = `${Math.round((snap.centre + 1) / 2 * 100)}%`;
      lane.style.width = `${Math.round(snap.corridor * 100)}%`;
      sheet.style.left = `${Math.round((snap.pos + 1) / 2 * 100)}%`;
      fill.style.width = `${Math.round(snap.fed * 100)}%`;
      const word = snap.moving ? 'Feeding — steer ahead of the drift' : 'Hold to feed the sheet through';
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-steer'); host.innerHTML = ''; },
  };
}
