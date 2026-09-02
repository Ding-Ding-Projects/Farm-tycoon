// helicopter.js — the helicopter pad (L22). A third transport beside the truck and the boat,
// and the fastest MATERIALS channel, which is what makes the crafting spine tractable at all.
//
// Fuel regenerates on absolute timestamps like every other timer, so it accrues while the game
// is closed and is capped rather than unbounded.
// State: state.helicopter { current: { crates, arrivedAt, departsAt } | null, fuel,
//                           fuelUpdatedAt, returningAt }
//
// `current` here carries { crates, departedAt, returningAt, xp, materials, coinsBonus } — the
// reward is rolled and banked at dispatch time (what the flight is bringing back), and
// collectDelivery() hands it over once returningAt has passed. `state.helicopter.returningAt`
// mirrors `current.returningAt` (0 when idle) to match the documented top-level shape exactly.
// A `loading` array (one slot per HELICOPTER.crates) holds what has been filled on the pad
// ahead of dispatch; it is not itself part of the documented save shape but is lazily added to
// the persisted state.helicopter object the same way, so it survives a reload.

import { state } from './state.js';
import { HELICOPTER, MATERIALS } from './data.js';
import * as economy from './economy.js';
import * as neighbours from './neighbours.js';
import * as storage from './storage.js';

function barnRoom() { return storage.room('barn'); }
function addToBarn(id, qty) { return storage.add(id, qty); }

function ensure() {
  const h = state.helicopter;
  if (!Array.isArray(h.loading)) h.loading = new Array(HELICOPTER.crates).fill(null);
  if (typeof h.fuel !== 'number') h.fuel = HELICOPTER.fuel.max;
  if (typeof h.fuelUpdatedAt !== 'number') h.fuelUpdatedAt = Date.now();
  if (typeof h.returningAt !== 'number') h.returningAt = h.current ? h.current.returningAt : 0;
  return h;
}

/** The flight currently on the pad, or null between flights. */
export function currentFlight() {
  return ensure().current;
}

/** Fuel now, resolving regeneration from fuelUpdatedAt and capping at HELICOPTER.fuel.max. */
export function currentFuel(now = Date.now()) {
  const h = ensure();
  const elapsed = Math.max(0, now - h.fuelUpdatedAt);
  const regen = Math.floor(elapsed / (HELICOPTER.fuel.regenSeconds * 1000));
  return Math.min(HELICOPTER.fuel.max, h.fuel + regen);
}

// Banks the regenerated fuel into persisted state and resets the regen baseline to `now`.
// Anything that SPENDS fuel must call this first, so spending interacts correctly with regen
// that accrued since the last time fuel was touched (including entirely offline).
function settleFuel(now) {
  const h = ensure();
  h.fuel = currentFuel(now);
  h.fuelUpdatedAt = now;
}

/** Fill one crate from the barn. */
export function fillCrate(index) {
  const h = ensure();
  if (h.current) return false; // pad is busy mid-flight
  if (!(index >= 0 && index < HELICOPTER.crates)) return false;
  if (h.loading[index]) return false; // already filled

  // The most plentiful barn GOOD. Never a Workshop component or kit (the crafting spine), and
  // never a construction material (that is what the flight brings BACK) - the old pick was
  // simply the biggest stack, which could quietly be a building kit.
  const stocked = Object.entries(state.barn.items)
    .filter(([id, qty]) => qty > 0 && !economy.isWorkshopCraft(id) && !MATERIALS[id])
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (!stocked.length) return false;
  const [goodId] = stocked[0];

  state.barn.items[goodId] -= 1;
  h.loading[index] = { item: goodId, qty: 1 };
  return true;
}

function weightedPick(rng, pool) {
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = rng() * total;
  for (const p of pool) {
    if (roll < p.weight) return p;
    roll -= p.weight;
  }
  return pool[pool.length - 1];
}

let dispatchCounter = 0;
function rollMaterials() {
  const [lo, hi] = HELICOPTER.rewards.materialsPerFlight;
  const seed = (state.neighbours?.seed ?? 0) ^ Date.now() ^ (dispatchCounter++);
  const rng = neighbours._rng(neighbours._hash(`heli_dispatch:${seed}`));
  const count = lo + Math.floor(rng() * (hi - lo + 1));
  const out = {};
  for (let i = 0; i < count; i++) {
    const pick = weightedPick(rng, HELICOPTER.rewards.materialPool);
    const [qLo, qHi] = pick.qty;
    const qty = qLo + Math.floor(rng() * (qHi - qLo + 1));
    out[pick.material] = (out[pick.material] || 0) + qty;
  }
  return out;
}

/** Dispatch the flight; spends fuel, pays XP, materials and the full-load bonus. */
export function dispatch() {
  const h = ensure();
  if (h.current) return false;
  const filled = h.loading.filter(Boolean);
  if (filled.length === 0) return false;

  const now = Date.now();
  settleFuel(now);
  if (h.fuel < HELICOPTER.fuel.costPerDispatch) return false;
  h.fuel -= HELICOPTER.fuel.costPerDispatch;

  const fullLoad = filled.length === HELICOPTER.crates;
  h.current = {
    crates: filled,
    departedAt: now,
    returningAt: now + HELICOPTER.interval * 1000,
    xp: HELICOPTER.rewards.xpPerCrate * filled.length,
    materials: rollMaterials(),
    coinsBonus: fullLoad ? HELICOPTER.rewards.fullBonusCoins : 0,
    coopPoints: HELICOPTER.rewards.coopPoints,
  };
  h.returningAt = h.current.returningAt;
  h.loading = new Array(HELICOPTER.crates).fill(null);
  return true;
}

/** Collect the return delivery. */
export function collectDelivery(now = Date.now()) {
  const h = ensure();
  if (!h.current || now < h.current.returningAt) return null;
  const f = h.current;

  const given = {};
  for (const [id, qty] of Object.entries(f.materials)) {
    const amount = addToBarn(id, qty);
    if (amount > 0) given[id] = amount;
  }
  economy.addXp(f.xp);
  if (f.coinsBonus) economy.addCoins(f.coinsBonus);
  economy.trackStat('helicopterFlights', 1);

  h.current = null;
  h.returningAt = 0;
  return { materials: given, xp: f.xp, coinsBonus: f.coinsBonus };
}

/** Advance flight and fuel timers; called from the game loop. */
export function tick(now = Date.now()) {
  ensure();
  settleFuel(now);
}
