// zoo.js — the Zoo (Township layer, L34): buy enclosures (coins + MATERIALS), feed each
// species farm goods on a timer to produce zoo souvenir goods (ZOO.enclosures), earn
// passive visitor income scaled by town population (ZOO.visitorIncomePerHour), and fill
// zoo orders mixing zoo + farm goods. State: state.zoo { enclosures, lastIncomeAt, orders }.

import { state } from './state.js';
import { ZOO, CROPS, GOODS } from './data.js';
import * as economy from './economy.js';
import * as town from './town.js';
import * as storage from './storage.js';

const VISITOR_CAP_MS = 12 * 3600 * 1000; // 12h — a fortnight away must not print a fortune

// See trains.js for why this lazy-seed pattern exists.
function ensureState() {
  if (!state.zoo) state.zoo = { enclosures: {}, lastIncomeAt: Date.now(), orders: [] };
  return state.zoo;
}

function barnHas(materials) {
  return Object.entries(materials || {}).every(([id, qty]) => (state.barn.items[id] || 0) >= qty);
}

function barnSpend(materials) {
  for (const [id, qty] of Object.entries(materials || {})) {
    state.barn.items[id] = Math.max(0, (state.barn.items[id] || 0) - qty);
  }
}

function itemStock(id) {
  return state.silo.items[id] ?? state.barn.items[id] ?? 0;
}

function removeItem(id, qty) {
  if (state.silo.items[id] !== undefined) {
    state.silo.items[id] = Math.max(0, state.silo.items[id] - qty);
  } else if (state.barn.items[id] !== undefined) {
    state.barn.items[id] = Math.max(0, state.barn.items[id] - qty);
  }
}

function addToBarn(id, qty) {
  return storage.add(id, qty);
}

/** Buy an enclosure (level-gated, consumes coins + materials). */
export function buyEnclosure(id) {
  const z = ensureState();
  const def = ZOO.enclosures[id];
  if (!def) return false;
  if (z.enclosures[id]) return false; // already owned
  if (state.level < def.unlockLevel) return false;
  if (state.coins < def.cost) return false;
  if (!barnHas(def.materials)) return false;

  economy.addCoins(-def.cost);
  barnSpend(def.materials);
  z.enclosures[id] = { fedAt: 0, readyAt: 0 };
  return true;
}

/** Feed an enclosure (consumes its feed goods; starts the souvenir timer). */
export function feed(id) {
  const z = ensureState();
  const def = ZOO.enclosures[id];
  const owned = z.enclosures[id];
  if (!def || !owned) return false;
  if (owned.readyAt > 0) return false; // already producing/ready — collect first

  for (const [goodId, qty] of Object.entries(def.feed)) {
    if (itemStock(goodId) < qty) return false;
  }
  // Check everything, then commit.
  for (const [goodId, qty] of Object.entries(def.feed)) removeItem(goodId, qty);
  owned.fedAt = Date.now();
  owned.readyAt = owned.fedAt + def.produceTime * 1000;
  return true;
}

/** Collect a ready souvenir into the barn. */
export function collect(id) {
  const z = ensureState();
  const def = ZOO.enclosures[id];
  const owned = z.enclosures[id];
  if (!def || !owned) return false;
  if (!(owned.readyAt > 0) || Date.now() < owned.readyAt) return false;
  if (storage.room('barn') <= 0) return false; // barn full — the souvenir waits in the enclosure

  addToBarn(def.product, 1);
  economy.trackStat('zooSouvenirs', 1);   // the counter the Zookeeper achievement and regatta read
  owned.fedAt = 0;
  owned.readyAt = 0;
  return true;
}

/** Accrued visitor income since last collection (capped at 12h). */
export function pendingIncome(now = Date.now()) {
  const z = ensureState();
  if (state.level < ZOO.unlockLevel) return 0;
  const elapsedMs = Math.min(VISITOR_CAP_MS, Math.max(0, now - z.lastIncomeAt));
  const population = town.populationInfo().population;
  // Research (marketing) raises visitor income through the shared multiplier merge point.
  const perHour = ZOO.visitorIncomePerHour(population) * economy.multiplier('zooIncomeMult', 'zoo');
  return Math.floor(perHour * (elapsedMs / 3600000));
}

/** Collect visitor income. */
export function collectIncome() {
  const z = ensureState();
  const now = Date.now();
  const amount = pendingIncome(now);
  // Advance the clock regardless of amount so a zero-population early call doesn't let time
  // silently accumulate past the cap unclaimed.
  z.lastIncomeAt = now;
  if (amount > 0) economy.addCoins(amount);
  return amount;
}

// ---------------------------------------------------------------------------------------------
// Zoo orders: no dedicated data.js table exists (unlike orders.js's ORDERS), so requests are
// generated procedurally from owned zoo souvenir products plus farm crops/goods — matching the
// "mixing zoo + farm goods" contract in the module header.
// ---------------------------------------------------------------------------------------------
function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function baseSellValue(itemId) { return CROPS[itemId]?.sellPrice ?? GOODS[itemId]?.sellPrice ?? 0; }

function ownedProductIds() {
  const z = ensureState();
  return Object.keys(z.enclosures)
    .map((id) => ZOO.enclosures[id]?.product)
    .filter(Boolean);
}

function farmPool() {
  return [...Object.keys(CROPS), ...Object.keys(GOODS)].filter((id) => economy.isUnlocked(id));
}

let nextZooOrderId = 1;
function freshOrderId() { return `zoo_order_${nextZooOrderId++}_${Date.now().toString(36)}`; }

function generateOrder() {
  const zooIds = ownedProductIds();
  const farmIds = farmPool();
  if (zooIds.length === 0 || farmIds.length === 0) return null;

  const items = [
    { itemId: pickRandom(zooIds), qty: randomInt(1, 3) },
    { itemId: pickRandom(farmIds), qty: randomInt(2, 6) },
  ];
  const base = items.reduce((sum, it) => sum + baseSellValue(it.itemId) * it.qty, 0);
  return {
    id: freshOrderId(),
    items,
    rewardCoins: Math.round(base * 1.6) + 100,
    rewardXp: Math.max(10, Math.round(base / 10)),
  };
}

/** Advance timers + regenerate zoo orders; called from the game loop. */
export function tick(now = Date.now()) {
  const z = ensureState();
  if (state.level < ZOO.unlockLevel) return;
  while (z.orders.length < ZOO.orderSlots) {
    const order = generateOrder();
    if (!order) break; // nothing eligible yet — stop trying rather than loop forever
    z.orders.push(order);
  }
}

/** Fulfill a zoo order (consumes items, pays coins/XP, may include materials). */
export function fulfillOrder(orderId) {
  const z = ensureState();
  const order = z.orders.find((o) => o.id === orderId);
  if (!order) return false;
  for (const it of order.items) {
    if (itemStock(it.itemId) < it.qty) return false;
  }
  for (const it of order.items) removeItem(it.itemId, it.qty);

  economy.addCoins(order.rewardCoins);
  economy.addXp(order.rewardXp);
  z.orders = z.orders.filter((o) => o.id !== orderId);
  return true;
}
