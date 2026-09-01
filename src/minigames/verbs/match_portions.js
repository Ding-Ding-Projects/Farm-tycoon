// match_portions.js — "Match the Portions". The doner kebab stand's playable item.
//
// Family: release, and the fourth. season_pinch judges a magnitude against a target it shows you.
// pull_shot judges one release against a moment. press_luck is about when to stop taking.
//
// This one gives you NO target at all. It is scored on how alike the five portions are, and the
// size you settle on is entirely yours - the only verb here judged on the SPREAD of your attempts
// rather than on how good any one of them was. Five identical middling portions beat four superb
// ones and a thin one, which is exactly how a stand that sells the same wrap all day actually
// works.
//
// It is not stir_figure with a different hat. There the first lap is the anchor and every later
// lap is measured against it. Here nothing is an anchor: two portions in, you may still decide the
// remaining three should meet the ones behind them halfway, and the score will thank you for it.
//
// The trap is the obvious opening move. The spit thins as you shave it, so the first cut is the
// easiest big one you will ever get and a proud first portion is one you can never match - by the
// fifth the spit simply cannot give that much however long you lean on the blade. The yields are
// published for exactly that reason: this is a planning problem, not a guessing one, and the
// player who reads to the END of the row and picks a size the LAST cut can still make wins it.
//
// Two degenerate strategies are closed deliberately. Tapping the blade five times gives five
// identical nothings, so the score carries a substance term that a shaving cannot satisfy. Leaning
// on it to the stop gives five DIFFERENT weights, because the yields differ - so the laziest input
// in the family fails on the very thing the verb measures.

export const id = 'match_portions';

const PORTIONS = 5;
const DURATION_MS = 16000;
const SUBSTANCE = 0.45;       // mean weight at or above this counts as a full portion
const TOLERANCE = 0.30;       // spread at or above this scores nothing for consistency

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.6 : 1);
  const tolerance = TOLERANCE * (assist ? 2 : 1);

  // How much meat each successive cut can give. It only ever falls, and it is seeded so a given
  // craft plays the same way twice without every craft being the same row of numbers.
  const rng = mulberry32(seed);
  const yields = [];
  let y = 0.98;
  for (let i = 0; i < PORTIONS; i++) {
    yields.push(Math.max(0.5, Math.min(1, y)));
    y -= 0.06 + rng() * 0.06;
  }

  let elapsed = 0;
  let finished = false;
  const weights = [];
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.fired && weights.length < PORTIONS) {
        const charge = typeof input.charge === 'number' ? Math.max(0, Math.min(1, input.charge)) : 0;
        const w = Math.max(0, Math.min(1, charge * yields[weights.length]));
        weights.push(w);
        lastResult = `portion ${weights.length}: ${Math.round(w * 100)}`;
        if (weights.length >= PORTIONS) finished = true;
      }

      if (elapsed >= limitMs) finished = true;
    },

    // Two terms, multiplied rather than averaged, because either one failing genuinely ruins the
    // batch: five identical shavings are not a service, and five generous but unequal portions are
    // not a business. Averaging would let one carry the other.
    score() {
      if (weights.length < 2) return 0;
      const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
      const spread = Math.max(...weights) - Math.min(...weights);
      const consistency = Math.max(0, 1 - spread / tolerance);
      const substance = Math.max(0, Math.min(1, mean / SUBSTANCE));
      // An unfinished row is scored on what it has, scaled by how much of the row it is.
      const completeness = weights.length / PORTIONS;
      const s = consistency * substance * completeness;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, weights.length / PORTIONS); },
    done() { return finished; },

    snapshot() {
      const next = Math.min(weights.length, PORTIONS - 1);
      return {
        portion: Math.min(weights.length + 1, PORTIONS),
        portions: PORTIONS,
        weights: weights.slice(),
        // The whole row, not just the next one. Seeing that the last cut can only give 0.62 is
        // the entire insight, and hiding it would turn planning into guesswork.
        yields: yields.slice(),
        yieldNow: yields[next],
        // What the thinnest remaining cut could still match, so the plan is checkable rather than
        // something the player has to hold in their head across five releases.
        matchable: Math.min(...yields.slice(weights.length).concat(yields[PORTIONS - 1])),
        spread: weights.length > 1 ? Math.max(...weights) - Math.min(...weights) : 0,
        tolerance,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-gauge', 'stage-portions');
  host.innerHTML = '';

  const row = doc.createElement('div');
  row.className = 'portion-row';
  const cells = [];
  for (let i = 0; i < PORTIONS; i++) {
    const c = doc.createElement('div');
    c.className = 'portion';
    const fill = doc.createElement('i');
    c.appendChild(fill);
    row.appendChild(c);
    cells.push({ cell: c, fill });
  }

  const gauge = doc.createElement('div');
  gauge.className = 'gauge';
  const needle = doc.createElement('i');
  gauge.appendChild(needle);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(row, gauge, status);

  let announced = '';
  return {
    render(snap) {
      for (let i = 0; i < cells.length; i++) {
        const w = snap.weights[i];
        cells[i].fill.style.height = `${(w == null ? 0 : w) * 100}%`;
        cells[i].cell.classList.toggle('done', w != null);
        cells[i].cell.classList.toggle('now', w == null && i === snap.weights.length);
        // The ceiling for this cut, so a player can see the row falling away in front of them.
        cells[i].cell.style.setProperty('--yield', String(snap.yields[i]));
      }
      needle.style.width = `${Math.min(1, snap.yieldNow) * 100}%`;

      const word = snap.weights.length >= snap.portions
        ? `Five portions cut, spread ${Math.round(snap.spread * 100)}`
        : `Portion ${snap.portion} of ${snap.portions} - this cut can give at most ${Math.round(snap.yieldNow * 100)},`
          + ` the last one only ${Math.round(snap.yields[snap.portions - 1] * 100)}. Hold to shave, let go to drop.`;
      status.textContent = snap.result ? `${word} (${snap.result})` : word;
      if (ctx.announce && word !== announced) { announced = word; ctx.announce(word); }
    },
    unmount() {
      host.classList.remove('stage-gauge', 'stage-portions');
      host.innerHTML = '';
    },
  };
}
