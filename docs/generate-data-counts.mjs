#!/usr/bin/env node
// generate-data-counts.mjs — regenerates docs/content/data-counts.js from src/data.js.
//
// Why this exists: GitHub Pages serves docs/ only, so the published site cannot reach
// ../src/data.js the way the game and tools/validate-data.mjs do (both live at the repo
// root, one level above src/). The site used to work around that by having a person type
// the current content counts into article prose by hand. That drifts the moment content is
// added anywhere else in the repository, and it drifted silently — the numbers looked fine,
// they just described a version of the game that no longer existed.
//
// The fix is this file: it is the ONE place that computes a content count from the real
// data tables, and every article imports the result from ../content/data-counts.js instead
// of writing a number into prose. Since the site has no build step, "importing the result"
// means importing a committed, generated module — so this script has to be re-run and its
// output re-committed whenever src/data.js changes shape. docs/verify-data-counts.mjs is the
// guard that fails the build when someone forgets.
//
// Run: node docs/generate-data-counts.mjs
// Then: node docs/verify-data-counts.mjs   (should print OK)
//
// This script is a maintainer-time tool. It is never imported by the site itself, never
// referenced from index.html or app.js, and makes no network request.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const dataPath = join(repoRoot, 'src', 'data.js');
// The guard (verify-data-counts.mjs) reruns this exact script with the output redirected to
// a scratch file, so it can diff a freshly generated result against the committed one without
// touching the working tree. Everything else about the run — which src/data.js it reads, how
// it computes COUNTS — is identical to an ordinary regeneration.
const outPath = process.env.FARM_TYCOON_DOC_COUNTS_OUT || join(here, 'content', 'data-counts.js');

const d = await import('../src/data.js');

const sum = (arr, fn) => arr.reduce((n, x) => n + fn(x), 0);
const money = (n) => n.toLocaleString('en-US');

// "N tables" counts the top-level `export const` bindings in data.js, i.e. the number of
// content tables the module actually exports. Counted from the source text rather than from
// `Object.keys(d)` so a helper function export (there is exactly one, `qualityTier`) never
// gets counted as a "table".
const dataSource = readFileSync(dataPath, 'utf8');
const dataTables = (dataSource.match(/^export const \w+/gm) || []).length;

// ---------------------------------------------------------------------------------------
// Decorations, broken down by the route the validator requires every one of them to have.
// ---------------------------------------------------------------------------------------
const decos = Object.values(d.DECORATIONS);
const decorationsCoinAlways = decos.filter((x) => x.cost != null && !x.holiday).length;
const decorationsCoinSeasonal = decos.filter((x) => x.cost != null && x.holiday).length;
const decorationsVoucher = decos.filter((x) => x.voucherCost != null).length;
const decorationsEventOnly = decos.filter((x) => x.eventOnly).length;
const decorationsSubsystem = decos.filter((x) => x.coopOnly || x.regattaOnly || x.museumOnly).length;

// ---------------------------------------------------------------------------------------
// The museum: totals across all six (currently) exhibits.
// ---------------------------------------------------------------------------------------
const exhibits = Object.values(d.MUSEUM.exhibits);
const museumCoinsTotal = sum(exhibits, (e) => (e.rewards && e.rewards.coins) || 0);
const museumDiamondsTotal = sum(exhibits, (e) => (e.rewards && e.rewards.diamonds) || 0);
const museumIncomeTotal = sum(exhibits, (e) => e.visitorBonusPerHour || 0);

// ---------------------------------------------------------------------------------------
// The Building Workshop: it is an ordinary BUILDINGS entry, so its own stats are read the
// same way any building's would be.
// ---------------------------------------------------------------------------------------
const workshop = d.BUILDINGS.build_workshop;
const kitBuildings = Object.values(d.BUILDINGS).filter((b) => b.kit).length;

// ---------------------------------------------------------------------------------------
// The full per-building table (farming.js's "All N buildings"). This used to be typed by
// hand, row by row, and it silently fell five buildings behind when content landed elsewhere
// in the repository -- the table listed 26 rows while data.js had grown to 31. Generating the
// rows here means a new building appears in the article the next time this script runs,
// with no second place anyone has to remember to update.
const minigamesByBuilding = {};
for (const [mid, m] of Object.entries(d.MINIGAMES)) minigamesByBuilding[m.building] = { id: mid, ...m };
const buildingsTable = Object.entries(d.BUILDINGS)
  .map(([id, b]) => {
    const mg = minigamesByBuilding[id];
    return {
      id,
      name: b.name,
      level: b.unlockLevel,
      cost: money(b.cost),
      kit: b.kit ? `<code>${b.kit}</code>` : 'coins only',
      slots: b.queueSlots,
      recipes: b.recipes.length,
      minigame: mg ? mg.name : '—',
      effect: mg ? `<code>${mg.effect}</code>` : '—',
      maxBonus: mg ? `+${Math.round(mg.cap * 100)}%` : '—',
    };
  })
  .sort((a, b) => a.level - b.level);

// ---------------------------------------------------------------------------------------
// The full per-minigame table (crafting.js's "All N per-factory minigames"). Same failure
// mode as the buildings table above: hand-typed rows silently fell behind when five new
// production buildings -- and their five minigames -- landed elsewhere in the repository.
// Ordered to match MINIGAMES' own declaration order in data.js, exactly as the original
// hand-typed table happened to be.
const minigamesTable = Object.entries(d.MINIGAMES).map(([id, m]) => ({
  id,
  name: m.name,
  factory: d.BUILDINGS[m.building].name,
  effect: m.effect,
  capPercent: Math.round(m.cap * 100),
  purpose: m.purpose,
}));

// ---------------------------------------------------------------------------------------
// The full kit table (crafting.js's "The N kits"). A third instance of the same defect as
// the buildings and minigames tables: 23 hand-typed rows, 28 real kits once the five new
// buildings landed. Ordered by building unlock level, matching the original table's order.
const formatDuration = (seconds) => {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};
const itemName = (id) => (d.GOODS[id] || d.MATERIALS[id] || d.CROPS[id])?.name || id;
const kitsTable = Object.entries(d.BUILDINGS)
  .filter(([, b]) => b.kit)
  .map(([, b]) => {
    const kitRecipe = d.BUILDINGS.build_workshop.recipes.find((r) => r.id === b.kit);
    return {
      kitName: d.GOODS[b.kit].name,
      building: b.name,
      buildingLevel: b.unlockLevel,
      kitLevel: kitRecipe.unlockLevel,
      inputs: Object.entries(kitRecipe.inputs)
        .map(([iid, qty]) => `${qty} ${itemName(iid)}`)
        .join(' + '),
      craftTime: formatDuration(kitRecipe.time),
      xp: kitRecipe.xp,
      coinCost: b.cost,
    };
  })
  .sort((a, b) => a.buildingLevel - b.buildingLevel);

// ---------------------------------------------------------------------------------------
// The town: total bill for one of every house and one of every community building.
// ---------------------------------------------------------------------------------------
const townMaterialTotals = {};
let townHousesCoinsTotal = 0;
let townCommunityCoinsTotal = 0;
for (const h of Object.values(d.TOWN.houses)) {
  townHousesCoinsTotal += h.cost || 0;
  for (const [m, q] of Object.entries(h.materials || {})) townMaterialTotals[m] = (townMaterialTotals[m] || 0) + q;
}
for (const c of Object.values(d.TOWN.communityBuildings)) {
  townCommunityCoinsTotal += c.cost || 0;
  for (const [m, q] of Object.entries(c.materials || {})) townMaterialTotals[m] = (townMaterialTotals[m] || 0) + q;
}
const townCombinedCoinsTotal = townHousesCoinsTotal + townCommunityCoinsTotal;
const townCombinedMaterialsTotal = Object.values(townMaterialTotals).reduce((n, q) => n + q, 0);
const townBuildingMaterialsDistinct = Object.keys(townMaterialTotals).length;
const townMaterialBreakdown = Object.entries(townMaterialTotals)
  .sort((a, b) => b[1] - a[1])
  .map(([id, qty]) => `${d.MATERIALS[id].name} ×${qty}`)
  .join(', ');
// Community buildings raise the population CAP (their `capacity` field); they do not add
// population themselves. Only houses do, so "one of everything" population is a houses-only
// sum — that is what the article means by it, and what the game computes too.
const townPopulationTotal = sum(Object.values(d.TOWN.houses), (h) => h.population || 0);
const townFinalPopulationTarget = d.TOWN.milestones[d.TOWN.milestones.length - 1].population;

// ---------------------------------------------------------------------------------------
// The zoo: same shape of total-bill arithmetic as the town, over ZOO.enclosures.
// ---------------------------------------------------------------------------------------
const zooMaterialTotals = {};
let zooCoinsTotal = 0;
for (const z of Object.values(d.ZOO.enclosures)) {
  zooCoinsTotal += z.cost || 0;
  for (const [m, q] of Object.entries(z.materials || {})) zooMaterialTotals[m] = (zooMaterialTotals[m] || 0) + q;
}
const zooMaterialsTotal = Object.values(zooMaterialTotals).reduce((n, q) => n + q, 0);
const zooMaterialBreakdown = Object.entries(zooMaterialTotals)
  .sort((a, b) => b[1] - a[1])
  .map(([id, qty]) => `${d.MATERIALS[id].name} ×${qty}`)
  .join(', ');
const zooLevels = Object.values(d.ZOO.enclosures).map((z) => z.unlockLevel);

const cafe = d.BUILDINGS.tropical_cafe;

const fishAll = d.ACHIEVEMENTS.find((a) => a.id === 'fish_all');

// ---------------------------------------------------------------------------------------
// Recipe economics: the sink/underwater analysis farming.js walks through. A non-sink
// recipe should never sell for less than its raw inputs -- tools/validate-data.mjs enforces
// that for non-sink recipes directly. This mirrors the same arithmetic across EVERY recipe,
// sink or not, because the article's point is about which recipes are deliberately allowed
// to be underwater (feed, and Workshop components/kits) and which are not.
const sellValue = (id) => (d.CROPS[id] || d.GOODS[id] || d.MATERIALS[id])?.sellPrice;
let recipesTotalAll = 0;
let recipesSinkTotal = 0;
let recipesSinkFeedMill = 0;
let recipesSinkWorkshop = 0;
let recipesUnderwaterTotal = 0;
let recipesUnderwaterUnmarkedSink = 0;
const recipesSinkNonUnderwaterNames = [];
const nonSinkUplifts = [];
for (const [bid, b] of Object.entries(d.BUILDINGS)) {
  for (const r of b.recipes) {
    recipesTotalAll++;
    const out = d.GOODS[r.id];
    let inSum = 0;
    for (const [iid, qty] of Object.entries(r.inputs)) {
      const sv = sellValue(iid);
      if (sv == null) continue;
      inSum += sv * qty;
    }
    if (r.sink) {
      recipesSinkTotal++;
      if (bid === 'feed_mill') recipesSinkFeedMill++;
      if (bid === 'build_workshop') recipesSinkWorkshop++;
    }
    if (!out) continue;
    const underwater = out.sellPrice <= inSum;
    if (underwater) {
      recipesUnderwaterTotal++;
      if (!r.sink) recipesUnderwaterUnmarkedSink++;
    } else if (r.sink) {
      recipesSinkNonUnderwaterNames.push(out.name);
    }
    if (!r.sink && inSum > 0) nonSinkUplifts.push(out.sellPrice / inSum);
  }
}
const recipesNonSinkTotal = recipesTotalAll - recipesSinkTotal;
nonSinkUplifts.sort((a, b) => a - b);
const mid = nonSinkUplifts.length / 2;
const recipesNonSinkMedianUplift = nonSinkUplifts.length % 2
  ? nonSinkUplifts[Math.floor(mid)]
  : (nonSinkUplifts[mid - 1] + nonSinkUplifts[mid]) / 2;


// ---------------------------------------------------------------------------------------
// Assemble. Every field here is either a table length, a sum over a table, or a single
// declared config value (tasksPerFair, startDiamonds, ...) — never a hand-typed guess.
// ---------------------------------------------------------------------------------------
const COUNTS = {
  // The validate-data.mjs census line, field for field.
  crops: Object.keys(d.CROPS).length,
  animals: Object.keys(d.ANIMALS).length,
  buildings: Object.keys(d.BUILDINGS).length,
  recipes: sum(Object.values(d.BUILDINGS), (b) => b.recipes.length),
  goods: Object.keys(d.GOODS).length,
  mergeChains: Object.keys(d.MERGE.chains).length,
  achievements: d.ACHIEVEMENTS.length,
  achievementDiamondsTotal: sum(d.ACHIEVEMENTS, (a) => a.diamonds),
  maxLevel: d.LEVELS.maxLevel,
  weekendEvents: d.EVENTS.weekend.rotation.length,
  miniEvents: d.EVENTS.miniWeekday.rotation.length,
  fairTasks: d.EVENTS.fair.taskPool.length,
  holidays: d.EVENTS.holidays.length,
  townHouses: Object.keys(d.TOWN.houses).length,
  townCommunity: Object.keys(d.TOWN.communityBuildings).length,
  zooEnclosures: Object.keys(d.ZOO.enclosures).length,
  islands: Object.keys(d.ISLANDS.destinations).length,
  materials: Object.keys(d.MATERIALS).length,

  // Structural.
  dataTables,

  // Decorations.
  decorations: decos.length,
  decorationsCoinAlways,
  decorationsCoinSeasonal,
  decorationsVoucher,
  decorationsEventOnly,
  decorationsSubsystem,

  // Fishing / achievements cross-reference.
  fishSpecies: d.FISHING.species.length,
  fishAllAchievementTarget: fishAll.target,

  // Exploration systems.
  artifacts: Object.keys(d.ARTIFACTS).length,
  museumExhibits: exhibits.length,
  museumCoinsTotal,
  museumDiamondsTotal,
  museumIncomeTotal,
  researchNodes: Object.keys(d.LAB.tree).length,
  researchBranches: new Set(Object.values(d.LAB.tree).map((n) => n.name.replace(/\s+[IVX]+$/, ''))).size,
  expeditionSites: Object.keys(d.EXPEDITIONS.sites).length,
  mineDepths: d.MINE.depths.length,
  collectionsBooks: Object.keys(d.COLLECTIONS.books).length,
  minigames: Object.keys(d.MINIGAMES).length,

  // Building Workshop.
  workshopRecipes: workshop.recipes.length,
  workshopUnlockLevel: workshop.unlockLevel,
  workshopCost: workshop.cost,
  workshopQueueSlots: workshop.queueSlots,
  workshopSize: `${workshop.size[0]}×${workshop.size[1]}`,
  kitBuildings,

  // Progression.
  startDiamonds: d.NEW_GAME.diamonds,

  // The Farm Fair.
  fairTasksPerFair: d.EVENTS.fair.tasksPerFair,
  fairTasksToComplete: d.EVENTS.fair.tasksToComplete,

  // Township: the town's own materials bill.
  townBuildingMaterialsDistinct,
  townHousesCoinsTotal,
  townCommunityCoinsTotal,
  townCombinedCoinsTotal,
  townCombinedMaterialsTotal,
  townMaterialBreakdown,
  townPopulationTotal,
  townMilestones: d.TOWN.milestones.length,
  townFinalPopulationTarget,

  // Township: the zoo's own materials bill.
  zooCoinsTotal,
  zooMaterialsTotal,
  zooMaterialBreakdown,
  zooLevelMin: Math.min(...zooLevels),
  zooLevelMax: Math.max(...zooLevels),

  // The Tropical Café, the one building every island voyage exists to feed.
  cafeRecipes: cafe.recipes.length,
  cafeUnlockLevel: cafe.unlockLevel,

  // Recipe economics (the sink / underwater analysis in farming.js).
  recipesSinkTotal,
  recipesSinkFeedMill,
  recipesSinkWorkshop,
  recipesUnderwaterTotal,
  recipesUnderwaterUnmarkedSink,
  recipesSinkNonUnderwaterCount: recipesSinkNonUnderwaterNames.length,
  recipesSinkNonUnderwaterNames: recipesSinkNonUnderwaterNames.join(' and '),
  recipesNonSinkTotal,
  recipesNonSinkMedianUplift: Math.round(recipesNonSinkMedianUplift * 100) / 100,

  // Storage.
  siloBaseCapacity: d.STORAGE.silo.baseCapacity,
  barnBaseCapacity: d.STORAGE.barn.baseCapacity,

  // The Farm Fair.
  fairUnlockLevel: d.EVENTS.fair.unlockLevel,

  // Decorating mode.
  decorateUndoDepth: d.DECORATE.undoDepth,
  decorateMultiSelectMax: d.DECORATE.multiSelectMax,

  // The museum.
  museumUnlockLevel: d.MUSEUM.unlockLevel,

  // The laboratory.
  labUnlockLevel: d.LAB.unlockLevel,
  labSlots: d.LAB.slots,
  labBuildCoins: d.LAB.buildCost.coins,
  labTotalCoinsWithBuild:
    sum(Object.values(d.LAB.tree), (n) => n.cost.coins) + d.LAB.buildCost.coins,
  labTotalResearchDays:
    Math.round((sum(Object.values(d.LAB.tree), (n) => n.time) / 3600 / 24) * 10) / 10,
  labBuildMaterials: Object.entries(d.LAB.buildCost.materials)
    .map(([id, qty], i, arr) => {
      const word = `${qty} ${d.MATERIALS[id].name.toLowerCase()}`;
      return i === arr.length - 1 && arr.length > 1 ? `and ${word}` : word;
    })
    .join(', ')
    .replace(/, (and [^,]+)$/, ' $1'),

  // The train material pool, and how much of its weight the town's own building set claims.
  trainPoolMaterials: d.TRAINS.materialPool.length,
  // Effect keys, and the split between per-minigame keys and shared research/system keys.
  effectKeysTotal: d.EFFECT_KEYS.length,
  effectKeysShared: d.EFFECT_KEYS.length - Object.keys(d.MINIGAMES).length,
  workshopComponents: workshop.recipes.filter((r) => !r.id.startsWith('kit_')).length,
  structures: Object.keys(d.STRUCTURES).length,
  kitsAtWorkshopLevel: kitsTable.filter((k) => k.kitLevel === workshop.unlockLevel).length,
  kitsAtTrainLevel: kitsTable.filter((k) => k.kitLevel === d.TRAINS.unlockLevel).length,
  kitsAdvancedCount: kitsTable.length -
    kitsTable.filter((k) => k.kitLevel === workshop.unlockLevel).length -
    kitsTable.filter((k) => k.kitLevel === d.TRAINS.unlockLevel).length,

  trainPoolTownSharePercent: (() => {
    const townMatIds = new Set(Object.keys(townMaterialTotals));
    let total = 0;
    let town = 0;
    for (const e of d.TRAINS.materialPool) {
      total += e.weight;
      if (townMatIds.has(e.material)) town += e.weight;
    }
    return Math.round((1000 * town) / total) / 10;
  })(),
};

// A couple of pre-formatted strings, computed here rather than re-derived by every article
// that wants them, so the exact wording of the validator's own summary line lives in one
// place. This is deliberately the same sentence tools/validate-data.mjs prints, built from
// the same COUNTS fields above rather than quoted from a snapshot of its output.
const censusLine =
  `${COUNTS.crops} crops, ${COUNTS.animals} animals, ${COUNTS.buildings} buildings, ` +
  `${COUNTS.recipes} recipes, ${COUNTS.goods} goods, ${COUNTS.mergeChains} merge chains, ` +
  `${COUNTS.achievements} achievements, ${COUNTS.maxLevel} levels all with unlocks, ` +
  `${COUNTS.weekendEvents} weekend events + ${COUNTS.miniEvents} mini-events + ` +
  `${COUNTS.fairTasks} fair tasks + ${COUNTS.holidays} holidays, ` +
  `town: ${COUNTS.townHouses} houses + ${COUNTS.townCommunity} community, ` +
  `${COUNTS.zooEnclosures} zoo enclosures, ${COUNTS.islands} islands, ${COUNTS.materials} materials`;

const fmt = {
  townHousesCoinsTotal: money(COUNTS.townHousesCoinsTotal),
  townCommunityCoinsTotal: money(COUNTS.townCommunityCoinsTotal),
  townCombinedCoinsTotal: money(COUNTS.townCombinedCoinsTotal),
  museumCoinsTotal: money(COUNTS.museumCoinsTotal),
  zooCoinsTotal: money(COUNTS.zooCoinsTotal),
};

const out = `/* ============================================================================
 * GENERATED FILE — do not hand-edit.
 *
 * Produced by \`node docs/generate-data-counts.mjs\` from src/data.js. Every number an
 * article quotes about "how much content the game has" should come from here rather than
 * being typed into prose, because a typed number goes stale the moment content is added
 * anywhere else in the repository and nothing says so.
 *
 * After changing src/data.js, regenerate this file and re-run the guard:
 *
 *   node docs/generate-data-counts.mjs
 *   node docs/verify-data-counts.mjs
 *
 * The guard fails the moment this file disagrees with src/data.js, so an article that
 * imports COUNTS can never describe a version of the game that no longer exists — as long
 * as this file is regenerated. Nothing regenerates it automatically; that is why the guard
 * exists at all.
 * ==========================================================================*/

export const COUNTS = Object.freeze(${JSON.stringify(COUNTS, null, 2)});

/** The exact sentence tools/validate-data.mjs prints after "data.js OK — ", rebuilt from
 *  COUNTS above instead of quoted from a snapshot of that command's output. */
export const CENSUS_LINE = ${JSON.stringify(censusLine)};

/** A few totals pre-formatted with thousands separators, for articles that quote coin sums. */
export const FMT = Object.freeze(${JSON.stringify(fmt, null, 2)});

/** Every production building, one row per entry, sorted by unlock level — the data behind
 *  farming.js's "All N buildings" table. Rendered by the article, not baked into HTML here,
 *  so the article keeps ownership of markup and this file stays pure data. */
export const BUILDINGS_TABLE = Object.freeze(${JSON.stringify(buildingsTable, null, 2)});

/** Every per-factory minigame, one row per entry, in MINIGAMES' own declaration order --
 *  the data behind crafting.js's "All N per-factory minigames" table. */
export const MINIGAMES_TABLE = Object.freeze(${JSON.stringify(minigamesTable, null, 2)});

/** Every kit -- one row per kit-requiring building, sorted by that building's unlock level --
 *  the data behind crafting.js's "The N kits" table. */
export const KITS_TABLE = Object.freeze(${JSON.stringify(kitsTable, null, 2)});
`;

writeFileSync(outPath, out, 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`data.js OK — ${censusLine}`);
