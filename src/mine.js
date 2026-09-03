// mine.js — the mine (L24): spend a pickaxe or dynamite to dig; yields ore/gems per the
// weight tables of the CURRENT DEPTH (event gold_rush doubles). Ore refines in the Smelter
// building (a normal production building — see production.js/enqueue).
//
// The mine now has five tiered depths (MINE.depths). Each is opened with coins and materials,
// yields richer ore than the last, and only depths below the surface seam drop artifacts —
// which go to museum.js, never to the barn.
//
// MINE.tools is a live getter onto depths[0].tools, kept so dig() and the validator keep
// working unchanged. Read it for the surface seam only; anything depth-aware goes through
// digAt() instead.
// State: state.mine { depthUnlocked: [depthId], currentDepth, digs }

import { state } from './state.js';
import { MINE } from './data.js';
import * as economy from './economy.js';
import * as museum from './museum.js';
import * as storage from './storage.js';
import * as extras from './extras.js';

function depthDef(depthId) {
  return MINE.depths.find((d) => d.id === depthId) || null;
}

function isDepthUnlocked(depthId) {
  return state.mine.depthUnlocked.includes(depthId);
}

/** Weighted pick from a yield/loot table shaped [{..., weight}]. Returns one entry or null. */
function weightedPick(pool) {
  const total = pool.reduce((sum, e) => sum + (e.weight || 0), 0);
  if (!(total > 0)) return null;
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight || 0;
    if (roll < 0) return entry;
  }
  return pool[pool.length - 1];
}

function randomQty(qty) {
  if (Array.isArray(qty)) {
    const [lo, hi] = qty;
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  return qty;
}

/** Whether an event doubling ore/gem yields (Mining Madness, or a gold_rush id) is active. */
function goldRushActive() {
  if (state.event && state.event.id === 'gold_rush' && state.event.endsAt > Date.now()) return true;
  try { return !!extras.activeEventEffect()?.mineDouble; } catch { return false; }
}

function barnRoom() { return storage.room('barn'); }

/** Dig with a tool ('pickaxe'|'dynamite') at the surface seam. Sugar for digAt(depth 1). */
export function dig(tool) {
  return digAt(MINE.depths[0].id, tool);
}

/** The dig currently being worked, or null. */
export function activeDig() {
  if (!state.mine.active) return null;
  return state.mine.active;
}

/** Mark a finished dig as ready. Called from the game loop, so a seam finishes with the panel shut. */
export function tick(now = Date.now()) {
  const active = state.mine.active;
  if (active && !active.ready && now >= active.readyAt) active.ready = true;
}

/**
 * Start a dig at a specific unlocked depth. Consumes the tool and ROLLS the haul now, but the
 * ore does not come up until the seam has been worked - collectDig() brings it out.
 *
 * The roll happens at the start on purpose. Rolling on collection would let a player reload a
 * save to re-roll a bad haul, and it would make the "what did I find?" moment depend on when
 * they happened to come back rather than on the dig itself.
 */
export function digAt(depthId, tool) {
  const depth = depthDef(depthId);
  if (!depth) return null;
  if (!isDepthUnlocked(depthId)) return null;
  const toolTable = depth.tools[tool];
  if (!toolTable) return null;
  if (state.mine.active) return null;   // one seam at a time

  const have = state.barn.items[tool] || 0;
  if (have < 1) return null;

  // Consume the tool up front, exactly once, only after every check above has passed —
  // nothing below this line can fail in a way that would need refunding it.
  state.barn.items[tool] = have - 1;

  const picked = weightedPick(toolTable.yields);
  let qty = picked ? randomQty(picked.qty) : 0;
  if (picked && goldRushActive()) qty *= 2;
  // Research (deep drilling) and the co-op's Deep Contacts add a share to every dig.
  if (picked && qty > 0) qty = Math.max(1, Math.round(qty * (1 + economy.bonus('mineYieldBonus'))));

  let artifact = null;
  if (depth.artifactChance > 0 && Array.isArray(depth.artifactPool) && depth.artifactPool.length
    && Math.random() < depth.artifactChance) {
    artifact = depth.artifactPool[Math.floor(Math.random() * depth.artifactPool.length)];
  }

  const now = Date.now();
  const seconds = depth.digTime;
  state.mine.active = {
    depthId, tool,
    item: picked ? picked.item : null,
    qty,
    artifact,
    startedAt: now,
    readyAt: now + seconds * 1000,
    ready: false,
  };
  return { depthId, tool, seconds, readyAt: state.mine.active.readyAt };
}

/**
 * Bring the haul up. Pays into the barn (or as coins for whatever will not fit) and hands any
 * artifact to the museum, which is where artifacts live - never the barn.
 */
export function collectDig(now = Date.now()) {
  const active = state.mine.active;
  if (!active) return null;
  if (now < active.readyAt) return false;

  let given = 0;
  let paidOut = 0;
  if (active.item && active.qty > 0) {
    ({ given, paidOut } = storage.addOrPay(active.item, active.qty));
  }
  if (active.artifact) {
    try { museum.addArtifact(active.artifact, 1); } catch { /* museum.js may still be a stub */ }
  }

  state.mine.digs += 1;
  economy.trackStat('mineDigs', 1);
  state.mine.active = null;
  return { depthId: active.depthId, tool: active.tool, item: active.item, qty: given, paidOut, artifact: active.artifact };
}

/** Every depth, with its unlock state and requirements (for the mine panel). */
export function depths() {
  return MINE.depths.map((d) => ({
    id: d.id,
    name: d.name,
    unlockLevel: d.unlockLevel,
    requires: d.requires,
    artifactChance: d.artifactChance,
    digTime: d.digTime,
    unlocked: isDepthUnlocked(d.id),
    levelMet: economy.isUnlocked(d.id),
    current: state.mine.currentDepth === d.id,
  }));
}

/** The depth the player is currently working. */
export function currentDepth() {
  return depthDef(state.mine.currentDepth) || depthDef(MINE.depths[0].id);
}

/** Open a new depth; consumes its coins and materials. */
export function unlockDepth(depthId) {
  const depth = depthDef(depthId);
  if (!depth) return false;
  if (isDepthUnlocked(depthId)) return false;
  if (!economy.isUnlocked(depthId)) return false;
  const req = depth.requires;
  if (!req) return false; // depth 0 (surface) has no requires and is unlocked from the start

  if (state.coins < req.coins) return false;
  for (const [mat, qty] of Object.entries(req.materials || {})) {
    if ((state.barn.items[mat] || 0) < qty) return false;
  }

  // Every check above passed, so the deduction below can never fail partway through.
  economy.addCoins(-req.coins);
  for (const [mat, qty] of Object.entries(req.materials || {})) {
    state.barn.items[mat] -= qty;
  }

  state.mine.depthUnlocked.push(depthId);
  state.mine.currentDepth = depthId;
  return true;
}

/** Tools the player currently owns (for the mine panel UI). */
export function availableTools() {
  return {
    pickaxe: state.barn.items.pickaxe || 0,
    dynamite: state.barn.items.dynamite || 0,
  };
}
