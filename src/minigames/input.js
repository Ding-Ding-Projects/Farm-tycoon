// input.js — the eight input families.
//
// A family decides ONE thing: how a pointer or a key becomes the small normalised object a verb
// model is stepped with. It says nothing about what that object means — two verbs in the same
// family must still be different games.
//
// Keyboard parity lives HERE rather than in each verb, and that is the whole point of the file.
// A verb author cannot forget to support the keyboard, because they never touch input at all;
// they receive a shape. With a required-to-play gate, a verb that is mouse-only would be a verb
// that locks a keyboard-only player out of a recipe permanently.
//
// Every normaliser exposes the same tiny contract:
//   read()    -> the family's shape for this frame; consumes one-shot events (taps, fires)
//   destroy() -> removes every listener it added; safe to call twice

const FAMILIES = ['path', 'rhythm', 'sustain', 'balance', 'route', 'sequence', 'release', 'rate'];

export function isFamily(name) { return FAMILIES.includes(name); }
export function families() { return FAMILIES.slice(); }

/** Pointer position within `el`, normalised to 0..1 on both axes. */
function localPoint(el, ev) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return { x: 0.5, y: 0.5 };
  return {
    x: Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)),
  };
}

export function createInput(family, host, opts = {}) {
  const doc = host.ownerDocument;
  const lanes = Math.max(1, opts.lanes || 3);
  const listeners = [];
  function on(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    listeners.push([target, type, fn, options]);
  }

  // Shared mutable input state; each family reads the slice it cares about.
  let down = false;
  let x = 0.5, y = 0.5;
  let heldMs = 0, lastHeldAt = 0;
  let taps = [];
  let padIndex = null;
  let lane = 0, commit = false;
  let charge = 0, fired = false;
  let rate = 0;
  let keyCursorX = 0.5, keyCursorY = 0.5;

  host.tabIndex = 0; // focusable, so the keyboard path works without a mouse ever being used

  const isTapKey = (k) => k === ' ' || k === 'Enter' || k === 'Spacebar';

  on(host, 'pointerdown', (ev) => {
    down = true;
    const p = localPoint(host, ev);
    x = p.x; y = p.y;
    lastHeldAt = ev.timeStamp;
    taps.push({ tMs: ev.timeStamp });
    if (family === 'release') charge = 0;
    if (family === 'sequence') {
      const pad = ev.target && ev.target.closest && ev.target.closest('[data-pad]');
      if (pad) padIndex = Number(pad.dataset.pad);
    }
    if (family === 'route') lane = Math.min(lanes - 1, Math.floor(p.x * lanes));
    host.focus();
    ev.preventDefault();
  });

  on(doc, 'pointermove', (ev) => {
    const p = localPoint(host, ev);
    x = p.x; y = p.y;
    if (family === 'rate') rate = 1 - p.y;
  });

  on(doc, 'pointerup', (ev) => {
    if (down && family === 'release') fired = true;
    if (down && family === 'route') commit = true;
    down = false;
    lastHeldAt = ev.timeStamp;
  });

  on(host, 'keydown', (ev) => {
    const k = ev.key;
    if (isTapKey(k)) {
      if (!ev.repeat) taps.push({ tMs: ev.timeStamp });
      down = true;
      if (family === 'route') commit = true;
      ev.preventDefault();
      return;
    }
    if (k >= '1' && k <= '9') {
      const n = Number(k) - 1;
      if (family === 'sequence') padIndex = n;
      if (family === 'route') lane = Math.min(lanes - 1, n);
      ev.preventDefault();
      return;
    }
    const step = 0.06;
    if (k === 'ArrowLeft') { keyCursorX = Math.max(0, keyCursorX - step); ev.preventDefault(); }
    if (k === 'ArrowRight') { keyCursorX = Math.min(1, keyCursorX + step); ev.preventDefault(); }
    if (k === 'ArrowUp') { keyCursorY = Math.max(0, keyCursorY - step); ev.preventDefault(); }
    if (k === 'ArrowDown') { keyCursorY = Math.min(1, keyCursorY + step); ev.preventDefault(); }
    if (family === 'path' || family === 'balance') { x = keyCursorX; y = keyCursorY; down = true; }
    if (family === 'rate') {
      if (k === '[') { rate = Math.max(0, rate - 0.08); ev.preventDefault(); }
      if (k === ']') { rate = Math.min(1, rate + 0.08); ev.preventDefault(); }
    }
  });

  on(host, 'keyup', (ev) => {
    if (isTapKey(ev.key)) {
      if (family === 'release') fired = true;
      down = false;
    }
  });

  // A pointer released outside the window must not leave the model believing it is still held.
  on(doc, 'pointercancel', () => { down = false; });
  on(host, 'blur', () => { down = false; });

  return {
    read(dtMs = 0) {
      if (down) heldMs += dtMs; else heldMs = 0;
      switch (family) {
        case 'path': return { x, y, down };
        case 'rhythm': { const out = { taps }; taps = []; return out; }
        case 'sustain': return { held: down, heldMs };
        case 'balance': return { ax: (x - 0.5) * 2, ay: (y - 0.5) * 2 };
        case 'route': { const out = { lane, commit }; commit = false; return out; }
        case 'sequence': { const out = { padIndex }; padIndex = null; return out; }
        case 'release': {
          if (down) charge = Math.min(1, charge + dtMs / 900);
          const out = { charge, fired };
          if (fired) { fired = false; charge = 0; }
          return out;
        }
        case 'rate': return { rate };
        default: return null;
      }
    },
    destroy() {
      while (listeners.length) {
        const [t, type, fn, options] = listeners.pop();
        t.removeEventListener(type, fn, options);
      }
    },
  };
}
