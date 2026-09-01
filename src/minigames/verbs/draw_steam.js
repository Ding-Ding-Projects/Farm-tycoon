// draw_steam.js — "Draw the Steam". The coffee kiosk's playable item.
//
// Family: sustain, and the third. mind_oven is a band you sit inside; boil_size is a ceiling you
// creep up on and must not cross. This one has a band AND a hazard that sweeps through it: the
// milk scalds in bursts, and while a burst is passing you have to LET GO and lose ground, then
// build it back. The correct value is known the whole time and is periodically forbidden.
//
// The other two reward holding steady. This one punishes it, which is as different as two verbs
// in one family can be.

export const id = 'draw_steam';

const DURATION_MS = 14000;

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 2 : 1);
  const halfBand = assist ? 0.18 : 0.11;
  const scaldEvery = assist ? 4200 : 3000;   // ms between bursts
  const scaldFor = assist ? 380 : 520;       // ms each burst lasts

  const rng = mulberry32(seed);
  const offset = rng() * scaldEvery;
  const centre = 0.52 + rng() * 0.14;

  let elapsed = 0;
  let pressure = 0.1;
  let drawn = 0;      // time spent correctly in band while safe
  let safe = 0;       // time during which drawing was possible at all
  let scalded = 0;    // time spent holding through a burst
  let samples = 0;
  let finished = false;

  // The burst is TELEGRAPHED. Without a warning the verb demands frame-perfect reaction: the
  // moment scalding begins you are already in the band, already being punished, with no way to
  // have acted sooner. Measured that way, careful play scored 0.17-0.63 and was mostly luck.
  // With a warning it becomes anticipation, which is a skill a player can actually learn.
  const WARN_MS = 620;
  const phase = (t) => (t + offset) % scaldEvery;
  const scalding = (t) => phase(t) < scaldFor;
  const warning = (t) => !scalding(t) && phase(t) > scaldEvery - WARN_MS;
  // And a matching grace AFTER the burst. The player was told to come off, so the pressure they
  // lost doing as they were told must not then be charged to them on the way back up. Warning and
  // recovery are the same principle at both ends: only time you could actually have been drawing
  // counts toward the score.
  const RECOVER_MS = 700;
  const recovering = (t) => !scalding(t) && phase(t) >= scaldFor && phase(t) < scaldFor + RECOVER_MS;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;
      const secs = dt / 1000;

      const held = !!(input && input.held);
      pressure += held ? 0.95 * secs : -0.75 * secs;
      pressure = Math.max(0, Math.min(1, pressure));

      const burst = scalding(elapsed);
      const inBand = Math.abs(pressure - centre) <= halfBand;

      if (burst) {
        // During a burst the band is forbidden: being in it costs, being out of it is correct.
        // Holding through a burst does not merely fail to score: it scalds what you already
        // drew. Measured before this, ignoring the hazard outscored respecting it (0.540 against
        // 0.487), which meant the hazard was decoration. A mechanic the best strategy ignores is
        // not a mechanic.
        if (inBand) { scalded += 1; drawn = Math.max(0, drawn - 5); }
      } else if (!warning(elapsed) && !recovering(elapsed)) {
        // Only SAFE time is scoreable, and the warning window is not safe time either: a player
        // coming off the band because they were told to must not be marked down for it. Counting
        // burst or warning time in the denominator would cap even perfect play well below 1
        // through no fault of the player.
        if (inBand) drawn += 1;
        safe += 1;
      }
      samples += 1;

      if (elapsed >= limitMs) finished = true;
    },

    score() {
      if (safe === 0) return 0;
      const s = drawn / safe;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, elapsed / limitMs); },
    done() { return finished; },

    snapshot() {
      const burst = scalding(elapsed);
      return {
        pressure,
        bandLow: Math.max(0, centre - halfBand),
        bandHigh: Math.min(1, centre + halfBand),
        scalding: burst,
        warning: warning(elapsed),
        inBand: Math.abs(pressure - centre) <= halfBand,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-gauge');
  host.innerHTML = '';

  const column = doc.createElement('div'); column.className = 'column';
  const band = doc.createElement('span'); band.className = 'band';
  const level = doc.createElement('span'); level.className = 'level';
  const needle = doc.createElement('span'); needle.className = 'needle';
  column.append(band, level, needle);

  const side = doc.createElement('div');
  side.style.flex = '1';
  const status = doc.createElement('span');
  status.className = 'status';
  side.appendChild(status);
  host.append(column, side);

  let lastWord = '';
  return {
    render(snap) {
      level.style.height = `${Math.round(snap.pressure * 100)}%`;
      needle.style.bottom = `${Math.round(snap.pressure * 100)}%`;
      band.style.bottom = `${Math.round(snap.bandLow * 100)}%`;
      band.style.height = `${Math.round((snap.bandHigh - snap.bandLow) * 100)}%`;
      // The hazard is spelled out in words, never signalled by colour alone.
      band.style.opacity = snap.scalding ? '0.25' : '1';
      const word = snap.scalding ? 'Scalding - come off the band'
        : snap.warning ? 'About to scald - ease off now'
        : snap.inBand ? 'Drawing well - hold it' : 'Build the pressure back';
      status.textContent = word;
      if (ctx.announce && word !== lastWord) { lastWord = word; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-gauge'); host.innerHTML = ''; },
  };
}
