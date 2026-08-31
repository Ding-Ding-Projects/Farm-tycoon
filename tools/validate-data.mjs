// validate-data.mjs — integrity checks for src/data.js. Run via `npm test`.
// Fails (exit 1) if any content id doesn't resolve or invariants are broken.

import * as d from '../src/data.js';

const errors = [];
const item = (id) => d.CROPS[id] || d.GOODS[id];
// Recipe inputs are wider than item(): the Building Workshop consumes raw MATERIALS to
// craft components and kits, so a recipe input may be a crop, a good, or a material.
// item() stays narrow for everything else (zoo feed, island cargo) where materials are
// not a legal input.
const recipeInput = (id) => d.CROPS[id] || d.GOODS[id] || d.MATERIALS[id];
// Materials resolve, have positive quantities, and - when a set is named - come from the
// right economy. A barn upgrade asking for expansion tools is a design bug, not a typo.
const checkMaterials = (ctx, mats, requiredSet = null) => {
  for (const [m, qty] of Object.entries(mats || {})) {
    const mat = d.MATERIALS[m];
    if (!mat) { errors.push(`${ctx}: unknown material '${m}'`); continue; }
    if (!(qty > 0)) errors.push(`${ctx}: bad material qty for '${m}'`);
    if (requiredSet && mat.set !== requiredSet)
      errors.push(`${ctx}: material '${m}' is set '${mat.set}', expected '${requiredSet}'`);
  }
};

// Every recipe output exists in GOODS; every input is a crop or good.
for (const [bid, b] of Object.entries(d.BUILDINGS)) {
  for (const r of b.recipes) {
    if (!d.GOODS[r.id]) errors.push(`${bid}: recipe output '${r.id}' not in GOODS`);
    for (const i of Object.keys(r.inputs)) if (!recipeInput(i)) errors.push(`${bid}/${r.id}: input '${i}' unknown`);
    if (!(r.time > 0) || !(r.xp > 0)) errors.push(`${bid}/${r.id}: bad time/xp`);
  }
}

// Building kits: the crafting spine. A kit must be a real good, must actually be craftable
// in the Building Workshop, and must not be reachable before the building it places exists -
// otherwise a player can hold a kit for a building the game will not let them own.
{
  const WORKSHOP = 'build_workshop';
  const ws = d.BUILDINGS[WORKSHOP];
  if (!ws) errors.push('BUILDINGS: build_workshop is missing - nothing can craft kits');
  const craftable = new Set((ws ? ws.recipes : []).map((r) => r.id));
  const kitOwners = new Map();
  for (const [bid, b] of Object.entries(d.BUILDINGS)) {
    if (!b.kit) continue;
    if (!d.GOODS[b.kit]) errors.push(`building ${bid}: kit '${b.kit}' not in GOODS`);
    else if (!craftable.has(b.kit)) errors.push(`building ${bid}: kit '${b.kit}' is not craftable in ${WORKSHOP}`);
    if (kitOwners.has(b.kit)) errors.push(`kit '${b.kit}' is claimed by both ${kitOwners.get(b.kit)} and ${bid}`);
    kitOwners.set(b.kit, bid);
    if (ws && b.unlockLevel < ws.unlockLevel)
      errors.push(`building ${bid} unlocks at ${b.unlockLevel}, before ${WORKSHOP} at ${ws.unlockLevel} - its kit is uncraftable`);
  }
  // Hand-written list, because a rule alone passes trivially on a building that simply has
  // no kit field. These must each require one; the three coin-only ones must NOT.
  const MUST_HAVE_KIT = ['dairy', 'sugar_mill', 'popcorn_pot', 'grill', 'pie_oven', 'loom', 'sewing_machine', 'juice_press', 'jam_maker', 'coffee_kiosk', 'candy_machine', 'tropical_cafe', 'smelter',
    'oil_press', 'tea_house', 'sushi_bar', 'perfumery', 'salad_bar', 'pasta_kitchen',
    'fondue_pot', 'preservation_station', 'jeweler', 'yogurt_maker'];
  const COIN_ONLY = ['feed_mill', 'bakery', 'build_workshop'];
  for (const bid of MUST_HAVE_KIT) {
    if (!d.BUILDINGS[bid]) errors.push(`kit inventory names unknown building '${bid}'`);
    else if (!d.BUILDINGS[bid].kit) errors.push(`building ${bid} must require a build kit but has none`);
  }
  for (const bid of COIN_ONLY)
    if (d.BUILDINGS[bid] && d.BUILDINGS[bid].kit)
      errors.push(`building ${bid} must stay coin-only but requires kit '${d.BUILDINGS[bid].kit}'`);
  for (const bid of Object.keys(d.BUILDINGS))
    if (!MUST_HAVE_KIT.includes(bid) && !COIN_ONLY.includes(bid))
      errors.push(`building ${bid} is in neither the kit list nor the coin-only list - classify it`);
}

// Per-factory minigames. The hand-written list matters more than the rules: a rule alone
// passes happily on a building that simply has no minigame field, so the thing that would
// actually go wrong (somebody adds a factory and forgets its game) needs an explicit roster.
{
  const MUST_HAVE_MINIGAME = Object.keys(d.BUILDINGS);
  const seenEffect = new Map();
  for (const bid of MUST_HAVE_MINIGAME) {
    const b = d.BUILDINGS[bid];
    if (!b.minigame) { errors.push(`building ${bid} has no minigame`); continue; }
    const g = d.MINIGAMES[b.minigame];
    if (!g) { errors.push(`building ${bid}: minigame '${b.minigame}' not in MINIGAMES`); continue; }
    if (g.building !== bid) errors.push(`minigame ${b.minigame} says it belongs to ${g.building}, but ${bid} claims it`);
  }
  for (const [gid, g] of Object.entries(d.MINIGAMES)) {
    if (!d.BUILDINGS[g.building]) errors.push(`minigame ${gid}: unknown building '${g.building}'`);
    if (!d.EFFECT_KEYS.includes(g.effect)) errors.push(`minigame ${gid}: effect '${g.effect}' is not in EFFECT_KEYS`);
    if (!(g.cap > 0) || g.cap > 1) errors.push(`minigame ${gid}: cap must be between 0 and 1 so a bonus cannot be farmed without bound`);
    if (!g.name || !g.purpose) errors.push(`minigame ${gid}: needs a name and a stated purpose`);
    // Distinct purpose per factory was an explicit design decision, so two factories
    // sharing an effect key is a design regression, not a harmless duplicate.
    if (seenEffect.has(g.effect)) errors.push(`minigames ${seenEffect.get(g.effect)} and ${gid} share effect '${g.effect}'`);
    seenEffect.set(g.effect, gid);
  }
  if (new Set(d.EFFECT_KEYS).size !== d.EFFECT_KEYS.length) errors.push('EFFECT_KEYS contains duplicates');
}

// Orphan and sink audit - the highest-value rule here, and one that did not exist before.
// A good nobody produces is unobtainable; a crop nobody consumes is a dead-end the player
// grows once and never again. Neither fails any other check, and both are invisible in review.
{
  const produced = new Set();
  for (const b of Object.values(d.BUILDINGS)) for (const r of b.recipes) produced.add(r.id);
  for (const a of Object.values(d.ANIMALS)) produced.add(a.product);
  for (const f of d.FISHING.species) produced.add(f);
  for (const t of Object.values(d.MINE.tools)) for (const y of t.yields) produced.add(y.item);
  for (const i of Object.values(d.ISLANDS.destinations)) for (const g of Object.keys(i.cargo)) produced.add(g);
  for (const z of Object.values(d.ZOO.enclosures)) produced.add(z.product);
  for (const l of d.FISHING.chestLoot) if (l.item) produced.add(l.item);
  for (const c of Object.values(d.MERGE.chains)) {
    if (c.topReward && c.topReward.item) produced.add(c.topReward.item);
    for (const rw of Object.values(c.claims)) if (rw.item) produced.add(rw.item);
  }
  for (const [gid, g] of Object.entries(d.GOODS))
    if (!produced.has(gid) && g.source !== 'loot')
      errors.push(`good '${gid}' has no producer and is not tagged source: 'loot'`);

  // Sinks. Instant-sell is a universal sink, so this applies only to crops, which exist to
  // be turned into something: a crop with no recipe is content the player grows once.
  const consumed = new Set();
  for (const b of Object.values(d.BUILDINGS)) for (const r of b.recipes) for (const k of Object.keys(r.inputs)) consumed.add(k);
  for (const z of Object.values(d.ZOO.enclosures)) for (const k of Object.keys(z.feed)) consumed.add(k);
  for (const cid of Object.keys(d.CROPS))
    if (!consumed.has(cid)) errors.push(`crop '${cid}' is consumed by no recipe or zoo feed`);

  // Materials must be both earnable and spendable. A material with no build cost is a
  // currency for nothing; one with no source is a wall.
  const matSpent = new Set();
  const collect = (m) => { for (const k of Object.keys(m || {})) matSpent.add(k); };
  for (const h of Object.values(d.TOWN.houses)) collect(h.materials);
  for (const c of Object.values(d.TOWN.communityBuildings)) collect(c.materials);
  for (const z of Object.values(d.ZOO.enclosures)) collect(z.materials);
  for (const e of d.FARM.expansions) collect(e.materials);
  for (const b of Object.values(d.BUILDINGS)) for (const r of b.recipes) for (const k of Object.keys(r.inputs)) if (d.MATERIALS[k]) matSpent.add(k);
  for (const s of Object.values(d.STORAGE)) for (const m of s.materials || []) matSpent.add(m);
  for (const mid of Object.keys(d.MATERIALS))
    if (!matSpent.has(mid)) errors.push(`material '${mid}' is spent on nothing`);
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
// Every material set id is one of the four; every material is priced.
for (const [id, m] of Object.entries(d.MATERIALS)) {
  if (!d.MATERIAL_SETS.includes(m.set)) errors.push(`material ${id}: unknown set '${m.set}'`);
  if (!(m.sellPrice > 0)) errors.push(`material ${id}: bad sellPrice`);
}

// Expansions draw from the EXPANSION set only, sit inside the grid, and never overlap each
// other or the start zone. Overlap is silent corruption otherwise: two unlock zones would
// claim the same tiles and whichever rendered last would win.
for (const e of d.FARM.expansions) checkMaterials(`expansion ${e.id}`, e.materials, 'expansion');
{
  const N = d.FARM.gridSize;
  const rects = [{ id: 'startZone', r: d.FARM.startZone }, ...d.FARM.expansions.map((e) => ({ id: e.id, r: e.rect }))];
  for (const { id, r } of rects)
    if (r.x < 0 || r.y < 0 || r.w <= 0 || r.h <= 0 || r.x + r.w > N || r.y + r.h > N)
      errors.push(`${id}: rect out of bounds for gridSize ${N}`);
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r, b = rects[j].r;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        errors.push(`${rects[i].id} overlaps ${rects[j].id}`);
    }
}

// Storage upgrades draw from the STORAGE set, and silo/barn must not share a trio.
for (const [which, s] of Object.entries(d.STORAGE)) {
  if (!Array.isArray(s.materials) || s.materials.length !== 3)
    errors.push(`storage ${which}: expected exactly 3 upgrade materials`);
  for (const m of s.materials || []) {
    if (!d.MATERIALS[m]) errors.push(`storage ${which}: unknown material '${m}'`);
    else if (d.MATERIALS[m].set !== 'storage') errors.push(`storage ${which}: '${m}' is not a storage material`);
  }
  if (!(s.materialBase > 0) || !(s.materialStep > 0)) errors.push(`storage ${which}: bad material scaling`);
}
if (d.STORAGE.silo.materials.some((m) => d.STORAGE.barn.materials.includes(m)))
  errors.push('STORAGE: silo and barn must not share upgrade materials');
if (!(d.MARKET.slots > 0) || !(d.MARKET.priceMultiplier > 1)) errors.push('MARKET tuning invalid');
if (!(d.TRAINS.wagons[0] <= d.TRAINS.wagons[1])) errors.push('TRAINS wagons range invalid');

// Nothing may unlock above maxLevel. Without this, raising content past the cap ships
// items no player can ever reach and every other check stays green - which is exactly what
// happened when crops were added at level 84 while maxLevel was still 50.
for (const [label, table] of [['crop', d.CROPS], ['animal', d.ANIMALS], ['building', d.BUILDINGS],
                              ['zoo', d.ZOO.enclosures], ['island', d.ISLANDS.destinations]])
  for (const [id, v] of Object.entries(table))
    if (v.unlockLevel > d.LEVELS.maxLevel)
      errors.push(`${label} '${id}' unlocks at ${v.unlockLevel}, above maxLevel ${d.LEVELS.maxLevel}`);

// LEVELS.unlocks ids resolve to known content or feature flags.
const features = new Set([
  'field', 'orders_board', 'truck', 'boat', 'fishing', 'mine', 'pets', 'merge_meadow',
  'silo_mega_upgrade', 'barn_mega_upgrade', 'golden_fields', 'master_orders', 'golden_windmill',
  'market', 'town', 'trains', 'airport', 'zoo', 'islands', 'town_mega_milestone',
  // late game (levels 51-95)
  'silo_titan_upgrade', 'barn_titan_upgrade', 'deep_silo', 'golden_barn', 'golden_meadow',
  'master_orders_ii', 'gilded_orders', 'grand_fair', 'harvest_festival', 'prize_pavilion',
  'grand_market', 'master_grower', 'master_rancher', 'master_crafter', 'master_farmer',
  'legend_trucks', 'legend_boats', 'legend_trains', 'golden_farm_crown',
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
  // A decoration must have exactly one legitimate way to be obtained. The earn-only flags are
  // a closed list rather than "any truthy flag", so a typo like `coopOnly2: true` is caught
  // instead of silently making the decoration unobtainable by every route.
  const EARN_FLAGS = ['eventOnly', 'coopOnly', 'regattaOnly', 'museumOnly'];
  const earned = EARN_FLAGS.filter((f) => dec[f] === true);
  const ways = (dec.cost ? 1 : 0) + (dec.voucherCost ? 1 : 0) + earned.length;
  if (ways === 0) errors.push(`decoration ${id}: no cost, no voucher cost and no earn flag - unobtainable`);
  if (ways > 1) errors.push(`decoration ${id}: ${ways} ways to obtain it (${[dec.cost && 'cost', dec.voucherCost && 'voucherCost', ...earned].filter(Boolean).join(', ')}) - pick one`);
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
