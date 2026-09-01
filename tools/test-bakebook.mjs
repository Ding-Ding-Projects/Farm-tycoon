// test-bakebook.mjs — the Bake Book derives itself, and tells the truth about what you have done.
//
// The book is worth testing for one reason above the others: it is DERIVED. A hand-listed book
// would be a second place to forget a recipe, and the failure would be silent - a page that simply
// never mentions the thing you just added. So the first test here is not about rendering at all,
// it is that the book and the data agree about what "playable" means.
//
// The second theme is the distinction between "never tried" and "tried and did badly". They are
// different facts and a book that renders them the same way tells a player they failed at
// something they have not attempted. That is a one-character mistake to make (`|| 0` instead of a
// typeof check) and impossible to see by reading, so it is pinned here.

import assert from 'node:assert/strict';
import * as state from '../src/state.js';
import { BUILDINGS, QUALITY } from '../src/data.js';
import * as bakebook from '../src/bakebook.js';

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

function freshState() { state.resetGame(); return state.state; }

/** Every recipe carrying a play chain, read straight from data rather than from the module. */
function playableFromData() {
  const ids = [];
  for (const b of Object.values(BUILDINGS)) {
    for (const r of b.recipes || []) if (r.play && r.play.stages) ids.push(r.id);
  }
  return ids.sort();
}

console.log('\nBake Book\n');

test('the book is derived from the data, not a list somebody has to remember to update', () => {
  freshState();
  const fromBook = bakebook.entries().map((e) => e.recipeId).sort();
  const fromData = playableFromData();
  assert.deepEqual(fromBook, fromData,
    'the book and data.js disagree about which recipes are playable - a derived book cannot drift, '
    + 'so if these differ the derivation has a filter in it that data.js does not');
  assert.ok(fromBook.length > 0, 'a book that derives nothing renders as an empty page with no error anywhere');
});

test('a recipe never played reads as never played, not as played badly', () => {
  const s = freshState();
  s.minigames.best = {};
  const e = bakebook.entries()[0];
  assert.equal(e.bestIndex, undefined,
    'undefined, not 0 - `best[id] || 0` would make every untouched recipe look like a failed one');
  assert.equal(e.bestTier, null);
  assert.equal(e.mastered, false);

  const sum = bakebook.summary();
  assert.equal(sum.played, 0);
  assert.equal(sum.unplayed, sum.total);
  assert.equal(sum.perTier.reduce((a, t) => a + t.count, 0), 0,
    'nothing has been played, so no tier may have a count - unplayed recipes must not fall into the bottom tier');
});

test('the tier counts sum to what was PLAYED, never to the whole book', () => {
  const s = freshState();
  const ids = playableFromData();
  s.minigames.best = { [ids[0]]: 0, [ids[1]]: 2, [ids[2]]: bakebook.MASTER_INDEX };
  const sum = bakebook.summary();
  assert.equal(sum.played, 3);
  assert.equal(sum.unplayed, sum.total - 3);
  assert.equal(sum.perTier.reduce((a, t) => a + t.count, 0), 3,
    'the tiers must account for the played recipes and nothing else');
  assert.equal(sum.mastered, 1, 'only the top tier counts as mastered');
  assert.equal(sum.perTier[0].count, 1);
  assert.equal(sum.perTier[2].count, 1);
});

test('MASTER_INDEX follows the QUALITY table rather than being hardcoded', () => {
  assert.equal(bakebook.MASTER_INDEX, QUALITY.tiers.length - 1);
  const top = QUALITY.tiers[bakebook.MASTER_INDEX];
  assert.ok(top && top.grantsEffect,
    'the top tier is the one that grants the factory effect; if that stops being true the book is '
    + 'calling something "mastered" that the economy does not');
});

test('the book is only complete when every playable recipe is at the top tier', () => {
  const s = freshState();
  const ids = playableFromData();
  s.minigames.best = Object.fromEntries(ids.map((id) => [id, bakebook.MASTER_INDEX]));
  assert.equal(bakebook.summary().complete, true);

  // One short, and one at the tier below the top, must both read as incomplete.
  s.minigames.best = Object.fromEntries(ids.slice(0, -1).map((id) => [id, bakebook.MASTER_INDEX]));
  assert.equal(bakebook.summary().complete, false, 'one unplayed recipe means the book is not finished');
  s.minigames.best = Object.fromEntries(ids.map((id) => [id, bakebook.MASTER_INDEX - 1]));
  assert.equal(bakebook.summary().complete, false, 'every recipe played is not the same as every recipe mastered');
});

test('verbStanding ignores recipes never attempted, and puts the weakest verb first', () => {
  const s = freshState();
  const all = bakebook.entries();
  // Find two recipes using different verbs, and master one while failing the other.
  const withVerb = all.filter((e) => e.stages.length === 1);
  const a = withVerb[0];
  const b = withVerb.find((e) => e.stages[0].verb !== a.stages[0].verb);
  assert.ok(a && b, 'this test needs two single-stage recipes on different verbs');

  s.minigames.best = { [a.recipeId]: 0, [b.recipeId]: bakebook.MASTER_INDEX };
  const standing = bakebook.verbStanding();
  const played = standing.filter((v) => v.played > 0);
  assert.equal(played.length, 2, 'only the two attempted verbs may show as played');
  assert.equal(played[0].verb, a.stages[0].verb,
    'the verb with nothing mastered must sort ahead of the one fully mastered - the whole point is '
    + 'telling a player which verb to practise');
  assert.equal(played[0].mastered, 0);
  assert.equal(played[1].mastered, 1);
});

test('entries read in the order a player meets them', () => {
  freshState();
  const e = bakebook.entries();
  for (let i = 1; i < e.length; i++) {
    const prev = e[i - 1];
    const cur = e[i];
    assert.ok(prev.buildingLevel <= cur.buildingLevel,
      `${prev.recipeId} (building lv ${prev.buildingLevel}) sorted before ${cur.recipeId} (lv ${cur.buildingLevel})`);
  }
});

test('byBuilding covers every entry exactly once', () => {
  freshState();
  const flat = bakebook.byBuilding().flatMap((g) => g.recipes.map((r) => r.recipeId)).sort();
  assert.deepEqual(flat, bakebook.entries().map((e) => e.recipeId).sort(),
    'grouping must not drop or duplicate a recipe');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
