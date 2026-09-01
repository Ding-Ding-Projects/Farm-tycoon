// skim_curds.js — "Skim the Curds". The dairy's playable item.
//
// Family: path, and the fourth. whisk_batter is tempo, pipe_frosting is precision with no clock,
// fold_shell is a speed limit. This is a SWEEP that must not double back: the curds gather ahead
// of the paddle, and passing over the same water twice pushes them apart again. You get one clean
// pass across each band, in whatever direction you choose, and reversing undoes work.
//
// Precision verbs ask you to be somewhere. This one asks you never to be somewhere twice.

export const id = 'skim_curds';

const BANDS = 4;
const DURATION_MS = 13000;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const bandHeight = 1 / BANDS;
  // Assist forgives a little backtracking; it does not remove the rule.
  const slack = assist ? 0.06 : 0.015;

  let elapsed = 0;
  let band = 0;
  let swept = 0;        // furthest x reached on this band, 0..1
  let dir = 0;          // +1 sweeping right, -1 sweeping left, 0 not yet started
  let gathered = 0;     // bands completed cleanly
  let spoiled = 0;      // bands where the paddle doubled back
  let dirty = false;    // this band has been backtracked
  let lastX = null;
  let finished = false;

  function nextBand(ok) {
    if (ok && !dirty) gathered += 1; else spoiled += 1;
    band += 1;
    swept = 0; dir = 0; dirty = false; lastX = null;
    if (band >= BANDS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.down) {
        const inBand = Math.abs(input.y - (band + 0.5) * bandHeight) <= bandHeight * 0.6;
        if (inBand) {
          if (lastX !== null) {
            const delta = input.x - lastX;
            if (Math.abs(delta) > 1e-4) {
              const d = Math.sign(delta);
              if (dir === 0) dir = d;
              else if (d !== dir && Math.abs(delta) > slack) dirty = true; // doubled back
              if (d === dir) swept += Math.abs(delta);
            }
          }
          lastX = input.x;
          if (swept >= 0.86) nextBand(true);
        }
      } else {
        lastX = null;
      }

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const s = gathered / BANDS - Math.min(0.25, spoiled * 0.06);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, (band + swept) / BANDS); },
    done() { return finished; },

    snapshot() {
      return {
        bands: BANDS,
        band: Math.min(band, BANDS - 1),
        bandHeight,
        swept,
        dir,
        dirty,
        gathered,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-skim');
  host.innerHTML = '';

  const vat = doc.createElement('div');
  vat.className = 'vat';
  const rows = [];
  for (let i = 0; i < BANDS; i++) {
    const r = doc.createElement('span');
    r.className = 'band';
    r.style.top = `${(i / BANDS) * 100}%`;
    r.style.height = `${(1 / BANDS) * 100}%`;
    const fill = doc.createElement('span');
    fill.className = 'gathered';
    r.appendChild(fill);
    vat.appendChild(r);
    rows.push({ r, fill });
  }
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(vat, status);

  let lastWord = '';
  return {
    render(snap) {
      for (let i = 0; i < rows.length; i++) {
        rows[i].r.classList.toggle('current', i === snap.band);
        rows[i].r.classList.toggle('done', i < snap.band);
        rows[i].fill.style.width = i === snap.band ? `${Math.round(snap.swept * 100)}%` : (i < snap.band ? '100%' : '0%');
      }
      const word = snap.dirty ? 'Doubled back - the curds have spread again'
        : `Band ${snap.band + 1} of ${snap.bands} - one clean sweep, do not reverse`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-skim'); host.innerHTML = ''; },
  };
}
