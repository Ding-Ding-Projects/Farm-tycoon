// shell.js — the surface every verb is played inside. The shell is shared; the stage is not.
//
// Written once so a verb never has to: the modal, the header, the stage pips, the rAF clock,
// input binding, the aria-live region, teardown, and the commit-then-render ordering that makes
// a stage score survive a reload. A verb supplies a model and a view and nothing else.
//
// Loaded dynamically by ui.js the first time a playable craft is opened, so none of this is on
// the boot path.

import { state, save } from '../state.js';
import * as minigames from '../minigames.js';
import { VERBS } from '../data.js';
import * as audio from '../audio.js';
import { createInput } from './input.js';
import { loadVerb } from './registry.js';

const DEFAULT_DURATION_MS = 12000;

function el(doc, tag, cls, text) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/**
 * Play one stage of a craft. Resolves when the stage is committed or the player leaves.
 *
 * Returns { committed, abandoned, result } — `result` is minigames.commitStage's return, so the
 * caller learns whether the whole chain just finished and at what tier.
 */
export async function playStage(host, entry, { onClose } = {}) {
  const doc = host.ownerDocument;
  const stages = minigames.chainFor(entry);
  const index = entry.play.stage;
  const stageDef = stages[index] || {};
  const meta = VERBS[stageDef.verb] || { name: stageDef.verb, family: 'sequence', hint: '' };

  const assist = !!(state.settings && state.settings.assist);
  const reducedMotion = typeof doc.defaultView?.matchMedia === 'function'
    ? doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // ---- chrome -------------------------------------------------------------------------
  host.innerHTML = '';
  const wrap = el(doc, 'div', 'minigame');

  const head = el(doc, 'div', 'minigame-head');
  const titles = el(doc, 'div');
  titles.appendChild(el(doc, 'div', 'title', meta.name));
  titles.appendChild(el(doc, 'div', 'purpose', meta.purpose || ''));
  head.appendChild(titles);

  const steps = el(doc, 'div', 'minigame-steps');
  steps.setAttribute('aria-label', `Step ${index + 1} of ${stages.length}`);
  for (let i = 0; i < stages.length; i++) {
    const dot = el(doc, 'span', 'step');
    if (i < index) dot.classList.add('done');
    if (i === index) dot.classList.add('current');
    steps.appendChild(dot);
  }
  head.appendChild(steps);

  const scoreBadge = el(doc, 'div', 'score', '0%');
  head.appendChild(scoreBadge);
  wrap.appendChild(head);

  wrap.appendChild(el(doc, 'p', 'minigame-hint', meta.hint || ''));

  const stage = el(doc, 'div', 'game-stage');
  wrap.appendChild(stage);

  const live = el(doc, 'div', 'sr-live');
  live.setAttribute('aria-live', 'polite');
  wrap.appendChild(live);

  const actions = el(doc, 'div', 'minigame-actions');
  wrap.appendChild(actions);
  host.appendChild(wrap);

  const announce = (text) => { live.textContent = text; };

  // ---- the verb -----------------------------------------------------------------------
  const mod = await loadVerb(stageDef.verb);
  if (!mod) {
    // A rejected import on a REQUIRED craft would be a hard block, so it lands here rather than
    // in a console nobody reads. The same floor-tier path the accessibility hatch uses.
    stage.appendChild(el(doc, 'p', 'minigame-hint',
      'This game could not be loaded. You can finish the batch plain — no bonus, but nothing is lost.'));
    const plain = el(doc, 'button', 'btn', 'Finish it plain');
    plain.addEventListener('click', () => {
      const result = minigames.finishPlain(entry);
      save();
      if (onClose) onClose({ committed: true, abandoned: false, result });
    });
    actions.appendChild(plain);
    return { committed: false, abandoned: false, result: null, failedToLoad: true };
  }

  const seed = minigames.stageSeed(entry, index);
  const durationMs = (meta.durationMs || DEFAULT_DURATION_MS) * (assist ? 2 : 1);
  const model = mod.create(seed, { assist, durationMs, reducedMotion });
  const view = mod.mount(stage, { assist, reducedMotion, announce });
  const input = createInput(meta.family, stage, { lanes: meta.lanes || 3 });

  // Paint one frame BEFORE the loop starts. A view that builds part of its board on first
  // render (rather than in mount) would otherwise show an empty stage until the first
  // animation frame arrives - and a throttled or background tab may not deliver one promptly.
  // Doing it here fixes it for every verb at once instead of constraining how each one is written.
  try { view.render(model.snapshot()); } catch { /* a broken first paint must not block the game */ }

  let raf = 0;
  let last = 0;
  // Audio is driven off progress() and score(), never off a verb's own fields, so the shell needs
  // to know nothing about any particular game. Progress is quantised into sixteenths: a beat fires
  // at most sixteen times a stage, which is frequent enough to feel responsive and infrequent
  // enough not to become a drone. Whether that beat sounds like a hit or a miss is decided by
  // whether the score moved across it, which is true for every verb by construction.
  const BEATS = 16;
  let lastBeat = -1;
  let scoreAtBeat = 0;
  let torn = false;
  let settled = null;

  function teardown() {
    if (torn) return;
    torn = true;
    if (raf) doc.defaultView.cancelAnimationFrame(raf);
    input.destroy();
    try { view.unmount(); } catch { /* a broken view must never block the close */ }
  }

  return await new Promise((resolve) => {
    function finish(outcome) {
      if (settled) return;
      settled = outcome;
      teardown();
      resolve(outcome);
      if (onClose) onClose(outcome);
    }

    // Leaving mid-stage keeps every COMMITTED stage and loses only the partial run. The derived
    // seed means re-entering rebuilds the identical board, so this is not a reroll.
    const leave = el(doc, 'button', 'btn quiet', 'Leave for now');
    leave.addEventListener('click', () => {
      minigames.abandon(entry);
      save();
      finish({ committed: false, abandoned: true, result: null });
    });
    actions.appendChild(leave);

    if (state.settings && state.settings.autoFinish) {
      const plain = el(doc, 'button', 'btn quiet', 'Let the machine finish it');
      plain.addEventListener('click', () => {
        const result = minigames.finishPlain(entry);
        save();
        finish({ committed: true, abandoned: false, result });
      });
      actions.appendChild(plain);
    }

    function frame(now) {
      if (torn) return;
      const dt = last ? Math.min(64, now - last) : 16; // clamp so a background tab cannot skip a round
      last = now;

      model.step(dt, input.read(dt));
      view.render(model.snapshot());
      const now01 = model.score();
      scoreBadge.textContent = `${Math.round(now01 * 100)}%`;

      const beat = Math.floor(model.progress() * BEATS);
      if (beat > lastBeat) {
        if (lastBeat >= 0) {
          if (now01 > scoreAtBeat + 1e-6) audio.minigameHit(meta.family);
          else audio.minigameMiss();
        }
        lastBeat = beat;
        scoreAtBeat = now01;
      }

      if (model.done()) {
        // COMMIT FIRST, then render anything. The score is in the save before a result screen
        // exists, so a reload at this instant resumes at the next stage rather than replaying.
        const result = minigames.commitStage(entry, model.score());
        save();
        if (result && result.done) audio.craftFinished(result.tier);
        else audio.stageDone();
        finish({ committed: true, abandoned: false, result });
        return;
      }
      raf = doc.defaultView.requestAnimationFrame(frame);
    }
    raf = doc.defaultView.requestAnimationFrame(frame);
    stage.focus();
  });
}
