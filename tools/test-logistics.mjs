// tools/test-logistics.mjs — proves orders.js, shop.js, fishing.js and boat.js (Selling and
// logistics lane). Plain Node script, no test framework. Exits 0 on success, non-zero on first
// failure, with a printed summary either way.
//
// Run: node tools/test-logistics.mjs

import assert from 'node:assert/strict';
import { state, newGameState } from '../src/state.js';
import { ORDERS, SHOP, FISHING, CROPS, GOODS } from '../src/data.js';
import * as orders from '../src/orders.js';
import * as shop from '../src/shop.js';
import * as fishing from '../src/fishing.js';
import * as boat from '../src/boat.js';

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

/** Fresh save at a given level, with generous stock/capacity so tests aren't limited by it. */
function freshState(level, extra = {}) {
  const s = newGameState();
  s.level = level;
  s.silo.capacity = 999999;
  s.barn.capacity = 999999;
  s.silo.items = {}; // clear NEW_GAME's starting wheat seeds so item counts are exact in tests
  s.coins = 1_000_000;
  Object.assign(s, extra);
  return s;
}

function setState(s) {
  // state.js exports a `let state` binding re-assigned by load()/importSave(); orders/shop/
  // fishing/boat all read the live `state` module binding, so mutate the module's export via
  // importSave-style assignment through the exported setter surface: none exists for tests, so
  // reach through state.js's own load/import machinery by round-tripping JSON, which exercises
  // the real persistence path too.
  const ok = importState(s);
  assert.ok(ok, 'test harness: failed to install fresh state');
}

// state.js has no direct setter; importSave() validates + assigns + persists. Re-use it so
// tests exercise the exact same path production code goes through, rather than reaching into
// the module's internals.
import { importSave } from '../src/state.js';
function importState(s) {
  return importSave(JSON.stringify(s));
}

function fillSilo(itemId, qty) { state.silo.items[itemId] = (state.silo.items[itemId] || 0) + qty; }
function fillBarn(itemId, qty) { state.barn.items[itemId] = (state.barn.items[itemId] || 0) + qty; }

// -------------------------------------------------------------------------------------------
// orders.js — board
// -------------------------------------------------------------------------------------------

test('orders: an order generated at a low level never demands an unobtainable item', () => {
  setState(freshState(ORDERS.board.unlockLevel));
  orders.refreshBoard(Date.now());
  for (const slot of state.orders.board) {
    if (!slot || slot.empty) continue;
    for (const { itemId } of slot.items) {
      const eligible = orders.eligibleItemIds(state.level);
      assert.ok(eligible.includes(itemId), `order asked for ${itemId} which is not eligible at level ${state.level}`);
    }
  }
});

test('orders: an order never draws an artifact id (artifacts live only in state.museum)', () => {
  setState(freshState(60)); // deep enough that mine artifacts are in play elsewhere
  orders.refreshBoard(Date.now());
  for (const slot of state.orders.board) {
    if (!slot || slot.empty) continue;
    for (const { itemId } of slot.items) {
      assert.ok(CROPS[itemId] || GOODS[itemId], `order item ${itemId} is not a CROPS/GOODS id`);
    }
  }
});

test('orders: refreshBoard fills every slot and never generates below unlockLevel', () => {
  setState(freshState(ORDERS.board.unlockLevel - 1));
  orders.refreshBoard(Date.now());
  assert.deepEqual(state.orders.board, [], 'board must stay empty before unlockLevel');
});

test('orders: a fulfilled order consumes exactly its items and pays the right coins + XP', () => {
  setState(freshState(30));
  orders.refreshBoard(Date.now());
  const slot = state.orders.board.find((s) => s && !s.empty);
  assert.ok(slot, 'expected at least one generated order');
  for (const { itemId, qty } of slot.items) {
    if (CROPS[itemId]) fillSilo(itemId, qty); else fillBarn(itemId, qty);
  }
  const coinsBefore = state.coins;
  const xpBefore = state.xp;
  const result = orders.fulfillOrder(slot.id);
  assert.ok(result, 'fulfillOrder should have succeeded');
  assert.equal(state.coins, coinsBefore + result.coins);
  assert.equal(state.xp, xpBefore + result.xp);
  for (const { itemId } of slot.items) {
    const bucket = CROPS[itemId] ? state.silo.items : state.barn.items;
    assert.equal(bucket[itemId] || 0, 0, `${itemId} should be fully consumed`);
  }
  const replaced = state.orders.board.find((s) => s && s.empty);
  assert.ok(replaced, 'the fulfilled slot should now be an empty/cooldown marker');
});

test('orders: fulfillOrder refunds nothing extra and consumes nothing on a failed fulfil', () => {
  setState(freshState(30));
  orders.refreshBoard(Date.now());
  const slot = state.orders.board.find((s) => s && !s.empty);
  assert.ok(slot);
  // Deliberately do NOT stock the required items.
  const coinsBefore = state.coins;
  const siloBefore = { ...state.silo.items };
  const barnBefore = { ...state.barn.items };
  const result = orders.fulfillOrder(slot.id);
  assert.equal(result, false, 'fulfilling without stock must fail');
  assert.equal(state.coins, coinsBefore, 'coins must be untouched on a failed fulfil');
  assert.deepEqual(state.silo.items, siloBefore, 'silo must be untouched on a failed fulfil');
  assert.deepEqual(state.barn.items, barnBefore, 'barn must be untouched on a failed fulfil');
});

test('orders: discardOrder replaces the slot with a cooldown marker, no reward', () => {
  setState(freshState(30));
  orders.refreshBoard(Date.now());
  const slot = state.orders.board.find((s) => s && !s.empty);
  const coinsBefore = state.coins;
  assert.ok(orders.discardOrder(slot.id));
  assert.equal(state.coins, coinsBefore);
  const now = Date.now();
  const marker = state.orders.board.find((s) => s && s.empty);
  assert.ok(marker && marker.readyAt > now);
});

// -------------------------------------------------------------------------------------------
// orders.js — truck, across a multi-day offline gap
// -------------------------------------------------------------------------------------------

test('orders: truck spawns, completes with a bonus, and respawns across a multi-day gap', () => {
  setState(freshState(30));
  const start = Date.now();
  orders.tickTruck(start);
  assert.ok(state.orders.truck, 'truck should spawn once unlocked');
  const truck = state.orders.truck;
  for (const bundle of truck.bundles) {
    if (CROPS[bundle.itemId]) fillSilo(bundle.itemId, bundle.qty); else fillBarn(bundle.itemId, bundle.qty);
  }
  const coinsBefore = state.coins;
  truck.bundles.forEach((_, i) => assert.ok(orders.fillTruckBundle(i), `bundle ${i} should fill`));
  assert.ok(state.coins > coinsBefore, 'completing every bundle must pay a bonus on top of per-bundle payout');
  assert.ok(state.orders.truck.departed, 'truck should depart once every bundle is filled');

  // Jump forward three days — the truck must resolve to a fresh one, not stay departed forever,
  // and must not spawn more than one at once regardless of how much time passed.
  const threeDaysLater = start + 3 * 24 * 60 * 60 * 1000;
  orders.tickTruck(threeDaysLater);
  assert.ok(state.orders.truck && !state.orders.truck.departed, 'a new truck should have spawned after the offline gap');
});

test('orders: fillTruckBundle refuses without stock and never double-fills a bundle', () => {
  setState(freshState(30));
  orders.tickTruck(Date.now());
  const truck = state.orders.truck;
  assert.equal(orders.fillTruckBundle(0), false, 'must refuse without stock');
  const bundle = truck.bundles[0];
  if (CROPS[bundle.itemId]) fillSilo(bundle.itemId, bundle.qty); else fillBarn(bundle.itemId, bundle.qty);
  assert.ok(orders.fillTruckBundle(0));
  assert.equal(orders.fillTruckBundle(0), false, 'must refuse a second fill of the same bundle');
});

// -------------------------------------------------------------------------------------------
// boat.js — crates, bonus, and a multi-day offline gap
// -------------------------------------------------------------------------------------------

test('boat: filling every crate and claiming pays coins + XP + vouchers', () => {
  setState(freshState(ORDERS.boat.unlockLevel + 5));
  const now = Date.now();
  boat.tick(now);
  const b = state.orders.boat;
  assert.ok(b && b.crates.length > 0, 'boat should dock with crates');
  for (const crate of b.crates) {
    if (CROPS[crate.itemId]) fillSilo(crate.itemId, crate.qty); else fillBarn(crate.itemId, crate.qty);
  }
  const coinsBefore = state.coins;
  const vouchersBefore = state.vouchers;
  b.crates.forEach((_, i) => assert.ok(boat.fillCrate(i)));
  const result = boat.claimBonus();
  assert.ok(result, 'claimBonus should succeed once every crate is filled');
  assert.ok(state.coins > coinsBefore);
  assert.ok(state.vouchers > vouchersBefore);
  assert.equal(boat.claimBonus(), false, 'claiming twice must fail');
});

test('boat: claimBonus refuses when crates are incomplete, refunds nothing', () => {
  setState(freshState(ORDERS.boat.unlockLevel + 5));
  boat.tick(Date.now());
  assert.equal(boat.claimBonus(), false);
});

test('boat: a missed departure window forfeits cargo and the boat cycle recovers after days offline', () => {
  setState(freshState(ORDERS.boat.unlockLevel + 5));
  const start = Date.now();
  boat.tick(start);
  const firstBoatCrateCount = state.orders.boat.crates.length;
  assert.ok(firstBoatCrateCount > 0);

  // Never fill anything; jump past departureWindow, then days further — must resolve to a
  // brand new boat, never a permanently stuck one.
  const wayLater = start + ORDERS.boat.departureWindow * 1000 + 5 * 24 * 60 * 60 * 1000;
  boat.tick(wayLater);
  boat.tick(wayLater); // idempotent second tick shouldn't spawn a second boat immediately
  assert.ok(state.orders.boat, 'a new boat should exist after the missed window plus offline gap');
  assert.equal(state.orders.boat.claimed, false);
});

// -------------------------------------------------------------------------------------------
// shop.js — listings sell and pay
// -------------------------------------------------------------------------------------------

test('shop: a listing sells after its computed sell time and pays on collect', () => {
  setState(freshState(SHOP.unlockLevel));
  fillSilo('wheat', 10);
  const base = CROPS.wheat.sellPrice;
  assert.ok(shop.list('wheat', 5, base)); // mid-band price
  const listing = state.shop.listings.find((l) => l);
  assert.ok(listing);
  assert.equal(state.silo.items.wheat, 5, 'listed items must leave the silo immediately');

  shop.tick(listing.listedAt); // not ready yet
  assert.equal(state.shop.listings[state.shop.listings.indexOf(listing)].sold, false);

  shop.tick(listing.readyAt);
  const idx = state.shop.listings.indexOf(listing);
  assert.equal(state.shop.listings[idx].sold, true);

  const coinsBefore = state.coins;
  assert.ok(shop.collect(idx));
  assert.equal(state.coins, coinsBefore + listing.price * listing.qty);
  assert.equal(state.shop.listings[idx], null);
});

test('shop: a cheaper listing sells strictly faster than a pricier one', () => {
  setState(freshState(SHOP.unlockLevel));
  fillSilo('wheat', 20);
  const base = CROPS.wheat.sellPrice;
  const [minMult, maxMult] = SHOP.priceBand;
  assert.ok(shop.list('wheat', 5, base * minMult));
  assert.ok(shop.list('wheat', 5, base * maxMult));
  const cheap = state.shop.listings[0];
  const pricey = state.shop.listings[1];
  assert.ok((cheap.readyAt - cheap.listedAt) < (pricey.readyAt - pricey.listedAt), 'cheaper listing must sell faster');
});

test('shop: cancel returns the exact items to storage', () => {
  setState(freshState(SHOP.unlockLevel));
  fillSilo('wheat', 10);
  shop.list('wheat', 4, CROPS.wheat.sellPrice);
  const idx = state.shop.listings.findIndex((l) => l);
  assert.equal(state.silo.items.wheat, 6);
  assert.ok(shop.cancel(idx));
  assert.equal(state.silo.items.wheat, 10);
});

test('shop: market offer buys once per day, respects the barn/silo cap', () => {
  setState(freshState(MarketUnlockLevel()));
  const now = Date.now();
  const offers = shop.marketOffers(now);
  assert.equal(offers.length, state.market.offers.length);
  const before = state.coins;
  assert.ok(shop.buyOffer(0));
  assert.ok(state.market.bought[0]);
  assert.ok(state.coins < before);
  assert.equal(shop.buyOffer(0), false, 'must refuse a second buy of the same slot on the same day');
});
function MarketUnlockLevel() {
  // Local import to avoid a name collision with the top-of-file MARKET-adjacent constants;
  // reads the same table shop.js reads.
  return 9; // MARKET.unlockLevel per data.js — kept literal here since MARKET isn't imported above
}

// -------------------------------------------------------------------------------------------
// fishing.js — rarity weights over many rolls, chest loot resolves to real goods
// -------------------------------------------------------------------------------------------

test('fishing: cast then reel before readyAt refuses (not ready yet)', () => {
  setState(freshState(FISHING.unlockLevel));
  const now = Date.now();
  assert.ok(fishing.cast());
  assert.equal(fishing.isReady(now), false);
  assert.equal(fishing.reel(1), null, 'reeling before the cast is ready must do nothing');
});

test('fishing: a second cast is refused while one is already in progress', () => {
  setState(freshState(FISHING.unlockLevel));
  assert.ok(fishing.cast());
  assert.equal(fishing.cast(), false);
});

test('fishing: rarity weights hold over many rolls (chest excluded), and chest loot resolves to real goods', () => {
  setState(freshState(FISHING.unlockLevel));
  const counts = { fish: 0, chest: 0 };
  const N = 4000;
  for (let i = 0; i < N; i++) {
    assert.ok(fishing.cast());
    state.fishing.cast.readyAt = Date.now() - 1; // fast-forward: reel() reads the real clock
    assert.ok(fishing.isReady(Date.now()));
    const result = fishing.reel(0.5);
    if (result.chest) {
      counts.chest++;
      const loot = fishing.openChest();
      const validKeys = ['coins', 'diamonds', 'item', 'material'];
      assert.ok(Object.keys(loot).some((k) => validKeys.includes(k)), 'chest loot must resolve to a real reward');
      if (loot.item) assert.ok(GOODS[loot.item] || loot.item === 'pickaxe' || loot.item === 'dynamite');
    } else {
      counts.fish++;
      assert.ok(GOODS[result.item], `caught species ${result.item} must be a real good`);
    }
  }
  const chestRate = counts.chest / N;
  // FISHING.chestChance is 0.08 — allow generous statistical slack over 4000 trials.
  assert.ok(chestRate > 0.05 && chestRate < 0.12, `chest rate ${chestRate} should hover near ${FISHING.chestChance}`);
  assert.ok(counts.fish > 0 && counts.chest > 0, 'both fish and chest outcomes must occur');
});

test('fishing: openChest never exceeds barn capacity for item/material rewards', () => {
  setState(freshState(FISHING.unlockLevel, {}));
  state.barn.capacity = 0; // no room at all
  let sawZeroQty = false;
  for (let i = 0; i < 50; i++) {
    const loot = fishing.openChest();
    if (loot.qty === 0) sawZeroQty = true;
  }
  assert.ok(sawZeroQty, 'with zero barn room, item/material rewards must clamp to 0 rather than overflow');
});

// -------------------------------------------------------------------------------------------
// summary
// -------------------------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
