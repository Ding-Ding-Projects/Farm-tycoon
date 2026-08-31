// economy.js — coins, XP, leveling, unlock checks, and pricing helpers.

/** Add coins (positive or negative). Throws if the balance would go negative. Fires coin-pop effect. */
export function addCoins(amount) { /* Phase B */ }

/** Add XP, handling level-ups (may cascade multiple levels). Shows level-up popup + rewards diamonds. */
export function addXp(amount) { /* Phase B */ }

/** Spend diamonds (skip timers, exclusive decorations). Returns false if insufficient. */
export function spendDiamonds(amount) { /* Phase B */ }

/** Diamond cost to skip `remainingSeconds` of a timer (Hay Day-style: ~1 diamond per 10 min, min 1). */
export function skipCost(remainingSeconds) { /* Phase B */ }

/** Is a content id (crop/building/animal/feature) unlocked at the current level? */
export function isUnlocked(id) { /* Phase B */ }

/** List of ids newly unlocked when reaching `level` (for the level-up popup). */
export function unlocksAt(level) { /* Phase B */ }

/** Base sell value of any item id (crop, good, fish, ore), with active event multipliers applied. */
export function sellValue(itemId) { /* Phase B */ }

/** Record a lifetime stat increment and check achievements (delegates to extras.js). */
export function trackStat(stat, amount = 1) { /* Phase B */ }
