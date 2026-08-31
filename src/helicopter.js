// helicopter.js — the helicopter pad (L22). A third transport beside the truck and the boat,
// and the fastest MATERIALS channel, which is what makes the crafting spine tractable at all.
//
// Fuel regenerates on absolute timestamps like every other timer, so it accrues while the game
// is closed and is capped rather than unbounded.
// State: state.helicopter { current: { crates, arrivedAt, departsAt } | null, fuel,
//                           fuelUpdatedAt, returningAt }

/** The flight currently on the pad, or null between flights. */
export function currentFlight() { /* Phase B */ }

/** Fuel now, resolving regeneration from fuelUpdatedAt and capping at HELICOPTER.fuel.max. */
export function currentFuel(now) { /* Phase B */ }

/** Fill one crate from the barn. */
export function fillCrate(index) { /* Phase B */ }

/** Dispatch the flight; spends fuel, pays XP, materials and the full-load bonus. */
export function dispatch() { /* Phase B */ }

/** Collect the return delivery. */
export function collectDelivery() { /* Phase B */ }

/** Advance flight and fuel timers; called from the game loop. */
export function tick(now) { /* Phase B */ }
