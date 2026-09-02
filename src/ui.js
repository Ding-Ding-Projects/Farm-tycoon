// ui.js — all DOM: HUD, dock, sheet panels, radial menu, toasts, modals.
// Canvas (renderer.js) draws only the world; everything a player reads or taps that isn't a
// physical object in the world lives here. Panels are opened generically by id (STRUCTURES[x]
// .panel names them) so input.js never needs a big switch of its own.

import { state, save } from './state.js';
import * as economy from './economy.js';
import * as farm from './farm.js';
import * as production from './production.js';
import * as orders from './orders.js';
import * as shop from './shop.js';
import * as boat from './boat.js';
import * as fishing from './fishing.js';
import * as mine from './mine.js';
import * as merge from './merge.js';
import * as town from './town.js';
import * as trains from './trains.js';
import * as zoo from './zoo.js';
import * as extras from './extras.js';
import * as coop from './coop.js';
import * as regatta from './regatta.js';
import * as expeditions from './expeditions.js';
import * as museum from './museum.js';
import * as lab from './lab.js';
import * as helicopter from './helicopter.js';
import * as islands from './islands.js';
import * as newspaper from './newspaper.js';
import * as collections from './collections.js';
import * as neighbours from './neighbours.js';
import * as decorate from './decorate.js';
import * as bakebook from './bakebook.js';
import * as panelsearch from './panelsearch.js';
import * as audio from './audio.js';
import * as tutorial from './tutorial.js';
import * as workshop from './workshop.js';
import * as minigames from './minigames.js';
import * as placement from './placement.js';
import {
  CROPS, ANIMALS, BUILDINGS, GOODS, STRUCTURES, MATERIALS, LEVELS, FARM, QUALITY,
  ISLANDS, MERGE, TOWN, ZOO, HELICOPTER, LAB, MUSEUM, ARTIFACTS, EXPEDITIONS,
  COOP, REGATTA, PHOTO, PETS, ACHIEVEMENTS, SHOP, COLLECTIONS,
} from './data.js';

// ---------------------------------------------------------------------------
// DOM refs, wired in init()
// ---------------------------------------------------------------------------
let el = {};
let radialTarget = null; // context passed to the currently-open radial menu's callbacks

function q(id) { return document.getElementById(id); }

function itemName(id) {
  return CROPS[id]?.name || GOODS[id]?.name || ANIMALS[id]?.name || MATERIALS[id]?.name || ARTIFACTS[id]?.name || id;
}
function itemIcon(id) {
  return CROPS[id]?.icon || GOODS[id]?.icon || ANIMALS[id]?.icon || MATERIALS[id]?.icon || (ARTIFACTS[id] ? '🏺' : '❔');
}

/** Which bucket a given item id lives in — crops sit in the silo, everything else (goods AND
 *  raw MATERIALS) sits in the barn. Mirrors production.js's own stockOf(), which isn't
 *  exported; kept identical on purpose so the UI never disagrees with what enqueue() checks. */
function stockOf(id) {
  return CROPS[id] ? state.silo.items : state.barn.items;
}

/** Current stock of an item id wherever it actually lives (silo or barn). */
function stockCount(id) {
  return stockOf(id)[id] || 0;
}

/** mm:ss / h:mm style countdown text for a millisecond duration. Never negative. */
function fmtDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Small inline progress-bar HTML, reusing the same classes the event banner already uses. */
function progressBarHtml(frac) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  return `<div class="event-progress"><div class="event-progress-fill" style="width:${Math.round(clamped * 100)}%"></div></div>`;
}

/** Call a backend module's own tick(now), defensively — a broken/missing tick must never take
 *  a panel down with it. main.js's loop now ticks lab/newspaper/coop/helicopter/regatta itself
 *  (see its tickAllSystems), so this is only still called for regatta's render path (kept for
 *  on-demand freshness when its panel opens between the loop's own 5-minute throttled ticks —
 *  see the comment at that one remaining call site for why it is safe rather than a double
 *  tick). Left generic/exported-shape rather than deleted so a future render-time need has
 *  somewhere to reach for the same defensive wrapper. */
function safeTick(fn, now) {
  try { if (typeof fn === 'function') fn(now); } catch (e) { console.error(e); }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
let lastHud = null;

/** Show/hide dock buttons whose feature isn't reachable yet. Cheap enough to run every frame. */
function syncDockVisibility() {
  if (!el.dock) return;
  const coopBtn = findDockButton('coop');
  if (coopBtn) coopBtn.hidden = state.level < COOP.unlockLevel;
}

function findDockButton(panelId) {
  if (!el.dock) return null;
  return Array.from(el.dock.children || []).find((b) => b?.dataset?.panel === panelId) || null;
}

/**
 * Short form for a HUD counter: 1,234 stays as it is, 999,549 becomes 999.5k.
 *
 * Measured on a real phone rather than guessed at. On a 412px screen with six-digit coins the
 * four counter pills came to 414px and the barn pill's right edge landed at 461px, so 49px of it
 * was simply off the side of the display. A million coins is ordinary mid-game play, not an edge
 * case, and no amount of shrinking four pills makes a seven-digit number fit beside three others.
 *
 * Exact values below 100,000, because that is the range where a player is actually counting.
 */
function compactCount(n) {
  const v = Math.floor(Number(n) || 0);
  if (Math.abs(v) < 100000) return v.toLocaleString();
  if (Math.abs(v) < 1000000) return `${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) < 1000000000) return `${(v / 1000000).toFixed(2)}M`;
  return `${(v / 1000000000).toFixed(2)}B`;
}

export function updateHud() {
  if (!state || !el.coinsValue) return;
  syncDockVisibility();
  const siloUsed = Object.values(state.silo.items).reduce((a, b) => a + b, 0);
  const barnUsed = Object.values(state.barn.items).reduce((a, b) => a + b, 0);
  const level = state.level;
  const cur = LEVELS.xpForLevel ? LEVELS.xpForLevel(level) : (LEVELS.thresholds?.[level] ?? 0);
  const next = LEVELS.xpForLevel ? LEVELS.xpForLevel(level + 1) : (LEVELS.thresholds?.[level + 1] ?? (cur + 100));
  const span = Math.max(1, next - cur);
  const frac = Math.max(0, Math.min(1, (state.xp - cur) / span));

  const key = `${state.coins}|${state.diamonds}|${siloUsed}|${state.silo.capacity}|${barnUsed}|${state.barn.capacity}|${level}|${frac.toFixed(3)}`;
  if (key === lastHud) return;
  lastHud = key;

  el.coinsValue.textContent = compactCount(state.coins);
  el.diamondsValue.textContent = compactCount(state.diamonds);
  el.siloValue.textContent = `${siloUsed}/${state.silo.capacity}`;
  el.barnValue.textContent = `${barnUsed}/${state.barn.capacity}`;
  el.levelNumber.textContent = String(level);

  const ring = el.levelBadge.querySelector('.progress-ring');
  if (ring) {
    const r = 28, c = 2 * Math.PI * r;
    ring.innerHTML = `<circle cx="32" cy="32" r="${r}" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="6"/>
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="#f0b52e" stroke-width="6"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" stroke-linecap="round"
        transform="rotate(-90 32 32)"/>`;
  }
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
export function toast(message, kind = 'info') {
  if (!el.toasts) return;
  const node = document.createElement('div');
  node.className = `toast toast-${kind}`;
  node.textContent = message;
  el.toasts.appendChild(node);
  setTimeout(() => node.classList.add('toast-out'), 2200);
  setTimeout(() => node.remove(), 2600);
}

// ---------------------------------------------------------------------------
// Modal (yes/no confirms, level-up popup, etc.)
// ---------------------------------------------------------------------------
export function openModal(html, onClose) {
  el.modal.hidden = false;
  el.modalCard.innerHTML = html;
  el.modal.onclick = (e) => { if (e.target === el.modal) closeModal(onClose); };
  const closeBtn = el.modalCard.querySelector('[data-close]');
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal(onClose));
  return el.modalCard; // returned so a caller can render a live surface into it
}
export function closeModal(onClose) {
  el.modal.hidden = true;
  el.modalCard.innerHTML = '';
  if (onClose) onClose();
}

// ---------------------------------------------------------------------------
// Radial context menu — used for field plant/harvest and pen feed/collect.
// options: [{ icon, label, locked, sub, onSelect }]
// ---------------------------------------------------------------------------
export function openRadial(screenX, screenY, options, ctx = null) {
  radialTarget = ctx;
  const radial = el.radial;
  radial.innerHTML = '';
  radial.hidden = false;
  const n = options.length;
  const radius = n <= 1 ? 0 : 74;
  options.forEach((opt, i) => {
    const angle = n === 1 ? -Math.PI / 2 : (-Math.PI / 2) + (i / n) * Math.PI * 2;
    const bx = screenX + Math.cos(angle) * radius;
    const by = screenY + Math.sin(angle) * radius;
    const btn = document.createElement('button');
    btn.className = opt.locked ? 'locked' : '';
    btn.style.left = `${bx - 26}px`;
    btn.style.top = `${by - 26}px`;
    btn.title = opt.label || '';
    btn.textContent = opt.icon || '?';
    btn.style.pointerEvents = 'auto';
    if (!opt.locked) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeRadial();
        try { opt.onSelect && opt.onSelect(); } catch (err) { console.error(err); }
      });
    }
    radial.appendChild(btn);
  });
  if (options.length) {
    const label = document.createElement('div');
    label.className = 'radial-label';
    label.style.left = `${screenX}px`;
    label.style.top = `${screenY + radius + 40}px`;
    label.textContent = options[0]?.sub || '';
    radial.appendChild(label);
  }
}
export function closeRadial() {
  if (!el.radial) return;
  el.radial.hidden = true;
  el.radial.innerHTML = '';
  radialTarget = null;
}

// ---------------------------------------------------------------------------
// Sheet panels — the generic system opened by clicking a world structure or a dock button.
// ---------------------------------------------------------------------------
const PANEL_TITLES = {
  orders: 'Order Board', truck: 'Truck', barn: 'Barn', silo: 'Silo', shop: 'Roadside Shop',
  boat: 'Boat Dock', fishing: 'Fishing Lake', mine: 'Mine', merge: 'Merge Meadow',
  market: 'Market Stall', trains: 'Train Station', airport: 'Airport', helicopter: 'Helicopter Pad',
  workshop: 'Building Workshop', museum: 'Museum', lab: 'Laboratory', expeditions: 'Expedition Camp',
  town: 'Town', zoo: 'Zoo', newspaper: 'Newspaper', collections: 'Collections', photo: 'Photo Mode',
  building: 'Building', pen: 'Animal Pen', decorate: 'Decorate', achievements: 'Achievements',
  coop: 'Co-op & Regatta', settings: 'Settings', wheel: 'Daily Wheel', bakebook: 'Bake Book',
};

let openPanelId = null;
let openPanelCtx = null;

export function isPanelOpen() { return !!openPanelId && !el.sheet.hidden; }
export function currentPanel() { return openPanelId; }

export function openPanel(panelId, ctx = null) {
  if (!el.sheet) return;
  openPanelId = panelId;
  openPanelCtx = ctx;
  el.sheetTitle.textContent = PANEL_TITLES[panelId] || panelId;
  el.sheetContent.innerHTML = '';
  el.sheet.hidden = false;
  audio.open();
  renderPanelContent(panelId, ctx);
  window.dispatchEvent(new CustomEvent('panel-opened', { detail: { panelId } }));
}

export function closePanel() {
  if (!el.sheet || el.sheet.hidden) return;
  el.sheet.hidden = true;
  el.sheetContent.innerHTML = '';
  openPanelId = null;
  openPanelCtx = null;
  mergeSelected = null; // transient UI-only selection — never survives leaving the panel
  audio.close();
}

/** Re-render whichever panel is currently open, with the same ctx it was opened with — the
 *  one thing every action button needs after it mutates state (queue a recipe, craft a
 *  component, collect output, place a building) so the player sees the result immediately
 *  instead of a stale panel. */
function refreshPanel() {
  if (!openPanelId || !el.sheet || el.sheet.hidden) return;
  renderPanelContent(openPanelId, openPanelCtx);
}

function row(html) {
  const d = document.createElement('div');
  d.className = 'panel-row';
  d.innerHTML = html;
  return d;
}

function button(label, onClick, opts = {}) {
  const b = document.createElement('button');
  b.className = `btn ${opts.className || ''}`.trim();
  b.textContent = label;
  b.disabled = !!opts.disabled;
  b.addEventListener('click', onClick);
  return b;
}

/** Fallback content for any system whose backing module is still a Phase B stub. */
function renderComingSoon(container, name) {
  const p = document.createElement('p');
  p.className = 'minigame-hint';
  p.textContent = `${name} is being built — check back soon!`;
  container.appendChild(p);
}

/**
 * A standalone hint line under a panel heading.
 *
 * Always a BLOCK. It used to be a span, which was invisible for as long as every panel appended
 * exactly one - and the moment two went in the game ran them together into a single line:
 * "Energy: 99/100Tap a generator to spawn items." Four panels were doing it (merge, lab,
 * expeditions, coop) plus the Bake Book. A span cannot take the vertical margin the class already
 * asks for, so the fix belongs here rather than at five call sites.
 *
 * The inline uses of .minigame-hint are raw <span> in card template strings, not this function, so
 * they are untouched.
 */
function hintEl(text) {
  const s = document.createElement('p');
  s.className = 'minigame-hint';
  s.textContent = text;
  return s;
}

function slotGrid() {
  const grid = document.createElement('div');
  grid.className = 'slot-grid';
  return grid;
}

function renderInventoryGrid(container, items, emptyLabel) {
  const grid = slotGrid();
  const entries = Object.entries(items).filter(([, qty]) => qty > 0);
  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'minigame-hint';
    p.textContent = emptyLabel;
    container.appendChild(p);
    return;
  }
  for (const [id, qty] of entries) {
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = `<span class="icon">${itemIcon(id)}</span><strong>${itemName(id)}</strong><span>x${qty}</span>`;
    const sellPrice = economy.sellValue ? economy.sellValue(id) : null;
    if (sellPrice) {
      card.appendChild(button(`Sell for 🪙${sellPrice}`, () => {
        try {
          const bucket = state.silo.items[id] !== undefined ? state.silo.items : state.barn.items;
          if ((bucket[id] || 0) <= 0) return;
          bucket[id] -= 1;
          economy.addCoins(sellPrice);
          economy.trackStat && economy.trackStat('sold', 1);
          tutorial.emit('sold');
          audio.coin();
          toast(`Sold 1 ${itemName(id)} for 🪙${sellPrice}`, 'success');
          refreshPanel();
        } catch (e) { audio.error(); toast('Could not sell that.', 'error'); }
      }));
    }
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function renderBarnOrSilo(container, kind) {
  const bucket = kind === 'silo' ? state.silo : state.barn;
  renderInventoryGrid(container, bucket.items, kind === 'silo' ? 'No crops in the silo yet — plant a field!' : 'No goods in the barn yet — cook something up!');
}

// ---------------------------------------------------------------------------
// Orders + the truck (orders.js)
// ---------------------------------------------------------------------------
function renderOrders(container) {
  orders.refreshBoard(Date.now());
  const board = state.orders.board || [];
  if (!board.some(Boolean)) { renderComingSoon(container, 'The order board'); return; }

  for (const slot of board) {
    if (!slot) continue;
    const card = document.createElement('div');
    card.className = 'order-card';
    if (slot.empty) {
      card.innerHTML = `<span class="minigame-hint">Next order in ${fmtDuration(slot.readyAt - Date.now())}…</span>`;
      container.appendChild(card);
      continue;
    }
    const order = slot;
    const canFulfill = orders.canFulfill(order);
    const reqs = (order.items || []).map((it) => `${itemIcon(it.itemId)} ${itemName(it.itemId)} x${it.qty}`).join(', ');
    card.innerHTML = `<strong>Order</strong><div>${reqs}</div><div>Reward: 🪙${order.rewardCoins ?? 0} · ✨${order.rewardXp ?? 0} XP</div>`;
    card.appendChild(button('Fulfill', () => {
      const result = orders.fulfillOrder(order.id);
      if (result) {
        audio.orderComplete();
        toast('Order fulfilled!', 'success');
        tutorial.emit('order_fulfilled');
        refreshPanel();
      } else { audio.error(); toast("You don't have everything for this order yet.", 'error'); }
    }, { disabled: !canFulfill }));
    container.appendChild(card);
  }
}

function renderTruck(container) {
  orders.tickTruck(Date.now());
  const truck = state.orders.truck;
  if (!truck) { renderComingSoon(container, 'The truck'); return; }

  if (truck.departed) {
    container.appendChild(hintEl(`The truck has departed. Next one in ${fmtDuration((truck.nextSpawnAt || 0) - Date.now())}.`));
    return;
  }

  const grid = slotGrid();
  truck.bundles.forEach((bundle, i) => {
    const card = document.createElement('div');
    card.className = `build-card${bundle.filled ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">${itemIcon(bundle.itemId)}</span><strong>${itemName(bundle.itemId)}</strong><span>x${bundle.qty}</span>`;
    if (bundle.filled) {
      card.appendChild(hintEl('Loaded ✅'));
    } else {
      card.appendChild(button('Fill', () => {
        const ok = orders.fillTruckBundle(i);
        if (ok) { audio.place(); toast('Bundle filled!', 'success'); refreshPanel(); }
        else { audio.error(); toast('Not enough in storage.', 'error'); }
      }, { disabled: stockCount(bundle.itemId) < bundle.qty }));
    }
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Roadside shop + the market trader (shop.js)
// ---------------------------------------------------------------------------
function renderShop(container) {
  shop.tick(Date.now());
  const listings = state.shop.listings || [];
  const active = listings.filter(Boolean);

  if (active.length) {
    const grid = slotGrid();
    listings.forEach((listing, i) => {
      if (!listing) return;
      const card = document.createElement('div');
      card.className = 'shop-slot';
      card.innerHTML = `<span class="icon">${itemIcon(listing.itemId)}</span><strong>${itemName(listing.itemId)}</strong><span>x${listing.qty} — 🪙${listing.price}</span>`;
      if (listing.sold) {
        card.appendChild(button('Collect', () => {
          const ok = shop.collect(i);
          if (ok) { audio.coin(); toast('Collected!', 'success'); refreshPanel(); }
        }));
      } else {
        card.appendChild(hintEl(`Selling… ready in ${fmtDuration(listing.readyAt - Date.now())}`));
        card.appendChild(button('Cancel', () => {
          const ok = shop.cancel(i);
          if (ok) { toast('Listing cancelled.', 'info'); refreshPanel(); }
        }));
      }
      grid.appendChild(card);
    });
    container.appendChild(grid);
  } else {
    container.appendChild(hintEl('No listings yet — sell something below.'));
  }

  container.appendChild(hintEl('List an item for sale:'));
  const usedSlots = listings.filter(Boolean).length;
  const full = usedSlots >= SHOP.slots;
  const sellPool = { ...state.silo.items, ...state.barn.items };
  const listGrid = slotGrid();
  let listable = 0;
  for (const [id, qty] of Object.entries(sellPool)) {
    if (!(qty > 0)) continue;
    const base = economy.sellValue(id);
    if (!(base > 0)) continue;
    listable++;
    const price = Math.round(base * 1.2);
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = `<span class="icon">${itemIcon(id)}</span><strong>${itemName(id)}</strong><span>x${qty} owned</span>`;
    card.appendChild(button(`List 1 for 🪙${price}`, () => {
      const ok = shop.list(id, 1, price);
      if (ok) { audio.place(); toast(`Listed 1 ${itemName(id)}.`, 'success'); refreshPanel(); }
      else { audio.error(); toast('Could not list that.', 'error'); }
    }, { disabled: full }));
    listGrid.appendChild(card);
  }
  if (listable) container.appendChild(listGrid);
  else container.appendChild(hintEl('Nothing to sell yet — harvest or craft something first!'));
}

function renderMarket(container) {
  const offers = shop.marketOffers(Date.now());
  if (!offers.length) { renderComingSoon(container, 'The market stall'); return; }
  const grid = slotGrid();
  offers.forEach((offer, i) => {
    const card = document.createElement('div');
    card.className = `build-card${offer.bought ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">${itemIcon(offer.item)}</span><strong>${itemName(offer.item)}</strong><span>x${offer.qty} — 🪙${offer.price}</span>`;
    if (offer.bought) {
      card.appendChild(hintEl('Sold out for today.'));
    } else {
      card.appendChild(button('Buy', () => {
        const ok = shop.buyOffer(i);
        if (ok) { audio.coin(); toast(`Bought ${itemName(offer.item)}!`, 'success'); refreshPanel(); }
        else { audio.error(); toast('Could not buy that.', 'error'); }
      }, { disabled: state.coins < offer.price }));
    }
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Boat crates (boat.js) + island voyages (islands.js) — one physical dock, two modules.
// ---------------------------------------------------------------------------
function renderBoat(container) {
  boat.tick(Date.now());
  container.appendChild(hintEl('Boat Orders'));
  const b = state.orders.boat;
  if (!b) {
    container.appendChild(hintEl('The next boat has not docked yet.'));
  } else if (b.departed) {
    container.appendChild(hintEl(`The boat has sailed. Next one in ${fmtDuration((b.nextSpawnAt || 0) - Date.now())}.`));
  } else {
    container.appendChild(hintEl(`Departs in ${fmtDuration(b.departsAt - Date.now())}.`));
    const grid = slotGrid();
    b.crates.forEach((crate, i) => {
      const card = document.createElement('div');
      card.className = `build-card${crate.filled ? ' locked' : ''}`;
      card.innerHTML = `<span class="icon">${itemIcon(crate.itemId)}</span><strong>${itemName(crate.itemId)}</strong><span>x${crate.qty}</span>`;
      if (crate.filled) {
        card.appendChild(hintEl('Loaded ✅'));
      } else {
        card.appendChild(button('Load', () => {
          const ok = boat.fillCrate(i);
          if (ok) { audio.place(); toast('Crate loaded!', 'success'); refreshPanel(); }
          else { audio.error(); toast('Not enough in storage.', 'error'); }
        }, { disabled: stockCount(crate.itemId) < crate.qty }));
      }
      grid.appendChild(card);
    });
    container.appendChild(grid);
    if (b.crates.length && b.crates.every((c) => c.filled) && !b.claimed) {
      const claimRow = row('');
      claimRow.appendChild(button('Claim full-boat bonus!', () => {
        const result = boat.claimBonus();
        if (result) {
          audio.depart();
          toast(`Bonus: 🪙${result.coins} · ✨${result.xp} XP · 🎟️${result.vouchers} vouchers!`, 'success');
          refreshPanel();
        } else { audio.error(); toast('Too late — the boat has left.', 'error'); }
      }));
      container.appendChild(claimRow);
    }
  }

  container.appendChild(hintEl('Island Voyages'));
  const voyage = state.islands.voyage;
  if (voyage) {
    const def = ISLANDS.destinations[voyage.islandId];
    const now = Date.now();
    if (now >= voyage.readyAt) {
      const cargo = islands.pendingCargo() || {};
      const cargoLine = Object.entries(cargo).map(([id, qty]) => `${itemIcon(id)} x${qty}`).join(', ');
      const card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML = `<strong>${def?.name || voyage.islandId} has returned!</strong><div>${cargoLine}</div>`;
      card.appendChild(button('Collect cargo', () => {
        const ok = islands.collect();
        if (ok) { audio.coin(); toast('Cargo collected!', 'success'); refreshPanel(); }
        else { audio.error(); toast('Barn is full — make room first.', 'error'); }
      }));
      container.appendChild(card);
    } else {
      container.appendChild(hintEl(`${def?.name || voyage.islandId} returns in ${fmtDuration(voyage.readyAt - now)}.`));
    }
  } else {
    const grid = slotGrid();
    for (const dest of islands.destinations()) {
      const card = document.createElement('div');
      card.className = 'build-card';
      const cargoLine = Object.keys(dest.cargo || {}).map((id) => itemIcon(id)).join(' ');
      card.innerHTML = `<span class="icon">⛵</span><strong>${dest.name}</strong><span class="minigame-hint">${cargoLine} · ${fmtDuration(dest.tripTime * 1000)}</span>`;
      card.appendChild(button('Sail', () => {
        const ok = islands.sail(dest.id);
        if (ok) { audio.depart(); toast(`Sailing to ${dest.name}…`, 'success'); refreshPanel(); }
        else { audio.error(); toast('Cannot sail right now.', 'error'); }
      }, { disabled: !islands.canSail(dest.id) }));
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }
}

// ---------------------------------------------------------------------------
// Fishing (fishing.js) — cast, then reel a real-time timing bar for accuracy.
// ---------------------------------------------------------------------------
let fishingStyleInjected = false;
function ensureFishingStyle() {
  if (fishingStyleInjected) return;
  if (typeof document === 'undefined' || !document.head) return;
  const style = document.createElement('style');
  style.textContent = `
    .fishing-track { position: relative; height: 18px; margin: 8px 0; cursor: pointer; background: rgba(0,0,0,0.12); border-radius: 9px; }
    .fishing-marker { position: absolute; top: 0; width: 4px; height: 100%; background: #f0b52e; border-radius: 2px;
      animation: fishing-ping-pong 1.4s ease-in-out infinite; }
    @keyframes fishing-ping-pong { 0% { left: 0%; } 50% { left: 96%; } 100% { left: 0%; } }
  `;
  document.head.appendChild(style);
  fishingStyleInjected = true;
}

function renderFishing(container) {
  const now = Date.now();
  const cast = state.fishing.cast;

  if (!cast) {
    container.appendChild(hintEl('Cast your line and wait for a bite.'));
    const castRow = row('');
    castRow.appendChild(button('Cast', () => {
      const ok = fishing.cast();
      if (ok) { audio.place(); toast('Line cast — wait for it…', 'info'); refreshPanel(); }
      else { audio.error(); toast('Cannot cast right now.', 'error'); }
    }));
    container.appendChild(castRow);
    return;
  }

  if (now < cast.readyAt) {
    container.appendChild(hintEl(`Waiting for a bite… ${fmtDuration(cast.readyAt - now)}`));
    return;
  }

  ensureFishingStyle();
  container.appendChild(hintEl('Something is biting! Click the bar when the marker is centred.'));
  const track = document.createElement('div');
  track.className = 'fishing-track';
  const marker = document.createElement('div');
  marker.className = 'fishing-marker';
  const animStart = Date.now();
  track.appendChild(marker);
  track.addEventListener('click', () => {
    const cycle = 1400;
    const t = ((Date.now() - animStart) % cycle) / cycle;
    const pos = t < 0.5 ? t * 2 : (1 - t) * 2; // mirrors the CSS ping-pong keyframes above
    const accuracy = 1 - Math.abs(pos - 0.5) * 2;
    const result = fishing.reel(accuracy);
    if (!result) { audio.error(); refreshPanel(); return; }
    if (result.chest) {
      const loot = fishing.openChest();
      const parts = [];
      if (loot.coins) parts.push(`🪙${loot.coins}`);
      if (loot.diamonds) parts.push(`💎${loot.diamonds}`);
      if (loot.item) parts.push(`${itemIcon(loot.item)} x${loot.qty}`);
      if (loot.material) parts.push(`${itemIcon(loot.material)} x${loot.qty}`);
      audio.coin();
      toast(`Treasure chest: ${parts.join(', ') || 'nothing this time'}!`, 'success');
    } else if (result.qty > 0) {
      audio.fishSplash();
      toast(`Caught a ${itemName(result.item)}!`, 'success');
    } else {
      audio.error();
      toast('It got away — the barn is full.', 'error');
    }
    refreshPanel();
  });
  container.appendChild(track);
}

// ---------------------------------------------------------------------------
// The mine (mine.js) — tiered depths, dig with a pickaxe or dynamite.
// ---------------------------------------------------------------------------
function renderMine(container) {
  const tools = mine.availableTools();
  container.appendChild(hintEl(`Tools in the barn: ${itemIcon('pickaxe')} x${tools.pickaxe}   ${itemIcon('dynamite')} x${tools.dynamite}`));

  const cur = mine.currentDepth();
  container.appendChild(hintEl(`Currently digging: ${cur?.name || '—'}`));

  const digRow = row('');
  digRow.appendChild(button(`Dig with ${itemIcon('pickaxe')} Pickaxe`, () => {
    const result = mine.digAt(state.mine.currentDepth, 'pickaxe');
    if (result) {
      audio.harvest();
      const line = result.item ? `${itemIcon(result.item)} x${result.qty}` : 'nothing this time';
      toast(`Found ${line}${result.artifact ? ' + an artifact!' : ''}`, 'success');
      refreshPanel();
    } else { audio.error(); toast('No pickaxe in the barn.', 'error'); }
  }, { disabled: tools.pickaxe <= 0 }));
  digRow.appendChild(button(`Dig with ${itemIcon('dynamite')} Dynamite`, () => {
    const result = mine.digAt(state.mine.currentDepth, 'dynamite');
    if (result) {
      audio.harvest();
      const line = result.item ? `${itemIcon(result.item)} x${result.qty}` : 'nothing this time';
      toast(`Found ${line}${result.artifact ? ' + an artifact!' : ''}`, 'success');
      refreshPanel();
    } else { audio.error(); toast('No dynamite in the barn.', 'error'); }
  }, { disabled: tools.dynamite <= 0 }));
  container.appendChild(digRow);

  container.appendChild(hintEl('Depths:'));
  const grid = slotGrid();
  for (const depth of mine.depths()) {
    const card = document.createElement('div');
    card.className = `build-card${depth.unlocked ? '' : ' locked'}`;
    card.innerHTML = `<span class="icon">⛰️</span><strong>${depth.name}</strong>${depth.current ? '<span>Current</span>' : ''}`;
    if (!depth.unlocked) {
      if (!depth.levelMet) {
        card.appendChild(hintEl(`Unlocks at level ${depth.unlockLevel}.`));
      } else if (depth.requires) {
        const matLine = Object.entries(depth.requires.materials || {}).map(([id, qty]) => `${itemIcon(id)} x${qty}`).join(' ');
        card.appendChild(hintEl(`🪙${depth.requires.coins} · ${matLine}`));
        card.appendChild(button('Open', () => {
          const ok = mine.unlockDepth(depth.id);
          if (ok) { audio.place(); toast(`${depth.name} opened!`, 'success'); refreshPanel(); }
          else { audio.error(); toast('Not enough to open this depth.', 'error'); }
        }));
      }
    } else if (!depth.current) {
      card.appendChild(button('Switch to', () => {
        state.mine.currentDepth = depth.id;
        refreshPanel();
      }));
    }
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Merge Meadow (merge.js) — a 7x9 tap-to-merge board (select, then merge/move/claim).
// ---------------------------------------------------------------------------
let mergeSelected = null;
// Which cell the keyboard is on. Separate from the SELECTION: on a merge board you move around
// looking before you pick anything up, exactly as a pointer does, and collapsing the two would
// mean every arrow key press picked something up.
let mergeFocus = 0;
// Set just before a board action rebuilds the panel, so focus can be put back on the cell that
// was acted on. Never set on open: a panel that grabs focus the moment it appears is a panel that
// fights the user.
let mergeRefocus = false;

function renderMerge(container) {
  merge.initBoard();
  const energy = merge.currentEnergy(Date.now());
  container.appendChild(hintEl(`Energy: ${energy}/${MERGE.energy.max}`));
  container.appendChild(hintEl('Tap a generator to spawn items. Tap two matching items to merge. Tap a maxed item to claim its reward.'));

  const grid = document.createElement('div');
  grid.className = 'merge-grid';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${MERGE.board.cols}, 1fr)`;
  grid.style.gap = '3px';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', `Merge board, ${MERGE.board.rows} rows by ${MERGE.board.cols} columns`);
  grid.setAttribute('aria-rowcount', String(MERGE.board.rows));
  grid.setAttribute('aria-colcount', String(MERGE.board.cols));

  const cols = MERGE.board.cols;
  const cellButtons = [];

  const m = state.merge;
  m.cells.forEach((cell, i) => {
    const cellBtn = document.createElement('button');
    cellBtn.className = 'btn';
    cellBtn.style.aspectRatio = '1';
    cellBtn.style.minWidth = '0';
    cellBtn.style.padding = '2px';
    cellBtn.style.fontSize = '16px';
    // Selection is a CLASS, not an inline outline. Inline styles beat the stylesheet, so an
    // inline outline here would have swallowed the focus ring on the one cell where knowing both
    // matters most: the cell you have picked up and are still standing on.
    if (i === mergeSelected) cellBtn.classList.add('picked-up');

    const row = Math.floor(i / cols) + 1;
    const col = (i % cols) + 1;
    cellBtn.setAttribute('role', 'gridcell');
    cellBtn.setAttribute('aria-rowindex', String(row));
    cellBtn.setAttribute('aria-colindex', String(col));
    // Roving tabindex: the board is 63 buttons, and making every one a tab stop would mean
    // twenty-odd presses just to get PAST the merge panel. One stop in, then arrow keys.
    cellBtn.tabIndex = i === mergeFocus ? 0 : -1;
    // The selection was an outline and nothing else, so a screen reader could not tell which cell
    // was picked up - on a board whose entire mechanic is "pick this up, put it on that one".
    cellBtn.setAttribute('aria-pressed', i === mergeSelected ? 'true' : 'false');

    // Every cell says where it is and what is on it. Before this, the 57 empty cells of a fresh
    // board had no accessible name at all: a screen reader read out "button" fifty-seven times,
    // with no way to tell them apart or know where on the board you were.
    let what;
    if (!cell) {
      cellBtn.textContent = '';
      what = 'empty';
    } else if (cell.generator) {
      const gen = MERGE.generators[cell.generator];
      cellBtn.textContent = '📦';
      what = `${gen?.name || cell.generator}, a generator`;
      cellBtn.title = gen?.name || cell.generator;
    } else {
      const chain = MERGE.chains[cell.chain];
      const tierName = chain?.tiers?.[cell.tier] || `Tier ${cell.tier + 1}`;
      const of = chain?.tiers?.length ? ` of ${chain.tiers.length}` : '';
      cellBtn.textContent = String(cell.tier + 1);
      what = `${chain?.name || cell.chain}, ${tierName}, tier ${cell.tier + 1}${of}`;
      cellBtn.title = `${chain?.name || cell.chain} — ${tierName}`;
    }
    cellBtn.setAttribute('aria-label',
      `Row ${row}, column ${col}, ${what}${i === mergeSelected ? ', picked up' : ''}`);

    cellBtn.addEventListener('click', () => {
      // Record the acted-on cell HERE rather than leaning on the focus event. Focusing an element
      // that is already focused fires nothing, so a focus-maintained variable is only correct when
      // focus actually moved - and after a rebuild it often has not. Measured: focus came back on
      // a cell three rows from the one that was clicked. The cell that was acted on is known right
      // here, with no ordering to reason about.
      mergeFocus = i;
      if (!cell) {
        if (mergeSelected !== null) {
          const ok = merge.moveItem(mergeSelected, i);
          mergeSelected = null;
          if (ok) (mergeRefocus = true, refreshPanel());
        }
        return;
      }
      if (cell.generator) {
        const placed = merge.spawnFrom(i);
        if (placed) { audio.place(); (mergeRefocus = true, refreshPanel()); }
        else { audio.error(); toast('Not enough energy, or the board is full.', 'error'); }
        return;
      }
      if (mergeSelected === null) { mergeSelected = i; (mergeRefocus = true, refreshPanel()); return; }
      if (mergeSelected === i) { mergeSelected = null; (mergeRefocus = true, refreshPanel()); return; }
      if (merge.canMerge(mergeSelected, i)) {
        const result = merge.merge(mergeSelected, i);
        mergeSelected = null;
        if (result) { audio.merge(); toast('Merged!', 'success'); (mergeRefocus = true, refreshPanel()); }
        return;
      }
      if (merge.claimableReward(i)) {
        merge.claim(i);
        mergeSelected = null;
        audio.coin();
        toast('Claimed!', 'success');
        (mergeRefocus = true, refreshPanel());
        return;
      }
      mergeSelected = i; // switch the selection to this cell instead
      (mergeRefocus = true, refreshPanel());
    });
    cellBtn.addEventListener('focus', () => { mergeFocus = i; });
    cellButtons.push(cellBtn);
    grid.appendChild(cellBtn);
  });

  // Arrow keys walk the board, Home and End jump to the ends of a row. Without this the only way
  // across a 7x9 board is Tab, one cell at a time, in reading order - which is not navigation, it
  // is endurance, and it makes the two-dimensional layout meaningless to anyone not using a mouse.
  grid.addEventListener('keydown', (ev) => {
    const rows = MERGE.board.rows;
    const from = mergeFocus;
    let to = from;
    if (ev.key === 'ArrowRight') to = from + 1;
    else if (ev.key === 'ArrowLeft') to = from - 1;
    else if (ev.key === 'ArrowDown') to = from + cols;
    else if (ev.key === 'ArrowUp') to = from - cols;
    else if (ev.key === 'Home') to = Math.floor(from / cols) * cols;
    else if (ev.key === 'End') to = Math.floor(from / cols) * cols + cols - 1;
    else return;
    if (to < 0 || to >= rows * cols) return;
    // Horizontal moves must also stay on their own ROW. Checking only the board bounds let
    // ArrowRight off the last column land on the first column of the next row - measured, and the
    // opposite of what the comment above it claimed. On a board where position is the whole game,
    // an edge has to feel like an edge.
    const horizontal = ev.key === 'ArrowRight' || ev.key === 'ArrowLeft';
    if (horizontal && Math.floor(to / cols) !== Math.floor(from / cols)) return;
    ev.preventDefault();
    mergeFocus = to;
    cellButtons[to]?.focus();
  });

  container.appendChild(grid);

  // The panel rebuilds itself on every move, which destroys the focused button along with the rest
  // of the DOM and drops focus back to the document. Putting it back is what makes keyboard play
  // continuous instead of dumping the user at the top of the panel after every single merge.
  // Only ever after an action taken ON the board, so opening the panel does not grab focus.
  if (mergeRefocus) {
    mergeRefocus = false;
    cellButtons[Math.min(mergeFocus, cellButtons.length - 1)]?.focus();
  }
}

// ---------------------------------------------------------------------------
// Town (town.js) — houses raise population, community buildings raise the cap.
// ---------------------------------------------------------------------------
function findFreeTownTile(w, h) {
  const { x: dx, y: dy, w: dw, h: dh } = TOWN.district;
  const occupied = state.town.buildings;
  for (let y = dy; y <= dy + dh - h; y++) {
    for (let x = dx; x <= dx + dw - w; x++) {
      const free = occupied.every((b) => {
        const [bw, bh] = b.size || [1, 1];
        return !(x < b.x + bw && x + w > b.x && y < b.y + bh && y + h > b.y);
      });
      if (free) return [x, y];
    }
  }
  return null;
}

function buildTownCard(id, def, kind) {
  const card = document.createElement('div');
  const affordable = town.canBuild(kind, id);
  card.className = `build-card${affordable ? '' : ' locked'}`;
  const matLine = Object.entries(def.materials || {}).map(([m, qty]) => `${itemIcon(m)} x${qty}`).join(' ');
  card.innerHTML = `<span class="icon">🏘️</span><strong>${def.name}</strong><span>🪙${def.cost}</span><span class="minigame-hint">${matLine}</span>`;
  card.appendChild(button('Build', () => {
    const spot = findFreeTownTile(def.size[0], def.size[1]);
    if (!spot) { audio.error(); toast('No free space in town.', 'error'); return; }
    const ok = town.build(kind, id, spot[0], spot[1]);
    if (ok) { audio.place(); toast(`Built ${def.name}!`, 'success'); refreshPanel(); }
    else { audio.error(); toast('Cannot build that yet.', 'error'); }
  }, { disabled: !affordable }));
  return card;
}

function renderTown(container) {
  const info = town.populationInfo();
  container.appendChild(hintEl(`Population: ${info.population}/${info.capacity}`));

  const claimable = town.claimableMilestones();
  for (const idx of claimable) {
    const m = TOWN.milestones[idx];
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `<strong>${m.population} population reached!</strong><span>🪙${m.rewards.coins ?? 0} · 💎${m.rewards.diamonds ?? 0}</span>`;
    card.appendChild(button('Claim', () => {
      town.claimMilestone(idx);
      audio.reward();
      toast('Milestone claimed!', 'success');
      refreshPanel();
    }));
    container.appendChild(card);
  }

  const tier = town.unlockedTier();
  container.appendChild(hintEl('Houses (raise population):'));
  const houseGrid = slotGrid();
  for (const [id, def] of Object.entries(TOWN.houses)) {
    if (def.tier > tier) continue;
    houseGrid.appendChild(buildTownCard(id, def, 'house'));
  }
  container.appendChild(houseGrid);

  container.appendChild(hintEl('Community buildings (raise the cap):'));
  const commGrid = slotGrid();
  for (const [id, def] of Object.entries(TOWN.communityBuildings)) {
    if (def.tier > tier) continue;
    commGrid.appendChild(buildTownCard(id, def, 'community'));
  }
  container.appendChild(commGrid);
}

// ---------------------------------------------------------------------------
// Trains + the airport (trains.js) — cargo transports of the Township layer.
// ---------------------------------------------------------------------------
function renderTrains(container) {
  trains.tick(Date.now());
  if (state.trains.readyToCollect) {
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = '<strong>The train has returned!</strong>';
    card.appendChild(button('Collect materials', () => {
      const ok = trains.collectDelivery();
      if (ok) { audio.coin(); toast('Materials collected!', 'success'); refreshPanel(); }
      else { audio.error(); toast('Barn is full — make room first.', 'error'); }
    }));
    container.appendChild(card);
    return;
  }

  const t = trains.currentTrain();
  if (!t) { container.appendChild(hintEl('No train at the station right now.')); return; }

  container.appendChild(hintEl(`Departs in ${fmtDuration(t.departsBy - Date.now())}.`));
  const grid = slotGrid();
  t.wagons.forEach((wagon, i) => {
    const full = wagon.filled >= wagon.requested;
    const card = document.createElement('div');
    card.className = `build-card${full ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">${itemIcon(wagon.itemId)}</span><strong>${itemName(wagon.itemId)}</strong><span>${wagon.filled}/${wagon.requested}</span>`;
    if (!full) {
      card.appendChild(button('Load', () => {
        const ok = trains.fillWagon(i);
        if (ok) { audio.place(); refreshPanel(); }
        else { audio.error(); toast('Not enough in storage.', 'error'); }
      }));
    }
    grid.appendChild(card);
  });
  container.appendChild(grid);

  if (t.wagons.length && t.wagons.every((w) => w.filled >= w.requested)) {
    const dispatchRow = row('');
    dispatchRow.appendChild(button('Dispatch train', () => {
      trains.dispatchTrain();
      audio.depart();
      toast('Train dispatched!', 'success');
      refreshPanel();
    }));
    container.appendChild(dispatchRow);
  }
}

function renderAirport(container) {
  trains.tick(Date.now());
  if (state.airport.readyToCollect) {
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = '<strong>The plane has returned!</strong>';
    card.appendChild(button('Collect delivery', () => {
      const ok = trains.collectFlight();
      if (ok) { audio.coin(); toast('Delivery collected!', 'success'); refreshPanel(); }
      else { audio.error(); toast('Barn is full — make room first.', 'error'); }
    }));
    container.appendChild(card);
    return;
  }

  const p = trains.currentPlane();
  if (!p) { container.appendChild(hintEl('No plane at the airport right now.')); return; }

  container.appendChild(hintEl(`Departs in ${fmtDuration(p.departsBy - Date.now())}.`));
  const grid = slotGrid();
  p.crates.forEach((crate, i) => {
    const full = crate.filled >= crate.requested;
    const card = document.createElement('div');
    card.className = `build-card${full ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">${itemIcon(crate.itemId)}</span><strong>${itemName(crate.itemId)}</strong><span>${crate.filled}/${crate.requested}</span>`;
    if (!full) {
      card.appendChild(button('Load', () => {
        const ok = trains.fillCrate(i);
        if (ok) { audio.place(); refreshPanel(); }
        else { audio.error(); toast('Not enough in storage.', 'error'); }
      }));
    }
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// The zoo (zoo.js) — enclosures, feeding, visitor income, zoo orders.
// ---------------------------------------------------------------------------
function renderZoo(container) {
  zoo.tick(Date.now());
  const income = zoo.pendingIncome(Date.now());
  const incomeRow = row('');
  incomeRow.appendChild(hintEl(`Visitor income: 🪙${income}`));
  if (income > 0) {
    incomeRow.appendChild(button('Collect', () => {
      const amount = zoo.collectIncome();
      audio.coin();
      toast(`Collected 🪙${amount}!`, 'success');
      refreshPanel();
    }));
  }
  container.appendChild(incomeRow);

  container.appendChild(hintEl('Enclosures:'));
  const grid = slotGrid();
  const owned = state.zoo.enclosures;
  for (const [id, def] of Object.entries(ZOO.enclosures)) {
    const has = owned[id];
    const card = document.createElement('div');
    if (!has) {
      const locked = state.level < def.unlockLevel;
      card.className = `build-card${locked ? ' locked' : ''}`;
      const matLine = Object.entries(def.materials || {}).map(([m, qty]) => `${itemIcon(m)} x${qty}`).join(' ');
      card.innerHTML = `<span class="icon">🦁</span><strong>${def.name}</strong><span>🪙${def.cost}</span><span class="minigame-hint">${matLine}</span>`;
      if (locked) {
        card.appendChild(hintEl(`Unlocks at level ${def.unlockLevel}.`));
      } else {
        card.appendChild(button('Buy', () => {
          const ok = zoo.buyEnclosure(id);
          if (ok) { audio.place(); toast(`Built ${def.name}!`, 'success'); refreshPanel(); }
          else { audio.error(); toast('Not enough to buy this.', 'error'); }
        }));
      }
    } else {
      card.className = 'build-card';
      const now = Date.now();
      const ready = has.readyAt > 0 && now >= has.readyAt;
      const feeding = has.readyAt > 0 && !ready;
      card.innerHTML = `<span class="icon">${itemIcon(def.product)}</span><strong>${def.name}</strong>`;
      if (ready) {
        card.appendChild(button('Collect', () => {
          const ok = zoo.collect(id);
          if (ok) { audio.harvest(); toast(`Collected ${itemName(def.product)}!`, 'success'); refreshPanel(); }
        }));
      } else if (feeding) {
        card.appendChild(hintEl(`Producing… ${fmtDuration(has.readyAt - now)}`));
      } else {
        const feedLine = Object.entries(def.feed).map(([g, qty]) => `${itemIcon(g)} x${qty}`).join(' ');
        const haveFeed = Object.entries(def.feed).every(([g, qty]) => stockCount(g) >= qty);
        card.appendChild(hintEl(feedLine));
        card.appendChild(button('Feed', () => {
          const ok = zoo.feed(id);
          if (ok) { audio.animal(); toast('Feeding…', 'success'); refreshPanel(); }
          else { audio.error(); toast('Not enough feed.', 'error'); }
        }, { disabled: !haveFeed }));
      }
    }
    grid.appendChild(card);
  }
  container.appendChild(grid);

  const zooOrders = state.zoo.orders || [];
  if (zooOrders.length) {
    container.appendChild(hintEl('Zoo orders:'));
    for (const order of zooOrders) {
      const canFulfill = order.items.every((it) => stockCount(it.itemId) >= it.qty);
      const card = document.createElement('div');
      card.className = 'order-card';
      const reqs = order.items.map((it) => `${itemIcon(it.itemId)} x${it.qty}`).join(', ');
      card.innerHTML = `<strong>Zoo Order</strong><div>${reqs}</div><div>Reward: 🪙${order.rewardCoins}</div>`;
      card.appendChild(button('Fulfill', () => {
        const ok = zoo.fulfillOrder(order.id);
        if (ok) { audio.orderComplete(); toast('Zoo order fulfilled!', 'success'); refreshPanel(); }
      }, { disabled: !canFulfill }));
      container.appendChild(card);
    }
  }
}

// ---------------------------------------------------------------------------
// The helicopter pad (helicopter.js) — the fastest materials channel.
// ---------------------------------------------------------------------------
function renderHelicopter(container) {
  // No helicopter.tick() call here on purpose — see main.js's tickAllSystems for why:
  // settleFuel() resolves elapsed-since-last-call and unconditionally resets its own baseline,
  // so calling it on every render (which can happen many times a second while this panel is
  // open) would discard fuel regen exactly the way an unthrottled per-frame loop tick would.
  // currentFuel() below is the pure, side-effect-free reader that already shows the correct
  // live value without needing tick() to run at all; main.js ticks the real regen forward on a
  // throttled cadence in the background.
  const fuel = helicopter.currentFuel(Date.now());
  container.appendChild(hintEl(`Fuel: ${fuel}/${HELICOPTER.fuel.max}`));

  const flight = helicopter.currentFlight();
  if (flight) {
    const now = Date.now();
    if (now >= flight.returningAt) {
      const card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML = '<strong>The helicopter has returned!</strong>';
      card.appendChild(button('Collect delivery', () => {
        const result = helicopter.collectDelivery();
        if (result) { audio.coin(); toast('Delivery collected!', 'success'); refreshPanel(); }
      }));
      container.appendChild(card);
    } else {
      container.appendChild(hintEl(`Returning in ${fmtDuration(flight.returningAt - now)}.`));
    }
    return;
  }

  container.appendChild(hintEl('Load crates, then dispatch:'));
  const grid = slotGrid();
  const loading = state.helicopter.loading || [];
  for (let i = 0; i < HELICOPTER.crates; i++) {
    const slot = loading[i];
    const card = document.createElement('div');
    card.className = 'build-card';
    if (slot) {
      card.innerHTML = `<span class="icon">${itemIcon(slot.item)}</span><strong>${itemName(slot.item)}</strong>`;
    } else {
      card.innerHTML = '<span class="icon">➕</span><strong>Empty</strong>';
      card.appendChild(button('Load', () => {
        const ok = helicopter.fillCrate(i);
        if (ok) { audio.place(); refreshPanel(); }
        else { audio.error(); toast('Nothing in the barn to load.', 'error'); }
      }));
    }
    grid.appendChild(card);
  }
  container.appendChild(grid);

  const filled = loading.filter(Boolean).length;
  const dispatchRow = row('');
  dispatchRow.appendChild(button('Dispatch', () => {
    const ok = helicopter.dispatch();
    if (ok) { audio.depart(); toast('Helicopter dispatched!', 'success'); refreshPanel(); }
    else { audio.error(); toast('Load a crate and check fuel first.', 'error'); }
  }, { disabled: filled === 0 || fuel < HELICOPTER.fuel.costPerDispatch }));
  container.appendChild(dispatchRow);
}

// ---------------------------------------------------------------------------
// The laboratory (lab.js) — permanent research; one node runs at a time.
// ---------------------------------------------------------------------------
function renderLab(container) {
  // No render-time lab.tick() here — main.js's loop ticks it every frame now, and lab.tick()'s
  // "if (now < active.readyAt) return" one-shot check is idempotent at any call frequency, so
  // the loop alone genuinely covers this (see main.js's tickAllSystems comment).

  if (!state.lab.built) {
    const cost = LAB.buildCost;
    const matLine = Object.entries(cost.materials || {}).map(([m, qty]) => `${itemIcon(m)} x${qty}`).join(' ');
    container.appendChild(hintEl(`Build the Laboratory: 🪙${cost.coins} · ${matLine}`));
    const buildRow = row('');
    buildRow.appendChild(button('Build', () => {
      const ok = lab.build();
      if (ok) { audio.place(); toast('Laboratory built!', 'success'); refreshPanel(); }
      else { audio.error(); toast('Not enough to build the lab.', 'error'); }
    }));
    container.appendChild(buildRow);
    return;
  }

  if (state.lab.active) {
    const node = LAB.tree[state.lab.active.id];
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `<strong>Researching ${node?.name || state.lab.active.id}</strong><div>${fmtDuration(state.lab.active.readyAt - Date.now())} remaining</div>`;
    card.appendChild(button('Cancel', () => {
      lab.cancelResearch();
      toast('Research cancelled — refunded.', 'info');
      refreshPanel();
    }));
    container.appendChild(card);
  }

  container.appendChild(hintEl(`Completed: ${state.lab.researched.length} / ${Object.keys(LAB.tree).length}`));
  container.appendChild(hintEl('Available research:'));
  const grid = slotGrid();
  for (const id of lab.availableNodes()) {
    const node = LAB.tree[id];
    const can = lab.canResearch(id);
    const card = document.createElement('div');
    card.className = `build-card${can ? '' : ' locked'}`;
    const cost = node.cost || {};
    const itemsLine = Object.entries(cost.items || {}).map(([g, qty]) => `${itemIcon(g)} x${qty}`).join(' ');
    const matsLine = Object.entries(cost.materials || {}).map(([m, qty]) => `${itemIcon(m)} x${qty}`).join(' ');
    card.innerHTML = `<span class="icon">🔬</span><strong>${node.name}</strong><span>🪙${cost.coins ?? 0}</span><span class="minigame-hint">${itemsLine} ${matsLine}</span>`;
    card.appendChild(button('Research', () => {
      const ok = lab.startResearch(id);
      if (ok) { audio.place(); toast(`Researching ${node.name}…`, 'success'); refreshPanel(); }
      else { audio.error(); toast('Cannot research that right now.', 'error'); }
    }, { disabled: !can }));
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// The museum (museum.js) — exhibits made of found artifacts (never in the barn).
// ---------------------------------------------------------------------------
function renderMuseum(container) {
  container.appendChild(hintEl('Exhibits:'));
  const grid = slotGrid();
  for (const [id, exhibit] of Object.entries(MUSEUM.exhibits)) {
    const progress = museum.exhibitProgress(id);
    const claimed = state.museum.claimedRewards.includes(id);
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = `<span class="icon">🏛️</span><strong>${exhibit.name}</strong><span>${progress.found}/${progress.total} found</span>`;
    if (progress.found >= progress.total && !claimed) {
      card.appendChild(button('Claim', () => {
        const ok = museum.claimExhibit(id);
        if (ok) { audio.reward(); toast(`${exhibit.name} exhibit complete!`, 'success'); refreshPanel(); }
      }));
    } else if (claimed) {
      card.appendChild(hintEl('Claimed ✅'));
    }
    grid.appendChild(card);
  }
  container.appendChild(grid);

  const owned = Object.entries(state.museum.artifacts).filter(([, qty]) => qty > 0);
  if (owned.length) {
    container.appendChild(hintEl('Your artifacts:'));
    const artGrid = slotGrid();
    for (const [id, qty] of owned) {
      const def = ARTIFACTS[id];
      const card = document.createElement('div');
      card.className = 'build-card';
      card.innerHTML = `<span class="icon">🏺</span><strong>${def?.name || id}</strong><span>x${qty}</span>`;
      if (qty > 1) {
        card.appendChild(button(`Sell 1 for 🪙${def?.sellPrice ?? 0}`, () => {
          const sold = museum.sellDuplicate(id, 1);
          if (sold) { audio.coin(); toast('Sold a duplicate.', 'success'); refreshPanel(); }
        }));
      }
      artGrid.appendChild(card);
    }
    container.appendChild(artGrid);
  }
}

// ---------------------------------------------------------------------------
// Expeditions (expeditions.js) — hire specialists, send a crew, collect loot.
// ---------------------------------------------------------------------------
function renderExpeditions(container) {
  container.appendChild(hintEl('Crew:'));
  const activeIdxs = new Set(state.expeditions.active.map((a) => a.crewIdx));
  const crewGrid = slotGrid();
  state.expeditions.crew.forEach((member, idx) => {
    const specialist = EXPEDITIONS.specialists[member.specialistId];
    const trip = state.expeditions.active.find((a) => a.crewIdx === idx);
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = `<span class="icon">🧑‍🌾</span><strong>${specialist?.name || member.specialistId}</strong>`;
    if (trip) {
      const now = Date.now();
      if (now >= trip.readyAt) {
        card.appendChild(button('Collect', () => {
          const result = expeditions.collect(idx);
          if (result) {
            audio[result.failed ? 'error' : 'reward']();
            toast(result.failed ? 'The expedition came back empty-handed.' : 'Expedition returned with loot!', result.failed ? 'error' : 'success');
            refreshPanel();
          }
        }));
      } else {
        card.appendChild(hintEl(`Out on ${EXPEDITIONS.sites[trip.siteId]?.name || trip.siteId}… ${fmtDuration(trip.readyAt - now)}`));
      }
    } else {
      card.appendChild(hintEl('Available for a site.'));
    }
    crewGrid.appendChild(card);
  });
  if (crewGrid.children.length) container.appendChild(crewGrid);
  else container.appendChild(hintEl('No specialists hired yet.'));

  container.appendChild(hintEl('Hire a specialist:'));
  const hireGrid = slotGrid();
  for (const [id, specialist] of Object.entries(EXPEDITIONS.specialists)) {
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = `<span class="icon">🧑‍🌾</span><strong>${specialist.name}</strong><span>🪙${specialist.cost}</span>`;
    card.appendChild(button('Hire', () => {
      const idx = expeditions.hireSpecialist(id);
      if (idx !== false) { audio.place(); toast(`Hired ${specialist.name}!`, 'success'); refreshPanel(); }
      else { audio.error(); toast('Not enough coins.', 'error'); }
    }, { disabled: state.coins < specialist.cost }));
    hireGrid.appendChild(card);
  }
  container.appendChild(hireGrid);

  container.appendChild(hintEl('Launch a site:'));
  const siteGrid = slotGrid();
  for (const id of expeditions.sites()) {
    const site = EXPEDITIONS.sites[id];
    const can = expeditions.canLaunch(id);
    const freeIdx = state.expeditions.crew.findIndex((_, idx) => !activeIdxs.has(idx));
    const card = document.createElement('div');
    card.className = `build-card${can && freeIdx !== -1 ? '' : ' locked'}`;
    const suppliesLine = Object.entries(site.supplies || {}).map(([g, qty]) => `${itemIcon(g)} x${qty}`).join(' ');
    card.innerHTML = `<span class="icon">🗺️</span><strong>${site.name}</strong><span class="minigame-hint">${suppliesLine} · ${fmtDuration(site.duration * 1000)}</span>`;
    card.appendChild(button('Launch', () => {
      const ok = expeditions.launch(id, freeIdx);
      if (ok) { audio.depart(); toast(`${site.name} expedition launched!`, 'success'); refreshPanel(); }
      else { audio.error(); toast('Need a free crew member and supplies.', 'error'); }
    }, { disabled: !can || freeIdx === -1 }));
    siteGrid.appendChild(card);
  }
  container.appendChild(siteGrid);
}

// ---------------------------------------------------------------------------
// The newspaper (newspaper.js) — browse simulated neighbours' shops.
// ---------------------------------------------------------------------------
function renderNewspaper(container) {
  // No render-time newspaper.tick() here — main.js's loop ticks it every frame now, and
  // currentIssue()'s own staleness check (only regenerates once the issue is genuinely
  // NEWSPAPER.refreshMinutes old) is idempotent at any call frequency.
  const issue = newspaper.currentIssue(Date.now());
  const refreshRow = row('');
  refreshRow.appendChild(button('Refresh', () => {
    newspaper.refresh(Date.now());
    toast('Newspaper refreshed.', 'info');
    refreshPanel();
  }));
  container.appendChild(refreshRow);

  const listings = issue.listings || [];
  if (!listings.length) { renderComingSoon(container, 'The newspaper'); return; }
  const grid = slotGrid();
  for (const listing of listings) {
    const nb = neighbours.get(listing.neighbourId);
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = `<span class="icon">${itemIcon(listing.item)}</span><strong>${itemName(listing.item)}</strong>
      <span>x${listing.qty} — 🪙${listing.price}${listing.bargain ? ' 🔥' : ''}</span>
      <span class="minigame-hint">${nb ? `${nb.first} ${nb.last}'s Farm` : ''}</span>`;
    card.appendChild(button('Buy', () => {
      const ok = newspaper.buy(listing.id);
      if (ok) { audio.coin(); toast(`Bought ${itemName(listing.item)}!`, 'success'); refreshPanel(); }
      else { audio.error(); toast('Could not buy that.', 'error'); }
    }, { disabled: state.coins < listing.price }));
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Collections + building mastery (collections.js).
// ---------------------------------------------------------------------------
function renderCollections(container) {
  container.appendChild(hintEl('Collection books:'));
  for (const [id, def] of Object.entries(COLLECTIONS.books)) {
    const entries = collections.bookEntries(id);
    const found = collections.found(id);
    const claimableCount = collections.claimable(id);
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `<strong>${def.name}</strong><div>${found.length}/${entries.length} found</div>`;
    if (claimableCount > 0) {
      card.appendChild(button(`Claim x${claimableCount}`, () => {
        const n = collections.claim(id);
        if (n) { audio.reward(); toast(`Claimed ${n} milestone reward${n === 1 ? '' : 's'}!`, 'success'); refreshPanel(); }
      }));
    }
    container.appendChild(card);
  }

  container.appendChild(hintEl('Building mastery:'));
  const masteryEntries = Object.keys(state.collections.mastery);
  if (!masteryEntries.length) {
    container.appendChild(hintEl('Craft recipes to start earning mastery stars.'));
    return;
  }
  const grid = slotGrid();
  for (const buildingId of masteryEntries) {
    const info = collections.masteryOf(buildingId);
    const def = BUILDINGS[buildingId];
    const card = document.createElement('div');
    card.className = 'build-card';
    const stars = info.star > 0 ? '⭐'.repeat(info.star) : '—';
    card.innerHTML = `<strong>${def?.name || buildingId}</strong><span>${stars}</span>
      <span class="minigame-hint">${info.makes} made${info.nextTier ? ` · ${info.nextTier.remaining} to next star` : ' · max star'}</span>`;
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Co-op + the regatta (coop.js / regatta.js) — one dock panel, two systems.
// ---------------------------------------------------------------------------
function renderCoop(container) {
  if (state.level < COOP.unlockLevel) {
    container.appendChild(hintEl(`The co-op unlocks at level ${COOP.unlockLevel}.`));
    return;
  }
  // No render-time coop.tick() here — main.js's loop ticks it every frame now, and both
  // refreshDailyTasksIfNeeded (a calendar-boundary check) and refreshBoard (fills up to
  // capacity and stops) are idempotent at any call frequency.

  container.appendChild(hintEl(`Co-op points: ${coop.contributionPoints()}`));

  container.appendChild(hintEl('Daily tasks:'));
  for (const task of coop.dailyTasks()) {
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `<strong>${task.desc}</strong>${progressBarHtml(task.progress / task.target)}<span>${task.progress}/${task.target}</span>`;
    if (task.claimed) {
      card.appendChild(hintEl('Claimed ✅'));
    } else if (task.complete) {
      card.appendChild(button('Claim', () => {
        const ok = coop.claimTask(task.id);
        if (ok) { audio.reward(); toast('Task reward claimed!', 'success'); refreshPanel(); }
      }));
    }
    container.appendChild(card);
  }

  container.appendChild(hintEl('Request board:'));
  for (const req of coop.requests()) {
    const card = document.createElement('div');
    card.className = 'order-card';
    if (req.posterIsPlayer) {
      const now = Date.now();
      const ready = req.readyAt !== null && now >= req.readyAt;
      card.innerHTML = `<strong>Your request</strong><div>${itemIcon(req.item)} ${itemName(req.item)} x${req.qty}</div>`;
      if (ready) {
        card.appendChild(button('Collect', () => {
          const result = coop.collectRequest(req.id);
          if (result) { audio.coin(); toast('Request filled!', 'success'); refreshPanel(); }
        }));
      } else {
        card.appendChild(hintEl(`Waiting… ${fmtDuration((req.readyAt || 0) - now)}`));
        card.appendChild(button('Cancel', () => { coop.cancelRequest(req.id); refreshPanel(); }));
      }
    } else {
      const have = stockCount(req.item) >= req.qty;
      card.innerHTML = `<strong>Neighbour request</strong><div>${itemIcon(req.item)} ${itemName(req.item)} x${req.qty}</div>`;
      card.appendChild(button('Help', () => {
        const ok = coop.helpRequest(req.id);
        if (ok) { audio.coin(); toast('Helped a neighbour!', 'success'); refreshPanel(); }
      }, { disabled: !have }));
    }
    container.appendChild(card);
  }

  container.appendChild(hintEl('Post a request:'));
  const [minQ] = COOP.requestBoard.requestSizeRange;
  const postRow = row('');
  postRow.appendChild(button(`Request ${itemIcon('wheat')} Wheat x${minQ}`, () => {
    const ok = coop.postRequest('wheat', minQ);
    if (ok) { toast('Request posted!', 'success'); refreshPanel(); }
    else { audio.error(); toast('Cannot post a request right now.', 'error'); }
  }));
  container.appendChild(postRow);

  container.appendChild(hintEl('Regatta:'));
  if (state.level < REGATTA.unlockLevel) {
    container.appendChild(hintEl(`Unlocks at level ${REGATTA.unlockLevel}.`));
    return;
  }
  // Kept deliberately, unlike lab/newspaper/coop above: regatta.tick() advances rival scores
  // through neighbours.simulate()'s Math.round(), which — like helicopter's fuel — resolves
  // elapsed-since-last-call and unconditionally resets its own baseline (state.regatta.rivals[].
  // lastTickAt). main.js's loop only ticks this on a 5-minute throttle for safe background
  // progress, so a panel opened between throttled ticks would show standings up to 5 minutes
  // stale without this. Calling it again here is safe rather than a double-advance: it is
  // delta-based against the real elapsed wall-clock time since whichever call (loop or render)
  // touched it last, never a fixed per-call increment, so an extra call just adds the tiny
  // extra slice of real time and moves the baseline forward — it cannot count the same elapsed
  // time twice.
  safeTick(regatta.tick, Date.now());
  const season = regatta.activeSeason(Date.now());
  const league = REGATTA.leagues.find((l) => l.id === season.league);
  container.appendChild(hintEl(`League: ${league?.name || season.league} · Season ends in ${fmtDuration(season.endsAt - Date.now())}`));
  for (const standing of regatta.standings()) {
    const line = row(`<span>${standing.isPlayer ? '⭐ ' : ''}${standing.name}</span><span>${standing.points} pts</span>`);
    line.style.display = 'flex';
    line.style.justifyContent = 'space-between';
    container.appendChild(line);
  }
  if (season.lastRewards && !season.placementClaimed) {
    const claimRow = row('');
    claimRow.appendChild(button('Claim last season reward', () => {
      const ok = regatta.claimPlacement();
      if (ok) { audio.reward(); toast('Placement reward claimed!', 'success'); refreshPanel(); }
    }));
    container.appendChild(claimRow);
  }

  container.appendChild(hintEl('Regatta tasks:'));
  for (const task of regatta.board()) {
    const card = document.createElement('div');
    card.className = 'order-card';
    if (task.claimedAt === null) {
      card.innerHTML = `<strong>${task.desc}</strong>`;
      card.appendChild(button('Start', () => { regatta.claimTask(task.id); refreshPanel(); }));
    } else {
      const prog = regatta.taskProgress(task.id);
      const progress = prog?.progress || 0;
      card.innerHTML = `<strong>${task.desc}</strong>${progressBarHtml(progress / task.target)}<span>${progress}/${task.target}</span>`;
      if (task.handedIn) card.appendChild(hintEl('Handed in ✅'));
      else if (prog?.complete && !prog.expired) {
        card.appendChild(button('Hand in', () => {
          const ok = regatta.completeTask(task.id);
          if (ok) { audio.reward(); toast('Task handed in!', 'success'); refreshPanel(); }
        }));
      } else if (prog?.expired) card.appendChild(hintEl('Expired'));
    }
    container.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Photo mode (decorate.js: setFrame/addSticker/capture).
// ---------------------------------------------------------------------------
function renderPhoto(container) {
  container.appendChild(hintEl('Choose a frame:'));
  const grid = slotGrid();
  for (const frameId of PHOTO.frames) {
    const label = frameId.replace('frame_', '').replace(/^\w/, (c) => c.toUpperCase()) || 'None';
    const active = state.photo.frame === frameId;
    const card = document.createElement('div');
    card.className = `build-card${active ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">🖼️</span><strong>${label}</strong>`;
    if (active) card.appendChild(hintEl('Selected'));
    else card.appendChild(button('Use', () => {
      decorate.setFrame(frameId);
      toast('Frame changed.', 'info');
      refreshPanel();
    }));
    grid.appendChild(card);
  }
  container.appendChild(grid);
  container.appendChild(hintEl(`Stickers placed: ${state.photo.stickers.length}/${PHOTO.maxStickers}`));
  const captureRow = row('');
  captureRow.appendChild(button('Take Photo', () => {
    decorate.capture();
    audio.click();
    toast('Photo captured!', 'success');
  }));
  container.appendChild(captureRow);
}

// ---------------------------------------------------------------------------
// Daily Wheel + Pets + the occasional NPC visitor offer (extras.js).
// These have no world structure of their own, so they share the "wheel" dock panel.
// ---------------------------------------------------------------------------
function renderWheel(container) {
  const canSpin = extras.canSpin(Date.now());
  container.appendChild(hintEl(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`));
  const spinRow = row('');
  spinRow.appendChild(button(canSpin ? 'Spin the wheel!' : 'Come back tomorrow', () => {
    const result = extras.spin();
    if (!result) { audio.error(); return; }
    const parts = [];
    if (result.coins) parts.push(`🪙${result.coins}`);
    if (result.diamonds) parts.push(`💎${result.diamonds}`);
    if (result.item) parts.push(`${itemIcon(result.item)} x${result.qty || 1}`);
    if (result.material) parts.push(`${itemIcon(result.material)} x${result.qty || 1}`);
    audio.reward();
    toast(`You won: ${parts.join(', ')}!`, 'success');
    refreshPanel();
  }, { disabled: !canSpin }));
  container.appendChild(spinRow);

  container.appendChild(hintEl('Pets:'));
  const grid = slotGrid();
  for (const [id, def] of Object.entries(PETS)) {
    const owned = state.pets[id];
    const card = document.createElement('div');
    card.innerHTML = `<span class="icon">${id === 'dog' ? '🐶' : '🐱'}</span><strong>${def.name}</strong>`;
    if (!owned?.owned) {
      const locked = state.level < def.unlockLevel;
      card.className = `build-card${locked ? ' locked' : ''}`;
      card.appendChild(hintEl(`🪙${def.cost}`));
      card.appendChild(button('Adopt', () => {
        const ok = extras.buyPet(id);
        if (ok) { audio.place(); toast(`${def.name} adopted!`, 'success'); refreshPanel(); }
        else { audio.error(); toast('Not enough coins.', 'error'); }
      }, { disabled: locked || state.coins < def.cost }));
    } else {
      card.className = 'build-card';
      const fedToday = owned.lastFedAt && new Date(owned.lastFedAt).toDateString() === new Date().toDateString();
      card.appendChild(button(fedToday ? 'Fed today' : 'Feed', () => {
        const ok = extras.feedPet(id);
        if (ok) { audio.harvest(); toast(`+${def.feedXp} XP!`, 'success'); refreshPanel(); }
      }, { disabled: fedToday }));
    }
    grid.appendChild(card);
  }
  container.appendChild(grid);

  const visitor = state.visitor;
  if (visitor) {
    container.appendChild(hintEl('A visitor has an offer:'));
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `<strong>${itemIcon(visitor.itemId)} ${itemName(visitor.itemId)} x${visitor.qty}</strong><div>🪙${visitor.price} total</div>`;
    card.appendChild(button('Accept', () => {
      extras.resolveVisitor(true);
      audio.coin();
      toast('Sold to the visitor!', 'success');
      refreshPanel();
    }));
    card.appendChild(button('Decline', () => { extras.resolveVisitor(false); refreshPanel(); }));
    container.appendChild(card);
  }
}

/** Every input this recipe is short on right now, as readable "icon Name (have/need)" strings. */
function missingInputs(recipe) {
  const out = [];
  for (const [id, qty] of Object.entries(recipe.inputs || {})) {
    const have = stockOf(id)[id] || 0;
    if (have < qty) out.push(`${itemIcon(id)} ${itemName(id)} (${have}/${qty})`);
  }
  return out;
}

/** Compact "icon have/need" line for every input a recipe needs, met or not. */
function inputsLine(recipe) {
  return Object.entries(recipe.inputs || {})
    .map(([id, qty]) => `${itemIcon(id)} ${stockOf(id)[id] || 0}/${qty}`)
    .join('  ');
}

/**
 * Shared "what's cooking" view for one production object's own state.production entries
 * (an ordinary building's queue, or the Workshop's — both are just filtered rows of the same
 * queue; see production.js). `recipeOf(id)` resolves a recipeId to its {time,...} definition
 * for the progress bar; `collectFn(entry, index)` performs the actual collection and should
 * return a truthy result on success. Renders nothing when the queue is empty.
 */
/** True when a craft has finished prepping but its game has not been played through. */
function needsPlay(entry) {
  return !!entry.play && !entry.play.done;
}

/** The queue card's status line — a playable craft says what it is waiting for. */
function statusLine(entry, ready) {
  if (!ready) return 'Crafting…';
  if (!needsPlay(entry)) {
    const tier = entry.play ? QUALITY.tiers[entry.play.tier] : null;
    return tier ? `${tier.label} — ready to collect!` : 'Ready to collect!';
  }
  const stages = (minigames.chainFor(entry) || []);
  return stages.length > 1
    ? `Ready to make — step ${entry.play.stage + 1} of ${stages.length}`
    : 'Ready to make';
}

/** Button label for a playable craft — 'Resume' reads better than 'Make' mid-chain. */
function playLabel(entry) {
  return entry.play && entry.play.stage > 0 ? 'Resume' : 'Make it';
}

/**
 * Say ONCE, the first time a craft is waiting to be played, that some things are made by hand.
 *
 * This is the one rule in the game that contradicts what a farming game has trained everyone to
 * expect: a timer finishes and the thing is yours. Here, for roughly one recipe in three, the
 * timer only gets you as far as being ABLE to make it, and there is no other way to collect it.
 *
 * Nothing was telling anybody that. The recipe card carries a 🎮 and the queue says "Ready to
 * make", which is enough to work out once you already know the rule and not enough to teach it -
 * and the tutorial ends at the order board, twelve steps and several levels before the first
 * playable recipe (cookie, at the bakery, level 8) can possibly come up.
 *
 * The three things it has to say are the three a player would otherwise worry about: it will not
 * spoil, you are not trapped with it, and there is a gentler setting if you want one.
 *
 * The flag lives on state.minigames, which every save already has, and its ABSENCE reads as
 * "not explained yet" - so this needs no migration and an older save gets the explanation too,
 * which is right, because that player has never seen it either.
 */
function explainTheGateOnce() {
  if (!state.minigames || state.minigames.explained) return;
  state.minigames.explained = true;
  save();
  openModal(`
    <h3>🎮 This one is made by hand</h3>
    <p>Most things finish on their own. Some — about one recipe in three — need you to
       <strong>make them yourself</strong> once the prep is done. It is the only way to collect them,
       and how well you do decides the quality, the XP and sometimes an extra one.</p>
    <p><strong>It will wait.</strong> Nothing spoils and nothing expires, so you can come back to it
       whenever you like. Anything finished behind it in the queue can still be collected.</p>
    <p><strong>You are not stuck with it.</strong> <em>Throw it out</em> frees the slot and returns
       half the ingredients.</p>
    <p><strong>It cannot be failed</strong>, only done well or less well. If you would rather it were
       gentler, <em>Assist mode</em> in Settings gives longer stages and wider margins.</p>
    <div class="minigame-actions">
      <button class="btn" data-close>Got it</button>
    </div>`);
}

/**
 * Open one stage of a playable craft. The shell is imported HERE, lazily, so neither it nor any
 * verb is on the boot path — the game loads exactly as fast as it did before this feature.
 */
async function openStagePlayer(entry) {
  const host = openModal('<div class="minigame-loading">Setting up…</div>');
  try {
    const { playStage } = await import('./minigames/shell.js');
    const outcome = await playStage(host, entry, {});
    closeModal();
    if (outcome.committed && outcome.result) {
      if (outcome.result.done) {
        audio.harvest();
        toast(`${itemName(entry.recipeId)} — ${outcome.result.tier}! Collect it from the queue.`, 'success');
      } else {
        audio.place();
        toast(`Step ${outcome.result.stage} of ${outcome.result.of} done.`, 'success');
      }
    }
  } catch (err) {
    // A failed dynamic import on a REQUIRED craft must never be a dead end.
    closeModal();
    audio.error();
    toast('That game could not be loaded — try again, or finish it plain from settings.', 'error');
  }
  refreshPanel();
}

function renderQueue(container, entries, recipeOf, collectFn) {
  if (!entries.length) return;
  const heading = document.createElement('p');
  heading.className = 'minigame-hint';
  heading.textContent = `In progress (${entries.length}):`;
  container.appendChild(heading);

  const now = Date.now();
  for (const [index, entry] of entries.entries()) {
    const recipe = recipeOf(entry.recipeId);
    const ready = entry.readyAt <= now;
    const total = recipe ? recipe.time * 1000 : 1;
    const frac = ready ? 1 : Math.max(0, Math.min(1, 1 - (entry.readyAt - now) / total));
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `<strong>${itemIcon(entry.recipeId)} ${itemName(entry.recipeId)}</strong>
      ${progressBarHtml(frac)}
      <span>${statusLine(entry, ready)}</span>`;
    if (ready && needsPlay(entry)) {
      // A PLAYABLE craft: the prep timer is done, but the item only exists once its game has
      // been played through. Nothing expires while it waits here.
      explainTheGateOnce();
      card.appendChild(button(playLabel(entry), () => openStagePlayer(entry)));
      // The release valve. A playable craft can only be collected by playing it, so without a
      // way out a player who does not fancy three cakes would hold three slots for ever.
      card.appendChild(button('Throw it out', () => {
        const recipe = itemName(entry.recipeId);
        openModal(`
          <h3>Throw out the ${recipe}?</h3>
          <p>The slot is freed and half the ingredients come back, rounded down. Anything that will not fit is paid out in coins. The rest is lost.</p>
          <div class="minigame-actions">
            <button class="btn quiet" data-close>Keep it</button>
            <button class="btn danger" id="confirm-discard">Throw it out</button>
          </div>`);
        document.getElementById('confirm-discard')?.addEventListener('click', () => {
          const out = production.discardBatch(entry.cid);
          closeModal();
          if (out) { audio.error(); toast(`Threw out the ${recipe}.`, 'info'); refreshPanel(); }
        });
      }, { className: 'quiet' }));
    } else if (ready) {
      card.appendChild(button('Collect', () => {
        const result = collectFn(entry, index);
        if (result) {
          audio.harvest();
          toast(`Collected ${itemName(entry.recipeId)}!`, 'success');
          tutorial.emit(`collected:${entry.recipeId}`);
          refreshPanel();
        } else { audio.error(); toast('Barn is full — make room first.', 'error'); }
      }));
    }
    container.appendChild(card);
  }
}

function renderBuildingQueue(container, buildingId) {
  const obj = state.farm.objects.find((o) => o.id === buildingId);
  const def = obj && BUILDINGS[obj.type];
  if (!obj || !def) { renderComingSoon(container, 'This building'); return; }

  const recipes = def.recipes || [];
  const entries = state.production.filter((p) => p.objectId === buildingId);
  renderQueue(container, entries, (id) => recipes.find((r) => r.id === id),
    () => production.collectBuilding(buildingId));

  const queueFull = entries.length >= (def.queueSlots ?? Infinity);
  const grid = slotGrid();
  for (const recipe of recipes) {
    const locked = economy.isUnlocked ? !economy.isUnlocked(recipe.id) : false;
    const short = missingInputs(recipe);
    const card = document.createElement('div');
    card.className = `build-card${locked ? ' locked' : ''}`;
    // The Bake Book, put where a player is already looking rather than in a panel of its own:
    // your best result for this recipe, on the card you queue it from. state.minigames.best was
    // being written by finalize() and read by nothing at all until this line.
    const bestIdx = recipe.play ? state.minigames.best[recipe.id] : undefined;
    const bestTier = bestIdx === undefined ? null : QUALITY.tiers[bestIdx];
    const bookLine = recipe.play
      ? `<span class="minigame-hint">🎮 ${bestTier ? `Best: ${bestTier.label}` : 'Not yet made by hand'}</span>`
      : '';
    card.innerHTML = `<span class="icon">${itemIcon(recipe.id)}</span><strong>${itemName(recipe.id)}</strong>
      <span class="minigame-hint">${inputsLine(recipe)}</span>${bookLine}`;
    card.appendChild(button('Queue', () => {
      const ok = typeof production.enqueue === 'function' && production.enqueue(buildingId, recipe.id);
      if (ok) {
        audio.place();
        toast(`Queued ${itemName(recipe.id)}!`, 'success');
        tutorial.emit(`enqueued:${recipe.id}`);
        refreshPanel();
      } else { audio.error(); toast("Can't queue that right now.", 'error'); }
    }, { disabled: locked || queueFull || short.length > 0 }));
    if (locked) card.appendChild(hintEl(`Unlocks at level ${recipe.unlockLevel}.`));
    else if (queueFull) card.appendChild(hintEl('Queue is full — collect something first.'));
    else if (short.length) card.appendChild(hintEl(`Need ${short.join(', ')}.`));
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

/**
 * Hand a freshly crafted or bought building to the placement ghost so the PLAYER picks the tile.
 *
 * This used to call findFreeTile() and drop the building on the first fitting tile it scanned,
 * front to back, with no say from anyone. Two things were wrong with that: you could not put a
 * bakery where you wanted it, and once the scan found nothing you got "No free space" with no way
 * to rearrange what was already down. The ghost fixes both, and input.js finishes the gesture.
 *
 * The panel closes first, because the world is what the player now needs to see.
 */
function buildAt(kind, id, def, onPlaced) {
  closePanel();
  placement.begin(kind, id, {
    label: def.name,
    onPlaced: () => {
      onPlaced && onPlaced();
      audio.place();
      toast(`Built ${def.name}!`, 'success');
      tutorial.emit(`placed:${id}`);
      save();
    },
  });
  toast(`Drag ${def.name} where you want it, then tap to place. Esc cancels.`, 'info');
}

/**
 * The Building Workshop (L6): the crafting spine. Coins alone never place a production
 * building — see workshop.js. This panel is the ONLY place that chain is reachable:
 *   1. Build the Workshop itself (coin-only, like feed_mill/bakery).
 *   2. Craft components from raw MATERIALS, then kits from components (workshop.craft/
 *      collect — both just views onto the ordinary production queue).
 *   3. Place a building: coins are still charged (farm.place), and on top of that a
 *      kit-required building (BUILDINGS[x].kit) needs its kit held (workshop.hasKitFor) and
 *      consumes it (workshop.consumeKit) — never the other way around, and never on a
 *      failed placement.
 * Animal pens stay coin-only throughout (ANIMALS has no kit concept), so they get their own
 * small section rather than being mixed into the kit chain.
 */
function renderWorkshop(container) {
  const workshopObj = state.farm.objects.find((o) => o.kind === 'building' && o.type === 'build_workshop');

  if (!workshopObj) {
    const def = BUILDINGS.build_workshop;
    container.appendChild(hintEl('Build the Workshop to start turning raw materials into components, components into kits, and kits into buildings.'));
    const grid = slotGrid();
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = `<span class="icon">🏗️</span><strong>${def.name}</strong><span>🪙${def.cost ?? 0}</span>`;
    card.appendChild(button('Build', () => buildAt('building', 'build_workshop', def)));
    grid.appendChild(card);
    container.appendChild(grid);
    return;
  }

  // --- 1. Crafting: raw materials → components → kits --------------------------------
  const recipes = BUILDINGS.build_workshop.recipes || [];
  const entries = state.production.filter((p) => p.objectId === workshopObj.id);
  renderQueue(container, entries, (id) => recipes.find((r) => r.id === id),
    (entry, index) => workshop.collect(index));

  container.appendChild(hintEl('Craft components from materials, then kits from components:'));
  const craftGrid = slotGrid();
  const queueFull = entries.length >= (BUILDINGS.build_workshop.queueSlots ?? Infinity);
  for (const recipe of recipes) {
    const locked = !economy.isUnlocked(recipe.id);
    const craftable = !locked && workshop.canCraft(recipe.id);
    const short = missingInputs(recipe);
    const card = document.createElement('div');
    card.className = `build-card${craftable ? '' : ' locked'}`;
    card.innerHTML = `<span class="icon">${itemIcon(recipe.id)}</span><strong>${itemName(recipe.id)}</strong>
      <span class="minigame-hint">${inputsLine(recipe)}</span>`;
    card.appendChild(button('Craft', () => {
      const ok = workshop.craft(recipe.id);
      if (ok) {
        audio.place();
        toast(`Crafting ${itemName(recipe.id)}…`, 'success');
        tutorial.emit(`crafting:${recipe.id}`);
        refreshPanel();
      } else { audio.error(); toast("Can't craft that right now.", 'error'); }
    }, { disabled: !craftable }));
    if (locked) card.appendChild(hintEl(`Unlocks at level ${recipe.unlockLevel}.`));
    else if (queueFull) card.appendChild(hintEl('Queue is full — collect something first.'));
    else if (short.length) card.appendChild(hintEl(`Need ${short.join(', ')}.`));
    craftGrid.appendChild(card);
  }
  container.appendChild(craftGrid);

  // --- 2. Build: place a crafted kit as its production building ----------------------
  const built = new Set(state.farm.objects.map((o) => o.type));
  container.appendChild(hintEl('Place a building — a kit-gated one needs its kit crafted above, on top of the coin cost:'));
  const buildGrid = slotGrid();
  for (const [id, def] of Object.entries(BUILDINGS)) {
    if (id === 'build_workshop' || built.has(id)) continue;
    const locked = !economy.isUnlocked(id);
    const needsKit = !!def.kit;
    const haveKit = workshop.hasKitFor(id);
    const card = document.createElement('div');
    card.className = `build-card${locked ? ' locked' : ''}`;
    const kitLine = needsKit
      ? `<span class="minigame-hint">${haveKit ? '✅' : '❌'} ${itemIcon(def.kit)} ${itemName(def.kit)}</span>` : '';
    card.innerHTML = `<span class="icon">🏗️</span><strong>${def.name}</strong><span>🪙${def.cost ?? 0}</span>${kitLine}`;
    card.appendChild(button('Build', () => {
      if (needsKit && !workshop.hasKitFor(id)) {
        audio.error();
        toast(`You need a ${itemName(def.kit)} to build the ${def.name} — craft one above first.`, 'error');
        return;
      }
      buildAt('building', id, def, () => { if (needsKit) workshop.consumeKit(id); });
    }, { disabled: locked || (needsKit && !haveKit) }));
    if (locked) card.appendChild(hintEl(`Unlocks at level ${def.unlockLevel}.`));
    else if (needsKit && !haveKit) card.appendChild(hintEl(`Craft a ${itemName(def.kit)} first.`));
    buildGrid.appendChild(card);
  }
  container.appendChild(buildGrid);

  // --- 3. Livestock: pens stay coin-only, no kit involved -----------------------------
  const penGrid = slotGrid();
  for (const [id, def] of Object.entries(ANIMALS)) {
    if (built.has(id)) continue;
    const locked = !economy.isUnlocked(id);
    const card = document.createElement('div');
    card.className = `build-card${locked ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">🐾</span><strong>${def.name}</strong><span>🪙${def.penCost ?? 0}</span>`;
    card.appendChild(button('Build', () => buildAt('pen', id, def), { disabled: locked }));
    if (locked) card.appendChild(hintEl(`Unlocks at level ${def.unlockLevel}.`));
    penGrid.appendChild(card);
  }
  if (penGrid.children.length) {
    container.appendChild(hintEl('Livestock:'));
    container.appendChild(penGrid);
  }

  if (!craftGrid.children.length && !buildGrid.children.length && !penGrid.children.length) {
    container.appendChild(hintEl("You've built everything available so far!"));
  }
}

function renderSettings(container) {
  const soundRow = row('');
  const soundBtn = button(state.settings.sound ? '🔊 Sound: On' : '🔇 Sound: Off', () => {
    state.settings.sound = !state.settings.sound;
    save();
    refreshPanel();
  });
  soundRow.appendChild(soundBtn);
  container.appendChild(soundRow);

  const langRow = row('<p>Language: English</p>');
  container.appendChild(langRow);

  // Playing is REQUIRED to collect a playable craft, so these two are not decoration: they are
  // what stops that gate becoming a wall. Assist widens every tolerance and doubles every stage;
  // auto-finish is the floor-tier way out for someone who still cannot finish one, and is off by
  // default so an ordinary player never sees it.
  const help = document.createElement('div');
  help.className = 'panel-row';
  help.innerHTML = '<p><strong>Making things</strong></p>';
  container.appendChild(help);

  const assistRow = row('');
  assistRow.appendChild(button(state.settings.assist ? '🐢 Assist mode: On' : '🐢 Assist mode: Off', () => {
    state.settings.assist = !state.settings.assist;
    save();
    refreshPanel();
  }));
  assistRow.appendChild(hintEl('Longer stages and wider margins on every making game. Tops out at Fine rather than Masterpiece, so it is a helping hand and not a shortcut.'));
  container.appendChild(assistRow);

  const autoRow = row('');
  autoRow.appendChild(button(state.settings.autoFinish ? '🤖 Let the machine finish: On' : '🤖 Let the machine finish: Off', () => {
    state.settings.autoFinish = !state.settings.autoFinish;
    save();
    refreshPanel();
  }));
  autoRow.appendChild(hintEl('Adds a button inside every making game that completes it at Plain quality — no bonus, no tip. For when a game is not playable for you; nothing is ever lost.'));
  container.appendChild(autoRow);

  const exportBtn = button('Export save', () => {
    const data = state && JSON.stringify(state);
    toast(data ? 'Save copied to console.' : 'Nothing to export.', 'info');
    if (data) console.log(data);
  });
  const resetBtn = button('Reset game', () => {
    openModal(`
      <h3>Reset your farm?</h3>
      <p>This deletes all progress and cannot be undone.</p>
      <div class="minigame-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-danger" id="confirm-reset">Reset</button>
      </div>`);
    document.getElementById('confirm-reset')?.addEventListener('click', () => {
      import('./state.js').then((m) => { m.resetGame(); location.reload(); });
    });
  }, { className: 'btn-danger' });
  const actions = row('');
  actions.appendChild(exportBtn);
  actions.appendChild(resetBtn);
  container.appendChild(actions);
}

function renderAchievements(container) {
  const unlocked = state.achievements?.unlocked || [];
  container.appendChild(hintEl(`${unlocked.length}/${ACHIEVEMENTS.length} unlocked.`));
  const grid = slotGrid();
  for (const a of ACHIEVEMENTS) {
    const have = a.stat === 'level' ? state.level : (state.stats[a.stat] || 0);
    const done = unlocked.includes(a.id);
    const card = document.createElement('div');
    card.className = `build-card${done ? '' : ' locked'}`;
    card.innerHTML = `<span class="icon">${done ? '⭐' : '🔒'}</span><strong>${a.name}</strong>
      <span class="minigame-hint">${a.desc}</span>
      <span>${Math.min(have, a.target)}/${a.target}</span>`;
    grid.appendChild(card);
  }
  container.appendChild(grid);

  const bookSum = bakebook.summary();
  container.appendChild(row('')).appendChild(button(
    `Bake Book \u2014 ${bookSum.mastered}/${bookSum.total} mastered`,
    () => openPanel('bakebook'),
  ));
}

/**
 * The Bake Book. Every playable recipe and the best tier you have ever reached on it.
 *
 * It opens from Achievements rather than from the dock, because the dock is contractually four
 * buttons - the four things with no place in the world - and a fifth would break the contract
 * test as well as the rule behind it. A record of what you have made sits naturally beside a
 * record of what you have done.
 *
 * The list is derived in bakebook.js and only rendered here, so what "mastered" means is decided
 * in exactly one place.
 */
function renderBakeBook(container) {
  const sum = bakebook.summary();
  const tiers = sum.perTier.map((t) => `${t.label} ${t.count}`).join(' \u00b7 ');
  container.appendChild(hintEl(
    sum.complete
      ? `Every one of the ${sum.total} playable recipes at Masterpiece. The book is finished.`
      : `${sum.mastered}/${sum.total} at Masterpiece \u00b7 ${sum.played} played, ${sum.unplayed} never tried \u00b7 ${tiers}`,
    true,
  ));

  // Skill is per VERB while quality is recorded per RECIPE, so a player stuck at Plain on four
  // recipes usually has one verb they have not got the hang of - which is invisible on any single
  // recipe card. Only verbs actually attempted are worth naming; never having tried something is
  // not the same as being bad at it.
  const weakest = bakebook.verbStanding().filter((v) => v.played > 0 && v.mastered < v.played);
  if (weakest.length) {
    container.appendChild(hintEl(
      'Still to master: ' + weakest.slice(0, 4).map((v) => `${v.name} (${v.mastered}/${v.played})`).join(', '),
    ));
  }

  // ONE grid, not a chapter per building. bakebook.byBuilding() exists and is tested, but almost
  // every factory has exactly one playable recipe, so grouping put a heading above 42 of the 44
  // cards and turned a scannable page into a very long scroll. The building name goes on the card
  // instead, which is the same information in a quarter of the height.
  const grid = slotGrid();
  for (const e of bakebook.entries()) {
    const card = document.createElement('div');
    // An unplayed recipe looks locked but is NOT a failure, and the copy says which it is: a book
    // that renders "never tried" and "tried and did badly" the same way tells the player they
    // failed at something they have not attempted.
    card.className = `build-card${e.bestIndex === undefined ? ' locked' : ''}`;
    const badge = e.mastered ? '\u2b50' : e.bestIndex === undefined ? '\u2b1c' : '\u2705';
    const verbs = e.stages.map((st) => st.name).join(' \u2192 ');
    const stand = e.bestIndex === undefined
      ? 'never played'
      : `best: ${e.bestTier ? e.bestTier.label : e.bestIndex}`;
    card.innerHTML = `<span class="icon">${badge}</span><strong>${itemName(e.recipeId)}</strong>
      <span class="minigame-hint">${e.buildingName} \u00b7 lv ${e.unlockLevel}</span>
      <span class="minigame-hint">${verbs}</span>
      <span>${stand}</span>`;
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function renderDecorate(container) {
  const active = !!state.decorate?.active;
  const btn = button(active ? 'Exit Decorate Mode' : 'Enter Decorate Mode', () => {
    if (active) decorate.exit(); else decorate.enter();
    save();
    closePanel();
    toast(state.decorate.active ? 'Decorate mode on — drag decorations to arrange your farm.' : 'Decorate mode off.', 'info');
  });
  container.appendChild(row('')).appendChild(btn);
}

/** Central dispatch: each panel gets a best-effort real render, or a coming-soon fallback. */
function renderPanelContent(panelId, ctx = null) {
  const container = el.sheetContent;
  container.innerHTML = '';
  switch (panelId) {
    case 'silo': renderBarnOrSilo(container, 'silo'); tutorial.emit('panel_opened:inventory'); break;
    case 'barn': renderBarnOrSilo(container, 'barn'); tutorial.emit('panel_opened:inventory'); break;
    case 'orders': renderOrders(container); break;
    case 'truck': renderTruck(container); break;
    case 'shop': renderShop(container); break;
    case 'market': renderMarket(container); break;
    case 'boat': renderBoat(container); break;
    case 'fishing': renderFishing(container); break;
    case 'mine': renderMine(container); break;
    case 'merge': renderMerge(container); break;
    case 'building': renderBuildingQueue(container, ctx); break;
    case 'workshop': renderWorkshop(container); break;
    case 'town': renderTown(container); break;
    case 'trains': renderTrains(container); break;
    case 'airport': renderAirport(container); break;
    case 'zoo': renderZoo(container); break;
    case 'helicopter': renderHelicopter(container); break;
    case 'lab': renderLab(container); break;
    case 'museum': renderMuseum(container); break;
    case 'expeditions': renderExpeditions(container); break;
    case 'newspaper': renderNewspaper(container); break;
    case 'collections': renderCollections(container); break;
    case 'coop': renderCoop(container); break;
    case 'photo': renderPhoto(container); break;
    case 'wheel': renderWheel(container); break;
    case 'settings': renderSettings(container); break;
    case 'achievements': renderAchievements(container); break;
    case 'bakebook': renderBakeBook(container); break;
    case 'decorate': renderDecorate(container); break;
    default: {
      const struct = STRUCTURES[ctx];
      renderComingSoon(container, struct?.name || PANEL_TITLES[panelId] || panelId);
    }
  }

  // One line, every panel, including ones nobody has written yet. Attaching the search here rather
  // than inside each render function is the whole design: twenty-nine copies of a filter would be
  // twenty-nine chances to diverge, and the thirtieth panel would ship without one because its
  // author did not know to add it. panelsearch decides for itself whether there is enough on
  // screen to be worth searching, so a two-card panel is not given a box that finds nothing.
  panelsearch.attach(container);
}

// ---------------------------------------------------------------------------
// Dock + init
// ---------------------------------------------------------------------------
export function init() {
  el = {
    hudTop: document.querySelector('.hud-top'),
    coinsValue: q('coins-value'),
    diamondsValue: q('diamonds-value'),
    siloValue: q('silo-value'),
    barnValue: q('barn-value'),
    levelBadge: q('level-badge'),
    levelNumber: q('level-number'),
    dock: q('dock'),
    sheet: q('sheet'),
    sheetTitle: q('sheet-title'),
    sheetContent: q('sheet-content'),
    radial: q('radial'),
    toasts: q('toasts'),
    modal: q('modal'),
    modalCard: q('modal-card'),
    eventBanner: q('event-banner'),
  };

  // The silo and barn pills are the thing a player reaches for when they want to see (and
  // sell) what they are holding - reading a number and not being able to open it is the whole
  // complaint. The world structures still open the same panels; this is a second door, not a
  // replacement for the click-the-world rule.
  q('silo-pill')?.addEventListener('click', () => { audio.click(); if (isPanelOpen() && openPanelId === 'silo') closePanel(); else openPanel('silo'); });
  q('barn-pill')?.addEventListener('click', () => { audio.click(); if (isPanelOpen() && openPanelId === 'barn') closePanel(); else openPanel('barn'); });

  el.sheet.querySelector('.sheet-handle')?.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePanel(); closeRadial(); } });

  el.dock?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dock-btn');
    if (!btn || btn.hidden) return;
    audio.click();
    const panelId = btn.dataset.panel;
    if (isPanelOpen() && openPanelId === panelId) closePanel();
    else openPanel(panelId);
  });

  // The Daily Wheel (+ pets, + the occasional NPC visitor offer) has no world structure of its
  // own to be clicked, so — like decorate/achievements/settings — it lives on the dock. Added
  // here at runtime rather than in index.html, matching how the "coop" button already ships
  // hidden in markup and is only unhidden once unlocked (see syncDockVisibility above).
  if (el.dock && !findDockButton('wheel')) {
    const wheelBtn = document.createElement('button');
    wheelBtn.className = 'dock-btn';
    if (wheelBtn.dataset) wheelBtn.dataset.panel = 'wheel';
    wheelBtn.title = 'Daily Wheel';
    wheelBtn.setAttribute('aria-label', 'Daily wheel');   // the only text is an emoji; a title alone is not a name
    wheelBtn.textContent = '🎡';
    el.dock.appendChild(wheelBtn);
  }

  economy.onCoinsChanged(() => updateHud());
  economy.onXpChanged((info) => {
    updateHud();
    if (info?.leveledUp) {
      audio.levelUp();
      openModal(`<h3>Level ${info.newLevel}! 🎉</h3><p>You've grown your farm to level ${info.newLevel}.</p>
        <div class="minigame-actions"><button class="btn" data-close>Nice!</button></div>`);
    }
  });

  updateHud();
}
