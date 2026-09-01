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
import * as audio from './audio.js';
import * as tutorial from './tutorial.js';
import * as workshop from './workshop.js';
import { CROPS, ANIMALS, BUILDINGS, GOODS, STRUCTURES, MATERIALS, LEVELS, FARM } from './data.js';

// ---------------------------------------------------------------------------
// DOM refs, wired in init()
// ---------------------------------------------------------------------------
let el = {};
let radialTarget = null; // context passed to the currently-open radial menu's callbacks

function q(id) { return document.getElementById(id); }

function itemName(id) {
  return CROPS[id]?.name || GOODS[id]?.name || ANIMALS[id]?.name || MATERIALS[id]?.name || id;
}
function itemIcon(id) {
  return CROPS[id]?.icon || GOODS[id]?.icon || ANIMALS[id]?.icon || MATERIALS[id]?.icon || '❔';
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
let lastHud = null;

export function updateHud() {
  if (!state || !el.coinsValue) return;
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

  el.coinsValue.textContent = Math.floor(state.coins).toLocaleString();
  el.diamondsValue.textContent = Math.floor(state.diamonds).toLocaleString();
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
  coop: 'Co-op & Regatta', settings: 'Settings',
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

function renderInventoryGrid(container, items, emptyLabel) {
  const grid = document.createElement('div');
  grid.className = 'build-grid';
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

function renderOrders(container) {
  const board = state.orders.board || [];
  if (!board.length) { renderComingSoon(container, 'The order board'); return; }
  for (const order of board) {
    const canFulfill = typeof orders.canFulfill === 'function' ? orders.canFulfill(order) : false;
    const card = document.createElement('div');
    card.className = 'order-card';
    const reqs = (order.items || []).map((it) => `${itemIcon(it.item)} x${it.qty}`).join(', ');
    card.innerHTML = `<strong>${order.customer || 'Order'}</strong><div>${reqs}</div><div>Reward: 🪙${order.reward?.coins ?? 0}</div>`;
    card.appendChild(button('Fulfill', () => {
      const ok = typeof orders.fulfillOrder === 'function' && orders.fulfillOrder(order.id);
      if (ok) {
        audio.orderComplete();
        toast('Order fulfilled!', 'success');
        tutorial.emit('order_fulfilled');
        refreshPanel();
      } else { audio.error(); toast("You don't have everything for this order yet.", 'error'); }
    }, { disabled: !canFulfill }));
    container.appendChild(card);
  }
}

function renderShop(container) {
  const listings = state.shop.listings || [];
  if (!listings.length) { renderComingSoon(container, 'The roadside shop'); return; }
  for (const [i, listing] of listings.entries()) {
    const card = document.createElement('div');
    card.className = 'shop-slot';
    card.innerHTML = `<span class="icon">${itemIcon(listing.item)}</span><strong>${itemName(listing.item)}</strong><span>x${listing.qty} — 🪙${listing.price}</span>`;
    card.appendChild(button('Collect', () => {
      const ok = typeof shop.collect === 'function' && shop.collect(i);
      if (ok) { audio.coin(); toast('Collected!', 'success'); refreshPanel(); }
    }));
    container.appendChild(card);
  }
}

/** Which bucket a recipe input lives in — crops sit in the silo, everything else (goods AND
 *  raw MATERIALS) sits in the barn. Mirrors production.js's own stockOf(), which isn't
 *  exported; kept identical on purpose so the UI never disagrees with what enqueue() checks. */
function stockOf(id) {
  return CROPS[id] ? state.silo.items : state.barn.items;
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

function hintEl(text) {
  const s = document.createElement('span');
  s.className = 'minigame-hint';
  s.textContent = text;
  return s;
}

/**
 * Shared "what's cooking" view for one production object's own state.production entries
 * (an ordinary building's queue, or the Workshop's — both are just filtered rows of the same
 * queue; see production.js). `recipeOf(id)` resolves a recipeId to its {time,...} definition
 * for the progress bar; `collectFn(entry, index)` performs the actual collection and should
 * return a truthy result on success. Renders nothing when the queue is empty.
 */
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
      <div class="event-progress"><div class="event-progress-fill" style="width:${Math.round(frac * 100)}%"></div></div>
      <span>${ready ? 'Ready to collect!' : 'Crafting…'}</span>`;
    if (ready) {
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
  const grid = document.createElement('div');
  grid.className = 'build-grid';
  for (const recipe of recipes) {
    const locked = economy.isUnlocked ? !economy.isUnlocked(recipe.id) : false;
    const short = missingInputs(recipe);
    const card = document.createElement('div');
    card.className = `build-card${locked ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">${itemIcon(recipe.id)}</span><strong>${itemName(recipe.id)}</strong>
      <span class="minigame-hint">${inputsLine(recipe)}</span>`;
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

/** Does a candidate w×h footprint at (x,y) overlap any of the always-present STRUCTURES? */
function overlapsAnyStructure(x, y, w, h) {
  for (const def of Object.values(STRUCTURES)) {
    const [sw, sh] = def.size;
    const overlaps = x < def.pos.x + sw && x + w > def.pos.x && y < def.pos.y + sh && y + h > def.pos.y;
    if (overlaps) return true;
  }
  return false;
}

/**
 * Scan the start zone for the first free w×h tile — free of other placed objects (via
 * farm.canPlace) AND of the always-present STRUCTURES footprints, which farm.js has no
 * reason to know about (they're world-layer chrome, not state.farm.objects).
 */
function findFreeTile(w, h) {
  for (let y = FARM.startZone.y; y < FARM.startZone.y + FARM.startZone.h - h + 1; y++) {
    for (let x = FARM.startZone.x; x < FARM.startZone.x + FARM.startZone.w - w + 1; x++) {
      if (farm.canPlace(x, y, w, h) && !overlapsAnyStructure(x, y, w, h)) return [x, y];
    }
  }
  return null;
}

/** Place a freshly crafted/coin-bought building or pen at the first free start-zone tile. */
function buildAt(kind, id, def, onPlaced) {
  const [w, h] = def.size || [2, 2];
  const spot = findFreeTile(w, h);
  if (!spot) { audio.error(); toast('No free space for that right now.', 'error'); return; }
  const obj = farm.place(kind, id, spot[0], spot[1]);
  if (!obj) { audio.error(); toast("Can't build that right now.", 'error'); return; }
  onPlaced && onPlaced();
  audio.place();
  toast(`Built ${def.name}!`, 'success');
  tutorial.emit(`placed:${id}`);
  save();
  refreshPanel();
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
    const grid = document.createElement('div');
    grid.className = 'build-grid';
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
  const craftGrid = document.createElement('div');
  craftGrid.className = 'build-grid';
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
  const buildGrid = document.createElement('div');
  buildGrid.className = 'build-grid';
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
  const penGrid = document.createElement('div');
  penGrid.className = 'build-grid';
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
  const p = document.createElement('p');
  p.className = 'minigame-hint';
  p.textContent = `${unlocked.length} achievement${unlocked.length === 1 ? '' : 's'} unlocked so far.`;
  container.appendChild(p);
}

function renderDecorate(container) {
  const active = !!state.decorate?.active;
  const btn = button(active ? 'Exit Decorate Mode' : 'Enter Decorate Mode', () => {
    state.decorate.active = !state.decorate.active;
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
    case 'shop': renderShop(container); break;
    case 'building': renderBuildingQueue(container, ctx); break;
    case 'workshop': renderWorkshop(container); break;
    case 'settings': renderSettings(container); break;
    case 'achievements': renderAchievements(container); break;
    case 'decorate': renderDecorate(container); break;
    default: {
      const struct = STRUCTURES[ctx];
      renderComingSoon(container, struct?.name || PANEL_TITLES[panelId] || panelId);
    }
  }
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
