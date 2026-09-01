// museum.js — the Museum (L60) and the artifacts it displays.
//
// Artifacts live HERE, in state.museum, and never in the barn. Two reasons, both load-bearing:
// a full barn would otherwise soft-lock expedition collection, and every generator that draws
// from "things the player owns" (orders, trucks, boats, the regatta) must be unable to ask for
// a museum piece.
// State: state.museum { artifacts: { artifactId: qty }, exhibitsCompleted: [], claimedRewards: [] }

import { state } from './state.js';
import { MUSEUM, ARTIFACTS } from './data.js';
import * as economy from './economy.js';
import * as collections from './collections.js';
import * as decorate from './decorate.js';

/** Add found artifacts. Duplicates are kept and can be sold per MUSEUM.duplicatePolicy. */
export function addArtifact(id, qty = 1) {
  if (!ARTIFACTS[id] || !(qty > 0)) return false;
  state.museum.artifacts[id] = (state.museum.artifacts[id] || 0) + qty;
  economy.trackStat('artifactsFound', qty);
  collections.record('relic_catalogue', id);   // the Relic Catalogue fills from real finds
  return true;
}

/** Found / total for one exhibit. */
export function exhibitProgress(exhibitId) {
  const exhibit = MUSEUM.exhibits[exhibitId];
  if (!exhibit) return { found: 0, total: 0 };
  const found = exhibit.artifacts.filter((id) => (state.museum.artifacts[id] || 0) > 0).length;
  return { found, total: exhibit.artifacts.length };
}

/** Exhibits with every artifact found. */
export function completedExhibits() {
  return Object.keys(MUSEUM.exhibits).filter((id) => {
    const progress = exhibitProgress(id);
    return progress.total > 0 && progress.found === progress.total;
  });
}

/** Claim a completed exhibit's reward. */
export function claimExhibit(exhibitId) {
  const exhibit = MUSEUM.exhibits[exhibitId];
  if (!exhibit) return false;
  if (state.museum.claimedRewards.includes(exhibitId)) return false;
  const progress = exhibitProgress(exhibitId);
  if (progress.found < progress.total) return false;

  const rewards = exhibit.rewards || {};
  if (rewards.coins) economy.addCoins(rewards.coins);
  if (rewards.diamonds) state.diamonds += rewards.diamonds;
  // A decoration reward is granted as an OWNED decoration (placed for free from the Workshop's
  // decorations list); the comment that used to sit here said "recorded so decorate.js can grant
  // it", and nothing ever did.
  if (rewards.decoration) decorate.grant(rewards.decoration);

  state.museum.claimedRewards.push(exhibitId);
  if (!state.museum.exhibitsCompleted.includes(exhibitId)) {
    state.museum.exhibitsCompleted.push(exhibitId);
  }
  economy.trackStat('exhibitsCompleted', 1);
  return true;
}

/** Sell duplicates of an artifact for coins. Never sells the last copy. */
export function sellDuplicate(id, qty = 1) {
  const owned = state.museum.artifacts[id] || 0;
  if (!(qty > 0) || owned <= 1) return false;
  const sellable = Math.min(qty, owned - 1);
  if (sellable <= 0) return false;
  const price = ARTIFACTS[id]?.sellPrice || 0;
  economy.addCoins(price * sellable);
  state.museum.artifacts[id] = owned - sellable;
  return sellable;
}

/** Visitor income bonus from completed exhibits, added to the zoo's hourly rate. */
export function visitorBonusPerHour() {
  return completedExhibits().reduce((sum, id) => sum + (MUSEUM.exhibits[id].visitorBonusPerHour || 0), 0);
}
