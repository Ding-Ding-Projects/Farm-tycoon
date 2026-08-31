// trains.js — cargo transports of the Township layer: trains (L21) and the airport (L28).
// Trains: arrive every TRAINS.interval with wagons requesting goods; a filled train
// departs, and after TRAINS.tripTime returns with construction MATERIALS (weighted
// random). An unfilled train leaves after departureWindow with partial reward.
// Airport: a plane with AIRPORT.crates of high-tier goods; full plane pays the coin
// bonus + materials + XP. All timers wall-clock (readyAt), offline-resolved by tick().
// State: state.trains { current: {wagons, filledAt...}, returningAt }, state.airport {...}.

/** Advance train + plane lifecycles (arrive/depart/return); called from the game loop. */
export function tick(now) { /* Phase B */ }

/** The train currently at the station (wagons + fill state + departure countdown), or null. */
export function currentTrain() { /* Phase B */ }

/** Fill one wagon from storage. */
export function fillWagon(index) { /* Phase B */ }

/** Dispatch a fully loaded train early (starts the material trip immediately). */
export function dispatchTrain() { /* Phase B */ }

/** The plane currently at the airport, or null. */
export function currentPlane() { /* Phase B */ }

/** Fill one plane crate from storage. */
export function fillCrate(index) { /* Phase B */ }

/** Claim a returned train's materials into the barn. */
export function collectDelivery() { /* Phase B */ }
