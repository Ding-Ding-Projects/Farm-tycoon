// minigames.js — per-factory minigames. Every production building has exactly one, and each
// does something only that factory would plausibly do (MINIGAMES in data.js): the bakery
// kneads dough for extra yield, the smelter works the bellows for purity, the workshop lines
// up a frame to save material. Not one minigame reskinned sixteen times.
//
// They are an OPTIONAL BONUS LAYER, and that is load-bearing rather than a nicety: production
// runs to completion whether or not the player ever opens one. Gating a recipe behind hand-eye
// skill would break the idle contract and punish offline play, which the absolute-readyAt
// timestamp model exists to protect. A player who never touches a minigame is playing the
// game correctly, just without the bonus.
//
// Each result contributes one EFFECT_KEYS entry, the same closed set the Laboratory and
// building Mastery use, so every multiplier in the game merges through one code path.
// MINIGAMES[id].cap bounds a perfect run, so no bonus is farmable without limit.
//
// State: state.minigames { pending: { buildingId: { gameId, seed, expiresAt } },
//                          results: { buildingId: { effect, amount, appliedAt } },
//                          played: { gameId: count } }

import { state } from './state.js';
import { BUILDINGS, MINIGAMES } from './data.js';

const RUN_WINDOW_MS = 60 * 1000; // a minigame stays valid for a minute before it expires
const ROUND_LENGTH = 8; // fixed-length seeded event sequence every minigame's board is built from

function findBuilding(buildingId) {
  return state.farm.objects.find((o) => o.id === buildingId && o.kind === 'building') || null;
}

/** The minigame for a building, or null if it has none. */
export function forBuilding(buildingId) {
  const building = findBuilding(buildingId);
  if (!building) return null;
  const def = BUILDINGS[building.type];
  const gameId = def && def.minigame;
  if (!gameId) return null;
  const game = MINIGAMES[gameId];
  return game ? { id: gameId, ...game } : null;
}

/** True when this building has a queued batch a minigame could still improve. */
export function isAvailable(buildingId, now = Date.now()) {
  if (!forBuilding(buildingId)) return false;
  return state.production.some((p) => p.objectId === buildingId && p.readyAt > now);
}

// -----------------------------------------------------------------------------------------
// Deterministic seeded round generation. mulberry32 is a tiny, well-known PRNG: given the
// same 32-bit seed it produces the exact same stream of floats every time, on every
// platform, with no dependency on Math.random. The round layout is a PURE function of the
// seed, so start()ing a run and later regenerating its board from the stored seed (a
// refresh, a replay, a reconnect) can never land on an easier round than the first roll did.
// -----------------------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the deterministic event sequence for a round from its seed alone. */
function roundFromSeed(seed) {
  const rng = mulberry32(seed);
  const events = [];
  for (let i = 0; i < ROUND_LENGTH; i++) {
    events.push({ t: Math.round(rng() * 1000) / 1000, target: Math.round(rng() * 1000) / 1000 });
  }
  return events;
}

/**
 * Begin a run. Returns a seeded, deterministic setup so the same seed always produces the
 * same board — a replayed seed must not reroll into an easier round.
 */
export function start(buildingId, now = Date.now()) {
  const game = forBuilding(buildingId);
  if (!game) return null;
  if (!isAvailable(buildingId, now)) return null;

  // The seed itself may draw from wall-clock time and building identity (picking WHICH
  // round is offered is allowed to vary); what must never vary is the mapping from a given
  // seed to its round, which roundFromSeed() guarantees by taking no other input.
  const seed = (now ^ hashString(buildingId) ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
  const expiresAt = now + RUN_WINDOW_MS;
  state.minigames.pending[buildingId] = { gameId: game.id, seed, expiresAt };

  return { gameId: game.id, seed, expiresAt, effect: game.effect, cap: game.cap, round: roundFromSeed(seed) };
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Finish a run with a 0..1 score. Returns { effect, amount } where amount is
 * score * MINIGAMES[gameId].cap, never more. Scores outside 0..1 are clamped rather than
 * trusted: the caller is UI code and a bad score must not become a bad bonus.
 */
export function finish(buildingId, score) {
  const pending = state.minigames.pending[buildingId];
  if (!pending) return null;
  const game = MINIGAMES[pending.gameId];
  if (!game) { delete state.minigames.pending[buildingId]; return null; }

  const clamped = Math.max(0, Math.min(1, typeof score === 'number' && !Number.isNaN(score) ? score : 0));
  const amount = clamped * game.cap;

  delete state.minigames.pending[buildingId];
  state.minigames.results[buildingId] = { effect: game.effect, amount, appliedAt: Date.now() };
  state.minigames.played[pending.gameId] = (state.minigames.played[pending.gameId] || 0) + 1;

  return { effect: game.effect, amount };
}

/** Abandon a run without penalty. Skipping a minigame is always free. */
export function cancel(buildingId) {
  if (!(buildingId in state.minigames.pending)) return false;
  delete state.minigames.pending[buildingId];
  return true;
}

/**
 * The pending bonus for a building, consumed when its batch is collected. Returns a zeroed
 * effect rather than null when nothing is pending, so callers never branch on absence.
 */
export function pendingBonus(buildingId) {
  const result = state.minigames.results[buildingId];
  if (!result) return { effect: null, amount: 0 };
  delete state.minigames.results[buildingId]; // consumed — collecting the batch spends it once
  return { effect: result.effect, amount: result.amount };
}

/** Expire stale runs; called from the game loop. */
export function tick(now = Date.now()) {
  const expired = [];
  for (const [buildingId, pending] of Object.entries(state.minigames.pending)) {
    if (pending.expiresAt <= now) {
      delete state.minigames.pending[buildingId];
      expired.push(buildingId);
    }
  }
  return expired;
}
