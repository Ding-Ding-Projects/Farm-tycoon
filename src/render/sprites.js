// sprites.js — pure vector art. Every entity is a draw function using canvas paths,
// gradients and rounded shapes — no image assets, anti-aliased, modern flat style with
// soft shadows. Contract: draw<Thing>(ctx, x, y, size, stageOrFrame) where (x,y) is the
// tile anchor in screen space and `size` the tile width at current zoom.
//
// Shared palette (must match DESIGN_BRIEF.md tokens):
export const PALETTE = {
  grass: '#7ec850', grassDark: '#5fa83c', soil: '#8a5a33', soilDark: '#6e4526',
  water: '#4db3e6', wood: '#a5713f', roof: '#e05a4e', roofAlt: '#4e8fe0',
  gold: '#f5b52e', cream: '#fff6e5', shadow: 'rgba(30,50,20,0.18)',
};

// One draw function per entity; 4 growth stages for crops, idle-bob frame for animals.
// Full inventory to implement in Phase B (one exported function each):
//   terrain: drawGrassTile, drawSoilPlot, drawLockedTile, drawPath, drawWaterEdge
//   crops (x14): drawWheat, drawCorn, drawCarrot, drawSoybean, drawSugarcane, drawCotton,
//     drawTomato, drawPotato, drawStrawberry, drawPumpkin, drawIndigo, drawChili,
//     drawCoffee, drawGrapes  — each (ctx, x, y, size, stage 0..3)
//   animals (x7): drawChicken, drawCow, drawPig, drawSheep, drawGoat, drawBeehive, drawDuck
//   pens: drawPen(ctx, x, y, size, penType)
//   buildings (x13 incl. smelter): drawBuilding(ctx, x, y, size, buildingType) with
//     distinct roof/awning/prop per type (bakery chimney smoke, windmill blades spin, ...)
//   world: drawPond, drawMineEntrance, drawShopStand, drawTruck, drawBoat, drawSilo, drawBarn
//   decorations (x15): drawDecoration(ctx, x, y, size, decoId)
//   pets: drawDog, drawCat (roaming, idle-bob)
//   misc: drawProgressRing(ctx, x, y, r, fraction), drawCloudShadow

export function drawPlaceholder(ctx, x, y, size, label) { /* Phase B replaces all placeholders */ }
