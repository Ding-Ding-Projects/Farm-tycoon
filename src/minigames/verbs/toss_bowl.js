// toss_bowl.js — "Toss the Bowl". The salad bar's playable item.
//
// Family: balance, and the second, and it is the INVERSE of the first. pour_tin asks you to hold
// a point still in the middle against a lean that keeps pushing you off it. This asks you to keep
// the bowl MOVING: a salad is tossed by swinging it to one extreme and then the other, and sitting
// still in the centre is the one thing that dresses nothing at all.
//
// Same input shape, opposite instinct. A player who has learned to hold steady has to unlearn it.

export const id = 'toss_bowl';

const SWINGS = 8;
const DURATION_MS = 13000;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const reach = assist ? 0.45 : 0.62;   // how far out counts as a full swing

  let elapsed = 0;
  let swings = 0;
  let side = 0;          // -1 left, +1 right, 0 not yet committed
  let stillFor = 0;      // ms spent near the centre, which is wasted time
  let coverage = 0;      // credit for swinging through the whole arc
  let samples = 0;
  let finished = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const ax = input && typeof input.ax === 'number' ? Math.max(-1, Math.min(1, input.ax)) : 0;
      const ay = input && typeof input.ay === 'number' ? Math.max(-1, Math.min(1, input.ay)) : 0;
      const swing = Math.hypot(ax, ay);

      if (swing < 0.18) {
        stillFor += dt;   // dead centre: nothing is being tossed
      } else {
        coverage += Math.min(1, swing / reach);
        samples += 1;
        const now = Math.sign(ax || 1);
        // A swing only counts when it reaches the far side AFTER having been on the other one.
        if (swing >= reach) {
          if (side === 0) side = now;
          else if (now !== side) { swings += 1; side = now; }
        }
      }

      if (swings >= SWINGS || elapsed >= limitMs) finished = true;
    },

    score() {
      const tossed = Math.min(1, swings / SWINGS);
      const vigour = samples === 0 ? 0 : Math.min(1, coverage / samples);
      const idle = Math.min(0.35, (stillFor / Math.max(1, elapsed)) * 0.7);
      const s = tossed * 0.65 + vigour * 0.35 - idle;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, swings / SWINGS); },
    done() { return finished; },

    snapshot() {
      return {
        swings,
        need: SWINGS,
        side,
        reach,
        idling: stillFor / Math.max(1, elapsed) > 0.4,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-toss');
  host.innerHTML = '';

  const arc = doc.createElement('div');
  arc.className = 'arc';
  const left = doc.createElement('span'); left.className = 'end left';
  const right = doc.createElement('span'); right.className = 'end right';
  const bowl = doc.createElement('span'); bowl.className = 'bowl';
  arc.append(left, right, bowl);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(arc, status);

  let lastWord = '';
  return {
    render(snap) {
      bowl.style.left = `${50 + snap.side * 34}%`;
      left.classList.toggle('lit', snap.side === -1);
      right.classList.toggle('lit', snap.side === 1);
      const word = snap.idling ? 'Sitting still dresses nothing - keep it swinging'
        : `${snap.swings} of ${snap.need} tosses - all the way to each side`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-toss'); host.innerHTML = ''; },
  };
}
