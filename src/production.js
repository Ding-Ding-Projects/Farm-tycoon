// production.js — all timed work: crop growth, animal feeding/collection, building queues.
// Every timer is an absolute `readyAt` timestamp; tick() resolves anything past due,
// including everything that finished while the game was closed (resolved on load).

import { state } from './state.js';
import { CROPS, ANIMALS, BUILDINGS } from './data.js';
import * as economy from './economy.js';

// Materials (data.js MATERIALS) have no dedicated bucket — see the NOTE in state.js. Any
// input/output id that is not a crop lives in the barn, materials included.
function isCrop(id) { return Object.prototype.hasOwnProperty.call(CROPS, id); }
function stockOf(id) { return isCrop(id) ? state.silo.items : state.barn.items; }
function totalCount(items) { return Object.values(items).reduce((a, b) => a + b, 0); }
function siloRoom() { return Math.max(0, state.silo.capacity - totalCount(state.silo.items)); }
function barnRoom() { return Math.max(0, state.barn.capacity - totalCount(state.barn.items)); }

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
  field.readyAt = now + crop.growTime * 1000;
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

/** Harvest a ready field: +2x seeds to silo (capacity permitting), +XP, sparkle effect. */
export function harvest(fieldId, now = Date.now()) {
  const field = findField(fieldId);
  if (!field || !field.cropId || field.readyAt === null || now < field.readyAt) return null;
  const crop = CROPS[field.cropId];
  const cropId = field.cropId;
  const yieldQty = crop.seedCost * 2; // Hay Day rule: harvest returns 2x the planted seed
  const given = Math.min(yieldQty, siloRoom());

  if (given > 0) state.silo.items[cropId] = (state.silo.items[cropId] || 0) + given;
  economy.addXp(crop.xp);
  economy.trackStat('cropsHarvested', 1);

  field.cropId = null;
  field.plantedAt = null;
  field.readyAt = null;
  return { cropId, qty: given };
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
  pen.readyAt = Date.now() + animal.produceTime * 1000;
  return true;
}

/** Collect ready animal products into the barn. */
export function collectPen(penId, now = Date.now()) {
  const pen = findPen(penId);
  if (!pen || pen.readyAt === null || now < pen.readyAt) return null;
  const animal = ANIMALS[pen.type];
  const qty = animal.capacity;
  const given = Math.min(qty, barnRoom());
  if (given === 0) return null; // barn full — leave the pen ready, collect once there is room

  state.barn.items[animal.product] = (state.barn.items[animal.product] || 0) + given;
  economy.addXp(animal.xp);
  economy.trackStat('goodsProduced', given);
  pen.readyAt = null;
  return { product: animal.product, qty: given };
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

  state.production.push({ objectId: buildingId, recipeId, readyAt: Date.now() + recipe.time * 1000 });
  return true;
}

/** Collect a finished queue slot's output into the barn. */
export function collectBuilding(buildingId, now = Date.now()) {
  const idx = state.production.findIndex((p) => p.objectId === buildingId && p.readyAt <= now);
  if (idx === -1) return null;
  const entry = state.production[idx];
  const building = findBuilding(buildingId);
  const def = building && BUILDINGS[building.type];
  const recipe = def && def.recipes.find((r) => r.id === entry.recipeId);
  if (!recipe) return null;

  const given = Math.min(1, barnRoom()); // one crafted unit per queue slot
  if (given === 0) return null; // barn full — leave the entry queued, collect once there is room

  state.barn.items[entry.recipeId] = (state.barn.items[entry.recipeId] || 0) + given;
  economy.addXp(recipe.xp);
  economy.trackStat('goodsProduced', given);
  state.production.splice(idx, 1);
  return { goodId: entry.recipeId, qty: given };
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
