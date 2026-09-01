// boil_size.js — "Boil the Size". The rubber factory's playable item.
//
// Family: sustain, and the second one. mind_oven is a BAND you sit inside, with overshooting and
// undershooting equally wrong and a target that drifts. This is a CEILING: the batch thickens the
// longer you heat it and never thins back, so the only mistake that exists is going too far, and
// it cannot be undone. You are creeping up on a line, not balancing on one.
//
// The asymmetry is the game. Stopping short costs a little; crossing costs everything.

export const id = 'boil_size';

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
  const rng = mulberry32(seed);
  const ceiling = 0.62 + rng() * 0.24;
  const rate = assist ? 0.13 : 0.21;   // thickening per second while heated

  let elapsed = 0;
  let thickness = 0;
  let spoiled = false;
  let finished = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      if (!spoiled && input && input.held) {
        thickness = Math.min(1.2, thickness + rate * (dt / 1000));
        // Crossing the line is terminal. There is no stirring it back down.
        if (thickness > ceiling) { spoiled = true; finished = true; return; }
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (spoiled) return 0;                       // burnt size is not a bad batch, it is no batch
      const s = Math.max(0, Math.min(1, thickness / ceiling));
      return Number.isNaN(s) ? 0 : s;
    },

    progress() { return Math.min(1, thickness / ceiling); },
    done() { return finished; },

    snapshot() {
      return {
        thickness, ceiling, spoiled,
        close: !spoiled && thickness > ceiling * 0.85,
        remaining: Math.max(0, 1 - elapsed / limitMs),
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-gauge');
  host.innerHTML = '';
  const column = doc.createElement('div'); column.className = 'column';
  const band = doc.createElement('span'); band.className = 'band';
  const level = doc.createElement('span'); level.className = 'level';
  column.append(band, level);
  const side = doc.createElement('div'); side.style.flex = '1';
  const status = doc.createElement('span'); status.className = 'status';
  side.appendChild(status);
  host.append(column, side);
  let lastWord = '';
  return {
    render(snap) {
      level.style.height = `${Math.round(Math.min(1, snap.thickness) * 100)}%`;
      band.style.bottom = `${Math.round(snap.ceiling * 100)}%`;
      band.style.height = '4px';
      const word = snap.spoiled ? 'Gone past it - the batch is spoiled'
        : snap.close ? 'Nearly there - let it off' : 'Hold to thicken. It never thins back.';
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-gauge'); host.innerHTML = ''; },
  };
}
