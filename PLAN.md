# Farm Tycoon — Hay Day-style Windows Game

## Context

The `Farm-tycoon` repo is empty (README only). The user wants a vibe-coded Windows video game with gameplay closely modeled on Hay Day: a cozy farm-management sim built around a plant → harvest → produce → sell economy loop. Decisions made with the user:

- **Stack:** HTML5/JS Canvas game, packaged for Windows via **Electron** (also runs in any browser for dev/testing).
- **Scope:** Core loop **plus extras** — crops, animals, production buildings, coins/XP/levels, roadside shop, order board, **truck orders, land expansion, decorations, and a fishing pond mini-area**.
- **Art:** **Pure drawn vector art** — everything rendered in code with canvas paths/gradients, no image assets.

## Delivery phases

**Phase A — NOW (this session): scaffolding only, pushed to `main`** (user explicitly requested pushing scaffolding to main). No gameplay implementation yet:

1. Full repo skeleton: `index.html`, `styles.css`, all `src/` module files created with their public API contracts (exported function signatures + JSDoc describing what each will do), `electron/` wrapper, `package.json`.
2. `data.js` fully populated with the real content tables (crops, animals, recipes, levels) — data is design, not implementation, and gives Claude Design real item names to work with.
3. All docs: `PLAN.md` (this document), `CLAUDE.md`, `README.md`, `.claude/skills/` (run-game, add-content, playtest).
4. **`DESIGN_BRIEF.md`** — the Claude Design handoff document (see section below): screens to mock, layout specs, palette, typography, component inventory, and naming conventions so the design maps 1:1 onto the planned DOM/canvas structure.
5. Commit and push directly to `main`.

**Phase B — LATER (when the user says "start developing"):** the full one-shot implementation of every feature in this plan, on branch `claude/windows-hay-day-game-cfctdb`, with a draft PR. The user will have used Claude Design to build the UI foundation first; incorporate whatever design artifacts/CSS/tokens landed in the repo by then.

## Claude Design handoff (`DESIGN_BRIEF.md` contents)

So the user can hand UI design to Claude Design with zero friction, the brief will include:

- **Screens to design (artboards):** 1) main game HUD over a farm illustration placeholder, 2) orders board panel, 3) roadside shop panel, 4) build menu carousel, 5) barn/silo inventory, 6) fishing view, 7) mine view, 8) daily-wheel popup, 9) level-up popup, 10) settings, 11) tutorial overlay state.
- **Canvas vs DOM split:** the farm world is canvas (design only needs to suggest its mood); every panel/HUD element is real DOM — those are the design targets.
- **Design tokens to produce:** CSS custom properties the code will consume verbatim — `--color-primary/gold/danger`, `--panel-bg` (parchment), `--wood-bg`, `--bevel-top/bottom`, `--radius-panel: 16px`, `--radius-pill`, `--shadow-soft`, `--font-display`, spacing scale. Naming these in the brief means the designed CSS drops straight into `styles.css`.
- **Component inventory with exact class names** matching what the scaffold's `index.html`/`ui.js` will use: `.hud-top`, `.level-badge`, `.pill-counter`, `.dock`, `.dock-btn`, `.sheet-panel`, `.order-card`, `.shop-slot`, `.build-card`, `.radial-menu`, `.toast`, `.progress-ring`.
- **Art direction:** modern casual (current Hay Day-level polish), Hay Day's own language — wood-plank boards, cream parchment cards, dark leather pills, chunky glossy bevel buttons, white outlined numerals — at modern polish; explicitly "not retro, not pixel, not frosted glass".
- **Reference dimensions:** 1280×800 base window, must stay usable down to 1024×640 and scale up to 4K.

Phase B branch: `claude/windows-hay-day-game-cfctdb` (draft PR). Phase A goes to `main` directly, per user instruction.

## Architecture

Vanilla JS (no framework, no bundler) — ES modules loaded by a single `index.html`. Electron wraps the same files; a plain static server (or `file://` via Electron) runs it.

```
Farm-tycoon/
├── index.html              # canvas + HUD DOM overlay
├── styles.css              # HUD, panels, buttons
├── src/
│   ├── main.js             # boot, game loop (requestAnimationFrame), autosave timer
│   ├── state.js            # game state object, new-game defaults, save/load (localStorage)
│   ├── data.js             # all content definitions (crops, animals, buildings, recipes, levels)
│   ├── economy.js          # coins/XP/leveling, unlocks, pricing
│   ├── farm.js             # grid model: tiles, plots, placement, expansion
│   ├── production.js       # timers: crop growth, animal feeding, building queues
│   ├── orders.js           # order board + truck order generation/fulfillment
│   ├── shop.js             # roadside shop stand (sell inventory at chosen prices)
│   ├── fishing.js          # pond mini-area: cast minigame, fish inventory, chests
│   ├── boat.js             # boat orders (bulk crates, departure timer, vouchers)
│   ├── mine.js             # mine digging (tools, ores) + smelter integration
│   ├── merge.js            # Merge Meadow: Township-style merge board minigame
│   ├── town.js             # Town: houses, population, community buildings, milestones
│   ├── trains.js           # cargo trains + airport (materials economy)
│   ├── zoo.js              # zoo enclosures, souvenirs, visitor income, zoo orders
│   ├── extras.js           # achievements, daily wheel, NPC visitors, diamonds
│   ├── render/
│   │   ├── renderer.js     # camera (pan/zoom), tile grid, draw order, day tint
│   │   ├── sprites.js      # vector-art draw functions: drawWheat(ctx,stage), drawCow(ctx)...
│   │   └── effects.js      # coin pops, sparkles, floating +XP text
│   ├── ui.js               # HUD, panels (barn/silo inventory, shop, orders), toasts
│   └── input.js            # mouse/touch: select, drag-plant, pan, zoom wheel
│   ├── audio.js            # WebAudio synthesized SFX + ambient, mute toggle
│   └── tutorial.js         # guided intro overlay (arrows, highlights, step machine)
├── electron/
│   ├── main.cjs            # Electron main process (BrowserWindow, loads index.html)
│   └── preload.cjs         # minimal, contextIsolation on
├── package.json            # electron + electron-builder; scripts: start, dist (Windows Squirrel.Windows — corrected from an earlier NSIS plan; see HANDOFF.md)
├── PLAN.md                 # this full design document, committed to the repo
├── DESIGN_BRIEF.md         # Claude Design handoff: screens, tokens, class names
├── CLAUDE.md               # project guide for future Claude sessions
├── .claude/skills/         # project skills for agents (see below)
└── README.md               # how to play, run, and build the .exe
```

## Repo docs & agent tooling (committed with the game)

- **`PLAN.md`** — this entire design document recorded in the repo root, so the full game design (content tables, systems, balance philosophy) lives with the code.
- **`CLAUDE.md`** — a good project guide for future Claude/agent sessions: what the game is, architecture map (which module owns what), how to run it (static server / Electron), how to add content (new crop/recipe = one entry in `data.js` + one draw function in `sprites.js`), save-format versioning rules, code conventions (vanilla ES modules, no deps, DOM for menus / canvas for world), and how to verify changes with the Playwright smoke test.
- **`.claude/skills/`** — project skills so agents work on this repo effectively:
  - **`run-game/SKILL.md`** — how to launch the game (static server + Playwright/Chromium at `/opt/pw-browsers/chromium`), take screenshots, and check the console for errors.
  - **`add-content/SKILL.md`** — step-by-step recipe for adding a crop, animal, recipe, building, or decoration (which tables in `data.js`, unlock level placement, sprite function contract in `sprites.js`, balance formulas for price/time/XP).
  - **`playtest/SKILL.md`** — scripted smoke playtest: boot, run the tutorial path, fast-forward timers via a debug hook (`window.__farmDebug.timeSkip(ms)`), verify economy invariants (coins never negative, storage caps respected, save→reload→state identical).

## One-shot delivery requirement

Applies to **Phase B**: the game is implemented **fully, start to finish, in a single pass** — every feature listed in this plan ships in that implementation; nothing is stubbed, deferred, or marked TODO. The implementation-order list below is the internal build sequence within that one pass, ending with the tested, committed, pushed result and a draft PR. (Phase A's scaffolding stubs are the sanctioned exception — they exist precisely to be filled in by Phase B.)

> **Status: Phase B shipped.** Every module contract is implemented — `grep -r "/\* Phase B \*/" src/` returns nothing across the 37-file `src/` tree, and `npm test` passes 147 assertions across nine files. It did not land through the branch-plus-draft-PR route described above: every Phase B commit went directly to `main`, the same as the scaffold. See `HANDOFF.md` for the full verification record and `CLAUDE.md` for the current handoff state.

## Gameplay design (Hay Day parity)

**Core loop:** plant crops on field plots → harvest → feed animals / run production buildings → sell goods via roadside shop, order board, or truck → earn coins + XP → level up → unlock more content → expand land.

### Content (`data.js`) — big content set

> **Superseded by the wiki expansion.** The section below describes the original scaffold
> targets and is kept for the design reasoning, but the shipped numbers are now larger and
> `src/data.js` is the authority. Current: **22 crops, 12 animals, 26 buildings / 128 recipes,
> 192 goods, 23 materials in four purpose-scoped sets, 16 town houses + 10 community buildings,
> 14 zoo enclosures, 8 islands, 39 achievements, 95 levels.**
>
> Three things were added that this section predates, and they are the parts that make the game
> not a clone of its sources:
>
> - **Buildings are crafted, not bought.** The Building Workshop turns materials into
>   components, components into a building kit, and the kit places the factory. Both source
>   games sell factories for coins, which leaves their material economies shallow; this makes
>   materials the spine of progression and gives trains, the airport and the helicopter a
>   reason to exist.
> - **Every production building has its own minigame**, with an effect only that factory would
>   have. This is the per-BUILDING bonus layer (`MINIGAMES`), and it remains optional.
> - **Some ITEMS are playable, and for those the game is required.** A recipe carrying a `play`
>   chain (`VERBS`, one game per stage) can only be collected by playing it through. This
>   REVERSES the original "never a gate" rule above, deliberately and at the owner's explicit
>   direction, after the trade-off was put to them. What protects the idle contract instead:
>   a run never expires, a game can be scored badly but never failed, an unplayed craft never
>   blocks a collectable one behind it, four whole recipe classes may never be playable (kits,
>   workshop components, animal feed, and any building's introductory recipe), and Assist mode
>   plus an opt-in auto-finish exist so the gate can never become a wall.
>   Offline time still completes the PREP timer; it cannot complete the game.
> - **Systems open by clicking their structure in the world**, never from the HUD or dock, and
>   locked structures are derelict but still clickable from level 1 so the map doubles as the
>   roadmap.
>
> Also added: mine depths, artifacts and a museum, expeditions, a permanent research
> laboratory, a helicopter, a co-op with a request board, a weekly regatta against simulated
> neighbours, and four dead-time systems (foraging, the newspaper, collection books, mastery).
>
> One balance note worth not re-deriving: crop XP looks inverted (wheat out-earns late crops
> per hour) but only for a player tapping every two minutes. At any real check-in cadence the
> late crops win by 4-14x. See the note above `CROPS` in `data.js`.

- **Crops — 14** (grow on field plots; harvesting returns 2x seeds like Hay Day), unlock by level with staggered timers: wheat 2 min, corn 5 min, carrot 10 min, soybean 20 min, sugarcane 30 min, cotton 45 min, tomato 1 h, potato 1.5 h, strawberry 2 h, pumpkin 3 h, indigo 4 h, chili pepper 6 h, coffee bean 8 h, grapes 12 h.
- **Animals — 7 pen types** (feed → wait → collect): chickens→eggs, cows→milk, pigs→bacon, sheep→wool, goats→goat milk, bees (beehive)→honey, ducks→feathers. Each pen holds 3–5 animals; feed is made in the **Feed Mill** from crops (chicken feed = 2 wheat + 1 corn, cow feed = 2 corn + 1 soybean, etc.), exactly like Hay Day.
- **Production buildings — 12, ~45 recipes total** (queue up to 3, more slots via upgrades):
  - **Feed Mill** — 5 feed types from crops
  - **Bakery** — bread, corn bread, cookies, raspberry muffin (strawberry sub)
  - **Dairy** — cream, butter, cheese, goat cheese
  - **Sugar Mill** — sugar, brown sugar, syrup
  - **Popcorn Pot** — popcorn, buttered popcorn, chili popcorn
  - **Grill (BBQ)** — pancakes, bacon & eggs, baked potato, burger
  - **Pie Oven** — carrot pie, pumpkin pie, apple-less strawberry pie, fish pie
  - **Loom + Sewing Machine** — cotton fabric, wool sweater, cotton shirt, wooly hat, blue wooly hat (indigo dye)
  - **Juice Press** — carrot juice, tomato juice, strawberry smoothie, grape juice
  - **Jam Maker** — strawberry jam, grape jam, honey jam
  - **Coffee Kiosk** — espresso, latte, honey coffee
  - **Candy Machine** — caramel, chili chocolate, honey toffee
- **Fishing pond:** cast with a timing minigame (moving marker, click in the green zone), 8 fish species across 3 rarities + rare treasure chests (coins/diamonds); fish feed the Pie Oven's fish pie and boat orders.
- **Decorations — 12+:** fences (3 styles), flowerbeds, oak/pine trees, stone paths, scarecrow, fountain, windmill (animated), pond lilies, gnome, hay bales.
- **Levels 1–40:** XP curve with an unlock at *every* level (new crop, recipe, building, animal, expansion zone, or feature) so there's always a next carrot. Features gate in stages: order board L3, feed mill L5, truck L8, fishing L12, boat L17, mine L24.

### Systems
- **Farm grid** (`farm.js`): isometric-look diamond grid (rendered 2:1), ~24×24 logical tiles; starting area unlocked, **expansion** buys adjacent zones with coins + level gate. Objects occupy footprints (field 1×1, buildings 2×2, pens 3×3, pond fixed).
- **Timers** (`production.js`): all timers are wall-clock timestamps (`readyAt`), so progress continues while the game is closed — matches Hay Day. On load, elapsed time resolves finished work.
- **Storage:** Silo (crops) and Barn (goods) with capacity, upgradeable with coins.
- **Order board** (`orders.js`): 6 rotating orders asking for goods mixes, paying coins+XP; refresh/discard with 5-min cooldown.
- **Truck orders:** every ~15 min a truck request of 3 bundles appears; fulfilling all 3 pays a bonus.
- **Boat orders (L17):** a boat docks every ~2 h with 6 crates of bulk goods; filling every crate before it departs pays a large coin/XP bonus plus vouchers (cosmetic currency for exclusive decorations).
- **Mine (L24):** buy pickaxes/dynamite (from orders & fishing chests) to dig ore (silver, gold, platinum, gems); a **Smelter** building refines ore into bars for high-value late-game orders.
- **Diamonds:** premium-style currency earned free (level-ups, achievements, treasure chests, mine gems) — spend to skip timers or buy exclusive decorations. No real money anywhere, obviously.
- **Achievements (~20):** e.g. "Harvest 100 wheat", "Fulfill 50 orders", "Catch every fish" — award diamonds and profile badges, shown in an achievements panel.
- **Daily reward:** a wheel-of-fortune spin once per day (coins, goods, diamonds), streak bonus for consecutive days.
- **Visitors:** occasional NPC visitors wander to your shop/farm and ask to buy a specific item at a premium — accept or decline.
- **Merge Meadow (L11) — Township-style merge minigame:** a separate 7×9 merge board opened from the dock. Generators (Toolbox, Seed Sack, Gift Box) spawn tier-1 items for energy (regenerates ~1/90s, max 100, offline like all timers); drag two identical items to merge into the next tier across 3 chains (Tools 7 tiers, Plants 7, Treats 6). Mid-chain and top-tier items are claimable for rewards that pay into the main farm — coins, diamonds, boat vouchers, and mine tools — so the minigame feeds the core loop. Small bonus drops (coins/energy) on ~12% of merges. Board state persists in the save. Module: `src/merge.js`; tuning in `data.js` `MERGE`.
- **Pets (L10+):** dog and cat roam the farm; feed them daily for an XP bonus and idle animations.
- **Events (Hay Day-style, offline single-player; all client-side + deterministic from the calendar):**
  - **Weekend point events** (Fri–Sun, picked by ISO week number from a 7-event rotation):
    Harvest / Production / Fishing Frenzy / Mining Madness / Truck Bonanza / Boat Race /
    Merge Mania. Themed actions score points; bronze/silver/gold tiers (level-scaled
    thresholds) pay coins, diamonds, goods — gold tiers of some events grant exclusive
    decorations (bunting fence, festival tent, prize trophy, balloon cluster). Each event
    also carries a passive weekend buff (2x crop XP, double fish, +50% truck coins, ...).
  - **Weekday mini-events** (Tue–Wed): one small single-tier goal (Egg Hunt, Bake-Off,
    Order Rush).
  - **Farm Fair** (the Derby, solo adaptation; monthly, L15+): 9 tasks drawn from a
    15-task pool (seeded by year+month), complete any 7 in the week; bronze/silver/gold
    ribbons by task points with big rewards; lifetime gold ribbons fill the **Fair Pass**
    (bronze/silver/golden trophy decoration line).
  - **Holiday seasons** (month-keyed, cosmetic): Spring Bloom, Summer Splash, Harvest
    Fest, Winter Holiday (snow tint) — each with limited shop decorations that stay once
    owned. No paid anything.
  - UI: `.event-banner` strip under the HUD (icon, progress bar with tier pins, timer);
    event panel via the ⭐ extras dock button. Data in `data.js` `EVENTS`; logic contract
    in `extras.js` (tickEvents, addEventPoints, claimEventTier, activeFair, ...).
- **Tutorial:** guided first 10 minutes — arrow + highlight overlay walks the player through plant → harvest → feed chicken → bake bread → fulfill first order.
- **Sound (WebAudio, generated in code):** soft pops, coin clinks, harvest swishes, ambient birds — synthesized (no audio files), with a mute toggle.
- **Settings panel:** sound on/off, autosave interval, reset game, and manual save-export/import (JSON download/paste) so progress can move between machines.
- **Roadside shop** (`shop.js`): 8 slots; player lists an item + quantity at a price within a min/max band; sells automatically after a short timer (simulated "visitors").
- **Economy** (`economy.js`): sell values per item, XP per action, level curve `xp(n) = 50 * n^1.8` rounded.
- **Save/load** (`state.js`): single JSON blob in `localStorage`, autosave every 10 s and on quit; version field for migrations.

### Presentation
- **Vector art** (`sprites.js`): each entity is a `draw(ctx, x, y, size, stage/frame)` function using paths, gradients, and rounded shapes — e.g. wheat as golden stalk fans with 4 growth stages, cow as rounded white/black body with idle bob, buildings with roofs and awnings. Consistent palette (greens, warm browns, sky gradient).
- **Camera:** drag to pan, wheel to zoom (clamped); subtle animated clouds and day-cycle tint in `renderer.js`.
- **Juice** (`effects.js`): coin/XP pop-ups, harvest sparkles, bounce ease on placements, progress rings over busy plots/buildings.
- **HUD/UI** (`ui.js` + DOM overlay): top bar (coins, level+XP bar), bottom toolbar (build/shop/orders/fishing), side panels rendered as styled DOM over the canvas — DOM for menus, canvas for the world.


### Hay Day reference notes (wiki research, Phase A.3)

Visual ground truth (hayday.fandom.com + Hay Day's established identity):
- The ground is a **continuous soft meadow — no visible grid or checkerboard** in normal
  play. Subtle low-frequency tonal mottling, sparse grass tufts, tiny flowers; painted
  look, no outlines. The placement grid appears **only in edit/placement mode**.
- **Fields are raised soil slabs**: rounded diamonds with a light top-edge highlight and a
  darker visible side thickness; furrows on top; crops render as dense rows.
- The farm is **framed**: a dirt road along the front (the roadside shop sits on it),
  fence lines, forest/tree borders on unexpanded land, expansion plots marked with posts.
- Perspective is ~2:1 dimetric with soft blob shadows.

Mechanics confirmed by the wiki: 1 planted crop → 2 harvested (matches our rule); fields
cost ~1 coin, are unlimited, and are granted with levels; farm expansion (their L22+)
consumes **land deeds + mallets + marker stakes** rather than coins. *Phase B fidelity
option:* switch our expansions from coin costs to expansion materials earned from orders,
chests and the boat — keep coins as the simple default until then.


## Township layer (Hay Day + Township combined)

Township's defining systems, adapted offline/solo, on top of the farm:

- **The Town (L20, `src/town.js`):** a district on the world grid. **10 house types**
  (cottage → mansion) cost coins + construction materials and grant **population**;
  **6 community buildings** (town hall → museum) raise the population cap. **Population
  milestones** pay rewards and unlock higher building tiers — Township's growth loop
  without multiplayer. Data: `TOWN`.
- **Construction materials (`MATERIALS`):** brick, slab, glass, paint, hammer, nails +
  the Hay Day expansion trio (land deed, mallet, marker stake — `FARM.expansions` now
  cost coins **and** materials). Earned from trains, the airport, mine chests and events;
  stored in the barn.
- **Trains (L21, `src/trains.js`):** cargo trains arrive every ~3 h with 3–5 wagons
  requesting goods; filled trains depart and return with construction materials — the
  engine of the materials economy. Data: `TRAINS`.
- **Airport (L28, contract in `trains.js`):** a cargo plane with 4 crates of high-tier
  goods every ~4 h; pays a big coin bonus + materials + XP. The boat stays the Hay Day
  voucher channel; the plane is the Township materials/XP channel. Data: `AIRPORT`.
- **Helicopter orders:** the order board is presented as the helicopter pad (Township
  flavor; `orders.js` unchanged mechanically).
- **Zoo (L34, `src/zoo.js`):** 8 enclosures (peacock → elephant) bought with coins +
  materials; feed each species farm goods on timers to produce **zoo souvenir goods**;
  passive visitor income scales with town population; a 3-slot zoo order board mixes zoo
  + farm goods. Data: `ZOO`.
- **Island expeditions (L36, contract in `boat.js`):** send the boat to 4 islands
  (Palm Isle → Volcano Key); it returns with exotic goods (banana, pineapple, cocoa,
  vanilla) consumed by the new **Tropical Café** building (4 recipes). Data: `ISLANDS`.
- **Market trader (L9, contract in `shop.js`):** a daily rotating 6-slot stall selling
  goods/materials for coins at a premium, restocking each morning. Data: `MARKET`.
- **Regatta → Farm Fair:** Township's Regatta maps onto the existing monthly Farm Fair
  task board (see Events).
- **Levels extended to 50** to pace the Township content (zoo enclosures and islands
  fill 41–50; still an unlock at every level).

## Look & feel — modern, not retro

The target aesthetic is a **modern casual game** (think current Hay Day / township-style polish), not an old-school or pixel game:

- **Flat vector art with depth cues:** smooth rounded shapes, soft gradients, subtle drop shadows under every object, gentle ambient animation (crops sway, animals bob, clouds drift). Vibrant saturated palette — lush greens, warm golds, sky blue — with a soft day-cycle tint.
- **High-DPI crisp rendering:** canvas scaled to `devicePixelRatio`, everything drawn with anti-aliased paths — no blocky pixels anywhere.
- **Hay Day-style tactile UI:** wood-plank frames, cream parchment panels (18px rounded), dark leather-brown counter pills with gold trim, chunky glossy green/orange buttons with bevel highlights and dark outlines, white numerals with drop shadow, a friendly rounded sans font (Nunito), springy open/close animations, and micro-interactions (buttons scale on hover/press).
- **Juice everywhere:** coin bursts, +XP floaters, harvest sparkles, elastic bounce when placing buildings, smooth eased camera pan/zoom.

### App window & screen layout

The app opens as a **frameless-feel 1280×800 resizable Electron window** titled "Farm Tycoon". Layout:

- **World (full-window canvas):** an isometric farm on rolling green terrain — tilled brown field plots, cute rounded buildings with colored awnings, animal pens, a sparkling pond in one corner, drifting cloud shadows. Drag to pan, scroll to zoom.
- **Top-left:** circular level badge with an arcing XP progress ring, player level number inside.
- **Top-right:** pill-shaped counters for coins (gold coin icon) and, next to them, silo/barn capacity pills that pulse when nearly full.
- **Bottom-center dock:** a floating rounded toolbar (like a macOS dock) with big friendly icon buttons — Build 🔨, Shop stand, Orders board, Truck, Fishing — each with notification badges (e.g. "order ready").
- **Panels:** clicking a dock icon slides up a parchment sheet in a wooden frame from the bottom (orders as cards with goods icons and coin/XP rewards; shop as a grid of sale slots; build menu as a horizontally scrollable card carousel showing price + level lock).
- **Contextual radial menu:** tapping a field/building pops a small radial of round action buttons around it (plant, harvest, collect, info) — the signature modern farm-game interaction.
- **Progress feedback:** thin rounded progress rings float above growing crops and busy buildings, with a checkmark burst when ready.

## Electron packaging

- `electron/main.cjs`: 1280×800 resizable `BrowserWindow`, loads `index.html`, `contextIsolation: true`, no node integration in renderer.
- `package.json`: `npm start` → electron; `npm run dist` → `electron-builder --win nsis` producing a Windows installer. Include `build` config (appId, productName "Farm Tycoon", win target).
- Game must also run by simply opening `index.html` / a static server, so all dev iteration happens in the browser.

## Implementation order

1. Scaffold: `index.html`, `styles.css`, game loop, camera, grid renderer with placeholder tiles.
2. `data.js` content definitions + `state.js` save/load.
3. Crops end-to-end: plant, growth stages, harvest, silo, sell (instant-sell first) — playable loop.
4. Vector sprite pass: terrain, crops, UI polish.
5. Animals + production buildings with queues; barn storage.
6. Economy: XP/levels/unlocks; order board.
7. Roadside shop, truck orders, fishing pond (with minigame).
8. Boat orders, mine + smelter, Merge Meadow minigame, diamonds, achievements, daily wheel, NPC visitors.
9. Expansion + decorations; effects/juice pass; balance timers & prices across levels 1–40.
10. Pets, seasonal events, tutorial overlay, WebAudio SFX, settings panel with save export/import.
11. Repo docs & tooling: `PLAN.md` (this document), `CLAUDE.md`, `.claude/skills/` (run-game, add-content, playtest), README.
12. Electron wrapper + `package.json` + build config.
13. Test in browser (Playwright/Chromium available for a smoke check + screenshot), commit, push, open draft PR.

## Verification

- Run a static server (`python3 -m http.server`) and drive Chromium via Playwright: boot with no console errors, plant/harvest a wheat plot (short timer), verify coins/XP increase and save persists across reload.
- `npm start` under Electron can't be visually verified headless in this container, but the wrapper is minimal; verify `electron-builder` config passes `npx electron-builder --help`-level sanity and document the Windows build steps in README for the user to run locally.
- Manual balance sanity: starting coins allow the first field/crop purchases; level-2 unlock reachable in ~5 minutes of play.
