// data.js — all game content definitions for Farm Tycoon.
// Data is design: everything here is final content; systems in other modules consume it.
// Times are in seconds (wall-clock). Prices in coins. All ids are lowercase snake_case.

/** Crop definitions. Harvest returns 2x the planted seed (Hay Day rule). */
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
  // feed
  chicken_feed: { name: 'Chicken Feed', sellPrice: 5 },
  cow_feed:     { name: 'Cow Feed',     sellPrice: 8 },
  pig_feed:     { name: 'Pig Feed',     sellPrice: 12 },
  sheep_feed:   { name: 'Sheep Feed',   sellPrice: 16 },
  goat_feed:    { name: 'Goat Feed',    sellPrice: 21 },
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
  // mine tools (consumed, obtainable from orders/fishing chests/shop)
  pickaxe:  { name: 'Pickaxe',  sellPrice: 40 },
  dynamite: { name: 'Dynamite', sellPrice: 90 },
};

/**
 * Production buildings. Each has an ordered recipe list:
 * inputs: {itemId: qty} — crops, goods, or other products. time in seconds.
 */
export const BUILDINGS = {
  feed_mill: {
    name: 'Feed Mill', unlockLevel: 5, cost: 300, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'chicken_feed', inputs: { wheat: 2, corn: 1 },      time: 300,  xp: 2 },
      { id: 'cow_feed',     inputs: { corn: 2, soybean: 1 },    time: 600,  xp: 3 },
      { id: 'pig_feed',     inputs: { carrot: 2, soybean: 2 },  time: 1200, xp: 4 },
      { id: 'sheep_feed',   inputs: { wheat: 3, soybean: 2 },   time: 1800, xp: 5 },
      { id: 'goat_feed',    inputs: { carrot: 3, corn: 3 },     time: 2400, xp: 6 },
    ],
  },
  bakery: {
    name: 'Bakery', unlockLevel: 3, cost: 200, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'bread',      inputs: { wheat: 3 },            time: 300,   xp: 3 },
      { id: 'corn_bread', inputs: { corn: 2, egg: 1 },     time: 900,   xp: 4 },
      { id: 'cookie',     inputs: { wheat: 2, egg: 2, sugar: 1 }, time: 1800, xp: 6 },
      { id: 'muffin',     inputs: { strawberry: 2, wheat: 2, egg: 2 }, time: 3600, xp: 10 },
    ],
  },
  dairy: {
    name: 'Dairy', unlockLevel: 6, cost: 450, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'cream',       inputs: { milk: 1 },              time: 600,  xp: 3 },
      { id: 'butter',      inputs: { cream: 1, milk: 1 },    time: 1500, xp: 5 },
      { id: 'cheese',      inputs: { milk: 3 },              time: 2700, xp: 7 },
      { id: 'goat_cheese', inputs: { goat_milk: 2 },         time: 3600, xp: 9 },
    ],
  },
  sugar_mill: {
    name: 'Sugar Mill', unlockLevel: 8, cost: 600, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'sugar',       inputs: { sugarcane: 1 },           time: 600,  xp: 3 },
      { id: 'brown_sugar', inputs: { sugarcane: 2 },           time: 1200, xp: 4 },
      { id: 'syrup',       inputs: { sugarcane: 4 },           time: 3600, xp: 8 },
    ],
  },
  popcorn_pot: {
    name: 'Popcorn Pot', unlockLevel: 9, cost: 750, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'popcorn',          inputs: { corn: 2 },                time: 450,  xp: 3 },
      { id: 'buttered_popcorn', inputs: { corn: 2, butter: 1 },     time: 1800, xp: 7 },
      { id: 'chili_popcorn',    inputs: { corn: 3, chili: 1 },      time: 3600, xp: 11 },
    ],
  },
  grill: {
    name: 'Grill', unlockLevel: 12, cost: 1100, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'bacon_eggs',   inputs: { bacon: 1, egg: 2 },               time: 1200, xp: 5 },
      { id: 'pancakes',     inputs: { wheat: 2, egg: 1, syrup: 1 },     time: 1800, xp: 7 },
      { id: 'baked_potato', inputs: { potato: 2, butter: 1 },           time: 2400, xp: 7 },
      { id: 'burger',       inputs: { bread: 2, bacon: 2, tomato: 1 },  time: 4500, xp: 13 },
    ],
  },
  pie_oven: {
    name: 'Pie Oven', unlockLevel: 16, cost: 1800, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'carrot_pie',     inputs: { carrot: 3, wheat: 2, egg: 1 },      time: 2400, xp: 8 },
      { id: 'pumpkin_pie',    inputs: { pumpkin: 1, wheat: 2, egg: 2 },     time: 3600, xp: 10 },
      { id: 'strawberry_pie', inputs: { strawberry: 3, wheat: 2, cream: 1 }, time: 5400, xp: 12 },
      { id: 'fish_pie',       inputs: { fish_perch: 2, wheat: 2, butter: 1 }, time: 5400, xp: 14 },
    ],
  },
  loom: {
    name: 'Loom', unlockLevel: 14, cost: 1500, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'cotton_fabric', inputs: { cotton: 3 },        time: 1800, xp: 6 },
      { id: 'sweater',       inputs: { wool: 2 },          time: 3600, xp: 9 },
    ],
  },
  sewing_machine: {
    name: 'Sewing Machine', unlockLevel: 20, cost: 2800, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'cotton_shirt', inputs: { cotton_fabric: 2 },            time: 3600, xp: 10 },
      { id: 'wooly_hat',    inputs: { wool: 1, cotton_fabric: 1 },   time: 4500, xp: 11 },
      { id: 'blue_hat',     inputs: { wool: 1, cotton_fabric: 1, indigo: 1 }, time: 7200, xp: 15 },
    ],
  },
  juice_press: {
    name: 'Juice Press', unlockLevel: 15, cost: 1700, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'carrot_juice', inputs: { carrot: 3 },                 time: 1200, xp: 5 },
      { id: 'tomato_juice', inputs: { tomato: 2 },                 time: 2400, xp: 7 },
      { id: 'smoothie',     inputs: { strawberry: 2, milk: 1 },    time: 3600, xp: 10 },
      { id: 'grape_juice',  inputs: { grapes: 2 },                 time: 5400, xp: 14 },
    ],
  },
  jam_maker: {
    name: 'Jam Maker', unlockLevel: 22, cost: 3600, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'strawberry_jam', inputs: { strawberry: 3, sugar: 1 }, time: 4500, xp: 11 },
      { id: 'honey_jam',      inputs: { honey: 1, sugar: 2 },      time: 5400, xp: 13 },
      { id: 'grape_jam',      inputs: { grapes: 3, sugar: 1 },     time: 7200, xp: 16 },
    ],
  },
  coffee_kiosk: {
    name: 'Coffee Kiosk', unlockLevel: 30, cost: 6500, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'espresso',     inputs: { coffee: 2 },              time: 3600, xp: 10 },
      { id: 'latte',        inputs: { coffee: 2, milk: 1 },     time: 4500, xp: 12 },
      { id: 'honey_coffee', inputs: { coffee: 2, honey: 1 },    time: 6300, xp: 15 },
    ],
  },
  candy_machine: {
    name: 'Candy Machine', unlockLevel: 26, cost: 5000, size: [2, 2], queueSlots: 3,
    recipes: [
      { id: 'caramel',      inputs: { sugar: 2, cream: 1 },        time: 3600, xp: 9 },
      { id: 'honey_toffee', inputs: { honey: 1, brown_sugar: 1 },  time: 5400, xp: 12 },
      { id: 'chili_choc',   inputs: { chili: 1, sugar: 2, milk: 1 }, time: 7200, xp: 14 },
    ],
  },
  smelter: {
    name: 'Smelter', unlockLevel: 24, cost: 4200, size: [2, 2], queueSlots: 2,
    recipes: [
      { id: 'silver_bar',   inputs: { ore_silver: 2 },   time: 3600,  xp: 9 },
      { id: 'gold_bar',     inputs: { ore_gold: 2 },     time: 5400,  xp: 12 },
      { id: 'platinum_bar', inputs: { ore_platinum: 2 }, time: 7200,  xp: 16 },
    ],
  },
};

/** Fishing: species pool weighted by rarity + chest odds. Cast uses a timing minigame. */
export const FISHING = {
  unlockLevel: 12,
  castTime: 20, // seconds until the catch window
  species: ['fish_perch', 'fish_trout', 'fish_carp', 'fish_bass', 'fish_pike', 'fish_catfish', 'fish_salmon', 'fish_golden'],
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
};

/** Level curve + per-level unlocks (levels 1–40, an unlock at every level). */
export const LEVELS = {
  maxLevel: 40,
  /** XP required to go from level n to n+1. */
  xpForLevel: (n) => Math.round(50 * Math.pow(n, 1.8)),
  /** Feature/content gates. Anything not listed unlocks via its own unlockLevel field. */
  unlocks: {
    1:  ['field', 'wheat'],
    2:  ['corn', 'chicken'],
    3:  ['bakery', 'orders_board', 'carrot'],
    4:  ['expansion_1'],
    5:  ['feed_mill', 'soybean'],
    6:  ['cow', 'dairy'],
    7:  ['sugarcane'],
    8:  ['truck', 'sugar_mill'],
    9:  ['cotton', 'popcorn_pot'],
    10: ['pig', 'pets'],
    11: ['tomato'],
    12: ['fishing', 'grill'],
    13: ['potato', 'expansion_2'],
    14: ['sheep', 'loom'],
    15: ['strawberry', 'juice_press'],
    16: ['pie_oven'],
    17: ['boat'],
    18: ['pumpkin'],
    19: ['goat', 'expansion_3'],
    20: ['sewing_machine'],
    21: ['indigo'],
    22: ['jam_maker'],
    23: ['bee'],
    24: ['mine', 'smelter'],
    25: ['chili', 'expansion_4'],
    26: ['candy_machine'],
    27: ['duck'],
    28: ['expansion_5'],
    29: ['coffee'],
    30: ['coffee_kiosk'],
    31: ['expansion_6'],
    32: ['silo_mega_upgrade'],
    33: ['grapes'],
    34: ['barn_mega_upgrade'],
    35: ['expansion_7'],
    36: ['golden_fields'],
    37: ['expansion_8'],
    38: ['master_orders'],
    39: ['expansion_9'],
    40: ['golden_windmill'],
  },
};

/** Storage: silo (crops) and barn (goods). Upgrade cost scales per tier. */
export const STORAGE = {
  silo: { baseCapacity: 50, upgradeStep: 25, upgradeCostBase: 150, upgradeCostFactor: 1.6 },
  barn: { baseCapacity: 50, upgradeStep: 25, upgradeCostBase: 200, upgradeCostFactor: 1.6 },
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

/** Farm grid + expansion zones. */
export const FARM = {
  gridSize: 32,
  startZone: { x: 10, y: 10, w: 12, h: 12 },
  expansions: [
    { id: 'expansion_1', rect: { x: 22, y: 10, w: 5, h: 12 }, cost: 500 },
    { id: 'expansion_2', rect: { x: 10, y: 22, w: 12, h: 5 }, cost: 2000 },
    { id: 'expansion_3', rect: { x: 5,  y: 10, w: 5, h: 12 }, cost: 6000 },
    { id: 'expansion_4', rect: { x: 10, y: 5,  w: 12, h: 5 }, cost: 15000 },
    { id: 'expansion_5', rect: { x: 22, y: 22, w: 5, h: 5 },  cost: 30000 },
    { id: 'expansion_6', rect: { x: 5,  y: 22, w: 5, h: 5 },  cost: 50000 },
    { id: 'expansion_7', rect: { x: 5,  y: 5,  w: 5, h: 5 },  cost: 80000 },
    { id: 'expansion_8', rect: { x: 22, y: 5,  w: 5, h: 5 },  cost: 120000 },
    { id: 'expansion_9', rect: { x: 27, y: 5,  w: 5, h: 22 }, cost: 200000 },
  ],
  fieldCost: 25, // per new field plot
};

/** Achievements: condition is checked against lifetime stats counters in state.stats. */
export const ACHIEVEEMENTS_DIAMOND_REWARD = 3;
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

/** Rotating seasonal events (client-side schedule, one active at a time, ~3 days each). */
export const EVENTS = [
  { id: 'harvest_festival', name: 'Harvest Festival', desc: 'Crops sell for 2x!',        effect: { cropSellMult: 2 } },
  { id: 'fishing_frenzy',   name: 'Fishing Frenzy',   desc: 'Double fish from the pond!', effect: { fishDouble: true } },
  { id: 'baking_bonanza',   name: 'Baking Bonanza',   desc: 'Bakery goods give 2x XP!',   effect: { bakeryXpMult: 2 } },
  { id: 'gold_rush',        name: 'Gold Rush',        desc: 'Mine yields are doubled!',   effect: { mineDouble: true } },
];

/** New game starting condition. */
export const NEW_GAME = {
  coins: 150,
  diamonds: 5,
  level: 1,
  fields: 6,          // pre-placed field plots
  seeds: { wheat: 6 },
};
