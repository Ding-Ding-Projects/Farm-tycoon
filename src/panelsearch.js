// panelsearch.js — one search bar, every panel.
//
// The game had no search field anywhere: 44 cards in the Bake Book, 43 in Achievements, 50 in the
// newspaper, a barn that grows past a hundred, and every one of them scanned by eye.
//
// The important decision here is WHERE this lives. Adding a filter to each render function would
// mean twenty-nine edits, twenty-nine chances to diverge, and a thirtieth panel next month with no
// search because whoever wrote it did not know to add one. So the bar is attached once, to the
// panel container, AFTER the panel has rendered - it filters the cards that are actually on screen
// rather than the data behind them. Every panel gets it, including ones not written yet, and there
// is one implementation to be correct rather than twenty-nine to keep in step.
//
// The cost of that choice, stated plainly: it can only match what a card DISPLAYS. A card showing
// "Cookie" cannot be found by typing "bakery" unless the card says bakery. That is a fair trade for
// a filter that cannot drift, and where a panel wants richer matching the fix is to put the missing
// word on the card - which helps a player reading it too.
//
// Plain text is the default and regex is an explicit opt-in, because most people typing in a search
// box mean the letters they typed. `a.b` should find "a.b" until somebody says otherwise.

const MIN_ITEMS = 6;                 // below this everything is on screen already; see attach()

// What was typed, per panel, so a re-render does not wipe it. refreshPanel() rebuilds the whole
// panel after every action - sell one item and the box, its toggles and the caret were gone. The
// query survives here until the panel is closed or another one opens (ui.js calls forget()).
const memory = new Map();

/** Drop the remembered query for one panel key, or for every panel when no key is given. */
export function forget(key) {
  if (key === undefined) memory.clear();
  else memory.delete(key);
}
const ITEM_SELECTOR = '.build-card, .order-card';

/**
 * Build a predicate from what the user typed. Pure, DOM-free and the only part of this file worth
 * testing hard, because it is where a bad pattern turns into either a crash or a silent match-all.
 *
 * Returns { ok, test, error }. On a bad pattern `ok` is false and `test` matches EVERYTHING rather
 * than nothing: a half-typed regex is a user mid-thought, and blanking their list at every
 * keystroke would make the mode unusable. The error is reported beside the field instead.
 */
export function makeMatcher(query, { regex = false, caseSensitive = false } = {}) {
  const q = String(query == null ? '' : query);
  if (!q.trim()) return { ok: true, empty: true, test: () => true, error: null };

  if (!regex) {
    const needle = caseSensitive ? q : q.toLowerCase();
    return {
      ok: true,
      empty: false,
      test: (text) => (caseSensitive ? String(text) : String(text).toLowerCase()).includes(needle),
      error: null,
    };
  }

  try {
    const re = new RegExp(q, caseSensitive ? '' : 'i');
    // A pattern with a global flag would carry lastIndex between calls and match every other card;
    // the flag is deliberately not offered, and this comment is here so nobody adds it as a feature.
    return { ok: true, empty: false, test: (text) => re.test(String(text)), error: null };
  } catch (err) {
    return { ok: false, empty: false, test: () => true, error: err.message };
  }
}

/** The tokens the builder offers, as [insert, label, explanation]. */
const TOKENS = [
  ['.', '.', 'any one character'],
  ['\\d', '\\d', 'a digit'],
  ['\\w', '\\w', 'a letter, digit or underscore'],
  ['\\s', '\\s', 'a space'],
  ['[abc]', '[ ]', 'any one of these'],
  ['[^abc]', '[^ ]', 'anything but these'],
  ['(a|b)', '( | )', 'either of these'],
  ['?', '?', 'the thing before it, optional'],
  ['+', '+', 'one or more of the thing before it'],
  ['*', '*', 'any number of the thing before it'],
  ['^', '^', 'the start'],
  ['$', '$', 'the end'],
];

/**
 * Attach a search bar to a rendered panel, if it has enough in it to be worth searching.
 *
 * The threshold is a rule rather than a per-panel judgement, which is the point: a filter that
 * appears on some lists and not others teaches a player that the pattern is unreliable, and then
 * they stop looking for it. Six is where a list stops fitting on screen at once, so below six
 * there is genuinely nothing to find.
 */
/**
 * The text of a card as a person reads it: no decorative icons, no runs of whitespace, trimmed.
 *
 * The icon matters more than it looks. Cards start with a badge in a `.icon` span, so the raw
 * textContent begins "⭐Cookie..." and an anchored pattern like `^Cookie` could never match
 * anything - the caret was always sitting in front of an emoji. Measured before this existed:
 * `^(Cookie|Ravioli)` found zero of forty-four cards that plainly contain both words.
 */
export function searchTextOf(item) {
  let text = '';
  for (const node of item.childNodes) {
    if (node.nodeType === 1 && node.classList && node.classList.contains('icon')) continue;
    if (node.nodeType === 1 && node.getAttribute && node.getAttribute('aria-hidden') === 'true') continue;
    text += ` ${node.textContent || ''}`;
  }
  return text.replace(/\s+/g, ' ').trim();
}

export function attach(container, { minItems = MIN_ITEMS, key = null } = {}) {
  const doc = container.ownerDocument;
  const items = [...container.querySelectorAll(ITEM_SELECTOR)];
  if (items.length < minItems) return null;

  // Computed once rather than per keystroke. A card's NAME does not change while the panel is
  // open; only its timers do, and nobody searches for "4m 12s". A re-render re-attaches, so this
  // cannot go stale in the way that would matter.
  const text = new Map(items.map((it) => [it, searchTextOf(it)]));

  const bar = doc.createElement('div');
  bar.className = 'panel-search';

  const field = doc.createElement('input');
  field.type = 'search';
  field.className = 'panel-search-input';
  field.placeholder = `Search ${items.length} items`;
  field.setAttribute('aria-label', 'Filter what this panel shows');

  const reBtn = doc.createElement('button');
  reBtn.type = 'button';
  reBtn.className = 'panel-search-toggle';
  reBtn.textContent = '.*';
  reBtn.title = 'Match with a regular expression instead of plain text';
  reBtn.setAttribute('aria-pressed', 'false');
  reBtn.setAttribute('aria-label', 'Use a regular expression');

  const caseBtn = doc.createElement('button');
  caseBtn.type = 'button';
  caseBtn.className = 'panel-search-toggle';
  caseBtn.textContent = 'Aa';
  caseBtn.title = 'Match upper and lower case exactly';
  caseBtn.setAttribute('aria-pressed', 'false');
  caseBtn.setAttribute('aria-label', 'Match case');

  const help = doc.createElement('button');
  help.type = 'button';
  help.className = 'panel-search-toggle';
  help.textContent = '?';
  help.title = 'Insert a pattern piece';
  help.setAttribute('aria-expanded', 'false');
  help.setAttribute('aria-label', 'Pattern pieces');
  help.hidden = true;                       // only meaningful once regex mode is on

  const count = doc.createElement('span');
  count.className = 'panel-search-count';
  count.setAttribute('aria-live', 'polite');

  // The builder, anchored to this field rather than to the app. It stays inside the panel so it
  // cannot end up floating over a surface that is no longer open.
  const palette = doc.createElement('div');
  palette.className = 'panel-search-palette';
  palette.hidden = true;
  for (const [insert, label, explain] of TOKENS) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'token';
    b.textContent = label;
    b.title = explain;
    b.setAttribute('aria-label', `${label} - ${explain}`);
    b.addEventListener('click', () => {
      const at = field.selectionStart == null ? field.value.length : field.selectionStart;
      const to = field.selectionEnd == null ? at : field.selectionEnd;
      field.value = field.value.slice(0, at) + insert + field.value.slice(to);
      // Put the caret INSIDE a bracket or group rather than after it, because that is where the
      // next thing the user types belongs.
      const inner = insert.indexOf('a') >= 0 ? at + insert.indexOf('a') : at + insert.length;
      field.focus();
      field.setSelectionRange(inner, insert.indexOf('a') >= 0 ? inner + 3 : inner);
      apply();
    });
    palette.appendChild(b);
  }

  bar.append(field, reBtn, caseBtn, help, count);
  const wrap = doc.createElement('div');
  wrap.className = 'panel-search-wrap';
  wrap.append(bar, palette);
  container.insertBefore(wrap, container.firstChild);

  let empty = null;

  function apply() {
    const useRe = reBtn.getAttribute('aria-pressed') === 'true';
    const cased = caseBtn.getAttribute('aria-pressed') === 'true';
    const m = makeMatcher(field.value, { regex: useRe, caseSensitive: cased });

    let shown = 0;
    for (const item of items) {
      const hit = m.test(text.get(item) || '');
      item.hidden = !hit;
      if (hit) shown += 1;
    }

    // A grid whose every card is hidden still draws its gaps, and a heading above nothing reads as
    // a section that lost its contents rather than one that was filtered out.
    for (const grid of container.querySelectorAll('.slot-grid')) {
      const kids = [...grid.querySelectorAll(ITEM_SELECTOR)];
      grid.hidden = kids.length > 0 && kids.every((k) => k.hidden);
    }

    bar.classList.toggle('invalid', !m.ok);
    if (!m.ok) {
      count.textContent = `not a pattern yet: ${m.error.replace(/^Invalid regular expression:?\s*/i, '')}`;
    } else if (m.empty) {
      count.textContent = `${items.length} items`;
    } else {
      count.textContent = `${shown} of ${items.length}`;
    }

    // An honest no-match message rather than a blank panel, which reads as something broken.
    if (!empty) {
      empty = doc.createElement('p');
      empty.className = 'minigame-hint panel-search-empty';
      wrap.appendChild(empty);
    }
    const none = m.ok && !m.empty && shown === 0;
    empty.hidden = !none;
    empty.textContent = none ? `Nothing here matches "${field.value}".` : '';
  }

  const setPressed = (btn, on) => {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) btn.classList.add('on'); else btn.classList.remove('on');
  };
  const toggle = (btn) => setPressed(btn, btn.getAttribute('aria-pressed') !== 'true');

  let focused = false;
  function remember() {
    if (key === null) return;
    memory.set(key, {
      value: field.value,
      regex: reBtn.getAttribute('aria-pressed') === 'true',
      cased: caseBtn.getAttribute('aria-pressed') === 'true',
      focused,
    });
  }
  const remembered = key === null ? null : memory.get(key);
  if (remembered) {
    field.value = remembered.value || '';
    setPressed(reBtn, !!remembered.regex);
    setPressed(caseBtn, !!remembered.cased);
    help.hidden = !remembered.regex;
  }

  field.addEventListener('focus', () => { focused = true; remember(); });
  field.addEventListener('blur', () => { focused = false; remember(); });
  field.addEventListener('input', () => { apply(); remember(); });
  field.addEventListener('keydown', (ev) => {
    // Escape clears rather than closing the panel, so a filter is never something the user has to
    // hunt for a way out of.
    if (ev.key === 'Escape' && field.value) {
      ev.stopPropagation();
      ev.preventDefault();
      field.value = '';
      apply();
    }
  });
  reBtn.addEventListener('click', () => {
    toggle(reBtn);
    const on = reBtn.getAttribute('aria-pressed') === 'true';
    help.hidden = !on;
    if (!on) { palette.hidden = true; help.setAttribute('aria-expanded', 'false'); }
    field.focus();
    apply();
    remember();
  });
  caseBtn.addEventListener('click', () => { toggle(caseBtn); field.focus(); apply(); remember(); });
  help.addEventListener('click', () => {
    palette.hidden = !palette.hidden;
    help.setAttribute('aria-expanded', palette.hidden ? 'false' : 'true');
  });

  apply();
  // Focus comes back to the box after a re-render only if it was there before it: a panel that
  // grabs focus on open fights the user, one that drops it mid-word loses their place.
  if (remembered && remembered.focused) { focused = true; field.focus(); }
  return { field, apply, items };
}
