// state.js — the single game-state object, new-game defaults, and save/load.
// Save format: one JSON blob in localStorage under KEY, with a `version` field for migrations.
// All timers are stored as absolute wall-clock timestamps (ms) so progress continues offline.

import { NEW_GAME, FARM, MERGE, TOWN } from './data.js';

export const SAVE_KEY = 'farm-tycoon-save';
// v1 -> v2: merge/trains/airport joined the documented shape below (builds v0.1.0-build2
// through build11 shipped v1 saves, so a real save missing those three keys can exist on a
// machine). v2 -> v3: town/zoo/market joined it too (builds through v0.1.0-build15 shipped v2
// saves without them — town.js/zoo.js/shop.js built those slices lazily on first use instead
// of newGameState() seeding them, so a v2 save on disk can genuinely lack all three). Any
// future key added to the shape means bumping this again and adding a migration in
// MIGRATIONS — otherwise an existing save loads with the new key undefined and every consumer
// starts branching on absence.
// v4 -> v5: settings.dayCycle (the day/night light over the farm, default on). Also from v5,
// load() default-fills ANY top-level key a save lacks from newGameState(), so a key added to
// the shape can never again reach a consumer as undefined - the migrations stay as the record
// of what each version changed, and the fill is the safety net under them.
export const SAVE_VERSION = 5;

// localStorage is a browser/Electron-renderer global. The game itself never runs anywhere
// else, but tools/test-core.mjs exercises this module under plain Node, which has no such
// global. Fall back to an in-memory store with the identical get/set/remove surface so the
// real code path (browser localStorage) is untouched and the test path needs no setup.
const storage = (() => {
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
  };
})();

/**
 * The live game state. Shape (Phase B fills in behavior; the shape is the contract):
 * {
 *   version, createdAt, lastSaved,
 *   coins, diamonds, vouchers, level, xp,
 *   farm: { objects: [{id, type, kind, x, y, ...}], unlockedZones: ['start', ...] },
 *   silo: { capacity, items: {cropId: qty} },
 *   barn: { capacity, items: {goodId: qty} },
 *   production: [{objectId, recipeId, readyAt, cid, play}], // active queue entries
 *   orders: { board: [...], truck: {...}, boat: {...} },
 *   shop: { listings: [{item, qty, price, soldAt}] },
 *   market: { dayNum, offers: [{item, qty, price}], bought: [bool...] }, // daily rotating market
 *   pets: { dog: {owned, lastFedAt}, cat: {...} },
 *   fishing: { cast: null|{readyAt} },
 *   achievements: { unlocked: [id...] },
 *   daily: { lastSpinAt, streak },
 *   event: { id, endsAt },
 *   stats: { cropsHarvested, ordersFulfilled, coinsEarned, ... }, // lifetime counters
 *   settings: { sound, autosaveInterval, assist, autoFinish },
 *
 *   // --- expansion systems ---
 *   workshop: { queue: [{recipeId, readyAt}], kits: {kitId: qty} },
 *   minigames: { results, played, best, explained },
 *     explained: set once the game has told the player that some recipes are made by hand.
 *     Deliberately NOT initialised anywhere - an absent field reads as false, which is exactly
 *     right for a save written before this existed, so it needs no SAVE_VERSION bump.
 *   neighbours: { roster: [{id, first, last, farm, level, profile}], seed },
 *   coop: { points, perksUnlocked, dailyTasks, tasksRefreshedAt, requests, ownRequestCooldownUntil },
 *   regatta: { seasonId, endsAt, board, points, rivals, league, seasonsWon, placementClaimed },
 *   expeditions: { crew, active, lastResults },
 *   museum: { artifacts: {artifactId: qty}, exhibitsCompleted, claimedRewards },  // NOT the barn
 *   lab: { built, researched: [nodeId], active: {id, readyAt}|null },
 *   helicopter: { current, fuel, fuelUpdatedAt, returningAt },
 *   islands: { voyage: {islandId, readyAt}|null, unlocked },
 *   mine: { depthUnlocked, currentDepth, digs },
 *   town: { buildings: [{id, type, ...}], population, capacity, claimedMilestones },
 *   zoo: { enclosures: {enclosureId: {...}}, lastIncomeAt, orders },
 *   merge: { cells: [{chain, tier}|{generator}|null, ...], energy, energyUpdatedAt },
 *   trains: { current: {wagons, filledAt, ...}|null, returningAt, pendingMaterials },
 *   airport: { current: {...}|null, returningAt, pendingMaterials, pendingBonus },
 *   foraging: { nodes: [{id, type, x, y, readyAt}] },
 *   newspaper: { issueId, generatedAt, listings },
 *   collections: { seen, claimed, mastery: {buildingId: {makes, star}} },
 *   decorate: { active, selection, history, historyIndex },
 *   photo: { frame, stickers },
 * }
 *
 * NOTE on materials (data.js MATERIALS): they have no dedicated bucket of their own. They
 * are goods like any other, so they live in barn.items alongside GOODS/recipe outputs —
 * barn.items is keyed by any tradeable item id, not narrowly a data.js GOODS-table id. This
 * keeps the documented shape above unchanged (no new top-level key) while giving trains,
 * the airport, mine chests and expansions somewhere real to put the materials they yield.
 */
export let state = null;

/**
 * A fresh new game starts with NEW_GAME.fields pre-placed empty field plots inside the
 * start zone, matching the actual Hay Day opening state, so there is immediately something
 * to plant on. Placed well below the fixed structures row (barn/silo/order board all sit
 * around startZone.y+0..1 per STRUCTURES) so the structures layer never collides with them.
 *
 * They are laid out as a BLOCK, not a row. Six plots in a straight line is fine on a square
 * grid and wrong on this one: the world is isometric, so a 1x6 run renders as a single long
 * diagonal strip and the soil plots merge into what reads as a wooden boardwalk laid across
 * the meadow. It is the first thing a new player sees, and it does not look like a farm. A
 * 3x2 block reads as a field patch immediately, which is what it is.
 */
function makeStartingFields() {
  const objects = [];
  const COLS = 3;
  for (let i = 0; i < NEW_GAME.fields; i++) {
    objects.push({
      id: `field_${i + 1}`,
      kind: 'field',
      type: 'field',
      x: FARM.startZone.x + 1 + (i % COLS),
      y: FARM.startZone.y + 3 + Math.floor(i / COLS),
      cropId: null,
      plantedAt: null,
      readyAt: null,
    });
  }
  return objects;
}

// Shared shape builders for merge.js / trains.js's own state slices — used by both
// newGameState() below and the v1 -> v2 migration, so the two can never drift apart.
function makeEmptyMergeBoard() {
  return {
    cells: new Array(MERGE.board.cols * MERGE.board.rows).fill(null),
    energy: MERGE.energy.max,
    energyUpdatedAt: Date.now(),
  };
}
function makeEmptyTrains() {
  return { current: null, returningAt: 0, pendingMaterials: null };
}
function makeEmptyAirport() {
  return { current: null, returningAt: 0, pendingMaterials: null, pendingBonus: 0 };
}

// Shared shape builders for town.js / zoo.js / shop.js's own state slices — mirrors each
// module's own ensureState()/ensureMarketState() default exactly, used by both
// newGameState() below and the v2 -> v3 migration, so the two can never drift apart.
function makeEmptyTown() {
  return { buildings: [], population: 0, capacity: TOWN.basePopulationCap, claimedMilestones: [] };
}
function makeEmptyZoo() {
  return { enclosures: {}, lastIncomeAt: Date.now(), orders: [] };
}
function makeEmptyMarket() {
  // Matches shop.js's own ensureMarketState() fallback shape exactly: dayNum: -1 is not a
  // real market day number (marketDayNumber() only ever returns a large non-negative
  // integer), so the very first call to ensureMarketState() sees it as stale and generates
  // that day's real offers — this is deliberately the "not yet generated" sentinel, not a
  // shortcut that skips generation.
  return { dayNum: -1, offers: [], bought: [] };
}

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
    farm: { objects: makeStartingFields(), unlockedZones: ['start'] },
    silo: { capacity: 50, items: { ...NEW_GAME.seeds } },
    barn: { capacity: 50, items: {} },
    production: [],
    orders: { board: [], truck: null, boat: null },
    shop: { listings: [] },
    market: makeEmptyMarket(),
    pets: {},
    fishing: { cast: null },
    achievements: { unlocked: [] },
    daily: { lastSpinAt: 0, streak: 0 },
    event: null,
    stats: {},
    settings: { sound: true, autosaveInterval: 10, assist: false, autoFinish: false, dayCycle: true },

    // Expansion systems. Seeded empty rather than left absent, so Phase B never has to branch
    // on whether a key exists — only on whether it holds anything yet.
    workshop: { queue: [], kits: {} },
    minigames: { results: {}, played: {}, best: {} },
    craftSeq: 0,             // monotonic source of production-entry cids (see production.js)
    neighbours: null,        // generated on first use from createdAt, then persisted forever
    coop: null,
    regatta: null,
    expeditions: { crew: [], active: [], lastResults: [] },
    museum: { artifacts: {}, exhibitsCompleted: [], claimedRewards: [] },
    lab: { built: false, researched: [], active: null },
    helicopter: { current: null, fuel: 5, fuelUpdatedAt: 0, returningAt: 0 },
    islands: { voyage: null, unlocked: [] },
    mine: { depthUnlocked: ['mine_depth_1'], currentDepth: 'mine_depth_1', digs: 0 },
    town: makeEmptyTown(),
    zoo: makeEmptyZoo(),
    merge: makeEmptyMergeBoard(),
    trains: makeEmptyTrains(),
    airport: makeEmptyAirport(),
    foraging: { nodes: [] },
    newspaper: { issueId: 0, generatedAt: 0, listings: [] },
    collections: { seen: {}, claimed: {}, mastery: {} },
    decorate: { active: false, selection: [], history: [], historyIndex: 0 },
    photo: { frame: 'frame_none', stickers: [] },
  };
}

/**
 * Migration steps, keyed by the version they upgrade FROM. Each function takes a raw parsed
 * save object at version N and returns one shaped for version N+1, never mutating in place
 * blindly since a half-applied migration is worse than none. The next key added to the
 * documented shape above bumps SAVE_VERSION again and gets its own migration added here
 * (default the new key, nothing else — every existing key on the save passes through
 * completely untouched).
 */
const MIGRATIONS = {
  // v1 -> v2: merge.js/trains.js gained their own state.merge/state.trains/state.airport
  // slices. A v1 save predates all three, so default them exactly as a fresh game would;
  // everything else on the object is left exactly as it was.
  1: (obj) => {
    if (!obj.merge) obj.merge = makeEmptyMergeBoard();
    if (!obj.trains) obj.trains = makeEmptyTrains();
    if (!obj.airport) obj.airport = makeEmptyAirport();
    return obj;
  },
  // v2 -> v3: town.js/zoo.js/shop.js gained their own state.town/state.zoo/state.market
  // slices, seeded lazily by each module's own ensureState()/ensureMarketState() rather than
  // by newGameState(). A v2 save predates all three, so default them exactly as a fresh game
  // would (and exactly as those lazy helpers already would on first use); everything else on
  // the object is left exactly as it was.
  2: (obj) => {
    if (!obj.town) obj.town = makeEmptyTown();
    if (!obj.zoo) obj.zoo = makeEmptyZoo();
    if (!obj.market) obj.market = makeEmptyMarket();
    return obj;
  },
  // v3 -> v4: playable crafts. Production entries gained a stable `cid` handle (the array
  // index is not a safe UI handle once an earlier entry is collected mid-session) and a
  // `play` record carrying the item's minigame progress. state.minigames.pending is dropped:
  // it was keyed by buildingId, which cannot address ONE queued craft, and it was transient
  // (60s) so discarding it can never lose anything durable.
  //
  // The load-bearing line is the `play` default. A craft queued under v3 was never gated, so
  // it must not become gated retroactively by the save being upgraded underneath it — it is
  // grandfathered as already-played at the floor tier rather than trapped forever.
  3: (obj) => {
    let seq = 0;
    for (const e of obj.production || []) {
      if (!e.cid) e.cid = `c${seq++}`;
      if (e.play === undefined) e.play = { seed: 0, stage: 0, scores: [], attempts: 0, done: true, tier: 0 };
    }
    if (typeof obj.craftSeq !== 'number') obj.craftSeq = seq;
    if (!obj.minigames) obj.minigames = { results: {}, played: {}, best: {} };
    else {
      delete obj.minigames.pending;
      if (!obj.minigames.results) obj.minigames.results = {};
      if (!obj.minigames.played) obj.minigames.played = {};
      if (!obj.minigames.best) obj.minigames.best = {};
    }
    if (!obj.settings) obj.settings = { sound: true, autosaveInterval: 10 };
    if (obj.settings.assist === undefined) obj.settings.assist = false;
    if (obj.settings.autoFinish === undefined) obj.settings.autoFinish = false;
    return obj;
  },
  // v4 -> v5: the day/night cycle setting. Default ON, which is the new look; a player who
  // prefers the fixed golden hour turns it off in Settings.
  4: (obj) => {
    if (!obj.settings) obj.settings = { sound: true, autosaveInterval: 10, assist: false, autoFinish: false };
    if (obj.settings.dayCycle === undefined) obj.settings.dayCycle = true;
    return obj;
  },
};

/**
 * Seed every top-level key (and every settings key) a loaded save lacks from a fresh game.
 * A v1/v2 save migrated forward still lacked workshop/expeditions/museum/lab/helicopter/
 * islands/mine/foraging/newspaper/collections/decorate/photo/fishing/achievements/daily/
 * event/shop/vouchers/pets, because the migrations only ever added the keys their own version
 * introduced - and buildWorld() then threw every frame on s.foraging.nodes. Existing keys are
 * never touched.
 */
function fillDefaults(obj) {
  const fresh = newGameState();
  for (const [key, value] of Object.entries(fresh)) {
    if (!(key in obj) || obj[key] === undefined) obj[key] = value;
  }
  if (obj.settings && typeof obj.settings === 'object') {
    for (const [key, value] of Object.entries(fresh.settings)) {
      if (obj.settings[key] === undefined) obj.settings[key] = value;
    }
  }
  return obj;
}

function migrate(obj) {
  let v = obj.version;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) break; // no known path forward, caller rejects it as invalid below
    obj = step(obj);
    v = obj.version = v + 1;
  }
  return obj;
}

/** Structural validation for a save object, rejects anything malformed or half-shaped. */
function isValidSave(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.version !== 'number') return false;
  if (typeof obj.coins !== 'number' || obj.coins < 0) return false;
  if (typeof obj.diamonds !== 'number' || obj.diamonds < 0) return false;
  if (typeof obj.level !== 'number' || obj.level < 1) return false;
  if (typeof obj.xp !== 'number' || obj.xp < 0) return false;
  if (!obj.farm || !Array.isArray(obj.farm.objects) || !Array.isArray(obj.farm.unlockedZones)) return false;
  if (!obj.silo || typeof obj.silo.capacity !== 'number' || typeof obj.silo.items !== 'object' || obj.silo.items === null) return false;
  if (!obj.barn || typeof obj.barn.capacity !== 'number' || typeof obj.barn.items !== 'object' || obj.barn.items === null) return false;
  if (!Array.isArray(obj.production)) return false;
  if (!obj.orders || typeof obj.orders !== 'object') return false;
  if (!obj.stats || typeof obj.stats !== 'object') return false;
  return true;
}

/** Load from localStorage (running migrations by version) or start a new game. Sets `state`. */
export function load() {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) { state = newGameState(); return state; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    state = newGameState(); // corrupt JSON, never half-load it
    return state;
  }

  if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') {
    state = newGameState();
    return state;
  }
  if (parsed.version > SAVE_VERSION) {
    // A save from a newer build than this one understands. Never guess at its shape.
    state = newGameState();
    return state;
  }
  if (parsed.version < SAVE_VERSION) parsed = migrate(parsed);
  if (!isValidSave(parsed) || parsed.version !== SAVE_VERSION) {
    state = newGameState();
    return state;
  }

  state = fillDefaults(parsed);
  return state;
}

/** Persist `state` to localStorage. Called by the autosave timer and on quit. */
export function save() {
  if (!state) return;
  state.lastSaved = Date.now();
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

/** Serialize the save to a JSON string for export (settings panel). */
export function exportSave() {
  if (!state) return null;
  return JSON.stringify(state);
}

/**
 * Import a save from a JSON string; validates version and shape. Returns true and applies
 * plus persists it on success; returns false and leaves the live `state` completely
 * untouched on any failure (malformed JSON, unknown future version, or a shape that fails
 * validation).
 */
export function importSave(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') return false;
  if (parsed.version > SAVE_VERSION) return false;
  if (parsed.version < SAVE_VERSION) parsed = migrate(parsed);
  if (!isValidSave(parsed) || parsed.version !== SAVE_VERSION) return false;

  state = fillDefaults(parsed);
  save();
  return true;
}

/** Wipe the save and restart (settings panel "reset game"). */
export function resetGame() {
  state = newGameState();
  save();
  return state;
}
