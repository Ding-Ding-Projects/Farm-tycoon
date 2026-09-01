// roll_press.js — "Press the Sheet". The paper mill's playable item.
//
// Family: dual, and the second one, so the difference has to be real. throw_shuttles asks you to
// hold two values that DRIFT APART, so the work is chasing two moving marks. This asks you to
// hold two rollers in BALANCE with each other: there is no target position at all, only a
// difference that must stay near zero while the pair as a whole is driven upward.
//
// One is "follow two things", the other is "keep two things equal while pushing both". A player
// doing the second cannot use the strategy that works for the first.

export const id = 'roll_press';

const DURATION_MS = 13000;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.8 : 1);
  const skewTol = assist ? 0.26 : 0.13;   // how far apart the rollers may sit

  let elapsed = 0;
  let pressed = 0;      // how much sheet has gone through
  let even = 0;
  let samples = 0;
  let torn = 0;
  let finished = false;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const l = input && typeof input.left === 'number' ? input.left : 0;
      const r = input && typeof input.right === 'number' ? input.right : 0;
      const skew = Math.abs(l - r);
      const drive = Math.min(l, r);   // the sheet only advances as fast as the SLOWER roller

      if (drive > 0.05) {
        if (skew <= skewTol) even += 1;
        else if (skew > skewTol * 2) torn += 1;   // badly uneven and the sheet tears
        samples += 1;
        pressed = Math.min(1, pressed + drive * (dt / 1000) * 0.13);
      }

      if (pressed >= 1 || elapsed >= limitMs) finished = true;
    },

    score() {
      if (samples === 0) return 0;
      const evenness = even / samples;
      const s = evenness * 0.55 + pressed * 0.45 - Math.min(0.3, (torn / samples) * 0.6);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return pressed; },
    done() { return finished; },

    snapshot() { return { pressed, skewTol, tearing: samples > 0 && torn / samples > 0.25 }; },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-dual');
  host.innerHTML = '';
  const mk = (cls) => { const c = doc.createElement('div'); c.className = `rail ${cls}`; return c; };
  const L = mk('left'), R = mk('right');
  const status = doc.createElement('span'); status.className = 'status';
  host.append(L, status, R);
  let lastWord = '';
  return {
    render(snap) {
      const word = snap.tearing ? 'Tearing - even the rollers up'
        : `Pressing ${Math.round(snap.pressed * 100)}% - keep both level and push`;
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-dual'); host.innerHTML = ''; },
  };
}
