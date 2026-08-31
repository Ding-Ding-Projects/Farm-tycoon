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

// ---- Market trader (Township layer, L9; MARKET in data.js) ----
// A daily stall: MARKET.slots offers drawn deterministically from the day number
// (goods at priceMultiplier over base, ~25% construction materials), each buyable once
// per day; restocks at MARKET.refreshHourLocal.

/** Today's market offers with bought flags: [{item, qty, price, bought}]. */
export function marketOffers(now) { /* Phase B */ }

/** Buy a market offer (coins → item into silo/barn; respects caps; once per day per slot). */
export function buyOffer(index) { /* Phase B */ }
