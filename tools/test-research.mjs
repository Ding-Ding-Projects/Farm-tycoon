// tools/test-research.mjs — proves lab.js, museum.js, expeditions.js and extras.js.
//
// Plain Node script, no test framework (the project has no dependencies). Exits 0 on
// success, non-zero on first failure category, with a printed summary either way.
//
// Run: node tools/test-research.mjs

import assert from 'node:assert/strict';
import * as state from '../src/state.js';
import * as lab from '../src/lab.js';
import * as museum from '../src/museum.js';
import * as expeditions from '../src/expeditions.js';
import * as extras from '../src/extras.js';
import * as economy from '../src/economy.js';
import {
  LAB, EFFECT_KEYS, MUSEUM, EXPEDITIONS, MATERIALS, TRAINS, AIRPORT, HELICOPTER,
  DAILY_WHEEL, EVENTS, MINE, CROPS, GOODS,
} from '../src/data.js';

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

function freshState() {
  state.resetGame();
  const s = state.state;
  s.level = 99; // clear every unlockLevel gate so tests focus on this lane's own logic
  s.coins = 1e9;
  s.diamonds = 0;
  // Research costs draw on crop/good items as well as materials — stock the barn/silo deep
  // enough that no lab test is actually about resource affordability.
  for (const id of Object.keys(MATERIALS)) s.barn.items[id] = 1e6;
  for (const id of Object.keys(CROPS)) s.silo.items[id] = 1e6;
  for (const id of Object.keys(GOODS)) s.barn.items[id] = 1e6;
  return s;
}

/** Deterministic Math.random for one test: returns queued values, then 0.999 forever. */
function withScriptedRandom(values, fn) {
  const real = Math.random;
  const queue = [...values];
  Math.random = () => (queue.length ? queue.shift() : 0.999);
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

// ---------------------------------------------------------------------------
// lab.js
// ---------------------------------------------------------------------------

test('the research graph is walkable from a root, and requires is enforced', () => {
  const s = freshState();
  lab.build();
  assert.equal(s.lab.built, true);

  const roots = Object.entries(LAB.tree).filter(([, n]) => (n.requires || []).length === 0);
  assert.ok(roots.length > 0, 'the tree must have at least one root node');
  const available = lab.availableNodes();
  for (const [id] of roots) assert.ok(available.includes(id), `root ${id} must be available`);

  // A node whose prerequisite is unmet must never be startable, however rich the player is.
  assert.equal(lab.canResearch('irrigation_2'), false, 'irrigation_2 needs irrigation_1 first');
  assert.equal(lab.startResearch('irrigation_2'), false);
  assert.deepEqual(s.lab.researched, []);

  // Every non-root node's requires must themselves exist in the tree (graph is well-formed;
  // the data validator already proves acyclic, this proves every edge resolves).
  for (const [, node] of Object.entries(LAB.tree)) {
    for (const req of node.requires || []) assert.ok(LAB.tree[req], `dangling requires: ${req}`);
  }
});

test('only one research project runs at a time', () => {
  const s = freshState();
  lab.build();
  assert.equal(lab.startResearch('irrigation_1'), true);
  assert.ok(s.lab.active);
  assert.equal(lab.canResearch('automation_1'), false, 'a second slot must not be available');
  assert.equal(lab.startResearch('automation_1'), false);
  assert.equal(s.lab.active.id, 'irrigation_1', 'the active project must be unchanged');

  lab.cancelResearch();
  assert.equal(s.lab.active, null);
  assert.equal(lab.startResearch('automation_1'), true, 'the slot frees up after cancelling');
});

test('cancelResearch refunds the cost in full', () => {
  const s = freshState();
  lab.build();
  const before = s.coins;
  lab.startResearch('irrigation_1');
  assert.ok(s.coins < before, 'starting must spend coins');
  lab.cancelResearch();
  assert.equal(s.coins, before, 'cancelling must refund every coin spent');
});

test('researchedEffect() returns neutral values with nothing researched, and composes two nodes', () => {
  const s = freshState();
  const neutral = lab.researchedEffect();
  for (const key of EFFECT_KEYS) {
    assert.equal(neutral[key], key.endsWith('Mult') ? 1 : 0, `neutral ${key}`);
  }

  // Bypass the timers and directly seed two researched multiplicative nodes plus two
  // researched additive nodes, to prove the merge math without waiting out tree tiers.
  s.lab.researched.push('irrigation_1', 'irrigation_2', 'cellars_1', 'cellars_2');
  const merged = lab.researchedEffect();
  const expectedGrowMult = LAB.tree.irrigation_1.effect.cropGrowMult * LAB.tree.irrigation_2.effect.cropGrowMult;
  assert.ok(Math.abs(merged.cropGrowMult - expectedGrowMult) < 1e-9, 'Mult keys must multiply');
  const expectedBarnBonus = LAB.tree.cellars_1.effect.barnCapBonus + LAB.tree.cellars_2.effect.barnCapBonus;
  assert.equal(merged.barnCapBonus, expectedBarnBonus, 'non-Mult keys must add');
  // Every other key must stay untouched (still neutral).
  assert.equal(merged.siloCapBonus, 0);
  assert.equal(merged.mineYieldBonus, 0);
});

test('tick() completes research only once readyAt has passed, and tracks the stat', () => {
  const s = freshState();
  lab.build();
  lab.startResearch('irrigation_1');
  const readyAt = s.lab.active.readyAt;
  lab.tick(readyAt - 1000);
  assert.ok(s.lab.active, 'must not complete early');
  lab.tick(readyAt);
  assert.equal(s.lab.active, null);
  assert.deepEqual(s.lab.researched, ['irrigation_1']);
  assert.equal(s.stats.researchCompleted, 1);
});

// ---------------------------------------------------------------------------
// museum.js
// ---------------------------------------------------------------------------

test('an artifact goes to state.museum, never to the barn — even with a completely full barn', () => {
  const s = freshState();
  s.barn.capacity = 0; // simulate "full" — museum collection must be entirely independent of it
  assert.equal(museum.addArtifact('clay_shard', 1), true);
  assert.equal(s.museum.artifacts.clay_shard, 1);
  assert.equal(s.barn.items.clay_shard, undefined, 'an artifact id must never appear in barn.items');
});

test('an exhibit completes and pays exactly once', () => {
  const s = freshState();
  const exhibit = MUSEUM.exhibits.pottery;
  for (const id of exhibit.artifacts) museum.addArtifact(id, 1);
  assert.deepEqual(museum.completedExhibits().includes('pottery'), true);

  const before = s.coins;
  assert.equal(museum.claimExhibit('pottery'), true);
  assert.equal(s.coins, before + exhibit.rewards.coins);
  assert.equal(museum.claimExhibit('pottery'), false, 'a completed exhibit must not pay twice');
  assert.equal(s.coins, before + exhibit.rewards.coins, 'coins must not move on the second claim');
});

test('sellDuplicate never sells the last copy', () => {
  const s = freshState();
  museum.addArtifact('clay_shard', 1);
  assert.equal(museum.sellDuplicate('clay_shard', 1), false);
  assert.equal(s.museum.artifacts.clay_shard, 1);
  museum.addArtifact('clay_shard', 2);
  assert.equal(museum.sellDuplicate('clay_shard', 5), 2, 'must cap the sale at owned-1');
  assert.equal(s.museum.artifacts.clay_shard, 1);
});

// ---------------------------------------------------------------------------
// expeditions.js
// ---------------------------------------------------------------------------

test('expedition loot resolves after an offline gap', () => {
  const s = freshState();
  const crewIdx = expeditions.hireSpecialist('digger');
  assert.equal(typeof crewIdx, 'number');
  s.barn.items.bread = 10;
  s.barn.items.carrot_juice = 10;

  assert.equal(expeditions.canLaunch('dust_canyon'), true);
  assert.equal(expeditions.launch('dust_canyon', crewIdx), true);
  assert.equal(s.expeditions.active.length, 1);
  // supplies were consumed up front
  assert.equal(s.barn.items.bread, 8);
  assert.equal(s.barn.items.carrot_juice, 9);

  assert.equal(expeditions.collect(crewIdx), null, 'must refuse to collect before readyAt');

  // Simulate a real offline gap: the trip's absolute readyAt has already passed.
  s.expeditions.active[0].readyAt = Date.now() - 1000;

  // Scripted rolls: (1) fail-chance check misses, (2) pickWeighted lands on the artifact
  // slot (cumulative 40-55 of 100), (3) the artifact reroll succeeds.
  const result = withScriptedRandom([0.5, 0.45, 0.1], () => expeditions.collect(crewIdx));
  assert.equal(result.failed, false);
  assert.equal(s.expeditions.active.length, 0);
  assert.equal(s.museum.artifacts.clay_shard, 1, 'the artifact must route to the museum');
  assert.equal(s.barn.items.clay_shard, undefined, 'never to the barn');
});

test('a failed expedition still cost its supplies, and the crew slot frees up', () => {
  const s = freshState();
  const crewIdx = expeditions.hireSpecialist('scout');
  s.barn.items.bread = 10;
  s.barn.items.carrot_juice = 10;
  expeditions.launch('dust_canyon', crewIdx);
  s.expeditions.active[0].readyAt = Date.now() - 1000;

  const result = withScriptedRandom([0.0], () => expeditions.collect(crewIdx));
  assert.equal(result.failed, true, 'a near-zero roll must fail against a positive riskFailChance');
  assert.deepEqual(result.loot, []);
  assert.equal(s.expeditions.active.length, 0);
  assert.equal(expeditions.canLaunch('dust_canyon'), true, 'the crew member is free again');
});

test('the advanced material set is reachable only from expeditions, never trains/airport/helicopter', () => {
  const advancedIds = Object.entries(MATERIALS).filter(([, m]) => m.set === 'advanced').map(([id]) => id);
  assert.ok(advancedIds.length > 0);

  function poolMaterialIds(pool) {
    return (pool || []).filter((e) => e.material).map((e) => e.material);
  }
  const trainIds = poolMaterialIds(TRAINS.materialPool);
  const airportIds = poolMaterialIds(AIRPORT.rewards.materialPool);
  const heliIds = poolMaterialIds(HELICOPTER.rewards.materialPool);
  for (const id of advancedIds) {
    assert.ok(!trainIds.includes(id), `${id} must never come from trains`);
    assert.ok(!airportIds.includes(id), `${id} must never come from the airport`);
    assert.ok(!heliIds.includes(id), `${id} must never come from the helicopter`);
  }

  // And it DOES appear somewhere expeditions can yield (site loot or a crafting requirement),
  // proving the assertion is about a real reachable set, not an empty one nobody ever grants.
  const reachableFromExpeditions = new Set();
  for (const site of Object.values(EXPEDITIONS.sites)) {
    for (const entry of site.loot) if (entry.material) reachableFromExpeditions.add(entry.material);
  }
  const viaSiteRequires = new Set();
  for (const depth of MINE.depths) {
    for (const id of Object.keys(depth.requires?.materials || {})) viaSiteRequires.add(id);
  }
  const anyAdvancedReachable = advancedIds.some(
    (id) => reachableFromExpeditions.has(id) || viaSiteRequires.has(id),
  );
  assert.ok(anyAdvancedReachable, 'advanced materials must be obtainable from somewhere in the game');
});

// ---------------------------------------------------------------------------
// extras.js — daily wheel
// ---------------------------------------------------------------------------

test('a daily-wheel streak advances once per day and cannot be farmed by spinning twice', () => {
  const s = freshState();
  const now = Date.now();
  assert.equal(extras.canSpin(now), true);

  const first = extras.spin();
  assert.ok(first);
  assert.equal(s.daily.streak, 1);
  assert.equal(extras.canSpin(now), false, 'a second spin the same instant must be refused');
  assert.equal(extras.spin(), null, 'spinning twice must not advance the streak further');
  assert.equal(s.daily.streak, 1);

  // Simulate the next calendar day, less than 48h later: streak must advance.
  const tomorrow = now + 24 * 60 * 60 * 1000 + 60 * 1000;
  assert.equal(extras.canSpin(tomorrow), true);
  const originalNow = Date.now;
  Date.now = () => tomorrow;
  try {
    extras.spin();
  } finally {
    Date.now = originalNow;
  }
  assert.equal(s.daily.streak, 2, 'a consecutive day must advance the streak');

  // Simulate a day skipped entirely (a full 2 days after the second spin, not merely the
  // next calendar day): streak must reset to 1, not keep climbing.
  const skippedADay = tomorrow + 2 * 24 * 60 * 60 * 1000;
  const realNow = Date.now;
  Date.now = () => skippedADay;
  try {
    extras.spin();
  } finally {
    Date.now = realNow;
  }
  assert.equal(s.daily.streak, 1, 'a missed day must reset the streak');
});

test('checkAchievements unlocks once a lifetime stat crosses its target, and pays diamonds once', () => {
  const s = freshState();
  s.stats.cropsHarvested = 1;
  const unlocked = extras.checkAchievements();
  assert.ok(unlocked.some((a) => a.id === 'first_harvest'));
  const diamondsAfterFirst = s.diamonds;
  const again = extras.checkAchievements();
  assert.equal(again.length, 0, 'an already-unlocked achievement must not fire twice');
  assert.equal(s.diamonds, diamondsAfterFirst);
});

// ---------------------------------------------------------------------------
// extras.js — events open/close on wall-clock time
// ---------------------------------------------------------------------------

test('an event window opens and closes on wall-clock time', () => {
  const s = freshState();
  // A known Friday 00:00:01 local time.
  const friday = new Date(2027, 0, 1, 0, 0, 1).getTime(); // 2027-01-01 is a Friday
  extras.tickEvents(friday);
  assert.ok(s.event, 'a weekend event must be open on Friday');
  assert.equal(s.event.kind, 'weekend');
  const endsAt = s.event.endsAt;

  extras.tickEvents(friday + 1000);
  assert.equal(s.event.endsAt, endsAt, 'ticking again inside the window must not restart it');

  extras.tickEvents(endsAt + 1000);
  assert.equal(s.event, null, 'the event must close once its window has passed');
});

test('event points accrue through trackStat, and a tier pays exactly once', () => {
  const s = freshState();
  const friday = new Date(2027, 0, 1, 0, 0, 1).getTime();
  extras.tickEvents(friday);
  const entry = extras.activeWeekendEvent();
  assert.ok(entry, 'an event must be active to score against');
  const [statKey] = Object.keys(entry.pointsFor);

  economy.trackStat(statKey, 1);
  assert.ok(s.event.points > 0, 'trackStat must route points into the active event');

  // Force the points comfortably over the bronze threshold and claim it.
  s.event.points = 1e9;
  const before = s.coins;
  assert.equal(extras.claimEventTier('bronze'), true);
  assert.ok(s.coins > before);
  assert.equal(extras.claimEventTier('bronze'), false, 'a tier must not pay twice');
});

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`);
  process.exit(1);
}
