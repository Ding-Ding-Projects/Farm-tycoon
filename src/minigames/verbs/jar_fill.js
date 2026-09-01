// jar_fill.js — "Fill the Jars". The jam maker's playable item.
//
// Family: rate, and the third. swirl_cone matches a moving target and answers your hand at once.
// wind_press is a one-way ratchet. This one has DEAD TIME: hot jam is thick and slow, so the flow
// arriving at the jar is what you asked for roughly half a second ago. Closing the tap when the
// jar looks full is already too late, and the classic mistake is to over-correct and slop.
//
// Controlling something that answers late is a different skill from controlling something that
// answers now, and it is the only verb here that has it.

export const id = 'jar_fill';

const JARS = 4;
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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const lagMs = assist ? 260 : 520;
  const tolerance = assist ? 0.13 : 0.07;

  const rng = mulberry32(seed);
  const lines = [];
  for (let i = 0; i < JARS; i++) lines.push(0.5 + rng() * 0.4);

  const pipe = [];        // the delay line: what was asked for, and when
  let elapsed = 0;
  let jar = 0;
  let level = 0;
  let quality = 0;
  let judged = 0;
  let finished = false;
  let lastResult = null;

  function closeJar() {
    const want = lines[jar];
    const off = Math.abs(level - want);
    quality += Math.max(0, 1 - off / (tolerance * 3));
    judged += 1;
    lastResult = off <= tolerance ? 'filled to the line'
      : level > want ? 'slopped over' : 'short of the line';
    jar += 1;
    level = 0;
    pipe.length = 0;
    if (jar >= JARS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const asked = input && typeof input.rate === 'number' ? Math.max(0, Math.min(1, input.rate)) : 0;
      pipe.push({ at: elapsed, rate: asked });

      // What actually pours now is what was asked for lagMs ago.
      let arriving = 0;
      while (pipe.length > 1 && pipe[1].at <= elapsed - lagMs) pipe.shift();
      if (pipe.length && pipe[0].at <= elapsed - lagMs) arriving = pipe[0].rate;

      level = Math.min(1.3, level + arriving * (dt / 1000) * 0.42);

      // A jar closes when it has clearly stopped filling, or when it has plainly overflowed.
      if (level > 1.15) { closeJar(); return; }
      if (level > 0.05 && arriving < 0.02 && pipe.every((p) => p.rate < 0.02)) closeJar();

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (judged === 0) return 0;
      const s = (quality / JARS);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, jar / JARS); },
    done() { return finished; },

    snapshot() {
      return {
        level,
        line: jar < JARS ? lines[jar] : 0,
        tolerance,
        jar: Math.min(jar + 1, JARS),
        jars: JARS,
        // How much is already in the pipe and cannot be called back. This is the number a player
        // has to reason about, so it must be visible - the lag is a challenge, not a secret.
        inPipe: pipe.reduce((a, p) => a + p.rate, 0) / Math.max(1, pipe.length),
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-jar');
  host.innerHTML = '';

  const jar = doc.createElement('div');
  jar.className = 'jar';
  const jam = doc.createElement('span'); jam.className = 'jam';
  const line = doc.createElement('span'); line.className = 'line';
  jar.append(jam, line);

  const pipe = doc.createElement('div'); pipe.className = 'pipe';
  const inflight = doc.createElement('span'); inflight.className = 'inflight';
  pipe.appendChild(inflight);

  const status = doc.createElement('span'); status.className = 'status';
  host.append(jar, pipe, status);

  let lastWord = '';
  return {
    render(snap) {
      jam.style.height = `${Math.round(Math.min(1, snap.level) * 100)}%`;
      line.style.bottom = `${Math.round(snap.line * 100)}%`;
      inflight.style.height = `${Math.round(Math.min(1, snap.inPipe) * 100)}%`;
      const word = `Jar ${snap.jar} of ${snap.jars} - the jam runs slow, so ease off early`;
      status.textContent = snap.result ? `${word} (last: ${snap.result})` : word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-jar'); host.innerHTML = ''; },
  };
}
