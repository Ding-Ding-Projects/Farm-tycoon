// catch_kernels.js — "Catch the Kernels". The popcorn pot's playable item.
//
// Family: steer, and the second. guide_dough is about STAYING ON a line while something drifts you
// off it: the target is continuous and the failure is leaving it. This is INTERCEPTION: kernels
// pop out at random and fall, and the bowl has to be underneath each one when it lands. The target
// is discrete, it jumps, and there is nothing to stay on between catches.
//
// One verb is a tracking problem, the other is a series of journeys. Both are steered; neither
// strategy helps with the other.

export const id = 'catch_kernels';

const KERNELS = 9;
const FALL_MS = 1250;
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
  const fallMs = FALL_MS * (assist ? 1.7 : 1);
  // Narrow, and the kernels spread right to the edges. At 0.13 with the bowl parked in the
  // middle, doing nothing at all caught 44% of them - half the game played itself.
  const catchWidth = assist ? 0.16 : 0.08;
  const speed = assist ? 1.5 : 1.15;   // bowl travel per second at full steer

  const rng = mulberry32(seed);
  const lands = [];
  for (let i = 0; i < KERNELS; i++) lands.push(0.04 + rng() * 0.92);

  let bowl = 0.5;
  let index = 0;
  let t = 0;
  let caught = 0;
  let elapsed = 0;
  let finished = false;
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;
      t += dt;

      const steer = input && typeof input.steer === 'number' ? Math.max(-1, Math.min(1, input.steer)) : 0;
      bowl = Math.max(0, Math.min(1, bowl + steer * speed * (dt / 1000)));

      if (t >= fallMs) {
        // It has landed. Either the bowl was there or it was not; there is no partial catch.
        if (Math.abs(bowl - lands[index]) <= catchWidth) { caught += 1; lastResult = 'caught'; }
        else lastResult = 'missed';
        index += 1;
        t = 0;
        if (index >= KERNELS) finished = true;
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const s = caught / KERNELS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, index / KERNELS); },
    done() { return finished; },

    snapshot() {
      return {
        bowl,
        target: index < KERNELS ? lands[index] : -1,
        fall: Math.min(1, t / fallMs),
        caught,
        index: Math.min(index + 1, KERNELS),
        kernels: KERNELS,
        catchWidth,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-catch');
  host.innerHTML = '';

  const pot = doc.createElement('div');
  pot.className = 'pot';
  const kernel = doc.createElement('span'); kernel.className = 'kernel';
  const bowl = doc.createElement('span'); bowl.className = 'bowl';
  pot.append(kernel, bowl);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(pot, status);

  let announced = -1;
  return {
    render(snap) {
      if (snap.target >= 0) {
        kernel.style.display = '';
        kernel.style.left = `${Math.round(snap.target * 100)}%`;
        kernel.style.top = `${Math.round(snap.fall * 74)}%`;
      } else {
        kernel.style.display = 'none';
      }
      bowl.style.left = `${Math.round(snap.bowl * 100)}%`;
      bowl.style.width = `${Math.round(snap.catchWidth * 2 * 100)}%`;
      status.textContent = `${snap.caught} of ${snap.kernels} caught`;
      if (ctx.announce && snap.index !== announced) {
        announced = snap.index;
        ctx.announce(status.textContent);
      }
    },
    unmount() { host.classList.remove('stage-catch'); host.innerHTML = ''; },
  };
}
