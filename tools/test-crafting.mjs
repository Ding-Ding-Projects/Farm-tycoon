// tools/test-crafting.mjs — proves workshop.js, minigames.js, mine.js and merge.js.
//
// Plain Node script, no test framework (the project has no dependencies). Exits 0 on
// success, non-zero on first failure category, with a printed summary either way.
//
// Run: node tools/test-crafting.mjs

import assert from 'node:assert/strict';
import * as state from '../src/state.js';
import * as workshop from '../src/workshop.js';
import * as minigames from '../src/minigames.js';
import * as mine from '../src/mine.js';
import * as merge from '../src/merge.js';
import { BUILDINGS, MINIGAMES, MINE, MERGE } from '../src/data.js';

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
  return state.state;
}

function placeWorkshop(s) {
  s.farm.objects.push({ id: 'workshop_1', kind: 'building', type: 'build_workshop', x: 0, y: 0 });
  return s.farm.objects[s.farm.objects.length - 1];
}

function placeBuilding(s, id, type) {
  s.farm.objects.push({ id, kind: 'building', type, x: 5, y: 5 });
  return s.farm.objects[s.farm.objects.length - 1];
}

// ---------------------------------------------------------------------------
// workshop.js
// ---------------------------------------------------------------------------

test('a component recipe consumes its materials exactly once', () => {
  const s = freshState();
  s.level = 6;
  placeWorkshop(s);
  s.barn.items.slab = 1;
  s.barn.items.nails = 1;

  const ok = workshop.craft('shingle');
  assert.equal(ok, true);
  assert.equal(s.barn.items.slab, 0);
  assert.equal(s.barn.items.nails, 0);
  assert.equal(s.production.length, 1);
});

test('craft refuses (and refunds nothing, because it never touches the barn) when short an input', () => {
  const s = freshState();
  s.level = 6;
  placeWorkshop(s);
  s.barn.items.slab = 1; // missing nails entirely
  const before = { ...s.barn.items };

  const ok = workshop.craft('shingle');
  assert.equal(ok, false);
  assert.deepEqual(s.barn.items, before, 'a failed craft must not touch the barn at all');
  assert.equal(s.production.length, 0);
});

test('collecting a finished component pays exactly one unit into the barn', () => {
  const s = freshState();
  s.level = 6;
  placeWorkshop(s);
  s.barn.items.slab = 1;
  s.barn.items.nails = 1;
  workshop.craft('shingle');
  s.production[0].readyAt = Date.now() - 1000; // force-ready

  const result = workshop.collect(0);
  assert.deepEqual(result, { goodId: 'shingle', qty: 1 });
  assert.equal(s.barn.items.shingle, 1);
  assert.equal(s.production.length, 0);
});

test('a kit cannot be consumed when none is held, and nothing is touched', () => {
  const s = freshState();
  assert.equal(workshop.hasKitFor('dairy'), false);
  const ok = workshop.consumeKit('dairy');
  assert.equal(ok, false);
  assert.equal(s.barn.items.kit_dairy || 0, 0);
});

test('a building cannot be placed without its kit (hasKitFor gates placement)', () => {
  const s = freshState();
  assert.equal(workshop.hasKitFor('dairy'), false, 'no kit held yet');
  s.barn.items.kit_dairy = 1;
  assert.equal(workshop.hasKitFor('dairy'), true, 'kit now held');
});

test('a held kit is consumed exactly once by consumeKit, never left negative', () => {
  const s = freshState();
  s.barn.items.kit_dairy = 1;
  const ok = workshop.consumeKit('dairy');
  assert.equal(ok, true);
  assert.equal(s.barn.items.kit_dairy, 0);
  const ok2 = workshop.consumeKit('dairy'); // second attempt: nothing left
  assert.equal(ok2, false);
  assert.equal(s.barn.items.kit_dairy, 0, 'must never go negative');
});

test('a buildingId with no kit requirement always reports hasKitFor true', () => {
  freshState();
  assert.equal(workshop.hasKitFor('feed_mill'), true);
  assert.equal(workshop.hasKitFor('bakery'), true);
});

// ---------------------------------------------------------------------------
// minigames.js
// ---------------------------------------------------------------------------

// The scoring, clamping, determinism and tier rules now live in tools/test-playables.mjs,
// which drives them through the real production queue. What belongs HERE is the one rule the
// workshop itself has to uphold.

test('no build_workshop recipe is playable - a gated kit would be a hard progression block', () => {
  // The most important of the four never-playable classes. A player who could not finish a
  // minigame would otherwise never craft a kit, and so could never place a factory again.
  for (const recipe of BUILDINGS.build_workshop.recipes) {
    assert.equal(recipe.play, undefined,
      `${recipe.id} is a workshop recipe and must never be gated behind a minigame`);
  }
});

test('no recipe that is some building placement kit is playable, wherever it is made', () => {
  const kits = new Set(Object.values(BUILDINGS).map((b) => b.kit).filter(Boolean));
  for (const def of Object.values(BUILDINGS)) {
    for (const recipe of def.recipes) {
      if (kits.has(recipe.id)) {
        assert.equal(recipe.play, undefined, `${recipe.id} is a placement kit and must not be gated`);
      }
    }
  }
});

test('a workshop craft carries no play record and collects without any game', () => {
  const s = freshState();
  s.level = 6;
  placeWorkshop(s);
  s.barn.items.slab = 1;
  s.barn.items.nails = 1;
  assert.equal(workshop.craft('shingle'), true);

  const entry = s.production.find((p) => p.objectId === 'workshop_1');
  assert.ok(entry, 'the craft must be queued');
  assert.equal(entry.play, null, 'a workshop craft is never playable');
  assert.ok(entry.cid, 'but it still gets a stable handle like every other entry');
});

test('pendingBonus returns a zeroed effect (never null) when nothing is pending', () => {
  freshState();
  const bonus = minigames.pendingBonus('no_such_building');
  assert.deepEqual(bonus, { effect: null, amount: 0 });
});

// ---------------------------------------------------------------------------
// mine.js
// ---------------------------------------------------------------------------

test('the surface seam (depth 1) never drops an artifact', () => {
  const s = freshState();
  s.level = 90;
  s.barn.items.pickaxe = 500;
  for (let i = 0; i < 500; i++) {
    const result = mine.digAt('mine_depth_1', 'pickaxe');
    assert.ok(result);
    assert.equal(result.artifact, null, 'the surface seam has artifactChance 0');
  }
});

test('a deeper depth can drop an artifact (statistically, over many digs)', () => {
  const s = freshState();
  s.level = 90;
  s.mine.depthUnlocked.push('mine_depth_5');
  s.barn.items.pickaxe = 4000;
  let sawArtifact = false;
  for (let i = 0; i < 4000 && !sawArtifact; i++) {
    const result = mine.digAt('mine_depth_5', 'pickaxe');
    if (result.artifact) sawArtifact = true;
  }
  assert.equal(sawArtifact, true, 'depth 5 has a 15% artifact chance — 4000 digs must surface at least one');
});

test('digging without a tool held does nothing', () => {
  const s = freshState();
  const before = { ...s.barn.items };
  const result = mine.dig('pickaxe');
  assert.equal(result, null);
  assert.deepEqual(s.barn.items, before);
});

test('digging consumes exactly one tool per dig', () => {
  const s = freshState();
  s.barn.items.pickaxe = 3;
  mine.dig('pickaxe');
  assert.equal(s.barn.items.pickaxe, 2);
  mine.dig('pickaxe');
  assert.equal(s.barn.items.pickaxe, 1);
});

// ---------------------------------------------------------------------------
// merge.js
// ---------------------------------------------------------------------------

test('merge energy regenerates across an offline gap and is capped at max', () => {
  const s = freshState();
  merge.initBoard();
  s.merge.energy = 0;
  const past = Date.now() - (MERGE.energy.regenSeconds * 1000 * (MERGE.energy.max + 50));
  s.merge.energyUpdatedAt = past;

  const energy = merge.currentEnergy(Date.now());
  assert.equal(energy, MERGE.energy.max, 'an enormous offline gap must cap, never overflow, energy');
});

test('merge energy regenerates partially for a partial gap', () => {
  const s = freshState();
  merge.initBoard();
  s.merge.energy = 0;
  const intervalMs = MERGE.energy.regenSeconds * 1000;
  s.merge.energyUpdatedAt = Date.now() - Math.floor(intervalMs * 3.5);

  const energy = merge.currentEnergy(Date.now());
  assert.equal(energy, 3, 'exactly 3 whole intervals have elapsed');
});

test('initBoard is idempotent — a second call never wipes an in-progress board', () => {
  const s = freshState();
  merge.initBoard();
  s.merge.cells[0] = { chain: 'tools', tier: 4 };
  merge.initBoard();
  assert.deepEqual(s.merge.cells[0], { chain: 'tools', tier: 4 });
});

test('two identical mid-tier items can merge into the next tier; mismatched ones cannot', () => {
  const s = freshState();
  merge.initBoard();
  s.merge.cells.fill(null);
  s.merge.cells[0] = { chain: 'tools', tier: 2 };
  s.merge.cells[1] = { chain: 'tools', tier: 2 };
  s.merge.cells[2] = { chain: 'tools', tier: 3 };
  s.merge.cells[3] = { chain: 'plants', tier: 2 };

  assert.equal(merge.canMerge(0, 1), true);
  assert.equal(merge.canMerge(0, 2), false, 'different tiers cannot merge');
  assert.equal(merge.canMerge(0, 3), false, 'different chains cannot merge');

  const result = merge.merge(0, 1);
  assert.ok(result);
  assert.equal(s.merge.cells[1].tier, 3);
  assert.equal(s.merge.cells[0], null);
});

test('the top tier of a chain cannot merge further', () => {
  const s = freshState();
  merge.initBoard();
  s.merge.cells.fill(null);
  const topTier = MERGE.chains.treats.tiers.length - 1;
  s.merge.cells[0] = { chain: 'treats', tier: topTier };
  s.merge.cells[1] = { chain: 'treats', tier: topTier };
  assert.equal(merge.canMerge(0, 1), false);
});

test('claiming a top-tier item pays its topReward and clears the cell', () => {
  const s = freshState();
  merge.initBoard();
  s.merge.cells.fill(null);
  const topTier = MERGE.chains.treats.tiers.length - 1;
  s.merge.cells[0] = { chain: 'treats', tier: topTier };
  const before = s.coins;

  const result = merge.claim(0);
  assert.ok(result);
  assert.equal(s.coins, before + MERGE.chains.treats.topReward.coins);
  assert.equal(s.merge.cells[0], null);
});

test('claiming an unclaimable cell (mid-chain, no claim reward there) fails and touches nothing', () => {
  const s = freshState();
  merge.initBoard();
  s.merge.cells.fill(null);
  s.merge.cells[0] = { chain: 'tools', tier: 0 }; // tier 0 has no claims entry
  const before = s.coins;
  const ok = merge.claim(0);
  assert.equal(ok, false);
  assert.equal(s.coins, before);
  assert.deepEqual(s.merge.cells[0], { chain: 'tools', tier: 0 });
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
