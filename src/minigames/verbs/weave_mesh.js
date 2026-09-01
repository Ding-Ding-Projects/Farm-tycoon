// weave_mesh.js — "Weave the Mesh". The net maker's playable item.
//
// Family: drag, and the third. lay_slices CARRIES a thing to a place and is judged on whether the
// place was right. stack_layers is judged on the ORDER things were put down in. Both of those ask
// a question about the move you are making right now.
//
// This one asks about the moves you already made. The thread runs peg to peg and may never cross a
// line it has already laid, so every segment permanently removes options from the board, and the
// last move - back to where you started - is the one your first eight choices have to leave room
// for. Nothing else here has a move that is illegal because of the SHAPE of your earlier ones.
//
// The trap is real and it is the whole game: grabbing the nearest free peg each time feels correct
// and tangles the net about as often as not, because a nearest-neighbour tour through random points
// self-intersects. Sweeping round the pegs in angular order never does. A player who spots that
// wins every board; a player who does not gets a partial net, which still counts for something.
//
// Getting stuck is not a failure state. If no legal peg is left the stage ends immediately with
// what you wove rather than making you sit out the clock, and a rejected drop costs nothing at all
// - the thread simply stays where it was and the status line says why.

export const id = 'weave_mesh';

const PEGS = 9;
const ASSIST_PEGS = 7;
const DURATION_MS = 20000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sign of the cross product (b-a) x (c-a): which side of line ab the point c falls on. */
function turn(a, b, c) {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (v > 1e-9) return 1;
  if (v < -1e-9) return -1;
  return 0;
}

/**
 * Do segments p1-p2 and p3-p4 properly cross? Only the strict case counts: segments that merely
 * touch at a shared peg are how a path is built, so they are never a crossing. Callers must not
 * pass segments that share an endpoint.
 */
function crosses(p1, p2, p3, p4) {
  const d1 = turn(p3, p4, p1);
  const d2 = turn(p3, p4, p2);
  const d3 = turn(p1, p2, p3);
  const d4 = turn(p1, p2, p4);
  return d1 !== d2 && d3 !== d4 && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
}

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const pegs = assist ? ASSIST_PEGS : PEGS;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.6 : 1);

  // Pegs sit anywhere on the board rather than on a ring. On a ring almost any order works and
  // there is no puzzle; scattered, the angular sweep is a real insight and greedy is a real trap.
  const rng = mulberry32(seed);
  const points = [];
  for (let i = 0; i < pegs; i++) points.push({ x: 0.12 + rng() * 0.76, y: 0.12 + rng() * 0.76 });

  let elapsed = 0;
  let finished = false;
  let closed = false;
  let lastResult = null;
  const order = [];               // pegs threaded so far, in the order they were threaded

  const segments = () => {
    const out = [];
    for (let i = 0; i + 1 < order.length; i++) out.push([order[i], order[i + 1]]);
    return out;
  };

  /** Would running the thread from `from` to `to` cross anything already laid? */
  const wouldCross = (from, to) => {
    for (const [a, b] of segments()) {
      if (a === from || b === from || a === to || b === to) continue;   // shares a peg: fine
      if (crosses(points[from], points[to], points[a], points[b])) return true;
    }
    return false;
  };

  const legalFrom = (from) => {
    const out = [];
    for (let i = 0; i < pegs; i++) {
      if (order.includes(i)) continue;
      if (!wouldCross(from, i)) out.push(i);
    }
    // Closing the loop is legal only once every peg is on the thread.
    if (order.length === pegs && !wouldCross(from, order[0])) out.push(order[0]);
    return out;
  };

  const stuck = () => order.length > 0 && !closed && legalFrom(order[order.length - 1]).length === 0;

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.dropped) {
        const to = typeof input.dropOn === 'number' ? input.dropOn : -1;
        if (to < 0 || to >= pegs) {
          lastResult = 'let go off the board';
        } else if (order.length === 0) {
          order.push(to);
          lastResult = 'thread tied on';
        } else {
          const from = order[order.length - 1];
          if (to === from) {
            lastResult = 'already there';
          } else if (order.includes(to)) {
            // The one exception: coming home to the first peg, once everything else is threaded.
            if (to === order[0] && order.length === pegs) {
              if (wouldCross(from, to)) lastResult = 'the way home is blocked';
              else { closed = true; finished = true; lastResult = 'net closed'; }
            } else {
              lastResult = 'already threaded';
            }
          } else if (wouldCross(from, to)) {
            lastResult = 'that line crosses one you laid';
          } else {
            order.push(to);
            lastResult = null;
          }
        }
      }

      if (!finished && stuck()) { finished = true; lastResult = 'no way through - net left open'; }
      if (elapsed >= limitMs) finished = true;
    },

    // Threading every peg is most of the job; bringing it home is the part that needs planning,
    // so it is worth the last third on its own rather than being a rounding error on top.
    score() {
      const covered = order.length / pegs;
      const s = covered * 0.7 + (closed ? 0.3 : 0);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, order.length / pegs); },
    done() { return finished; },

    snapshot() {
      const from = order.length ? order[order.length - 1] : -1;
      return {
        pegs,
        points,                                   // the view draws these; the model owns them
        order: order.slice(),
        current: from,
        closed,
        threaded: order.length,
        // Published so the view can grey out what is already unreachable. Knowing which pegs are
        // still open is not a hint, it is the board - the alternative is guessing at geometry.
        legal: from < 0 ? Array.from({ length: pegs }, (_, i) => i) : legalFrom(from),
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  const NS = 'http://www.w3.org/2000/svg';
  host.classList.add('stage-drag', 'stage-weave');
  host.innerHTML = '';

  const board = doc.createElement('div');
  board.className = 'weave-board';

  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const thread = doc.createElementNS(NS, 'polyline');
  thread.setAttribute('class', 'weave-thread');
  thread.setAttribute('fill', 'none');
  svg.appendChild(thread);
  board.appendChild(svg);

  const buttons = [];
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(board, status);

  let built = false;
  let announced = '';

  const build = (snap) => {
    for (let i = 0; i < snap.pegs; i++) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'weave-peg';
      // Both halves of the drag contract: a peg is somewhere to take the thread FROM and somewhere
      // to put it. That is also what makes the two-press keyboard route work on this board.
      b.dataset.grab = String(i);
      b.dataset.drop = String(i);
      b.style.left = `${snap.points[i].x * 100}%`;
      b.style.top = `${snap.points[i].y * 100}%`;
      b.setAttribute('aria-label', `Peg ${i + 1}`);
      board.appendChild(b);
      buttons.push(b);
    }
    built = true;
  };

  return {
    render(snap) {
      if (!built) build(snap);

      const pts = snap.order.map((i) => `${snap.points[i].x * 100},${snap.points[i].y * 100}`);
      if (snap.closed && snap.order.length) pts.push(pts[0]);
      thread.setAttribute('points', pts.join(' '));
      thread.classList.toggle('closed', snap.closed);

      const legal = new Set(snap.legal);
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        b.classList.toggle('threaded', snap.order.includes(i));
        b.classList.toggle('current', i === snap.current);
        b.classList.toggle('blocked', !legal.has(i) && !snap.order.includes(i));
      }

      const word = snap.closed
        ? 'Net closed'
        : snap.threaded === 0
          ? `Tie the thread on at any of the ${snap.pegs} pegs`
          : `${snap.threaded} of ${snap.pegs} threaded - ${snap.threaded === snap.pegs ? 'now back to the first peg' : 'no line may cross another'}`;
      status.textContent = snap.result ? `${word} (${snap.result})` : word;
      if (ctx.announce && word !== announced) { announced = word; ctx.announce(word); }
    },
    unmount() {
      host.classList.remove('stage-drag', 'stage-weave');
      host.innerHTML = '';
    },
  };
}
