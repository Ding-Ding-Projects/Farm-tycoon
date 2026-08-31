// farm.js — the farm grid model: tiles, object placement, footprints, expansion.
// Grid is FARM.gridSize² logical tiles rendered isometrically (2:1 diamonds) by render/renderer.js.
// Objects: {id, kind: 'field'|'building'|'pen'|'decoration'|'pond'|'mine', type, x, y}
// occupying a [w,h] footprint from data.js sizes.

/** Is the rect free (inside an unlocked zone, no overlapping object)? */
export function canPlace(x, y, w, h) { /* Phase B */ }

/** Place a new object; deducts cost via economy.addCoins. Returns the object or null. */
export function place(kind, type, x, y) { /* Phase B */ }

/** Move an existing object to a new position if free (edit mode). */
export function move(objectId, x, y) { /* Phase B */ }

/** Sell/remove a decoration or field (refunds a fraction of cost). */
export function remove(objectId) { /* Phase B */ }

/** Object at a tile, if any (for input picking). */
export function objectAt(x, y) { /* Phase B */ }

/** Is a tile inside any unlocked zone? */
export function isUnlockedTile(x, y) { /* Phase B */ }

/** Buy an expansion zone by id (level-gated, costs coins). Unlocks its tiles. */
export function buyExpansion(id) { /* Phase B */ }

/** Zones adjacent to unlocked land that are purchasable at the current level (for UI). */
export function availableExpansions() { /* Phase B */ }
