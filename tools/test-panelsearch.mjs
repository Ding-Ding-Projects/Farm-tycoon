// test-panelsearch.mjs — the search bar every panel gets.
//
// Two things are worth pinning here and they are different in kind.
//
// The first is makeMatcher, which is pure and is where a mistake turns into either a crash on a
// half-typed pattern or, far worse, a filter that silently matches everything. The invalid-pattern
// case is the one that matters most: it must match EVERYTHING rather than nothing, because a
// person mid-keystroke has not made an error yet, and blanking their list on every character would
// make regex mode unusable. That behaviour looks like a bug unless somebody wrote down that it is
// deliberate, so it is asserted rather than left to a comment.
//
// The second is that the bar is attached at all. It is wired in ONE place - the end of
// renderPanelContent - and that is the whole design: twenty-nine per-panel copies would be
// twenty-nine chances to diverge. One wiring line is cheap to guard and catastrophic to lose,
// because losing it removes search from every panel at once with nothing on screen to say so.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeMatcher, searchTextOf } from '../src/panelsearch.js';

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

console.log('\nPanel search\n');

// ---------------------------------------------------------------------------
// makeMatcher
// ---------------------------------------------------------------------------

test('an empty query matches everything and says so', () => {
  for (const q of ['', '   ', null, undefined]) {
    const m = makeMatcher(q);
    assert.equal(m.ok, true);
    assert.equal(m.empty, true, `${JSON.stringify(q)} should read as no query at all`);
    assert.equal(m.test('anything'), true);
  }
});

test('plain text is a substring match, and ignores case unless told otherwise', () => {
  const m = makeMatcher('cake');
  assert.equal(m.test('Carrot Cake'), true);
  assert.equal(m.test('CARROT CAKE'), true);
  assert.equal(m.test('Cookie'), false);

  const cased = makeMatcher('Cake', { caseSensitive: true });
  assert.equal(cased.test('Carrot Cake'), true);
  assert.equal(cased.test('carrot cake'), false);
});

test('plain text is NOT a pattern - the characters mean themselves', () => {
  // The whole reason plain is the default. Someone typing "a.b" means a dot.
  const m = makeMatcher('a.b');
  assert.equal(m.test('a.b'), true);
  assert.equal(m.test('axb'), false, 'a dot in plain mode must not match any character');

  const starred = makeMatcher('lv 8*');
  assert.equal(starred.test('lv 8*'), true);
  assert.equal(starred.test('lv 8'), false, 'a star in plain mode is a star');
});

test('regex mode is an explicit opt-in and then the pattern is a pattern', () => {
  const m = makeMatcher('a.b', { regex: true });
  assert.equal(m.test('axb'), true);
  assert.equal(m.test('a.b'), true);

  const anchored = makeMatcher('^Cookie', { regex: true });
  assert.equal(anchored.test('Cookie Bakery'), true);
  assert.equal(anchored.test('Chewy Cookie'), false);

  const alt = makeMatcher('(Cookie|Ravioli)$', { regex: true });
  assert.equal(alt.test('one Ravioli'), true);
  assert.equal(alt.test('Ravioli plate'), false);
});

test('regex mode honours the case toggle too', () => {
  assert.equal(makeMatcher('cookie', { regex: true }).test('COOKIE'), true);
  assert.equal(makeMatcher('cookie', { regex: true, caseSensitive: true }).test('COOKIE'), false);
});

test('a half-typed pattern matches EVERYTHING, never nothing, and reports why', () => {
  // NOT in this list, and it surprised me into a failing test: `a{2,` is a perfectly valid
  // JavaScript regex. An unterminated quantifier is treated as the literal characters `{2,` in
  // non-unicode mode, so it compiles and matches "a{2," rather than erroring. The engine decides
  // what is invalid, not intuition.
  for (const q of ['(', '[', '\\', '(?<']) {
    const m = makeMatcher(q, { regex: true });
    assert.equal(m.ok, false, `${q} should be reported as not a pattern yet`);
    assert.ok(m.error && m.error.length, 'an unusable pattern must say what is wrong');
    assert.equal(m.test('literally anything'), true,
      'a pattern mid-typing must not blank the list - the user has not made a mistake yet, and a '
      + 'panel that empties on every keystroke cannot be typed into');
  }
});

test('no global flag, so a matcher can be reused across every card', () => {
  // A /g regex carries lastIndex between calls and would match every OTHER card. The flag is
  // deliberately not offered; this proves reuse is safe rather than trusting the comment.
  const m = makeMatcher('a', { regex: true });
  for (let i = 0; i < 6; i++) assert.equal(m.test('cake'), true, `call ${i + 1} disagreed with the first`);
});

test('a matcher never throws, whatever it is handed', () => {
  const m = makeMatcher('cake');
  for (const v of ['', null, undefined, 0, 123, {}, []]) {
    assert.doesNotThrow(() => m.test(v), `test(${JSON.stringify(v)}) threw`);
  }
});

// ---------------------------------------------------------------------------
// searchTextOf
// ---------------------------------------------------------------------------

/** The smallest node shape searchTextOf actually reads. */
function node(tag, text, cls = '', attrs = {}) {
  return {
    nodeType: 1,
    tagName: tag,
    textContent: text,
    classList: { contains: (c) => cls.split(' ').includes(c) },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
  };
}
function card(children) { return { childNodes: children }; }

test('decorative icons are not searchable text', () => {
  // This is the bug it was written for: cards begin with a badge, so the raw textContent starts
  // "⭐Cookie" and ^Cookie could never match. Measured live: zero of forty-four cards.
  const c = card([
    node('SPAN', '⭐', 'icon'),
    node('STRONG', 'Cookie'),
    node('SPAN', 'Bakery · lv 8', 'minigame-hint'),
  ]);
  const text = searchTextOf(c);
  assert.equal(text, 'Cookie Bakery · lv 8');
  assert.ok(makeMatcher('^Cookie', { regex: true }).test(text),
    'an anchored pattern must be able to reach the first word a person actually reads');
  assert.ok(!text.includes('⭐'));
});

test('anything hidden from assistive technology is hidden from search too', () => {
  const c = card([
    node('SPAN', 'decorative', '', { 'aria-hidden': 'true' }),
    node('STRONG', 'Ravioli'),
  ]);
  assert.equal(searchTextOf(c), 'Ravioli');
});

test('whitespace is collapsed, so a pattern is written the way the card reads', () => {
  const c = card([node('STRONG', '  Carrot\n\n   Cake  '), node('SPAN', '\t lv 23 ')]);
  assert.equal(searchTextOf(c), 'Carrot Cake lv 23');
});

test('text nodes with no class or attributes are kept', () => {
  const c = card([{ nodeType: 3, textContent: 'loose text' }, node('STRONG', 'Cookie')]);
  assert.equal(searchTextOf(c), 'loose text Cookie');
});

// ---------------------------------------------------------------------------
// The wiring
// ---------------------------------------------------------------------------

test('renderPanelContent attaches the bar, so every panel gets one from a single line', () => {
  const src = fs.readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const start = src.indexOf('function renderPanelContent');
  assert.ok(start !== -1, 'expected a renderPanelContent in ui.js');
  const body = src.slice(start, start + 8000);
  // Anchored to the start of a line so a commented-out call cannot satisfy it. A plain
  // includes('panelsearch.attach(') would pass on "// panelsearch.attach(container);", which is
  // exactly how this wiring would most likely die - somebody disabling it while debugging.
  assert.match(body, /^\s*panelsearch\.attach\(container\);/m,
    'renderPanelContent must call panelsearch.attach(container) on a live line - losing it removes '
    + 'search from every panel at once, with nothing on screen to say so');
  assert.match(src, /^import \* as panelsearch from '\.\/panelsearch\.js';$/m);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
