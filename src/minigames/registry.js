// registry.js — one lazy loader per verb.
//
// Nothing in the game imports a verb eagerly. main.js does not import this tree at all; ui.js
// pulls in the shell only when a player actually opens a playable craft, and the shell pulls in
// the single verb it needs. Boot cost therefore stays exactly zero however many verbs exist,
// with no bundler and no build step — native dynamic import does the work.
//
// The map is deliberately a bare literal of arrow functions rather than anything computed: a
// dynamic specifier built from a variable cannot be statically checked, and the validator's
// job is to await every one of these so a typo'd path fails npm test rather than a player's cake.

export const VERB_LOADERS = {
  press_cutter: () => import('./verbs/press_cutter.js'),
  whisk_batter: () => import('./verbs/whisk_batter.js'),
  pour_tin: () => import('./verbs/pour_tin.js'),
  mind_oven: () => import('./verbs/mind_oven.js'),
  pipe_frosting: () => import('./verbs/pipe_frosting.js'),
  place_decor: () => import('./verbs/place_decor.js'),
  swirl_cone: () => import('./verbs/swirl_cone.js'),
  tie_bouquet: () => import('./verbs/tie_bouquet.js'),
  sort_chillies: () => import('./verbs/sort_chillies.js'),
  season_pinch: () => import('./verbs/season_pinch.js'),
};

/** Load one verb module by id, or null if it is not registered. */
export async function loadVerb(verbId) {
  const loader = VERB_LOADERS[verbId];
  if (!loader) return null;
  const mod = await loader();
  return mod && mod.id === verbId ? mod : null;
}
