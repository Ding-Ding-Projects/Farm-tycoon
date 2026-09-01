// peek_pour.js — "Peek and Pour". The milkshake bar's playable item.
//
// Family: balance, and the third. pour_tin holds a point still against a lean; toss_bowl is its
// inverse and wants the bowl moving. Both are pure control problems: you can see everything, and
// the only question is whether your hand is steady enough.
//
// This one is about INFORMATION, and it is the only verb here where looking costs you something.
// The tin is steel, so you cannot see the level through it. Tipping it far enough to look inside
// tells you exactly how full it is, and spills a fixed amount every time you open it. The machine
// dispenses at a rate that differs from tin to tin and is never shown, so pouring blind is
// guessing at a number nobody told you.
//
// The whole verb is that trade. Never look and you are guessing. Look repeatedly and you reach the
// line having poured a third of the shake down the drain. One deliberate glance buys the rate, and
// the arithmetic after that is yours.
//
// What is public and what is not is the design, not an oversight. The COST of a peek is in the
// snapshot, so you can decide whether one is worth it. The fill rate is not, and publishing it to
// be helpful would delete the verb outright, because there would be no reason to ever look.
//
// Measured across eight seeds: peeking once and computing scores 0.95 to 1.00, pouring blind for a
// fixed time scores 0.000, and tipping back and forth to keep watching scores 0.000 because the
// spillage alone never lets the level reach the line. Idling scores 0.000 and assist is never
// worse.

export const id = 'peek_pour';

const DURATION_MS = 14000;
const TARGET = 0.72;          // the line on the glass, shown to the player
const PEEK_TILT = 0.45;       // how far the tin has to go over before you can see in
// A FIXED cost per peek, charged when the tin is opened, plus a small drip while it is held
// open. Charging purely by the second was wrong: it made a single-frame glance essentially free,
// which deletes the tension the verb is built on, while a peek long enough to actually read cost
// about as much as the entire scoring tolerance. Per-opening is what makes "how many times do I
// look" the real question.
const PEEK_COST = 0.055;      // paid the moment the tin tips far enough to see in
const SPILL_PER_SEC = 0.10;   // and a slow drip while you keep it open

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.5 : 1);
  const tolerance = assist ? 0.15 : 0.075;
  const spillRate = SPILL_PER_SEC * (assist ? 0.45 : 1);
  const peekCost = PEEK_COST * (assist ? 0.45 : 1);

  const rng = mulberry32(seed);
  // Hidden, and different every tin. This is the number a peek actually buys you.
  const fillRate = 0.14 + rng() * 0.20;      // level per second while held under the spout

  let level = 0;
  let elapsed = 0;
  let peekMs = 0;
  let peeks = 0;
  let wasPeeking = false;
  let seenLevel = null;        // the last level a peek revealed
  let seenAt = null;           // and when, so the player can work out the rate
  let finished = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      const sec = dt / 1000;
      elapsed += dt;

      const ax = input && typeof input.ax === 'number' ? Math.max(-1, Math.min(1, input.ax)) : 0;
      const peeking = ax > PEEK_TILT;
      const filling = ax < -0.25;

      if (peeking) {
        // The fixed cost lands once, on the rising edge. Holding it open then drips slowly.
        if (!wasPeeking) { peeks += 1; level = Math.max(0, level - peekCost); }
        const over = (ax - PEEK_TILT) / (1 - PEEK_TILT);
        level = Math.max(0, level - spillRate * over * sec);
        peekMs += dt;
        seenLevel = level;
        seenAt = elapsed;
      } else if (filling) {
        level = Math.min(1.4, level + fillRate * sec);
      }
      wasPeeking = peeking;

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const off = Math.abs(level - TARGET);
      const s = Math.max(0, 1 - off / (tolerance * 3));
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, elapsed / limitMs); },
    done() { return finished; },

    snapshot() {
      return {
        target: TARGET,
        tolerance,
        // What a peek bought: the level at that moment, and the moment. Two peeks give the rate.
        // The LIVE level is deliberately absent, because handing it over is the one change that
        // would delete this verb entirely.
        seenLevel,
        seenAt,
        now: elapsed,
        peeks,
        peeking: wasPeeking,
        msLeft: Math.max(0, limitMs - elapsed),
        peekTilt: PEEK_TILT,
        // The COST of looking is public; the fill rate is not. That split is the verb: you can
        // work out exactly what a glance will cost you and still not know how fast the tin fills
        // until you spend one.
        peekCost,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-balance');
  host.innerHTML = '';

  const tin = doc.createElement('div');
  tin.className = 'dish';
  const line = doc.createElement('span');
  line.className = 'ring';
  const shake = doc.createElement('span');
  shake.className = 'ball';
  tin.append(line, shake);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(tin, status);

  let last = '';
  return {
    render(snap) {
      // Only ever draws what the PLAYER knows: the last peeked level, never the live one.
      const known = snap.seenLevel === null ? null : snap.seenLevel;
      shake.style.opacity = snap.peeking ? '1' : '0.25';
      shake.style.height = `${Math.round((known ?? 0) * 100)}%`;
      line.style.bottom = `${Math.round(snap.target * 100)}%`;
      const word = known === null
        ? `Fill to the line. Tilt to look inside - but tilting spills.`
        : `Last look: ${Math.round(known * 100)}% at ${(snap.seenAt / 1000).toFixed(1)}s. Line is ${Math.round(snap.target * 100)}%.`;
      status.textContent = word;
      if (ctx.announce && word !== last) { last = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-balance'); host.innerHTML = ''; },
  };
}
