// collections.js — collection books and building mastery (COLLECTIONS, MASTERY, L10).
//
// Book entries are DERIVED from the live data tables, never hand-listed, so a new fish or recipe
// joins its book automatically and no book can drift out of date. The validator checks each
// source derives a non-empty list, because a book that silently derives nothing renders as an
// empty page with no error anywhere.
//
// Mastery effects flow through EFFECT_KEYS and are merged by lab.researchedEffect(), so mastery,
// research and minigames meet at one point rather than three.
// State: state.collections { seen: { bookId: [entryId] }, claimed: { bookId: n },
//                            mastery: { buildingId: { makes, star } } }

/** Every entry a book can hold, derived from its source table. */
export function bookEntries(bookId) { /* Phase B */ }

/** Which of them the player has found. */
export function found(bookId) { /* Phase B */ }

/** Record a discovery. Idempotent - finding a second trout changes nothing. */
export function record(bookId, entryId) { /* Phase B */ }

/** Unclaimed milestone rewards for a book. */
export function claimable(bookId) { /* Phase B */ }

/** Claim them. */
export function claim(bookId) { /* Phase B */ }

/** Count one completed production toward a building's mastery. */
export function recordMake(buildingId) { /* Phase B */ }

/** A building's current star tier and progress to the next. */
export function masteryOf(buildingId) { /* Phase B */ }

/** Merged mastery effect across every building, for the shared multiplier merge point. */
export function masteryEffect() { /* Phase B */ }
