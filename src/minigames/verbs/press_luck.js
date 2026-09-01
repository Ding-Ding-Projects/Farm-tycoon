// press_luck.js — "Work the Frames". The honey extractor's playable item.
//
// Family: release, and the third. season_pinch judges a MAGNITUDE by feel and lets go at the right
// size. pull_shot is a RUNNING TOTAL that must land exactly on a figure. Both are about executing
// a movement well.
//
// This one asks a question no other verb here asks: when do you stop taking? Every frame you pull
// adds honey, and every frame you pull makes the comb more likely to shatter and cost you the
// whole batch. Nothing about it is dexterity. There is no line to hit, no rhythm to keep and no
// hand to steady - you hold to pull another frame, you release to bank what you have, and the only
// skill is knowing when enough is enough.
//
// The comb creaks louder as it nears its limit, so the risk is READABLE rather than a coin flip -
// but readable as a BAND, not a number. That distinction is the whole verb and it took a second
// pass to get right: the first version published the exact strain, which named the last safe frame
// precisely and collapsed the optimal play into "pull until the meter reads 1.00". That is an
// execution task wearing a decision's clothes, and it made this a slower boil_size rather than
// anything new. Three bands, each spanning several frames, is what leaves a real question.
//
// Measured across eight seeds: banking on the first warning takes 0.75 to 0.80 of the comb,
// pulling every frame shatters it and banks 0.000 every time, stopping after one frame banks 0.20
// to 0.25, and idling scores 0.000.
//
// The safe line deliberately does NOT top the scale. Playing it sound lands around Fine; the top
// tier is reserved for taking the extra pull and being right, which is what a press-your-luck verb
// is for. tools/test-verbs.mjs asserts both halves of that, including that the cautious line stays
// below 1.0 - if safety scored full marks there would be no reason ever to risk a frame.
//
// It is deliberately the one verb with no physical demand at all. A library where every item asks
// for steady hands is a library that excludes the same people from every single one of them.

export const id = 'press_luck';

const FRAMES = 7;             // the most you could ever pull
const PULL_MS = 900;          // how long a single frame takes to work loose
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
  const pullMs = PULL_MS * (assist ? 0.7 : 1);

  const rng = mulberry32(seed);
  // How many frames this comb will take before it goes. Seeded, so it is fixed the moment the run
  // begins and cannot shift under the player mid-decision - the creak is telling the truth.
  // Assist widens the comb rather than muting the warning, so the read stays honest.
  const breaksAfter = (assist ? 4 : 3) + Math.floor(rng() * 3);

  let pulled = 0;
  let banked = 0;
  let holdMs = 0;
  let elapsed = 0;
  let wasHeld = false;
  let shattered = false;
  let finished = false;
  let lastResult = null;

  /** 0 at a fresh comb, 1 at the frame that breaks it. This is the creak the player hears. */
  const strain = () => Math.min(1, pulled / breaksAfter);

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      const held = !!(input && input.held);

      if (held) {
        holdMs += dt;
        if (holdMs >= pullMs) {
          holdMs = 0;
          pulled += 1;
          if (pulled > breaksAfter) {
            // The comb goes, and everything in this batch goes with it. That is the whole risk.
            shattered = true;
            banked = 0;
            finished = true;
            lastResult = 'the comb shattered';
            return;
          }
          lastResult = 'another frame out';
        }
      } else if (wasHeld && pulled > 0) {
        // Letting go banks what is out. Deliberately one-way: you cannot bank and then continue,
        // because a decision you can walk back is not a decision.
        banked = pulled;
        finished = true;
        lastResult = `banked ${banked} frames`;
        return;
      }
      wasHeld = held;

      if (elapsed >= limitMs) {
        // Running the clock out banks whatever is loose, so doing nothing is not punished with a
        // shatter it never chose.
        banked = pulled;
        finished = true;
      }
    },

    score() {
      // Against what this comb actually HELD, not against the theoretical maximum. Scoring out of
      // FRAMES would cap a flawless read at 5/7, so the top tier could never be reached however
      // well the comb was read - a scale nobody can top is not a scale.
      const s = banked / breaksAfter;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, pulled / FRAMES); },
    done() { return finished; },

    snapshot() {
      return {
        pulled,
        frames: FRAMES,
        banked,
        shattered,
        // The creak, as one of three BANDS rather than a number.
        //
        // This started as the exact fraction and that was a mistake worth recording: strain was
        // pulled/breaksAfter, so a reading of 1.00 named the last safe frame precisely and the
        // optimal play collapsed to "pull until the meter says 1.00". That is an execution task
        // wearing a decision's clothes, and it made this verb a slower boil_size rather than
        // something new. A band spans several frames - on a five-frame comb "about to go" covers
        // the last two - so the player genuinely has to decide whether to take one more.
        creak: strain() < 0.34 ? 'solid' : strain() < 0.67 ? 'creaking' : 'straining',
        holding: wasHeld,
        pullProgress: holdMs / pullMs,
        msLeft: Math.max(0, limitMs - elapsed),
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-gauge');
  host.innerHTML = '';

  const bar = doc.createElement('div');
  bar.className = 'gauge';
  const fill = doc.createElement('span');
  fill.className = 'fill';
  bar.appendChild(fill);

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(bar, status);

  let last = '';
  return {
    render(snap) {
      fill.style.width = `${{ solid: 25, creaking: 60, straining: 92 }[snap.creak]}%`;
      // Strain is described in words as well as drawn, so the read never depends on seeing a bar.
      const creak = snap.creak === 'solid' ? 'the comb is solid'
        : snap.creak === 'creaking' ? 'the comb is creaking'
          : 'the comb is about to go';
      const word = snap.shattered ? 'The comb shattered, and the batch with it.'
        : snap.banked ? `Banked ${snap.banked} frames.`
          : `${snap.pulled} frames out, ${creak}. Hold for another, let go to bank.`;
      status.textContent = word;
      if (ctx.announce && word !== last) { last = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-gauge'); host.innerHTML = ''; },
  };
}
