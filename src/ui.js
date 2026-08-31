// ui.js — all DOM UI: HUD, dock, sliding sheet panels, radial menu, toasts, popups.
// The DOM structure lives in index.html; this module fills and wires it.
// Class names are the contract with DESIGN_BRIEF.md / styles.css:
//   .hud-top .level-badge .pill-counter .dock .dock-btn .sheet-panel .order-card
//   .shop-slot .build-card .radial-menu .toast .progress-ring
// Panels: orders, shop, build, inventory (barn/silo), fishing, mine, boat,
// achievements, daily wheel, settings, level-up popup, tutorial overlay.

/** Wire up static DOM, dock buttons, and panel machinery. */
export function init() { /* Phase B */ }

/** Refresh HUD counters (coins, diamonds, level ring, storage pills) — cheap, every frame. */
export function updateHud() { /* Phase B */ }

/** Open/close a named sheet panel ('orders'|'shop'|'build'|...) with the slide-up animation. */
export function openPanel(name) { /* Phase B */ }
export function closePanel() { /* Phase B */ }

/** Show the radial action menu around a world object (plant/harvest/collect/info/move). */
export function showRadial(objectId, actions) { /* Phase B */ }
export function hideRadial() { /* Phase B */ }

/** Transient toast message (top of screen). */
export function toast(text, icon) { /* Phase B */ }

/** Level-up celebration popup listing economy.unlocksAt(level). */
export function levelUpPopup(level) { /* Phase B */ }
