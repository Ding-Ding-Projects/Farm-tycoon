// validate-data.mjs — integrity checks for src/data.js. Run via `npm test`.
// Fails (exit 1) if any content id doesn't resolve or invariants are broken.

import * as d from '../src/data.js';

const errors = [];
const item = (id) => d.CROPS[id] || d.GOODS[id];
const checkMaterials = (ctx, mats) => {
  for (const [m, q] of Object.entries(mats || {})) {
    if (!d.MATERIALS[m]) errors.push(`${ctx}: unknown material '${m}'`);
    if (!(q > 0)) errors.push(`${ctx}: bad material qty for '${m}'`);
  }
};

// Every recipe output exists in GOODS; every input is a crop or good.
for (const [bid, b] of Object.entries(d.BUILDINGS)) {
  for (const r of b.recipes) {
    if (!d.GOODS[r.id]) errors.push(`${bid}: recipe output '${r.id}' not in GOODS`);
    for (const i of Object.keys(r.inputs)) if (!item(i)) errors.push(`${bid}/${r.id}: input '${i}' unknown`);
    if (!(r.time > 0) || !(r.xp > 0)) errors.push(`${bid}/${r.id}: bad time/xp`);
  }
}

// Animals: product in GOODS, feed is a feed-mill recipe (or null for bees).
const feedIds = new Set(d.BUILDINGS.feed_mill.recipes.map((r) => r.id));
for (const [aid, a] of Object.entries(d.ANIMALS)) {
  if (!d.GOODS[a.product]) errors.push(`animal ${aid}: product '${a.product}' not in GOODS`);
  if (a.feed !== null && !feedIds.has(a.feed)) errors.push(`animal ${aid}: feed '${a.feed}' is not a feed-mill recipe`);
}

// Fishing species + chest/mine loot items exist.
for (const f of d.FISHING.species) if (!d.GOODS[f]) errors.push(`fishing species '${f}' not in GOODS`);
for (const l of d.FISHING.chestLoot) if (l.item && !d.GOODS[l.item]) errors.push(`chest loot '${l.item}' unknown`);
for (const t of Object.values(d.MINE.tools)) for (const y of t.yields) if (!d.GOODS[y.item]) errors.push(`mine yield '${y.item}' unknown`);

// Merge Meadow: generator chains exist; claim tiers within range; rewards resolve.
for (const [gid, g] of Object.entries(d.MERGE.generators)) if (!d.MERGE.chains[g.chain]) errors.push(`generator ${gid}: chain '${g.chain}' unknown`);
for (const [cid, c] of Object.entries(d.MERGE.chains)) {
  for (const tier of Object.keys(c.claims)) if (+tier >= c.tiers.length) errors.push(`merge chain ${cid}: claim tier ${tier} out of range`);
  for (const rw of [c.topReward, ...Object.values(c.claims)]) if (rw.item && !d.GOODS[rw.item]) errors.push(`merge chain ${cid}: reward item '${rw.item}' unknown`);
}

// Township layer: town, trains/airport, zoo, islands, market, expansion materials.
for (const [id, h] of Object.entries(d.TOWN.houses)) {
  checkMaterials(`house ${id}`, h.materials);
  if (!(h.population > 0) || !(h.cost > 0) || !(h.tier >= 1)) errors.push(`house ${id}: bad population/cost/tier`);
}
for (const [id, c] of Object.entries(d.TOWN.communityBuildings)) {
  checkMaterials(`community ${id}`, c.materials);
  if (!(c.capacity > 0)) errors.push(`community ${id}: bad capacity`);
}
{
  let prev = 0;
  for (const m of d.TOWN.milestones) {
    if (m.population <= prev) errors.push('town milestones not ascending');
    prev = m.population;
    checkMaterials('town milestone', m.rewards.materials);
  }
}
for (const [id, z] of Object.entries(d.ZOO.enclosures)) {
  checkMaterials(`zoo ${id}`, z.materials);
  if (!d.GOODS[z.product]) errors.push(`zoo ${id}: product '${z.product}' not in GOODS`);
  for (const f of Object.keys(z.feed)) if (!item(f)) errors.push(`zoo ${id}: feed '${f}' unknown`);
}
for (const [id, isl] of Object.entries(d.ISLANDS.destinations)) {
  for (const g of Object.keys(isl.cargo)) if (!d.GOODS[g]) errors.push(`island ${id}: cargo '${g}' not in GOODS`);
  if (!(isl.tripTime > 0)) errors.push(`island ${id}: bad tripTime`);
}
for (const e of d.FARM.expansions) checkMaterials(`expansion ${e.id}`, e.materials);
if (!(d.MARKET.slots > 0) || !(d.MARKET.priceMultiplier > 1)) errors.push('MARKET tuning invalid');
if (!(d.TRAINS.wagons[0] <= d.TRAINS.wagons[1])) errors.push('TRAINS wagons range invalid');

// LEVELS.unlocks ids resolve to known content or feature flags.
const features = new Set([
  'field', 'orders_board', 'truck', 'boat', 'fishing', 'mine', 'pets', 'merge_meadow',
  'silo_mega_upgrade', 'barn_mega_upgrade', 'golden_fields', 'master_orders', 'golden_windmill',
  'market', 'town', 'trains', 'airport', 'zoo', 'islands', 'town_mega_milestone',
]);
const known = (id) => d.CROPS[id] || d.ANIMALS[id] || d.BUILDINGS[id] || features.has(id)
  || d.FARM.expansions.some((e) => e.id === id) || d.ZOO.enclosures[id]
  || d.ISLANDS.destinations[id] || d.DECORATIONS[id];
for (const [lvl, ids] of Object.entries(d.LEVELS.unlocks)) {
  if (+lvl > d.LEVELS.maxLevel) errors.push(`unlocks at level ${lvl} beyond maxLevel`);
  for (const id of ids) if (!known(id)) errors.push(`level ${lvl}: unlock '${id}' unknown`);
}

// Unlock levels referenced by content all have an unlocks entry (design goal: no dead levels).
for (let l = 1; l <= d.LEVELS.maxLevel; l++) if (!d.LEVELS.unlocks[l]) errors.push(`level ${l} has no unlock`);

// Achievements: unique ids, positive targets.
const seen = new Set();
for (const a of d.ACHIEVEMENTS) {
  if (seen.has(a.id)) errors.push(`duplicate achievement id '${a.id}'`);
  seen.add(a.id);
  if (!(a.target > 0) || !(a.diamonds > 0)) errors.push(`achievement ${a.id}: bad target/diamonds`);
}

// Decorations & pets sanity.
for (const [id, dec] of Object.entries(d.DECORATIONS)) {
  if (!dec.cost && !dec.voucherCost && !dec.eventOnly) errors.push(`decoration ${id}: no cost and not eventOnly`);
  if (dec.holiday && !d.EVENTS.holidays.some((hd) => hd.id === dec.holiday)) errors.push(`decoration ${id}: unknown holiday '${dec.holiday}'`);
}

// Events: rotations non-empty; thresholds ascending & matching rewards; reward refs resolve.
const STAT_KEYS = new Set([
  'cropsHarvested', 'goodsProduced', 'ordersFulfilled', 'trucksCompleted', 'truckBundles',
  'boatsCompleted', 'boatCrates', 'fishCaught', 'uniqueFishCaught', 'mineDigs',
  'animalCollections', 'shopSales', 'merges', 'feedMade', 'coinsEarned', 'level',
]);
const checkReward = (ctx, rw) => {
  if (rw.item && !d.GOODS[rw.item]) errors.push(`${ctx}: reward item '${rw.item}' unknown`);
  if (rw.decoration && !d.DECORATIONS[rw.decoration]) errors.push(`${ctx}: reward decoration '${rw.decoration}' unknown`);
};
for (const pool of [d.EVENTS.weekend.rotation, d.EVENTS.miniWeekday.rotation]) {
  if (!pool.length) errors.push('event rotation empty');
  for (const ev of pool) {
    for (const s of Object.keys(ev.pointsFor)) if (!STAT_KEYS.has(s)) errors.push(`event ${ev.id}: unknown stat '${s}'`);
    if (ev.thresholds.length !== ev.rewards.length) errors.push(`event ${ev.id}: thresholds/rewards length mismatch`);
    for (let i = 1; i < ev.thresholds.length; i++) if (ev.thresholds[i] <= ev.thresholds[i - 1]) errors.push(`event ${ev.id}: thresholds not ascending`);
    ev.rewards.forEach((rw) => checkReward(`event ${ev.id}`, rw));
  }
}
for (const t of d.EVENTS.fair.taskPool) {
  if (!STAT_KEYS.has(t.stat)) errors.push(`fair task ${t.id}: unknown stat '${t.stat}'`);
  if (!(t.target > 0) || !(t.points > 0)) errors.push(`fair task ${t.id}: bad target/points`);
}
if (d.EVENTS.fair.taskPool.length < d.EVENTS.fair.tasksPerFair) errors.push('fair taskPool smaller than tasksPerFair');
{
  const r = d.EVENTS.fair.ribbonThresholds;
  if (!(r.bronze < r.silver && r.silver < r.gold)) errors.push('fair ribbon thresholds not ascending');
  for (const [tier, rw] of Object.entries(d.EVENTS.fair.ribbonRewards)) checkReward(`fair ribbon ${tier}`, rw);
  for (const p of d.EVENTS.fair.fairPass) checkReward('fairPass', p);
}
for (const hd of d.EVENTS.holidays) if (!hd.months?.length) errors.push(`holiday ${hd.id}: no months`);

if (errors.length) {
  console.error(`data.js validation FAILED (${errors.length}):\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log(
  `data.js OK — ${Object.keys(d.CROPS).length} crops, ${Object.keys(d.ANIMALS).length} animals, ` +
  `${Object.keys(d.BUILDINGS).length} buildings, ${Object.values(d.BUILDINGS).reduce((n, b) => n + b.recipes.length, 0)} recipes, ` +
  `${Object.keys(d.GOODS).length} goods, ${Object.keys(d.MERGE.chains).length} merge chains, ${d.ACHIEVEMENTS.length} achievements, ` +
  `${d.LEVELS.maxLevel} levels all with unlocks, ${d.EVENTS.weekend.rotation.length} weekend events + ` +
  `${d.EVENTS.miniWeekday.rotation.length} mini-events + ${d.EVENTS.fair.taskPool.length} fair tasks + ${d.EVENTS.holidays.length} holidays, ` +
  `town: ${Object.keys(d.TOWN.houses).length} houses + ${Object.keys(d.TOWN.communityBuildings).length} community, ` +
  `${Object.keys(d.ZOO.enclosures).length} zoo enclosures, ${Object.keys(d.ISLANDS.destinations).length} islands, ` +
  `${Object.keys(d.MATERIALS).length} materials`
);
