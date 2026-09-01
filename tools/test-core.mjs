// tools/test-core.mjs — proves state.js, economy.js, farm.js and production.js.
//
// Plain Node script, no test framework (the project has no dependencies). Exits 0 on
// success, non-zero on first failure category, with a printed summary either way.
//
// Run: node tools/test-core.mjs

import assert from 'node:assert/strict';
import * as state from '../src/state.js';
import * as economy from '../src/economy.js';
import * as farm from '../src/farm.js';
import * as production from '../src/production.js';
import { NEW_GAME, CROPS, LEVELS, FARM, BUILDINGS, ANIMALS, MERGE, TOWN } from '../src/data.js';

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

// ---------------------------------------------------------------------------
// state.js
// ---------------------------------------------------------------------------

test('newGameState has the documented keys and NEW_GAME values', () => {
  const s = freshState();
  assert.equal(s.coins, NEW_GAME.coins);
  assert.equal(s.diamonds, NEW_GAME.diamonds);
  assert.equal(s.level, NEW_GAME.level);
  assert.equal(s.xp, 0);
  assert.equal(s.vouchers, 0);
  assert.equal(s.silo.items.wheat, NEW_GAME.seeds.wheat);
  assert.equal(s.silo.capacity, 50);
  assert.equal(s.barn.capacity, 50);
  assert.deepEqual(s.production, []);
  assert.ok(Array.isArray(s.farm.objects));
  assert.equal(s.farm.objects.filter((o) => o.kind === 'field').length, NEW_GAME.fields);
  assert.deepEqual(s.farm.unlockedZones, ['start']);
  for (const key of [
    'workshop', 'minigames', 'expeditions', 'museum', 'lab', 'helicopter',
    'islands', 'mine', 'town', 'zoo', 'merge', 'trains', 'airport', 'foraging',
    'newspaper', 'collections', 'decorate', 'photo', 'market',
  ]) {
    assert.ok(key in s, `missing expansion key: ${key}`);
  }
});

test('newGameState seeds state.town/state.zoo/state.market with the shapes town.js/zoo.js/shop.js expect', () => {
  const s = freshState();

  // town.js's own ensureState(): { buildings: [], population: 0, capacity: TOWN.basePopulationCap, claimedMilestones: [] }
  assert.ok(s.town, 'state.town must be present, not lazily absent');
  assert.deepEqual(s.town, {
    buildings: [], population: 0, capacity: TOWN.basePopulationCap, claimedMilestones: [],
  });

  // zoo.js's own ensureState(): { enclosures: {}, lastIncomeAt: Date.now(), orders: [] }
  assert.ok(s.zoo, 'state.zoo must be present, not lazily absent');
  assert.deepEqual(s.zoo.enclosures, {});
  assert.equal(typeof s.zoo.lastIncomeAt, 'number');
  assert.deepEqual(s.zoo.orders, []);

  // shop.js's own ensureMarketState() fallback sentinel: { dayNum: -1, offers: [], bought: [] }
  // (dayNum: -1 deliberately never matches a real market day number, so the first real call
  // to ensureMarketState() sees it as stale and generates that day's offers.)
  assert.ok(s.market, 'state.market must be present, not lazily absent');
  assert.deepEqual(s.market, { dayNum: -1, offers: [], bought: [] });
});

test('newGameState seeds state.merge/state.trains/state.airport with the shapes merge.js/trains.js expect', () => {
  const s = freshState();

  // merge.js's own ensureMergeState(): { cells: Array(cols*rows).fill(null), energy: max, energyUpdatedAt }
  assert.ok(s.merge, 'state.merge must be present, not lazily absent');
  assert.equal(s.merge.cells.length, MERGE.board.cols * MERGE.board.rows);
  assert.ok(s.merge.cells.every((c) => c === null), 'a fresh board must be entirely empty cells');
  assert.equal(s.merge.energy, MERGE.energy.max);
  assert.equal(typeof s.merge.energyUpdatedAt, 'number');

  // trains.js's own ensureState(): state.trains / state.airport
  assert.deepEqual(s.trains, { current: null, returningAt: 0, pendingMaterials: null });
  assert.deepEqual(s.airport, { current: null, returningAt: 0, pendingMaterials: null, pendingBonus: 0 });
});

test('save -> load round-trips to a deep-equal state', () => {
  const s = freshState();
  s.coins += 1234;
  s.silo.items.wheat += 5;
  production.plant(s.farm.objects[0].id, 'wheat');
  state.save();
  const before = JSON.parse(JSON.stringify(state.state));
  state.load();
  assert.deepEqual(state.state, before);
});

test('a malformed save is rejected rather than half-loaded', () => {
  const before = freshState();
  before.coins = 999;
  state.save();
  const ok1 = state.importSave('{ not: valid json');
  assert.equal(ok1, false);
  assert.equal(state.state.coins, 999, 'malformed JSON must not touch live state');

  const ok2 = state.importSave(JSON.stringify({ version: 1, coins: -5 }));
  assert.equal(ok2, false, 'negative coins must be rejected');
  assert.equal(state.state.coins, 999);

  const ok3 = state.importSave(JSON.stringify({ version: 1, coins: 1, farm: {} }));
  assert.equal(ok3, false, 'missing required shape must be rejected');
  assert.equal(state.state.coins, 999);
});

test('a save from an unknown future version is rejected', () => {
  const before = freshState();
  before.coins = 42;
  state.save();
  const ok = state.importSave(JSON.stringify({ ...before, version: 999 }));
  assert.equal(ok, false);
  assert.equal(state.state.coins, 42);
});

test('a v1 save missing every key from every migration walks 1->2->3->4 and comes out complete, preserving every other key exactly', () => {
  const s = freshState();
  // Give the save some real, distinguishing content so "preserved byte-for-byte" is actually
  // being tested, not just a fresh-game object that happens to survive by coincidence.
  s.coins = 4242;
  s.silo.items.wheat += 7;
  s.stats.cropsHarvested = 3;
  const fieldId = s.farm.objects[0].id;
  production.plant(fieldId, 'wheat');

  // Build a synthetic v1 save: today's (v3) state minus every key either migration step
  // adds, with version rolled back to 1 — exactly the shape a save written by an earlier
  // build (v0.1.0-build2..build11 all shipped v1 saves) would have on disk. It must walk
  // MIGRATIONS[1] (merge/trains/airport) *and* MIGRATIONS[2] (town/zoo/market) in sequence,
  // which is the chained path most likely to break if the two steps interact badly.
  const v1 = JSON.parse(JSON.stringify(state.state));
  v1.version = 1;
  for (const key of ['merge', 'trains', 'airport', 'town', 'zoo', 'market']) delete v1[key];
  assert.ok(
    ['merge', 'trains', 'airport', 'town', 'zoo', 'market'].every((key) => !(key in v1)),
    'synthetic v1 save must actually lack all six keys',
  );
  const preMigration = JSON.parse(JSON.stringify(v1));

  const ok = state.importSave(JSON.stringify(v1));
  assert.equal(ok, true, 'a migrated v1 save must still pass isValidSave and import cleanly');
  assert.equal(state.state.version, state.SAVE_VERSION, 'migration must land exactly on the current version');
  assert.equal(state.state.version, 4, 'sanity: the current version really is 4');

  // The v1->v2 keys are present and match the documented/newGameState shape.
  assert.ok(state.state.merge, 'merge must be defaulted by the migration');
  assert.equal(state.state.merge.cells.length, MERGE.board.cols * MERGE.board.rows);
  assert.ok(state.state.merge.cells.every((c) => c === null));
  assert.equal(state.state.merge.energy, MERGE.energy.max);
  assert.deepEqual(state.state.trains, { current: null, returningAt: 0, pendingMaterials: null });
  assert.deepEqual(state.state.airport, { current: null, returningAt: 0, pendingMaterials: null, pendingBonus: 0 });

  // The v2->v3 keys are present and match the documented/newGameState shape too.
  assert.deepEqual(state.state.town, {
    buildings: [], population: 0, capacity: TOWN.basePopulationCap, claimedMilestones: [],
  });
  assert.deepEqual(state.state.zoo.enclosures, {});
  assert.equal(typeof state.state.zoo.lastIncomeAt, 'number');
  assert.deepEqual(state.state.zoo.orders, []);
  assert.deepEqual(state.state.market, { dayNum: -1, offers: [], bought: [] });

  // Every key that existed before migration is untouched. version and lastSaved are the two
  // legitimate exceptions: version changing is the whole point of migrating, and lastSaved is
  // always re-stamped to Date.now() by the save() call inside importSave() itself, regardless
  // of migration — asserting it byte-for-byte would make this test flaky on whichever
  // millisecond boundary the run happens to straddle. Swept via Object.keys + deepEqual rather
  // than spot-checked, so nothing else silently drifts unnoticed.
  for (const key of Object.keys(preMigration)) {
    if (key === 'version' || key === 'lastSaved') continue;
    assert.deepEqual(state.state[key], preMigration[key], `key '${key}' must survive migration byte-for-byte`);
  }

  // The migrated, imported state round-trips through save/load with no further drift. Snapshot
  // AFTER save() (which stamps a fresh lastSaved), matching the existing save->load round-trip
  // test's pattern — snapshotting first would race Date.now() against the save() call below.
  state.save();
  const beforeReload = JSON.parse(JSON.stringify(state.state));
  state.load();
  assert.deepEqual(state.state, beforeReload, 'a migrated save must round-trip through save/load unchanged');
});

test('a v2 save without town/zoo/market migrates forward with them defaulted, preserving every other key exactly', () => {
  const s = freshState();
  s.coins = 1313;
  s.barn.items.egg = 4;
  s.stats.ordersFulfilled = 2;

  // Build a synthetic v2 save: today's (v3) state minus only the three keys the v2->v3
  // migration adds, with version rolled back to 2 — the shape a save written by
  // v0.1.0-build12..build15 (which all shipped v2 saves, per the previous pass's own
  // SAVE_VERSION bump) would have on disk. merge/trains/airport are deliberately left
  // present, since a real v2 save already has them.
  const v2 = JSON.parse(JSON.stringify(state.state));
  v2.version = 2;
  for (const key of ['town', 'zoo', 'market']) delete v2[key];
  assert.ok(
    ['town', 'zoo', 'market'].every((key) => !(key in v2)),
    'synthetic v2 save must actually lack the three keys',
  );
  assert.ok('merge' in v2 && 'trains' in v2 && 'airport' in v2, 'synthetic v2 save must still carry the v1->v2 keys');
  const preMigration = JSON.parse(JSON.stringify(v2));

  const ok = state.importSave(JSON.stringify(v2));
  assert.equal(ok, true, 'a migrated v2 save must still pass isValidSave and import cleanly');
  assert.equal(state.state.version, state.SAVE_VERSION, 'migration must land exactly on the current version');
  assert.equal(state.state.version, 4, 'sanity: the current version really is 4');

  assert.deepEqual(state.state.town, {
    buildings: [], population: 0, capacity: TOWN.basePopulationCap, claimedMilestones: [],
  });
  assert.deepEqual(state.state.zoo.enclosures, {});
  assert.equal(typeof state.state.zoo.lastIncomeAt, 'number');
  assert.deepEqual(state.state.zoo.orders, []);
  assert.deepEqual(state.state.market, { dayNum: -1, offers: [], bought: [] });

  // Every key that existed before migration is untouched (version and lastSaved aside, for
  // the same reason as the v1->v3 test above — lastSaved is always re-stamped by the save()
  // call inside importSave() itself). Swept via Object.keys + deepEqual.
  for (const key of Object.keys(preMigration)) {
    if (key === 'version' || key === 'lastSaved') continue;
    assert.deepEqual(state.state[key], preMigration[key], `key '${key}' must survive migration byte-for-byte`);
  }

  state.save();
  const beforeReload = JSON.parse(JSON.stringify(state.state));
  state.load();
  assert.deepEqual(state.state, beforeReload, 'a migrated save must round-trip through save/load unchanged');
});

test('a valid save round-trips through importSave', () => {
  const s = freshState();
  s.coins = 777;
  const json = state.exportSave();
  s.coins = 0; // mutate live state so we can tell the import actually applied
  const ok = state.importSave(json);
  assert.equal(ok, true);
  assert.equal(state.state.coins, 777);
});

// ---------------------------------------------------------------------------
// economy.js
// ---------------------------------------------------------------------------

test('addCoins increases balance and never goes negative', () => {
  const s = freshState();
  economy.addCoins(100);
  assert.equal(s.coins, NEW_GAME.coins + 100);
  assert.throws(() => economy.addCoins(-999999));
  assert.equal(s.coins, NEW_GAME.coins + 100, 'a rejected spend must not partially apply');
});

test('spendDiamonds fails cleanly and refunds nothing partial', () => {
  const s = freshState();
  const before = s.diamonds;
  assert.equal(economy.spendDiamonds(before + 1), false);
  assert.equal(s.diamonds, before);
  assert.equal(economy.spendDiamonds(1), true);
  assert.equal(s.diamonds, before - 1);
});

test('skipCost is roughly 1 diamond per 10 minutes, minimum 1', () => {
  assert.equal(economy.skipCost(1), 1);
  assert.equal(economy.skipCost(600), 1);
  assert.equal(economy.skipCost(601), 2);
  assert.equal(economy.skipCost(6000), 10);
});

test('addXp levels up and crosses the piecewise seam at level 50 correctly', () => {
  const s = freshState();
  s.level = 49;
  s.xp = 0;
  const needed49 = LEVELS.xpForLevel(49);
  const result = economy.addXp(needed49);
  assert.equal(s.level, 50, 'must cross from 49 to 50 using the <=50 branch cost');
  assert.equal(result.leveledUp, true);
  assert.equal(result.newLevel, 50);

  const needed50 = LEVELS.xpForLevel(50); // first use of the >50 branch
  economy.addXp(needed50);
  assert.equal(s.level, 51, 'must cross the seam from 50 to 51 using the >50 branch cost');
});

test('addXp awards unlocks and diamonds on level-up', () => {
  const s = freshState();
  s.level = 1;
  s.xp = 0;
  const before = s.diamonds;
  const result = economy.addXp(LEVELS.xpForLevel(1));
  assert.equal(s.level, 2);
  assert.equal(s.diamonds, before + 1);
  assert.deepEqual(result.unlocks, LEVELS.unlocks[2]);
});

test('isUnlocked follows both per-entity unlockLevel and LEVELS.unlocks feature gates', () => {
  const s = freshState();
  s.level = 1;
  assert.equal(economy.isUnlocked('wheat'), true); // CROPS.wheat unlockLevel: 1
  assert.equal(economy.isUnlocked('corn'), false); // CROPS.corn unlockLevel: 2
  assert.equal(economy.isUnlocked('town'), false); // feature gate at level 20
  s.level = 20;
  assert.equal(economy.isUnlocked('town'), true);
});

test('sellValue reads the correct table for crops, goods and materials', () => {
  assert.equal(economy.sellValue('wheat'), CROPS.wheat.sellPrice);
  assert.equal(economy.sellValue('egg'), 10);
  assert.equal(economy.sellValue('brick'), 30);
  assert.equal(economy.sellValue('not_a_real_item'), 0);
});

// ---------------------------------------------------------------------------
// farm.js
// ---------------------------------------------------------------------------

test('canPlace / place respects collision, bounds and unlocked zones', () => {
  const s = freshState();
  const { x, y, w, h } = FARM.startZone;
  assert.equal(farm.canPlace(x, y, 1, 1), true);
  assert.equal(farm.canPlace(-1, 0, 1, 1), false, 'off the grid');
  assert.equal(farm.canPlace(FARM.gridSize - 1, 0, 5, 5), false, 'past the far edge');
  assert.equal(farm.canPlace(0, 0, 1, 1), false, 'outside every unlocked zone');

  const spot = { x: x + 1, y: y + 1 };
  const first = farm.place('decoration', 'fence_wood', spot.x, spot.y);
  assert.ok(first, 'placement inside the start zone must succeed');
  const second = farm.place('decoration', 'fence_wood', spot.x, spot.y);
  assert.equal(second, null, 'placing on top of an existing object must fail');
});

test('place deducts coins and a failed purchase never mutates state', () => {
  const s = freshState();
  s.coins = 10; // fence_wood costs 30
  const before = JSON.parse(JSON.stringify(s));
  const result = farm.place('decoration', 'fence_wood', FARM.startZone.x + 1, FARM.startZone.y + 1);
  assert.equal(result, null);
  assert.deepEqual(s, before, 'an unaffordable placement must be a complete no-op');
});

test('remove refunds half the cost and frees the tile', () => {
  const s = freshState();
  s.coins = 1000;
  const spot = { x: FARM.startZone.x + 1, y: FARM.startZone.y + 1 };
  const obj = farm.place('decoration', 'fence_wood', spot.x, spot.y);
  const afterPlace = s.coins;
  const ok = farm.remove(obj.id);
  assert.equal(ok, true);
  assert.equal(s.coins, afterPlace + 15); // half of 30
  assert.equal(farm.objectAt(spot.x, spot.y), null);
});

test('buyExpansion requires level, coins and materials, and never partially deducts', () => {
  const s = freshState();
  const exp = FARM.expansions[0];
  s.level = 1; // expansion_1 unlocks at level 4
  s.coins = exp.cost;
  assert.equal(farm.buyExpansion(exp.id), false, 'must be level-gated');

  s.level = 4;
  s.coins = exp.cost - 1;
  assert.equal(farm.buyExpansion(exp.id), false, 'must require full coin cost');
  assert.equal(s.coins, exp.cost - 1, 'a failed purchase must not deduct coins');

  s.coins = exp.cost;
  assert.equal(farm.buyExpansion(exp.id), false, 'must require the materials too');
  assert.equal(s.coins, exp.cost, 'missing materials must not deduct coins either');

  for (const [mat, qty] of Object.entries(exp.materials)) s.barn.items[mat] = qty;
  const ok = farm.buyExpansion(exp.id);
  assert.equal(ok, true);
  assert.equal(s.coins, 0);
  assert.ok(s.farm.unlockedZones.includes(exp.id));
  for (const mat of Object.keys(exp.materials)) assert.equal(s.barn.items[mat], 0);

  assert.equal(farm.buyExpansion(exp.id), false, 'cannot buy the same expansion twice');
});

// ---------------------------------------------------------------------------
// production.js
// ---------------------------------------------------------------------------

test('plant -> tick past grow time -> harvest yields 2x seeds and positive XP', () => {
  const s = freshState();
  const fieldId = s.farm.objects.find((o) => o.kind === 'field').id;
  s.silo.items.wheat = CROPS.wheat.seedCost;
  const xpBefore = s.xp;

  const planted = production.plant(fieldId, 'wheat');
  assert.equal(planted, true);
  assert.equal(s.silo.items.wheat, 0, 'seedCost must be deducted immediately on plant');

  const future = Date.now() + (CROPS.wheat.growTime + 5) * 1000;
  const readiness = production.tick(future);
  assert.ok(readiness.readyFields.includes(fieldId));

  const result = production.harvest(fieldId, future);
  assert.deepEqual(result, { cropId: 'wheat', qty: CROPS.wheat.seedCost * 2 });
  assert.equal(s.silo.items.wheat, CROPS.wheat.seedCost * 2);
  assert.equal(s.xp > xpBefore, true);

  const field = s.farm.objects.find((o) => o.id === fieldId);
  assert.equal(field.cropId, null, 'field must be empty again after harvest');
});

test('harvesting before grow time completes fails, and offline resolution matches real elapsed time', () => {
  const s = freshState();
  const fieldId = s.farm.objects.find((o) => o.kind === 'field').id;
  s.silo.items.wheat = CROPS.wheat.seedCost;
  production.plant(fieldId, 'wheat');
  const field = s.farm.objects.find((o) => o.id === fieldId);

  assert.equal(production.harvest(fieldId, Date.now()), null, 'not ready yet');

  // Simulate the player returning after two real days offline: push readyAt into the past
  // exactly as it would sit in a save loaded long after growTime elapsed, then resolve it
  // through tick()/harvest() using "now" the same way a live two-day wait would.
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  field.readyAt = twoDaysAgo;
  const now = Date.now();
  const readiness = production.tick(now);
  assert.ok(readiness.readyFields.includes(fieldId), 'offline elapsed time must resolve as ready');
  const result = production.harvest(fieldId, now);
  assert.equal(result.qty, CROPS.wheat.seedCost * 2, 'offline harvest must yield exactly as a live one would');
});

test('harvest output is capped by silo capacity', () => {
  const s = freshState();
  const fieldId = s.farm.objects.find((o) => o.kind === 'field').id;
  s.silo.capacity = 5;
  s.silo.items = { wheat: CROPS.wheat.seedCost };
  production.plant(fieldId, 'wheat'); // uses seedCost, leaving 0 stored, room = 5
  const field = s.farm.objects.find((o) => o.id === fieldId);
  field.readyAt = Date.now() - 1000;
  // Fill the silo with an unrelated crop so there is only 1 slot of room left.
  s.silo.items.corn = s.silo.capacity - 1;
  const result = production.harvest(fieldId, Date.now());
  assert.equal(result.qty, 1, 'harvest must cap at remaining silo room, never overflow it');
  assert.equal(totalAfterCap(s), s.silo.capacity);
});
function totalAfterCap(s) { return Object.values(s.silo.items).reduce((a, b) => a + b, 0); }

test('feedPen consumes feed once and collectPen is capped by barn capacity', () => {
  const s = freshState();
  const pen = farm.place('pen', 'chicken', FARM.startZone.x + 8, FARM.startZone.y + 3);
  assert.ok(pen, 'placing the pen must succeed');
  s.barn.items.chicken_feed = ANIMALS.chicken.capacity;

  const fed = production.feedPen(pen.id);
  assert.equal(fed, true);
  assert.equal(s.barn.items.chicken_feed, 0, 'feed must be consumed exactly once');
  assert.equal(production.feedPen(pen.id), false, 'cannot feed an already-producing pen');

  s.barn.capacity = ANIMALS.chicken.capacity - 1; // deliberately too small for the full yield
  s.barn.items = { chicken_feed: 0 };
  const now = Date.now() + (ANIMALS.chicken.produceTime + 5) * 1000;
  const result = production.collectPen(pen.id, now);
  assert.equal(result.qty, ANIMALS.chicken.capacity - 1, 'collect must cap at barn room');

  const stillPen = s.farm.objects.find((o) => o.id === pen.id);
  assert.equal(stillPen.readyAt, null, 'a capped-but-nonzero collect still clears the timer');
});

test('enqueue consumes inputs exactly once, refunds nothing on failure, and collect fills the barn', () => {
  const s = freshState();
  s.coins = 1000;
  const building = farm.place('building', 'bakery', FARM.startZone.x + 5, FARM.startZone.y + 7);
  assert.ok(building);
  const recipe = BUILDINGS.bakery.recipes.find((r) => r.id === 'bread');
  s.silo.items.wheat = recipe.inputs.wheat; // exactly enough, no more

  const firstEnqueue = production.enqueue(building.id, 'bread');
  assert.equal(firstEnqueue, true, 'exactly enough stock must succeed');
  assert.equal(s.silo.items.wheat, 0, 'inputs must be consumed exactly once, immediately');

  assert.equal(production.enqueue(building.id, 'bread'), false, 'insufficient inputs must fail cleanly');
  assert.equal(s.silo.items.wheat, 0, 'a failed enqueue must not touch stock further');

  const now = Date.now() + (recipe.time + 5) * 1000;
  const readiness = production.tick(now);
  assert.ok(readiness.readyBuildings.includes(building.id));

  const collected = production.collectBuilding(building.id, now);
  assert.deepEqual(collected, { goodId: 'bread', qty: 1, tier: null },
    'a non-playable recipe collects with a null tier — no quality channel applies to it');
  assert.equal(s.barn.items.bread, 1);
  assert.equal(s.production.length, 0, 'the finished queue entry must be removed once collected');
});

test('enqueue respects queueSlots', () => {
  const s = freshState();
  s.coins = 1000;
  const building = farm.place('building', 'bakery', FARM.startZone.x + 5, FARM.startZone.y + 7);
  s.silo.items.wheat = 999;
  const slots = BUILDINGS.bakery.queueSlots;
  for (let i = 0; i < slots; i++) {
    assert.equal(production.enqueue(building.id, 'bread'), true, `slot ${i} must accept`);
  }
  assert.equal(production.enqueue(building.id, 'bread'), false, 'queue must reject once full');
});

test('skipTimer spends diamonds and clears the wait; insufficient diamonds refunds nothing', () => {
  const s = freshState();
  const fieldId = s.farm.objects.find((o) => o.kind === 'field').id;
  s.silo.items.wheat = CROPS.wheat.seedCost;
  production.plant(fieldId, 'wheat');
  const field = s.farm.objects.find((o) => o.id === fieldId);
  const readyAtBefore = field.readyAt;

  s.diamonds = 0;
  assert.equal(production.skipTimer(field), false, 'must fail with no diamonds');
  assert.equal(field.readyAt, readyAtBefore, 'a failed skip must not touch the timer');

  s.diamonds = 999;
  assert.equal(production.skipTimer(field), true);
  assert.ok(field.readyAt <= Date.now());
});

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`);
  process.exit(1);
}
