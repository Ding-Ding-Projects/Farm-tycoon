// main.js — boot + game loop.
// Boot order: state.load() → renderer.init → ui.init → input.init → audio.init (deferred to
// first gesture) → tutorial.init → resolve offline progress (production.tick(now)) → rAF loop.
// Loop each frame: production/shop/orders/boat/event ticks → camera tick → drawFrame → updateHud.
// Autosave every state.settings.autosaveInterval seconds and on beforeunload.
//
// Debug hook (used by the playtest skill; harmless in production):
//   window.__farmDebug = { timeSkip(ms), state, give(itemId, qty) }

import * as state from './state.js';

function boot() {
  state.load();
  // Phase B: full boot sequence per the comment above.
  const el = document.getElementById('boot-status');
  if (el) el.textContent = 'Farm Tycoon scaffold — gameplay arrives in Phase B.';
}

window.addEventListener('DOMContentLoaded', boot);
