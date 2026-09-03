// fishing.js — the pond mini-area: cast, timing minigame, fish/chest loot.
// Flow: cast() starts FISHING.castTime; when ready, the UI shows a moving marker —
// reel(accuracy 0..1) decides catch quality; rollCatch() picks species by rarity weight
// (or a treasure chest at FISHING.chestChance).

import { state } from './state.js';
import { FISHING } from './data.js';
import * as economy from './economy.js';
import * as storage from './storage.js';
import * as extras from './extras.js';
import * as collections from './collections.js';

function ensureFishingState() {
  if (!state.fishing || typeof state.fishing !== 'object') state.fishing = { cast: null };
  return state.fishing;
}

/** Start a cast; fails if one is already in progress. */
export function cast() {
  if (state.level < FISHING.unlockLevel) return false;
  const fishing = ensureFishingState();
  if (fishing.cast) return false; // already casting/waiting to reel
  fishing.cast = { readyAt: Date.now() + FISHING.castTime * 1000 };
  return true;
}

/** Is the cast ready for the reel minigame? */
export function isReady(now = Date.now()) {
  const fishing = ensureFishingState();
  return !!(fishing.cast && now >= fishing.cast.readyAt);
}

// Rarity weight -> species tier. Species are listed lowest-tier-first in FISHING.species and
// split evenly across common/uncommon/rare buckets (14 species / 3 tiers), matching how
// rarityWeights is structured as three named buckets rather than one per species.
function speciesTiers() {
  const list = FISHING.species;
  const third = Math.ceil(list.length / 3);
  return {
    common: list.slice(0, third),
    uncommon: list.slice(third, third * 2),
    rare: list.slice(third * 2),
  };
}

function rollWeighted(weightMap) {
  const entries = Object.entries(weightMap).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return entries[0]?.[0];
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    if (roll < w) return key;
    roll -= w;
  }
  return entries[entries.length - 1][0];
}

function pickSpecies() {
  // Research (sonar) adds to the rare bucket's share of the roll.
  const weights = { ...FISHING.rarityWeights };
  const rareBonus = economy.bonus('fishRareChance');
  if (rareBonus > 0) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    weights.rare = (weights.rare || 0) + rareBonus * total;
  }
  const tier = rollWeighted(weights);
  const tiers = speciesTiers();
  const candidates = tiers[tier] && tiers[tier].length > 0 ? tiers[tier] : FISHING.species;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function siloBarnRoomFor() {
  // Fish are goods (barn stock), never crops.
  return storage.room('barn');
}

function eventEffect() {
  try { return extras.activeEventEffect() || {}; } catch { return {}; }
}

/** Roll a treasure chest's contents against FISHING.chestLoot. Does not open it. */
function rollChestLoot() {
  const total = FISHING.chestLoot.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of FISHING.chestLoot) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return FISHING.chestLoot[FISHING.chestLoot.length - 1];
}

/**
 * Reel in a chest: it comes up locked.
 *
 * The loot is rolled here, at the moment it breaks the surface, and held on the chest until it
 * is worked open - so reloading a save cannot re-roll a disappointing chest, and what the player
 * eventually opens is what they actually caught.
 */
function haulChest() {
  const fishing = ensureFishingState();
  const entry = rollChestLoot();
  const loot = {};
  if (entry.coins) loot.coins = randomBetween(entry.coins);
  if (entry.diamonds) loot.diamonds = randomBetween(entry.diamonds);
  if (entry.item) { loot.item = entry.item; loot.qty = randomBetween(entry.qty); }
  if (entry.material) { loot.material = entry.material; loot.qty = randomBetween(entry.qty); }
  const now = Date.now();
  fishing.chest = {
    loot,
    hauledAt: now,
    readyAt: now + FISHING.chestOpenTime * 1000,
    ready: false,
  };
  return fishing.chest;
}

function randomBetween(range) {
  const [min, max] = range;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** The chest currently being worked open, or null. */
export function pendingChest() {
  return ensureFishingState().chest || null;
}

/** Mark a chest ready once its time is up. Called from the game loop. */
export function tick(now = Date.now()) {
  const fishing = ensureFishingState();
  if (fishing.chest && !fishing.chest.ready && now >= fishing.chest.readyAt) fishing.chest.ready = true;
}

/** Resolve the reel minigame: accuracy 0..1 from the timing bar. Returns {item, qty} or {chest}. */
export function reel(accuracy) {
  const fishing = ensureFishingState();
  if (!fishing.cast) return null;
  const now = Date.now();
  if (now < fishing.cast.readyAt) return null; // not ready yet
  // A full barn keeps the line in the water: the cast is NOT spent until the catch has a home.
  if (siloBarnRoomFor() <= 0) return null;

  fishing.cast = null; // the cast is consumed regardless of outcome
  const clampedAccuracy = Math.min(1, Math.max(0, accuracy));

  // A chest already on the bench is never overwritten by a second one - that would silently
  // destroy loot the player had already been shown and was waiting on.
  if (!fishing.chest && Math.random() < FISHING.chestChance) {
    const chest = haulChest();
    return { chest: true, readyAt: chest.readyAt, seconds: FISHING.chestOpenTime };
  }

  const speciesId = pickSpecies();
  // Better timing yields a chance at an extra fish (1 normally, up to 2 on a near-perfect reel);
  // Fishing Frenzy doubles every catch. What the barn cannot hold is paid out as coins.
  let qty = clampedAccuracy > 0.9 && Math.random() < 0.25 ? 2 : 1;
  if (eventEffect().fishDouble) qty *= 2;
  const { given, paidOut } = storage.addOrPay(speciesId, qty);
  economy.trackStat('fishCaught', given);
  // The Fishing Log and the Compleat Angler achievement both count distinct species.
  fishing.caught = fishing.caught || {};
  fishing.caught[speciesId] = (fishing.caught[speciesId] || 0) + 1;
  economy.setStat('uniqueFishCaught', Object.keys(fishing.caught).length);
  collections.record('fish_book', speciesId);
  return { item: speciesId, qty: given, paidOut };
}

/**
 * Open a chest that has finished being worked open. Pays whatever was rolled when it surfaced -
 * never a fresh roll, so the wait cannot turn a good chest into a bad one.
 */
export function openChest(now = Date.now()) {
  const fishing = ensureFishingState();
  const chest = fishing.chest;
  if (!chest) return null;
  if (now < chest.readyAt) return false;

  const loot = chest.loot || {};
  const result = {};
  if (loot.coins) { economy.addCoins(loot.coins); result.coins = loot.coins; }
  if (loot.diamonds) { state.diamonds += loot.diamonds; result.diamonds = loot.diamonds; }
  if (loot.item) {
    const { given, paidOut } = storage.addOrPay(loot.item, loot.qty);   // never lost to a full barn
    result.item = loot.item; result.qty = given; result.paidOut = paidOut;
  }
  if (loot.material) {
    const { given, paidOut } = storage.addOrPay(loot.material, loot.qty);
    result.material = loot.material; result.qty = given; result.paidOut = paidOut;
  }

  fishing.chest = null;
  economy.trackStat('chestsOpened', 1);
  return result;
}
