// place_decor.js — "Place the Decorations". The last stage of a cake.
//
// Family: sequence — the same {padIndex} shape press_cutter uses, and a deliberately different
// game. press_cutter is REACTION: hit the one that is lit. This is MEMORY: the pattern is shown
// once, then hidden, and you lay it back in order. Nothing is lit while you are answering, so a
// fast hand buys you nothing at all.
//
// It is the verb that most rewards Assist mode honestly: assist shows the pattern for longer, it
// does not make the pattern shorter.

export const id = 'place_decor';

const PADS = 4;
const ROUNDS = 3;                 // three patterns, each one longer than the last
const SHOW_MS = 620;              // per pad, while demonstrating
const GAP_MS = 180;

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
  const showMs = SHOW_MS * (assist ? 1.9 : 1);
  const answerMs = (assist ? 9000 : 6000);

  const rng = mulberry32(seed);
  const patterns = [];
  for (let r = 0; r < ROUNDS; r++) {
    const len = 3 + r;                       // 3, 4, 5
    const p = [];
    for (let i = 0; i < len; i++) p.push(Math.floor(rng() * PADS));
    patterns.push(p);
  }

  let round = 0;
  let phase = 'show';        // 'show' | 'answer' | 'settle'
  let t = 0;                 // ms within the phase
  let answer = [];
  let correct = 0;
  let total = 0;
  let finished = false;
  let lastFeedback = null;

  function beginAnswer() { phase = 'answer'; t = 0; answer = []; }
  function settleRound() {
    const want = patterns[round];
    for (let i = 0; i < want.length; i++) {
      total += 1;
      if (answer[i] === want[i]) correct += 1;
    }
    lastFeedback = answer.length === 0 ? 'missed' : 'placed';
    phase = 'settle';
    t = 0;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      t += dt;
      const pattern = patterns[round];

      if (phase === 'show') {
        if (t >= pattern.length * (showMs + GAP_MS)) beginAnswer();
        return;
      }

      if (phase === 'answer') {
        if (input && typeof input.padIndex === 'number') {
          answer.push(input.padIndex);
          if (answer.length >= pattern.length) { settleRound(); return; }
        }
        // Running out of time settles what you managed, rather than stalling for ever.
        if (t >= answerMs) settleRound();
        return;
      }

      if (phase === 'settle' && t >= 700) {
        round += 1;
        if (round >= ROUNDS) { finished = true; return; }
        phase = 'show'; t = 0;
      }
    },

    score() {
      if (total === 0) return 0;
      const s = correct / total;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, round / ROUNDS); },
    done() { return finished; },

    snapshot() {
      const pattern = patterns[round] || [];
      let lit = -1;
      if (phase === 'show') {
        const idx = Math.floor(t / (showMs + GAP_MS));
        const within = t - idx * (showMs + GAP_MS);
        if (idx < pattern.length && within < showMs) lit = pattern[idx];
      }
      return {
        pads: PADS,
        lit,
        phase,
        round: Math.min(round + 1, ROUNDS),
        rounds: ROUNDS,
        placed: answer.length,
        wanted: pattern.length,
        feedback: phase === 'settle' ? lastFeedback : null,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-pads');
  host.innerHTML = '';

  const grid = doc.createElement('div'); grid.className = 'grid';
  const colours = ['#f48ab0', '#7fd4f0', '#f7d43e', '#8ed653'];
  const pads = [];
  for (let i = 0; i < PADS; i++) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'pad';
    b.dataset.pad = String(i);
    b.style.background = colours[i];
    b.setAttribute('aria-label', `Decoration ${i + 1}`);
    grid.appendChild(b);
    pads.push(b);
  }
  const status = doc.createElement('span'); status.className = 'status';
  host.append(grid, status);

  let lastPhase = '';
  return {
    render(snap) {
      for (let i = 0; i < pads.length; i++) pads[i].classList.toggle('lit', i === snap.lit);
      const word = snap.phase === 'show'
        ? `Watch — pattern ${snap.round} of ${snap.rounds}`
        : snap.phase === 'answer'
          ? `Your turn — ${snap.placed} of ${snap.wanted} placed`
          : 'Nice — next pattern';
      status.textContent = word;
      if (ctx.announce && snap.phase !== lastPhase) { lastPhase = snap.phase; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-pads'); host.innerHTML = ''; },
  };
}
