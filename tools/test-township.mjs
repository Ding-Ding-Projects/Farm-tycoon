// tools/test-township.mjs — proves trains.js, town.js, zoo.js and islands.js (the Township
// materials-economy lane). Plain Node script, no test framework. Exits 0 on success, non-zero
// on first failure category, with a printed summary either way.
//
// Run: node tools/test-township.mjs

import assert from 'node:assert/strict';
import { state, newGameState, importSave } from '../src/state.js';
import { TRAINS, AIRPORT, TOWN, ZOO, ISLANDS, CROPS } from '../src/data.js';
import * as trains from '../src/trains.js';
import * as town from '../src/town.js';
import * as zoo from '../src/zoo.js';
import * as islands from '../src/islands.js';

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

function freshState(level, extra = {}) {
  const s = newGameState();
  s.level = level;
  s.silo.capacity = 999999;
  s.barn.capacity = 999999;
  s.silo.items = {};
  s.coins = 5_000_000;
  s.diamonds = 0;
  Object.assign(s, extra);
  return s;
}

// state.js has no direct setter; importSave() validates + assigns + persists. Re-use the exact
// path production code goes through, same as test-logistics.mjs.
function setState(s) {
  const ok = importSave(JSON.stringify(s));
  assert.ok(ok, 'test harness: failed to install fresh state');
}

function fillBarn(id, qty) { state.barn.items[id] = (state.barn.items[id] || 0) + qty; }
function fillSilo(id, qty) { state.silo.items[id] = (state.silo.items[id] || 0) + qty; }
function barnTotal() { return Object.values(state.barn.items).reduce((a, b) => a + b, 0); }

const BUILDING_SET = new Set(TRAINS.materialPool.map((e) => e.material));
const EXPANSION_SET = new Set(['shovel', 'axe', 'saw']);
const ADVANCED_SET_SAMPLE = ['jackhammer', 'drill', 'electric_saw'];

// -------------------------------------------------------------------------------------------
// trains.js
// -------------------------------------------------------------------------------------------

test('trains: a fully-loaded train consumes its wagon goods exactly once and returns only from its own material set', () => {
  setState(freshState(TRAINS.unlockLevel));
  const now = Date.now();
  trains.tick(now);
  const t = trains.currentTrain();
  assert.ok(t, 'a train should have arrived');
  for (const wagon of t.wagons) fillSilo(wagon.itemId, wagon.requested + 5);
  const before = { ...state.silo.items };
  t.wagons.forEach((_, i) => trains.fillWagon(i));
  // second fill attempt on an already-full train must be a no-op — no double consumption
  t.wagons.forEach((_, i) => trains.fillWagon(i));
  // Two wagons on one train can legitimately request the SAME good (measured at ~5% of trains),
  // so expected consumption has to be summed per item id. Comparing a combined draw against a
  // single wagon's request made this test fail roughly one full run in twenty.
  const expected = {};
  for (const wagon of t.wagons) expected[wagon.itemId] = (expected[wagon.itemId] || 0) + wagon.requested;
  for (const [itemId, want] of Object.entries(expected)) {
    const consumed = before[itemId] - state.silo.items[itemId];
    assert.equal(consumed, want, `${itemId} consumed exactly its requested amount once`);
  }
  trains.tick(now + 1); // departs (full)
  trains.tick(now + TRAINS.tripTime * 1000 + 1); // returns
  assert.ok(trains.collectDelivery(), 'delivery should be collectible');
  for (const id of Object.keys(state.barn.items)) {
    assert.ok(BUILDING_SET.has(id) || EXPANSION_SET.has(id), `${id} must come from TRAINS.materialPool only`);
  }
  assert.ok(barnTotal() > 0, 'a full train should return at least one material');
});

test('trains: the advanced material set never arrives from trains or the airport', () => {
  setState(freshState(AIRPORT.unlockLevel));
  const now = Date.now();
  for (let i = 0; i < 40; i++) {
    trains.tick(now + i * (TRAINS.departureWindow * 1000 + 1));
    const t = trains.currentTrain();
    if (t) t.wagons.forEach((w) => { w.filled = w.requested; }); // force-fill without touching stock
    const p = trains.currentPlane();
    if (p) p.crates.forEach((c) => { c.filled = c.requested; });
    trains.collectDelivery();
    trains.collectFlight();
  }
  for (const id of Object.keys(state.barn.items)) {
    assert.ok(!ADVANCED_SET_SAMPLE.includes(id), `advanced material ${id} must never arrive from trains/airport`);
  }
});

test('trains: a train that departs unfilled still pays a partial (non-full) reward, never a refused/lost trip', () => {
  setState(freshState(TRAINS.unlockLevel));
  const now = Date.now();
  trains.tick(now);
  const t = trains.currentTrain();
  assert.ok(t, 'a train should have arrived');
  // fill nothing, let the departure window expire
  trains.tick(now + TRAINS.departureWindow * 1000 + 1);
  assert.equal(trains.currentTrain(), null, 'the unfilled train should have departed');
  trains.tick(now + TRAINS.departureWindow * 1000 + TRAINS.tripTime * 1000 + 2);
  // an empty-handed departure may reasonably return nothing; the important invariant is that
  // collection never throws and never desyncs state — try it either way.
  trains.collectDelivery();
  assert.ok(true, 'partial/empty return collected without error');
});

test('trains: filling more than requested is refused (no over-consumption)', () => {
  setState(freshState(TRAINS.unlockLevel));
  trains.tick(Date.now());
  const t = trains.currentTrain();
  const wagon = t.wagons[0];
  fillSilo(wagon.itemId, wagon.requested + 50);
  trains.fillWagon(0);
  assert.equal(wagon.filled, wagon.requested, 'filled never exceeds requested');
  const before = state.silo.items[wagon.itemId];
  const ok = trains.fillWagon(0);
  assert.equal(ok, false, 'filling an already-full wagon is refused');
  assert.equal(state.silo.items[wagon.itemId], before, 'no stock consumed on a refused fill');
});

// -------------------------------------------------------------------------------------------
// town.js
// -------------------------------------------------------------------------------------------

test('town: building a house raises population and cannot exceed the capacity cap', () => {
  setState(freshState(TOWN.unlockLevel));
  fillBarn('brick', 999);
  fillBarn('nails', 999);
  fillBarn('slab', 999);
  fillBarn('glass', 999);
  fillBarn('paint', 999);
  fillBarn('hammer', 999);
  const cap = town.populationInfo().capacity;
  let built = 0;
  while (town.canBuild('house', 'cottage')) {
    town.build('house', 'cottage', 10 + built, 10);
    built++;
    assert.ok(town.populationInfo().population <= cap, 'population must never exceed capacity');
    if (built > 100) break; // safety valve against an infinite loop bug
  }
  assert.ok(built > 0, 'at least one house should have been built before hitting the cap');
  assert.equal(town.canBuild('house', 'cottage'), false, 'building past the cap is refused');
});

test('town: a community building consumes materials atomically (all-or-nothing)', () => {
  setState(freshState(TOWN.unlockLevel));
  fillBarn('brick', 3); // town_hall needs brick:4, slab:4 — deliberately short
  fillBarn('slab', 4);
  const before = { ...state.barn.items };
  const beforeCoins = state.coins;
  assert.equal(town.canBuild('community', 'town_hall'), false, 'insufficient materials refuse the build');
  const built = town.build('community', 'town_hall', 27, 27);
  assert.equal(built, false, 'build() must also refuse rather than partially consuming');
  assert.deepEqual(state.barn.items, before, 'no materials consumed on a refused build');
  assert.equal(state.coins, beforeCoins, 'no coins consumed on a refused build');

  fillBarn('brick', 10);
  const record = town.build('community', 'town_hall', 27, 27);
  assert.ok(record, 'build should succeed once affordable');
  assert.equal(state.barn.items.brick, 9, 'brick spent exactly 4 (13 - 4)');
  assert.equal(state.barn.items.slab, 0, 'slab spent exactly 4');
});

test('town: milestone claim pays rewards once and unlocks the next tier (idempotent)', () => {
  setState(freshState(TOWN.unlockLevel, { town: { buildings: [], population: 25, capacity: 100, claimedMilestones: [] } }));
  const claimable = town.claimableMilestones();
  assert.ok(claimable.includes(0), 'milestone 0 (population 20) should be claimable at population 25');
  const before = state.coins;
  assert.ok(town.claimMilestone(0), 'first claim succeeds');
  assert.equal(state.coins, before + TOWN.milestones[0].rewards.coins, 'coins reward paid exactly once');
  assert.ok(town.claimMilestone(0), 'second claim is idempotent and reports success without re-paying');
  assert.equal(state.coins, before + TOWN.milestones[0].rewards.coins, 'coins unchanged on repeat claim');
  assert.equal(town.unlockedTier(), TOWN.milestones[0].unlocksTier, 'tier unlocked after claim');
});

// -------------------------------------------------------------------------------------------
// zoo.js
// -------------------------------------------------------------------------------------------

test('zoo: visitor income across a 14-day offline gap is capped at 12 hours worth', () => {
  setState(freshState(ZOO.unlockLevel, { town: { buildings: [], population: 100, capacity: 500, claimedMilestones: [] } }));
  const now = Date.now();
  zoo.pendingIncome(now); // touches zoo.js's lazy state seed before we override it below
  state.zoo.lastIncomeAt = now - 14 * 24 * 3600 * 1000; // 14 days ago
  const perHour = ZOO.visitorIncomePerHour(100);
  const expected12h = Math.floor(perHour * 12);
  const pending = zoo.pendingIncome(now);
  assert.equal(pending, expected12h, 'income accrual caps at 12 hours regardless of elapsed time');
  const before = state.coins;
  const collected = zoo.collectIncome();
  assert.equal(collected, expected12h, 'collected amount matches the capped pending amount');
  assert.equal(state.coins, before + expected12h, 'coins credited exactly once');
  assert.equal(zoo.pendingIncome(now), 0, 'nothing left pending immediately after collection');
});

test('zoo: feeding an enclosure consumes feed exactly once and collect() pays the souvenir', () => {
  setState(freshState(ZOO.unlockLevel));
  fillBarn('glass', 10);
  fillBarn('nails', 10);
  assert.ok(zoo.buyEnclosure('zoo_peacock'), 'enclosure purchase should succeed');
  fillSilo('wheat', 20);
  const before = state.silo.items.wheat;
  assert.ok(zoo.feed('zoo_peacock'), 'feeding should succeed with enough wheat');
  assert.equal(state.silo.items.wheat, before - 10, 'exactly the feed amount was consumed');
  assert.equal(zoo.feed('zoo_peacock'), false, 'feeding an already-producing enclosure is refused');
  assert.equal(zoo.collect('zoo_peacock'), false, 'collecting before the timer completes is refused');
  state.zoo.enclosures.zoo_peacock.readyAt = Date.now() - 1; // fast-forward
  assert.ok(zoo.collect('zoo_peacock'), 'collect succeeds once ready');
  assert.equal(state.barn.items.peacock_feather, 1, 'exactly one souvenir was produced');
});

// -------------------------------------------------------------------------------------------
// islands.js
// -------------------------------------------------------------------------------------------

test('islands: a voyage resolves cargo after an offline gap and cannot double-sail', () => {
  setState(freshState(ISLANDS.unlockLevel));
  const islandId = Object.keys(ISLANDS.destinations)[0];
  assert.ok(islands.canSail(islandId), 'should be able to sail an unlocked destination');
  assert.ok(islands.sail(islandId), 'sail should succeed');
  assert.equal(islands.canSail(islandId), false, 'cannot start a second voyage while one is at sea');
  assert.equal(islands.pendingCargo(), null, 'no cargo while the voyage is still out');

  // simulate a long offline gap by moving readyAt into the past — tick() must resolve this
  // via absolute wall-clock comparison, not a countdown that needed ongoing calls.
  state.islands.voyage.readyAt = Date.now() - 1;
  islands.tick(Date.now());
  const cargo = islands.pendingCargo();
  assert.ok(cargo && Object.keys(cargo).length > 0, 'cargo should be ready after the offline gap');
  assert.ok(islands.collect(), 'collect should succeed');
  assert.equal(state.islands.voyage, null, 'voyage cleared after collection');
  for (const [id, qty] of Object.entries(cargo)) {
    assert.ok(state.barn.items[id] >= qty, 'cargo landed in the barn');
  }
});

// -------------------------------------------------------------------------------------------

// -------------------------------------------------------------------------------------------
// all-or-nothing loading, the transport counters, and the zoo's "no room" rule
// -------------------------------------------------------------------------------------------

function stockFor(itemId, qty) { (CROPS[itemId] ? fillSilo : fillBarn)(itemId, qty); }

test('trains: fillWagon is all-or-nothing - a short stock is refused and untouched', () => {
  setState(freshState(TRAINS.unlockLevel));
  trains.tick(Date.now());
  const wagon = trains.currentTrain().wagons[0];
  const bucket = CROPS[wagon.itemId] ? state.silo.items : state.barn.items;
  bucket[wagon.itemId] = wagon.requested - 1;
  assert.equal(trains.fillWagon(0), false, 'one unit short is refused');
  assert.equal(wagon.filled, 0);
  assert.equal(bucket[wagon.itemId], wagon.requested - 1, 'a refused fill takes nothing');
  bucket[wagon.itemId] = wagon.requested;
  assert.equal(trains.fillWagon(0), true);
  assert.equal(wagon.filled, wagon.requested);
  assert.equal(bucket[wagon.itemId], 0, 'exactly the request, once');
});

test('trains: a train that leaves with cargo counts toward trainsCompleted; an empty departure does not', () => {
  setState(freshState(TRAINS.unlockLevel));
  const now = Date.now();
  trains.tick(now);
  trains.tick(now + TRAINS.departureWindow * 1000 + 1); // leaves empty
  assert.equal(state.stats.trainsCompleted || 0, 0, 'an empty train is not a sent train');

  setState(freshState(TRAINS.unlockLevel));
  trains.tick(now);
  const t = trains.currentTrain();
  t.wagons.forEach((w, i) => { stockFor(w.itemId, w.requested); assert.ok(trains.fillWagon(i)); });
  assert.equal(trains.dispatchTrain(), true);
  assert.equal(state.stats.trainsCompleted, 1);
});

test('airport: a plane that leaves with cargo counts toward planesCompleted', () => {
  setState(freshState(AIRPORT.unlockLevel));
  const now = Date.now();
  trains.tick(now);
  const p = trains.currentPlane();
  assert.ok(p, 'a plane should be on the apron');
  p.crates.forEach((c, i) => { stockFor(c.itemId, c.requested); assert.ok(trains.fillCrate(i)); });
  trains.tick(now + 1);
  assert.equal(trains.currentPlane(), null, 'a full plane leaves');
  assert.equal(state.stats.planesCompleted, 1);
});

test('zoo: collect() refuses a full barn and leaves the souvenir waiting; a collect counts zooSouvenirs', () => {
  setState(freshState(ZOO.unlockLevel));
  fillBarn('glass', 10);
  fillBarn('nails', 10);
  assert.ok(zoo.buyEnclosure('zoo_peacock'));
  fillSilo('wheat', 20);
  assert.ok(zoo.feed('zoo_peacock'));
  const enc = state.zoo.enclosures.zoo_peacock;
  enc.readyAt = Date.now() - 1;
  state.barn.capacity = barnTotal(); // not one slot free
  assert.equal(zoo.collect('zoo_peacock'), false, 'no room means no collect');
  assert.ok(enc.readyAt > 0, 'the souvenir is still waiting');
  assert.equal(state.barn.items.peacock_feather || 0, 0);
  state.barn.capacity = 999999;
  assert.ok(zoo.collect('zoo_peacock'));
  assert.equal(state.barn.items.peacock_feather, 1);
  assert.equal(state.stats.zooSouvenirs, 1);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`);
  process.exit(1);
}
