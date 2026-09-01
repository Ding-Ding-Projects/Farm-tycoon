// swirl_cone.js — "Swirl the Cone". The ice cream maker's playable item.
//
// Family: rate. The model sees {rate} in 0..1 and nothing else — how far the lever is open. The
// cone turns on its own; your job is to match the flow to how much room is left as it fills. Open
// too far and it overflows down the side; too little and the swirl comes out thin and stubby.
//
// The only verb whose input is a single continuous magnitude with no position, no timing and no
// target. Nothing to aim at, nothing to remember: just how hard you are pouring, right now.

export const id = 'swirl_cone';

const DURATION_MS = 10000;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const tolerance = assist ? 0.34 : 0.18;

  let elapsed = 0;
  let filled = 0;      // 0..1 of the cone
  let good = 0;
  let samples = 0;
  let spilled = 0;
  let finished = false;

  // The flow the cone WANTS: generous at the base, easing off near the top so the peak holds.
  function wanted(fill) {
    return Math.max(0.12, 1 - fill * 0.85);
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const rate = (input && typeof input.rate === 'number') ? Math.max(0, Math.min(1, input.rate)) : 0;
      const want = wanted(filled);
      const off = Math.abs(rate - want);

      if (off <= tolerance) good += 1;
      else if (rate > want + tolerance * 2) spilled += 1;
      samples += 1;

      filled = Math.min(1, filled + rate * (dt / 1000) * 0.22);
      if (filled >= 1 || elapsed >= limitMs) finished = true;
    },

    score() {
      if (samples === 0) return 0;
      // Both halves matter: a cone you never filled scores as poorly as one you slopped.
      const accuracy = good / samples;
      const height = filled;
      const waste = Math.min(0.3, (spilled / samples) * 0.6);
      const s = accuracy * 0.55 + height * 0.45 - waste;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return filled; },
    done() { return finished; },

    snapshot() {
      const want = wanted(filled);
      return { filled, want, tolerance, overflowing: spilled > 0 && filled > 0.9 };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-swirl');
  host.innerHTML = '';

  const cone = doc.createElement('div'); cone.className = 'cone';
  const soft = doc.createElement('span'); soft.className = 'soft';
  cone.appendChild(soft);

  const meter = doc.createElement('div'); meter.className = 'flow';
  const wantMark = doc.createElement('span'); wantMark.className = 'want';
  const lever = doc.createElement('span'); lever.className = 'lever';
  meter.append(wantMark, lever);

  const status = doc.createElement('span'); status.className = 'status';
  host.append(cone, meter, status);

  let lastWord = '';
  return {
    render(snap) {
      soft.style.height = `${Math.round(snap.filled * 100)}%`;
      wantMark.style.bottom = `${Math.round(snap.want * 100)}%`;
      const word = snap.filled >= 1 ? 'Done — that will set nicely'
        : 'Match the lever to the mark';
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-swirl'); host.innerHTML = ''; },
  };
}
