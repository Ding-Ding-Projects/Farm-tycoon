// match_seam.js — "Match the Seam". The sewing machine's playable item.
//
// Family: route, and the third. sort_chillies is MATCHING: each pepper carries its own answer and
// you just have to open that chute in time. split_press is ALLOCATION: every destination is legal
// and only the division is right or wrong. This one is a CHAINED RULE: the piece coming down does
// not tell you where it goes, because a seam must continue the piece BEFORE it. The answer is
// always on the board behind you, never on the item in front of you.
//
// A player who solves sort_chillies by looking at the falling item learns nothing here, because
// looking at the falling item is exactly the wrong instinct.

export const id = 'match_seam';

const LANES = 3;
const PIECES = 8;
const FALL_MS = 1600;

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
  const fallMs = FALL_MS * (assist ? 1.8 : 1);

  const rng = mulberry32(seed);
  const kinds = [];
  for (let i = 0; i < PIECES; i++) kinds.push(Math.floor(rng() * LANES));

  let index = 0;
  let t = 0;
  let right = 0;
  let judged = 0;
  let finished = false;
  let lastResult = null;

  // The seam continues the PREVIOUS piece. The first piece has nothing before it, so it is free
  // and simply sets the seam going.
  const wanted = () => (index === 0 ? null : kinds[index - 1]);

  function land(chosen) {
    const want = wanted();
    if (want === null) { lastResult = 'seam started'; }
    else {
      judged += 1;
      if (chosen === want) { right += 1; lastResult = 'seam matched'; }
      else lastResult = 'seam broken';
    }
    index += 1;
    t = 0;
    if (index >= PIECES) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      t += Math.max(0, dtMs || 0);

      const lane = input && typeof input.lane === 'number' ? input.lane : -1;
      if (input && input.commit && lane >= 0) { land(lane); return; }
      if (t >= fallMs) land(lane);
    },

    score() {
      if (judged === 0) return 0;
      const s = right / (PIECES - 1);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, index / PIECES); },
    done() { return finished; },

    snapshot() {
      return {
        lanes: LANES,
        // What is FALLING, which is deliberately not the answer.
        falling: index < PIECES ? kinds[index] : -1,
        // What the seam needs, which is the piece before it.
        needs: wanted(),
        fall: Math.min(1, t / fallMs),
        piece: Math.min(index + 1, PIECES),
        pieces: PIECES,
        right,
        result: lastResult,
      };
    },
  };
}

const COLOURS = ['#7fd4f0', '#f7d43e', '#f48ab0'];

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
    c.dataset.pad = String(i);
    c.style.background = COLOURS[i];
    c.setAttribute('aria-label', `Seam ${i + 1}`);
    chutes.appendChild(c);
    lanes.push(c);
  }
  host.append(item, chutes);

  let announced = -1;
  return {
    render(snap) {
      if (snap.falling >= 0) {
        item.style.display = '';
        item.style.background = COLOURS[snap.falling];
        item.style.left = `${14 + snap.falling * 26}%`;
        item.style.top = `${6 + snap.fall * 62}%`;
      } else {
        item.style.display = 'none';
      }
      // The OPEN chute shows what the seam needs - the previous piece - not what is falling.
      for (let i = 0; i < lanes.length; i++) lanes[i].classList.toggle('open', i === snap.needs);
      if (ctx.announce && snap.piece !== announced) {
        announced = snap.piece;
        ctx.announce(`Piece ${snap.piece} of ${snap.pieces}, ${snap.right} seams matched`);
      }
    },
    unmount() { host.classList.remove('stage-route'); host.innerHTML = ''; },
  };
}
