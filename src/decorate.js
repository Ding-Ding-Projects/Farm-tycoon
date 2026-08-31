// decorate.js — decorating mode and photo mode (DECORATE, PHOTO).
//
// Decorating is a MODE over the world rather than a place, which makes it the single declared
// exception to the rule that systems open by clicking their structure: it toggles from the dock,
// because there is no building called "rearranging things".
//
// The filler that never runs out, because the player supplies the goal. No timers, no resource
// cost, nothing to collect.
// State: state.decorate { active, selection: [objectId], history: [], historyIndex }
//        state.photo { frame, stickers: [{ id, x, y }] }

import { state } from './state.js';
import { DECORATE, PHOTO, FARM, BUILDINGS, DECORATIONS, ANIMALS, STRUCTURES } from './data.js';
import * as farm from './farm.js';

// Mirrors farm.js's private footprintOf() — needed here because a multi-select move must
// validate every moved object against the others IN the selection being ignored at once,
// which farm.js's single-object move()/canPlace() cannot express.
function footprintOf(kind, type) {
  if (kind === 'field') return [1, 1];
  if (kind === 'building') return BUILDINGS[type]?.size ?? [1, 1];
  if (kind === 'decoration') return DECORATIONS[type]?.size ?? [1, 1];
  if (kind === 'pen') return ANIMALS[type]?.size ?? [2, 2];
  if (STRUCTURES[type]) return STRUCTURES[type].size;
  return [1, 1];
}

function rectFree(x, y, w, h, ignoreIds) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x + w > FARM.gridSize || y + h > FARM.gridSize) return false;
  if (typeof farm.isUnlockedTile === 'function') {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (!farm.isUnlockedTile(tx, ty)) return false;
      }
    }
  }
  for (const obj of state.farm.objects) {
    if (ignoreIds.has(obj.id)) continue;
    const [ow, oh] = footprintOf(obj.kind, obj.type);
    const overlaps = x < obj.x + ow && x + w > obj.x && y < obj.y + oh && y + h > obj.y;
    if (overlaps) return false;
  }
  return true;
}

/** Record an undoable action as a set of per-object {before, after} snapshots. */
function pushHistory(entries) {
  if (entries.length === 0) return;
  const h = state.decorate;
  h.history = h.history.slice(0, h.historyIndex);
  h.history.push(entries);
  h.historyIndex = h.history.length;
  if (h.history.length > DECORATE.undoDepth) {
    h.history.shift();
    h.historyIndex -= 1;
  }
}

function applySnapshot(entries, key) {
  for (const entry of entries) {
    const obj = state.farm.objects.find((o) => o.id === entry.objectId);
    if (!obj) continue;
    Object.assign(obj, entry[key]);
  }
}

function snapshotOf(obj) {
  return { x: obj.x, y: obj.y, rotation: obj.rotation || 0 };
}

/** Enter decorating mode. */
export function enter() {
  state.decorate.active = true;
  return true;
}

/** Leave it, committing placements. */
export function exit() {
  state.decorate.active = false;
  state.decorate.selection = [];
  return true;
}

/** Select an object, optionally adding to the current selection. */
export function select(objectId, additive) {
  const sel = state.decorate.selection;
  if (objectId == null) {
    state.decorate.selection = [];
    return state.decorate.selection;
  }
  if (additive) {
    const idx = sel.indexOf(objectId);
    if (idx === -1) sel.push(objectId);
    else sel.splice(idx, 1);
  } else {
    state.decorate.selection = [objectId];
  }
  return state.decorate.selection;
}

/** Move the selection by a tile delta, snapping and refusing invalid placements. */
export function move(dx, dy) {
  const ids = state.decorate.selection;
  if (ids.length === 0) return false;
  const objects = ids.map((id) => state.farm.objects.find((o) => o.id === id)).filter(Boolean);
  if (objects.length === 0) return false;

  const ignoreIds = new Set(objects.map((o) => o.id));
  const targets = objects.map((o) => ({ obj: o, x: o.x + dx, y: o.y + dy }));

  for (const { obj, x, y } of targets) {
    const [w, h] = footprintOf(obj.kind, obj.type);
    if (!rectFree(x, y, w, h, ignoreIds)) return false; // atomic: any invalid target refuses the whole move
  }

  const entries = targets.map(({ obj }) => ({ objectId: obj.id, before: snapshotOf(obj) }));
  for (const { obj, x, y } of targets) {
    obj.x = x;
    obj.y = y;
  }
  entries.forEach((entry, i) => { entry.after = snapshotOf(targets[i].obj); });
  pushHistory(entries);
  return true;
}

/** Rotate the selection through DECORATE.rotations steps. */
export function rotate() {
  const ids = state.decorate.selection;
  if (ids.length === 0) return false;
  const step = 360 / DECORATE.rotations;
  const entries = [];
  for (const id of ids) {
    const obj = state.farm.objects.find((o) => o.id === id);
    if (!obj) continue;
    const before = snapshotOf(obj);
    obj.rotation = ((obj.rotation || 0) + step) % 360;
    entries.push({ objectId: obj.id, before, after: snapshotOf(obj) });
  }
  pushHistory(entries);
  return entries.length > 0;
}

/** Undo / redo, bounded by DECORATE.undoDepth. */
export function undo() {
  const h = state.decorate;
  if (h.historyIndex <= 0) return false;
  h.historyIndex -= 1;
  applySnapshot(h.history[h.historyIndex], 'before');
  return true;
}

export function redo() {
  const h = state.decorate;
  if (h.historyIndex >= h.history.length) return false;
  applySnapshot(h.history[h.historyIndex], 'after');
  h.historyIndex += 1;
  return true;
}

/** Photo mode: choose a frame, place stickers, and render the current view. */
export function setFrame(frameId) {
  if (!PHOTO.frames.includes(frameId)) return false;
  state.photo.frame = frameId;
  return true;
}

export function addSticker(id, x, y) {
  if (state.photo.stickers.length >= PHOTO.maxStickers) return false;
  state.photo.stickers.push({ id, x, y });
  return true;
}

export function capture() {
  return {
    frame: state.photo.frame,
    stickers: state.photo.stickers.map((s) => ({ ...s })),
    capturedAt: Date.now(),
  };
}
