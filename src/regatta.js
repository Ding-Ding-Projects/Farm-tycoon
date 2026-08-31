// regatta.js — the weekly regatta (L55). The player's crew races five simulated crews drawn
// from neighbours.js.
//
// Rival scores advance on WALL-CLOCK elapsed time from each crew's activity profile, not on
// ticks the player was present for, so returning after a day away shows a race that plainly
// continued without you rather than one frozen where you left it. That difference is most of
// what makes a simulated race feel like a race.
// State: state.regatta { seasonId, endsAt, board, points, rivals, league, seasonsWon,
//                        placementClaimed }
//
// Two extra fields (lastPlace, lastRewards) ride alongside the documented shape to carry the
// most recently settled season's result forward for claimPlacement() — placementClaimed always
// describes THAT result, never the brand-new season that starts the moment the old one ends.

import { state } from './state.js';
import { REGATTA } from './data.js';
import * as economy from './economy.js';
import * as neighbours from './neighbours.js';

function totalCount(items) { return Object.values(items).reduce((a, b) => a + b, 0); }
function barnRoom() { return Math.max(0, state.barn.capacity - totalCount(state.barn.items)); }
function addToBarn(id, qty) {
  const given = Math.max(0, Math.min(qty, barnRoom()));
  if (given > 0) state.barn.items[id] = (state.barn.items[id] || 0) + given;
  return given;
}

function pickBoard(seasonId) {
  const rng = neighbours._rng(neighbours._hash(`${state.neighbours.seed}:regattaboard:${seasonId}`));
  const pool = [...REGATTA.taskPool];
  const n = Math.min(REGATTA.taskSlots, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n).map((t) => ({
    id: t.id, claimedAt: null, deadlineAt: null, snapshotStat: null, handedIn: false,
  }));
}

function leagueIndex(id) { return REGATTA.leagues.findIndex((l) => l.id === id); }

function maybePromoteDemote(place) {
  const s = state.regatta;
  const idx = leagueIndex(s.league);
  if (place === 1) {
    s.seasonsWon += 1;
    const next = REGATTA.leagues[idx + 1];
    if (next && s.seasonsWon >= next.minSeasonsWon) s.league = next.id;
  } else if (place === REGATTA.laneCount) {
    const prev = REGATTA.leagues[idx - 1];
    if (prev) s.league = prev.id;
  }
}

function startNewSeason(now, league, carry = {}) {
  const seasonId = (state.regatta?.seasonId || 0) + 1;
  // A missed season steps forward from where the PREVIOUS season's clock actually ran out, not
  // from `now` — otherwise rolling over several missed weeks in one activeSeason() call would
  // jump the new endsAt straight past `now` on the very first iteration and silently swallow
  // every season in between (seasonId barely moving while weeks of "missed" seasons vanish).
  const baseline = state.regatta ? state.regatta.endsAt : now;
  const rivals = neighbours.sample(REGATTA.laneCount - 1, `regatta_${seasonId}`).map((nb) => ({
    neighbourId: nb.id, points: 0, lastTickAt: now,
  }));
  state.regatta = {
    seasonId,
    endsAt: baseline + REGATTA.seasonDurationDays * 86400 * 1000,
    board: pickBoard(seasonId),
    points: 0,
    rivals,
    league,
    seasonsWon: state.regatta?.seasonsWon || 0,
    placementClaimed: carry.placementClaimed !== undefined ? carry.placementClaimed : true,
    lastPlace: carry.lastPlace !== undefined ? carry.lastPlace : (state.regatta?.lastPlace ?? null),
    lastRewards: carry.lastRewards !== undefined ? carry.lastRewards : (state.regatta?.lastRewards ?? null),
  };
}

function ensure() {
  if (!state.regatta) startNewSeason(Date.now(), REGATTA.leagues[0].id);
  return state.regatta;
}

/** Standings, player included, sorted by points. */
export function standings() {
  const s = ensure();
  const rows = [{ id: 'player', name: 'You', points: s.points, isPlayer: true }];
  for (const r of s.rivals) {
    const nb = neighbours.get(r.neighbourId);
    rows.push({
      id: r.neighbourId,
      name: nb ? `${nb.first} ${nb.last}` : 'Unknown Crew',
      points: r.points,
      isPlayer: false,
    });
  }
  rows.sort((a, b) => b.points - a.points);
  return rows;
}

function doSettle(now) {
  const rows = standings();
  const place = rows.findIndex((r) => r.isPlayer) + 1;
  maybePromoteDemote(place);
  const rewardDef = REGATTA.rewards.placement.find((p) => p.place === place)
    || REGATTA.rewards.placement[REGATTA.rewards.placement.length - 1];
  const result = { place, rewards: rewardDef };
  const league = state.regatta.league;
  startNewSeason(now, league, { lastPlace: place, lastRewards: rewardDef, placementClaimed: false });
  return result;
}

/** The current season, starting a new one if the last has ended. */
export function activeSeason(now = Date.now()) {
  ensure();
  let guard = 0;
  // Bounded loop: a save left untouched for months still resolves in a handful of iterations
  // (one per missed season), never in an unbounded loop or a fabricated fortune.
  while (now >= state.regatta.endsAt && guard < 2000) {
    doSettle(now);
    guard++;
  }
  return state.regatta;
}

/** The task board for this season. */
export function board() {
  const s = ensure();
  return s.board.map((entry) => {
    const def = REGATTA.taskPool.find((t) => t.id === entry.id);
    return { ...def, claimedAt: entry.claimedAt, deadlineAt: entry.deadlineAt, handedIn: entry.handedIn };
  });
}

/** Claim a task from the board, starting its 24-hour window. */
export function claimTask(taskId) {
  const s = ensure();
  const entry = s.board.find((e) => e.id === taskId);
  if (!entry || entry.claimedAt !== null) return false;
  const def = REGATTA.taskPool.find((t) => t.id === taskId);
  if (!def) return false;
  const now = Date.now();
  entry.claimedAt = now;
  entry.deadlineAt = now + REGATTA.taskDurationHours * 3600 * 1000;
  entry.snapshotStat = state.stats[def.stat] || 0;
  return true;
}

/** Progress on a claimed task, measured against the stat snapshot taken when it was claimed. */
export function taskProgress(taskId) {
  const s = ensure();
  const entry = s.board.find((e) => e.id === taskId);
  if (!entry || entry.claimedAt === null) return null;
  const def = REGATTA.taskPool.find((t) => t.id === taskId);
  const now = Date.now();
  const progress = Math.max(0, Math.min(def.target, (state.stats[def.stat] || 0) - entry.snapshotStat));
  return {
    progress,
    target: def.target,
    complete: progress >= def.target,
    expired: now > entry.deadlineAt && !entry.handedIn,
    handedIn: entry.handedIn,
  };
}

/** Hand in a finished task for points. */
export function completeTask(taskId) {
  const s = ensure();
  const entry = s.board.find((e) => e.id === taskId);
  if (!entry || entry.claimedAt === null || entry.handedIn) return false;
  const prog = taskProgress(taskId);
  if (!prog || !prog.complete || prog.expired) return false;
  const def = REGATTA.taskPool.find((t) => t.id === taskId);
  const league = REGATTA.leagues.find((l) => l.id === s.league) || REGATTA.leagues[0];

  s.points += Math.round(def.points * league.rewardMult);
  economy.addCoins(Math.round(REGATTA.rewards.perTask.coins * league.rewardMult));
  economy.addXp(REGATTA.rewards.perTask.xp);
  entry.handedIn = true;
  return true;
}

/** Settle a finished season: place the crews, promote or demote, unlock the reward claim. */
export function settleSeason(now = Date.now()) {
  ensure();
  if (now < state.regatta.endsAt) return null; // not over yet — nothing to settle
  return doSettle(now);
}

/** Claim the placement reward for a settled season. */
export function claimPlacement() {
  const s = ensure();
  if (!s.lastRewards || s.placementClaimed) return false;
  const r = s.lastRewards;
  if (r.coins) economy.addCoins(r.coins);
  if (r.diamonds) state.diamonds += r.diamonds;
  if (r.materials) {
    for (const [id, qty] of Object.entries(r.materials)) addToBarn(id, qty);
  }
  if (r.decoration) addToBarn(r.decoration, 1);
  s.placementClaimed = true;
  return true;
}

/** Advance rival scores from elapsed time; called from the game loop. */
export function tick(now = Date.now()) {
  activeSeason(now);
  const s = state.regatta;
  for (const r of s.rivals) {
    const elapsedSeconds = Math.max(0, (now - r.lastTickAt) / 1000);
    if (elapsedSeconds <= 0) continue;
    const sim = neighbours.simulate(r.neighbourId, elapsedSeconds);
    r.points += sim.points;
    r.lastTickAt = now;
  }
}
