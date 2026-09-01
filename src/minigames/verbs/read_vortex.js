// read_vortex.js — "Read the Vortex". The smoothie mixer's playable item.
//
// Family: sustain, and the fourth. The other three all tell you what you are aiming at and then
// make hitting it hard: mind_oven is a band you sit inside, boil_size is a ceiling you creep up
// on, draw_steam is a band with a hazard sweeping through it. In every one of them the correct
// value is on screen the whole time.
//
// Here it is not. Every jug has its own thickness, the blend is done at a hold time proportional
// to it, and the thickness is never shown. What IS shown is the level dropping as the fruit
// breaks down, and it drops more slowly the thicker the jug is. So the answer has to be deduced
// from something you watched happen earlier in this same run.
//
// That is the distinction, and it is a real one: this is the only verb here whose target cannot
// be memorised between runs, guessed from the first frame, or read off the screen at all. You
// hold, you watch how fast it thins, and that tells you when to stop.

export const id = 'read_vortex';

const JUGS = 3;
const DURATION_MS = 16000;

// level(t) = 1 - (DROP_BASE * heldMs) / thickness, so a thick jug thins slowly.
// The blend is ready at heldMs = thickness * READY_PER_THICKNESS.
// Both are exported because the optimal play is a calculation, and a rule the player cannot in
// principle work out would make this a lottery rather than a deduction.
export const DROP_BASE = 0.00019;
export const READY_PER_THICKNESS = 3400;

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
  const tolerance = assist ? 900 : 460;   // ms of slack around the ready moment

  const rng = mulberry32(seed);
  const thickness = [];
  for (let i = 0; i < JUGS; i++) thickness.push(0.62 + rng() * 0.9);

  let jug = 0;
  let heldMs = 0;
  let elapsed = 0;
  let wasHeld = false;
  let scored = 0;
  let judged = 0;
  let finished = false;
  let lastResult = null;

  const readyAt = () => thickness[Math.min(jug, JUGS - 1)] * READY_PER_THICKNESS;
  const level = () => Math.max(0, 1 - (DROP_BASE * heldMs) / thickness[Math.min(jug, JUGS - 1)]);

  function judgeRelease() {
    const off = Math.abs(heldMs - readyAt());
    scored += Math.max(0, 1 - off / (tolerance * 2.4));
    judged += 1;
    lastResult = off <= tolerance ? 'smooth'
      : heldMs > readyAt() ? 'over-blended and thin' : 'still chunky';
    jug += 1;
    heldMs = 0;
    if (jug >= JUGS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const held = !!(input && input.held);
      if (held) heldMs += dt;

      // Releasing after a real blend is the commit. A tap with nothing blended is ignored so a
      // stray click cannot burn a jug.
      if (wasHeld && !held && heldMs > 250) { wasHeld = held; judgeRelease(); return; }
      wasHeld = held;

      // A jug you simply never let go of eventually ends itself, over-blended, so the run cannot
      // stall on someone leaning on the button.
      if (heldMs > READY_PER_THICKNESS * 2.6) { judgeRelease(); return; }
      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (judged === 0) return 0;
      const s = scored / JUGS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, jug / JUGS); },
    done() { return finished; },

    snapshot() {
      return {
        // Observable: how far the jug has thinned, and how long you have held it. Between them
        // these give away the thickness, which is exactly the deduction the verb is made of.
        level: level(),
        heldMs,
        jug: Math.min(jug + 1, JUGS),
        jugs: JUGS,
        dropBase: DROP_BASE,
        readyPerThickness: READY_PER_THICKNESS,
        result: lastResult,
        // Deliberately NOT exposed: thickness, and readyAt. Publishing either would collapse this
        // into "hold until the meter says stop", which the other three sustain verbs already are.
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-sustain');
  host.innerHTML = '';

  const jar = doc.createElement('div');
  jar.className = 'jug';
  const fill = doc.createElement('span');
  fill.className = 'fill';
  jar.appendChild(fill);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(jar, status);

  let last = '';
  return {
    render(snap) {
      fill.style.height = `${Math.round(snap.level * 100)}%`;
      const word = `Jug ${snap.jug} of ${snap.jugs} - hold to blend. Thick jugs thin slowly and need longer.`;
      status.textContent = snap.result ? `${word} (last: ${snap.result})` : word;
      if (ctx.announce && word !== last) { last = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-sustain'); host.innerHTML = ''; },
  };
}
