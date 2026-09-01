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

  // Interception rather than tracking: head for where the next kernel will land, not for a line.
  catch_kernels: () => (snap) => ({
    steer: snap.target < 0 ? 0 : Math.max(-1, Math.min(1, (snap.target - snap.bowl) * 8)),
    throttle: 1, heldMs: 16,
  }),

  // Ratchet: ride just under the safe line, which RISES as the mash compacts. Winding straight
  // to full cracks the press and scores zero.
  wind_press: () => (snap) => ({ rate: Math.max(snap.turned, snap.safe - 0.01) }),

  // Dead time: stop pouring once the level PLUS what is already in the pipe will reach the line.
  // Pouring until the jar looks full overshoots every single jar and scores zero.
  jar_fill: () => (snap) => {
    const willArrive = snap.inPipe * 0.42 * 0.52;
    return { rate: snap.level + willArrive < snap.line - 0.02 ? 1 : 0 };
  },

  pull_taffy: () => {
    // Cyclic, and PACED. Snapping between apart and together as fast as possible still completes
    // every pull but forfeits the evenness credit - 0.66 against 0.98 - which is the verb saying
    // that snatching at taffy does not aerate it.
    let held = 0;
    let want = null;
    return (snap) => {
      if (snap.want !== want) { want = snap.want; held = 0; }
      held += 16;
      if (held < 700) return snap.want === 'apart' ? { left: 0.5, right: 0.5 } : { left: 1, right: 0 };
      return snap.want === 'apart' ? { left: 1, right: 0 } : { left: 0.5, right: 0.5 };
    };
  },

  // Chained rule: the seam continues the piece BEFORE it. Routing by the falling piece - the
  // instinct sort_chillies teaches - scores 0.14 to 0.57 here, which is the point.
  match_seam: () => (snap) => ({ lane: snap.needs === null ? 0 : snap.needs, commit: true }),
  // Repetition, so the optimal play is simply the SAME circle every lap. A driver that varied
  // its radius scored 0.618 against this one's 0.900, which is the gap the verb exists to make.
  // Ballistic, so the optimal play SOLVES the arc rather than pointing at the cup: 45 degrees is
  // the max-range angle, which makes power = sqrt(distance / k). Aiming flat at the cup the way
  // cast_ingot teaches scores 0.000 to 0.418 against this driver's 1.000.
  // Deduction, not timing. The thickness is never shown, so the optimal play watches how fast
  // the jug thins for a moment, solves for it, and releases on that. A fixed hold that ignores
  // the jug scores 0.007 to 0.671 against this driver's 0.99.
  // Sequencing. The optimal play works through the tickets in heat order rather than the order
  // they arrived, because the pan keeps whatever heat the last omelet left in it. The dedicated
  // ordering guard below is what actually pins that claim; this driver only proves it is winnable.
  // Information with a price. The optimal play fills blind for a fixed spell, spends exactly ONE
  // peek to learn the hidden fill rate, then computes the rest. The peek is a single frame on
  // purpose: the cost is charged per opening, so a longer look buys nothing and only drips more.
  // Judgement, not dexterity: keep pulling while the comb is holding, bank the moment the creak
  // says it is at its limit. Greedy play shatters and scores 0.000 on every seed; stopping early
  // banks proportionally less. The dedicated guard below pins that gradient.
  // Simultaneity: both threads rise together and cross taut on the same frame. Pulling one and
  // then the other is the natural instinct and scores 0.000, which the dedicated guard pins.
  set_hook: () => {
    let pull = 0;
    return (snap) => {
      if (snap.threading) { pull = 0; return { left: 0, right: 0 }; }
      pull = Math.min(1, pull + 0.1);
      return { left: pull, right: pull };
    };
  },
  press_luck: () => (snap) => ({ held: snap.creak !== 'straining' }),
  peek_pour: () => {
    let phase = 'fill';
    let rate = null;
    let filledMs = 0;
    return (snap) => {
      if (phase === 'fill') {
        if (snap.now < 2500) { filledMs = snap.now + 16; return { ax: -1 }; }
        phase = 'peek';
        return { ax: 1 };
      }
      if (phase === 'peek') {
        if (snap.seenLevel === null) return { ax: 1 };
        // What was seen is the fill MINUS the peek's fixed cost, and that cost is published.
        rate = (snap.seenLevel + snap.peekCost) / (filledMs / 1000);
        phase = 'pour';
        return { ax: 0 };
      }
      const estimated = snap.seenLevel + rate * ((snap.now - snap.seenAt) / 1000);
      return { ax: estimated < snap.target ? -1 : 0 };
    };
  },
  ride_heat: () => (snap) => {
    if (snap.busy) return null;
    const left = snap.tickets.filter((k) => !k.done);
    if (!left.length) return null;
    const sorted = [...left].sort((x, y) => x.heat - y.heat);
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    const next = Math.abs(snap.panHeat - lo.heat) <= Math.abs(snap.panHeat - hi.heat) ? lo : hi;
    return { lane: next.lane, commit: true };
  },
  read_vortex: () => (snap) => {
    if (snap.heldMs < 1200) return { held: true };     // observe first
    const dropped = 1 - snap.level;
    if (dropped <= 0) return { held: true };
    const thickness = (snap.dropBase * snap.heldMs) / dropped;
    return { held: snap.heldMs < thickness * snap.readyPerThickness };
  },
  arc_pour: () => {
    let power = 0;
    return (snap) => {
      const angle = Math.PI / 4;
      const want = Math.sqrt(Math.min(1, snap.distance / snap.k));
      if (power >= want) { power = 0; return { angle, power: want, fired: true }; }
      power += 16 / 1100;                       // input.js's own power-build rate
      return { angle, power, fired: false };
    };
  },
  stir_figure: () => {
    let a = 0;
    return () => {
      a += 0.05;
      return { x: 0.5 + Math.cos(a) * 0.3, y: 0.5 + Math.sin(a) * 0.3, down: true };
    };
  },

  // ---- the last five wiki factories ---------------------------------------------------------

  weave_mesh: () => {
    // Sweep the pegs in angular order about their centroid. Sorting points by angle about an
    // interior point always produces a simple polygon, so this route can never cross itself and
    // always has a way home. Taking the NEAREST free peg instead is the natural play and tangles
    // the net on most boards, which is measured separately below.
    let plan = null;
    let i = 0;
    return (snap) => {
      if (!plan) {
        const cx = snap.points.reduce((a, q) => a + q.x, 0) / snap.pegs;
        const cy = snap.points.reduce((a, q) => a + q.y, 0) / snap.pegs;
        plan = snap.points
          .map((q, idx) => ({ idx, a: Math.atan2(q.y - cy, q.x - cx) }))
          .sort((u, v) => u.a - v.a)
          .map((e) => e.idx);
      }
      const to = i < plan.length ? plan[i++] : plan[0];
      return { grabbed: snap.current, dropOn: to, dropped: true };
    };
  },

  match_portions: () => {
    // The spit only ever thins, so the biggest size EVERY cut can still make is the last cut's
    // yield. Aim all five at that, and the spread goes to nothing. The input layer builds charge
    // at dt/900, so the driver models the same climb and lets go at the computed point.
    let charge = 0;
    return (snap) => {
      const target = Math.min(...snap.yields);
      const want = Math.min(1, target / snap.yieldNow);
      if (charge >= want) { const out = { charge, fired: true }; charge = 0; return out; }
      charge = Math.min(1, charge + 16 / 900);
      return { charge, fired: false };
    };
  },

  set_pots: () => (snap) => {
    // Walk the water on a coarse polar grid and take the first spot that clears the wall, the
    // rocks and every territory already claimed. There is no target to aim at, so "optimal" here
    // means searching rather than aiming.
    const clear = (x, y) => {
      if (Math.hypot(x, y) > 0.97) return false;
      for (const rk of snap.rocks) if (Math.hypot(x - rk.x, y - rk.y) < rk.r + 0.05) return false;
      for (const q of snap.placed) if (Math.hypot(x - q.x, y - q.y) < snap.territory * 2) return false;
      return true;
    };
    for (const r of [0.8, 0.62, 0.44, 0.9, 0.26, 0.1]) {
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        if (clear(Math.cos(a) * r, Math.sin(a) * r)) return { angle: a, power: r / 0.95, fired: true };
      }
    }
    return { angle: 0, power: 0.5, fired: true };
  },

  calm_hands: () => {
    // Travel fast between patches, because travel is free, then decelerate below the patch's own
    // limit before crossing its edge and dwell there. Crawling the whole way round is the mistake
    // that looks careful: it is slow enough to run out of clock with half the bird undone.
    let pos = { x: 0.5, y: 0.5 };
    return (snap) => {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < snap.patches.length; i++) {
        const q = snap.patches[i];
        if (q.fill >= 1) continue;
        const d = Math.hypot(q.x - pos.x, q.y - pos.y);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return { x: pos.x, y: pos.y, down: true };
      const q = snap.patches[best];
      const dx = q.x - pos.x;
      const dy = q.y - pos.y;
      const d = Math.hypot(dx, dy) || 1e-9;
      const vel = d > q.r * 1.4 ? 2.2 : q.limit * 0.55;      // screen widths per second
      const stepd = Math.min(d, vel * (16 / 1000));
      pos = { x: pos.x + (dx / d) * stepd, y: pos.y + (dy / d) * stepd };
      return { x: pos.x, y: pos.y, down: true };
    };
  },

  batch_dies: () => (snap) => {
    // Finish every ticket for the die already fitted, then change once. Two changes for three
    // dies instead of the eight or ten that serving them in arrival order costs.
    if (snap.busy) return { lane: snap.fitted, commit: false };
    const left = (d) => snap.tickets.filter((t) => !t.filled && t.die === d).length;
    if (left(snap.fitted) > 0) return { lane: snap.fitted, commit: true };
    for (let d = 0; d < snap.dies; d++) if (left(d) > 0) return { lane: d, commit: true };
    return { lane: snap.fitted, commit: false };
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

// ---------------------------------------------------------------------------------------
// ride_heat: the ordering claim, pinned.
//
// The generic sweep above proves a verb is winnable and that skill beats idling. Neither says
// anything about the thing this verb exists for, which is that the SEQUENCE matters: cooking the
// tickets in heat order must beat cooking them in the order they arrived.
//
// That check earns its own guard because the previous attempt at an ordering verb (work_rush,
// cut) died exactly here. Its ordering claim was measured against a driver whose name said "first
// come, first served" while it actually picked "most slack remaining", and the gap it appeared to
// show evaporated the moment the real policy was measured. So this guard names both policies
// explicitly and asserts the direction on every seed.
// ---------------------------------------------------------------------------------------
await testAsync('ride_heat: planning the route beats cooking in arrival order, on every seed', async () => {
  const mod = await VERB_LOADERS.ride_heat();

  const play = (seed, pick) => {
    const g = mod.create(seed, {});
    let t = 0;
    while (!g.done() && t < 200000) {
      const snap = g.snapshot();
      let move = null;
      if (!snap.busy) {
        const left = snap.tickets.filter((k) => !k.done);
        if (left.length) move = { lane: pick(left, snap).lane, commit: true };
      }
      g.step(16, move);
      t += 16;
    }
    return g.score();
  };

  // Plan: work through the remaining tickets in heat order, starting at whichever end of the
  // range the pan is already nearer to.
  const planned = (left, snap) => {
    const sorted = [...left].sort((a, b) => a.heat - b.heat);
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    return Math.abs(snap.panHeat - lo.heat) <= Math.abs(snap.panHeat - hi.heat) ? lo : hi;
  };
  // Arrival order: straight down the queue, which is what the tickets tempt you into.
  const inOrder = (left) => left[0];

  for (const seed of [1, 42, 555, 9001, 31337, 777, 2024, 4242, 88, 1234]) {
    const plan = play(seed, planned);
    const queue = play(seed, inOrder);
    assert.ok(
      plan > queue + 0.15,
      `seed ${seed}: planned ${plan.toFixed(3)} must clearly beat arrival order ${queue.toFixed(3)} - `
      + 'if working straight down the queue is just as good, the pan state is not doing anything',
    );
    assert.ok(plan >= 0.9, `seed ${seed}: a planned route should plate nearly everything, got ${plan.toFixed(3)}`);
  }
});

// ---------------------------------------------------------------------------------------
// peek_pour: the information trade, pinned.
//
// The generic sweep proves the verb is winnable and that skill beats idling. Neither touches the
// claim the verb is actually built on: that looking is worth doing ONCE and not worth doing
// repeatedly. If pouring blind were as good, there would be no reason to peek; if peeking were
// free, there would be no reason not to stare. Both ends get asserted.
// ---------------------------------------------------------------------------------------
await testAsync('peek_pour: one peek beats both never looking and constantly looking', async () => {
  const mod = await VERB_LOADERS.peek_pour();

  const play = (seed, decide) => {
    const g = mod.create(seed, {});
    let t = 0;
    while (!g.done() && t < 200000) { g.step(16, decide(g.snapshot())); t += 16; }
    return g.score();
  };

  // Fill, glance once, compute, finish. Same policy as the registered driver.
  const oneGlance = () => {
    let phase = 'fill';
    let rate = null;
    let filledMs = 0;
    return (snap) => {
      if (phase === 'fill') {
        if (snap.now < 2500) { filledMs = snap.now + 16; return { ax: -1 }; }
        phase = 'peek';
        return { ax: 1 };
      }
      if (phase === 'peek') {
        if (snap.seenLevel === null) return { ax: 1 };
        rate = (snap.seenLevel + snap.peekCost) / (filledMs / 1000);
        phase = 'pour';
        return { ax: 0 };
      }
      return { ax: snap.seenLevel + rate * ((snap.now - snap.seenAt) / 1000) < snap.target ? -1 : 0 };
    };
  };
  // Never look: pour for a plausible fixed spell and hope the tin filled at the rate you assumed.
  const neverLook = () => (snap) => ({ ax: snap.now < 5000 ? -1 : 0 });
  // Keep looking: tip back and forth so the level is always known, and pay for every glance.
  const alwaysLook = () => (snap) => ({ ax: Math.floor(snap.now / 300) % 2 ? 1 : -1 });
  // A cheat that only works if the snapshot leaks the hidden fill rate. It exists to protect the
  // one design rule written at the top of the verb: publishing the rate to be helpful would
  // delete the whole thing, because there would be no reason to ever look. Without the leak this
  // driver cannot fill at all and scores zero, so it is harmless; with the leak it wins outright.
  const cheatIfLeaked = () => (snap) => {
    const leaked = snap.fillRate;
    if (typeof leaked !== 'number') return { ax: 0 };
    return { ax: (leaked * (snap.now / 1000)) < snap.target ? -1 : 0 };
  };

  for (const seed of [1, 42, 555, 9001, 31337, 777, 2024, 4242]) {
    const glance = play(seed, oneGlance());
    const blind = play(seed, neverLook());
    const staring = play(seed, alwaysLook());
    assert.ok(
      glance > blind + 0.15,
      `seed ${seed}: peeking once (${glance.toFixed(3)}) must clearly beat pouring blind `
      + `(${blind.toFixed(3)}) - if it does not, the hidden fill rate is not hidden enough to matter`,
    );
    assert.ok(
      glance > staring + 0.15,
      `seed ${seed}: peeking once (${glance.toFixed(3)}) must clearly beat looking constantly `
      + `(${staring.toFixed(3)}) - if it does not, looking is too cheap and there is no trade`,
    );
    assert.ok(glance >= 0.9, `seed ${seed}: a correct read should land on the line, got ${glance.toFixed(3)}`);
    const cheat = play(seed, cheatIfLeaked());
    assert.ok(
      cheat < 0.2,
      `seed ${seed}: a driver that reads snapshot.fillRate scored ${cheat.toFixed(3)} - the hidden `
      + 'fill rate has been published, which removes any reason to peek and deletes the verb',
    );
  }
});

// ---------------------------------------------------------------------------------------
// press_luck: the risk gradient, pinned.
//
// The generic sweep proves the verb is winnable and beats idling. The claim this verb is built
// on is finer than that: every degree of nerve should be rewarded in order. Taking everything
// must lose the lot, stopping at the first frame must bank a little, stopping halfway must bank
// more, and reading the creak to its limit must bank all of it. If any two of those collapse
// together, the decision the verb exists for has stopped mattering.
// ---------------------------------------------------------------------------------------
await testAsync('press_luck: nerve is rewarded in order, and greed loses everything', async () => {
  const mod = await VERB_LOADERS.press_luck();

  const play = (seed, decide) => {
    const g = mod.create(seed, {});
    let t = 0;
    while (!g.done() && t < 200000) { g.step(16, decide(g.snapshot())); t += 16; }
    return g.score();
  };

  // Bank the moment the comb starts straining. This is the sound conservative line, and it
  // deliberately does NOT reach 1.0: the band spans several frames, so banking on the first
  // warning always leaves something in the comb. Topping the scale means taking the extra pull
  // and being right, which is the entire point of a press-your-luck verb.
  const bankOnWarning = (s) => ({ held: s.creak !== 'straining' });
  const greedy = () => ({ held: true });
  const timid = (s) => ({ held: s.pulled < 1 });
  const cautious = (s) => ({ held: s.creak === 'solid' });

  for (const seed of [1, 42, 555, 9001, 31337, 777, 2024, 4242]) {
    const read = play(seed, bankOnWarning);
    const grab = play(seed, greedy);
    const one = play(seed, timid);
    const half = play(seed, cautious);

    assert.equal(grab, 0,
      `seed ${seed}: pulling every frame must shatter the comb and bank nothing, got ${grab.toFixed(3)}`);
    assert.ok(read >= 0.7,
      `seed ${seed}: banking on the first warning should still take most of the comb, got ${read.toFixed(3)}`);
    assert.ok(read < 1,
      `seed ${seed}: the safe line must NOT top the scale (${read.toFixed(3)}) - if playing it safe `
      + 'scores full marks there is no reason to ever risk a frame, and the verb has no gamble in it');
    assert.ok(read > half && half >= one,
      `seed ${seed}: nerve must pay in order - warning ${read.toFixed(3)} > cautious ${half.toFixed(3)} `
      + `>= timid ${one.toFixed(3)}. If any two collapse together there is no decision left`);
    assert.ok(one > 0,
      `seed ${seed}: stopping at the first frame should still bank something, got ${one.toFixed(3)}`);
  }
});

// ---------------------------------------------------------------------------------------
// set_hook: simultaneity, pinned.
//
// The generic sweep proves the verb is winnable and beats idling. The claim it exists for is
// narrower: that pulling the two threads ONE AFTER THE OTHER cannot work, however hard either is
// pulled. That is the natural instinct and the whole reason the verb is not just another dual
// game, so it gets asserted directly rather than trusted to a header comment.
//
// The jammed case is here too. Holding both threads permanently taut and waiting is the obvious
// way to cheat a coincidence check, and it must not pay: only rising edges count.
// ---------------------------------------------------------------------------------------
await testAsync('set_hook: pulling one thread then the other never sets it', async () => {
  const mod = await VERB_LOADERS.set_hook();

  const play = (seed, decide) => {
    const g = mod.create(seed, {});
    let t = 0;
    while (!g.done() && t < 200000) { g.step(16, decide(g.snapshot())); t += 16; }
    return g.score();
  };

  // Both threads rise together and cross taut on the same frame.
  const together = () => {
    let pull = 0;
    return (snap) => {
      if (snap.threading) { pull = 0; return { left: 0, right: 0 }; }
      pull = Math.min(1, pull + 0.1);
      return { left: pull, right: pull };
    };
  };
  // The instinct: pull the left taut, then a clear half second later pull the right.
  const oneThenOther = () => {
    let frames = 0;
    return (snap) => {
      if (snap.threading) { frames = 0; return { left: 0, right: 0 }; }
      frames += 1;
      return { left: frames > 6 ? 1 : 0, right: frames > 40 ? 1 : 0 };
    };
  };
  // Jam both taut and hold. A coincidence check that counts levels rather than rising edges
  // would score this perfectly, which is precisely the mistake worth guarding.
  const jammed = () => () => ({ left: 1, right: 1 });

  for (const seed of [1, 42, 555, 9001, 31337, 777]) {
    const both = play(seed, together());
    const apart = play(seed, oneThenOther());
    const held = play(seed, jammed());

    assert.ok(both >= 0.9,
      `seed ${seed}: crossing taut together should set every hook, got ${both.toFixed(3)}`);
    assert.equal(apart, 0,
      `seed ${seed}: pulling one thread and then the other must set NOTHING, got ${apart.toFixed(3)} - `
      + 'if sequential play scores, the verb is not about simultaneity at all');
    assert.ok(both > held + 0.5,
      `seed ${seed}: jamming both taut (${held.toFixed(3)}) must not approach playing it `
      + `(${both.toFixed(3)}) - only rising edges may count, or holding beats timing`);
  }
});


// ---------------------------------------------------------------------------------------
// The last five factories. Each verb below claims something specific about what it measures,
// and a claim that only lives in a header comment is a claim nobody has checked. The generic
// sweep above already proves each one is winnable and beats idling; these prove the thing that
// makes it a different game from its neighbours.
// ---------------------------------------------------------------------------------------

const SEEDS = [1, 42, 555, 9001, 31337, 777, 2024, 4242, 8, 13, 99, 12345];

/** Run a verb to completion with a driver built per-run, returning its final snapshot and score. */
const runVerb = (mod, seed, makeDriver, opts = {}) => {
  const g = mod.create(seed, opts);
  const drive = makeDriver();
  let t = 0;
  while (!g.done() && t < 200000) {
    g.step(16, drive(g.snapshot()));
    t += 16;
  }
  return { score: g.score(), snap: g.snapshot(), ms: t };
};

await testAsync('weave_mesh: a net that must not cross itself really does refuse the greedy route', async () => {
  const mod = await VERB_LOADERS.weave_mesh();

  const sweep = () => {
    let plan = null;
    let i = 0;
    return (snap) => {
      if (!plan) {
        const cx = snap.points.reduce((a, q) => a + q.x, 0) / snap.pegs;
        const cy = snap.points.reduce((a, q) => a + q.y, 0) / snap.pegs;
        plan = snap.points.map((q, idx) => ({ idx, a: Math.atan2(q.y - cy, q.x - cx) }))
          .sort((u, v) => u.a - v.a).map((e) => e.idx);
      }
      return { grabbed: snap.current, dropOn: i < plan.length ? plan[i++] : plan[0], dropped: true };
    };
  };
  // The instinct: always take the nearest peg that is still legal.
  const nearest = () => (snap) => {
    if (snap.current < 0) return { grabbed: -1, dropOn: 0, dropped: true };
    const here = snap.points[snap.current];
    const open = snap.legal.filter((q) => !snap.order.includes(q));
    const pool = open.length ? open : snap.legal;
    if (!pool.length) return { grabbed: snap.current, dropOn: -1, dropped: false };
    let best = pool[0];
    let bd = Infinity;
    for (const q of pool) {
      const d = (snap.points[q].x - here.x) ** 2 + (snap.points[q].y - here.y) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    return { grabbed: snap.current, dropOn: best, dropped: true };
  };

  let tangled = 0;
  for (const seed of SEEDS) {
    const a = runVerb(mod, seed, sweep);
    const b = runVerb(mod, seed, nearest);
    assert.equal(a.snap.closed, true,
      `seed ${seed}: an angular sweep is always a simple polygon, so it must always close - `
      + 'if it does not, the crossing test is rejecting legal moves');
    assert.ok(a.score >= 0.99, `seed ${seed}: sweeping every peg and closing should score full, got ${a.score.toFixed(3)}`);
    if (b.score < a.score - 0.001) tangled += 1;
  }
  // Not every board punishes greed, and it should not: easy boards are how a player learns the
  // rule. But if greed were ALWAYS fine there would be no puzzle here at all.
  assert.ok(tangled >= SEEDS.length / 3,
    `taking the nearest peg lost on only ${tangled}/${SEEDS.length} boards - if the greedy route `
    + 'nearly always works, the no-crossing rule is not doing anything and this is not a game');
});

await testAsync('match_portions: it scores the SPREAD, so the proud first portion loses everything', async () => {
  const mod = await VERB_LOADERS.match_portions();

  // Aim every cut at the biggest size the LAST cut could still make.
  const planned = () => {
    let charge = 0;
    return (snap) => {
      const want = Math.min(1, Math.min(...snap.yields) / snap.yieldNow);
      if (charge >= want) { const out = { charge, fired: true }; charge = 0; return out; }
      charge = Math.min(1, charge + 16 / 900);
      return { charge, fired: false };
    };
  };
  // The trap: match the first cut, which the thinning spit can never repeat.
  const anchorOnFirst = () => {
    let charge = 0;
    return (snap) => {
      const want = Math.min(1, snap.yields[0] / snap.yieldNow);
      if (charge >= want) { const out = { charge, fired: true }; charge = 0; return out; }
      charge = Math.min(1, charge + 16 / 900);
      return { charge, fired: false };
    };
  };
  // Lean on the blade every time. Perfectly consistent INPUT, five different weights.
  const maxHold = () => {
    let charge = 0;
    return () => {
      if (charge >= 1) { const out = { charge, fired: true }; charge = 0; return out; }
      charge = Math.min(1, charge + 16 / 900);
      return { charge, fired: false };
    };
  };
  // Tap it five times. Perfectly consistent OUTPUT, and five portions of nothing.
  const shavings = () => () => ({ charge: 0.004, fired: true });

  for (const seed of SEEDS) {
    const plan = runVerb(mod, seed, planned).score;
    const first = runVerb(mod, seed, anchorOnFirst).score;
    const held = runVerb(mod, seed, maxHold).score;
    const thin = runVerb(mod, seed, shavings).score;

    assert.ok(plan >= 0.9,
      `seed ${seed}: aiming every cut at what the last cut can still give should score full, got ${plan.toFixed(3)}`);
    assert.ok(first < 0.3,
      `seed ${seed}: matching the FIRST portion must fail (${first.toFixed(3)}) - the spit thins, so `
      + 'that size is unrepeatable, and this trap is the whole reason the yields are published');
    assert.ok(held < 0.3,
      `seed ${seed}: holding to the stop every time gives five DIFFERENT weights and must not pass `
      + `(${held.toFixed(3)}), or the laziest input in the family beats playing it`);
    assert.ok(thin < 0.3,
      `seed ${seed}: five identical shavings are perfectly consistent and must still score `
      + `nothing (${thin.toFixed(3)}), or consistency alone is farmable with no skill at all`);
  }
});

await testAsync('set_pots: packing is the game, so an even ring that ignores the water fills fewer pots', async () => {
  const mod = await VERB_LOADERS.set_pots();

  const searched = () => (snap) => {
    const clear = (x, y) => {
      if (Math.hypot(x, y) > 0.97) return false;
      for (const rk of snap.rocks) if (Math.hypot(x - rk.x, y - rk.y) < rk.r + 0.05) return false;
      for (const q of snap.placed) if (Math.hypot(x - q.x, y - q.y) < snap.territory * 2) return false;
      return true;
    };
    for (const r of [0.8, 0.62, 0.44, 0.9, 0.26, 0.1]) {
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        if (clear(Math.cos(a) * r, Math.sin(a) * r)) return { angle: a, power: r / 0.95, fired: true };
      }
    }
    return { angle: 0, power: 0.5, fired: true };
  };
  // Throw at a comfortable middle distance, evenly spaced, without looking at what is down.
  const evenRing = () => { let k = 0; return () => ({ angle: (k++) * 1.1, power: 0.47, fired: true }); };

  for (const seed of SEEDS) {
    const good = runVerb(mod, seed, searched);
    const blind = runVerb(mod, seed, evenRing);
    assert.ok(good.score >= 0.99,
      `seed ${seed}: a board that cannot be filled by searching it is a board that is unfair, got ${good.score.toFixed(3)}`);
    assert.ok(blind.score <= good.score - 0.2,
      `seed ${seed}: ignoring the pots already down scored ${blind.score.toFixed(3)} against `
      + `${good.score.toFixed(3)} - if throwing blind is nearly as good, nothing here is a packing problem`);
  }
});

await testAsync('calm_hands: hurrying is the only way to fail it, and it fails completely', async () => {
  const mod = await VERB_LOADERS.calm_hands();

  const calm = () => {
    let pos = { x: 0.5, y: 0.5 };
    return (snap) => {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < snap.patches.length; i++) {
        const q = snap.patches[i];
        if (q.fill >= 1) continue;
        const d = Math.hypot(q.x - pos.x, q.y - pos.y);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return { x: pos.x, y: pos.y, down: true };
      const q = snap.patches[best];
      const dx = q.x - pos.x;
      const dy = q.y - pos.y;
      const d = Math.hypot(dx, dy) || 1e-9;
      const vel = d > q.r * 1.4 ? 2.2 : q.limit * 0.55;
      const stepd = Math.min(d, vel * (16 / 1000));
      pos = { x: pos.x + (dx / d) * stepd, y: pos.y + (dy / d) * stepd };
      return { x: pos.x, y: pos.y, down: true };
    };
  };
  // What every OTHER path verb wants: cover as much ground as possible, quickly.
  const hurried = () => { let k = 0; return () => { k += 1; const a = k * 0.09; return { x: 0.5 + Math.cos(a) * 0.34, y: 0.5 + Math.sin(a) * 0.34, down: true }; }; };

  for (const seed of SEEDS) {
    const a = runVerb(mod, seed, calm);
    const b = runVerb(mod, seed, hurried);
    // Every patch must be reachable. Before the sampler stopped letting patches overlap, half the
    // seeds stranded four of the six behind another one, and nothing on screen said why.
    assert.ok(a.score >= 0.99,
      `seed ${seed}: a calm hand should finish every patch, got ${a.score.toFixed(3)} - a patch that `
      + 'cannot be reached at all is a board defect, not a hard round');
    assert.ok(b.score <= 0.05,
      `seed ${seed}: sweeping the board fast scored ${b.score.toFixed(3)} - covering ground is what `
      + 'every other path verb rewards, and here it must be worth nothing');
  }
});

await testAsync('batch_dies: grouping provably beats arrival order, which is what work_rush could never manage', async () => {
  const mod = await VERB_LOADERS.batch_dies();

  const left = (snap, d) => snap.tickets.filter((t) => !t.filled && t.die === d).length;
  const batched = () => (snap) => {
    if (snap.busy) return { lane: snap.fitted, commit: false };
    if (left(snap, snap.fitted) > 0) return { lane: snap.fitted, commit: true };
    for (let d = 0; d < snap.dies; d++) if (left(snap, d) > 0) return { lane: d, commit: true };
    return { lane: snap.fitted, commit: false };
  };
  // Serve them in the order they arrived, changing the die whenever the next one differs.
  const arrivalOrder = () => (snap) => {
    if (snap.busy) return { lane: snap.fitted, commit: false };
    const i = snap.tickets.findIndex((t) => !t.filled);
    if (i < 0) return { lane: snap.fitted, commit: false };
    return { lane: snap.tickets[i].die, commit: true };
  };

  for (const seed of SEEDS) {
    const a = runVerb(mod, seed, batched);
    const b = runVerb(mod, seed, arrivalOrder);
    assert.ok(a.score >= 0.99,
      `seed ${seed}: clearing each die before changing should finish the rack, got ${a.score.toFixed(3)}`);
    assert.ok(a.snap.swaps <= snap_dies_minus_one(a),
      `seed ${seed}: grouping three dies needs two changes, not ${a.snap.swaps}`);
    // The number that matters. work_rush died because triage scored IDENTICALLY to not bothering;
    // if this gap ever closes, the same thing has happened here and the verb should be cut.
    assert.ok(a.score - b.score >= 0.15,
      `seed ${seed}: batching ${a.score.toFixed(3)} vs arrival order ${b.score.toFixed(3)} - a gap `
      + 'this small means the ordering does not matter and this is work_rush all over again');
  }

  function snap_dies_minus_one(run) { return run.snap.dies - 1; }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
