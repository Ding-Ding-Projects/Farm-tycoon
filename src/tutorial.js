// tutorial.js — guided-intro step machine over data.js TUTORIAL.steps.
// Each step names a `target` (what the bubble points at) and an `event` that advances it. Other
// modules (input.js, ui.js) call emit(eventName) whenever something tutorial-relevant happens;
// this module only cares whether the current step's event matches.
//
// Targets are REAL: 'world:field' | 'world:pen' | 'world:building' anchor to a placed object,
// 'world:structure:<STRUCTURES key>' to a fixed structure, 'dock:<panel>' to a dock button and
// 'panel:<selector>' to a node inside the open sheet. World anchors are projected through the
// renderer every frame while the step is showing, so the spotlight stays on its plot when the
// camera glides. (The old steps pointed at dock buttons that no longer exist and described a
// drag-to-plant that never did; world targets were never anchored at all.)

import { TUTORIAL, STRUCTURES } from './data.js';
import { state } from './state.js';
import * as economy from './economy.js';
import * as farm from './farm.js';
import * as renderer from './render/renderer.js';

let overlay, spotlight, arrow, bubble;
let currentIndex = -1;
let active = false;
const listeners = [];

/** Subscribe to tutorial lifecycle changes: fn({stepIndex, step, active}). */
export function onChange(fn) { listeners.push(fn); }
function notify() {
  const step = currentIndex >= 0 ? TUTORIAL.steps[currentIndex] : null;
  for (const fn of listeners) {
    try { fn({ stepIndex: currentIndex, step, active }); } catch { /* never break the game */ }
  }
}

export function isFinished() {
  return !!(state.tutorial && state.tutorial.finished);
}

/** The farm object a 'world:field|pen|building' target means for this step: the field being
 *  grown/harvested, the empty one to plant, the newest pen, the bakery. */
function worldObjectFor(kind, step) {
  const objects = state?.farm?.objects || [];
  if (kind === 'field') {
    const fields = objects.filter((o) => o.kind === 'field');
    const growing = fields.find((o) => o.cropId);
    if (step?.event === 'planted') return fields.find((o) => !o.cropId) || fields[0] || null;
    return growing || fields[0] || null;
  }
  if (kind === 'pen') {
    const pens = objects.filter((o) => o.kind === 'pen');
    return pens[pens.length - 1] || null;
  }
  if (kind === 'building') {
    const buildings = objects.filter((o) => o.kind === 'building');
    return buildings.find((o) => o.type === 'bakery') || buildings[buildings.length - 1] || null;
  }
  return null;
}

/**
 * Screen circle {x, y, r} for a world target, or null when nothing matches yet (a pen that is not
 * built; a step whose target is a panel that is not open). Exported so the UI contract test can
 * prove every target in TUTORIAL resolves to something real.
 */
export function resolveTarget(target, step = null) {
  if (!target) return null;
  if (target.startsWith('world:structure:')) {
    const def = STRUCTURES[target.slice('world:structure:'.length)];
    if (!def) return null;
    return anchorOf({ tx: def.pos.x, ty: def.pos.y, fw: def.size[0], fh: def.size[1] });
  }
  if (target.startsWith('world:')) {
    const obj = worldObjectFor(target.slice(6), step);
    if (!obj) return null;
    const [fw, fh] = farm.footprintOf(obj.kind, obj.type);
    return anchorOf({ tx: obj.x, ty: obj.y, fw, fh });
  }
  return null;
}

function anchorOf(obj) {
  const vp = typeof renderer.getViewport === 'function' ? renderer.getViewport() : { w: 1280, h: 800 };
  const [sx, sy, size] = renderer.objectAnchor(obj, vp.w, vp.h);
  const T = renderer.TILE_BASE * (renderer.camera?.zoom ?? 1);
  return { x: sx, y: sy + T / 2 * Math.max(0.5, size * 0.5), r: Math.max(34, T * size * 0.55) };
}

function domAnchor(target) {
  if (typeof document === 'undefined') return null;
  if (target.startsWith('dock:')) return document.querySelector(`.dock-btn[data-panel="${target.slice(5)}"]`);
  if (target.startsWith('panel:')) {
    const sheet = document.getElementById('sheet');
    if (!sheet || sheet.hidden) return null;
    return sheet.querySelector(target.slice(6));
  }
  return null;
}

function placeAt(circle, anchoredToWorld) {
  spotlight.hidden = false;
  spotlight.style.left = `${circle.x - circle.r}px`;
  spotlight.style.top = `${circle.y - circle.r}px`;
  spotlight.style.width = `${circle.r * 2}px`;
  spotlight.style.height = `${circle.r * 2}px`;
  arrow.hidden = false;
  arrow.style.left = `${circle.x - 14}px`;
  arrow.style.top = `${circle.y - circle.r - 44}px`;
  const w = window.innerWidth || 1280, h = window.innerHeight || 800;
  bubble.style.transform = '';               // the centred fallback's translateX(-50%) must not linger
  bubble.style.left = `${Math.max(12, Math.min(w - 312, circle.x - 150))}px`;
  bubble.style.bottom = '';
  // Below the target when there is room, above it otherwise - a bubble under a plot at the
  // bottom of the screen used to sit off the display.
  const below = circle.y + circle.r + 16;
  bubble.style.top = below + 140 <= h ? `${below}px` : `${Math.max(12, circle.y - circle.r - 156)}px`;
  keepClearOfSheet();
  overlay.dataset.anchored = anchoredToWorld ? 'world' : 'dom';
}

/**
 * Keep the bubble off the open sheet panel.
 *
 * Several steps say "tap the silo" or "open the build menu", and the moment the player does,
 * the sheet slides up from the bottom - straight under a bubble that is usually anchored low,
 * because the thing it was pointing at is usually low. So the instruction ends up covering the
 * panel it just asked you to open, which is the exact opposite of guidance.
 */
function keepClearOfSheet() {
  const sheet = document.getElementById('sheet');
  if (!sheet || sheet.hidden || typeof sheet.getBoundingClientRect !== 'function') return;
  const panel = sheet.getBoundingClientRect();
  if (!panel.height) return;
  const box = bubble.getBoundingClientRect();
  if (!box.height) return;
  const overlaps = box.bottom > panel.top && box.top < panel.bottom
    && box.right > panel.left && box.left < panel.right;
  if (!overlaps) return;
  // Above the panel if there is room for the whole bubble, otherwise pinned to the top margin -
  // never partly off-screen, which is the failure the old bottom-anchored fallback had.
  const wanted = panel.top - box.height - 12;
  bubble.style.bottom = '';
  bubble.style.top = `${Math.max(12, wanted)}px`;
}

function render() {
  if (!overlay) return;
  if (!active || currentIndex < 0 || currentIndex >= TUTORIAL.steps.length) {
    overlay.hidden = true;
    return;
  }
  const step = TUTORIAL.steps[currentIndex];
  overlay.hidden = false;
  // Every step gets a real Next button and a Skip, ALWAYS - including the steps that are
  // waiting on a game event. The tutorial is guidance, never a gate: if a player cannot find
  // the thing being pointed at, or simply wants to get on with it, the bubble must never be
  // the reason they are stuck staring at the same sentence.
  bubble.innerHTML = `<div class="speaker"><span class="avatar" aria-hidden="true"></span><span>Farmhand Ellie</span>`
    + `<span class="tutorial-step-count">${currentIndex + 1}/${TUTORIAL.steps.length}</span></div>`
    + `<p>${step.text}</p>`
    + `<div class="tutorial-actions">`
    + `<button type="button" class="tutorial-skip" id="tutorial-skip">Skip tutorial</button>`
    + `<button type="button" class="tutorial-next" id="tutorial-next">${currentIndex + 1 >= TUTORIAL.steps.length ? 'Finish' : 'Next'}</button>`
    + `</div>`;
  bubble.querySelector('#tutorial-next').addEventListener('click', (e) => { e.stopPropagation(); advance(); });
  bubble.querySelector('#tutorial-skip').addEventListener('click', (e) => { e.stopPropagation(); skip(); });

  const el = step.target ? domAnchor(step.target) : null;
  if (el && typeof el.getBoundingClientRect === 'function') {
    const r = el.getBoundingClientRect();
    placeAt({ x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 + 6 }, false);
    return;
  }
  const circle = step.target ? resolveTarget(step.target, step) : null;
  if (circle) { placeAt(circle, true); return; }

  spotlight.hidden = true;
  arrow.hidden = true;
  bubble.style.left = '50%';
  bubble.style.top = '';
  bubble.style.bottom = '110px';
  bubble.style.transform = 'translateX(-50%)';
  overlay.dataset.anchored = 'none';
}

function finish() {
  if (isFinished()) return;   // never a second reward: Skip after the last step, or a double call
  active = false;
  currentIndex = TUTORIAL.steps.length;
  if (state.tutorial) state.tutorial.finished = true;
  else state.tutorial = { stepIndex: -1, finished: true };
  const r = TUTORIAL.finishReward;
  if (r) {
    if (r.coins) economy.addCoins(r.coins);
    if (r.xp) economy.addXp(r.xp);
    if (r.diamonds) state.diamonds += r.diamonds;
  }
  render();
  notify();
}

function goTo(index) {
  currentIndex = index;
  if (state.tutorial) state.tutorial.stepIndex = index;
  render();
  notify();
}

/** Advance past the current step, or dismiss straight to the end if `dismissed` is the gate. */
function advance() {
  if (currentIndex + 1 >= TUTORIAL.steps.length) { finish(); return; }
  goTo(currentIndex + 1);
}

/** Called from input.js/ui.js whenever a tutorial-relevant thing happens in the game. */
export function emit(eventName) {
  if (!active || currentIndex < 0) return;
  const step = TUTORIAL.steps[currentIndex];
  if (!step) return;
  if (step.event === eventName) advance();
}

/**
 * Called once per frame from main.js's loop. A few TUTORIAL.steps gate on a passive world
 * state rather than a discrete player action (e.g. 'crop_ready' — nothing "happens" when a
 * timer elapses, so nobody would ever call emit() for it). Poll those here, and keep a world-
 * anchored spotlight on its plot while the camera moves.
 */
export function checkAutoEvents() {
  if (!active || currentIndex < 0) return;
  const step = TUTORIAL.steps[currentIndex];
  if (!step) return;
  if (step.event === 'crop_ready') {
    const now = Date.now();
    const ready = state.farm.objects.some((o) => o.kind === 'field' && o.cropId && o.readyAt && o.readyAt <= now);
    if (ready) { advance(); return; }
  }
  if (overlay && !overlay.hidden && step.target && step.target.startsWith('world:')) render();
}

/** Skip the whole tutorial (settings option). Pays the finish reward once, never twice. */
export function skip() { finish(); }

/**
 * Re-place the bubble without changing step. ui.js calls this whenever a sheet panel opens or
 * closes, because that is when the bubble's clear space appears and disappears - the tutorial
 * itself has no way to notice a panel it did not open.
 */
export function reposition() { if (active) render(); }

export function isActive() { return active; }

/** The step currently showing, for the settings panel and tests. */
export function currentStep() {
  return active && currentIndex >= 0 ? TUTORIAL.steps[currentIndex] : null;
}

/** Wire DOM + resume/start based on saved progress. */
export function init() {
  overlay = document.getElementById('tutorial');
  spotlight = document.getElementById('tutorial-spotlight');
  arrow = document.getElementById('tutorial-arrow');
  bubble = document.getElementById('tutorial-bubble');
  if (!overlay) return;

  overlay.addEventListener('click', () => {
    const step = TUTORIAL.steps[currentIndex];
    if (step && step.event === 'dismissed') advance();
  });
  window.addEventListener('resize', render);

  if (!state.tutorial) state.tutorial = { stepIndex: 0, finished: false };
  if (isFinished()) { active = false; return; }
  active = true;
  goTo(Math.max(0, Math.min(state.tutorial.stepIndex || 0, TUTORIAL.steps.length - 1)));
}
