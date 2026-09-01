// whisk_batter.js — "Whisk the Batter". Stage 1 of a cake.
//
// Family: path. You drag around the bowl and the model only ever sees {x, y, down}. What it
// measures is ANGULAR PROGRESS: keep going round, in one direction, at a steady rate. Stopping
// costs you, and so does thrashing — a whisk that changes direction is not whisking.
//
// Distinct from pipe_frosting, which is the other `path` verb: that one cares WHERE you are
// against a fixed route, this one cares only how smoothly you keep turning.

export const id = 'whisk_batter';

const TURNS_WANTED = 4;          // full revolutions to bring the batter together
const IDEAL_RATE = 2.6;          // radians per second that reads as "steady"
const DURATION_MS = 11000;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const turns = assist ? TURNS_WANTED - 1 : TURNS_WANTED;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.6 : 1);

  let elapsed = 0;
  let angle = null;        // last pointer angle around the bowl centre
  let swept = 0;           // total signed radians travelled
  let smooth = 0;          // accumulated smoothness credit
  let samples = 0;
  let reversals = 0;
  let lastDir = 0;
  let finished = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      if (input && input.down) {
        const a = Math.atan2(input.y - 0.5, input.x - 0.5);
        if (angle !== null) {
          let delta = a - angle;
          while (delta > Math.PI) delta -= Math.PI * 2;   // shortest way round
          while (delta < -Math.PI) delta += Math.PI * 2;
          const dir = Math.sign(delta);
          if (dir !== 0 && lastDir !== 0 && dir !== lastDir && Math.abs(delta) > 0.05) reversals += 1;
          if (dir !== 0) lastDir = dir;

          swept += Math.abs(delta);
          // Rate credit: 1 when you are near the ideal, falling away either side, so both
          // dawdling and frantic scrubbing score worse than an even hand.
          const rate = Math.abs(delta) / Math.max(1, dt) * 1000;
          const off = Math.abs(rate - IDEAL_RATE) / IDEAL_RATE;
          smooth += Math.max(0, 1 - Math.min(1, off));
          samples += 1;
        }
        angle = a;
      } else {
        angle = null; // lifting off breaks the stroke; it does not penalise beyond lost credit
      }

      if (swept >= turns * Math.PI * 2 || elapsed >= limitMs) finished = true;
    },

    score() {
      if (samples === 0) return 0;
      const evenness = smooth / samples;
      const completion = Math.min(1, swept / (turns * Math.PI * 2));
      const penalty = Math.min(0.4, reversals * 0.05);
      const s = Math.max(0, completion * 0.6 + evenness * 0.4 - penalty);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, swept / (turns * Math.PI * 2)); },
    done() { return finished; },

    snapshot() {
      return {
        turns: swept / (Math.PI * 2),
        turnsWanted: turns,
        angle: angle === null ? null : angle,
        pips: Math.floor(swept / (Math.PI / 2)),
        stirring: angle !== null,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-dial');
  host.innerHTML = '';

  const track = doc.createElement('div');
  track.className = 'track';
  const ring = doc.createElement('span'); ring.className = 'ring';
  const hub = doc.createElement('span'); hub.className = 'hub';
  const handle = doc.createElement('span'); handle.className = 'handle';
  track.append(ring, hub, handle);

  const pips = [];
  for (let i = 0; i < 4; i++) {
    const p = doc.createElement('span');
    p.className = 'pip';
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    p.style.left = `${50 + Math.cos(a) * 46}%`;
    p.style.top = `${50 + Math.sin(a) * 46}%`;
    track.appendChild(p);
    pips.push(p);
  }
  host.appendChild(track);

  let announced = -1;
  return {
    render(snap) {
      const a = snap.angle === null ? -Math.PI / 2 : snap.angle;
      handle.style.left = `${50 + Math.cos(a) * 46}%`;
      handle.style.top = `${50 + Math.sin(a) * 46}%`;
      handle.style.opacity = snap.stirring ? '1' : '0.55';
      const whole = Math.floor(snap.turns);
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('hit', snap.pips > i);
      if (ctx.announce && whole !== announced) {
        announced = whole;
        ctx.announce(`${whole} of ${snap.turnsWanted} turns`);
      }
    },
    unmount() { host.classList.remove('stage-dial'); host.innerHTML = ''; },
  };
}
