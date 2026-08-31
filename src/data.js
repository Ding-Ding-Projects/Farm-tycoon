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
  pickaxe:  { name: 'Pickaxe',  sellPrice: 40 },
  dynamite: { name: 'Dynamite', sellPrice: 90 },
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
    name: 'Dairy', unlockLevel: 6, cost: 450, size: [2, 2], kit: 'kit_dairy', queueSlots: 3,
    recipes: [
      { id: 'cream',       inputs: { milk: 1 },              time: 600,  xp: 3 },
      { id: 'butter',      inputs: { cream: 1, milk: 1 },    time: 1500, xp: 5 },
      { id: 'cheese',      inputs: { milk: 3 },              time: 2700, xp: 7 },
      { id: 'goat_cheese', inputs: { goat_milk: 2 },         time: 3600, xp: 9 },
    ],
  },
  sugar_mill: {
    name: 'Sugar Mill', unlockLevel: 8, cost: 600, size: [2, 2], kit: 'kit_sugar_mill', queueSlots: 3,
    recipes: [
      { id: 'sugar',       inputs: { sugarcane: 1 },           time: 600,  xp: 3 },
      { id: 'brown_sugar', inputs: { sugarcane: 2 },           time: 1200, xp: 4 },
      { id: 'syrup',       inputs: { sugarcane: 4 },           time: 3600, xp: 8 },
    ],
  },
  popcorn_pot: {
    name: 'Popcorn Pot', unlockLevel: 9, cost: 750, size: [2, 2], kit: 'kit_popcorn_pot', queueSlots: 3,
    recipes: [
      { id: 'popcorn',          inputs: { corn: 2 },                time: 450,  xp: 3 },
      { id: 'buttered_popcorn', inputs: { corn: 2, butter: 1 },     time: 1800, xp: 7 },
      { id: 'chili_popcorn',    inputs: { corn: 3, chili: 1 },      time: 3600, xp: 11 },
    ],
  },
  grill: {
    name: 'Grill', unlockLevel: 12, cost: 1100, size: [2, 2], kit: 'kit_grill', queueSlots: 3,
    recipes: [
      { id: 'bacon_eggs',   inputs: { bacon: 1, egg: 2 },               time: 1200, xp: 5 },
      { id: 'pancakes',     inputs: { wheat: 2, egg: 1, syrup: 1 },     time: 1800, xp: 7 },
      { id: 'baked_potato', inputs: { potato: 2, butter: 1 },           time: 2400, xp: 7 },
      { id: 'burger',       inputs: { bread: 2, bacon: 2, tomato: 1 },  time: 4500, xp: 13 },
    ],
  },
  pie_oven: {
    name: 'Pie Oven', unlockLevel: 16, cost: 1800, size: [2, 2], kit: 'kit_pie_oven', queueSlots: 3,
    recipes: [
      { id: 'carrot_pie',     inputs: { carrot: 3, wheat: 2, egg: 1 },      time: 2400, xp: 8 },
      { id: 'pumpkin_pie',    inputs: { pumpkin: 1, wheat: 2, egg: 2 },     time: 3600, xp: 10 },
      { id: 'strawberry_pie', inputs: { strawberry: 3, wheat: 2, cream: 1 }, time: 5400, xp: 12 },
      { id: 'fish_pie',       inputs: { fish_perch: 2, wheat: 2, butter: 1 }, time: 5400, xp: 14 },
    ],
  },
  loom: {
    name: 'Loom', unlockLevel: 14, cost: 1500, size: [2, 2], kit: 'kit_loom', queueSlots: 3,
    recipes: [
      { id: 'cotton_fabric', inputs: { cotton: 3 },        time: 1800, xp: 6 },
      { id: 'sweater',       inputs: { wool: 2 },          time: 3600, xp: 9 },
    ],
  },
  sewing_machine: {
    name: 'Sewing Machine', unlockLevel: 20, cost: 2800, size: [2, 2], kit: 'kit_sewing_machine', queueSlots: 3,
    recipes: [
      { id: 'cotton_shirt', inputs: { cotton_fabric: 2 },            time: 3600, xp: 10 },
      { id: 'wooly_hat',    inputs: { wool: 1, cotton_fabric: 1 },   time: 4500, xp: 11 },
      { id: 'blue_hat',     inputs: { wool: 1, cotton_fabric: 1, indigo: 1 }, time: 7200, xp: 15 },
    ],
  },
  juice_press: {
    name: 'Juice Press', unlockLevel: 15, cost: 1700, size: [2, 2], kit: 'kit_juice_press', queueSlots: 3,
    recipes: [
      { id: 'carrot_juice', inputs: { carrot: 3 },                 time: 1200, xp: 5 },
      { id: 'tomato_juice', inputs: { tomato: 2 },                 time: 2400, xp: 7 },
      { id: 'smoothie',     inputs: { strawberry: 2, milk: 1 },    time: 3600, xp: 10 },
      { id: 'grape_juice',  inputs: { grapes: 2 },                 time: 5400, xp: 14 },
    ],
  },
  jam_maker: {
    name: 'Jam Maker', unlockLevel: 22, cost: 3600, size: [2, 2], kit: 'kit_jam_maker', queueSlots: 3,
    recipes: [
      { id: 'strawberry_jam', inputs: { strawberry: 3, sugar: 1 }, time: 4500, xp: 11 },
      { id: 'honey_jam',      inputs: { honey: 1, sugar: 2 },      time: 5400, xp: 13 },
      { id: 'grape_jam',      inputs: { grapes: 3, sugar: 1 },     time: 7200, xp: 16 },
    ],
  },
  coffee_kiosk: {
    name: 'Coffee Kiosk', unlockLevel: 30, cost: 6500, size: [2, 2], kit: 'kit_coffee_kiosk', queueSlots: 3,
    recipes: [
      { id: 'espresso',     inputs: { coffee: 2 },              time: 3600, xp: 10 },
      { id: 'latte',        inputs: { coffee: 2, milk: 1 },     time: 4500, xp: 12 },
      { id: 'honey_coffee', inputs: { coffee: 2, honey: 1 },    time: 6300, xp: 15 },
    ],
  },
  candy_machine: {
    name: 'Candy Machine', unlockLevel: 26, cost: 5000, size: [2, 2], kit: 'kit_candy_machine', queueSlots: 3,
    recipes: [
      { id: 'caramel',      inputs: { sugar: 2, cream: 1 },        time: 3600, xp: 9 },
      { id: 'honey_toffee', inputs: { honey: 1, brown_sugar: 1 },  time: 5400, xp: 12 },
      { id: 'chili_choc',   inputs: { chili: 1, sugar: 2, milk: 1 }, time: 7200, xp: 14 },
    ],
  },
  tropical_cafe: {
    name: 'Tropical Café', unlockLevel: 36, cost: 12000, size: [2, 2], kit: 'kit_tropical_cafe', queueSlots: 3,
    recipes: [
      { id: 'banana_split',  inputs: { banana: 2, cream: 1, sugar: 1 },   time: 5400, xp: 14 },
      { id: 'pina_smoothie', inputs: { pineapple: 2, milk: 1 },           time: 6300, xp: 15 },
      { id: 'choco_banana',  inputs: { banana: 2, cocoa: 1, sugar: 1 },   time: 7200, xp: 16 },
      { id: 'vanilla_ice',   inputs: { vanilla: 1, cream: 2, sugar: 2 },  time: 9000, xp: 18 },
    ],
  },
  smelter: {
    name: 'Smelter', unlockLevel: 24, cost: 4200, size: [2, 2], kit: 'kit_smelter', queueSlots: 2,
    recipes: [
      { id: 'silver_bar',   inputs: { ore_silver: 2 },   time: 3600,  xp: 9 },
      { id: 'gold_bar',     inputs: { ore_gold: 2 },     time: 5400,  xp: 12 },
      { id: 'platinum_bar', inputs: { ore_platinum: 2 }, time: 7200,  xp: 16 },
    ],
  },
  // The Building Workshop is the spine of progression: coins alone never place a
  // production building. Raw MATERIALS become components here, components become a kit,
  // and the kit is consumed to place its building (BUILDINGS[x].kit). It is itself
  // coin-only, as are feed_mill and bakery, so the tutorial never dead-ends.
  build_workshop: {
    name: 'Building Workshop', unlockLevel: 6, cost: 900, size: [3, 2], queueSlots: 3,
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
};

/** Level curve + per-level unlocks (levels 1–40, an unlock at every level). */
export const LEVELS = {
  maxLevel: 50,
  /** XP required to go from level n to n+1. */
  xpForLevel: (n) => Math.round(50 * Math.pow(n, 1.8)),
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
  },
  communityBuildings: {
    town_hall: { name: 'Town Hall',     cost: 5000,   materials: { brick: 4, slab: 4 },              capacity: 60,  size: [2, 2], tier: 1 },
    school:    { name: 'School',        cost: 12000,  materials: { brick: 6, glass: 4, nails: 4 },   capacity: 90,  size: [2, 2], tier: 2 },
    clinic:    { name: 'Clinic',        cost: 22000,  materials: { slab: 8, glass: 6, paint: 4 },    capacity: 120, size: [2, 2], tier: 3 },
    cinema:    { name: 'Cinema',        cost: 38000,  materials: { brick: 10, glass: 8, hammer: 4 }, capacity: 160, size: [2, 2], tier: 4 },
    pavilion:  { name: 'Park Pavilion', cost: 60000,  materials: { slab: 12, paint: 8, nails: 6 },   capacity: 210, size: [2, 2], tier: 4 },
    museum:    { name: 'Museum',        cost: 95000,  materials: { brick: 16, glass: 12, paint: 8 }, capacity: 280, size: [2, 2], tier: 5 },
  },
  basePopulationCap: 30,
  /** Milestones by total population; each pays once and unlocks the next house/community tier. */
  milestones: [
    { population: 20,  rewards: { coins: 2000, diamonds: 2 }, unlocksTier: 2 },
    { population: 60,  rewards: { coins: 6000, diamonds: 3, materials: { brick: 4, slab: 4 } }, unlocksTier: 3 },
    { population: 140, rewards: { coins: 15000, diamonds: 5, materials: { glass: 6, paint: 4 } }, unlocksTier: 4 },
    { population: 260, rewards: { coins: 40000, diamonds: 8, materials: { hammer: 6, nails: 6 } }, unlocksTier: 5 },
    { population: 400, rewards: { coins: 100000, diamonds: 15 }, unlocksTier: 5 },
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
