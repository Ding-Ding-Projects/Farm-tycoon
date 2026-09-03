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

test('loading a truck bundle does not pay for it either', () => {
  const src = readFileSync(abs('src/orders.js'), 'utf8');
  const fn = src.slice(src.indexOf('export function fillTruckBundle('),
                       src.indexOf('function dispatchTruck('));
  assert(fn.length > 100, 'could not isolate fillTruckBundle - the guard needs updating');
  assert(!fn.includes('addCoins'),
    'fillTruckBundle pays coins per bundle; the whole load must be paid on the truck return');
  assert(!fn.includes('addXp'),
    'fillTruckBundle awards XP per bundle; the whole load must be paid on the truck return');
  const dispatch = src.slice(src.indexOf('function dispatchTruck('));
  assert(!dispatch.slice(0, dispatch.indexOf('\n}')).includes('addCoins'),
    'dispatchTruck pays at the bay; the payout must ride with the delivery instead');
  assert(dispatch.includes('arrivesAt'), 'dispatchTruck does not put the load on the road');
  assert(dispatch.includes('bonusMultiplier'),
    'the completion bonus is no longer carried by the departing truck');
});

test('a full boat casts off instead of paying at the dock', () => {
  const src = readFileSync(abs('src/boat.js'), 'utf8');
  const fn = src.slice(src.indexOf('export function claimBonus('));
  assert(fn.length > 100, 'could not isolate claimBonus - the guard needs updating');
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(!body.includes('addCoins'),
    'claimBonus pays at the dock; the payout must sail with the boat instead');
  assert(!body.includes('addXp'),
    'claimBonus awards XP at the dock; the payout must sail with the boat instead');
  assert(!body.includes('state.vouchers ='),
    'claimBonus hands vouchers over at the dock; they must sail with the boat instead');
  assert(body.includes('orders.addDelivery'), 'claimBonus does not put the boat to sea');
  assert(body.includes('rewardVouchers'),
    'the vouchers are not carried on the voyage record, so they would be re-rolled on arrival');
});

test('every vessel shares one delivery list, one clock and one collection path', () => {
  const orders = readFileSync(abs('src/orders.js'), 'utf8');
  const boat = readFileSync(abs('src/boat.js'), 'utf8');
  assert(orders.includes('export function addDelivery'),
    'orders.js does not expose addDelivery, so another module would need its own delivery list');
  // A second list is the failure this guards: three vessels, three arrival clocks, three
  // collection paths, and only one of them maintained.
  assert(!boat.includes('state.orders.deliveries'),
    'boat.js reaches into the delivery list directly instead of going through addDelivery');
  const collect = orders.slice(orders.indexOf('export function collectDelivery('));
  assert(collect.includes('rewardVouchers'),
    'collectDelivery ignores vouchers, so a docked boat would pay nothing for them');
});

test('a dig is worked, not instant: the tool goes in and the haul comes up later', () => {
  const src = readFileSync(abs('src/mine.js'), 'utf8');
  const digAt = src.slice(src.indexOf('export function digAt('), src.indexOf('export function collectDig('));
  assert(digAt.length > 100, 'could not isolate digAt - the guard needs updating');
  assert(!digAt.includes('storage.addOrPay'),
    'digAt puts ore in the barn on the spot; the haul must come up when the seam is worked');
  assert(!digAt.includes('museum.addArtifact'),
    'digAt hands the artifact over on the spot; it must come up with the haul');
  assert(digAt.includes('readyAt'), 'digAt does not start a timed dig');
  // Rolled at the swing, not at collection: otherwise a reload re-rolls a bad haul.
  assert(digAt.includes('weightedPick'), 'digAt no longer rolls the haul at the swing');
  const collect = src.slice(src.indexOf('export function collectDig('));
  assert(collect.includes('storage.addOrPay') && collect.includes('museum.addArtifact'),
    'collectDig does not actually deliver the haul');
  const main = readFileSync(abs('src/main.js'), 'utf8');
  assert(main.includes('mine.tick'), 'main.js never ticks the mine, so a seam finishes only while its panel is open');
});

test('a chest comes up locked, and what is inside was decided when it surfaced', () => {
  const src = readFileSync(abs('src/fishing.js'), 'utf8');
  const haul = src.slice(src.indexOf('function haulChest('), src.indexOf('export function pendingChest('));
  assert(haul.length > 100, 'could not isolate haulChest - the guard needs updating');
  assert(haul.includes('readyAt'), 'a chest is handed over unlocked, with no time to work it open');
  assert(haul.includes('loot'), 'the loot is not rolled and held when the chest surfaces');
  const open = src.slice(src.indexOf('export function openChest('));
  assert(!open.includes('rollChestLoot'),
    'openChest rolls fresh loot, so the wait could turn a good chest into a bad one');
  assert(open.includes('chest.loot') || open.includes('chest.loot || {}'),
    'openChest does not pay the loot the chest actually surfaced with');
  const main = readFileSync(abs('src/main.js'), 'utf8');
  assert(main.includes('fishing.tick'), 'main.js never ticks fishing, so a chest opens only while its panel is open');
});

test('every yield in the game is waited for - nothing hands goods over on the spot', () => {
  // The hand-written list is the point: a rule-shaped check would pass on a module that had
  // quietly grown a new instant payout, because it would never have looked for one.
  const WAITS = [
    ['src/shop.js', 'readyAt', 'the roadside stand'],
    ['src/orders.js', 'arrivesAt', 'the order board and the truck bay'],
    ['src/boat.js', 'addDelivery', 'the boat dock'],
    ['src/mine.js', 'readyAt', 'the mine'],
    ['src/fishing.js', 'readyAt', 'fishing'],
  ];
  for (const [file, needle, what] of WAITS) {
    const src = readFileSync(abs(file), 'utf8');
    assert(src.includes(needle), `${what} (${file}) no longer makes the player wait for its yield`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
