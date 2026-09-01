// set_pots.js — "Space the Pots". The lobster pool's playable item.
//
// Family: aim, and the third. cast_ingot points at a channel and the metal goes where it is
// pointed. arc_pour throws a stream that falls, so the angle that lands is never the angle that
// aims. Both of those judge one shot against a target somebody else put on the board.
//
// There is no target here at all. Lobsters will not share ground, so a pot is legal or not
// entirely because of where the OTHER pots already are - the first drop cannot be wrong and the
// last one has almost nowhere left to go. It is a packing problem played with a throwing input,
// and nothing else in the library asks the player to arrange rather than to hit.
//
// It shares one property with set_stone and differs in the part that matters: both get harder the
// better you are doing. set_stone narrows a timing window on a target that never moves; this
// narrows the WATER, and which part of it gets narrow is the player's own doing. Two people
// playing the same board can be left with completely different problems at pot six.
//
// A refused drop costs an attempt and nothing else. There are more attempts than pots on purpose,
// so a misjudged throw is a setback rather than the end of the round, and the reason for every
// refusal is published rather than left to be inferred from a pot that did not appear.

export const id = 'set_pots';

const POTS = 8;
const ATTEMPTS = 12;
const TERRITORY = 0.22;       // half the distance two pots must keep between them
const POT_BODY = 0.05;        // the pot itself, for clearing rocks
const ROCKS = 4;
const DURATION_MS = 18000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.6 : 1);
  const territory = TERRITORY * (assist ? 0.78 : 1);
  const attempts = ATTEMPTS + (assist ? 4 : 0);

  const rng = mulberry32(seed);
  const rocks = [];
  for (let i = 0; i < ROCKS; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.25 + rng() * 0.6;
    rocks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, r: 0.11 + rng() * 0.08 });
  }

  let elapsed = 0;
  let finished = false;
  let used = 0;
  let lastResult = null;
  const placed = [];

  /** Why this spot will not take a pot, or null if it will. */
  const refuse = (p) => {
    if (Math.hypot(p.x, p.y) > 0.97) return 'over the wall';
    for (const rk of rocks) if (dist(p, rk) < rk.r + POT_BODY) return 'on the rocks';
    for (const q of placed) if (dist(p, q) < territory * 2) return 'too close to pot ' + (placed.indexOf(q) + 1);
    return null;
  };

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.fired && placed.length < POTS && used < attempts) {
        const angle = typeof input.angle === 'number' ? input.angle : 0;
        const power = typeof input.power === 'number' ? Math.max(0, Math.min(1, input.power)) : 0;
        // Power is how far out from the middle of the pool the pot lands, so the two continuous
        // values the family gives are read as a polar coordinate rather than as a shot.
        const p = { x: Math.cos(angle) * power * 0.95, y: Math.sin(angle) * power * 0.95 };
        used += 1;
        const why = refuse(p);
        if (why) {
          lastResult = why;
        } else {
          placed.push(p);
          lastResult = `pot ${placed.length} set`;
        }
        if (placed.length >= POTS || used >= attempts) finished = true;
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const s = placed.length / POTS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, placed.length / POTS); },
    done() { return finished; },

    snapshot() {
      return {
        pots: POTS,
        placed: placed.map((p) => ({ x: p.x, y: p.y })),
        rocks: rocks.map((r) => ({ x: r.x, y: r.y, r: r.r })),
        // Published because it is the rule of the game, not a hint: a player who cannot see how
        // much ground a pot claims is being asked to guess at the only constraint there is.
        territory,
        attemptsLeft: attempts - used,
        attempts,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  const NS = 'http://www.w3.org/2000/svg';
  host.classList.add('stage-aim', 'stage-pool');
  host.innerHTML = '';

  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-1 -1 2 2');
  svg.setAttribute('class', 'pool');
  svg.setAttribute('aria-hidden', 'true');

  const water = doc.createElementNS(NS, 'circle');
  water.setAttribute('r', '0.97');
  water.setAttribute('class', 'pool-water');
  svg.appendChild(water);

  const rockLayer = doc.createElementNS(NS, 'g');
  const potLayer = doc.createElementNS(NS, 'g');
  svg.append(rockLayer, potLayer);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(svg, status);

  let rocksDrawn = false;
  let announced = '';

  return {
    render(snap) {
      if (!rocksDrawn) {
        for (const rk of snap.rocks) {
          const c = doc.createElementNS(NS, 'circle');
          c.setAttribute('cx', String(rk.x));
          c.setAttribute('cy', String(rk.y));
          c.setAttribute('r', String(rk.r));
          c.setAttribute('class', 'pool-rock');
          rockLayer.appendChild(c);
        }
        rocksDrawn = true;
      }

      while (potLayer.childNodes.length > snap.placed.length * 2) potLayer.removeChild(potLayer.lastChild);
      for (let i = potLayer.childNodes.length / 2; i < snap.placed.length; i++) {
        const p = snap.placed[i];
        const ring = doc.createElementNS(NS, 'circle');
        ring.setAttribute('cx', String(p.x));
        ring.setAttribute('cy', String(p.y));
        ring.setAttribute('r', String(snap.territory));
        ring.setAttribute('class', 'pool-territory');
        const pot = doc.createElementNS(NS, 'circle');
        pot.setAttribute('cx', String(p.x));
        pot.setAttribute('cy', String(p.y));
        pot.setAttribute('r', '0.05');
        pot.setAttribute('class', 'pool-pot');
        potLayer.append(ring, pot);
      }

      const word = snap.placed.length >= snap.pots
        ? `All ${snap.pots} pots set`
        : `Pot ${snap.placed.length + 1} of ${snap.pots} - ${snap.attemptsLeft} throws left.`
          + ' Aim to turn, hold to reach further out, let go to drop.';
      status.textContent = snap.result ? `${word} (${snap.result})` : word;
      if (ctx.announce && word !== announced) { announced = word; ctx.announce(word); }
    },
    unmount() {
      host.classList.remove('stage-aim', 'stage-pool');
      host.innerHTML = '';
    },
  };
}
