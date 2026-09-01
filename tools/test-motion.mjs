// test-motion.mjs — prefers-reduced-motion reaches the canvas, not just the stylesheet.
//
// styles.css had honoured the preference from early on with a blanket rule flattening every CSS
// animation and transition, which made it LOOK handled. It was not: the world is a canvas, so the
// machinery turning on every working factory, the coin bursts, the XP floaters, the harvest
// sparkles and the camera easing are all drawn frame by frame in JavaScript where no stylesheet
// can reach. Only the minigame shell read the preference, and only for itself.
//
// The check that matters most here is the one about INFORMATION. Turning the animation off must
// not turn a working factory into an idle-looking one - a state may never be signalled by motion
// alone, exactly as it may never be signalled by colour alone. So `working` stays true and only
// the clock freezes.
//
// Written in Node rather than the browser on purpose. Verifying this through a page meant
// cache-busting the import, which hands the test a DIFFERENT motion module instance from the one
// effects.js imports - so setting the flag on one had no effect on the other and the suppression
// looked broken when it was fine. Node has one module registry and no HTTP cache.

import assert from 'node:assert/strict';
import * as motion from '../src/motion.js';
import * as effects from '../src/render/effects.js';
import * as sprites from '../src/render/sprites.js';

let passed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  - ${name}`); }
  catch (err) {
    failures.push({ name, err });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

console.log('\nReduced motion\n');

test('it defaults to off, and init() is safe where there is no matchMedia', () => {
  assert.equal(motion.isReduced(), false, 'nothing may be reduced until the platform says so');
  assert.doesNotThrow(() => motion.init(), 'init() must no-op under Node rather than throwing');
  assert.equal(motion.isReduced(), false);
});

test('phase freezes the animation clock, ease turns a glide into a snap', () => {
  motion.__setReducedForTests(false);
  assert.equal(motion.phase(123456), 123456, 'normally the clock passes straight through');
  assert.equal(motion.ease(0.1), 0.1, 'and easing is left alone');

  motion.__setReducedForTests(true);
  assert.equal(motion.phase(123456), 0, 'reduced motion pins the clock to one instant');
  assert.equal(motion.ease(0.1), 1, 'and easing becomes an immediate arrival');
  motion.__setReducedForTests(false);
});

test('particle spawners produce nothing at all under reduced motion', () => {
  motion.__setReducedForTests(true);
  const before = effects.particleCount();
  effects.coinBurst(100, 100, 5000);
  effects.xpFloater(100, 100, 20);
  effects.sparkle(100, 100);
  assert.equal(effects.particleCount(), before,
    'a burst of objects flying outward under gravity is pure decoration - it must not be spawned '
    + 'at all, rather than spawned and skipped at draw time');
  motion.__setReducedForTests(false);
});

test('and produce plenty when it is off, so the suppression is really the cause', () => {
  // The other half of the previous test. Without this, a spawner that was broken for an unrelated
  // reason would pass the suppression check perfectly.
  motion.__setReducedForTests(false);
  const before = effects.particleCount();
  effects.coinBurst(100, 100, 5000);
  effects.xpFloater(100, 100, 20);
  effects.sparkle(100, 100);
  assert.ok(effects.particleCount() > before + 5,
    'with the preference off these must spawn as they always did');
});

test('a working factory still LOOKS like one with the clock frozen', () => {
  // The information rule. drawBuilding is handed `working: true` and a frozen `now`, and the
  // static signals it already carried - a lit lantern, an orange firebox, a four-puff plume where
  // an idle chimney shows a single wisp - have to survive that. Proven by drawing the same
  // building working and idle at the SAME frozen instant and requiring the two to differ.
  const calls = { working: [], idle: [] };
  const recorder = (bucket) => new Proxy({}, {
    get(_t, k) {
      if (k === 'canvas') return { width: 300, height: 300 };
      if (k === 'save' || k === 'restore' || k === 'beginPath' || k === 'closePath') return () => {};
      return (...args) => { bucket.push(`${String(k)}(${args.join(',')})`); };
    },
    set(_t, k, v) { bucket.push(`${String(k)}=${v}`); return true; },
  });

  // Imported at the top, NOT with a dynamic import inside here. test() is synchronous, so
  // returning a promise from it marks the test passed before the assertion in the .then() has
  // run - which would make this particular guard, the one protecting against losing information,
  // incapable of ever failing.
  sprites.drawBuilding(recorder(calls.working), 150, 150, 0.78, 'bakery', { working: true, now: 0 });
  sprites.drawBuilding(recorder(calls.idle), 150, 150, 0.78, 'bakery', { working: false, now: 0 });
  assert.notDeepEqual(calls.working, calls.idle,
    'at one frozen instant a working factory drew exactly what an idle one drew - so with the '
    + 'animation off there would be no way at all to tell which of your factories are busy');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
