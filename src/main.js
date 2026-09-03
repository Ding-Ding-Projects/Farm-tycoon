// main.js — boot + game loop.
// Boot order: state.load() → renderer.init → ui.init → input.init → audio.init (deferred to
// first gesture) → tutorial.init → resolve offline progress (production.tick(now)) → rAF loop.
// Loop each frame: production/shop/orders/boat/event ticks → camera tick → drawFrame → updateHud.
// Autosave every state.settings.autosaveInterval seconds and on beforeunload.
//
// Debug hook (used by the playtest skill; harmless in production):
//   window.__farmDebug = { timeSkip(ms), state, give(itemId, qty) }

import * as state from './state.js';
import * as motion from './motion.js';
import * as renderer from './render/renderer.js';
import * as daylight from './render/daylight.js';
import * as ui from './ui.js';
import * as input from './input.js';
import * as audio from './audio.js';
import * as tutorial from './tutorial.js';
import * as production from './production.js';
import * as orders from './orders.js';
import * as boat from './boat.js';
import * as shop from './shop.js';
import * as trains from './trains.js';
import * as zoo from './zoo.js';
import * as extras from './extras.js';
import * as foraging from './foraging.js';
import * as placement from './placement.js';
import * as lab from './lab.js';
import * as helicopter from './helicopter.js';
import * as newspaper from './newspaper.js';
import * as coop from './coop.js';
import * as regatta from './regatta.js';
import * as farm from './farm.js';
import * as drag from './drag.js';
import { prand, tileHash } from './render/sprites.js';
import {
  CROPS, GOODS, MATERIALS, STRUCTURES, FARM, FORAGING, HELICOPTER, ANIMALS, BUILDINGS, LEVELS,
} from './data.js';

let lastAutosave = 0;
let running = false;
let lastFrameMs = 0;

// helicopter.tick()/regatta.tick() both resolve "how much time passed since I was last called"
// and then unconditionally reset their own baseline to `now` (helicopter.js's settleFuel();
// regatta.js's tick(), through neighbours.simulate()'s Math.round()). Called every animation
// frame (~16ms apart), the elapsed slice is always far too small to register — floor()/round()
// resolves to zero EVERY time, the baseline still advances to `now`, and that sliver of
// progress is gone for good: verified live, fuel would never regenerate and rival scores would
// never move if these two were ticked unthrottled, which is worse than the render-time-only
// workaround they had before (see ui.js's old safeTick calls). Throttled here to an interval
// long enough that real, non-zero progress lands on every call instead.
let lastHeliTick = 0;
let lastRegattaTick = 0;
let lastVisitorTick = 0;
const VISITOR_TICK_INTERVAL_MS = 60 * 1000; // extras.maybeSpawnVisitor rolls 2% per call: once a minute, not once a frame
const REGATTA_TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 min — safely above the ~90s worst case
// (slowest rival profile, unluckiest jitter) neighbours.simulate() needs to round up to ≥1 point.

function safeCall(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  try { return fn(...args); } catch (e) { console.error(e); return undefined; }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Stable 0..1 from an object id, so a pen's animals stand where they stood last frame. */
function idHash(id) {
  let h = 2166136261;
  const str = String(id);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The tile rects the player owns: the start zone plus every unlocked expansion. */
export function ownedRects(s) {
  const rects = [FARM.startZone];
  for (const id of s?.farm?.unlockedZones ?? []) {
    if (id === 'start') continue;
    const exp = FARM.expansions.find((e) => e.id === id);
    if (exp) rects.push(exp.rect);
  }
  return rects;
}

function tileTest(rects) {
  return (tx, ty) => {
    for (const r of rects) {
      if (tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h) return true;
    }
    return false;
  };
}

/** The level an expansion opens at, from LEVELS.unlocks (the same gate economy.isUnlocked reads). */
export function expansionLevel(expansionId) {
  for (const [level, ids] of Object.entries(LEVELS.unlocks)) {
    if (ids.includes(expansionId)) return Number(level);
  }
  return 1;
}

function structureAtTile(tx, ty) {
  for (const def of Object.values(STRUCTURES)) {
    if (tx >= def.pos.x && tx < def.pos.x + def.size[0] && ty >= def.pos.y && ty < def.pos.y + def.size[1]) return true;
  }
  return false;
}

// Scenery is deterministic from the tile coordinate, so it only has to be regenerated when the
// set of owned land changes (or the player's level, which flips a signpost's locked state).
let sceneryCache = { key: null, objects: [] };

/**
 * Trees, bushes, rocks and stumps on every tile the player does NOT own (plus a ring outside the
 * grid so the farm has a horizon), rail fences on owned tiles that face unowned land, and one
 * signpost per locked expansion. Ordinary depth-sorted render objects, so a tree draws in front
 * of a barn when it stands south of it. Buying a zone clears its scenery on the next frame.
 */
export function sceneryFor(s) {
  const key = `${(s.farm.unlockedZones || []).join(',')}|${s.level}`;
  if (sceneryCache.key === key) return sceneryCache.objects;
  const owned = tileTest(ownedRects(s));
  const objects = [];
  const G = FARM.gridSize, RING = 4;

  const signTiles = new Set();
  for (const exp of FARM.expansions) {
    if (s.farm.unlockedZones.includes(exp.id)) continue;
    const r = exp.rect;
    const cx = r.x + Math.floor(r.w / 2), cy = r.y + Math.floor(r.h / 2);
    signTiles.add(`${cx},${cy}`);
    const level = expansionLevel(exp.id);
    objects.push({
      id: `signpost:${exp.id}`, kind: 'signpost', type: exp.id, tx: cx, ty: cy, fw: 1, fh: 1,
      level, locked: s.level < level, cost: exp.cost,
    });
  }

  for (let ty = -RING; ty < G + RING; ty++) {
    for (let tx = -RING; tx < G + RING; tx++) {
      if (owned(tx, ty)) {
        let back = '', front = '';
        if (!owned(tx, ty - 1)) back += 'N';
        if (!owned(tx - 1, ty)) back += 'W';
        if (!owned(tx + 1, ty)) front += 'E';
        if (!owned(tx, ty + 1)) front += 'S';
        if (back) objects.push({ id: `rail:${tx},${ty}:b`, kind: 'scenery', type: 'rail', sides: back, tx, ty, fw: 1, fh: 1, depth: tx + ty - 0.5 });
        if (front) objects.push({ id: `rail:${tx},${ty}:f`, kind: 'scenery', type: 'rail', sides: front, tx, ty, fw: 1, fh: 1, depth: tx + ty + 0.5 });
        continue;
      }
      if (structureAtTile(tx, ty) || signTiles.has(`${tx},${ty}`)) continue;
      const hb = tileHash(tx, ty);
      const roll = prand(hb, 11);
      let type = null;
      if (roll < 0.13) type = 'tree';
      else if (roll < 0.19) type = 'bush';
      else if (roll < 0.23) type = 'rock';
      else if (roll < 0.25) type = 'stump';
      if (!type) continue;
      const speciesRoll = prand(hb, 12);
      objects.push({
        id: `scenery:${tx},${ty}`, kind: 'scenery', type,
        species: speciesRoll < 0.5 ? 'oak' : speciesRoll < 0.8 ? 'pine' : speciesRoll < 0.93 ? 'birch' : 'fruit',
        variant: prand(hb, 13),
        tx: tx + 0.15 + prand(hb, 14) * 0.7, ty: ty + 0.15 + prand(hb, 15) * 0.7, fw: 1, fh: 1,
      });
    }
  }
  sceneryCache = { key, objects };
  return objects;
}

/**
 * Assemble this frame's world for renderer.drawFrame: farm.js placed objects (fields/buildings/
 * pens/decorations, mapped into the {kind,type,tx,ty,fw,fh,...} shape renderer.js documents),
 * the animals inside every pen, owned pets, every STRUCTURES entry (always drawn, even locked/
 * derelict — that's what makes a level-90 system discoverable at level 5), forage nodes, and the
 * scenery on unowned land.
 */
function buildWorld() {
  const s = state.state;
  if (!s) return { objects: [] };
  const now = Date.now();
  const anim = motion.phase(now);
  const objects = [];

  for (const obj of s.farm.objects) {
    const [fw, fh] = farm.footprintOf(obj.kind, obj.type);
    if (obj.kind === 'field') {
      if (obj.cropId) {
        // readyAt is the end of the bar, NOT plantedAt + growTime: a timer skipped with diamonds
        // (or shifted by the debug hook) must read as ready the moment the harvest is allowed.
        const done = obj.readyAt !== null && obj.readyAt <= now;
        const span = obj.readyAt && obj.plantedAt ? obj.readyAt - obj.plantedAt : 0;
        const growProgress = done || span <= 0 ? 1 : clamp01((now - obj.plantedAt) / span);
        objects.push({ id: obj.id, kind: 'crop', type: obj.cropId, tx: obj.x, ty: obj.y, fw: 1, fh: 1, growProgress, ready: done });
      } else {
        objects.push({ id: obj.id, kind: 'field', type: 'field', tx: obj.x, ty: obj.y, fw: 1, fh: 1 });
      }
    } else if (obj.kind === 'pen') {
      const animal = ANIMALS[obj.type];
      const fed = obj.readyAt !== null && obj.readyAt > now;
      const ready = obj.readyAt !== null && obj.readyAt <= now;
      const penDepth = (obj.x + fw - 1) + (obj.y + fh - 1);
      const total = (animal?.produceTime ?? 1) * 1000;
      objects.push({
        id: obj.id, kind: 'pen', type: obj.type, tx: obj.x, ty: obj.y, fw, fh, fed, ready,
        progress: fed ? clamp01(1 - (obj.readyAt - now) / total) : undefined,
      });
      // The animals themselves. Bees are the one species whose "capacity" is a hive, not heads.
      const count = obj.type === 'bee' ? 3 : Math.min(5, animal?.capacity ?? 3);
      const hb = idHash(obj.id);
      for (let i = 0; i < count; i++) {
        const u = 0.4 + prand(hb, 30 + i) * (fw - 0.8);          // inside the yard, off the rails
        const v = 0.8 + prand(hb, 50 + i) * Math.max(0.2, fh - 1.1); // front two-thirds; shelter is at the back
        objects.push({
          id: `${obj.id}:a${i}`, kind: 'animal', type: obj.type, fw: 1, fh: 1,
          // An animal's feet land ~0.24 T below its anchor, so the anchor sits that far "north"
          // of the ground point in tile space (both axes) for the feet to stand on it.
          tx: obj.x + u - 0.24, ty: obj.y + v - 0.24,
          idleFrame: (anim / 1400 + prand(hb, 70 + i)) % 1,
          depth: penDepth + 0.02 + ((u + v) / (fw + fh)) * 0.05,
        });
      }
      objects.push({ id: `${obj.id}:front`, kind: 'penfront', type: obj.type, tx: obj.x, ty: obj.y, fw, fh, depth: penDepth + 0.1 });
    } else if (obj.kind === 'building') {
      const entries = s.production.filter((p) => p.objectId === obj.id);
      // Working means STILL COOKING, not merely "has a queue entry": a finished craft waiting
      // to be collected should look finished, so its chimney stops and its windows cool off.
      const cooking = entries.filter((p) => p.readyAt > now);
      let progress;
      if (cooking.length) {
        const soonest = cooking.reduce((a, b) => (a.readyAt < b.readyAt ? a : b));
        const recipe = BUILDINGS[obj.type]?.recipes?.find((r) => r.id === soonest.recipeId);
        const total = (recipe?.time ?? 60) * 1000;   // the recipe's OWN duration, not a fixed minute
        progress = clamp01(1 - (soonest.readyAt - now) / total);
      }
      const ready = entries.some((p) => p.readyAt <= now && production.isCollectable(p));
      // The queue as slot pips above the factory (Hay Day's strip): what a dragged recipe lands in.
      const slots = BUILDINGS[obj.type]?.queueSlots ?? 0;
      const queue = entries.map((p) => (p.readyAt > now ? 'cooking' : production.isCollectable(p) ? 'ready' : 'play'));
      objects.push({
        id: obj.id, kind: 'building', type: obj.type, tx: obj.x, ty: obj.y, fw, fh,
        working: cooking.length > 0, progress, ready, slots, queue,
      });
    } else if (obj.kind === 'decoration' || obj.kind === 'pond' || obj.kind === 'mine') {
      objects.push({ id: obj.id, kind: 'decoration', type: obj.type, tx: obj.x, ty: obj.y, fw, fh });
    }
  }

  for (const [key, def] of Object.entries(STRUCTURES)) {
    objects.push({
      id: `structure:${key}`, kind: 'structure', type: key,
      tx: def.pos.x, ty: def.pos.y, fw: def.size[0], fh: def.size[1],
      derelict: s.level < def.unlockLevel,
    });
  }

  // Owned pets keep the barn company.
  const barn = STRUCTURES.barn;
  for (const [petId, pet] of Object.entries(s.pets || {})) {
    if (!pet?.owned) continue;
    const spot = petId === 'cat' ? [1.55, 2.25] : [0.45, 2.35];
    objects.push({
      id: `pet:${petId}`, kind: 'pet', type: petId, fw: 1, fh: 1,
      tx: barn.pos.x + spot[0] - 0.24, ty: barn.pos.y + spot[1] - 0.24,
      idleFrame: (anim / 1600 + (petId === 'cat' ? 0.3 : 0)) % 1,
    });
  }

  // Forage nodes (foraging.js) — a SEPARATE array from s.farm.objects (see foraging.js's own
  // findFreeTile, which checks farm.objectAt to avoid ever overlapping one), so they need their
  // own loop here. `progress` reuses drawFrame's generic "ring while progress < 1" support to
  // show a regrowing node, from the node's own real respawn duration.
  for (const node of s.foraging?.nodes ?? []) {
    const respawnMs = (FORAGING.nodes[node.type]?.respawn ?? 1) * 1000;
    const elapsed = now - (node.readyAt - respawnMs);
    const progress = node.readyAt <= now ? 1 : clamp01(elapsed / respawnMs);
    objects.push({ id: node.id, kind: 'forage', type: node.type, tx: node.x, ty: node.y, fw: 1, fh: 1, progress });
  }

  for (const o of sceneryFor(s)) objects.push(o);

  // While the ghost is up, show the tile grid: that is the one moment the player is thinking in
  // tiles rather than in scenery, and it is exactly what CLAUDE.md reserves the grid for.
  const ghost = placement.ghost();
  const unlockedRects = ownedRects(s);
  // The tile or object under a live item drag, tinted by whether it takes the drop.
  const dropTarget = drag.target();
  // Fence-style decorations join up: a 1x1 decoration learns which of its four neighbours carries
  // the same type, and sprites.drawDecoration runs its rails toward them.
  const singles = new Map();
  for (const o of objects) if (o.kind === 'decoration' && o.fw === 1 && o.fh === 1) singles.set(`${o.type}:${o.tx},${o.ty}`, o);
  for (const o of singles.values()) {
    const at = (dx, dy) => singles.has(`${o.type}:${o.tx + dx},${o.ty + dy}`);
    const n = at(0, -1), e = at(1, 0), s = at(0, 1), w = at(-1, 0);
    if (n || e || s || w) o.joins = { n, e, s, w };
  }
  return { objects, ghost, showGrid: !!ghost, unlockedRects, isUnlocked: tileTest(unlockedRects), dropTarget };
}

/** Run every timer/tick module's tick(now), defensively — Phase B stubs are safe no-ops. */
function tickAllSystems(now) {
  safeCall(production.tick, now);
  safeCall(orders.tickTruck, now);
  safeCall(orders.tickDeliveries, now);   // trucks on the road arrive even with every panel shut
  safeCall(boat.tick, now);
  safeCall(shop.tick, now);
  safeCall(trains.tick, now);
  safeCall(zoo.tick, now);
  safeCall(extras.tickEvents, now);
  safeCall(foraging.tick, now);
  // The order board used to refill only while its panel was open, so a player who left it shut
  // for an hour came back to the same six orders. Idempotent: it only generates into a slot
  // whose cooldown has passed.
  safeCall(orders.refreshBoard, now);
  // NPC visitors (extras.js) had no caller at all. Throttled: the chance is per call.
  if (now - lastVisitorTick >= VISITOR_TICK_INTERVAL_MS) {
    lastVisitorTick = now;
    safeCall(extras.maybeSpawnVisitor, now);
  }

  // lab/newspaper/coop resolve elapsed time via a one-shot readyAt check or a staleness/
  // boundary comparison (see each module's own tick — none of them floor/round a fractional
  // slice of elapsed time into a baseline they then reset), so calling them every frame is
  // exactly as safe as production/orders/boat/shop/trains/zoo/extras above already are.
  safeCall(lab.tick, now);
  safeCall(newspaper.tick, now);
  safeCall(coop.tick, now);

  // helicopter and regatta do NOT share that property (see the module-load comment above) —
  // throttled so every call carries enough real elapsed time to register.
  if (now - lastHeliTick >= HELICOPTER.fuel.regenSeconds * 1000) {
    lastHeliTick = now;
    safeCall(helicopter.tick, now);
  }
  if (now - lastRegattaTick >= REGATTA_TICK_INTERVAL_MS) {
    lastRegattaTick = now;
    safeCall(regatta.tick, now);
  }
}

// Exported for tools/test-ui-contracts.mjs, which proves the loop-wiring seam the same way it
// proves ui.js's panel-routing seam: by calling the real function against real state, rather
// than restating what it does. Harmless for the shipped boot path — nothing here changes
// because these are now reachable from outside the module.
export { tickAllSystems, buildWorld };

/**
 * Shift every stored wall-clock stamp back by `ms`, simulating elapsed time, then tick every
 * system so the skipped time resolves. The playtest skill's backbone (window.__farmDebug.timeSkip
 * delegates here); exported so tools/test-ui-contracts.mjs can prove it reaches every timer.
 */
export function debugTimeSkip(ms) {
  const s = state.state;
  if (!s) return;
  const shift = (obj, key) => { if (obj && typeof obj[key] === 'number' && obj[key] > 0) obj[key] -= ms; };
  for (const obj of s.farm.objects) { shift(obj, 'readyAt'); shift(obj, 'plantedAt'); }
  for (const entry of s.production) shift(entry, 'readyAt');
  // Every system keeps absolute stamps under its OWN names. The truck and the boat never had a
  // `readyAt` - which is what this used to shift on them, i.e. nothing - so a playtest that
  // leaned on timeSkip silently never exercised the truck, the boat, the board's cooldowns,
  // trains, planes, the zoo, the merge board, co-op requests, shop listings or island voyages.
  for (const slot of s.orders?.board || []) shift(slot, 'readyAt');
  shift(s.orders?.truck, 'nextSpawnAt'); shift(s.orders?.truck, 'spawnedAt');
  for (const key of ['departsAt', 'dockedAt', 'nextSpawnAt']) shift(s.orders?.boat, key);
  for (const listing of s.shop?.listings || []) shift(listing, 'readyAt');
  for (const node of s.foraging?.nodes || []) shift(node, 'readyAt');
  shift(s.lab?.active, 'readyAt');
  shift(s.fishing?.cast, 'readyAt');
  for (const sys of [s.trains, s.airport]) {
    shift(sys, 'returningAt');
    shift(sys?.current, 'departsBy');
    shift(sys?.current, 'arrivedAt');
  }
  for (const enc of Object.values(s.zoo?.enclosures || {})) { shift(enc, 'readyAt'); shift(enc, 'fedAt'); }
  shift(s.zoo, 'lastIncomeAt');
  shift(s.merge, 'energyUpdatedAt');
  for (const req of s.coop?.requests || []) shift(req, 'readyAt');
  shift(s.islands?.voyage, 'readyAt');
  for (const trip of s.expeditions?.active || []) shift(trip, 'readyAt');
  shift(s.newspaper, 'generatedAt');
  shift(s.regatta, 'endsAt');
  // helicopter/regatta resolve elapsed time from their OWN baseline field, not a fixed
  // readyAt - shift that instead so tickAllSystems() below actually sees the skipped time
  // (and reset this file's own loop throttles so they do not swallow the very tick that is
  // supposed to make it visible).
  shift(s.helicopter, 'fuelUpdatedAt');
  shift(s.helicopter?.current, 'returningAt');
  for (const r of s.regatta?.rivals || []) shift(r, 'lastTickAt');
  lastHeliTick = 0;
  lastRegattaTick = 0;
  lastVisitorTick = 0;
  tickAllSystems(Date.now());
}


let debugHour = null;   // a pinned local hour for the day/night cycle (null = the real clock)

function loop(nowMs) {
  if (!running) return;
  const now = Date.now();
  // The real frame delta (clamped so a background tab cannot fling the camera when it wakes),
  // rather than an assumed 60 Hz: the glide takes the same time on a 30 Hz phone and a 144 Hz
  // monitor.
  const dt = lastFrameMs ? Math.min(0.1, Math.max(0.001, (nowMs - lastFrameMs) / 1000)) : 1 / 60;
  lastFrameMs = nowMs;
  tickAllSystems(now);
  safeCall(tutorial.checkAutoEvents);
  safeCall(renderer.tickCamera, dt);
  const world = buildWorld();
  // The light over the farm follows the player's clock when the cycle is on; {} paints the
  // fixed golden hour. __farmDebug.setHour pins an hour for screenshots and playtests.
  world.light = debugHour == null
    ? daylight.lightingFor(now, state.state?.settings?.dayCycle !== false)
    : daylight.lightingAtHour(debugHour);
  safeCall(renderer.drawFrame, now, world);
  ui.updateHud();

  const interval = (state.state?.settings?.autosaveInterval || 10) * 1000;
  if (now - lastAutosave > interval) {
    lastAutosave = now;
    state.save();
  }

  requestAnimationFrame(loop);
}

/**
 * Live camera bounds: start zone ∪ every unlocked expansion ∪ every STRUCTURES entry — locked
 * ones included, because buildWorld() below emits one render object per STRUCTURES entry
 * unconditionally (a level-90 system sitting derelict on the map from level 5 is the whole point
 * of that design; see buildWorld()'s own comment), so the clamp's domain must cover every one it
 * draws, not just the reachable subset of today's save. Unioning in every structure's real
 * pos+size (NOT buildWorld()'s per-frame render shape, which collapses size down to a single
 * `scale` number and would under-count a footprint like the 4x3 airport) took structure
 * reachability from 1/22 to 17/22 at zoom 1 and 22/22 zoomed in — see tools/test-camera.mjs.
 *
 * A FUNCTION, called fresh each time, not a bounds object computed once — `state.state` is read
 * live inside it (an ES module live binding, so this always sees the current save, not a
 * snapshot), so the domain grows the moment an expansion unlocks mid-game rather than only at
 * the next boot(). Registered with renderer.setBoundsProvider() below so every clamp inside
 * renderer.js (tickCamera()'s every-frame clamp, resizeToWindow()'s on-resize clamp — not just
 * this function's own one-off focusTile() call) shares this same domain permanently, not just
 * for the instant between boot() and frame 1. Before that provider existed, tickCamera() ran
 * every frame before drawFrame and always fell back to clampCamera()'s bare worldBounds()
 * default (start zone only) — verified by direct simulation to be the permanent steady state,
 * discarding whatever richer bounds boot() had just computed. See renderer.js's own comments on
 * setBoundsProvider()/tickCamera() for the mechanism.
 */
function cameraBounds() {
  return renderer.worldBounds(state.state?.farm?.unlockedZones ?? [], Object.values(STRUCTURES));
}

function boot() {
  const canvas = document.getElementById('world');
  const bootStatus = document.getElementById('boot-status');

  state.load();
  const now = Date.now();
  const s = state.state;

  renderer.init(canvas);
  renderer.setBoundsProvider(cameraBounds);

  const bounds = cameraBounds();

  // Where to point the camera, separately from how far it may travel (`bounds` above — now the
  // permanent clamp domain, not just this boot frame's). The geometric centre of the empty
  // 12x12 start zone (the old target) sits on the far side of the domain from the starting
  // fields (planted 3 rows north of the start zone's own centre), landing near its worse edge;
  // aiming at the centre of what is actually placed — the save's real farm objects plus whichever
  // STRUCTURES are unlocked at the player's current level (locked ones deliberately excluded:
  // they're reachable by panning now that the clamp domain covers them, but nothing unusable yet
  // should pull the initial framing toward it) — lands nearer the domain's centre instead.
  const startCenterX = FARM.startZone.x + FARM.startZone.w / 2;
  const startCenterY = FARM.startZone.y + FARM.startZone.h / 2;
  const level = s?.level ?? 1;
  const unlockedStructures = Object.values(STRUCTURES).filter((d) => level >= d.unlockLevel);
  // Prefer what the PLAYER owns. Averaging their plots together with every unlocked structure
  // drags the opening camera off toward the scenery: on a fresh save it framed the lake and the
  // truck bay while the six starting fields sat half off the top-left corner, which is the one
  // thing the tutorial immediately asks the player to use. Structures are the fallback for a
  // save that somehow owns nothing, not an equal vote.
  const ownedPoints = (s?.farm?.objects ?? []).map((o) => ({ x: o.x, y: o.y }));
  const focusPoints = ownedPoints.length
    ? ownedPoints
    : unlockedStructures.map((d) => ({ x: d.pos.x + d.size[0] / 2, y: d.pos.y + d.size[1] / 2 }));
  const focusX = focusPoints.length
    ? focusPoints.reduce((sum, p) => sum + p.x, 0) / focusPoints.length
    : startCenterX;
  const focusY = focusPoints.length
    ? focusPoints.reduce((sum, p) => sum + p.y, 0) / focusPoints.length
    : startCenterY;

  const vp = renderer.getViewport();
  // Open zoomed out far enough to see the farm you are being asked to use. At zoom 1 a 1280x800
  // viewport shows barely a dozen tiles, so the barn filled the screen and the six starting
  // fields the tutorial immediately points at sat off the bottom edge. clampCamera's own algebra
  // says the visible tile span is (w + 2h) / (2 * TILE_BASE * zoom); solving that for a ~20-tile
  // span gives a framing where the whole start zone and its neighbours are on screen at once.
  const FIT_SPAN_TILES = 20;
  const fitZoom = Math.max(0.5, Math.min(1, (vp.w + 2 * vp.h) / (2 * renderer.TILE_BASE * FIT_SPAN_TILES)));
  renderer.camera.zoom = fitZoom;
  safeCall(renderer.focusTile, focusX, focusY, vp.w, vp.h, bounds);
  renderer.cameraTarget.x = renderer.camera.x;
  renderer.cameraTarget.y = renderer.camera.y;
  renderer.cameraTarget.zoom = renderer.camera.zoom;

  motion.init();   // must run before the first frame, so nothing animates once and then stops
  ui.init();
  input.init(canvas);
  tutorial.init();

  // Resolve any offline progress up to right now before the first frame paints.
  safeCall(production.tick, now);

  if (bootStatus) bootStatus.textContent = '';

  // Save on every route out of the app, not just beforeunload.
  //
  // beforeunload is the desktop event and it is genuinely unreliable on mobile: Android
  // frequently backgrounds or kills an app without ever firing it, which on the Android target
  // means the last stretch of play is simply gone. visibilitychange (to hidden) and pagehide are
  // the events the platform actually guarantees, and they fire at the moment the app leaves the
  // foreground, which is precisely when the OS may decide to reclaim it.
  //
  // This matters more than it looks, and it was measured rather than assumed. localStorage is
  // committed to disk lazily: force-quitting the app seconds after a save loses that save
  // entirely and the game reloads the PREVIOUS one, while the same force-quit after a settling
  // window keeps everything. Saving on the way out is what gives the browser the chance to
  // commit before the process dies. See tools/verify-persistence.mjs, which demonstrates both
  // outcomes.
  const saveOnExit = () => { try { state.save(); } catch { /* never let a save break teardown */ } };
  window.addEventListener('beforeunload', saveOnExit);
  window.addEventListener('pagehide', saveOnExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveOnExit();
  });

  running = true;
  lastAutosave = now;
  requestAnimationFrame(loop);

  // ---------------------------------------------------------------------
  // Debug hook for the playtest skill. Harmless in production: it only
  // mutates state the player could already reach through play.
  // ---------------------------------------------------------------------
  window.__farmDebug = {
    get state() { return state.state; },
    /** Shift every stored readyAt timestamp back by ms, simulating elapsed time. */
    timeSkip(ms) { debugTimeSkip(ms); },
    /** Pin the day/night cycle to a local hour (0..24) for screenshots; null returns to the clock. */
    setHour(hour) { debugHour = hour == null ? null : Number(hour); },
    /** Grant qty of an item id straight into the appropriate storage bucket. */
    give(itemId, qty = 1) {
      const s = state.state;
      if (!s) return;
      if (CROPS[itemId]) {
        s.silo.items[itemId] = (s.silo.items[itemId] || 0) + qty;
      } else if (GOODS[itemId] || MATERIALS[itemId]) {
        s.barn.items[itemId] = (s.barn.items[itemId] || 0) + qty;
      } else {
        s.barn.items[itemId] = (s.barn.items[itemId] || 0) + qty;
      }
      ui.updateHud();
    },
  };
}

window.addEventListener('DOMContentLoaded', boot);
