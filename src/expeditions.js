// expeditions.js — expeditions (L57). Hire specialists, send a crew to a site, wait out a real
// trip, collect loot.
//
// Supplies are consumed UP FRONT, so a failed run genuinely costs something - otherwise
// riskFailChance is decoration and there is no decision in choosing a site.
//
// Artifacts in the loot go to museum.js, never to the barn: a full barn must not be able to
// soft-lock collection, and the order and truck generators must never be able to ask the player
// to hand over a museum piece.
// State: state.expeditions { crew: [{ specialistId, hiredAt }], active: [{ siteId, readyAt, crewIdx }],
//                            lastResults: [] }

/** Sites unlocked at the player's level. */
export function sites() { /* Phase B */ }

/** Hire a specialist into a crew slot. */
export function hireSpecialist(id) { /* Phase B */ }

/** Whether supplies and a free crew slot are both available for this site. */
export function canLaunch(siteId) { /* Phase B */ }

/** Launch; consumes supplies. Refunds in full if the launch itself fails. */
export function launch(siteId, crewIdx) { /* Phase B */ }

/** Collect a returned expedition. Routes artifacts to museum.js and goods to the barn. */
export function collect(crewIdx) { /* Phase B */ }

/** Results not yet acknowledged by the UI. */
export function pendingResults() { /* Phase B */ }

/** Advance trip timers; called from the game loop. */
export function tick(now) { /* Phase B */ }
