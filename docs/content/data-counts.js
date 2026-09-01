/* ============================================================================
 * GENERATED FILE — do not hand-edit.
 *
 * Produced by `node docs/generate-data-counts.mjs` from src/data.js. Every number an
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

export const COUNTS = Object.freeze({
  "crops": 22,
  "animals": 12,
  "buildings": 31,
  "recipes": 150,
  "goods": 214,
  "mergeChains": 3,
  "achievements": 39,
  "achievementDiamondsTotal": 497,
  "maxLevel": 95,
  "weekendEvents": 10,
  "miniEvents": 6,
  "fairTasks": 25,
  "holidays": 6,
  "townHouses": 16,
  "townCommunity": 10,
  "zooEnclosures": 14,
  "islands": 8,
  "materials": 23,
  "dataTables": 46,
  "decorations": 54,
  "decorationsCoinAlways": 24,
  "decorationsCoinSeasonal": 7,
  "decorationsVoucher": 7,
  "decorationsEventOnly": 12,
  "decorationsSubsystem": 4,
  "fishSpecies": 14,
  "fishAllAchievementTarget": 8,
  "artifacts": 24,
  "museumExhibits": 6,
  "museumCoinsTotal": 915000,
  "museumDiamondsTotal": 86,
  "museumIncomeTotal": 515,
  "researchNodes": 28,
  "researchBranches": 7,
  "expeditionSites": 8,
  "mineDepths": 5,
  "collectionsBooks": 5,
  "minigames": 31,
  "workshopRecipes": 36,
  "workshopUnlockLevel": 6,
  "workshopCost": 900,
  "workshopQueueSlots": 3,
  "workshopSize": "3×2",
  "kitBuildings": 28,
  "startDiamonds": 5,
  "fairTasksPerFair": 9,
  "fairTasksToComplete": 7,
  "townBuildingMaterialsDistinct": 8,
  "townHousesCoinsTotal": 2242400,
  "townCommunityCoinsTotal": 1372000,
  "townCombinedCoinsTotal": 3614400,
  "townCombinedMaterialsTotal": 814,
  "townMaterialBreakdown": "Brick ×216, Glass ×198, Slab ×156, Paint ×80, Hammer ×54, Cement ×48, Roof Tile ×44, Nails ×18",
  "townPopulationTotal": 1476,
  "townMilestones": 9,
  "townFinalPopulationTarget": 2000,
  "zooCoinsTotal": 1912000,
  "zooMaterialsTotal": 284,
  "zooMaterialBreakdown": "Brick ×87, Slab ×75, Glass ×66, Paint ×22, Hammer ×16, Cement ×10, Nails ×8",
  "zooLevelMin": 34,
  "zooLevelMax": 91,
  "cafeRecipes": 9,
  "cafeUnlockLevel": 36,
  "recipesSinkTotal": 46,
  "recipesSinkFeedMill": 10,
  "recipesSinkWorkshop": 36,
  "recipesUnderwaterTotal": 45,
  "recipesUnderwaterUnmarkedSink": 0,
  "recipesSinkNonUnderwaterCount": 1,
  "recipesSinkNonUnderwaterNames": "Roof Shingle",
  "recipesNonSinkTotal": 104,
  "recipesNonSinkMedianUplift": 1.57,
  "siloBaseCapacity": 50,
  "barnBaseCapacity": 50,
  "fairUnlockLevel": 15,
  "decorateUndoDepth": 50,
  "decorateMultiSelectMax": 40,
  "museumUnlockLevel": 60,
  "labUnlockLevel": 54,
  "labSlots": 1,
  "labBuildCoins": 120000,
  "labTotalCoinsWithBuild": 6545000,
  "labTotalResearchDays": 11.5,
  "labBuildMaterials": "12 glass, 8 wire and 6 cement",
  "trainPoolMaterials": 14,
  "effectKeysTotal": 41,
  "effectKeysShared": 10,
  "workshopComponents": 8,
  "structures": 22,
  "kitsAtWorkshopLevel": 13,
  "kitsAtTrainLevel": 12,
  "kitsAdvancedCount": 3,
  "trainPoolTownSharePercent": 72.6
});

/** The exact sentence tools/validate-data.mjs prints after "data.js OK — ", rebuilt from
 *  COUNTS above instead of quoted from a snapshot of that command's output. */
export const CENSUS_LINE = "22 crops, 12 animals, 31 buildings, 150 recipes, 214 goods, 3 merge chains, 39 achievements, 95 levels all with unlocks, 10 weekend events + 6 mini-events + 25 fair tasks + 6 holidays, town: 16 houses + 10 community, 14 zoo enclosures, 8 islands, 23 materials";

/** A few totals pre-formatted with thousands separators, for articles that quote coin sums. */
export const FMT = Object.freeze({
  "townHousesCoinsTotal": "2,242,400",
  "townCommunityCoinsTotal": "1,372,000",
  "townCombinedCoinsTotal": "3,614,400",
  "museumCoinsTotal": "915,000",
  "zooCoinsTotal": "1,912,000"
});

/** Every production building, one row per entry, sorted by unlock level — the data behind
 *  farming.js's "All N buildings" table. Rendered by the article, not baked into HTML here,
 *  so the article keeps ownership of markup and this file stays pure data. */
export const BUILDINGS_TABLE = Object.freeze([
  {
    "id": "bakery",
    "name": "Bakery",
    "level": 3,
    "cost": "200",
    "kit": "coins only",
    "slots": 3,
    "recipes": 4,
    "minigame": "Knead the Dough",
    "effect": "<code>bonusYield</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "feed_mill",
    "name": "Feed Mill",
    "level": 5,
    "cost": "300",
    "kit": "coins only",
    "slots": 3,
    "recipes": 10,
    "minigame": "Grain Sort",
    "effect": "<code>seedRefundChance</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "dairy",
    "name": "Dairy",
    "level": 6,
    "cost": "450",
    "kit": "<code>kit_dairy</code>",
    "slots": 3,
    "recipes": 4,
    "minigame": "Churn Timing",
    "effect": "<code>speedMult</code>",
    "maxBonus": "+20%"
  },
  {
    "id": "build_workshop",
    "name": "Building Workshop",
    "level": 6,
    "cost": "900",
    "kit": "coins only",
    "slots": 3,
    "recipes": 36,
    "minigame": "Fit the Frame",
    "effect": "<code>materialRefund</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "sugar_mill",
    "name": "Sugar Mill",
    "level": 8,
    "cost": "600",
    "kit": "<code>kit_sugar_mill</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Press Pressure",
    "effect": "<code>extraOutput</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "popcorn_pot",
    "name": "Popcorn Pot",
    "level": 9,
    "cost": "750",
    "kit": "<code>kit_popcorn_pot</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Catch the Pops",
    "effect": "<code>byproductChance</code>",
    "maxBonus": "+35%"
  },
  {
    "id": "grill",
    "name": "Grill",
    "level": 12,
    "cost": "1,100",
    "kit": "<code>kit_grill</code>",
    "slots": 3,
    "recipes": 5,
    "minigame": "Flip Timing",
    "effect": "<code>sellPriceMult</code>",
    "maxBonus": "+20%"
  },
  {
    "id": "loom",
    "name": "Loom",
    "level": 14,
    "cost": "1,500",
    "kit": "<code>kit_loom</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Weave the Pattern",
    "effect": "<code>rarityTier</code>",
    "maxBonus": "+20%"
  },
  {
    "id": "juice_press",
    "name": "Juice Press",
    "level": 15,
    "cost": "1,700",
    "kit": "<code>kit_juice_press</code>",
    "slots": 3,
    "recipes": 4,
    "minigame": "Press at Peak",
    "effect": "<code>juiceYieldBonus</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "pie_oven",
    "name": "Pie Oven",
    "level": 16,
    "cost": "1,800",
    "kit": "<code>kit_pie_oven</code>",
    "slots": 3,
    "recipes": 4,
    "minigame": "Crimp the Crust",
    "effect": "<code>xpMult</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "sewing_machine",
    "name": "Sewing Machine",
    "level": 20,
    "cost": "2,800",
    "kit": "<code>kit_sewing_machine</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Hold the Seam",
    "effect": "<code>fabricSaveChance</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "cake_oven",
    "name": "Cake Oven",
    "level": 21,
    "cost": "12,100",
    "kit": "<code>kit_cake_oven</code>",
    "slots": 3,
    "recipes": 8,
    "minigame": "Even the Crumb",
    "effect": "<code>crumbEvenness</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "jam_maker",
    "name": "Jam Maker",
    "level": 22,
    "cost": "3,600",
    "kit": "<code>kit_jam_maker</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Hold the Heat",
    "effect": "<code>setQualityBonus</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "smelter",
    "name": "Smelter",
    "level": 24,
    "cost": "4,200",
    "kit": "<code>kit_smelter</code>",
    "slots": 2,
    "recipes": 3,
    "minigame": "Work the Bellows",
    "effect": "<code>purityChance</code>",
    "maxBonus": "+20%"
  },
  {
    "id": "candy_machine",
    "name": "Candy Machine",
    "level": 26,
    "cost": "5,000",
    "kit": "<code>kit_candy_machine</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Pour the Moulds",
    "effect": "<code>mouldPrecision</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "ice_cream_maker",
    "name": "Ice Cream Maker",
    "level": 29,
    "cost": "6,400",
    "kit": "<code>kit_ice_cream_maker</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Set the Swirl",
    "effect": "<code>swirlSmooth</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "coffee_kiosk",
    "name": "Coffee Kiosk",
    "level": 30,
    "cost": "6,500",
    "kit": "<code>kit_coffee_kiosk</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Pull the Shot",
    "effect": "<code>rushHourChance</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "tropical_cafe",
    "name": "Tropical Café",
    "level": 36,
    "cost": "12,000",
    "kit": "<code>kit_tropical_cafe</code>",
    "slots": 3,
    "recipes": 9,
    "minigame": "Stack the Garnish",
    "effect": "<code>tipChance</code>",
    "maxBonus": "+35%"
  },
  {
    "id": "soup_kitchen",
    "name": "Soup Kitchen",
    "level": 46,
    "cost": "21,000",
    "kit": "<code>kit_soup_kitchen</code>",
    "slots": 3,
    "recipes": 2,
    "minigame": "Season by Touch",
    "effect": "<code>seasoningEdge</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "oil_press",
    "name": "Oil Press",
    "level": 52,
    "cost": "18,000",
    "kit": "<code>kit_oil_press</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Watch the Flow",
    "effect": "<code>oilClarity</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "sauce_maker",
    "name": "Sauce Maker",
    "level": 55,
    "cost": "42,000",
    "kit": "<code>kit_sauce_maker</code>",
    "slots": 3,
    "recipes": 2,
    "minigame": "Balance the Heat",
    "effect": "<code>sauceBalance</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "tea_house",
    "name": "Tea House",
    "level": 56,
    "cost": "26,000",
    "kit": "<code>kit_tea_house</code>",
    "slots": 3,
    "recipes": 4,
    "minigame": "Steep the Leaves",
    "effect": "<code>steepQuality</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "sushi_bar",
    "name": "Sushi Bar",
    "level": 60,
    "cost": "36,000",
    "kit": "<code>kit_sushi_bar</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Knife Work",
    "effect": "<code>knifePrecision</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "perfumery",
    "name": "Perfumery",
    "level": 64,
    "cost": "50,000",
    "kit": "<code>kit_perfumery</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Blend the Notes",
    "effect": "<code>blendHarmony</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "salad_bar",
    "name": "Salad Bar",
    "level": 68,
    "cost": "68,000",
    "kit": "<code>kit_salad_bar</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Toss the Bowl",
    "effect": "<code>plateFreshness</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "flower_shop",
    "name": "Flower Shop",
    "level": 71,
    "cost": "34,000",
    "kit": "<code>kit_flower_shop</code>",
    "slots": 3,
    "recipes": 2,
    "minigame": "Trim the Stems",
    "effect": "<code>bloomLife</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "pasta_kitchen",
    "name": "Pasta Kitchen",
    "level": 72,
    "cost": "90,000",
    "kit": "<code>kit_pasta_kitchen</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Stretch the Dough",
    "effect": "<code>doughStretch</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "fondue_pot",
    "name": "Fondue Pot",
    "level": 76,
    "cost": "120,000",
    "kit": "<code>kit_fondue_pot</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Stir the Melt",
    "effect": "<code>meltEvenness</code>",
    "maxBonus": "+25%"
  },
  {
    "id": "preservation_station",
    "name": "Preservation Station",
    "level": 80,
    "cost": "155,000",
    "kit": "<code>kit_preservation_station</code>",
    "slots": 3,
    "recipes": 5,
    "minigame": "Seal the Jars",
    "effect": "<code>sealTightness</code>",
    "maxBonus": "+30%"
  },
  {
    "id": "jeweler",
    "name": "Jeweler",
    "level": 85,
    "cost": "200,000",
    "kit": "<code>kit_jeweler</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Set the Stone",
    "effect": "<code>settingAccuracy</code>",
    "maxBonus": "+20%"
  },
  {
    "id": "yogurt_maker",
    "name": "Yogurt Maker",
    "level": 90,
    "cost": "260,000",
    "kit": "<code>kit_yogurt_maker</code>",
    "slots": 3,
    "recipes": 3,
    "minigame": "Hold the Culture",
    "effect": "<code>cultureVigour</code>",
    "maxBonus": "+30%"
  }
]);

/** Every per-factory minigame, one row per entry, in MINIGAMES' own declaration order --
 *  the data behind crafting.js's "All N per-factory minigames" table. */
export const MINIGAMES_TABLE = Object.freeze([
  {
    "id": "grain_sort",
    "name": "Grain Sort",
    "factory": "Feed Mill",
    "effect": "seedRefundChance",
    "capPercent": 25,
    "purpose": "Sort the good grain from the chaff. Clean batches hand seed back."
  },
  {
    "id": "knead_dough",
    "name": "Knead the Dough",
    "factory": "Bakery",
    "effect": "bonusYield",
    "capPercent": 30,
    "purpose": "Knead to the rhythm. Well-worked dough rises into an extra loaf."
  },
  {
    "id": "churn_timing",
    "name": "Churn Timing",
    "factory": "Dairy",
    "effect": "speedMult",
    "capPercent": 20,
    "purpose": "Hold the churn at the right speed to finish the batch sooner."
  },
  {
    "id": "press_pressure",
    "name": "Press Pressure",
    "factory": "Sugar Mill",
    "effect": "extraOutput",
    "capPercent": 25,
    "purpose": "Lean on the press without cracking it. More cane, more sugar."
  },
  {
    "id": "pop_catch",
    "name": "Catch the Pops",
    "factory": "Popcorn Pot",
    "effect": "byproductChance",
    "capPercent": 35,
    "purpose": "Catch kernels as they fly. Strays become a second snack."
  },
  {
    "id": "flip_timing",
    "name": "Flip Timing",
    "factory": "Grill",
    "effect": "sellPriceMult",
    "capPercent": 20,
    "purpose": "Flip at the sear, not after. Char sells for more."
  },
  {
    "id": "crimp_pattern",
    "name": "Crimp the Crust",
    "factory": "Pie Oven",
    "effect": "xpMult",
    "capPercent": 30,
    "purpose": "Trace the crimp around the rim. A neat pie teaches a neat baker."
  },
  {
    "id": "weave_trace",
    "name": "Weave the Pattern",
    "factory": "Loom",
    "effect": "rarityTier",
    "capPercent": 20,
    "purpose": "Follow the pattern thread. A clean weave lifts the cloth a tier."
  },
  {
    "id": "stitch_line",
    "name": "Hold the Seam",
    "factory": "Sewing Machine",
    "effect": "fabricSaveChance",
    "capPercent": 25,
    "purpose": "Keep the seam straight and the offcut is big enough to reuse."
  },
  {
    "id": "press_peak",
    "name": "Press at Peak",
    "factory": "Juice Press",
    "effect": "juiceYieldBonus",
    "capPercent": 30,
    "purpose": "Stop the press at peak flow. Overpressing bruises the fruit."
  },
  {
    "id": "heat_band",
    "name": "Hold the Heat",
    "factory": "Jam Maker",
    "effect": "setQualityBonus",
    "capPercent": 25,
    "purpose": "Keep the pot inside the setting band. A firm set fills an extra jar."
  },
  {
    "id": "shot_timing",
    "name": "Pull the Shot",
    "factory": "Coffee Kiosk",
    "effect": "rushHourChance",
    "capPercent": 30,
    "purpose": "Pull to the timing window. A good crema brings the morning rush."
  },
  {
    "id": "mould_pour",
    "name": "Pour the Moulds",
    "factory": "Candy Machine",
    "effect": "mouldPrecision",
    "capPercent": 25,
    "purpose": "Pour clean into every mould. Spillage sets into offcut sweets."
  },
  {
    "id": "garnish_stack",
    "name": "Stack the Garnish",
    "factory": "Tropical Café",
    "effect": "tipChance",
    "capPercent": 35,
    "purpose": "Balance the garnish. A drink that looks the part earns a tip."
  },
  {
    "id": "bellows_timing",
    "name": "Work the Bellows",
    "factory": "Smelter",
    "effect": "purityChance",
    "capPercent": 20,
    "purpose": "Time the bellows to hold the heat. Hotter metal pours purer."
  },
  {
    "id": "workshop_fit",
    "name": "Fit the Frame",
    "factory": "Building Workshop",
    "effect": "materialRefund",
    "capPercent": 25,
    "purpose": "Line the joints up before fixing. A tight fit leaves offcuts over."
  },
  {
    "id": "press_flow",
    "name": "Watch the Flow",
    "factory": "Oil Press",
    "effect": "oilClarity",
    "capPercent": 25,
    "purpose": "Keep the flow steady. Cloudy oil is worth less than clear."
  },
  {
    "id": "steep_timer",
    "name": "Steep the Leaves",
    "factory": "Tea House",
    "effect": "steepQuality",
    "capPercent": 30,
    "purpose": "Pull the leaves at the right moment. Over-steeped tea turns bitter."
  },
  {
    "id": "knife_work",
    "name": "Knife Work",
    "factory": "Sushi Bar",
    "effect": "knifePrecision",
    "capPercent": 25,
    "purpose": "Slice clean and even. A ragged cut ruins the roll."
  },
  {
    "id": "blend_nose",
    "name": "Blend the Notes",
    "factory": "Perfumery",
    "effect": "blendHarmony",
    "capPercent": 30,
    "purpose": "Balance top and base notes. One loud note flattens the blend."
  },
  {
    "id": "plate_toss",
    "name": "Toss the Bowl",
    "factory": "Salad Bar",
    "effect": "plateFreshness",
    "capPercent": 25,
    "purpose": "Toss without bruising. Handled well, the leaves stay crisp."
  },
  {
    "id": "dough_stretch",
    "name": "Stretch the Dough",
    "factory": "Pasta Kitchen",
    "effect": "doughStretch",
    "capPercent": 30,
    "purpose": "Stretch thin without tearing. Thin sheets cook true."
  },
  {
    "id": "melt_stir",
    "name": "Stir the Melt",
    "factory": "Fondue Pot",
    "effect": "meltEvenness",
    "capPercent": 25,
    "purpose": "Keep it moving. A fondue left still catches and splits."
  },
  {
    "id": "jar_seal",
    "name": "Seal the Jars",
    "factory": "Preservation Station",
    "effect": "sealTightness",
    "capPercent": 30,
    "purpose": "Seat every lid square. A poor seal spoils the batch."
  },
  {
    "id": "stone_set",
    "name": "Set the Stone",
    "factory": "Jeweler",
    "effect": "settingAccuracy",
    "capPercent": 20,
    "purpose": "Seat the stone dead centre. Off-centre and the claw shows."
  },
  {
    "id": "culture_temp",
    "name": "Hold the Culture",
    "factory": "Yogurt Maker",
    "effect": "cultureVigour",
    "capPercent": 30,
    "purpose": "Hold the warmth steady. A cold spot and the culture stalls."
  },
  {
    "id": "crumb_even",
    "name": "Even the Crumb",
    "factory": "Cake Oven",
    "effect": "crumbEvenness",
    "capPercent": 30,
    "purpose": "A cake that rises level slices clean and sells for more."
  },
  {
    "id": "swirl_set",
    "name": "Set the Swirl",
    "factory": "Ice Cream Maker",
    "effect": "swirlSmooth",
    "capPercent": 30,
    "purpose": "An even swirl sets firm and scoops clean."
  },
  {
    "id": "season_touch",
    "name": "Season by Touch",
    "factory": "Soup Kitchen",
    "effect": "seasoningEdge",
    "capPercent": 25,
    "purpose": "Seasoned right, a pot goes further."
  },
  {
    "id": "stem_trim",
    "name": "Trim the Stems",
    "factory": "Flower Shop",
    "effect": "bloomLife",
    "capPercent": 30,
    "purpose": "Cleanly cut stems keep a bouquet alive longer."
  },
  {
    "id": "heat_balance",
    "name": "Balance the Heat",
    "factory": "Sauce Maker",
    "effect": "sauceBalance",
    "capPercent": 25,
    "purpose": "Heat and sweetness in balance sells at a premium."
  }
]);

/** Every kit -- one row per kit-requiring building, sorted by that building's unlock level --
 *  the data behind crafting.js's "The N kits" table. */
export const KITS_TABLE = Object.freeze([
  {
    "kitName": "Dairy Kit",
    "building": "Dairy",
    "buildingLevel": 6,
    "kitLevel": 6,
    "inputs": "2 Timber Frame + 2 Wall Panel + 3 Roof Shingle",
    "craftTime": "1 h 30 min",
    "xp": 20,
    "coinCost": 450
  },
  {
    "kitName": "Sugar Mill Kit",
    "building": "Sugar Mill",
    "buildingLevel": 8,
    "kitLevel": 6,
    "inputs": "2 Steel Beam + 2 Timber Frame + 3 Roof Shingle",
    "craftTime": "1 h 45 min",
    "xp": 23,
    "coinCost": 600
  },
  {
    "kitName": "Popcorn Pot Kit",
    "building": "Popcorn Pot",
    "buildingLevel": 9,
    "kitLevel": 6,
    "inputs": "2 Steel Beam + 3 Wall Panel + 1 Brass Fitting",
    "craftTime": "2 h",
    "xp": 26,
    "coinCost": 750
  },
  {
    "kitName": "BBQ Grill Kit",
    "building": "Grill",
    "buildingLevel": 12,
    "kitLevel": 6,
    "inputs": "3 Steel Beam + 2 Brass Fitting + 4 Roof Shingle",
    "craftTime": "2 h 15 min",
    "xp": 29,
    "coinCost": 1100
  },
  {
    "kitName": "Loom Kit",
    "building": "Loom",
    "buildingLevel": 14,
    "kitLevel": 6,
    "inputs": "4 Timber Frame + 3 Wall Panel + 1 Wiring Loom",
    "craftTime": "3 h",
    "xp": 37,
    "coinCost": 1500
  },
  {
    "kitName": "Juice Press Kit",
    "building": "Juice Press",
    "buildingLevel": 15,
    "kitLevel": 6,
    "inputs": "4 Steel Beam + 2 Plumbing Set + 2 Glazing Unit",
    "craftTime": "4 h",
    "xp": 47,
    "coinCost": 1700
  },
  {
    "kitName": "Pie Oven Kit",
    "building": "Pie Oven",
    "buildingLevel": 16,
    "kitLevel": 6,
    "inputs": "4 Brick + 3 Steel Beam + 1 Plumbing Set",
    "craftTime": "2 h 30 min",
    "xp": 33,
    "coinCost": 1800
  },
  {
    "kitName": "Sewing Machine Kit",
    "building": "Sewing Machine",
    "buildingLevel": 20,
    "kitLevel": 6,
    "inputs": "4 Timber Frame + 3 Brass Fitting + 1 Wiring Loom",
    "craftTime": "3 h 30 min",
    "xp": 42,
    "coinCost": 2800
  },
  {
    "kitName": "Cake Oven Kit",
    "building": "Cake Oven",
    "buildingLevel": 21,
    "kitLevel": 6,
    "inputs": "3 Timber Frame + 2 Wall Panel + 2 Brass Fitting + 1 Glazing Unit",
    "craftTime": "2 h 30 min",
    "xp": 34,
    "coinCost": 12100
  },
  {
    "kitName": "Jam Maker Kit",
    "building": "Jam Maker",
    "buildingLevel": 22,
    "kitLevel": 21,
    "inputs": "5 Wall Panel + 2 Glazing Unit + 2 Plumbing Set",
    "craftTime": "4 h 30 min",
    "xp": 53,
    "coinCost": 3600
  },
  {
    "kitName": "Smelter Kit",
    "building": "Smelter",
    "buildingLevel": 24,
    "kitLevel": 21,
    "inputs": "8 Steel Beam + 4 Cement + 3 Plumbing Set",
    "craftTime": "8 h",
    "xp": 84,
    "coinCost": 4200
  },
  {
    "kitName": "Candy Machine Kit",
    "building": "Candy Machine",
    "buildingLevel": 26,
    "kitLevel": 21,
    "inputs": "5 Brass Fitting + 3 Wiring Loom + 4 Steel Beam",
    "craftTime": "6 h",
    "xp": 66,
    "coinCost": 5000
  },
  {
    "kitName": "Ice Cream Maker Kit",
    "building": "Ice Cream Maker",
    "buildingLevel": 29,
    "kitLevel": 6,
    "inputs": "2 Timber Frame + 2 Wall Panel + 1 Plumbing Set",
    "craftTime": "2 h 20 min",
    "xp": 30,
    "coinCost": 6400
  },
  {
    "kitName": "Coffee Kiosk Kit",
    "building": "Coffee Kiosk",
    "buildingLevel": 30,
    "kitLevel": 21,
    "inputs": "3 Glazing Unit + 2 Wiring Loom + 4 Wall Panel",
    "craftTime": "5 h",
    "xp": 59,
    "coinCost": 6500
  },
  {
    "kitName": "Tropical Cafe Kit",
    "building": "Tropical Café",
    "buildingLevel": 36,
    "kitLevel": 21,
    "inputs": "4 Glazing Unit + 3 Plumbing Set + 6 Timber Frame",
    "craftTime": "7 h",
    "xp": 74,
    "coinCost": 12000
  },
  {
    "kitName": "Soup Kitchen Kit",
    "building": "Soup Kitchen",
    "buildingLevel": 46,
    "kitLevel": 6,
    "inputs": "2 Steel Beam + 3 Wall Panel + 1 Plumbing Set",
    "craftTime": "3 h",
    "xp": 38,
    "coinCost": 21000
  },
  {
    "kitName": "Oil Press Kit",
    "building": "Oil Press",
    "buildingLevel": 52,
    "kitLevel": 21,
    "inputs": "3 Steel Beam + 2 Plumbing Set + 3 Wall Panel",
    "craftTime": "9 h",
    "xp": 92,
    "coinCost": 18000
  },
  {
    "kitName": "Sauce Maker Kit",
    "building": "Sauce Maker",
    "buildingLevel": 55,
    "kitLevel": 6,
    "inputs": "3 Steel Beam + 2 Brass Fitting + 1 Plumbing Set",
    "craftTime": "4 h",
    "xp": 48,
    "coinCost": 42000
  },
  {
    "kitName": "Tea House Kit",
    "building": "Tea House",
    "buildingLevel": 56,
    "kitLevel": 21,
    "inputs": "4 Timber Frame + 3 Glazing Unit + 5 Roof Shingle + 4 Roof Tile",
    "craftTime": "10 h 5 min",
    "xp": 103,
    "coinCost": 26000
  },
  {
    "kitName": "Sushi Bar Kit",
    "building": "Sushi Bar",
    "buildingLevel": 60,
    "kitLevel": 21,
    "inputs": "5 Wall Panel + 3 Glazing Unit + 3 Brass Fitting",
    "craftTime": "11 h 18 min",
    "xp": 115,
    "coinCost": 36000
  },
  {
    "kitName": "Perfumery Kit",
    "building": "Perfumery",
    "buildingLevel": 64,
    "kitLevel": 21,
    "inputs": "5 Glazing Unit + 4 Brass Fitting + 2 Wiring Loom",
    "craftTime": "12 h 39 min",
    "xp": 129,
    "coinCost": 50000
  },
  {
    "kitName": "Salad Bar Kit",
    "building": "Salad Bar",
    "buildingLevel": 68,
    "kitLevel": 21,
    "inputs": "5 Timber Frame + 5 Wall Panel + 2 Plumbing Set",
    "craftTime": "14 h 10 min",
    "xp": 144,
    "coinCost": 68000
  },
  {
    "kitName": "Flower Shop Kit",
    "building": "Flower Shop",
    "buildingLevel": 71,
    "kitLevel": 6,
    "inputs": "2 Timber Frame + 2 Glazing Unit + 2 Wall Panel",
    "craftTime": "3 h 30 min",
    "xp": 44,
    "coinCost": 34000
  },
  {
    "kitName": "Pasta Kitchen Kit",
    "building": "Pasta Kitchen",
    "buildingLevel": 72,
    "kitLevel": 21,
    "inputs": "5 Steel Beam + 4 Brass Fitting + 3 Plumbing Set",
    "craftTime": "15 h 52 min",
    "xp": 161,
    "coinCost": 90000
  },
  {
    "kitName": "Fondue Pot Kit",
    "building": "Fondue Pot",
    "buildingLevel": 76,
    "kitLevel": 21,
    "inputs": "6 Brass Fitting + 3 Wiring Loom + 3 Cement",
    "craftTime": "17 h 46 min",
    "xp": 180,
    "coinCost": 120000
  },
  {
    "kitName": "Preservation Kit",
    "building": "Preservation Station",
    "buildingLevel": 80,
    "kitLevel": 80,
    "inputs": "6 Glazing Unit + 4 Plumbing Set + 5 Steel Beam + 2 Electric Saw",
    "craftTime": "19 h 54 min",
    "xp": 202,
    "coinCost": 155000
  },
  {
    "kitName": "Jeweler Kit",
    "building": "Jeweler",
    "buildingLevel": 85,
    "kitLevel": 75,
    "inputs": "7 Glazing Unit + 6 Brass Fitting + 4 Wiring Loom + 2 Jackhammer",
    "craftTime": "22 h 17 min",
    "xp": 226,
    "coinCost": 200000
  },
  {
    "kitName": "Yogurt Maker Kit",
    "building": "Yogurt Maker",
    "buildingLevel": 90,
    "kitLevel": 86,
    "inputs": "5 Plumbing Set + 7 Wall Panel + 4 Wiring Loom + 3 Drill",
    "craftTime": "24 h 57 min",
    "xp": 253,
    "coinCost": 260000
  }
]);
