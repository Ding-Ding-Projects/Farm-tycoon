// fishing.js — the pond mini-area: cast, timing minigame, fish/chest loot.
// Flow: cast() starts FISHING.castTime; when ready, the UI shows a moving marker —
// reel(accuracy 0..1) decides catch quality; rollCatch() picks species by rarity weight
// (or a treasure chest at FISHING.chestChance).

import { state } from './state.js';
import { FISHING } from './data.js';
import * as economy from './economy.js';

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
  const tier = rollWeighted(FISHING.rarityWeights);
  const tiers = speciesTiers();
  const candidates = tiers[tier] && tiers[tier].length > 0 ? tiers[tier] : FISHING.species;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function siloBarnRoomFor() {
  // Fish are goods (barn stock), never crops.
  const total = Object.values(state.barn.items).reduce((a, b) => a + b, 0);
  return Math.max(0, state.barn.capacity - total);
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

/** Resolve the reel minigame: accuracy 0..1 from the timing bar. Returns {item, qty} or {chest}. */
export function reel(accuracy) {
  const fishing = ensureFishingState();
  if (!fishing.cast) return null;
  const now = Date.now();
  if (now < fishing.cast.readyAt) return null; // not ready yet

  fishing.cast = null; // the cast is consumed regardless of outcome
  const clampedAccuracy = Math.min(1, Math.max(0, accuracy));

  if (Math.random() < FISHING.chestChance) {
    return { chest: true };
  }

  const speciesId = pickSpecies();
  // Better timing yields a chance at an extra fish (1 normally, up to 2 on a near-perfect reel),
  // capped by remaining barn room like every other production output.
  const qty = clampedAccuracy > 0.9 && Math.random() < 0.25 ? 2 : 1;
  const given = Math.min(qty, siloBarnRoomFor());
  if (given > 0) state.barn.items[speciesId] = (state.barn.items[speciesId] || 0) + given;
  economy.trackStat('fishCaught', given);
  return { item: speciesId, qty: given };
}

/** Open a treasure chest: rolls FISHING.chestLoot. */
export function openChest() {
  const entry = rollChestLoot();
  const result = {};

  if (entry.coins) {
    const [min, max] = entry.coins;
    const amount = min + Math.floor(Math.random() * (max - min + 1));
    economy.addCoins(amount);
    result.coins = amount;
  }
  if (entry.diamonds) {
    const [min, max] = entry.diamonds;
    const amount = min + Math.floor(Math.random() * (max - min + 1));
    state.diamonds += amount;
    result.diamonds = amount;
  }
  if (entry.item) {
    const [min, max] = entry.qty;
    const qty = min + Math.floor(Math.random() * (max - min + 1));
    const given = Math.min(qty, siloBarnRoomFor());
    if (given > 0) state.barn.items[entry.item] = (state.barn.items[entry.item] || 0) + given;
    result.item = entry.item;
    result.qty = given;
  }
  if (entry.material) {
    const [min, max] = entry.qty;
    const qty = min + Math.floor(Math.random() * (max - min + 1));
    const given = Math.min(qty, siloBarnRoomFor());
    if (given > 0) state.barn.items[entry.material] = (state.barn.items[entry.material] || 0) + given;
    result.material = entry.material;
    result.qty = given;
  }
  economy.trackStat('chestsOpened', 1);
  return result;
}
