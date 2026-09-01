// minigames.js — the rules ledger for playable crafts. DOM-free on purpose: everything here is
// drivable under Node, which is what lets tools/test-playables.mjs prove the gate can never
// trap a craft without a browser in the loop.
//
// TWO SEPARATE REWARD CHANNELS, deliberately not merged:
//
//   1. Per-CRAFT quality — a playable recipe carries a `play` chain (data.js). Playing it
//      through resolves a tier, which becomes yield / XP / a coin tip inside
//      production.collectBuilding. One-shot, never stored per-unit.
//   2. Per-BUILDING factory bonus — the unchanged MINIGAMES table, one entry per building with
//      a unique EFFECT_KEYS effect. Awarded when a craft lands at Masterpiece, and merged
//      through economy.registerMultiplierEffect exactly the way lab.js and mastery already do,
//      so every multiplier in the game still meets at ONE point.
//
// NOTE ON THE GATE. A playable item can only be obtained by playing its game. That is a
// deliberate product decision and it reverses this module's original contract, so the old
// "optional bonus layer, never a gate" comment has been removed rather than left to contradict
// the code. What protects the player instead:
//   - a run NEVER expires (there is no run window and no tick sweep — a phone call mid-bake
//     must not destroy a craft);
//   - a game can be scored badly but never FAILED — every verb completes at some score;
//   - an unplayed craft never blocks a collectable one queued behind it (production.js);
//   - four whole recipe classes are forbidden from being playable (kits, workshop components,
//     animal feed, and any building's introductory recipe) so progression cannot deadlock.
//
// State: state.minigames { results: { buildingId: {effect, amount, appliedAt} },
//                          played:  { recipeId: count },
//                          best:    { recipeId: tierIndex } }
// A craft's in-progress record lives on the production entry itself (entry.play), not here —
// a side table keyed by buildingId cannot address ONE queued craft.

import { state } from './state.js';
import { BUILDINGS, MINIGAMES, QUALITY } from './data.js';
import * as economy from './economy.js';
import { aggregate, tierIndexFor } from './minigames/quality.js';

function findBuilding(buildingId) {
  return state.farm.objects.find((o) => o.id === buildingId && o.kind === 'building') || null;
}

/** The building-level factory bonus for a building, or null if it has none. */
export function forBuilding(buildingId) {
  const building = findBuilding(buildingId);
  if (!building) return null;
  const def = BUILDINGS[building.type];
  const gameId = def && def.minigame;
  if (!gameId) return null;
  const game = MINIGAMES[gameId];
  return game ? { id: gameId, ...game } : null;
}

/** The recipe behind a queue entry, or null. */
export function recipeFor(entry) {
  if (!entry) return null;
  const building = findBuilding(entry.objectId);
  const def = building && BUILDINGS[building.type];
  return (def && def.recipes.find((r) => r.id === entry.recipeId)) || null;
}

/** A queue entry by its stable cid. */
export function craftByCid(cid) {
  return state.production.find((p) => p.cid === cid) || null;
}

/** The stage chain for a playable entry — [] for a plain one. */
export function chainFor(entry) {
  const recipe = recipeFor(entry);
  return (recipe && recipe.play && recipe.play.stages) || [];
}

/** True once the prep timer is done but the game has not been played through. */
export function needsPlay(entry, now = Date.now()) {
  return !!entry && !!entry.play && !entry.play.done && entry.readyAt <= now;
}

// ------------------------------------------------------------------------------------------
// Determinism. mulberry32 is a tiny well-known PRNG: the same 32-bit seed yields the same
// float stream everywhere, with no dependency on Math.random. A stage's seed is DERIVED from
// the craft seed and the stage index rather than stored, so re-entering a stage after
// abandoning regenerates the identical board — a replayed stage can never reroll into an
// easier one, which is what stops "abandon until the board is kind" being a strategy.
// ------------------------------------------------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed for stage `i` of a craft — a pure function of (craft seed, index). */
export function stageSeed(entry, i) {
  const base = (entry && entry.play && entry.play.seed) >>> 0;
  let h = (base ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Commit one stage's score and advance. ATOMIC on purpose: the score is written and the stage
 * index incremented before any result screen renders, so the only way to retry a stage is to
 * abandon it MID-run — which returns the same derived seed and loses the partial attempt. The
 * reroll exploit is closed by construction, with no penalty mechanic needed.
 *
 * Returns { stage, of, done, quality, tier } describing the state after the commit.
 */
export function commitStage(entry, score) {
  if (!entry || !entry.play || entry.play.done) return null;
  const stages = chainFor(entry);
  if (stages.length === 0) return null;

  const clamped = typeof score === 'number' && !Number.isNaN(score)
    ? Math.max(0, Math.min(1, score)) : 0;
  entry.play.scores.push(clamped);
  entry.play.stage = entry.play.scores.length;

  if (entry.play.stage >= stages.length) return finalize(entry);
  return { stage: entry.play.stage, of: stages.length, done: false, quality: null, tier: null };
}

/**
 * Close a finished chain: resolve quality, stamp the tier, and — at Masterpiece only — award
 * the building's factory bonus. Marking `done` is what makes the craft collectable; the item
 * itself is NOT delivered here, so a full barn defers collection rather than destroying a run
 * the player already played.
 */
export function finalize(entry) {
  const stages = chainFor(entry);
  const quality = aggregate(entry.play.scores, stages);
  const tierIndex = tierIndexFor(quality);
  const tier = QUALITY.tiers[tierIndex];

  entry.play.done = true;
  entry.play.tier = tierIndex;

  state.minigames.played[entry.recipeId] = (state.minigames.played[entry.recipeId] || 0) + 1;
  const prevBest = state.minigames.best[entry.recipeId];
  if (prevBest === undefined || tierIndex > prevBest) state.minigames.best[entry.recipeId] = tierIndex;

  if (tier && tier.grantsEffect) {
    const game = forBuilding(entry.objectId);
    if (game) {
      state.minigames.results[entry.objectId] =
        { effect: game.effect, amount: game.cap * quality, appliedAt: Date.now() };
    }
  }

  return { stage: entry.play.stage, of: stages.length, done: true, quality, tier: tier ? tier.id : null };
}

/** Abandon a stage in progress. Committed stages survive; nothing is lost but the partial run. */
export function abandon(entry) {
  if (!entry || !entry.play || entry.play.done) return false;
  entry.play.attempts = (entry.play.attempts || 0) + 1;
  return true;
}

/**
 * Finish a craft at the floor tier without playing it. This is the ONE softening of the gate,
 * and it exists for two cases that would otherwise be hard blocks rather than as a shortcut:
 * a verb module that fails to load, and a player who cannot complete a stage even with Assist
 * mode on (opt-in via settings.autoFinish). Score 0 throughout: Plain tier, no XP bonus, no
 * tip, no factory effect — strictly the worst outcome available.
 */
export function finishPlain(entry) {
  if (!entry || !entry.play || entry.play.done) return null;
  const stages = chainFor(entry);
  while (entry.play.scores.length < Math.max(1, stages.length)) entry.play.scores.push(0);
  entry.play.stage = entry.play.scores.length;
  return finalize(entry);
}

/**
 * The pending factory bonus for a building, consumed on read. Returns a zeroed effect rather
 * than null when nothing is pending, so callers never have to branch on absence.
 */
export function pendingBonus(buildingId) {
  const result = state.minigames.results[buildingId];
  if (!result) return { effect: null, amount: 0 };
  delete state.minigames.results[buildingId];
  return { effect: result.effect, amount: result.amount };
}

// Wire into economy's single merge point, mirroring lab.js:181 — so a factory bonus, a lab node
// and building mastery all reach economy.combinedMultiplier through one path rather than three.
// Effects are read without consuming: pendingBonus() is the consuming path, used at collect.
economy.registerMultiplierEffect((kind, id) => {
  if (!kind || !kind.endsWith('Mult')) return 1;
  const result = id ? state.minigames.results[id] : null;
  if (!result || result.effect !== kind) return 1;
  return 1 + result.amount;
});
