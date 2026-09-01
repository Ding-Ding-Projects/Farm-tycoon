// tools/test-render.mjs — proves the renderer's geometry and the world main.js feeds it.
//
// Plain Node script, no test framework (the project has no dependencies). Exits 0 on success,
// non-zero on failure, with a printed summary either way. Run: node tools/test-render.mjs
//
// Nothing here needs a real canvas: the "context" is a recording Proxy (the same shape
// tools/test-motion.mjs uses) whose every method returns undefined, so a sprite that reaches for
// a raw createLinearGradient(...).addColorStop() throws here exactly as it would under that
// suite. Every sprite family is driven through it once, idle and derelict, so a new draw function
// that forgets the gradientOrFlat guard fails before it ships.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// main.js registers a DOMContentLoaded listener at module load and ui.js/tutorial.js/audio.js
// touch nothing at load, so a bare window shim is enough to import the loop-wiring seam. The
// document shim below makes render/ground.js take its "cannot build a texture here" path.
const fakeEl = () => ({ width: 0, height: 0, style: {}, getContext: () => undefined, addEventListener() {}, setAttribute() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1 };
globalThis.document = { createElement: fakeEl, getElementById: () => null, querySelector: () => null, addEventListener() {}, body: fakeEl() };

const state = await import('../src/state.js');
const farm = await import('../src/farm.js');
const production = await import('../src/production.js');
const motion = await import('../src/motion.js');
const effects = await import('../src/render/effects.js');
const renderer = await import('../src/render/renderer.js');
const sprites = await import('../src/render/sprites.js');
const ground = await import('../src/render/ground.js');
const main = await import('../src/main.js');
const data = await import('../src/data.js');

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

/** A canvas context that records every call and property write, and answers nothing. */
function recorder(bucket = []) {
  return new Proxy({}, {
    get(_t, k) {
      if (k === '__calls') return bucket;
      if (k === 'canvas') return { width: 1280, height: 800 };
      if (k === 'save' || k === 'restore' || k === 'beginPath' || k === 'closePath') return () => {};
      return (...args) => { bucket.push(`${String(k)}(${args.join(',')})`); };
    },
    set(_t, k, v) { bucket.push(`${String(k)}=${v}`); return true; },
  });
}

const VW = 1280, VH = 800;
function resetCamera() {
  renderer.camera.x = 0; renderer.camera.y = 0; renderer.camera.zoom = 1;
  renderer.cameraTarget.x = 0; renderer.cameraTarget.y = 0; renderer.cameraTarget.zoom = 1;
}

// ---------------------------------------------------------------------------
// Footprint anchors, scale and depth
// ---------------------------------------------------------------------------

test('objectAnchor of a 1x1 object is exactly tileToScreen of its tile at zoom scale', () => {
  resetCamera();
  const [ex, ey] = renderer.tileToScreen(5, 7, VW, VH);
  const [x, y, size] = renderer.objectAnchor({ tx: 5, ty: 7 }, VW, VH);
  assert.equal(x, ex); assert.equal(y, ey); assert.equal(size, 1);
});

test('objectAnchor of a 2x2 object sits on the top vertex of its central virtual tile, at 2x', () => {
  resetCamera();
  const [ex, ey] = renderer.tileToScreen(5.5, 7.5, VW, VH);
  const [x, y, size] = renderer.objectAnchor({ tx: 5, ty: 7, fw: 2, fh: 2 }, VW, VH);
  assert.equal(x, ex); assert.equal(y, ey); assert.equal(size, 2);
  // the footprint's centre point is half a tile-height below that vertex, exactly as a 1x1 tile's
  // centre sits below ITS top vertex - the anchor's virtual tile is centred on the footprint
  const [cx, cy] = renderer.tileToScreen(6, 8, VW, VH);
  assert.equal(cx, x);
  assert.ok(Math.abs(cy - (y + renderer.TILE_BASE / 2)) < 1e-9);
});

test('objectAnchor of a 4x3 structure scales by its longer side and centres on the footprint', () => {
  resetCamera();
  const [ex, ey] = renderer.tileToScreen(22 + 1.5, 5 + 1, VW, VH);
  const [x, y, size] = renderer.objectAnchor({ tx: 22, ty: 5, fw: 4, fh: 3 }, VW, VH);
  assert.equal(x, ex); assert.equal(y, ey); assert.equal(size, 4);
  renderer.camera.zoom = 0.5;
  assert.equal(renderer.objectAnchor({ tx: 22, ty: 5, fw: 4, fh: 3 }, VW, VH)[2], 2);
  resetCamera();
});

test('an explicit scale overrides the footprint scale', () => {
  resetCamera();
  assert.equal(renderer.objectAnchor({ tx: 1, ty: 1, fw: 2, fh: 2, scale: 0.7 }, VW, VH)[2], 0.7);
});

test('footprintCorners: a 1x1 is the familiar tile diamond, a 2x2 spans two tiles each way', () => {
  const c1 = sprites.footprintCorners(100, 50, 1, 1, 104);
  assert.deepEqual(c1.top, [100, 50]);
  assert.deepEqual(c1.east, [204, 102]);
  assert.deepEqual(c1.south, [100, 154]);
  assert.deepEqual(c1.west, [-4, 102]);
  const c2 = sprites.footprintCorners(100, 50, 2, 2, 104);   // anchor is the central virtual tile's top vertex
  assert.deepEqual(c2.top, [100, -2]);
  assert.deepEqual(c2.east, [308, 102]);
  assert.deepEqual(c2.south, [100, 206]);
  assert.deepEqual(c2.west, [-108, 102]);
  assert.deepEqual(c2.centre, [100, 102]);
});

test('depthOf uses the footprint\'s far corner, and an explicit depth wins', () => {
  assert.equal(renderer.depthOf({ tx: 5, ty: 5 }), 10);
  assert.equal(renderer.depthOf({ tx: 5, ty: 5, fw: 2, fh: 2 }), 12);
  assert.equal(renderer.depthOf({ tx: 5, ty: 5, fw: 4, fh: 3 }), 5 + 3 + 5 + 2);
  assert.equal(renderer.depthOf({ tx: 5, ty: 5, depth: 99.5 }), 99.5);
});

test('sortedObjects draws a 1x1 object north-east of a 2x2 building\'s far corner BEFORE the building', () => {
  const building = { id: 'b', tx: 5, ty: 5, fw: 2, fh: 2 };  // depth 12
  const prop = { id: 'p', tx: 7, ty: 4 };                    // depth 11: behind the building's front edge
  const sorted = renderer.sortedObjects([building, prop]);
  assert.deepEqual(sorted.map((o) => o.id), ['p', 'b']);
});

test('sortedObjects keeps the old {tx,ty}-only semantics: north first, ties by tx', () => {
  const north = { id: 'north', tx: 5, ty: 5 };
  const south = { id: 'south', tx: 5, ty: 15 };
  assert.deepEqual(renderer.sortedObjects([south, north]).map((o) => o.id), ['north', 'south']);
  const a = { id: 'a', tx: 10, ty: 5 }, b = { id: 'b', tx: 5, ty: 10 };
  assert.deepEqual(renderer.sortedObjects([a, b]).map((o) => o.id), ['b', 'a']);
});

test('sortedObjects honours a depth override so animals sit between a pen floor and its front rails', () => {
  const pen = { id: 'pen', tx: 5, ty: 5, fw: 2, fh: 2 };             // depth 12
  const hen = { id: 'hen', tx: 5.3, ty: 5.4, depth: 12.03 };         // would be 10.7 by position
  const front = { id: 'front', tx: 5, ty: 5, fw: 2, fh: 2, depth: 12.1 };
  const later = { id: 'later', tx: 7, ty: 6 };                       // depth 13, genuinely in front
  assert.deepEqual(renderer.sortedObjects([later, front, hen, pen]).map((o) => o.id), ['pen', 'hen', 'front', 'later']);
});

test('viewGeometry\'s tile box contains the tiles under all four viewport corners', () => {
  resetCamera();
  renderer.camera.x = 12; renderer.camera.y = 14; renderer.camera.zoom = 0.7;
  const v = renderer.viewGeometry(VW, VH);
  for (const [sx, sy] of [[0, 0], [VW, 0], [0, VH], [VW, VH]]) {
    const [tx, ty] = renderer.screenToTile(sx, sy, VW, VH);
    assert.ok(tx >= v.minTx && tx <= v.maxTx && ty >= v.minTy && ty <= v.maxTy, `corner (${sx},${sy}) -> tile (${tx},${ty}) outside box`);
  }
  // and the transform numbers are tileToScreen's own: tile (3,4) through (ox, oy, T)
  const [ex, ey] = renderer.tileToScreen(3, 4, VW, VH);
  assert.ok(Math.abs(v.ox + (3 - 4) * v.T - ex) < 1e-9);
  assert.ok(Math.abs(v.oy + (3 + 4) * (v.T / 2) - ey) < 1e-9);
  resetCamera();
});

// ---------------------------------------------------------------------------
// drawFrame against a recording context: the ghost, the ground, culling
// ---------------------------------------------------------------------------

// init() clamps the camera to the start zone (it has no bounds provider here), so anything that
// compares against tileToScreen must be computed AFTER init and before the frame: `expect` runs
// in that window and its return value comes back alongside the recorded calls.
function liveFrame(world, expect = () => null) {
  resetCamera();
  const calls = [];
  const ctx = recorder(calls);
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  renderer.init(canvas);
  const expected = expect();
  renderer.drawFrame(Date.now(), world);
  return { calls, expected };
}

test('the placement ghost tints the tile whose TOP vertex is tileToScreen(tx,ty), never half a tile north', () => {
  const T = renderer.TILE_BASE;
  const { calls, expected: [sx, sy] } = liveFrame(
    { objects: [], showGrid: false, ghost: { kind: 'field', type: 'field', tx: 15, ty: 15, w: 1, h: 1, legal: true } },
    () => renderer.tileToScreen(15, 15, VW, VH),
  );
  assert.ok(calls.includes(`moveTo(${sx},${sy})`), 'ghost diamond must start at the tile\'s top vertex');
  assert.ok(calls.includes(`lineTo(${sx + T},${sy + T / 2})`), 'and run to the east vertex');
  assert.ok(!calls.includes(`moveTo(${sx},${sy - T / 2})`), 'the old anchor-centred diamond must be gone');
});

test('drawFrame paints owned land as the projected diamond of its rect, and degrades to flat fills without a canvas', () => {
  const z = data.FARM.startZone;
  const { calls, expected: [[ax, ay], [bx, by]] } = liveFrame(
    { objects: [], unlockedRects: [z] },
    () => [renderer.tileToScreen(z.x, z.y, VW, VH), renderer.tileToScreen(z.x + z.w, z.y, VW, VH)],
  );
  assert.ok(calls.includes(`moveTo(${ax},${ay})`) && calls.includes(`lineTo(${bx},${by})`), 'the start zone must be filled as its own diamond');
  assert.equal(ground.textureState('meadow'), 'unavailable', 'no real canvas here, so the texture must be marked unavailable, not throw');
  assert.ok(calls.some((c) => c.startsWith('fillRect(0,0,')), 'the rough land floods the viewport first, as a flat fill here');
  assert.ok(calls.includes(`fillStyle=${sprites.PALETTE.grass}`), 'owned land falls back to the meadow green');
});

test('drawFrame culls objects far outside the viewport and draws the ones inside', () => {
  const inside = { id: 'in', kind: 'field', type: 'field', tx: 15, ty: 15 };
  const far = { id: 'far', kind: 'field', type: 'field', tx: 60, ty: 60 };
  const { calls, expected: [[ix, iy], [fx, fy]] } = liveFrame(
    { objects: [inside, far] },
    () => [renderer.tileToScreen(15, 15, VW, VH), renderer.tileToScreen(60, 60, VW, VH)],
  );
  assert.ok(calls.some((c) => c === `moveTo(${ix},${iy})`), 'the visible soil plot must be drawn');
  assert.ok(!calls.some((c) => c === `moveTo(${fx},${fy})`), 'a plot 60 tiles away must be culled');
});

// ---------------------------------------------------------------------------
// The world main.js builds
// ---------------------------------------------------------------------------

function freshWorld() {
  state.resetGame();
  return state.state;
}

test('buildWorld gives every object a footprint and emits animals, a pen floor and a pen front for a pen', () => {
  const s = freshWorld();
  const pen = farm.place('pen', 'chicken', 15, 15);
  assert.ok(pen, 'the chicken coop must place inside the start zone');
  const { objects } = main.buildWorld();
  for (const o of objects) assert.ok(o.fw >= 1 && o.fh >= 1, `${o.id} lacks a footprint`);
  const floor = objects.find((o) => o.id === pen.id);
  assert.equal(floor.kind, 'pen'); assert.equal(floor.fw, 2); assert.equal(floor.fh, 2);
  const animals = objects.filter((o) => o.kind === 'animal' && o.type === 'chicken');
  assert.equal(animals.length, data.ANIMALS.chicken.capacity);
  for (const a of animals) {
    assert.ok(a.tx > pen.x - 0.3 && a.tx < pen.x + 2 && a.ty > pen.y - 0.3 && a.ty < pen.y + 2, `${a.id} stands outside its pen`);
    assert.ok(a.depth > renderer.depthOf(floor), 'animals must draw over the pen floor');
    assert.ok(typeof a.idleFrame === 'number');
  }
  const front = objects.find((o) => o.kind === 'penfront' && o.id.startsWith(pen.id));
  assert.ok(front && front.depth > Math.max(...animals.map((a) => a.depth)), 'the front rails draw after the animals');
  assert.equal(s.farm.objects.filter((o) => o.kind === 'pen').length, 1);
});

test('a skipped crop renders ready: growProgress comes from readyAt, not plantedAt + growTime', () => {
  freshWorld();
  assert.ok(production.plant('field_1', 'wheat'));
  const field = state.state.farm.objects.find((o) => o.id === 'field_1');
  let crop = main.buildWorld().objects.find((o) => o.id === 'field_1');
  assert.equal(crop.kind, 'crop');
  assert.ok(crop.growProgress < 0.05, 'just planted');
  field.readyAt = Date.now() - 1;             // what a diamond skip or the debug hook does
  crop = main.buildWorld().objects.find((o) => o.id === 'field_1');
  assert.equal(crop.growProgress, 1);
  assert.equal(crop.ready, true);
});

test('a building\'s progress ring runs over the recipe\'s own duration, not a fixed minute', () => {
  const s = freshWorld();
  s.coins = 5000;
  s.silo.items.wheat = 40;
  const bakery = farm.place('building', 'bakery', 17, 15);
  assert.ok(bakery, 'bakery must place');
  const bread = data.BUILDINGS.bakery.recipes.find((r) => r.id === 'bread');
  assert.ok(production.enqueue(bakery.id, 'bread'));
  let b = main.buildWorld().objects.find((o) => o.id === bakery.id);
  assert.equal(b.working, true);
  assert.ok(b.progress >= 0 && b.progress < 0.05, `fresh craft should be ~0, got ${b.progress}`);
  const entry = s.production.find((p) => p.objectId === bakery.id);
  entry.readyAt = Date.now() + bread.time * 500;   // halfway through a recipe of time seconds
  b = main.buildWorld().objects.find((o) => o.id === bakery.id);
  assert.ok(Math.abs(b.progress - 0.5) < 0.05, `halfway should read ~0.5, got ${b.progress}`);
  entry.readyAt = Date.now() - 1;
  b = main.buildWorld().objects.find((o) => o.id === bakery.id);
  assert.equal(b.working, false);
  assert.equal(b.ready, true, 'a finished plain craft is collectable, so the building shows ready');
});

test('unowned land carries scenery and a signpost per locked expansion; buying a zone clears it', () => {
  const s = freshWorld();
  const inRect = (o, r) => Math.floor(o.tx) >= r.x && Math.floor(o.tx) < r.x + r.w && Math.floor(o.ty) >= r.y && Math.floor(o.ty) < r.y + r.h;
  let objects = main.buildWorld().objects;
  const scenery = objects.filter((o) => o.kind === 'scenery' && o.type !== 'rail');
  assert.ok(scenery.length > 100, `expected a forest on the unowned 40x40, got ${scenery.length}`);
  assert.ok(!scenery.some((o) => inRect(o, data.FARM.startZone)), 'no tree may stand on owned land');
  assert.ok(scenery.some((o) => o.type === 'tree' && ['oak', 'pine', 'birch', 'fruit'].includes(o.species)), 'trees carry a species');
  assert.equal(objects.filter((o) => o.kind === 'signpost').length, data.FARM.expansions.length);
  // 44 boundary tiles; a corner facing two unowned sides on the same face folds into one object
  const rails = objects.filter((o) => o.type === 'rail');
  assert.ok(rails.length >= 4 * data.FARM.startZone.w - 8, `the owned edge is fenced, got ${rails.length} rail objects`);
  const sides = new Set(rails.flatMap((r) => r.sides.split('')));
  assert.deepEqual([...sides].sort(), ['E', 'N', 'S', 'W'], 'all four faces of the start zone carry rails');

  const exp1 = data.FARM.expansions[0];
  assert.ok(scenery.some((o) => inRect(o, exp1.rect)), 'expansion_1 is wooded before purchase');
  s.farm.unlockedZones.push(exp1.id);
  objects = main.buildWorld().objects;
  assert.equal(objects.filter((o) => o.kind === 'signpost').length, data.FARM.expansions.length - 1);
  assert.ok(!objects.some((o) => o.kind === 'scenery' && o.type !== 'rail' && inRect(o, exp1.rect)), 'buying clears the trees');
  assert.ok(main.ownedRects(s).some((r) => r === exp1.rect));
});

test('KIND_DISPATCH covers every kind buildWorld emits on a busy farm', () => {
  const s = freshWorld();
  s.coins = 9000; s.silo.items.wheat = 40; s.level = 12;
  s.pets = { dog: { owned: true, lastFedAt: 0 }, cat: { owned: true, lastFedAt: 0 } };
  farm.place('pen', 'cow', 15, 15);
  farm.place('building', 'bakery', 17, 15);
  farm.place('decoration', 'tree_oak', 19, 13);
  production.plant('field_2', 'wheat');
  const kinds = new Set(main.buildWorld().objects.map((o) => o.kind));
  for (const k of ['field', 'crop', 'pen', 'penfront', 'animal', 'building', 'decoration', 'structure', 'pet', 'scenery', 'signpost']) {
    assert.ok(kinds.has(k), `expected buildWorld to emit kind "${k}"`);
  }
  for (const k of kinds) assert.ok(renderer.DISPATCH_KINDS.includes(k), `KIND_DISPATCH is missing "${k}"`);
});

// ---------------------------------------------------------------------------
// Effects: one clock
// ---------------------------------------------------------------------------

test('a particle spawned now survives the very next frame drawn with the frame loop\'s clock', () => {
  motion.__setReducedForTests(false);
  const before = effects.particleCount();
  effects.coinBurst(100, 100, 50);
  effects.sparkle(100, 100);
  effects.xpFloater(100, 100, 3);
  assert.ok(effects.particleCount() > before);
  effects.tickAndDraw(recorder(), Date.now());
  assert.ok(effects.particleCount() > before, 'particles were pruned on their first frame - the spawn clock and the draw clock disagree');
  effects.tickAndDraw(recorder(), Date.now() + 5000);
  assert.equal(effects.particleCount(), 0, 'and they are gone once their life is over');
});

test('effects are spawned from the harvest, collect and place paths (source guard)', () => {
  const input = readFileSync(new URL('../src/input.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.ok(/effects\.sparkle\(/.test(input) && /effects\.xpFloater\(/.test(input), 'input.js must spawn juice on harvest/collect');
  assert.ok(/effects\.placeBounce\(/.test(input), 'input.js must bounce a placed object');
  assert.ok(/effects\.coinBurst\(/.test(ui), 'ui.js must burst coins when the balance grows');
});

// ---------------------------------------------------------------------------
// Sprites: every family draws against the fake context, and nothing is sized in raw pixels
// ---------------------------------------------------------------------------

test('every structure, pen, crop, animal, forage node, decoration and scenery sprite draws on the fake context', () => {
  const ctx = recorder();
  for (const id of Object.keys(data.STRUCTURES)) {
    sprites.drawStructure(ctx, id, 100, 100, 2, { derelict: false, now: 0, fw: 2, fh: 2 });
    sprites.drawStructure(ctx, id, 100, 100, 2, { derelict: true, now: 1234, fw: 2, fh: 2 });
  }
  for (const id of Object.keys(data.ANIMALS)) {
    sprites.drawPen(ctx, 100, 100, 2, id, { fw: 2, fh: 2, part: 'back', fed: true });
    sprites.drawPen(ctx, 100, 100, 2, id, { fw: 2, fh: 2, part: 'front' });
    sprites.ANIMAL_DRAW[id](ctx, 100, 100, 1, 0.3);
  }
  const missingCrops = Object.keys(data.CROPS).filter((id) => typeof sprites.CROP_DRAW[id] !== 'function');
  assert.deepEqual(missingCrops, [], `crops with no sprite would render as the magenta placeholder: ${missingCrops.join(', ')}`);
  for (const id of Object.keys(data.CROPS)) {
    for (const g of [0, 0.3, 0.7, 1]) sprites.CROP_DRAW[id](ctx, 100, 100, 1, g);
  }
  const missingAnimals = Object.keys(data.ANIMALS).filter((id) => typeof sprites.ANIMAL_DRAW[id] !== 'function');
  assert.deepEqual(missingAnimals, [], `animals with no sprite: ${missingAnimals.join(', ')}`);
  for (const fn of Object.values(sprites.FORAGE_DRAW)) fn(ctx, 100, 100, 1);
  for (const id of Object.keys(data.DECORATIONS)) sprites.drawDecoration(ctx, 100, 100, 1, id, { now: 0, fw: 1, fh: 1 });
  for (const species of ['oak', 'pine', 'birch', 'fruit']) sprites.drawTree(ctx, 100, 100, 1, { kind: species, variant: 0.4 });
  for (const type of ['bush', 'rock', 'stump']) sprites.drawScenery(ctx, 100, 100, 1, { type, variant: 0.5 });
  sprites.drawScenery(ctx, 100, 100, 1, { type: 'rail', sides: 'NESW' });
  sprites.drawSignpost(ctx, 100, 100, 1, { level: 4, locked: true, cost: 500 });
  sprites.drawSignpost(ctx, 100, 100, 1, { level: 4, locked: false, cost: 500 });
  sprites.drawCat(ctx, 100, 100, 1, 0.5); sprites.drawDog(ctx, 100, 100, 1, 0.5);
  sprites.drawGoldenHour(ctx, 1280, 800);
  sprites.drawMeadow(ctx, 1280, 800);
  assert.ok(ctx.__calls.length > 1000);
});

test('sprites.js sizes nothing in raw pixels: no `lineWidth = <number>;` literal survives', () => {
  const src = readFileSync(new URL('../src/render/sprites.js', import.meta.url), 'utf8');
  const literal = src.match(/lineWidth = \d+(\.\d+)?;/g) || [];
  assert.deepEqual(literal, [], `zoom-blind line widths: ${literal.join(' | ')}`);
  assert.ok(!/const T = 104;/.test(src), 'no sprite may pin T to 104 and ignore its size argument');
});

test('every gradient in sprites.js goes through the guarded helpers', () => {
  const src = readFileSync(new URL('../src/render/sprites.js', import.meta.url), 'utf8');
  const raw = src.split('\n').filter((l, i) => /ctx\.create(Linear|Radial)Gradient\(/.test(l) && !/try \{ g = ctx\.create/.test(l));
  assert.deepEqual(raw, [], `raw gradient calls would throw on the fake context: ${raw.join(' | ')}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
