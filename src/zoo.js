// zoo.js — the Zoo (Township layer, L34): buy enclosures (coins + MATERIALS), feed each
// species farm goods on a timer to produce zoo souvenir goods (ZOO.enclosures), earn
// passive visitor income scaled by town population (ZOO.visitorIncomePerHour), and fill
// zoo orders mixing zoo + farm goods. State: state.zoo { enclosures, lastIncomeAt, orders }.

/** Buy an enclosure (level-gated, consumes coins + materials). */
export function buyEnclosure(id) { /* Phase B */ }

/** Feed an enclosure (consumes its feed goods; starts the souvenir timer). */
export function feed(id) { /* Phase B */ }

/** Collect a ready souvenir into the barn. */
export function collect(id) { /* Phase B */ }

/** Accrued visitor income since last collection (capped at 12h). */
export function pendingIncome(now) { /* Phase B */ }

/** Collect visitor income. */
export function collectIncome() { /* Phase B */ }

/** Advance timers + regenerate zoo orders; called from the game loop. */
export function tick(now) { /* Phase B */ }

/** Fulfill a zoo order (consumes items, pays coins/XP, may include materials). */
export function fulfillOrder(orderId) { /* Phase B */ }
