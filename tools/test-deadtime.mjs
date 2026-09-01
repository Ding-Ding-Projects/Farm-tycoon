// tools/test-deadtime.mjs — proves foraging.js, newspaper.js, collections.js and decorate.js
// (the Dead-time content lane: short-gap foraging + the newspaper, long-gap collections +
// decorating). Plain Node script, no test framework. Exits 0 on success, non-zero on first
// failure category, with a printed summary either way.
//
// Run: node tools/test-deadtime.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { state, resetGame } from '../src/state.js';
import { FORAGING, NEWSPAPER, COLLECTIONS, MASTERY, DECORATE, PHOTO, EFFECT_KEYS, GOODS, CROPS, FARM, BUILDINGS } from '../src/data.js';
import * as production from '../src/production.js';
import * as farm from '../src/farm.js';
import * as economy from '../src/economy.js';
import * as foraging from '../src/foraging.js';
import * as newspaper from '../src/newspaper.js';
import * as neighbours from '../src/neighbours.js';
import * as collections from '../src/collections.js';
import * as decorate from '../src/decorate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function freshState(level = 1) {
  resetGame();
  state.level = level;
  return state;
}

// ---------------------------------------------------------------------------
// foraging.js
// ---------------------------------------------------------------------------

test('foraging.tick spawns only unlocked node types, never more than offlineRespawnCap in one call', () => {
  const s = freshState(1);
  const unlockedTypes = Object.entries(FORAGING.nodes).filter(([, def]) => (def.unlockLevel ?? 1) <= s.level);
  const spawned = foraging.tick(Date.now());
  assert.ok(spawned.length <= FORAGING.offlineRespawnCap, 'a single tick must not exceed offlineRespawnCap');
  assert.ok(spawned.length <= unlockedTypes.length, 'must not spawn a locked node type');
  for (const node of spawned) {
    assert.ok(unlockedTypes.some(([type]) => type === node.type), `spawned locked type ${node.type}`);
  }
});

test('offlineRespawnCap bounds accrual across many ticks; the total never exceeds maxActive per unlocked type or globalMaxActive', () => {
  const s = freshState(1);
  const now = Date.now();
  for (let i = 0; i < 30; i++) foraging.tick(now);
  assert.ok(state.foraging.nodes.length <= FORAGING.globalMaxActive, 'globalMaxActive must be respected even after many ticks');
  const countByType = {};
  for (const n of state.foraging.nodes) countByType[n.type] = (countByType[n.type] || 0) + 1;
  for (const [type, count] of Object.entries(countByType)) {
    assert.ok(count <= FORAGING.nodes[type].maxActive, `${type} exceeded its own maxActive`);
  }
});

test('forage node respawns resolve across an offline gap via absolute readyAt', () => {
  const s = freshState(1);
  const now = Date.now();
  const node = { id: 'test_node_1', type: 'wildflower_patch', x: 11, y: 13, readyAt: now - 10 * 60 * 60 * 1000 };
  state.foraging.nodes = [node];
  assert.deepEqual(foraging.ready(now), [node], 'a node whose readyAt is long in the past must be ready now');
});

test('picking a forage node costs nothing and yields a real item id, then reschedules readyAt forward', () => {
  const s = freshState(1);
  s.coins = 500;
  s.diamonds = 3;
  const now = Date.now();
  const node = { id: 'test_node_2', type: 'berry_bush', x: 11, y: 14, readyAt: now - 1000 };
  state.foraging.nodes = [node];

  const result = foraging.collectNode('test_node_2', now);
  assert.equal(s.coins, 500, 'foraging must never touch coins');
  assert.equal(s.diamonds, 3, 'foraging must never touch diamonds');
  assert.ok(result.itemId === null || GOODS[result.itemId], 'a picked item must be a real GOODS id');
  if (result.itemId) assert.ok(state.barn.items[result.itemId] >= result.qty);
  assert.ok(node.readyAt > now, 'collecting must push readyAt into the future');
  assert.equal(node.readyAt, now + FORAGING.nodes.berry_bush.respawn * 1000);
});

// ---------------------------------------------------------------------------
// newspaper.js
// ---------------------------------------------------------------------------

test('newspaper.js defines no name/farm pool of its own — source text carries no such literal', () => {
  const src = readFileSync(join(__dirname, '../src/newspaper.js'), 'utf8');
  assert.ok(src.includes("from './neighbours.js'"), 'newspaper.js must source farms from neighbours.js');
  assert.ok(!/const\s+(FIRST_NAMES|LAST_NAMES|NAMES|FARM_NAMES|SELLERS)\s*=/.test(src), 'newspaper.js must not hand-list its own names');
});

test('every newspaper listing traces back to the shared neighbours roster, never an invented farm', () => {
  const s = freshState(20);
  const issue = newspaper.currentIssue(Date.now());
  const rosterList = (typeof neighbours.roster === 'function' ? neighbours.roster() : null) || [];
  if (!Array.isArray(rosterList) || rosterList.length === 0) {
    // neighbours.js has not generated a roster yet (still a stub, or genuinely empty) — in
    // that state the newspaper must invent NO farms of its own.
    assert.equal(issue.listings.length, 0, 'with no roster available the newspaper must not invent farms');
  } else {
    const rosterIds = new Set(rosterList.map((n) => n.id));
    for (const listing of issue.listings) {
      assert.ok(rosterIds.has(listing.neighbourId), `listing referenced neighbour ${listing.neighbourId} not in the roster`);
    }
  }
});

test('a bargain listing is genuinely cheaper than the ordinary price floor', () => {
  assert.ok(NEWSPAPER.bargainBand[1] < NEWSPAPER.priceBand[0], 'data invariant: bargain ceiling must sit below the ordinary floor');
  const base = 200;
  const worstBargainPrice = Math.round(base * NEWSPAPER.bargainBand[1]);
  const cheapestOrdinaryPrice = Math.round(base * NEWSPAPER.priceBand[0]);
  assert.ok(worstBargainPrice < cheapestOrdinaryPrice, 'even the priciest bargain must undercut the cheapest ordinary price');
});

test('newspaper.buy refuses outright when the item\'s own store is full, and never touches coins', () => {
  const s = freshState(20);
  s.coins = 100000;
  s.silo.capacity = 5;
  s.silo.items = { wheat: 5 }; // corn is a crop: it is the SILO that has to have room
  state.newspaper.listings = [{ id: 'test_listing_full', neighbourId: 'n1', item: 'corn', qty: 10, price: 500, bargain: false }];
  const before = s.coins;
  assert.equal(newspaper.buy('test_listing_full'), false, 'a full silo must refuse the purchase entirely');
  assert.equal(s.coins, before, 'a refused purchase must not touch coins');
  assert.equal(s.barn.items.corn, undefined, 'a crop never lands in the barn');

  s.barn.capacity = 5;
  s.barn.items = { bread: 5 };
  state.newspaper.listings = [{ id: 'test_listing_full_barn', neighbourId: 'n1', item: 'bread', qty: 2, price: 100, bargain: false }];
  assert.equal(newspaper.buy('test_listing_full_barn'), false, 'a full barn refuses a good the same way');
  assert.equal(s.coins, before);
});

test('newspaper.buy partially fills to the room in the item\'s own store and charges only for what fit', () => {
  const s = freshState(20);
  s.coins = 100000;
  s.silo.capacity = 10;
  s.silo.items = { wheat: 7 }; // 3 slots of room
  state.newspaper.listings = [{ id: 'test_listing_partial', neighbourId: 'n1', item: 'corn', qty: 6, price: 60, bargain: false }];
  const before = s.coins;
  const ok = newspaper.buy('test_listing_partial');
  assert.equal(ok, true);
  assert.equal(state.silo.items.corn, 3, 'must fill only the 3 free silo slots');
  assert.equal(state.barn.items.corn, undefined, 'a crop bought from a neighbour goes to the silo, where it can be planted');
  assert.equal(before - s.coins, 30, 'must charge exactly the pro-rated price for what fit');
  const rest = state.newspaper.listings.find((l) => l.id === 'test_listing_partial');
  assert.equal(rest.qty, 3, 'the unbought remainder stays listed');
  assert.equal(rest.price, 30, 'at the remainder\'s share of the lot price');
});

// ---------------------------------------------------------------------------
// collections.js
// ---------------------------------------------------------------------------

test('every collection book derives a non-empty entry list from its source table', () => {
  const s = freshState(1);
  for (const bookId of Object.keys(COLLECTIONS.books)) {
    const entries = collections.bookEntries(bookId);
    assert.ok(Array.isArray(entries), `${bookId} must derive an array`);
    assert.ok(entries.length > 0, `${bookId} silently derived zero entries`);
  }
});

test('collections.record is idempotent; claimable/claim grant a reward exactly once per tier', () => {
  const s = freshState(1);
  const bookId = 'crop_almanac';
  const def = COLLECTIONS.books[bookId];
  const entries = collections.bookEntries(bookId);
  for (let i = 0; i < def.rewardPer; i++) collections.record(bookId, entries[i]);
  collections.record(bookId, entries[0]); // duplicate discovery, must not double-count
  assert.equal(collections.found(bookId).length, def.rewardPer);
  assert.equal(collections.claimable(bookId), 1);

  const before = s.coins;
  const claimedTiers = collections.claim(bookId);
  assert.equal(claimedTiers, 1);
  assert.equal(s.coins, before + def.reward.coins);
  assert.equal(collections.claimable(bookId), 0, 'a claimed tier must not be claimable again');
  assert.equal(collections.claim(bookId), 0, 'claiming with nothing due must grant nothing');
});

test('building mastery advances a star tier on repetition, and its effect key sits in EFFECT_KEYS', () => {
  const s = freshState(1);
  assert.ok(EFFECT_KEYS.includes(MASTERY.effect), 'MASTERY.effect must be a member of the closed EFFECT_KEYS set');
  const buildingId = 'bakery';
  assert.equal(collections.masteryOf(buildingId).star, 0);
  for (let i = 0; i < MASTERY.tiers[0].makes; i++) collections.recordMake(buildingId);
  const m = collections.masteryOf(buildingId);
  assert.equal(m.star, 1, 'reaching tier 1\'s make count must advance the star');
  const effect = collections.masteryEffect();
  assert.ok(MASTERY.effect in effect);
  assert.ok(effect[MASTERY.effect] <= 1, 'a mastered building must only ever help, never hurt, productionTimeMult');
});

// ---------------------------------------------------------------------------
// decorate.js
// ---------------------------------------------------------------------------

test('decorate.move is undoable and redoable to the exact prior layout', () => {
  const s = freshState(1);
  const field = s.farm.objects.find((o) => o.kind === 'field');
  const before = { x: field.x, y: field.y };

  decorate.enter();
  decorate.select(field.id, false);
  // Up, not down: the starting plots are a 3x2 block, so the row below the first field is its
  // own sibling and a downward move is a legitimate collision refusal rather than a bug.
  const moved = decorate.move(0, -1);
  assert.equal(moved, true, 'a move into open, unlocked land must succeed');
  assert.deepEqual({ x: field.x, y: field.y }, { x: before.x, y: before.y - 1 });

  const undone = decorate.undo();
  assert.equal(undone, true);
  assert.deepEqual({ x: field.x, y: field.y }, before, 'undo must restore the EXACT prior layout');

  const redone = decorate.redo();
  assert.equal(redone, true);
  assert.deepEqual({ x: field.x, y: field.y }, { x: before.x, y: before.y - 1 }, 'redo must reapply the exact move');
});

test('decorate.move refuses a collision and leaves the layout untouched (nothing pushed to history)', () => {
  const s = freshState(1);
  const fields = s.farm.objects.filter((o) => o.kind === 'field');
  assert.ok(fields.length >= 2, 'fixture assumes at least two starting fields');
  const [a, b] = fields;
  decorate.enter();
  decorate.select(a.id, false);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const before = { x: a.x, y: a.y };
  const moved = decorate.move(dx, dy); // straight onto field b's tile
  assert.equal(moved, false, 'moving onto an occupied tile must be refused');
  assert.deepEqual({ x: a.x, y: a.y }, before, 'a refused move must not mutate position');
});

test('decorate.rotate cycles through DECORATE.rotations steps back to 0', () => {
  const s = freshState(1);
  const field = s.farm.objects.find((o) => o.kind === 'field');
  decorate.select(field.id, false);
  for (let i = 0; i < DECORATE.rotations; i++) decorate.rotate();
  assert.equal((field.rotation || 0) % 360, 0, 'a full cycle of rotations must return to the starting orientation');
});

test('photo mode validates frames, bounds stickers to PHOTO.maxStickers, and capture reflects the composition', () => {
  const s = freshState(1);
  assert.equal(decorate.setFrame('not_a_real_frame'), false);
  assert.equal(decorate.setFrame(PHOTO.frames[1]), true);
  assert.equal(s.photo.frame, PHOTO.frames[1]);

  for (let i = 0; i < PHOTO.maxStickers; i++) {
    assert.equal(decorate.addSticker(`sticker_${i}`, i, i), true);
  }
  assert.equal(decorate.addSticker('overflow', 0, 0), false, 'must refuse a sticker past maxStickers');

  const snap = decorate.capture();
  assert.equal(snap.frame, PHOTO.frames[1]);
  assert.equal(snap.stickers.length, PHOTO.maxStickers);
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// the "no room" rule for foraging, lot pricing in the newspaper, and books filled by real play
// ---------------------------------------------------------------------------

test('a full barn leaves a forage node standing: no XP, no reset, nothing counted', () => {
  const s = freshState(1);
  const now = Date.now();
  const node = { id: 'n_full', type: 'berry_bush', x: 11, y: 14, readyAt: now - 1000 };
  s.foraging.nodes = [node];
  s.barn.capacity = 0;
  const xp = s.xp;
  assert.equal(foraging.collectNode('n_full', now), null);
  assert.equal(node.readyAt, now - 1000, 'the node is still ready');
  assert.equal(s.xp, xp, 'no XP for a pick that did not happen');
  assert.equal(s.stats.foraged || 0, 0);
});

test('a forage pick fills the Forage Journal and the foraged counter', () => {
  const s = freshState(1);
  const now = Date.now();
  s.foraging.nodes = [{ id: 'n_one', type: 'berry_bush', x: 11, y: 14, readyAt: now - 1000 }];
  const result = foraging.collectNode('n_one', now);
  assert.ok(result, 'a ready node with room must be collectable');
  assert.equal(s.stats.foraged, 1);
  if (result.itemId) assert.ok(collections.found('forage_journal').includes(result.itemId), 'the find is in the journal');
});

test('newspaper listings are priced for the whole lot (per unit x qty) and never offer Workshop crafts', () => {
  const s = freshState(NEWSPAPER.unlockLevel);
  const minMult = Math.min(NEWSPAPER.priceBand[0], NEWSPAPER.bargainBand[0]);
  let seen = 0;
  for (let i = 0; i < 5; i++) {
    const issue = newspaper.refresh(Date.now() + i * 1000);
    for (const l of issue.listings) {
      seen++;
      assert.ok(!economy.isWorkshopCraft(l.item), `the newspaper lists ${l.item}`);
      const unit = economy.sellValue(l.item);
      assert.ok(unit > 0, `${l.item} has no sell value`);
      assert.ok(l.price >= Math.floor(unit * minMult * l.qty), `${l.item} x${l.qty} at ${l.price}: below the floor for the LOT`);
      if (!l.bargain) assert.ok(l.price >= Math.floor(unit * NEWSPAPER.priceBand[0] * l.qty), `${l.item}: an ordinary listing under the ordinary floor`);
      assert.ok(l.price >= l.qty);
    }
  }
  assert.ok(seen > 20, 'five issues must produce a real sample');

  // Buying a whole lot charges exactly its lot price and lands it in its own store.
  const l = s.newspaper.listings.find((x) => x.qty > 1) || s.newspaper.listings[0];
  s.coins = l.price;
  s.silo.capacity = 999999;
  s.barn.capacity = 999999;
  assert.equal(newspaper.buy(l.id), true);
  assert.equal(s.coins, 0, 'the lot price, once');
  const bucket = CROPS[l.item] ? s.silo.items : s.barn.items;
  assert.equal(bucket[l.item], l.qty);
});

test('the Crop Almanac and the Recipe Book fill from a real harvest and a real collect', () => {
  const s = freshState(1);
  s.coins = 100000;
  const fieldId = s.farm.objects.find((o) => o.kind === 'field').id;
  s.silo.items.wheat = CROPS.wheat.seedCost;
  assert.equal(production.plant(fieldId, 'wheat'), true);
  s.farm.objects.find((o) => o.id === fieldId).readyAt = Date.now() - 1;
  assert.ok(production.harvest(fieldId, Date.now()));
  assert.deepEqual(collections.found('crop_almanac'), ['wheat']);

  const bakery = farm.place('building', 'bakery', FARM.startZone.x + 5, FARM.startZone.y + 7);
  assert.ok(bakery);
  const recipe = BUILDINGS.bakery.recipes.find((r) => r.id === 'bread');
  s.silo.items.wheat = recipe.inputs.wheat;
  assert.equal(production.enqueue(bakery.id, 'bread'), true);
  const now = Date.now() + (recipe.time + 5) * 1000;
  production.tick(now);
  const made = production.collectBuilding(bakery.id, now);
  assert.equal(made.goodId, 'bread');
  assert.deepEqual(collections.found('recipe_book'), ['bread']);
  assert.equal(collections.found('crop_almanac').length, 1, 'a second wheat harvest would not add a page');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`);
  process.exit(1);
}
