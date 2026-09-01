// pull_shot.js — "Pull the Shot". The sugar mill's playable item.
//
// Family: release, and the second. season_pinch judges a MAGNITUDE: hold to build a pinch, let go
// at the right size, and every pot is independent. This is a RUNNING TOTAL: each pull adds to a
// batch that must land exactly on a figure, so the size you want changes with every pull you have
// already made, and overshooting the total cannot be undone by a smaller pull afterwards.
//
// One verb asks "how big is this one". This one asks "how much is left, and can you land on it".

export const id = 'pull_shot';

const TARGET = 1.0;          // the batch, in arbitrary units
const MAX_PULLS = 6;
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
  // Two DIFFERENT numbers, and conflating them was a real defect. `tolerance` is the SCORING
  // window and assist widens it. `LANDED` is when the batch is considered finished, and it must
  // NOT move with assist: widening it ended the run early, before the player could refine, so
  // assist scored WORSE than playing without it. An accommodation that truncates the game is not
  // an accommodation.
  const tolerance = assist ? 0.10 : 0.045;
  const LANDED = 0.02;

  // A head start, so the sum is never simply "six identical pulls".
  const rng = mulberry32(seed);
  let filled = rng() * 0.18;

  let pulls = 0;
  let elapsed = 0;
  let overshot = false;
  let finished = false;
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.fired) {
        // A full pull is deliberately well under half the batch. At 0.45 two full pulls landed
        // near the mark by luck, so pulling blindly scored almost as well as judging it - the
        // verb has to make the LAST pull small and deliberate or it is not a running total at all.
        const amount = Math.max(0, Math.min(1, input.charge || 0)) * 0.28;
        filled += amount;
        pulls += 1;
        if (filled > TARGET + tolerance) {
          // Over the line, and sugar cannot be taken back out of a batch.
          overshot = true;
          finished = true;
          lastResult = 'overshot';
          return;
        }
        lastResult = Math.abs(TARGET - filled) <= LANDED ? 'on the mark' : 'more to go';
        if (Math.abs(TARGET - filled) <= LANDED || pulls >= MAX_PULLS) finished = true;
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (overshot) return 0;
      const off = Math.abs(TARGET - filled);
      // Landing close matters far more than landing in few pulls, but a tidy batch still helps.
      const accuracy = Math.max(0, 1 - off / (tolerance * 4));
      const economy = pulls === 0 ? 0 : Math.max(0, 1 - (pulls - 1) / (MAX_PULLS * 2));
      const s = accuracy * 0.85 + economy * 0.15;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, filled / TARGET); },
    done() { return finished; },

    snapshot() {
      return {
        filled,
        target: TARGET,
        remaining: Math.max(0, TARGET - filled),
        tolerance,
        pulls,
        maxPulls: MAX_PULLS,
        overshot,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-pinch');
  host.innerHTML = '';

  const gauge = doc.createElement('div');
  gauge.className = 'gauge';
  const target = doc.createElement('span'); target.className = 'target-band';
  const held = doc.createElement('span'); held.className = 'held';
  gauge.append(target, held);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(gauge, status);

  let lastWord = '';
  return {
    render(snap) {
      const t = snap.target;
      target.style.left = `${Math.round(Math.max(0, (t - snap.tolerance) / t) * 100)}%`;
      target.style.width = `${Math.round((snap.tolerance * 2 / t) * 100)}%`;
      held.style.width = `${Math.round(Math.min(1, snap.filled / t) * 100)}%`;
      const word = snap.overshot ? 'Over the mark - the batch is spoiled'
        : `${snap.remaining.toFixed(2)} left, ${snap.maxPulls - snap.pulls} pulls in hand`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-pinch'); host.innerHTML = ''; },
  };
}
