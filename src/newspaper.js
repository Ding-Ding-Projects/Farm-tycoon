// newspaper.js — browse simulated neighbours' roadside shops (L7).
//
// Counterintuitively the biggest dead-time sink in the genre: it costs nothing to read,
// refreshes endlessly, and is pure browsing. It is also the supply valve - when one missing
// input blocks a recipe, buying it beats waiting out a grow timer.
//
// Farms and sellers come from neighbours.js. Nothing here is networked; the game is
// offline-first and stays so.
// State: state.newspaper { issueId, generatedAt, listings: [{ id, neighbourId, item, qty, price, bargain }] }

/** The current issue, regenerating if it is older than NEWSPAPER.refreshMinutes. */
export function currentIssue(now) { /* Phase B */ }

/** Force a refresh. */
export function refresh(now) { /* Phase B */ }

/** Buy a listing; pays coins and puts the goods in the barn. Respects barn capacity. */
export function buy(listingId) { /* Phase B */ }

/** Listings matching an item id, for "who is selling what I need". */
export function findItem(itemId) { /* Phase B */ }

/** Advance the refresh timer; called from the game loop. */
export function tick(now) { /* Phase B */ }
