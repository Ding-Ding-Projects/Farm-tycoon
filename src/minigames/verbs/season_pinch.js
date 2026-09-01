// season_pinch.js — "Season by Touch". The soup kitchen's playable item.
//
// Family: release. The model sees {charge, fired}: how long you have been holding, and the
// instant you let go. You take a pinch of seasoning — the longer you hold, the bigger the pinch —
// and release it into the pot. Each pot wants a specific amount, shown before you start.
//
// Nothing here is timed against a clock and nothing moves: the whole skill is judging a
// MAGNITUDE by feel and letting go at the right size. Overshooting is worse than undershooting,
// because you cannot take salt back out of a soup.

export const id = 'season_pinch';

const POTS = 5;
const DURATION_MS = 14000;

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
  const tolerance = assist ? 0.22 : 0.11;
  const perPotMs = limitMs / POTS;

  const rng = mulberry32(seed);
  const wants = [];
  for (let i = 0; i < POTS; i++) wants.push(0.25 + rng() * 0.6);

  let pot = 0;
  let elapsed = 0;
  let scored = 0;      // summed accuracy
  let judged = 0;
  let sincePot = 0;
  let finished = false;
  let lastResult = null;

  function judge(amount) {
    const want = wants[pot];
    const off = Math.abs(amount - want);
    // Asymmetric on purpose: too much salt is a ruined pot, too little is a bland one.
    const penalty = amount > want ? 1.6 : 1;
    const accuracy = Math.max(0, 1 - (off * penalty) / Math.max(tolerance * 3, 0.001));
    scored += Math.min(1, accuracy);
    judged += 1;
    lastResult = off <= tolerance ? 'seasoned' : (amount > want ? 'too much' : 'too little');
    pot += 1;
    sincePot = 0;
    if (pot >= POTS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;
      sincePot += dt;

      if (input && input.fired) { judge(Math.max(0, Math.min(1, input.charge || 0))); return; }

      // A pot you never season goes out unseasoned rather than holding the run open for ever.
      if (sincePot >= perPotMs) judge(0);
    },

    score() {
      if (judged === 0) return 0;
      const s = scored / POTS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, pot / POTS); },
    done() { return finished; },

    snapshot() {
      return {
        want: pot < POTS ? wants[pot] : 0,
        pot: Math.min(pot + 1, POTS),
        pots: POTS,
        result: lastResult,
        tolerance,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-pinch');
  host.innerHTML = '';

  const gauge = doc.createElement('div'); gauge.className = 'gauge';
  const target = doc.createElement('span'); target.className = 'target-band';
  const held = doc.createElement('span'); held.className = 'held';
  gauge.append(target, held);

  const status = doc.createElement('span'); status.className = 'status';
  host.append(gauge, status);

  let announced = -1;
  return {
    render(snap) {
      target.style.left = `${Math.round(Math.max(0, snap.want - snap.tolerance) * 100)}%`;
      target.style.width = `${Math.round(snap.tolerance * 2 * 100)}%`;
      // The held amount is owned by the input layer, so the view shows the ASK and the outcome;
      // the pinch itself is felt rather than read off a bar, which is the point of the verb.
      held.style.width = '0%';
      const word = `Pot ${snap.pot} of ${snap.pots}` + (snap.result ? ` — last one ${snap.result}` : '');
      status.textContent = word;
      if (ctx.announce && snap.pot !== announced) { announced = snap.pot; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-pinch'); host.innerHTML = ''; },
  };
}
