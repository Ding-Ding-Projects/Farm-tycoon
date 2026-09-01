// islands.js — island voyages (ISLANDS, L36). Split out of boat.js, which keeps crates and
// vouchers: with expeditions.js now in the codebase, "the boat module also does voyages" was a
// confusion waiting to be had, and the two systems have nothing in common but water.
// State: state.islands { voyage: { islandId, readyAt } | null, unlocked: [islandId] }

import { state } from './state.js';
import { ISLANDS } from './data.js';
import * as economy from './economy.js';
import * as storage from './storage.js';

function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function randomQty(qty) { return Array.isArray(qty) ? randomInt(qty[0], qty[1]) : qty; }

// state.js already documents state.islands in the shape comment (`islands: { voyage:
// {islandId, readyAt}|null, unlocked }`) and newGameState() seeds `{ voyage: null, unlocked:
// [] }`, so unlike town/trains/zoo this key already exists — but defend anyway in case a
// save predates it or state.js's seed changes shape.
function ensureState() {
  if (!state.islands) state.islands = { voyage: null, unlocked: [] };
  if (!Array.isArray(state.islands.unlocked)) state.islands.unlocked = [];
  return state.islands;
}

/** Destinations unlocked at the player's level. */
export function destinations() {
  ensureState();
  return Object.entries(ISLANDS.destinations)
    .filter(([, def]) => state.level >= def.unlockLevel)
    .map(([id, def]) => ({ id, ...def }));
}

/** Whether a voyage can start - island unlocked and no voyage already at sea. */
export function canSail(islandId) {
  const s = ensureState();
  const def = ISLANDS.destinations[islandId];
  if (!def) return false;
  if (state.level < ISLANDS.unlockLevel) return false;
  if (state.level < def.unlockLevel) return false;
  if (s.voyage) return false; // one voyage at a time
  return true;
}

/** Send the boat. One voyage at a time. */
export function sail(islandId) {
  const s = ensureState();
  if (!canSail(islandId)) return false;
  const def = ISLANDS.destinations[islandId];
  s.voyage = { islandId, readyAt: Date.now() + def.tripTime * 1000 };
  if (!s.unlocked.includes(islandId)) s.unlocked.push(islandId);
  return true;
}

/** Cargo waiting to be collected, or null if the boat is still out. Rolled once and cached
 * on the voyage the first time it is asked for, so repeated calls (including the one collect()
 * makes internally) never re-roll different quantities out from under the caller. */
export function pendingCargo() {
  const s = ensureState();
  if (!s.voyage) return null;
  if (Date.now() < s.voyage.readyAt) return null;
  if (!s.voyage.cargo) {
    const def = ISLANDS.destinations[s.voyage.islandId];
    if (!def) return null;
    const cargo = {};
    for (const [goodId, qty] of Object.entries(def.cargo)) {
      cargo[goodId] = randomQty(qty);
    }
    s.voyage.cargo = cargo;
  }
  return s.voyage.cargo;
}

function barnRoom() { return storage.room('barn'); }

/** Collect the cargo into the barn. */
export function collect() {
  const s = ensureState();
  const cargo = pendingCargo();
  if (!cargo) return false;
  const totalQty = Object.values(cargo).reduce((a, b) => a + b, 0);
  if (totalQty > barnRoom()) return false; // never lose cargo to an over-full barn — try later

  for (const [goodId, qty] of Object.entries(cargo)) {
    state.barn.items[goodId] = (state.barn.items[goodId] || 0) + qty;
  }
  economy.trackStat('voyagesCompleted', 1);
  s.voyage = null;
  return true;
}

/** Advance the voyage timer; called from the game loop. */
export function tick(now = Date.now()) {
  // Timers are absolute wall-clock readyAt values; nothing to advance here beyond letting
  // pendingCargo()/collect() compare against `now` themselves once readyAt has passed —
  // arbitrary elapsed (including days offline) resolves correctly with no extra bookkeeping.
  void now;
}
