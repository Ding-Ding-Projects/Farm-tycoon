// state.js — the single game-state object, new-game defaults, and save/load.
// Save format: one JSON blob in localStorage under KEY, with a `version` field for migrations.
// All timers are stored as absolute wall-clock timestamps (ms) so progress continues offline.

import { NEW_GAME } from './data.js';

export const SAVE_KEY = 'farm-tycoon-save';
// Still 1: load() is a stub and no build has ever shipped a save, so there is nothing to
// migrate FROM. The moment a build does ship saves, adding a key above means bumping this to 2
// and defaulting the new keys in load() — otherwise an existing save loads with them undefined
// and every consumer starts branching on absence.
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
 *
 *   // --- expansion systems ---
 *   workshop: { queue: [{recipeId, readyAt}], kits: {kitId: qty} },
 *   minigames: { pending, results, played },
 *   neighbours: { roster: [{id, first, last, farm, level, profile}], seed },
 *   coop: { points, perksUnlocked, dailyTasks, tasksRefreshedAt, requests, ownRequestCooldownUntil },
 *   regatta: { seasonId, endsAt, board, points, rivals, league, seasonsWon, placementClaimed },
 *   expeditions: { crew, active, lastResults },
 *   museum: { artifacts: {artifactId: qty}, exhibitsCompleted, claimedRewards },  // NOT the barn
 *   lab: { built, researched: [nodeId], active: {id, readyAt}|null },
 *   helicopter: { current, fuel, fuelUpdatedAt, returningAt },
 *   islands: { voyage: {islandId, readyAt}|null, unlocked },
 *   mine: { depthUnlocked, currentDepth, digs },
 *   foraging: { nodes: [{id, type, x, y, readyAt}] },
 *   newspaper: { issueId, generatedAt, listings },
 *   collections: { seen, claimed, mastery: {buildingId: {makes, star}} },
 *   decorate: { active, selection, history, historyIndex },
 *   photo: { frame, stickers },
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

    // Expansion systems. Seeded empty rather than left absent, so Phase B never has to branch
    // on whether a key exists — only on whether it holds anything yet.
    workshop: { queue: [], kits: {} },
    minigames: { pending: {}, results: {}, played: {} },
    neighbours: null,        // generated on first use from createdAt, then persisted forever
    coop: null,
    regatta: null,
    expeditions: { crew: [], active: [], lastResults: [] },
    museum: { artifacts: {}, exhibitsCompleted: [], claimedRewards: [] },
    lab: { built: false, researched: [], active: null },
    helicopter: { current: null, fuel: 5, fuelUpdatedAt: 0, returningAt: 0 },
    islands: { voyage: null, unlocked: [] },
    mine: { depthUnlocked: ['mine_depth_1'], currentDepth: 'mine_depth_1', digs: 0 },
    foraging: { nodes: [] },
    newspaper: { issueId: 0, generatedAt: 0, listings: [] },
    collections: { seen: {}, claimed: {}, mastery: {} },
    decorate: { active: false, selection: [], history: [], historyIndex: 0 },
    photo: { frame: 'frame_none', stickers: [] },
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
