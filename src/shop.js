// shop.js — the roadside shop stand: list items at a chosen price, they sell on a timer.
// Cheaper listings sell faster: sellTime = SHOP.sellTimeBase * (price / maxPrice), min 15s.
// Simulated "visitors" — no networking.

/** List `qty` of `itemId` at `price` (clamped to SHOP.priceBand of base value) in a free slot. */
export function list(itemId, qty, price) { /* Phase B */ }

/** Cancel a listing, returning items to storage. */
export function cancel(slotIndex) { /* Phase B */ }

/** Collect coins from a sold listing. */
export function collect(slotIndex) { /* Phase B */ }

/** Advance sale timers; occasionally spawns an NPC premium offer (extras.js visitor). */
export function tick(now) { /* Phase B */ }
