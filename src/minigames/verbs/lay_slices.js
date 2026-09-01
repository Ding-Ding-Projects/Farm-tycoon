// lay_slices.js — "Lay the Slices". The sushi bar's playable item.
//
// Family: drag. The model sees {grabbed, dropOn, dropped}: which slice is in your hand, where it
// was let go, and the instant it landed. Carrying a thing from one place to another is its own
// grammar, and nothing else here has it: sequence taps a pad and forgets it, route opens a chute
// and waits. This picks a specific thing up and takes it somewhere specific.
//
// Each slice belongs on the plate that matches it, and the order you work in is yours: there is
// no lit target and no clock ticking on any single move, only a board to clear.

export const id = 'lay_slices';

const SLICES = 6;
const PLATES = 3;
const DURATION_MS = 16000;

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
  const belongs = [];
  for (let i = 0; i < SLICES; i++) belongs.push(Math.floor(rng() * PLATES));

  const placed = new Array(SLICES).fill(-1);   // plate each slice ended on, -1 = still on the board
  let elapsed = 0;
  let right = 0;
  let wrong = 0;
  let finished = false;
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.dropped) {
        const i = input.grabbed;
        const plate = input.dropOn;
        // A slice dropped back on the board, or one already laid, is simply not a move.
        if (i >= 0 && i < SLICES && placed[i] === -1 && plate >= 0 && plate < PLATES) {
          placed[i] = plate;
          if (plate === belongs[i]) { right += 1; lastResult = 'laid'; }
          else { wrong += 1; lastResult = 'wrong plate'; }
        }
      }

      // The board clears itself when the service ends, whether or not you laid anything.
      if (right + wrong >= SLICES || elapsed >= limitMs) finished = true;
    },

    score() {
      // Unlaid slices count against you as surely as misplaced ones: an unfinished plate is not
      // a neutral outcome, it is an incomplete dish.
      const s = right / SLICES;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, (right + wrong) / SLICES); },
    done() { return finished; },

    snapshot() {
      return {
        slices: SLICES, plates: PLATES,
        belongs, placed: placed.slice(),
        right, wrong,
        remaining: Math.max(0, 1 - elapsed / limitMs),
        result: lastResult,
      };
    },
  };
}

const COLOURS = ['#f48ab0', '#7fd4f0', '#f7d43e'];

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-drag');
  host.innerHTML = '';

  const board = doc.createElement('div'); board.className = 'board';
  const slices = [];
  for (let i = 0; i < SLICES; i++) {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'slice';
    b.dataset.grab = String(i);
    board.appendChild(b);
    slices.push(b);
  }

  const plates = doc.createElement('div'); plates.className = 'plates';
  const dishes = [];
  for (let i = 0; i < PLATES; i++) {
    const p = doc.createElement('button');
    p.type = 'button'; p.className = 'plate';
    p.dataset.drop = String(i);
    p.style.borderColor = COLOURS[i];
    p.setAttribute('aria-label', `Plate ${i + 1}`);
    plates.appendChild(p);
    dishes.push(p);
  }

  const status = doc.createElement('span'); status.className = 'status';
  host.append(board, plates, status);

  let announced = -1;
  return {
    render(snap) {
      for (let i = 0; i < slices.length; i++) {
        slices[i].style.background = COLOURS[snap.belongs[i]];
        slices[i].classList.toggle('laid', snap.placed[i] !== -1);
        slices[i].setAttribute('aria-label',
          `Slice ${i + 1}, plate ${snap.belongs[i] + 1}${snap.placed[i] !== -1 ? ', laid' : ''}`);
      }
      const done = snap.right + snap.wrong;
      status.textContent = `${snap.right} of ${snap.slices} laid right`;
      if (ctx.announce && done !== announced) {
        announced = done;
        ctx.announce(`${snap.right} of ${snap.slices} laid right`);
      }
    },
    unmount() { host.classList.remove('stage-drag'); host.innerHTML = ''; },
  };
}
