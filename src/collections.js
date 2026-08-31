// collections.js — collection books and building mastery (COLLECTIONS, MASTERY, L10).
//
// Book entries are DERIVED from the live data tables, never hand-listed, so a new fish or recipe
// joins its book automatically and no book can drift out of date. The validator checks each
// source derives a non-empty list, because a book that silently derives nothing renders as an
// empty page with no error anywhere.
//
// Mastery effects flow through EFFECT_KEYS and are merged by lab.researchedEffect(), so mastery,
// research and minigames meet at one point rather than three.
// State: state.collections { seen: { bookId: [entryId] }, claimed: { bookId: n },
//                            mastery: { buildingId: { makes, star } } }

import { state } from './state.js';
import { COLLECTIONS, MASTERY, EFFECT_KEYS, CROPS, BUILDINGS, FISHING, FORAGING, MUSEUM } from './data.js';
import * as economy from './economy.js';

/**
 * A source table name -> the deterministic list of entry ids it derives, so a new crop,
 * recipe, fish, forage find or artifact joins its book the moment it lands in data.js.
 * Never hand-listed here — this is the one thing this module is written to guarantee.
 */
const SOURCES = {
  crops: () => Object.keys(CROPS || {}),
  recipes: () => {
    const ids = [];
    for (const building of Object.values(BUILDINGS || {})) {
      for (const recipe of building.recipes || []) ids.push(recipe.id);
    }
    return [...new Set(ids)];
  },
  fish: () => [...(FISHING?.species || [])],
  forage: () => {
    const ids = [];
    for (const def of Object.values(FORAGING?.nodes || {})) {
      for (const y of def.yields || []) ids.push(y.item);
    }
    return [...new Set(ids)];
  },
  artifacts: () => {
    const ids = [];
    for (const exhibit of Object.values(MUSEUM?.exhibits || {})) {
      for (const a of exhibit.artifacts || []) ids.push(a);
    }
    return [...new Set(ids)];
  },
};

function bookDef(bookId) {
  return COLLECTIONS.books[bookId] || null;
}

/** Every entry a book can hold, derived from its source table. */
export function bookEntries(bookId) {
  const def = bookDef(bookId);
  if (!def) return [];
  const deriver = SOURCES[def.source];
  return deriver ? deriver() : [];
}

/** Which of them the player has found. */
export function found(bookId) {
  return state.collections.seen[bookId] || [];
}

/** Record a discovery. Idempotent - finding a second trout changes nothing. */
export function record(bookId, entryId) {
  if (!bookDef(bookId)) return false;
  if (!bookEntries(bookId).includes(entryId)) return false;
  const list = state.collections.seen[bookId] || (state.collections.seen[bookId] = []);
  if (list.includes(entryId)) return false;
  list.push(entryId);
  return true;
}

/** Number of unclaimed milestone tiers for a book (found.length / rewardPer, minus claimed). */
export function claimable(bookId) {
  const def = bookDef(bookId);
  if (!def) return 0;
  const tiersEarned = Math.floor(found(bookId).length / def.rewardPer);
  const tiersClaimed = state.collections.claimed[bookId] || 0;
  return Math.max(0, tiersEarned - tiersClaimed);
}

/** Claim them. */
export function claim(bookId) {
  const def = bookDef(bookId);
  if (!def) return 0;
  const count = claimable(bookId);
  if (count <= 0) return 0;

  if (def.reward.coins) economy.addCoins(def.reward.coins * count);
  if (def.reward.diamonds) state.diamonds += def.reward.diamonds * count;
  if (def.reward.xp) economy.addXp(def.reward.xp * count);

  state.collections.claimed[bookId] = (state.collections.claimed[bookId] || 0) + count;
  return count;
}

function tierFor(makes) {
  let best = null;
  for (const tier of MASTERY.tiers) {
    if (makes >= tier.makes) best = tier;
  }
  return best;
}

/** Count one completed production toward a building's mastery. */
export function recordMake(buildingId) {
  const entry = state.collections.mastery[buildingId] || (state.collections.mastery[buildingId] = { makes: 0, star: 0 });
  entry.makes += 1;
  const tier = tierFor(entry.makes);
  entry.star = tier ? tier.star : 0;
  return entry;
}

/** A building's current star tier and progress to the next. */
export function masteryOf(buildingId) {
  const entry = state.collections.mastery[buildingId] || { makes: 0, star: 0 };
  const tier = tierFor(entry.makes);
  const nextTier = MASTERY.tiers.find((t) => t.makes > entry.makes) || null;
  return {
    makes: entry.makes,
    star: entry.star,
    bonus: tier ? tier.bonus : 1,
    nextTier: nextTier ? { star: nextTier.star, makes: nextTier.makes, remaining: nextTier.makes - entry.makes } : null,
  };
}

/**
 * Merged mastery effect across every building, for the shared multiplier merge point.
 * Returns a complete object over EFFECT_KEYS with neutral (1) values, matching
 * lab.researchedEffect()'s shape, so callers never branch on a missing key. Only
 * MASTERY.effect ever moves, as the product of every mastered building's current bonus —
 * an unmastered building contributes 1 (no effect), never undefined.
 */
export function masteryEffect() {
  const effect = {};
  for (const key of EFFECT_KEYS) effect[key] = 1;

  let merged = 1;
  for (const buildingId of Object.keys(state.collections.mastery)) {
    merged *= masteryOf(buildingId).bonus;
  }
  effect[MASTERY.effect] = merged;
  return effect;
}
