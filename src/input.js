// input.js — pointer handling: pick/pan/zoom/drag-plant/placement ghost.
//
// The defining interaction of this game: every system with a physical presence opens by
// CLICKING ITS STRUCTURE IN THE WORLD (STRUCTURES in data.js), never from a HUD/dock button.
// Locked structures are derelict and still clickable from level 1, showing their unlock
// requirement — that's what makes a level-90 system discoverable at level 5.

import { state, save } from './state.js';
import * as renderer from './render/renderer.js';
import * as farm from './farm.js';
import * as production from './production.js';
import * as foraging from './foraging.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as tutorial from './tutorial.js';
import { STRUCTURES, CROPS, ANIMALS, GOODS, MATERIALS } from './data.js';
import * as economy from './economy.js';
import * as placement from './placement.js';
import * as effects from './render/effects.js';

let canvasRef = null;

// Drag/tap tracking
let pointerDown = false;
let dragging = false;
let downX = 0, downY = 0, lastX = 0, lastY = 0;
let downTime = 0;
const TAP_MOVE_THRESHOLD = 6; // px
const TAP_TIME_MAX = 400; // ms

// Every live pointer, keyed by pointerId. A mouse only ever puts one entry in here, so the
// single-pointer paths below are completely unchanged by the presence of this map; two entries
// means a pinch is in progress.
const pointers = new Map();
let pinchStartDist = 0;
let pinchStartZoom = 1;
let pinchMidX = 0, pinchMidY = 0;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
/** One clamp for every zoom route, so pinch and wheel cannot drift apart. */
function setZoom(z) {
  renderer.cameraTarget.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/** Shift the camera by a screen-space delta, in tile space. Shared by drag-pan and pinch-pan. */
function panByScreen(dx, dy) {
  const T = renderer.TILE_BASE * renderer.camera.zoom;
  // tileToScreen: sx = ox + (tx-ty)*T ; sy = oy + (tx+ty)*T/2, with ox,oy shifted by camera.
  // Dragging the screen by (dx,dy) should move the camera opposite in tile-space:
  const dtx = (dx / T + (dy * 2) / T) / 2;
  const dty = ((dy * 2) / T - dx / T) / 2;
  renderer.cameraTarget.x -= dtx;
  renderer.cameraTarget.y -= dty;
}

/** Distance and midpoint of the first two live pointers. */
function pinchGeometry() {
  const [a, b] = [...pointers.values()];
  return {
    dist: Math.hypot(a.x - b.x, a.y - b.y),
    mx: (a.x + b.x) / 2,
    my: (a.y + b.y) / 2,
  };
}

function firstGestureUnlockAudio() {
  audio.init();
  audio.unlock();
}

function structureAt(tx, ty) {
  for (const [key, def] of Object.entries(STRUCTURES)) {
    const [w, h] = def.size;
    if (tx >= def.pos.x && tx < def.pos.x + w && ty >= def.pos.y && ty < def.pos.y + h) {
      return { key, def };
    }
  }
  return null;
}

function isStructureUnlocked(def) {
  return state.level >= def.unlockLevel;
}

/** Item display name across every table a foraged item id could land in. */
function nameOf(id) {
  return CROPS[id]?.name || GOODS[id]?.name || MATERIALS[id]?.name || id;
}

/** A forage node at this tile, or null. Nodes live in state.foraging.nodes — a SEPARATE array
 *  from state.farm.objects (see foraging.js's own findFreeTile, which checks farm.objectAt to
 *  avoid ever overlapping one), so farm.objectAt() above never finds them; this is the one
 *  place a tap resolves them. Exported (alongside forageTap below) so tools/test-ui-contracts.mjs
 *  can drive the real tap-resolution path directly rather than faking pointer/canvas geometry
 *  just to prove the wiring is real. */
export function forageNodeAt(tx, ty) {
  return foraging.nodes().find((n) => n.x === tx && n.y === ty) || null;
}

/** Nodes cost nothing and are simply tapped (foraging.js's own words) — no radial menu, no
 *  confirmation, just an instant collect when ready and an honest "not yet" toast when not. */
export function forageTap(node) {
  const now = Date.now();
  if (node.readyAt > now) {
    ui.toast('Still regrowing — check back soon.', 'info');
    return;
  }
  const result = foraging.collectNode(node.id, now);
  if (result && result.qty > 0) {
    audio.harvest();
    ui.toast(`Foraged ${nameOf(result.itemId)} x${result.qty}!`, 'success');
    tutorial.emit('foraged');
  } else {
    audio.error();
    ui.toast('Barn is full — make room first.', 'error');
  }
  save();
}

function openStructure(key, def) {
  if (!isStructureUnlocked(def)) {
    audio.error();
    ui.toast(`${def.name} unlocks at level ${def.unlockLevel}.`, 'error');
    return;
  }
  audio.click();
  ui.openPanel(def.panel, key);
}

function fieldRadial(screenX, screenY, obj) {
  const now = Date.now();
  const growing = !!obj.cropId && obj.readyAt && obj.readyAt > now;
  const ready = !!obj.cropId && obj.readyAt && obj.readyAt <= now;

  if (ready) {
    // Captured now: harvest() clears the field's cropId, so reading it afterwards names nothing.
    const crop = CROPS[obj.cropId];
    ui.openRadial(screenX, screenY, [{
      icon: '🧺', label: 'Harvest', sub: crop?.name || 'Harvest',
      onSelect: () => {
        // harvest() returns null (not false) when it refuses - a full silo leaves the crop standing
        // - so only a truthy result is a harvest. The old `ok !== false` toasted success on null.
        const result = typeof production.harvest === 'function' ? production.harvest(obj.id) : null;
        if (result) {
          audio.harvest();
          effects.sparkle(screenX, screenY);
          effects.xpFloater(screenX, screenY - 26, crop?.xp ?? 1);
          ui.toast(`Harvested ${crop?.name || 'crop'}!`, 'success');
          tutorial.emit('harvested');
        } else {
          audio.error();
          ui.toast('Silo is full — sell or use some crops first.', 'error');
        }
        save();
      },
    }], obj.id);
    return;
  }
  if (growing) {
    ui.toast('Still growing — check back soon!', 'info');
    return;
  }
  // Empty field: offer unlocked crops to plant.
  const options = Object.entries(CROPS)
    .filter(([id]) => economy.isUnlocked(id))
    .slice(0, 8)
    .map(([id, crop]) => ({
      icon: crop.icon || '🌱',
      label: crop.name,
      sub: crop.name,
      onSelect: () => {
        const ok = typeof production.plant === 'function' && production.plant(obj.id, id);
        if (ok !== false) {
          audio.plant();
          ui.toast(`Planted ${crop.name}.`, 'success');
          tutorial.emit('planted');
        } else {
          audio.error();
          ui.toast("Can't plant that here.", 'error');
        }
        save();
      },
    }));
  if (!options.length) { ui.toast('No crops unlocked yet.', 'info'); return; }
  ui.openRadial(screenX, screenY, options, obj.id);
}

function penRadial(screenX, screenY, obj) {
  const now = Date.now();
  const ready = obj.readyAt && obj.readyAt <= now;
  const fed = !!obj.readyAt;
  const options = [];
  if (ready) {
    options.push({
      icon: '🧺', label: 'Collect', sub: ANIMALS[obj.type]?.name || 'Collect',
      onSelect: () => {
        // collectPen() returns null when the barn is full and leaves the pen ready; that is not a
        // collection and must not be toasted as one.
        const result = typeof production.collectPen === 'function' ? production.collectPen(obj.id) : null;
        if (result) {
          audio.harvest();
          effects.sparkle(screenX, screenY);
          effects.xpFloater(screenX, screenY - 26, ANIMALS[obj.type]?.xp ?? 1);
          ui.toast(`Collected ${result.qty} ${nameOf(result.product)}!`, 'success');
        } else {
          audio.error();
          ui.toast('Barn is full — make room first.', 'error');
        }
        save();
      },
    });
  } else if (!fed) {
    options.push({
      icon: '🌾', label: 'Feed', sub: ANIMALS[obj.type]?.name || 'Feed',
      onSelect: () => {
        const ok = typeof production.feedPen === 'function' && production.feedPen(obj.id);
        if (ok !== false) { audio.animal(); ui.toast('Fed!', 'success'); tutorial.emit('fed'); } else { audio.error(); ui.toast('No feed available.', 'error'); }
        save();
      },
    });
  } else {
    ui.toast('Still working — check back soon!', 'info');
    return;
  }
  ui.openRadial(screenX, screenY, options, obj.id);
}

/** Tile under a screen point. The ghost and handleTap must agree, so they share this. */
function tileAt(sx, sy) {
  const viewport = renderer.getViewport();
  return renderer.screenToTile(sx, sy, viewport.w, viewport.h).map(Math.floor);
}

/**
 * Commit the placement ghost.
 *
 * A blocked tile deliberately does NOT cancel: it plays the error tone and leaves the ghost up,
 * so a mis-tap costs a second rather than a crafted kit.
 */
function commitPlacement() {
  const res = placement.confirm();
  if (res.ok) {
    audio.place();
    if (res.object?.id) effects.placeBounce(res.object.id);
    save();
    return true;
  }
  audio.error();
  // Distinguish the two ways this can refuse: a blocked tile is fixed by moving, an unaffordable
  // building is not, and telling someone to "try somewhere else" when they are short of coins
  // sends them hunting for a tile that was never the problem.
  ui.toast(
    res.reason === 'refused'
      ? "You can't afford that right now."
      : 'That spot is blocked - try somewhere else.',
    'error',
  );
  return false;
}

function handleTap(sx, sy) {
  ui.closeRadial();
  const [tx, ty] = tileAt(sx, sy);

  // Placing something beats every other meaning a tap could have: while the ghost is up the
  // player is answering "where?", not asking to open a panel.
  if (placement.isActive()) { commitPlacement(); return; }

  // Decorate mode turns a tap on a placed object into a pick-up. This is the drag-to-arrange the
  // dock has always promised in its toast and never actually implemented.
  if (state?.decorate?.active) {
    const target = farm.objectAt(tx, ty);
    if (target) {
      placement.beginMove(target.id);
      ui.toast('Drag it where you like, then tap to drop it. Esc puts it back.', 'info');
    }
    return;
  }

  const struct = structureAt(tx, ty);
  if (struct) { openStructure(struct.key, struct.def); return; }

  const obj = farm.objectAt(tx, ty);
  if (obj) {
    if (obj.kind === 'field') { fieldRadial(sx, sy, obj); return; }
    if (obj.kind === 'pen') { penRadial(sx, sy, obj); return; }
    if (obj.kind === 'building') { ui.openPanel('building', obj.id); return; }
    // decoration/pond/other: nothing to open, just a friendly ack.
    return;
  }

  const node = forageNodeAt(tx, ty);
  if (node) { forageTap(node); return; }

  // Tapped empty unlocked ground with nothing on it — no default action (per design, only
  // fields/structures/pens/forage nodes open something); just close any open panel to feel
  // responsive.
  if (ui.isPanelOpen()) ui.closePanel();
}

// ---------------------------------------------------------------------------
// Pointer wiring: drag pans the camera target, a short low-movement press is a tap.
// ---------------------------------------------------------------------------
function onPointerDown(e) {
  firstGestureUnlockAudio();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    // A second finger turns the gesture into a pinch. Whatever the first finger was doing is
    // abandoned rather than completed: without this, lifting out of a pinch fires a tap and
    // opens a panel nobody asked for.
    const g = pinchGeometry();
    pinchStartDist = g.dist;
    pinchStartZoom = renderer.camera.zoom;
    pinchMidX = g.mx;
    pinchMidY = g.my;
    dragging = true;
    pointerDown = false;
    ui.closeRadial();
    return;
  }
  if (pointers.size > 2) return;

  pointerDown = true;
  dragging = false;
  downX = lastX = e.clientX;
  downY = lastY = e.clientY;
  downTime = performance.now();
  // May throw (e.g. NotFoundError) for a pointer id the browser doesn't consider active —
  // harmless to skip; capture is just an optimization to keep receiving events off-canvas.
  try { canvasRef.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
}

function onPointerMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // Pinch: two fingers zoom by their separation and pan by their midpoint, together, because
  // that is how one physical gesture actually behaves. Doing only the zoom makes the world feel
  // nailed down while your hand moves across it.
  if (pointers.size === 2) {
    const g = pinchGeometry();
    if (pinchStartDist > 0) setZoom(pinchStartZoom * (g.dist / pinchStartDist));
    panByScreen(g.mx - pinchMidX, g.my - pinchMidY);
    pinchMidX = g.mx;
    pinchMidY = g.my;
    return;
  }

  // The ghost follows the pointer whether or not a button is down, so you can see where a
  // building will land before committing to the gesture.
  if (placement.isActive()) {
    const [gx, gy] = tileAt(e.clientX, e.clientY);
    const g = placement.ghost();
    // Centre the footprint on the cursor: grabbing a 3x3 factory by its top-left corner makes it
    // feel like it is lagging behind the finger.
    placement.hover(gx - Math.floor((g?.w || 1) / 2), gy - Math.floor((g?.h || 1) / 2));
    return;
  }
  if (!pointerDown) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (!dragging && Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_MOVE_THRESHOLD) {
    dragging = true;
    ui.closeRadial();
  }
  if (dragging) panByScreen(dx, dy);
  lastX = e.clientX;
  lastY = e.clientY;
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);

  // Coming out of a pinch with one finger still down: re-seed that finger's baseline, or the
  // camera lurches by however far the two fingers happened to be apart. Deliberately does NOT
  // resume dragging, because the remaining finger has not started a new gesture yet.
  if (pointers.size === 1) {
    const [only] = [...pointers.values()];
    downX = lastX = only.x;
    downY = lastY = only.y;
    downTime = performance.now();
    pointerDown = true;
    dragging = true;      // a leftover finger pans, it never taps
    return;
  }
  if (pointers.size > 1) return;

  if (!pointerDown) return;
  pointerDown = false;
  const elapsed = performance.now() - downTime;
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (placement.isActive()) {
    // A drag-and-release is the natural way to place, so releasing over a legal tile commits
    // even when the pointer travelled far enough to count as a drag anywhere else.
    commitPlacement();
  } else if (!dragging && moved <= TAP_MOVE_THRESHOLD && elapsed <= TAP_TIME_MAX) {
    handleTap(e.clientX, e.clientY);
  }
  dragging = false;
}

function onWheel(e) {
  e.preventDefault();
  setZoom(renderer.cameraTarget.zoom + -Math.sign(e.deltaY) * 0.1);
}

/** Attach all listeners to the world canvas. Call once during boot. */
export function init(canvas) {
  canvasRef = canvas;
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
}

/**
 * Keyboard parity for placement.
 *
 * A ghost you can only position with a pointer is a building a keyboard-only player can never
 * put down, and buildAt() no longer has an auto-place path to fall back on - so this is the
 * accessibility floor for the whole feature, not a convenience.
 */
function onKeyDown(e) {
  if (!placement.isActive()) return;
  if (e.key === 'Escape') { placement.cancel(); ui.toast('Cancelled.', 'info'); e.preventDefault(); return; }
  if (e.key === 'Enter' || e.key === ' ') { commitPlacement(); e.preventDefault(); return; }
  const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (step) { placement.nudge(step[0], step[1]); e.preventDefault(); }
}
