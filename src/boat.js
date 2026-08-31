// boat.js — boat orders (L17): a boat docks every ORDERS.boat.interval with 6 bulk crates;
// filling all crates before departureWindow expires pays bonusMultiplier + vouchers
// (spent on exclusive decorations in DECORATIONS with voucherCost).

import { state } from './state.js';
import { ORDERS, CROPS, GOODS } from './data.js';
import * as economy from './economy.js';
import { eligibleItemIds } from './orders.js';

function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function baseSellValue(itemId) { return CROPS[itemId]?.sellPrice ?? GOODS[itemId]?.sellPrice ?? 0; }

function spawnBoat(now) {
  const pool = eligibleItemIds(state.level);
  const crates = [];
  const usedIds = new Set();
  for (let i = 0; i < ORDERS.boat.crates; i++) {
    const remaining = pool.filter((id) => !usedIds.has(id));
    const itemId = remaining.length > 0 ? pickRandom(remaining) : (pool.length > 0 ? pickRandom(pool) : null);
    if (itemId === null) break; // no eligible content yet (very low level)
    usedIds.add(itemId);
    crates.push({ itemId, qty: randomInt(3, 8), filled: false });
  }
  return {
    crates,
    dockedAt: now,
    departsAt: now + ORDERS.boat.departureWindow * 1000,
    claimed: false,
    departed: false,
    nextSpawnAt: null,
  };
}

/** Spawn/advance the boat lifecycle (docked → departed); called from the game loop. */
export function tick(now = Date.now()) {
  if (state.level < ORDERS.boat.unlockLevel) return;
  const boat = state.orders.boat;
  if (!boat || (boat.departed && boat.nextSpawnAt !== null && now >= boat.nextSpawnAt)) {
    state.orders.boat = spawnBoat(now);
    return;
  }
  if (!boat.departed && !boat.claimed && now >= boat.departsAt) {
    // Window expired without every crate filled and claimed — the boat leaves empty-handed,
    // and whatever was already loaded into crates stays lost (matching Hay Day/Township's rule
    // that a missed boat forfeits its cargo, not just its bonus).
    boat.departed = true;
    boat.nextSpawnAt = now + ORDERS.boat.interval * 1000;
  }
}

/** Fill one crate from storage. */
export function fillCrate(index) {
  const boat = state.orders.boat;
  if (!boat || boat.departed || boat.claimed) return false;
  const crate = boat.crates[index];
  if (!crate || crate.filled) return false;

  const bucket = CROPS[crate.itemId] ? state.silo.items : state.barn.items;
  if ((bucket[crate.itemId] || 0) < crate.qty) return false;
  bucket[crate.itemId] -= crate.qty;
  crate.filled = true;
  return true;
}

/** Claim the full-boat bonus (coins + XP + vouchers) once every crate is filled. */
export function claimBonus() {
  const boat = state.orders.boat;
  if (!boat || boat.claimed || boat.departed) return false;
  if (boat.crates.length === 0 || !boat.crates.every((c) => c.filled)) return false;
  const now = Date.now();
  if (now >= boat.departsAt) return false; // too late — tick() will mark it departed next

  const totalBase = boat.crates.reduce((sum, c) => sum + baseSellValue(c.itemId) * c.qty, 0);
  const coins = Math.round(totalBase * ORDERS.boat.bonusMultiplier);
  const xp = Math.round(boat.crates.length * ORDERS.boat.bonusMultiplier * 2);
  const [voucherMin, voucherMax] = ORDERS.boat.vouchersPerBoat;
  const vouchers = randomInt(voucherMin, voucherMax);

  economy.addCoins(coins);
  economy.addXp(xp);
  state.vouchers = (state.vouchers || 0) + vouchers;
  economy.trackStat('boatsCompleted', 1);

  boat.claimed = true;
  boat.departed = true;
  boat.nextSpawnAt = now + ORDERS.boat.interval * 1000;
  return { coins, xp, vouchers };
}

// ---- Island voyages moved out ----
// Voyages now live in islands.js. They were parked here while the boat was the only vessel,
// but with expeditions.js in the codebase 'the boat module also does expeditions' is a
// confusion waiting to happen, and the two share nothing but water. boat.js keeps crates and
// vouchers; islands.js owns sailing.
