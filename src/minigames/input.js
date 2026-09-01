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

// The twelve grammars. Each is a genuinely different way a hand moves, and that is the real
// ceiling on how many DISTINCT games can exist: two verbs inside one family can differ, but
// eventually they start to rhyme. Adding a family raises the ceiling instead of grinding against
// it, and it is deliberately more work than adding a verb, because it should be.
//
//   path      a point you move             rhythm    when you tap
//   sustain   how long you hold            balance   a point you keep centred
//   route     which of N you pick          sequence  which pad, in order
//   release   how big, then let go         rate      how far open, continuously
//   aim       direction AND power, committed together as one shot
//   dual      two independent values held at once, one per side
//   steer     a moving thing kept on course while you keep it going
//   drag      pick a thing up, carry it, set it down somewhere
const FAMILIES = [
  'path', 'rhythm', 'sustain', 'balance', 'route', 'sequence', 'release', 'rate',
  'aim', 'dual', 'steer', 'drag',
];

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
  // aim: a heading plus a power that builds while held, both committed on release.
  let aimAngle = 0, aimPower = 0, aimFired = false;
  // dual: two independent values, one per side. Keys split Q/A and P/L; a mouse picks a side by
  // where it is; a touch screen gives each finger the side it landed on, below.
  let leftV = 0.5, rightV = 0.5;
  // Which side each TOUCH pointer owns, keyed by pointerId.
  //
  // Two fingers one per half already worked under the old position rule, because each move landed
  // in its own half and set its own value. What did NOT work is a finger crossing the midline: it
  // silently began driving the other side, clobbering whatever the other finger was holding and
  // freezing its own. throw_shuttles and blend_notes both move two values that can genuinely pass
  // each other, so that is a real defect rather than a theoretical one.
  //
  // Mouse pointers are deliberately absent from this map. A mouse has exactly one position, so
  // picking the side from that position is the only thing it can mean, and its behaviour is
  // unchanged.
  const dualSide = new Map();
  // steer: a heading you correct while a throttle is held.
  let heading = 0, throttle = 0;
  // drag: carry one thing from a source to a destination.
  let grabbed = -1, dropOn = -1, dropped = false;

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
    if (family === 'aim') { aimPower = 0; aimAngle = Math.atan2(p.y - 0.5, p.x - 0.5); }
    if (family === 'steer') throttle = 1;
    if (family === 'drag') {
      const src = ev.target && ev.target.closest && ev.target.closest('[data-grab]');
      if (src) grabbed = Number(src.dataset.grab);
    }
    if (family === 'dual' && ev.pointerType === 'touch') {
      dualSide.set(ev.pointerId, p.x < 0.5 ? 'left' : 'right');
    }
    host.focus();
    ev.preventDefault();
  });

  on(doc, 'pointermove', (ev) => {
    const p = localPoint(host, ev);
    x = p.x; y = p.y;
    if (family === 'rate') rate = 1 - p.y;
    if (family === 'aim' && down) aimAngle = Math.atan2(p.y - 0.5, p.x - 0.5);
    if (family === 'steer') heading = (p.x - 0.5) * 2;
    if (family === 'dual') {
      const side = dualSide.get(ev.pointerId);
      if (side === 'left') leftV = 1 - p.y;
      else if (side === 'right') rightV = 1 - p.y;
      else if (p.x < 0.5) leftV = 1 - p.y;      // mouse: side follows position, as before
      else rightV = 1 - p.y;
    }
  });

  on(doc, 'pointerup', (ev) => {
    if (down && family === 'release') fired = true;
    if (down && family === 'route') commit = true;
    if (down && family === 'aim') aimFired = true;
    if (family === 'steer') throttle = 0;
    if (down && family === 'drag' && grabbed >= 0) {
      const dst = ev.target && ev.target.closest && ev.target.closest('[data-drop]');
      dropOn = dst ? Number(dst.dataset.drop) : -1;
      dropped = true;
    }
    dualSide.delete(ev.pointerId);
    down = false;
    lastHeldAt = ev.timeStamp;
  });

  on(host, 'keydown', (ev) => {
    const k = ev.key;
    if (isTapKey(k)) {
      if (!ev.repeat) taps.push({ tMs: ev.timeStamp });
      down = true;
      if (family === 'route') commit = true;
      // Dragging by keyboard is TWO presses: the first picks up whatever is focused, the second
      // puts it down on whatever is focused then. Before this, `grabbed` was only ever assigned
      // from a pointerdown, so a keyboard user could not pick anything up AT ALL - and keyup's
      // `dropOn = grabbed` then dropped each thing back onto itself. The whole drag family was
      // unplayable without a mouse, on crafts that cannot be collected any other way, which made
      // it a gate rather than a game. Tab moves between the pegs; Enter grabs, Enter drops.
      if (family === 'drag' && !ev.repeat) {
        const el = doc.activeElement;
        const near = (attr) => (el && el.closest ? el.closest(`[${attr}]`) : null);
        if (grabbed < 0) {
          const src = near('data-grab');
          if (src) grabbed = Number(src.dataset.grab);
        } else {
          const dst = near('data-drop');
          if (dst) { dropOn = Number(dst.dataset.drop); dropped = true; }
        }
      }
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
    if (family === 'aim') { aimAngle = (keyCursorX - 0.5) * Math.PI * 2; down = true; }
    if (family === 'steer') { heading = (keyCursorX - 0.5) * 2; throttle = 1; }
    // dual needs two hands, so it gets two key pairs rather than one cursor.
    if (family === 'dual') {
      if (k === 'q' || k === 'Q') { leftV = Math.min(1, leftV + step); ev.preventDefault(); }
      if (k === 'a' || k === 'A') { leftV = Math.max(0, leftV - step); ev.preventDefault(); }
      if (k === 'p' || k === 'P') { rightV = Math.min(1, rightV + step); ev.preventDefault(); }
      if (k === 'l' || k === 'L') { rightV = Math.max(0, rightV - step); ev.preventDefault(); }
    }
    if (family === 'rate') {
      if (k === '[') { rate = Math.max(0, rate - 0.08); ev.preventDefault(); }
      if (k === ']') { rate = Math.min(1, rate + 0.08); ev.preventDefault(); }
    }
  });

  on(host, 'keyup', (ev) => {
    if (isTapKey(ev.key)) {
      if (family === 'release') fired = true;
      if (family === 'aim') aimFired = true;
      if (family === 'steer') throttle = 0;
      // drag's keyboard drop happens on keydown above, so that a press can mean 'pick up' or
      // 'put down' depending on whether a thing is already in hand. Dropping here as well would
      // fire both halves off one press and put every item straight back where it came from.
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
        case 'aim': {
          if (down) aimPower = Math.min(1, aimPower + dtMs / 1100);
          const out = { angle: aimAngle, power: aimPower, fired: aimFired };
          if (aimFired) { aimFired = false; aimPower = 0; }
          return out;
        }
        case 'dual': return { left: leftV, right: rightV };
        case 'steer': { if (down) heldMs += 0; return { steer: heading, throttle, heldMs }; }
        case 'drag': {
          const out = { grabbed, dropOn, dropped };
          if (dropped) { dropped = false; grabbed = -1; dropOn = -1; }
          return out;
        }
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
