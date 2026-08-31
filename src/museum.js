// museum.js — the Museum (L60) and the artifacts it displays.
//
// Artifacts live HERE, in state.museum, and never in the barn. Two reasons, both load-bearing:
// a full barn would otherwise soft-lock expedition collection, and every generator that draws
// from "things the player owns" (orders, trucks, boats, the regatta) must be unable to ask for
// a museum piece.
// State: state.museum { artifacts: { artifactId: qty }, exhibitsCompleted: [], claimedRewards: [] }

/** Add found artifacts. Duplicates are kept and can be sold per MUSEUM.duplicatePolicy. */
export function addArtifact(id, qty) { /* Phase B */ }

/** Found / total for one exhibit. */
export function exhibitProgress(exhibitId) { /* Phase B */ }

/** Exhibits with every artifact found. */
export function completedExhibits() { /* Phase B */ }

/** Claim a completed exhibit's reward. */
export function claimExhibit(exhibitId) { /* Phase B */ }

/** Sell duplicates of an artifact for coins. Never sells the last copy. */
export function sellDuplicate(id, qty) { /* Phase B */ }

/** Visitor income bonus from completed exhibits, added to the zoo's hourly rate. */
export function visitorBonusPerHour() { /* Phase B */ }
