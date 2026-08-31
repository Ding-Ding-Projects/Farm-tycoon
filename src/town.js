// town.js — the Town (Township layer, L20): a district on the world grid where houses
// grant population and community buildings raise the population cap (TOWN in data.js).
// Milestones pay rewards and unlock higher building tiers. Construction consumes coins +
// MATERIALS from the barn (refund on cancel; materials never go negative).
// Town state: state.town { buildings: [...], population, capacity, claimedMilestones }.

/** Current population and capacity {population, capacity}. */
export function populationInfo() { /* Phase B */ }

/** Highest unlocked house/community tier (from claimed milestones). */
export function unlockedTier() { /* Phase B */ }

/** Can the player afford + fit this house/community building (coins, materials, cap, tier)? */
export function canBuild(kind, typeId) { /* Phase B */ }

/** Build a house or community building at (x,y) in the town district; consumes costs. */
export function build(kind, typeId, x, y) { /* Phase B */ }

/** Milestones reached but not yet claimed (for the town panel + dock badge). */
export function claimableMilestones() { /* Phase B */ }

/** Claim a reached population milestone: pays rewards, unlocks its tier. Idempotent. */
export function claimMilestone(index) { /* Phase B */ }
