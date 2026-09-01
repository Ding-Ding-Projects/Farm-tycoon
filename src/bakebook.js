// bakebook.js — the Bake Book: every playable recipe, and the best you have ever done on it.
//
// The last unbuilt piece of the playable-item system. Everything it reads already existed and was
// already being written: minigames.js has recorded a best tier per recipe in state.minigames.best
// since the gate shipped, and ui.js shows it on the card you queue from. What was missing was
// anywhere to see the whole set at once, which is the difference between a number on a card and a
// thing a player can set out to finish.
//
// DERIVED, never hand-listed. The book is built from the recipes that carry a `play` chain, the
// same way collections.js derives its books from the live tables, so a new playable recipe joins
// the book the moment it lands in data.js and no page can drift out of date. A hand-written list
// here would be a second place to forget.
//
// This module is DOM-free on purpose. ui.js renders it, tools/ can test it under Node, and the
// two cannot disagree about what "mastered" means because only one of them decides.
//
// State: read-only over state.minigames.best { recipeId: tierIndex }. Nothing here writes; the
// write lives in minigames.js's finalize() where the score is actually known.

import { state } from './state.js';
import { BUILDINGS, VERBS, QUALITY } from './data.js';

/** The tier index that counts as fully mastered - the last one in the table, whatever it is called. */
export const MASTER_INDEX = QUALITY.tiers.length - 1;

/**
 * Every playable recipe in the game, with the building it belongs to, the verbs it is played
 * with, and the best tier the player has reached on it.
 *
 * Sorted by building unlock level then recipe unlock level, so the book reads in the order a
 * player actually meets it rather than in object-key order, which is an implementation detail.
 */
export function entries() {
  const out = [];
  for (const [buildingId, building] of Object.entries(BUILDINGS || {})) {
    for (const recipe of building.recipes || []) {
      if (!recipe.play || !recipe.play.stages) continue;
      const stages = recipe.play.stages.map((s) => {
        const verb = VERBS[s.verb] || null;
        return {
          verb: s.verb,
          name: verb ? verb.name : s.verb,
          family: verb ? verb.family : null,
          weight: s.weight || 1,
        };
      });
      const bestIndex = state?.minigames?.best?.[recipe.id];
      out.push({
        recipeId: recipe.id,
        buildingId,
        buildingName: building.name,
        buildingLevel: building.unlockLevel || 0,
        unlockLevel: recipe.unlockLevel || 0,
        stages,
        // undefined rather than 0: never played and played badly are different facts, and a book
        // that renders them the same tells the player they failed at something they never tried.
        bestIndex: typeof bestIndex === 'number' ? bestIndex : undefined,
        bestTier: typeof bestIndex === 'number' ? (QUALITY.tiers[bestIndex] || null) : null,
        mastered: bestIndex === MASTER_INDEX,
      });
    }
  }
  out.sort((a, b) => (a.buildingLevel - b.buildingLevel)
    || (a.unlockLevel - b.unlockLevel)
    || a.recipeId.localeCompare(b.recipeId));
  return out;
}

/** The book grouped by building, in the same order, for a rendering that reads as chapters. */
export function byBuilding() {
  const groups = new Map();
  for (const e of entries()) {
    if (!groups.has(e.buildingId)) {
      groups.set(e.buildingId, { buildingId: e.buildingId, name: e.buildingName, level: e.buildingLevel, recipes: [] });
    }
    groups.get(e.buildingId).recipes.push(e);
  }
  return [...groups.values()];
}

/**
 * How the book stands. `perTier` counts only recipes actually played, so the tiers sum to
 * `played` rather than to `total` - the unplayed ones are their own number and are not quietly
 * folded into the bottom tier.
 */
export function summary() {
  const all = entries();
  const perTier = QUALITY.tiers.map((t) => ({ id: t.id, label: t.label || t.id, count: 0 }));
  let played = 0;
  let mastered = 0;
  for (const e of all) {
    if (e.bestIndex === undefined) continue;
    played += 1;
    if (perTier[e.bestIndex]) perTier[e.bestIndex].count += 1;
    if (e.mastered) mastered += 1;
  }
  return {
    total: all.length,
    played,
    unplayed: all.length - played,
    mastered,
    perTier,
    // Whole-book completion, which is what a "book" implies: every playable recipe at the top
    // tier. Deliberately strict - a book that says 100% while something is unplayed is lying.
    complete: all.length > 0 && mastered === all.length,
  };
}

/**
 * Which verbs the player is worst at, most-missing first.
 *
 * This is the reason the book is worth having rather than a list. Quality is per RECIPE, but skill
 * is per VERB, so a player stuck at Plain on four different recipes usually has one verb they have
 * not got the hang of - and that is invisible on any single recipe card. Recipes never played are
 * excluded: not having tried something is not the same as being bad at it.
 */
export function verbStanding() {
  const byVerb = new Map();
  for (const e of entries()) {
    for (const s of e.stages) {
      if (!byVerb.has(s.verb)) byVerb.set(s.verb, { verb: s.verb, name: s.name, family: s.family, played: 0, mastered: 0, recipes: 0 });
      const v = byVerb.get(s.verb);
      v.recipes += 1;
      if (e.bestIndex === undefined) continue;
      v.played += 1;
      if (e.mastered) v.mastered += 1;
    }
  }
  return [...byVerb.values()].sort((a, b) => {
    const ar = a.played ? a.mastered / a.played : 1;
    const br = b.played ? b.mastered / b.played : 1;
    return ar - br || a.name.localeCompare(b.name);
  });
}
