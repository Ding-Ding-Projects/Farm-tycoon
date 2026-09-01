// farm.js — the farm grid model: tiles, object placement, footprints, expansion.
// Grid is FARM.gridSize² logical tiles rendered isometrically (2:1 diamonds) by render/renderer.js.
// Objects: {id, kind: 'field'|'building'|'pen'|'decoration'|'pond'|'mine', type, x, y}
// occupying a [w,h] footprint from data.js sizes.

import { state } from './state.js';
import { FARM, BUILDINGS, DECORATIONS, ANIMALS, STRUCTURES } from './data.js';
import * as economy from './economy.js';
import * as storage from './storage.js';

let nextObjectId = 1;
function freshId() { return `obj_${nextObjectId++}_${Date.now().toString(36)}`; }

/**
 * Footprint lookup. Fields are always 1x1; buildings/decorations/structures carry an
 * explicit [w,h] in data.js. Animal pens have no size field in data.js (ANIMALS only
 * defines pen economy, not pen geometry), so pens default to a fixed 2x2 footprint here —
 * a farm.js-local rendering/placement decision, not invented game content.
 *
 * EXPORTED and shared: placement.js, decorate.js and main.js's buildWorld() all used to carry
 * their own copy with subtly different fallbacks (`penSize` vs `size`, [2,2] vs [1,1]), which
 * agreed only by accident. One function, so the ghost, the legality check, the move validator
 * and the renderer can never disagree about how big a thing is.
 */
export function footprintOf(kind, type) {
  if (kind === 'field') return [1, 1];
  if (kind === 'building') return BUILDINGS[type]?.size ?? [1, 1];
  if (kind === 'decoration') return DECORATIONS[type]?.size ?? [1, 1];
  if (kind === 'pen') return ANIMALS[type]?.size ?? [2, 2];
  if (STRUCTURES[type]) return STRUCTURES[type].size;
  return [1, 1];
}

/**
 * A pen's price is the enclosure PLUS its animals: ANIMALS[x].penCost + animalCost for each of
 * its `capacity` heads. animalCost sat in data.js unread, so every pen came fully stocked for
 * the price of the fence (a turkey run's three 2,800-coin birds were free).
 */
export function penPrice(type) {
  const a = ANIMALS[type];
  if (!a) return 0;
  return (a.penCost ?? 0) + (a.animalCost ?? 0) * (a.capacity ?? 0);
}

export function costOf(kind, type) {
  if (kind === 'field') return FARM.fieldCost;
  if (kind === 'building') return BUILDINGS[type]?.cost ?? 0;
  if (kind === 'decoration') return DECORATIONS[type]?.cost ?? 0;
  if (kind === 'pen') return penPrice(type);
  return 0;
}

/** Extra runtime fields a freshly placed object of this kind needs (timers etc). */
function initialExtra(kind, type) {
  if (kind === 'field') return { cropId: null, plantedAt: null, readyAt: null };
  if (kind === 'pen') return { readyAt: null };
  return {};
}

/** Is a tile inside any unlocked zone? */
export function isUnlockedTile(x, y) {
  for (const zoneId of state.farm.unlockedZones) {
    const rect = zoneId === 'start'
      ? FARM.startZone
      : FARM.expansions.find((e) => e.id === zoneId)?.rect;
    if (rect && x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h) return true;
  }
  return false;
}

function rectInUnlockedLand(x, y, w, h) {
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      if (!isUnlockedTile(tx, ty)) return false;
    }
  }
  return true;
}

function rectOverlapsAnyObject(x, y, w, h, ignoreId) {
  for (const obj of state.farm.objects) {
    if (obj.id === ignoreId) continue;
    const [ow, oh] = footprintOf(obj.kind, obj.type);
    const overlaps = x < obj.x + ow && x + w > obj.x && y < obj.y + oh && y + h > obj.y;
    if (overlaps) return true;
  }
  return false;
}

/** Is the rect free (inside an unlocked zone, no overlapping object)? */
export function canPlace(x, y, w, h) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || w <= 0 || h <= 0) return false;
  if (x < 0 || y < 0 || x + w > FARM.gridSize || y + h > FARM.gridSize) return false;
  if (!rectInUnlockedLand(x, y, w, h)) return false;
  if (rectOverlapsAnyObject(x, y, w, h, null)) return false;
  return true;
}

/** Place a new object; deducts cost via economy.addCoins. Returns the object or null. */
export function place(kind, type, x, y) {
  const [w, h] = footprintOf(kind, type);
  if (!canPlace(x, y, w, h)) return null;

  if (kind === 'decoration') {
    if (!payForDecoration(type)) return null;
  } else {
    const cost = costOf(kind, type);
    if (cost > 0) {
      try {
        economy.addCoins(-cost);
      } catch {
        return null; // insufficient coins — nothing was ever mutated, so nothing to refund
      }
    }
  }

  const obj = { id: freshId(), kind, type, x, y, ...initialExtra(kind, type) };
  state.farm.objects.push(obj);
  // A new pen comes with one feeding in the barn (what fits), so "feed your animals" is possible
  // before the feed mill (L5) exists - the tutorial asks for exactly that with the level-2 coop.
  if (kind === 'pen') {
    const animal = ANIMALS[type];
    if (animal?.feed) storage.add(animal.feed, animal.capacity);
  }
  return obj;
}

/**
 * How a decoration is paid for, in priority order: an OWNED one (a reward from the regatta, an
 * event, the museum or the Fair Pass) is free and consumes the owned count; a voucher-priced one
 * spends boat vouchers; a coin-priced one spends coins. Anything with no price at all (the event,
 * co-op, regatta and museum exclusives) can only ever be placed from the owned count. Returns
 * false, having spent nothing, when it cannot be paid for.
 */
function payForDecoration(type) {
  const def = DECORATIONS[type];
  if (!def) return false;
  const owned = state.decorate?.owned || {};
  if ((owned[type] || 0) > 0) {
    owned[type] -= 1;
    return true;
  }
  if (def.voucherCost > 0) {
    if ((state.vouchers || 0) < def.voucherCost) return false;
    state.vouchers -= def.voucherCost;
    return true;
  }
  if (def.cost > 0) {
    try { economy.addCoins(-def.cost); } catch { return false; }
    return true;
  }
  return false;
}

/** Move an existing object to a new position if free (edit mode). */
export function move(objectId, x, y) {
  const obj = state.farm.objects.find((o) => o.id === objectId);
  if (!obj) return false;
  const [w, h] = footprintOf(obj.kind, obj.type);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x + w > FARM.gridSize || y + h > FARM.gridSize) return false;
  if (!rectInUnlockedLand(x, y, w, h)) return false;
  if (rectOverlapsAnyObject(x, y, w, h, objectId)) return false;
  obj.x = x;
  obj.y = y;
  return true;
}

/** Sell/remove a decoration or field (refunds a fraction of cost). */
export function remove(objectId) {
  const idx = state.farm.objects.findIndex((o) => o.id === objectId);
  if (idx === -1) return false;
  const obj = state.farm.objects[idx];
  const cost = costOf(obj.kind, obj.type);
  state.farm.objects.splice(idx, 1);
  if (cost > 0) economy.addCoins(Math.floor(cost * 0.5)); // refund half — cannot go negative
  return true;
}

/** Object at a tile, if any (for input picking). */
export function objectAt(x, y) {
  for (const obj of state.farm.objects) {
    const [w, h] = footprintOf(obj.kind, obj.type);
    if (x >= obj.x && x < obj.x + w && y >= obj.y && y < obj.y + h) return obj;
  }
  return null;
}

/** Buy an expansion zone by id (level-gated, costs coins). Unlocks its tiles. */
export function buyExpansion(id) {
  const exp = FARM.expansions.find((e) => e.id === id);
  if (!exp) return false;
  if (state.farm.unlockedZones.includes(id)) return false;
  if (!economy.isUnlocked(id)) return false;
  if (state.coins < exp.cost) return false;
  for (const [mat, qty] of Object.entries(exp.materials)) {
    if ((state.barn.items[mat] || 0) < qty) return false;
  }

  // Verified above, so the deduction below can never fail partway through.
  economy.addCoins(-exp.cost);
  for (const [mat, qty] of Object.entries(exp.materials)) {
    state.barn.items[mat] -= qty;
  }
  state.farm.unlockedZones.push(id);
  return true;
}

/** Zones adjacent to unlocked land that are purchasable at the current level (for UI). */
export function availableExpansions() {
  return FARM.expansions.filter(
    (e) => !state.farm.unlockedZones.includes(e.id) && economy.isUnlocked(e.id),
  );
}
