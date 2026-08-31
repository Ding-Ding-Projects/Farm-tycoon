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
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as tutorial from './tutorial.js';
import { STRUCTURES, CROPS, ANIMALS } from './data.js';
import * as economy from './economy.js';

let canvasRef = null;

// Drag/tap tracking
let pointerDown = false;
let dragging = false;
let downX = 0, downY = 0, lastX = 0, lastY = 0;
let downTime = 0;
const TAP_MOVE_THRESHOLD = 6; // px
const TAP_TIME_MAX = 400; // ms

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
    ui.openRadial(screenX, screenY, [{
      icon: '🧺', label: 'Harvest', sub: CROPS[obj.cropId]?.name || 'Harvest',
      onSelect: () => {
        const ok = typeof production.harvest === 'function' && production.harvest(obj.id);
        if (ok !== false) {
          audio.harvest();
          ui.toast(`Harvested ${CROPS[obj.cropId]?.name || 'crop'}!`, 'success');
          tutorial.emit('harvested');
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
        const ok = typeof production.collectPen === 'function' && production.collectPen(obj.id);
        if (ok !== false) { audio.harvest(); ui.toast('Collected!', 'success'); }
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

function handleTap(sx, sy) {
  ui.closeRadial();
  const viewport = renderer.getViewport();
  const [tx, ty] = renderer.screenToTile(sx, sy, viewport.w, viewport.h).map(Math.floor);

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

  // Tapped empty unlocked ground with nothing on it — no default action (per design, only
  // fields/structures/pens open something); just close any open panel to feel responsive.
  if (ui.isPanelOpen()) ui.closePanel();
}

// ---------------------------------------------------------------------------
// Pointer wiring: drag pans the camera target, a short low-movement press is a tap.
// ---------------------------------------------------------------------------
function onPointerDown(e) {
  firstGestureUnlockAudio();
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
  if (!pointerDown) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (!dragging && Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_MOVE_THRESHOLD) {
    dragging = true;
    ui.closeRadial();
  }
  if (dragging) {
    const T = renderer.TILE_BASE * renderer.camera.zoom;
    // tileToScreen: sx = ox + (tx-ty)*T ; sy = oy + (tx+ty)*T/2, with ox,oy shifted by camera.
    // Dragging the screen by (dx,dy) should move the camera opposite in tile-space:
    const dtx = (dx / T + (dy * 2) / T) / 2;
    const dty = ((dy * 2) / T - dx / T) / 2;
    renderer.cameraTarget.x -= dtx;
    renderer.cameraTarget.y -= dty;
  }
  lastX = e.clientX;
  lastY = e.clientY;
}

function onPointerUp(e) {
  if (!pointerDown) return;
  pointerDown = false;
  const elapsed = performance.now() - downTime;
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (!dragging && moved <= TAP_MOVE_THRESHOLD && elapsed <= TAP_TIME_MAX) {
    handleTap(e.clientX, e.clientY);
  }
  dragging = false;
}

function onWheel(e) {
  e.preventDefault();
  const delta = -Math.sign(e.deltaY) * 0.1;
  renderer.cameraTarget.zoom = Math.max(0.5, Math.min(2.5, renderer.cameraTarget.zoom + delta));
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
}
