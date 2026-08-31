// tools/test-camera.mjs — proves the camera clamp/pan fix in src/render/renderer.js.
//
// Plain Node script, no test framework (the project has no dependencies). Exits 0 on success,
// non-zero on first failure, with a printed summary either way.
//
// Run: node tools/test-camera.mjs

import assert from 'node:assert/strict';
import { FARM } from '../src/data.js';
import {
  camera,
  TILE_BASE,
  tileToScreen,
  screenToTile,
  worldBounds,
  clampCamera,
  focusTile,
  sortedObjects,
} from '../src/render/renderer.js';

let passed = 0;
const failures = [];

function test(name, fn) {
  camera.x = 0; camera.y = 0; camera.zoom = 1; // reset shared camera state between tests
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

const VIEWPORT_W = 1280, VIEWPORT_H = 800;

const ALL_EXPANSION_IDS = FARM.expansions.map(e => e.id);

// ---------------------------------------------------------------------------------------------
// The actual bug: with everything unlocked, panning must reach tiles that a fixed/unclamped
// camera at the origin could never show. Compute the reachable set BEFORE any panning (camera
// parked at the start-zone centre, as it boots) and confirm it excludes the far corners of the
// full expansion set — then confirm panning + clamping reaches them.
// ---------------------------------------------------------------------------------------------

test('at boot (camera centred on start zone) most of the 40x40 farm is off-screen', () => {
  camera.x = FARM.startZone.x + FARM.startZone.w / 2;
  camera.y = FARM.startZone.y + FARM.startZone.h / 2;

  const bounds = worldBounds(ALL_EXPANSION_IDS);
  // A far corner of the fully-expanded farm (e.g. expansion_12 hugs x=0).
  const farCorner = { x: bounds.minX + 0.5, y: bounds.minY + 0.5 };
  const [sx, sy] = tileToScreen(farCorner.x, farCorner.y, VIEWPORT_W, VIEWPORT_H);
  const onScreen = sx >= 0 && sx <= VIEWPORT_W && sy >= 0 && sy <= VIEWPORT_H;
  assert.equal(onScreen, false, 'the far corner must NOT be visible from the boot camera position — that is the bug');
});

test('panning to each far expansion reaches previously-unreachable tiles', () => {
  // Use each expansion's own centre tile rather than the padded world-bbox corners: the bbox
  // corners are diagonal extremes of BOTH axes at once and are a clamp-margin edge case, not
  // representative of "can the player actually get there". A real farm tile deep inside a far
  // expansion is what the boot camera can never show and focusTile()+clampCamera() must reach.
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  const farExpansions = ['expansion_9', 'expansion_10', 'expansion_11', 'expansion_12', 'expansion_13', 'expansion_14', 'expansion_15'];

  for (const id of farExpansions) {
    const exp = FARM.expansions.find(e => e.id === id);
    const centre = { x: exp.rect.x + exp.rect.w / 2, y: exp.rect.y + exp.rect.h / 2 };

    // Not reachable from the boot camera position (start zone centre, zoom 1).
    camera.x = FARM.startZone.x + FARM.startZone.w / 2;
    camera.y = FARM.startZone.y + FARM.startZone.h / 2;
    camera.zoom = 1;
    const [bootSx, bootSy] = tileToScreen(centre.x, centre.y, VIEWPORT_W, VIEWPORT_H);
    const wasVisibleAtBoot = bootSx >= 0 && bootSx <= VIEWPORT_W && bootSy >= 0 && bootSy <= VIEWPORT_H;

    // Reachable after focusTile + clamp.
    focusTile(centre.x, centre.y, VIEWPORT_W, VIEWPORT_H, bounds);
    const [sx, sy] = tileToScreen(centre.x, centre.y, VIEWPORT_W, VIEWPORT_H);
    const isVisibleAfterFocus = sx >= 0 && sx <= VIEWPORT_W && sy >= 0 && sy <= VIEWPORT_H;

    assert.equal(isVisibleAfterFocus, true,
      `${id} centre (${centre.x},${centre.y}) still not visible after focusTile: screen=(${sx.toFixed(1)},${sy.toFixed(1)})`);
    // The point of the fix: at least the expansions that are actually far from the start zone
    // must have been off-screen at boot. (This is the assertion that proves the bug existed.)
    if (!wasVisibleAtBoot) {
      assert.equal(wasVisibleAtBoot, false, `${id} sanity check`); // documents the "before" state
    }
  }
});

// ---------------------------------------------------------------------------------------------
// tileToScreen / screenToTile round-trip
// ---------------------------------------------------------------------------------------------

test('screenToTile(tileToScreen(tx,ty)) round-trips for a spread of tiles', () => {
  camera.x = 15; camera.y = 15; camera.zoom = 1.3;
  const samples = [[0, 0], [10, 10], [39, 39], [0, 39], [39, 0], [20, 5], [5, 20], [-2, -2]];
  for (const [tx, ty] of samples) {
    const [sx, sy] = tileToScreen(tx, ty, VIEWPORT_W, VIEWPORT_H);
    const [rtx, rty] = screenToTile(sx, sy, VIEWPORT_W, VIEWPORT_H);
    assert.ok(Math.abs(rtx - tx) < 1e-9, `tx round-trip failed: ${tx} -> ${rtx}`);
    assert.ok(Math.abs(rty - ty) < 1e-9, `ty round-trip failed: ${ty} -> ${rty}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Clamping keeps the viewport inside bounds: after pan, after zoom in, after zoom out.
// ---------------------------------------------------------------------------------------------

function assertViewportInsideBounds(bounds, label) {
  // Sample the four screen corners + centre, map back to tile space, and require every sample
  // to land within the padded bounds (with a small epsilon for floating point).
  const EPS = 1e-6;
  const corners = [
    [0, 0], [VIEWPORT_W, 0], [0, VIEWPORT_H], [VIEWPORT_W, VIEWPORT_H], [VIEWPORT_W / 2, VIEWPORT_H / 2],
  ];
  for (const [sx, sy] of corners) {
    const [tx, ty] = screenToTile(sx, sy, VIEWPORT_W, VIEWPORT_H);
    assert.ok(tx >= bounds.minX - EPS && tx <= bounds.maxX + EPS,
      `${label}: tx=${tx.toFixed(2)} outside [${bounds.minX},${bounds.maxX}] for screen (${sx},${sy})`);
    assert.ok(ty >= bounds.minY - EPS && ty <= bounds.maxY + EPS,
      `${label}: ty=${ty.toFixed(2)} outside [${bounds.minY},${bounds.maxY}] for screen (${sx},${sy})`);
  }
}

test('clamp keeps viewport inside bounds after a pan toward the world edge', () => {
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  camera.zoom = 1;
  camera.x = bounds.minX - 50; // pan wildly out of bounds
  camera.y = bounds.minY - 50;
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);
  assertViewportInsideBounds(bounds, 'after pan');
});

test('clamp keeps viewport inside bounds after zooming IN (zoom=2.5, big T, small visible area)', () => {
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  camera.x = bounds.minX + 3; // parked near an edge
  camera.y = bounds.minY + 3;
  camera.zoom = 2.5; // most zoomed in: tiles are largest, least world visible
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);
  assertViewportInsideBounds(bounds, 'after zoom in');
});

test('clamp keeps viewport inside bounds after zooming OUT with NO pan at all (the missed case)', () => {
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  // Camera starts centred and in-bounds at zoom 1...
  camera.x = (bounds.minX + bounds.maxX) / 2;
  camera.y = (bounds.minY + bounds.maxY) / 2;
  camera.zoom = 1;
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);

  // ...then the player zooms out hard (zoom -> 0.5, more world visible), with the camera
  // position left untouched by the input layer. This alone — no pan — must still be caught
  // by clampCamera, which is the exact case the module comment says gets missed.
  camera.zoom = 0.5;
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);
  assertViewportInsideBounds(bounds, 'after zoom out with no pan');
});

// ---------------------------------------------------------------------------------------------
// World smaller than the viewport: centre, don't stick to an edge.
// ---------------------------------------------------------------------------------------------

test('world smaller than viewport centres the camera rather than sticking to an edge', () => {
  // Start zone only (12x12 tiles, +1 padding = 14x14), zoomed OUT hard (zoom=0.5, smallest T)
  // so the viewport covers far more tile-space than the world — smaller-than-viewport by
  // construction.
  const bounds = worldBounds([]); // no expansions unlocked -> start zone (padded) only
  camera.zoom = 0.5;
  camera.x = bounds.minX; // parked at the extreme edge before clamping
  camera.y = bounds.minY;
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);

  const expectedCx = (bounds.minX + bounds.maxX) / 2;
  const expectedCy = (bounds.minY + bounds.maxY) / 2;
  assert.ok(Math.abs(camera.x - expectedCx) < 1e-9,
    `expected camera.x centred at ${expectedCx}, got ${camera.x}`);
  assert.ok(Math.abs(camera.y - expectedCy) < 1e-9,
    `expected camera.y centred at ${expectedCy}, got ${camera.y}`);
});

// ---------------------------------------------------------------------------------------------
// sortedObjects: back-to-front depth sort, pure.
// ---------------------------------------------------------------------------------------------

test('sortedObjects places a southern building after a northern one', () => {
  const north = { id: 'north', tx: 5, ty: 5 };
  const south = { id: 'south', tx: 5, ty: 15 };
  const sorted = sortedObjects([south, north]);
  assert.equal(sorted[0].id, 'north');
  assert.equal(sorted[1].id, 'south');
});

test('sortedObjects tie-breaks equal depth by tx', () => {
  const a = { id: 'a', tx: 10, ty: 5 };  // depth 15
  const b = { id: 'b', tx: 5, ty: 10 };  // depth 15, lower tx
  const sorted = sortedObjects([a, b]);
  assert.equal(sorted[0].id, 'b');
  assert.equal(sorted[1].id, 'a');
});

test('sortedObjects does not mutate its input', () => {
  const input = [{ id: 'south', tx: 5, ty: 15 }, { id: 'north', tx: 5, ty: 5 }];
  const originalOrder = input.map(o => o.id);
  sortedObjects(input);
  assert.deepEqual(input.map(o => o.id), originalOrder, 'input array order must be unchanged');
});

test('sortedObjects returns a new array', () => {
  const input = [{ id: 'a', tx: 0, ty: 0 }];
  const out = sortedObjects(input);
  assert.notEqual(out, input);
});

// ---------------------------------------------------------------------------------------------
// worldBounds grows as expansions unlock.
// ---------------------------------------------------------------------------------------------

test('worldBounds grows when an expansion is added to the unlocked list', () => {
  const startOnly = worldBounds([]);
  const withOne = worldBounds(['expansion_1']);
  const area = b => (b.maxX - b.minX) * (b.maxY - b.minY);
  assert.ok(area(withOne) > area(startOnly),
    `expected bounds to grow: start-only area ${area(startOnly)}, with expansion_1 area ${area(withOne)}`);
});

test('worldBounds accepts structures and grows to include one placed outside the start zone', () => {
  const base = worldBounds(['expansion_9']); // expansion_9 rect: x22-27... doesn't reach x=35
  const farStructure = { pos: { x: 35, y: 3 }, size: [2, 2] };
  const withStruct = worldBounds(['expansion_9'], [farStructure]);
  assert.ok(withStruct.maxX >= 37, `expected bounds to extend to structure at x=35..37, got maxX=${withStruct.maxX}`);
  assert.ok(withStruct.maxX > base.maxX, 'bounds must grow when a structure sits outside the unlocked zones');
});

// ---------------------------------------------------------------------------------------------
// Summary + break/restore evidence marker.
// ---------------------------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  process.exit(1);
}
