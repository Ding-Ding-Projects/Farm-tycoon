// fold_shell.js — "Fold the Shell". The taco kitchen's playable item.
//
// Family: path, and the third one, so the distinction has to be real. whisk_batter cares about
// TEMPO (keep turning at an even rate). pipe_frosting cares about PRECISION and has no clock at
// all. This one has a SPEED LIMIT: the shell is brittle, and moving the fold faster than it can
// take cracks it. Going slowly is free; going quickly is the failure.
//
// So the three path verbs are: go at the right speed, go anywhere accurately, go as slowly as you
// like but never fast. Nothing here is a re-skin of the other two.

export const id = 'fold_shell';

const DURATION_MS = 13000;
const FOLDS = 3;

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
  const maxSpeed = assist ? 0.0022 : 0.0011;   // units of stage-space per ms
  const corridor = assist ? 0.20 : 0.12;

  const rng = mulberry32(seed);
  const folds = [];
  for (let i = 0; i < FOLDS; i++) folds.push(0.22 + i * 0.28 + rng() * 0.06);

  let elapsed = 0;
  let fold = 0;
  let along = 0;        // progress across the current fold, 0..1
  let cracks = 0;
  let clean = 0;
  let samples = 0;
  let lastY = null;
  let finished = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(1, dtMs || 0);
      elapsed += dt;

      if (input && input.down && fold < FOLDS) {
        const lineX = folds[fold];
        const onLine = Math.abs(input.x - lineX) <= corridor;
        if (lastY !== null) {
          const speed = Math.abs(input.y - lastY) / dt;
          if (onLine) {
            if (speed > maxSpeed) { cracks += 1; }       // too quick: the shell splits
            else { clean += 1; along = Math.min(1, along + Math.abs(input.y - lastY)); }
            samples += 1;
          }
        }
        lastY = input.y;
        if (along >= 0.9) { fold += 1; along = 0; lastY = null; }
      } else {
        lastY = null;
      }

      if (fold >= FOLDS || elapsed >= limitMs) finished = true;
    },

    score() {
      const done = fold / FOLDS;
      const gentleness = samples === 0 ? 0 : clean / samples;
      const s = done * 0.6 + gentleness * 0.4;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, (fold + along) / FOLDS); },
    done() { return finished; },

    snapshot() {
      return {
        folds, fold: Math.min(fold, FOLDS - 1), foldsDone: fold, total: FOLDS,
        along, cracks, corridor,
        cracking: cracks > 0 && samples > 0 && cracks / samples > 0.25,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-fold');
  host.innerHTML = '';

  const shell = doc.createElement('div'); shell.className = 'shell';
  const line = doc.createElement('span'); line.className = 'foldline';
  const seam = doc.createElement('span'); seam.className = 'seam';
  shell.append(line, seam);
  const status = doc.createElement('span'); status.className = 'status';
  host.append(shell, status);

  let lastWord = '';
  return {
    render(snap) {
      line.style.left = `${Math.round(snap.folds[snap.fold] * 100)}%`;
      line.style.width = `${Math.round(snap.corridor * 2 * 100)}%`;
      seam.style.height = `${Math.round(snap.along * 100)}%`;
      seam.style.left = `${Math.round(snap.folds[snap.fold] * 100)}%`;
      const word = snap.cracking ? 'Cracking - fold it slower'
        : `Fold ${Math.min(snap.foldsDone + 1, snap.total)} of ${snap.total} - slow and steady`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-fold'); host.innerHTML = ''; },
  };
}
