// actions.js — the field and pen actions with their feedback, shared by the tap path (a ring
// button) and the drag path (the same icon dragged onto the world). One function per action so the
// two can never disagree about what a harvest or a feeding does, toasts, sounds, effects and the
// tutorial included. The sweep specs are Hay Day's strokes: a seed sown across every empty field
// it crosses, a basket swept across every ripe one.

import { state, save } from './state.js';
import { CROPS, ANIMALS, GOODS, MATERIALS } from './data.js';
import * as production from './production.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as tutorial from './tutorial.js';
import * as effects from './render/effects.js';
import * as renderer from './render/renderer.js';

function nameOf(id) {
  return CROPS[id]?.name || GOODS[id]?.name || MATERIALS[id]?.name || id;
}

/** Screen point at the centre of a tile, for effects spawned by a drag or a sweep. */
export function tileScreen(tx, ty) {
  const vp = renderer.getViewport();
  return renderer.tileToScreen(tx + 0.5, ty + 0.5, vp.w, vp.h);
}

export function fieldReady(obj, now = Date.now()) { return !!obj && !!obj.cropId && !!obj.readyAt && obj.readyAt <= now; }
export function fieldEmpty(obj) { return !!obj && !obj.cropId; }
export function penReady(obj, now = Date.now()) { return !!obj && obj.readyAt !== null && obj.readyAt !== undefined && obj.readyAt <= now; }
export function penHungry(obj) { return !!obj && (obj.readyAt === null || obj.readyAt === undefined); }

/** Harvest one field. Returns true when something was harvested. */
export function harvestField(obj, sx, sy, { quiet = false } = {}) {
  if (!obj) return false;
  const crop = CROPS[obj.cropId];
  // harvest() returns null (not false) when it refuses - a full silo leaves the crop standing -
  // so only a truthy result is a harvest.
  const result = production.harvest(obj.id);
  if (result) {
    audio.harvest();
    if (Number.isFinite(sx)) {
      effects.sparkle(sx, sy);
      effects.xpFloater(sx, sy - 26, crop?.xp ?? 1);
    }
    if (!quiet) ui.toast(`Harvested ${crop?.name || 'crop'}!`, 'success');
    tutorial.emit('harvested');
    save();
    return true;
  }
  audio.error();
  ui.toast('Silo is full — sell or use some crops first.', 'error');
  return false;
}

/** Plant one field. Returns true when it was planted. */
export function plantField(obj, cropId, { quiet = false } = {}) {
  const crop = CROPS[cropId];
  if (!obj || !crop) return false;
  const ok = production.plant(obj.id, cropId);
  if (ok) {
    audio.plant();
    if (!quiet) ui.toast(`Planted ${crop.name}.`, 'success');
    tutorial.emit('planted');
    save();
    return true;
  }
  audio.error();
  ui.toast((state.silo.items[cropId] || 0) < crop.seedCost ? `No ${crop.name} seeds — buy some from the plant sheet.` : "Can't plant that here.", 'error');
  return false;
}

/** Feed one pen. Returns true when it was fed. */
export function feedPen(obj) {
  if (!obj) return false;
  const ok = production.feedPen(obj.id);
  if (ok) { audio.animal(); ui.toast('Fed!', 'success'); tutorial.emit('fed'); save(); return true; }
  audio.error();
  const animal = ANIMALS[obj.type];
  ui.toast(animal?.feed ? `No ${nameOf(animal.feed)} in the barn.` : 'Still working — check back soon!', 'error');
  return false;
}

/** Collect one pen. Returns true when something was collected. */
export function collectPen(obj, sx, sy) {
  if (!obj) return false;
  // collectPen() returns null when the barn is full and leaves the pen ready; that is not a
  // collection and must not be toasted as one.
  const result = production.collectPen(obj.id);
  if (result) {
    audio.harvest();
    if (Number.isFinite(sx)) {
      effects.sparkle(sx, sy);
      effects.xpFloater(sx, sy - 26, ANIMALS[obj.type]?.xp ?? 1);
    }
    ui.toast(`Collected ${result.qty} ${nameOf(result.product)}!`, 'success');
    save();
    return true;
  }
  audio.error();
  ui.toast('Barn is full — make room first.', 'error');
  return false;
}

// ---------------------------------------------------------------------------------------------
// Drag specs (see drag.js for the shape).
// ---------------------------------------------------------------------------------------------

/** The basket: sweep it across ripe fields and each one is harvested as it is crossed. */
export function harvestSweepSpec() {
  let count = 0;
  let blocked = false;
  return {
    kind: 'item', icon: '🧺', label: 'Harvest', sweep: true,
    onStart: () => ui.closeRadial(),
    canDrop: (t) => !!t.obj && t.obj.kind === 'field' && fieldReady(t.obj),
    onEnter: (t) => {
      if (blocked || !t.obj || t.obj.kind !== 'field' || !fieldReady(t.obj)) return;
      const [x, y] = tileScreen(t.tx, t.ty);
      if (harvestField(t.obj, x, y, { quiet: true })) count += 1;
      else blocked = true;   // a full silo ends the stroke; the toast has already said so
    },
    onEnd: () => {
      if (count > 1) ui.toast(`Harvested ${count} fields!`, 'success');
      else if (count === 1) ui.toast('Harvested!', 'success');
    },
  };
}

/** A seed: sweep it across empty fields and each one is sown while the seeds last. */
export function plantSweepSpec(cropId) {
  const crop = CROPS[cropId];
  let count = 0;
  const haveSeeds = () => (state.silo.items[cropId] || 0) >= (crop?.seedCost ?? 1);
  return {
    kind: 'item', icon: crop?.icon || '🌱', label: `Plant ${crop?.name || cropId}`, sweep: true,
    onStart: () => { ui.closeRadial(); ui.closePanel(); },
    canDrop: (t) => !!t.obj && t.obj.kind === 'field' && fieldEmpty(t.obj) && haveSeeds(),
    onEnter: (t) => {
      if (!t.obj || t.obj.kind !== 'field' || !fieldEmpty(t.obj) || !haveSeeds()) return;
      if (plantField(t.obj, cropId, { quiet: true })) {
        count += 1;
        const [x, y] = tileScreen(t.tx, t.ty);
        effects.sparkle(x, y);
      }
    },
    onEnd: () => {
      if (count > 1) ui.toast(`Planted ${count} fields of ${crop.name}.`, 'success');
      else if (count === 1) ui.toast(`Planted ${crop.name}.`, 'success');
      else if (!haveSeeds()) ui.toast(`No ${crop.name} seeds left — buy some from the plant sheet.`, 'error');
    },
  };
}

/** The feed bag: drop it on any hungry pen of the same species. */
export function feedDragSpec(obj) {
  const animal = ANIMALS[obj.type];
  return {
    kind: 'item', icon: animal?.feed ? '🌾' : '🍯', label: `Feed ${animal?.name || 'animals'}`,
    onStart: () => ui.closeRadial(),
    canDrop: (t) => !!t.obj && t.obj.kind === 'pen' && t.obj.type === obj.type && penHungry(t.obj),
    onDrop: (t) => feedPen(t.obj),
    onCancel: (t) => { if (t) ui.toast(`Drop the feed on the ${animal?.pen || 'pen'}.`, 'info'); },
  };
}

/** The basket for a pen: drop it on any pen that is ready. */
export function collectDragSpec(obj) {
  const animal = ANIMALS[obj.type];
  return {
    kind: 'item', icon: '🧺', label: `Collect ${animal?.name || 'animals'}`,
    onStart: () => ui.closeRadial(),
    canDrop: (t) => !!t.obj && t.obj.kind === 'pen' && penReady(t.obj),
    onDrop: (t) => { const [x, y] = tileScreen(t.obj.x, t.obj.y); collectPen(t.obj, x, y); },
    onCancel: (t) => { if (t) ui.toast('Drop the basket on a pen that is ready.', 'info'); },
  };
}
