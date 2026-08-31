// newspaper.js — browse simulated neighbours' roadside shops (L7).
//
// Counterintuitively the biggest dead-time sink in the genre: it costs nothing to read,
// refreshes endlessly, and is pure browsing. It is also the supply valve - when one missing
// input blocks a recipe, buying it beats waiting out a grow timer.
//
// Farms and sellers come from neighbours.js. Nothing here is networked; the game is
// offline-first and stays so.
// State: state.newspaper { issueId, generatedAt, listings: [{ id, neighbourId, item, qty, price, bargain }] }

import { state } from './state.js';
import { NEWSPAPER, CROPS, GOODS, MATERIALS } from './data.js';
import * as economy from './economy.js';
import * as neighbours from './neighbours.js';

let nextListingId = 1;
function freshId() { return `listing_${nextListingId++}_${Date.now().toString(36)}`; }

function randomQty([lo, hi]) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
function randomInRange([lo, hi]) { return lo + Math.random() * (hi - lo); }

function barnRoom() {
  const used = Object.values(state.barn.items).reduce((a, b) => a + b, 0);
  return Math.max(0, state.barn.capacity - used);
}

/** Every sellable item id (crops, goods, materials) that could plausibly show up as a listing. */
function sellableItemIds() {
  return [
    ...Object.keys(CROPS || {}),
    ...Object.keys(GOODS || {}),
    ...Object.keys(MATERIALS || {}),
  ];
}

/**
 * Generate one issue's listings. Never invents its own farms/sellers — every listing is
 * attached to a real neighbour from neighbours.js, so the same person never appears twice
 * with two different identities across newspaper and co-op/regatta.
 */
function generateIssue(now) {
  const farms = (typeof neighbours.sample === 'function'
    ? neighbours.sample(NEWSPAPER.farmsPerIssue, `newspaper:${state.newspaper.issueId + 1}`)
    : null) || [];
  const items = sellableItemIds();
  const listings = [];

  for (const farmEntry of farms) {
    const neighbourId = farmEntry?.id ?? farmEntry;
    if (!neighbourId) continue;
    const count = randomQty(NEWSPAPER.listingsPerFarm);
    for (let i = 0; i < count; i++) {
      if (items.length === 0) break;
      const itemId = items[Math.floor(Math.random() * items.length)];
      const base = economy.sellValue(itemId);
      if (!(base > 0)) continue;
      const bargain = Math.random() < NEWSPAPER.bargainChance;
      const mult = bargain ? randomInRange(NEWSPAPER.bargainBand) : randomInRange(NEWSPAPER.priceBand);
      const price = Math.max(1, Math.round(base * mult));
      listings.push({
        id: freshId(),
        neighbourId,
        item: itemId,
        qty: randomQty([1, 10]),
        price,
        bargain,
      });
    }
  }

  state.newspaper.issueId += 1;
  state.newspaper.generatedAt = now;
  state.newspaper.listings = listings;
  return state.newspaper;
}

/** The current issue, regenerating if it is older than NEWSPAPER.refreshMinutes. */
export function currentIssue(now) {
  const staleAfter = NEWSPAPER.refreshMinutes * 60 * 1000;
  if (state.newspaper.generatedAt === 0 || now - state.newspaper.generatedAt >= staleAfter) {
    generateIssue(now);
  }
  return state.newspaper;
}

/** Force a refresh. */
export function refresh(now) {
  return generateIssue(now);
}

/** Buy a listing; pays coins and puts the goods in the barn. Respects barn capacity. */
export function buy(listingId) {
  const idx = state.newspaper.listings.findIndex((l) => l.id === listingId);
  if (idx === -1) return false;
  const listing = state.newspaper.listings[idx];

  const room = barnRoom();
  if (room <= 0) return false;
  const qty = Math.min(listing.qty, room);
  const cost = Math.round(listing.price * (qty / listing.qty));
  if (state.coins < cost) return false;

  try {
    economy.addCoins(-cost);
  } catch {
    return false;
  }
  state.barn.items[listing.item] = (state.barn.items[listing.item] || 0) + qty;

  if (qty >= listing.qty) {
    state.newspaper.listings.splice(idx, 1);
  } else {
    listing.qty -= qty;
    listing.price -= cost;
  }
  return true;
}

/** Listings matching an item id, for "who is selling what I need". */
export function findItem(itemId) {
  return state.newspaper.listings.filter((l) => l.item === itemId);
}

/** Advance the refresh timer; called from the game loop. */
export function tick(now) {
  currentIssue(now);
}
