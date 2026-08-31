// merge.js — Merge Meadow: the Township-style merge minigame (L11).
// Own 7×9 board in a full-screen sheet panel; drag-merge two identical items into the
// next tier of their chain (MERGE.chains). Generators spawn tier-1 items for energy;
// energy regenerates on wall-clock time (persists offline like all timers).
// Rewards (coins/diamonds/vouchers/tools) pay into the main farm economy.
//
// Board state in state.merge: { cells: [{chain, tier} | {generator} | null] * cols*rows,
//   energy, energyUpdatedAt }
//
// state.js does not (yet) predeclare a `merge` key — every function here lazily creates it
// on first touch, matching the documented shape exactly, so a fresh or old save that never
// visited Merge Meadow gets one the moment it does rather than crashing on a missing key.

import { state } from './state.js';
import { MERGE } from './data.js';
import * as economy from './economy.js';

const COLS = MERGE.board.cols;
const ROWS = MERGE.board.rows;
const CELL_COUNT = COLS * ROWS;

function barnRoom() {
  const used = Object.values(state.barn.items).reduce((a, b) => a + b, 0);
  return Math.max(0, state.barn.capacity - used);
}

function ensureMergeState() {
  if (!state.merge) {
    state.merge = { cells: new Array(CELL_COUNT).fill(null), energy: MERGE.energy.max, energyUpdatedAt: Date.now() };
  }
  return state.merge;
}

function inBounds(i) {
  return Number.isInteger(i) && i >= 0 && i < CELL_COUNT;
}

function freeCellIndexes(m) {
  const out = [];
  for (let i = 0; i < CELL_COUNT; i++) if (m.cells[i] === null) out.push(i);
  return out;
}

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Ensure the board exists (first open): place starting generators + a few tier-1 items. */
export function initBoard() {
  const m = ensureMergeState();
  if (m.cells.some((c) => c !== null)) return m; // already initialised — idempotent

  const generatorIds = Object.keys(MERGE.generators);
  // Spread the starting generators evenly along the top row, spaced apart so their spawn
  // batches have somewhere free to land.
  generatorIds.forEach((genId, idx) => {
    const cellIndex = idx * Math.floor(COLS / generatorIds.length);
    if (inBounds(cellIndex)) m.cells[cellIndex] = { generator: genId };
  });

  // A handful of starting tier-1 items so the board isn't a totally blank slate on first
  // open — one from the first chain, placed on a free cell.
  const chainIds = Object.keys(MERGE.chains);
  const starterFree = freeCellIndexes(m);
  for (let i = 0; i < Math.min(3, starterFree.length); i++) {
    const chainId = chainIds[i % chainIds.length];
    m.cells[starterFree[i]] = { chain: chainId, tier: 0 };
  }

  return m;
}

/** Current energy, applying regen since energyUpdatedAt (never exceeds max). */
export function currentEnergy(now = Date.now()) {
  const m = ensureMergeState();
  const max = MERGE.energy.max;
  if (m.energy >= max) {
    m.energy = max;
    m.energyUpdatedAt = now;
    return m.energy;
  }
  const intervalMs = MERGE.energy.regenSeconds * 1000;
  const elapsed = Math.max(0, now - m.energyUpdatedAt);
  const gained = Math.floor(elapsed / intervalMs);
  if (gained > 0) {
    m.energy = Math.min(max, m.energy + gained);
    // Advance the clock only by the whole intervals actually consumed, so a partial
    // interval isn't discarded — it carries into the next call, exactly like every other
    // absolute-readyAt timer in this game.
    m.energyUpdatedAt += gained * intervalMs;
    if (m.energy >= max) m.energyUpdatedAt = now;
  }
  return m.energy;
}

/** Tap a generator: spend energy, spawn spawnBatch tier-1 items into free cells. */
export function spawnFrom(cellIndex) {
  const m = ensureMergeState();
  if (!inBounds(cellIndex)) return false;
  const cell = m.cells[cellIndex];
  if (!cell || !cell.generator) return false;
  const gen = MERGE.generators[cell.generator];
  if (!gen) return false;

  const now = Date.now();
  const cost = MERGE.energy.costPerSpawn;
  if (currentEnergy(now) < cost) return false;

  const free = freeCellIndexes(m);
  if (free.length === 0) return false; // board full — nothing to spawn into, nothing spent

  m.energy -= cost;

  const [lo, hi] = gen.spawnBatch;
  const count = Math.min(randInt(lo, hi), free.length);
  const placed = [];
  for (let i = 0; i < count; i++) {
    const idx = free[i];
    m.cells[idx] = { chain: gen.chain, tier: 0 };
    placed.push(idx);
  }
  return placed;
}

/** Can cells a and b merge (same chain + tier, not top tier)? */
export function canMerge(a, b) {
  const m = ensureMergeState();
  if (!inBounds(a) || !inBounds(b) || a === b) return false;
  const ca = m.cells[a];
  const cb = m.cells[b];
  if (!ca || !cb || !ca.chain || !cb.chain) return false;
  if (ca.chain !== cb.chain || ca.tier !== cb.tier) return false;
  const chain = MERGE.chains[ca.chain];
  if (!chain) return false;
  return ca.tier < chain.tiers.length - 1;
}

function rollMergeBonus() {
  const bonus = MERGE.mergeBonus;
  if (!bonus || Math.random() >= bonus.chance) return null;
  const pool = bonus.loot;
  const total = pool.reduce((sum, e) => sum + (e.weight || 0), 0);
  if (!(total > 0)) return null;
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight || 0;
    if (roll < 0) return entry;
  }
  return pool[pool.length - 1];
}

function applyMergeBonus() {
  const entry = rollMergeBonus();
  if (!entry) return null;
  if (Array.isArray(entry.coins)) {
    const amount = randInt(entry.coins[0], entry.coins[1]);
    economy.addCoins(amount);
    return { coins: amount };
  }
  if (Array.isArray(entry.energy)) {
    const m = ensureMergeState();
    const amount = randInt(entry.energy[0], entry.energy[1]);
    m.energy = Math.min(MERGE.energy.max, m.energy + amount);
    return { energy: amount };
  }
  return null;
}

/** Merge item at `from` onto `to`: next-tier item at `to`, rolls MERGE.mergeBonus. */
export function merge(from, to) {
  if (!canMerge(from, to)) return false;
  const m = state.merge;
  const cell = m.cells[to];
  m.cells[to] = { chain: cell.chain, tier: cell.tier + 1 };
  m.cells[from] = null;
  const bonus = applyMergeBonus();
  return { tier: m.cells[to].tier, bonus };
}

/** Move an item to a free cell (plain drag). */
export function moveItem(from, to) {
  const m = ensureMergeState();
  if (!inBounds(from) || !inBounds(to) || from === to) return false;
  if (m.cells[from] === null) return false;
  if (m.cells[to] !== null) return false;
  m.cells[to] = m.cells[from];
  m.cells[from] = null;
  return true;
}

/** Reward definition for a cell (from chain claims/topReward), or null if not claimable. */
export function claimableReward(cellIndex) {
  const m = ensureMergeState();
  if (!inBounds(cellIndex)) return null;
  const cell = m.cells[cellIndex];
  if (!cell || !cell.chain) return null;
  const chain = MERGE.chains[cell.chain];
  if (!chain) return null;
  if (cell.tier === chain.tiers.length - 1) return chain.topReward || null;
  return (chain.claims && chain.claims[cell.tier]) || null;
}

/** Claim a claimable/top-tier item: removes it, pays its reward into the farm economy. */
export function claim(cellIndex) {
  const reward = claimableReward(cellIndex);
  if (!reward) return false;
  const m = state.merge;

  if (reward.coins) economy.addCoins(reward.coins);
  if (reward.diamonds) state.diamonds += reward.diamonds;
  if (reward.vouchers) state.vouchers += reward.vouchers;
  if (reward.item) {
    const given = Math.min(reward.qty || 1, barnRoom());
    if (given > 0) state.barn.items[reward.item] = (state.barn.items[reward.item] || 0) + given;
  }

  m.cells[cellIndex] = null;
  return { reward };
}
