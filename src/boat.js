// boat.js — boat orders (L17): a boat docks every ORDERS.boat.interval with 6 bulk crates;
// filling all crates before departureWindow expires pays bonusMultiplier + vouchers
// (spent on exclusive decorations in DECORATIONS with voucherCost).

/** Spawn/advance the boat lifecycle (docked → departed); called from the game loop. */
export function tick(now) { /* Phase B */ }

/** Fill one crate from storage. */
export function fillCrate(index) { /* Phase B */ }

/** Claim the full-boat bonus (coins + XP + vouchers) once every crate is filled. */
export function claimBonus() { /* Phase B */ }

// ---- Island expeditions (Township layer, L36; ISLANDS in data.js) ----
// While not serving crate orders, the boat can sail to a destination island and return
// after tripTime with exotic cargo (banana/pineapple/cocoa/vanilla) for the Tropical Café.
// The boat is one vessel: an expedition and a crate-order docking never overlap.

/** Destinations unlocked at the current level (for the boat panel's expedition tab). */
export function availableDestinations() { /* Phase B */ }

/** Send the boat to ISLANDS.destinations[id]; fails if a crate order is docked/expedition active. */
export function sendExpedition(id) { /* Phase B */ }

/** The active expedition {destination, returnsAt}, or null. */
export function currentExpedition(now) { /* Phase B */ }

/** Collect a returned expedition's exotic cargo into the barn. */
export function collectExpedition() { /* Phase B */ }
