/* test-repo-surfaces.mjs — the repository's own shipped surfaces, as a hand-written inventory.
 *
 * A rule-shaped check ("every .bat that exists is well-formed") passes cleanly on a repository
 * that has no .bat files at all, which is exactly the state this file was written to catch. So
 * the inventory below is written by hand: each entry names a file that MUST exist, and adding a
 * new required surface means adding a row here, not hoping a glob notices.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ok  - ${name}`); passed++; }
  catch (e) { console.log(`FAIL  - ${name}\n        ${e.message}`); failed++; }
}
const abs = (p) => path.join(ROOT, p);
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ---------------------------------------------------------------------------------------------
// One-click build scripts. A repository whose build script only works on a machine that already
// has everything is a build script nobody has proven, and the first time it is needed is the
// worst time to find out.
// ---------------------------------------------------------------------------------------------
const REQUIRED_SCRIPTS = [
  { file: 'build.bat', mustMention: ['build.ps1', '/s'] },
  { file: 'build-installer.bat', mustMention: ['build.ps1', '-Installer'] },
  { file: 'download-dependencies.bat', mustMention: ['bootstrap.ps1'] },
  { file: 'tools/build.ps1', mustMention: ['npm test', 'NotSigned', 'bootstrap.ps1'] },
  { file: 'tools/bootstrap.ps1', mustMention: ['npm ci', 'electron'] },
];

for (const entry of REQUIRED_SCRIPTS) {
  test(`${entry.file} exists and is a real script`, () => {
    assert(existsSync(abs(entry.file)), `${entry.file} is missing from the repository root`);
    const text = readFileSync(abs(entry.file), 'utf8');
    assert(text.length > 200, `${entry.file} is too short to be doing the job it claims`);
    for (const needle of entry.mustMention) {
      assert(text.includes(needle), `${entry.file} never mentions ${needle}`);
    }
  });
}

test('every .bat accepts a silent mode, so CI and an agent can call it without blocking', () => {
  for (const { file } of REQUIRED_SCRIPTS.filter((e) => e.file.endsWith('.bat'))) {
    const text = readFileSync(abs(file), 'utf8');
    assert(/\/s/i.test(text) && text.includes('--silent'), `${file} has no silent mode`);
  }
});

test('build.ps1 judges npm by its exit code, not by whether it printed to stderr', () => {
  // The suite deliberately prints "Error: boom" from a fixture. Under ErrorActionPreference
  // 'Stop' that one line aborts a run that exited 0, so the preference must be relaxed around
  // the native call and the exit code read explicitly.
  const text = readFileSync(abs('tools/build.ps1'), 'utf8');
  assert(/\$ErrorActionPreference\s*=\s*'Continue'/.test(text),
    'build.ps1 never relaxes ErrorActionPreference around its native npm calls');
  assert(text.includes('$testExit'), 'build.ps1 does not capture npm test\'s exit code');
});

// ---------------------------------------------------------------------------------------------
// The shared-link embed graphic. A repository whose link pastes as a grey card has thrown away
// its first impression, and the upload is a manual Settings step — so the file has to be
// findable at the root, not four directories down.
// ---------------------------------------------------------------------------------------------
test('social-preview.png sits at the repository root', () => {
  assert(existsSync(abs('social-preview.png')),
    'social-preview.png is missing from the repository root (Settings -> General -> Social preview uploads it)');
  assert(statSync(abs('social-preview.png')).size > 10000, 'social-preview.png is implausibly small');
});

test('the root master and the served docs copy are byte-identical', () => {
  // Two copies of one picture are two pictures that will disagree eventually, so assert rather
  // than assume: the docs site serves docs/og-image.png as its og:image and the root file is the
  // master a human drags into the Settings page.
  const digest = (p) => createHash('sha256').update(readFileSync(abs(p))).digest('hex');
  assert(digest('social-preview.png') === digest('docs/og-image.png'),
    'social-preview.png and docs/og-image.png have drifted apart');
});

test('the docs site actually references its og:image', () => {
  const html = readFileSync(abs('docs/index.html'), 'utf8');
  assert(/property=["']og:image["']/.test(html), 'docs/index.html declares no og:image');
  assert(/twitter:card/.test(html) && html.includes('summary_large_image'),
    'docs/index.html has no summary_large_image card, so the embed renders as a thumbnail');
});

// ---------------------------------------------------------------------------------------------
// Release notes must not make a claim the repository can disprove.
// ---------------------------------------------------------------------------------------------
test('the release notes no longer describe the game as an unplayable scaffold', () => {
  const text = readFileSync(abs('tools/release-notes.mjs'), 'utf8');
  for (const stale of ['not yet playable', 'stub bodies', 'placeholder splash screen']) {
    assert(!text.includes(stale),
      `release-notes.mjs still claims "${stale}", which stopped being true when Phase B landed`);
  }
});

test('the release notes take their content counts from the generated module, never from prose', () => {
  const text = readFileSync(abs('tools/release-notes.mjs'), 'utf8');
  assert(text.includes('loadDataCounts'), 'release-notes.mjs does not load the generated counts');
  assert(/counts\.crops/.test(text), 'release-notes.mjs does not use the loaded crop count');
});

// ---------------------------------------------------------------------------------------------
// Selling waits for a buyer. There is no instant sell anywhere, and this is the check that stops
// one quietly coming back: a single addCoins beside a storage take, in a panel, is all it takes
// to undercut the entire roadside stand.
// ---------------------------------------------------------------------------------------------
test('no inventory panel pays out coins on the spot', () => {
  const ui = readFileSync(abs('src/ui.js'), 'utf8');
  assert(!ui.includes('Sell for '),
    'src/ui.js still renders an instant "Sell for X" button - selling must go through the shop');
  const grid = ui.slice(ui.indexOf('function renderInventoryGrid'), ui.indexOf('function openSellDialog'));
  assert(grid.length > 100, 'could not isolate renderInventoryGrid - the guard needs updating');
  assert(!grid.includes('addCoins'),
    'renderInventoryGrid pays coins directly; selling must list on the stand and wait');
  assert(grid.includes('openSellDialog'), 'renderInventoryGrid no longer opens the sell dialog');
});

test('the dialog previews the wait with the same function the listing uses', () => {
  const ui = readFileSync(abs('src/ui.js'), 'utf8');
  const shopSrc = readFileSync(abs('src/shop.js'), 'utf8');
  assert(ui.includes('shop.estimateSellTime('),
    'the sell dialog does not call shop.estimateSellTime, so its preview can drift from the result');
  assert(shopSrc.includes('export function estimateSellTime'),
    'shop.js does not export estimateSellTime');
  const listFn = shopSrc.slice(shopSrc.indexOf('export function list('),
                               shopSrc.indexOf('export function cancel('));
  assert(listFn.includes('estimateSellTime('),
    'shop.list() computes its own sell time instead of the shared estimator');
});

test('the roadside stand is open from level 1, because it is the only way to sell', () => {
  const data = readFileSync(abs('src/data.js'), 'utf8');
  const i = data.indexOf('export const SHOP = {');
  assert(i >= 0, 'src/data.js has no SHOP table');
  const shopBlock = data.slice(i, i + 700);
  assert(shopBlock.includes('unlockLevel: 1'),
    'SHOP.unlockLevel is not 1 - a new player would have produce and no way to sell it');
  assert(data.includes("unlockLevel: 1,  panel: 'shop'"),
    'the shop_stand structure is not unlocked at level 1, so the stand cannot be reached');
});

// ---------------------------------------------------------------------------------------------
// Orders travel by road. Packing a crate takes the goods; the truck's arrival pays for them.
// The failure this guards against is the same one the roadside stand had: a single addCoins at
// hand-in time, which removes the entire delivery leg while leaving all of its code in place.
// ---------------------------------------------------------------------------------------------
test('loading an order onto the truck does not pay for it', () => {
  const src = readFileSync(abs('src/orders.js'), 'utf8');
  const fn = src.slice(src.indexOf('export function fulfillOrder('),
                       src.indexOf('// -----', src.indexOf('export function fulfillOrder(')));
  assert(fn.length > 100, 'could not isolate fulfillOrder - the guard needs updating');
  assert(!fn.includes('addCoins'),
    'fulfillOrder pays coins directly; the delivery must pay on arrival instead');
  assert(!fn.includes('addXp'),
    'fulfillOrder awards XP directly; the delivery must award it on arrival instead');
  assert(fn.includes('arrivesAt'), 'fulfillOrder no longer dispatches a delivery');
});

test('the delivery leg exists end to end: dispatch, tick, collect', () => {
  const src = readFileSync(abs('src/orders.js'), 'utf8');
  for (const name of ['deliveryTimeFor', 'deliveries', 'tickDeliveries', 'collectDelivery']) {
    assert(src.includes('export function ' + name),
      'orders.js does not export ' + name + ', so the delivery leg is incomplete');
  }
  const collect = src.slice(src.indexOf('export function collectDelivery('));
  assert(collect.includes('addCoins') && collect.includes('addXp'),
    'collectDelivery does not actually pay, so an arrived truck is worth nothing');
  // The loop has to advance deliveries, or a truck only arrives while its panel is open.
  const main = readFileSync(abs('src/main.js'), 'utf8');
  assert(main.includes('orders.tickDeliveries'),
    'main.js never ticks deliveries, so a truck would only arrive while the order panel is open');
});

test('the order card states the drive before the player commits to it', () => {
  const ui = readFileSync(abs('src/ui.js'), 'utf8');
  assert(ui.includes('orders.deliveryTimeFor('),
    'the order card does not show the drive time from the shared function');
  assert(ui.includes('Load the truck'),
    'the order button no longer says what it does - it dispatches a truck, it does not pay');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
