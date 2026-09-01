// storage.js — the silo and the barn: capacity, room, one add path, and the upgrades.
//
// Fourteen modules used to carry their own copy of `barnRoom()` reading `state.barn.capacity`
// directly, and NOTHING ever wrote that capacity after new-game: STORAGE (data.js) had no
// consumer, the laboratory's siloCapBonus/barnCapBonus were computed and read by nobody, and
// the co-op's Communal Store perk did nothing. A 50-slot barn holding every good, all 23
// construction materials, kits, ore, fish and souvenirs is why the mid-game was unreachable.
//
// This is now the one place that answers "how much fits": effective capacity is the save's
// own (upgradeable) capacity plus every registered bonus, and every module that stores things
// asks here. The rule for "not enough room" lives with the callers and is the same everywhere
// (see production.harvest): check room BEFORE consuming; with no room refuse and leave the
// source intact; with partial room store what fits and pay the rest out as coins at sellValue,
// via addOrPay() - a player must never lose value to a cap they cannot see coming.

import { state } from './state.js';
import { STORAGE, CROPS } from './data.js';
import * as economy from './economy.js';

export function isCrop(id) { return Object.prototype.hasOwnProperty.call(CROPS, id); }

/** 'silo' for a crop id, 'barn' for everything else (goods, materials, fish, ore, kits). */
export function kindOf(id) { return isCrop(id) ? 'silo' : 'barn'; }

/** The live items map an id is stored in. */
export function bucketFor(id) { return isCrop(id) ? state.silo.items : state.barn.items; }

/** Capacity written on the save (base + bought upgrades), before bonuses. */
export function baseCapacity(kind) { return state[kind].capacity; }

/** Effective capacity: the save's capacity plus research and co-op bonuses (economy.bonus). */
export function capacity(kind) {
  const extra = economy.bonus(kind === 'silo' ? 'siloCapBonus' : 'barnCapBonus');
  return Math.floor(state[kind].capacity + Math.max(0, extra));
}

export function used(kind) {
  return Object.values(state[kind].items).reduce((a, b) => a + (b > 0 ? b : 0), 0);
}

export function room(kind) { return Math.max(0, capacity(kind) - used(kind)); }

export function roomFor(id) { return room(kindOf(id)); }

/** Store up to `qty` of `id`, never past the cap. Returns how many actually landed. */
export function add(id, qty) {
  const give = Math.max(0, Math.min(Math.floor(qty), roomFor(id)));
  if (give > 0) {
    const bucket = bucketFor(id);
    bucket[id] = (bucket[id] || 0) + give;
  }
  return give;
}

/**
 * Store what fits and pay the shortfall out as coins at sellValue, so a reward, a refund or a
 * harvest into a full store is never silently lost. Returns { given, paidOut }.
 */
export function addOrPay(id, qty) {
  const given = add(id, qty);
  const short = Math.max(0, Math.floor(qty) - given);
  let paidOut = 0;
  if (short > 0) {
    paidOut = Math.round(economy.sellValue(id) * short);
    if (paidOut > 0) economy.addCoins(paidOut);
  }
  return { given, paidOut };
}

/** Take up to `qty` of `id` out of wherever it lives; returns how many were taken. */
export function take(id, qty) {
  const bucket = bucketFor(id);
  const have = bucket[id] || 0;
  const taken = Math.max(0, Math.min(have, Math.floor(qty)));
  if (taken > 0) bucket[id] = have - taken;
  return taken;
}

// ---------------------------------------------------------------------------
// Upgrades (STORAGE in data.js): each step adds upgradeStep slots for coins that grow by
// upgradeCostFactor per step, plus a trio of construction materials that grows by one each.
// ---------------------------------------------------------------------------

export function upgradesBought(kind) {
  const def = STORAGE[kind];
  if (!def) return 0;
  return Math.max(0, Math.round((state[kind].capacity - def.baseCapacity) / def.upgradeStep));
}

/** { coins, materials: {id: qty}, nextCapacity } for the next upgrade of a store. */
export function upgradeCost(kind) {
  const def = STORAGE[kind];
  if (!def) return null;
  const n = upgradesBought(kind);
  const coins = Math.round(def.upgradeCostBase * Math.pow(def.upgradeCostFactor, n));
  const materials = {};
  for (const m of def.materials) materials[m] = def.materialBase + def.materialStep * n;
  return { coins, materials, nextCapacity: state[kind].capacity + def.upgradeStep };
}

export function canUpgrade(kind) {
  const cost = upgradeCost(kind);
  if (!cost) return false;
  if (state.coins < cost.coins) return false;
  for (const [id, qty] of Object.entries(cost.materials)) {
    if ((state.barn.items[id] || 0) < qty) return false;
  }
  return true;
}

/** Buy the next upgrade: consumes coins + materials, raises the save's capacity. */
export function upgrade(kind) {
  if (!canUpgrade(kind)) return false;
  const cost = upgradeCost(kind);
  economy.addCoins(-cost.coins);
  for (const [id, qty] of Object.entries(cost.materials)) state.barn.items[id] -= qty;
  state[kind].capacity += STORAGE[kind].upgradeStep;
  return true;
}
