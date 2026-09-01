// lab.js — the Laboratory (L54): permanent research, not Township's timed boosters.
//
// researchedEffect() is the SINGLE merge point for every permanent multiplier in the game.
// economy.js, production.js, minigames, mastery and co-op perks all read their multipliers
// through it, merged with minigame results and co-op perks, so three systems that grant
// bonuses cannot drift into three different opinions about what a bonus means.
// State: state.lab { built, researched: [nodeId], active: { id, readyAt } | null }

import { state } from './state.js';
import { LAB, EFFECT_KEYS } from './data.js';
import * as economy from './economy.js';
import * as storage from './storage.js';

/**
 * Neutral value for an effect key: 1 for every *Mult key (a no-op multiplier), 0 for
 * everything else (a no-op bonus/flat add). researchedEffect() always returns every key in
 * EFFECT_KEYS at its neutral value when nothing researched touches it, so callers never have
 * to branch on a missing key.
 */
function neutralValue(key) {
  return key.endsWith('Mult') ? 1 : 0;
}

function neutralEffect() {
  const out = {};
  for (const key of EFFECT_KEYS) out[key] = neutralValue(key);
  return out;
}

function hasItems(items) {
  if (!items) return true;
  for (const [id, qty] of Object.entries(items)) {
    const have = (state.silo.items[id] || 0) + (state.barn.items[id] || 0);
    if (have < qty) return false;
  }
  return true;
}

function consumeItems(items) {
  if (!items) return;
  for (const [id, qty] of Object.entries(items)) {
    let remaining = qty;
    const fromSilo = Math.min(remaining, state.silo.items[id] || 0);
    if (fromSilo > 0) { state.silo.items[id] -= fromSilo; remaining -= fromSilo; }
    const fromBarn = Math.min(remaining, state.barn.items[id] || 0);
    if (fromBarn > 0) { state.barn.items[id] -= fromBarn; remaining -= fromBarn; }
  }
}

function refundItems(items) {
  if (!items) return;
  // Back to the store each id actually lives in (crops to the silo - a crop refunded into the
  // barn can neither be planted nor spent), capped there, with any shortfall paid out as coins.
  for (const [id, qty] of Object.entries(items)) storage.addOrPay(id, qty);
}

function hasMaterials(materials) {
  if (!materials) return true;
  for (const [id, qty] of Object.entries(materials)) {
    if ((state.barn.items[id] || 0) < qty) return false;
  }
  return true;
}

function consumeMaterials(materials) {
  if (!materials) return;
  for (const [id, qty] of Object.entries(materials)) {
    state.barn.items[id] = (state.barn.items[id] || 0) - qty;
  }
}

function refundMaterials(materials) {
  if (!materials) return;
  for (const [id, qty] of Object.entries(materials)) storage.addOrPay(id, qty);
}

/** Build the laboratory; consumes LAB.buildCost. */
export function build() {
  if (state.lab.built) return false;
  if (state.level < LAB.unlockLevel) return false;
  const cost = LAB.buildCost;
  if (state.coins < (cost.coins || 0)) return false;
  if (!hasMaterials(cost.materials)) return false;
  economy.addCoins(-(cost.coins || 0));
  consumeMaterials(cost.materials);
  state.lab.built = true;
  return true;
}

/** Nodes whose prerequisites are met and which are not yet researched. */
export function availableNodes() {
  const out = [];
  for (const [id, node] of Object.entries(LAB.tree)) {
    if (state.lab.researched.includes(id)) continue;
    const requires = node.requires || [];
    if (requires.every((r) => state.lab.researched.includes(r))) out.push(id);
  }
  return out;
}

/** Whether this node's prerequisites, coins, items and materials are all satisfied. */
export function canResearch(id) {
  if (!state.lab.built) return false;
  if (state.lab.active) return false; // only LAB.slots (1) may run at once
  const node = LAB.tree[id];
  if (!node) return false;
  if (state.lab.researched.includes(id)) return false;
  const requires = node.requires || [];
  if (!requires.every((r) => state.lab.researched.includes(r))) return false;
  const cost = node.cost || {};
  if (state.coins < (cost.coins || 0)) return false;
  if (!hasItems(cost.items)) return false;
  if (!hasMaterials(cost.materials)) return false;
  return true;
}

/** Start researching; consumes cost. Only LAB.slots may run at once. */
export function startResearch(id) {
  if (!canResearch(id)) return false;
  const node = LAB.tree[id];
  const cost = node.cost || {};
  economy.addCoins(-(cost.coins || 0));
  consumeItems(cost.items);
  consumeMaterials(cost.materials);
  state.lab.active = { id, readyAt: Date.now() + node.time * 1000 };
  return true;
}

/** Cancel active research. Refunds in full - a cancelled project must not cost anything. */
export function cancelResearch() {
  if (!state.lab.active) return false;
  const node = LAB.tree[state.lab.active.id];
  const cost = node.cost || {};
  economy.addCoins(cost.coins || 0);
  refundItems(cost.items);
  refundMaterials(cost.materials);
  state.lab.active = null;
  return true;
}

/**
 * The merged effect of everything researched, as { effectKey: value }. Keys come from
 * EFFECT_KEYS. Returns a complete object with neutral values rather than a sparse one, so
 * callers never branch on a missing key.
 *
 * Composition rule: *Mult keys MULTIPLY together (each node's value is relative to 1, so
 * research compounds — the later, cheaper multipliers on a tier still shrink an already-
 * shrunk time rather than resetting it), every other key ADDS (a flat bonus stacks linearly,
 * which matches how siloCapBonus/barnCapBonus/mineYieldBonus read in data.js).
 */
export function researchedEffect() {
  const out = neutralEffect();
  for (const id of state.lab.researched) {
    const node = LAB.tree[id];
    if (!node || !node.effect) continue;
    for (const [key, value] of Object.entries(node.effect)) {
      if (!EFFECT_KEYS.includes(key)) continue;
      if (key.endsWith('Mult')) out[key] *= value;
      else out[key] += value;
    }
  }
  return out;
}

/** Complete finished research; called from the game loop. */
export function tick(now) {
  const active = state.lab.active;
  if (!active) return;
  if (now < active.readyAt) return;
  state.lab.researched.push(active.id);
  state.lab.active = null;
  economy.trackStat('researchCompleted', 1);
}

// Wire into economy's single merge point so any caller already doing
// combinedMultiplier(kind, id) picks up research automatically without a hard import cycle.
// kind is treated as an EFFECT_KEYS name; id is unused (research is global, not per-item).
economy.registerMultiplierEffect((kind) => {
  if (!state?.lab || !EFFECT_KEYS.includes(kind) || !kind.endsWith('Mult')) return 1;
  return researchedEffect()[kind];
});
// ...and the additive keys (siloCapBonus, barnCapBonus, mineYieldBonus, fishRareChance) through
// the additive merge point, which storage.js, mine.js and fishing.js read.
economy.registerBonusEffect((key) => {
  if (!state?.lab || !EFFECT_KEYS.includes(key) || key.endsWith('Mult')) return 0;
  return researchedEffect()[key] || 0;
});
