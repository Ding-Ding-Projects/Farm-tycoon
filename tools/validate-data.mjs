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
// requiredSet is only worth having if every caller passes one: the four callers that passed
// null meant a house could demand expansion tools and nothing would have said a word.
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
    'fondue_pot', 'preservation_station', 'jeweler', 'yogurt_maker', 'cake_oven',
    'ice_cream_maker', 'soup_kitchen', 'flower_shop', 'sauce_maker',
    'sandwich_bar', 'taco_kitchen', 'hat_maker', 'donut_maker',
    'paper_mill', 'rubber_factory', 'candle_maker', 'smoothie_mixer'];
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
  for (const n of Object.values(d.FORAGING.nodes)) for (const y of n.yields) produced.add(y.item);
  for (const s of Object.values(d.EXPEDITIONS.sites)) for (const l of s.loot) if (l.item) produced.add(l.item);
  for (const dep of d.MINE.depths) for (const t of Object.values(dep.tools)) for (const y of t.yields) produced.add(y.item);
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

  // The earn side of the same rule. Only the spend half was ever implemented, so nine
  // materials were spendable and obtainable nowhere - which made every farm expansion and
  // every storage upgrade permanently unbuyable while the whole suite stayed green.
  // Every table that can put a material into the barn is enumerated here by hand; a count
  // that says HOW MANY materials arrive is not a source, only a pool naming WHICH ones is.
  const matEarned = new Set();
  const earn = (m) => { for (const k of Object.keys(m || {})) matEarned.add(k); };
  const earnPool = (pool) => { for (const e of pool || []) if (e.material) matEarned.add(e.material); };
  for (const m of d.TOWN.milestones) earn(m.rewards.materials);
  for (const t of d.COOP.taskPool) earn(t.rewards && t.rewards.materials);
  for (const p of d.REGATTA.rewards.placement) earn(p.materials);
  for (const s of Object.values(d.EXPEDITIONS.sites)) earnPool(s.loot);
  earnPool(d.TRAINS.materialPool);
  earnPool(d.AIRPORT.rewards.materialPool);
  earnPool(d.HELICOPTER.rewards.materialPool);
  for (const l of d.FISHING.chestLoot) if (l.material) matEarned.add(l.material);
  for (const seg of d.DAILY_WHEEL) if (seg.material) matEarned.add(seg.material);
  for (const ev of Object.values(d.EVENTS.types || {})) earn(ev.rewards && ev.rewards.materials);
  for (const mid of Object.keys(d.MATERIALS))
    if (!matEarned.has(mid)) errors.push(`material '${mid}' has no source - it can be spent but never earned`);
}

// Recipe gating: a recipe's unlockLevel must never open before its building AND never
// open before every one of its inputs is actually obtainable. A crop, animal product,
// fish, mine yield, forage find, zoo souvenir, island cargo good or merge reward has a
// real earliest level; a recipe output's own earliest level is its own unlockLevel, so
// this resolves as a fixed point over the whole crafting graph (the Feed Mill making
// otter_feed out of rice is exactly the kind of gap this exists to catch).
{
  const earliest = new Map(); // itemId -> earliest level truly obtainable
  const bump = (id, lvl) => {
    if (lvl == null || !Number.isFinite(lvl)) return;
    const cur = earliest.get(id);
    if (cur == null || lvl < cur) earliest.set(id, lvl);
  };
  for (const [cid, c] of Object.entries(d.CROPS)) bump(cid, c.unlockLevel);
  for (const a of Object.values(d.ANIMALS)) bump(a.product, a.unlockLevel);
  for (const f of d.FISHING.species) bump(f, d.FISHING.unlockLevel);
  for (const l of d.FISHING.chestLoot) if (l.item) bump(l.item, d.FISHING.unlockLevel);
  for (const dep of d.MINE.depths) for (const t of Object.values(dep.tools)) for (const y of t.yields) bump(y.item, dep.unlockLevel);
  for (const n of Object.values(d.FORAGING.nodes)) for (const y of n.yields) bump(y.item, n.unlockLevel);
  for (const z of Object.values(d.ZOO.enclosures)) bump(z.product, z.unlockLevel);
  for (const i of Object.values(d.ISLANDS.destinations)) for (const g of Object.keys(i.cargo)) bump(g, i.unlockLevel);
  for (const p of d.TRAINS.materialPool) bump(p.material, d.TRAINS.unlockLevel);
  for (const p of d.AIRPORT.rewards.materialPool) bump(p.material, d.AIRPORT.unlockLevel);
  // The daily wheel carries no unlockLevel of its own - it is live from the very first
  // login - and fishing's chest loot is gated by FISHING.unlockLevel. Both were already
  // required to be *earnable* by the matEarned check above; this is what actually lets that
  // earnability reach the fixed point below, instead of every material still bottoming out
  // at TRAINS.unlockLevel (21) regardless of how early a wheel/chest source claims to be.
  for (const seg of d.DAILY_WHEEL) if (seg.material) bump(seg.material, 1);
  for (const l of d.FISHING.chestLoot) if (l.material) bump(l.material, d.FISHING.unlockLevel);
  for (const s of Object.values(d.EXPEDITIONS.sites)) for (const l of s.loot) { if (l.material) bump(l.material, s.unlockLevel); if (l.item) bump(l.item, s.unlockLevel); }
  for (const c of Object.values(d.MERGE.chains)) {
    if (c.topReward && c.topReward.item) bump(c.topReward.item, d.MERGE.unlockLevel);
    for (const rw of Object.values(c.claims)) if (rw.item) bump(rw.item, d.MERGE.unlockLevel);
  }

  const recipeLevel = new Map();
  const resolveInputLevel = (id) => (earliest.has(id) ? earliest.get(id) : (recipeLevel.has(id) ? recipeLevel.get(id) : null));
  let changed = true, pass = 0;
  while (changed && pass < 50) {
    changed = false; pass++;
    for (const b of Object.values(d.BUILDINGS)) {
      for (const r of b.recipes) {
        let lvl = b.unlockLevel, ok = true;
        for (const iid of Object.keys(r.inputs)) {
          const il = resolveInputLevel(iid);
          if (il == null) { ok = false; break; }
          if (il > lvl) lvl = il;
        }
        if (!ok) continue;
        if (recipeLevel.get(r.id) !== lvl) { recipeLevel.set(r.id, lvl); earliest.set(r.id, lvl); changed = true; }
      }
    }
  }

  for (const [bid, b] of Object.entries(d.BUILDINGS)) {
    for (const r of b.recipes) {
      if (typeof r.unlockLevel !== 'number') { errors.push(`${bid}/${r.id}: missing unlockLevel`); continue; }
      if (r.unlockLevel < b.unlockLevel)
        errors.push(`${bid}/${r.id}: unlockLevel ${r.unlockLevel} is below its building's unlockLevel ${b.unlockLevel}`);
      const trueLevel = recipeLevel.get(r.id);
      if (trueLevel != null && r.unlockLevel < trueLevel)
        errors.push(`${bid}/${r.id}: unlockLevel ${r.unlockLevel} is below the true earliest availability ${trueLevel} of its inputs`);
    }
  }

  // The last link: a building must not unlock before its OWN kit is actually craftable.
  // The kit block above only checks that the kit is reachable in the Workshop at all and
  // that the building doesn't open before the Workshop itself does - it never asked whether
  // the Workshop could produce that specific kit yet. This is the fixed-point number that
  // answers that, and is what caught (and now guards against) dairy/sugar_mill/popcorn_pot/
  // grill/loom/juice_press/pie_oven/sewing_machine each unlocking 5-15 levels before their
  // own kit's raw materials had any source at all.
  for (const [bid, b] of Object.entries(d.BUILDINGS)) {
    if (!b.kit) continue;
    const kitLevel = recipeLevel.get(b.kit);
    if (kitLevel != null && b.unlockLevel < kitLevel)
      errors.push(`building ${bid} unlocks at ${b.unlockLevel} but its kit '${b.kit}' is not craftable until ${kitLevel} - the building would be unplaceable on unlock`);
  }
}

// Advanced-material gating: MATERIALS.<x>.set === 'advanced' is reserved for tools
// (jackhammer/drill/electric_saw) that ONLY come from Tool Exchange / expedition loot,
// never from trains or the airport - see the MATERIALS doc comment and TRAINS.materialPool.
// The whole point of that tier is that a player cannot reach it before expeditions open
// (EXPEDITIONS.unlockLevel = 57). This guard is the direct sanity check for the bug that
// prompted it: timber/wire/rope were once wrongly tagged 'advanced', which - despite every
// other guard passing - silently walled off the Building Workshop's entire early crafting
// spine for 55 levels. It re-asserts the tier's own promise independently of the recursive
// fixed-point above: any recipe that consumes an advanced material must itself be gated no
// earlier than N = EXPEDITIONS.unlockLevel, regardless of how early its owning building
// (the Workshop opens at Level 6) unlocks.
{
  const N = d.EXPEDITIONS.unlockLevel;
  for (const [bid, b] of Object.entries(d.BUILDINGS)) {
    for (const r of b.recipes) {
      const usesAdvanced = Object.keys(r.inputs).some((iid) => d.MATERIALS[iid] && d.MATERIALS[iid].set === 'advanced');
      if (usesAdvanced && r.unlockLevel < N)
        errors.push(`${bid}/${r.id}: uses an advanced-tier material but unlocks at ${r.unlockLevel}, before expeditions open at ${N} - advanced materials have no earlier source`);
    }
  }
}

// Margin: a non-sink recipe's output must sell for more than the sum of its inputs, or a
// player is strictly better off selling the raw ingredients. Recipes that are deliberate
// sinks (feed, and every Building Workshop component/kit) are tagged sink: true and are
// exempt on purpose - feed is consumed by animals, not resold, and kits exist to place a
// building, not to be flipped for coins.
{
  const sellValue = (id) => (d.CROPS[id] || d.GOODS[id] || d.MATERIALS[id])?.sellPrice;
  for (const [bid, b] of Object.entries(d.BUILDINGS)) {
    for (const r of b.recipes) {
      if (r.sink) continue;
      const out = d.GOODS[r.id];
      if (!out) continue; // already flagged above
      let inSum = 0;
      for (const [iid, qty] of Object.entries(r.inputs)) {
        const sv = sellValue(iid);
        if (sv == null) continue; // already flagged above
        inSum += sv * qty;
      }
      if (out.sellPrice <= inSum)
        errors.push(`${bid}/${r.id}: output sells for ${out.sellPrice} but inputs sell for ${inSum} - underwater and not marked sink: true`);
    }
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
  checkMaterials(`house ${id}`, h.materials, 'building');
  if (!(h.population > 0) || !(h.cost > 0) || !(h.tier >= 1)) errors.push(`house ${id}: bad population/cost/tier`);
}
for (const [id, c] of Object.entries(d.TOWN.communityBuildings)) {
  checkMaterials(`community ${id}`, c.materials, 'building');
  if (!(c.capacity > 0)) errors.push(`community ${id}: bad capacity`);
}
{
  let prev = 0;
  for (const m of d.TOWN.milestones) {
    if (m.population <= prev) errors.push('town milestones not ascending');
    prev = m.population;
    // Milestone payouts take the building set too. A reward is not a build cost, so this is
    // a deliberate choice rather than a forced one: the town pays out in the currency the
    // town spends, which keeps its loop closed and stops a milestone quietly becoming a
    // back door for expansion tools or storage parts that belong to other channels.
    checkMaterials('town milestone', m.rewards.materials, 'building');
  }
}
for (const [id, z] of Object.entries(d.ZOO.enclosures)) {
  checkMaterials(`zoo ${id}`, z.materials, 'building');
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

// Item icons. itemIcon() in src/ui.js resolves CROPS, then GOODS, then ANIMALS, then
// MATERIALS, falling back to '❔' the moment none of the four carries an `icon` field for
// that id - which is exactly what shipped, silently, until a screenshot pass caught every
// panel in the game rendering question marks. A rule alone ("every icon present is
// non-empty") passes trivially on a table with zero icons at all, so the tables itemIcon()
// can be asked about are named by hand here; a table dropped from this list would make the
// same defect ship again with a green test suite.
{
  const ICON_TABLES = [['CROPS', d.CROPS], ['ANIMALS', d.ANIMALS], ['GOODS', d.GOODS], ['MATERIALS', d.MATERIALS]];
  for (const [name, table] of ICON_TABLES) {
    if (!table || !Object.keys(table).length) { errors.push(`icon audit: table '${name}' is empty or missing - itemIcon() has nothing to resolve`); continue; }
    for (const [id, entry] of Object.entries(table))
      if (!entry.icon || typeof entry.icon !== 'string' || !entry.icon.trim())
        errors.push(`${name}.${id} has no icon - itemIcon() would render the '❔' fallback for it`);
  }
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

// Transport material pools. A pool entry must name a real material with a sane quantity band
// and a positive weight; a zero-weight entry looks like a source and can never be drawn.
for (const [label, pool] of [['TRAINS', d.TRAINS.materialPool],
                             ['AIRPORT', d.AIRPORT.rewards.materialPool],
                             ['HELICOPTER', d.HELICOPTER.rewards.materialPool]]) {
  if (!Array.isArray(pool) || pool.length === 0) { errors.push(`${label}: materialPool is missing or empty`); continue; }
  const seen = new Set();
  for (const e of pool) {
    if (!d.MATERIALS[e.material]) { errors.push(`${label} pool: unknown material '${e.material}'`); continue; }
    if (seen.has(e.material)) errors.push(`${label} pool: '${e.material}' listed twice`);
    seen.add(e.material);
    if (d.MATERIALS[e.material].set === 'advanced')
      errors.push(`${label} pool: '${e.material}' is an advanced material - those are Tool Exchange and expedition loot only`);
    if (!Array.isArray(e.qty) || !(e.qty[0] > 0) || !(e.qty[1] >= e.qty[0]))
      errors.push(`${label} pool: bad qty range for '${e.material}'`);
    if (!(e.weight > 0)) errors.push(`${label} pool: '${e.material}' has non-positive weight and can never be drawn`);
  }
}

// Nothing may unlock above maxLevel. Without this, raising content past the cap ships
// items no player can ever reach and every other check stays green - which is exactly what
// happened when crops were added at level 84 while maxLevel was still 50.
for (const [label, table] of [['crop', d.CROPS], ['animal', d.ANIMALS], ['building', d.BUILDINGS],
                              ['zoo', d.ZOO.enclosures], ['island', d.ISLANDS.destinations]])
  for (const [id, v] of Object.entries(table))
    if (v.unlockLevel > d.LEVELS.maxLevel)
      errors.push(`${label} '${id}' unlocks at ${v.unlockLevel}, above maxLevel ${d.LEVELS.maxLevel}`);

// Artifacts live in their own id namespace because they are stored in state.museum, not the
// barn. If an id collided with a good, a crop or a material, the two stores would disagree
// about what the player owns and nothing else would notice.
{
  const spaces = [['GOODS', d.GOODS], ['CROPS', d.CROPS], ['MATERIALS', d.MATERIALS], ['ARTIFACTS', d.ARTIFACTS]];
  for (let i = 0; i < spaces.length; i++)
    for (let j = i + 1; j < spaces.length; j++)
      for (const id of Object.keys(spaces[i][1]))
        if (spaces[j][1][id]) errors.push(`id '${id}' exists in both ${spaces[i][0]} and ${spaces[j][0]}`);
}

// Museum: every artifact belongs to exactly one exhibit, and every exhibit lists only real
// artifacts. Checked as a bijection in BOTH directions - a one-way check passes happily on an
// artifact that belongs to no exhibit and can therefore never be displayed.
{
  const claimed = new Map();
  for (const [eid, ex] of Object.entries(d.MUSEUM.exhibits)) {
    if (!ex.artifacts || ex.artifacts.length === 0) errors.push(`exhibit ${eid}: no artifacts`);
    for (const aid of ex.artifacts || []) {
      if (!d.ARTIFACTS[aid]) errors.push(`exhibit ${eid}: unknown artifact '${aid}'`);
      if (claimed.has(aid)) errors.push(`artifact '${aid}' is in both ${claimed.get(aid)} and ${eid}`);
      claimed.set(aid, eid);
    }
    if (ex.rewards) {
      if (ex.rewards.decoration && !d.DECORATIONS[ex.rewards.decoration])
        errors.push(`exhibit ${eid}: reward decoration '${ex.rewards.decoration}' unknown`);
      if (!(ex.rewards.coins > 0)) errors.push(`exhibit ${eid}: reward coins must be positive`);
    }
    if (!(ex.visitorBonusPerHour >= 0)) errors.push(`exhibit ${eid}: bad visitorBonusPerHour`);
  }
  for (const [aid, a] of Object.entries(d.ARTIFACTS)) {
    if (!claimed.has(aid)) errors.push(`artifact '${aid}' is in no exhibit - it can never be displayed`);
    if (!d.MUSEUM.exhibits[a.set]) errors.push(`artifact '${aid}': set '${a.set}' is not an exhibit`);
    else if (!d.MUSEUM.exhibits[a.set].artifacts.includes(aid))
      errors.push(`artifact '${aid}' claims set '${a.set}' but that exhibit does not list it`);
    if (!(a.sellPrice > 0)) errors.push(`artifact '${aid}': bad sellPrice`);
  }
}

// Expeditions: supplies are real items, and every loot entry names exactly one kind of reward.
// "Exactly one" matters - an entry with both an item and coins would pay twice or neither
// depending on which branch the collector happens to check first.
for (const [sid, s] of Object.entries(d.EXPEDITIONS.sites)) {
  for (const k of Object.keys(s.supplies || {})) if (!item(k)) errors.push(`expedition ${sid}: supply '${k}' unknown`);
  if (!(s.duration > 0)) errors.push(`expedition ${sid}: bad duration`);
  if (!(s.riskFailChance >= 0 && s.riskFailChance < 1)) errors.push(`expedition ${sid}: riskFailChance out of range`);
  if (!(s.artifactChance >= 0 && s.artifactChance <= 1)) errors.push(`expedition ${sid}: artifactChance out of range`);
  for (const l of s.loot || []) {
    const kinds = ['item', 'artifact', 'material', 'coins', 'diamonds'].filter((k) => l[k] !== undefined);
    if (kinds.length !== 1) errors.push(`expedition ${sid}: loot entry names ${kinds.length} reward kinds (${kinds.join(', ') || 'none'}), needs exactly 1`);
    if (l.item && !d.GOODS[l.item]) errors.push(`expedition ${sid}: loot item '${l.item}' unknown`);
    if (l.artifact && !d.ARTIFACTS[l.artifact]) errors.push(`expedition ${sid}: loot artifact '${l.artifact}' unknown`);
    if (l.material && !d.MATERIALS[l.material]) errors.push(`expedition ${sid}: loot material '${l.material}' unknown`);
    if (!(l.weight > 0)) errors.push(`expedition ${sid}: loot weight must be positive`);
  }
}
if (!(d.EXPEDITIONS.crewSlots > 0)) errors.push('EXPEDITIONS: crewSlots must be positive');
for (const [spid, sp] of Object.entries(d.EXPEDITIONS.specialists)) {
  if (!(sp.cost > 0) || !(sp.hireTime > 0)) errors.push(`specialist ${spid}: bad cost or hireTime`);
  const BONUS = ['artifactChance', 'speedMult', 'riskReduction', 'lootBonus'];
  for (const k of Object.keys(sp.bonus || {})) if (!BONUS.includes(k)) errors.push(`specialist ${spid}: unknown bonus '${k}'`);
}

// Neighbours: one pool, and it must actually be able to produce distinct people.
{
  const N = d.NEIGHBOURS;
  if (!(N.poolSize > 0)) errors.push('NEIGHBOURS: poolSize must be positive');
  for (const key of ['firstNames', 'lastNames', 'farmNames']) {
    if (!N[key] || N[key].length === 0) errors.push(`NEIGHBOURS: ${key} is empty`);
    else if (new Set(N[key]).size !== N[key].length) errors.push(`NEIGHBOURS: ${key} contains duplicates`);
  }
  // The pool must be namable without collisions, or two "different" neighbours share a name.
  if (N.firstNames && N.lastNames && N.firstNames.length * N.lastNames.length < N.poolSize)
    errors.push(`NEIGHBOURS: ${N.firstNames.length} x ${N.lastNames.length} name combinations cannot fill a pool of ${N.poolSize}`);
  if (!N.farmNames || N.farmNames.length < 1) errors.push('NEIGHBOURS: needs at least one farm name');
  if (!(N.levelBand[0] <= N.levelBand[1])) errors.push('NEIGHBOURS: levelBand is inverted');
  const profs = Object.entries(N.activityProfiles || {});
  if (profs.length === 0) errors.push('NEIGHBOURS: no activity profiles');
  for (const [pid, pr] of profs) {
    if (!(pr.weight > 0)) errors.push(`neighbour profile ${pid}: weight must be positive`);
    if (!(pr.scoreMult > 0)) errors.push(`neighbour profile ${pid}: scoreMult must be positive`);
    if (!(pr.fillSecondsRange[0] <= pr.fillSecondsRange[1])) errors.push(`neighbour profile ${pid}: fillSecondsRange inverted`);
  }
}

// Mine depths. The tools alias must stay identical to depths[0].tools by IDENTITY, not by
// looking similar: src/mine.js and the orphan audit both read MINE.tools, and a copy that
// drifts from what it aliases would be invisible until the two disagreed in play.
{
  if (d.MINE.tools !== d.MINE.depths[0].tools)
    errors.push('MINE.tools is no longer the same object as depths[0].tools - the alias has drifted');
  let prev = -Infinity;
  for (const dep of d.MINE.depths) {
    if (!(dep.unlockLevel > prev)) errors.push(`mine depth ${dep.id}: unlockLevel must increase (got ${dep.unlockLevel} after ${prev})`);
    prev = dep.unlockLevel;
    if (dep.requires) checkMaterials(`mine depth ${dep.id}`, dep.requires.materials);
    if (!(dep.artifactChance >= 0 && dep.artifactChance <= 1)) errors.push(`mine depth ${dep.id}: artifactChance out of range`);
    for (const aid of dep.artifactPool || []) if (!d.ARTIFACTS[aid]) errors.push(`mine depth ${dep.id}: unknown artifact '${aid}'`);
    for (const [tid, t] of Object.entries(dep.tools))
      for (const y of t.yields) {
        if (!d.GOODS[y.item]) errors.push(`mine depth ${dep.id}/${tid}: yield '${y.item}' unknown`);
        if (!(y.weight > 0)) errors.push(`mine depth ${dep.id}/${tid}: weight must be positive`);
      }
  }
  // The surface seam must stay artifact-free, or the museum opens before the player has any
  // reason to have found the mine's depths at all.
  if (d.MINE.depths[0].artifactChance !== 0) errors.push('mine depth 1 must not drop artifacts');
}

// Laboratory: a research tree that must be finishable. Acyclic is the load-bearing check -
// a cycle is not a slow tree, it is a permanently unreachable branch, and nothing else notices.
{
  const tree = d.LAB.tree;
  for (const [nid, n] of Object.entries(tree)) {
    for (const r of n.requires || []) if (!tree[r]) errors.push(`lab ${nid}: requires unknown node '${r}'`);
    for (const k of Object.keys(n.effect || {}))
      if (!d.EFFECT_KEYS.includes(k)) errors.push(`lab ${nid}: effect '${k}' is not in EFFECT_KEYS`);
    if (!(n.time > 0)) errors.push(`lab ${nid}: bad research time`);
    if (!(n.cost && n.cost.coins > 0)) errors.push(`lab ${nid}: bad cost`);
    for (const k of Object.keys((n.cost && n.cost.items) || {}))
      if (!recipeInput(k)) errors.push(`lab ${nid}: cost item '${k}' unknown`);
  }
  if (!Object.values(tree).some((n) => !n.requires || n.requires.length === 0))
    errors.push('LAB: no root node - nothing can ever be researched first');
  // Depth-first cycle detection.
  const state = new Map();
  const walk = (nid, path) => {
    if (state.get(nid) === 'done') return;
    if (state.get(nid) === 'open') { errors.push(`LAB: requires cycle ${[...path, nid].join(' -> ')}`); return; }
    state.set(nid, 'open');
    for (const r of tree[nid].requires || []) if (tree[r]) walk(r, [...path, nid]);
    state.set(nid, 'done');
  };
  for (const nid of Object.keys(tree)) walk(nid, []);
  checkMaterials('LAB buildCost', d.LAB.buildCost.materials);
}

// Helicopter tuning.
if (!(d.HELICOPTER.departureWindow < d.HELICOPTER.interval))
  errors.push('HELICOPTER: departureWindow must be shorter than interval, or a flight never leaves');
if (!(d.HELICOPTER.crates > 0) || !(d.HELICOPTER.fuel.max > 0) || !(d.HELICOPTER.fuel.regenSeconds > 0))
  errors.push('HELICOPTER: bad crate or fuel tuning');
if (!(d.HELICOPTER.rewards.materialsPerFlight[0] <= d.HELICOPTER.rewards.materialsPerFlight[1]))
  errors.push('HELICOPTER: materialsPerFlight range inverted');

// Placed structures. Every system opened by clicking the world needs a footprint and a
// position, in bounds and not overlapping another structure - otherwise two panels answer
// the same click and which one wins is down to iteration order.
{
  const N = d.FARM.gridSize;
  const list = Object.entries(d.STRUCTURES);
  for (const [sid, s] of list) {
    if (!Array.isArray(s.size) || !(s.size[0] > 0) || !(s.size[1] > 0)) errors.push(`structure ${sid}: bad size`);
    if (!s.pos || s.pos.x < 0 || s.pos.y < 0 || s.pos.x + s.size[0] > N || s.pos.y + s.size[1] > N)
      errors.push(`structure ${sid}: out of bounds for gridSize ${N}`);
    if (!s.panel) errors.push(`structure ${sid}: no panel to open - it would be a decoration, not a structure`);
    if (s.unlockLevel > d.LEVELS.maxLevel) errors.push(`structure ${sid}: unlocks at ${s.unlockLevel}, above maxLevel`);
  }
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [ai, a] = list[i], [bi, b] = list[j];
      if (a.pos.x < b.pos.x + b.size[0] && b.pos.x < a.pos.x + a.size[0] &&
          a.pos.y < b.pos.y + b.size[1] && b.pos.y < a.pos.y + a.size[1])
        errors.push(`structure ${ai} overlaps ${bi}`);
    }
  const panels = list.map(([, s]) => s.panel);
  if (new Set(panels).size !== panels.length) errors.push('STRUCTURES: two structures open the same panel');

  // A structure must stand on land the player can actually own by the time it opens.
  // Every footprint sits ENTIRELY inside one zone - the start zone or a single expansion -
  // and that zone must unlock at or before the structure does. Straddling two zones is its
  // own failure: half a building on unbought land is not a thing that can be clicked.
  // Expansion unlock levels come from LEVELS.unlocks, which is what actually grants them,
  // rather than from a second hand-maintained list that would drift.
  const zoneLevel = new Map([['startZone', 1]]);
  for (const [lvl, ids] of Object.entries(d.LEVELS.unlocks))
    for (const id of ids) if (id.startsWith('expansion_')) zoneLevel.set(id, +lvl);
  const zones = [{ id: 'startZone', r: d.FARM.startZone }, ...d.FARM.expansions.map((e) => ({ id: e.id, r: e.rect }))];
  for (const z of zones) if (!zoneLevel.has(z.id)) errors.push(`zone '${z.id}' is granted by no level in LEVELS.unlocks`);
  for (const [sid, s] of list) {
    const box = { x: s.pos.x, y: s.pos.y, w: s.size[0], h: s.size[1] };
    const host = zones.find((z) => box.x >= z.r.x && box.y >= z.r.y &&
                                   box.x + box.w <= z.r.x + z.r.w && box.y + box.h <= z.r.y + z.r.h);
    if (!host) { errors.push(`structure ${sid}: no single zone contains it - it straddles unowned land`); continue; }
    const need = zoneLevel.get(host.id) || 0;
    if (need > s.unlockLevel)
      errors.push(`structure ${sid} opens at level ${s.unlockLevel} but stands in ${host.id}, which the player cannot own until level ${need}`);
  }
}

// Foraging. Free pickups, so the only thing that can go wrong is a node that yields something
// unreal, never respawns, or can stack without bound while the player is away.
for (const [nid, n] of Object.entries(d.FORAGING.nodes)) {
  if (!(n.respawn > 0)) errors.push(`forage node ${nid}: respawn must be positive or it never returns`);
  if (!(n.maxActive > 0)) errors.push(`forage node ${nid}: maxActive must be positive`);
  if (!n.yields || n.yields.length === 0) errors.push(`forage node ${nid}: yields nothing`);
  for (const y of n.yields || []) {
    if (!item(y.item)) errors.push(`forage node ${nid}: yield '${y.item}' unknown`);
    if (!(y.weight > 0)) errors.push(`forage node ${nid}: yield weight must be positive`);
    if (!(y.qty[0] > 0) || !(y.qty[0] <= y.qty[1])) errors.push(`forage node ${nid}: bad qty range for '${y.item}'`);
  }
}
if (!(d.FORAGING.offlineRespawnCap > 0))
  errors.push('FORAGING: offlineRespawnCap must be positive, or a fortnight away carpets the farm');
{
  const totalActive = Object.values(d.FORAGING.nodes).reduce((s, n) => s + n.maxActive, 0);
  if (d.FORAGING.globalMaxActive > totalActive)
    errors.push(`FORAGING: globalMaxActive ${d.FORAGING.globalMaxActive} exceeds the ${totalActive} the nodes can ever produce`);
}

// Newspaper. The bargain band must actually be a bargain - if it overlaps the ordinary price
// band, "bargain" is a label on a normal price and the player learns to distrust the flag.
{
  const N = d.NEWSPAPER;
  if (!(N.priceBand[0] > 0 && N.priceBand[0] < N.priceBand[1])) errors.push('NEWSPAPER: priceBand invalid');
  if (!(N.bargainBand[0] > 0 && N.bargainBand[0] < N.bargainBand[1])) errors.push('NEWSPAPER: bargainBand invalid');
  if (!(N.bargainBand[1] < N.priceBand[0]))
    errors.push(`NEWSPAPER: bargains top out at ${N.bargainBand[1]} but ordinary prices start at ${N.priceBand[0]} - a bargain must be cheaper than any ordinary price`);
  if (!(N.bargainChance > 0 && N.bargainChance < 1)) errors.push('NEWSPAPER: bargainChance out of range');
  if (!(N.listingsPerFarm[0] <= N.listingsPerFarm[1])) errors.push('NEWSPAPER: listingsPerFarm inverted');
  if (!(N.farmsPerIssue > 0) || N.farmsPerIssue > d.NEIGHBOURS.poolSize)
    errors.push(`NEWSPAPER: ${N.farmsPerIssue} farms per issue cannot come from a pool of ${d.NEIGHBOURS.poolSize}`);
}

// Collections. Entries are derived from the live tables, so the real risk is a book whose
// source derives NOTHING - it would render as an empty page with no error anywhere.
{
  const SOURCES = {
    crops:     () => Object.keys(d.CROPS),
    recipes:   () => Object.values(d.BUILDINGS).flatMap((b) => b.recipes.map((r) => r.id)),
    fish:      () => d.FISHING.species,
    forage:    () => [...new Set(Object.values(d.FORAGING.nodes).flatMap((n) => n.yields.map((y) => y.item)))],
    artifacts: () => Object.keys(d.ARTIFACTS),
  };
  for (const [bid, b] of Object.entries(d.COLLECTIONS.books)) {
    const derive = SOURCES[b.source];
    if (!derive) { errors.push(`collection ${bid}: unknown source '${b.source}'`); continue; }
    const entries = derive();
    if (entries.length === 0) errors.push(`collection ${bid}: source '${b.source}' derives zero entries - the book would be empty`);
    if (!(b.rewardPer > 0)) errors.push(`collection ${bid}: rewardPer must be positive`);
    if (b.rewardPer > entries.length)
      errors.push(`collection ${bid}: rewards every ${b.rewardPer} entries but the source only has ${entries.length} - the first reward is unreachable`);
    if (!(b.reward && b.reward.coins > 0)) errors.push(`collection ${bid}: bad reward`);
  }
}

// Mastery.
{
  if (!d.EFFECT_KEYS.includes(d.MASTERY.effect)) errors.push(`MASTERY: effect '${d.MASTERY.effect}' is not in EFFECT_KEYS`);
  let makes = 0, bonus = Infinity;
  for (const t of d.MASTERY.tiers) {
    if (!(t.makes > makes)) errors.push(`mastery star ${t.star}: makes must ascend`);
    makes = t.makes;
    // productionTimeMult is a multiplier below 1, so a stronger tier is a SMALLER number.
    if (!(t.bonus < bonus)) errors.push(`mastery star ${t.star}: bonus must improve with each tier`);
    bonus = t.bonus;
  }
}

// Photo frames and decorating limits.
if (!d.PHOTO.frames || d.PHOTO.frames.length === 0) errors.push('PHOTO: no frames');
if (new Set(d.PHOTO.frames).size !== d.PHOTO.frames.length) errors.push('PHOTO: duplicate frame ids');
if (!(d.DECORATE.undoDepth > 0)) errors.push('DECORATE: undoDepth must be positive');
if (!(d.DECORATE.rotations > 0)) errors.push('DECORATE: rotations must be positive');

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
  // new counters for the expansion subsystems
  'coopHelps', 'coopTasksDone', 'requestsFilled', 'regattaPoints', 'regattaTasks',
  'trainsCompleted', 'planesCompleted', 'helicopterFlights', 'materialsEarned',
  'expeditionsCompleted', 'artifactsFound', 'exhibitsCompleted', 'researchCompleted',
  'zooSouvenirs', 'foraged', 'componentsCrafted',
]);

// Co-op and regatta task pools.
{
  const checkPool = (label, pool, minSize) => {
    const ids = new Set();
    for (const t of pool) {
      if (!STAT_KEYS.has(t.stat)) errors.push(`${label} ${t.id}: unknown stat '${t.stat}'`);
      if (!(t.target > 0) || !(t.points > 0)) errors.push(`${label} ${t.id}: bad target or points`);
      if (ids.has(t.id)) errors.push(`${label}: duplicate task id '${t.id}'`);
      ids.add(t.id);
    }
    if (pool.length < minSize) errors.push(`${label}: pool of ${pool.length} cannot fill ${minSize} slots`);
  };
  checkPool('coop task', d.COOP.taskPool, d.COOP.dailyTasks.count);
  checkPool('regatta task', d.REGATTA.taskPool, d.REGATTA.taskSlots);

  const ELIGIBLE = ['crops', 'goods', 'materials'];
  for (const e of d.COOP.requestBoard.eligible) if (!ELIGIBLE.includes(e)) errors.push(`COOP requestBoard: unknown eligible class '${e}'`);
  let pp = -Infinity;
  for (const perk of d.COOP.perks) {
    if (!(perk.points > pp)) errors.push(`coop perk ${perk.id}: points must ascend`);
    pp = perk.points;
    for (const k of Object.keys(perk.effect || {}))
      if (!d.EFFECT_KEYS.includes(k)) errors.push(`coop perk ${perk.id}: effect '${k}' is not in EFFECT_KEYS`);
  }
  let ml = -Infinity;
  for (const lg of d.REGATTA.leagues) {
    if (!(lg.minSeasonsWon > ml)) errors.push(`regatta league ${lg.id}: minSeasonsWon must ascend`);
    ml = lg.minSeasonsWon;
  }
  for (let i = 1; i < d.REGATTA.pointsGoal.length; i++)
    if (!(d.REGATTA.pointsGoal[i] > d.REGATTA.pointsGoal[i - 1])) errors.push('REGATTA: pointsGoal must ascend');
  if (d.REGATTA.rewards.placement.length !== d.REGATTA.laneCount)
    errors.push(`REGATTA: ${d.REGATTA.rewards.placement.length} placement rewards for ${d.REGATTA.laneCount} lanes`);
  let pc = Infinity;
  for (const pl of d.REGATTA.rewards.placement) {
    if (!(pl.coins <= pc)) errors.push(`regatta placement ${pl.place}: coins must not increase down the table`);
    pc = pl.coins;
    checkMaterials(`regatta placement ${pl.place}`, pl.materials);
    if (pl.decoration && !d.DECORATIONS[pl.decoration]) errors.push(`regatta placement ${pl.place}: unknown decoration '${pl.decoration}'`);
  }
}

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

// The playable share, printed on every run rather than asserted.
//
// The stated design target is roughly one recipe in three being playable. It is NOT there yet,
// and a number that is quietly wrong is worse than one that is loudly wrong: printing it means
// the gap cannot drift out of sight, and means nobody has to re-derive it by hand to find out.
// It is not a hard failure because the shortfall is missing CONTENT, not a broken invariant -
// failing the build over it would block every unrelated change until the content lands.
{
  let eligible = 0;
  let playable = 0;
  for (const b of Object.values(d.BUILDINGS)) {
    for (const r of b.recipes) {
      if (r.sink) continue;
      eligible += 1;
      if (r.play) playable += 1;
    }
  }
  const share = playable === 0 ? Infinity : eligible / playable;
  const verbs = Object.keys(d.VERBS).length;
  const onTarget = share <= 3.5;
  console.log(
    `playable share: ${playable}/${eligible} recipes (1 in ${share.toFixed(1)}), ${verbs} verbs` +
    (onTarget ? ' - at the 1-in-3 target' : ` - TARGET IS 1 IN 3, short by ${Math.ceil(eligible / 3) - playable} recipes`)
  );
}
