// dip_wick.js — "True the Wick". The candle maker's playable item.
//
// Family: rhythm, and the second one. tie_bouquet is a METRONOME: one beat, hit it, and it speeds
// up. This is a PATTERN: dip, dip, rest, in threes, and the rest is as much a part of it as the
// dips are. Tapping through the rest ruins the candle exactly as surely as missing a dip does.
//
// So one verb asks "can you keep time", and this one asks "can you keep a shape". A player who
// simply taps on every beat scores badly here, which is the test that they are different games.

export const id = 'dip_wick';

const PATTERN = [1, 1, 0, 1, 1, 0, 1, 1, 0];   // 1 = dip, 0 = rest
const BEAT_MS = 620;

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const beat = BEAT_MS * (assist ? 1.7 : 1);
  const window_ = assist ? 240 : 140;

  let elapsed = 0;
  let index = 0;          // which slot of the pattern we are judging
  let correct = 0;
  let wrong = 0;
  let answered = false;   // did a tap land in the current slot
  let finished = false;
  let lastResult = null;

  function closeSlot() {
    const want = PATTERN[index] === 1;
    if (want === answered) { correct += 1; lastResult = want ? 'dipped' : 'rested'; }
    else { wrong += 1; lastResult = want ? 'missed a dip' : 'dipped on the rest'; }
    index += 1;
    answered = false;
    if (index >= PATTERN.length) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      const taps = (input && Array.isArray(input.taps)) ? input.taps.length : 0;
      if (taps > 0) {
        const centre = index * beat + beat / 2;
        if (Math.abs(elapsed - centre) <= window_ || PATTERN[index] === 0) answered = true;
      }

      while (!finished && elapsed >= (index + 1) * beat) closeSlot();
    },

    score() {
      const s = correct / PATTERN.length;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, index / PATTERN.length); },
    done() { return finished; },

    snapshot() {
      return {
        pattern: PATTERN, index: Math.min(index, PATTERN.length - 1),
        slot: PATTERN[Math.min(index, PATTERN.length - 1)],
        correct, wrong, total: PATTERN.length,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-rhythm');
  host.innerHTML = '';
  const stems = doc.createElement('div'); stems.className = 'stems';
  const cells = PATTERN.map(() => { const w = doc.createElement('span'); w.className = 'wrap'; stems.appendChild(w); return w; });
  const beat = doc.createElement('div'); beat.className = 'beat';
  const status = doc.createElement('span'); status.className = 'status';
  host.append(stems, beat, status);
  let lastWord = '';
  return {
    render(snap) {
      for (let i = 0; i < cells.length; i++) {
        cells[i].classList.toggle('tied', i < snap.index);
        cells[i].style.opacity = snap.pattern[i] === 1 ? '1' : '0.35';
      }
      beat.style.opacity = snap.slot === 1 ? '1' : '0.3';
      const word = snap.slot === 1 ? 'Dip' : 'Rest - do not tap';
      status.textContent = `${word} - ${snap.correct} of ${snap.total} right`;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-rhythm'); host.innerHTML = ''; },
  };
}
