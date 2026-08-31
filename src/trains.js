// trains.js — cargo transports of the Township layer: trains (L21) and the airport (L28).
// Trains: arrive every TRAINS.interval with wagons requesting goods; a filled train
// departs, and after TRAINS.tripTime returns with construction MATERIALS (weighted
// random). An unfilled train leaves after departureWindow with partial reward.
// Airport: a plane with AIRPORT.crates of high-tier goods; full plane pays the coin
// bonus + materials + XP. All timers wall-clock (readyAt), offline-resolved by tick().
// State: state.trains { current: {wagons, filledAt...}, returningAt }, state.airport {...}.

import { state } from './state.js';
import { TRAINS, AIRPORT, CROPS, GOODS } from './data.js';
import * as economy from './economy.js';

// ---------------------------------------------------------------------------------------------
// Lazy state seeding. state.js (owned by another lane) does not yet carry `trains`/`airport`
// keys in its documented shape; rather than touch a file outside this lane's ownership, every
// entry point here defensively seeds its own slice the first time it is touched. Once state.js
// grows these keys itself this is a harmless no-op (the `||=` never overwrites real data).
// ---------------------------------------------------------------------------------------------
function ensureState() {
  if (!state.trains) state.trains = { current: null, returningAt: 0, pendingMaterials: null };
  if (!state.airport) state.airport = { current: null, returningAt: 0, pendingMaterials: null, pendingBonus: 0 };
  return state;
}

function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function randomQty(qty) { return Array.isArray(qty) ? randomInt(qty[0], qty[1]) : qty; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Weighted pick from a pool shaped [{..., weight}]. Returns one entry or null. */
function weightedPick(pool) {
  const total = pool.reduce((sum, e) => sum + (e.weight || 0), 0);
  if (!(total > 0)) return null;
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight || 0;
    if (roll < 0) return entry;
  }
  return pool[pool.length - 1];
}

/** Draw `count` material rewards from `pool` (weighted, with repeats), merged into one map. */
function drawMaterials(pool, count) {
  const out = {};
  for (let i = 0; i < count; i++) {
    const pick = weightedPick(pool);
    if (!pick) continue;
    const qty = randomQty(pick.qty);
    out[pick.material] = (out[pick.material] || 0) + qty;
  }
  return out;
}

function barnUsed() {
  return Object.values(state.barn.items).reduce((a, b) => a + b, 0);
}

function barnRoom() {
  return Math.max(0, state.barn.capacity - barnUsed());
}

function addToBarn(items) {
  for (const [id, qty] of Object.entries(items)) {
    state.barn.items[id] = (state.barn.items[id] || 0) + qty;
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

/** A fresh set of wagon requests, drawn from unlocked goods/crops (level-scaled qty). */
function generateWagons() {
  const n = randomInt(TRAINS.wagons[0], TRAINS.wagons[1]);
  const pool = [...Object.keys(CROPS), ...Object.keys(GOODS)].filter((id) => economy.isUnlocked(id));
  const wagons = [];
  for (let i = 0; i < n; i++) {
    const itemId = pool.length ? pickRandom(pool) : 'wheat';
    wagons.push({ itemId, requested: randomInt(3, 8), filled: 0 });
  }
  return wagons;
}

function generateCrates() {
  const n = AIRPORT.crates;
  const pool = [...Object.keys(CROPS), ...Object.keys(GOODS)].filter((id) => economy.isUnlocked(id));
  const crates = [];
  for (let i = 0; i < n; i++) {
    const itemId = pool.length ? pickRandom(pool) : 'wheat';
    crates.push({ itemId, requested: randomInt(4, 10), filled: 0 });
  }
  return crates;
}

function isTrainFull(t) { return t.wagons.every((w) => w.filled >= w.requested); }
function isPlaneFull(p) { return p.crates.every((c) => c.filled >= c.requested); }

/** Advance train + plane lifecycles (arrive/depart/return); called from the game loop. */
export function tick(now) {
  ensureState();
  const level = state.level;

  // --- trains ---
  const t = state.trains;
  if (!t.current && !t.returningAt && level >= TRAINS.unlockLevel) {
    t.current = { wagons: generateWagons(), arrivedAt: now, departsBy: now + TRAINS.departureWindow * 1000 };
  }
  if (t.current) {
    const full = isTrainFull(t.current);
    if (full || now >= t.current.departsBy) {
      const filledWagons = t.current.wagons.filter((w) => w.filled >= w.requested).length;
      const materialsPerTrip = randomInt(TRAINS.materialsPerTrip[0], TRAINS.materialsPerTrip[1]);
      const scale = full ? 1 : (t.current.wagons.length ? filledWagons / t.current.wagons.length : 0);
      const count = Math.max(0, Math.round(materialsPerTrip * (full ? 1 : Math.max(0.25, scale))));
      const materials = drawMaterials(TRAINS.materialPool, count);
      const xp = full ? TRAINS.xpPerWagon * t.current.wagons.length : Math.round(TRAINS.xpPerWagon * filledWagons * 0.5);
      t.pendingMaterials = { materials, xp };
      t.returningAt = now + TRAINS.tripTime * 1000;
      t.current = null;
    }
  }
  if (t.returningAt && now >= t.returningAt && t.pendingMaterials && !t.readyToCollect) {
    t.readyToCollect = true;
  }

  // --- airport ---
  const a = state.airport;
  if (!a.current && !a.returningAt && level >= AIRPORT.unlockLevel) {
    a.current = { crates: generateCrates(), arrivedAt: now, departsBy: now + AIRPORT.departureWindow * 1000 };
  }
  if (a.current) {
    const full = isPlaneFull(a.current);
    if (full || now >= a.current.departsBy) {
      const filledCrates = a.current.crates.filter((c) => c.filled >= c.requested).length;
      const materialsPerFlight = randomInt(AIRPORT.rewards.materialsPerFlight[0], AIRPORT.rewards.materialsPerFlight[1]);
      const scale = full ? 1 : (a.current.crates.length ? filledCrates / a.current.crates.length : 0);
      const count = Math.max(0, Math.round(materialsPerFlight * (full ? 1 : Math.max(0.25, scale))));
      const materials = drawMaterials(AIRPORT.rewards.materialPool, count);
      const xp = full ? AIRPORT.rewards.xpPerCrate * a.current.crates.length : Math.round(AIRPORT.rewards.xpPerCrate * filledCrates * 0.5);
      const bonus = full ? AIRPORT.rewards.fullBonusCoins : 0;
      a.pendingMaterials = { materials, xp };
      a.pendingBonus = bonus;
      a.returningAt = now + TRAINS.tripTime * 1000; // no dedicated flight-return time in data; reuse trip cadence
      a.current = null;
    }
  }
  if (a.returningAt && now >= a.returningAt && a.pendingMaterials && !a.readyToCollect) {
    a.readyToCollect = true;
  }
}

/** The train currently at the station (wagons + fill state + departure countdown), or null. */
export function currentTrain() {
  ensureState();
  return state.trains.current;
}

/** Fill one wagon from storage. */
export function fillWagon(index) {
  ensureState();
  const t = state.trains.current;
  if (!t || !t.wagons[index]) return false;
  const wagon = t.wagons[index];
  const need = wagon.requested - wagon.filled;
  if (need <= 0) return false;
  const have = itemStock(wagon.itemId);
  const take = Math.min(need, have);
  if (take <= 0) return false;
  removeItem(wagon.itemId, take);
  wagon.filled += take;
  return true;
}

/** Dispatch a fully loaded train early (starts the material trip immediately). */
export function dispatchTrain() {
  ensureState();
  const t = state.trains.current;
  if (!t || !isTrainFull(t)) return false;
  tick(Date.now());
  return true;
}

/** The plane currently at the airport, or null. */
export function currentPlane() {
  ensureState();
  return state.airport.current;
}

/** Fill one plane crate from storage. */
export function fillCrate(index) {
  ensureState();
  const a = state.airport.current;
  if (!a || !a.crates[index]) return false;
  const crate = a.crates[index];
  const need = crate.requested - crate.filled;
  if (need <= 0) return false;
  const have = itemStock(crate.itemId);
  const take = Math.min(need, have);
  if (take <= 0) return false;
  removeItem(crate.itemId, take);
  crate.filled += take;
  return true;
}

/** Claim a returned train's materials into the barn. */
export function collectDelivery() {
  ensureState();
  const t = state.trains;
  if (!t.readyToCollect || !t.pendingMaterials) return false;
  const totalQty = Object.values(t.pendingMaterials.materials).reduce((a, b) => a + b, 0);
  if (totalQty > barnRoom()) return false; // caller must free space first; never lose materials
  addToBarn(t.pendingMaterials.materials);
  if (t.pendingMaterials.xp > 0) economy.addXp(t.pendingMaterials.xp);
  t.pendingMaterials = null;
  t.returningAt = 0;
  t.readyToCollect = false;
  return true;
}

/** Claim a returned plane's materials + bonus coins into the barn. */
export function collectFlight() {
  ensureState();
  const a = state.airport;
  if (!a.readyToCollect || !a.pendingMaterials) return false;
  const totalQty = Object.values(a.pendingMaterials.materials).reduce((s, v) => s + v, 0);
  if (totalQty > barnRoom()) return false;
  addToBarn(a.pendingMaterials.materials);
  if (a.pendingMaterials.xp > 0) economy.addXp(a.pendingMaterials.xp);
  if (a.pendingBonus > 0) economy.addCoins(a.pendingBonus);
  a.pendingMaterials = null;
  a.pendingBonus = 0;
  a.returningAt = 0;
  a.readyToCollect = false;
  return true;
}
