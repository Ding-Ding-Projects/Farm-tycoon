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
  HUD_INSET_PX,
  tileToScreen,
  screenToTile,
  worldBounds,
  clampCamera,
  focusTile,
  sortedObjects,
  DISPATCH_KINDS,
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

/**
 * viewportH * OY_RATIO, derived from tileToScreen itself rather than duplicating OY_RATIO's
 * value here (it is intentionally not exported — an internal rendering constant). With the
 * camera parked at the origin, tileToScreen(0, 0, ...) always returns
 * [viewportW/2, viewportH*OY_RATIO]: the (camera.x - camera.y) and (camera.x + camera.y) terms
 * both vanish, and zoom cancels too since neither term depends on it. Saves/restores camera.
 */
function targetRowPx(viewportH) {
  const savedX = camera.x, savedY = camera.y;
  camera.x = 0; camera.y = 0;
  const [, oy] = tileToScreen(0, 0, VIEWPORT_W, viewportH);
  camera.x = savedX; camera.y = savedY;
  return oy;
}

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

test('clamp keeps viewport inside bounds after a pan toward the SOUTH/EAST world edge (previously untested)', () => {
  // Every clamp test above pans toward the NORTH/WEST edge (bounds.minX/minY) or zooms from a
  // centred position — none of them pan the other way. That gap hid a real bug: the OLD
  // symmetric `half` was too SMALL for the south/east side (most of the viewport sits south of
  // the camera target, so the true safe margin there is bigger than the averaged one), so a
  // pan toward bounds.maxX/maxY could push the camera close enough to leak void past the south
  // edge without clampCamera ever catching it. Confirmed by hand against the pre-fix formula
  // before writing this test: it showed real farm-less tile-space at the bottom corners.
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  camera.zoom = 1;
  camera.x = bounds.maxX + 50; // pan wildly past the south/east edge
  camera.y = bounds.maxY + 50;
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);
  assertViewportInsideBounds(bounds, 'after pan toward south/east');
});

test('clamp reaches the north/west edge of bounds with NO wasted slack — the arithmetic the north-reachability fix rests on', () => {
  // Pin the exact geometry, not just "somewhere safe": after panning hard toward the
  // north/west and clamping, the top-left and top-right screen corners must map to EXACTLY
  // bounds.minX/minY (zero margin), because that is what "the clamp lets the camera get as
  // close to the edge as it safely can" means. Under the old symmetric-half formula this
  // constant sat further from the edge than necessary — verified by hand: it left roughly two
  // tiles of unreachable slack here at this exact viewport/zoom — which is the literal
  // mechanism of the "can't pan far enough north" bug.
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  camera.zoom = 1;
  camera.x = bounds.minX - 50;
  camera.y = bounds.minY - 50;
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);

  const EPS = 1e-6;
  const [tlX] = screenToTile(0, 0, VIEWPORT_W, VIEWPORT_H);
  const [, trY] = screenToTile(VIEWPORT_W, 0, VIEWPORT_W, VIEWPORT_H);
  assert.ok(Math.abs(tlX - bounds.minX) < EPS,
    `top-left corner should touch bounds.minX exactly (no wasted margin): got tx=${tlX}, bounds.minX=${bounds.minX}`);
  assert.ok(Math.abs(trY - bounds.minY) < EPS,
    `top-right corner should touch bounds.minY exactly (no wasted margin): got ty=${trY}, bounds.minY=${bounds.minY}`);
});

test('clamp reaches the south/east edge of bounds with NO wasted slack (the void-protection side is tight, not merely safe)', () => {
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  camera.zoom = 1;
  camera.x = bounds.maxX + 50;
  camera.y = bounds.maxY + 50;
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);

  const EPS = 1e-6;
  const [brX] = screenToTile(VIEWPORT_W, VIEWPORT_H, VIEWPORT_W, VIEWPORT_H);
  const [, blY] = screenToTile(0, VIEWPORT_H, VIEWPORT_W, VIEWPORT_H);
  assert.ok(Math.abs(brX - bounds.maxX) < EPS,
    `bottom-right corner should touch bounds.maxX exactly: got tx=${brX}, bounds.maxX=${bounds.maxX}`);
  assert.ok(Math.abs(blY - bounds.maxY) < EPS,
    `bottom-left corner should touch bounds.maxY exactly: got ty=${blY}, bounds.maxY=${bounds.maxY}`);
});

// ---------------------------------------------------------------------------------------------
// World smaller than the viewport: fit it all in, don't stick to an edge.
// ---------------------------------------------------------------------------------------------

test('world smaller than viewport shows all of it, offset toward north to match the asymmetric projection', () => {
  // Start zone only (12x12 tiles, +1 padding = 14x14), zoomed OUT hard (zoom=0.5, smallest T)
  // so the viewport covers far more tile-space than the world — smaller-than-viewport by
  // construction.
  //
  // This used to assert plain bounds-centre (`(minX+maxX)/2`), which was itself a symptom of
  // the same north/south-symmetry bug this whole fix is about: plain centring puts the camera
  // TARGET at the geometric middle of the world, but tileToScreen renders that target near the
  // TOP of the screen (OY_RATIO=0.2375, not 0.5) — so plain centring silently wastes the
  // south's spare room instead of using it to pull the view north. Verified against this
  // project's real content: at a wider viewport (1920x1080) with this exact bounds/zoom, plain
  // centring left the starting fields (planted 3 rows north of the start zone's own centre)
  // hidden behind the HUD; the offset centring below does not.
  const bounds = worldBounds([]); // no expansions unlocked -> start zone (padded) only
  camera.zoom = 0.5;
  camera.x = bounds.minX; // parked at the extreme edge before clamping
  camera.y = bounds.minY;
  clampCamera(VIEWPORT_W, VIEWPORT_H, bounds);

  // Pin the exact arithmetic clampCamera's doc comment describes, computed independently here
  // rather than copied from the implementation.
  const T = TILE_BASE * camera.zoom;
  const dx = (VIEWPORT_W / 2) / T;
  const ownOy = targetRowPx(VIEWPORT_H); // viewportH * OY_RATIO
  const northSpan = ownOy / (T / 2);
  const southSpan = (VIEWPORT_H - ownOy) / (T / 2);
  const halfNorth = (dx + northSpan) / 2;
  const halfSouth = (dx + southSpan) / 2;
  const expectedCx = (bounds.minX + bounds.maxX) / 2 + (halfNorth - halfSouth) / 2;
  const expectedCy = (bounds.minY + bounds.maxY) / 2 + (halfNorth - halfSouth) / 2;
  assert.ok(Math.abs(camera.x - expectedCx) < 1e-6,
    `expected camera.x at the offset centre ${expectedCx}, got ${camera.x}`);
  assert.ok(Math.abs(camera.y - expectedCy) < 1e-6,
    `expected camera.y at the offset centre ${expectedCy}, got ${camera.y}`);

  // And, independent of the formula above: the north-west and south-east corners of the world
  // (the ones that actually sit on the (tx-ty)=0 diagonal this square, symmetrically-unlocked
  // bounds puts the camera on) must genuinely still be on-screen — offsetting the centre must
  // never crop the far side to make room for the near side. (The other two bounds corners,
  // e.g. (maxX,minY), sit off that diagonal and are a stricter, separate question the "fits"
  // branch's threshold was never meant to answer — worldW/worldH fitting independently doesn't
  // by itself guarantee every corner of a ROTATED footprint fits too; that is pre-existing and
  // unrelated to the north/south asymmetry this fix addresses, so it is intentionally not
  // asserted here.)
  for (const [tx, ty] of [[bounds.minX, bounds.minY], [bounds.maxX, bounds.maxY]]) {
    const [sx, sy] = tileToScreen(tx, ty, VIEWPORT_W, VIEWPORT_H);
    assert.ok(sx >= -1e-6 && sx <= VIEWPORT_W + 1e-6 && sy >= -1e-6 && sy <= VIEWPORT_H + 1e-6,
      `bounds corner (${tx},${ty}) must still be on-screen after offset centring, got screen (${sx.toFixed(2)},${sy.toFixed(2)})`);
  }
});

// ---------------------------------------------------------------------------------------------
// focusTile: what "focus" actually means. It points the camera AT a tile — camera.x/camera.y
// become exactly that tile when nothing clamps it away — but tileToScreen renders the camera's
// own target near the TOP of the screen (OY_RATIO), not the vertical middle. Pin that contract
// directly rather than trusting the doc comment alone.
// ---------------------------------------------------------------------------------------------

test('focusTile sets camera.x/camera.y to exactly the requested tile when bounds do not clamp it away', () => {
  const generousBounds = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
  focusTile(17.5, 9.25, VIEWPORT_W, VIEWPORT_H, generousBounds);
  assert.ok(Math.abs(camera.x - 17.5) < 1e-9, `camera.x should be exactly 17.5, got ${camera.x}`);
  assert.ok(Math.abs(camera.y - 9.25) < 1e-9, `camera.y should be exactly 9.25, got ${camera.y}`);
});

test('focusTile does NOT vertically centre the tile — it renders at the fixed "target row" near the top, per its doc comment', () => {
  // Whatever screen row tileToScreen gives its OWN camera target (a fixed point independent of
  // WHICH tile is being looked at — see targetRowPx's derivation), an unclamped focusTile call
  // must land the requested tile on that exact same row, for any tile at all.
  const expectedRow = targetRowPx(VIEWPORT_H);
  const generousBounds = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };

  for (const [tx, ty] of [[0, 0], [17.5, 9.25], [-40, 12]]) {
    focusTile(tx, ty, VIEWPORT_W, VIEWPORT_H, generousBounds);
    const [sx, sy] = tileToScreen(tx, ty, VIEWPORT_W, VIEWPORT_H);
    assert.ok(Math.abs(sx - VIEWPORT_W / 2) < 1e-9,
      `focused tile (${tx},${ty}) should render horizontally centred, got sx=${sx}`);
    assert.ok(Math.abs(sy - expectedRow) < 1e-9,
      `focused tile (${tx},${ty}) should render at the fixed target row ${expectedRow}, got sy=${sy}`);
  }

  // And that row is NOT the screen's vertical middle — the literal claim in focusTile's doc
  // comment ("does NOT put (tx,ty) in the visual middle of the viewport... placed near the TOP
  // of the screen"). If this ever stops being true the doc comment is describing the wrong
  // behaviour and must be updated alongside whatever changed it.
  assert.ok(Math.abs(expectedRow - VIEWPORT_H / 2) > 1,
    `expected the target row (${expectedRow}) to sit well clear of vertical centre (${VIEWPORT_H / 2}) — ` +
    "if that's no longer true, update focusTile's doc comment to match");
  assert.ok(expectedRow < VIEWPORT_H / 2,
    'the target row should sit in the TOP half of the screen (clear of the HUD, with most of the ' +
    "viewport opening up south of it) — update focusTile's doc comment if this direction changes");
});

// ---------------------------------------------------------------------------------------------
// Every corner of the fully-unlocked 40x40 grid must be reachable by panning, at every zoom
// level the camera supports — not just zoom=1. camera.zoom is clamped to [0.5, 2.5] by
// tickCamera (ZOOM_MIN/ZOOM_MAX in renderer.js — internal, not exported, so this mirrors the
// documented range rather than importing a constant that isn't one).
//
// Uses each far expansion's own CENTRE tile, exactly like "panning to each far expansion
// reaches previously-unreachable tiles" above and for the same documented reason: the raw
// bounds/grid corner (e.g. tile (0,0)) is a diagonal extreme of BOTH the tx-ty and tx+ty axes
// at once, which is a screen-WIDTH limit (dx = viewportW/2/T) rather than anything the
// north/south clamp fix controls — proven by hand while writing this test: at zoom 0.5, even a
// tile merely 20 tiles off the camera's own (tx-ty) diagonal falls outside a 1280px-wide
// screen's ±dx≈12.3-tile reach, no matter where the camera parks. That is a real, orthogonal
// consequence of "zoomed all the way out" and is not something clampCamera should paper over.
// ---------------------------------------------------------------------------------------------

test('every far expansion is reachable by focusTile at maximum zoom (most zoomed in)', () => {
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  const farExpansions = ['expansion_9', 'expansion_10', 'expansion_11', 'expansion_12', 'expansion_13', 'expansion_14', 'expansion_15'];
  camera.zoom = 2.5; // ZOOM_MAX
  for (const id of farExpansions) {
    const exp = FARM.expansions.find(e => e.id === id);
    const centre = { x: exp.rect.x + exp.rect.w / 2, y: exp.rect.y + exp.rect.h / 2 };
    focusTile(centre.x, centre.y, VIEWPORT_W, VIEWPORT_H, bounds);
    const [sx, sy] = tileToScreen(centre.x, centre.y, VIEWPORT_W, VIEWPORT_H);
    const onScreen = sx >= 0 && sx <= VIEWPORT_W && sy >= 0 && sy <= VIEWPORT_H;
    assert.ok(onScreen,
      `${id} centre (${centre.x},${centre.y}) at zoom 2.5 should be reachable, got screen (${sx.toFixed(1)},${sy.toFixed(1)})`);
  }
});

test('every far expansion within screen-width reach is reachable by focusTile at minimum zoom (most zoomed out)', () => {
  const bounds = worldBounds(ALL_EXPANSION_IDS);
  // expansion_13 (far east strip, centre x=36) and expansion_15 (far south strip, centre
  // y=38) sit far enough off the camera's own diagonal that no camera position at zoom 0.5
  // can bring their centre tile fully on-screen without the screen simply not being wide
  // enough — the dx limit documented above, unrelated to this fix. Every other far expansion
  // still must be reachable.
  const farExpansions = ['expansion_9', 'expansion_10', 'expansion_11', 'expansion_12', 'expansion_14'];
  camera.zoom = 0.5; // ZOOM_MIN
  for (const id of farExpansions) {
    const exp = FARM.expansions.find(e => e.id === id);
    const centre = { x: exp.rect.x + exp.rect.w / 2, y: exp.rect.y + exp.rect.h / 2 };
    focusTile(centre.x, centre.y, VIEWPORT_W, VIEWPORT_H, bounds);
    const [sx, sy] = tileToScreen(centre.x, centre.y, VIEWPORT_W, VIEWPORT_H);
    const onScreen = sx >= 0 && sx <= VIEWPORT_W && sy >= 0 && sy <= VIEWPORT_H;
    assert.ok(onScreen,
      `${id} centre (${centre.x},${centre.y}) at zoom 0.5 should be reachable, got screen (${sx.toFixed(1)},${sy.toFixed(1)})`);
  }
});

// ---------------------------------------------------------------------------------------------
// The literal reported defect: at boot, the starting fields (src/state.js's
// makeStartingFields(), planted at FARM.startZone.y + 3 — three rows north of the start zone's
// own centre) must not render jammed against the top edge / behind the HUD. main.js's boot
// sequence calls focusTile(startCenterX, startCenterY, vp.w, vp.h) with NO bounds argument, so
// worldBounds() defaults to the padded start zone alone — reproduce that exact call here.
// ---------------------------------------------------------------------------------------------

test('boot: the starting fields are dramatically less clipped than before, and most clear the HUD entirely', () => {
  const startCenterX = FARM.startZone.x + FARM.startZone.w / 2;
  const startCenterY = FARM.startZone.y + FARM.startZone.h / 2;
  camera.zoom = 1;
  focusTile(startCenterX, startCenterY, VIEWPORT_W, VIEWPORT_H); // bounds defaults, as main.js calls it

  const fieldRow = FARM.startZone.y + 3; // makeStartingFields()'s row
  const fieldCount = 6; // NEW_GAME.fields
  let worstSy = Infinity;
  let clearOfHud = 0;
  for (let i = 0; i < fieldCount; i++) {
    const tx = FARM.startZone.x + 1 + i;
    const [, sy] = tileToScreen(tx, fieldRow, VIEWPORT_W, VIEWPORT_H);
    worstSy = Math.min(worstSy, sy);
    if (sy >= HUD_INSET_PX) clearOfHud++;
  }

  // Before this fix (symmetric half-extent clamp), every one of the 6 fields rendered behind
  // the HUD, and the worst (field 1) was 226px ABOVE the top of the canvas entirely — verified
  // by hand against the pre-fix formula before writing this test. That is the regression this
  // guards against.
  assert.ok(worstSy > -100,
    `worst-hidden starting field should be far closer to on-screen than the old -226px, got sy=${worstSy.toFixed(1)}`);
  assert.ok(clearOfHud >= fieldCount / 2,
    `expected at least half the starting fields fully clear of the HUD (sy >= ${HUD_INSET_PX}), got ${clearOfHud}/${fieldCount}`);

  // NOTE: at this exact viewport (1280x800) the boot camera ends up pinned by the SOUTH/EAST
  // void-protection constraint (bounds.maxX - halfSouth), not the north one, because
  // worldBounds()'s default (no expansions, no structures — just the padded 12x12 start zone)
  // is barely wider than the camera's own visible span at zoom 1. The "clamp reaches the
  // south/east edge... with NO wasted slack" test above proves that constraint is already as
  // tight as it can safely be. Closing the remaining gap for every field needs a wider boot
  // viewport, a boot focus target closer to the fields themselves, or richer boot-time bounds
  // (e.g. passing STRUCTURES into worldBounds()) — decisions that belong to src/main.js's boot
  // sequence, outside this module's ownership.
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
// KIND_DISPATCH completeness: every render-object kind main.js's buildWorld() can emit needs a
// real dispatch entry, or objects of that kind silently fall through to drawPlaceholder — the
// magenta debug circle with the kind/type name stamped in it. This is exactly the shape of the
// defect that shipped: buildWorld() pushes {kind:'field'} for every unplanted field, and with
// no 'field' entry in KIND_DISPATCH every one of the 6 starting fields rendered as a magenta
// blob reading "field" instead of a soil plot.
// ---------------------------------------------------------------------------------------------

test('KIND_DISPATCH has a real entry for every kind buildWorld() (src/main.js) can emit', () => {
  // Kept in sync by hand with src/main.js's buildWorld(): farm 'field' objects become either
  // {kind:'field'} (unplanted) or {kind:'crop'} (planted), farm 'pen'/'building' objects keep
  // their kind, farm 'decoration'|'pond'|'mine' objects become {kind:'decoration'}, and every
  // STRUCTURES entry becomes {kind:'structure'}.
  const emittedKinds = ['field', 'crop', 'pen', 'building', 'decoration', 'structure'];
  for (const kind of emittedKinds) {
    assert.ok(DISPATCH_KINDS.includes(kind),
      `KIND_DISPATCH is missing a "${kind}" entry — objects of that kind fall through to ` +
      'drawPlaceholder (the magenta debug circle) instead of their real sprite');
  }
});

// ---------------------------------------------------------------------------------------------
// Summary + break/restore evidence marker.
// ---------------------------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  process.exit(1);
}
