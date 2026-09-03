// orders.js — the order board (6 rotating orders) + truck orders (periodic 3-bundle requests).
// Order generation scales requested items/quantities to the player's level and unlocked content,
// paying sellValue * payoutMultiplier coins and xpMultiplier XP (tuning in data.js ORDERS).

import { state } from './state.js';
import { ORDERS, CROPS, GOODS, ANIMALS, BUILDINGS } from './data.js';
import * as economy from './economy.js';
import * as extras from './extras.js';

function eventEffect() {
  try { return extras.activeEventEffect() || {}; } catch { return {}; }
}

// ---------------------------------------------------------------------------------------------
// Item eligibility. An order must never ask for something the player cannot plausibly produce
// at their current level, and must never draw an artifact id — artifacts live in state.museum,
// not the barn/silo, so asking for one would be permanently unfulfillable. Restricting the pool
// to CROPS + GOODS keys (never ARTIFACTS, never MATERIALS) makes that safe by construction: those
// two tables are the only things production.js/farm.js ever put into silo/barn stock as sellable
// produce.
//
// economy.js already builds a full id -> unlockLevel map (crop ids direct, recipe output ids via
// BUILDINGS[*].recipes[*].unlockLevel) and exposes it as isUnlocked(). The one gap is animal
// products: ANIMALS entries are keyed by animal id ('chicken'), not by the product id they emit
// ('egg'), so economy's map never learns egg's real gate. Close that gap locally.
// ---------------------------------------------------------------------------------------------
let animalProductLevelCache = null;
function animalProductUnlockLevel(goodId) {
  if (!animalProductLevelCache) {
    animalProductLevelCache = new Map();
    for (const animal of Object.values(ANIMALS)) {
      const existing = animalProductLevelCache.get(animal.product);
      if (existing === undefined || animal.unlockLevel < existing) {
        animalProductLevelCache.set(animal.product, animal.unlockLevel);
      }
    }
  }
  return animalProductLevelCache.get(goodId);
}

/** Effective unlock level for an order-eligible item id (crop or good), never below 1. */
function itemUnlockLevel(itemId) {
  if (CROPS[itemId]) return CROPS[itemId].unlockLevel;
  for (const building of Object.values(BUILDINGS)) {
    const recipe = building.recipes?.find((r) => r.id === itemId);
    if (recipe) return recipe.unlockLevel;
  }
  const animalLevel = animalProductUnlockLevel(itemId);
  if (animalLevel !== undefined) return animalLevel;
  return 1; // unmapped good — never block on something we cannot classify
}

/**
 * Every crop/good id obtainable at or below `level`, deduped, in a stable order. Building
 * Workshop components and kits are GOODS too (they sit in the barn with a sell price), but they
 * are the crafting spine, not trade goods: an order that asked for a pasta-kitchen kit would
 * swallow seven hours of material chain for sellPrice x 1.35, so they are never eligible.
 */
export function eligibleItemIds(level) {
  const ids = [];
  for (const id of Object.keys(CROPS)) if (itemUnlockLevel(id) <= level) ids.push(id);
  for (const id of Object.keys(GOODS)) if (itemUnlockLevel(id) <= level && !economy.isWorkshopCraft(id)) ids.push(id);
  return ids;
}

function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function baseSellValue(itemId) {
  return CROPS[itemId]?.sellPrice ?? GOODS[itemId]?.sellPrice ?? 0;
}

/** How many units of one item an order asks for at this level: 1-2 early, up to 8 later. */
export function quantityBand(level) {
  return [1, Math.min(8, 2 + Math.floor(Math.max(1, level) / 8))];
}

/**
 * Build one order's item list from the eligible pool at the player's level. `countRange` is
 * ORDERS.board.itemsPerOrder: how many DISTINCT items the order asks for (the tuning knob's
 * documented meaning - it used to be read as the per-item quantity while the item count sat
 * hard-coded at 1-2). Quantities scale with level through quantityBand().
 */
function generateItems(level, countRange = ORDERS.board.itemsPerOrder) {
  const pool = eligibleItemIds(level);
  if (pool.length === 0) return []; // no eligible content yet (very low level) — caught by callers
  const n = Math.min(pool.length, randomInt(countRange[0], countRange[1]));
  const [qLo, qHi] = quantityBand(level);
  const usedIds = new Set();
  const items = [];
  for (let i = 0; i < n; i++) {
    const remaining = pool.filter((id) => !usedIds.has(id));
    if (remaining.length === 0) break;
    const itemId = pickRandom(remaining);
    usedIds.add(itemId);
    items.push({ itemId, qty: randomInt(qLo, qHi) });
  }
  return items;
}

function itemsRewardBase(items) {
  return items.reduce((sum, it) => sum + baseSellValue(it.itemId) * it.qty, 0);
}

let nextOrderId = 1;
function freshOrderId() { return `order_${nextOrderId++}_${Date.now().toString(36)}`; }

function generateOrder(now) {
  const items = generateItems(state.level);
  if (items.length === 0) return null;
  const base = itemsRewardBase(items);
  return {
    id: freshOrderId(),
    items,
    rewardCoins: Math.round(base * ORDERS.board.payoutMultiplier),
    rewardXp: Math.round(items.reduce((sum, it) => sum + it.qty, 0) * ORDERS.board.xpMultiplier),
    createdAt: now,
  };
}

// ---------------------------------------------------------------------------------------------
// Board: a fixed-length array of ORDERS.board.slots entries. Each slot holds either an active
// order object or an { empty:true, readyAt } marker while its replacement cooldown runs.
// ---------------------------------------------------------------------------------------------

/** Ensure the board has ORDERS.board.slots orders, generating new ones as needed. */
export function refreshBoard(now = Date.now()) {
  if (state.level < ORDERS.board.unlockLevel) return;
  if (!Array.isArray(state.orders.board)) state.orders.board = [];
  const board = state.orders.board;
  while (board.length < ORDERS.board.slots) board.push(null);
  for (let i = 0; i < ORDERS.board.slots; i++) {
    const slot = board[i];
    if (slot === null || (slot.empty && now >= slot.readyAt)) {
      const order = generateOrder(now);
      board[i] = order || { empty: true, readyAt: now + ORDERS.board.refreshCooldown * 1000 };
    }
  }
}

function findBoardSlot(orderId) {
  const board = state.orders.board || [];
  const index = board.findIndex((s) => s && !s.empty && s.id === orderId);
  return index === -1 ? -1 : index;
}

/** Can the player fulfill this order from current silo/barn stock? */
export function canFulfill(order) {
  if (!order || !Array.isArray(order.items)) return false;
  return order.items.every(({ itemId, qty }) => {
    const bucket = CROPS[itemId] ? state.silo.items : state.barn.items;
    return (bucket[itemId] || 0) >= qty;
  });
}

/**
 * Pack an order onto the delivery truck.
 *
 * This takes the goods and dispatches; it does NOT pay. The coins and XP are recorded on the
 * delivery and handed over by collectDelivery() once the truck arrives - see the Deliveries
 * section below for why the multipliers are applied then rather than now.
 */
export function fulfillOrder(orderId) {
  const index = findBoardSlot(orderId);
  if (index === -1) return null;
  const order = state.orders.board[index];
  if (!canFulfill(order)) return false;

  for (const { itemId, qty } of order.items) {
    const bucket = CROPS[itemId] ? state.silo.items : state.barn.items;
    bucket[itemId] -= qty;
  }

  const now = Date.now();
  const units = order.items.reduce((sum, it) => sum + it.qty, 0);
  const seconds = deliveryTimeFor(units);
  ensureDeliveries().push({
    id: `del_${order.id}_${now}`,
    orderId: order.id,
    items: order.items.map((it) => ({ itemId: it.itemId, qty: it.qty })),
    rewardCoins: order.rewardCoins,
    rewardXp: order.rewardXp,
    dispatchedAt: now,
    arrivesAt: now + seconds * 1000,
    arrived: false,
  });
  economy.trackStat('ordersDispatched', 1);

  state.orders.board[index] = { empty: true, readyAt: now + ORDERS.board.refreshCooldown * 1000 };
  return { dispatched: true, seconds, coins: order.rewardCoins, xp: order.rewardXp };
}

// ---------------------------------------------------------------------------------------------
// Deliveries: the leg between packing a crate and being paid for it.
//
// Handing an order in used to be the whole transaction - goods vanished from the barn and coins
// appeared in the same instant, with the delivery truck parked outside doing nothing. Now the
// crate goes ON the truck, the truck drives, and the money arrives when it does. Nothing is lost
// in transit and nothing can fail; the wait is the point, not a risk.
// ---------------------------------------------------------------------------------------------

/** Seconds a load of `units` items takes to reach its buyer, from ORDERS.board tuning. */
export function deliveryTimeFor(units) {
  const cfg = ORDERS.board;
  const raw = cfg.deliveryBase + cfg.deliveryPerItem * Math.max(0, units);
  return Math.min(cfg.deliveryMax, Math.round(raw));
}

function ensureDeliveries() {
  if (!Array.isArray(state.orders.deliveries)) state.orders.deliveries = [];
  return state.orders.deliveries;
}

/** Every delivery currently on the road or waiting to be collected, newest dispatch last. */
export function deliveries() {
  return ensureDeliveries();
}

/** Mark any delivery whose arrival time has passed. Called from the game loop and on load. */
export function tickDeliveries(now = Date.now()) {
  for (const d of ensureDeliveries()) {
    if (!d.arrived && now >= d.arrivesAt) d.arrived = true;
  }
}

/**
 * Take the payment for an arrived delivery.
 *
 * The multipliers are applied HERE rather than at dispatch, so a research node or a co-op perk
 * that lands while the truck is on the road still counts - the alternative quietly punishes the
 * player for having filled the order five minutes earlier.
 */
export function collectDelivery(deliveryId) {
  const list = ensureDeliveries();
  const index = list.findIndex((d) => d.id === deliveryId);
  if (index === -1) return false;
  const delivery = list[index];
  if (!delivery.arrived) return false;

  const coins = Math.round(delivery.rewardCoins * economy.multiplier('orderPayoutMult', delivery.orderId));
  economy.addCoins(coins);
  economy.addXp(delivery.rewardXp);
  economy.trackStat('ordersFulfilled', 1);
  list.splice(index, 1);
  return { coins, xp: delivery.rewardXp };
}

/** Discard an order (replacement arrives after refreshCooldown). */
export function discardOrder(orderId) {
  const index = findBoardSlot(orderId);
  if (index === -1) return false;
  state.orders.board[index] = { empty: true, readyAt: Date.now() + ORDERS.board.refreshCooldown * 1000 };
  return true;
}

// ---------------------------------------------------------------------------------------------
// Truck: a single active request of ORDERS.truck.bundles items at a time. Filling every bundle
// pays a completion bonus on top of each bundle's own payout; the truck then departs and the
// next one spawns after ORDERS.truck.interval.
// ---------------------------------------------------------------------------------------------

function spawnTruck(now) {
  const items = [];
  for (let i = 0; i < ORDERS.truck.bundles; i++) {
    const [it] = generateItems(state.level, ORDERS.board.itemsPerOrder);
    if (it) items.push({ itemId: it.itemId, qty: it.qty, filled: false });
  }
  return { bundles: items, departed: false, nextSpawnAt: null, spawnedAt: now };
}

/** Spawn/advance the truck: new request every ORDERS.truck.interval; bonus when all bundles filled. */
export function tickTruck(now = Date.now()) {
  if (state.level < ORDERS.truck.unlockLevel) return;
  const truck = state.orders.truck;
  if (!truck) { state.orders.truck = spawnTruck(now); return; }
  if (truck.departed && truck.nextSpawnAt !== null && now >= truck.nextSpawnAt) {
    state.orders.truck = spawnTruck(now);
  }
}

/** Fill one truck bundle. */
export function fillTruckBundle(index) {
  const truck = state.orders.truck;
  if (!truck || truck.departed) return false;
  const bundle = truck.bundles[index];
  if (!bundle || bundle.filled) return false;

  const bucket = CROPS[bundle.itemId] ? state.silo.items : state.barn.items;
  if ((bucket[bundle.itemId] || 0) < bundle.qty) return false;
  bucket[bundle.itemId] -= bundle.qty;
  bundle.filled = true;

  const base = baseSellValue(bundle.itemId) * bundle.qty;
  // Truck Bonanza (a weekend event) pays extra per bundle; research/perks raise every order.
  const coinMult = ORDERS.board.payoutMultiplier * (eventEffect().truckCoinMult || 1) * economy.multiplier('orderPayoutMult', bundle.itemId);
  economy.addCoins(Math.round(base * coinMult));
  economy.addXp(Math.round(bundle.qty * ORDERS.board.xpMultiplier));
  economy.trackStat('truckBundles', 1);   // the name the Truck Bonanza event scores

  if (truck.bundles.length > 0 && truck.bundles.every((b) => b.filled)) {
    const totalBase = truck.bundles.reduce((sum, b) => sum + baseSellValue(b.itemId) * b.qty, 0);
    const bonusCoins = Math.round(totalBase * (ORDERS.truck.bonusMultiplier - 1));
    if (bonusCoins > 0) economy.addCoins(bonusCoins);
    economy.addXp(Math.round(truck.bundles.length * ORDERS.board.xpMultiplier));
    economy.trackStat('trucksCompleted', 1);
    const now = Date.now();
    truck.departed = true;
    // The co-op's Standing Orders perk (truckIntervalMult) brings the next truck sooner.
    truck.nextSpawnAt = now + Math.round(ORDERS.truck.interval * 1000 * economy.multiplier('truckIntervalMult', 'truck'));
  }
  return true;
}
