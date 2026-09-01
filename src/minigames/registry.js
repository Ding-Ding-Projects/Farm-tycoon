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
//
// ---------------------------------------------------------------------------------------
// Verbs that were designed, measured and then CUT. Recorded so nobody rebuilds them.
//
//   test_set   - a testing step where guessing at 62% consistently beat actually testing, so the
//                best strategy was to ignore the mechanic. Four attempts.
//
//   steady_spindle - a milkshake tin balanced on a spinning spindle, an inverted pendulum. The
//                intended skill was anticipation: correct on which way it is MOVING, not only on
//                where it is, because shoving against the lean was supposed to add momentum you
//                then had to cancel. Measured, that is simply false. Sweeping the reactive gain
//                from 1 to 20 showed gains of 6 and above scoring a flat 1.000, because the input
//                saturates at plus or minus one and a high-gain proportional controller therefore
//                degenerates into bang-bang control, which stabilises an inverted pendulum
//                perfectly well. Reaction beats the verb's own premise.
//
//                Removing the drag term and adding a driven wobble did not save it; those made
//                low gains worse without making high gains fail. The fix that would work is input
//                lag, which is exactly the distinction jar_fill already owns, so there is nothing
//                left here that is not already a verb.
//
//   work_rush  - a hot dog stand lunch rush: more orders come good than you can plate, and the
//                intended skill was choosing what to sacrifice. Five attempts, all failed, and
//                the reason is worth keeping because it is a general trap rather than a tuning
//                miss: WITH UNIFORM ITEM VALUE AND A HARD LIMIT ON ACTIONS, TRIAGE IS
//                MATHEMATICALLY IRRELEVANT. Serving any N items scores identically, so the order
//                cannot matter however tight the windows are. Tightening windows, clustering
//                arrivals, correlating urgency with arrival time and finally giving orders
//                different values all failed to make earliest-deadline reliably beat plain
//                first-come-first-served; on several seeds the naive policy actually won.
//
//                Also recorded: the first comparison was against a STRAWMAN. The "first come,
//                first served" driver picked the largest msLeft, which is "most slack left", not
//                "waited longest". With uneven windows those are different policies, and the
//                apparent win vanished once the model published a real waitedMs and the true
//                policy was measured. Check what your losing driver is actually doing before
//                believing the gap.
//
//                A rush verb can still work, but it needs the loss to depend on the ORDER rather
//                than on the count: interacting orders, a shared resource, or a penalty that
//                compounds. Uneven prices alone are not enough.
// ---------------------------------------------------------------------------------------

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
  pull_shot: () => import('./verbs/pull_shot.js'),
  toss_bowl: () => import('./verbs/toss_bowl.js'),
  sear_flip: () => import('./verbs/sear_flip.js'),
  crimp_edge: () => import('./verbs/crimp_edge.js'),
  catch_kernels: () => import('./verbs/catch_kernels.js'),
  wind_press: () => import('./verbs/wind_press.js'),
  jar_fill: () => import('./verbs/jar_fill.js'),
  pull_taffy: () => import('./verbs/pull_taffy.js'),
  match_seam: () => import('./verbs/match_seam.js'),
  stir_figure: () => import('./verbs/stir_figure.js'),
  arc_pour: () => import('./verbs/arc_pour.js'),
  read_vortex: () => import('./verbs/read_vortex.js'),
  ride_heat: () => import('./verbs/ride_heat.js'),
  peek_pour: () => import('./verbs/peek_pour.js'),
};

/** Load one verb module by id, or null if it is not registered. */
export async function loadVerb(verbId) {
  const loader = VERB_LOADERS[verbId];
  if (!loader) return null;
  const mod = await loader();
  return mod && mod.id === verbId ? mod : null;
}
