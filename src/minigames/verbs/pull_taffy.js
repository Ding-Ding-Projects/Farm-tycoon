// pull_taffy.js — "Pull the Taffy". The candy machine's playable item.
//
// Family: dual, and the fourth. throw_shuttles chases two marks that drift apart; roll_press keeps
// two rollers equal while driving both; blend_notes is zero-sum, where only the ratio matters.
// This is CYCLIC: the two hands must move apart to a full stretch and then back together, over and
// over, and it is the RHYTHM of that cycle that aerates the taffy. Holding any position at all,
// however correct-looking, does nothing.
//
// The other three are about where the two values ARE. This one is about how they are moving.

export const id = 'pull_taffy';

const PULLS = 7;
const DURATION_MS = 14000;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const stretch = assist ? 0.55 : 0.72;   // how far apart counts as a full pull
  const close = assist ? 0.28 : 0.18;     // how near counts as folded back

  let elapsed = 0;
  let phase = 'apart';    // what the taffy is waiting for next
  let pulls = 0;
  let smooth = 0;         // credit for even, unhurried cycles
  let cycles = 0;
  let lastSwitch = 0;
  let finished = false;
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const l = input && typeof input.left === 'number' ? Math.max(0, Math.min(1, input.left)) : 0;
      const r = input && typeof input.right === 'number' ? Math.max(0, Math.min(1, input.right)) : 0;
      const gap = Math.abs(l - r);

      if (phase === 'apart' && gap >= stretch) {
        phase = 'together';
        lastResult = 'stretched';
      } else if (phase === 'together' && gap <= close) {
        phase = 'apart';
        pulls += 1;
        // An even cadence aerates; snatching at it or dawdling does not.
        const span = elapsed - lastSwitch;
        const ideal = 1500;
        smooth += Math.max(0, 1 - Math.abs(span - ideal) / ideal);
        cycles += 1;
        lastSwitch = elapsed;
        lastResult = 'folded';
      }

      if (pulls >= PULLS || elapsed >= limitMs) finished = true;
    },

    score() {
      const done = Math.min(1, pulls / PULLS);
      const evenness = cycles === 0 ? 0 : smooth / cycles;
      const s = done * 0.65 + evenness * 0.35;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, pulls / PULLS); },
    done() { return finished; },

    snapshot() {
      return {
        want: phase,          // 'apart' = stretch it, 'together' = fold it back
        pulls,
        need: PULLS,
        stretch,
        close,
        result: lastResult,
      };
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
    return c;
  };
  const L = rail('left');
  const R = rail('right');
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(L, status, R);

  let lastWord = '';
  return {
    render(snap) {
      const word = snap.want === 'apart'
        ? `Stretch it apart - ${snap.pulls} of ${snap.need} pulls`
        : `Fold it back together - ${snap.pulls} of ${snap.need} pulls`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-dual'); host.innerHTML = ''; },
  };
}
