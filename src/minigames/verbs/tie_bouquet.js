// tie_bouquet.js — "Tie the Bouquet". The flower shop's playable item.
//
// Family: rhythm. The model sees {taps} — discrete impulses with timestamps, and nothing about
// where they landed. Twine goes round the stems on a beat; each turn wants to fall on the beat,
// and the beat quietly speeds up as the binding tightens.
//
// The only verb scored purely on WHEN. No target, no position, no magnitude — a tap is a tap,
// and all that matters is how close it fell to the metronome.

export const id = 'tie_bouquet';

const TURNS = 10;
const START_INTERVAL_MS = 720;
const TIGHTEN = 0.965;   // each turn comes a little sooner than the last

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const window_ = assist ? 260 : 150;      // how far off the beat still counts
  const tighten = assist ? 1 : TIGHTEN;    // assist keeps the tempo steady rather than speeding

  // Beat times are derived up front, so the whole pattern is a pure function of nothing but the
  // constants — two runs of this verb are identical by construction.
  const beats = [];
  let at = START_INTERVAL_MS;
  let interval = START_INTERVAL_MS;
  for (let i = 0; i < TURNS; i++) {
    beats.push(at);
    interval *= tighten;
    at += interval;
  }
  const endsAt = at + 400;

  let elapsed = 0;
  let next = 0;          // index of the next unjudged beat
  let hits = 0;
  let closeness = 0;     // summed 0..1 accuracy over hit beats
  let finished = false;
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      const taps = (input && Array.isArray(input.taps)) ? input.taps.length : 0;
      for (let i = 0; i < taps; i++) {
        if (next >= beats.length) break;
        // Judge against the nearest unjudged beat, using elapsed rather than the tap's own
        // timestamp: the model owns one clock, and mixing two is how timing games drift.
        const off = Math.abs(elapsed - beats[next]);
        if (off <= window_) {
          hits += 1;
          closeness += 1 - off / window_;
          lastResult = 'tied';
        } else {
          lastResult = 'slipped';
        }
        next += 1;
      }

      // Beats you never answered pass by on their own; the binding does not wait.
      while (next < beats.length && elapsed > beats[next] + window_) {
        next += 1;
        lastResult = 'slipped';
      }

      if (elapsed >= endsAt) finished = true;
    },

    score() {
      const s = closeness / TURNS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, next / TURNS); },
    done() { return finished; },

    snapshot() {
      const target = beats[Math.min(next, beats.length - 1)];
      const untilBeat = target - elapsed;
      return {
        turns: next,
        total: TURNS,
        hits,
        // 1 exactly on the beat, falling away either side — drives the pulse in the view.
        pulse: Math.max(0, 1 - Math.min(1, Math.abs(untilBeat) / 320)),
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
  const wraps = [];
  for (let i = 0; i < TURNS; i++) {
    const w = doc.createElement('span');
    w.className = 'wrap';
    stems.appendChild(w);
    wraps.push(w);
  }

  const beat = doc.createElement('div'); beat.className = 'beat';
  const status = doc.createElement('span'); status.className = 'status';
  host.append(stems, beat, status);

  let announced = -1;
  return {
    render(snap) {
      for (let i = 0; i < wraps.length; i++) wraps[i].classList.toggle('tied', i < snap.hits);
      beat.style.transform = `scale(${(0.72 + snap.pulse * 0.45).toFixed(3)})`;
      beat.style.opacity = (0.45 + snap.pulse * 0.55).toFixed(2);
      status.textContent = `${snap.hits} of ${snap.total} turns tied`;
      if (ctx.announce && snap.turns !== announced) {
        announced = snap.turns;
        ctx.announce(`${snap.hits} of ${snap.total} tied`);
      }
    },
    unmount() { host.classList.remove('stage-rhythm'); host.innerHTML = ''; },
  };
}
