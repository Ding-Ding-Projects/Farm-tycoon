// sprites.js — pure vector art. Every entity is a draw function using canvas paths,
// gradients and rounded shapes — no image assets, anti-aliased, modern flat style with
// soft shadows. Contract: draw<Thing>(ctx, x, y, size, stageOrFrame) where (x,y) is the
// tile anchor in screen space and `size` the tile width at current zoom.
//
// GROUND RULE (Hay Day reference): the world ground renders as a CONTINUOUS soft meadow —
// base green with low-frequency tonal mottling, sparse tufts and tiny flowers. The logical
// placement grid is NEVER drawn during normal play; grid squares appear only in placement /
// edit mode (renderer.drawFrame draws them under the placement ghost). Fields and buildings
// are free-standing raised slabs with a lighter top edge and darker side thickness.
//
// Shared palette (must match DESIGN_BRIEF.md / styles.css tokens). Values below are the
// Phase A "candy graft" revision from design/handoff/SPRITE-NOTES.md §1 — same keys as the
// original stub, raised saturation, plus five new keys (flowerPink, roadLight, outline,
// outlineWidth, sun, vignette). `outline` (#3a2510) MUST equal the `--color-outline` CSS
// token — chrome (DOM/CSS) and world (canvas) sharing one outline colour is most of why the
// two read as one artefact instead of two mismatched layers.
export const PALETTE = {
  // ground — pushed up in saturation without going neon
  grass: '#8ecb36', grassLight: '#a8dc52', grassDark: '#6da828',
  grassMottleLight: 'rgba(206,238,124,0.45)', grassMottleDark: 'rgba(96,152,40,0.34)',
  flowerWhite: '#fff8ee', flowerYellow: '#ffd94d', flowerPink: '#f48ab0',   // NEW
  soil: '#9c6432', soilLight: '#b87c40', soilDark: '#6f4218', soilRow: 'rgba(58,37,16,0.44)',
  water: '#3fb0e0', waterLight: '#86d8f2',
  road: '#e6bd7c', roadEdge: '#a87c42', roadLight: 'rgba(255,231,178,0.72)',  // NEW
  wood: '#c08a4e', woodDark: '#7a4a18', woodLight: '#dca868',
  roof: '#e05548', roofDark: '#b83a2c', roofTop: '#a03426', roofAlt: '#4a8fd4',
  wall: '#fbeccb', window: '#7fd4f0', trimLight: '#fffaea',
  silo: '#e8dcc0', siloLight: '#fffaea', siloDark: '#bfae8c',
  gold: '#f0b52e', cream: '#fffaf0', wheatGold: '#f2c94c',
  shadow: 'rgba(58,37,16,0.26)',

  // NEW — the three that carry the whole look (SPRITE-NOTES §1)
  outline: '#3a2510',        // one outline colour for every sprite; == --color-outline
  outlineWidth: 3.5,         // at tile ≈ 104px; scale with tile size, see §2 contract below
  sun: 'rgba(255,196,104,0.34)',      // golden-hour wash
  vignette: 'rgba(72,44,14,0.38)',    // corner falloff
};

// ---------------------------------------------------------------------------------------
// §2 contract — outline(ctx): silhouette stroke shared by every draw function. Phase B
// implements this once and every entity function calls it after filling its own path(s).
//
//   const OW = PALETTE.outlineWidth * (T / 104);   // scale with tile size T
//   function outline(ctx) {
//     ctx.strokeStyle = PALETTE.outline;
//     ctx.lineWidth = OW;
//     ctx.lineJoin = 'round';
//     ctx.stroke();
//   }
//
// Rules (SPRITE-NOTES §2), binding on every draw function added below:
//   - Outline SILHOUETTES ONLY — the body/roof/canopy/animal outer edge. Never interior
//     detail (plank lines, window mullions, soil rows); those stay low-alpha strokes with
//     no outline treatment of their own.
//   - ONE outline width per entity, not per part. Small props (fence posts, grain dots) use
//     `OW * 0.5`.
//   - Canopy / foliage clusters: outline the UNION of the cluster, never each circle
//     individually. Fill every circle first, then build one combined path over all the arcs
//     and stroke it once — stroking per-circle produces a bag of overlapping rings instead
//     of one clean silhouette.
//   - Ground and water tiles get NO outline. The pond (drawPond) is the one water shape that
//     DOES get an outline, because as a placed object it needs to read as clickable/discrete
//     rather than as part of the terrain.
//   - Existing white trim on barn/house stays INSIDE the outline: draw order is
//     fill → white trim stroke → dark outline stroke (outermost, last). The cream sliver
//     left between the red fill and the dark outline is what makes the trim pop.
//
// §3 contract — golden-hour lighting pass. Called once per frame by renderer.js, AFTER all
// entities are drawn and BEFORE UI/DOM overlays, using canvas size (w, h):
//
//   function drawGoldenHour(ctx, w, h) {
//     const sun = ctx.createRadialGradient(w * 0.72, -h * 0.18, 0, w * 0.72, -h * 0.18, h * 1.15);
//     sun.addColorStop(0, PALETTE.sun); sun.addColorStop(1, 'rgba(0,0,0,0)');
//     ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
//
//     const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.34, w / 2, h * 0.5, h * 1.02);
//     vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, PALETTE.vignette);
//     ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
//   }
//
// Two entity-level details this pass depends on, both mandatory in every applicable draw fn:
//   - Shadows lean AWAY from the sun (upper-right source): offset the ground-shadow ellipse
//     left and down by `~0.10 * T` / `~0.05 * T` instead of centring it under the sprite.
//   - Warm rim light: on BIG STRUCTURES ONLY (buildings, not crops/props/decorations), after
//     the outline stroke, stroke the upper-right silhouette edge with
//     `rgba(255,225,150,0.5)` at `OW * 0.6`. One extra stroke per building; skip entirely on
//     small props/crops/decorations.
//
// If a day/night cycle ever lands, `PALETTE.sun` and `PALETTE.vignette` are the only two
// values that need to change — that is why they live in PALETTE and not hardcoded in the
// drawGoldenHour body.
// ---------------------------------------------------------------------------------------

// §7 contract — crop growth stages. One shared stem/head routine driven by a numeric
// `growProgress` (0..1) parameter, NOT bespoke per-crop art. Crop identity is carried
// entirely by head shape + head colour, passed into the shared routine as config:
//
//   drawCropStage(ctx, x, y, size, growProgress, { headShape, headColor, leafColor })
//
//   growProgress  Stage     Draw
//   0             Planted   6–8 dark seed dots scattered in the furrows
//   0–0.5         Sprout    two small leaf ellipses per dot, in `leafColor` (leafLight tone)
//   0.5–1         Growing   stem + closed head shape, ~70% of final height
//   1             Ready     full height, head filled with `headColor`; the pulsing
//                           `.plot-ready` DOM chip (CSS-driven) layers on top separately —
//                           the canvas draw function does not render the ready badge itself
//
// This one shared routine is what makes 22 crops (see inventory below) affordable: adding a
// crop is a data-only change (one config row: head shape + head colour), never a new
// drawing routine.

// One draw function per entity; 4 growth stages for crops (via the shared §7 routine above),
// idle-bob frame for animals. Full inventory to implement in Phase B (one exported function
// each unless noted). IDs below are read live from src/data.js — do not hand-type or guess:
// `node -e "import('./src/data.js').then(d=>console.log(Object.keys(d.CROPS), Object.keys(d.ANIMALS), Object.keys(d.STRUCTURES), Object.keys(d.FORAGING.nodes)))"`
//
//   terrain: drawGrassTile, drawSoilPlot, drawLockedTile, drawPath, drawWaterEdge
//
//   crops (x22, data.CROPS) — each (ctx, x, y, size, growProgress 0..1) via §7 shared routine:
//     drawWheat, drawCorn, drawCarrot, drawSoybean, drawSugarcane, drawCotton, drawTomato,
//     drawPotato, drawStrawberry, drawPumpkin, drawIndigo, drawChili, drawCoffee, drawGrapes,
//     drawRice, drawOlive, drawLavender, drawTeaLeaf, drawBellPepper, drawPeony,
//     drawWatermelon, drawMint
//
//   animals (x12, data.ANIMALS) — each (ctx, x, y, size, idleFrame):
//     drawChicken, drawCow, drawPig, drawSheep, drawGoat, drawBee, drawDuck, drawLamb,
//     drawQuail, drawAlpaca, drawOtter, drawTurkey
//
//   pens: drawPen(ctx, x, y, size, penType)
//
//   buildings (production recipes; 15 building types, includes the smelter): drawBuilding(ctx,
//     x, y, size, buildingType, { derelict }) with distinct roof/awning/prop per type (bakery
//     chimney smoke, windmill blades spin, ...) — see §6 for the derelict flag contract
//
//   structures (x22, data.STRUCTURES) — placed, clickable, each needs BOTH an active state
//     and a §6 derelict state via the same flag-on-draw-call contract:
//     drawOrderBoard (order_board), drawTruckBay (truck_bay), drawBarn (barn),
//     drawSilo (silo), drawShopStand (shop_stand), drawBoatDock (boat_dock),
//     drawPond/drawLake (lake), drawMineEntrance (mine_entrance) — see §5 shape recipe,
//     drawMergePlot (merge_plot) — see §5 "Merge Meadow plot" shape recipe,
//     drawMarketStall (market_stall), drawTrainStation (train_station) — see §5 shape recipe,
//     drawAirport (airport), drawHelipad (helipad) — see §5 "Helicopter pad" shape recipe,
//     drawWorkshopYard (workshop_yard) — see §5 "Building Workshop" shape recipe,
//     drawMuseumHall (museum_hall) — see §5 "Museum" shape recipe,
//     drawLaboratory (laboratory) — see §5 "Laboratory" shape recipe,
//     drawExpeditionCamp (expedition_camp) — see §5 "Expedition camp" shape recipe,
//     drawTownGate (town_gate), drawZooGate (zoo_gate), drawMailbox (mailbox),
//     drawBookshelf (bookshelf), drawTripod (tripod)
//
//   foraging nodes (x6, data.FORAGING.nodes) — small, non-outlined-rim world pickups:
//     drawWildflowerPatch (wildflower_patch), drawBerryBush (berry_bush),
//     drawDriftwoodPile (driftwood_pile), drawMushroomRing (mushroom_ring),
//     drawBirdsNest (birds_nest), drawWildHive (wild_hive)
//
//   decorations (x15): drawDecoration(ctx, x, y, size, decoId)
//   pets: drawDog, drawCat (roaming, idle-bob)
//   misc: drawProgressRing(ctx, x, y, r, fraction), drawCloudShadow

// §6 contract — derelict state. Locked structures are visible and clickable from level 1, so
// EVERY structure/building draw function above must accept this flag rather than growing a
// second, parallel "ruined" function:
//
//   function drawStructure(ctx, id, x, y, size, { derelict = false } = {}) { … }
//
// When `derelict` is true:
//   - `ctx.filter = 'saturate(0.45)'` for the whole sprite draw (matches `.derelict-sprite`
//     in styles.css — canvas and DOM must desaturate by the same amount).
//   - Swap roof colour to `#8a7f68`, wall colour to `#c9b89a` (fixed derelict palette, not
//     PALETTE.roof/PALETTE.wall darkened — a distinct washed-out pair).
//   - Break the silhouette: notch the roofline, tilt one post ~6°, omit one window. The
//     shape itself must look abandoned, not just recoloured.
//   - Add two or three loose planks on the ground plus a weed tuft at the base.
//   - Do NOT dim or desaturate the outline stroke — the outline must stay crisp so the
//     structure still reads as clickable even while ruined. `ctx.filter` above applies to
//     the fill/rim passes; the final outline() call happens outside that filter scope.

export function drawPlaceholder(ctx, x, y, size, label) { /* Phase B replaces all placeholders */ }
