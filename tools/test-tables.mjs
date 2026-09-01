// test-tables.mjs — the hand-transcribed tables, checked for internal coherence.
//
// WHAT THIS DOES NOT DO, first, because the distinction is the whole point of the file. It does not
// prove these numbers match the wikis they came from. Nothing here reaches the network, and even if
// it did, the wikis describe a different game - their figures were a starting point, and several
// have deliberately diverged since (the doner kebab stand sits at level 54 here rather than the
// wiki's 32, because lamb does not arrive until 53).
//
// What it does is catch the failure mode those numbers actually have. Regatta rewards, community
// building costs and expansion prices were read off wiki text and images and typed in by hand, and
// the way a hand-typed table goes wrong is a slipped digit: 12000 for 120000, a diamond count that
// dips in the middle of a descending run, a cost an order of magnitude out. Those do not look like
// anything when you read them, and they are obvious the moment you ask whether the curve is smooth.
//
// So every check here is about SHAPE rather than value. A number can be wrong and still pass this;
// a number can be right and still fail it if the design genuinely changes. Both are stated in the
// message the assertion prints, so a failure is a question rather than an accusation.

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

/** Each value against the one before it, as a ratio, skipping zeroes. */
function ratios(values) {
  const out = [];
  for (let i = 1; i < values.length; i++) {
    if (!values[i - 1]) continue;
    out.push({ i, ratio: values[i] / values[i - 1] });
  }
  return out;
}

console.log('\nHand-transcribed tables\n');

// ---------------------------------------------------------------------------
// Regatta
// ---------------------------------------------------------------------------

test('regatta placement rewards fall with every place, in both currencies', () => {
  const places = d.REGATTA.rewards.placement;
  assert.ok(places.length >= 2, 'a placement table needs at least two places to mean anything');
  for (let i = 0; i < places.length; i++) {
    assert.equal(places[i].place, i + 1, `place ${i + 1} is out of order or missing`);
  }
  for (let i = 1; i < places.length; i++) {
    assert.ok(places[i].coins < places[i - 1].coins,
      `place ${i + 1} pays ${places[i].coins} coins, more than place ${i} at ${places[i - 1].coins} - `
      + 'a lower finish must never pay better, and a slipped digit is what this usually is');
    assert.ok(places[i].diamonds <= places[i - 1].diamonds,
      `place ${i + 1} pays ${places[i].diamonds} diamonds against place ${i}'s ${places[i - 1].diamonds}`);
  }
});

test('no regatta place pays an order of magnitude out of line with its neighbours', () => {
  // The specific slip this catches: 12000 typed for 120000, which keeps the table descending but
  // puts one row ten times where it belongs.
  for (const { i, ratio } of ratios(d.REGATTA.rewards.placement.map((p) => p.coins))) {
    assert.ok(ratio > 0.25 && ratio < 1,
      `place ${i + 1} pays ${(ratio * 100).toFixed(0)}% of place ${i} - a step that steep is usually `
      + 'a digit, not a design decision');
  }
});

test('regatta leagues climb in both what they ask and what they pay', () => {
  const leagues = d.REGATTA.leagues || [];
  assert.ok(leagues.length >= 2, 'expected a league ladder');
  assert.equal(leagues[0].minSeasonsWon, 0, 'the first league must be reachable from a standing start');
  assert.equal(leagues[0].rewardMult, 1, 'the first league is the baseline multiplier');
  for (let i = 1; i < leagues.length; i++) {
    assert.ok(leagues[i].minSeasonsWon > leagues[i - 1].minSeasonsWon,
      `${leagues[i].id} asks for ${leagues[i].minSeasonsWon} seasons, no more than ${leagues[i - 1].id} - `
      + 'a league nobody has to climb to is not a league');
    assert.ok(leagues[i].rewardMult > leagues[i - 1].rewardMult,
      `${leagues[i].id} pays no better than ${leagues[i - 1].id}, so there is no reason to reach it`);
  }
});

// ---------------------------------------------------------------------------
// Town
// ---------------------------------------------------------------------------

test('community buildings cost more and hold more as they go up', () => {
  const list = Object.entries(d.TOWN.communityBuildings);
  const byCost = [...list].sort((a, b) => a[1].cost - b[1].cost);
  for (let i = 1; i < byCost.length; i++) {
    assert.ok(byCost[i][1].capacity > byCost[i - 1][1].capacity,
      `${byCost[i][0]} costs more than ${byCost[i - 1][0]} but houses no more people - `
      + 'a dearer building that does less is one nobody would ever pick');
  }
  for (let i = 1; i < byCost.length; i++) {
    assert.ok((byCost[i][1].tier || 0) >= (byCost[i - 1][1].tier || 0),
      `${byCost[i][0]} is a lower tier than the cheaper ${byCost[i - 1][0]}`);
  }
});

test('no community building is priced an order of magnitude off its neighbours', () => {
  // Cost per head of capacity should drift, not jump. It is allowed to fall slightly at the top -
  // the botanical garden is deliberately the best value in the game, at about 3% under the
  // observatory - so the band is generous downward and tight upward, where a slipped digit lands.
  const byCost = Object.entries(d.TOWN.communityBuildings).sort((a, b) => a[1].cost - b[1].cost);
  const perHead = byCost.map(([, b]) => b.cost / b.capacity);
  for (const { i, ratio } of ratios(perHead)) {
    assert.ok(ratio > 0.8 && ratio < 2,
      `${byCost[i][0]} costs ${perHead[i].toFixed(0)} per head against ${perHead[i - 1].toFixed(0)} `
      + `for ${byCost[i - 1][0]} - a ${ratio.toFixed(2)}x step is usually a typo`);
  }
});

// ---------------------------------------------------------------------------
// Expansions
// ---------------------------------------------------------------------------

test('every expansion costs more than the last, in coins and in tools', () => {
  const zones = d.FARM.expansions;
  assert.ok(Array.isArray(zones) && zones.length > 1, 'expected a list of expansions');
  for (let i = 1; i < zones.length; i++) {
    assert.ok(zones[i].cost > zones[i - 1].cost,
      `${zones[i].id} costs ${zones[i].cost}, no more than ${zones[i - 1].id} at ${zones[i - 1].cost}`);
    const total = (z) => Object.values(z.materials || {}).reduce((a, n) => a + n, 0);
    assert.ok(total(zones[i]) >= total(zones[i - 1]),
      `${zones[i].id} asks for fewer tools than ${zones[i - 1].id}`);
  }
});

test('no expansion jumps an order of magnitude in price', () => {
  for (const { i, ratio } of ratios(d.FARM.expansions.map((z) => z.cost))) {
    assert.ok(ratio > 1 && ratio < 4.5,
      `${d.FARM.expansions[i].id} costs ${ratio.toFixed(2)}x the one before it - the curve should `
      + 'climb steadily, and a step this size is usually a digit rather than a decision');
  }
});

test('the expansion rectangles do not overlap each other', () => {
  const zones = d.FARM.expansions;
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i].rect;
      const b = zones[j].rect;
      const hit = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      assert.ok(!hit, `${zones[i].id} and ${zones[j].id} claim the same ground`);
    }
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
