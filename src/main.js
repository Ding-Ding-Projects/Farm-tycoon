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

function boot() {
  const canvas = document.getElementById('world');
  const bootStatus = document.getElementById('boot-status');

  state.load();
  const now = Date.now();
  const s = state.state;

  renderer.init(canvas);

  // The clamp's protected region (worldBounds()) must cover every structure the world ever
  // draws — buildWorld() below emits one render object per STRUCTURES entry unconditionally,
  // locked/derelict included, because a level-90 system sitting derelict on the map from level
  // 5 is the whole point of that design (see buildWorld()'s own comment). Passing no structures
  // here (the old call) left the clamp's domain as just the padded 12x12 start zone: verified by
  // calling focusTile() directly for every STRUCTURES entry with that bare domain, only 1 of 22
  // could ever be brought fully on-screen — everything else sat outside the tiny box, so the
  // clamp pulled the camera to the box's edge and rendered the structure nowhere near itself.
  // Unioning in every structure's real pos+size (NOT buildWorld()'s per-frame render shape,
  // which collapses size down to a single `scale` number and would under-count a footprint like
  // the 4x3 airport) fixes that at the focusTile()-call level: 17/22 verified reachable this way
  // at zoom 1, and all 22 once zoomed in — see tools/test-camera.mjs. `unlockedZones` carries
  // the real save's unlocked expansions (`['start']` only on a fresh game) rather than a
  // hard-coded empty list, so the domain stays correct for an established save too.
  //
  // IMPORTANT, verified by direct simulation (not assumed): this richer domain does NOT yet
  // reach the live screen. renderer.tickCamera() — called every frame, before drawFrame, so
  // before any pixel is ever painted — ends with an unconditional `clampCamera(viewportW,
  // viewportH)` that takes no bounds argument and therefore always falls back to the bare
  // `worldBounds()` (start zone only). Since cameraTarget is set to match camera right below,
  // easing is a no-op on frame 1, so that bare clamp is the very next thing that runs on
  // whatever focusTile() below just placed — and it stays the steady state forever after,
  // because nothing currently updates cameraTarget once boot finishes. Simulated out to 300
  // frames to confirm: the camera never leaves that bare, start-zone-only window no matter what
  // `bounds` or target this function passes in. The 17/22 structure-reachability figure above is
  // real and already testable through focusTile() directly, and is exactly what a fixed
  // tickCamera() will need once it can accept real bounds — but making it reach the actual
  // rendered frame needs tickCamera() (renderer.js) to stop hard-coding the bare default, which
  // is squarely outside this module's ownership. Filed as the next step rather than worked
  // around here with something like re-clamping a second time after tickCamera(): that would
  // not even help, since a value already inside the bare window (which is where tickCamera()
  // always leaves it) passes straight through a second, wider clamp unchanged.
  const bounds = renderer.worldBounds(s?.farm?.unlockedZones ?? [], Object.values(STRUCTURES));

  // Where to point the camera, separately from how far it may travel. Because of the
  // tickCamera() ceiling documented above, the reachable outcome on the live screen today is
  // bounded by the bare start-zone-only clamp window regardless of what target is picked here —
  // verified: no choice gets every starting field clear of the HUD while that ceiling stands.
  // What the target choice DOES still control is how close to that ceiling the boot frame lands.
  // The geometric centre of the empty 12x12 start zone (the old target) sits on the far side of
  // the bare window from the fields, landing at its worse edge; aiming at the centre of what is
  // actually placed — the save's real farm objects plus whichever STRUCTURES are unlocked at the
  // player's current level (locked ones are left out on purpose: they're reachable by panning
  // once tickCamera() can use `bounds` above, but nothing unusable yet should pull the initial
  // framing toward it) — lands on the window's near side instead. Verified: this takes the worst
  // starting field from 226px, then 24px, off-canvas down to 8px, without changing which ones
  // clear the HUD (still 4 of 6 — the remaining 2 need the tickCamera() fix above to go further).
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
