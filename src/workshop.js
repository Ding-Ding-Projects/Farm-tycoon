// workshop.js — the Building Workshop (L6): the spine of progression. Coins alone never place
// a production building. Raw MATERIALS become components here, components become a building
// kit, and the kit is consumed to place its factory (BUILDINGS[x].kit).
//
// This is why trains, the airport and the helicopter exist: they are the material channels, and
// without a sink for what they deliver they would be flavour. It also means the late game is a
// logistics problem rather than a coin balance.
//
// Uses the ordinary production queue - a workshop is a BUILDINGS entry with recipes, so there is
// no second production system here, only the placement rules on top. Crafting therefore
// delegates to production.enqueue/tick for the actual timers, and this module only adds the
// workshop-specific views (available/canCraft) and the kit-gates placement leans on.
// State: state.workshop { queue: [{ recipeId, readyAt }], kits: { kitId: qty } }

import { state } from './state.js';
import { BUILDINGS } from './data.js';
import * as economy from './economy.js';
import * as production from './production.js';
import * as collections from './collections.js';

function def() {
  return BUILDINGS.build_workshop;
}

/** The single placed Building Workshop instance, or null if it has not been built yet. */
function findWorkshop() {
  return state.farm.objects.find((o) => o.kind === 'building' && o.type === 'build_workshop') || null;
}

/** This workshop's own queue entries, in the order they were crafted. */
function queueEntries(workshop) {
  return state.production.filter((p) => p.objectId === workshop.id);
}

function recipeOf(recipeId) {
  return def().recipes.find((r) => r.id === recipeId) || null;
}

/** Component and kit recipes currently craftable (level, materials and unlocks permitting). */
export function available() {
  return def().recipes
    .filter((r) => economy.isUnlocked(r.id))
    .map((r) => ({ ...r, craftable: canCraft(r.id) }));
}

/** Whether the player holds every input for this recipe right now. */
export function canCraft(recipeId) {
  const workshop = findWorkshop();
  if (!workshop) return false;
  const recipe = recipeOf(recipeId);
  if (!recipe) return false;
  if (!economy.isUnlocked(recipeId)) return false;

  const activeCount = queueEntries(workshop).length;
  if (activeCount >= def().queueSlots) return false;

  for (const [inputId, qty] of Object.entries(recipe.inputs)) {
    if ((state.barn.items[inputId] || 0) < qty) return false;
  }
  return true;
}

/** Start crafting; consumes inputs up front. Refunds in full if the queue push fails. */
export function craft(recipeId) {
  const workshop = findWorkshop();
  if (!workshop) return false;
  // canCraft already re-checks level/unlock/queue-room/inputs, so a failure here means
  // nothing is consumed at all — production.enqueue itself never partially consumes either
  // (it verifies every input before touching any of them).
  if (!canCraft(recipeId)) return false;
  return production.enqueue(workshop.id, recipeId);
}

/** Advance the queue; called from the game loop. */
export function tick(now = Date.now()) {
  return production.tick(now);
}

/** Collect a finished component or kit into the barn. `index` selects among this workshop's
 *  own queue entries (in craft order), so the UI can offer several finished slots at once. */
export function collect(index) {
  const workshop = findWorkshop();
  if (!workshop) return null;
  const entries = queueEntries(workshop);
  const entry = entries[index];
  if (!entry) return null;
  const now = Date.now();
  if (entry.readyAt > now) return null; // not finished yet — nothing to collect

  const recipe = recipeOf(entry.recipeId);
  if (!recipe) return null;

  const used = Object.values(state.barn.items).reduce((a, b) => a + b, 0);
  const room = Math.max(0, state.barn.capacity - used);
  const given = Math.min(1, room);
  if (given === 0) return null; // barn full — leave it queued, collect once there is room

  state.barn.items[entry.recipeId] = (state.barn.items[entry.recipeId] || 0) + given;
  // The Workshop has its own minigame (workshop_fit) like every other production building —
  // spend a finished run's bonus at this same collection point, through production.js's own
  // helper rather than a second copy of the *Mult/chance-of-a-bonus-unit logic.
  const { xp, bonusQty } = production.applyMinigameBonus(workshop.id, entry.recipeId, recipe.xp);
  economy.addXp(xp);
  economy.trackStat('goodsProduced', given + bonusQty);
  collections.recordMake(workshop.id);

  const idx = state.production.indexOf(entry);
  if (idx !== -1) state.production.splice(idx, 1);

  return { goodId: entry.recipeId, qty: given + bonusQty };
}

/** Whether a kit for this building is held and the building may therefore be placed. */
export function hasKitFor(buildingId) {
  const building = BUILDINGS[buildingId];
  if (!building || !building.kit) return true; // no kit required (e.g. feed_mill, bakery)
  return (state.barn.items[building.kit] || 0) >= 1;
}

/** Consume the kit as part of placing the building. Never consumes on a failed placement:
 *  it only ever decrements when a whole kit is actually held, and returns false otherwise
 *  without touching the barn at all. */
export function consumeKit(buildingId) {
  const building = BUILDINGS[buildingId];
  if (!building || !building.kit) return true; // nothing to consume — always "succeeds"
  if (!hasKitFor(buildingId)) return false;
  state.barn.items[building.kit] -= 1;
  return true;
}
