// boat.js — boat orders (L17): a boat docks every ORDERS.boat.interval with 6 bulk crates;
// filling all crates before departureWindow expires pays bonusMultiplier + vouchers
// (spent on exclusive decorations in DECORATIONS with voucherCost).

/** Spawn/advance the boat lifecycle (docked → departed); called from the game loop. */
export function tick(now) { /* Phase B */ }

/** Fill one crate from storage. */
export function fillCrate(index) { /* Phase B */ }

/** Claim the full-boat bonus (coins + XP + vouchers) once every crate is filled. */
export function claimBonus() { /* Phase B */ }

// ---- Island voyages moved out ----
// Voyages now live in islands.js. They were parked here while the boat was the only vessel,
// but with expeditions.js in the codebase 'the boat module also does expeditions' is a
// confusion waiting to happen, and the two share nothing but water. boat.js keeps crates and
// vouchers; islands.js owns sailing.
