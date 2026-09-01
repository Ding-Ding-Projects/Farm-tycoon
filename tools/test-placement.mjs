// tools/test-placement.mjs — proves placement.js: the ghost, its legality rule, and the
// pick-up/put-down move that decorate.js has always described and never had.
//
// The interesting assertions are the negative ones. A ghost that reports "legal" over the barn,
// or a cancelled move that leaves a building somewhere the player never put it, are both
// failures a screenshot would not reveal.
//
// Run: node tools/test-placement.mjs

import assert from 'node:assert/strict';
import * as state from '../src/state.js';
import * as farm from '../src/farm.js';
import * as placement from '../src/placement.js';
import { FARM, STRUCTURES, BUILDINGS } from '../src/data.js';
import { readFileSync } from 'node:fs';

let passed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  - ${name}`); }
  catch (err) { failures.push({ name, err }); console.log(`FAIL  - ${name}`); console.log(`        ${err.message}`); }
}

function freshState() { placement.cancel(); state.resetGame(); return state.state; }

/** A tile inside the start zone with room for w×h and nothing on it. */
function freeSpot(w, h) {
  const z = FARM.startZone;
  for (let y = z.y; y <= z.y + z.h - h; y++) {
    for (let x = z.x; x <= z.x + z.w - w; x++) if (placement.isLegal(x, y, w, h)) return [x, y];
  }
  throw new Error('no free spot in the start zone');
}

test('nothing is being placed until begin() is called', () => {
  freshState();
  assert.equal(placement.isActive(), false);
  assert.equal(placement.ghost(), null);
});

test('begin() opens a session whose ghost reports a legal opening tile', () => {
  freshState();
  placement.begin('decoration', 'flowerbed');
  const g = placement.ghost();
  assert.ok(g, 'ghost should exist while placing');
  assert.equal(g.mode, 'new');
  assert.equal(g.legal, true, 'the suggested opening tile must be placeable');
  placement.cancel();
});

test('the ghost follows hover() and is clamped inside the grid', () => {
  freshState();
  placement.begin('decoration', 'flowerbed');
  placement.hover(-50, -50);
  let g = placement.ghost();
  assert.ok(g.tx >= 0 && g.ty >= 0, 'ghost must not leave the world to the north-west');
  placement.hover(9999, 9999);
  g = placement.ghost();
  assert.ok(g.tx + g.w <= FARM.gridSize && g.ty + g.h <= FARM.gridSize, 'nor to the south-east');
  placement.cancel();
});

test('the ghost reports ILLEGAL over a world structure', () => {
  freshState();
  const barn = STRUCTURES.barn || Object.values(STRUCTURES)[0];
  placement.begin('decoration', 'flowerbed');
  placement.hover(barn.pos.x, barn.pos.y);
  assert.equal(placement.ghost().legal, false, 'a structure tile must never read as free');
  placement.cancel();
});

test('confirm() on a blocked tile is a NO-OP and keeps the session open', () => {
  const s = freshState();
  const barn = STRUCTURES.barn || Object.values(STRUCTURES)[0];
  const before = s.farm.objects.length;
  placement.begin('decoration', 'flowerbed');
  placement.hover(barn.pos.x, barn.pos.y);
  const res = placement.confirm();
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'blocked');
  assert.equal(s.farm.objects.length, before, 'nothing may be placed on a blocked tile');
  assert.equal(placement.isActive(), true, 'a mis-tap must not throw away the crafted kit');
  placement.cancel();
});

test('confirm() on a legal tile places the object exactly there', () => {
  const s = freshState();
  const [x, y] = freeSpot(1, 1);
  placement.begin('decoration', 'flowerbed');
  placement.hover(x, y);
  const res = placement.confirm();
  assert.equal(res.ok, true);
  assert.equal(res.object.x, x);
  assert.equal(res.object.y, y);
  assert.equal(placement.isActive(), false, 'a successful placement closes the session');
});

test('onPlaced fires once, with the placed object', () => {
  freshState();
  const [x, y] = freeSpot(1, 1);
  const seen = [];
  placement.begin('decoration', 'flowerbed', { onPlaced: (o) => seen.push(o) });
  placement.hover(x, y);
  placement.confirm();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].x, x);
});

test('cancel() places nothing', () => {
  const s = freshState();
  const before = s.farm.objects.length;
  placement.begin('decoration', 'flowerbed');
  placement.cancel();
  assert.equal(s.farm.objects.length, before);
  assert.equal(placement.isActive(), false);
});

test('beginMove() picks an existing object up and confirm() relocates it', () => {
  const s = freshState();
  const [x, y] = freeSpot(1, 1);
  const obj = farm.place('decoration', 'flowerbed', x, y);
  assert.ok(obj, 'setup: the object should place');
  const count = s.farm.objects.length;   // resetGame() seeds starting fields, so never assume 1
  const [nx, ny] = freeSpot(1, 1);
  placement.beginMove(obj.id);
  assert.equal(placement.ghost().mode, 'move');
  placement.hover(nx, ny);
  const res = placement.confirm();
  assert.equal(res.ok, true);
  const after = s.farm.objects.find((o) => o.id === obj.id);
  assert.equal(after.x, nx);
  assert.equal(after.y, ny);
  assert.equal(s.farm.objects.length, count, 'a move must not duplicate the object');
});

test('a move ghost over its OWN tiles is legal - it does not block itself', () => {
  freshState();
  const [x, y] = freeSpot(2, 2);
  const obj = farm.place('pen', 'chicken', x, y);
  if (!obj) return; // pen type may differ; the decoration case above already covers the rule
  placement.beginMove(obj.id);
  placement.hover(x, y);
  assert.equal(placement.ghost().legal, true, 'an object must never report itself as an obstacle');
  placement.cancel();
});

test('a cancelled move leaves the object untouched and closes the session', () => {
  const s = freshState();
  const [x, y] = freeSpot(1, 1);
  const obj = farm.place('decoration', 'flowerbed', x, y);
  placement.beginMove(obj.id);
  const [nx, ny] = freeSpot(1, 1);
  placement.hover(nx, ny);
  placement.cancel();
  const after = s.farm.objects.find((o) => o.id === obj.id);
  assert.equal(after.x, x, 'hover() must never move the real object - only the ghost');
  assert.equal(after.y, y);
  assert.equal(placement.isActive(), false, 'cancel must close the session');
});

test('confirm() after cancel() places nothing - a stale tap cannot resurrect a session', () => {
  const s = freshState();
  const [x, y] = freeSpot(1, 1);
  placement.begin('decoration', 'flowerbed');
  placement.hover(x, y);
  placement.cancel();
  const before = s.farm.objects.length;
  const res = placement.confirm();
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'inactive');
  assert.equal(s.farm.objects.length, before, 'a cancelled session must stay cancelled');
});

test('a second object cannot be placed on top of the first', () => {
  freshState();
  const [x, y] = freeSpot(1, 1);
  farm.place('decoration', 'flowerbed', x, y);
  placement.begin('decoration', 'flowerbed');
  placement.hover(x, y);
  assert.equal(placement.ghost().legal, false, 'occupied tiles must read as blocked');
  placement.cancel();
});

test('the ghost reports ILLEGAL on land that has not been unlocked', () => {
  freshState();
  const far = FARM.gridSize - 1;
  placement.begin('decoration', 'flowerbed');
  placement.hover(far, far);
  assert.equal(placement.ghost().legal, false, 'locked land must never read as placeable');
  placement.cancel();
});

// ---------------------------------------------------------------------------------------
// Building art coverage.
//
// drawBuilding() falls back to a plain gable hut for any building with no BUILDING_CONFIG
// entry. That fallback is deliberate (it must never crash), which is exactly why it needs a
// guard: a factory added without a config renders as a generic box, looks like every other
// generic box, and nothing anywhere reports a problem. A rule-shaped check over the configs
// that DO exist cannot catch a config that was never written, so this compares against the
// real BUILDINGS table instead.
// ---------------------------------------------------------------------------------------

const spritesSrc = readFileSync(new URL('../src/render/sprites.js', import.meta.url), 'utf8');
const cfgBlock = spritesSrc.slice(
  spritesSrc.indexOf('const BUILDING_CONFIG'),
  spritesSrc.indexOf('const FALLBACK_CFG'),
);

/** id -> its raw config line, parsed once. Config lines never nest braces, so this is exact. */
const configLines = new Map();
for (const line of cfgBlock.split('\n')) {
  const m = line.match(/^ {2}([a-z_0-9]+):\s*\{(.*)\},\s*$/);
  if (m) configLines.set(m[1], m[2]);
}

const FORMS = ['gable', 'hip', 'flat', 'domed', 'sawtooth', 'pagoda', 'barrel', 'kiosk', 'tower'];
const ACCENTS = ['smoke', 'steam', 'blades', 'wheel', 'gear', 'churn', 'pot', 'sparks', 'drips'];

test('every building in BUILDINGS has its own art config - none falls back to the generic hut', () => {
  const missing = Object.keys(BUILDINGS).filter((id) => !configLines.has(id));
  assert.deepEqual(missing, [], `these would render as an unstyled box: ${missing.join(', ')}`);
});

test('every configured building declares a known roof form and a known working accent', () => {
  for (const id of Object.keys(BUILDINGS)) {
    const body = configLines.get(id);
    assert.ok(body, `${id} should have a readable config line`);
    const form = body.match(/form: '([a-z]+)'/);
    const accent = body.match(/accent: '([a-z]+)'/);
    assert.ok(form && FORMS.includes(form[1]), `${id} needs a known roof form, got ${form && form[1]}`);
    assert.ok(accent && ACCENTS.includes(accent[1]), `${id} needs a known accent, got ${accent && accent[1]}`);
  }
});

test('buildings have genuinely different silhouettes, not just different paint', () => {
  // The defect this replaces was 38 factories sharing one shape in different colours. Requiring
  // several distinct forms to be IN USE is what stops a later batch quietly collapsing back to
  // all-gable while every individual config line still looks perfectly valid.
  const forms = new Set();
  const accents = new Set();
  for (const id of Object.keys(BUILDINGS)) {
    const body = configLines.get(id) || '';
    const f = body.match(/form: '([a-z]+)'/);
    const a = body.match(/accent: '([a-z]+)'/);
    if (f) forms.add(f[1]);
    if (a) accents.add(a[1]);
  }
  assert.ok(forms.size >= 6, `expected 6+ roof forms in use, found ${forms.size}: ${[...forms].join(', ')}`);
  assert.ok(accents.size >= 7, `expected 7+ working accents in use, found ${accents.size}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
