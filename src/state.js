// state.js — the single game-state object, new-game defaults, and save/load.
// Save format: one JSON blob in localStorage under KEY, with a `version` field for migrations.
// All timers are stored as absolute wall-clock timestamps (ms) so progress continues offline.

import { NEW_GAME } from './data.js';

export const SAVE_KEY = 'farm-tycoon-save';
export const SAVE_VERSION = 1;

/**
 * The live game state. Shape (Phase B fills in behavior; the shape is the contract):
 * {
 *   version, createdAt, lastSaved,
 *   coins, diamonds, vouchers, level, xp,
 *   farm: { objects: [{id, type, kind, x, y, ...}], unlockedZones: ['start', ...] },
 *   silo: { capacity, items: {cropId: qty} },
 *   barn: { capacity, items: {goodId: qty} },
 *   production: [{objectId, recipeId, readyAt}], // active queue entries
 *   orders: { board: [...], truck: {...}, boat: {...} },
 *   shop: { listings: [{item, qty, price, soldAt}] },
 *   pets: { dog: {owned, lastFedAt}, cat: {...} },
 *   fishing: { cast: null|{readyAt} },
 *   achievements: { unlocked: [id...] },
 *   daily: { lastSpinAt, streak },
 *   event: { id, endsAt },
 *   stats: { cropsHarvested, ordersFulfilled, coinsEarned, ... }, // lifetime counters
 *   settings: { sound, autosaveInterval },
 * }
 */
export let state = null;

/** Create a fresh new-game state object (does not persist it). */
export function newGameState() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    lastSaved: 0,
    coins: NEW_GAME.coins,
    diamonds: NEW_GAME.diamonds,
    vouchers: 0,
    level: NEW_GAME.level,
    xp: 0,
    farm: { objects: [], unlockedZones: ['start'] },
    silo: { capacity: 50, items: { ...NEW_GAME.seeds } },
    barn: { capacity: 50, items: {} },
    production: [],
    orders: { board: [], truck: null, boat: null },
    shop: { listings: [] },
    pets: {},
    fishing: { cast: null },
    achievements: { unlocked: [] },
    daily: { lastSpinAt: 0, streak: 0 },
    event: null,
    stats: {},
    settings: { sound: true, autosaveInterval: 10 },
  };
}

/** Load from localStorage (running migrations by version) or start a new game. Sets `state`. */
export function load() { /* Phase B */ state = newGameState(); return state; }

/** Persist `state` to localStorage. Called by the autosave timer and on quit. */
export function save() { /* Phase B */ }

/** Serialize the save to a JSON string for export (settings panel). */
export function exportSave() { /* Phase B */ }

/** Import a save from a JSON string; validates version and shape. */
export function importSave(json) { /* Phase B */ }

/** Wipe the save and restart (settings panel "reset game"). */
export function resetGame() { /* Phase B */ }
