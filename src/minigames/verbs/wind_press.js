// wind_press.js — "Wind the Press". The oil press's playable item.
//
// Family: rate, and the second. swirl_cone asks you to MATCH a flow that changes as the cone
// fills: the right answer moves, and you follow it up and down. This is a RATCHET. The screw only
// turns one way, so your rate may only ever rise, and easing off is not a correction you can make
// - it is simply the end of how far you got. On top of that the press has a breaking point that
// rises as the mash compacts, so going too hard too early cracks it.
//
// Following a moving target and committing to a one-way climb are opposite skills, which is what
// makes them two verbs rather than one.

export const id = 'wind_press';

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.9 : 1);
  const headroom = assist ? 0.26 : 0.14;   // how far above the safe line before it cracks

  const rng = mulberry32(seed);
  const start = 0.16 + rng() * 0.1;

  let elapsed = 0;
  let turned = 0;      // the ratchet: highest rate reached, never falls
  let yielded = 0;     // oil pressed out
  let cracked = false;
  let finished = false;

  // The press can safely take more as the mash compacts, so patience genuinely pays.
  const safeLine = (t) => Math.min(0.95, start + (t / 1000) * 0.075);

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const asked = input && typeof input.rate === 'number' ? Math.max(0, Math.min(1, input.rate)) : 0;
      // The ratchet: the screw does not unwind, so easing off holds rather than lowers.
      turned = Math.max(turned, asked);

      const safe = safeLine(elapsed);
      if (turned > safe + headroom) { cracked = true; finished = true; return; }

      // Oil comes out faster the harder it is pressed, so hanging back is not free either.
      yielded += turned * (dt / 1000) * 0.16;

      if (yielded >= 1 || elapsed >= limitMs) finished = true;
    },

    score() {
      if (cracked) return 0;
      const s = Math.min(1, yielded);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, yielded); },
    done() { return finished; },

    snapshot() {
      const safe = safeLine(elapsed);
      return {
        turned,
        safe,
        headroom,
        yielded,
        cracked,
        straining: turned > safe,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-swirl');
  host.innerHTML = '';

  const jug = doc.createElement('div');
  jug.className = 'cone';
  const oil = doc.createElement('span'); oil.className = 'soft';
  jug.appendChild(oil);

  const meter = doc.createElement('div'); meter.className = 'flow';
  const line = doc.createElement('span'); line.className = 'want';
  const screw = doc.createElement('span'); screw.className = 'lever';
  meter.append(line, screw);

  const status = doc.createElement('span'); status.className = 'status';
  host.append(jug, meter, status);

  let lastWord = '';
  return {
    render(snap) {
      oil.style.height = `${Math.round(Math.min(1, snap.yielded) * 100)}%`;
      line.style.bottom = `${Math.round(snap.safe * 100)}%`;
      screw.style.bottom = `${Math.round(snap.turned * 100)}%`;
      const word = snap.cracked ? 'Cracked the press - too much, too early'
        : snap.straining ? 'Straining - it will crack' : 'Wind it up. The screw does not unwind.';
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-swirl'); host.innerHTML = ''; },
  };
}
