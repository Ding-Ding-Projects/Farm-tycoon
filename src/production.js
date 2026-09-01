// production.js — all timed work: crop growth, animal feeding/collection, building queues.
// Every timer is an absolute `readyAt` timestamp; tick() resolves anything past due,
// including everything that finished while the game was closed (resolved on load).

import { state } from './state.js';
import { CROPS, ANIMALS, BUILDINGS, QUALITY } from './data.js';
import * as economy from './economy.js';
import * as collections from './collections.js';
import * as minigames from './minigames.js';
import * as storage from './storage.js';
import * as extras from './extras.js';

// Building mastery (collections.js) computes a `productionTimeMult` contribution that is meant
// to flow through economy's ONE multiplier merge point (economy.registerMultiplierEffect) —
// exactly the way lab.js's own research self-registers at the bottom of that file — but nothing
// ever registered it, so a maxed-out mastery star tier composed with nothing. Registered here,
// at production.js's own module load, using the same sanctioned API lab.js uses, rather than
// giving mastery a second merge mechanism of its own.
//
// NOTE for whoever picks up productionTimeMult next: economy.js's combinedMultiplier() (the
// function this registration ultimately feeds) is currently only ever invoked for the 'sell'
// kind (economy.sellValue) — 'productionTimeMult' itself, along with every other reserved-for-
// research EFFECT_KEYS entry (cropGrowMult, animalProduceMult, siloCapBonus, barnCapBonus,
// orderPayoutMult, mineYieldBonus, fishRareChance, zooIncomeMult, truckIntervalMult), has NO
// consumer anywhere in the codebase yet — that is a pre-existing gap in economy.js, not
// something this file can fix without adding the second merge path this comment is here to
// avoid. This registration makes mastery's contribution available the moment somebody does.
economy.registerMultiplierEffect((kind) => collections.masteryEffect()[kind] ?? 1);

// Materials (data.js MATERIALS) have no dedicated bucket — see the NOTE in state.js. Any
// input/output id that is not a crop lives in the barn, materials included. storage.js is the
// one answer for where an id lives and how much room is left (capacity includes research and
// co-op bonuses there, not here).
const isCrop = storage.isCrop;
const stockOf = storage.bucketFor;
function siloRoom() { return storage.room('silo'); }
function barnRoom() { return storage.room('barn'); }

/** The active event's passive effect map ({} when none) - read at the point of use. */
function eventEffect() {
  try { return extras.activeEventEffect() || {}; } catch { return {}; }
}

/**
 * Can this queue entry be collected? A PLAYABLE craft (one carrying a `play` record) cannot,
 * until its game has actually been played through. A plain craft always can.
 *
 * This is the whole gate, deliberately in one predicate: every caller that decides whether an
 * entry is takeable asks here, so the rule cannot drift between production, the UI and the tests.
 */
export function isCollectable(entry) { return !entry.play || entry.play.done === true; }

/** Stable 32-bit hash of a string — used to derive a craft's play seed from its cid. */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function findField(fieldId) {
  return state.farm.objects.find((o) => o.id === fieldId && o.kind === 'field') || null;
}
function findPen(penId) {
  return state.farm.objects.find((o) => o.id === penId && o.kind === 'pen') || null;
}
function findBuilding(buildingId) {
  return state.farm.objects.find((o) => o.id === buildingId && o.kind === 'building') || null;
}

/** Plant a crop on a field plot (consumes 1 seed from the silo). */
export function plant(fieldId, cropId) {
  const field = findField(fieldId);
  if (!field) return false;
  if (field.cropId) return false; // already planted
  const crop = CROPS[cropId];
  if (!crop) return false;
  const have = state.silo.items[cropId] || 0;
  if (have < crop.seedCost) return false;

  state.silo.items[cropId] = have - crop.seedCost;
  const now = Date.now();
  field.cropId = cropId;
  field.plantedAt = now;
  // Research (irrigation) and the co-op's Shared Know-how shorten the grow time through the
  // shared multiplier merge point. Applied at planting so an absolute readyAt stays absolute.
  field.readyAt = now + Math.max(1000, Math.round(crop.growTime * 1000 * economy.multiplier('cropGrowMult', cropId)));
  return true;
}

/** Growth stage 0..3 for rendering, derived from plantedAt/growTime. -1 means an empty plot. */
export function growthStage(field, now = Date.now()) {
  if (!field || !field.cropId) return -1;
  if (field.readyAt !== null && now >= field.readyAt) return 3;
  const crop = CROPS[field.cropId];
  const total = crop.growTime * 1000;
  const elapsed = now - field.plantedAt;
  const frac = total > 0 ? elapsed / total : 1;
  if (frac < 1 / 3) return 0;
  if (frac < 2 / 3) return 1;
  return 2;
}

/**
 * Harvest a ready field: +2x seeds to silo, +XP. Returns { cropId, qty, paidOut } or null.
 *
 * A FULL SILO REFUSES THE HARVEST and leaves the crop standing, exactly as collectPen and
 * collectBuilding already leave their produce waiting. The old code stored zero, paid the XP,
 * and cleared the field anyway - the crop simply vanished. With partial room, what fits is
 * stored and the rest is paid out as coins at sellValue (collectBuilding's own shortfall rule),
 * so the silo cap can never destroy value.
 */
export function harvest(fieldId, now = Date.now()) {
  const field = findField(fieldId);
  if (!field || !field.cropId || field.readyAt === null || now < field.readyAt) return null;
  const crop = CROPS[field.cropId];
  const cropId = field.cropId;
  const yieldQty = crop.seedCost * 2; // Hay Day rule: harvest returns 2x the planted seed
  if (siloRoom() <= 0) return null;   // silo full — the crop stays in the ground

  const { given, paidOut } = storage.addOrPay(cropId, yieldQty);
  economy.addXp(Math.round(crop.xp * (eventEffect().cropXpMult || 1)));
  economy.trackStat('cropsHarvested', 1);
  collections.record('crop_almanac', cropId);

  field.cropId = null;
  field.plantedAt = null;
  field.readyAt = null;
  const out = { cropId, qty: given };
  if (paidOut > 0) out.paidOut = paidOut;   // only present when the silo could not hold it all
  return out;
}

/** Feed an animal pen (consumes feed items from barn); starts its produce timer. */
export function feedPen(penId) {
  const pen = findPen(penId);
  if (!pen) return false;
  if (pen.readyAt !== null) return false; // already producing
  const animal = ANIMALS[pen.type];
  if (!animal) return false;

  if (animal.feed) {
    const need = animal.capacity;
    const have = state.barn.items[animal.feed] || 0;
    if (have < need) return false;
    state.barn.items[animal.feed] = have - need;
  }
  pen.readyAt = Date.now() + Math.max(1000, Math.round(animal.produceTime * 1000 * economy.multiplier('animalProduceMult', pen.type)));
  return true;
}

/** Collect ready animal products into the barn. */
export function collectPen(penId, now = Date.now()) {
  const pen = findPen(penId);
  if (!pen || pen.readyAt === null || now < pen.readyAt) return null;
  const animal = ANIMALS[pen.type];
  const qty = animal.capacity;
  if (barnRoom() <= 0) return null; // barn full — leave the pen ready, collect once there is room

  const { given, paidOut } = storage.addOrPay(animal.product, qty);
  economy.addXp(animal.xp);
  economy.trackStat('goodsProduced', given);
  economy.trackStat('animalCollections', given);   // the counter every animal achievement/task reads
  pen.readyAt = null;
  const out = { product: animal.product, qty: given };
  if (paidOut > 0) out.paidOut = paidOut;
  return out;
}

/** Enqueue a recipe on a production building (consumes inputs immediately, Hay Day-style). */
export function enqueue(buildingId, recipeId) {
  const building = findBuilding(buildingId);
  if (!building) return false;
  const def = BUILDINGS[building.type];
  if (!def) return false;
  const recipe = def.recipes.find((r) => r.id === recipeId);
  if (!recipe) return false;

  const activeCount = state.production.filter((p) => p.objectId === buildingId).length;
  if (activeCount >= def.queueSlots) return false;

  // Check every input BEFORE consuming any of them, so a failure never leaves a partial
  // consumption behind that would need refunding.
  for (const [inputId, qty] of Object.entries(recipe.inputs)) {
    if ((stockOf(inputId)[inputId] || 0) < qty) return false;
  }
  for (const [inputId, qty] of Object.entries(recipe.inputs)) {
    stockOf(inputId)[inputId] -= qty;
  }

  // A PLAYABLE recipe (one carrying a `play` chain in data.js) gets a play record stamped on
  // the entry itself rather than in a side table. It then lives and dies with the craft, is
  // removed by the same splice that collects it, and survives a reload for free because it is
  // inside the one save blob. `cid` exists because the array index stops being a stable UI
  // handle the moment an earlier entry is collected mid-session.
  const cid = `c${state.craftSeq = (state.craftSeq || 0) + 1}`;
  const play = recipe.play
    ? { seed: (Date.now() ^ hashString(cid)) >>> 0, stage: 0, scores: [], attempts: 0, done: false, tier: null }
    : null;
  // Research (automation) and building mastery shorten the craft through the shared multiplier
  // merge point - the one consumer productionTimeMult never had.
  const ms = Math.max(1000, Math.round(recipe.time * 1000 * economy.multiplier('productionTimeMult', recipeId)));
  state.production.push({ objectId: buildingId, recipeId, readyAt: Date.now() + ms, cid, play });
  return true;
}

/**
 * Apply the per-BUILDING factory bonus (minigames.pendingBonus — the original one-per-building
 * MINIGAMES table, awarded at Masterpiece by minigames.js's finalize()) at the moment a batch is
 * actually collected — the one place both production.js and workshop.js spend it, since
 * minigames.js's own `results` bucket is consumed on read (see pendingBonus's doc comment). This
 * is a SEPARATE channel from the per-CRAFT quality tier a playable recipe's own game resolves
 * (that one is a real gate now, by design — see production.collectBuilding/isCollectable); the
 * factory bonus here stays exactly what it always was, optional and never a gate on its own:
 * pendingBonus() returns a zeroed shape when nothing is pending, and `amount > 0` short-circuits
 * before either branch below does anything.
 *
 * `*Mult`-named effects (speedMult, sellPriceMult, xpMult, ...) read as a fractional boost on
 * top of the recipe's own reward; XP is the one reward every recipe already pays, so that is
 * what a multiplicative result adds to. Every other effect name (bonusYield, extraOutput,
 * byproductChance, purityChance, ...) reads as a probability of one bonus unit of the same
 * good, bounded by barn room exactly like the base yield.
 * Returns { xp, bonusQty } — xp is the TOTAL to award (base + bonus), bonusQty is how many
 * extra units of `goodId` were actually granted (0 unless the barn had room and the roll hit).
 */
export function applyMinigameBonus(buildingId, goodId, baseXp) {
  const bonus = minigames.pendingBonus(buildingId);
  let xp = baseXp;
  let bonusQty = 0;
  if (bonus.effect && bonus.amount > 0) {
    if (bonus.effect.endsWith('Mult')) {
      xp += Math.round(baseXp * bonus.amount);
    } else if (Math.random() < bonus.amount && barnRoom() > 0) {
      state.barn.items[goodId] = (state.barn.items[goodId] || 0) + 1;
      bonusQty = 1;
    }
  }
  return { xp, bonusQty };
}

/**
 * Throw out a queued craft, freeing its slot and refunding HALF its inputs, rounded down.
 *
 * This exists for one specific dead end. A playable craft can only be collected by playing its
 * game, so a player who does not want to play three cakes could otherwise sit with three of the
 * factory's slots occupied for ever. The gate is deliberate; a permanently bricked factory is
 * not, and this is the release valve.
 *
 * Half back rather than all back, so it stays a loss rather than a free cancel: queueing a craft
 * and discarding it must never be a way to store inputs or dodge a bad roll.
 */
export function discardBatch(cid) {
  const idx = state.production.findIndex((p) => p.cid === cid);
  if (idx === -1) return null;
  const entry = state.production[idx];
  const building = findBuilding(entry.objectId);
  const def = building && BUILDINGS[building.type];
  const recipe = def && def.recipes.find((r) => r.id === entry.recipeId);
  if (!recipe) return null;

  // Whatever will not fit is paid out as coins instead of vanishing. The UI promises half back,
  // and a full silo must not quietly turn that promise into nothing: the same shortfall-to-coins
  // rule collectBuilding already uses, for the same reason.
  const refunded = {};
  let paidOut = 0;
  for (const [inputId, qty] of Object.entries(recipe.inputs || {})) {
    const back = Math.floor(qty / 2);
    if (back <= 0) continue;
    const bucket = stockOf(inputId);
    const room = isCrop(inputId) ? siloRoom() : barnRoom();
    const give = Math.max(0, Math.min(back, room));
    if (give > 0) {
      bucket[inputId] = (bucket[inputId] || 0) + give;
      refunded[inputId] = give;
    }
    const short = back - give;
    if (short > 0) paidOut += economy.sellValue(inputId) * short;
  }
  if (paidOut > 0) economy.addCoins(Math.round(paidOut));

  state.production.splice(idx, 1);
  return { recipeId: entry.recipeId, refunded, paidOut: Math.round(paidOut) };
}

/**
 * Collect a finished queue slot's output into the barn. With `cid` given, collect exactly that
 * entry (the one whose card the player pressed); without it, the first collectable one.
 */
export function collectBuilding(buildingId, now = Date.now(), cid = null) {
  // findIndex SKIPS a ready-but-unplayed entry rather than stopping at it, so an unplayed cake
  // never blocks a finished loaf queued behind it. This is the single most important line in
  // the playable-craft change.
  const idx = state.production.findIndex(
    (p) => p.objectId === buildingId && p.readyAt <= now && isCollectable(p) && (!cid || p.cid === cid));
  if (idx === -1) return null;
  const entry = state.production[idx];
  const building = findBuilding(buildingId);
  const def = building && BUILDINGS[building.type];
  const recipe = def && def.recipes.find((r) => r.id === entry.recipeId);
  if (!recipe) return null;

  // A played craft resolves its tier here, once, into things the game already has: how many
  // units land, an XP multiplier, and a one-off coin tip. Nothing per-unit is stored.
  const tier = entry.play ? QUALITY.tiers[entry.play.tier] || QUALITY.tiers[0] : null;
  const want = tier ? tier.yield : 1;

  const given = Math.min(want, barnRoom());
  if (given === 0) return null; // barn full — leave the entry queued, collect once there is room

  state.barn.items[entry.recipeId] = (state.barn.items[entry.recipeId] || 0) + given;

  // Two SEPARATE reward channels stack here, per minigames.js's own header comment: the tier
  // above is the per-CRAFT quality game's result (XP multiplier baked in); applyMinigameBonus
  // spends the per-BUILDING factory bonus (the original MINIGAMES table, awarded at Masterpiece
  // and banked in state.minigames.results) on top of it — that bonus is computed by finalize()
  // but was never actually being spent anywhere, exactly the gap minigames.js's own comment on
  // pendingBonus() describes ("the consuming path, used at collect") without it being wired.
  const tierXp = Math.round(recipe.xp * (tier ? tier.xpMult : 1) * (eventEffect().productionXpMult || 1));
  const { xp, bonusQty } = applyMinigameBonus(buildingId, entry.recipeId, tierXp);
  economy.addXp(xp);
  economy.trackStat('goodsProduced', given + bonusQty);
  if (entry.recipeId.endsWith('_feed')) economy.trackStat('feedMade', given + bonusQty);
  collections.record('recipe_book', entry.recipeId);

  // Room for fewer than the tier earned: pay the shortfall out as coins rather than inventing
  // a partial-entry state, and rather than silently dropping units the player played for.
  const short = want - given;
  if (short > 0) economy.addCoins(economy.sellValue(entry.recipeId) * short);
  if (tier && tier.tipMult > 1) {
    economy.addCoins(Math.round(economy.sellValue(entry.recipeId) * (tier.tipMult - 1) * given));
  }

  collections.recordMake(buildingId);
  state.production.splice(idx, 1);
  return { goodId: entry.recipeId, qty: given + bonusQty, tier: tier ? tier.id : null };
}

/** Skip a timer with diamonds (uses economy.skipCost). `target` is any object carrying a
 *  readyAt (a field, a pen, or a state.production queue entry). */
export function skipTimer(target) {
  if (!target || typeof target.readyAt !== 'number') return false;
  const now = Date.now();
  if (target.readyAt <= now) return false; // already ready — nothing to skip
  const remainingSeconds = Math.ceil((target.readyAt - now) / 1000);
  const cost = economy.skipCost(remainingSeconds);
  if (!economy.spendDiamonds(cost)) return false;
  target.readyAt = now;
  return true;
}

/**
 * Advance all timers; called every frame and once on load with offline elapsed time.
 * Every readyAt in this game is an absolute timestamp compared against `now` at the point of
 * use (growthStage/harvest/collectPen/collectBuilding all take `now` too), so nothing here
 * actually needs to mutate state to "catch up" — comparing a readyAt from days ago against
 * the current `now` already resolves correctly, offline or not. tick() is the single place
 * that reports what is ready right now, so callers (the renderer, the UI dock) do not have
 * to re-walk state.farm.objects and state.production themselves every frame.
 */
export function tick(now = Date.now()) {
  const readyFields = state.farm.objects
    .filter((o) => o.kind === 'field' && o.cropId && o.readyAt !== null && o.readyAt <= now)
    .map((o) => o.id);
  const readyPens = state.farm.objects
    .filter((o) => o.kind === 'pen' && o.readyAt !== null && o.readyAt <= now)
    .map((o) => o.id);
  const readyBuildings = [...new Set(
    state.production.filter((p) => p.readyAt <= now).map((p) => p.objectId),
  )];
  return { now, readyFields, readyPens, readyBuildings };
}
