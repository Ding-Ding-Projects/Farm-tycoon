// sort_chillies.js — "Sort the Chillies". The sauce maker's playable item.
//
// Family: route. The model sees {lane, commit}: which chute is selected, and whether the player
// has just committed to it. Peppers come down the belt one at a time and each belongs in one of
// three chutes; you have until it lands to have the right one open.
//
// Decisions rather than reflex, which is what separates it from press_cutter: the target is
// never hidden and never moves, but choosing wrongly is entirely possible and entirely yours.

export const id = 'sort_chillies';

const LANES = 3;
const ITEMS = 9;
const FALL_MS = 1500;

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
  const fallMs = FALL_MS * (assist ? 1.9 : 1);

  const rng = mulberry32(seed);
  const kinds = [];
  for (let i = 0; i < ITEMS; i++) kinds.push(Math.floor(rng() * LANES));

  let index = 0;
  let t = 0;
  let right = 0;
  let judged = 0;
  let finished = false;
  let lastResult = null;

  function land(chosen) {
    judged += 1;
    if (chosen === kinds[index]) { right += 1; lastResult = 'sorted'; }
    else lastResult = 'wrong';
    index += 1;
    t = 0;
    if (index >= ITEMS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      t += Math.max(0, dtMs || 0);

      const lane = input && typeof input.lane === 'number' ? input.lane : -1;

      // Committing early drops it straight down that chute — a way to go faster if you are sure.
      if (input && input.commit && lane >= 0) { land(lane); return; }

      // Otherwise it lands on its own, into whichever chute happens to be open. Doing nothing is
      // therefore a CHOICE with a consequence, not a stall: the run still ends.
      if (t >= fallMs) land(lane);
    },

    score() {
      if (judged === 0) return 0;
      const s = right / ITEMS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, index / ITEMS); },
    done() { return finished; },

    snapshot() {
      return {
        lanes: LANES,
        kind: index < ITEMS ? kinds[index] : -1,
        fall: Math.min(1, t / fallMs),
        index: Math.min(index + 1, ITEMS),
        items: ITEMS,
        right,
        result: lastResult,
      };
    },
  };
}

const COLOURS = ['#82ce3c', '#f2c94c', '#e05548'];

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-route');
  host.innerHTML = '';

  const item = doc.createElement('span'); item.className = 'item';
  const chutes = doc.createElement('span'); chutes.className = 'chutes';
  const lanes = [];
  for (let i = 0; i < LANES; i++) {
    const c = doc.createElement('span');
    c.className = 'chute';
    c.dataset.pad = String(i);     // the shared input layer reads lanes from pointer x, keys 1-3
    c.style.background = COLOURS[i];
    c.setAttribute('aria-label', `Chute ${i + 1}`);
    chutes.appendChild(c);
    lanes.push(c);
  }
  host.append(item, chutes);

  let announced = -1;
  return {
    render(snap) {
      if (snap.kind >= 0) {
        item.style.display = '';
        item.style.background = COLOURS[snap.kind];
        item.style.left = `${12 + snap.kind * 26}%`;
        item.style.top = `${6 + snap.fall * 62}%`;
      } else {
        item.style.display = 'none';
      }
      for (let i = 0; i < lanes.length; i++) lanes[i].classList.toggle('open', i === snap.kind);
      if (ctx.announce && snap.index !== announced) {
        announced = snap.index;
        ctx.announce(`Pepper ${snap.index} of ${snap.items}, ${snap.right} sorted`);
      }
    },
    unmount() { host.classList.remove('stage-route'); host.innerHTML = ''; },
  };
}
