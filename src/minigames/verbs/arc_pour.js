// arc_pour.js — "Pour the Arc". The tea house's playable item.
//
// Family: aim, and the second. cast_ingot is DIRECT: the crucible points at the channel and the
// metal goes where it is pointed, so angle and power are read exactly as they look. This is
// BALLISTIC. The long-spout pot throws a stream that falls under its own weight, so the angle
// that lands in the cup is never the angle that points at it, and range depends on angle and
// power together rather than on either one alone.
//
// The distinction is deliberate and it is the whole verb: a player who learned cast_ingot's
// "point at it and let go" will aim flat at a far cup and watch the tea land on the table. Two
// different angles reach the same cup (a low fast arc and a high lobbed one), which is what
// makes it a genuine choice rather than a single hidden answer to guess.

export const id = 'arc_pour';

const CUPS = 4;
const DURATION_MS = 15000;

// Range of a projectile at unit gravity: R = K * v^2 * sin(2a). Held here as one constant so the
// model, the preview arc and the tests cannot drift apart about what the tea will do.
const K = 1.25;
export function rangeFor(angle, power) {
  return K * power * power * Math.sin(2 * angle);
}

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const perCupMs = limitMs / CUPS;
  const tolerance = assist ? 0.16 : 0.085;

  const rng = mulberry32(seed);
  const cups = [];
  for (let i = 0; i < CUPS; i++) cups.push(0.34 + rng() * 0.72);   // distance across the table

  let index = 0;
  let sinceCup = 0;
  let scored = 0;
  let judged = 0;
  let finished = false;
  let lastResult = null;
  let lastLanding = null;

  function judge(angle, power) {
    const want = cups[index];
    const landed = rangeFor(Math.max(0.05, Math.min(Math.PI / 2 - 0.05, angle)), Math.max(0, Math.min(1, power)));
    const off = Math.abs(landed - want);
    scored += Math.max(0, 1 - off / (tolerance * 3));
    judged += 1;
    lastLanding = landed;
    lastResult = off <= tolerance ? 'in the cup'
      : landed > want ? 'overshot the cup' : 'fell short';
    index += 1;
    sinceCup = 0;
    if (index >= CUPS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      sinceCup += Math.max(0, dtMs || 0);
      if (input && input.fired) { judge(input.angle || 0, input.power || 0); return; }
      // A cup you never pour into simply goes unfilled; the run never waits on you.
      if (sinceCup >= perCupMs) judge(0, 0);
    },

    score() {
      if (judged === 0) return 0;
      const s = scored / CUPS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, index / CUPS); },
    done() { return finished; },

    snapshot() {
      return {
        // How far the cup is. NOT an angle: converting distance into an angle is the work, and
        // handing it over would reduce this to cast_ingot with a different backdrop.
        distance: index < CUPS ? cups[index] : 0,
        cup: Math.min(index + 1, CUPS),
        cups: CUPS,
        tolerance,
        landed: lastLanding,
        result: lastResult,
        // The relationship itself is public. The challenge is flying the arc, never guessing the
        // physics: a hidden rule would make this a lottery rather than a skill.
        k: K,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  const NS = 'http://www.w3.org/2000/svg';
  host.classList.add('stage-aim');
  host.innerHTML = '';

  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 60');
  svg.setAttribute('preserveAspectRatio', 'none');
  const table = doc.createElementNS(NS, 'line');
  table.setAttribute('x1', '4'); table.setAttribute('y1', '52');
  table.setAttribute('x2', '96'); table.setAttribute('y2', '52');
  table.setAttribute('class', 'table');
  const cup = doc.createElementNS(NS, 'rect');
  cup.setAttribute('class', 'cup');
  cup.setAttribute('y', '44'); cup.setAttribute('width', '7'); cup.setAttribute('height', '8');
  svg.append(table, cup);
  host.appendChild(svg);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(status);

  let last = '';
  return {
    render(snap) {
      // Distance maps onto the visible table, so what the player sees is the number they aim at.
      cup.setAttribute('x', String(4 + snap.distance * 84));
      const word = `Cup ${snap.cup} of ${snap.cups} - the tea falls as it flies, so aim above it`;
      status.textContent = snap.result ? `${word} (last: ${snap.result})` : word;
      if (ctx.announce && word !== last) { last = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-aim'); host.innerHTML = ''; },
  };
}
