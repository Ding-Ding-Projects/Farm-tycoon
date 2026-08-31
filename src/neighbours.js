// neighbours.js — the one pool of simulated players (NEIGHBOURS). The game is single-player
// and offline-first, so every "other player" anywhere in it comes from here: co-op members,
// regatta crews, newspaper farms, request posters.
//
// It is deliberately ONE system. Left to themselves, coop.js, regatta.js and newspaper.js would
// each roll their own roster and the same neighbour would appear as three different people in
// three screens.
//
// Generated ONCE from state.createdAt and persisted, never re-rolled per load: a neighbour who
// helped yesterday is the same neighbour, with the same farm, in this week's regatta. Their
// activity advances on wall-clock elapsed time, not on ticks the player watched.
//
// They are never presented as real people online.
// State: state.neighbours { roster: [{ id, first, last, farm, level, profile }], seed }

import { state } from './state.js';
import { NEIGHBOURS, LEVELS } from './data.js';

// ---------------------------------------------------------------------------
// Deterministic RNG. Every simulated result in the game (roster, samples, rival scores)
// derives from state.neighbours.seed (itself derived from state.createdAt), never from
// Math.random(), so the same save produces the same "other players" every time — a reload
// mid-race must never reroll who is in it or how far ahead they are.
// ---------------------------------------------------------------------------

/** FNV-1a style 32-bit string hash. Exported for reuse by coop.js/regatta.js (same lane). */
export function _hash(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, seeded PRNG returning a fn() => [0, 1). */
export function _rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, entries) {
  const total = entries.reduce((sum, [, def]) => sum + def.weight, 0);
  let roll = rng() * total;
  for (const [key, def] of entries) {
    if (roll < def.weight) return key;
    roll -= def.weight;
  }
  return entries[entries.length - 1][0];
}

/** The roster, generating it deterministically on first call and persisting it. */
export function roster() {
  if (state.neighbours && Array.isArray(state.neighbours.roster) && state.neighbours.roster.length > 0) {
    return state.neighbours.roster;
  }

  const seed = _hash(`neighbours:${state.createdAt}`);
  const rng = _rng(seed);
  const used = new Set();
  const profileEntries = Object.entries(NEIGHBOURS.activityProfiles);
  const [bandLo, bandHi] = NEIGHBOURS.levelBand;
  const playerLevel = state.level || 1;
  const list = [];

  for (let i = 0; i < NEIGHBOURS.poolSize; i++) {
    let first;
    let last;
    let key;
    let guard = 0;
    do {
      first = NEIGHBOURS.firstNames[Math.floor(rng() * NEIGHBOURS.firstNames.length)];
      last = NEIGHBOURS.lastNames[Math.floor(rng() * NEIGHBOURS.lastNames.length)];
      key = `${first} ${last}`;
      guard++;
    } while (used.has(key) && guard < 500);
    used.add(key);

    const farm = NEIGHBOURS.farmNames[Math.floor(rng() * NEIGHBOURS.farmNames.length)];
    const profile = pickWeighted(rng, profileEntries);
    const levelOffset = bandLo + Math.floor(rng() * (bandHi - bandLo + 1));
    const level = Math.max(1, Math.min(LEVELS.maxLevel, playerLevel + levelOffset));

    list.push({ id: `nb_${i + 1}`, first, last, farm, level, profile, levelOffset });
  }

  state.neighbours = { roster: list, seed };
  return list;
}

/** One neighbour by id. */
export function get(id) {
  return roster().find((n) => n.id === id) || null;
}

/** A stable pseudo-random subset, for a co-op roster or a newspaper issue. */
export function sample(count, seedKey) {
  const list = roster();
  const n = Math.max(0, Math.min(count, list.length));
  if (n === 0) return [];
  const pool = list.slice();
  const rng = _rng(_hash(`${state.neighbours.seed}:${seedKey}`));
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// Points earned per hour of elapsed wall-clock time by a "steady" (scoreMult 1.0) neighbour.
// Casual/devoted scale off this by their own scoreMult; a per-neighbour jitter (stable, derived
// from the neighbour's own id) keeps a whole roster from ticking in perfect lockstep.
const POINTS_PER_HOUR_BASE = 40;

/** Simulated progress for a neighbour over an elapsed period, from their activity profile. */
export function simulate(id, elapsedSeconds) {
  const nb = get(id);
  if (!nb || !(elapsedSeconds > 0)) return { points: 0, profile: nb ? nb.profile : null };

  const profile = NEIGHBOURS.activityProfiles[nb.profile] || NEIGHBOURS.activityProfiles.steady;
  const jitter = 0.85 + _rng(_hash(`${state.neighbours.seed}:jitter:${id}`))() * 0.3; // stable per neighbour, [0.85, 1.15)
  const hours = elapsedSeconds / 3600;
  const points = Math.round(hours * POINTS_PER_HOUR_BASE * profile.scoreMult * jitter);
  return { points, profile: nb.profile };
}

/** Re-level the roster against the player so rivals stay inside NEIGHBOURS.levelBand. */
export function rebalance(playerLevel) {
  const list = roster();
  for (const nb of list) {
    nb.level = Math.max(1, Math.min(LEVELS.maxLevel, playerLevel + nb.levelOffset));
  }
  return list;
}
