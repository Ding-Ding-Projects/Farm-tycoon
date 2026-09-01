// stir_figure.js — "Stir the Figure". The fondue pot's playable item.
//
// Family: path, and the fifth. whisk_batter is tempo, pipe_frosting is precision against a route
// the game drew, fold_shell is a speed limit, skim_curds is one pass with no doubling back. This
// is REPETITION: you stir a figure of eight, and what is judged is how closely each lap matches
// the lap before it. There is no route to follow, because the route is whatever you did the first
// time round.
//
// pipe_frosting scores you against the game's line. This scores you against your own.

export const id = 'stir_figure';

const LAPS = 4;
const SAMPLES = 24;            // points sampled per lap for comparison
const DURATION_MS = 15000;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const slack = assist ? 0.20 : 0.11;

  let reference = null;        // the first lap, once completed
  let current = [];
  let elapsed = 0;
  let laps = 0;
  let quality = 0;
  let judged = 0;
  let lastAngle = null;
  let swept = 0;
  let finished = false;
  let lastResult = null;

  function closeLap() {
    if (reference === null) {
      reference = current.slice();
      lastResult = 'shape set';
    } else if (current.length >= 4) {
      // Compare this lap against the first, point for point around the loop.
      let off = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const a = reference[Math.min(reference.length - 1, Math.floor((i / SAMPLES) * reference.length))];
        const b = current[Math.min(current.length - 1, Math.floor((i / SAMPLES) * current.length))];
        off += Math.hypot(a.x - b.x, a.y - b.y);
      }
      off /= SAMPLES;
      quality += Math.max(0, 1 - off / (slack * 2));
      judged += 1;
      lastResult = off <= slack ? 'even lap' : 'wandered';
    }
    current = [];
    laps += 1;
    swept = 0;
    if (laps > LAPS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.down) {
        current.push({ x: input.x, y: input.y });
        const a = Math.atan2(input.y - 0.5, input.x - 0.5);
        if (lastAngle !== null) {
          let d = a - lastAngle;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          swept += Math.abs(d);
        }
        lastAngle = a;
        if (swept >= Math.PI * 2) closeLap();
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (judged === 0) return 0;
      const s = quality / LAPS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, laps / (LAPS + 1)); },
    done() { return finished; },

    snapshot() {
      return {
        laps: Math.max(0, laps - 1),
        need: LAPS,
        hasReference: reference !== null,
        result: lastResult,
        // The reference lap is shown back so the player can see what they are matching. Hiding it
        // would make this a memory verb, and memory already has its own.
        reference: reference ? reference.slice(0, 40) : [],
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  const NS = 'http://www.w3.org/2000/svg';
  host.classList.add('stage-trace');
  host.innerHTML = '';

  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  const ref = doc.createElementNS(NS, 'path');
  ref.setAttribute('class', 'route');
  svg.appendChild(ref);
  host.appendChild(svg);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(status);

  let lastWord = '';
  return {
    render(snap) {
      if (snap.reference.length > 1) {
        ref.setAttribute('d', snap.reference
          .map((p, i) => `${i ? 'L' : 'M'}${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`)
          .join(' '));
      } else {
        ref.removeAttribute('d');
      }
      const word = !snap.hasReference
        ? 'Stir a figure of eight - your first lap sets the shape'
        : `Match that lap again - ${snap.laps} of ${snap.need}`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-trace'); host.innerHTML = ''; },
  };
}
