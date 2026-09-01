// quality.js — turning a chain of stage scores into one quality, and one quality into a tier.
//
// Pure and DOM-free on purpose: this is the arithmetic the gate depends on, so it has to be
// drivable headlessly by tools/test-playables.mjs without a browser anywhere near it.

import { QUALITY, qualityTier } from '../data.js';

/**
 * Aggregate a chain's per-stage scores into one 0..1 quality.
 *
 * Two terms, and the second is the one that matters:
 *
 *   q_raw   = Σ(wᵢ·sᵢ) / Σwᵢ            weighted mean — a heavy stage (the bake) counts for more
 *   quality = min(q_raw, worst + cap)    worst-stage cap
 *
 * The cap is what stops a burnt cake being rescued by nice piping, and — more importantly —
 * stops quality being farmed by deliberately sandbagging the one hard stage in a chain and
 * acing the four easy ones. Without it the weighted mean alone rewards exactly that.
 *
 * An empty or absent score list is 0, not NaN: callers use this to decide what a player earns,
 * and NaN would silently become the floor tier through qualityTier()'s own guard anyway — being
 * explicit here means the value is inspectable rather than merely surviving.
 */
export function aggregate(scores, stages = []) {
  if (!Array.isArray(scores) || scores.length === 0) return 0;

  let weighted = 0;
  let totalWeight = 0;
  let worst = Infinity;

  for (let i = 0; i < scores.length; i++) {
    const raw = scores[i];
    const s = typeof raw === 'number' && !Number.isNaN(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    const w = Math.max(0, Number(stages[i] && stages[i].weight) || 1);
    weighted += s * w;
    totalWeight += w;
    if (s < worst) worst = s;
  }

  if (totalWeight === 0) return 0;
  const mean = weighted / totalWeight;
  return Math.max(0, Math.min(1, Math.min(mean, worst + QUALITY.worstStageCap)));
}

/** The index into QUALITY.tiers that a 0..1 quality earns. */
export function tierIndexFor(quality) {
  const tier = qualityTier(quality);
  return QUALITY.tiers.indexOf(tier);
}

/** Which stage of a chain scored worst, for the result screen's "Weakest step" line. */
export function weakestStage(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return -1;
  let idx = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] < scores[idx]) idx = i;
  return idx;
}
