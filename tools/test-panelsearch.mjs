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
import { makeMatcher, searchTextOf, attach, forget } from '../src/panelsearch.js';

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

// ---------------------------------------------------------------------------
// attach() remembers a query across a re-render
// ---------------------------------------------------------------------------
// refreshPanel() rebuilds the whole panel after every action, which used to wipe the box, its
// toggles and the caret. The smallest DOM that attach() needs: elements with children, classes,
// attributes, listeners, insertBefore and a comma-tolerant querySelectorAll.
function makeDoc() {
  const focused = [];
  function element(tag) {
    const listeners = {};
    const node = {
      tagName: tag, nodeType: 1, className: '', textContent: '', hidden: false, value: '',
      children: [], childNodes: [], parentNode: null, attributes: {}, ownerDocument: null,
      selectionStart: null, selectionEnd: null,
      classList: {
        add(...c) { const s = new Set(node.className.split(/\s+/).filter(Boolean)); c.forEach((x) => s.add(x)); node.className = [...s].join(' '); },
        remove(...c) { node.className = node.className.split(/\s+/).filter((x) => x && !c.includes(x)).join(' '); },
        contains(c) { return node.className.split(/\s+/).includes(c); },
        toggle(c, force) { const on = force === undefined ? !node.classList.contains(c) : !!force; if (on) node.classList.add(c); else node.classList.remove(c); return on; },
      },
      setAttribute(k, v) { node.attributes[k] = String(v); },
      getAttribute(k) { return k in node.attributes ? node.attributes[k] : null; },
      appendChild(child) { node.children.push(child); node.childNodes.push(child); child.parentNode = node; return child; },
      append(...kids) { kids.forEach((k) => node.appendChild(k)); },
      insertBefore(child, ref) { const i = node.children.indexOf(ref); if (i === -1) return node.appendChild(child); node.children.splice(i, 0, child); node.childNodes.splice(i, 0, child); child.parentNode = node; return child; },
      get firstChild() { return node.children[0] || null; },
      querySelectorAll(sel) {
        const wanted = sel.split(',').map((s) => s.trim().replace(/^\./, ''));
        const out = [];
        (function walk(n) { for (const c of n.children) { if (wanted.some((w) => c.classList.contains(w))) out.push(c); walk(c); } })(node);
        return out;
      },
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
      dispatchEvent(evt) { for (const fn of listeners[evt.type] || []) fn(evt); return true; },
      click() { node.dispatchEvent({ type: 'click' }); },
      focus() { focused.push(node); node.dispatchEvent({ type: 'focus' }); },
      setSelectionRange() {},
    };
    return node;
  }
  const doc = { createElement: (tag) => { const n = element(tag); n.ownerDocument = doc; return n; }, focused };
  return doc;
}

/** A panel with `n` cards named Card 1..n, the way renderPanelContent leaves one. */
function panel(doc, n = 8) {
  const container = doc.createElement('div');
  container.ownerDocument = doc;
  const grid = doc.createElement('div'); grid.classList.add('slot-grid');
  for (let i = 1; i <= n; i++) {
    const card = doc.createElement('div'); card.classList.add('build-card');
    const label = doc.createElement('strong'); label.textContent = i === 3 ? 'Oak Tree' : `Card ${i}`;
    card.appendChild(label);
    grid.appendChild(card);
  }
  container.appendChild(grid);
  return container;
}

test('a query, its toggles and its focus survive a re-render of the same panel; another panel starts clean', () => {
  forget();
  const doc = makeDoc();
  const first = attach(panel(doc), { key: 'workshop' });
  assert.ok(first, 'eight cards is enough to search');
  first.field.value = 'oak';
  first.field.dispatchEvent({ type: 'input' });
  first.field.focus();
  const reBtn = first.field.parentNode.querySelectorAll('.panel-search-toggle')[0];
  reBtn.click();                                    // regex on
  assert.equal(first.items.filter((it) => !it.hidden).length, 1, 'the filter is live before the re-render');

  const again = attach(panel(doc), { key: 'workshop' });   // refreshPanel() rebuilt the panel
  assert.equal(again.field.value, 'oak', 'the query came back');
  assert.equal(again.field.parentNode.querySelectorAll('.panel-search-toggle')[0].getAttribute('aria-pressed'), 'true', 'so did regex mode');
  assert.equal(again.items.filter((it) => !it.hidden).length, 1, 'and it is applied to the new cards');
  assert.ok(doc.focused.includes(again.field), 'focus went back to the box because it was there before');

  const other = attach(panel(doc), { key: 'settings' });
  assert.equal(other.field.value, '', 'a different panel does not inherit the query');

  forget('workshop');
  const cleared = attach(panel(doc), { key: 'workshop' });
  assert.equal(cleared.field.value, '', 'forget() drops it (closePanel/openPanel call this)');
  assert.equal(cleared.items.filter((it) => !it.hidden).length, 8);
});

test('attach() without a key remembers nothing, so a nameless caller can never leak a query', () => {
  forget();
  const doc = makeDoc();
  const a = attach(panel(doc));
  a.field.value = 'zzz';
  a.field.dispatchEvent({ type: 'input' });
  const b = attach(panel(doc));
  assert.equal(b.field.value, '');
});

test('renderPanelContent attaches the bar, so every panel gets one from a single line', () => {
  const src = fs.readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const start = src.indexOf('function renderPanelContent');
  assert.ok(start !== -1, 'expected a renderPanelContent in ui.js');
  const body = src.slice(start, start + 8000);
  // Anchored to the start of a line so a commented-out call cannot satisfy it. A plain
  // includes('panelsearch.attach(') would pass on "// panelsearch.attach(container);", which is
  // exactly how this wiring would most likely die - somebody disabling it while debugging.
  // The call may carry an options object (the per-panel key that keeps a query across re-renders).
  assert.match(body, /^\s*panelsearch\.attach\(container(?:,\s*\{[^}]*\})?\);/m,
    'renderPanelContent must call panelsearch.attach(container) on a live line - losing it removes '
    + 'search from every panel at once, with nothing on screen to say so');
  assert.match(src, /^import \* as panelsearch from '\.\/panelsearch\.js';$/m);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
