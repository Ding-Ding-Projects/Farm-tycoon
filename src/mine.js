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

/** Dig at a specific unlocked depth; consumes the tool, rolls that depth's yield table. */
export function digAt(depthId, tool) {
  const depth = depthDef(depthId);
  if (!depth) return null;
  if (!isDepthUnlocked(depthId)) return null;
  const toolTable = depth.tools[tool];
  if (!toolTable) return null;

  const have = state.barn.items[tool] || 0;
  if (have < 1) return null;

  // Consume the tool up front, exactly once, only after every check above has passed —
  // nothing below this line can fail in a way that would need refunding it. The tool's own
  // barn slot is freed by that, so the ore always has at least one slot to land in; whatever
  // exceeds the barn is paid out as coins (storage.addOrPay) rather than lost, as it used to be.
  state.barn.items[tool] = have - 1;

  const picked = weightedPick(toolTable.yields);
  let qty = picked ? randomQty(picked.qty) : 0;
  if (picked && goldRushActive()) qty *= 2;
  // Research (deep drilling) and the co-op's Deep Contacts add a share to every dig.
  if (picked && qty > 0) qty = Math.max(1, Math.round(qty * (1 + economy.bonus('mineYieldBonus'))));

  let given = 0;
  let paidOut = 0;
  if (picked && qty > 0) {
    ({ given, paidOut } = storage.addOrPay(picked.item, qty));
  }

  let artifact = null;
  if (depth.artifactChance > 0 && Array.isArray(depth.artifactPool) && depth.artifactPool.length
    && Math.random() < depth.artifactChance) {
    const artifactId = depth.artifactPool[Math.floor(Math.random() * depth.artifactPool.length)];
    try { museum.addArtifact(artifactId, 1); } catch { /* museum.js may still be a stub */ }
    artifact = artifactId;
  }

  state.mine.digs += 1;
  economy.trackStat('mineDigs', 1);

  return { depthId, tool, item: picked ? picked.item : null, qty: given, paidOut, artifact };
}

/** Every depth, with its unlock state and requirements (for the mine panel). */
export function depths() {
  return MINE.depths.map((d) => ({
    id: d.id,
    name: d.name,
    unlockLevel: d.unlockLevel,
    requires: d.requires,
    artifactChance: d.artifactChance,
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
