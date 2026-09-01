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
import * as storage from './storage.js';

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
  // Rivals start racing when the SEASON starts, not when the player next looks: a season that
  // began while the game was closed shows crews that have plainly been at it since then.
  const rivals = neighbours.sample(REGATTA.laneCount - 1, `regatta_${seasonId}`).map((nb) => ({
    neighbourId: nb.id, points: 0, lastTickAt: baseline,
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

/**
 * Standings, player included, sorted by points. A tie goes AGAINST the player: you must beat a
 * crew to place above it. The old stable sort left the player - pushed first - on top of every
 * tie, which is how twenty idle weeks used to become twenty wins and a golden-league promotion.
 */
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
  rows.sort((a, b) => (b.points - a.points) || ((a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0)));
  return rows;
}

/** Advance rival scores from their own last tick up to `upTo`, never past the season's end. */
function advanceRivals(upTo) {
  const s = state.regatta;
  const cap = Math.min(upTo, s.endsAt);
  for (const r of s.rivals) {
    const elapsedSeconds = Math.max(0, (cap - r.lastTickAt) / 1000);
    if (elapsedSeconds <= 0) continue;
    const sim = neighbours.simulate(r.neighbourId, elapsedSeconds);
    r.points += sim.points;
    r.lastTickAt = cap;
  }
}

/**
 * Settle a finished season. A season the player never scored in was not entered: no place, no
 * reward, and neither a promotion nor a demotion - the league is decided by racing, not by
 * absence in either direction.
 */
function doSettle(now) {
  const s = state.regatta;
  const league = s.league;
  if (!(s.points > 0)) {
    startNewSeason(now, league, { lastPlace: null, lastRewards: null, placementClaimed: true });
    return { place: null, rewards: null, entered: false };
  }
  const rows = standings();
  const place = rows.findIndex((r) => r.isPlayer) + 1;
  maybePromoteDemote(place);
  const rewardDef = REGATTA.rewards.placement.find((p) => p.place === place)
    || REGATTA.rewards.placement[REGATTA.rewards.placement.length - 1];
  const result = { place, rewards: rewardDef, entered: true };
  startNewSeason(now, state.regatta.league, { lastPlace: place, lastRewards: rewardDef, placementClaimed: false });
  return result;
}

/** The current season, starting a new one if the last has ended. */
export function activeSeason(now = Date.now()) {
  ensure();
  let guard = 0;
  // Bounded loop: a save left untouched for months still resolves in a handful of iterations
  // (one per missed season), never in an unbounded loop or a fabricated fortune. Each missed
  // season's rivals race to that season's end before it is placed.
  while (now >= state.regatta.endsAt && guard < 2000) {
    advanceRivals(state.regatta.endsAt);
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

  const pts = Math.round(def.points * league.rewardMult);
  s.points += pts;
  economy.trackStat('regattaPoints', pts);   // the counter the Crew Hand / Commodore achievements read
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
    // What fits lands in the barn; the rest is paid out rather than lost to a full store.
    for (const [id, qty] of Object.entries(r.materials)) storage.addOrPay(id, qty);
  }
  if (r.decoration) grantDecoration(r.decoration);
  s.placementClaimed = true;
  return true;
}

/**
 * A decoration reward is an owned decoration the player can place for free from the Workshop's
 * decorations list - not a barn item. It used to be dropped into the barn, where it occupied a
 * slot for ever, sold for nothing and could never be placed.
 */
function grantDecoration(decoId) {
  if (!state.decorate) state.decorate = { active: false, selection: [], history: [], historyIndex: 0 };
  if (!state.decorate.owned) state.decorate.owned = {};
  state.decorate.owned[decoId] = (state.decorate.owned[decoId] || 0) + 1;
}

/** Advance rival scores from elapsed time; called from the game loop. */
export function tick(now = Date.now()) {
  activeSeason(now);
  advanceRivals(now);
}
