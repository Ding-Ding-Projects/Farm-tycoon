// main.js — boot + game loop.
// Boot order: state.load() → renderer.init → ui.init → input.init → audio.init (deferred to
// first gesture) → tutorial.init → resolve offline progress (production.tick(now)) → rAF loop.
// Loop each frame: production/shop/orders/boat/event ticks → camera tick → drawFrame → updateHud.
// Autosave every state.settings.autosaveInterval seconds and on beforeunload.
//
// Debug hook (used by the playtest skill; harmless in production):
//   window.__farmDebug = { timeSkip(ms), state, give(itemId, qty) }

import * as state from './state.js';
import * as renderer from './render/renderer.js';
import * as ui from './ui.js';
import * as input from './input.js';
import * as audio from './audio.js';
import * as tutorial from './tutorial.js';
import * as production from './production.js';
import * as orders from './orders.js';
import * as boat from './boat.js';
import * as shop from './shop.js';
import * as trains from './trains.js';
import * as zoo from './zoo.js';
import * as extras from './extras.js';
import { CROPS, GOODS, MATERIALS, STRUCTURES, FARM } from './data.js';

let lastAutosave = 0;
let running = false;

function safeCall(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  try { return fn(...args); } catch (e) { console.error(e); return undefined; }
}

/**
 * Assemble this frame's { objects } for renderer.drawFrame: farm.js placed objects (fields/
 * buildings/pens/decorations, mapped into the {kind,type,tx,ty,...} shape renderer.js
 * documents) plus every STRUCTURES entry (always drawn, even locked/derelict — that's what
 * makes a level-90 system discoverable at level 5).
 */
function buildWorld() {
  const s = state.state;
  if (!s) return { objects: [] };
  const now = Date.now();
  const objects = [];

  for (const obj of s.farm.objects) {
    if (obj.kind === 'field') {
      if (obj.cropId) {
        const crop = CROPS[obj.cropId];
        const total = crop ? crop.growTime * 1000 : 1;
        const elapsed = obj.plantedAt ? now - obj.plantedAt : total;
        const growProgress = Math.max(0, Math.min(1, elapsed / total));
        objects.push({ id: obj.id, kind: 'crop', type: obj.cropId, tx: obj.x, ty: obj.y, growProgress });
      } else {
        objects.push({ id: obj.id, kind: 'field', type: 'field', tx: obj.x, ty: obj.y });
      }
    } else if (obj.kind === 'pen') {
      objects.push({ id: obj.id, kind: 'pen', type: obj.type, tx: obj.x, ty: obj.y });
    } else if (obj.kind === 'building') {
      const entry = s.production.find((p) => p.objectId === obj.id);
      objects.push({
        id: obj.id, kind: 'building', type: obj.type, tx: obj.x, ty: obj.y,
        progress: entry ? Math.max(0, Math.min(1, 1 - (entry.readyAt - now) / 60000)) : undefined,
      });
    } else if (obj.kind === 'decoration' || obj.kind === 'pond' || obj.kind === 'mine') {
      objects.push({ id: obj.id, kind: 'decoration', type: obj.type, tx: obj.x, ty: obj.y });
    }
  }

  for (const [key, def] of Object.entries(STRUCTURES)) {
    objects.push({
      id: `structure:${key}`, kind: 'structure', type: key,
      tx: def.pos.x, ty: def.pos.y, scale: Math.max(...def.size),
      derelict: s.level < def.unlockLevel,
    });
  }

  return { objects };
}

/** Run every timer/tick module's tick(now), defensively — Phase B stubs are safe no-ops. */
function tickAllSystems(now) {
  safeCall(production.tick, now);
  safeCall(orders.tickTruck, now);
  safeCall(boat.tick, now);
  safeCall(shop.tick, now);
  safeCall(trains.tick, now);
  safeCall(zoo.tick, now);
  safeCall(extras.tickEvents, now);
}

function loop(nowMs) {
  if (!running) return;
  const now = Date.now();
  tickAllSystems(now);
  safeCall(tutorial.checkAutoEvents);
  safeCall(renderer.tickCamera, 1 / 60);
  safeCall(renderer.drawFrame, now, buildWorld());
  ui.updateHud();

  const interval = (state.state?.settings?.autosaveInterval || 10) * 1000;
  if (now - lastAutosave > interval) {
    lastAutosave = now;
    state.save();
  }

  requestAnimationFrame(loop);
}

/**
 * Live camera bounds: start zone ∪ every unlocked expansion ∪ every STRUCTURES entry — locked
 * ones included, because buildWorld() below emits one render object per STRUCTURES entry
 * unconditionally (a level-90 system sitting derelict on the map from level 5 is the whole point
 * of that design; see buildWorld()'s own comment), so the clamp's domain must cover every one it
 * draws, not just the reachable subset of today's save. Unioning in every structure's real
 * pos+size (NOT buildWorld()'s per-frame render shape, which collapses size down to a single
 * `scale` number and would under-count a footprint like the 4x3 airport) took structure
 * reachability from 1/22 to 17/22 at zoom 1 and 22/22 zoomed in — see tools/test-camera.mjs.
 *
 * A FUNCTION, called fresh each time, not a bounds object computed once — `state.state` is read
 * live inside it (an ES module live binding, so this always sees the current save, not a
 * snapshot), so the domain grows the moment an expansion unlocks mid-game rather than only at
 * the next boot(). Registered with renderer.setBoundsProvider() below so every clamp inside
 * renderer.js (tickCamera()'s every-frame clamp, resizeToWindow()'s on-resize clamp — not just
 * this function's own one-off focusTile() call) shares this same domain permanently, not just
 * for the instant between boot() and frame 1. Before that provider existed, tickCamera() ran
 * every frame before drawFrame and always fell back to clampCamera()'s bare worldBounds()
 * default (start zone only) — verified by direct simulation to be the permanent steady state,
 * discarding whatever richer bounds boot() had just computed. See renderer.js's own comments on
 * setBoundsProvider()/tickCamera() for the mechanism.
 */
function cameraBounds() {
  return renderer.worldBounds(state.state?.farm?.unlockedZones ?? [], Object.values(STRUCTURES));
}

function boot() {
  const canvas = document.getElementById('world');
  const bootStatus = document.getElementById('boot-status');

  state.load();
  const now = Date.now();
  const s = state.state;

  renderer.init(canvas);
  renderer.setBoundsProvider(cameraBounds);

  const bounds = cameraBounds();

  // Where to point the camera, separately from how far it may travel (`bounds` above — now the
  // permanent clamp domain, not just this boot frame's). The geometric centre of the empty
  // 12x12 start zone (the old target) sits on the far side of the domain from the starting
  // fields (planted 3 rows north of the start zone's own centre), landing near its worse edge;
  // aiming at the centre of what is actually placed — the save's real farm objects plus whichever
  // STRUCTURES are unlocked at the player's current level (locked ones deliberately excluded:
  // they're reachable by panning now that the clamp domain covers them, but nothing unusable yet
  // should pull the initial framing toward it) — lands nearer the domain's centre instead.
  const startCenterX = FARM.startZone.x + FARM.startZone.w / 2;
  const startCenterY = FARM.startZone.y + FARM.startZone.h / 2;
  const level = s?.level ?? 1;
  const unlockedStructures = Object.values(STRUCTURES).filter((d) => level >= d.unlockLevel);
  const focusPoints = [
    ...(s?.farm?.objects ?? []).map((o) => ({ x: o.x, y: o.y })),
    ...unlockedStructures.map((d) => ({ x: d.pos.x + d.size[0] / 2, y: d.pos.y + d.size[1] / 2 })),
  ];
  const focusX = focusPoints.length
    ? focusPoints.reduce((sum, p) => sum + p.x, 0) / focusPoints.length
    : startCenterX;
  const focusY = focusPoints.length
    ? focusPoints.reduce((sum, p) => sum + p.y, 0) / focusPoints.length
    : startCenterY;

  const vp = renderer.getViewport();
  safeCall(renderer.focusTile, focusX, focusY, vp.w, vp.h, bounds);
  renderer.cameraTarget.x = renderer.camera.x;
  renderer.cameraTarget.y = renderer.camera.y;
  renderer.cameraTarget.zoom = renderer.camera.zoom;

  ui.init();
  input.init(canvas);
  tutorial.init();

  // Resolve any offline progress up to right now before the first frame paints.
  safeCall(production.tick, now);

  if (bootStatus) bootStatus.textContent = '';

  window.addEventListener('beforeunload', () => state.save());

  running = true;
  lastAutosave = now;
  requestAnimationFrame(loop);

  // ---------------------------------------------------------------------
  // Debug hook for the playtest skill. Harmless in production: it only
  // mutates state the player could already reach through play.
  // ---------------------------------------------------------------------
  window.__farmDebug = {
    get state() { return state.state; },
    /** Shift every stored readyAt timestamp back by ms, simulating elapsed time. */
    timeSkip(ms) {
      const s = state.state;
      if (!s) return;
      for (const obj of s.farm.objects) {
        if (obj.readyAt) obj.readyAt -= ms;
      }
      for (const entry of s.production) {
        if (entry.readyAt) entry.readyAt -= ms;
      }
      if (s.orders?.truck?.readyAt) s.orders.truck.readyAt -= ms;
      if (s.orders?.boat?.readyAt) s.orders.boat.readyAt -= ms;
      tickAllSystems(Date.now());
    },
    /** Grant qty of an item id straight into the appropriate storage bucket. */
    give(itemId, qty = 1) {
      const s = state.state;
      if (!s) return;
      if (CROPS[itemId]) {
        s.silo.items[itemId] = (s.silo.items[itemId] || 0) + qty;
      } else if (GOODS[itemId] || MATERIALS[itemId]) {
        s.barn.items[itemId] = (s.barn.items[itemId] || 0) + qty;
      } else {
        s.barn.items[itemId] = (s.barn.items[itemId] || 0) + qty;
      }
      ui.updateHud();
    },
  };
}

window.addEventListener('DOMContentLoaded', boot);
