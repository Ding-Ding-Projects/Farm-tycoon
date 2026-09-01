// calm_hands.js — "Keep Them Calm". The duck salon's playable item.
//
// Family: path, and the sixth. Every other one rewards the motion itself: whisk_batter wants a
// full sweep, pipe_frosting wants a line held true, fold_shell wants the turn made cleanly,
// skim_curds wants the surface covered, stir_figure wants a lap that matches your own first lap.
// In all five, moving MORE is moving better.
//
// Here it is the opposite, and that is the whole verb. A duck startles at a fast hand, and a
// startled duck cannot be preened at all - so the only way to fail this is to hurry. Speed is not
// scored down, it is scored NOTHING: over the limit, the patch stops taking progress and gives
// some back.
//
// The limit is not one number. Every patch has its own tenderness, and the tender ones are the
// strictest, so the hand has to change pace as it crosses the bird rather than settling into one
// safe crawl. Travelling BETWEEN patches is free at any speed, which is deliberate: the skill is
// arriving slowly, not moving slowly, and a verb that punished the journey too would just be
// tedious.
//
// Lifting off and pressing down again somewhere quiet is allowed, because that is what a person
// actually does. It buys nothing though: a fresh press has to settle before the patch will take
// anything, so tapping from patch to patch is no quicker than gliding between them gently.

export const id = 'calm_hands';

const PATCHES = 6;
const DURATION_MS = 18000;
const SETTLE_MS = 220;        // after a fresh press, how long before a patch will take progress
const FILL_MS = 900;          // how long a patch takes to preen at a calm hand

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.6 : 1);
  const ease = assist ? 2.1 : 1;

  // Patches are laid down WITHOUT overlapping, by rejection, and that is load-bearing rather than
  // tidiness. The hand is inside whichever patch contains it, so two patches sharing ground means
  // one of them can never be reached at all: a driver sits on the pair, fills the first, and the
  // second stays at zero for the whole round with nothing on screen to say why. Measured before
  // this was fixed, half the seeds stranded four of the six patches.
  const rng = mulberry32(seed);
  const patches = [];
  for (let i = 0, guard = 0; i < PATCHES && guard < 400; guard++) {
    const c = {
      x: 0.14 + rng() * 0.72,
      y: 0.14 + rng() * 0.72,
      r: 0.09 + rng() * 0.04,
      // Screen widths per second. A tender patch will not tolerate much more than a drift.
      limit: (0.22 + rng() * 0.5) * ease,
      fill: 0,
    };
    if (patches.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < q.r + c.r + 0.03)) continue;
    patches.push(c);
    i += 1;
  }
  // Rejection can in principle run out of room; the round must still be playable, so anything the
  // sampler could not fit is dropped rather than placed on top of something.
  const patchCount = patches.length;

  let elapsed = 0;
  let finished = false;
  let prev = null;            // last position, only tracked while the hand is down
  let heldFor = 0;
  let speed = 0;
  let startles = 0;
  let inside = -1;
  let spooked = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const down = !!(input && input.down);
      const x = input && typeof input.x === 'number' ? input.x : 0.5;
      const y = input && typeof input.y === 'number' ? input.y : 0.5;

      if (!down) {
        prev = null;
        heldFor = 0;
        speed = 0;
        inside = -1;
        spooked = false;
      } else {
        heldFor += dt;
        if (prev && dt > 0) {
          // Screen widths per second, so the published limits mean something a player can feel.
          speed = Math.hypot(x - prev.x, y - prev.y) / (dt / 1000);
        } else {
          speed = 0;   // a fresh press has no history to measure against, and SETTLE_MS covers it
        }
        prev = { x, y };

        // Nearest containing patch rather than the first one found, so that even if two ever did
        // share ground the hand would be on the one it is actually closest to.
        inside = -1;
        let near = Infinity;
        for (let i = 0; i < patches.length; i++) {
          const p = patches[i];
          const d = Math.hypot(x - p.x, y - p.y);
          if (d <= p.r && d < near) { near = d; inside = i; }
        }

        if (inside >= 0 && heldFor >= SETTLE_MS) {
          const p = patches[inside];
          if (speed <= p.limit) {
            spooked = false;
            p.fill = Math.min(1, p.fill + dt / FILL_MS);
          } else {
            // Not merely unscored: a hurried hand undoes some of what a calm one did.
            if (!spooked) startles += 1;
            spooked = true;
            p.fill = Math.max(0, p.fill - dt / (FILL_MS * 1.6));
          }
        } else {
          spooked = false;
        }
      }

      if (patches.every((p) => p.fill >= 1)) finished = true;
      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const s = patches.reduce((a, p) => a + p.fill, 0) / patchCount;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() {
      return Math.min(1, patches.reduce((a, p) => a + p.fill, 0) / patchCount);
    },

    done() { return finished; },

    snapshot() {
      return {
        patches: patches.map((p) => ({ x: p.x, y: p.y, r: p.r, limit: p.limit, fill: p.fill })),
        // Both published: the limit for where the hand is, and how fast it is actually going.
        // A speed limit the player cannot read is not a limit, it is a trap.
        speed,
        limitHere: inside >= 0 ? patches[inside].limit : null,
        inside,
        spooked,
        startles,
        settling: inside >= 0 && heldFor < SETTLE_MS,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-trace', 'stage-calm');
  host.innerHTML = '';

  const board = doc.createElement('div');
  board.className = 'calm-board';
  // Built on the first render rather than here, because how many patches actually fitted is the
  // model's business and PATCHES is only what it aimed for.
  const spots = [];

  const meter = doc.createElement('div');
  meter.className = 'calm-meter';
  const bar = doc.createElement('i');
  meter.appendChild(bar);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(board, meter, status);

  let placed = false;
  let announced = '';

  return {
    render(snap) {
      if (!placed) {
        for (const p of snap.patches) {
          const el = doc.createElement('div');
          el.className = 'calm-patch';
          const fill = doc.createElement('i');
          el.appendChild(fill);
          el.style.left = `${(p.x - p.r) * 100}%`;
          el.style.top = `${(p.y - p.r) * 100}%`;
          el.style.width = `${p.r * 200}%`;
          el.style.paddingTop = `${p.r * 200}%`;
          board.appendChild(el);
          spots.push({ el, fill });
        }
        placed = true;
      }
      for (let i = 0; i < spots.length; i++) {
        const p = snap.patches[i];
        spots[i].fill.style.opacity = String(0.15 + p.fill * 0.85);
        spots[i].el.classList.toggle('tender', p.limit < 0.4);
        spots[i].el.classList.toggle('done', p.fill >= 1);
        spots[i].el.classList.toggle('here', i === snap.inside);
      }

      // Against the limit of the patch the hand is over, so the bar reads as "how close am I to
      // startling it" rather than as a bare speed nobody can judge.
      const ref = snap.limitHere == null ? 1 : snap.limitHere;
      bar.style.width = `${Math.min(100, (snap.speed / ref) * 100)}%`;
      meter.classList.toggle('over', snap.spooked);

      const word = snap.spooked
        ? 'Too fast - it is pulling away'
        : snap.settling
          ? 'Settling - hold still a moment'
          : snap.inside >= 0
            ? `Preening patch ${snap.inside + 1} - keep under ${snap.limitHere.toFixed(2)} widths a second`
            : 'Move onto a patch. Travel as fast as you like; arrive slowly.';
      status.textContent = snap.startles ? `${word} (${snap.startles} startles)` : word;
      if (ctx.announce && word !== announced) { announced = word; ctx.announce(word); }
    },
    unmount() {
      host.classList.remove('stage-trace', 'stage-calm');
      host.innerHTML = '';
    },
  };
}
