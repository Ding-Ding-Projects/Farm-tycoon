// Farm Tycoon — daylight.js
// The light over the farm as a function of the player's own clock. Pure and DOM-free: the
// renderer paints whatever this returns and tools/test-render.mjs samples it directly.
//
//   lightingFor(now, enabled) → {} when the cycle is off (the renderer then paints PALETTE's
//   fixed golden hour, exactly the look the game had before the cycle existed), otherwise
//   { sun, vignette, haze, night, phase }:
//     sun      rgba() string for the warm radial wash from the top right
//     vignette rgba() string for the edge darkening
//     haze     rgba() string for the cool distance haze over the top of the viewport
//     night    0..1, how deep into night the farm is. Buildings light their windows and lamps
//              glow above 0.3; the renderer's night overlay is night × NIGHT_MAX_ALPHA, so the
//              farm never drops below ~70% brightness and stays readable.
//     phase    'night' | 'dawn' | 'day' | 'dusk'
//
// Keyframes are in local hours and interpolated linearly, wrapping at midnight, so nothing ever
// jumps. The clock is sampled at whole minutes: the renderer caches its lighting layer by colour,
// so that is one repaint a minute rather than one a frame.

export const NIGHT_MAX_ALPHA = 0.3;
export const NIGHT_TINT = [18, 26, 70];

// [hour, sun, vignette, haze, night, phase] — colours as [r, g, b, a].
const KEYFRAMES = [
  [0.0, [150, 180, 255, 0.10], [10, 16, 48, 0.50], [120, 150, 220, 0.14], 1.00, 'night'],
  [4.5, [150, 180, 255, 0.10], [10, 16, 48, 0.50], [120, 150, 220, 0.14], 1.00, 'night'],
  [6.5, [255, 170, 140, 0.30], [80, 50, 90, 0.36], [200, 190, 230, 0.18], 0.15, 'dawn'],
  [8.5, [255, 225, 170, 0.18], [72, 44, 14, 0.24], [170, 205, 240, 0.14], 0.00, 'day'],
  [12.0, [255, 245, 220, 0.12], [72, 44, 14, 0.20], [180, 210, 240, 0.12], 0.00, 'day'],
  [16.0, [255, 220, 150, 0.22], [72, 44, 14, 0.28], [180, 200, 235, 0.13], 0.00, 'day'],
  [18.0, [255, 196, 104, 0.34], [72, 44, 14, 0.38], [220, 180, 190, 0.14], 0.00, 'dusk'],
  [19.5, [255, 150, 110, 0.26], [50, 30, 60, 0.42], [160, 140, 200, 0.16], 0.35, 'dusk'],
  [21.0, [150, 180, 255, 0.10], [10, 16, 48, 0.50], [120, 150, 220, 0.14], 1.00, 'night'],
  [24.0, [150, 180, 255, 0.10], [10, 16, 48, 0.50], [120, 150, 220, 0.14], 1.00, 'night'],
];

function mix(a, b, t) { return a + (b - a) * t; }
function rgba(c) {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
}
function mixColor(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)]; }

/** Local clock hour (0..24) of a timestamp, at whole-minute resolution. */
export function hourOf(now = Date.now()) {
  const d = new Date(now);
  return d.getHours() + d.getMinutes() / 60;
}

/** The light at a given local hour (0..24, wrapping). Pure: this is what the tests sample. */
export function lightingAtHour(hour) {
  let h = Number.isFinite(hour) ? hour % 24 : 12;
  if (h < 0) h += 24;
  let i = 0;
  while (i < KEYFRAMES.length - 2 && KEYFRAMES[i + 1][0] <= h) i++;
  const A = KEYFRAMES[i], B = KEYFRAMES[i + 1];
  const t = Math.max(0, Math.min(1, (h - A[0]) / (B[0] - A[0])));
  const night = Math.max(0, Math.min(1, mix(A[4], B[4], t)));
  return {
    sun: rgba(mixColor(A[1], B[1], t)),
    vignette: rgba(mixColor(A[2], B[2], t)),
    haze: rgba(mixColor(A[3], B[3], t)),
    night,
    phase: t < 0.5 ? A[5] : B[5],
  };
}

/** The light for a wall-clock timestamp, or {} when the day/night cycle is switched off. */
export function lightingFor(now = Date.now(), enabled = true) {
  if (!enabled) return {};
  return lightingAtHour(hourOf(now));
}
