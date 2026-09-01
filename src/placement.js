// placement.js — the placement ghost: choosing WHERE a building goes.
//
// Before this existed, ui.js's buildAt() called findFreeTile() and dropped the building on the
// first fitting tile it scanned. The player never chose, the start zone filled front-to-back, and
// once it was full you simply got "No free space for that right now" with no way to rearrange.
//
// decorate.js had select()/move()/rotate()/undo()/redo() written and working, and ZERO callers —
// the dock toggled a mode and toasted "drag decorations to arrange your farm" while nothing
// implemented the drag. This module is what those two halves were missing.
//
// It is deliberately DOM-free: input.js drives it, renderer.js draws the ghost from ghost(), and
// nothing here touches the document. That keeps it testable under Node like every other rules
// module in src/.

import * as state from './state.js';
import * as farm from './farm.js';
import { STRUCTURES, FARM } from './data.js';

let session = null;

/** Footprint for a kind/type pair — farm.js's own footprintOf(), so the ghost can never disagree
 *  with the placement check about how big a thing is. */
const footprintOf = farm.footprintOf;

/**
 * The world's fixed systems (order board, barn, lake, mine entrance...) are NOT in
 * state.farm.objects, so farm.canPlace() cannot see them and will happily report a tile free that
 * the silo is standing on. ui.js already carried this check for exactly that reason; the ghost
 * needs it too or it would show green over the barn.
 */
function overlapsAnyStructure(x, y, w, h) {
  for (const def of Object.values(STRUCTURES)) {
    const [sw, sh] = def.size;
    if (x < def.pos.x + sw && x + w > def.pos.x && y < def.pos.y + sh && y + h > def.pos.y) return true;
  }
  return false;
}

/** Is this footprint legal at this tile? Ignores `exceptId` so a move can overlap its own origin. */
export function isLegal(x, y, w, h, exceptId = null) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x + w > FARM.gridSize || y + h > FARM.gridSize) return false;
  if (overlapsAnyStructure(x, y, w, h)) return false;

  // Every covered tile must be on land the player has actually unlocked. farm.canPlace() checks
  // this too, but it also rejects overlap with EVERY object including the one being moved, so a
  // move could never be legal anywhere. Checking the two conditions separately is what lets the
  // same predicate serve both a fresh build and a relocation.
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!farm.isUnlockedTile(x + i, y + j)) return false;
    }
  }

  const s = state.state;
  if (!s) return false;
  for (const o of s.farm.objects) {
    if (o.id === exceptId) continue;
    const [ow, oh] = footprintOf(o.kind, o.type);
    if (x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y) return false;
  }
  return true;
}

/** Start placing a NEW object. `commit` runs only once a legal tile is confirmed. */
export function begin(kind, type, { onPlaced = null, label = '' } = {}) {
  const [w, h] = footprintOf(kind, type);
  const start = suggestTile(w, h);
  session = {
    mode: 'new', kind, type, w, h, label,
    tx: start[0], ty: start[1], objectId: null, origin: null, onPlaced,
  };
  return session;
}

/** Pick an EXISTING object up to relocate it. Cancelling puts it back where it was. */
export function beginMove(objectId) {
  const s = state.state;
  const obj = s?.farm.objects.find((o) => o.id === objectId);
  if (!obj) return null;
  const [w, h] = footprintOf(obj.kind, obj.type);
  session = {
    mode: 'move', kind: obj.kind, type: obj.type, w, h, label: '',
    tx: obj.x, ty: obj.y, objectId, origin: { x: obj.x, y: obj.y }, onPlaced: null, // origin: where the ghost opens
  };
  return session;
}

/** A sensible opening tile: the first free one, or the middle of the start zone if none is. */
function suggestTile(w, h) {
  const z = FARM.startZone;
  for (let y = z.y; y <= z.y + z.h - h; y++) {
    for (let x = z.x; x <= z.x + z.w - w; x++) {
      if (isLegal(x, y, w, h)) return [x, y];
    }
  }
  return [z.x + Math.floor((z.w - w) / 2), z.y + Math.floor((z.h - h) / 2)];
}

/** Drag/hover the ghost to a tile. Clamped to the grid so it can never leave the world. */
export function hover(tx, ty) {
  if (!session) return;
  session.tx = Math.max(0, Math.min(FARM.gridSize - session.w, Math.round(tx)));
  session.ty = Math.max(0, Math.min(FARM.gridSize - session.h, Math.round(ty)));
}

export function nudge(dx, dy) {
  if (!session) return;
  hover(session.tx + dx, session.ty + dy);
}

export function isActive() { return session !== null; }

/** What renderer.js needs to draw the ghost. Null when nothing is being placed. */
export function ghost() {
  if (!session) return null;
  return {
    kind: session.kind, type: session.type,
    tx: session.tx, ty: session.ty, w: session.w, h: session.h,
    mode: session.mode, label: session.label,
    legal: isLegal(session.tx, session.ty, session.w, session.h, session.objectId),
  };
}

/**
 * Commit the ghost. Returns { ok, reason, object }.
 *
 * A blocked tile is a NO-OP, not a failure: the session stays open so the player can simply keep
 * dragging. Bailing out here would throw away a crafted kit for a mis-tap.
 */
export function confirm() {
  if (!session) return { ok: false, reason: 'inactive' };
  const { tx, ty, w, h, objectId } = session;
  if (!isLegal(tx, ty, w, h, objectId)) return { ok: false, reason: 'blocked' };

  if (session.mode === 'move') {
    const moved = farm.move(objectId, tx, ty);
    if (!moved) return { ok: false, reason: 'blocked' };
    const done = session;
    session = null;
    return { ok: true, reason: 'moved', object: state.state.farm.objects.find((o) => o.id === done.objectId) };
  }

  const obj = farm.place(session.kind, session.type, tx, ty);
  if (!obj) return { ok: false, reason: 'refused' };
  const cb = session.onPlaced;
  session = null;
  if (cb) cb(obj);
  return { ok: true, reason: 'placed', object: obj };
}

/**
 * Abandon the session.
 *
 * There is deliberately no "put it back" step here: hover() moves the GHOST only, and the real
 * object is not touched until confirm() calls farm.move(). So a cancelled move has nothing to
 * restore, by construction. An earlier draft carried a restore call for safety, and the test
 * written to protect it passed even with that call deleted - a guard that cannot fail is
 * decoration, so both are gone rather than kept as reassurance.
 */
export function cancel() {
  if (!session) return false;
  session = null;
  return true;
}
