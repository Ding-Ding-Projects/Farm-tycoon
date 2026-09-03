// test-buildstamp.mjs - the front screen states which build is running and when it was made.
//
// The contract has two halves and the second is the one worth guarding: provenance that is
// MISSING must read as missing. A stamp that quietly falls back to the current time is worse than
// no stamp at all, because it answers the reader's question confidently and wrongly, and there is
// nothing on screen to tell them so.
//
// The markup half is checked by reading index.html directly rather than by rendering. The element
// can be deleted in one keystroke and nothing else in the suite would notice.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILD_INFO, buildStamp } from '../src/build-info.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  - ${name}`); }
  catch (err) { failures.push({ name, err }); console.log(`FAIL  - ${name}`); console.log(`        ${err.message}`); }
}

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

console.log('\nBuild stamp\n');

test('the front screen carries the stamp element before any navigation', () => {
  // Anchored to the line, not to a bare substring: a commented-out div still contains the id.
  assert.match(html, /^\s*<div class="build-stamp" id="build-stamp">/m, 'index.html must render the build stamp');
  assert.match(html, /^\s*<span id="build-stamp-version">/m, 'the version span must exist');
  assert.match(html, /^\s*<span id="build-stamp-when">/m, 'the build-time span must exist');
  // It must sit ahead of the HUD, i.e. on the first screen rather than behind a panel.
  assert.ok(html.indexOf('id="build-stamp"') < html.indexOf('class="hud-top"'), 'the stamp belongs on the front screen');
});

test('main.js actually paints it - a stamp nothing writes to is decoration', () => {
  assert.match(mainJs, /^\s*paintBuildStamp\(\);/m, 'boot must call paintBuildStamp()');
  assert.match(mainJs, /^\s*function paintBuildStamp\(\)/m, 'paintBuildStamp must be defined');
  assert.match(mainJs, /from '\.\/build-info\.js'/, 'and it must read the real provenance module');
});

test('missing provenance reads as missing, never as the current time', () => {
  const s = buildStamp({ version: '9.9.9', builtAt: null, commit: null });
  assert.equal(s.version, 'v9.9.9');
  assert.match(s.when, /unavailable/, 'an unstamped build must say so');
  const year = String(new Date().getFullYear());
  assert.ok(!s.when.includes(year), 'it must not fall back to today');
});

test('an unreadable timestamp is also reported, not rendered as Invalid Date', () => {
  const s = buildStamp({ version: '1.0.0', builtAt: 'not-a-date', commit: null });
  assert.match(s.when, /unavailable/);
  assert.ok(!/Invalid/.test(s.when), 'the reader gets a sentence, not a Date object failure');
});

test('a stamped build shows the local date and time down to the second', () => {
  const s = buildStamp({ version: '0.1.0', builtAt: '2026-09-03T02:00:31Z', commit: 'abc1234' });
  assert.match(s.when, /^built \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, 'seconds are part of the contract');
  assert.match(s.title, /abc1234/, 'the commit is available for anyone checking provenance');
});

test('the committed placeholder is honestly unstamped', () => {
  assert.equal(BUILD_INFO.builtAt, null, 'a source checkout must not claim a build time');
});

test('the release workflow stamps provenance before it packages', () => {
  const stampAt = workflow.indexOf('tools/stamp-build-info.mjs');
  const packageAt = workflow.indexOf('npm run dist');
  assert.ok(stampAt !== -1, 'the workflow must run the stamper');
  assert.ok(packageAt !== -1, 'and it must still package');
  assert.ok(stampAt < packageAt, 'stamping after packaging would ship the placeholder');
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
