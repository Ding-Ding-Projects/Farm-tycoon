// set_stone.js — "Set the Stones". The jeweler's playable item.
//
// Family: sequence, and the fourth. The others are reaction (press_cutter), recall (place_decor)
// and symmetry (pin_brim). This is ESCALATING TOLERANCE: the target never moves and is never
// hidden, but every stone you set narrows the window for the next one. The first is nearly free
// and the last is genuinely hard, and the difficulty comes entirely from your own progress.
//
// Nothing else here gets harder because you are doing well.

export const id = 'set_stone';

const STONES = 5;
const SEATS = 9;
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
  // Assist narrows more gently; it does not stop the narrowing, because that IS the verb.
  const shrink = assist ? 0.72 : 0.52;

  const rng = mulberry32(seed);
  const wanted = [];
  for (let i = 0; i < STONES; i++) wanted.push(Math.floor(rng() * SEATS));

  let set = 0;
  let elapsed = 0;
  let quality = 0;
  let finished = false;
  let lastResult = null;

  // Allowed neighbours either side of the true seat, shrinking with every stone set.
  const tolerance = () => Math.max(0, Math.round(2 * Math.pow(shrink, set)));

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && typeof input.padIndex === 'number' && set < STONES) {
        const off = Math.abs(input.padIndex - wanted[set]);
        const tol = tolerance();
        if (off <= tol) {
          quality += 1 - (tol === 0 ? 0 : (off / (tol + 1)) * 0.5);
          lastResult = off === 0 ? 'seated true' : 'seated';
        } else {
          lastResult = 'off the seat';
        }
        set += 1;
        if (set >= STONES) finished = true;
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const s = quality / STONES;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, set / STONES); },
    done() { return finished; },

    snapshot() {
      return {
        seats: SEATS,
        want: set < STONES ? wanted[set] : -1,
        tolerance: tolerance(),
        stone: Math.min(set + 1, STONES),
        stones: STONES,
        result: lastResult,
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
  const seats = [];
  for (let i = 0; i < SEATS; i++) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'target';
    b.dataset.pad = String(i);
    b.setAttribute('aria-label', `Seat ${i + 1}`);
    grid.appendChild(b);
    seats.push(b);
  }
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(grid, status);

  let announced = -1;
  return {
    render(snap) {
      for (let i = 0; i < seats.length; i++) {
        const within = snap.want >= 0 && Math.abs(i - snap.want) <= snap.tolerance;
        seats[i].classList.toggle('live', i === snap.want);
        seats[i].classList.toggle('spent', snap.want >= 0 && !within);
      }
      status.textContent = `Stone ${snap.stone} of ${snap.stones} - room for ${snap.tolerance} either side`;
      if (ctx.announce && snap.stone !== announced) {
        announced = snap.stone;
        ctx.announce(status.textContent);
      }
    },
    unmount() { host.classList.remove('stage-targets'); host.innerHTML = ''; },
  };
}
