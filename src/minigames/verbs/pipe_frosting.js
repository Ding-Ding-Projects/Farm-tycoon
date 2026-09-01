// pipe_frosting.js — "Pipe the Frosting". Stage 4 of a cake.
//
// Family: path. Same {x, y, down} shape as whisk_batter, deliberately a different game: this one
// is pure PRECISION with no tempo at all. A fixed route is drawn across the cake and you follow
// it; wander off the piping line and you stop laying frosting until you come back to it.
//
// Nothing here is timed against a beat, which is why it reads as the calm stage between the bake
// and the decoration.

export const id = 'pipe_frosting';

const DURATION_MS = 12000;
const NODES = 7;

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
  const corridor = assist ? 0.17 : 0.09; // how far off the line still counts as on it

  // A zig-zag scallop across the cake, deterministic from the seed.
  const rng = mulberry32(seed);
  const route = [];
  for (let i = 0; i < NODES; i++) {
    route.push({
      x: 0.08 + (i / (NODES - 1)) * 0.84,
      y: i % 2 === 0 ? 0.30 + rng() * 0.10 : 0.62 + rng() * 0.10,
    });
  }

  let elapsed = 0;
  let target = 1;      // the node being piped toward
  let laid = 0;        // samples spent on the line
  let samples = 0;
  let strayed = 0;
  let finished = false;

  /** Distance from p to the segment route[target-1] -> route[target]. */
  function distToLeg(px, py) {
    const a = route[target - 1];
    const b = route[target];
    const vx = b.x - a.x, vy = b.y - a.y;
    const wx = px - a.x, wy = py - a.y;
    const len2 = vx * vx + vy * vy || 1e-6;
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
    return { d: Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t)), t };
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.down && target < route.length) {
        const { d, t } = distToLeg(input.x, input.y);
        if (d <= corridor) {
          laid += 1;
          // Reaching the far end of the current leg advances to the next one.
          if (t > 0.92) target = Math.min(route.length - 1, target + 1);
        } else {
          strayed += 1;
        }
        samples += 1;
      }

      if (elapsed >= limitMs || (target >= route.length - 1 && samples > 0 && laid > 0
        && distToLeg(route[route.length - 1].x, route[route.length - 1].y).t > 0.9 && target === route.length - 1 && laid > NODES * 6)) {
        finished = true;
      }
      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const covered = (target) / (route.length - 1);
      if (samples === 0) return 0;
      const cleanliness = laid / (laid + strayed || 1);
      const s = covered * 0.65 + cleanliness * 0.35;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, target / (route.length - 1)); },
    done() { return finished; },

    snapshot() {
      return {
        route,
        target,
        done: target >= route.length - 1,
        corridor,
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
  const base = doc.createElementNS(NS, 'path'); base.setAttribute('class', 'route');
  const drawn = doc.createElementNS(NS, 'path'); drawn.setAttribute('class', 'drawn');
  const ahead = doc.createElementNS(NS, 'path'); ahead.setAttribute('class', 'ahead');
  const cursor = doc.createElementNS(NS, 'circle'); cursor.setAttribute('class', 'cursor'); cursor.setAttribute('r', '3');
  svg.append(base, drawn, ahead, cursor);
  host.appendChild(svg);

  const d = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`).join(' ');

  let announced = -1;
  return {
    render(snap) {
      base.setAttribute('d', d(snap.route));
      drawn.setAttribute('d', d(snap.route.slice(0, snap.target + 1)));
      ahead.setAttribute('d', d(snap.route.slice(snap.target)));
      const head = snap.route[snap.target];
      cursor.setAttribute('cx', (head.x * 100).toFixed(1));
      cursor.setAttribute('cy', (head.y * 100).toFixed(1));
      if (ctx.announce && snap.target !== announced) {
        announced = snap.target;
        ctx.announce(`Piped ${snap.target} of ${snap.route.length - 1} scallops`);
      }
    },
    unmount() { host.classList.remove('stage-trace'); host.innerHTML = ''; },
  };
}
