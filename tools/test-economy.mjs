// test-economy.mjs — the money has to run downhill.
//
// This exists because of one specific unproven claim. An early audit found a Building Workshop
// arbitrage - "craft components at a loss, sell the kit for about 9,800" - and a later pass checked
// only SINGLE hops: is each recipe's output worth more than the resale price of the things fed
// straight into it. That check passed and the finding was recorded as "very likely closed, not
// proven eliminated", because the full raw-material -> component -> kit chain was never re-run
// end to end.
//
// A single-hop check cannot see this class of exploit at all. Every individual step can look
// profitable while the chain as a whole prints money, and it can equally look unprofitable at one
// step and still be worth running because the step after it pays for both. The only honest way to
// ask the question is to expand a recipe all the way down to things the player can actually
// obtain, and compare THAT to what the output sells for.
//
// Two prices are checked, because there are two ways to get an input:
//
//   at base       everything the recipe consumes, valued at its own sellPrice. This is the floor:
//                 if a kit is worth more than this, the loop pays even for a player who grew or
//                 mined every ingredient, and the game has a printer in it.
//
//   at market     the same basket at MARKET.priceMultiplier, currently 1.4x, which is what the
//                 player actually pays to BUY an input rather than make it. A chain that is
//                 underwater at base but profitable at market would be a bad deal nobody takes;
//                 the reverse - profitable at base, and therefore also worth buying into - is the
//                 dangerous direction, so base is the one that fails the build.
//
// Cycles are impossible by construction (the validator refuses recipe input cycles) but the walk
// carries a seen-set anyway, because a stack overflow inside an economy check would read as a
// broken test rather than as the cycle it actually is.

import assert from 'node:assert/strict';
import * as d from '../src/data.js';

let passed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  - ${name}`); }
  catch (err) {
    failures.push({ name, err });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Expansion
// ---------------------------------------------------------------------------

/** Every recipe that can produce this id, across every building. */
const producers = new Map();
for (const [bid, b] of Object.entries(d.BUILDINGS)) {
  for (const r of b.recipes || []) {
    if (!producers.has(r.id)) producers.set(r.id, []);
    producers.get(r.id).push({ bid, recipe: r });
  }
}

/** What one unit of an id is worth if sold. Crops sell from the silo, goods and materials from the barn. */
function unitPrice(id) {
  if (d.GOODS[id]) return d.GOODS[id].sellPrice || 0;
  if (d.MATERIALS[id]) return d.MATERIALS[id].sellPrice || 0;
  if (d.CROPS[id]) return d.CROPS[id].sellPrice || 0;
  return 0;
}

/** True when nothing in the game crafts this, so the player grows, mines, forages or is given it. */
const isLeaf = (id) => !producers.has(id);

/**
 * Expand `id` into the multiset of LEAF inputs one unit of it costs, following the cheapest
 * producing recipe at each step. Cheapest, not first: a chain is only an exploit if SOME route
 * through it pays, so taking the dearest route would let a real exploit hide behind an expensive
 * sibling recipe.
 */
function leafCost(id, seen = new Set()) {
  if (isLeaf(id) || seen.has(id)) return { coins: unitPrice(id), leaves: { [id]: 1 } };
  const next = new Set(seen).add(id);
  let best = null;
  for (const { recipe } of producers.get(id)) {
    let coins = 0;
    const leaves = {};
    for (const [ing, qty] of Object.entries(recipe.inputs || {})) {
      const sub = leafCost(ing, next);
      coins += sub.coins * qty;
      for (const [k, v] of Object.entries(sub.leaves)) leaves[k] = (leaves[k] || 0) + v * qty;
    }
    if (!best || coins < best.coins) best = { coins, leaves };
  }
  return best || { coins: unitPrice(id), leaves: { [id]: 1 } };
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

const MARKET_MULT = d.MARKET.priceMultiplier;
const kitIds = Object.values(d.BUILDINGS)
  .map((b) => b.kit)
  .filter(Boolean);

console.log(`\nExpanding ${kitIds.length} build kits to their raw inputs...\n`);

test('every build kit costs more to make than it sells for, valued at base', () => {
  const printers = [];
  for (const kit of kitIds) {
    const { coins } = leafCost(kit);
    const sells = unitPrice(kit);
    if (sells > coins) printers.push(`${kit}: raw inputs ${Math.round(coins)}, sells for ${sells} (+${Math.round(sells - coins)})`);
  }
  assert.equal(printers.length, 0,
    'a kit worth more than everything it consumes is a coin printer - craft it, sell it, repeat:\n        '
    + printers.join('\n        '));
});

test('no kit is profitable even when every raw input is BOUGHT at the market multiplier', () => {
  const printers = [];
  for (const kit of kitIds) {
    const { coins } = leafCost(kit);
    const sells = unitPrice(kit);
    if (sells > coins * MARKET_MULT) printers.push(`${kit}: bought-in ${Math.round(coins * MARKET_MULT)}, sells ${sells}`);
  }
  assert.equal(printers.length, 0,
    `at ${MARKET_MULT}x these kits still pay for themselves:\n        ` + printers.join('\n        '));
});

// A first version of this checked that no chain multiplied its raw inputs more than eightfold,
// and it failed on eleven perfectly correct recipes - fresh_pasta turns 18 coins of wheat and egg
// into 560, a 31x markup. That is not an exploit, it is the entire farming loop: crops are cheap
// on purpose and processed goods are valuable on purpose, and the thing being spent is TIME.
// A guard that fires on the game working as designed is worse than no guard, so the threshold was
// deleted rather than tuned upward until it went quiet.
//
// What is actually invariant is the direction: crafting must never DESTROY coins. A recipe whose
// output sells for less than the things it consumed is a trap, because the player cannot see the
// arithmetic and the game gave them no reason to expect it.
test('no recipe destroys value - crafting is never worse than selling the ingredients', () => {
  const traps = [];
  for (const b of Object.values(d.BUILDINGS)) {
    for (const r of b.recipes || []) {
      if (r.sink) continue;                     // feed and kits are sinks; losing money is the point
      const sells = unitPrice(r.id);
      let direct = 0;
      for (const [ing, qty] of Object.entries(r.inputs || {})) direct += unitPrice(ing) * qty;
      const raw = leafCost(r.id).coins;
      if (sells < direct) traps.push(`${r.id}: its own inputs sell for ${direct}, it sells for ${sells}`);
      else if (sells < raw) traps.push(`${r.id}: raw materials worth ${Math.round(raw)}, it sells for ${sells}`);
    }
  }
  assert.equal(traps.length, 0,
    'these cost the player money to make:\n        ' + traps.join('\n        '));
});

// Reported, never asserted. How much a recipe earns per second of queue time is a BALANCE
// question, and the right answer is a design decision rather than an invariant - so this prints
// the spread and the worst offenders and leaves the judgement to a person. It is here because a
// number nobody prints is a number that drifts: measured when this was written, the best recipe
// earned about twelve times the median per second, and the bottom of the table earned so little
// that selling the ingredients would have been better use of the hour.
{
  const rows = [];
  for (const b of Object.values(d.BUILDINGS)) {
    for (const r of b.recipes || []) {
      if (r.sink || !(r.time > 0)) continue;
      rows.push({ id: r.id, cps: (unitPrice(r.id) - leafCost(r.id).coins) / r.time, time: r.time });
    }
  }
  rows.sort((a, b) => a.cps - b.cps);
  const at = (q) => rows[Math.floor(q * (rows.length - 1))].cps;
  const worst = rows.slice(0, 4).map((r) => `${r.id} ${r.cps.toFixed(3)}`).join(', ');
  console.log(
    `\n  coins per second of queue time, net of raw inputs: median ${at(0.5).toFixed(3)}, `
    + `p90 ${at(0.9).toFixed(3)}, best ${rows[rows.length - 1].cps.toFixed(3)} `
    + `(${(rows[rows.length - 1].cps / at(0.5)).toFixed(1)}x the median)`
  );
  console.log(`  thinnest margins per second: ${worst}`);
}

test('the original finding is re-run by name: no kit reaches the ~9,800 it claimed', () => {
  // The audit's exact scenario. Recorded as a named case so it is re-run rather than remembered.
  let worst = null;
  for (const kit of kitIds) {
    const { coins } = leafCost(kit);
    const margin = unitPrice(kit) - coins;
    if (!worst || margin > worst.margin) worst = { kit, margin, coins, sells: unitPrice(kit) };
  }
  assert.ok(worst.margin <= 0,
    `best kit margin is ${worst.kit} at ${Math.round(worst.margin)} coins `
    + `(raw ${Math.round(worst.coins)}, sells ${worst.sells}) - the original finding was ~9,800`);
  console.log(`        best kit margin: ${worst.kit} at ${Math.round(worst.margin)} coins `
    + `(raw ${Math.round(worst.coins)} vs sells ${worst.sells})`);
});

test('every leaf a kit expands to is something the player can actually obtain', () => {
  const orphans = new Set();
  for (const kit of kitIds) {
    for (const leaf of Object.keys(leafCost(kit).leaves)) {
      const known = d.CROPS[leaf] || d.MATERIALS[leaf] || d.GOODS[leaf]
        || Object.values(d.ANIMALS).some((a) => a.produces === leaf);
      if (!known) orphans.add(leaf);
    }
  }
  assert.equal(orphans.size, 0, `kits bottom out in things nothing produces: ${[...orphans].join(', ')}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
