// foraging.js — free respawning world nodes (FORAGING, from L1).
//
// The most important short-gap filler in the game, and free is the entire point: every other
// activity has a price (the mine wants tools, the meadow wants energy, fishing has cooldowns),
// which left a player with two idle minutes nothing to do. Nodes cost nothing and are simply
// tapped.
//
// Respawns are absolute readyAt timestamps, and offlineRespawnCap bounds what accrues while
// away so a fortnight's absence does not carpet the farm in free goods.
// State: state.foraging { nodes: [{ id, type, x, y, readyAt }] }

import { state } from './state.js';
import { FORAGING, FARM, STRUCTURES } from './data.js';
import * as economy from './economy.js';
import * as farm from './farm.js';
import * as storage from './storage.js';
import * as collections from './collections.js';

let nextNodeId = 1;
function freshId() { return `forage_${nextNodeId++}_${Date.now().toString(36)}`; }

/** Weighted pick from a yield table shaped [{..., weight}]. Returns one entry or null. */
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

function barnRoom() { return storage.room('barn'); }

function nodeDef(type) {
  return FORAGING.nodes[type] || null;
}

function isNodeUnlocked(type) {
  const def = nodeDef(type);
  return !!def && state.level >= (def.unlockLevel ?? 1);
}

/** Nodes currently placed in the world, ready or not. */
export function nodes() {
  return state.foraging.nodes;
}

/** Nodes ready to collect right now. */
export function ready(now) {
  return state.foraging.nodes.filter((n) => n.readyAt <= now);
}

/** Collect one node: rolls its yield table, pays XP, and sets its next readyAt. */
export function collectNode(nodeId, now) {
  const node = state.foraging.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  if (node.readyAt > now) return null;
  const def = nodeDef(node.type);
  if (!def) return null;
  // A full barn leaves the node standing (it used to reset the node and pay the XP for nothing).
  if (barnRoom() <= 0) return null;

  const picked = weightedPick(def.yields);
  const result = { itemId: null, qty: 0, xp: 0, paidOut: 0 };
  if (picked) {
    const { given, paidOut } = storage.addOrPay(picked.item, randomQty(picked.qty));
    result.itemId = picked.item;
    result.qty = given;
    result.paidOut = paidOut;
    collections.record('forage_journal', picked.item);
  }

  economy.addXp(FORAGING.xpPerPickup);
  economy.trackStat('foraged', 1);   // one find, the counter every forage task/achievement reads
  result.xp = FORAGING.xpPerPickup;

  node.readyAt = now + def.respawn * 1000;
  return result;
}

/** Tiles covered by fixed world structures (STRUCTURES never appear in state.farm.objects). */
function structureTileAt(x, y) {
  for (const struct of Object.values(STRUCTURES)) {
    const [w, h] = struct.size;
    if (x >= struct.pos.x && x < struct.pos.x + w && y >= struct.pos.y && y < struct.pos.y + h) return true;
  }
  return false;
}

/** Find an open, unoccupied tile inside unlocked land for a fresh 1x1 node. */
function findFreeTile() {
  const zones = [FARM.startZone, ...FARM.expansions.filter((e) => state.farm.unlockedZones.includes(e.id)).map((e) => e.rect)];
  const occupied = new Set(state.foraging.nodes.map((n) => `${n.x},${n.y}`));
  // Bounded random search rather than an exhaustive scan — the farm can be large and this
  // only needs to find ONE free tile, not enumerate them all.
  for (let attempt = 0; attempt < 200; attempt++) {
    const zone = zones[Math.floor(Math.random() * zones.length)];
    if (!zone) continue;
    const x = zone.x + Math.floor(Math.random() * zone.w);
    const y = zone.y + Math.floor(Math.random() * zone.h);
    if (occupied.has(`${x},${y}`)) continue;
    if (farm.objectAt(x, y)) continue;
    if (structureTileAt(x, y)) continue;
    return { x, y };
  }
  return null;
}

/** Place and respawn nodes, honouring maxActive, globalMaxActive and offlineRespawnCap. */
export function tick(now) {
  const spawned = [];
  const countByType = {};
  for (const n of state.foraging.nodes) countByType[n.type] = (countByType[n.type] || 0) + 1;

  for (const [type, def] of Object.entries(FORAGING.nodes)) {
    if (spawned.length >= FORAGING.offlineRespawnCap) break;
    if (!isNodeUnlocked(type)) continue;
    if (state.foraging.nodes.length >= FORAGING.globalMaxActive) break;
    const have = countByType[type] || 0;
    if (have >= def.maxActive) continue;

    const tile = findFreeTile();
    if (!tile) continue;

    const node = { id: freshId(), type, x: tile.x, y: tile.y, readyAt: now };
    state.foraging.nodes.push(node);
    countByType[type] = have + 1;
    spawned.push(node);
  }
  return spawned;
}
