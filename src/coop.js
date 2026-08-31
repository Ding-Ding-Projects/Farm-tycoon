// coop.js — the co-op and its request board (L52). Members come from neighbours.js; this
// module generates nobody.
//
// The request board is the supply valve: when one missing input blocks a recipe, asking a
// neighbour beats waiting out a grow timer. Filling others' requests earns co-op points, which
// buy permanent perks whose effects flow through EFFECT_KEYS like everything else.
// State: state.coop { points, perksUnlocked, dailyTasks, tasksRefreshedAt,
//                     requests: [{ id, item, qty, filled, postedAt, readyAt, byNeighbourId }],
//                     ownRequestCooldownUntil }
//
// Each request row also carries `posterIsPlayer`: false for a neighbour's own request (the
// player fills it via helpRequest, from whichever store the item actually lives in), true for
// the player's own post (a neighbour fills it after a delay drawn from their activity profile;
// the player collects it via collectRequest). Keeping both kinds in one array is what "the open
// request board, including the player's own posts" means.

import { state } from './state.js';
import { COOP, NEIGHBOURS, CROPS, GOODS, MATERIALS } from './data.js';
import * as economy from './economy.js';
import * as neighbours from './neighbours.js';

function ensure() {
  if (!state.coop) {
    state.coop = {
      points: 0,
      perksUnlocked: [],
      dailyTasks: [],
      tasksRefreshedAt: 0,
      requests: [],
      ownRequestCooldownUntil: 0,
    };
  }
  return state.coop;
}

function isCrop(id) { return Object.prototype.hasOwnProperty.call(CROPS, id); }
function totalCount(items) { return Object.values(items).reduce((a, b) => a + b, 0); }
function siloRoom() { return Math.max(0, state.silo.capacity - totalCount(state.silo.items)); }
function barnRoom() { return Math.max(0, state.barn.capacity - totalCount(state.barn.items)); }
function stockOf(id) { return isCrop(id) ? state.silo.items : state.barn.items; }
function roomFor(id) { return isCrop(id) ? siloRoom() : barnRoom(); }

function addToBarn(id, qty) {
  const given = Math.max(0, Math.min(qty, barnRoom()));
  if (given > 0) state.barn.items[id] = (state.barn.items[id] || 0) + given;
  return given;
}

function applyRewards(rewards) {
  if (!rewards) return;
  if (rewards.coins) economy.addCoins(rewards.coins);
  if (rewards.xp) economy.addXp(rewards.xp);
  if (rewards.materials) {
    for (const [id, qty] of Object.entries(rewards.materials)) addToBarn(id, qty);
  }
}

function eligibleItemPool() {
  const pool = [];
  if (COOP.requestBoard.eligible.includes('crops')) pool.push(...Object.keys(CROPS));
  if (COOP.requestBoard.eligible.includes('goods')) pool.push(...Object.keys(GOODS));
  if (COOP.requestBoard.eligible.includes('materials')) pool.push(...Object.keys(MATERIALS));
  return pool;
}

function unlockEligiblePerks() {
  const c = ensure();
  for (const perk of COOP.perks) {
    if (c.points >= perk.points && !c.perksUnlocked.includes(perk.id)) {
      c.perksUnlocked.push(perk.id);
    }
  }
}

/** Co-op members for this save, drawn from neighbours.roster(). */
export function members() {
  return neighbours.sample(COOP.maxMembers, 'coop_members');
}

// Local-hour day boundary: everything before refreshHourLocal on a given calendar day still
// belongs to the PREVIOUS day's boundary, matching how a 5am daily reset actually reads to a
// player checking in at 2am.
function dayBoundary(now, refreshHourLocal) {
  const d = new Date(now);
  if (d.getHours() < refreshHourLocal) d.setDate(d.getDate() - 1);
  d.setHours(refreshHourLocal, 0, 0, 0);
  return d.getTime();
}

function refreshDailyTasksIfNeeded(now) {
  const c = ensure();
  const boundary = dayBoundary(now, COOP.dailyTasks.refreshHourLocal);
  if (c.tasksRefreshedAt >= boundary) return;

  const rng = neighbours._rng(neighbours._hash(`coop_daily:${boundary}`));
  const pool = [...COOP.taskPool];
  const n = Math.min(COOP.dailyTasks.count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  c.dailyTasks = pool.slice(0, n).map((t) => ({
    taskId: t.id,
    statAtStart: state.stats[t.stat] || 0,
    claimed: false,
  }));
  c.tasksRefreshedAt = boundary;
}

/** Today's three tasks, refreshing at COOP.dailyTasks.refreshHourLocal. */
export function dailyTasks() {
  const now = Date.now();
  refreshDailyTasksIfNeeded(now);
  const c = ensure();
  return c.dailyTasks.map((entry) => {
    const def = COOP.taskPool.find((t) => t.id === entry.taskId);
    const progress = Math.max(0, Math.min(def.target, (state.stats[def.stat] || 0) - entry.statAtStart));
    return { ...def, progress, claimed: entry.claimed, complete: progress >= def.target };
  });
}

/** Claim a completed daily task's reward. */
export function claimTask(taskId) {
  refreshDailyTasksIfNeeded(Date.now());
  const c = ensure();
  const entry = c.dailyTasks.find((e) => e.taskId === taskId);
  if (!entry || entry.claimed) return false;
  const def = COOP.taskPool.find((t) => t.id === taskId);
  if (!def) return false;
  const progress = (state.stats[def.stat] || 0) - entry.statAtStart;
  if (progress < def.target) return false;

  entry.claimed = true;
  applyRewards(def.rewards);
  c.points += def.points;
  unlockEligiblePerks();
  return true;
}

function refreshBoard(now) {
  const c = ensure();
  const neighbourPosts = c.requests.filter((r) => !r.posterIsPlayer);
  const need = COOP.requestBoard.slots - neighbourPosts.length;
  if (need <= 0) return;

  const mem = members();
  const items = eligibleItemPool();
  if (!mem.length || !items.length) return;
  const [minQ, maxQ] = COOP.requestBoard.requestSizeRange;

  for (let i = 0; i < need; i++) {
    const seed = neighbours._hash(`${state.neighbours.seed}:reqboard:${c.requests.length}:${i}`);
    const rng = neighbours._rng(seed);
    const nb = mem[Math.floor(rng() * mem.length)];
    const item = items[Math.floor(rng() * items.length)];
    const qty = minQ + Math.floor(rng() * (maxQ - minQ + 1));
    c.requests.push({
      id: `req_${now}_${c.requests.length}_${Math.floor(rng() * 1e6)}`,
      item,
      qty,
      filled: false,
      postedAt: now,
      readyAt: null,
      byNeighbourId: nb.id,
      posterIsPlayer: false,
    });
  }
}

/** The open request board, including the player's own posts. */
export function requests() {
  refreshBoard(Date.now());
  return ensure().requests.slice();
}

/** Post a request for an item. Bounded by ownRequestSlots and the cooldown. */
export function postRequest(item, qty) {
  const c = ensure();
  const now = Date.now();
  if (now < c.ownRequestCooldownUntil) return false;
  const [minQ, maxQ] = COOP.requestBoard.requestSizeRange;
  if (!(qty > 0) || qty < minQ || qty > maxQ) return false;
  if (!eligibleItemPool().includes(item)) return false;
  const ownActive = c.requests.filter((r) => r.posterIsPlayer).length;
  if (ownActive >= COOP.requestBoard.ownRequestSlots) return false;

  const mem = members();
  if (!mem.length) return false;
  const seed = neighbours._hash(`${state.neighbours.seed}:ownreq:${now}:${item}:${qty}:${c.requests.length}`);
  const rng = neighbours._rng(seed);
  const nb = mem[Math.floor(rng() * mem.length)];
  const profile = NEIGHBOURS.activityProfiles[nb.profile] || NEIGHBOURS.activityProfiles.steady;
  const [fLo, fHi] = profile.fillSecondsRange;
  const fillSeconds = fLo + Math.floor(rng() * (fHi - fLo + 1));

  c.requests.push({
    id: `ownreq_${now}_${c.requests.length}`,
    item,
    qty,
    filled: false,
    postedAt: now,
    readyAt: now + fillSeconds * 1000,
    byNeighbourId: nb.id,
    posterIsPlayer: true,
  });
  return true;
}

/** Cancel one of the player's own requests. */
export function cancelRequest(id) {
  const c = ensure();
  const idx = c.requests.findIndex((r) => r.id === id && r.posterIsPlayer);
  if (idx === -1) return false;
  c.requests.splice(idx, 1);
  return true;
}

/** Collect a request a neighbour has filled. */
export function collectRequest(id) {
  const c = ensure();
  const now = Date.now();
  const req = c.requests.find((r) => r.id === id && r.posterIsPlayer);
  if (!req || req.filled) return null;
  if (req.readyAt === null || now < req.readyAt) return null;

  const given = Math.min(req.qty, roomFor(req.item));
  if (given === 0) return null; // no room yet — leave it collectible

  stockOf(req.item)[req.item] = (stockOf(req.item)[req.item] || 0) + given;
  req.filled = true;
  c.requests = c.requests.filter((r) => r.id !== id);
  c.ownRequestCooldownUntil = now + COOP.requestBoard.cooldownAfterFill * 1000;
  economy.trackStat('requestsFilled', 1);
  return { item: req.item, qty: given };
}

/** Fill a neighbour's request from the barn; pays coins, XP and co-op points. */
export function helpRequest(id) {
  const c = ensure();
  const req = c.requests.find((r) => r.id === id && !r.posterIsPlayer);
  if (!req || req.filled) return false;
  const stock = stockOf(req.item);
  if ((stock[req.item] || 0) < req.qty) return false;

  stock[req.item] -= req.qty;
  req.filled = true;
  const reward = COOP.requestBoard.helpReward;
  economy.addCoins(reward.coinsPerItem * req.qty);
  economy.addXp(reward.xp);
  c.points += reward.coopPoints;
  economy.trackStat('coopHelps', 1);
  unlockEligiblePerks();
  c.requests = c.requests.filter((r) => r.id !== id);
  return true;
}

/** Lifetime co-op points. */
export function contributionPoints() {
  return ensure().points;
}

/** Merged effect object from every unlocked perk, for the shared multiplier merge point. */
export function activePerkEffect() {
  const c = ensure();
  const effect = {};
  for (const perk of COOP.perks) {
    if (!c.perksUnlocked.includes(perk.id)) continue;
    for (const [key, value] of Object.entries(perk.effect)) {
      if (/Mult$/.test(key)) effect[key] = (effect[key] ?? 1) * value;
      else effect[key] = (effect[key] ?? 0) + value;
    }
  }
  return effect;
}

/** Advance neighbour fill timers and refresh the board; called from the game loop. */
export function tick(now = Date.now()) {
  ensure();
  refreshBoard(now);
  refreshDailyTasksIfNeeded(now);
}
