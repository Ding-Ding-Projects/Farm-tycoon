// audio.js — WebAudio-synthesised SFX. No audio files, ever.
// A single shared AudioContext is created lazily on the first user gesture (browsers refuse
// to start one before that), then every sound below is a short synthesised blip/sweep/chord
// built from oscillators + a gain envelope. Respects state.settings.sound.

import { state } from './state.js';

let ctx = null;
let unlocked = false;

/** Create/resume the shared AudioContext. Call from the first pointer/key gesture. */
export function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Resume a suspended context (autoplay policy) — call again on later gestures if needed. */
export function unlock() {
  if (!ctx) init();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  unlocked = true;
}

function enabled() {
  return !!ctx && !!state && state.settings?.sound !== false;
}

/** One oscillator with an ADSR-ish envelope. freq may be a [start,end] sweep. */
function tone(freq, { duration = 0.14, type = 'sine', gain = 0.18, delay = 0 } = {}) {
  if (!enabled()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  if (Array.isArray(freq)) {
    osc.frequency.setValueAtTime(freq[0], t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq[1]), t0 + duration);
  } else {
    osc.frequency.setValueAtTime(freq, t0);
  }
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.015, duration / 4));
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function chord(freqs, opts) {
  for (const f of freqs) tone(f, opts);
}

/** UI tap — soft short click. */
export function click() { tone(880, { duration: 0.05, type: 'triangle', gain: 0.12 }); }
/** A panel/sheet opening — gentle upward sweep. */
export function open() { tone([440, 660], { duration: 0.12, type: 'sine', gain: 0.14 }); }
/** A panel/sheet closing — gentle downward sweep. */
export function close() { tone([520, 340], { duration: 0.1, type: 'sine', gain: 0.12 }); }
/** Planting a seed — soft pluck. */
export function plant() { tone([300, 500], { duration: 0.09, type: 'triangle', gain: 0.14 }); }
/** Harvesting — bright pop + sparkle. */
export function harvest() {
  tone([500, 900], { duration: 0.1, type: 'sine', gain: 0.16 });
  tone(1400, { duration: 0.08, type: 'sine', gain: 0.08, delay: 0.05 });
}
/** Coins earned — classic two-note coin jingle. */
export function coin() {
  tone(988, { duration: 0.08, type: 'square', gain: 0.1 });
  tone(1319, { duration: 0.12, type: 'square', gain: 0.1, delay: 0.06 });
}
/** Diamond/reward gained — sparkly chord. */
export function reward() { chord([784, 988, 1175], { duration: 0.22, type: 'sine', gain: 0.09 }); }
/** Level up — ascending fanfare. */
export function levelUp() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, { duration: 0.18, type: 'triangle', gain: 0.13, delay: i * 0.08 }));
}
/** Something completed / ready (timer ding). */
export function ready() { tone([660, 990], { duration: 0.14, type: 'sine', gain: 0.14 }); }
/** Building/placing an object — soft thud + confirm. */
export function place() { tone([220, 260], { duration: 0.1, type: 'square', gain: 0.1 }); }
/** Error / can't-do-that buzz. */
export function error() { tone(140, { duration: 0.18, type: 'sawtooth', gain: 0.1 }); }
/** Order fulfilled — happy double chime. */
export function orderComplete() {
  tone(880, { duration: 0.1, type: 'sine', gain: 0.14 });
  tone(1175, { duration: 0.16, type: 'sine', gain: 0.14, delay: 0.09 });
}
/** Animal feed / collect. */
export function animal() { tone([400, 300], { duration: 0.1, type: 'triangle', gain: 0.12 }); }
/** Vehicle departs (truck/train/boat/plane). */
export function depart() { tone([200, 120], { duration: 0.3, type: 'sawtooth', gain: 0.07 }); }
/** Merge Meadow: tiles merging. */
export function merge() { tone([600, 1000], { duration: 0.12, type: 'sine', gain: 0.13 }); }
/** Fishing: cast / reel-in success. */
export function fishSplash() { tone([300, 180], { duration: 0.14, type: 'sine', gain: 0.1 }); }
/** Achievement / milestone unlocked. */
export function achievementUnlocked() { chord([523, 659, 784, 1047], { duration: 0.25, type: 'triangle', gain: 0.08 }); }
