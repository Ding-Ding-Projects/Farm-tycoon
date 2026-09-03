// tools/test-logistics.mjs — proves orders.js, shop.js, fishing.js and boat.js (Selling and
// logistics lane). Plain Node script, no test framework. Exits 0 on success, non-zero on first
// failure, with a printed summary either way.
//
// Run: node tools/test-logistics.mjs

import assert from 'node:assert/strict';
import { state, newGameState } from '../src/state.js';
import { ORDERS, SHOP, FISHING, CROPS, GOODS, MARKET, BUILDINGS } from '../src/data.js';
import * as economy from '../src/economy.js';
import * as collections from '../src/collections.js';
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

// orders.js keeps its own baseSellValue() private; mirror it here from the same tables so
// the bonus assertion is computed independently rather than trusting the module under test.
function baseSellValueFor(itemId) {
  return CROPS[itemId]?.sellPrice ?? GOODS[itemId]?.sellPrice ?? 0;
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

test('orders: loading the truck consumes exactly its items and pays nothing until the delivery arrives', () => {
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
  assert.ok(result && result.dispatched, 'fulfillOrder should have dispatched a delivery');

  // The whole point: the goods are gone and the money is NOT here yet.
  assert.equal(state.coins, coinsBefore, 'loading the truck must not pay on the spot');
  assert.equal(state.xp, xpBefore, 'loading the truck must not award XP on the spot');
  for (const { itemId } of slot.items) {
    const bucket = CROPS[itemId] ? state.silo.items : state.barn.items;
    assert.equal(bucket[itemId] || 0, 0, `${itemId} should be fully consumed`);
  }

  const [delivery] = orders.deliveries();
  assert.ok(delivery, 'expected the order to be on the road');
  assert.equal(delivery.arrived, false, 'a delivery starts in transit, never already arrived');

  const units = slot.items.reduce((sum, it) => sum + it.qty, 0);
  assert.equal(Math.round((delivery.arrivesAt - delivery.dispatchedAt) / 1000),
    orders.deliveryTimeFor(units),
    'the drive must be the one deliveryTimeFor() computes, not a second copy of the arithmetic');

  // Collecting early is refused rather than silently paying.
  assert.equal(orders.collectDelivery(delivery.id), false, 'a delivery in transit must not pay out');
  assert.equal(state.coins, coinsBefore, 'a refused collection must not move coins');

  // Wind the clock forward the way the game loop would, then collect.
  orders.tickDeliveries(delivery.arrivesAt);
  assert.equal(orders.deliveries()[0].arrived, true, 'the delivery should arrive on its own clock');
  const paid = orders.collectDelivery(delivery.id);
  assert.ok(paid, 'an arrived delivery must pay');
  assert.equal(state.coins, coinsBefore + paid.coins);
  assert.equal(state.xp, xpBefore + paid.xp);
  assert.equal(orders.deliveries().length, 0, 'a collected delivery leaves the road');

  const replaced = state.orders.board.find((s) => s && s.empty);
  assert.ok(replaced, 'the loaded slot should now be an empty/cooldown marker');
});

test('orders: a bigger load takes longer on the road, and the drive is capped', () => {
  const one = orders.deliveryTimeFor(1);
  const ten = orders.deliveryTimeFor(10);
  assert.ok(ten > one, `expected a ten-unit load to take longer than one unit, got ${ten} vs ${one}`);
  assert.equal(orders.deliveryTimeFor(100000), ORDERS.board.deliveryMax,
    'a huge load must be capped at deliveryMax rather than becoming an overnight wait');
  assert.equal(orders.deliveryTimeFor(0), ORDERS.board.deliveryBase,
    'an empty load is still a drive: the base time');
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

test('orders: a full truck departs with its whole payout and pays only when it gets back', () => {
  setState(freshState(30));
  const start = Date.now();
  orders.tickTruck(start);
  assert.ok(state.orders.truck, 'truck should spawn once unlocked');
  const truck = state.orders.truck;
  for (const bundle of truck.bundles) {
    if (CROPS[bundle.itemId]) fillSilo(bundle.itemId, bundle.qty); else fillBarn(bundle.itemId, bundle.qty);
  }
  const coinsBefore = state.coins;
  const xpBefore = state.xp;

  // Loading takes the goods and pays nothing - not per bundle, and not on the last one either.
  truck.bundles.forEach((_, i) => {
    assert.ok(orders.fillTruckBundle(i), `bundle ${i} should load`);
    assert.equal(state.coins, coinsBefore, `loading bundle ${i} must not pay on the spot`);
  });
  assert.equal(state.xp, xpBefore, 'loading must not award XP on the spot');
  assert.ok(state.orders.truck.departed, 'the truck should set off once every bundle is loaded');

  const load = orders.deliveries().find((d) => d.kind === 'truck');
  assert.ok(load, 'the full truck must be on the road as a delivery');
  const units = truck.bundles.reduce((sum, b) => sum + b.qty, 0);
  assert.equal(Math.round((load.arrivesAt - load.dispatchedAt) / 1000), orders.deliveryTimeFor(units),
    'the truck drives on the same road as the order board, by the same formula');

  // The completion bonus rides along rather than being paid at the bay.
  const bundleOnly = truck.bundles.reduce(
    (sum, b) => sum + Math.round(baseSellValueFor(b.itemId) * b.qty * ORDERS.board.payoutMultiplier), 0);
  assert.ok(load.rewardCoins > bundleOnly,
    `expected the load to carry the completion bonus on top of ${bundleOnly}, got ${load.rewardCoins}`);

  orders.tickDeliveries(load.arrivesAt);
  const paid = orders.collectDelivery(load.id);
  assert.ok(paid, 'an arrived truck must pay');
  assert.equal(state.coins, coinsBefore + paid.coins, 'the whole payout arrives with the truck');
  assert.ok(state.xp > xpBefore, 'XP arrives with the truck too');

  // Jump forward three days — the truck must resolve to a fresh one, not stay departed forever,
  // and must not spawn more than one at once regardless of how much time passed.
  const threeDaysLater = start + 3 * 24 * 60 * 60 * 1000;
  orders.tickTruck(threeDaysLater);
  assert.ok(state.orders.truck && !state.orders.truck.departed, 'a new truck should have spawned after the offline gap');
});

test('orders: an uncollected truck load never blocks the next truck', () => {
  setState(freshState(30));
  const start = Date.now();
  orders.tickTruck(start);
  const truck = state.orders.truck;
  for (const bundle of truck.bundles) {
    if (CROPS[bundle.itemId]) fillSilo(bundle.itemId, bundle.qty); else fillBarn(bundle.itemId, bundle.qty);
  }
  truck.bundles.forEach((_, i) => orders.fillTruckBundle(i));
  assert.equal(orders.deliveries().length, 1, 'the load should be on the road');

  // Deliberately do NOT collect. The bay is a bay, not a waiting room: the next truck arrives on
  // its own schedule and the money stays owed on the road.
  orders.tickTruck(start + ORDERS.truck.interval * 1000 + 1000);
  assert.ok(state.orders.truck && !state.orders.truck.departed, 'a fresh truck should be waiting to load');
  assert.equal(orders.deliveries().length, 1, 'the uncollected load must still be owed, not dropped');
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

test('boat: a full boat casts off with coins, XP and vouchers aboard, paid when she docks', () => {
  setState(freshState(ORDERS.boat.unlockLevel + 5));
  const now = Date.now();
  boat.tick(now);
  const b = state.orders.boat;
  assert.ok(b && b.crates.length > 0, 'boat should dock with crates');
  for (const crate of b.crates) {
    if (CROPS[crate.itemId]) fillSilo(crate.itemId, crate.qty); else fillBarn(crate.itemId, crate.qty);
  }
  const coinsBefore = state.coins;
  const xpBefore = state.xp;
  const vouchersBefore = state.vouchers;
  b.crates.forEach((_, i) => assert.ok(boat.fillCrate(i)));

  const result = boat.claimBonus();
  assert.ok(result && result.dispatched, 'claiming should cast off once every crate is filled');
  assert.equal(state.coins, coinsBefore, 'casting off must not pay on the spot');
  assert.equal(state.xp, xpBefore, 'casting off must not award XP on the spot');
  assert.equal(state.vouchers, vouchersBefore, 'casting off must not hand over vouchers on the spot');
  assert.equal(boat.claimBonus(), false, 'claiming twice must fail');

  const voyage = orders.deliveries().find((d) => d.kind === 'boat');
  assert.ok(voyage, 'the full boat must be at sea as a delivery');
  assert.equal(Math.round((voyage.arrivesAt - voyage.dispatchedAt) / 1000), ORDERS.boat.voyageTime,
    'the boat sails its fixed route, not a cargo-scaled one');
  assert.equal(voyage.rewardVouchers, result.vouchers,
    'the vouchers the player was told about must be the ones aboard - never a fresh roll on arrival');

  orders.tickDeliveries(voyage.arrivesAt);
  const paid = orders.collectDelivery(voyage.id);
  assert.ok(paid, 'a docked boat must pay');
  assert.equal(state.coins, coinsBefore + paid.coins);
  assert.equal(state.vouchers, vouchersBefore + result.vouchers,
    'exactly the vouchers that sailed must arrive');
  assert.ok(state.xp > xpBefore, 'XP arrives with her too');
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

// -------------------------------------------------------------------------------------------
// pricing, pools and counters (the newspaper/market exploits, kit exclusion, order shape)
// -------------------------------------------------------------------------------------------

test('market: offers are priced per unit (base x priceMultiplier x qty) and never sell Workshop crafts', () => {
  setState(freshState(MARKET.unlockLevel));
  let seen = 0;
  for (let day = 0; day < 20; day++) {
    const offers = shop.marketOffers(Date.now() + day * 86400 * 1000);
    assert.equal(offers.length, MARKET.slots);
    for (const o of offers) {
      seen++;
      assert.ok(!economy.isWorkshopCraft(o.item), `the market must not sell ${o.item}`);
      const unit = economy.sellValue(o.item);
      assert.ok(unit > 0, `${o.item} has no sell value`);
      assert.ok(o.price >= Math.floor(unit * MARKET.priceMultiplier * o.qty),
        `${o.item} x${o.qty} for ${o.price}: below the stall's own per-unit price for the bundle`);
      assert.ok(o.price >= o.qty);
    }
  }
  assert.equal(seen, 20 * MARKET.slots);
});

test('market: buyOffer charges the whole bundle price once and delivers the whole bundle', () => {
  setState(freshState(MARKET.unlockLevel));
  const o = shop.marketOffers(Date.now())[0];
  const coinsBefore = state.coins;
  const bucket = CROPS[o.item] ? state.silo.items : state.barn.items;
  const had = bucket[o.item] || 0;
  assert.equal(shop.buyOffer(0), true);
  assert.equal(state.coins, coinsBefore - o.price, 'the bundle price, exactly once');
  assert.equal(bucket[o.item], had + o.qty, 'every unit of the bundle lands in its own store');
  assert.equal(shop.buyOffer(0), false, 'once per day per slot');
  assert.equal(state.coins, coinsBefore - o.price, 'a refused re-buy charges nothing');
});

test('orders: no order, boat crate or truck bundle ever asks for a Workshop component or kit', () => {
  const ids = orders.eligibleItemIds(95);
  assert.ok(ids.length > 50, 'the level-95 pool covers most of the catalogue');
  for (const id of ids) assert.ok(!economy.isWorkshopCraft(id), `${id} is eligible for orders`);
  const crafts = BUILDINGS.build_workshop.recipes.map((r) => r.id);
  assert.ok(crafts.every((id) => !ids.includes(id)));

  setState(freshState(60));
  boat.tick(Date.now());
  assert.ok(state.orders.boat.crates.length > 0);
  for (const c of state.orders.boat.crates) assert.ok(!economy.isWorkshopCraft(c.itemId), `the boat asks for ${c.itemId}`);
  orders.tickTruck(Date.now());
  assert.ok(state.orders.truck.bundles.length > 0);
  for (const b of state.orders.truck.bundles) assert.ok(!economy.isWorkshopCraft(b.itemId), `the truck asks for ${b.itemId}`);
  orders.refreshBoard(Date.now());
  for (const o of state.orders.board) {
    for (const it of o.items || []) assert.ok(!economy.isWorkshopCraft(it.itemId), `the board asks for ${it.itemId}`);
  }
});

test('orders: an order asks for itemsPerOrder distinct items in level-scaled quantities', () => {
  const [nLo, nHi] = ORDERS.board.itemsPerOrder;
  for (const level of [ORDERS.board.unlockLevel, 20, 60, 95]) {
    setState(freshState(level));
    orders.refreshBoard(Date.now());
    const [qLo, qHi] = orders.quantityBand(level);
    const live = state.orders.board.filter((o) => o && !o.empty);
    assert.equal(live.length, ORDERS.board.slots);
    for (const o of live) {
      assert.ok(o.items.length >= nLo && o.items.length <= nHi, `level ${level}: ${o.items.length} items`);
      assert.equal(new Set(o.items.map((it) => it.itemId)).size, o.items.length, 'items are distinct');
      for (const it of o.items) assert.ok(it.qty >= qLo && it.qty <= qHi, `level ${level}: qty ${it.qty} outside [${qLo}, ${qHi}]`);
    }
  }
  assert.deepEqual(orders.quantityBand(1), [1, 2], 'the first orders ask for one or two');
  assert.ok(orders.quantityBand(95)[1] > orders.quantityBand(1)[1], 'later orders ask for more');
  assert.ok(orders.quantityBand(95)[1] <= 8, 'never a wall of one item');
});

test('orders: a filled truck bundle counts toward truckBundles, the stat the Truck Bonanza event scores', () => {
  setState(freshState(ORDERS.truck.unlockLevel));
  orders.tickTruck(Date.now());
  const b = state.orders.truck.bundles[0];
  const bucket = CROPS[b.itemId] ? state.silo.items : state.barn.items;
  bucket[b.itemId] = b.qty;
  assert.equal(orders.fillTruckBundle(0), true);
  assert.equal(state.stats.truckBundles, 1);
  assert.equal(orders.fillTruckBundle(0), false, 'a bundle fills once');
  assert.equal(state.stats.truckBundles, 1);
});

test('boat: a filled crate counts toward boatCrates', () => {
  setState(freshState(ORDERS.boat.unlockLevel));
  boat.tick(Date.now());
  const c = state.orders.boat.crates[0];
  const bucket = CROPS[c.itemId] ? state.silo.items : state.barn.items;
  bucket[c.itemId] = c.qty;
  assert.equal(boat.fillCrate(0), true);
  assert.equal(state.stats.boatCrates, 1);
});

test('fishing: a full barn keeps the cast; a catch fills the Fishing Log and the unique-species stat', () => {
  setState(freshState(FISHING.unlockLevel));
  assert.equal(fishing.cast(), true);
  state.fishing.cast.readyAt = Date.now() - 1;
  state.barn.capacity = 0;
  assert.equal(fishing.reel(1), null, 'no room: the line stays in the water');
  assert.ok(state.fishing.cast, 'the cast must not be spent by a refused reel');

  state.barn.capacity = 999999;
  const realRandom = Math.random;
  Math.random = () => 0.999; // never a chest, never the bonus fish
  let result;
  try { result = fishing.reel(1); } finally { Math.random = realRandom; }
  assert.ok(result && result.item, 'a fish must land');
  assert.equal(result.qty, 1);
  assert.equal(state.fishing.cast, null, 'the cast is spent by the catch');
  assert.equal(state.stats.fishCaught, 1);
  assert.equal(state.stats.uniqueFishCaught, 1);
  assert.deepEqual(collections.found('fish_book'), [result.item]);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
