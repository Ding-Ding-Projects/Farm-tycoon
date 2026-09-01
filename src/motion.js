// motion.js — one answer to "does this player want less movement", for the whole game.
//
// styles.css has honoured prefers-reduced-motion since early on, with a blanket rule that flattens
// every CSS animation and transition. That covers the chrome and nothing else, because the world
// is a CANVAS: the machinery turning on every working factory, the coin bursts, the XP floaters,
// the harvest sparkles and the camera easing are all drawn frame by frame in JavaScript, where no
// stylesheet can reach them. So the setting appeared to be respected while the largest moving
// surface in the game ignored it completely. Only the minigame shell read it, and only for itself.
//
// Read once and cached, with a listener, because matchMedia is cheap to query but not free and the
// renderer asks per frame. The listener matters more than the caching: a player who turns the
// setting on mid-session should see the game settle immediately rather than at the next reload,
// which is exactly when somebody reaches for it.
//
// NOTHING here removes information. A factory that is working must still LOOK like it is working
// with the animation off - the repo's own rule that a state may never be signalled by colour alone
// applies just as much to motion alone. See sprites.js, which draws the machinery in its
// mid-stroke position rather than hiding it.

let reduced = false;
let query = null;

/** Wire up to the platform's preference. Safe to call more than once, and a no-op under Node. */
export function init() {
  const w = typeof window !== 'undefined' ? window : null;
  if (!w || typeof w.matchMedia !== 'function') return;
  query = w.matchMedia('(prefers-reduced-motion: reduce)');
  reduced = !!query.matches;
  const onChange = (ev) => { reduced = !!ev.matches; };
  // addEventListener is the current API; addListener is the deprecated one some older engines
  // still only have. Trying both costs two lines and avoids a silent no-op on the older ones.
  if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
  else if (typeof query.addListener === 'function') query.addListener(onChange);
}

/** True when the player has asked the platform for less movement. */
export function isReduced() { return reduced; }

/**
 * A time value for animation phase. Returns a FIXED instant under reduced motion, so anything
 * driven by it renders in a consistent mid-stroke pose instead of cycling - visible, legible, and
 * still. Callers do not need to branch; they pass this instead of `now`.
 */
export function phase(now) { return reduced ? 0 : now; }

/**
 * How far to move toward a target this frame. Easing becomes an immediate snap under reduced
 * motion, which is the honest reading of the preference for a camera: the player still gets where
 * they asked to go, without the glide.
 */
export function ease(factor) { return reduced ? 1 : factor; }

/** Test seam. The renderer and effects have no other way to be driven from Node. */
export function __setReducedForTests(v) { reduced = !!v; }
