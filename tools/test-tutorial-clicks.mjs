// test-tutorial-clicks.mjs - the coach card's buttons must survive the frame loop.
//
// The poke guy this exists to stop was invisible to every other suite. checkAutoEvents() runs on
// every animation frame and, for any step anchored to a world object, called render(). render()
// rewrote bubble.innerHTML, so the Next and Skip buttons were destroyed and recreated about sixty
// times a second. A pointerdown and the pointerup after it then landed on two different DOM
// nodes, the browser generated no click event at all, and both buttons silently did nothing -
// measured in the real Electron build as 1 of 6 clicks landing, against 6 of 6 once fixed.
//
// Nothing about that is visible in a screenshot, in the hit test (the button IS the topmost
// element), or in a unit test that calls advance() directly. It is only visible to a real click,
// so the guard has to be about the code shape: render() may reposition freely, but it must not
// rebuild the markup unless the step actually changed.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  - ${name}`); }
  catch (err) { failures.push({ name, err }); console.log(`FAIL  - ${name}`); console.log(`        ${err.message}`); }
}

const tutorial = readFileSync(new URL('../src/tutorial.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('../src/desktop.js', import.meta.url), 'utf8');

console.log('\nTutorial card clickability\n');

// Everything from `function render()` to the next top-level `function ` declaration. Brace
// counting rather than a lazy [\s\S]*? run, which would sail straight past the closing brace.
function bodyOf(source, header) {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `${header} must exist`);
  let depth = 0, i = source.indexOf('{', start);
  const open = i;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) return source.slice(open, i + 1); }
  }
  throw new Error(`unbalanced braces in ${header}`);
}

const renderBody = bodyOf(tutorial, 'function render()');
const paintBody = bodyOf(tutorial, 'function paintBubble(');

test('the markup is built in paintBubble, not in render', () => {
  assert.match(paintBody, /bubble\.innerHTML\s*=/, 'paintBubble must be the one that writes the markup');
  assert.doesNotMatch(renderBody, /bubble\.innerHTML\s*=/,
    'render() runs every frame for world-anchored steps; writing innerHTML there destroys the buttons mid-click');
});

test('render only repaints when the step actually changed', () => {
  assert.match(renderBody, /if \(paintedIndex !== currentIndex\) paintBubble\(/,
    'the repaint must be guarded by a step-change check');
});

test('paintBubble records which step it painted, or the guard never closes', () => {
  assert.match(paintBody, /^\s*paintedIndex = currentIndex;/m,
    'without this the guard is true forever and the buttons are rebuilt every frame again');
});

test('hiding the overlay forgets the painted step, so a restart repaints', () => {
  assert.match(renderBody, /overlay\.hidden = true;\s*\n\s*paintedIndex = -1;/,
    'a tutorial restarted after finishing must not reuse the last step\'s markup');
});

test('both buttons are wired inside paintBubble', () => {
  assert.match(paintBody, /#tutorial-next'\)\.addEventListener\('click'/, 'Next must be wired where it is created');
  assert.match(paintBody, /#tutorial-skip'\)\.addEventListener\('click'/, 'Skip must be wired where it is created');
});

test('the sheet panel sits above the tutorial spotlight', () => {
  // The spotlight paints a 9999px dark ring around its hole. A sheet below it is dimmed by the
  // very step that told the player to open it, and reads as disabled.
  const overlay = css.match(/\.tutorial-overlay\s*\{[^}]*z-index:\s*(\d+)/);
  const sheet = css.match(/\.sheet-panel\s*\{[^}]*z-index:\s*(\d+)/);
  assert.ok(overlay, '.tutorial-overlay must declare a z-index');
  assert.ok(sheet, '.sheet-panel must declare a z-index');
  assert.ok(Number(sheet[1]) > Number(overlay[1]),
    `sheet z-index ${sheet && sheet[1]} must exceed tutorial overlay ${overlay && overlay[1]}`);
});

test('a modal still outranks the sheet, so a decision is never covered', () => {
  const sheet = Number(css.match(/\.sheet-panel\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  const modal = Number(css.match(/\.modal-backdrop\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  assert.ok(modal > sheet, `modal ${modal} must outrank sheet ${sheet}`);
});

test('the desktop title bar does not sit on top of the HUD', () => {
  // body.is-desktop adds 34px of padding, which moves normal flow and NOT position:fixed. Only
  // #world was compensated, so the bar covered 28px of the level badge and 21px of every pill in
  // the built app - and the badge's top is a drag region, so a click there moved the window.
  assert.match(css, /^body[.]is-desktop [.]hud-top \{ top: 34px; \}/m,
    'the HUD strip must be shifted below the title bar in the Electron build');
  assert.match(css, /^body[.]is-desktop [.]event-banner \{ top: 130px;/m,
    'and the event banner must clear the shifted HUD');
});

test('the radial ring is clamped into the viewport', () => {
  const body = bodyOf(ui, 'export function openRadial(');
  assert.ok(body.includes('screenX = Math.max(margin, Math.min(vw - margin, screenX));'),
    'an unclamped ring throws options off-screen and drops onto the dock');
  assert.ok(body.includes('screenY = Math.max(margin, Math.min(vh - margin - 40, screenY));'),
    'the vertical clamp must also leave room for the label strip');
});

test('the radial ring declares its own z-index rather than relying on DOM order', () => {
  const radial = css.match(/[.]radial-menu \{[^}]*z-index:\s*(\d+)/);
  assert.ok(radial, '.radial-menu must declare a z-index');
  const modal = Number(css.match(/[.]modal-backdrop\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  assert.ok(Number(radial[1]) < modal, `ring ${radial[1]} must stay below a modal ${modal}`);
});

test('the update banner is lifted clear of the dock instead of covering it', () => {
  // Both are anchored bottom-right and the banner's z-index (9100) is above everything, so while
  // an update was ready it sat on the dock's buttons and took their clicks.
  const body = bodyOf(desktop, 'function initUpdates(');
  assert.ok(body.includes('function placeBanner()'), 'the banner must position itself against the dock');
  assert.ok(body.includes("document.querySelector('.dock')"),
    'it must measure the real dock: its height changes with the safe-area inset and unlocked buttons');
  assert.match(body, /^\s*banner\.hidden = false;\s*\n\s*placeBanner\(\);/m,
    'every path that reveals the banner must place it, or it shows at the old position first');
  assert.ok(body.includes("window.addEventListener('resize', placeBanner)"),
    'a resize moves the dock, so the banner has to follow');
});

test('a later update state cancels the error auto-hide timer', () => {
  // Squirrel emits a noisy error from the check subprocess and then succeeds, so the real order is
  // error -> ready. Without this, the error's eight-second timer wiped the ready banner: title
  // said "Update 0.1.89 ready", Restart was visible, hidden was true. Measured on a real upgrade.
  const body = bodyOf(desktop, 'function initUpdates(');
  assert.ok(body.includes('const clearHide ='), 'the timer must be cancellable');
  assert.match(body, /^\s*const state = s && s\.state;\s*\n\s*clearHide\(\);/m,
    'every incoming state must cancel the previous state\'s timer, before anything else');
  assert.ok(body.includes('hideTimer = setTimeout('),
    'the auto-hide must be stored in the handle it is cancelled through');
  assert.ok(!/(?<!hideTimer = )setTimeout\(\(\) => \{ banner\.hidden = true; \}/.test(body),
    'no un-cancellable auto-hide may remain');
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
