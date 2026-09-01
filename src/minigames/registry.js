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
  cast_ingot: () => import('./verbs/cast_ingot.js'),
  throw_shuttles: () => import('./verbs/throw_shuttles.js'),
  guide_dough: () => import('./verbs/guide_dough.js'),
  lay_slices: () => import('./verbs/lay_slices.js'),
  stack_layers: () => import('./verbs/stack_layers.js'),
  fold_shell: () => import('./verbs/fold_shell.js'),
  pin_brim: () => import('./verbs/pin_brim.js'),
  roll_press: () => import('./verbs/roll_press.js'),
  boil_size: () => import('./verbs/boil_size.js'),
  dip_wick: () => import('./verbs/dip_wick.js'),
  set_stone: () => import('./verbs/set_stone.js'),
  blend_notes: () => import('./verbs/blend_notes.js'),
  split_press: () => import('./verbs/split_press.js'),
  draw_steam: () => import('./verbs/draw_steam.js'),
  skim_curds: () => import('./verbs/skim_curds.js'),
};

/** Load one verb module by id, or null if it is not registered. */
export async function loadVerb(verbId) {
  const loader = VERB_LOADERS[verbId];
  if (!loader) return null;
  const mod = await loader();
  return mod && mod.id === verbId ? mod : null;
}
