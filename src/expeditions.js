// expeditions.js — expeditions (L57). Hire specialists, send a crew to a site, wait out a real
// trip, collect loot.
//
// Supplies are consumed UP FRONT, so a failed run genuinely costs something - otherwise
// riskFailChance is decoration and there is no decision in choosing a site.
//
// Artifacts in the loot go to museum.js, never to the barn: a full barn must not be able to
// soft-lock collection, and the order and truck generators must never be able to ask the player
// to hand over a museum piece.
// State: state.expeditions { crew: [{ specialistId, hiredAt }], active: [{ siteId, readyAt, crewIdx }],
//                            lastResults: [] }

import { state } from './state.js';
import { EXPEDITIONS } from './data.js';
import * as economy from './economy.js';
import * as museum from './museum.js';
import * as storage from './storage.js';

function hasItems(items) {
  if (!items) return true;
  for (const [id, qty] of Object.entries(items)) {
    if ((state.barn.items[id] || 0) < qty) return false;
  }
  return true;
}

function consumeItems(items) {
  if (!items) return;
  for (const [id, qty] of Object.entries(items)) {
    state.barn.items[id] = (state.barn.items[id] || 0) - qty;
  }
}

function refundItems(items) {
  if (!items) return;
  for (const [id, qty] of Object.entries(items)) {
    state.barn.items[id] = (state.barn.items[id] || 0) + qty;
  }
}

function crewBonus(crewIdx, key) {
  const member = state.expeditions.crew[crewIdx];
  const specialist = member && EXPEDITIONS.specialists[member.specialistId];
  return specialist?.bonus?.[key] ?? 0;
}

function randInt([lo, hi]) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function pickWeighted(pool) {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return pool[pool.length - 1];
}

/** Sites unlocked at the player's level. */
export function sites() {
  return Object.entries(EXPEDITIONS.sites)
    .filter(([, site]) => state.level >= site.unlockLevel)
    .map(([id]) => id);
}

/** Hire a specialist into a crew slot. */
export function hireSpecialist(id) {
  const specialist = EXPEDITIONS.specialists[id];
  if (!specialist) return false;
  if (state.coins < specialist.cost) return false;
  economy.addCoins(-specialist.cost);
  state.expeditions.crew.push({ specialistId: id, hiredAt: Date.now() });
  return state.expeditions.crew.length - 1;
}

function activeCrewIdxs() {
  return new Set(state.expeditions.active.map((a) => a.crewIdx));
}

/** Whether supplies and a free crew slot are both available for this site. */
export function canLaunch(siteId) {
  const site = EXPEDITIONS.sites[siteId];
  if (!site) return false;
  if (state.level < site.unlockLevel) return false;
  if (state.expeditions.active.length >= EXPEDITIONS.crewSlots) return false;
  if (!hasItems(site.supplies)) return false;
  const busy = activeCrewIdxs();
  return state.expeditions.crew.some((_, idx) => !busy.has(idx));
}

/** Launch; consumes supplies. Refunds in full if the launch itself fails. */
export function launch(siteId, crewIdx) {
  const site = EXPEDITIONS.sites[siteId];
  if (!site) return false;
  if (state.level < site.unlockLevel) return false;
  if (state.expeditions.active.length >= EXPEDITIONS.crewSlots) return false;
  if (!state.expeditions.crew[crewIdx]) return false;
  if (activeCrewIdxs().has(crewIdx)) return false;
  if (!hasItems(site.supplies)) return false;

  consumeItems(site.supplies);
  const specialist = EXPEDITIONS.specialists[state.expeditions.crew[crewIdx].specialistId];
  const durationMult = specialist?.bonus?.speedMult ?? 1;
  const duration = site.duration * durationMult;
  state.expeditions.active.push({ siteId, readyAt: Date.now() + duration * 1000, crewIdx });
  return true;
}

/** Collect a returned expedition. Routes artifacts to museum.js and goods to the barn. */
export function collect(crewIdx) {
  const idx = state.expeditions.active.findIndex((a) => a.crewIdx === crewIdx);
  if (idx === -1) return null;
  const trip = state.expeditions.active[idx];
  if (Date.now() < trip.readyAt) return null;

  const site = EXPEDITIONS.sites[trip.siteId];
  state.expeditions.active.splice(idx, 1);

  const riskReduction = crewBonus(crewIdx, 'riskReduction');
  const failChance = Math.max(0, site.riskFailChance - riskReduction);
  const failed = Math.random() < failChance;

  const result = { siteId: trip.siteId, crewIdx, failed, loot: [] };

  if (!failed) {
    const artifactBonus = crewBonus(crewIdx, 'artifactChance');
    const lootBonus = crewBonus(crewIdx, 'lootBonus');
    const rolled = pickWeighted(site.loot);
    let entry = null;
    if (rolled.artifact) {
      // Reroll the artifact independently against the site's own artifactChance (+specialist
      // bonus), so a digger genuinely raises the odds rather than only picking a table row.
      if (Math.random() < site.artifactChance + artifactBonus) entry = rolled;
    } else {
      entry = rolled;
    }
    if (entry) {
      if (entry.artifact) {
        museum.addArtifact(entry.artifact, 1);
        result.loot.push({ artifact: entry.artifact, qty: 1 });
      } else if (entry.item) {
        // Never past the barn cap: what fits is stored, the rest is paid out as coins.
        const qty = Math.round(randInt(entry.qty) * (1 + lootBonus));
        const { given, paidOut } = storage.addOrPay(entry.item, qty);
        result.loot.push({ item: entry.item, qty: given, paidOut });
      } else if (entry.material) {
        const qty = Math.round(randInt(entry.qty) * (1 + lootBonus));
        const { given, paidOut } = storage.addOrPay(entry.material, qty);
        result.loot.push({ material: entry.material, qty: given, paidOut });
      } else if (entry.coins) {
        const coins = Math.round(randInt(entry.coins) * (1 + lootBonus));
        economy.addCoins(coins);
        result.loot.push({ coins });
      }
    }
    economy.trackStat('expeditionsCompleted', 1);
  }

  state.expeditions.lastResults.push(result);
  return result;
}

/** Results not yet acknowledged by the UI. */
export function pendingResults() {
  return state.expeditions.lastResults;
}

/** Advance trip timers; called from the game loop. Timers are absolute readyAt timestamps, so
 *  there is nothing to accumulate here - collect() reads readiness directly - but the hook is
 *  kept for symmetry with every other system's tick(now) contract. */
export function tick(now = Date.now()) { /* readiness is computed on demand from readyAt in collect() */ }
