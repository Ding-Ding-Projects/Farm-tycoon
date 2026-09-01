// extras.js — achievements, daily wheel, NPC visitors, pets, seasonal events, diamonds sinks.

import { state } from './state.js';
import { ACHIEVEMENTS, DAILY_WHEEL, PETS, EVENTS, MUSEUM } from './data.js';
import * as economy from './economy.js';
import * as storage from './storage.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function isSameCalendarDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function statValue(achievement) {
  if (achievement.stat === 'level') return state.level;
  return state.stats[achievement.stat] || 0;
}

/** Check all ACHIEVEMENTS against state.stats; unlock + toast + award diamonds for new ones. */
export function checkAchievements() {
  const newlyUnlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (state.achievements.unlocked.includes(achievement.id)) continue;
    if (statValue(achievement) >= achievement.target) {
      state.achievements.unlocked.push(achievement.id);
      state.diamonds += achievement.diamonds || 0;
      newlyUnlocked.push(achievement);
    }
  }
  return newlyUnlocked;
}

// ---------------------------------------------------------------------------
// Daily wheel — one free spin per calendar day; a consecutive-day streak (capped at 5)
// boosts coin segments by +10% per streak day, per the DAILY_WHEEL data.js note. Missing a
// day resets the streak; spinning again the same day is refused so the streak cannot be
// farmed by spinning twice.
// ---------------------------------------------------------------------------

/** Is the daily spin available (once per calendar day, streak tracked)? */
export function canSpin(now = Date.now()) {
  if (!state.daily.lastSpinAt) return true;
  return !isSameCalendarDay(state.daily.lastSpinAt, now);
}

/** Spin the wheel: returns the landed DAILY_WHEEL segment (streak boosts coin segments). */
export function spin() {
  const now = Date.now();
  if (!canSpin(now)) return null;

  const wasYesterday = state.daily.lastSpinAt && (now - state.daily.lastSpinAt) < 2 * DAY_MS
    && !isSameCalendarDay(state.daily.lastSpinAt, now);
  state.daily.streak = wasYesterday ? Math.min(5, state.daily.streak + 1) : 1;
  state.daily.lastSpinAt = now;

  const segment = DAILY_WHEEL[Math.floor(Math.random() * DAILY_WHEEL.length)];
  const streakMult = 1 + 0.1 * (state.daily.streak - 1);
  const result = { ...segment };

  if (result.coins) {
    result.coins = Math.round(result.coins * streakMult);
    economy.addCoins(result.coins);
  }
  if (result.diamonds) state.diamonds += result.diamonds;
  // Never past the barn cap: what fits is stored, the rest is paid out as coins.
  if (result.item) result.paidOut = storage.addOrPay(result.item, result.qty || 1).paidOut;
  if (result.material) result.paidOut = storage.addOrPay(result.material, result.qty || 1).paidOut;

  return result;
}

// ---------------------------------------------------------------------------
// Visitors — an NPC occasionally offers to buy an owned barn item at a premium.
// ---------------------------------------------------------------------------

const VISITOR_CHANCE_PER_TICK = 0.02;
const VISITOR_PREMIUM = 1.5;

/** Maybe spawn an NPC visitor offering to buy an owned item at a premium (from shop.tick). */
export function maybeSpawnVisitor(now = Date.now()) {
  if (state.visitor) return null;
  const owned = Object.entries(state.barn.items).filter(([, qty]) => qty > 0);
  if (owned.length === 0) return null;
  if (Math.random() >= VISITOR_CHANCE_PER_TICK) return null;

  const [itemId, qty] = owned[Math.floor(Math.random() * owned.length)];
  const offerQty = Math.min(qty, 1 + Math.floor(Math.random() * 3));
  const price = Math.round(economy.sellValue(itemId) * VISITOR_PREMIUM) || Math.round(10 * VISITOR_PREMIUM);
  state.visitor = { itemId, qty: offerQty, price, expiresAt: now + 5 * 60 * 1000 };
  return state.visitor;
}

/** Accept/decline the current visitor offer. */
export function resolveVisitor(accept) {
  const visitor = state.visitor;
  if (!visitor) return false;
  if (accept) {
    const owned = state.barn.items[visitor.itemId] || 0;
    const qty = Math.min(owned, visitor.qty);
    if (qty > 0) {
      state.barn.items[visitor.itemId] = owned - qty;
      economy.addCoins(visitor.price * qty);
    }
  }
  state.visitor = null;
  return true;
}

// ---------------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------------

/** Buy a pet; feedPet() once per day for PETS[x].feedXp. */
export function buyPet(petId) {
  const pet = PETS[petId];
  if (!pet) return false;
  if (state.pets[petId]?.owned) return false;
  if (state.level < (pet.unlockLevel || 1)) return false;
  if (state.coins < pet.cost) return false;
  economy.addCoins(-pet.cost);
  state.pets[petId] = { owned: true, lastFedAt: 0 };
  return true;
}

export function feedPet(petId) {
  const pet = PETS[petId];
  const owned = state.pets[petId];
  if (!pet || !owned?.owned) return false;
  const now = Date.now();
  if (owned.lastFedAt && isSameCalendarDay(owned.lastFedAt, now)) return false;
  owned.lastFedAt = now;
  economy.addXp(pet.feedXp);
  return true;
}

// ---------------------------------------------------------------------------
// Events (data.js EVENTS: weekend point events, weekday mini-events, Farm Fair, holidays)
// All scheduling is deterministic from the local calendar: ISO week number picks the
// weekend/mini rotation entry; the Fair runs the first full week of each month (L15+);
// holidays key off the month. Event state: state.event { id, kind, endsAt, points,
// claimedTiers }, plus state.fair { tasks, progress, ribbonsClaimed } and lifetime
// state.fairPass { goldRibbons }. Invariants: points never negative; each tier/ribbon
// claimable exactly once; expired events settle unclaimed tiers as lost (like Hay Day).
// ---------------------------------------------------------------------------

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/** Fri 00:00 -> Mon 00:00 local, for the given instant's calendar week. */
function weekendWindow(now) {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun..6=Sat
  const daysSinceFri = (day - 5 + 7) % 7; // Fri=0, Sat=1, Sun=2, Mon..Thu = 3..6
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceFri, 0, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * DAY_MS); // through end of Sunday
  return { start: start.getTime(), end: end.getTime() };
}

/** Tue 00:00 -> Thu 00:00 local, for the given instant's calendar week. */
function miniWindow(now) {
  const d = new Date(now);
  const day = d.getDay();
  const daysSinceTue = (day - 2 + 7) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceTue, 0, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * DAY_MS);
  return { start: start.getTime(), end: end.getTime() };
}

function startWeekendEvent(now) {
  const { rotation, levelScale } = EVENTS.weekend;
  const week = isoWeekNumber(new Date(now));
  const entry = rotation[week % rotation.length];
  const { end } = weekendWindow(now);
  state.event = { id: entry.id, kind: 'weekend', endsAt: end, points: 0, claimedTiers: [], levelScaleAt: levelScale(state.level) };
}

function startMiniEvent(now) {
  const { rotation } = EVENTS.miniWeekday;
  const week = isoWeekNumber(new Date(now));
  const entry = rotation[week % rotation.length];
  const { end } = miniWindow(now);
  state.event = { id: entry.id, kind: 'mini', endsAt: end, points: 0, claimedTiers: [] };
}

/** Advance/settle the event calendar; starts and expires events. Called from the game loop. */
export function tickEvents(now = Date.now()) {
  if (state.event && now >= state.event.endsAt) state.event = null; // unclaimed tiers are lost

  if (!state.event) {
    const wknd = weekendWindow(now);
    const mini = miniWindow(now);
    if (now >= wknd.start && now < wknd.end) startWeekendEvent(now);
    else if (now >= mini.start && now < mini.end) startMiniEvent(now);
  }

  tickFair(now);
}

function findEventEntry() {
  if (!state.event) return null;
  const pool = state.event.kind === 'weekend' ? EVENTS.weekend.rotation : EVENTS.miniWeekday.rotation;
  return pool.find((e) => e.id === state.event.id) || null;
}

/** The active weekend or mini event descriptor + live points, or null. */
export function activeWeekendEvent() {
  if (!state.event) return null;
  const entry = findEventEntry();
  if (!entry) return null;
  return { ...entry, kind: state.event.kind, endsAt: state.event.endsAt, points: state.event.points, claimedTiers: [...state.event.claimedTiers] };
}

/** Merged passive-buff object from the active event + holiday ({} when none) —
 *  consumed by economy/fishing/mine/boat/merge. */
export function activeEventEffect() {
  const out = {};
  const entry = findEventEntry();
  if (entry?.effect && typeof entry.effect === 'object') Object.assign(out, entry.effect);
  return out;
}

/** Score event points for a themed action (called by trackStat routing); shows a floater. */
export function addEventPoints(stat, amount) {
  const entry = findEventEntry();
  if (!entry || !state.event) return 0;
  const per = entry.pointsFor?.[stat];
  if (!per) return 0;
  const gained = Math.max(0, amount) * per;
  state.event.points = Math.max(0, state.event.points + gained);
  return gained;
}

/** Claim a reached tier ('bronze'|'silver'|'gold') of the active event; idempotent. */
export function claimEventTier(tier) {
  const entry = findEventEntry();
  if (!entry || !state.event || state.event.kind !== 'weekend') return false;
  if (state.event.claimedTiers.includes(tier)) return false;
  const tierIdx = EVENTS.weekend.tiers.indexOf(tier);
  if (tierIdx === -1) return false;
  const baseThreshold = entry.thresholds[tierIdx];
  const scaledThreshold = baseThreshold * (state.event.levelScaleAt ?? EVENTS.weekend.levelScale(state.level));
  if (state.event.points < scaledThreshold) return false;

  const reward = entry.rewards[tierIdx] || {};
  if (reward.coins) economy.addCoins(reward.coins);
  if (reward.diamonds) state.diamonds += reward.diamonds;
  state.event.claimedTiers.push(tier);
  return true;
}

// ---- Farm Fair ----

function seededFairTasks(year, month) {
  // A small deterministic PRNG seeded by year+month so the same fair draws the same tasks
  // for everyone in that month, without needing a server.
  let seed = year * 100 + month;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pool = [...EVENTS.fair.taskPool];
  const drawn = [];
  const count = Math.min(EVENTS.fair.tasksPerFair, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rand() * pool.length);
    drawn.push(pool.splice(idx, 1)[0]);
  }
  return drawn.map((t) => ({ ...t, startStat: 0 }));
}

function firstFullFairWeek(now) {
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  // First Monday on/after the 1st, so the fair window never spans two months.
  const offsetToMonday = (8 - (monthStart.getDay() || 7)) % 7;
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 + offsetToMonday);
  const end = new Date(start.getTime() + EVENTS.fair.durationDays * DAY_MS);
  return { start: start.getTime(), end: end.getTime() };
}

function tickFair(now) {
  const { unlockLevel } = EVENTS.fair;
  if (state.level < unlockLevel) return;
  const { start, end } = firstFullFairWeek(now);
  const inWindow = now >= start && now < end;

  if (state.fair && now >= state.fair.endsAt) state.fair = null; // unclaimed ribbon is lost

  if (inWindow && !state.fair) {
    const d = new Date(now);
    const tasks = seededFairTasks(d.getFullYear(), d.getMonth() + 1).map((t) => ({
      ...t, startValue: state.stats[t.stat] || 0,
    }));
    state.fair = { tasks, endsAt: end, ribbonClaimed: false };
  }
}

/** The active Farm Fair (task list + per-task progress + ribbon state), or null. */
export function activeFair() {
  if (!state.fair) return null;
  return {
    tasks: state.fair.tasks.map((t) => ({ ...t, progress: fairTaskProgress(t.id) })),
    endsAt: state.fair.endsAt,
    ribbonClaimed: state.fair.ribbonClaimed,
  };
}

/** Progress fraction for one fair task (from stat deltas since the fair started). */
export function fairTaskProgress(taskId) {
  if (!state.fair) return 0;
  const task = state.fair.tasks.find((t) => t.id === taskId);
  if (!task) return 0;
  const delta = (state.stats[task.stat] || 0) - task.startValue;
  return Math.max(0, Math.min(1, delta / task.target));
}

/** Claim the earned ribbon at fair end; updates fairPass and unlocks trophy decorations. */
export function claimFairRibbon() {
  if (!state.fair || state.fair.ribbonClaimed) return false;
  const completed = state.fair.tasks.filter((t) => fairTaskProgress(t.id) >= 1);
  if (completed.length < EVENTS.fair.tasksToComplete) return false;

  const totalPoints = completed.reduce((sum, t) => sum + t.points, 0);
  const { ribbonThresholds, ribbonRewards } = EVENTS.fair;
  let ribbon = null;
  if (totalPoints >= ribbonThresholds.gold) ribbon = 'gold';
  else if (totalPoints >= ribbonThresholds.silver) ribbon = 'silver';
  else if (totalPoints >= ribbonThresholds.bronze) ribbon = 'bronze';
  if (!ribbon) return false;

  const reward = ribbonRewards[ribbon];
  if (reward.coins) economy.addCoins(reward.coins);
  if (reward.diamonds) state.diamonds += reward.diamonds;
  state.fair.ribbonClaimed = true;

  if (!state.fairPass) state.fairPass = { goldRibbons: 0 };
  if (ribbon === 'gold') state.fairPass.goldRibbons += 1;
  return { ribbon, totalPoints };
}

// ---- Holidays ----

/** The active holiday season descriptor (tint, flags, limited decorations), or null. */
export function activeHoliday() {
  const month = new Date().getMonth() + 1;
  return EVENTS.holidays.find((h) => h.months.includes(month)) || null;
}

// ---------------------------------------------------------------------------
// Wire into economy's shared hooks so achievements and event points update from the same
// single trackStat() call site every other stat-driven system already uses.
// ---------------------------------------------------------------------------
economy.registerStatHook((stat, _total, delta) => {
  addEventPoints(stat, delta);
  checkAchievements();
});
economy.onXpChanged(() => checkAchievements());
