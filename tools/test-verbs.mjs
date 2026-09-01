// tools/test-verbs.mjs — proves every registered verb, headlessly.
//
// Plain Node script, no test framework (the project has no dependencies). Exits 0 on
// success, non-zero on first failure category, with a printed summary either way.
//
// WHY THIS SUITE EXISTS. Playing is REQUIRED to collect a playable craft, so a verb that can
// stall is not a bad minigame — it is a craft the player can never finish and an item they can
// never obtain. Every verb therefore has to prove, mechanically, that it ends. The verb models
// are pure and DOM-free precisely so this can run under Node against all of them at once.
//
// Run: node tools/test-verbs.mjs

import assert from 'node:assert/strict';
import { VERB_LOADERS } from '../src/minigames/registry.js';
import { VERBS, BUILDINGS } from '../src/data.js';
import { families } from '../src/minigames/input.js';

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
async function testAsync(name, fn) {
  try { await fn(); passed++; console.log(`  ok  - ${name}`); }
  catch (err) {
    failures.push({ name, err });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Optimal drivers — hand-written, one per verb.
//
// A generic "play it well" driver cannot exist: knowing what good play IS is the whole content
// of a verb. So each one is written out by hand, and a test below asserts that EVERY registered
// verb has one. That is the difference between a rule that passes trivially on a verb nobody
// listed and a list that fails loudly when a verb goes missing from it.
// ---------------------------------------------------------------------------
// Each entry is a FACTORY returning a fresh driver. A driver that keeps closure state between
// runs (an angle, a remembered pattern) would make two identical runs diverge and the
// determinism test would fail against the TEST rather than the verb — which is exactly what
// happened when these were written as plain functions.
const OPTIMAL = {
  press_cutter: () => (snap) => (snap.live >= 0 ? { padIndex: snap.live } : null),

  whisk_batter: () => {
    let a = 0;
    return () => { a += 0.0416; return { x: 0.5 + Math.cos(a) * 0.4, y: 0.5 + Math.sin(a) * 0.4, down: true }; };
  },

  pour_tin: () => (snap) => ({ ax: -snap.leanX * 2, ay: -snap.leanY * 2 }),

  mind_oven: () => (snap) => ({ held: snap.heat < (snap.bandLow + snap.bandHigh) / 2, heldMs: 16 }),

  pipe_frosting: () => (snap) => {
    const p = snap.route[snap.target];
    return { x: p.x, y: p.y, down: true };
  },

  place_decor: () => {
    // Memory: watch the shown pattern, then play it back in order. Record on the RISING EDGE of
    // a pad lighting up, not by comparing values — a pattern may legitimately repeat a pad, and
    // deduping by value silently drops the second one.
    let seen = [];
    let prevLit = -1;
    return (snap) => {
      if (snap.phase === 'show') {
        if (snap.lit >= 0 && prevLit === -1) seen.push(snap.lit);
        prevLit = snap.lit;
        return null;
      }
      if (snap.phase === 'answer') {
        const next = seen.shift();
        return next === undefined ? null : { padIndex: next };
      }
      seen = [];
      prevLit = -1;
      return null;
    };
  },

  swirl_cone: () => (snap) => ({ rate: snap.want }),

  tie_bouquet: () => {
    // Tap once per beat, at the top of the pulse. Tracking the turn index stops one long
    // near-the-beat window being answered several times.
    let lastTurn = -1;
    return (snap) => {
      if (snap.pulse >= 0.95 && snap.turns !== lastTurn) {
        lastTurn = snap.turns;
        return { taps: [{ tMs: 0 }] };
      }
      return { taps: [] };
    };
  },

  sort_chillies: () => (snap) => ({ lane: snap.kind, commit: true }),

  season_pinch: () => {
    // The input layer builds charge while held; the driver has to model that itself, at the
    // same rate input.js uses (dt / 900), then let go once the pinch matches the ask.
    let charge = 0;
    return (snap) => {
      if (charge >= snap.want) { const out = { charge, fired: true }; charge = 0; return out; }
      charge = Math.min(1, charge + 16 / 900);
      return { charge, fired: false };
    };
  },

  cast_ingot: () => {
    // Aim needs BOTH halves: build power to the asked depth while already pointed at the
    // channel, then release. Power builds at input.js's own rate (dt / 1100).
    let power = 0;
    return (snap) => {
      if (power >= snap.wantDepth) {
        const out = { angle: snap.wantAngle, power, fired: true };
        power = 0;
        return out;
      }
      power = Math.min(1, power + 16 / 1100);
      return { angle: snap.wantAngle, power, fired: false };
    };
  },

  throw_shuttles: () => (snap) => ({ left: snap.wantLeft, right: snap.wantRight }),

  guide_dough: () => (snap) => {
    // Steer toward the lane centre and keep the throttle down. Proportional rather than
    // bang-bang, because the sheet carries momentum and overcorrecting oscillates.
    const err = snap.centre - snap.pos;
    return { steer: Math.max(-1, Math.min(1, err * 3)), throttle: 1 };
  },

  lay_slices: () => {
    // Carry one slice per frame to the plate it belongs on, working left to right.
    return (snap) => {
      const i = snap.placed.findIndex((p) => p === -1);
      if (i === -1) return { grabbed: -1, dropOn: -1, dropped: false };
      return { grabbed: i, dropOn: snap.belongs[i], dropped: true };
    };
  },

  stack_layers: () => (snap) => {
    // Ordering: find the tray slot holding the layer the pile wants next, and drop it on the pile.
    if (!snap.next) return { grabbed: -1, dropOn: -1, dropped: false };
    const i = snap.tray.findIndex((t) => !t.used && t.name === snap.next);
    if (i === -1) return { grabbed: -1, dropOn: -1, dropped: false };
    return { grabbed: i, dropOn: 0, dropped: true };
  },

  fold_shell: () => {
    // Speed-limited: creep down the fold line well under the crack threshold. Anything faster
    // scores worse, which is the whole point of the verb.
    let y = 0;
    return (snap) => {
      y = y >= 1 ? 0 : y + 0.012;
      return { x: snap.folds[snap.fold], y, down: true };
    };
  },

  pin_brim: () => (snap) => {
    // Symmetry: for each already-set pin, the one straight across is what the brim owes.
    const half = snap.pins / 2;
    for (const p of snap.pinned) {
      const across = (p + half) % snap.pins;
      if (!snap.pinned.includes(across)) return { padIndex: across };
    }
    return { padIndex: null };
  },

  roll_press: () => () => ({ left: 1, right: 1 }),   // both rollers equal and driven hard

  boil_size: () => (snap) => ({ held: snap.thickness < snap.ceiling * 0.97, heldMs: 16 }),

  dip_wick: () => (snap) => (snap.slot === 1 ? { taps: [{ tMs: 0 }] } : { taps: [] }),

  set_stone: () => (snap) => (snap.want >= 0 ? { padIndex: snap.want } : { padIndex: null }),

  // Zero-sum: only the ratio counts, so hand it the target share directly.
  blend_notes: () => (snap) => ({ left: snap.target, right: 1 - snap.target }),

  split_press: () => (snap) => {
    // Allocation: pour into whichever bottle is furthest below its share.
    let worst = 0;
    let gap = -Infinity;
    for (let i = 0; i < snap.bottles; i++) {
      const d = snap.targets[i] - snap.filled[i];
      if (d > gap) { gap = d; worst = i; }
    }
    return gap > 0 ? { lane: worst, commit: false } : { lane: -1, commit: false };
  },

  draw_steam: () => {
    // Come off on the WARNING, not on the burst - reacting once it has started is already too
    // late, which is the whole reason the burst is telegraphed. Between bursts, use hysteresis
    // rather than seeking the centre: bang-bang control oscillates across the band and spends
    // most of its time outside it.
    let rising = true;
    return (snap) => {
      if (snap.scalding || snap.warning) { rising = true; return { held: false, heldMs: 0 }; }
      if (rising && snap.pressure >= snap.bandHigh - 0.01) rising = false;
      if (!rising && snap.pressure <= snap.bandLow + 0.01) rising = true;
      return { held: rising, heldMs: 16 };
    };
  },

  skim_curds: () => {
    // One sweep per band, LIFTING the paddle between bands. Snapping the cursor back with the
    // paddle still down reads as doubling back, which is correct behaviour by the verb and was
    // a bug in the first driver written for it.
    let x = 0;
    let band = -1;
    return (snap) => {
      if (snap.band !== band) { band = snap.band; x = 0; return { x: 0, y: (snap.band + 0.5) * snap.bandHeight, down: false }; }
      x = Math.min(1, x + 0.03);
      return { x, y: (snap.band + 0.5) * snap.bandHeight, down: true };
    };
  },

  pull_shot: () => {
    // Running total: size each pull to exactly what is LEFT, not to a fixed amount. Pulling
    // blindly at full charge overshoots and scores zero, which is the point of the verb.
    let charge = 0;
    return (snap) => {
      const want = Math.min(1, snap.remaining / 0.28);
      if (charge >= want) { const out = { charge, fired: true }; charge = 0; return out; }
      charge = Math.min(1, charge + 16 / 1100);
      return { charge, fired: false };
    };
  },

  // Inverted balance: swing right out to each side. Holding centred - the pour_tin instinct -
  // scores zero here, which is what makes the two different games.
  toss_bowl: () => { let p = 0; return () => { p += 0.06; return { ax: Math.sin(p) * 0.95, ay: 0 }; }; },

  // Read the cue, do not count. sizzle reaches exactly 1.0 at the moment the side is done, and
  // the interval differs every flip, so a fixed metronome scores about half of this.
  sear_flip: () => (snap) => (snap.sizzle >= 1 ? { taps: [{ tMs: 0 }] } : { taps: [] }),

  // Spacing: every gap the same. The gap itself is whatever the first two crimps set, so the
  // driver picks one and holds it rather than aiming at anything the game chose.
  crimp_edge: () => (snap) => {
    if (snap.placed.length === 0) return { padIndex: 0 };
    const last = snap.placed[snap.placed.length - 1];
    return { padIndex: (last + 3) % snap.notches };
  },
};

/** Drive a verb to completion with a driver, returning its final score. */
function play(mod, seed, makeDriver, opts = {}) {
  const g = mod.create(seed, opts);
  const driver = typeof makeDriver === 'function' ? makeDriver() : null;
  let t = 0;
  while (!g.done() && t < 180000) {
    const input = driver ? driver(g.snapshot()) : null;
    g.step(16, input);
    t += 16;
  }
  return { score: g.score(), ms: t, done: g.done() };
}

const ids = Object.keys(VERB_LOADERS);
const mods = {};

console.log(`\nDriving ${ids.length} registered verbs...\n`);

for (const id of ids) mods[id] = await VERB_LOADERS[id]();

// ---------------------------------------------------------------------------
// registry <-> data parity
// ---------------------------------------------------------------------------

test('every registered verb has a VERBS entry and vice versa', () => {
  const inData = Object.keys(VERBS).sort();
  assert.deepEqual(ids.slice().sort(), inData,
    'a verb in one table and not the other is a game that either cannot load or cannot be authored');
});

test('every loaded module exports an id matching its registry key', () => {
  for (const id of ids) assert.equal(mods[id].id, id, `${id} exports a mismatched id`);
});

test('verbWord is globally unique — this is what stops a re-skin shipping as a new game', () => {
  const words = Object.entries(VERBS).map(([k, v]) => [k, v.verbWord]);
  for (const [, w] of words) assert.ok(w && /^[a-z]+$/.test(w), `verbWord must be one lowercase word, got '${w}'`);
  const seen = new Map();
  for (const [k, w] of words) {
    assert.equal(seen.has(w), false, `verbWord '${w}' is used by both ${seen.get(w)} and ${k}`);
    seen.set(w, k);
  }
});

test('every verb declares one of the eight input families', () => {
  const valid = families();
  for (const [k, v] of Object.entries(VERBS)) {
    assert.ok(valid.includes(v.family), `${k} declares family '${v.family}', which the shell cannot feed`);
  }
});

test('every verb is actually used by at least one recipe stage', () => {
  const used = new Set();
  for (const b of Object.values(BUILDINGS)) {
    for (const r of b.recipes) {
      for (const st of (r.play && r.play.stages) || []) used.add(st.verb);
    }
  }
  for (const id of ids) assert.ok(used.has(id), `${id} is registered but no recipe plays it — dead verb`);
});

test('every recipe stage names a verb that exists', () => {
  for (const [bid, b] of Object.entries(BUILDINGS)) {
    for (const r of b.recipes) {
      for (const st of (r.play && r.play.stages) || []) {
        assert.ok(VERBS[st.verb], `${bid}/${r.id} stages unknown verb '${st.verb}'`);
        if (st.weight !== undefined) assert.ok(st.weight > 0, `${bid}/${r.id} has a non-positive stage weight`);
      }
    }
  }
});

test('every registered verb has a hand-written optimal driver in this file', () => {
  for (const id of ids) {
    assert.ok(typeof OPTIMAL[id] === 'function',
      `${id} has no driver here, so nothing proves it can be played WELL — add one`);
  }
});

// ---------------------------------------------------------------------------
// Per-verb invariants. These are the ones that keep a required craft finishable.
// ---------------------------------------------------------------------------

for (const id of ids) {
  const mod = mods[id];
  const meta = VERBS[id];
  const budget = (meta.durationMs || 12000) * 3;

  test(`${id}: completes from NULL input for ever, within 3x its nominal duration`, () => {
    const r = play(mod, 4242, null);
    assert.equal(r.done, true, 'a verb that can stall is a craft the player can never finish');
    assert.ok(r.ms <= budget, `took ${r.ms}ms, budget ${budget}ms`);
  });

  test(`${id}: score is a valid 0..1 before the first step and after the last`, () => {
    const fresh = mod.create(7, {});
    const s0 = fresh.score();
    assert.ok(typeof s0 === 'number' && !Number.isNaN(s0) && s0 >= 0 && s0 <= 1, `pre-step score was ${s0}`);
    const r = play(mod, 7, null);
    assert.ok(r.score >= 0 && r.score <= 1 && !Number.isNaN(r.score), `final score was ${r.score}`);
  });

  test(`${id}: played well it scores far above played not at all`, () => {
    const idle = play(mod, 31337, null).score;
    const good = play(mod, 31337, OPTIMAL[id]).score;
    assert.ok(good >= 0.7, `optimal play only reached ${good.toFixed(3)} — the verb is unwinnable`);
    assert.ok(good > idle + 0.3, `optimal ${good.toFixed(3)} vs idle ${idle.toFixed(3)} — skill barely matters`);
  });

  test(`${id}: identical seed and identical input give an identical score`, () => {
    const a = play(mod, 555, OPTIMAL[id]).score;
    const b = play(mod, 555, OPTIMAL[id]).score;
    assert.equal(a, b, 'a replayed stage must not reroll into a different outcome');
  });

  test(`${id}: assist mode never scores worse than the same play without it`, () => {
    const plain = play(mod, 8080, OPTIMAL[id], {}).score;
    const assisted = play(mod, 8080, OPTIMAL[id], { assist: true }).score;
    assert.ok(assisted >= plain - 0.05,
      `assist scored ${assisted.toFixed(3)} vs ${plain.toFixed(3)} — an accommodation must not punish`);
  });

  test(`${id}: create() touches no browser global, so it is testable and deterministic`, () => {
    const src = mod.create.toString();
    for (const bad of ['document', 'window.', 'performance.', 'Math.random']) {
      assert.equal(src.includes(bad), false, `create() references ${bad}`);
    }
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
