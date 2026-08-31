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

export function isPanelOpen() { return !!openPanelId && !el.sheet.hidden; }
export function currentPanel() { return openPanelId; }

export function openPanel(panelId, ctx = null) {
  if (!el.sheet) return;
  openPanelId = panelId;
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
  audio.close();
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
          renderPanelContent(openPanelId);
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
        renderPanelContent('orders');
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
      if (ok) { audio.coin(); toast('Collected!', 'success'); renderPanelContent('shop'); }
    }));
    container.appendChild(card);
  }
}

function renderBuildingQueue(container, buildingId) {
  const obj = state.farm.objects.find((o) => o.id === buildingId);
  const def = obj && BUILDINGS[obj.type];
  if (!obj || !def) { renderComingSoon(container, 'This building'); return; }
  const grid = document.createElement('div');
  grid.className = 'build-grid';
  const recipes = def.recipes || {};
  for (const [recipeId, recipe] of Object.entries(recipes)) {
    const locked = economy.isUnlocked ? !economy.isUnlocked(recipeId) : false;
    const card = document.createElement('div');
    card.className = `build-card${locked ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">${itemIcon(recipe.output || recipeId)}</span><strong>${itemName(recipe.output || recipeId)}</strong>`;
    card.appendChild(button('Queue', () => {
      const ok = typeof production.enqueue === 'function' && production.enqueue(buildingId, recipeId);
      if (ok) {
        audio.place();
        toast('Queued!', 'success');
        tutorial.emit(`enqueued:${recipe.output || recipeId}`);
      } else { audio.error(); toast("Can't queue that right now.", 'error'); }
    }, { disabled: locked }));
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

function renderWorkshop(container) {
  const built = new Set(state.farm.objects.map((o) => o.type));
  const grid = document.createElement('div');
  grid.className = 'build-grid';

  const addEntry = (kind, id, def, cost, sizeGetter) => {
    if (built.has(id)) return;
    const locked = !economy.isUnlocked(id);
    const card = document.createElement('div');
    card.className = `build-card${locked ? ' locked' : ''}`;
    card.innerHTML = `<span class="icon">${def.icon || '🏗️'}</span><strong>${def.name}</strong><span>🪙${cost}</span>`;
    card.appendChild(button('Build', () => {
      const [w, h] = sizeGetter();
      const spot = findFreeTile(w, h);
      if (!spot) { audio.error(); toast('No free space for that right now.', 'error'); return; }
      const obj = farm.place(kind, id, spot[0], spot[1]);
      if (obj) {
        audio.place();
        toast(`Built ${def.name}!`, 'success');
        tutorial.emit(`placed:${id}`);
        save();
        renderPanelContent('workshop');
      } else { audio.error(); toast("Can't build that right now.", 'error'); }
    }, { disabled: locked }));
    grid.appendChild(card);
  };

  for (const [id, def] of Object.entries(BUILDINGS)) addEntry('building', id, def, def.cost ?? 0, () => def.size || [2, 2]);
  for (const [id, def] of Object.entries(ANIMALS)) addEntry('pen', id, def, def.penCost ?? 0, () => def.size || [2, 2]);

  if (!grid.children.length) {
    const p = document.createElement('p');
    p.className = 'minigame-hint';
    p.textContent = "You've built everything available so far!";
    container.appendChild(p);
    return;
  }
  container.appendChild(grid);
}

function renderSettings(container) {
  const soundRow = row('');
  const soundBtn = button(state.settings.sound ? '🔊 Sound: On' : '🔇 Sound: Off', () => {
    state.settings.sound = !state.settings.sound;
    save();
    renderPanelContent('settings');
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
