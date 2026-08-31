// workshop.js — the Building Workshop (L6): the spine of progression. Coins alone never place
// a production building. Raw MATERIALS become components here, components become a building
// kit, and the kit is consumed to place its factory (BUILDINGS[x].kit).
//
// This is why trains, the airport and the helicopter exist: they are the material channels, and
// without a sink for what they deliver they would be flavour. It also means the late game is a
// logistics problem rather than a coin balance.
//
// Uses the ordinary production queue - a workshop is a BUILDINGS entry with recipes, so there is
// no second production system here, only the placement rules on top.
// State: state.workshop { queue: [{ recipeId, readyAt }], kits: { kitId: qty } }

/** Component and kit recipes currently craftable (level, materials and unlocks permitting). */
export function available() { /* Phase B */ }

/** Whether the player holds every input for this recipe right now. */
export function canCraft(recipeId) { /* Phase B */ }

/** Start crafting; consumes inputs up front. Refunds in full if the queue push fails. */
export function craft(recipeId) { /* Phase B */ }

/** Advance the queue; called from the game loop. */
export function tick(now) { /* Phase B */ }

/** Collect a finished component or kit into the barn. */
export function collect(index) { /* Phase B */ }

/** Whether a kit for this building is held and the building may therefore be placed. */
export function hasKitFor(buildingId) { /* Phase B */ }

/** Consume the kit as part of placing the building. Never consumes on a failed placement. */
export function consumeKit(buildingId) { /* Phase B */ }
