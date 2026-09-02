// drag.js — the one drag layer. Hay Day's whole interaction model is "pick a thing up from a
// strip and put it on the world": a building out of the catalog, a recipe onto its factory, feed
// onto the animals, a seed swept across the fields. Every one of those is this module. ui.js
// starts a drag from a card or a ring button, input.js feeds it the pointer, and the world
// (farm.js) is the drop target.
//
// A press that never moves past the tap threshold is NOT a drag: end() returns false and the
// card's own click runs, so every tap path stays exactly as it was - which is also the keyboard
// and accessibility floor (a ghost can still be tapped and nudged into place).
//
// Two kinds. A 'place' drag begins a placement session once it is live (the canvas ghost is the
// picture) and commits it on release over a legal tile; released anywhere else the ghost STAYS
// for tap-to-place, because a mis-drop must never cost a crafted kit. An 'item' drag carries a
// DOM icon under the finger (#drag-ghost), reports every new target through onEnter (that is how
// one stroke sows a whole row) and drops through canDrop/onDrop; a `sweep` spec does its work in
// onEnter and nothing on release.

import * as farm from './farm.js';
import * as placement from './placement.js';
import * as renderer from './render/renderer.js';
import * as effects from './render/effects.js';

export const TAP_MOVE_THRESHOLD = 6; // px, the same as input.js's tap threshold

let canvasRef = null;
let session = null;

/** Hand the layer the canvas: a live drag captures its pointer there, because the card it
 *  started on is removed when the sheet closes and capture keeps the rest of the gesture coming. */
export function init(canvas) { canvasRef = canvas || null; }

function ghostEl() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('drag-ghost');
}

/** Everything under a screen point: the tile, the placed object, the fixed structure. */
export function targetAt(sx, sy) {
  const vp = renderer.getViewport();
  const [fx, fy] = renderer.screenToTile(sx, sy, vp.w, vp.h);
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const obj = farm.objectAt(tx, ty);
  const struct = obj ? null : farm.structureAt(tx, ty);
  const key = obj ? `obj:${obj.id}` : struct ? `struct:${struct.key}` : `tile:${tx},${ty}`;
  return { tx, ty, obj, struct, key };
}

/**
 * Arm a drag on pointerdown. `spec`:
 *   kind: 'place' | 'item'
 *   place: { kind, type, onPlaced(obj) }        place drags; placement.begin runs once live
 *   icon, label                                  item drags: what rides under the finger
 *   onStart()                                    the drag went live (close the sheet / ring)
 *   onEnter(target)                              item: every NEW target under the pointer
 *   canDrop(target) -> bool                      item: may this target take the drop (and the
 *                                                highlight colour); sweeps use it for the tint
 *   onDrop(target)                               item: released over a target canDrop accepted
 *   sweep: true, onEnd(target)                   item: onEnter did the work; release only ends it
 *   onCancel(target | null)                      released elsewhere, or the gesture was cancelled
 *   onBlocked(result)                            place: released over an illegal tile (ghost stays)
 */
export function start(spec, e) {
  if (!spec || !e) return false;
  if (typeof e.button === 'number' && e.button !== 0) return false;   // a right/middle press is not a drag
  cancel();
  session = {
    spec, pointerId: e.pointerId ?? 0, startX: e.clientX || 0, startY: e.clientY || 0,
    live: false, lastKey: null, target: null,
  };
  return true;
}

export function isPending() { return !!session && !session.live; }
export function isActive() { return !!session && session.live; }
export function current() { return session ? session.spec : null; }

/** The drop target under the pointer for the renderer's highlight: { tx, ty, fw, fh, ok, objectId }
 *  or null. Place drags have the placement ghost as their picture, so they report nothing here. */
export function target() {
  if (!session || !session.live || session.spec.kind !== 'item' || !session.target) return null;
  const t = session.target;
  let ok = false;
  try { ok = !!(session.spec.canDrop && session.spec.canDrop(t)); } catch { ok = false; }
  if (t.obj) {
    const [fw, fh] = farm.footprintOf(t.obj.kind, t.obj.type);
    return { tx: t.obj.x, ty: t.obj.y, fw, fh, ok, objectId: t.obj.id };
  }
  if (t.struct) {
    return { tx: t.struct.def.pos.x, ty: t.struct.def.pos.y, fw: t.struct.def.size[0], fh: t.struct.def.size[1], ok };
  }
  return { tx: t.tx, ty: t.ty, fw: 1, fh: 1, ok };
}

function goLive(x, y) {
  const s = session;
  s.live = true;
  try { canvasRef?.setPointerCapture?.(s.pointerId); } catch { /* not an active pointer (synthetic) */ }
  if (s.spec.kind === 'place') {
    const p = s.spec.place;
    placement.begin(p.kind, p.type, { label: s.spec.label || '', onPlaced: p.onPlaced || null });
  }
  if (s.spec.onStart) s.spec.onStart();
  const el = ghostEl();
  if (el && s.spec.kind === 'item') {
    el.textContent = s.spec.icon || '📦';
    el.hidden = false;
    if (s.spec.label && typeof el.setAttribute === 'function') el.setAttribute('aria-label', s.spec.label);
  }
  moveTo(x, y);
}

function moveTo(x, y) {
  const s = session;
  const t = targetAt(x, y);
  if (s.spec.kind === 'place') {
    // Centre the footprint on the pointer, the way input.js's hover does for a tap-started ghost.
    const g = placement.ghost();
    placement.hover(t.tx - Math.floor((g?.w || 1) / 2), t.ty - Math.floor((g?.h || 1) / 2));
    return;
  }
  const el = ghostEl();
  if (el && el.style) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
  s.target = t;
  if (t.key !== s.lastKey) {
    s.lastKey = t.key;
    if (s.spec.onEnter) s.spec.onEnter(t);
  }
}

/** Pointer moved. True when the event belonged to a drag (live, or just gone live). */
export function move(x, y) {
  if (!session) return false;
  if (!session.live) {
    if (Math.hypot(x - session.startX, y - session.startY) <= TAP_MOVE_THRESHOLD) return false;
    goLive(x, y);
    return true;
  }
  moveTo(x, y);
  return true;
}

function cleanup() {
  const el = ghostEl();
  if (el) el.hidden = true;
  session = null;
}

/** Pointer released. True when a live drag ended here (the release is not a tap); false for a
 *  press that never moved, which is the card's own tap and must run its click. */
export function end(x, y) {
  if (!session) return false;
  if (!session.live) { session = null; return false; }
  const s = session;
  if (s.spec.kind === 'place') {
    const res = placement.confirm();
    cleanup();
    if (res.ok) {
      if (res.object?.id) effects.placeBounce(res.object.id);
    } else if (s.spec.onBlocked) {
      s.spec.onBlocked(res);   // the ghost is still up: tap-to-place from here, Esc cancels
    }
    return true;
  }
  const t = targetAt(x, y);
  cleanup();
  if (s.spec.sweep) {
    if (s.spec.onEnd) s.spec.onEnd(t);
    return true;
  }
  let ok = false;
  try { ok = !!(s.spec.canDrop && s.spec.canDrop(t)); } catch { ok = false; }
  if (ok) { if (s.spec.onDrop) s.spec.onDrop(t); }
  else if (s.spec.onCancel) s.spec.onCancel(t);
  return true;
}

/** The gesture was interrupted (pointercancel, Escape). Nothing is spent. */
export function cancel() {
  if (!session) return false;
  const s = session;
  const wasLive = s.live;
  cleanup();
  if (wasLive) {
    if (s.spec.kind === 'place') placement.cancel();
    if (s.spec.onCancel) s.spec.onCancel(null);
  }
  return wasLive;
}
