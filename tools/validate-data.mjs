// validate-data.mjs — integrity checks for src/data.js. Run via `npm test`.
// Fails (exit 1) if any content id doesn't resolve or invariants are broken.

import * as d from '../src/data.js';

const errors = [];
const item = (id) => d.CROPS[id] || d.GOODS[id];

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

// LEVELS.unlocks ids resolve to known content or feature flags.
const features = new Set([
  'field', 'orders_board', 'truck', 'boat', 'fishing', 'mine', 'pets', 'merge_meadow',
  'silo_mega_upgrade', 'barn_mega_upgrade', 'golden_fields', 'master_orders', 'golden_windmill',
]);
const known = (id) => d.CROPS[id] || d.ANIMALS[id] || d.BUILDINGS[id] || features.has(id) || d.FARM.expansions.some((e) => e.id === id);
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
for (const [id, dec] of Object.entries(d.DECORATIONS)) if (!dec.cost && !dec.voucherCost) errors.push(`decoration ${id}: no cost`);

if (errors.length) {
  console.error(`data.js validation FAILED (${errors.length}):\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log(
  `data.js OK — ${Object.keys(d.CROPS).length} crops, ${Object.keys(d.ANIMALS).length} animals, ` +
  `${Object.keys(d.BUILDINGS).length} buildings, ${Object.values(d.BUILDINGS).reduce((n, b) => n + b.recipes.length, 0)} recipes, ` +
  `${Object.keys(d.GOODS).length} goods, ${Object.keys(d.MERGE.chains).length} merge chains, ${d.ACHIEVEMENTS.length} achievements, ` +
  `${d.LEVELS.maxLevel} levels all with unlocks`
);
