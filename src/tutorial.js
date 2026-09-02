// tutorial.js — guided-intro step machine over data.js TUTORIAL.steps.
// Each step names a `target` (a dock/world/panel selector hint, purely descriptive — the
// bubble text is what actually guides the player) and an `event` that advances it. Other
// modules (input.js, ui.js, production.js-adjacent code) call emit(eventName) whenever
// something tutorial-relevant happens; this module only cares whether the current step's
// event matches.

import { TUTORIAL } from './data.js';
import { state } from './state.js';
import * as economy from './economy.js';

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

function isFinished() {
  return !!(state.tutorial && state.tutorial.finished);
}

function render() {
  if (!overlay) return;
  if (!active || currentIndex < 0 || currentIndex >= TUTORIAL.steps.length) {
    overlay.hidden = true;
    return;
  }
  const step = TUTORIAL.steps[currentIndex];
  overlay.hidden = false;
  // Every step gets a real Next button and a Skip, ALWAYS — including the steps that are
  // waiting on a game event. The tutorial is guidance, never a gate: if a player cannot find
  // the thing being pointed at, or simply wants to get on with it, the bubble must never be
  // the reason they are stuck staring at the same sentence.
  bubble.innerHTML = `<div class="speaker"><span class="avatar" aria-hidden="true"></span><span>Farmhand Ellie</span>`
    + `<span class="tutorial-step-count">${currentIndex + 1}/${TUTORIAL.steps.length}</span></div>`
    + `<p>${step.text}</p>`
    + `<div class="tutorial-actions">`
    + `<button type="button" class="tutorial-skip" id="tutorial-skip">Skip tutorial</button>`
    + `<button type="button" class="tutorial-next" id="tutorial-next">${currentIndex + 1 >= TUTORIAL.steps.length ? "Finish" : "Next"}</button>`
    + `</div>`;
  bubble.querySelector("#tutorial-next").addEventListener("click", (e) => { e.stopPropagation(); advance(); });
  bubble.querySelector("#tutorial-skip").addEventListener("click", (e) => { e.stopPropagation(); skip(); });
  // Position the bubble/arrow near the described target if it resolves to a live DOM node;
  // otherwise center it — every step still reads fine centered, this is a nicety only.
  let anchor = null;
  if (step.target && step.target.startsWith('dock:')) {
    anchor = document.querySelector(`.dock-btn[data-panel="${step.target.slice(5)}"]`);
  } else if (step.target && step.target.startsWith('panel:')) {
    anchor = document.querySelector(step.target.slice(6));
  }
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    spotlight.hidden = false;
    spotlight.style.left = `${r.left - 6}px`;
    spotlight.style.top = `${r.top - 6}px`;
    spotlight.style.width = `${r.width + 12}px`;
    spotlight.style.height = `${r.height + 12}px`;
    arrow.hidden = false;
    arrow.style.left = `${r.left + r.width / 2 - 14}px`;
    arrow.style.top = `${r.top - 40}px`;
    bubble.style.left = `${Math.max(12, Math.min(window.innerWidth - 300, r.left))}px`;
    bubble.style.bottom = '';
    bubble.style.top = `${Math.min(window.innerHeight - 140, r.bottom + 16)}px`;
  } else {
    spotlight.hidden = true;
    arrow.hidden = true;
    bubble.style.left = '50%';
    bubble.style.top = '';
    bubble.style.bottom = '110px';
    bubble.style.transform = 'translateX(-50%)';
  }
}

function finish() {
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
  const step = TUTORIAL.steps[currentIndex];
  if (step && step.event === 'dismissed') {
    // A pure informational bubble ("welcome"/"done") — dismissed by the player tapping it.
  }
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
 * timer elapses, so nobody would ever call emit() for it). Poll those here instead.
 */
export function checkAutoEvents() {
  if (!active || currentIndex < 0) return;
  const step = TUTORIAL.steps[currentIndex];
  if (!step) return;
  if (step.event === 'crop_ready') {
    const now = Date.now();
    const ready = state.farm.objects.some((o) => o.kind === 'field' && o.cropId && o.readyAt && o.readyAt <= now);
    if (ready) advance();
  }
}

/** Skip the whole tutorial (settings option). */
export function skip() { finish(); }

export function isActive() { return active; }

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
