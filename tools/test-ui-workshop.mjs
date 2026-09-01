// tools/test-ui-workshop.mjs — proves ui.js's OWN wiring for the Building Workshop panel and
// the generic building-queue panel.
//
// This is not a duplicate of tools/test-crafting.mjs. That file already covers workshop.js's
// business logic in depth (hasKitFor/consumeKit/craft/collect — 23 assertions). The defect
// this file guards against was never in workshop.js: it was that ui.js never imported or
// called workshop.js at all, and instead sold every building for coins straight through
// farm.place(). workshop.js's own tests could not see that, because they never touch ui.js.
// This file exists to make that specific class of regression fail loudly again: a kit-gated
// building becoming placeable for coins, or a failed placement quietly eating the kit anyway.
// It also guards the neighbouring "?" icon / array-index bug in the recipe queue.
//
// ui.js is a DOM module and this project has zero dependencies (see CLAUDE.md: no
// dependencies, no build step) — so there is no jsdom here. What follows is the smallest
// possible fake DOM: no CSS, no innerHTML parsing, no layout, just enough surface for ui.js's
// own createElement/appendChild/querySelector/addEventListener calls to run for real in plain
// Node. It is deliberately NOT a substitute for real capture-based verification of the built
// page (see the playtest skill) — it is a regression guard for one thing going wrong again
// silently, checked against the exact same production/workshop/economy/farm modules the real
// app uses (no mocks of game logic — only the DOM is fake).
//
// Run: node tools/test-ui-workshop.mjs

import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal fake DOM. innerHTML is stored as a plain string and NEVER parsed into real child
// nodes — ui.js only ever queries for elements it created itself via document.createElement +
// appendChild (buttons, hint spans, headings), never for anything it wrote through innerHTML.
// Tests that need to look inside an innerHTML string do so with an exact anchored substring
// (e.g. "<strong>Dairy</strong>"), never a loose .includes() that "Dairy Kit" would also
// satisfy — see the shared "mangled needle" lesson on why a loose match proves nothing.
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
  // Real DOM semantics: assigning innerHTML replaces every child node, real or not — the
  // exact behaviour renderPanelContent()'s `container.innerHTML = ''` relies on to clear a
  // panel before re-rendering it. Without this, stale cards from an earlier openPanel() call
  // in an earlier test keep accumulating forever.
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
// Every id ui.js's init() looks up via q()/getElementById.
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
const workshop = await import('../src/workshop.js');
const ui = await import('../src/ui.js');
const { BUILDINGS, FARM } = await import('../src/data.js');
const placement = await import('../src/placement.js');

/**
 * Finish a placement the way input.js does: the Build button now only opens the ghost, so a
 * test that stops at the click is testing half a gesture.
 */
function dropGhostSomewhereLegal() {
  const g = placement.ghost();
  if (!g) return { ok: false, reason: 'no ghost' };
  const z = FARM.startZone;
  for (let y = z.y; y <= z.y + z.h - g.h; y++) {
    for (let x = z.x; x <= z.x + z.w - g.w; x++) {
      if (placement.isLegal(x, y, g.w, g.h)) { placement.hover(x, y); return placement.confirm(); }
    }
  }
  return { ok: false, reason: 'nowhere legal' };
}

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

function freshState(level = 30) {
  state.resetGame();
  const s = state.state;
  s.level = level;
  return s;
}

function placeWorkshop(s) {
  s.farm.objects.push({ id: 'ws_1', kind: 'building', type: 'build_workshop', x: 0, y: 0 });
}

/** Find a .build-card whose innerHTML carries this EXACT <strong>text</strong> — anchored so
 *  "Dairy" can never accidentally match the "Dairy Kit" crafting card. */
function findCard(exactStrongText) {
  const needle = `<strong>${exactStrongText}</strong>`;
  return queryAll(sheetContentEl, '.build-card').find((c) => c.innerHTML.includes(needle));
}
function buildButtonOn(card) {
  return queryAll(card, 'button').find((b) => b.textContent === 'Build');
}

// ---------------------------------------------------------------------------

test('the workshop panel never sells a kit-gated building for coins alone', () => {
  const s = freshState();
  placeWorkshop(s);
  s.coins = 999999;
  // No kit_dairy held.
  ui.openPanel('workshop');

  const dairyCard = findCard('Dairy');
  assert.ok(dairyCard, 'expected a Dairy build card in the workshop panel');
  const buildBtn = buildButtonOn(dairyCard);
  assert.ok(buildBtn, 'expected a Build button on the Dairy card');
  assert.equal(buildBtn.disabled, true, 'the Build button must be disabled without the kit');

  const coinsBefore = s.coins;
  buildBtn.click(); // a disabled button never dispatches — proves the DOM-level gate itself
  assert.equal(s.coins, coinsBefore, 'a disabled Build button must never spend coins');
  assert.equal(s.farm.objects.some((o) => o.type === 'dairy'), false, 'no Dairy should be placed');
});

test('even a forcibly re-enabled Build button refuses without the kit, and never consumes one', () => {
  const s = freshState();
  placeWorkshop(s);
  s.coins = 999999;
  s.barn.items.kit_sugar_mill = 1; // held at render time...
  ui.openPanel('workshop');
  const card = findCard('Sugar Mill');
  const buildBtn = buildButtonOn(card);
  assert.equal(buildBtn.disabled, false, 'the kit is held, so the button should be enabled');

  s.barn.items.kit_sugar_mill = 0; // ...but gone before the click actually lands
  buildBtn.disabled = false; // simulate a stale render bypassing the DOM-level gate too
  buildBtn.click();

  assert.equal(s.farm.objects.some((o) => o.type === 'sugar_mill'), false, 'must not place without the kit');
  assert.equal(s.barn.items.kit_sugar_mill, 0, 'must not fabricate a kit that was never there');
});

test('holding the kit places the building and consumes exactly one, on top of the coin cost', () => {
  const s = freshState();
  placeWorkshop(s);
  s.coins = 10000;
  s.barn.items.kit_dairy = 2;
  ui.openPanel('workshop');
  const buildBtn = buildButtonOn(findCard('Dairy'));
  assert.equal(buildBtn.disabled, false);
  buildBtn.click();

  // Build now opens the placement ghost rather than dropping the building on the first free
  // tile. Nothing may be spent until the player actually chooses where it goes: a ghost that
  // charged on open would bill someone for a building they then cancelled.
  assert.equal(placement.isActive(), true, 'Build should open the placement ghost');
  assert.equal(s.coins, 10000, 'opening the ghost must not charge anything yet');
  assert.equal(s.barn.items.kit_dairy, 2, 'opening the ghost must not consume the kit yet');

  const res = dropGhostSomewhereLegal();
  assert.equal(res.ok, true, 'the ghost should place on a legal start-zone tile');

  assert.equal(s.coins, 10000 - BUILDINGS.dairy.cost, 'the coin cost is still charged, kit or no kit');
  assert.equal(s.barn.items.kit_dairy, 1, 'exactly one kit is consumed, never the whole stack');
  assert.equal(s.farm.objects.filter((o) => o.type === 'dairy').length, 1);
});

test('a failed placement (insufficient coins) never touches the kit it would have needed', () => {
  const s = freshState();
  placeWorkshop(s);
  s.coins = 0;
  s.barn.items.kit_dairy = 1;
  ui.openPanel('workshop');
  const buildBtn = buildButtonOn(findCard('Dairy'));
  assert.equal(buildBtn.disabled, false, 'the kit is held, so only the coin cost can refuse this');
  buildBtn.click();
  const res = dropGhostSomewhereLegal();
  assert.equal(res.ok, false, 'no coins means the placement itself must refuse');
  assert.equal(res.reason, 'refused', 'refused (cannot afford), not blocked (bad tile)');
  placement.cancel();

  assert.equal(s.barn.items.kit_dairy, 1, 'a failed placement must never consume the kit');
  assert.equal(s.farm.objects.some((o) => o.type === 'dairy'), false);
});

test('coin-only buildings (feed_mill, bakery) never show a kit requirement', () => {
  const s = freshState();
  placeWorkshop(s);
  s.coins = 999999;
  ui.openPanel('workshop');
  for (const id of ['feed_mill', 'bakery']) {
    const def = BUILDINGS[id];
    const buildBtn = buildButtonOn(findCard(def.name));
    assert.ok(buildBtn, `expected a ${def.name} card`);
    assert.equal(buildBtn.disabled, false, `${def.name} must be coin-only, never kit-gated`);
  }
});

test('the crafting queue shows the real recipe name, never a bare array index', () => {
  const s = freshState();
  placeWorkshop(s);
  s.barn.items.slab = 1;
  s.barn.items.nails = 1;
  assert.equal(workshop.craft('shingle'), true);
  ui.openPanel('workshop');

  const heading = queryAll(sheetContentEl, 'p').find((p) => p.textContent.startsWith('In progress'));
  assert.ok(heading, 'expected an "In progress" heading once something is queued');
  const queueCard = queryAll(sheetContentEl, '.order-card')[0];
  assert.ok(queueCard, 'expected a queue card for the crafting shingle');
  assert.ok(queueCard.innerHTML.includes('Roof Shingle'), `expected the real recipe name, got: ${queueCard.innerHTML}`);
});

test('the generic building-queue panel (any placed production building) shows real recipe names too', () => {
  const s = freshState();
  s.farm.objects.push({ id: 'dairy_1', kind: 'building', type: 'dairy', x: 5, y: 5 });
  ui.openPanel('building', 'dairy_1');

  const cards = queryAll(sheetContentEl, '.build-card');
  assert.equal(cards.length, 4, 'Dairy has four recipes: cream, butter, cheese, goat_cheese');
  for (const expected of ['Cream', 'Butter', 'Cheese', 'Goat Cheese']) {
    assert.ok(
      cards.some((c) => c.innerHTML.includes(`<strong>${expected}</strong>`)),
      `expected a "${expected}" recipe card`,
    );
  }
  // This is the exact old failure mode: Object.entries() on the recipes ARRAY handed back
  // "0"/"1"/"2"/"3" as the key, and itemName(id) falls through every lookup table straight
  // back to the id itself for an id that matches nothing — so the card read literally "0".
  for (const c of cards) {
    assert.ok(!/<strong>[0-9]+<\/strong>/.test(c.innerHTML), `recipe label must not be a bare index: ${c.innerHTML}`);
  }
});

test('queueing and collecting a recipe on an ordinary building actually moves goods into the barn', () => {
  const s = freshState();
  s.farm.objects.push({ id: 'dairy_1', kind: 'building', type: 'dairy', x: 5, y: 5 });
  s.barn.items.milk = 5;
  ui.openPanel('building', 'dairy_1');

  const creamCard = findCard('Cream');
  const queueBtn = queryAll(creamCard, 'button').find((b) => b.textContent === 'Queue');
  assert.ok(queueBtn && !queueBtn.disabled, 'expected an enabled Queue button on the Cream card');
  queueBtn.click();
  assert.equal(s.production.length, 1, 'expected one queued recipe');
  assert.equal(s.barn.items.milk, 4, 'the input should be consumed on queue');

  s.production[0].readyAt = Date.now() - 1; // make it ready without touching production.js
  ui.openPanel('building', 'dairy_1'); // re-render to see the Collect button
  const collectBtn = queryAll(sheetContentEl, 'button').find((b) => b.textContent === 'Collect');
  assert.ok(collectBtn, 'expected a Collect button once the queue entry is ready');
  collectBtn.click();

  assert.equal(s.production.length, 0, 'the queue entry should be gone after collecting');
  assert.equal(s.barn.items.cream, 1, 'the crafted good should land in the barn');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
// toast()'s own setTimeouts (see ui.js) would otherwise hold the event loop open for ~2.6s
// after the last assertion; exit explicitly once the verdict is known either way.
process.exit(failures.length ? 1 : 0);
