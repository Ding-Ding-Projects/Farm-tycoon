// tools/test-playables.mjs — proves the playable-craft gate and the quality tier channel.
//
// Plain Node script, no test framework (the project has no dependencies). Exits 0 on
// success, non-zero on first failure category, with a printed summary either way.
//
// The point of this suite is narrow and load-bearing: a playable recipe can ONLY be collected
// by playing its game, which means every way that could TRAP a craft has to be proven not to.
// A gate nobody has tried to deadlock is a gate nobody should trust.
//
// Run: node tools/test-playables.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as state from '../src/state.js';
import * as farm from '../src/farm.js';
import * as production from '../src/production.js';
import * as minigames from '../src/minigames.js';
import * as economy from '../src/economy.js';
import { BUILDINGS, FARM, QUALITY, qualityTier } from '../src/data.js';
import { sellableItemIds } from '../src/newspaper.js';
import { aggregate, weakestStage } from '../src/minigames/quality.js';

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

/** Place a bakery and stock it so both bread (plain) and cookie (playable) can be queued. */
function bakeryWithStock(s, { wheat = 20, egg = 10, sugar = 5 } = {}) {
  s.coins = 5000;
  s.level = 20;
  const b = farm.place('building', 'bakery', FARM.startZone.x + 5, FARM.startZone.y + 7);
  assert.ok(b, 'the bakery must place for these tests to mean anything');
  s.silo.items.wheat = wheat;
  s.barn.items.egg = egg;
  s.barn.items.sugar = sugar;
  return b;
}

const forceReady = (entry) => { entry.readyAt = Date.now() - 1000; };

// ---------------------------------------------------------------------------
// quality.js — aggregation
// ---------------------------------------------------------------------------

test('an even chain aggregates to its own score', () => {
  assert.ok(Math.abs(aggregate([0.8, 0.8, 0.8]) - 0.8) < 1e-9);
});

test('the worst-stage cap stops quality being farmed by sandbagging the one hard stage', () => {
  // A plain weighted mean of [0.1, 1, 1, 1] is 0.775 — a Fine cake for flunking the bake.
  // The cap pulls it to worst + 0.25 = 0.35, which is the whole reason the cap exists.
  const q = aggregate([0.1, 1, 1, 1]);
  assert.ok(q <= 0.1 + QUALITY.worstStageCap + 1e-9, `expected <= 0.35, got ${q}`);
  assert.equal(qualityTier(q).id, 'plain', 'flunking a stage must not still buy a good tier');
});

test('stage weight makes a heavy stage count for more', () => {
  const light = aggregate([1, 0.5], [{}, {}]);
  const heavy = aggregate([1, 0.5], [{}, { weight: 2 }]);
  assert.ok(heavy < light, 'weighting the low stage harder must pull the result down');
});

test('an empty or malformed score list is 0, never NaN', () => {
  assert.equal(aggregate([]), 0);
  assert.equal(aggregate(null), 0);
  assert.equal(aggregate([NaN, 'x']), 0);
});

test('weakestStage names the stage the result screen should call out', () => {
  assert.equal(weakestStage([0.9, 0.3, 0.7]), 1);
  assert.equal(weakestStage([]), -1);
});

test('every tier is reachable and the floor tier catches everything below it', () => {
  assert.equal(qualityTier(0).id, 'plain');
  assert.equal(qualityTier(-5).id, 'plain', 'a nonsense score must floor, not throw');
  assert.equal(qualityTier(0.45).id, 'good', 'a tier min must be inclusive');
  assert.equal(qualityTier(0.7).id, 'fine');
  assert.equal(qualityTier(1).id, 'master');
});

// ---------------------------------------------------------------------------
// production.js — the gate
// ---------------------------------------------------------------------------

test('enqueue stamps a cid on every entry and a play record only on a playable recipe', () => {
  const s = freshState();
  const b = bakeryWithStock(s);

  assert.equal(production.enqueue(b.id, 'bread'), true);
  assert.equal(production.enqueue(b.id, 'cookie'), true);

  const [bread, cookie] = s.production;
  assert.ok(bread.cid && cookie.cid, 'every entry needs a stable handle');
  assert.notEqual(bread.cid, cookie.cid, 'cids must be unique per craft');
  assert.equal(bread.play, null, 'a plain recipe must carry no play record at all');
  assert.ok(cookie.play && cookie.play.done === false, 'a playable recipe starts unplayed');
});

test('a ready but unplayed craft refuses collection', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  forceReady(s.production[0]);

  assert.equal(production.collectBuilding(b.id), null, 'the gate must hold');
  assert.equal(s.barn.items.cookie || 0, 0, 'and nothing may reach the barn');
  assert.equal(s.production.length, 1, 'the craft must still be queued, not destroyed');
});

test('an unplayed craft never blocks a collectable one queued behind it', () => {
  // This is the single most important behaviour in the change: findIndex SKIPS the gated
  // entry. Without it, one cake nobody felt like playing would freeze the whole factory.
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie'); // gated, queued FIRST
  production.enqueue(b.id, 'bread');  // plain, queued behind it
  s.production.forEach(forceReady);

  const got = production.collectBuilding(b.id);
  assert.deepEqual(got, { goodId: 'bread', qty: 1, tier: null }, 'the loaf behind must come out');
  assert.equal(s.production.length, 1, 'and only the gated craft should remain');
  assert.equal(s.production[0].recipeId, 'cookie');
});

test('playing the craft through opens the gate and pays the tier yield', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  forceReady(entry);

  const result = minigames.commitStage(entry, 0.75); // Fine: yield 2, xp x1.5
  assert.equal(result.done, true, 'a one-stage chain finishes on its only commit');
  assert.equal(result.tier, 'fine');

  const got = production.collectBuilding(b.id);
  assert.equal(got.goodId, 'cookie');
  assert.equal(got.qty, 2, 'Fine yields two');
  assert.equal(got.tier, 'fine');
  assert.equal(s.barn.items.cookie, 2);
});

test('a barn with no room defers a played craft rather than destroying the run', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  forceReady(entry);
  minigames.commitStage(entry, 1);

  s.barn.capacity = 0; // played, and nowhere to put it
  assert.equal(production.collectBuilding(b.id), null, 'collection must defer');
  assert.equal(s.production.length, 1, 'the craft must survive');
  assert.equal(s.production[0].play.done, true, 'and must NOT need replaying');

  s.barn.capacity = 50;
  const got = production.collectBuilding(b.id);
  assert.ok(got && got.qty >= 1, 'once there is room it collects, without a second play');
});

test('room for fewer units than the tier earned pays the shortfall in coins', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  forceReady(entry);
  minigames.commitStage(entry, 1); // Masterpiece: yield 2

  s.barn.capacity = (Object.values(s.barn.items).reduce((a, x) => a + x, 0)) + 1; // room for 1
  const before = s.coins;
  const got = production.collectBuilding(b.id);

  assert.equal(got.qty, 1, 'only what fits may land in the barn');
  assert.ok(s.coins > before, 'the unit that did not fit must be paid out, not silently dropped');
});

test('a craft that is ready but unplayed survives a simulated month untouched', () => {
  // There is no run window and no expiry sweep, deliberately: with the game as a GATE, an
  // expiring run would mean a phone call mid-bake destroys a craft.
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  entry.readyAt = Date.now() - 30 * 24 * 60 * 60 * 1000;

  production.tick(Date.now());
  assert.equal(s.production.length, 1, 'a month of absence must not expire a craft');
  assert.equal(s.production[0].play.done, false, 'and it must still be playable');
});

test('skipTimer still works on a play-bearing entry and does not open the gate', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  s.diamonds = 500;
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];

  assert.equal(production.skipTimer(entry), true, 'diamonds must still skip the PREP timer');
  assert.ok(entry.readyAt <= Date.now(), 'the wait is gone');
  assert.equal(production.collectBuilding(b.id), null, 'but skipping prep must not skip the GAME');
});

// ---------------------------------------------------------------------------
// minigames.js — chains, determinism, the escape hatch
// ---------------------------------------------------------------------------

test('abandoning a stage keeps committed scores and regenerates an identical board', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  forceReady(entry);

  const before = minigames.stageSeed(entry, 0);
  assert.equal(minigames.abandon(entry), true);
  assert.equal(entry.play.attempts, 1, 'the attempt is recorded');
  assert.equal(entry.play.scores.length, 0, 'an abandoned stage commits nothing');
  assert.equal(minigames.stageSeed(entry, 0), before,
    'a replayed stage must regenerate the SAME board — otherwise abandoning until the board is kind is a strategy');
});

test('stage seeds are derived per index, so two stages of one craft differ', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  assert.notEqual(minigames.stageSeed(entry, 0), minigames.stageSeed(entry, 1));
});

test('a score outside 0..1 is clamped rather than trusted', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  minigames.commitStage(entry, 99);
  assert.equal(entry.play.scores[0], 1, 'the caller is UI code; a bad score must not become a bad tier');
});

test('finishPlain completes a craft at the floor tier with no bonus at all', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  forceReady(entry);

  const res = minigames.finishPlain(entry);
  assert.equal(res.done, true);
  assert.equal(res.tier, 'plain', 'the escape hatch must be the WORST outcome, never a shortcut');
  assert.equal(Object.keys(s.minigames.results).length, 0, 'and must award no factory effect');

  const got = production.collectBuilding(b.id);
  assert.equal(got.qty, 1, 'Plain yields one');
});

test('only a Masterpiece awards the building factory effect', () => {
  const s = freshState();
  const b = bakeryWithStock(s);

  production.enqueue(b.id, 'cookie');
  let entry = s.production[0];
  forceReady(entry);
  minigames.commitStage(entry, 0.75); // Fine
  assert.equal(s.minigames.results[b.id], undefined, 'Fine must not grant the effect');
  production.collectBuilding(b.id);

  production.enqueue(b.id, 'cookie');
  entry = s.production[0];
  forceReady(entry);
  minigames.commitStage(entry, 1); // Masterpiece
  assert.ok(s.minigames.results[b.id], 'Masterpiece must grant it');
  assert.equal(s.minigames.results[b.id].effect, 'bonusYield', "the bakery's own effect key");
});

test('pendingBonus consumes the factory effect exactly once', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  forceReady(entry);
  minigames.commitStage(entry, 1);

  const first = minigames.pendingBonus(b.id);
  assert.equal(first.effect, 'bonusYield');
  const second = minigames.pendingBonus(b.id);
  assert.equal(second.amount, 0, 'a consumed bonus must not pay twice');
  assert.equal(second.effect, null, 'and absence returns a zeroed shape, never null');
});

test('best-tier is recorded per recipe and never regresses', () => {
  const s = freshState();
  const b = bakeryWithStock(s, { wheat: 40, egg: 20, sugar: 10 });

  production.enqueue(b.id, 'cookie');
  let entry = s.production[0];
  forceReady(entry);
  minigames.commitStage(entry, 1); // Masterpiece
  production.collectBuilding(b.id);
  const best = s.minigames.best.cookie;

  production.enqueue(b.id, 'cookie');
  entry = s.production[0];
  forceReady(entry);
  minigames.commitStage(entry, 0); // Plain
  assert.equal(s.minigames.best.cookie, best, 'a worse run must not lower a recorded best');
});

// ---------------------------------------------------------------------------
// state.js — the v3 -> v4 migration
// ---------------------------------------------------------------------------

test('a v3 save grandfathers its in-flight crafts rather than gating them retroactively', () => {
  // The load-bearing migration case. A craft queued before playable items existed was never
  // gated; upgrading the save underneath it must not strand it forever.
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const raw = JSON.parse(state.exportSave());

  raw.version = 3;
  for (const e of raw.production) { delete e.cid; delete e.play; }
  delete raw.craftSeq;
  raw.minigames = { pending: { [b.id]: { gameId: 'knead_dough', seed: 1, expiresAt: 2 } }, results: {}, played: {} };

  assert.equal(state.importSave(JSON.stringify(raw)), true, 'a v3 save must still load');
  const s2 = state.state;
  assert.equal(s2.version, state.SAVE_VERSION, 'a v3 save walks every later migration too');
  assert.equal(s2.minigames.pending, undefined, 'the building-keyed pending table is dropped');
  assert.ok(s2.minigames.best, 'and best is defaulted');
  assert.equal(s2.settings.assist, false, 'assist defaults off');

  const entry = s2.production[0];
  assert.ok(entry.cid, 'every migrated entry gains a stable handle');
  assert.equal(entry.play.done, true, 'a pre-existing craft must be collectable WITHOUT playing');

  entry.readyAt = Date.now() - 1000;
  assert.ok(production.collectBuilding(entry.objectId), 'and it must actually come out');
});

test('a fresh save carries the new keys so no module has to branch on their absence', () => {
  const s = freshState();
  assert.equal(s.version, state.SAVE_VERSION);
  assert.equal(s.craftSeq, 0);
  assert.deepEqual(s.minigames, { results: {}, played: {}, best: {} });
  assert.equal(s.settings.assist, false);
  assert.equal(s.settings.autoFinish, false);
});

// ---------------------------------------------------------------------------
// economy.js — the multiplier merge point
// ---------------------------------------------------------------------------

test('sellValue honours a registered sellPriceMult provider', () => {
  // Regression: sellValue asked combinedMultiplier for 'sell', a key that is not in EFFECT_KEYS
  // and does not end in Mult, so no provider could ever answer it and sellPriceMult was dead.
  const s = freshState();
  const base = economy.sellValue('bread');
  economy.registerMultiplierEffect((kind) => (kind === 'sellPriceMult' ? 2 : 1));
  assert.equal(economy.sellValue('bread'), base * 2, 'the multiplier must actually reach the price');
});

// ---------------------------------------------------------------------------
// The two release valves. Both exist because the gate is deliberate and a DEAD END is not.
// ---------------------------------------------------------------------------

test('every playable good is buyable from a neighbour, so a gated order can never hard-stall', () => {
  // A playable item can ONLY be crafted by playing its game. If an order or a boat crate asks
  // for one, the newspaper is the route that does not require playing. Narrowing that pool to
  // exclude playable goods would strand exactly those requests, silently.
  const pool = new Set(sellableItemIds());
  const playable = [];
  for (const def of Object.values(BUILDINGS)) {
    for (const r of def.recipes) if (r.play) playable.push(r.id);
  }
  assert.ok(playable.length > 0, 'this test is meaningless if nothing is playable');
  for (const id of playable) {
    assert.ok(pool.has(id), `${id} is gated behind a minigame and cannot be bought either - dead end`);
  }
});

test('discarding a jammed craft frees the slot and refunds half the inputs', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  const recipe = BUILDINGS.bakery.recipes.find((r) => r.id === 'cookie');
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  const wheatAfterEnqueue = s.silo.items.wheat;

  const out = production.discardBatch(entry.cid);
  assert.ok(out, 'a queued craft must be discardable');
  assert.equal(s.production.length, 0, 'the slot must be freed');
  assert.equal(s.silo.items.wheat, wheatAfterEnqueue + Math.floor(recipe.inputs.wheat / 2),
    'exactly half the wheat, rounded down, comes back');
});

test('discarding refunds strictly less than it consumed, so it is never a free cancel', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  const before = { wheat: s.silo.items.wheat, egg: s.barn.items.egg, sugar: s.barn.items.sugar };
  production.enqueue(b.id, 'cookie');
  production.discardBatch(s.production[0].cid);
  const worseOff = s.silo.items.wheat < before.wheat || s.barn.items.egg < before.egg
    || s.barn.items.sugar < before.sugar;
  assert.ok(worseOff, 'queue-then-discard must cost something, or it dodges a bad roll for free');
});

test('a played craft can still be discarded, and an unknown cid is a safe no-op', () => {
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];
  forceReady(entry);
  minigames.commitStage(entry, 1);
  assert.ok(production.discardBatch(entry.cid), 'even a finished craft may be thrown out');
  assert.equal(production.discardBatch('no_such_cid'), null, 'an unknown handle must not throw');
});

test('a discard into a full silo pays the refund out in coins rather than losing it', () => {
  // The dialog promises half the ingredients back. A full container must not quietly turn that
  // promise into nothing, so whatever will not fit is paid at sell value instead.
  const s = freshState();
  const b = bakeryWithStock(s);
  production.enqueue(b.id, 'cookie');
  const entry = s.production[0];

  s.silo.capacity = 0;   // nowhere for the wheat to go
  s.barn.capacity = 0;   // nor the egg or sugar
  const coinsBefore = s.coins;
  const out = production.discardBatch(entry.cid);

  assert.ok(out, 'the discard must still happen');
  assert.equal(s.production.length, 0, 'the slot is freed either way');
  assert.ok(out.paidOut > 0, 'the un-refundable half must be paid, not silently dropped');
  assert.equal(s.coins, coinsBefore + out.paidOut, 'and the coins must actually arrive');
});

// ---------------------------------------------------------------------------------------
// Telling the player the rule exists.
//
// The gate contradicts what a farming game trains everyone to expect - a timer finishes and the
// thing is yours - and for roughly one recipe in three it does not. Nothing was saying so: the
// recipe card carries a 🎮 and the queue says "Ready to make", which is enough to work out once
// you know the rule and not enough to teach it, and the tutorial ends at the order board, several
// levels before the first playable recipe can come up.
//
// Both checks below are on the SOURCE rather than behaviour, because the explanation is a modal and
// the thing worth protecting is not its wording. It is that it is still wired in, and that it still
// costs no migration.
// ---------------------------------------------------------------------------------------
{
  const uiSource = fs.readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const stateSource = fs.readFileSync(new URL('../src/state.js', import.meta.url), 'utf8');

  test('the gate explains itself the first time a craft is waiting to be played', () => {
    // Anchored to the start of a line so a commented-out call cannot satisfy it, which is how a
    // one-shot explanation would most likely die - somebody silencing it while testing something
    // else and not noticing, because by then their own save has already seen it.
    assert.match(uiSource, /^\s*explainTheGateOnce\(\);/m,
      'renderQueue must call explainTheGateOnce() on a live line where a craft needs playing');
    assert.match(uiSource, /^function explainTheGateOnce\(\) \{/m, 'and the function must still exist');
  });

  test('the explained flag is never initialised, so an old save needs no migration', () => {
    // This is the whole reason there is no SAVE_VERSION 5. An ABSENT field reads as false, which
    // is exactly right for a save written before the explanation existed: that player has not seen
    // it either. Initialising it to false in resetGame would be harmless; initialising it to TRUE,
    // or adding a migration that sets it, would silently rob every existing save of the one
    // explanation it needs most.
    // Comments stripped first. The save-shape comment in state.js documents the field by name,
    // and a bare source scan matched that documentation and reported it as an assignment - the
    // test failing on the very comment explaining why the test exists.
    const code = stateSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /explained\s*:/,
      'state.js must not set minigames.explained - its absence is what makes old saves work');
    assert.match(uiSource, /state\.minigames\.explained = true;/,
      'ui.js is the only place that sets it, at the moment it is actually explained');
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
