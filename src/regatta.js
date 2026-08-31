// regatta.js — the weekly regatta (L55). The player's crew races five simulated crews drawn
// from neighbours.js.
//
// Rival scores advance on WALL-CLOCK elapsed time from each crew's activity profile, not on
// ticks the player was present for, so returning after a day away shows a race that plainly
// continued without you rather than one frozen where you left it. That difference is most of
// what makes a simulated race feel like a race.
// State: state.regatta { seasonId, endsAt, board, points, rivals, league, seasonsWon,
//                        placementClaimed }

/** The current season, starting a new one if the last has ended. */
export function activeSeason(now) { /* Phase B */ }

/** The task board for this season. */
export function board() { /* Phase B */ }

/** Claim a task from the board, starting its 24-hour window. */
export function claimTask(taskId) { /* Phase B */ }

/** Progress on a claimed task, measured against the stat snapshot taken when it was claimed. */
export function taskProgress(taskId) { /* Phase B */ }

/** Hand in a finished task for points. */
export function completeTask(taskId) { /* Phase B */ }

/** Standings, player included, sorted by points. */
export function standings() { /* Phase B */ }

/** Settle a finished season: place the crews, promote or demote, unlock the reward claim. */
export function settleSeason(now) { /* Phase B */ }

/** Claim the placement reward for a settled season. */
export function claimPlacement() { /* Phase B */ }

/** Advance rival scores from elapsed time; called from the game loop. */
export function tick(now) { /* Phase B */ }
