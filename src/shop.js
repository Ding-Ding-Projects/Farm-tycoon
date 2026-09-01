// shop.js — the roadside shop stand: list items at a chosen price, they sell on a timer.
// Cheaper listings sell faster: sellTime = SHOP.sellTimeBase * (price / maxPrice), min 15s.
// Simulated "visitors" — no networking.

import { state } from './state.js';
import { SHOP, MARKET, CROPS, GOODS, MATERIALS } from './data.js';
import * as economy from './economy.js';
import * as storage from './storage.js';

const MIN_SELL_TIME = 15; // seconds — a listing always takes at least this long, however cheap

function baseValue(itemId) {
  return CROPS[itemId]?.sellPrice ?? GOODS[itemId]?.sellPrice ?? MATERIALS[itemId]?.sellPrice ?? 0;
}

function priceBounds(itemId) {
  const base = baseValue(itemId);
  const [minMult, maxMult] = SHOP.priceBand;
  return { min: base * minMult, max: base * maxMult };
}

function stockBucket(itemId) { return CROPS[itemId] ? state.silo.items : state.barn.items; }

function ensureShopState() {
  if (!state.shop || !Array.isArray(state.shop.listings)) state.shop = { listings: [] };
  return state.shop;
}

/** List `qty` of `itemId` at `price` (clamped to SHOP.priceBand of base value) in a free slot. */
export function list(itemId, qty, price) {
  if (state.level < SHOP.unlockLevel) return false;
  if (!Number.isInteger(qty) || qty <= 0) return false;
  const base = baseValue(itemId);
  if (base <= 0) return false; // not a sellable item id

  const shop = ensureShopState();
  const usedSlots = shop.listings.filter((l) => l !== null).length;
  if (usedSlots >= SHOP.slots) return false;
  const emptyIndex = shop.listings.findIndex((l) => l === null);
  const slotIndex = emptyIndex === -1 ? shop.listings.length : emptyIndex;
  if (slotIndex >= SHOP.slots) return false;

  const bucket = stockBucket(itemId);
  if ((bucket[itemId] || 0) < qty) return false;

  const { min, max } = priceBounds(itemId);
  const clampedPrice = Math.min(max, Math.max(min, price));

  bucket[itemId] -= qty;

  const now = Date.now();
  const frac = max > min ? (clampedPrice - min) / (max - min) : 1; // 0 = cheapest, 1 = priciest
  // Cheaper listings sell faster: at the price floor sellTime shrinks toward MIN_SELL_TIME
  // (subject to the floor), at the price ceiling it is the full sellTimeBase.
  const sellTime = Math.max(MIN_SELL_TIME, Math.round(SHOP.sellTimeBase * (0.15 + frac * 0.85)));

  while (shop.listings.length <= slotIndex) shop.listings.push(null);
  shop.listings[slotIndex] = {
    itemId, qty, price: Math.round(clampedPrice), listedAt: now,
    readyAt: now + sellTime * 1000, sold: false,
  };
  return true;
}

/** Cancel a listing, returning items to storage. */
export function cancel(slotIndex) {
  const shop = ensureShopState();
  const listing = shop.listings[slotIndex];
  if (!listing || listing.sold) return false;
  const bucket = stockBucket(listing.itemId);
  bucket[listing.itemId] = (bucket[listing.itemId] || 0) + listing.qty;
  shop.listings[slotIndex] = null;
  return true;
}

/** Collect coins from a sold listing. */
export function collect(slotIndex) {
  const shop = ensureShopState();
  const listing = shop.listings[slotIndex];
  if (!listing || !listing.sold) return false;
  economy.addCoins(listing.price * listing.qty);
  economy.trackStat('shopSales', listing.qty);
  shop.listings[slotIndex] = null;
  return true;
}

/** Advance sale timers; occasionally spawns an NPC premium offer (extras.js visitor). */
export function tick(now = Date.now()) {
  const shop = ensureShopState();
  for (const listing of shop.listings) {
    if (listing && !listing.sold && now >= listing.readyAt) listing.sold = true;
  }
}

// ---- Market trader (Township layer, L9; MARKET in data.js) ----
// A daily stall: MARKET.slots offers drawn deterministically from the day number
// (goods at priceMultiplier over base, ~25% construction materials), each buyable once
// per day; restocks at MARKET.refreshHourLocal.

const MS_PER_DAY = 86400000;

/** The market's "day number" for `now`, rolling over at MARKET.refreshHourLocal local time. */
function marketDayNumber(now) {
  const d = new Date(now);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  local.setUTCHours(local.getUTCHours() - MARKET.refreshHourLocal);
  return Math.floor(local.getTime() / MS_PER_DAY);
}

// Small deterministic PRNG (mulberry32) seeded by the day number, so every call for the same
// day produces the identical offer list without persisting the roll itself.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function marketPoolForDay(rng, index) {
  // Kits and components are the crafting spine, never stall goods.
  const goodIds = Object.keys(GOODS).filter((id) => !economy.isWorkshopCraft(id));
  const materialIds = Object.keys(MATERIALS);
  const wantsMaterial = rng() < MARKET.materialChance && materialIds.length > 0;
  const pool = wantsMaterial ? materialIds : goodIds;
  const itemId = pool[Math.floor(rng() * pool.length) % pool.length];
  const qty = 1 + Math.floor(rng() * 5); // 1..5
  const base = baseValue(itemId);
  // The offer's price is for the whole bundle: base x priceMultiplier PER UNIT, times qty. It
  // used to be one unit's price for up to five units, i.e. below the barn's own sell price.
  const price = Math.max(qty, Math.round(base * MARKET.priceMultiplier * qty));
  return { item: itemId, qty, price };
}

function generateMarketDay(now) {
  const dayNum = marketDayNumber(now);
  const rng = mulberry32(dayNum);
  const offers = [];
  for (let i = 0; i < MARKET.slots; i++) offers.push(marketPoolForDay(rng, i));
  return { dayNum, offers };
}

function ensureMarketState(now) {
  if (!state.market || typeof state.market !== 'object') state.market = { dayNum: -1, offers: [], bought: [] };
  const dayNum = marketDayNumber(now);
  if (state.market.dayNum !== dayNum) {
    const fresh = generateMarketDay(now);
    state.market = { dayNum: fresh.dayNum, offers: fresh.offers, bought: fresh.offers.map(() => false) };
  }
  return state.market;
}

/** Today's market offers with bought flags: [{item, qty, price, bought}]. */
export function marketOffers(now = Date.now()) {
  if (state.level < MARKET.unlockLevel) return [];
  const market = ensureMarketState(now);
  return market.offers.map((o, i) => ({ ...o, bought: market.bought[i] }));
}

/** Buy a market offer (coins → item into silo/barn; respects caps; once per day per slot). */
export function buyOffer(index) {
  if (state.level < MARKET.unlockLevel) return false;
  const now = Date.now();
  const market = ensureMarketState(now);
  const offer = market.offers[index];
  if (!offer || market.bought[index]) return false;
  if (state.coins < offer.price) return false;
  if (storage.roomFor(offer.item) < offer.qty) return false; // never overflow the silo/barn cap

  economy.addCoins(-offer.price);
  storage.add(offer.item, offer.qty);
  market.bought[index] = true;
  return true;
}
