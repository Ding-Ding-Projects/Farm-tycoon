# Farm Tycoon — UI Design Brief (Claude Design handoff)

This document is the handoff for designing Farm Tycoon's UI. The scaffold in this repo
already defines the DOM structure (`index.html`), design tokens and component classes
(`styles.css`) — a design that redefines those tokens and classes drops straight into the game.

## Art direction

**Modern casual game** — the polish level of current Hay Day / Township. Vibrant flat
vector shapes with soft gradients, gentle drop shadows, frosted-glass UI surfaces, springy
micro-interactions. Explicitly **not retro, not pixel art, not skeuomorphic wood textures**.

- Palette mood: lush greens, warm golds, sky blue, cream surfaces. World palette reference
  in `src/render/sprites.js` (`PALETTE`).
- Typography: **Nunito** (rounded sans), weights 400/700/800. Big friendly numerals.
- Motion: everything eases with a slight overshoot (`cubic-bezier(0.34, 1.56, 0.64, 1)`);
  panels slide up, buttons scale on hover/press.

## Reference dimensions

Base window **1280×800**; must stay usable at **1024×640** and scale cleanly to 4K.
The farm world behind the UI is a full-window canvas — design it as a soft illustration
placeholder (rolling green farm, isometric mood), the game renders the real thing.

## Design tokens (produce these — CSS custom properties, consumed verbatim)

Defined in `styles.css :root`; restyle by changing values, keep the names:

`--color-primary`, `--color-primary-deep`, `--color-gold`, `--color-diamond`,
`--color-danger`, `--color-ink`, `--color-ink-soft`, `--panel-bg` (frosted/translucent),
`--panel-blur`, `--pill-bg`, `--radius-panel` (16px), `--radius-pill`, `--shadow-soft`,
`--shadow-pop`, `--font-display`, spacing scale `--sp-1…--sp-6`.

## Component inventory (exact class names used by the code)

| Class | What it is |
|---|---|
| `.hud-top` | top bar container (level badge left, counters right) |
| `.level-badge` | circular level number with arcing XP `.progress-ring` |
| `.pill-counter` | pill-shaped coin/diamond/silo/barn counters; `.warn` pulses when storage nearly full |
| `.dock` / `.dock-btn` | floating bottom toolbar of big icon buttons; `.badge` notification dot |
| `.sheet-panel` | frosted sheet sliding up from the bottom; `.sheet-handle`, `.sheet-title`, `.sheet-content` |
| `.order-card` | one order on the board: requested goods icons, coin+XP reward, fulfill button |
| `.shop-slot` | one roadside-shop sale slot (grid of 8, `.slot-grid`) |
| `.build-card` | build-menu carousel card (`.card-row`): item art, price, level lock (`.locked`) |
| `.radial-menu` | round action buttons popping out around a selected world object |
| `.toast` / `.toast-stack` | transient top-center messages |
| `.modal-backdrop` / `.modal-card` | centered popups (level-up, daily wheel, confirmations) |
| `.btn` (+ `.gold`, `.danger`) | primary pill buttons |
| `.tutorial-overlay` | arrow + highlight layer for the guided intro |

## Screens to design (artboards)

1. **Main HUD** over the farm illustration — level badge, counter pills, dock
2. **Order board** panel — 6 order cards, refresh/discard affordances
3. **Roadside shop** panel — 8 sale slots, price slider on a listing
4. **Build menu** — horizontally scrolling card carousel with level locks
5. **Barn & Silo inventory** — item grid with counts, capacity bar, upgrade button
6. **Fishing view** — pond mood, cast button, timing-bar minigame state
7. **Mine view** — dig buttons (pickaxe/dynamite counts), yield reveal
8. **Boat panel** — 6 crates with fill states, departure countdown, voucher reward
9. **Daily wheel popup** — 8-segment wheel, spin button, streak indicator
10. **Level-up popup** — celebratory, lists new unlocks with icons
11. **Achievements panel** — badge grid, progress bars, diamond rewards
12. **Settings** — sound toggle, save export/import, reset
13. **Tutorial overlay state** — highlight cutout + arrow + instruction bubble

## Game content the UI shows (for realistic mockups)

Real item names live in `src/data.js`: 14 crops (Wheat → Grapes), 7 animals
(Chicken Coop → Duck Pond), 13 production buildings (Bakery, Dairy, Feed Mill, Sugar Mill,
Popcorn Pot, Grill, Pie Oven, Loom, Sewing Machine, Juice Press, Jam Maker, Coffee Kiosk,
Candy Machine, Smelter), ~45 goods, 8 fish, ores/bars, 15 decorations. Currencies: coins 🪙,
diamonds 💎, boat vouchers 🎟️. Use these names/quantities in mockups so panels feel real.
