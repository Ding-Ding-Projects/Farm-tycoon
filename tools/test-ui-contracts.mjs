// tools/test-ui-contracts.mjs — proves the SEAM between ui.js and the backend modules it
// renders, across every panel, not just the workshop.
//
// Four real bugs shipped in this codebase, all the same shape: ui.js read a field name or
// called a function the owning module never produced.
//   1. ui.js never imported workshop.js at all -> the Building Workshop panel sold buildings
//      for coins straight through farm.place(), skipping the materials/kit chain entirely.
//   2. renderBuildingQueue did Object.entries() on BUILDINGS[x].recipes, which is an ARRAY —
//      so every recipe card read "0", "1", "2" with a "?" icon instead of its real name.
//   3. No item in data.js had an `icon` field, so itemIcon() fell through every table back to
//      '❔' for everything, everywhere.
//   4. renderOrders read `order.item` and `order.reward.coins`; orders.js actually produces
//      `order.items[].itemId` and `order.rewardCoins`/`order.rewardXp`. Every order rendered
//      "❔" and "Reward: 🪙0" regardless of what was actually on offer.
// #1-#3 were fixed before this file existed (see tools/test-ui-workshop.mjs for #1/#2, and the
// icon data itself for #3). #4 is fixed in this same change. All four survived the full existing
// suite (171 assertions across ten files) because every one of those suites drives the backend
// modules directly and none of them touch ui.js's own reading of what those modules produce.
//
// This file is the seam guard. It checks, mechanically:
//   A. ui.js actually IMPORTS every backend module it has a panel for (guards bug #1's class).
//   B. renderPanelContent's switch actually ROUTES every required panel id to its own render
//      function, never falling through to the "coming soon" default (a panel nobody wired is
//      indistinguishable from one that renders fine, unless something asserts it is wired).
//   C. Driven with REAL data the owning module actually produced (never a shape restated by
//      hand in this file — a duplicated shape proves nothing about the original), a sample of
//      panels across the whole game render the real item name/icon and the real numbers, never
//      "❔" and never a bare numeric index standing in for a label (bug #2's and #3's exact
//      signature).
//   D. A broad sweep: with a rich, real, playtested-shaped state, EVERY required panel is opened
//      and its rendered HTML is scanned for the same two signatures, across the whole panel set
//      at once — because a fixed bug in one panel says nothing about a sibling panel with the
//      same class of defect.
//
// Same zero-dependency constraint as tools/test-ui-workshop.mjs (see CLAUDE.md: no dependencies,
// no build step) — this is the identical minimal fake DOM, not a second implementation of it.
//
// Run: node tools/test-ui-contracts.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiSourcePath = path.join(__dirname, '..', 'src', 'ui.js');
const uiSource = readFileSync(uiSourcePath, 'utf8');

// ---------------------------------------------------------------------------
// Minimal fake DOM — copied in shape from tools/test-ui-workshop.mjs (not reinvented). Real
// child nodes only, created via document.createElement + appendChild; innerHTML is stored as a
// plain string and never parsed, which is exactly how ui.js itself uses it (it only ever
// queries for elements it created itself, never for anything written through innerHTML).
// ---------------------------------------------------------------------------
function fakeElement(tag) {
  const listeners = {};
  let innerHTMLBacking = '';
  const node = {
    tagName: String(tag || 'div').toLowerCase(),
    id: '',
    className: '',
    textContent: '',
    hidden: false,
    disabled: false,
    title: '',
    style: {},
    dataset: {},
    children: [],
    parentNode: null,
    classList: {
      add(...cls) {
        const set = new Set(node.className.split(/\s+/).filter(Boolean));
        for (const c of cls) set.add(c);
        node.className = [...set].join(' ');
      },
      remove(...cls) {
        node.className = node.className.split(/\s+/).filter((c) => c && !cls.includes(c)).join(' ');
      },
    },
    // Attributes. Absent until now, which silently made every accessibility attribute
    // untestable: renderMerge setting aria-label on a cell threw "setAttribute is not a function"
    // rather than being checked, so nothing about names, roles or pressed state could be
    // exercised here at all.
    attributes: {},
    setAttribute(name, value) { node.attributes[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(node.attributes, name) ? node.attributes[name] : null; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(node.attributes, name); },
    removeAttribute(name) { delete node.attributes[name]; },
    focus() {},
    appendChild(child) { node.children.push(child); child.parentNode = node; return child; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    dispatchEvent(evt) {
      if (node.disabled) return true; // a real <button disabled> never fires its click listeners
      for (const fn of (listeners[evt.type] || [])) fn(evt);
      return true;
    },
    click() { node.dispatchEvent({ type: 'click', target: node, stopPropagation() {} }); },
    remove() {
      if (node.parentNode) node.parentNode.children = node.parentNode.children.filter((c) => c !== node);
      node.parentNode = null;
    },
    querySelector(sel) { return queryAll(node, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(node, sel); },
    setPointerCapture() {},
  };
  Object.defineProperty(node, 'innerHTML', {
    get() { return innerHTMLBacking; },
    set(html) { innerHTMLBacking = html; node.children = []; },
  });
  return node;
}

function matchesSelector(el, sel) {
  if (sel.startsWith('.')) return el.className.split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  return el.tagName === sel.toLowerCase();
}

function queryAll(root, sel) {
  const out = [];
  (function walk(n) {
    for (const child of n.children) {
      if (matchesSelector(child, sel)) out.push(child);
      walk(child);
    }
  })(root);
  return out;
}

const registry = new Map();
function registerId(id) {
  const el = fakeElement('div');
  el.id = id;
  registry.set(id, el);
  return el;
}

const hudTop = fakeElement('div');
hudTop.className = 'hud-top';
for (const id of [
  'coins-value', 'diamonds-value', 'silo-value', 'barn-value', 'level-badge', 'level-number',
  'dock', 'sheet', 'sheet-title', 'sheet-content', 'radial', 'toasts', 'modal', 'modal-card',
  'event-banner',
]) registerId(id);
const sheetContentEl = registry.get('sheet-content');

globalThis.document = {
  createElement: (tag) => fakeElement(tag),
  getElementById: (id) => registry.get(id) || null,
  querySelector: (sel) => (sel === '.hud-top' ? hudTop : null),
  addEventListener() {},
};
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.CustomEvent = globalThis.CustomEvent || class CustomEvent {
  constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
};

const state = await import('../src/state.js');
const ui = await import('../src/ui.js');
const data = await import('../src/data.js');
const orders = await import('../src/orders.js');
const shop = await import('../src/shop.js');
const boat = await import('../src/boat.js');
const fishing = await import('../src/fishing.js');
const mine = await import('../src/mine.js');
const merge = await import('../src/merge.js');
const town = await import('../src/town.js');
const trains = await import('../src/trains.js');
const zoo = await import('../src/zoo.js');
const extras = await import('../src/extras.js');
const coop = await import('../src/coop.js');
const regatta = await import('../src/regatta.js');
const expeditions = await import('../src/expeditions.js');
const museum = await import('../src/museum.js');
const lab = await import('../src/lab.js');
const helicopter = await import('../src/helicopter.js');
const islands = await import('../src/islands.js');
const newspaper = await import('../src/newspaper.js');
const collections = await import('../src/collections.js');
const workshop = await import('../src/workshop.js');
const production = await import('../src/production.js');
const minigames = await import('../src/minigames.js');
const foraging = await import('../src/foraging.js');
const economy = await import('../src/economy.js');
const input = await import('../src/input.js');
const main = await import('../src/main.js');

state.resetGame();
ui.init();

// ---------------------------------------------------------------------------
let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

function freshState(level = 90) {
  state.resetGame();
  const s = state.state;
  s.level = level;
  s.coins = 50_000_000;
  s.diamonds = 9999;
  return s;
}

/** Every panel id in this list must (a) be imported into ui.js from its owning module and
 *  (b) be routed to its own render function in renderPanelContent — never the "coming soon"
 *  default. Hand-written on purpose: a rule that only checks panels already present in the
 *  switch would pass trivially on a panel nobody ever wired, exactly as bug #1 above did. */
const REQUIRED_PANELS = [
  'silo', 'barn', 'orders', 'truck', 'shop', 'market', 'boat', 'fishing', 'mine', 'merge',
  'workshop', 'town', 'trains', 'airport', 'zoo', 'helicopter', 'lab', 'museum', 'expeditions',
  'newspaper', 'collections', 'coop', 'photo', 'wheel', 'settings', 'achievements', 'decorate',
];

/** panelId -> the backend module(s) that MUST be imported into ui.js for that panel to be real
 *  (not every panel has its own 1:1 module — orders/truck both come from orders.js, trains/
 *  airport both come from trains.js, boat's panel also reaches into islands.js). */
const PANEL_MODULES = {
  orders: ['orders'], truck: ['orders'], shop: ['shop'], market: ['shop'],
  boat: ['boat', 'islands'], fishing: ['fishing'], mine: ['mine'], merge: ['merge'],
  workshop: ['workshop'], town: ['town'], trains: ['trains'], airport: ['trains'],
  zoo: ['zoo'], helicopter: ['helicopter'], lab: ['lab'], museum: ['museum'],
  expeditions: ['expeditions'], newspaper: ['newspaper'], collections: ['collections'],
  coop: ['coop', 'regatta'], photo: ['decorate'], wheel: ['extras'],
};

// ---------------------------------------------------------------------------
// A. Import completeness — every module a required panel depends on is actually imported.
// ---------------------------------------------------------------------------
for (const [panelId, modules] of Object.entries(PANEL_MODULES)) {
  for (const moduleName of modules) {
    test(`ui.js imports ${moduleName}.js (needed by the "${panelId}" panel)`, () => {
      const re = new RegExp(`from '\\./${moduleName}\\.js'`);
      assert.ok(re.test(uiSource), `expected "import ... from './${moduleName}.js'" in ui.js`);
    });
  }
}

// ---------------------------------------------------------------------------
// B. Panel-routing completeness — every required panel id has its own switch case, and the
// case actually calls a render function (not just falling through to the shared default).
// ---------------------------------------------------------------------------
/** Strip block and line comments before scanning source text for a pattern. A commented-out
 *  "case 'x': renderX(...)" line still contains the exact matching substring — proven live
 *  while writing this file: temporarily commenting out the real 'mine' case left this guard
 *  green while the panel was genuinely unwired (renderPanelContent fell through to the
 *  "coming soon" default). This is deliberately simple — no string/regex-literal awareness —
 *  since renderPanelContent's switch body never contains a `//` or `/*` inside a string. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const switchBody = (() => {
  const start = uiSource.indexOf('function renderPanelContent');
  assert.ok(start !== -1, 'expected a renderPanelContent function in ui.js');
  return stripComments(uiSource.slice(start, start + 6000));
})();

// Panels whose content is real but genuinely allowed to be RNG/roster-dependent enough that a
// bare fresh save is not guaranteed to have anything in it (the newspaper's listings depend on
// a freshly-seeded neighbour roster's random draws). Excluded ONLY from the runtime
// never-shows-the-placeholder check below; every one of them still has its own dedicated,
// data-driven test elsewhere in this file.
const RUNTIME_CHECK_EXEMPT = new Set(['newspaper']);

for (const panelId of REQUIRED_PANELS) {
  test(`renderPanelContent routes panel "${panelId}" to its own render call, not the default`, () => {
    const re = new RegExp(`case '${panelId}':\\s*render[A-Za-z]+\\(`);
    assert.ok(re.test(switchBody), `expected "case '${panelId}': render...(" in renderPanelContent (outside comments)`);
  });

  if (RUNTIME_CHECK_EXEMPT.has(panelId)) continue;
  test(`opening panel "${panelId}" on a real save never falls through to the generic "coming soon" placeholder`, () => {
    freshState();
    const html = openAndGetHtml(panelId);
    assert.ok(!html.includes('is being built — check back soon!'),
      `panel "${panelId}" rendered renderComingSoon()'s placeholder — it is not actually wired`);
  });
}

// ---------------------------------------------------------------------------
// Small helpers shared by the panels below.
// ---------------------------------------------------------------------------
/** Recursively collect every node's own .innerHTML (template-string content, set directly by
 *  card-building code) AND .textContent (set directly by hintEl()/button() via textContent,
 *  which never touches innerHTML) across a whole subtree. Needed because this fake DOM's
 *  .innerHTML setter clears .children (matching real DOM semantics — see fakeElement above),
 *  so a container's own real content lives in one or the other depending on how each node was
 *  built, and nested cards/buttons/spans are only reachable by walking .children. A shallow
 *  read of sheetContentEl.innerHTML alone is always '' (the container is populated entirely
 *  via appendChild, never via a top-level innerHTML string), which would make every assertion
 *  built on it pass trivially on NO content at all — exactly the "guard that never fails"
 *  trap this file exists to avoid falling into itself. */
function collectHtml(node) {
  let out = node.innerHTML || '';
  if (node.textContent) out += ` ${node.textContent}`;
  for (const child of node.children || []) out += ` ${collectHtml(child)}`;
  return out;
}

function openAndGetHtml(panelId, ctx) {
  ui.openPanel(panelId, ctx);
  return collectHtml(sheetContentEl);
}

/** The two exact historical failure signatures, checked together everywhere below: a fallback
 *  "❔" icon standing in for a real one, and a recipe/item label that is a bare array index
 *  (Object.entries() on an array yields "0"/"1"/"2"... as the "id"). */
function assertNoStrayFallbacks(html, context) {
  assert.ok(!html.includes('❔'), `${context}: rendered a "❔" fallback icon — a real item id resolved to nothing`);
  assert.ok(!/<strong>[0-9]+<\/strong>/.test(html), `${context}: rendered a bare numeric index as a label`);
}

function placeStructureAndBuilding(s, structureKey, buildingType, extra = {}) {
  const structDef = data.STRUCTURES[structureKey];
  s.farm.objects.push({
    id: `${buildingType}_1`, kind: 'building', type: buildingType,
    x: structDef.pos.x, y: structDef.pos.y, ...extra,
  });
  return `${buildingType}_1`;
}

// ---------------------------------------------------------------------------
// C. Bug-specific regression: the exact orders.js seam (order.items[].itemId, rewardCoins,
// rewardXp) — driven against a synthetic order shaped EXACTLY as orders.js's own
// generateOrder() produces it, so this proves the panel reads the real contract rather than
// restating orders.js's logic.
// ---------------------------------------------------------------------------
test('the order board reads order.items[].itemId and rewardCoins/rewardXp, never order.item/order.reward', () => {
  const s = freshState();
  s.silo.items.wheat = 10;
  const order = { id: 'seed_order_1', items: [{ itemId: 'wheat', qty: 3 }], rewardCoins: 4242, rewardXp: 77, createdAt: Date.now() };
  s.orders.board = [order];

  const html = openAndGetHtml('orders');
  assertNoStrayFallbacks(html, 'orders panel');
  assert.ok(html.includes(data.CROPS.wheat.icon), 'expected the real wheat icon in the order card');
  assert.ok(html.includes('Wheat'), 'expected the real item name "Wheat" in the order card');
  assert.ok(html.includes('🪙4242'), `expected the real reward "🪙4242" in the order card, got: ${html}`);
  assert.ok(html.includes('✨77'), `expected the real reward XP "✨77" in the order card, got: ${html}`);

  const fulfillBtn = queryAll(sheetContentEl, 'button').find((b) => b.textContent === 'Fulfill');
  assert.ok(fulfillBtn, 'expected a Fulfill button');
  assert.equal(fulfillBtn.disabled, false, 'enough wheat is in the silo — Fulfill must be enabled');
  const coinsBefore = s.coins;
  fulfillBtn.click();
  assert.equal(s.coins, coinsBefore + 4242, 'fulfilling must pay the real rewardCoins, not order.reward.coins (undefined)');
  assert.equal(s.silo.items.wheat, 7, 'fulfilling must consume the real qty from the real itemId');
});

test('the order board never crashes on an {empty, readyAt} cooldown slot and shows a countdown', () => {
  const s = freshState();
  s.orders.board = [{ empty: true, readyAt: Date.now() + 60_000 }];
  let html = '';
  assert.doesNotThrow(() => { html = openAndGetHtml('orders'); });
  assert.ok(/Next order in/.test(html), `expected a "Next order in ..." countdown for the empty slot, got: ${html}`);
});

// ---------------------------------------------------------------------------
// D. Bug-specific regression: the shop.js seam (listing.itemId, never listing.item), and null
// slots in state.shop.listings (cancel()/collect() leave a hole) never crashing the panel.
// ---------------------------------------------------------------------------
test('the roadside shop reads listing.itemId, never listing.item, and tolerates null slots', () => {
  const s = freshState();
  s.shop.listings = [
    null, // a cancelled/collected slot — must never crash a naive Object.entries()-style read
    { itemId: 'wheat', qty: 5, price: 25, listedAt: Date.now() - 1000, readyAt: Date.now() + 999_000, sold: false },
    { itemId: 'corn', qty: 2, price: 40, listedAt: Date.now() - 5000, readyAt: Date.now() - 1000, sold: true },
  ];

  const html = openAndGetHtml('shop');
  assertNoStrayFallbacks(html, 'shop panel');
  assert.ok(html.includes(data.CROPS.wheat.icon) && html.includes('Wheat'), 'expected the real wheat listing');
  assert.ok(html.includes(data.CROPS.corn.icon) && html.includes('Corn'), 'expected the real corn listing');

  const collectBtn = queryAll(sheetContentEl, 'button').find((b) => b.textContent === 'Collect');
  assert.ok(collectBtn, 'expected a Collect button on the sold corn listing');
  const coinsBefore = s.coins;
  collectBtn.click();
  assert.equal(s.coins, coinsBefore + 40 * 2, 'collecting a sold listing must pay price*qty from the real fields');
});

test('listing an owned item from the shop panel actually calls shop.list with the real item id', () => {
  const s = freshState();
  s.level = data.SHOP.unlockLevel;
  s.silo.items = {}; // clear the new-game starting seeds so "Egg" is the unambiguous card to find
  s.barn.items.egg = 4;
  ui.openPanel('shop');
  const eggCard = queryAll(sheetContentEl, '.build-card').find((c) => c.innerHTML.includes('<strong>Egg</strong>'));
  assert.ok(eggCard, 'expected an Egg card in the "list an item" section');
  const listBtn = queryAll(eggCard, 'button').find((b) => b.textContent.startsWith('List 1'));
  assert.ok(listBtn, 'expected a "List 1 for ..." button on the Egg card');
  listBtn.click();
  assert.equal(s.shop.listings.filter(Boolean).length, 1, 'expected exactly one real listing after clicking List');
  assert.equal(s.shop.listings.find(Boolean).itemId, 'egg', 'the listing must carry the real item id that was clicked');
});

// ---------------------------------------------------------------------------
// E. Sample of other panels, each driven with data the REAL module produced (never a shape
// restated here), asserting the same two fallback signatures never appear.
// ---------------------------------------------------------------------------
test('the mine panel shows real depth names and tool icons from mine.js, never "❔"', () => {
  const s = freshState();
  s.barn.items.pickaxe = 3;
  s.barn.items.dynamite = 1;
  const html = openAndGetHtml('mine');
  assertNoStrayFallbacks(html, 'mine panel');
  assert.ok(html.includes(data.MINE.depths[0].name), 'expected the real surface-seam depth name');
  const digBtn = queryAll(sheetContentEl, 'button').find((b) => b.textContent.includes('Pickaxe'));
  assert.ok(digBtn && !digBtn.disabled, 'holding a pickaxe must enable the dig-with-pickaxe button');
});

test('the zoo panel shows the real souvenir icon/name for a bought enclosure, from zoo.js', () => {
  const s = freshState();
  s.level = data.ZOO.unlockLevel;
  s.barn.items.glass = 20;
  s.barn.items.nails = 20;
  const ok = zoo.buyEnclosure('zoo_peacock');
  assert.equal(ok, true, 'setup: buying the peacock enclosure must succeed');
  const html = openAndGetHtml('zoo');
  assertNoStrayFallbacks(html, 'zoo panel');
  const product = data.ZOO.enclosures.zoo_peacock.product;
  assert.ok(html.includes(data.GOODS[product].icon), 'expected the real peacock-feather icon');
});

test('the museum panel shows the real artifact name from museum.addArtifact, never the raw id', () => {
  const s = freshState();
  const ok = museum.addArtifact('clay_shard', 3);
  assert.equal(ok, true, 'setup: adding the artifact must succeed');
  const html = openAndGetHtml('museum');
  assertNoStrayFallbacks(html, 'museum panel');
  assert.ok(html.includes('Clay Shard'), 'expected the real artifact name "Clay Shard"');
  assert.ok(!html.includes('>clay_shard<'), 'must never render the raw artifact id as its own label');
});

test('the expeditions panel shows the real specialist name from expeditions.hireSpecialist', () => {
  const s = freshState();
  s.level = data.EXPEDITIONS.unlockLevel;
  const idx = expeditions.hireSpecialist('digger');
  assert.equal(idx, 0, 'setup: hiring the first specialist must return crew index 0');
  const html = openAndGetHtml('expeditions');
  assertNoStrayFallbacks(html, 'expeditions panel');
  assert.ok(html.includes('Digger'), 'expected the real specialist name "Digger"');
});

test('the laboratory panel shows the real research node name once building is built', () => {
  const s = freshState();
  s.lab.built = true;
  const html = openAndGetHtml('lab');
  assertNoStrayFallbacks(html, 'lab panel');
  assert.ok(html.includes('Irrigation I'), 'expected a real research node name from LAB.tree');
});

test('the helicopter panel shows the real loaded item icon from helicopter.fillCrate', () => {
  const s = freshState();
  s.level = data.HELICOPTER.unlockLevel;
  s.barn.items.milk = 5;
  const ok = helicopter.fillCrate(0);
  assert.equal(ok, true, 'setup: filling a crate must succeed with barn stock present');
  const html = openAndGetHtml('helicopter');
  assertNoStrayFallbacks(html, 'helicopter panel');
  assert.ok(html.includes(data.GOODS.milk.icon), 'expected the real milk icon in the loaded crate');
});

test('the town panel shows real house names and reflects a real town.build() population change', () => {
  const s = freshState();
  s.level = data.TOWN.unlockLevel;
  s.barn.items.brick = 10;
  s.barn.items.nails = 10;
  const built = town.build('house', 'cottage', data.TOWN.district.x, data.TOWN.district.y);
  assert.ok(built, 'setup: building a cottage must succeed');
  const html = openAndGetHtml('town');
  assertNoStrayFallbacks(html, 'town panel');
  assert.ok(html.includes(`Population: ${data.TOWN.houses.cottage.population}/`), 'expected the real population from town.populationInfo()');
});

test('the collections panel reflects a real collections.record() find, never a stale count', () => {
  const s = freshState();
  const ok = collections.record('crop_almanac', 'wheat');
  assert.equal(ok, true, 'setup: recording a find must succeed');
  const html = openAndGetHtml('collections');
  const totalCrops = Object.keys(data.CROPS).length;
  assert.ok(html.includes(`1/${totalCrops} found`), `expected "1/${totalCrops} found" reflecting the real book size, got: ${html}`);
});

test('trains/airport panels show real wagon/crate item icons once trains.tick spawns one', () => {
  const s = freshState();
  s.level = data.TRAINS.unlockLevel;
  trains.tick(Date.now());
  const trainHtml = openAndGetHtml('trains');
  assertNoStrayFallbacks(trainHtml, 'trains panel');
  const t = trains.currentTrain();
  assert.ok(t, 'setup: a train must be at the station after tick()');
  assert.ok(trainHtml.includes(data.GOODS[t.wagons[0].itemId]?.icon || data.CROPS[t.wagons[0].itemId]?.icon),
    'expected the real wagon item icon');

  const airportHtml = openAndGetHtml('airport');
  assertNoStrayFallbacks(airportHtml, 'airport panel');
});

test('the boat panel shows real crate items from boat.js and real destinations from islands.js', () => {
  const s = freshState();
  s.level = data.ISLANDS.unlockLevel;
  boat.tick(Date.now());
  const html = openAndGetHtml('boat');
  assertNoStrayFallbacks(html, 'boat panel');
  assert.ok(html.includes('Palm Isle'), 'expected the real "Palm Isle" destination name');
});

test('the newspaper panel shows a real neighbour name from the shared roster, never undefined', () => {
  const s = freshState();
  s.level = data.NEWSPAPER?.unlockLevel ?? 7;
  const html = openAndGetHtml('newspaper');
  assertNoStrayFallbacks(html, 'newspaper panel');
  assert.ok(!html.includes('undefined'), 'must never render the literal string "undefined" for a missing neighbour');
});

test('the co-op panel shows the real posted item once coop.postRequest succeeds', () => {
  const s = freshState();
  s.level = data.COOP.unlockLevel;
  const posted = coop.postRequest('wheat', 3);
  assert.equal(posted, true, 'setup: posting a request must succeed at the unlock level');
  const html = openAndGetHtml('coop');
  assertNoStrayFallbacks(html, 'coop panel');
  assert.ok(html.includes('Wheat'), 'expected the real posted item name "Wheat" under "Your request"');
});

test('the achievements panel lists every real ACHIEVEMENTS entry with its own name and progress', () => {
  const s = freshState();
  s.stats.cropsHarvested = 5;
  const html = openAndGetHtml('achievements');
  assertNoStrayFallbacks(html, 'achievements panel');
  for (const a of data.ACHIEVEMENTS) {
    assert.ok(html.includes(a.name), `expected achievement name "${a.name}" to be rendered`);
  }
});

test('the daily wheel panel is reachable from the dock and spins for a real, non-fallback reward', () => {
  const s = freshState();
  const html = openAndGetHtml('wheel');
  assertNoStrayFallbacks(html, 'wheel panel');
  const spinBtn = queryAll(sheetContentEl, 'button').find((b) => b.textContent === 'Spin the wheel!');
  assert.ok(spinBtn, 'expected an enabled spin button on a fresh save');
  spinBtn.click();
  assert.equal(s.daily.streak, 1, 'spinning must advance the real daily-wheel streak in state');
});

test('the "wheel" dock button exists at runtime even though index.html ships without one', () => {
  // ui.js injects it in init() rather than requiring index.html to carry it — this proves the
  // injection actually happened, not just that the panel renders when opened directly.
  const dock = document.getElementById('dock');
  const wheelBtn = dock.children.find((b) => b.dataset && b.dataset.panel === 'wheel');
  assert.ok(wheelBtn, 'expected ui.js init() to have appended a data-panel="wheel" dock button');
});

test('the merge panel renders the real 7x9 board from MERGE.board without crashing, and spawns from a real generator', () => {
  const s = freshState();
  merge.initBoard();
  const genIndex = s.merge.cells.findIndex((c) => c && c.generator);
  assert.ok(genIndex !== -1, 'setup: initBoard must place at least one generator');
  const html = openAndGetHtml('merge');
  const cells = queryAll(sheetContentEl, 'button');
  assert.equal(cells.length, data.MERGE.board.cols * data.MERGE.board.rows, 'expected one button per board cell');
  cells[genIndex].click();
  // A successful spawn always reduces energy by MERGE.energy.costPerSpawn (>0) from full.
  assert.ok(merge.currentEnergy(Date.now()) < data.MERGE.energy.max, 'tapping a generator must have spent real energy');
});

test('the fishing panel offers a real Cast action, and casting actually calls fishing.cast()', () => {
  const s = freshState();
  const html = openAndGetHtml('fishing');
  const castBtn = queryAll(sheetContentEl, 'button').find((b) => b.textContent === 'Cast');
  assert.ok(castBtn, 'expected a Cast button with no cast in progress');
  castBtn.click();
  assert.ok(s.fishing.cast, 'clicking Cast must set a real fishing.cast entry in state');
});

test('photo mode reads real PHOTO.frames and calls decorate.setFrame with a real frame id', () => {
  const s = freshState();
  const html = openAndGetHtml('photo');
  assertNoStrayFallbacks(html, 'photo panel');
  const useBtn = queryAll(sheetContentEl, 'button').find((b) => b.textContent === 'Use');
  assert.ok(useBtn, 'expected a "Use" button for a non-active frame');
  useBtn.click();
  assert.ok(data.PHOTO.frames.includes(s.photo.frame), 'the applied frame must be one of the real PHOTO.frames');
});

// ---------------------------------------------------------------------------
// F. Broad sweep — open every required panel against one rich, progressed save and scan every
// one for the same two fallback signatures at once. A panel that individually looks fine in
// isolation can still break once real cross-system state (many owned items, several built
// structures) is present; this is the net that would have caught bug #4 even without knowing
// in advance which panel it was in.
// ---------------------------------------------------------------------------
test('a broad sweep of every required panel, against a rich real save, never renders "❔" or a bare index', () => {
  const s = freshState();
  // Populate storage broadly so every "your items" style listing has real content to show.
  for (const id of Object.keys(data.CROPS)) s.silo.items[id] = 5;
  for (const id of Object.keys(data.GOODS)) s.barn.items[id] = 5;
  for (const id of Object.keys(data.MATERIALS)) s.barn.items[id] = 5;
  s.stats.cropsHarvested = 500;

  placeStructureAndBuilding(s, 'workshop_yard', 'build_workshop');
  placeStructureAndBuilding(s, 'mine_entrance', 'dairy'); // an ordinary building for 'building' panel coverage

  const failuresBySweep = [];
  for (const panelId of REQUIRED_PANELS) {
    if (panelId === 'settings' || panelId === 'decorate') continue; // no item-shaped content to check
    try {
      const html = openAndGetHtml(panelId, panelId === 'building' ? 'dairy_1' : undefined);
      if (html.includes('❔')) failuresBySweep.push(`${panelId}: rendered a "❔" fallback icon`);
      if (/<strong>[0-9]+<\/strong>/.test(html)) failuresBySweep.push(`${panelId}: rendered a bare numeric index`);
    } catch (err) {
      failuresBySweep.push(`${panelId}: threw ${err.message}`);
    }
  }
  assert.equal(failuresBySweep.length, 0, `sweep failures:\n${failuresBySweep.join('\n')}`);
});

// ---------------------------------------------------------------------------
// G. Per-factory minigames (minigames.js) — the per-BUILDING factory bonus (one entry per
// production building in the MINIGAMES table, unchanged) versus the per-CRAFT quality game a
// playable RECIPE carries (the `playable-items` lane's own, separately-owned system).
//
// This originally held three UI-reachability tests written against minigames.start()/
// isAvailable()/finish()/cancel() and a "Play <name>" button this lane built into ui.js. Both
// are gone: the `playable-items` lane (already merged into origin/main — see 933eff4, 582ba3d,
// 2a5dbfe and friends) replaced the entire per-building "optional minigame you start and finish"
// mechanism with a per-CRAFT quality-tier system of its own, with its own UI (renderQueue's
// "Make it"/"Resume" button, openStagePlayer, minigames/shell.js) and its own gate — a playable
// recipe genuinely cannot be collected until played, by design (see production.isCollectable
// and minigames.js's own header comment, which explicitly removed the old "never a gate" line).
// minigames.js no longer exports start/isAvailable/finish/cancel/tick at all; keeping those
// three tests would mean either resurrecting deleted functions in a file this lane does not own,
// or reimplementing the other lane's own UI a second time. Neither is this lane's job.
//
// What minigames.js DID keep unchanged is forBuilding() and pendingBonus() — the per-building
// MINIGAMES table and its state.minigames.results bucket. minigames.js's own finalize() still
// banks a factory bonus there (awarded when a playable craft reaches Masterpiece), and its own
// comment on pendingBonus() says it is "the consuming path, used at collect" — but nothing
// anywhere actually called it. That is a real, still-open gap, and it is what the tests below
// guard instead: that production.collectBuilding() (and workshop.collect()) actually spend a
// banked factory bonus through production.applyMinigameBonus() at the real collection point,
// and that collection succeeds with or without one ever being banked — the factory bonus stays
// optional even though the separate per-craft quality game is now a real gate for its own recipe.
// ---------------------------------------------------------------------------
test('ui.js imports minigames.js', () => {
  assert.ok(/from '\.\/minigames\.js'/.test(uiSource), "expected \"import ... from './minigames.js'\" in ui.js");
});

test('collectBuilding spends a real banked factory bonus (minigames.pendingBonus) at the real collection point', () => {
  const s = freshState();
  const buildingId = placeStructureAndBuilding(s, 'mine_entrance', 'dairy');
  s.barn.items.milk = 1;
  assert.equal(production.enqueue(buildingId, 'cream'), true, 'setup: queuing a plain (non-playable) recipe must succeed');
  const entry = s.production.find((p) => p.objectId === buildingId);
  entry.readyAt = Date.now() - 1000;

  // Bank a factory bonus exactly the way minigames.js's own finalize() does at Masterpiece —
  // dairy's real churn_timing entry, not an invented effect name.
  const game = data.MINIGAMES.churn_timing;
  s.minigames.results[buildingId] = { effect: game.effect, amount: game.cap, appliedAt: Date.now() };

  const xpBefore = s.xp;
  const result = production.collectBuilding(buildingId);
  assert.ok(result && result.qty >= 1, 'setup: the batch must actually collect');
  assert.equal(s.xp - xpBefore, 3 + Math.round(3 * game.cap),
    'a speedMult factory bonus must add its own bonus XP on top of the recipe\'s base 3 XP');
  assert.equal(s.minigames.results[buildingId], undefined,
    'collecting must consume (spend) the banked factory bonus exactly once — pendingBonus() deletes on read');
});

test('collectBuilding and workshop.collect() both complete normally with nothing banked — the factory bonus is optional, never a gate', () => {
  const s = freshState();
  const buildingId = placeStructureAndBuilding(s, 'mine_entrance', 'dairy');
  s.barn.items.milk = 1;
  assert.equal(production.enqueue(buildingId, 'cream'), true);
  const entry = s.production.find((p) => p.objectId === buildingId);
  entry.readyAt = Date.now() - 1000;
  assert.equal(s.minigames.results[buildingId], undefined, 'setup: nothing banked for this building');
  const result = production.collectBuilding(buildingId);
  assert.ok(result && result.qty === 1, 'collection must succeed with no factory bonus ever banked, plain base XP only');

  const workshopId = placeStructureAndBuilding(s, 'workshop_yard', 'build_workshop');
  const wsRecipe = data.BUILDINGS.build_workshop.recipes[0];
  for (const [inputId, qty] of Object.entries(wsRecipe.inputs)) s.barn.items[inputId] = qty;
  assert.equal(workshop.craft(wsRecipe.id), true);
  const wsEntry = s.production.find((p) => p.objectId === workshopId);
  wsEntry.readyAt = Date.now() - 1000;
  const wsResult = workshop.collect(0);
  assert.ok(wsResult && wsResult.qty === 1, 'workshop.collect() must also succeed with nothing banked');
});

test("workshop.collect() also spends a real banked factory bonus for the Workshop's own minigame (workshop_fit)", () => {
  const s = freshState();
  const workshopId = placeStructureAndBuilding(s, 'workshop_yard', 'build_workshop');
  const recipe = data.BUILDINGS.build_workshop.recipes[0];
  for (const [inputId, qty] of Object.entries(recipe.inputs)) s.barn.items[inputId] = qty;
  assert.equal(workshop.craft(recipe.id), true);
  const entry = s.production.find((p) => p.objectId === workshopId);
  entry.readyAt = Date.now() - 1000;

  const game = data.MINIGAMES.workshop_fit;
  s.minigames.results[workshopId] = { effect: game.effect, amount: game.cap, appliedAt: Date.now() };
  const xpBefore = s.xp;
  const result = workshop.collect(0);
  assert.ok(result && result.qty >= 1, 'setup: the crafted item must actually collect');
  // workshop_fit's effect (materialRefund) is not *Mult-suffixed, so this exercises the OTHER
  // branch of applyMinigameBonus — a probabilistic bonus unit rather than bonus XP. Assert only
  // what is deterministic here: XP never changes for a non-Mult effect, and the bonus was spent.
  assert.equal(s.xp - xpBefore, recipe.xp, 'a non-Mult factory bonus must never add bonus XP');
  assert.equal(s.minigames.results[workshopId], undefined, 'collecting must consume the banked bonus exactly once');
});
// ---------------------------------------------------------------------------
// H. Foraging (foraging.js) — free, always-available world nodes that never rendered
// (main.js's buildWorld() never fed them into the frame's object list) and never had a click
// handler (input.js's handleTap only ever resolved state.farm.objects, a SEPARATE array from
// state.foraging.nodes).
// ---------------------------------------------------------------------------
test('main.js ticks foraging.js from the loop, and buildWorld() renders every real node as kind:"forage"', () => {
  const s = freshState();
  s.foraging.nodes = [];
  const spawned = foraging.tick(Date.now());
  assert.ok(spawned.length > 0, 'setup: a fresh unlocked save must spawn at least one forage node on tick');

  const world = main.buildWorld();
  const rendered = world.objects.filter((o) => o.kind === 'forage');
  assert.equal(rendered.length, s.foraging.nodes.length,
    'every real state.foraging.nodes entry must be rendered — main.js never fed them into the frame before this fix');
  for (const obj of rendered) {
    assert.ok(data.FORAGING.nodes[obj.type], `rendered forage type "${obj.type}" must be a real FORAGING.nodes key`);
    assert.ok(typeof obj.progress === 'number', 'a forage object must carry a real numeric progress for the regrow ring');
  }

  assert.ok(/from '\.\/foraging\.js'/.test(readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')),
    "expected \"import ... from './foraging.js'\" in main.js");
});

test('input.js resolves a tap on a forage node\'s own tile to foraging.collectNode, never state.farm.objects', () => {
  const s = freshState();
  s.foraging.nodes = [{ id: 'forage_test_ready', type: 'wildflower_patch', x: 5, y: 5, readyAt: Date.now() - 1000 }];
  const node = input.forageNodeAt(5, 5);
  assert.ok(node, 'expected forageNodeAt(5,5) to find the real state.foraging.nodes entry sitting there');
  assert.equal(node.id, 'forage_test_ready');
  assert.equal(input.forageNodeAt(0, 0), null, 'an empty tile must resolve to null rather than throwing');

  const barnBefore = Object.values(s.barn.items).reduce((a, b) => a + b, 0);
  input.forageTap(node);
  const barnAfter = Object.values(s.barn.items).reduce((a, b) => a + b, 0);
  assert.ok(barnAfter >= barnBefore, 'tapping a ready node must never remove items from the barn');
  assert.ok(node.readyAt > Date.now(), 'collecting must set a real future respawn readyAt, matching foraging.collectNode\'s own contract');

  const futureReadyAt = Date.now() + 999_000; // captured once — re-evaluating Date.now() at the
  // assertion below would make this flaky the moment a real millisecond ticks between the two calls
  const growing = { id: 'forage_test_growing', type: 'wildflower_patch', x: 6, y: 6, readyAt: futureReadyAt };
  input.forageTap(growing);
  assert.equal(growing.readyAt, futureReadyAt, 'tapping a not-yet-ready node must be a true no-op, not silently collect early');

  const inputSource = readFileSync(path.join(__dirname, '..', 'src', 'input.js'), 'utf8');
  assert.ok(/from '\.\/foraging\.js'/.test(inputSource), "expected \"import ... from './foraging.js'\" in input.js");
  assert.ok(/foraging\.collectNode\(/.test(inputSource), 'expected input.js to actually call foraging.collectNode(...)');
});

// ---------------------------------------------------------------------------
// I. Building mastery (collections.js) — production.js and workshop.js never called
// collections.recordMake, so a star tier could never advance no matter how much a player
// produced. Wired at both real completion points; mastery's own effect is registered with
// economy's shared multiplier merge point rather than composing through a second mechanism.
// ---------------------------------------------------------------------------
test('collectBuilding (production.js) records mastery via collections.recordMake at the real completion point', () => {
  const s = freshState();
  const buildingId = placeStructureAndBuilding(s, 'mine_entrance', 'dairy');
  s.barn.items.milk = 1;
  assert.equal(production.enqueue(buildingId, 'cream'), true);
  assert.equal(collections.masteryOf(buildingId).makes, 0, 'setup: no mastery recorded yet');

  const entry = s.production.find((p) => p.objectId === buildingId);
  entry.readyAt = Date.now() - 1000;
  const result = production.collectBuilding(buildingId);
  assert.ok(result, 'setup: the batch must actually collect');
  assert.equal(collections.masteryOf(buildingId).makes, 1, 'collectBuilding must call collections.recordMake exactly once per real collection');
});

test('collectBuilding must NOT record mastery when the barn is full and nothing actually collects', () => {
  const s = freshState();
  const buildingId = placeStructureAndBuilding(s, 'mine_entrance', 'dairy');
  s.barn.items.milk = 1;
  assert.equal(production.enqueue(buildingId, 'cream'), true);
  const entry = s.production.find((p) => p.objectId === buildingId);
  entry.readyAt = Date.now() - 1000;
  s.barn.capacity = 0; // nothing can fit
  const result = production.collectBuilding(buildingId);
  assert.equal(result, null, 'setup: a full barn must refuse to collect');
  assert.equal(collections.masteryOf(buildingId).makes, 0, 'a make must only be recorded for a real, successful collection');
});

test('workshop.collect() also records mastery for the Workshop building itself', () => {
  const s = freshState();
  const workshopId = placeStructureAndBuilding(s, 'workshop_yard', 'build_workshop');
  const recipe = data.BUILDINGS.build_workshop.recipes[0];
  for (const [inputId, qty] of Object.entries(recipe.inputs)) s.barn.items[inputId] = qty;
  assert.equal(workshop.craft(recipe.id), true);
  const entry = s.production.find((p) => p.objectId === workshopId);
  entry.readyAt = Date.now() - 1000;
  const result = workshop.collect(0);
  assert.ok(result, 'setup: the crafted item must actually collect');
  assert.equal(collections.masteryOf(workshopId).makes, 1, 'workshop.collect() must call collections.recordMake exactly once per real collection');
});

test('production.applyMinigameBonus: a *Mult-named result adds bonus XP and never a bonus unit', () => {
  const s = freshState();
  s.minigames.results.mult_test_building = { effect: 'speedMult', amount: 0.5 };
  const { xp, bonusQty } = production.applyMinigameBonus('mult_test_building', 'bread', 100);
  assert.equal(xp, 150, 'expected 100 base + round(100*0.5) bonus XP for a *Mult effect');
  assert.equal(bonusQty, 0, 'a *Mult effect must never grant a bonus unit of the good');
  assert.equal(s.minigames.results.mult_test_building, undefined, 'reading the bonus (pendingBonus) must consume it — a second read must find nothing');
});

test('production.applyMinigameBonus: a non-Mult result may grant one bonus unit, bounded by barn room', () => {
  const s = freshState();
  s.barn.capacity = 10;
  s.barn.items = {};
  s.minigames.results.chance_test_building = { effect: 'seedRefundChance', amount: 0.9 };
  const originalRandom = Math.random;
  Math.random = () => 0; // force the roll to hit, deterministically
  try {
    const { xp, bonusQty } = production.applyMinigameBonus('chance_test_building', 'bread', 100);
    assert.equal(xp, 100, 'a non-Mult effect must never touch XP');
    assert.equal(bonusQty, 1, 'a hit roll with barn room available must grant exactly one bonus unit');
    assert.equal(s.barn.items.bread, 1, 'the bonus unit must actually land in the barn');
  } finally {
    Math.random = originalRandom;
  }
});

test('production.applyMinigameBonus: nothing pending is a true no-op — the minigame is never a gate', () => {
  const s = freshState();
  const { xp, bonusQty } = production.applyMinigameBonus('no_such_building', 'bread', 100);
  assert.equal(xp, 100, 'with nothing pending, XP must be exactly the base amount, unmodified');
  assert.equal(bonusQty, 0, 'with nothing pending, no bonus unit may be granted');
});

test("mastery's effect composes through economy's shared multiplier provider list rather than a second merge path", () => {
  const s = freshState();
  const buildingId = placeStructureAndBuilding(s, 'mine_entrance', 'dairy');
  for (let i = 0; i < MASTERY_FIRST_TIER_MAKES(data); i++) collections.recordMake(buildingId);
  const effect = collections.masteryEffect();
  assert.ok(effect.productionTimeMult < 1, 'setup: enough makes must have crossed the first mastery tier');
  // economy.sellValue is the one existing consumer of economy's shared merge point
  // (registerMultiplierEffect / combinedMultiplier). production.js registers mastery's own
  // provider at module load (see production.js's top-of-file comment) using that exact
  // sanctioned API — proving it did not throw or corrupt the merge point for its one real
  // consumer today is the honest, real-behavior check available without economy.js exporting
  // a generic reader (it does not — combinedMultiplier is private, only ever invoked for
  // 'sell'). productionTimeMult itself having no consumer anywhere yet is a pre-existing gap
  // in economy.js, out of this file's scope to invent a second path around.
  assert.doesNotThrow(() => economy.sellValue('bread'), 'registering mastery\'s provider must never break the existing sell merge point');
});
function MASTERY_FIRST_TIER_MAKES(d) { return d.MASTERY.tiers[0].makes; }

// ---------------------------------------------------------------------------
// J. Five modules main.js's loop never ticked: lab, helicopter, newspaper, coop, regatta. The
// previous audit worked around it by ticking each from its own render function (ui.js), so an
// OPEN panel was never stale — but background progress while the panel stayed CLOSED never
// advanced. Wired into main.js's tickAllSystems(); helicopter and regatta specifically need a
// throttle (verified below, not assumed) because their own tick() resolves elapsed-since-last-
// call and unconditionally resets that baseline — ticked at full per-frame (~16ms) frequency,
// the elapsed slice never crosses a real regen/scoring threshold and progress is lost forever.
// ---------------------------------------------------------------------------
test('main.js imports and ticks lab/newspaper/coop/helicopter/regatta from tickAllSystems', () => {
  const mainSource = readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  for (const mod of ['lab', 'newspaper', 'coop', 'helicopter', 'regatta']) {
    assert.ok(new RegExp(`from '\\./${mod}\\.js'`).test(mainSource), `expected main.js to import ${mod}.js`);
    // Matches either a direct "mod.tick(" call or main.js's own "safeCall(mod.tick, ...)"
    // defensive-wrapper form (see main.js's safeCall) — both are real wiring, neither is a
    // restated shape of what main.js actually does.
    assert.ok(new RegExp(`(${mod}\\.tick\\(|safeCall\\(${mod}\\.tick[,)])`).test(mainSource),
      `expected main.js's loop to actually call ${mod}.tick(...), directly or via safeCall(...)`);
  }
});

test('tickAllSystems() completes research whose panel was never opened — the loop itself does it, not ui.js', () => {
  const s = freshState();
  // Research costs draw on crop items (silo) as well as goods/materials (barn) — see e.g.
  // irrigation_1's { wheat: 60, cotton: 20 } — stock all three so this test is about the tick
  // wiring, never about resource affordability (same shape as tools/test-research.mjs's own
  // freshState, which this cannot import from since it owns its own).
  for (const id of Object.keys(data.CROPS)) s.silo.items[id] = 1e6;
  for (const id of Object.keys(data.MATERIALS)) s.barn.items[id] = 1e6;
  for (const id of Object.keys(data.GOODS)) s.barn.items[id] = 1e6;
  assert.equal(lab.build(), true, 'setup: building the laboratory must succeed');
  const nodeId = lab.availableNodes()[0];
  assert.ok(nodeId, 'setup: at least one research node must be immediately available');
  assert.equal(lab.startResearch(nodeId), true, 'setup: starting research must succeed');
  assert.ok(s.lab.active, 'setup: research must now be active');

  // No ui.openPanel('lab', ...) call anywhere in this test — proving the LOOP, not ui.js's old
  // render-time safeTick(lab.tick, ...) fallback, is what completes it.
  main.tickAllSystems(s.lab.active.readyAt + 1);
  assert.equal(s.lab.active, null, 'tickAllSystems() must complete research once its readyAt has passed');
  assert.ok(s.lab.researched.includes(nodeId), 'the completed node must be recorded as researched');
});

test('DOCUMENTS the hazard: calling helicopter.tick() truly unthrottled (every ~1s) never regenerates fuel, even across real hours', () => {
  const s = freshState();
  s.helicopter.fuel = 0;
  const start = Date.now() + 950_000_000; // a synthetic timeline segment this test owns exclusively
  s.helicopter.fuelUpdatedAt = start;
  let now = start;
  for (let elapsed = 1000; elapsed <= 2 * 3600 * 1000; elapsed += 1000) {
    now = start + elapsed;
    helicopter.tick(now); // the RAW module call, unthrottled — exactly what a naive per-frame loop tick would do
  }
  assert.equal(helicopter.currentFuel(now), 0,
    "this is the exact defect main.js's throttled tickAllSystems() call exists to avoid: settleFuel() resolves elapsed-since-last-call and resets its own baseline on EVERY call, so an unthrottled periodic tick() permanently loses fuel regen no matter how much real time elapses");
});

test("main.js's throttled tickAllSystems() correctly regenerates helicopter fuel over real elapsed time", () => {
  const s = freshState();
  s.helicopter.fuel = 0;
  const start = Date.now() + 900_000_000; // a synthetic timeline segment this test owns exclusively
  s.helicopter.fuelUpdatedAt = start;
  let now = start;
  // 3 simulated hours, ticked every 90s of simulated time (a stand-in for "many animation
  // frames worth of loop calls" without literally iterating every 16ms) — the throttle inside
  // tickAllSystems() must still let real, correctly-sized elapsed spans through.
  for (let elapsed = 90_000; elapsed <= 3 * 3600 * 1000; elapsed += 90_000) {
    now = start + elapsed;
    main.tickAllSystems(now);
  }
  const fuel = helicopter.currentFuel(now);
  assert.ok(fuel >= 2 && fuel <= data.HELICOPTER.fuel.max,
    `expected roughly 3 fuel points (capped at ${data.HELICOPTER.fuel.max}) over 3 simulated hours of throttled loop ticks, got ${fuel}`);
});

test('DOCUMENTS the hazard: calling regatta.tick() truly unthrottled (every ~1s) never advances rival scores, even across real hours', () => {
  const s = freshState();
  regatta.standings(); // force regatta.js's ensure() to create real rivals
  const start = Date.now() + 850_000_000;
  s.regatta.endsAt = start + 999 * 24 * 3600 * 1000; // push the season boundary far out — no rollover must interfere
  for (const r of s.regatta.rivals) { r.points = 0; r.lastTickAt = start; }
  let now = start;
  for (let elapsed = 1000; elapsed <= 2 * 3600 * 1000; elapsed += 1000) {
    now = start + elapsed;
    regatta.tick(now); // the RAW module call, unthrottled
  }
  const totalPoints = s.regatta.rivals.reduce((sum, r) => sum + r.points, 0);
  assert.equal(totalPoints, 0,
    'neighbours.simulate()\'s Math.round() on a near-zero per-call elapsed slice resolves to 0 every time, and lastTickAt still resets — exactly the same hazard class as helicopter\'s fuel, which is why main.js throttles this one too');
});

test("main.js's throttled tickAllSystems() correctly advances regatta rival scores over real elapsed time", () => {
  const s = freshState();
  regatta.standings();
  // main.js's lastHeliTick/lastRegattaTick throttle timestamps are module-level state shared
  // across every test in this file (main.js is imported once) and only ever grow — this offset
  // must stay LARGER than every earlier tickAllSystems()-driven test's own synthetic timeline
  // (the helicopter-regen test above tops out around Date.now()+900_000_000+3h) or the throttle
  // gate here would never re-open and this test would tick nothing, exactly the failure mode
  // that shipped on the first pass of this test.
  const start = Date.now() + 2_000_000_000;
  s.regatta.endsAt = start + 999 * 24 * 3600 * 1000;
  for (const r of s.regatta.rivals) { r.points = 0; r.lastTickAt = start; }
  let now = start;
  // Called every simulated SECOND, not every 90s — on its own, a 1s-spaced call is exactly the
  // hazard the test above documents (Math.round() of a ~1s slice resolves to 0 for every rival
  // on every call). This only accumulates real points BECAUSE tickAllSystems()'s own 5-minute
  // throttle skips most of these calls and lets the few it does make carry a full throttle
  // interval's worth of real elapsed time — proven by temporarily deleting that throttle guard
  // during this fix's verification pass and watching this exact assertion go red.
  for (let elapsed = 1000; elapsed <= 3 * 3600 * 1000; elapsed += 1000) {
    now = start + elapsed;
    main.tickAllSystems(now);
  }
  const totalPoints = s.regatta.rivals.reduce((sum, r) => sum + r.points, 0);
  assert.ok(totalPoints > 0, 'rival scores must have moved in the background over 3 simulated hours of throttled loop ticks, with no panel ever opened');
});

// ---------------------------------------------------------------------------------------
// The merge board's keyboard and screen-reader contract.
//
// Found by sweeping every panel for controls with no accessible name: the merge board had 57 of
// them out of 63. Every cell was a bare <button> whose empty ones carried no text, no title and no
// label, so a screen reader read "button" fifty-seven times with no way to tell one from another
// or know where on the board you were - on a system whose entire mechanic is which cell a thing is
// in. The selection was an outline and nothing else, so there was no way to tell what you had
// picked up either, and all 63 cells were tab stops, meaning twenty-odd presses just to get PAST
// the panel.
//
// Source checks rather than a rendered sweep, because the fake DOM in this file does not model
// focus. What matters is that the attributes are still being set at all.
// ---------------------------------------------------------------------------------------
{
  const merge = uiSource.slice(uiSource.indexOf('function renderMerge'), uiSource.indexOf('function renderMerge') + 9000);

  test('every merge cell says where it is and what is on it', () => {
    assert.match(merge, /cellBtn\.setAttribute\('aria-label',/,
      'each cell needs an accessible name - an empty one has no text to fall back on');
    assert.match(merge, /Row \$\{row\}, column \$\{col\}/,
      'the name must carry the position: on a merge board, WHERE a thing is is the game');
    assert.match(merge, /what = 'empty'/, 'an empty cell must still name itself as empty');
  });

  test('the picked-up cell is announced, not just outlined', () => {
    assert.match(merge, /cellBtn\.setAttribute\('aria-pressed'/,
      'selection was an outline and nothing else, which no screen reader can report');
  });

  test('the board is one tab stop with arrow keys, not sixty-three tab stops', () => {
    assert.match(merge, /cellBtn\.tabIndex = i === mergeFocus \? 0 : -1;/,
      'roving tabindex: one way in, then arrows');
    assert.match(merge, /grid\.addEventListener\('keydown'/, 'and the arrows have to be handled');
    // The bug this caught on the way in: bounds-checking only the whole board let ArrowRight off
    // the last column wrap onto the next row, which the comment beside it claimed it did not.
    assert.match(merge, /horizontal && Math\.floor\(to \/ cols\) !== Math\.floor\(from \/ cols\)/,
      'a horizontal move must stay on its row - checking only the board ends lets it wrap');
  });

  test('the cell that was acted on is the one focus comes back to', () => {
    // Deliberately NOT read from a focus event: focusing an already-focused element fires nothing,
    // so a focus-maintained index is only right when focus actually moved. Measured before this
    // was fixed, focus returned three rows away from the cell that was clicked.
    assert.match(merge, /^\s*mergeFocus = i;/m,
      'the click handler must record its own cell rather than inferring it from a focus event');
  });
}

// ---------------------------------------------------------------------------------------
// Dock buttons have names, whatever the count is.
//
// Every dock button's only text is an EMOJI, so without a label a screen reader announces "star
// button" and "gear button". They all carried a `title`, which some readers use and some ignore
// and touch never surfaces at all, so it is not a name you can rely on.
//
// The COUNT is deliberately not asserted. Five separate documents claimed the dock had "exactly
// four" buttons, which was true of index.html and false of the running game - ui.js appends a
// fifth for the daily wheel at boot, on purpose. Pinning the number here would just move that
// drift into the test suite. What must hold is that every button, however many there are and
// wherever it was created, can be identified.
// ---------------------------------------------------------------------------------------
test('every dock button has an accessible name, not just an emoji and a title', () => {
  const markup = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const dockButtons = markup.match(/<button[^>]*class="dock-btn"[^>]*>/g) || [];
  assert.ok(dockButtons.length > 0, 'expected dock buttons in index.html');
  for (const btn of dockButtons) {
    assert.match(btn, /aria-label="[^"]+"/,
      `a dock button has no aria-label, so its name is an emoji: ${btn}`);
  }
  // The one ui.js creates at runtime has to be labelled in code, and is easy to miss precisely
  // because it is not in the markup with its siblings.
  assert.match(uiSource, /wheelBtn\.setAttribute\('aria-label'/,
    'the daily wheel button is built in ui.js and needs its label there');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
// toast()'s own setTimeouts (see ui.js) would otherwise hold the event loop open for ~2.6s
// after the last assertion; exit explicitly once the verdict is known either way.
process.exit(failures.length ? 1 : 0);
