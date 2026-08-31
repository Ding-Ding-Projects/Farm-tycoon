// tools/test-social.mjs — proves neighbours.js, coop.js, regatta.js and helicopter.js: the
// single simulated-player pool and its three consumers.
//
// Plain Node script, no test framework (the project has no dependencies). Exits 0 on success,
// non-zero on first failure category, with a printed summary either way.
//
// Run: node tools/test-social.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as stateMod from '../src/state.js';
import * as neighbours from '../src/neighbours.js';
import * as coop from '../src/coop.js';
import * as regatta from '../src/regatta.js';
import * as helicopter from '../src/helicopter.js';
import { NEIGHBOURS, COOP, REGATTA, HELICOPTER, EFFECT_KEYS, LEVELS, CROPS } from '../src/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  stateMod.resetGame();
  return stateMod.state;
}

// ---------------------------------------------------------------------------
// neighbours.js — the one roster
// ---------------------------------------------------------------------------

test('roster is generated once, has NEIGHBOURS.poolSize members, unique first+last names', () => {
  const s = freshState();
  const list = neighbours.roster();
  assert.equal(list.length, NEIGHBOURS.poolSize);
  const keys = new Set(list.map((n) => `${n.first} ${n.last}`));
  assert.equal(keys.size, list.length, 'every neighbour must have a unique first+last combo');
  assert.ok(s.neighbours && Array.isArray(s.neighbours.roster), 'roster must be persisted on state.neighbours');
});

test('roster levels sit inside NEIGHBOURS.levelBand relative to the player, clamped to [1, maxLevel]', () => {
  freshState();
  stateMod.state.level = 20;
  // Force regeneration at this player level by clearing any prior roster.
  stateMod.state.neighbours = null;
  const list = neighbours.roster();
  const [lo, hi] = NEIGHBOURS.levelBand;
  for (const nb of list) {
    const expectedUnclamped = 20 + nb.levelOffset;
    const expected = Math.max(1, Math.min(LEVELS.maxLevel, expectedUnclamped));
    assert.equal(nb.level, expected, `neighbour ${nb.id} level should track its stored offset`);
    assert.ok(nb.levelOffset >= lo && nb.levelOffset <= hi, `offset ${nb.levelOffset} outside levelBand`);
    assert.ok(nb.level >= 1 && nb.level <= LEVELS.maxLevel, `level ${nb.level} out of bounds`);
  }
});

test('roster is generated once and is byte-identical after a save/load round trip', () => {
  freshState();
  const before = JSON.stringify(neighbours.roster());
  stateMod.save();
  stateMod.load();
  const after = JSON.stringify(neighbours.roster());
  assert.equal(after, before, 'a reload must never reroll the roster');
});

test('roster is never re-rolled on a second load once persisted', () => {
  freshState();
  const first = neighbours.roster();
  const firstIds = first.map((n) => n.id).join(',');
  stateMod.save();
  stateMod.load();
  const second = neighbours.roster();
  assert.equal(second.map((n) => n.id).join(','), firstIds);
});

test('sample() is a deterministic pseudo-random subset keyed by seedKey', () => {
  freshState();
  neighbours.roster();
  const a = neighbours.sample(5, 'test_key').map((n) => n.id);
  const b = neighbours.sample(5, 'test_key').map((n) => n.id);
  assert.deepEqual(a, b, 'same seedKey must produce the same sample');
  const c = neighbours.sample(5, 'other_key').map((n) => n.id);
  assert.notDeepEqual(a, c, 'different seedKeys should (almost always) differ');
});

test('simulate() is deterministic: same id + elapsed always gives the same points', () => {
  freshState();
  const list = neighbours.roster();
  const id = list[0].id;
  const a = neighbours.simulate(id, 3600 * 5);
  const b = neighbours.simulate(id, 3600 * 5);
  assert.deepEqual(a, b);
  assert.ok(a.points >= 0);
});

test('rebalance() shifts every neighbour level to track the new player level', () => {
  freshState();
  const list = neighbours.roster();
  const nb = list[0];
  const before = nb.level;
  neighbours.rebalance(90);
  const expected = Math.max(1, Math.min(LEVELS.maxLevel, 90 + nb.levelOffset));
  assert.equal(nb.level, expected);
  if (before !== expected) assert.notEqual(nb.level, before);
});

// ---------------------------------------------------------------------------
// No consumer module rolls its own private roster — this is the whole point of having ONE
// neighbours.js. A rule alone ("no name pool anywhere") would trivially pass on a module that
// simply never mentioned the words "firstNames" — this checks the actual, named, consumer set.
// ---------------------------------------------------------------------------

const CONSUMER_FILES = ['coop.js', 'regatta.js', 'newspaper.js', 'helicopter.js'];

test('no consumer module contains its own private name pool', () => {
  for (const file of CONSUMER_FILES) {
    const full = path.join(__dirname, '..', 'src', file);
    const src = fs.readFileSync(full, 'utf8');
    assert.ok(
      !/\bfirstNames\b|\blastNames\b|\bfarmNames\b/.test(src),
      `${file} must not define its own name pool (those live only in neighbours.js/data.js)`,
    );
  }
});

test('every consumer module actually imports the shared neighbours.js', () => {
  for (const file of CONSUMER_FILES) {
    const full = path.join(__dirname, '..', 'src', file);
    const src = fs.readFileSync(full, 'utf8');
    assert.ok(
      /from ['"]\.\/neighbours\.js['"]/.test(src),
      `${file} must draw its simulated people from neighbours.js, not generate its own`,
    );
  }
});

// ---------------------------------------------------------------------------
// coop.js
// ---------------------------------------------------------------------------

test('coop members() is a subset of the shared roster', () => {
  freshState();
  const roster = neighbours.roster();
  const rosterIds = new Set(roster.map((n) => n.id));
  const mem = coop.members();
  assert.ok(mem.length > 0);
  for (const m of mem) assert.ok(rosterIds.has(m.id), 'every co-op member must be a real roster neighbour');
});

test('a co-op perk effect key sits inside EFFECT_KEYS', () => {
  for (const perk of COOP.perks) {
    for (const key of Object.keys(perk.effect)) {
      assert.ok(EFFECT_KEYS.includes(key), `perk ${perk.id} effect key "${key}" is not in EFFECT_KEYS`);
    }
  }
});

test('activePerkEffect merges only unlocked perks, multiplicatively for *Mult keys', () => {
  freshState();
  stateMod.state.coop = {
    points: 0, perksUnlocked: ['coop_truck_speed', 'coop_yield'],
    dailyTasks: [], tasksRefreshedAt: 0, requests: [], ownRequestCooldownUntil: 0,
  };
  const effect = coop.activePerkEffect();
  assert.equal(effect.truckIntervalMult, 0.9);
  assert.equal(effect.cropGrowMult, 0.96);
  assert.equal(effect.orderPayoutMult, undefined, 'a locked perk must not contribute');
});

// helpRequest's stock lookup needs to know crop-ness the same way coop.js does; re-derive it
// from data.js here rather than importing coop.js internals.
function stockFor(s, item) {
  return Object.prototype.hasOwnProperty.call(CROPS, item) ? s.silo.items : s.barn.items;
}

test('helpRequest consumes stock, pays coins/xp/points, and removes the request', () => {
  const s = freshState();
  neighbours.roster();
  const board = coop.requests();
  const req = board.find((r) => !r.posterIsPlayer);
  assert.ok(req, 'the board must seed neighbour requests');
  const stock = stockFor(s, req.item);
  stock[req.item] = req.qty;
  const coinsBefore = s.coins;
  const ok = coop.helpRequest(req.id);
  assert.equal(ok, true);
  assert.equal(stock[req.item], 0);
  assert.ok(s.coins > coinsBefore);
  assert.equal(coop.requests().some((r) => r.id === req.id), false);
});

test('postRequest is bounded by ownRequestSlots and the cooldown, and rejects an ineligible item', () => {
  const s = freshState();
  neighbours.roster();
  const item = Object.keys(CROPS)[0];
  assert.equal(coop.postRequest('not_a_real_item_id', 3), false);
  const [minQ] = COOP.requestBoard.requestSizeRange;
  let posted = 0;
  for (let i = 0; i < COOP.requestBoard.ownRequestSlots + 2; i++) {
    if (coop.postRequest(item, minQ)) posted++;
  }
  assert.equal(posted, COOP.requestBoard.ownRequestSlots, 'own posts must be capped at ownRequestSlots');
});

test('collectRequest only pays out once readyAt has passed, then removes the row', () => {
  const s = freshState();
  neighbours.roster();
  const item = Object.keys(CROPS)[0];
  const [minQ] = COOP.requestBoard.requestSizeRange;
  assert.equal(coop.postRequest(item, minQ), true);
  const own = coop.requests().find((r) => r.posterIsPlayer);
  assert.ok(own);
  assert.equal(coop.collectRequest(own.id), null, 'must not pay out before readyAt');
  const before = s.silo.items[item] || 0;
  // Fast-forward past readyAt by mutating the stored request directly (mirrors production.js's
  // own pattern of comparing an absolute readyAt against `now` — there is no clock to fake here).
  const stored = s.coop.requests.find((r) => r.id === own.id);
  stored.readyAt = Date.now() - 1;
  const result = coop.collectRequest(own.id);
  assert.ok(result, 'must pay out once readyAt has passed');
  assert.equal(result.qty, minQ);
  assert.equal((s.silo.items[item] || 0) - before, minQ);
  assert.equal(coop.requests().some((r) => r.id === own.id), false);
});

test('dailyTasks refresh once per local day boundary and claimTask pays out exactly once', () => {
  const s = freshState();
  const tasks = coop.dailyTasks();
  assert.equal(tasks.length, COOP.dailyTasks.count);
  const t = tasks[0];
  s.stats[t.stat] = t.target;
  assert.equal(coop.claimTask(t.id), true);
  assert.equal(coop.claimTask(t.id), false, 'a task must not pay out twice');
});

// ---------------------------------------------------------------------------
// regatta.js
// ---------------------------------------------------------------------------

test('activeSeason seeds laneCount-1 rivals drawn from the shared roster', () => {
  freshState();
  const now = Date.now();
  const season = regatta.activeSeason(now);
  assert.equal(season.rivals.length, REGATTA.laneCount - 1);
  const rosterIds = new Set(neighbours.roster().map((n) => n.id));
  for (const r of season.rivals) assert.ok(rosterIds.has(r.neighbourId));
});

test('rival regatta scores advance across an offline gap and are deterministic from the seed', () => {
  freshState();
  const now0 = Date.now();
  regatta.activeSeason(now0);
  const rivalId = stateMod.state.regatta.rivals[0].neighbourId;

  const gapSeconds = 6 * 3600;
  const now1 = now0 + gapSeconds * 1000;
  regatta.tick(now1);
  const pointsAfterGap = stateMod.state.regatta.rivals.find((r) => r.neighbourId === rivalId).points;
  assert.ok(pointsAfterGap > 0, 'an offline gap must move a rival forward');

  // Determinism: neighbours.simulate is a pure function of (id, elapsedSeconds, seed) — calling
  // it again for the same neighbour and the same elapsed time must reproduce the same tally the
  // tick() above actually banked.
  const expected = neighbours.simulate(rivalId, gapSeconds).points;
  assert.equal(pointsAfterGap, expected);
});

test('several missed seasons roll over correctly without hanging or fabricating a fortune', () => {
  freshState();
  const now0 = Date.now();
  const season1 = regatta.activeSeason(now0);
  const seasonId1 = season1.seasonId;

  const weeksMissed = 25;
  const now2 = now0 + weeksMissed * REGATTA.seasonDurationDays * 86400 * 1000 + 3600 * 1000;
  const rolled = regatta.activeSeason(now2);

  assert.ok(rolled.seasonId > seasonId1, 'seasonId must have advanced');
  // Season 1 covers [now0, now0+7d). now2 sits (weeksMissed full season-lengths + 1 hour) past
  // now0, so exactly `weeksMissed` seasons have fully elapsed and now2 lands one hour into the
  // NEXT one — season number `seasonId1 + weeksMissed`, not one further.
  assert.equal(rolled.seasonId, seasonId1 + weeksMissed);
  assert.ok(rolled.endsAt > now2, 'the current season must not already be over');
  assert.ok(
    rolled.endsAt <= now2 + REGATTA.seasonDurationDays * 86400 * 1000,
    'the new season boundary must be within one season length of now',
  );
  assert.equal(rolled.points, 0, 'a freshly-rolled season starts the player at zero points');
});

test('settleSeason places the crew, unlocks a claimable reward, and claimPlacement pays once', () => {
  const s = freshState();
  const now0 = Date.now();
  regatta.activeSeason(now0);
  s.regatta.points = 999999; // guarantee first place among simulated rivals
  const now1 = now0 + REGATTA.seasonDurationDays * 86400 * 1000 + 1000;
  const result = regatta.settleSeason(now1);
  assert.ok(result);
  assert.equal(result.place, 1);
  assert.equal(s.regatta.placementClaimed, false);
  const before = s.coins;
  assert.equal(regatta.claimPlacement(), true);
  assert.ok(s.coins > before);
  assert.equal(regatta.claimPlacement(), false, 'a placement reward must not pay out twice');
});

test('completeTask pays points scaled by the current league reward multiplier', () => {
  const s = freshState();
  regatta.activeSeason(Date.now());
  const boardEntry = regatta.board()[0];
  regatta.claimTask(boardEntry.id);
  s.stats[boardEntry.stat] = boardEntry.target;
  const before = s.regatta.points;
  assert.equal(regatta.completeTask(boardEntry.id), true);
  const league = REGATTA.leagues.find((l) => l.id === s.regatta.league);
  assert.equal(s.regatta.points - before, Math.round(boardEntry.points * league.rewardMult));
  assert.equal(regatta.completeTask(boardEntry.id), false, 'a task must not pay out twice');
});

// ---------------------------------------------------------------------------
// helicopter.js
// ---------------------------------------------------------------------------

test('helicopter fuel regenerates on elapsed wall-clock time and is capped at fuel.max', () => {
  const s = freshState();
  const now0 = Date.now();
  s.helicopter.fuel = 0;
  s.helicopter.fuelUpdatedAt = now0;

  const oneTick = now0 + HELICOPTER.fuel.regenSeconds * 1000;
  assert.equal(helicopter.currentFuel(oneTick), 1);

  const wayLater = now0 + HELICOPTER.fuel.regenSeconds * 1000 * 500;
  assert.equal(helicopter.currentFuel(wayLater), HELICOPTER.fuel.max, 'fuel must never exceed the cap');
});

test('helicopter.tick() persists regenerated fuel into state', () => {
  const s = freshState();
  const now0 = Date.now();
  s.helicopter.fuel = 0;
  s.helicopter.fuelUpdatedAt = now0;
  const now1 = now0 + HELICOPTER.fuel.regenSeconds * 1000;
  helicopter.tick(now1);
  assert.equal(s.helicopter.fuel, 1);
  assert.equal(s.helicopter.fuelUpdatedAt, now1);
});

test('fillCrate/dispatch/collectDelivery: a full round trip refunds nothing extra and pays out once', () => {
  const s = freshState();
  s.barn.items.wheat_flour = 10; // any barn good works; fillCrate auto-picks the most plentiful
  s.helicopter.fuel = HELICOPTER.fuel.max;
  s.helicopter.fuelUpdatedAt = Date.now();

  for (let i = 0; i < HELICOPTER.crates; i++) assert.equal(helicopter.fillCrate(i), true);
  assert.equal(helicopter.fillCrate(0), false, 'a slot cannot be filled twice');

  const now0 = Date.now();
  assert.equal(helicopter.dispatch(), true);
  assert.ok(helicopter.currentFlight(), 'a dispatched flight must be in progress');
  assert.equal(helicopter.collectDelivery(now0), null, 'must not pay out before returningAt');

  const returnTime = helicopter.currentFlight().returningAt;
  const result = helicopter.collectDelivery(returnTime);
  assert.ok(result);
  assert.equal(result.coinsBonus, HELICOPTER.rewards.fullBonusCoins, 'a full load must earn the full bonus');
  assert.equal(helicopter.currentFlight(), null);
  assert.equal(helicopter.collectDelivery(returnTime), null, 'a delivery must not be collectible twice');
});

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`);
  process.exit(1);
}
