// economy.js — coins, XP, leveling, unlock checks, and pricing helpers.

import { state } from './state.js';
import { LEVELS, CROPS, GOODS, MATERIALS } from './data.js';
import * as DATA from './data.js';

// ---------------------------------------------------------------------------
// Pluggable multiplier hook. Minigames, lab research and co-op perks all want
// to scale a sell value or a stat gain, but economy.js cannot import those
// modules directly (several are unimplemented stubs, and a hard dependency
// here would make this module unable to load until every one of them exists).
// Instead any module that computes a multiplier registers a provider; every
// registered provider is consulted here, at the single merge point the
// production.js contract calls for. With nothing registered the multiplier
// is exactly 1, so this module (and its tests) behave deterministically on
// their own.
// ---------------------------------------------------------------------------
const multiplierProviders = [];
/** Register a fn(kind, id) => number multiplier (e.g. lab.researchedEffect). */
export function registerMultiplierEffect(fn) { multiplierProviders.push(fn); }
function combinedMultiplier(kind, id) {
  let mult = 1;
  for (const fn of multiplierProviders) {
    try {
      const m = fn(kind, id);
      if (typeof m === 'number' && m > 0) mult *= m;
    } catch { /* a broken provider must never break the economy */ }
  }
  return mult;
}

const statHooks = [];
/** Register a fn(stat, total, delta) called after every trackStat increment (achievements). */
export function registerStatHook(fn) { statHooks.push(fn); }

const coinListeners = [];
/** Register a fn(newBalance, delta) called after every successful addCoins (coin-pop effect). */
export function onCoinsChanged(fn) { coinListeners.push(fn); }

const levelListeners = [];
/** Register a fn({leveledUp, newLevel, unlocks}) called after every addXp (level-up popup). */
export function onXpChanged(fn) { levelListeners.push(fn); }

/** Add coins (positive or negative). Throws if the balance would go negative. Fires coin-pop effect. */
export function addCoins(amount) {
  const next = state.coins + amount;
  if (next < 0) throw new Error(`addCoins: ${state.coins} + ${amount} would go negative`);
  state.coins = next;
  if (amount > 0) trackStat('coinsEarned', amount);
  for (const fn of coinListeners) {
    try { fn(state.coins, amount); } catch { /* a broken listener must never break the economy */ }
  }
  return state.coins;
}

/** Add XP, handling level-ups (may cascade multiple levels). Shows level-up popup + rewards diamonds. */
export function addXp(amount) {
  const result = { leveledUp: false, newLevel: state.level, unlocks: [] };
  if (!(amount > 0)) return result;

  state.xp += amount;
  while (state.level < LEVELS.maxLevel && state.xp >= LEVELS.xpForLevel(state.level)) {
    state.xp -= LEVELS.xpForLevel(state.level);
    state.level += 1;
    state.diamonds += 1; // Hay Day-style: every level-up drops a diamond
    result.leveledUp = true;
    result.newLevel = state.level;
    result.unlocks.push(...unlocksAt(state.level));
  }
  if (state.level >= LEVELS.maxLevel) state.xp = Math.max(0, state.xp); // never negative at the cap

  for (const fn of levelListeners) {
    try { fn(result); } catch { /* a broken listener must never break the economy */ }
  }
  return result;
}

/** Spend diamonds (skip timers, exclusive decorations). Returns false if insufficient. */
export function spendDiamonds(amount) {
  if (amount < 0) throw new Error('spendDiamonds: amount must not be negative');
  if (state.diamonds < amount) return false;
  state.diamonds -= amount;
  return true;
}

/** Diamond cost to skip `remainingSeconds` of a timer (Hay Day-style: ~1 diamond per 10 min, min 1). */
export function skipCost(remainingSeconds) {
  if (!(remainingSeconds > 0)) return 0;
  return Math.max(1, Math.ceil(remainingSeconds / 600));
}

// ---------------------------------------------------------------------------
// Unlock levels. Every content table in data.js keys entries by id and most
// carry their own `unlockLevel`; feature-level gates (buildings the player
// unlocks as a concept, town/mine/trains, etc.) live only in LEVELS.unlocks.
// This builds one map covering both sources ONCE (data.js is static content,
// never mutated at runtime) so new content just works without touching this
// file, per the "systems pick it up from data" rule in CLAUDE.md.
// ---------------------------------------------------------------------------
let unlockLevelCache = null;

function buildUnlockLevelMap() {
  const map = new Map();
  for (const [exportName, table] of Object.entries(DATA)) {
    if (exportName === 'LEVELS') continue;
    if (!table || typeof table !== 'object' || Array.isArray(table)) continue;
    for (const [id, def] of Object.entries(table)) {
      if (!def || typeof def !== 'object') continue;
      if (typeof def.unlockLevel === 'number' && !map.has(id)) map.set(id, def.unlockLevel);
      // Nested per-id dicts that carry their own unlockLevel: building recipes, zoo
      // enclosures, island destinations, mine depths.
      if (Array.isArray(def.recipes)) {
        for (const r of def.recipes) {
          if (r && typeof r.unlockLevel === 'number' && !map.has(r.id)) map.set(r.id, r.unlockLevel);
        }
      }
      for (const nestedKey of ['enclosures', 'destinations', 'depths']) {
        const nested = def[nestedKey];
        if (!nested) continue;
        const entries = Array.isArray(nested)
          ? nested.map((v) => [v.id, v])
          : Object.entries(nested);
        for (const [nid, ndef] of entries) {
          if (ndef && typeof ndef.unlockLevel === 'number' && !map.has(nid)) map.set(nid, ndef.unlockLevel);
        }
      }
    }
  }
  // Feature/content gates not covered by a per-entity unlockLevel field.
  for (const [levelStr, ids] of Object.entries(LEVELS.unlocks)) {
    const level = Number(levelStr);
    for (const id of ids) if (!map.has(id)) map.set(id, level);
  }
  return map;
}

function unlockLevelOf(id) {
  if (!unlockLevelCache) unlockLevelCache = buildUnlockLevelMap();
  return unlockLevelCache.has(id) ? unlockLevelCache.get(id) : 1;
}

/** Is a content id (crop/building/animal/feature) unlocked at the current level? */
export function isUnlocked(id) {
  return state.level >= unlockLevelOf(id);
}

/** List of ids newly unlocked when reaching `level` (for the level-up popup). */
export function unlocksAt(level) {
  return LEVELS.unlocks[level] || [];
}

/** Base sell value of any item id (crop, good, fish, ore), with active event multipliers applied. */
export function sellValue(itemId) {
  const base = CROPS[itemId]?.sellPrice ?? GOODS[itemId]?.sellPrice ?? MATERIALS[itemId]?.sellPrice ?? 0;
  return Math.round(base * combinedMultiplier('sell', itemId));
}

/** Record a lifetime stat increment and check achievements (delegates to extras.js). */
export function trackStat(stat, amount = 1) {
  state.stats[stat] = (state.stats[stat] || 0) + amount;
  for (const fn of statHooks) {
    try { fn(stat, state.stats[stat], amount); } catch { /* a broken hook must never break the economy */ }
  }
}
