// press_cutter.js — "Press the Cutter". The bakery's cookie verb.
//
// Rounds of dough come up one at a time on the bench; press the cutter onto each before it
// slumps. Reactive and spatial: you are not remembering an order (that is the recall verb in
// the same family), you are hitting the one that is live, and hitting it EARLY scores better
// than hitting it late.
//
// Family: sequence — the shell hands this model { padIndex: int|null } and nothing else, so
// pointer and keyboard reach it identically and neither can be forgotten by a verb author.
//
// The model is pure: no DOM, no timers of its own, no Math.random, no Date. It is stepped with
// an explicit dtMs by whoever owns the clock, which is what lets tools/test-verbs.mjs drive it
// to completion under Node with no browser at all.

export const id = 'press_cutter';

const CELLS = 9;          // 3x3 bench
const ROUNDS = 8;
const BASE_WINDOW_MS = 1100; // how long one round of dough stays pressable

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
  // Assist widens the window rather than slowing the whole game down, so the round still feels
  // like the same game — it just forgives a slower hand.
  const windowMs = BASE_WINDOW_MS * (assist ? 2.2 : 1);

  const rng = mulberry32(seed);
  const order = [];
  let prev = -1;
  for (let i = 0; i < ROUNDS; i++) {
    let cell = Math.floor(rng() * CELLS);
    if (cell === prev) cell = (cell + 1 + Math.floor(rng() * (CELLS - 1))) % CELLS;
    order.push(cell);
    prev = cell;
  }

  let round = 0;
  let elapsed = 0;      // within the current round
  let spent = false;    // already pressed (or missed) this round
  let hits = 0;
  let quality = 0;      // summed 0..1 promptness over hit rounds
  let lastResult = null; // 'hit' | 'miss' | null
  let finished = false;

  function endRound(result) {
    spent = true;
    lastResult = result;
  }

  function advance() {
    round += 1;
    elapsed = 0;
    spent = false;
    lastResult = null;
    if (round >= ROUNDS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (!spent && input && typeof input.padIndex === 'number') {
        if (input.padIndex === order[round]) {
          hits += 1;
          // Promptness: a press at t=0 is worth 1, at the end of the window worth ~0.4.
          quality += 1 - 0.6 * Math.min(1, elapsed / windowMs);
          endRound('hit');
        } else {
          endRound('miss'); // pressing the wrong dough spoils that round
        }
      }

      // A round always ends on its own. This is the invariant that matters most: with no input
      // for ever, the game still finishes, so a required craft can never be stalled by a player
      // who walks away, a dead pointer, or an input path that silently fails to bind.
      if (elapsed >= windowMs) {
        if (!spent) endRound('miss');
        if (elapsed >= windowMs + 220) advance(); // brief beat so the result is readable
      }
    },

    score() {
      if (ROUNDS === 0) return 0;
      const s = quality / ROUNDS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.max(0, Math.min(1, round / ROUNDS)); },

    done() { return finished; },

    snapshot() {
      return {
        cells: CELLS,
        live: finished || spent ? -1 : order[round],
        spentCell: spent ? order[round] : -1,
        result: lastResult,
        round: Math.min(round + 1, ROUNDS),
        rounds: ROUNDS,
        hits,
        remaining: Math.max(0, 1 - elapsed / windowMs),
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-targets');
  host.innerHTML = '';

  const grid = doc.createElement('div');
  grid.className = 'grid';
  const cells = [];
  for (let i = 0; i < CELLS; i++) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'target';
    b.dataset.pad = String(i);
    b.setAttribute('aria-label', `Dough ${i + 1}`);
    grid.appendChild(b);
    cells.push(b);
  }
  host.appendChild(grid);

  let lastRound = -1;
  return {
    render(snap) {
      for (let i = 0; i < cells.length; i++) {
        cells[i].classList.toggle('live', i === snap.live);
        cells[i].classList.toggle('spent', i === snap.spentCell);
      }
      // Announce once per round rather than per frame, or a screen reader is unusable.
      if (ctx.announce && snap.round !== lastRound) {
        lastRound = snap.round;
        ctx.announce(`Round ${snap.round} of ${snap.rounds}`);
      }
    },
    unmount() {
      host.classList.remove('stage-targets');
      host.innerHTML = '';
    },
  };
}
