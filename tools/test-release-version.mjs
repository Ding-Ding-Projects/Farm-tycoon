// test-release-version.mjs - every release must be a HIGHER version than the last one.
//
// This exists because the updater was dead for its entire life and nothing said so. The packaged
// version came straight from package.json, which is 0.1.0 and never changes, so every release
// published farm-tycoon-0.1.0-full.nupkg and advertised version 0.1.0 in RELEASES. An installed
// copy compared 0.1.0 against 0.1.0 and answered update-not-available, for ever, no matter how
// many releases shipped. The feed URL, the autoUpdater wiring, the ready banner and its Restart
// button were all correct, and none of them could ever run. Nothing failed, so nothing was noticed.
//
// The guard is on the workflow text because that is where the version is decided, and because the
// only true end-to-end proof needs two published releases and a real install to upgrade between.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  - ${name}`); }
  catch (err) { failures.push({ name, err }); console.log(`FAIL  - ${name}`); console.log(`        ${err.message}`); }
}

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');

console.log('\nRelease version uniqueness\n');

test('the packaged version is derived from the monotonic run number', () => {
  assert.match(workflow, /^\s*PKG_VERSION="\$\{MAJOR_MINOR\}\.\$\{RUN_NUMBER\}"/m,
    'a constant version makes every release invisible to the updater');
  assert.match(workflow, /^\s*RUN_NUMBER="\$\{GITHUB_RUN_NUMBER\}"/m,
    'the run number is the only monotonic counter available here');
});

test('the computed version is written into the manifest electron-builder reads', () => {
  assert.ok(workflow.includes("p.version = process.argv[1];"),
    'computing a version and not writing it packages the old one');
  assert.match(workflow, /^\s*ACTUAL="\$\(node -p "require\('\.\/package\.json'\)\.version"\)"/m,
    'and the write must be read back, not assumed');
  assert.ok(workflow.includes('Packaging would ship a version the updater cannot compare'),
    'the read-back must fail the job, not merely log');
});

test('the transient manifest edit is reverted before the ledger commit', () => {
  const at = workflow.indexOf('git checkout -- package.json');
  assert.notEqual(at, -1, 'the version bump must never be committed');
  assert.ok(at < workflow.indexOf('git add RELEASE-CODENAMES.md'),
    'and it must be reverted before git is touched, or the rebase retry refuses to run');
});

test('the repository itself still carries the base version', () => {
  assert.match(pkg.version, /^\d+\.\d+\.0$/,
    'the checked-in version stays the base; only the workflow bumps the patch');
});

test('the tag carries that same version', () => {
  assert.match(workflow, /^\s*TAG="v\$\{PKG_VERSION\}\+\$\{SHA_SHORT\}"/m,
    'a tag naming a different version than the artifact is a record nobody can trust');
});

test('the updater still points at a stable, tagless feed', () => {
  // Pinning the feed to a tag would defeat the version bump: the app would only ever look at one
  // release. /releases/latest/download redirects to whichever release is newest.
  assert.ok(main.includes('/releases/latest/download'), 'the feed must follow the newest release');
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
