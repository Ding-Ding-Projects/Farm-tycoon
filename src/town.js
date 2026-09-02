// town.js — the Town (Township layer, L20): a district on the world grid where houses
// grant population and community buildings raise the population cap (TOWN in data.js).
// Milestones pay rewards and unlock higher building tiers. Construction consumes coins +
// MATERIALS from the barn (refund on cancel; materials never go negative).
// Town state: state.town { buildings: [...], population, capacity, claimedMilestones }.

import { state } from './state.js';
import { TOWN } from './data.js';
import * as economy from './economy.js';
import * as storage from './storage.js';

// See trains.js for why this lazy-seed pattern exists: state.js does not yet carry a `town`
// key, and touching state.js is out of this lane's ownership.
function ensureState() {
  if (!state.town) {
    state.town = { buildings: [], population: 0, capacity: TOWN.basePopulationCap, claimedMilestones: [] };
  }
  return state.town;
}

function defFor(kind, typeId) {
  const table = kind === 'house' ? TOWN.houses : kind === 'community' ? TOWN.communityBuildings : null;
  return table ? table[typeId] || null : null;
}

function barnHas(materials) {
  return Object.entries(materials || {}).every(([id, qty]) => (state.barn.items[id] || 0) >= qty);
}

function barnSpend(materials) {
  for (const [id, qty] of Object.entries(materials || {})) {
    state.barn.items[id] = Math.max(0, (state.barn.items[id] || 0) - qty);
  }
}

function barnRefund(materials) {
  // Capped at the barn, with any shortfall paid out as coins rather than piled past the cap.
  for (const [id, qty] of Object.entries(materials || {})) storage.addOrPay(id, qty);
}

/** Highest unlocked house/community tier (from claimed milestones). */
export function unlockedTier() {
  ensureState();
  const t = state.town;
  let tier = 1;
  for (const idx of t.claimedMilestones) {
    const m = TOWN.milestones[idx];
    if (m && m.unlocksTier > tier) tier = m.unlocksTier;
  }
  return tier;
}

/** Current population and capacity {population, capacity}. */
export function populationInfo() {
  const t = ensureState();
  return { population: t.population, capacity: t.capacity };
}

/** Can the player afford + fit this house/community building (coins, materials, cap, tier)? */
export function canBuild(kind, typeId) {
  ensureState();
  const def = defFor(kind, typeId);
  if (!def) return false;
  if (def.tier > unlockedTier()) return false;
  if (state.level < TOWN.unlockLevel) return false;
  if (kind === 'house' && state.town.population + def.population > state.town.capacity) return false;
  if (state.coins < def.cost) return false;
  if (!barnHas(def.materials)) return false;
  return true;
}

/** Build a house or community building at (x,y) in the town district; consumes costs. */
export function build(kind, typeId, x, y) {
  ensureState();
  if (!canBuild(kind, typeId)) return false;
  const def = defFor(kind, typeId);

  // Check everything, then commit — never deduct and then discover a shortfall.
  economy.addCoins(-def.cost);
  barnSpend(def.materials);

  const record = {
    id: `town_${kind}_${typeId}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`,
    kind,
    typeId,
    x,
    y,
    size: def.size,
  };
  state.town.buildings.push(record);

  if (kind === 'house') {
    state.town.population += def.population;
  } else if (kind === 'community') {
    state.town.capacity += def.capacity;
  }
  return record;
}

/** Milestones reached but not yet claimed (for the town panel + dock badge). */
export function claimableMilestones() {
  const t = ensureState();
  const out = [];
  TOWN.milestones.forEach((m, index) => {
    if (t.population >= m.population && !t.claimedMilestones.includes(index)) out.push(index);
  });
  return out;
}

/** Claim a reached population milestone: pays rewards, unlocks its tier. Idempotent. */
export function claimMilestone(index) {
  const t = ensureState();
  const m = TOWN.milestones[index];
  if (!m) return false;
  if (t.claimedMilestones.includes(index)) return true; // already claimed — idempotent no-op
  if (t.population < m.population) return false;

  t.claimedMilestones.push(index);
  const rewards = m.rewards || {};
  if (rewards.coins) economy.addCoins(rewards.coins);
  if (rewards.diamonds) state.diamonds += rewards.diamonds;
  if (rewards.materials) barnRefund(rewards.materials); // materials are a reward, not a cost — same add path
  return true;
}
