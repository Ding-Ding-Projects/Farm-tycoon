// set_hook.js — "Snap the Hook". The lure workbench's playable item.
//
// Called "snap" rather than "set" because verbWord has to be globally unique and set_stone already
// owns "set". The validator refused the collision outright, which is the anti-re-skin rule earning
// its keep, and snap is the better word for it anyway: both threads go tight in the same instant.
//
// Family: dual, and the fifth. The other four are all about where the two values ARE or how they
// are moving: throw_shuttles chases two marks that drift apart, roll_press keeps two rollers equal
// while driving both, blend_notes is zero-sum so only the ratio matters, pull_taffy is cyclic and
// cares about rhythm rather than position.
//
// This one is about SIMULTANEITY. Two threads have to come taut at the same instant. Either one
// alone is trivial - pull it and it is taut - and pulling them one after the other is the natural
// thing to do and never works, because a hook set by one thread and then the other pulls out. The
// verb is the coincidence, not the positions.
//
// Nothing else here scores a moment shared between two inputs. That is the whole reason it exists,
// and it is why the window is published: the player needs to know how close together counts, or
// they are being asked to guess at a tolerance rather than hit one.

export const id = 'set_hook';

const HOOKS = 5;
const TAUT = 0.78;            // how far a thread must be pulled to count as taut
const WINDOW_MS = 180;        // how close together the two must arrive
const DURATION_MS = 15000;

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
  const windowMs = WINDOW_MS * (assist ? 2.4 : 1);

  // Each hook is tied a little tighter or looser than the last, seeded so a given craft plays the
  // same way twice. Without this the verb ignored its seed entirely and every run of every lure
  // was identical, which passes a determinism check trivially and gives a player no reason to
  // meet the second one.
  const rng = mulberry32(seed);
  const tautFor = [];
  for (let i = 0; i < HOOKS; i++) tautFor.push((TAUT - 0.08 + rng() * 0.16) * (assist ? 0.82 : 1));

  let elapsed = 0;
  let set = 0;
  let judged = 0;
  let quality = 0;
  let leftAt = null;          // when the left thread last came taut
  let rightAt = null;
  let leftWas = false;
  let rightWas = false;
  let cooldown = 0;
  let finished = false;
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;
      if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);

      const l = input && typeof input.left === 'number' ? Math.max(0, Math.min(1, input.left)) : 0;
      const r = input && typeof input.right === 'number' ? Math.max(0, Math.min(1, input.right)) : 0;

      const taut = tautFor[Math.min(judged, HOOKS - 1)];
      const lTaut = l >= taut;
      const rTaut = r >= taut;
      // Only the RISING edge counts. Holding a thread taut and waiting for the other to catch up
      // is exactly the sequential play this verb exists to refuse.
      if (lTaut && !leftWas) leftAt = elapsed;
      if (rTaut && !rightWas) rightAt = elapsed;
      leftWas = lTaut;
      rightWas = rTaut;

      if (cooldown === 0 && leftAt !== null && rightAt !== null) {
        const apart = Math.abs(leftAt - rightAt);
        judged += 1;
        if (apart <= windowMs) {
          set += 1;
          // Closer together is a cleaner set, so precision beyond merely qualifying still pays.
          quality += 1 - (apart / windowMs) * 0.4;
          lastResult = 'hook set';
        } else {
          lastResult = 'pulled one at a time';
        }
        leftAt = null;
        rightAt = null;
        cooldown = 420;       // the next hook has to be threaded before it can be set
        if (judged >= HOOKS) finished = true;
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (judged === 0) return 0;
      const s = quality / HOOKS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, judged / HOOKS); },
    done() { return finished; },

    snapshot() {
      return {
        hook: Math.min(judged + 1, HOOKS),
        hooks: HOOKS,
        set,
        taut: tautFor[Math.min(judged, HOOKS - 1)],
        // How close together counts. Published deliberately: a tolerance the player cannot know is
        // a tolerance they are guessing at, and this verb is hard enough when you DO know it.
        windowMs,
        threading: cooldown > 0,
        // Which threads are currently waiting for their partner, so the state is readable.
        leftWaiting: leftAt !== null,
        rightWaiting: rightAt !== null,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-dual');
  host.innerHTML = '';

  const rail = (cls) => { const d = doc.createElement('div'); d.className = `rail ${cls}`; return d; };
  const L = rail('left');
  const R = rail('right');
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(L, status, R);

  let last = '';
  return {
    render(snap) {
      L.classList.toggle('open', snap.leftWaiting);
      R.classList.toggle('open', snap.rightWaiting);
      const word = snap.threading
        ? `Hook ${snap.hook} of ${snap.hooks} - threading up`
        : `Hook ${snap.hook} of ${snap.hooks} - pull BOTH threads taut together, within ${Math.round(snap.windowMs)}ms`;
      status.textContent = snap.result ? `${word} (last: ${snap.result})` : word;
      if (ctx.announce && word !== last) { last = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-dual'); host.innerHTML = ''; },
  };
}
