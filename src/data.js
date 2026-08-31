// data.js — all game content definitions for Farm Tycoon.
// Data is design: everything here is final content; systems in other modules consume it.
// Times are in seconds (wall-clock). Prices in coins. All ids are lowercase snake_case.

/** Crop definitions. Harvest returns 2x the planted seed (Hay Day rule). */
/**
 * Balance note, recorded so it is not re-derived wrongly (it was, three times).
 *
 * Crop XP looks inverted: wheat yields 15 xp/h per field against about 1 for mint, so late
 * crops appear pointless. That is an artefact of measuring instantaneous rate. A crop only
 * yields when someone is present to harvest it, so the real cycle is ceil(growTime / visit)
 * * visit. Model an actual check-in cadence and it reverses:
 *
 *   xp per hour per field   wheat   strawberry   grapes   mint
 *   tapping every 2 min     15.15      2.48        1.00    1.14
 *   checking in every 4 h    0.25      1.25        1.00    1.14
 *   checking in every 12 h   0.08      0.42        1.00    1.14
 *
 * Wheat only wins for a player tapping thirty times an hour. At any cadence a person keeps,
 * late crops beat it by 4-14x. So the curve below is correct as it stands, and raising late
 * crop XP would inflate the economy to fix something that does not happen.
 */
export const CROPS = {
  wheat:      { name: 'Wheat',       unlockLevel: 1,  growTime: 120,   seedCost: 1,  sellPrice: 4,   xp: 1 },
  corn:       { name: 'Corn',        unlockLevel: 2,  growTime: 300,   seedCost: 2,  sellPrice: 7,   xp: 1 },
  carrot:     { name: 'Carrot',      unlockLevel: 3,  growTime: 600,   seedCost: 3,  sellPrice: 11,  xp: 2 },
  soybean:    { name: 'Soybean',     unlockLevel: 5,  growTime: 1200,  seedCost: 4,  sellPrice: 15,  xp: 2 },
  sugarcane:  { name: 'Sugarcane',   unlockLevel: 7,  growTime: 1800,  seedCost: 5,  sellPrice: 19,  xp: 3 },
  cotton:     { name: 'Cotton',      unlockLevel: 9,  growTime: 2700,  seedCost: 6,  sellPrice: 24,  xp: 3 },
  tomato:     { name: 'Tomato',      unlockLevel: 11, growTime: 3600,  seedCost: 7,  sellPrice: 30,  xp: 4 },
  potato:     { name: 'Potato',      unlockLevel: 13, growTime: 5400,  seedCost: 8,  sellPrice: 37,  xp: 4 },
  strawberry: { name: 'Strawberry',  unlockLevel: 15, growTime: 7200,  seedCost: 10, sellPrice: 46,  xp: 5 },
  pumpkin:    { name: 'Pumpkin',     unlockLevel: 18, growTime: 10800, seedCost: 12, sellPrice: 58,  xp: 6 },
  indigo:     { name: 'Indigo',      unlockLevel: 21, growTime: 14400, seedCost: 14, sellPrice: 72,  xp: 7 },
  chili:      { name: 'Chili Pepper',unlockLevel: 25, growTime: 21600, seedCost: 17, sellPrice: 90,  xp: 8 },
  coffee:     { name: 'Coffee Bean', unlockLevel: 29, growTime: 28800, seedCost: 20, sellPrice: 112, xp: 10 },
  grapes:     { name: 'Grapes',      unlockLevel: 33, growTime: 43200, seedCost: 25, sellPrice: 140, xp: 12 },
  // Levels 51-84. Names are wiki-real (Hay Day and Township both grow these); values
  // continue the shipped geometric curve rather than the add-content skill's formula,
  // which disagrees with every crop already in this table.
  rice:       { name: 'Rice',        unlockLevel: 51, growTime: 50400,  seedCost: 30, sellPrice: 172, xp: 14 },
  olive:      { name: 'Olive',       unlockLevel: 55, growTime: 57600,  seedCost: 34, sellPrice: 200, xp: 17 },
  lavender:   { name: 'Lavender',    unlockLevel: 58, growTime: 64800,  seedCost: 39, sellPrice: 232, xp: 19 },
  tea_leaf:   { name: 'Tea Leaf',    unlockLevel: 62, growTime: 72000,  seedCost: 45, sellPrice: 270, xp: 23 },
  bell_pepper: { name: 'Bell Pepper', unlockLevel: 66, growTime: 82800,  seedCost: 52, sellPrice: 314, xp: 26 },
  peony:      { name: 'Peony',       unlockLevel: 71, growTime: 93600,  seedCost: 60, sellPrice: 365, xp: 30 },
  watermelon: { name: 'Watermelon',  unlockLevel: 77, growTime: 108000, seedCost: 69, sellPrice: 424, xp: 35 },
  mint:       { name: 'Mint',        unlockLevel: 84, growTime: 129600, seedCost: 80, sellPrice: 492, xp: 41 },
};

/** Animal pens. Animals eat feed (made in the Feed Mill) and produce goods on a timer. */
export const ANIMALS = {
  chicken: { name: 'Chicken', pen: 'Chicken Coop', unlockLevel: 2,  feed: 'chicken_feed', produceTime: 600,   product: 'egg',       penCost: 100,   animalCost: 20,  capacity: 5, xp: 2 },
  cow:     { name: 'Cow',     pen: 'Cow Pasture',  unlockLevel: 6,  feed: 'cow_feed',     produceTime: 1800,  product: 'milk',      penCost: 350,   animalCost: 60,  capacity: 4, xp: 3 },
  pig:     { name: 'Pig',     pen: 'Pig Pen',      unlockLevel: 10, feed: 'pig_feed',     produceTime: 3600,  product: 'bacon',     penCost: 750,   animalCost: 120, capacity: 4, xp: 4 },
  sheep:   { name: 'Sheep',   pen: 'Sheep Field',  unlockLevel: 14, feed: 'sheep_feed',   produceTime: 5400,  product: 'wool',      penCost: 1400,  animalCost: 200, capacity: 4, xp: 5 },
  goat:    { name: 'Goat',    pen: 'Goat Yard',    unlockLevel: 19, feed: 'goat_feed',    produceTime: 7200,  product: 'goat_milk', penCost: 2600,  animalCost: 320, capacity: 3, xp: 6 },
  bee:     { name: 'Bees',    pen: 'Beehive',      unlockLevel: 23, feed: null,           produceTime: 10800, product: 'honey',     penCost: 4200,  animalCost: 0,   capacity: 1, xp: 7 },
  duck:    { name: 'Duck',    pen: 'Duck Pond',    unlockLevel: 27, feed: 'chicken_feed', produceTime: 9000,  product: 'feathers',  penCost: 6000,  animalCost: 450, capacity: 3, xp: 8 },
  // Lamb and Otter are wiki-real (Hay Day's lamb, Township's otter pond and its pearls).
  // Quail, Alpaca and Turkey are original but written in the same idiom - flagged here so
  // nobody later cites a wiki for them.
  lamb:    { name: 'Lamb',   pen: 'Lamb Meadow',     unlockLevel: 53, feed: 'lamb_feed',   produceTime: 12600, product: 'lamb_chop',    penCost: 9000,  animalCost: 700,  capacity: 3, xp: 10 },
  quail:   { name: 'Quail',  pen: 'Quail Hutch',     unlockLevel: 58, feed: 'quail_feed',  produceTime: 14400, product: 'quail_egg',    penCost: 13000, animalCost: 950,  capacity: 4, xp: 12 },
  alpaca:  { name: 'Alpaca', pen: 'Alpaca Paddock',  unlockLevel: 64, feed: 'alpaca_feed', produceTime: 18000, product: 'alpaca_wool',  penCost: 19000, animalCost: 1400, capacity: 3, xp: 15 },
  otter:   { name: 'Otter',  pen: 'Otter Pond',      unlockLevel: 72, feed: 'otter_feed',  produceTime: 21600, product: 'pearls',       penCost: 27000, animalCost: 2000, capacity: 2, xp: 18 },
  turkey:  { name: 'Turkey', pen: 'Turkey Run',      unlockLevel: 82, feed: 'turkey_feed', produceTime: 25200, product: 'turkey_plume', penCost: 38000, animalCost: 2800, capacity: 3, xp: 22 },
};

/** Goods produced by animals, buildings, fishing and the mine. sellPrice = base instant-sell value. */
export const GOODS = {
  // animal products
  egg:        { name: 'Egg',         sellPrice: 10 },
  milk:       { name: 'Milk',        sellPrice: 16 },
  bacon:      { name: 'Bacon',       sellPrice: 25 },
  wool:       { name: 'Wool',        sellPrice: 34 },
  goat_milk:  { name: 'Goat Milk',   sellPrice: 44 },
  honey:      { name: 'Honey',       sellPrice: 58 },
  feathers:   { name: 'Feathers',    sellPrice: 50 },
  lamb_chop:  { name: 'Lamb Chop',    sellPrice: 70 },
  quail_egg:  { name: 'Quail Egg',    sellPrice: 44 },
  alpaca_wool: { name: 'Alpaca Wool',  sellPrice: 105 },
  pearls:     { name: 'Pearls',       sellPrice: 160 },
  turkey_plume: { name: 'Turkey Plume', sellPrice: 135 },
  // feed
  chicken_feed: { name: 'Chicken Feed', sellPrice: 5 },
  cow_feed:     { name: 'Cow Feed',     sellPrice: 8 },
  pig_feed:     { name: 'Pig Feed',     sellPrice: 12 },
  sheep_feed:   { name: 'Sheep Feed',   sellPrice: 16 },
  goat_feed:    { name: 'Goat Feed',    sellPrice: 21 },
  lamb_feed:    { name: 'Lamb Feed',    sellPrice: 22 },
  quail_feed:   { name: 'Quail Feed',   sellPrice: 24 },
  alpaca_feed:  { name: 'Alpaca Feed',  sellPrice: 28 },
  otter_feed:   { name: 'Otter Feed',   sellPrice: 34 },
  turkey_feed:  { name: 'Turkey Feed',  sellPrice: 30 },
  // bakery
  bread:        { name: 'Bread',           sellPrice: 22 },
  corn_bread:   { name: 'Corn Bread',      sellPrice: 32 },
  cookie:       { name: 'Cookie',          sellPrice: 44 },
  muffin:       { name: 'Strawberry Muffin', sellPrice: 120 },
  // dairy
  cream:        { name: 'Cream',        sellPrice: 28 },
  butter:       { name: 'Butter',       sellPrice: 46 },
  cheese:       { name: 'Cheese',       sellPrice: 60 },
  goat_cheese:  { name: 'Goat Cheese',  sellPrice: 96 },
  // sugar mill
  sugar:        { name: 'Sugar',        sellPrice: 30 },
  brown_sugar:  { name: 'Brown Sugar',  sellPrice: 42 },
  syrup:        { name: 'Syrup',        sellPrice: 78 },
  // popcorn pot
  popcorn:          { name: 'Popcorn',          sellPrice: 20 },
  buttered_popcorn: { name: 'Buttered Popcorn', sellPrice: 74 },
  chili_popcorn:    { name: 'Chili Popcorn',    sellPrice: 130 },
  // grill
  pancakes:     { name: 'Pancakes',     sellPrice: 68 },
  bacon_eggs:   { name: 'Bacon & Eggs', sellPrice: 56 },
  baked_potato: { name: 'Baked Potato', sellPrice: 62 },
  burger:       { name: 'Burger',       sellPrice: 150 },
  // pie oven
  carrot_pie:     { name: 'Carrot Pie',     sellPrice: 80 },
  pumpkin_pie:    { name: 'Pumpkin Pie',    sellPrice: 116 },
  strawberry_pie: { name: 'Strawberry Pie', sellPrice: 148 },
  fish_pie:       { name: 'Fish Pie',       sellPrice: 170 },
  // loom & sewing
  cotton_fabric: { name: 'Cotton Fabric', sellPrice: 54 },
  sweater:       { name: 'Wool Sweater',  sellPrice: 104 },
  cotton_shirt:  { name: 'Cotton Shirt',  sellPrice: 122 },
  wooly_hat:     { name: 'Wooly Hat',     sellPrice: 132 },
  blue_hat:      { name: 'Blue Wooly Hat', sellPrice: 196 },
  // juice press
  carrot_juice:  { name: 'Carrot Juice',       sellPrice: 40 },
  tomato_juice:  { name: 'Tomato Juice',       sellPrice: 74 },
  smoothie:      { name: 'Strawberry Smoothie',sellPrice: 128 },
  grape_juice:   { name: 'Grape Juice',        sellPrice: 210 },
  // jam maker
  strawberry_jam: { name: 'Strawberry Jam', sellPrice: 158 },
  grape_jam:      { name: 'Grape Jam',      sellPrice: 240 },
  honey_jam:      { name: 'Honey Jam',      sellPrice: 200 },
  // coffee kiosk
  espresso:     { name: 'Espresso',     sellPrice: 138 },
  latte:        { name: 'Latte',        sellPrice: 170 },
  honey_coffee: { name: 'Honey Coffee', sellPrice: 214 },
  // candy machine
  caramel:      { name: 'Caramel',         sellPrice: 96 },
  chili_choc:   { name: 'Chili Chocolate', sellPrice: 184 },
  honey_toffee: { name: 'Honey Toffee',    sellPrice: 168 },
  // fish
  fish_perch:   { name: 'Perch',      sellPrice: 30, rarity: 'common' },
  fish_trout:   { name: 'Trout',      sellPrice: 34, rarity: 'common' },
  fish_carp:    { name: 'Carp',       sellPrice: 38, rarity: 'common' },
  fish_bass:    { name: 'Bass',       sellPrice: 60, rarity: 'uncommon' },
  fish_pike:    { name: 'Pike',       sellPrice: 68, rarity: 'uncommon' },
  fish_catfish: { name: 'Catfish',    sellPrice: 76, rarity: 'uncommon' },
  fish_salmon:  { name: 'Salmon',     sellPrice: 120, rarity: 'rare' },
  fish_golden:  { name: 'Golden Koi', sellPrice: 260, rarity: 'rare' },
  // mine
  ore_silver:   { name: 'Silver Ore',   sellPrice: 60 },
  ore_gold:     { name: 'Gold Ore',     sellPrice: 100 },
  ore_platinum: { name: 'Platinum Ore', sellPrice: 160 },
  gem:          { name: 'Gemstone',     sellPrice: 320 },
  silver_bar:   { name: 'Silver Bar',   sellPrice: 220 },
  gold_bar:     { name: 'Gold Bar',     sellPrice: 360 },
  platinum_bar: { name: 'Platinum Bar', sellPrice: 560 },
  // exotic goods (island expeditions) → Tropical Café
  banana:     { name: 'Banana',     sellPrice: 60 },
  pineapple:  { name: 'Pineapple',  sellPrice: 80 },
  cocoa:      { name: 'Cocoa',      sellPrice: 100 },
  vanilla:    { name: 'Vanilla',    sellPrice: 130 },
  // tropical café
  banana_split:  { name: 'Banana Split',       sellPrice: 280 },
  choco_banana:  { name: 'Choco Banana',       sellPrice: 330 },
  pina_smoothie: { name: 'Piña Smoothie',      sellPrice: 300 },
  vanilla_ice:   { name: 'Vanilla Ice Cream',  sellPrice: 380 },
  // zoo souvenirs
  peacock_feather: { name: 'Peacock Feather',  sellPrice: 220 },
  monkey_plush:    { name: 'Monkey Plush',     sellPrice: 260 },
  penguin_badge:   { name: 'Penguin Badge',    sellPrice: 300 },
  flamingo_pin:    { name: 'Flamingo Pin',     sellPrice: 320 },
  lion_figurine:   { name: 'Lion Figurine',    sellPrice: 380 },
  panda_souvenir:  { name: 'Panda Souvenir',   sellPrice: 420 },
  giraffe_scarf:   { name: 'Giraffe Scarf',    sellPrice: 470 },
  elephant_statue: { name: 'Elephant Statue',  sellPrice: 540 },
  // mine tools (consumed, obtainable from orders/fishing chests/shop)
  // source: 'loot' is the explicit opt-out from the orphan audit - these are earned from
  // orders, fishing chests and the shop, never produced by a recipe. Anything else lacking a
  // producer is a real gap, not a special case.
  pickaxe:  { name: 'Pickaxe',  sellPrice: 40, source: 'loot' },
  dynamite: { name: 'Dynamite', sellPrice: 90, source: 'loot' },
  // island and deep-water products
  peach_melba:      { name: 'Peach Melba',        sellPrice: 900 },
  lime_cooler:      { name: 'Lime Cooler',        sellPrice: 1050 },
  coconut_cream:    { name: 'Coconut Cream',      sellPrice: 1240 },
  mango_sorbet:     { name: 'Mango Sorbet',       sellPrice: 1480 },
  aloe_tonic:       { name: 'Aloe Tonic',         sellPrice: 1760 },
  smoked_sturgeon:  { name: 'Smoked Sturgeon',    sellPrice: 2100 },
  caviar_tin:       { name: 'Tin of Caviar',      sellPrice: 2650 },
  // island exotics (Township port goods)
  peach:           { name: 'Peach',            sellPrice: 150 },
  watermelon_ex:   { name: 'Island Melon',     sellPrice: 190 },
  plum:            { name: 'Plum',             sellPrice: 230 },
  key_lime:        { name: 'Key Lime',         sellPrice: 270 },
  coconut:         { name: 'Coconut',          sellPrice: 320 },
  avocado:         { name: 'Avocado',          sellPrice: 380 },
  mango:           { name: 'Mango',            sellPrice: 450 },
  aloe:            { name: 'Aloe',             sellPrice: 520 },
  // zoo souvenirs, second tier
  otter_charm:     { name: 'Otter Charm',        sellPrice: 600 },
  toucan_mask:     { name: 'Toucan Mask',        sellPrice: 680 },
  koala_plush:     { name: 'Koala Plush',        sellPrice: 770 },
  tiger_banner:    { name: 'Tiger Banner',       sellPrice: 870 },
  polar_globe:     { name: 'Polar Snow Globe',   sellPrice: 980 },
  rhino_carving:   { name: 'Rhino Carving',      sellPrice: 1100 },
  // deeper-water fish
  fish_sturgeon:   { name: 'Lake Sturgeon',    sellPrice: 210 },
  fish_zander:     { name: 'Zander',           sellPrice: 250 },
  fish_huchen:     { name: 'Huchen',           sellPrice: 300 },
  fish_arctic:     { name: 'Arctic Charr',     sellPrice: 360 },
  fish_barb:       { name: 'Giant Barb',       sellPrice: 430 },
  fish_moonfish:   { name: 'Moonfish',         sellPrice: 520 },
  // oil_press
  olive_oil:        { name: 'Olive Oil',            sellPrice: 420 },
  herb_oil:         { name: 'Herb Oil',             sellPrice: 560 },
  lavender_oil:     { name: 'Lavender Oil',         sellPrice: 720 },
  // tea_house
  green_tea:        { name: 'Green Tea',            sellPrice: 480 },
  milk_tea:         { name: 'Milk Tea',             sellPrice: 620 },
  honey_tea:        { name: 'Honey Tea',            sellPrice: 780 },
  mint_tea:         { name: 'Mint Tea',             sellPrice: 940 },
  // sushi_bar
  sushi_roll:       { name: 'Sushi Roll',           sellPrice: 700 },
  egg_sushi:        { name: 'Egg Sushi',            sellPrice: 840 },
  rice_ball:        { name: 'Rice Ball',            sellPrice: 1020 },
  // perfumery
  air_freshener:    { name: 'Air Freshener',        sellPrice: 900 },
  perfume:          { name: 'Perfume',              sellPrice: 1450 },
  lotion:           { name: 'Lotion',               sellPrice: 1180 },
  // salad_bar
  garden_salad:     { name: 'Garden Salad',         sellPrice: 860 },
  feta_salad:       { name: 'Feta Salad',           sellPrice: 1300 },
  fruit_salad:      { name: 'Fruit Salad',          sellPrice: 1120 },
  // pasta_kitchen
  fresh_pasta:      { name: 'Fresh Pasta',          sellPrice: 560 },
  lasagna:          { name: 'Lasagna',              sellPrice: 1700 },
  pesto_pasta:      { name: 'Pesto Pasta',          sellPrice: 1520 },
  // fondue_pot
  cheese_fondue:    { name: 'Cheese Fondue',        sellPrice: 1250 },
  choco_fondue:     { name: 'Chocolate Fondue',     sellPrice: 1800 },
  herb_fondue:      { name: 'Herb Fondue',          sellPrice: 2050 },
  // preservation_station
  pickles:          { name: 'Pickles',              sellPrice: 1650 },
  canned_fish:      { name: 'Canned Fish',          sellPrice: 2100 },
  dried_fruit:      { name: 'Dried Fruit',          sellPrice: 1500 },
  // jeweler
  pearl_necklace:   { name: 'Pearl Necklace',       sellPrice: 3200 },
  gold_ring:        { name: 'Gold Ring',            sellPrice: 3800 },
  plume_brooch:     { name: 'Plume Brooch',         sellPrice: 4500 },
  // yogurt_maker
  plain_yogurt:     { name: 'Plain Yogurt',         sellPrice: 1350 },
  berry_yogurt:     { name: 'Berry Yogurt',         sellPrice: 2000 },
  mint_yogurt:      { name: 'Mint Yogurt',          sellPrice: 2300 },
  // sinks for the new animal products, added to existing buildings
  lamb_skewer:      { name: 'Lamb Skewer',          sellPrice: 340 },
  alpaca_scarf:     { name: 'Alpaca Scarf',         sellPrice: 420 },
  // kits for the ten buildings above
  kit_oil_press:            { name: 'Oil Press Kit',          sellPrice: 2300 },
  kit_tea_house:            { name: 'Tea House Kit',          sellPrice: 2800 },
  kit_sushi_bar:            { name: 'Sushi Bar Kit',          sellPrice: 3400 },
  kit_perfumery:            { name: 'Perfumery Kit',          sellPrice: 4100 },
  kit_salad_bar:            { name: 'Salad Bar Kit',          sellPrice: 5000 },
  kit_pasta_kitchen:        { name: 'Pasta Kitchen Kit',      sellPrice: 6000 },
  kit_fondue_pot:           { name: 'Fondue Pot Kit',         sellPrice: 7200 },
  kit_preservation_station: { name: 'Preservation Kit',       sellPrice: 8600 },
  kit_jeweler:              { name: 'Jeweler Kit',            sellPrice: 10300 },
  kit_yogurt_maker:         { name: 'Yogurt Maker Kit',       sellPrice: 12400 },
  // build components (Building Workshop) - crafted from MATERIALS, consumed by kits
  beam:         { name: 'Steel Beam',       sellPrice: 70 },
  frame:        { name: 'Timber Frame',     sellPrice: 85 },
  panel:        { name: 'Wall Panel',       sellPrice: 95 },
  fitting:      { name: 'Brass Fitting',    sellPrice: 110 },
  glazing:      { name: 'Glazing Unit',     sellPrice: 130 },
  wiring_loom:  { name: 'Wiring Loom',      sellPrice: 150 },
  plumbing:     { name: 'Plumbing Set',     sellPrice: 170 },
  shingle:      { name: 'Roof Shingle',     sellPrice: 60 },
  // building kits - one per craftable building; consumed to PLACE it (see BUILDINGS.kit)
  kit_dairy:            { name: 'Dairy Kit',            sellPrice: 420 },
  kit_sugar_mill:       { name: 'Sugar Mill Kit',       sellPrice: 500 },
  kit_popcorn_pot:      { name: 'Popcorn Pot Kit',      sellPrice: 560 },
  kit_grill:            { name: 'BBQ Grill Kit',        sellPrice: 640 },
  kit_pie_oven:         { name: 'Pie Oven Kit',         sellPrice: 720 },
  kit_loom:             { name: 'Loom Kit',             sellPrice: 820 },
  kit_sewing_machine:   { name: 'Sewing Machine Kit',   sellPrice: 920 },
  kit_juice_press:      { name: 'Juice Press Kit',      sellPrice: 1050 },
  kit_jam_maker:        { name: 'Jam Maker Kit',        sellPrice: 1180 },
  kit_coffee_kiosk:     { name: 'Coffee Kiosk Kit',     sellPrice: 1320 },
  kit_candy_machine:    { name: 'Candy Machine Kit',    sellPrice: 1480 },
  kit_tropical_cafe:    { name: 'Tropical Cafe Kit',    sellPrice: 1700 },
  kit_smelter:          { name: 'Smelter Kit',          sellPrice: 1950 },
};

/**
 * Production buildings. Each has an ordered recipe list:
 * inputs: {itemId: qty} — crops, goods, or other products. time in seconds.
 */
// Every production building except feed_mill, bakery and build_workshop itself requires a
// crafted KIT to place (kit: <goodId>), on top of its coin cost. Those three stay coin-only
// so the opening hour of the game never depends on a supply chain that does not exist yet.
export const BUILDINGS = {
  feed_mill: {
    name: 'Feed Mill', unlockLevel: 5, cost: 300, size: [2, 2], minigame: 'grain_sort', queueSlots: 3,
    recipes: [
      { id: 'chicken_feed', inputs: { wheat: 2, corn: 1 },      time: 300,  xp: 2 },
      { id: 'cow_feed',     inputs: { corn: 2, soybean: 1 },    time: 600,  xp: 3 },
      { id: 'pig_feed',     inputs: { carrot: 2, soybean: 2 },  time: 1200, xp: 4 },
      { id: 'sheep_feed',   inputs: { wheat: 3, soybean: 2 },   time: 1800, xp: 5 },
      { id: 'goat_feed',    inputs: { carrot: 3, corn: 3 },     time: 2400, xp: 6 },
      { id: 'lamb_feed',   inputs: { rice: 2, soybean: 2 },          time: 3000, xp: 7 },
      { id: 'quail_feed',  inputs: { rice: 3, corn: 2 },             time: 3600, xp: 8 },
      { id: 'alpaca_feed', inputs: { bell_pepper: 2, wheat: 4 },     time: 4200, xp: 10 },
      { id: 'otter_feed',  inputs: { fish_perch: 1, rice: 2 },       time: 4800, xp: 12 },
      { id: 'turkey_feed', inputs: { corn: 3, watermelon: 1 },       time: 5400, xp: 14 },
    ],
  },
  bakery: {
    name: 'Bakery', unlockLevel: 3, cost: 200, size: [2, 2], minigame: 'knead_dough', queueSlots: 3,
    recipes: [
      { id: 'bread',      inputs: { wheat: 3 },            time: 300,   xp: 3 },
      { id: 'corn_bread', inputs: { corn: 2, egg: 1 },     time: 900,   xp: 4 },
      { id: 'cookie',     inputs: { wheat: 2, egg: 2, sugar: 1 }, time: 1800, xp: 6 },
      { id: 'muffin',     inputs: { strawberry: 2, wheat: 2, egg: 2 }, time: 3600, xp: 10 },
    ],
  },
  dairy: {
    name: 'Dairy', unlockLevel: 6, cost: 450, size: [2, 2], kit: 'kit_dairy', minigame: 'churn_timing', queueSlots: 3,
    recipes: [
      { id: 'cream',       inputs: { milk: 1 },              time: 600,  xp: 3 },
      { id: 'butter',      inputs: { cream: 1, milk: 1 },    time: 1500, xp: 5 },
      { id: 'cheese',      inputs: { milk: 3 },              time: 2700, xp: 7 },
      { id: 'goat_cheese', inputs: { goat_milk: 2 },         time: 3600, xp: 9 },
    ],
  },
  sugar_mill: {
    name: 'Sugar Mill', unlockLevel: 8, cost: 600, size: [2, 2], kit: 'kit_sugar_mill', minigame: 'press_pressure', queueSlots: 3,
    recipes: [
      { id: 'sugar',       inputs: { sugarcane: 1 },           time: 600,  xp: 3 },
      { id: 'brown_sugar', inputs: { sugarcane: 2 },           time: 1200, xp: 4 },
      { id: 'syrup',       inputs: { sugarcane: 4 },           time: 3600, xp: 8 },
    ],
  },
  popcorn_pot: {
    name: 'Popcorn Pot', unlockLevel: 9, cost: 750, size: [2, 2], kit: 'kit_popcorn_pot', minigame: 'pop_catch', queueSlots: 3,
    recipes: [
      { id: 'popcorn',          inputs: { corn: 2 },                time: 450,  xp: 3 },
      { id: 'buttered_popcorn', inputs: { corn: 2, butter: 1 },     time: 1800, xp: 7 },
      { id: 'chili_popcorn',    inputs: { corn: 3, chili: 1 },      time: 3600, xp: 11 },
    ],
  },
  grill: {
    name: 'Grill', unlockLevel: 12, cost: 1100, size: [2, 2], kit: 'kit_grill', minigame: 'flip_timing', queueSlots: 3,
    recipes: [
      { id: 'bacon_eggs',   inputs: { bacon: 1, egg: 2 },               time: 1200, xp: 5 },
      { id: 'pancakes',     inputs: { wheat: 2, egg: 1, syrup: 1 },     time: 1800, xp: 7 },
      { id: 'baked_potato', inputs: { potato: 2, butter: 1 },           time: 2400, xp: 7 },
      { id: 'burger',       inputs: { bread: 2, bacon: 2, tomato: 1 },  time: 4500, xp: 13 },
      { id: 'lamb_skewer',    inputs: { lamb_chop: 2, bell_pepper: 1 },               time: 2700,  xp: 26 },
    ],
  },
  pie_oven: {
    name: 'Pie Oven', unlockLevel: 16, cost: 1800, size: [2, 2], kit: 'kit_pie_oven', minigame: 'crimp_pattern', queueSlots: 3,
    recipes: [
      { id: 'carrot_pie',     inputs: { carrot: 3, wheat: 2, egg: 1 },      time: 2400, xp: 8 },
      { id: 'pumpkin_pie',    inputs: { pumpkin: 1, wheat: 2, egg: 2 },     time: 3600, xp: 10 },
      { id: 'strawberry_pie', inputs: { strawberry: 3, wheat: 2, cream: 1 }, time: 5400, xp: 12 },
      { id: 'fish_pie',       inputs: { fish_perch: 2, wheat: 2, butter: 1 }, time: 5400, xp: 14 },
    ],
  },
  loom: {
    name: 'Loom', unlockLevel: 14, cost: 1500, size: [2, 2], kit: 'kit_loom', minigame: 'weave_trace', queueSlots: 3,
    recipes: [
      { id: 'cotton_fabric', inputs: { cotton: 3 },        time: 1800, xp: 6 },
      { id: 'sweater',       inputs: { wool: 2 },          time: 3600, xp: 9 },
      { id: 'alpaca_scarf',   inputs: { alpaca_wool: 2, indigo: 1 },                  time: 5400,  xp: 34 },
    ],
  },
  sewing_machine: {
    name: 'Sewing Machine', unlockLevel: 20, cost: 2800, size: [2, 2], kit: 'kit_sewing_machine', minigame: 'stitch_line', queueSlots: 3,
    recipes: [
      { id: 'cotton_shirt', inputs: { cotton_fabric: 2 },            time: 3600, xp: 10 },
      { id: 'wooly_hat',    inputs: { wool: 1, cotton_fabric: 1 },   time: 4500, xp: 11 },
      { id: 'blue_hat',     inputs: { wool: 1, cotton_fabric: 1, indigo: 1 }, time: 7200, xp: 15 },
    ],
  },
  juice_press: {
    name: 'Juice Press', unlockLevel: 15, cost: 1700, size: [2, 2], kit: 'kit_juice_press', minigame: 'press_peak', queueSlots: 3,
    recipes: [
      { id: 'carrot_juice', inputs: { carrot: 3 },                 time: 1200, xp: 5 },
      { id: 'tomato_juice', inputs: { tomato: 2 },                 time: 2400, xp: 7 },
      { id: 'smoothie',     inputs: { strawberry: 2, milk: 1 },    time: 3600, xp: 10 },
      { id: 'grape_juice',  inputs: { grapes: 2 },                 time: 5400, xp: 14 },
    ],
  },
  jam_maker: {
    name: 'Jam Maker', unlockLevel: 22, cost: 3600, size: [2, 2], kit: 'kit_jam_maker', minigame: 'heat_band', queueSlots: 3,
    recipes: [
      { id: 'strawberry_jam', inputs: { strawberry: 3, sugar: 1 }, time: 4500, xp: 11 },
      { id: 'honey_jam',      inputs: { honey: 1, sugar: 2 },      time: 5400, xp: 13 },
      { id: 'grape_jam',      inputs: { grapes: 3, sugar: 1 },     time: 7200, xp: 16 },
    ],
  },
  coffee_kiosk: {
    name: 'Coffee Kiosk', unlockLevel: 30, cost: 6500, size: [2, 2], kit: 'kit_coffee_kiosk', minigame: 'shot_timing', queueSlots: 3,
    recipes: [
      { id: 'espresso',     inputs: { coffee: 2 },              time: 3600, xp: 10 },
      { id: 'latte',        inputs: { coffee: 2, milk: 1 },     time: 4500, xp: 12 },
      { id: 'honey_coffee', inputs: { coffee: 2, honey: 1 },    time: 6300, xp: 15 },
    ],
  },
  candy_machine: {
    name: 'Candy Machine', unlockLevel: 26, cost: 5000, size: [2, 2], kit: 'kit_candy_machine', minigame: 'mould_pour', queueSlots: 3,
    recipes: [
      { id: 'caramel',      inputs: { sugar: 2, cream: 1 },        time: 3600, xp: 9 },
      { id: 'honey_toffee', inputs: { honey: 1, brown_sugar: 1 },  time: 5400, xp: 12 },
      { id: 'chili_choc',   inputs: { chili: 1, sugar: 2, milk: 1 }, time: 7200, xp: 14 },
    ],
  },
  tropical_cafe: {
    name: 'Tropical Café', unlockLevel: 36, cost: 12000, size: [2, 2], kit: 'kit_tropical_cafe', minigame: 'garnish_stack', queueSlots: 3,
    recipes: [
      { id: 'banana_split',  inputs: { banana: 2, cream: 1, sugar: 1 },   time: 5400, xp: 14 },
      { id: 'pina_smoothie', inputs: { pineapple: 2, milk: 1 },           time: 6300, xp: 15 },
      { id: 'choco_banana',  inputs: { banana: 2, cocoa: 1, sugar: 1 },   time: 7200, xp: 16 },
      { id: 'vanilla_ice',   inputs: { vanilla: 1, cream: 2, sugar: 2 },  time: 9000, xp: 18 },
      { id: 'peach_melba',    inputs: { peach: 3, cream: 1 },                         time: 5400,  xp: 46 },
      { id: 'lime_cooler',    inputs: { key_lime: 2, watermelon_ex: 2 },              time: 6300,  xp: 54 },
      { id: 'coconut_cream',  inputs: { coconut: 3, milk: 2 },                        time: 7200,  xp: 62 },
      { id: 'mango_sorbet',   inputs: { mango: 3, plum: 2 },                          time: 8100,  xp: 70 },
      { id: 'aloe_tonic',     inputs: { aloe: 2, avocado: 2, honey: 1 },              time: 9000,  xp: 80 },
    ],
  },
  smelter: {
    name: 'Smelter', unlockLevel: 24, cost: 4200, size: [2, 2], kit: 'kit_smelter', minigame: 'bellows_timing', queueSlots: 2,
    recipes: [
      { id: 'silver_bar',   inputs: { ore_silver: 2 },   time: 3600,  xp: 9 },
      { id: 'gold_bar',     inputs: { ore_gold: 2 },     time: 5400,  xp: 12 },
      { id: 'platinum_bar', inputs: { ore_platinum: 2 }, time: 7200,  xp: 16 },
    ],
  },
  oil_press: {
    name: 'Oil Press', unlockLevel: 52, cost: 18000, size: [2, 2], kit: 'kit_oil_press', minigame: 'press_flow', queueSlots: 3,
    recipes: [
      { id: 'olive_oil',      inputs: { olive: 3 },                                   time: 2700,  xp: 22 },
      { id: 'herb_oil',       inputs: { olive: 2, mint: 2 },                          time: 3600,  xp: 28 },
      { id: 'lavender_oil',   inputs: { lavender: 3, olive: 1 },                      time: 4500,  xp: 34 },
    ],
  },
  tea_house: {
    name: 'Tea House', unlockLevel: 56, cost: 26000, size: [2, 2], kit: 'kit_tea_house', minigame: 'steep_timer', queueSlots: 3,
    recipes: [
      { id: 'green_tea',      inputs: { tea_leaf: 3 },                                time: 1800,  xp: 24 },
      { id: 'milk_tea',       inputs: { tea_leaf: 2, milk: 1 },                       time: 2700,  xp: 30 },
      { id: 'honey_tea',      inputs: { tea_leaf: 2, honey: 1 },                      time: 3600,  xp: 36 },
      { id: 'mint_tea',       inputs: { tea_leaf: 2, mint: 2 },                       time: 4500,  xp: 44 },
    ],
  },
  sushi_bar: {
    name: 'Sushi Bar', unlockLevel: 60, cost: 36000, size: [2, 2], kit: 'kit_sushi_bar', minigame: 'knife_work', queueSlots: 3,
    recipes: [
      { id: 'sushi_roll',     inputs: { rice: 5, fish_perch: 1 },                     time: 3600,  xp: 34 },
      { id: 'egg_sushi',      inputs: { rice: 5, egg: 3 },                            time: 4200,  xp: 40 },
      { id: 'rice_ball',      inputs: { rice: 6, quail_egg: 2 },                      time: 5400,  xp: 48 },
    ],
  },
  perfumery: {
    name: 'Perfumery', unlockLevel: 64, cost: 50000, size: [2, 2], kit: 'kit_perfumery', minigame: 'blend_nose', queueSlots: 3,
    recipes: [
      { id: 'air_freshener',  inputs: { lavender: 3 },                                time: 4500,  xp: 42 },
      { id: 'perfume',        inputs: { peony: 3, lavender: 2 },                      time: 6300,  xp: 56 },
      { id: 'lotion',         inputs: { peony: 2, olive_oil: 1 },                     time: 5400,  xp: 50 },
    ],
  },
  salad_bar: {
    name: 'Salad Bar', unlockLevel: 68, cost: 68000, size: [2, 2], kit: 'kit_salad_bar', minigame: 'plate_toss', queueSlots: 3,
    recipes: [
      { id: 'garden_salad',   inputs: { bell_pepper: 2, tomato: 2 },                  time: 3600,  xp: 44 },
      { id: 'feta_salad',     inputs: { goat_cheese: 1, olive: 2, bell_pepper: 1 },   time: 5400,  xp: 58 },
      { id: 'fruit_salad',    inputs: { watermelon: 2, strawberry: 2 },               time: 4500,  xp: 52 },
    ],
  },
  pasta_kitchen: {
    name: 'Pasta Kitchen', unlockLevel: 72, cost: 90000, size: [2, 2], kit: 'kit_pasta_kitchen', minigame: 'dough_stretch', queueSlots: 3,
    recipes: [
      { id: 'fresh_pasta',    inputs: { wheat: 2, egg: 1 },                           time: 1800,  xp: 30 },
      { id: 'lasagna',        inputs: { fresh_pasta: 2, tomato: 3, cheese: 1 },       time: 6300,  xp: 66 },
      { id: 'pesto_pasta',    inputs: { fresh_pasta: 2, mint: 2, olive_oil: 1 },      time: 5400,  xp: 62 },
    ],
  },
  fondue_pot: {
    name: 'Fondue Pot', unlockLevel: 76, cost: 120000, size: [2, 2], kit: 'kit_fondue_pot', minigame: 'melt_stir', queueSlots: 3,
    recipes: [
      { id: 'cheese_fondue',  inputs: { cheese: 2, bread: 1 },                        time: 4500,  xp: 56 },
      { id: 'choco_fondue',   inputs: { cocoa: 2, cream: 1, strawberry: 2 },          time: 6300,  xp: 72 },
      { id: 'herb_fondue',    inputs: { cheese: 2, bell_pepper: 2, olive_oil: 1 },    time: 7200,  xp: 80 },
    ],
  },
  preservation_station: {
    name: 'Preservation Station', unlockLevel: 80, cost: 155000, size: [2, 2], kit: 'kit_preservation_station', minigame: 'jar_seal', queueSlots: 3,
    recipes: [
      { id: 'pickles',        inputs: { bell_pepper: 3, watermelon: 1 },              time: 9000,  xp: 70 },
      { id: 'canned_fish',    inputs: { fish_trout: 2, olive_oil: 1 },                time: 10800, xp: 84 },
      { id: 'smoked_sturgeon', inputs: { fish_sturgeon: 2, mint: 1 },                  time: 12600, xp: 96 },
      { id: 'caviar_tin',     inputs: { fish_sturgeon: 1, fish_barb: 1 },             time: 16200, xp: 120 },
      { id: 'dried_fruit',    inputs: { grapes: 2, strawberry: 2 },                   time: 8100,  xp: 66 },
    ],
  },
  jeweler: {
    name: 'Jeweler', unlockLevel: 85, cost: 200000, size: [2, 2], kit: 'kit_jeweler', minigame: 'stone_set', queueSlots: 3,
    recipes: [
      { id: 'pearl_necklace', inputs: { pearls: 3, silver_bar: 1 },                   time: 12600, xp: 110 },
      { id: 'gold_ring',      inputs: { gold_bar: 2, pearls: 1 },                     time: 14400, xp: 125 },
      { id: 'plume_brooch',   inputs: { turkey_plume: 2, platinum_bar: 1 },           time: 16200, xp: 145 },
    ],
  },
  yogurt_maker: {
    name: 'Yogurt Maker', unlockLevel: 90, cost: 260000, size: [2, 2], kit: 'kit_yogurt_maker', minigame: 'culture_temp', queueSlots: 3,
    recipes: [
      { id: 'plain_yogurt',   inputs: { milk: 3, cream: 1 },                          time: 5400,  xp: 62 },
      { id: 'berry_yogurt',   inputs: { plain_yogurt: 1, strawberry: 3 },             time: 7200,  xp: 78 },
      { id: 'mint_yogurt',    inputs: { plain_yogurt: 1, mint: 2, honey: 1 },         time: 8100,  xp: 86 },
    ],
  },
  // The Building Workshop is the spine of progression: coins alone never place a
  // production building. Raw MATERIALS become components here, components become a kit,
  // and the kit is consumed to place its building (BUILDINGS[x].kit). It is itself
  // coin-only, as are feed_mill and bakery, so the tutorial never dead-ends.
  build_workshop: {
    name: 'Building Workshop', unlockLevel: 6, cost: 900, size: [3, 2], minigame: 'workshop_fit', queueSlots: 3,
    minigame: 'workshop_fit',
    recipes: [
      { id: 'shingle',              inputs: { slab: 1, nails: 1 },                              time: 600,   xp: 3 },
      { id: 'beam',                 inputs: { brick: 1, nails: 2 },                             time: 900,   xp: 4 },
      { id: 'frame',                inputs: { timber: 1, nails: 2 },                            time: 1200,  xp: 5 },
      { id: 'panel',                inputs: { slab: 2, paint: 1 },                              time: 1500,  xp: 6 },
      { id: 'fitting',              inputs: { hammer: 1, wire: 1 },                             time: 1800,  xp: 7 },
      { id: 'glazing',              inputs: { glass: 2, fitting: 1 },                           time: 2400,  xp: 9 },
      { id: 'wiring_loom',          inputs: { wire: 2, rope: 1 },                               time: 3000,  xp: 11 },
      { id: 'plumbing',             inputs: { cement: 1, fitting: 2 },                          time: 3600,  xp: 13 },
      { id: 'kit_dairy',            inputs: { frame: 2, panel: 2, shingle: 3 },                 time: 5400,  xp: 20 },
      { id: 'kit_sugar_mill',       inputs: { beam: 2, frame: 2, shingle: 3 },                  time: 6300,  xp: 23 },
      { id: 'kit_popcorn_pot',      inputs: { beam: 2, panel: 3, fitting: 1 },                  time: 7200,  xp: 26 },
      { id: 'kit_grill',            inputs: { beam: 3, fitting: 2, shingle: 4 },                time: 8100,  xp: 29 },
      { id: 'kit_pie_oven',         inputs: { brick: 4, beam: 3, plumbing: 1 },                 time: 9000,  xp: 33 },
      { id: 'kit_loom',             inputs: { frame: 4, panel: 3, wiring_loom: 1 },             time: 10800, xp: 37 },
      { id: 'kit_sewing_machine',   inputs: { frame: 4, fitting: 3, wiring_loom: 1 },           time: 12600, xp: 42 },
      { id: 'kit_juice_press',      inputs: { beam: 4, plumbing: 2, glazing: 2 },               time: 14400, xp: 47 },
      { id: 'kit_jam_maker',        inputs: { panel: 5, glazing: 2, plumbing: 2 },              time: 16200, xp: 53 },
      { id: 'kit_coffee_kiosk',     inputs: { glazing: 3, wiring_loom: 2, panel: 4 },           time: 18000, xp: 59 },
      { id: 'kit_candy_machine',    inputs: { fitting: 5, wiring_loom: 3, beam: 4 },            time: 21600, xp: 66 },
      { id: 'kit_tropical_cafe',    inputs: { glazing: 4, plumbing: 3, frame: 6 },              time: 25200, xp: 74 },
      { id: 'kit_smelter',          inputs: { beam: 8, cement: 4, plumbing: 3 },                time: 28800, xp: 84 },
      { id: 'kit_oil_press',          inputs: { beam: 3, plumbing: 2, panel: 3 },             time: 32400, xp: 92 },
      { id: 'kit_tea_house',          inputs: { frame: 4, glazing: 3, shingle: 5, tile: 4 },           time: 36300, xp: 103 },
      { id: 'kit_sushi_bar',          inputs: { panel: 5, glazing: 3, fitting: 3 },           time: 40680, xp: 115 },
      { id: 'kit_perfumery',          inputs: { glazing: 5, fitting: 4, wiring_loom: 2 },     time: 45540, xp: 129 },
      { id: 'kit_salad_bar',          inputs: { frame: 5, panel: 5, plumbing: 2 },            time: 51000, xp: 144 },
      { id: 'kit_pasta_kitchen',      inputs: { beam: 5, fitting: 4, plumbing: 3 },           time: 57120, xp: 161 },
      { id: 'kit_fondue_pot',         inputs: { fitting: 6, wiring_loom: 3, cement: 3 },      time: 63960, xp: 180 },
      { id: 'kit_preservation_station', inputs: { glazing: 6, plumbing: 4, beam: 5, electric_saw: 2 },           time: 71640, xp: 202 },
      { id: 'kit_jeweler',            inputs: { glazing: 7, fitting: 6, wiring_loom: 4, jackhammer: 2 },     time: 80220, xp: 226 },
      { id: 'kit_yogurt_maker',       inputs: { plumbing: 5, panel: 7, wiring_loom: 4, drill: 3 },      time: 89820, xp: 253 },
    ],
  },
};

/**
 * Per-factory minigames. Every production building has ONE, and each does something only
 * that factory would plausibly do - this is not one minigame reskinned sixteen times.
 *
 * They are an OPTIONAL BONUS LAYER and that is load-bearing: production runs normally
 * whether or not the player ever touches one. Gating a recipe behind hand-eye skill would
 * break the idle contract and punish offline play, which the absolute-readyAt timestamp
 * model exists to protect.
 *
 * effect keys come from EFFECT_KEYS, shared with the Laboratory, so bonuses from a
 * minigame and a research node compose through one code path instead of two.
 * cap is the maximum bonus a perfect run can grant, so no bonus is farmable without bound.
 */
export const MINIGAMES = {
  grain_sort:      { name: 'Grain Sort',         building: 'feed_mill',       effect: 'seedRefundChance',   cap: 0.25, purpose: 'Sort the good grain from the chaff. Clean batches hand seed back.' },
  knead_dough:     { name: 'Knead the Dough',    building: 'bakery',          effect: 'bonusYield',         cap: 0.3,  purpose: 'Knead to the rhythm. Well-worked dough rises into an extra loaf.' },
  churn_timing:    { name: 'Churn Timing',       building: 'dairy',           effect: 'speedMult',          cap: 0.2,  purpose: 'Hold the churn at the right speed to finish the batch sooner.' },
  press_pressure:  { name: 'Press Pressure',     building: 'sugar_mill',      effect: 'extraOutput',        cap: 0.25, purpose: 'Lean on the press without cracking it. More cane, more sugar.' },
  pop_catch:       { name: 'Catch the Pops',     building: 'popcorn_pot',     effect: 'byproductChance',    cap: 0.35, purpose: 'Catch kernels as they fly. Strays become a second snack.' },
  flip_timing:     { name: 'Flip Timing',        building: 'grill',           effect: 'sellPriceMult',      cap: 0.2,  purpose: 'Flip at the sear, not after. Char sells for more.' },
  crimp_pattern:   { name: 'Crimp the Crust',    building: 'pie_oven',        effect: 'xpMult',             cap: 0.3,  purpose: 'Trace the crimp around the rim. A neat pie teaches a neat baker.' },
  weave_trace:     { name: 'Weave the Pattern',  building: 'loom',            effect: 'rarityTier',         cap: 0.2,  purpose: 'Follow the pattern thread. A clean weave lifts the cloth a tier.' },
  stitch_line:     { name: 'Hold the Seam',      building: 'sewing_machine',  effect: 'fabricSaveChance',   cap: 0.25, purpose: 'Keep the seam straight and the offcut is big enough to reuse.' },
  press_peak:      { name: 'Press at Peak',      building: 'juice_press',     effect: 'juiceYieldBonus',    cap: 0.3,  purpose: 'Stop the press at peak flow. Overpressing bruises the fruit.' },
  heat_band:       { name: 'Hold the Heat',      building: 'jam_maker',       effect: 'setQualityBonus',    cap: 0.25, purpose: 'Keep the pot inside the setting band. A firm set fills an extra jar.' },
  shot_timing:     { name: 'Pull the Shot',      building: 'coffee_kiosk',    effect: 'rushHourChance',     cap: 0.3,  purpose: 'Pull to the timing window. A good crema brings the morning rush.' },
  mould_pour:      { name: 'Pour the Moulds',    building: 'candy_machine',   effect: 'mouldPrecision',     cap: 0.25, purpose: 'Pour clean into every mould. Spillage sets into offcut sweets.' },
  garnish_stack:   { name: 'Stack the Garnish',  building: 'tropical_cafe',   effect: 'tipChance',          cap: 0.35, purpose: 'Balance the garnish. A drink that looks the part earns a tip.' },
  bellows_timing:  { name: 'Work the Bellows',   building: 'smelter',         effect: 'purityChance',       cap: 0.2,  purpose: 'Time the bellows to hold the heat. Hotter metal pours purer.' },
  workshop_fit:    { name: 'Fit the Frame',      building: 'build_workshop',  effect: 'materialRefund',     cap: 0.25, purpose: 'Line the joints up before fixing. A tight fit leaves offcuts over.' },
  press_flow:      { name: 'Watch the Flow',     building: 'oil_press',              effect: 'oilClarity',         cap: 0.25, purpose: 'Keep the flow steady. Cloudy oil is worth less than clear.' },
  steep_timer:     { name: 'Steep the Leaves',   building: 'tea_house',              effect: 'steepQuality',       cap: 0.3,  purpose: 'Pull the leaves at the right moment. Over-steeped tea turns bitter.' },
  knife_work:      { name: 'Knife Work',         building: 'sushi_bar',              effect: 'knifePrecision',     cap: 0.25, purpose: 'Slice clean and even. A ragged cut ruins the roll.' },
  blend_nose:      { name: 'Blend the Notes',    building: 'perfumery',              effect: 'blendHarmony',       cap: 0.3,  purpose: 'Balance top and base notes. One loud note flattens the blend.' },
  plate_toss:      { name: 'Toss the Bowl',      building: 'salad_bar',              effect: 'plateFreshness',     cap: 0.25, purpose: 'Toss without bruising. Handled well, the leaves stay crisp.' },
  dough_stretch:   { name: 'Stretch the Dough',  building: 'pasta_kitchen',          effect: 'doughStretch',       cap: 0.3,  purpose: 'Stretch thin without tearing. Thin sheets cook true.' },
  melt_stir:       { name: 'Stir the Melt',      building: 'fondue_pot',             effect: 'meltEvenness',       cap: 0.25, purpose: 'Keep it moving. A fondue left still catches and splits.' },
  jar_seal:        { name: 'Seal the Jars',      building: 'preservation_station',   effect: 'sealTightness',      cap: 0.3,  purpose: 'Seat every lid square. A poor seal spoils the batch.' },
  stone_set:       { name: 'Set the Stone',      building: 'jeweler',                effect: 'settingAccuracy',    cap: 0.2,  purpose: 'Seat the stone dead centre. Off-centre and the claw shows.' },
  culture_temp:    { name: 'Hold the Culture',   building: 'yogurt_maker',           effect: 'cultureVigour',      cap: 0.3,  purpose: 'Hold the warmth steady. A cold spot and the culture stalls.' },
};

/**
 * The closed set of effect keys a bonus may carry. Shared by MINIGAMES and (later) the
 * Laboratory research tree, so every multiplier in the game resolves through one merge
 * point. Adding a key here is a deliberate act; the validator refuses anything else.
 */
export const EFFECT_KEYS = [
  'seedRefundChance', 'bonusYield', 'speedMult', 'extraOutput',
  'byproductChance', 'sellPriceMult', 'xpMult', 'rarityTier',
  'fabricSaveChance', 'juiceYieldBonus', 'setQualityBonus', 'rushHourChance',
  'mouldPrecision', 'tipChance', 'purityChance', 'materialRefund',
  'oilClarity', 'steepQuality', 'knifePrecision', 'blendHarmony', 'plateFreshness',
  'doughStretch', 'meltEvenness', 'sealTightness', 'settingAccuracy', 'cultureVigour',
  // reserved for Laboratory research (step 7); listed now so both consumers share one set
  'cropGrowMult', 'productionTimeMult', 'animalProduceMult',
  'siloCapBonus', 'barnCapBonus', 'orderPayoutMult',
  'mineYieldBonus', 'fishRareChance', 'zooIncomeMult',
];

/** Fishing: species pool weighted by rarity + chest odds. Cast uses a timing minigame. */
export const FISHING = {
  unlockLevel: 12,
  castTime: 20, // seconds until the catch window
  species: ['fish_perch', 'fish_trout', 'fish_carp', 'fish_bass', 'fish_pike', 'fish_catfish', 'fish_salmon', 'fish_golden', 'fish_sturgeon', 'fish_zander', 'fish_huchen', 'fish_arctic', 'fish_barb', 'fish_moonfish'],
  rarityWeights: { common: 60, uncommon: 30, rare: 10 },
  chestChance: 0.08, // treasure chest instead of a fish
  chestLoot: [
    { coins: [50, 200], weight: 60 },
    { diamonds: [1, 3], weight: 25 },
    { item: 'pickaxe', qty: [1, 2], weight: 10 },
    { item: 'dynamite', qty: [1, 1], weight: 5 },
  ],
};

/** Mine: tool → yield table. */
export const MINE = {
  unlockLevel: 24,
  tools: {
    pickaxe:  { yields: [{ item: 'ore_silver', qty: [1, 2], weight: 60 }, { item: 'ore_gold', qty: [1, 1], weight: 30 }, { item: 'ore_platinum', qty: [1, 1], weight: 9 }, { item: 'gem', qty: [1, 1], weight: 1 }] },
    dynamite: { yields: [{ item: 'ore_silver', qty: [2, 4], weight: 40 }, { item: 'ore_gold', qty: [1, 3], weight: 35 }, { item: 'ore_platinum', qty: [1, 2], weight: 20 }, { item: 'gem', qty: [1, 1], weight: 5 }] },
  },
};

/**
 * Merge Meadow — Township-style merge minigame on its own board.
 * Generators spawn tier-1 items (costing energy); drag two identical items together to
 * merge into the next tier. Top tiers pay out rewards into the main farm economy.
 * Energy regenerates over time; board state persists in the save.
 */
export const MERGE = {
  unlockLevel: 11,
  board: { cols: 7, rows: 9 },
  energy: { max: 100, regenSeconds: 90, costPerSpawn: 1 },
  /** Generators sit on the board and spawn tier-1 items of their chain when tapped. */
  generators: {
    toolbox:    { name: 'Toolbox',      chain: 'tools',   spawnBatch: [1, 3] },
    seed_sack:  { name: 'Seed Sack',    chain: 'plants',  spawnBatch: [1, 3] },
    gift_box:   { name: 'Gift Box',     chain: 'treats',  spawnBatch: [1, 2] },
  },
  /** Chains: item tiers low → high. Merging 2 of tier n yields 1 of tier n+1. */
  chains: {
    tools: {
      name: 'Tools',
      tiers: ['Nail', 'Hammer', 'Saw', 'Drill', 'Toolkit', 'Workbench', 'Golden Workbench'],
      /** Reward when the top tier is tapped/claimed (removed from board). */
      topReward: { coins: 2500, item: 'pickaxe', qty: 3 },
      /** Mid-chain claims: tier index → reward (claiming removes the item). */
      claims: { 3: { coins: 120 }, 4: { coins: 400 }, 5: { coins: 1000, diamonds: 1 } },
    },
    plants: {
      name: 'Plants',
      tiers: ['Sprout', 'Seedling', 'Herb Pot', 'Flower Box', 'Shrub', 'Fruit Tree', 'Tree of Plenty'],
      topReward: { coins: 2000, diamonds: 3 },
      claims: { 3: { coins: 100 }, 4: { coins: 350 }, 5: { coins: 900, item: 'dynamite', qty: 1 } },
    },
    treats: {
      name: 'Treats',
      tiers: ['Crumb', 'Cookie Bite', 'Cupcake', 'Cake Slice', 'Layer Cake', 'Wedding Cake'],
      topReward: { coins: 3000, vouchers: 5 },
      claims: { 2: { coins: 80 }, 3: { coins: 250 }, 4: { coins: 800, diamonds: 1 } },
    },
  },
  /** Occasional bonus drops when merging: small chance of coins/energy bubbles. */
  mergeBonus: { chance: 0.12, loot: [{ coins: [20, 80], weight: 70 }, { energy: [5, 15], weight: 30 }] },
};

/** Decorations — cosmetic, placeable. voucher items are boat-exclusive. */
export const DECORATIONS = {
  fence_wood:   { name: 'Wooden Fence',  cost: 30,   size: [1, 1] },
  fence_stone:  { name: 'Stone Fence',   cost: 60,   size: [1, 1] },
  fence_white:  { name: 'White Picket',  cost: 90,   size: [1, 1] },
  flowerbed:    { name: 'Flowerbed',     cost: 120,  size: [1, 1] },
  path_stone:   { name: 'Stone Path',    cost: 25,   size: [1, 1] },
  tree_oak:     { name: 'Oak Tree',      cost: 200,  size: [1, 1] },
  tree_pine:    { name: 'Pine Tree',     cost: 200,  size: [1, 1] },
  hay_bale:     { name: 'Hay Bale',      cost: 80,   size: [1, 1] },
  scarecrow:    { name: 'Scarecrow',     cost: 350,  size: [1, 1] },
  gnome:        { name: 'Garden Gnome',  cost: 500,  size: [1, 1] },
  fountain:     { name: 'Fountain',      cost: 1500, size: [2, 2] },
  windmill:     { name: 'Windmill',      cost: 3000, size: [2, 2] },
  // voucher-exclusive (boat currency)
  golden_statue:{ name: 'Golden Cow Statue', voucherCost: 40, size: [2, 2] },
  lily_pond:    { name: 'Lily Pond',         voucherCost: 25, size: [2, 2] },
  topiary:      { name: 'Topiary Horse',     voucherCost: 15, size: [1, 1] },
  // event-exclusive (gold tier of weekend events / Fair Pass) — no coin price
  bunting_fence:   { name: 'Bunting Fence',    eventOnly: true, size: [1, 1] },
  festival_tent:   { name: 'Festival Tent',    eventOnly: true, size: [2, 2] },
  prize_trophy:    { name: 'Prize Trophy',     eventOnly: true, size: [1, 1] },
  balloon_cluster: { name: 'Balloon Cluster',  eventOnly: true, size: [1, 1] },
  trophy_bronze:   { name: 'Bronze Fair Trophy', eventOnly: true, size: [1, 1] },
  trophy_silver:   { name: 'Silver Fair Trophy', eventOnly: true, size: [1, 1] },
  trophy_gold:     { name: 'Golden Fair Trophy', eventOnly: true, size: [2, 2] },
  golden_town_statue: { name: 'Golden Town Statue', eventOnly: true, size: [2, 2] },
  // holiday-limited (purchasable only in season; owned ones persist)
  snowman:        { name: 'Snowman',         cost: 600,  size: [1, 1], holiday: 'winter_holiday' },
  string_lights:  { name: 'String Lights',   cost: 400,  size: [1, 1], holiday: 'winter_holiday' },
  pumpkin_pile:   { name: 'Pumpkin Pile',    cost: 450,  size: [1, 1], holiday: 'harvest_fest' },
  cherry_blossom: { name: 'Cherry Blossom',  cost: 800,  size: [1, 1], holiday: 'spring_bloom' },
  beach_chair:    { name: 'Beach Chair',     cost: 350,  size: [1, 1], holiday: 'summer_splash' },
  // --- expansion decorations (levels 51+) ---
  // coin-bought, late tier
  stone_arch:         { name: 'Stone Arch',         cost: 1800,  size: [2, 1] },
  clock_tower:        { name: 'Clock Tower',        cost: 4200,  size: [2, 2] },
  duck_pond_deco:     { name: 'Ornamental Pond',    cost: 2600,  size: [2, 2] },
  flower_arch:        { name: 'Flower Arch',        cost: 1500,  size: [1, 1] },
  hedge_maze:         { name: 'Hedge Maze',         cost: 6800,  size: [3, 3] },
  stone_bridge:       { name: 'Stone Bridge',       cost: 3100,  size: [2, 1] },
  wishing_well:       { name: 'Wishing Well',       cost: 2200,  size: [1, 1] },
  sun_dial:           { name: 'Sundial',            cost: 1700,  size: [1, 1] },
  orchard_row:        { name: 'Orchard Row',        cost: 3600,  size: [3, 1] },
  lamp_post:          { name: 'Lamp Post',          cost: 900,   size: [1, 1] },
  picnic_set:         { name: 'Picnic Set',         cost: 1300,  size: [2, 1] },
  weather_vane:       { name: 'Weather Vane',       cost: 2000,  size: [1, 1] },
  // voucher-bought
  crystal_fountain:   { name: 'Crystal Fountain',   voucherCost: 18, size: [2, 2] },
  marble_arch:        { name: 'Marble Arch',        voucherCost: 24, size: [2, 1] },
  koi_pond:           { name: 'Koi Pond',           voucherCost: 30, size: [2, 2] },
  glass_house:        { name: 'Glass House',        voucherCost: 38, size: [2, 2] },
  // event rewards
  harvest_wagon:      { name: 'Harvest Wagon',      eventOnly: true, size: [2, 1] },
  ribbon_pole:        { name: 'Ribbon Pole',        eventOnly: true, size: [1, 1] },
  fair_carousel:      { name: 'Fair Carousel',      eventOnly: true, size: [3, 3] },
  banner_wall:        { name: 'Banner Wall',        eventOnly: true, size: [2, 1] },
  // earned only from the new subsystems - each needs its own flag, so the validator
  // learns three new ways a decoration can be legitimately unbuyable
  coop_flagpole:      { name: 'Co-op Flagpole',     coopOnly: true,   size: [1, 1] },
  regatta_buoy:       { name: 'Regatta Buoy',       regattaOnly: true, size: [1, 1] },
  relic_plinth:       { name: 'Relic Plinth',       museumOnly: true, size: [1, 1] },
  fossil_display:     { name: 'Fossil Display',     museumOnly: true, size: [2, 1] },
};

/** Level curve + per-level unlocks (levels 1–40, an unlock at every level). */
export const LEVELS = {
  maxLevel: 95,
  /**
   * XP to go from level n to n+1. PIECEWISE on purpose: the original 50*n^1.8 curve is kept
   * exactly for n <= 50, so every level the game already shipped costs precisely what it did
   * before. Above 50 the exponent eases to 1.65, because at a flat 1.8 level 95 alone would
   * cost about 190k XP and levels 51-95 several million - an endgame nobody reaches.
   * The two halves are joined at 50 so there is no jump at the seam.
   */
  xpForLevel: (n) => (n <= 50
    ? Math.round(50 * Math.pow(n, 1.8))
    : Math.round(50 * Math.pow(50, 1.8) * Math.pow(n / 50, 1.65))),
  /** Feature/content gates. Anything not listed unlocks via its own unlockLevel field. */
  unlocks: {
    1:  ['field', 'wheat'],
    2:  ['corn', 'chicken'],
    3:  ['bakery', 'orders_board', 'carrot'],
    4:  ['expansion_1'],
    5:  ['feed_mill', 'soybean'],
    6:  ['cow', 'build_workshop', 'dairy'],
    7:  ['sugarcane'],
    8:  ['truck', 'sugar_mill'],
    9:  ['cotton', 'popcorn_pot', 'market'],
    10: ['pig', 'pets'],
    11: ['tomato', 'merge_meadow'],
    12: ['fishing', 'grill'],
    13: ['potato', 'expansion_2'],
    14: ['sheep', 'loom'],
    15: ['strawberry', 'juice_press'],
    16: ['pie_oven'],
    17: ['boat'],
    18: ['pumpkin'],
    19: ['goat', 'expansion_3'],
    20: ['sewing_machine', 'town'],
    21: ['indigo', 'trains'],
    22: ['jam_maker'],
    23: ['bee'],
    24: ['mine', 'smelter'],
    25: ['chili', 'expansion_4'],
    26: ['candy_machine'],
    27: ['duck'],
    28: ['expansion_5', 'airport'],
    29: ['coffee'],
    30: ['coffee_kiosk'],
    31: ['expansion_6'],
    32: ['silo_mega_upgrade'],
    33: ['grapes'],
    34: ['barn_mega_upgrade', 'zoo', 'zoo_peacock', 'zoo_monkey'],
    35: ['expansion_7'],
    36: ['golden_fields', 'islands', 'isle_palm', 'tropical_cafe'],
    37: ['expansion_8'],
    38: ['master_orders'],
    39: ['expansion_9'],
    40: ['golden_windmill'],
    41: ['zoo_penguin'],
    42: ['zoo_flamingo'],
    43: ['isle_coral'],
    44: ['zoo_lion'],
    45: ['isle_lagoon'],
    46: ['zoo_panda'],
    47: ['isle_volcano'],
    48: ['zoo_giraffe'],
    49: ['town_mega_milestone'],
    50: ['zoo_elephant', 'golden_town_statue'],
    // Levels 51-95. Every level carries at least one unlock: the validator refuses a
    // dead level, which is what keeps the late game from becoming a silent XP corridor.
    51: ['rice'],
    52: ['oil_press', 'isle_frutus'],
    53: ['lamb'],
    54: ['expansion_10'],
    55: ['olive'],
    56: ['tea_house', 'zoo_otter'],
    57: ['silo_titan_upgrade'],
    58: ['lavender', 'quail', 'isle_olivia'],
    59: ['expansion_11'],
    60: ['sushi_bar'],
    61: ['barn_titan_upgrade'],
    62: ['tea_leaf', 'zoo_toucan'],
    63: ['expansion_12'],
    64: ['perfumery', 'alpaca'],
    65: ['golden_meadow'],
    66: ['bell_pepper', 'isle_fishers'],
    67: ['expansion_13'],
    68: ['salad_bar', 'zoo_koala'],
    69: ['master_orders_ii'],
    70: ['grand_fair'],
    71: ['peony'],
    72: ['pasta_kitchen', 'otter'],
    73: ['expansion_14'],
    74: ['harvest_festival', 'isle_bonita'],
    75: ['deep_silo', 'zoo_tiger'],
    76: ['fondue_pot'],
    77: ['watermelon'],
    78: ['expansion_15'],
    79: ['golden_barn'],
    80: ['preservation_station'],
    81: ['prize_pavilion'],
    82: ['turkey'],
    83: ['master_grower', 'zoo_polar'],
    84: ['mint'],
    85: ['jeweler'],
    86: ['gilded_orders'],
    87: ['master_rancher'],
    88: ['grand_market'],
    89: ['master_crafter'],
    90: ['yogurt_maker'],
    91: ['legend_trucks', 'zoo_rhino'],
    92: ['legend_boats'],
    93: ['legend_trains'],
    94: ['master_farmer'],
    95: ['golden_farm_crown'],
  },
};

/**
 * Silo (crops) and barn (goods) capacity. Upgrades cost coins AND the STORAGE material
 * set - Hay Day charges three material types per upgrade, the count stepping up by one
 * each level (upgrade n needs n+2 of each). Silo and barn take different trios so one
 * cannot be starved to feed the other.
 */
export const STORAGE = {
  silo: {
    baseCapacity: 50, upgradeStep: 25, upgradeCostBase: 150, upgradeCostFactor: 1.6,
    materials: ['screw', 'wood_panel', 'bracket'],
    materialBase: 3,      // upgrade 1 needs 3 of each
    materialStep: 1,      // +1 of each per subsequent upgrade
  },
  barn: {
    baseCapacity: 50, upgradeStep: 25, upgradeCostBase: 200, upgradeCostFactor: 1.6,
    materials: ['bolt', 'plank', 'duct_tape'],
    materialBase: 3,
    materialStep: 1,
  },
};

/** Order board / truck / boat tuning. */
export const ORDERS = {
  board: { slots: 6, refreshCooldown: 300, unlockLevel: 3, itemsPerOrder: [1, 3], payoutMultiplier: 1.35, xpMultiplier: 2 },
  truck: { unlockLevel: 8, interval: 900, bundles: 3, bonusMultiplier: 1.6 },
  boat:  { unlockLevel: 17, interval: 7200, crates: 6, departureWindow: 3600, bonusMultiplier: 2.0, vouchersPerBoat: [4, 10] },
};

/** Roadside shop stand. */
export const SHOP = {
  slots: 8, unlockLevel: 4,
  priceBand: [0.7, 1.5],       // min/max multiplier over base sellPrice
  sellTimeBase: 120,            // seconds at max price; cheaper listings sell faster
};

// ============================== TOWNSHIP LAYER ==============================

/**
 * Construction materials, split into four purpose-scoped SETS (the Township model - the
 * game keeps separate material economies rather than one undifferentiated pile):
 *
 *   building  - town houses, community buildings, zoo enclosures
 *   expansion - farm land expansions and island unlocks
 *   storage   - silo and barn capacity upgrades (Hay Day: three types per upgrade)
 *   advanced  - late-tier buildings; Tool Exchange only, never from trains
 *
 * Stored in the barn. Sources: trains, airport, helicopter, mine chests, expeditions,
 * event rewards. Every material must appear in at least one source pool AND at least one
 * build cost, which tools/validate-data.mjs enforces.
 */
export const MATERIALS = {
  // building
  brick:        { name: 'Brick',        set: 'building',  sellPrice: 30 },
  slab:         { name: 'Slab',         set: 'building',  sellPrice: 30 },
  glass:        { name: 'Glass',        set: 'building',  sellPrice: 30 },
  paint:        { name: 'Paint',        set: 'building',  sellPrice: 35 },
  hammer:       { name: 'Hammer',       set: 'building',  sellPrice: 35 },
  nails:        { name: 'Nails',        set: 'building',  sellPrice: 25 },
  cement:       { name: 'Cement',       set: 'building',  sellPrice: 45 },
  tile:         { name: 'Roof Tile',    set: 'building',  sellPrice: 45 },
  // expansion (Township: shovel / axe / saw)
  shovel:       { name: 'Shovel',       set: 'expansion', sellPrice: 60 },
  axe:          { name: 'Axe',          set: 'expansion', sellPrice: 60 },
  saw:          { name: 'Saw',          set: 'expansion', sellPrice: 60 },
  // storage (Hay Day: barn and silo each take their own trio)
  bolt:         { name: 'Bolt',         set: 'storage',   sellPrice: 40 },
  plank:        { name: 'Plank',        set: 'storage',   sellPrice: 40 },
  duct_tape:    { name: 'Duct Tape',    set: 'storage',   sellPrice: 40 },
  screw:        { name: 'Screw',        set: 'storage',   sellPrice: 40 },
  wood_panel:   { name: 'Wood Panel',   set: 'storage',   sellPrice: 40 },
  bracket:      { name: 'Bracket',      set: 'storage',   sellPrice: 40 },
  // advanced (Tool Exchange only, never from trains)
  jackhammer:   { name: 'Jackhammer',   set: 'advanced',  sellPrice: 140 },
  drill:        { name: 'Drill',        set: 'advanced',  sellPrice: 140 },
  electric_saw: { name: 'Electric Saw', set: 'advanced',  sellPrice: 140 },
  wire:         { name: 'Wire',         set: 'advanced',  sellPrice: 90 },
  rope:         { name: 'Rope',         set: 'advanced',  sellPrice: 90 },
  timber:       { name: 'Timber',       set: 'advanced',  sellPrice: 90 },
};

/** The four material sets. Closed enum - validated. */
export const MATERIAL_SETS = ['building', 'expansion', 'storage', 'advanced'];

/**
 * The Town (L20): a reserved district on the world grid. Houses grant population;
 * community buildings raise the population cap; milestones pay rewards and gate tiers.
 * Township's growth loop, offline/solo.
 */
export const TOWN = {
  unlockLevel: 20,
  district: { x: 27, y: 27, w: 5, h: 5 }, // town district zone (own expansion path later)
  houses: {
    cottage:     { name: 'Cottage',       cost: 1200,  materials: { brick: 2, nails: 2 },            population: 4,  size: [1, 1], tier: 1 },
    cabin:       { name: 'Log Cabin',     cost: 2200,  materials: { slab: 3, nails: 2 },             population: 6,  size: [1, 1], tier: 1 },
    bungalow:    { name: 'Bungalow',      cost: 4000,  materials: { brick: 3, glass: 2 },            population: 9,  size: [1, 1], tier: 2 },
    duplex:      { name: 'Duplex',        cost: 7000,  materials: { brick: 4, slab: 3, paint: 2 },   population: 14, size: [2, 2], tier: 2 },
    townhouse:   { name: 'Townhouse',     cost: 12000, materials: { brick: 5, glass: 4, hammer: 2 }, population: 20, size: [2, 2], tier: 3 },
    cape_house:  { name: 'Cape House',    cost: 18000, materials: { slab: 6, paint: 4, nails: 4 },   population: 27, size: [2, 2], tier: 3 },
    villa:       { name: 'Villa',         cost: 28000, materials: { brick: 8, glass: 6, paint: 4 },  population: 36, size: [2, 2], tier: 4 },
    terrace_row: { name: 'Terrace Row',   cost: 40000, materials: { brick: 10, slab: 8, hammer: 4 }, population: 48, size: [2, 2], tier: 4 },
    loft_block:  { name: 'Loft Block',    cost: 60000, materials: { glass: 12, slab: 10, paint: 6 }, population: 62, size: [2, 2], tier: 5 },
    mansion:     { name: 'Mansion',       cost: 90000, materials: { brick: 14, glass: 10, hammer: 6, paint: 6 }, population: 80, size: [2, 2], tier: 5 },
    apartment_block:  { name: 'Apartment Block',  cost: 130000, materials: { brick: 18, glass: 14, cement: 8 },    population: 100, size: [2, 2], tier: 6 },
    courtyard_row:    { name: 'Courtyard Row',    cost: 180000, materials: { slab: 20, paint: 14, tile: 10 },      population: 125, size: [2, 2], tier: 6 },
    hillside_villas:  { name: 'Hillside Villas',  cost: 250000, materials: { brick: 24, glass: 18, cement: 12 },   population: 160, size: [2, 2], tier: 6 },
    riverside_lofts:  { name: 'Riverside Lofts',  cost: 340000, materials: { glass: 28, slab: 22, tile: 14 },      population: 205, size: [2, 2], tier: 7 },
    clocktower_flats: { name: 'Clocktower Flats', cost: 460000, materials: { brick: 32, hammer: 20, cement: 16 },  population: 260, size: [2, 2], tier: 7 },
    grand_estate:     { name: 'Grand Estate',     cost: 620000, materials: { brick: 40, glass: 30, tile: 20 },     population: 320, size: [2, 2], tier: 7 },
  },
  communityBuildings: {
    town_hall: { name: 'Town Hall',     cost: 5000,   materials: { brick: 4, slab: 4 },              capacity: 60,  size: [2, 2], tier: 1 },
    school:    { name: 'School',        cost: 12000,  materials: { brick: 6, glass: 4, nails: 4 },   capacity: 90,  size: [2, 2], tier: 2 },
    clinic:    { name: 'Clinic',        cost: 22000,  materials: { slab: 8, glass: 6, paint: 4 },    capacity: 120, size: [2, 2], tier: 3 },
    cinema:    { name: 'Cinema',        cost: 38000,  materials: { brick: 10, glass: 8, hammer: 4 }, capacity: 160, size: [2, 2], tier: 4 },
    pavilion:  { name: 'Park Pavilion', cost: 60000,  materials: { slab: 12, paint: 8, nails: 6 },   capacity: 210, size: [2, 2], tier: 4 },
    museum:    { name: 'Museum',        cost: 95000,  materials: { brick: 16, glass: 12, paint: 8 }, capacity: 280, size: [2, 2], tier: 5 },
    library:         { name: 'Library',           cost: 150000, materials: { brick: 20, glass: 14 },     capacity: 350, size: [2, 2], tier: 6 },
    sports_hall:     { name: 'Sports Hall',       cost: 220000, materials: { slab: 26, cement: 12 },     capacity: 460, size: [2, 2], tier: 6 },
    observatory:     { name: 'Observatory',       cost: 320000, materials: { glass: 30, hammer: 18 },    capacity: 620, size: [2, 2], tier: 7 },
    botanic_garden:  { name: 'Botanical Garden',  cost: 450000, materials: { slab: 34, paint: 24 },      capacity: 900, size: [2, 2], tier: 7 },
  },
  basePopulationCap: 30,
  /** Milestones by total population; each pays once and unlocks the next house/community tier. */
  milestones: [
    { population: 20,  rewards: { coins: 2000, diamonds: 2 }, unlocksTier: 2 },
    { population: 60,  rewards: { coins: 6000, diamonds: 3, materials: { brick: 4, slab: 4 } }, unlocksTier: 3 },
    { population: 140, rewards: { coins: 15000, diamonds: 5, materials: { glass: 6, paint: 4 } }, unlocksTier: 4 },
    { population: 260, rewards: { coins: 40000, diamonds: 8, materials: { hammer: 6, nails: 6 } }, unlocksTier: 5 },
    { population: 400, rewards: { coins: 100000, diamonds: 15 }, unlocksTier: 5 },
    { population: 600,  rewards: { coins: 90000,  diamonds: 12, materials: { cement: 8, tile: 6 } },   unlocksTier: 6 },
    { population: 900,  rewards: { coins: 150000, diamonds: 16, materials: { glass: 12, brick: 12 } }, unlocksTier: 6 },
    { population: 1400, rewards: { coins: 260000, diamonds: 22, materials: { cement: 14, tile: 12 } }, unlocksTier: 7 },
    { population: 2000, rewards: { coins: 420000, diamonds: 30, materials: { brick: 20, glass: 18 } }, unlocksTier: 7 },
  ],
};

/**
 * Trains (L21): cargo trains arrive with wagons requesting goods; filled trains depart
 * and return with construction materials — the engine of the materials economy.
 */
export const TRAINS = {
  unlockLevel: 21,
  interval: 10800,          // s between arrivals
  departureWindow: 7200,    // s before an unfilled train leaves without bonus
  wagons: [3, 5],           // wagons per train, scales with level
  tripTime: 3600,           // s away before returning with materials
  materialsPerTrip: [4, 8], // total material items returned (weighted random from MATERIALS)
  xpPerWagon: 12,
};

/**
 * Airport (L28): a cargo plane with crates of high-tier goods; pays XP + materials
 * (+ event points during Boat Race/production events). The Township materials/XP channel;
 * the boat remains the Hay Day voucher channel.
 */
export const AIRPORT = {
  unlockLevel: 28,
  interval: 14400,
  crates: 4,
  departureWindow: 5400,
  rewards: { xpPerCrate: 30, materialsPerFlight: [3, 6], fullBonusCoins: 5000 },
};

/**
 * Zoo (L34): enclosures for exotic species, fed farm goods on timers to produce zoo
 * souvenirs; visitors generate passive coin income; zoo orders mix zoo + farm goods.
 */
export const ZOO = {
  unlockLevel: 34,
  visitorIncomePerHour: (population) => Math.min(500, 40 + population * 2), // town pop drives visitors
  orderSlots: 3,
  enclosures: {
    zoo_peacock:  { name: 'Peacock Aviary',     cost: 15000, materials: { glass: 4, nails: 4 },  feed: { wheat: 10 },            produceTime: 7200,  product: 'peacock_feather', unlockLevel: 34 },
    zoo_monkey:   { name: 'Monkey Treehouse',   cost: 20000, materials: { slab: 5, nails: 4 },   feed: { banana: 3 },            produceTime: 9000,  product: 'monkey_plush',    unlockLevel: 34 },
    zoo_penguin:  { name: 'Penguin Pool',       cost: 28000, materials: { glass: 6, slab: 4 },   feed: { fish_perch: 6 },        produceTime: 10800, product: 'penguin_badge',   unlockLevel: 41 },
    zoo_flamingo: { name: 'Flamingo Lagoon',    cost: 34000, materials: { paint: 5, glass: 4 },  feed: { fish_trout: 5 },        produceTime: 10800, product: 'flamingo_pin',    unlockLevel: 42 },
    zoo_lion:     { name: 'Lion Rock',          cost: 45000, materials: { brick: 8, hammer: 4 }, feed: { bacon: 5 },             produceTime: 14400, product: 'lion_figurine',   unlockLevel: 44 },
    zoo_panda:    { name: 'Panda Grove',        cost: 60000, materials: { slab: 8, paint: 5 },   feed: { sugarcane: 12 },        produceTime: 14400, product: 'panda_souvenir',  unlockLevel: 46 },
    zoo_giraffe:  { name: 'Giraffe Savanna',    cost: 80000, materials: { brick: 10, glass: 6 }, feed: { carrot: 15 },           produceTime: 18000, product: 'giraffe_scarf',   unlockLevel: 48 },
    zoo_elephant: { name: 'Elephant Meadow',    cost: 110000, materials: { brick: 12, slab: 10 }, feed: { pumpkin: 6 },          produceTime: 21600, product: 'elephant_statue', unlockLevel: 50 },
    zoo_otter:     { name: 'Otter Pond',        cost: 140000, materials: { glass: 14, slab: 12 },    feed: { fish_perch: 6 },      produceTime: 25200, product: 'otter_charm',   unlockLevel: 56 },
    zoo_toucan:    { name: 'Toucan Aviary',     cost: 175000, materials: { brick: 15, glass: 12 },   feed: { banana: 8 },          produceTime: 27000, product: 'toucan_mask',   unlockLevel: 62 },
    zoo_koala:     { name: 'Koala Grove',       cost: 215000, materials: { slab: 16, paint: 12 },    feed: { tea_leaf: 6 },        produceTime: 28800, product: 'koala_plush',   unlockLevel: 68 },
    zoo_tiger:     { name: 'Tiger Ridge',       cost: 265000, materials: { brick: 18, hammer: 12 },  feed: { lamb_chop: 5 },       produceTime: 32400, product: 'tiger_banner',  unlockLevel: 75 },
    zoo_polar:     { name: 'Polar Shore',       cost: 325000, materials: { glass: 20, cement: 10 },  feed: { fish_salmon: 4 },     produceTime: 36000, product: 'polar_globe',   unlockLevel: 83 },
    zoo_rhino:     { name: 'Rhino Plain',       cost: 400000, materials: { brick: 24, slab: 20 },    feed: { watermelon: 6 },      produceTime: 39600, product: 'rhino_carving', unlockLevel: 91 },
  },
};

/**
 * Island expeditions (L36): send the boat to a destination; it returns after tripTime
 * with exotic goods for the Tropical Café. Longer trips → rarer cargo.
 */
export const ISLANDS = {
  unlockLevel: 36,
  destinations: {
    isle_palm:    { name: 'Palm Isle',    tripTime: 3600,  cargo: { banana: [3, 6] },    unlockLevel: 36 },
    isle_coral:   { name: 'Coral Cove',   tripTime: 7200,  cargo: { pineapple: [3, 5] }, unlockLevel: 43 },
    isle_lagoon:  { name: 'Blue Lagoon',  tripTime: 10800, cargo: { cocoa: [2, 5] },     unlockLevel: 45 },
    isle_volcano: { name: 'Volcano Key',  tripTime: 14400, cargo: { vanilla: [2, 4] },   unlockLevel: 47 },
    // Township's real port islands. Each carries two goods rather than one, so a voyage is
    // worth the trip time at these levels.
    isle_frutus:   { name: 'Frutus Isle',       tripTime: 18000, cargo: { peach: [3, 6], plum: [2, 4] },              unlockLevel: 52 },
    isle_olivia:   { name: 'Olivia Isle',       tripTime: 25200, cargo: { key_lime: [2, 5], watermelon_ex: [2, 4] },  unlockLevel: 58 },
    isle_fishers:  { name: 'Fisherman Isle',  tripTime: 32400, cargo: { coconut: [2, 4], avocado: [2, 3] },         unlockLevel: 66 },
    isle_bonita:   { name: 'Bonita Isle',       tripTime: 39600, cargo: { mango: [2, 4], aloe: [1, 3] },              unlockLevel: 74 },
  },
};

/**
 * Market trader (L9): daily rotating stall selling goods/materials for coins at a premium.
 * Slots are drawn deterministically from the day number; each can be bought once per day.
 */
export const MARKET = {
  unlockLevel: 9,
  slots: 6,
  priceMultiplier: 1.4,        // over base sellPrice
  materialChance: 0.25,        // slots that offer a construction material instead of a good
  refreshHourLocal: 7,         // stall restocks at 7:00 local time
};

/** Farm grid + expansion zones. */
export const FARM = {
  // Grid grew 32 -> 40 to make room for expansions 10-15: the original nine rects plus
  // the start zone already tiled x5..31 by y5..26 completely, so anything further would
  // have overlapped. The validator now asserts in-bounds and non-overlap.
  gridSize: 40,
  startZone: { x: 10, y: 10, w: 12, h: 12 },
  // Expansions cost coins + the EXPANSION material set (shovel / axe / saw), earned from
  // trains, airport, helicopter and expedition loot. Never the building or storage sets.
  expansions: [
    { id: 'expansion_1', rect: { x: 22, y: 10, w: 5, h: 12 }, cost: 500, materials: { shovel: 1, axe: 1, saw: 1 } },
    { id: 'expansion_2', rect: { x: 10, y: 22, w: 12, h: 5 }, cost: 2000, materials: { shovel: 2, axe: 2, saw: 2 } },
    { id: 'expansion_3', rect: { x: 5, y: 10, w: 5, h: 12 }, cost: 6000, materials: { shovel: 3, axe: 3, saw: 3 } },
    { id: 'expansion_4', rect: { x: 10, y: 5, w: 12, h: 5 }, cost: 15000, materials: { shovel: 4, axe: 4, saw: 4 } },
    { id: 'expansion_5', rect: { x: 22, y: 22, w: 5, h: 5 }, cost: 30000, materials: { shovel: 6, axe: 5, saw: 5 } },
    { id: 'expansion_6', rect: { x: 5, y: 22, w: 5, h: 5 }, cost: 50000, materials: { shovel: 7, axe: 6, saw: 6 } },
    { id: 'expansion_7', rect: { x: 5, y: 5, w: 5, h: 5 }, cost: 80000, materials: { shovel: 8, axe: 8, saw: 7 } },
    { id: 'expansion_8', rect: { x: 22, y: 5, w: 5, h: 5 }, cost: 120000, materials: { shovel: 10, axe: 9, saw: 9 } },
    { id: 'expansion_9', rect: { x: 27, y: 5, w: 5, h: 22 }, cost: 200000, materials: { shovel: 12, axe: 12, saw: 12 } },
    { id: 'expansion_10', rect: { x: 5, y: 27, w: 27, h: 5 }, cost: 320000, materials: { shovel: 15, axe: 14, saw: 14 } },
    { id: 'expansion_11', rect: { x: 5, y: 0, w: 27, h: 5 }, cost: 500000, materials: { shovel: 18, axe: 17, saw: 16 } },
    { id: 'expansion_12', rect: { x: 0, y: 0, w: 5, h: 32 }, cost: 800000, materials: { shovel: 22, axe: 20, saw: 19 } },
    { id: 'expansion_13', rect: { x: 32, y: 0, w: 8, h: 32 }, cost: 1200000, materials: { shovel: 26, axe: 24, saw: 23 } },
    { id: 'expansion_14', rect: { x: 0, y: 32, w: 40, h: 4 }, cost: 1800000, materials: { shovel: 31, axe: 29, saw: 27 } },
    { id: 'expansion_15', rect: { x: 0, y: 36, w: 40, h: 4 }, cost: 2600000, materials: { shovel: 36, axe: 34, saw: 32 } },
  ],
  fieldCost: 25, // per new field plot
};

/** Achievements: condition is checked against lifetime stats counters in state.stats. */
export const ACHIEVEMENTS = [
  { id: 'first_harvest',   name: 'Green Thumb',      desc: 'Harvest your first crop',            stat: 'cropsHarvested', target: 1,    diamonds: 1 },
  { id: 'harvest_100',     name: 'Field Hand',       desc: 'Harvest 100 crops',                  stat: 'cropsHarvested', target: 100,  diamonds: 3 },
  { id: 'harvest_1000',    name: 'Harvest Master',   desc: 'Harvest 1,000 crops',                stat: 'cropsHarvested', target: 1000, diamonds: 8 },
  { id: 'orders_10',       name: 'Reliable',         desc: 'Fulfill 10 board orders',            stat: 'ordersFulfilled', target: 10,  diamonds: 2 },
  { id: 'orders_50',       name: 'Order Machine',    desc: 'Fulfill 50 board orders',            stat: 'ordersFulfilled', target: 50,  diamonds: 5 },
  { id: 'orders_200',      name: 'Merchant Prince',  desc: 'Fulfill 200 board orders',           stat: 'ordersFulfilled', target: 200, diamonds: 10 },
  { id: 'trucks_25',       name: 'Keep on Truckin\'', desc: 'Complete 25 truck orders',          stat: 'trucksCompleted', target: 25,  diamonds: 5 },
  { id: 'boats_10',        name: 'Harbor Master',    desc: 'Fill 10 boats completely',           stat: 'boatsCompleted', target: 10,   diamonds: 8 },
  { id: 'coins_10k',       name: 'Piggy Bank',       desc: 'Earn 10,000 coins lifetime',         stat: 'coinsEarned', target: 10000,   diamonds: 3 },
  { id: 'coins_100k',      name: 'Tycoon',           desc: 'Earn 100,000 coins lifetime',        stat: 'coinsEarned', target: 100000,  diamonds: 8 },
  { id: 'coins_1m',        name: 'Farm Mogul',       desc: 'Earn 1,000,000 coins lifetime',      stat: 'coinsEarned', target: 1000000, diamonds: 20 },
  { id: 'goods_100',       name: 'Artisan',          desc: 'Produce 100 goods',                  stat: 'goodsProduced', target: 100,   diamonds: 3 },
  { id: 'goods_1000',      name: 'Factory Farm',     desc: 'Produce 1,000 goods',                stat: 'goodsProduced', target: 1000,  diamonds: 8 },
  { id: 'fish_all',        name: 'Compleat Angler',  desc: 'Catch every fish species',           stat: 'uniqueFishCaught', target: 8,   diamonds: 6 },
  { id: 'fish_100',        name: 'Gone Fishing',     desc: 'Catch 100 fish',                     stat: 'fishCaught', target: 100,      diamonds: 5 },
  { id: 'mine_50',         name: 'Prospector',       desc: 'Dig 50 times in the mine',           stat: 'mineDigs', target: 50,         diamonds: 5 },
  { id: 'animals_500',     name: 'Animal Whisperer', desc: 'Collect 500 animal products',        stat: 'animalCollections', target: 500, diamonds: 6 },
  { id: 'shop_100',        name: 'Shopkeeper',       desc: 'Sell 100 shop listings',             stat: 'shopSales', target: 100,       diamonds: 5 },
  { id: 'level_10',        name: 'Rising Star',      desc: 'Reach level 10',                     stat: 'level', target: 10,            diamonds: 3 },
  { id: 'level_25',        name: 'Seasoned Farmer',  desc: 'Reach level 25',                     stat: 'level', target: 25,            diamonds: 8 },
  { id: 'level_40',        name: 'Legend of the Farm', desc: 'Reach level 40',                   stat: 'level', target: 40,            diamonds: 25 },
];

/** Daily wheel segments (one free spin per day, streak adds +10% coin values per day up to 5). */
export const DAILY_WHEEL = [
  { coins: 100 }, { coins: 250 }, { diamonds: 1 }, { coins: 500 },
  { item: 'pickaxe', qty: 1 }, { coins: 1000 }, { diamonds: 3 }, { coins: 2500 },
];

/** Pets: feed once per day for an XP bonus. */
export const PETS = {
  dog: { name: 'Dog', unlockLevel: 10, cost: 2000, feedXp: 15 },
  cat: { name: 'Cat', unlockLevel: 10, cost: 2000, feedXp: 15 },
};

/**
 * Events — Hay Day-style event system, single-player adaptation. Entirely client-side and
 * deterministic from the calendar (no server): the ISO week number picks the weekend event
 * from the rotation, so schedules are predictable and identical across reinstalls.
 * Event state lives in state.event: { id, kind, endsAt, points, claimedTiers }.
 */
export const EVENTS = {
  /**
   * Weekend point events — one runs every Fri 00:00 → Sun 24:00 (local), chosen by
   * weekNumber % rotation.length. Themed actions score points (via extras.addEventPoints);
   * bronze/silver/gold tiers pay out once each. Point thresholds are BASE values; at claim
   * time they scale by (0.5 + level/20) so early players can reach tiers too.
   * effect: passive buff while the event runs (consumed via extras.activeEventEffect()).
   */
  weekend: {
    tiers: ['bronze', 'silver', 'gold'],
    levelScale: (level) => 0.5 + level / 20,
    rotation: [
      { id: 'harvest_event',  name: 'Harvest Event',   desc: 'Score for every crop harvested — 2x crop XP all weekend!',
        pointsFor: { cropsHarvested: 1 }, effect: { cropXpMult: 2 },
        thresholds: [120, 400, 1000],
        rewards: [{ coins: 500 }, { coins: 1500, diamonds: 2 }, { coins: 4000, diamonds: 5, decoration: 'bunting_fence' }] },
      { id: 'production_event', name: 'Production Event', desc: 'Score for every good produced!',
        pointsFor: { goodsProduced: 2 }, effect: { productionXpMult: 2 },
        thresholds: [100, 320, 800],
        rewards: [{ coins: 600 }, { coins: 1800, diamonds: 2 }, { coins: 4500, diamonds: 5, decoration: 'festival_tent' }] },
      { id: 'fishing_frenzy', name: 'Fishing Frenzy',  desc: 'Score per fish — and every catch is doubled!',
        pointsFor: { fishCaught: 5 }, effect: { fishDouble: true },
        thresholds: [60, 200, 500],
        rewards: [{ coins: 500 }, { coins: 1500, diamonds: 2 }, { coins: 4000, diamonds: 5, item: 'dynamite', qty: 3 }] },
      { id: 'mining_madness', name: 'Mining Madness',  desc: 'Score per ore — and ore yields are doubled!',
        pointsFor: { mineDigs: 8 }, effect: { mineDouble: true },
        thresholds: [64, 200, 480],
        rewards: [{ coins: 800 }, { coins: 2400, diamonds: 3 }, { coins: 6000, diamonds: 6, decoration: 'prize_trophy' }] },
      { id: 'truck_bonanza',  name: 'Truck Bonanza',   desc: 'Score per truck bundle — trucks pay +50% coins!',
        pointsFor: { truckBundles: 10 }, effect: { truckCoinMult: 1.5 },
        thresholds: [60, 180, 420],
        rewards: [{ coins: 700 }, { coins: 2000, diamonds: 2 }, { coins: 5000, diamonds: 5, decoration: 'balloon_cluster' }] },
      { id: 'boat_race',      name: 'Boat Race',       desc: 'Score per boat crate — boats bring extra vouchers!',
        pointsFor: { boatCrates: 12 }, effect: { boatVoucherBonus: 3 },
        thresholds: [48, 144, 360],
        rewards: [{ coins: 900 }, { coins: 2600, diamonds: 3 }, { coins: 6500, diamonds: 6, vouchers: 12 }] },
      { id: 'merge_mania',    name: 'Merge Mania',     desc: 'Score per merge in Merge Meadow — energy refills faster!',
        pointsFor: { merges: 3 }, effect: { mergeEnergyRegenMult: 2 },
        thresholds: [60, 210, 540],
        rewards: [{ coins: 500 }, { coins: 1500, diamonds: 2 }, { coins: 4000, diamonds: 6 }] },
    ],
  },
  /**
   * Tue–Wed mini-event: a small single-tier buff + goal, rotating on the same week number.
   */
  miniWeekday: {
    rotation: [
      { id: 'egg_hunt',   name: 'Egg Hunt',    desc: 'Collect 30 animal products for a bonus!', pointsFor: { animalCollections: 1 }, thresholds: [30], rewards: [{ coins: 800, diamonds: 1 }] },
      { id: 'bake_off',   name: 'Bake-Off',    desc: 'Bake 15 bakery goods for a bonus!',       pointsFor: { goodsProduced: 1 }, buildingFilter: 'bakery', thresholds: [15], rewards: [{ coins: 900, diamonds: 1 }] },
      { id: 'order_rush', name: 'Order Rush',  desc: 'Fulfill 10 board orders for a bonus!',    pointsFor: { ordersFulfilled: 1 }, thresholds: [10], rewards: [{ coins: 1000, diamonds: 1 }] },
    ],
  },
  /**
   * Farm Fair — the Derby, solo adaptation. Monthly (first full week each month), L15+:
   * 9 tasks drawn deterministically from taskPool (seeded by year+month); finish any 7
   * within the week. Ribbon tiers by summed task points. fairPass: lifetime gold ribbons
   * unlock the trophy decoration line.
   */
  fair: {
    unlockLevel: 15,
    tasksPerFair: 9,
    tasksToComplete: 7,
    durationDays: 7,
    ribbonThresholds: { bronze: 900, silver: 1600, gold: 2300 },
    ribbonRewards: {
      bronze: { coins: 3000, diamonds: 3 },
      silver: { coins: 8000, diamonds: 6 },
      gold:   { coins: 20000, diamonds: 12 },
    },
    fairPass: [
      { goldRibbons: 1, decoration: 'trophy_bronze' },
      { goldRibbons: 3, decoration: 'trophy_silver' },
      { goldRibbons: 6, decoration: 'trophy_gold' },
    ],
    taskPool: [
      { id: 'harvest_150',  desc: 'Harvest 150 crops',            stat: 'cropsHarvested',   target: 150, points: 300 },
      { id: 'harvest_320',  desc: 'Harvest 320 crops',            stat: 'cropsHarvested',   target: 320, points: 450 },
      { id: 'produce_40',   desc: 'Produce 40 goods',             stat: 'goodsProduced',    target: 40,  points: 300 },
      { id: 'produce_90',   desc: 'Produce 90 goods',             stat: 'goodsProduced',    target: 90,  points: 450 },
      { id: 'orders_12',    desc: 'Fulfill 12 board orders',      stat: 'ordersFulfilled',  target: 12,  points: 300 },
      { id: 'orders_25',    desc: 'Fulfill 25 board orders',      stat: 'ordersFulfilled',  target: 25,  points: 450 },
      { id: 'trucks_6',     desc: 'Complete 6 truck orders',      stat: 'trucksCompleted',  target: 6,   points: 350 },
      { id: 'crates_8',     desc: 'Fill 8 boat crates',           stat: 'boatCrates',       target: 8,   points: 350 },
      { id: 'fish_15',      desc: 'Catch 15 fish',                stat: 'fishCaught',       target: 15,  points: 250 },
      { id: 'fish_35',      desc: 'Catch 35 fish',                stat: 'fishCaught',       target: 35,  points: 400 },
      { id: 'dig_10',       desc: 'Dig 10 times in the mine',     stat: 'mineDigs',         target: 10,  points: 300 },
      { id: 'animals_60',   desc: 'Collect 60 animal products',   stat: 'animalCollections', target: 60, points: 300 },
      { id: 'shop_15',      desc: 'Sell 15 shop listings',        stat: 'shopSales',        target: 15,  points: 250 },
      { id: 'merges_40',    desc: 'Make 40 merges in the Meadow', stat: 'merges',           target: 40,  points: 300 },
      { id: 'feed_30',      desc: 'Make 30 batches of feed',      stat: 'feedMade',         target: 30,  points: 300 },
    ],
  },
  /**
   * Holiday seasons — date-keyed cosmetic overlays + limited shop decorations.
   * months are 1-based; tint applies over the world; decorations with matching `holiday`
   * are only purchasable during the season (owned ones stay forever).
   */
  holidays: [
    { id: 'spring_bloom',   name: 'Spring Bloom',   months: [4],  tint: 'rgba(255, 220, 240, 0.06)', extraFlowers: true },
    { id: 'summer_splash',  name: 'Summer Splash',  months: [7],  tint: 'rgba(255, 240, 180, 0.06)' },
    { id: 'harvest_fest',   name: 'Harvest Fest',   months: [10], tint: 'rgba(255, 180, 90, 0.08)',  pumpkinsEverywhere: true },
    { id: 'winter_holiday', name: 'Winter Holiday', months: [12], tint: 'rgba(210, 235, 255, 0.12)', snow: true },
  ],
};

/**
 * Tutorial — the guided first minutes. Steps run in order; each highlights a target and
 * waits for its completion event (fired via tutorial.notify(event)). Uses only level 1–3
 * content (fields, wheat, chicken coop, bakery, order board).
 * target semantics: 'world:<objectKind>' spotlights the nearest matching world object
 * (screen coords via renderer.tileToScreen); 'dock:<panel>' spotlights that dock button;
 * 'panel:<selector>' spotlights an element inside the open sheet panel; null = center bubble.
 */
/**
 * Simulated neighbours. The game is single-player and offline-first, so every "other player"
 * it shows - co-op members, regatta rivals, newspaper farms, request posters - comes from this
 * one pool. It is deliberately ONE system: co-op, regatta and the newspaper each rolling their
 * own roster would let the same neighbour appear as three different people in three surfaces.
 *
 * Generated once from state.createdAt and stored in state.neighbours, never re-rolled per load.
 * A neighbour who helped with a request yesterday is the same neighbour in this week's regatta,
 * with the same name and farm. Re-rolling every load is what makes a simulated world feel fake.
 *
 * Their activity advances on wall-clock elapsed time, not on ticks the player watched, so a
 * rival's score moves while the app is closed.
 *
 * Never presented as real people online. The co-op and regatta surfaces say plainly that these
 * are simulated.
 */
export const NEIGHBOURS = {
  poolSize: 40,
  levelBand: [-6, 6],          // relative to the player, so rivals stay plausible
  firstNames: [
    'Ada', 'Bo', 'Cleo', 'Dane', 'Elsa', 'Finn', 'Greta', 'Hugo', 'Iris', 'Jonas',
    'Kit', 'Lena', 'Mabel', 'Nils', 'Otto', 'Pia', 'Quinn', 'Rosa', 'Silas', 'Tove',
    'Ulla', 'Vera', 'Wes', 'Xenia', 'Yuki', 'Zeb', 'Anya', 'Bram', 'Cora', 'Dov',
  ],
  lastNames: [
    'Applegate', 'Barleycorn', 'Clover', 'Dunmore', 'Eastfield', 'Fallow', 'Greenhill',
    'Harrow', 'Ivyshaw', 'Jessop', 'Kettle', 'Larkspur', 'Meadows', 'Northgate', 'Oakley',
  ],
  farmNames: [
    'Windward Acres', 'Thistledown', 'Bramble Hollow', 'Copper Kettle Farm', 'Long Meadow',
    'Quiet Creek', 'Redgate Farm', 'Sunnyside Holding', 'Two Oaks', 'Wren Cottage',
    'Amberfield', 'Bellflower Farm', 'Cider Hill', 'Dovecote', 'Elder Brook',
  ],
  /** Drives regatta scoring, request fill speed and shop restocking. Weights need not sum to 100. */
  activityProfiles: {
    casual:  { weight: 40, scoreMult: 0.6, fillSecondsRange: [3600, 14400] },
    steady:  { weight: 45, scoreMult: 1.0, fillSecondsRange: [1800, 7200] },
    devoted: { weight: 15, scoreMult: 1.5, fillSecondsRange: [900, 3600] },
  },
};

/**
 * Artifacts. A SEPARATE id namespace from GOODS on purpose: artifacts live in state.museum,
 * not the barn. Putting them in the barn would let a full barn soft-lock expedition collection,
 * and would let order/truck/boat generators ask the player to hand over a museum piece.
 */
export const ARTIFACTS = {
  clay_shard:     { name: 'Clay Shard',      set: 'pottery',   sellPrice: 200 },
  painted_jug:    { name: 'Painted Jug',     set: 'pottery',   sellPrice: 260 },
  storage_urn:    { name: 'Storage Urn',     set: 'pottery',   sellPrice: 320 },
  oil_lamp:       { name: 'Clay Oil Lamp',   set: 'pottery',   sellPrice: 380 },
  flint_blade:    { name: 'Flint Blade',     set: 'stone_age', sellPrice: 220 },
  hand_axe:       { name: 'Hand Axe',        set: 'stone_age', sellPrice: 280 },
  bone_needle:    { name: 'Bone Needle',     set: 'stone_age', sellPrice: 340 },
  carved_totem:   { name: 'Carved Totem',    set: 'stone_age', sellPrice: 410 },
  bronze_coin:    { name: 'Bronze Coin',     set: 'coins',     sellPrice: 300 },
  silver_denarius:{ name: 'Silver Denarius', set: 'coins',     sellPrice: 380 },
  gold_stater:    { name: 'Gold Stater',     set: 'coins',     sellPrice: 470 },
  coin_hoard:     { name: 'Coin Hoard',      set: 'coins',     sellPrice: 580 },
  quartz_cluster: { name: 'Quartz Cluster',  set: 'crystals',  sellPrice: 340 },
  amethyst_geode: { name: 'Amethyst Geode',  set: 'crystals',  sellPrice: 430 },
  rose_crystal:   { name: 'Rose Crystal',    set: 'crystals',  sellPrice: 530 },
  star_sapphire:  { name: 'Star Sapphire',   set: 'crystals',  sellPrice: 660 },
  ammonite:       { name: 'Ammonite',        set: 'fossils',   sellPrice: 400 },
  trilobite:      { name: 'Trilobite',       set: 'fossils',   sellPrice: 500 },
  fern_imprint:   { name: 'Fern Imprint',    set: 'fossils',   sellPrice: 620 },
  raptor_claw:    { name: 'Raptor Claw',     set: 'fossils',   sellPrice: 780 },
  ships_bell:     { name: "Ship's Bell",     set: 'sunken',    sellPrice: 460 },
  brass_sextant:  { name: 'Brass Sextant',   set: 'sunken',    sellPrice: 580 },
  captains_seal:  { name: "Captain's Seal",  set: 'sunken',    sellPrice: 720 },
  pearl_casket:   { name: 'Pearl Casket',    set: 'sunken',    sellPrice: 900 },
};

/**
 * The Museum. Six exhibits, each completed by finding every artifact in its set. Deliberately
 * far smaller than Township's 69 collections / 345 artifacts - that is a years-long collection
 * treadmill and this game is not asking for one.
 */
export const MUSEUM = {
  unlockLevel: 60,
  duplicatePolicy: 'sell',      // duplicates convert to coins rather than being refused
  exhibits: {
    pottery:   { name: 'Ancient Pottery',  artifacts: ['clay_shard', 'painted_jug', 'storage_urn', 'oil_lamp'],
                 rewards: { coins: 60000,  diamonds: 8,  decoration: 'relic_plinth' },  visitorBonusPerHour: 40 },
    stone_age: { name: 'The Stone Age',    artifacts: ['flint_blade', 'hand_axe', 'bone_needle', 'carved_totem'],
                 rewards: { coins: 85000,  diamonds: 10 }, visitorBonusPerHour: 55 },
    coins:     { name: 'Coins of Empire',  artifacts: ['bronze_coin', 'silver_denarius', 'gold_stater', 'coin_hoard'],
                 rewards: { coins: 120000, diamonds: 12 }, visitorBonusPerHour: 70 },
    crystals:  { name: 'Crystals',         artifacts: ['quartz_cluster', 'amethyst_geode', 'rose_crystal', 'star_sapphire'],
                 rewards: { coins: 160000, diamonds: 14 }, visitorBonusPerHour: 90 },
    fossils:   { name: 'Fossils',          artifacts: ['ammonite', 'trilobite', 'fern_imprint', 'raptor_claw'],
                 rewards: { coins: 210000, diamonds: 18, decoration: 'fossil_display' }, visitorBonusPerHour: 115 },
    sunken:    { name: 'The Sunken Ship',  artifacts: ['ships_bell', 'brass_sextant', 'captains_seal', 'pearl_casket'],
                 rewards: { coins: 280000, diamonds: 24 }, visitorBonusPerHour: 145 },
  },
};

/**
 * Expeditions. Send a crew to a site; they come back with loot after a real-time trip. Supplies
 * are consumed up front, so a failed run costs something - otherwise there is no decision.
 */
export const EXPEDITIONS = {
  unlockLevel: 57,
  crewSlots: 3,
  specialists: {
    digger:   { name: 'Digger',   cost: 40000, hireTime: 7200,  bonus: { artifactChance: 0.05 } },
    scout:    { name: 'Scout',    cost: 55000, hireTime: 9000,  bonus: { speedMult: 0.85 } },
    cook:     { name: 'Cook',     cost: 70000, hireTime: 10800, bonus: { riskReduction: 0.05 } },
    mechanic: { name: 'Mechanic', cost: 90000, hireTime: 12600, bonus: { lootBonus: 0.15 } },
  },
  sites: {
    dust_canyon:  { name: 'Dust Canyon',    unlockLevel: 57, duration: 5400,  riskFailChance: 0.10, artifactChance: 0.25,
                    supplies: { bread: 2, carrot_juice: 1 },
                    loot: [{ item: 'ore_silver', qty: [3, 6], weight: 40 }, { artifact: 'clay_shard', weight: 15 },
                           { material: 'cement', qty: [1, 3], weight: 15 }, { coins: [500, 1500], weight: 30 }] },
    hollow_ridge: { name: 'Hollow Ridge',   unlockLevel: 61, duration: 9000,  riskFailChance: 0.12, artifactChance: 0.28,
                    supplies: { bread: 3, cheese: 1 },
                    loot: [{ item: 'ore_gold', qty: [2, 5], weight: 38 }, { artifact: 'flint_blade', weight: 17 },
                           { material: 'wire', qty: [1, 3], weight: 15 }, { coins: [1200, 3000], weight: 30 }] },
    salt_flats:   { name: 'Salt Flats',     unlockLevel: 65, duration: 12600, riskFailChance: 0.14, artifactChance: 0.30,
                    supplies: { green_tea: 2, pickles: 1 },
                    loot: [{ item: 'ore_platinum', qty: [1, 3], weight: 32 }, { artifact: 'bronze_coin', weight: 18 },
                           { material: 'rope', qty: [2, 4], weight: 20 }, { coins: [2500, 5000], weight: 30 }] },
    glass_caves:  { name: 'Glass Caves',    unlockLevel: 70, duration: 16200, riskFailChance: 0.15, artifactChance: 0.33,
                    supplies: { olive_oil: 1, sushi_roll: 1 },
                    loot: [{ item: 'gem', qty: [1, 2], weight: 28 }, { artifact: 'quartz_cluster', weight: 20 },
                           { material: 'timber', qty: [2, 5], weight: 22 }, { coins: [4000, 8000], weight: 30 }] },
    fossil_beds:  { name: 'Fossil Beds',    unlockLevel: 75, duration: 21600, riskFailChance: 0.16, artifactChance: 0.36,
                    supplies: { lasagna: 1, mint_tea: 2 },
                    loot: [{ item: 'ore_platinum', qty: [2, 4], weight: 26 }, { artifact: 'ammonite', weight: 22 },
                           { material: 'jackhammer', qty: [1, 2], weight: 18 }, { coins: [7000, 13000], weight: 34 }] },
    drowned_bay:  { name: 'Drowned Bay',    unlockLevel: 80, duration: 27000, riskFailChance: 0.18, artifactChance: 0.38,
                    supplies: { canned_fish: 1, herb_fondue: 1 },
                    loot: [{ item: 'pearls', qty: [1, 3], weight: 26 }, { artifact: 'ships_bell', weight: 24 },
                           { material: 'electric_saw', qty: [1, 2], weight: 16 }, { coins: [11000, 20000], weight: 34 }] },
    ember_slope:  { name: 'Ember Slope',    unlockLevel: 86, duration: 32400, riskFailChance: 0.20, artifactChance: 0.40,
                    supplies: { pearl_necklace: 1, mint_yogurt: 2 },
                    loot: [{ item: 'gem', qty: [2, 4], weight: 24 }, { artifact: 'raptor_claw', weight: 26 },
                           { material: 'drill', qty: [1, 3], weight: 16 }, { coins: [18000, 32000], weight: 34 }] },
    lost_terrace: { name: 'The Lost Terrace',unlockLevel: 92, duration: 39600, riskFailChance: 0.22, artifactChance: 0.45,
                    supplies: { gold_ring: 1, caviar_tin: 1 },
                    loot: [{ item: 'gem', qty: [3, 6], weight: 22 }, { artifact: 'pearl_casket', weight: 28 },
                           { material: 'jackhammer', qty: [2, 4], weight: 16 }, { coins: [30000, 55000], weight: 34 }] },
  },
};

export const TUTORIAL = {
  finishReward: { coins: 200, diamonds: 2, xp: 20 },
  steps: [
    { id: 'welcome',      target: null,                text: 'Welcome to your farm! Let’s get things growing. 🌱', event: 'dismissed' },
    { id: 'plant_wheat',  target: 'world:field',       text: 'Tap a field and drag the wheat over your plots to plant it.', event: 'planted' },
    { id: 'grow_wait',    target: 'world:field',       text: 'Wheat takes a moment to grow — watch the timer ring!', event: 'crop_ready' },
    { id: 'harvest',      target: 'world:field',       text: 'It’s ready! Tap the field and swipe to harvest.', event: 'harvested' },
    { id: 'silo_peek',    target: 'dock:inventory',    text: 'Your crops are stored in the silo. Take a look!', event: 'panel_opened:inventory' },
    { id: 'sell_wheat',   target: 'panel:.shop-slot',  text: 'Sell 2 wheat to earn your first coins.', event: 'sold' },
    { id: 'buy_coop',     target: 'dock:build',        text: 'Open the build menu and buy a Chicken Coop. 🐔', event: 'placed:chicken' },
    { id: 'feed_hens',    target: 'world:pen',         text: 'Feed your chickens — they’ll lay eggs for you.', event: 'fed' },
    { id: 'buy_bakery',   target: 'dock:build',        text: 'Now buy a Bakery from the build menu.', event: 'placed:bakery' },
    { id: 'bake_bread',   target: 'world:building',    text: 'Tap the Bakery and queue up some bread. 🍞', event: 'enqueued:bread' },
    { id: 'first_order',  target: 'dock:orders',       text: 'The order board pays extra for goods. Fulfill your first order!', event: 'order_fulfilled' },
    { id: 'done',         target: null,                text: 'You’re a real farmer now — the farm is yours! 🎉', event: 'dismissed' },
  ],
};

/** New game starting condition. */
export const NEW_GAME = {
  coins: 150,
  diamonds: 5,
  level: 1,
  fields: 6,          // pre-placed field plots
  seeds: { wheat: 6 },
};
