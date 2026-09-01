/* ============================================================================
 * Farm Tycoon documentation — application shell.
 *
 * Plain ES modules, no build step, no framework, no dependency, and no request
 * that leaves this origin. Everything below runs in the browser exactly as it
 * is committed.
 *
 * ----------------------------------------------------------------------------
 * THE ARTICLE CONTRACT  (authors of ./content/*.js: this is the whole of it)
 * ----------------------------------------------------------------------------
 *
 * Every content module exports one named binding called `article`:
 *
 *   export const article = {
 *     id: 'unique-kebab-id',        // REQUIRED. Unique across the whole site.
 *                                   //   It is the URL: #/unique-kebab-id
 *     title: 'Human Title',         // REQUIRED. Tab label and page heading.
 *     group: 'Group Name',          // REQUIRED. Tabs are grouped by this
 *                                   //   string; groups appear in the order
 *                                   //   their first article is imported.
 *     summary: 'One sentence.',     // REQUIRED. Shown under the title, on the
 *                                   //   home page, and in search results.
 *     sections: [                   // REQUIRED. One or more.
 *       {
 *         id: 'section-id',         //   REQUIRED, unique WITHIN the article.
 *                                   //     It is the deep link:
 *                                   //     #/unique-kebab-id/section-id
 *         heading: 'Heading',       //   REQUIRED. Rendered as an <h2>.
 *         html: '<p>...</p>',       //   REQUIRED. Ordinary HTML, inserted as
 *                                   //     the section body.
 *       },
 *     ],
 *     related: ['other-article-id'],// OPTIONAL. Ids of articles to suggest at
 *                                   //   the end. Unknown ids are ignored; when
 *                                   //   none resolve, the shell substitutes
 *                                   //   the rest of the group so a reader is
 *                                   //   never left at a dead end.
 *   };
 *
 * Notes for authors:
 *
 *  - `html` is inserted with innerHTML and is NOT sanitised. These modules are
 *    first-party source in this repository; write trusted markup only, and
 *    never interpolate anything a reader supplied.
 *  - Use ordinary elements. The stylesheet already handles h2/h3/h4, p, ul, ol,
 *    table, pre, code, kbd, blockquote, hr and img. Tables are automatically
 *    wrapped in a horizontally scrolling container, so a wide table never makes
 *    the page scroll sideways.
 *  - Extra classes available to you: `.callout` plus one of `.callout-info`,
 *    `.callout-warn`, `.callout-ok`, `.callout-danger`; `.stat-row` containing
 *    `.stat` blocks with `.stat-num` and `.stat-label`.
 *  - Link between articles with ordinary anchors: <a href="#/farming">…</a> or
 *    <a href="#/farming/crops">…</a>. The router handles them.
 *  - The ONLY links that may leave this site are installer and release
 *    downloads, and those live in the shell's own Download article. Do not link
 *    out to a code host for the plan, the handoff, the roadmap, the changelog,
 *    source browsing or issues — that material belongs in the site itself.
 *  - Headings you write inside `html` should start at <h3>: the section's own
 *    `heading` is the <h2>.
 *  - A module that fails to load, or whose `article` is malformed, is reported
 *    on the Settings page and skipped. It never takes the site down.
 *
 * ==========================================================================*/

/* ---------------------------------------------------------------------------
 * 1. Content registry
 * ------------------------------------------------------------------------ */

/** Import paths, in the order their groups should appear. */
const CONTENT_PATHS = [
  './content/getting-started.js',
  './content/farming.js',
  './content/crafting.js',
  './content/logistics.js',
  './content/township.js',
  './content/exploration.js',
  './content/social.js',
  './content/deadtime.js',
  './content/architecture.js',
  './content/changelog.js',
];

/** Problems found while loading content. Surfaced on the Settings page. */
const contentProblems = [];

/** Every article the site knows about, in tab order. */
let articles = [];
/** id -> article */
const byId = new Map();

function validateArticle(raw, path) {
  const problems = [];
  if (!raw || typeof raw !== 'object') {
    problems.push('the module did not export an `article` object');
    return { problems };
  }
  const a = {
    id: typeof raw.id === 'string' ? raw.id.trim() : '',
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    group: typeof raw.group === 'string' ? raw.group.trim() : '',
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
    sections: [],
    related: Array.isArray(raw.related) ? raw.related.filter((r) => typeof r === 'string') : [],
    source: path,
  };
  if (!a.id) problems.push('`id` is missing or is not a string');
  if (!a.title) problems.push('`title` is missing or is not a string');
  if (!a.group) problems.push('`group` is missing or is not a string');
  if (!a.summary) problems.push('`summary` is missing or is not a string');

  if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
    problems.push('`sections` is missing or empty');
  } else {
    const seen = new Set();
    raw.sections.forEach((s, i) => {
      if (!s || typeof s !== 'object') {
        problems.push('section ' + (i + 1) + ' is not an object');
        return;
      }
      const id = typeof s.id === 'string' ? s.id.trim() : '';
      const heading = typeof s.heading === 'string' ? s.heading.trim() : '';
      const html = typeof s.html === 'string' ? s.html : '';
      if (!id) problems.push('section ' + (i + 1) + ' has no `id`');
      else if (seen.has(id)) problems.push('section id "' + id + '" is used more than once');
      if (!heading) problems.push('section "' + (id || i + 1) + '" has no `heading`');
      if (!html) problems.push('section "' + (id || i + 1) + '" has no `html`');
      if (id && heading && html) {
        seen.add(id);
        a.sections.push({ id, heading, html });
      }
    });
  }
  if (a.sections.length === 0) problems.push('no usable sections remain');
  return { article: problems.length === 0 ? a : null, problems };
}

async function loadContent() {
  const loaded = [];
  for (const path of CONTENT_PATHS) {
    let mod;
    try {
      mod = await import(path);
    } catch (err) {
      contentProblems.push({
        path,
        kind: 'missing',
        detail: 'the module could not be loaded (' + (err && err.message ? err.message : String(err)) + ')',
      });
      continue;
    }
    const raw = mod.article !== undefined ? mod.article : mod.default;
    const { article, problems } = validateArticle(raw, path);
    if (article) {
      if (byId.has(article.id)) {
        contentProblems.push({ path, kind: 'duplicate', detail: 'the id "' + article.id + '" is already in use' });
        continue;
      }
      byId.set(article.id, article);
      loaded.push(article);
    } else {
      contentProblems.push({ path, kind: 'invalid', detail: problems.join('; ') });
    }
  }
  return loaded;
}

/* ---------------------------------------------------------------------------
 * 2. Small helpers
 * ------------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function icon(name, cls = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + name);
  svg.appendChild(use);
  return svg;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

const prefersReducedMotion = () =>
  document.documentElement.dataset.motion === 'reduce' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

/* ---------------------------------------------------------------------------
 * 3. Storage — every read and write survives a private window or blocked
 *    site data, and the Settings page reports which state we are in.
 * ------------------------------------------------------------------------ */

const STORE_PREFIX = 'farm-tycoon-docs:';

const store = {
  available: false,
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(STORE_PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  },
  remove(key) {
    try { window.localStorage.removeItem(STORE_PREFIX + key); return true; } catch (_) { return false; }
  },
};

try {
  const probe = STORE_PREFIX + '__probe';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
  store.available = true;
} catch (_) {
  store.available = false;
}

/* ---------------------------------------------------------------------------
 * 4. Colour utilities
 * ------------------------------------------------------------------------ */

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const p = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return '#' + p(r) + p(g) + p(b);
}

function rgbToHsv({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb({ h, s, v }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; }
  else if (h < 120) { rr = x; gg = c; }
  else if (h < 180) { gg = c; bb = x; }
  else if (h < 240) { gg = x; bb = c; }
  else if (h < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  return { r: (rr + m) * 255, g: (gg + m) * 255, b: (bb + m) * 255 };
}

function rgbToHsl({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; }
  else if (h < 120) { rr = x; gg = c; }
  else if (h < 180) { gg = c; bb = x; }
  else if (h < 240) { gg = x; bb = c; }
  else if (h < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  return { r: (rr + m) * 255, g: (gg + m) * 255, b: (bb + m) * 255 };
}

function relLuminance({ r, g, b }) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  if (!a || !b) return 1;
  const la = relLuminance(a), lb = relLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function shift(hex, deltaLightness) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  hsl.l = clamp(hsl.l + deltaLightness, 0, 1);
  return rgbToHex(hslToRgb(hsl));
}

function mix(hexA, hexB, amount) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

/* ---------------------------------------------------------------------------
 * 5. Settings model — one definition list drives the Settings page, the
 *    command palette and the persisted state.
 * ------------------------------------------------------------------------ */

const FONT_STACKS = {
  nunito: "'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif",
  baloo: "'Baloo 2', 'Nunito', system-ui, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  mono: "ui-monospace, 'Cascadia Mono', 'SFMono-Regular', Consolas, monospace",
};

const SETTINGS = [
  {
    key: 'theme', group: 'Appearance', label: 'Theme', def: 'system', type: 'segmented',
    keywords: 'dark light night colour scheme contrast',
    desc: 'Light, dark, or whatever this device is currently set to.',
    help: 'Both schemes are designed separately rather than one being an inverted copy of the ' +
          'other: the dark scheme uses a warm low-chroma brown rather than a neutral grey, so ' +
          'the parchment character survives. "System" follows your operating system setting and ' +
          'changes live when that changes.',
    options: [
      { v: 'light', l: 'Light', icon: 'ui-sun' },
      { v: 'dark', l: 'Dark', icon: 'ui-moon' },
      { v: 'system', l: 'System', icon: 'ui-monitor' },
    ],
  },
  {
    key: 'accent', group: 'Appearance', label: 'Accent colour', def: '#427d12', type: 'color',
    keywords: 'colour color accent hue picker spectrum hex rgb hsl contrast',
    desc: 'The colour used for links, the selected tab, buttons and focus rings.',
    help: 'Pick any colour from the spectrum, or type an exact value as hex, RGB or HSL — the ' +
          'three notations stay in step. One colour has to work on a cream page and on a dark ' +
          'brown one, so when your choice would leave link text below 4.5:1 in the scheme you ' +
          'are currently in, the site lightens or darkens it just far enough to clear that bar ' +
          'and keeps the hue. It tells you when it has: the readout names the colour you chose, ' +
          'the colour actually being rendered, and the real measured ratios. Reset restores the ' +
          'farm green, which needs no adjustment in either scheme.',
  },
  {
    key: 'fontFamily', group: 'Appearance', label: 'Reading typeface', def: 'nunito', type: 'select',
    keywords: 'font typeface family serif mono system nunito baloo',
    desc: 'The typeface used for body text and interface labels.',
    help: 'Nunito and Baloo 2 are vendored into this site, so they load from this origin and ' +
          'work offline. The system, serif and monospace choices use faces already installed on ' +
          'your device. Headings keep Baloo 2 whichever body face you choose.',
    options: [
      { v: 'nunito', l: 'Nunito (default)' },
      { v: 'baloo', l: 'Baloo 2' },
      { v: 'system', l: 'System sans-serif' },
      { v: 'serif', l: 'Serif' },
      { v: 'mono', l: 'Monospace' },
    ],
  },
  {
    key: 'fontSize', group: 'Appearance', label: 'Base text size', def: 16, type: 'range',
    min: 14, max: 22, step: 1, unit: 'px',
    keywords: 'font size text bigger smaller zoom scale',
    desc: 'The size everything else is measured from.',
    help: 'Every type size in the site is derived from this one number, so headings, labels and ' +
          'captions scale in proportion rather than drifting apart. Your browser zoom still ' +
          'works on top of it.',
  },
  {
    key: 'density', group: 'Appearance', label: 'Density', def: 'comfortable', type: 'segmented',
    keywords: 'density spacing compact cosy comfortable padding',
    desc: 'How much breathing room sits around controls and rows.',
    help: 'This changes spacing and row heights only, never text size. Compact keeps touch ' +
          'targets at the minimum size that is still comfortable to hit.',
    options: [
      { v: 'comfortable', l: 'Comfortable' },
      { v: 'cosy', l: 'Cosy' },
      { v: 'compact', l: 'Compact' },
    ],
  },
  {
    key: 'dock', group: 'Layout', label: 'Tab strip position', def: 'left', type: 'segmented',
    keywords: 'tabs dock left right top bottom strip navigation position',
    desc: 'Which edge the tab strip is attached to.',
    help: 'A screen is wider than it is tall and a tab label is wider than it is high, so a ' +
          'vertical strip shows more tabs legibly than a horizontal one — which is why left is ' +
          'the default rather than the top edge browsers trained us to expect. Labels are never ' +
          'rotated to fit; on medium widths the vertical strip drops to icons instead, and below ' +
          '720px the strip becomes a drawer whichever edge you chose.',
    options: [
      { v: 'left', l: 'Left', icon: 'ui-dock-left' },
      { v: 'top', l: 'Top', icon: 'ui-dock-top' },
      { v: 'right', l: 'Right', icon: 'ui-dock-right' },
      { v: 'bottom', l: 'Bottom', icon: 'ui-dock-bottom' },
    ],
  },
  {
    key: 'motion', group: 'Reading', label: 'Motion', def: 'system', type: 'segmented',
    keywords: 'motion animation reduce accessibility vestibular smooth scroll',
    desc: 'Whether the site animates transitions and smooth-scrolls.',
    help: 'If your operating system already asks for reduced motion, this site honours that ' +
          'without you setting anything here. "Always reduce" is for the case where you want it ' +
          'here but not everywhere. Nothing in this site depends on motion to convey meaning.',
    options: [
      { v: 'system', l: 'Follow system' },
      { v: 'reduce', l: 'Always reduce' },
    ],
  },
  {
    key: 'rememberRegex', group: 'Reading', label: 'Remember regular expression mode', def: false, type: 'switch',
    keywords: 'regex regular expression search mode remember sticky',
    desc: 'Keep regular expression search switched on between visits.',
    help: 'Plain text is always the default for a fresh visit, because a stray bracket in a ' +
          'plain query should never be read as a pattern. Turn this on and the search field ' +
          'reopens in whichever mode you left it.',
  },
  {
    key: 'toastSeconds', group: 'Notifications', label: 'Notification dwell time', def: 7, type: 'range',
    min: 3, max: 20, step: 1, unit: 's',
    keywords: 'toast notification duration dismiss time',
    desc: 'How long an informational notification stays before it dismisses itself.',
    help: 'Warnings and errors ignore this and stay until you dismiss them, because a message ' +
          'reporting a failure should not disappear before it has been read. Every notification, ' +
          'dismissed or not, is kept in the history behind the bell in the top bar for the rest ' +
          'of this visit.',
  },
];

const settingByKey = new Map(SETTINGS.map((s) => [s.key, s]));

const state = {};
for (const s of SETTINGS) {
  const saved = store.get('setting:' + s.key, undefined);
  state[s.key] = saved === undefined ? s.def : coerceSetting(s, saved);
}

function coerceSetting(def, value) {
  if (def.type === 'range') {
    const n = Number(value);
    return Number.isFinite(n) ? clamp(n, def.min, def.max) : def.def;
  }
  if (def.type === 'switch') return value === true;
  if (def.type === 'color') return hexToRgb(value) ? rgbToHex(hexToRgb(value)) : def.def;
  if (def.options) return def.options.some((o) => o.v === value) ? value : def.def;
  return value;
}

function setSetting(key, value, { persist = true } = {}) {
  const def = settingByKey.get(key);
  if (!def) return;
  state[key] = coerceSetting(def, value);
  if (persist) store.set('setting:' + key, state[key]);
  applySettings();
  document.dispatchEvent(new CustomEvent('setting-changed', { detail: { key } }));
}

function resetSetting(key) {
  const def = settingByKey.get(key);
  if (!def) return;
  state[key] = def.def;
  store.remove('setting:' + key);
  applySettings();
  document.dispatchEvent(new CustomEvent('setting-changed', { detail: { key } }));
}

function resolvedTheme() {
  if (state.theme === 'light' || state.theme === 'dark') return state.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applySettings() {
  const root = document.documentElement;
  const app = $('#app');

  if (state.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);

  root.setAttribute('data-motion', state.motion === 'reduce' ? 'reduce' : 'system');
  root.style.setProperty('--fs-base', state.fontSize + 'px');
  root.style.setProperty('--font-ui', FONT_STACKS[state.fontFamily] || FONT_STACKS.nunito);

  if (app) {
    app.dataset.density = state.density;
    if (app.dataset.dock !== state.dock) {
      app.dataset.dock = state.dock;
      const strip = $('#railStrip');
      if (strip) {
        strip.setAttribute('aria-orientation',
          state.dock === 'top' || state.dock === 'bottom' ? 'horizontal' : 'vertical');
      }
    }
  }

  applyAccent(state.accent);
  const themeBtn = $('#themeBtn');
  if (themeBtn) {
    const use = themeBtn.querySelector('use');
    const map = { light: '#ui-sun', dark: '#ui-moon', system: '#ui-monitor' };
    if (use) use.setAttribute('href', map[state.theme] || '#ui-monitor');
    themeBtn.setAttribute('aria-label',
      'Theme: ' + state.theme + '. Activate to cycle light, dark and system.');
  }
  requestAnimationFrame(updateRailOverflow);
}

const ACCENT_TOKENS = ['--c-accent', '--c-accent-hover', '--c-on-accent', '--c-accent-soft', '--c-on-accent-soft', '--c-accent-ring'];
const SURFACE_LIGHT = '#fffdf8';
const SURFACE_DARK = '#221b14';
const ACCENT_MIN_CONTRAST = 4.6;

/**
 * A single accent has to survive a cream page and a dark brown one. When the
 * chosen colour would leave link text below AA in the scheme currently in use,
 * walk its lightness — hue and saturation untouched — until it clears the bar.
 * The picker reports both values, so the adjustment is never silent.
 */
function adaptAccent(hex, dark) {
  const surface = dark ? SURFACE_DARK : SURFACE_LIGHT;
  if (contrastRatio(hex, surface) >= ACCENT_MIN_CONTRAST) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  const dir = dark ? 1 : -1;
  let last = hex;
  for (let step = 1; step <= 100; step++) {
    const l = clamp(hsl.l + dir * step * 0.01, 0, 1);
    const cand = rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l }));
    if (contrastRatio(cand, surface) >= ACCENT_MIN_CONTRAST) return cand;
    last = cand;
    if (l === 0 || l === 1) break;
  }
  return last;
}

/** The accent actually painted right now, whatever its source. */
function renderedAccent() {
  return (getComputedStyle(document.documentElement).getPropertyValue('--c-accent') || '').trim() || '#427d12';
}

function applyAccent(hex) {
  const root = document.documentElement;

  // At the shipped default, stand aside: the stylesheet carries a separately
  // designed accent for each scheme, and a computed one would be worse.
  if (hex === settingByKey.get('accent').def) {
    for (const token of ACCENT_TOKENS) root.style.removeProperty(token);
    const untouched = document.querySelector('meta[name="theme-color"]');
    if (untouched) untouched.setAttribute('content', renderedAccent());
    return;
  }

  const dark = resolvedTheme() === 'dark';
  const used = adaptAccent(hex, dark);
  const rgb = hexToRgb(used);
  if (!rgb) return;
  const onAccent = contrastRatio(used, '#ffffff') >= contrastRatio(used, '#1a1208') ? '#ffffff' : '#1a1208';
  root.style.setProperty('--c-accent', used);
  root.style.setProperty('--c-accent-hover', dark ? shift(used, 0.07) : shift(used, -0.06));
  root.style.setProperty('--c-on-accent', onAccent);
  root.style.setProperty('--c-accent-soft', dark ? mix(used, '#17120d', 0.74) : mix(used, '#fdf6e9', 0.84));
  root.style.setProperty('--c-on-accent-soft', dark ? shift(used, 0.22) : shift(used, -0.24));
  root.style.setProperty('--c-accent-ring', 'rgba(' + Math.round(rgb.r) + ',' + Math.round(rgb.g) + ',' + Math.round(rgb.b) + ',0.34)');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', used);
}

/* ---------------------------------------------------------------------------
 * 6. Notifications — non-blocking toasts with a reviewable history.
 * ------------------------------------------------------------------------ */

const notifications = [];
let unreadNotifications = 0;

function notify(title, text, kind = 'info') {
  const record = { title, text, kind, at: new Date() };
  notifications.unshift(record);
  if (notifications.length > 60) notifications.length = 60;
  unreadNotifications += 1;
  updateNotifyBadge();

  const region = $('#toastRegion');
  const live = $('#toastLive');
  if (live) live.textContent = title + (text ? '. ' + text : '');
  if (!region) return record;

  const iconName = kind === 'warn' ? 'ui-warning'
    : kind === 'danger' ? 'ui-warning'
    : kind === 'ok' ? 'ui-check' : 'ui-info';

  const closeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Dismiss notification' }, [icon('ui-close', 'icon icon-sm')]);
  const toast = el('div', { class: 'toast toast-' + kind, role: kind === 'danger' || kind === 'warn' ? 'alert' : 'status' }, [
    icon(iconName),
    el('div', { class: 'toast-body' }, [
      el('div', { class: 'toast-title', text: title }),
      text ? el('div', { class: 'toast-text', text }) : null,
    ]),
    closeBtn,
  ]);
  const remove = () => { if (toast.parentNode) toast.remove(); };
  closeBtn.addEventListener('click', remove);
  region.appendChild(toast);
  if (kind === 'info' || kind === 'ok') {
    setTimeout(remove, Math.max(3, Number(state.toastSeconds) || 7) * 1000);
  }
  return record;
}

function updateNotifyBadge() {
  const badge = $('#notifyBadge');
  if (!badge) return;
  if (unreadNotifications > 0) {
    badge.hidden = false;
    badge.textContent = unreadNotifications > 9 ? '9+' : String(unreadNotifications);
  } else {
    badge.hidden = true;
  }
}

function openNotificationHistory(anchor) {
  unreadNotifications = 0;
  updateNotifyBadge();
  const list = el('div', { class: 'notice-list' });
  if (notifications.length === 0) {
    list.appendChild(el('p', { class: 'notice-empty', text: 'Nothing has been reported yet during this visit.' }));
  } else {
    for (const n of notifications) {
      list.appendChild(el('div', { class: 'notice' }, [
        el('div', { class: 'toast-title', text: n.title }),
        n.text ? el('div', { class: 'toast-text', text: n.text }) : null,
        el('div', { class: 'notice-time', text: n.at.toLocaleTimeString() }),
      ]));
    }
  }
  openPopover({
    anchor,
    title: 'Notification history',
    content: [
      list,
      el('p', { class: 'rb-note', text: 'History is kept for this visit only and is never written to storage or sent anywhere.' }),
    ],
  });
}

/* ---------------------------------------------------------------------------
 * 7. Popovers — anchored, dismissible, focus-returning.
 * ------------------------------------------------------------------------ */

let activePopover = null;

function closePopover() {
  if (!activePopover) return;
  const { node, anchor, onClose } = activePopover;
  activePopover = null;
  node.remove();
  if (anchor) {
    anchor.setAttribute('aria-expanded', 'false');
    if (document.activeElement === document.body || node.contains(document.activeElement)) {
      anchor.focus();
    }
  }
  document.removeEventListener('pointerdown', onOutsidePointer, true);
  document.removeEventListener('keydown', onPopoverKey, true);
  window.removeEventListener('resize', positionActivePopover);
  window.removeEventListener('scroll', positionActivePopover, true);
  if (typeof onClose === 'function') onClose();
}

function onOutsidePointer(ev) {
  if (!activePopover) return;
  if (activePopover.node.contains(ev.target)) return;
  if (activePopover.anchor && activePopover.anchor.contains(ev.target)) return;
  closePopover();
}

function onPopoverKey(ev) {
  if (!activePopover) return;
  if (ev.key === 'Escape') { ev.stopPropagation(); closePopover(); }
}

function positionActivePopover() {
  if (!activePopover) return;
  const { node, anchor } = activePopover;
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const margin = 8;
  let left = r.left;
  if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin;
  left = Math.max(margin, left);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - margin) {
    const above = r.top - h - 6;
    top = above >= margin ? above : Math.max(margin, window.innerHeight - h - margin);
  }
  node.style.left = left + 'px';
  node.style.top = top + 'px';
}

function openPopover({ anchor, title, content, className = '', onClose }) {
  const alreadyMine = activePopover && activePopover.anchor === anchor;
  closePopover();
  if (alreadyMine) return null;

  const closeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close' }, [icon('ui-close', 'icon icon-sm')]);
  closeBtn.addEventListener('click', closePopover);

  const node = el('div', {
    class: 'popover ' + className,
    role: 'dialog',
    'aria-modal': 'false',
    'aria-label': title || 'Panel',
  }, [
    el('div', { class: 'popover-head' }, [
      el('h2', { class: 'popover-title', text: title || '' }),
      closeBtn,
    ]),
  ]);
  for (const c of [].concat(content)) if (c) node.appendChild(c);

  $('#overlayRoot').appendChild(node);
  activePopover = { node, anchor, onClose };
  if (anchor) anchor.setAttribute('aria-expanded', 'true');
  positionActivePopover();

  document.addEventListener('pointerdown', onOutsidePointer, true);
  document.addEventListener('keydown', onPopoverKey, true);
  window.addEventListener('resize', positionActivePopover);
  window.addEventListener('scroll', positionActivePopover, true);

  const first = node.querySelector('input, button, select, [tabindex]:not([tabindex="-1"])');
  if (first) first.focus();
  return node;
}

/* ---------------------------------------------------------------------------
 * 8. Regular expressions — bounded compilation, a safety assessment, and a
 *    plain-language explanation. Everything is evaluated locally.
 * ------------------------------------------------------------------------ */

const REGEX_MAX_PATTERN = 200;      // characters
const REGEX_MAX_CHUNK = 2000;       // characters fed to one exec call
const REGEX_TIME_BUDGET_MS = 60;    // total matching time per query

/**
 * Refuse patterns that can blow up, and flag ones worth a second look.
 * The refusal is the real guard: a nested quantifier over a group that itself
 * quantifies is the classic exponential case, and no time budget can rescue a
 * single exec call once it has started.
 */
function assessPattern(src) {
  const cautions = [];
  if (src.length > REGEX_MAX_PATTERN) {
    return { ok: false, reason: 'The pattern is longer than ' + REGEX_MAX_PATTERN + ' characters.' };
  }

  const starts = [];
  let inClass = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') { i++; continue; }
    if (inClass) { if (ch === ']') inClass = false; continue; }
    if (ch === '[') { inClass = true; continue; }
    if (ch === '(') { starts.push(i); continue; }
    if (ch === ')') {
      const open = starts.pop();
      if (open === undefined) continue;
      const body = src.slice(open + 1, i);
      const next = src.slice(i + 1);
      const outerQuant = /^(?:[*+]|\{\s*\d+\s*,\s*\}?)/.test(next);
      if (!outerQuant) continue;
      if (hasUnescapedQuantifier(body)) {
        return {
          ok: false,
          reason: 'This pattern nests a repeat inside a repeated group, which can take ' +
                  'exponential time on ordinary text. Rewrite the inner repeat, or anchor it.',
        };
      }
      if (/(?:^|[^\\])\|/.test(body)) {
        cautions.push('A repeated group containing alternation can be slow on long text.');
      }
    }
  }
  if (/\.\*[\s\S]*\.\*/.test(src)) cautions.push('Two unbounded ".*" runs in one pattern usually match more than intended.');
  return { ok: true, cautions };
}

function hasUnescapedQuantifier(body) {
  let inClass = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\') { i++; continue; }
    if (inClass) { if (ch === ']') inClass = false; continue; }
    if (ch === '[') { inClass = true; continue; }
    if (ch === '*' || ch === '+') return true;
    if (ch === '{') {
      const rest = body.slice(i);
      if (/^\{\s*\d+\s*,\s*\d*\s*\}/.test(rest)) return true;
    }
  }
  return false;
}

function compilePattern(src, flags) {
  const verdict = assessPattern(src);
  if (!verdict.ok) return { error: verdict.reason };
  let re;
  try {
    re = new RegExp(src, flags.includes('g') ? flags : flags + 'g');
  } catch (err) {
    return { error: 'Not a valid regular expression: ' + (err && err.message ? err.message : String(err)) };
  }
  return { re, cautions: verdict.cautions || [] };
}

const CHAR_NAMES = {
  ' ': 'space', '.': 'full stop', '*': 'asterisk', '+': 'plus', '?': 'question mark',
  '(': 'opening bracket', ')': 'closing bracket', '[': 'opening square bracket',
  ']': 'closing square bracket', '{': 'opening brace', '}': 'closing brace',
  '^': 'caret', '$': 'dollar sign', '|': 'vertical bar', '\\': 'backslash', '/': 'slash',
};
function describeChar(c) {
  if (c === undefined) return 'nothing';
  return CHAR_NAMES[c] ? CHAR_NAMES[c] : '"' + c + '"';
}

const ESCAPE_MEANINGS = {
  d: 'any digit, 0 to 9',
  D: 'any character that is not a digit',
  w: 'any word character: a letter, a digit or an underscore',
  W: 'any character that is not a word character',
  s: 'any whitespace character',
  S: 'any character that is not whitespace',
  b: 'a word boundary — the edge between a word character and anything else',
  B: 'a position that is not a word boundary',
  n: 'a line feed',
  r: 'a carriage return',
  t: 'a tab',
};

/** Walk the pattern and describe each construct in ordinary words. */
function explainPattern(src, flags) {
  const parts = [];
  let i = 0;
  const add = (token, text) => parts.push({ token, text });

  while (i < src.length) {
    const ch = src[i];

    if (ch === '\\') {
      const n = src[i + 1];
      if (n === undefined) { add('\\', 'a trailing backslash, which is not valid on its own'); i += 1; continue; }
      if (ESCAPE_MEANINGS[n]) { add('\\' + n, ESCAPE_MEANINGS[n]); i += 2; continue; }
      if (n >= '1' && n <= '9') { add('\\' + n, 'whatever capture group ' + n + ' matched earlier'); i += 2; continue; }
      add('\\' + n, 'a literal ' + describeChar(n));
      i += 2; continue;
    }

    if (ch === '[') {
      let j = i + 1;
      const negated = src[j] === '^';
      if (negated) j++;
      let body = '';
      while (j < src.length && src[j] !== ']') {
        if (src[j] === '\\') { body += src[j] + (src[j + 1] || ''); j += 2; continue; }
        body += src[j]; j++;
      }
      const token = src.slice(i, Math.min(j + 1, src.length));
      add(token, (negated ? 'any single character that is NOT ' : 'any single character from ') + describeClassBody(body));
      i = j + 1; continue;
    }

    if (ch === '(') {
      const head3 = src.slice(i, i + 3);
      const head4 = src.slice(i, i + 4);
      if (head4 === '(?<=') { add(head4, 'a look-behind: the text before this point must match what follows, without consuming it'); i += 4; continue; }
      if (head4 === '(?<!') { add(head4, 'a negative look-behind: the text before this point must NOT match what follows'); i += 4; continue; }
      if (head3 === '(?=') { add(head3, 'a look-ahead: what follows must match here, but is not consumed'); i += 3; continue; }
      if (head3 === '(?!') { add(head3, 'a negative look-ahead: what follows must NOT match here'); i += 3; continue; }
      if (head3 === '(?:') { add(head3, 'the start of a group that is not captured'); i += 3; continue; }
      const named = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(src.slice(i));
      if (named) { add(named[0], 'the start of a group captured under the name "' + named[1] + '"'); i += named[0].length; continue; }
      add('(', 'the start of a capture group'); i += 1; continue;
    }

    if (ch === ')') { add(')', 'the end of that group'); i += 1; continue; }
    if (ch === '^') { add('^', flags.includes('m') ? 'the start of any line' : 'the start of the text'); i += 1; continue; }
    if (ch === '$') { add('$', flags.includes('m') ? 'the end of any line' : 'the end of the text'); i += 1; continue; }
    if (ch === '.') { add('.', flags.includes('s') ? 'any character at all, newlines included' : 'any character except a line break'); i += 1; continue; }
    if (ch === '|') { add('|', 'or — either the alternative before this, or the one after'); i += 1; continue; }

    if (ch === '*' || ch === '+' || ch === '?') {
      const lazy = src[i + 1] === '?';
      const word = ch === '*' ? 'zero or more times' : ch === '+' ? 'one or more times' : 'zero or one time';
      add(ch + (lazy ? '?' : ''), 'repeats the item just before it ' + word + (lazy ? ', preferring the shortest match' : ''));
      i += lazy ? 2 : 1; continue;
    }

    if (ch === '{') {
      const m = /^\{\s*(\d+)\s*(?:,\s*(\d*)\s*)?\}/.exec(src.slice(i));
      if (m) {
        const lazy = src[i + m[0].length] === '?';
        let word;
        if (m[2] === undefined) word = 'exactly ' + m[1] + ' times';
        else if (m[2] === '') word = 'at least ' + m[1] + ' times';
        else word = 'between ' + m[1] + ' and ' + m[2] + ' times';
        add(m[0] + (lazy ? '?' : ''), 'repeats the item just before it ' + word + (lazy ? ', preferring the shortest match' : ''));
        i += m[0].length + (lazy ? 1 : 0); continue;
      }
      add('{', 'a literal opening brace'); i += 1; continue;
    }

    let lit = '';
    while (i < src.length && !'\\[()^$.|*+?{'.includes(src[i])) { lit += src[i]; i++; }
    if (lit) add(lit, 'the literal text ' + JSON.stringify(lit));
  }

  const flagWords = [];
  if (flags.includes('i')) flagWords.push('upper and lower case are treated as the same');
  if (flags.includes('m')) flagWords.push('^ and $ apply to each line rather than the whole text');
  if (flags.includes('s')) flagWords.push('. also matches line breaks');
  if (flags.includes('u')) flagWords.push('the pattern is read as Unicode');
  return { parts, flagWords };
}

function describeClassBody(body) {
  if (!body) return 'an empty set, which can never match';
  const bits = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] === '\\' && ESCAPE_MEANINGS[body[i + 1]]) { bits.push(ESCAPE_MEANINGS[body[i + 1]]); i += 2; continue; }
    if (body[i] === '\\') { bits.push('a literal ' + describeChar(body[i + 1])); i += 2; continue; }
    if (body[i + 1] === '-' && body[i + 2] && body[i + 2] !== ']') {
      bits.push(body[i] + ' through ' + body[i + 2]);
      i += 3; continue;
    }
    bits.push(describeChar(body[i]));
    i += 1;
  }
  return bits.join(', ');
}

/* ---------------------------------------------------------------------------
 * 9. Search index and query engine
 * ------------------------------------------------------------------------ */

/** [{ articleId, articleTitle, group, sectionId, heading, text }] */
let searchIndex = [];

function htmlToText(html) {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return (holder.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * The shell's own articles build their bodies in code rather than declaring
 * `html`, so their real sections are whatever `render` emits. Render one
 * detached, read the headings back, and let that be the article's section list.
 * Derived rather than hand-listed, so the tab strip, the palette, the deep
 * links and the search index cannot drift apart from the page.
 */
function hydrateBuiltIn(article) {
  if (typeof article.render !== 'function') return;
  const holder = document.createElement('div');
  try {
    article.render(holder);
  } catch (err) {
    contentProblems.push({ path: '(shell) ' + article.id, kind: 'invalid', detail: 'render() threw: ' + err.message });
    return;
  }
  const derived = [];
  let current = null;
  const absorb = (text) => {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (current) current.text += ' ' + t;
    // Prose above the first heading belongs to the article itself.
    else article.leadText = ((article.leadText || '') + ' ' + t).trim();
  };
  // Headings can sit inside wrapper elements, so descend into any subtree that
  // still contains one and treat the rest as flat text.
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1 && child.tagName === 'H2' && child.id.startsWith('s-')) {
        current = { id: child.id.slice(2), heading: child.textContent.trim(), html: '', text: child.textContent.trim() };
        derived.push(current);
        continue;
      }
      if (child.nodeType === 1 && child.querySelector && child.querySelector('h2[id^="s-"]')) {
        walk(child);
        continue;
      }
      absorb(child.textContent);
    }
  };
  walk(holder);
  if (derived.length > 0) article.sections = derived;
}

function buildSearchIndex() {
  searchIndex = [];
  for (const a of articles) {
    searchIndex.push({
      articleId: a.id, articleTitle: a.title, group: a.group,
      sectionId: null, heading: a.title,
      text: [a.summary, a.leadText].filter(Boolean).join(' '),
    });
    for (const s of a.sections) {
      searchIndex.push({
        articleId: a.id, articleTitle: a.title, group: a.group,
        sectionId: s.id, heading: s.heading,
        text: s.text !== undefined ? s.text : s.heading + '. ' + htmlToText(s.html),
      });
    }
  }
}

/**
 * @returns {{results: Array, error: string|null, cautions: string[], truncated: boolean}}
 */
function runSearch(query, { regex, flags }) {
  const out = { results: [], error: null, cautions: [], truncated: false };
  const q = query.trim();
  if (!q) return out;

  if (regex) {
    const compiled = compilePattern(q, flags);
    if (compiled.error) { out.error = compiled.error; return out; }
    out.cautions = compiled.cautions;
    const started = performance.now();
    for (const entry of searchIndex) {
      if (performance.now() - started > REGEX_TIME_BUDGET_MS) { out.truncated = true; break; }
      const hit = firstRegexHit(compiled.re, entry.heading) || firstRegexHit(compiled.re, entry.text);
      if (hit) out.results.push({ entry, index: hit.index, length: hit.length, score: 1 });
      if (out.results.length >= 60) break;
    }
    return out;
  }

  const needle = q.toLowerCase();
  const terms = needle.split(/\s+/).filter(Boolean);
  for (const entry of searchIndex) {
    const hay = (entry.heading + ' ' + entry.articleTitle + ' ' + entry.group + ' ' + entry.text).toLowerCase();
    if (!terms.every((t) => hay.includes(t))) continue;
    const idx = entry.text.toLowerCase().indexOf(needle);
    const headIdx = entry.heading.toLowerCase().indexOf(needle);
    let score = 0;
    if (entry.articleTitle.toLowerCase().includes(needle)) score += 40;
    if (headIdx === 0) score += 30; else if (headIdx > -1) score += 18;
    if (idx > -1) score += 10;
    if (!entry.sectionId) score += 8;
    out.results.push({
      entry,
      index: idx > -1 ? idx : 0,
      length: idx > -1 ? needle.length : 0,
      score,
    });
    if (out.results.length >= 200) break;
  }
  out.results.sort((a, b) => b.score - a.score);
  out.results.length = Math.min(out.results.length, 60);
  return out;
}

/** Run a regex over a long string in bounded chunks. */
function firstRegexHit(re, text) {
  if (!text) return null;
  for (let start = 0; start < text.length; start += REGEX_MAX_CHUNK) {
    const chunk = text.slice(start, start + REGEX_MAX_CHUNK);
    re.lastIndex = 0;
    const m = re.exec(chunk);
    if (m) return { index: start + m.index, length: m[0].length || 1 };
  }
  return null;
}

/** Build a snippet element with the hit marked, without any innerHTML. */
function snippetNode(text, index, length) {
  const span = el('div', { class: 'sr-snippet' });
  if (!text) return span;
  const radius = 60;
  let from = Math.max(0, index - radius);
  const to = Math.min(text.length, index + length + radius);
  if (from > 0) span.appendChild(document.createTextNode('…'));
  span.appendChild(document.createTextNode(text.slice(from, index)));
  if (length > 0) {
    span.appendChild(el('mark', { text: text.slice(index, index + length) }));
    span.appendChild(document.createTextNode(text.slice(index + length, to)));
  } else {
    span.appendChild(document.createTextNode(text.slice(index, to)));
  }
  if (to < text.length) span.appendChild(document.createTextNode('…'));
  return span;
}

/* ---------------------------------------------------------------------------
 * 10. Regex builder — anchored beside the field it belongs to.
 * ------------------------------------------------------------------------ */

const TOKEN_GROUPS = [
  {
    name: 'Character classes',
    tokens: [
      { t: '.', d: 'any character' },
      { t: '\\d', d: 'digit' },
      { t: '\\D', d: 'not a digit' },
      { t: '\\w', d: 'word char' },
      { t: '\\W', d: 'not word' },
      { t: '\\s', d: 'whitespace' },
      { t: '\\S', d: 'not space' },
      { t: '[a-z]', d: 'range' },
      { t: '[^a-z]', d: 'not in range' },
      { t: '[aeiou]', d: 'any listed' },
    ],
  },
  {
    name: 'Anchors and boundaries',
    tokens: [
      { t: '^', d: 'start' },
      { t: '$', d: 'end' },
      { t: '\\b', d: 'word edge' },
      { t: '\\B', d: 'not an edge' },
    ],
  },
  {
    name: 'Groups',
    tokens: [
      { t: '(…)', d: 'capture', insert: '()', caret: -1 },
      { t: '(?:…)', d: 'no capture', insert: '(?:)', caret: -1 },
      { t: '(?<name>…)', d: 'named', insert: '(?<name>)', caret: -1 },
      { t: '\\1', d: 'back-reference' },
    ],
  },
  {
    name: 'Quantifiers',
    tokens: [
      { t: '*', d: 'zero or more' },
      { t: '+', d: 'one or more' },
      { t: '?', d: 'optional' },
      { t: '{2,5}', d: 'between 2 and 5' },
      { t: '{3}', d: 'exactly 3' },
      { t: '+?', d: 'lazy one or more' },
    ],
  },
  {
    name: 'Alternation',
    tokens: [
      { t: '|', d: 'either or' },
      { t: '(?:a|b)', d: 'grouped choice' },
    ],
  },
  {
    name: 'Look-around',
    tokens: [
      { t: '(?=…)', d: 'followed by', insert: '(?=)', caret: -1 },
      { t: '(?!…)', d: 'not followed by', insert: '(?!)', caret: -1 },
      { t: '(?<=…)', d: 'preceded by', insert: '(?<=)', caret: -1 },
      { t: '(?<!…)', d: 'not preceded by', insert: '(?<!)', caret: -1 },
    ],
  },
];

const FLAG_INFO = [
  { f: 'i', l: 'ignore case' },
  { f: 'm', l: 'multiline ^ $' },
  { f: 's', l: 'dot matches newlines' },
  { f: 'u', l: 'unicode' },
];

/**
 * Attach a regex builder to a text field.
 * @param {object} opts
 * @param {HTMLElement} opts.button   the anchored trigger beside the field
 * @param {HTMLInputElement} opts.input the field whose value is the pattern
 * @param {() => Array<{label:string, text:string}>} opts.corpus  live preview source
 * @param {object} opts.mode          shared { on: boolean, flags: string }
 * @param {() => void} opts.onChange  called when pattern, flags or mode change
 */
function attachRegexBuilder({ button, input, corpus, mode, onChange }) {
  function insertToken(tok) {
    const text = tok.insert !== undefined ? tok.insert : tok.t;
    const caretShift = tok.caret || 0;
    const start = input.selectionStart === null ? input.value.length : input.selectionStart;
    const end = input.selectionEnd === null ? input.value.length : input.selectionEnd;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const caret = start + text.length + caretShift;
    input.focus();
    input.setSelectionRange(caret, caret);
    if (!mode.on) { mode.on = true; }
    onChange();
    refresh();
  }

  let bodyRefs = null;

  function refresh() {
    if (!bodyRefs) return;
    const src = input.value;
    const { explainBox, previewBox, errorBox, cautionBox, patternMirror } = bodyRefs;
    patternMirror.value = src;
    patternMirror.classList.remove('is-invalid');
    clear(explainBox); clear(previewBox); clear(errorBox); clear(cautionBox);

    if (!src) {
      explainBox.appendChild(el('p', { class: 'rb-note', style: 'margin:0', text: 'Insert a token above, or type a pattern, and it will be explained here in words.' }));
      return;
    }

    const compiled = compilePattern(src, mode.flags);
    if (compiled.error) {
      patternMirror.classList.add('is-invalid');
      errorBox.appendChild(el('p', { class: 'rb-error', text: compiled.error }));
    } else if (compiled.cautions.length) {
      for (const c of compiled.cautions) cautionBox.appendChild(el('p', { class: 'rb-note', text: 'Caution: ' + c }));
    }

    const { parts, flagWords } = explainPattern(src, mode.flags);
    const ol = el('ol');
    for (const p of parts) {
      ol.appendChild(el('li', {}, [el('code', { text: p.token }), document.createTextNode(' — ' + p.text)]));
    }
    explainBox.appendChild(ol);
    if (flagWords.length) {
      explainBox.appendChild(el('p', { class: 'rb-note', text: 'With these flags: ' + flagWords.join('; ') + '.' }));
    }

    if (compiled.error) return;
    const items = corpus();
    const started = performance.now();
    let hits = 0;
    for (const item of items) {
      if (performance.now() - started > REGEX_TIME_BUDGET_MS) {
        previewBox.appendChild(el('p', { class: 'rb-note', text: 'Preview stopped at the time budget; the pattern is slow on this much text.' }));
        break;
      }
      const hit = firstRegexHit(compiled.re, item.text);
      if (!hit) continue;
      hits += 1;
      const box = el('div', { class: 'rb-hit' }, [el('b', { text: item.label })]);
      box.appendChild(snippetNode(item.text, hit.index, hit.length));
      previewBox.appendChild(box);
      if (hits >= 6) break;
    }
    if (hits === 0) previewBox.appendChild(el('p', { class: 'rb-note', style: 'margin:0', text: 'No match anywhere in the current text.' }));
    else previewBox.appendChild(el('p', { class: 'rb-note', text: 'Showing the first match in up to six places. Matching runs entirely in this page.' }));
  }

  function open() {
    const patternMirror = el('input', {
      class: 'rb-pattern', type: 'text', spellcheck: 'false',
      'aria-label': 'Regular expression pattern', value: input.value,
    });
    patternMirror.addEventListener('input', () => {
      input.value = patternMirror.value;
      onChange();
      refresh();
    });

    const modeSwitch = el('input', { type: 'checkbox', id: 'rb-mode-' + Math.random().toString(36).slice(2) });
    modeSwitch.checked = mode.on;
    modeSwitch.addEventListener('change', () => {
      mode.on = modeSwitch.checked;
      onChange();
      refresh();
    });
    const modeRow = el('label', { class: 'switch' }, [
      modeSwitch,
      el('span', { class: 'switch-track', 'aria-hidden': 'true' }),
      el('span', { text: 'Use this as a regular expression' }),
    ]);

    const flagsRow = el('div', { class: 'rb-flags' });
    for (const info of FLAG_INFO) {
      const b = el('button', {
        class: 'rb-flag', type: 'button',
        'aria-pressed': mode.flags.includes(info.f) ? 'true' : 'false',
        title: info.l,
        'aria-label': 'Flag ' + info.f + ': ' + info.l,
        text: info.f,
      });
      b.addEventListener('click', () => {
        if (mode.flags.includes(info.f)) mode.flags = mode.flags.split(info.f).join('');
        else mode.flags += info.f;
        b.setAttribute('aria-pressed', mode.flags.includes(info.f) ? 'true' : 'false');
        onChange();
        refresh();
      });
      flagsRow.appendChild(b);
    }

    const cats = el('div', { class: 'rb-cats' });
    TOKEN_GROUPS.forEach((g, gi) => {
      const wrap = el('details', { class: 'rb-cat', open: gi < 2 });
      wrap.appendChild(el('summary', { text: g.name }));
      const toks = el('div', { class: 'rb-tokens' });
      for (const tok of g.tokens) {
        const b = el('button', {
          class: 'rb-token', type: 'button',
          'aria-label': 'Insert ' + tok.t + ' — ' + tok.d,
        }, [el('code', { text: tok.t }), el('span', { text: tok.d })]);
        b.addEventListener('click', () => insertToken(tok));
        toks.appendChild(b);
      }
      wrap.appendChild(toks);
      cats.appendChild(wrap);
    });

    const errorBox = el('div');
    const cautionBox = el('div');
    const explainBox = el('div', { class: 'rb-explain' });
    const previewBox = el('div', { class: 'rb-preview' });

    bodyRefs = { explainBox, previewBox, errorBox, cautionBox, patternMirror };

    const node = openPopover({
      anchor: button,
      title: 'Regular expression builder',
      className: 'rb',
      content: [
        el('div', { class: 'rb-pattern-row' }, [patternMirror]),
        modeRow,
        el('p', { class: 'rb-section-title', text: 'Flags' }),
        flagsRow,
        el('p', { class: 'rb-section-title', text: 'Insert' }),
        cats,
        el('p', { class: 'rb-section-title', text: 'What this pattern says' }),
        errorBox, cautionBox, explainBox,
        el('p', { class: 'rb-section-title', text: 'Live matches' }),
        previewBox,
        el('p', {
          class: 'rb-note',
          text: 'Bounds: patterns are limited to ' + REGEX_MAX_PATTERN + ' characters, text is ' +
                'matched in ' + REGEX_MAX_CHUNK + '-character chunks, and a query gives up after ' +
                REGEX_TIME_BUDGET_MS + 'ms. A repeat nested inside a repeated group is refused ' +
                'outright, because that is the shape that runs for ever.',
        }),
      ],
      onClose: () => { bodyRefs = null; },
    });
    if (node) refresh();
  }

  button.addEventListener('click', open);
  return { refresh: () => refresh() };
}

/* ---------------------------------------------------------------------------
 * 11. Main search field
 * ------------------------------------------------------------------------ */

const searchMode = {
  on: store.get('setting:rememberRegex', false) ? store.get('search:regexOn', false) : false,
  flags: store.get('search:flags', 'i') || 'i',
};

let searchActiveIndex = -1;
let searchCurrent = [];

function searchCorpus() {
  return searchIndex.map((e) => ({
    label: e.articleTitle + (e.sectionId ? ' › ' + e.heading : ''),
    text: e.text,
  }));
}

function updateRegexButtonState() {
  const btn = $('#searchRegexBtn');
  if (!btn) return;
  btn.classList.toggle('is-on', searchMode.on);
  btn.setAttribute('aria-label',
    'Regular expression builder. Regular expression mode is currently ' + (searchMode.on ? 'on' : 'off') + '.');
  const bar = $('#searchAnchor');
  if (bar) bar.classList.remove('is-invalid');
}

function renderSearchResults() {
  const box = $('#searchResults');
  const input = $('#searchInput');
  const bar = $('#searchAnchor');
  clear(box);
  searchActiveIndex = -1;
  input.removeAttribute('aria-activedescendant');

  const q = input.value.trim();
  if (!q) {
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    bar.classList.remove('is-invalid');
    return;
  }

  const { results, error, cautions, truncated } = runSearch(q, { regex: searchMode.on, flags: searchMode.flags });
  searchCurrent = results;
  bar.classList.toggle('is-invalid', Boolean(error));

  if (error) {
    box.appendChild(el('p', { class: 'sr-empty', text: error }));
  } else if (results.length === 0) {
    box.appendChild(el('p', {
      class: 'sr-empty',
      text: searchMode.on
        ? 'That pattern matches nothing in the documentation.'
        : 'Nothing matches "' + q + '".',
    }));
  } else {
    for (const caution of cautions) box.appendChild(el('p', { class: 'sr-empty', text: 'Caution: ' + caution }));
    if (truncated) box.appendChild(el('p', { class: 'sr-empty', text: 'Stopped early at the time budget; these are the matches found so far.' }));
    results.forEach((r, i) => {
      const e = r.entry;
      const item = el('button', {
        class: 'sr-item', type: 'button', role: 'option',
        id: 'sr-opt-' + i, 'aria-selected': 'false',
      }, [
        el('div', { class: 'sr-title', text: e.sectionId ? e.heading : e.articleTitle }),
        el('div', { class: 'sr-path', text: e.group + ' › ' + e.articleTitle + (e.sectionId ? ' › section' : '') }),
      ]);
      item.appendChild(snippetNode(e.text, r.index, r.length));
      item.addEventListener('click', () => openResult(r));
      box.appendChild(item);
    });
  }

  box.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function openResult(r) {
  const e = r.entry;
  navigate('/' + e.articleId + (e.sectionId ? '/' + e.sectionId : ''));
  closeSearchResults();
}

function closeSearchResults() {
  const box = $('#searchResults');
  const input = $('#searchInput');
  if (box) { box.hidden = true; clear(box); }
  if (input) { input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
  searchActiveIndex = -1;
}

function moveSearchActive(delta) {
  const items = $$('.sr-item', $('#searchResults'));
  if (items.length === 0) return;
  items.forEach((it) => { it.classList.remove('is-active'); it.setAttribute('aria-selected', 'false'); });
  // The cursor has items.length + 1 positions: -1 (the field itself, nothing
  // highlighted) followed by 0..items.length-1. Shift by one into 0..n so the
  // wrap arithmetic is ordinary, move, then shift back. Doing the modulo on the
  // unshifted index leaves -1 mapping to -1 for every downward press, which is
  // exactly the state that made ArrowDown a permanent no-op.
  const slots = items.length + 1;
  searchActiveIndex = (((searchActiveIndex + 1 + delta) % slots) + slots) % slots - 1;
  if (searchActiveIndex < 0) { $('#searchInput').removeAttribute('aria-activedescendant'); return; }
  const active = items[searchActiveIndex];
  active.classList.add('is-active');
  active.setAttribute('aria-selected', 'true');
  active.scrollIntoView({ block: 'nearest' });
  $('#searchInput').setAttribute('aria-activedescendant', active.id);
}

function initSearch() {
  const input = $('#searchInput');
  const clearBtn = $('#searchClear');
  const regexBtn = $('#searchRegexBtn');

  const onChange = () => {
    store.set('search:flags', searchMode.flags);
    if (state.rememberRegex) store.set('search:regexOn', searchMode.on);
    updateRegexButtonState();
    renderSearchResults();
  };

  attachRegexBuilder({ button: regexBtn, input, corpus: searchCorpus, mode: searchMode, onChange });

  input.addEventListener('input', () => {
    clearBtn.hidden = input.value.length === 0;
    renderSearchResults();
  });
  input.addEventListener('focus', () => { if (input.value) renderSearchResults(); });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); moveSearchActive(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveSearchActive(-1); }
    else if (ev.key === 'Enter') {
      if (searchActiveIndex >= 0 && searchCurrent[searchActiveIndex]) {
        ev.preventDefault();
        openResult(searchCurrent[searchActiveIndex]);
      }
    } else if (ev.key === 'Escape') {
      if (!$('#searchResults').hidden) { ev.stopPropagation(); closeSearchResults(); }
      else { input.value = ''; clearBtn.hidden = true; }
    }
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    closeSearchResults();
    input.focus();
  });
  document.addEventListener('pointerdown', (ev) => {
    const bar = $('#searchAnchor');
    if (bar && !bar.contains(ev.target)) closeSearchResults();
  }, true);

  updateRegexButtonState();
}

/* ---------------------------------------------------------------------------
 * 12. Tab rail
 * ------------------------------------------------------------------------ */

const GROUP_ICONS = {
  'Overview': 'ui-home',
  'Get the game': 'ui-download',
  'Preferences': 'ui-gear',
};
const ARTICLE_ICON_HINTS = [
  [/start|begin|intro|first/i, 'ui-book'],
  [/farm|crop|animal|field/i, 'ui-sprout'],
  [/craft|workshop|build|recipe|factor/i, 'ui-hammer'],
  [/logist|ship|order|train|boat|truck|transport/i, 'ui-truck'],
  [/town|zoo|city|communit/i, 'ui-town'],
  [/explor|expedit|mine|island|museum|fish/i, 'ui-compass'],
  [/social|co-?op|neighbour|neighbor|regatta/i, 'ui-users'],
  [/dead|idle|offline|timer|wait/i, 'ui-clock'],
  [/architect|module|code|state|render/i, 'ui-code'],
  [/change|release|history|version/i, 'ui-history'],
];

function iconFor(article) {
  if (GROUP_ICONS[article.group] && (article.id === 'home' || article.id === 'download' || article.id === 'settings')) {
    return GROUP_ICONS[article.group];
  }
  const probe = article.id + ' ' + article.title + ' ' + article.group;
  for (const [re, name] of ARTICLE_ICON_HINTS) if (re.test(probe)) return name;
  return 'ui-book';
}

function buildRail() {
  const strip = $('#railStrip');
  clear(strip);
  let lastGroup = null;
  for (const a of articles) {
    if (a.group !== lastGroup) {
      lastGroup = a.group;
      strip.appendChild(el('div', { class: 'rail-group', role: 'presentation', text: a.group }));
    }
    const tab = el('a', {
      class: 'tab',
      role: 'tab',
      href: '#/' + a.id,
      id: 'tab-' + a.id,
      'data-article': a.id,
      'aria-controls': 'docPanel',
      'aria-selected': 'false',
      'aria-label': a.title,
      title: a.title,
      tabindex: '-1',
    }, [icon(iconFor(a)), el('span', { class: 'tab-label', text: a.title })]);
    strip.appendChild(tab);
  }
  strip.setAttribute('aria-orientation', state.dock === 'top' || state.dock === 'bottom' ? 'horizontal' : 'vertical');
}

function railTabs() { return $$('.tab', $('#railStrip')); }

function setActiveTab(articleId) {
  for (const tab of railTabs()) {
    const on = tab.dataset.article === articleId;
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
    tab.tabIndex = on ? 0 : -1;
    if (on) {
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const panel = $('#docPanel');
      if (panel) panel.setAttribute('aria-labelledby', tab.id);
    }
  }
  updateRailOverflow();
}

function initRailKeyboard() {
  const strip = $('#railStrip');
  strip.addEventListener('keydown', (ev) => {
    const horizontal = strip.getAttribute('aria-orientation') === 'horizontal';
    const next = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prev = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const tabs = railTabs();
    const current = tabs.indexOf(document.activeElement);
    let target = -1;
    if (ev.key === next) target = current < 0 ? 0 : (current + 1) % tabs.length;
    else if (ev.key === prev) target = current < 0 ? tabs.length - 1 : (current - 1 + tabs.length) % tabs.length;
    else if (ev.key === 'Home') target = 0;
    else if (ev.key === 'End') target = tabs.length - 1;
    else return;
    ev.preventDefault();
    const tab = tabs[target];
    if (!tab) return;
    tab.focus();
    // Browser-tab behaviour: moving focus opens the tab, but traversal does not
    // pile up history entries.
    navigate('/' + tab.dataset.article, { replace: true, keepFocus: true });
  });
}

function updateRailOverflow() {
  const strip = $('#railStrip');
  const btn = $('#railOverflow');
  const count = $('#railOverflowCount');
  if (!strip || !btn) return;
  const horizontal = strip.getAttribute('aria-orientation') === 'horizontal';
  const drawer = window.matchMedia('(max-width: 720px)').matches;
  const overflowing = drawer ? false : horizontal
    ? strip.scrollWidth - strip.clientWidth > 2
    : strip.scrollHeight - strip.clientHeight > 2;
  btn.hidden = !overflowing;
  if (overflowing) count.textContent = ' (' + railTabs().length + ')';
}

function openRailOverflow() {
  const filter = el('input', {
    class: 'rb-pattern pop-filter', type: 'search', placeholder: 'Filter sections',
    'aria-label': 'Filter the list of sections', spellcheck: 'false',
  });
  const list = el('div', { class: 'pop-list' });

  const render = () => {
    clear(list);
    const q = filter.value.trim().toLowerCase();
    let shown = 0;
    for (const a of articles) {
      if (q && !(a.title + ' ' + a.group + ' ' + a.summary).toLowerCase().includes(q)) continue;
      shown += 1;
      const link = el('a', {
        class: 'tab', href: '#/' + a.id,
        'aria-current': a.id === currentArticleId() ? 'page' : null,
      }, [icon(iconFor(a)), el('span', { class: 'tab-label', text: a.title })]);
      link.addEventListener('click', () => closePopover());
      list.appendChild(link);
    }
    if (shown === 0) list.appendChild(el('p', { class: 'notice-empty', text: 'No section matches that filter.' }));
  };
  filter.addEventListener('input', render);
  render();

  openPopover({
    anchor: $('#railOverflow'),
    title: 'All sections',
    content: [filter, list],
  });
}

/* ---------------------------------------------------------------------------
 * 13. Built-in shell articles
 * ------------------------------------------------------------------------ */

const RELEASE = {
  version: 'v0.1.0',
  file: 'Farm.Tycoon-Setup-0.1.0.exe',
  size: 'about 114 MB',
  url: 'https://github.com/Ding-Ding-Projects/Farm-tycoon/releases/latest/download/Farm.Tycoon-Setup-0.1.0.exe',
};

const homeArticle = {
  id: 'home',
  title: 'Start here',
  group: 'Overview',
  summary: 'What this documentation covers and how to move around it.',
  builtIn: true,
  sections: [{ id: 'contents', heading: 'Everything in this reference', html: '' }],
  related: [],
  render(body) {
    clear(body);
    body.appendChild(el('p', {
      text: 'Farm Tycoon is a farm-and-town management game: a crop, animal and production loop ' +
            'with a town-building layer on top. Two things set it apart from the games it draws ' +
            'on. Buildings are crafted rather than bought — materials become components, ' +
            'components become a kit, and the kit places the factory. And every production ' +
            'building has its own minigame, with an effect only that factory has, always ' +
            'optional and never a gate on a recipe.',
    }));

    const groups = [];
    const seen = new Map();
    for (const a of articles) {
      if (!seen.has(a.group)) { seen.set(a.group, []); groups.push(a.group); }
      seen.get(a.group).push(a);
    }

    const sectionCount = articles.reduce((n, a) => n + a.sections.length, 0);
    const stats = el('div', { class: 'stat-row' }, [
      el('div', { class: 'stat' }, [
        el('div', { class: 'stat-num', text: String(articles.length) }),
        el('div', { class: 'stat-label', text: 'articles' }),
      ]),
      el('div', { class: 'stat' }, [
        el('div', { class: 'stat-num', text: String(sectionCount) }),
        el('div', { class: 'stat-label', text: 'sections' }),
      ]),
      el('div', { class: 'stat' }, [
        el('div', { class: 'stat-num', text: String(groups.length) }),
        el('div', { class: 'stat-label', text: 'groups' }),
      ]),
    ]);
    body.appendChild(stats);

    body.appendChild(el('h2', { id: 's-contents', text: 'Everything in this reference' }));

    if (articles.filter((a) => !a.builtIn).length === 0) {
      body.appendChild(el('div', { class: 'callout callout-warn' }, [
        icon('ui-warning'),
        el('div', {}, [
          el('p', { style: 'margin:0', text: 'No content articles have loaded yet. The shell is working, but every module under ./content/ is either missing or malformed. The Settings page lists exactly which, and why.' }),
        ]),
      ]));
    }

    const grid = el('div', { class: 'home-grid' });
    for (const g of groups) {
      const card = el('div', { class: 'home-group' });
      card.appendChild(el('h3', {}, [icon(GROUP_ICONS[g] || 'ui-book'), document.createTextNode(g)]));
      const ul = el('ul');
      for (const a of seen.get(g)) {
        ul.appendChild(el('li', {}, [
          el('a', { class: 'home-link', href: '#/' + a.id }, [
            document.createTextNode(a.title),
            el('span', { text: a.summary }),
          ]),
        ]));
      }
      card.appendChild(ul);
      grid.appendChild(card);
    }
    body.appendChild(grid);

    body.appendChild(el('h2', { id: 's-moving-around', text: 'Moving around' }));
    const dl = el('div', { class: 'table-scroll' });
    const table = el('table', {}, [
      el('thead', {}, [el('tr', {}, [el('th', { text: 'Action' }), el('th', { text: 'How' })])]),
      el('tbody', {}, [
        el('tr', {}, [el('td', { text: 'Jump anywhere' }), el('td', {}, [el('kbd', { text: 'Ctrl' }), document.createTextNode(' + '), el('kbd', { text: 'Shift' }), document.createTextNode(' + '), el('kbd', { text: 'F' }), document.createTextNode(' opens the command palette, which lists every article, every section and every setting.')])]),
        el('tr', {}, [el('td', { text: 'Search the text' }), el('td', { text: 'The field in the top bar searches every article body. Plain text by default; the button beside it opens a regular expression builder with a live preview.' })]),
        el('tr', {}, [el('td', { text: 'Move between tabs' }), el('td', { text: 'Arrow keys inside the tab strip. Up and down when it is docked to a side, left and right when it is docked to the top or bottom.' })]),
        el('tr', {}, [el('td', { text: 'Change how it looks' }), el('td', { text: 'The Settings tab: theme, accent colour, typeface, text size, density, and which edge the tab strip lives on.' })]),
        el('tr', {}, [el('td', { text: 'Link straight to a section' }), el('td', { text: 'Every section has its own address in the form #/article-id/section-id, so a link can point at the exact paragraph.' })]),
      ]),
    ]);
    dl.appendChild(table);
    body.appendChild(dl);
  },
};

const downloadArticle = {
  id: 'download',
  title: 'Download',
  group: 'Get the game',
  summary: 'The Windows installer, and exactly what to expect when you run it.',
  builtIn: true,
  sections: [{ id: 'installer', heading: 'The Windows installer', html: '' }],
  related: [],
  render(body) {
    clear(body);
    body.appendChild(el('h2', { id: 's-installer', text: 'The Windows installer' }));
    body.appendChild(el('p', {
      text: 'This is the only place in this site that links anywhere outside it. Everything ' +
            'else — the plan, the architecture, the changelog, the handoff notes — is written ' +
            'into these pages rather than left on a code host.',
    }));

    const card = el('div', { class: 'download-card' });
    card.appendChild(el('h3', { style: 'margin:0', text: 'Farm Tycoon ' + RELEASE.version + ' for Windows' }));
    card.appendChild(el('div', { class: 'download-meta' }, [
      el('span', { class: 'chip' }, [icon('ui-check', 'icon icon-sm'), document.createTextNode('Windows 10 and 11, 64-bit')]),
      el('span', { class: 'chip' }, [icon('ui-download', 'icon icon-sm'), document.createTextNode(RELEASE.file + ' · ' + RELEASE.size)]),
    ]));
    card.appendChild(el('a', {
      class: 'btn btn-filled', href: RELEASE.url, rel: 'noopener',
    }, [icon('ui-download'), document.createTextNode('Download ' + RELEASE.file)]));
    card.appendChild(el('p', { class: 'external-mark' }, [
      icon('ui-external', 'icon icon-sm'),
      document.createTextNode('This link leaves the documentation site and downloads the release artifact.'),
    ]));

    card.appendChild(el('div', { class: 'callout callout-warn', style: 'margin-top:16px' }, [
      icon('ui-warning'),
      el('div', {}, [
        el('p', { style: 'margin:0' }, [
          el('strong', { text: 'This installer is unsigned.' }),
          document.createTextNode(' Code signing is permanently out of scope for this project, so ' +
            'the file carries no publisher certificate and nothing about it has been verified by a ' +
            'certificate authority. Windows will show an "unknown publisher" warning, and ' +
            'SmartScreen may warn as well before it will run. That is the expected behaviour for ' +
            'an unsigned artifact — it is not a sign that the download is damaged, and it is not ' +
            'something a future release will quietly fix.'),
        ]),
      ]),
    ]));
    body.appendChild(card);

    body.appendChild(el('h2', { id: 's-what-you-get', text: 'What the installer contains' }));
    body.appendChild(el('p', {
      text: 'The desktop build packages the same code this documentation describes: plain ' +
            'JavaScript and a canvas renderer, wrapped for the desktop. There are no image or ' +
            'audio assets in it — every sprite is drawn in code and every sound is synthesised ' +
            'at runtime.',
    }));
    body.appendChild(el('div', { class: 'callout callout-info' }, [
      icon('ui-info'),
      el('div', {}, [
        el('p', { style: 'margin:0', text: 'Saves live in your browser or app profile as a single JSON blob with a version number, and older saves are migrated forward rather than discarded. Nothing is uploaded anywhere.' }),
      ]),
    ]));
  },
};

/* ---------------------------------------------------------------------------
 * 14. Settings article
 * ------------------------------------------------------------------------ */

const settingsSearchMode = { on: false, flags: 'i' };

const settingsArticle = {
  id: 'settings',
  title: 'Settings',
  group: 'Preferences',
  summary: 'Theme, accent colour, typeface, density, and where the tab strip lives.',
  builtIn: true,
  sections: [{ id: 'appearance', heading: 'Appearance', html: '' }],
  related: [],
  render(body) {
    clear(body);

    /* --- the settings page has its own search and its own builder -------- */
    const searchInput = el('input', {
      class: 'searchbar-input', id: 'settingsSearchInput', type: 'search', spellcheck: 'false',
      autocomplete: 'off', placeholder: 'Search settings',
      'aria-label': 'Search the settings on this page',
    });
    const searchRegexBtn = el('button', {
      class: 'searchbar-regex', type: 'button', id: 'settingsRegexBtn',
      'aria-expanded': 'false', 'aria-haspopup': 'dialog',
      'aria-label': 'Regular expression builder for the settings search',
    }, [icon('ui-regex', 'icon icon-sm'), el('span', { class: 'searchbar-regex-text', text: '.*' })]);
    const searchBar = el('div', { class: 'searchbar' }, [
      icon('ui-search', 'icon searchbar-icon'),
      searchInput,
      searchRegexBtn,
    ]);
    const searchWrap = el('div', { class: 'settings-search' }, [searchBar]);
    body.appendChild(searchWrap);

    const rowsByKey = new Map();
    const groups = [];
    const seen = new Map();
    for (const s of SETTINGS) {
      if (!seen.has(s.group)) { seen.set(s.group, []); groups.push(s.group); }
      seen.get(s.group).push(s);
    }

    for (const g of groups) {
      const section = el('section', { class: 'set-group' });
      section.appendChild(el('h2', { id: 's-' + slug(g), text: g }));
      for (const s of seen.get(g)) {
        const row = buildSettingRow(s);
        rowsByKey.set(s.key, row);
        section.appendChild(row);
      }
      body.appendChild(section);
    }

    /* --- reset everything ------------------------------------------------ */
    const resetSection = el('section', { class: 'set-group' });
    resetSection.appendChild(el('h2', { id: 's-your-data', text: 'Your data' }));
    const resetRow = el('div', { class: 'set-row', id: 'set-reset' }, [
      el('div', {}, [
        el('p', { class: 'set-label', text: 'Reset every appearance setting' }),
        el('p', { class: 'set-desc', text: 'Puts theme, accent, typeface, size, density, tab position, motion and notifications back to how they shipped.' }),
        (() => {
          const d = el('details', { class: 'set-more' });
          d.appendChild(el('summary', { text: 'What does this do?' }));
          d.appendChild(el('div', {
            text: 'It removes this site\'s entries from your browser\'s local storage and ' +
                  'restores the defaults immediately. It touches nothing else in your browser, ' +
                  'sends nothing anywhere, and cannot affect the game\'s own save data, which ' +
                  'the documentation site never reads or writes.',
          }));
          return d;
        })(),
      ]),
      el('div', { class: 'set-control' }, [
        (() => {
          const b = el('button', { class: 'btn btn-outlined', type: 'button' }, [icon('ui-reset', 'icon icon-sm'), document.createTextNode('Reset all settings')]);
          b.addEventListener('click', () => {
            for (const s of SETTINGS) { state[s.key] = s.def; store.remove('setting:' + s.key); }
            applySettings();
            notify('Settings reset', 'Every appearance preference is back to its shipped value.', 'ok');
            renderRoute({ force: true });
          });
          return b;
        })(),
        el('p', {
          class: 'set-value',
          text: store.available
            ? 'Preferences are stored in this browser only (local storage).'
            : 'Local storage is unavailable here, so preferences last for this visit only.',
        }),
      ]),
    ]);
    resetSection.appendChild(resetRow);
    rowsByKey.set('__reset', resetRow);
    body.appendChild(resetSection);

    /* --- content diagnostics -------------------------------------------- */
    const diag = el('section', { class: 'set-group' });
    diag.appendChild(el('h2', { id: 's-content-modules', text: 'Content modules' }));
    const diagRow = el('div', { class: 'set-row', id: 'set-diagnostics' });
    const diagLeft = el('div');
    diagLeft.appendChild(el('p', { class: 'set-label', text: 'Article module status' }));
    diagLeft.appendChild(el('p', {
      class: 'set-desc',
      text: 'Each article is a separate ES module under ./content/. The shell loads them one by ' +
            'one and keeps going when one is missing or malformed, so a broken module never ' +
            'takes the site down. Anything it could not use is listed here.',
    }));
    const diagMore = el('details', { class: 'set-more' });
    diagMore.appendChild(el('summary', { text: 'What does this do?' }));
    diagMore.appendChild(el('div', {
      text: 'This is a status readout rather than a setting, and there is nothing here to change. ' +
            'Every module must export an object called `article` carrying an id, a title, a group, ' +
            'a one-sentence summary and at least one section with its own id, heading and HTML. A ' +
            'module that is absent, that fails to parse, that exports the wrong shape, or that ' +
            'claims an id another article already uses is skipped with the reason shown here, and ' +
            'the rest of the site carries on as normal.',
    }));
    diagLeft.appendChild(diagMore);
    if (contentProblems.length === 0) {
      diagLeft.appendChild(el('div', { class: 'callout callout-ok', style: 'margin-top:12px' }, [
        icon('ui-check'),
        el('div', { text: 'All ' + CONTENT_PATHS.length + ' expected modules loaded and validated.' }),
      ]));
    } else {
      const ul = el('ul');
      for (const p of contentProblems) {
        ul.appendChild(el('li', {}, [el('code', { text: p.path }), document.createTextNode(' — ' + p.detail)]));
      }
      diagLeft.appendChild(el('div', { class: 'callout callout-warn', style: 'margin-top:12px' }, [
        icon('ui-warning'),
        el('div', {}, [
          el('p', { style: 'margin:0 0 6px', text: contentProblems.length + ' of ' + CONTENT_PATHS.length + ' modules could not be used:' }),
          ul,
        ]),
      ]));
    }
    diagRow.appendChild(diagLeft);
    diagRow.appendChild(el('div', { class: 'set-control' }, [
      el('p', { class: 'set-value', text: articles.filter((a) => !a.builtIn).length + ' content articles loaded' }),
    ]));
    diag.appendChild(diagRow);
    rowsByKey.set('__diag', diagRow);
    body.appendChild(diag);

    /* --- wire the settings search ---------------------------------------- */
    const settingsCorpus = () => SETTINGS.map((s) => ({
      label: s.group + ' › ' + s.label,
      text: s.label + '. ' + s.desc + ' ' + s.help + ' ' + s.keywords,
    }));

    const applyFilter = () => {
      const q = searchInput.value.trim();
      searchBar.classList.remove('is-invalid');
      let matcher = null;
      if (q && settingsSearchMode.on) {
        const compiled = compilePattern(q, settingsSearchMode.flags);
        if (compiled.error) {
          searchBar.classList.add('is-invalid');
          return;
        }
        matcher = (text) => Boolean(firstRegexHit(compiled.re, text));
      } else if (q) {
        const needle = q.toLowerCase();
        matcher = (text) => text.toLowerCase().includes(needle);
      }

      let visible = 0;
      for (const s of SETTINGS) {
        const row = rowsByKey.get(s.key);
        const hay = s.label + ' ' + s.desc + ' ' + s.help + ' ' + s.keywords + ' ' + s.group;
        const show = !matcher || matcher(hay);
        row.hidden = !show;
        if (show) visible += 1;
      }
      for (const extra of ['__reset', '__diag']) {
        const row = rowsByKey.get(extra);
        if (row) row.hidden = Boolean(matcher);
      }
      for (const section of $$('.set-group', body)) {
        const rows = $$('.set-row', section);
        section.hidden = rows.length > 0 && rows.every((r) => r.hidden);
      }
      const existing = $('#settingsNoMatch', body);
      if (existing) existing.remove();
      if (matcher && visible === 0) {
        body.appendChild(el('p', { id: 'settingsNoMatch', class: 'sr-empty', text: 'No setting matches that.' }));
      }
    };

    searchInput.addEventListener('input', applyFilter);
    attachRegexBuilder({
      button: searchRegexBtn,
      input: searchInput,
      corpus: settingsCorpus,
      mode: settingsSearchMode,
      onChange: () => {
        searchRegexBtn.classList.toggle('is-on', settingsSearchMode.on);
        applyFilter();
      },
    });
  },
};

function buildSettingRow(s) {
  const row = el('div', { class: 'set-row', id: 'set-' + s.key, tabindex: '-1' });

  const left = el('div');
  left.appendChild(el('p', { class: 'set-label', id: 'setlabel-' + s.key, text: s.label }));
  left.appendChild(el('p', { class: 'set-desc', text: s.desc }));
  const more = el('details', { class: 'set-more' });
  more.appendChild(el('summary', { text: 'What does this do?' }));
  more.appendChild(el('div', { text: s.help }));
  left.appendChild(more);
  row.appendChild(left);

  const control = el('div', { class: 'set-control' });
  const changed = () => {
    const isDefault = JSON.stringify(state[s.key]) === JSON.stringify(s.def);
    resetBtn.disabled = isDefault;
    resetBtn.style.visibility = isDefault ? 'hidden' : 'visible';
  };

  const resetBtn = el('button', {
    class: 'btn btn-text btn-sm', type: 'button',
    'aria-label': 'Reset ' + s.label + ' to its default',
  }, [icon('ui-reset', 'icon icon-sm'), document.createTextNode('Reset')]);
  resetBtn.addEventListener('click', () => { resetSetting(s.key); renderRoute({ force: true, keepScroll: true }); });

  if (s.type === 'segmented') {
    const grp = el('div', { class: 'segmented', role: 'group', 'aria-labelledby': 'setlabel-' + s.key });
    for (const o of s.options) {
      const b = el('button', {
        type: 'button',
        'aria-pressed': state[s.key] === o.v ? 'true' : 'false',
        'aria-label': o.l,
      }, [o.icon ? icon(o.icon, 'icon icon-sm') : null, el('span', { text: o.l })]);
      b.addEventListener('click', () => {
        setSetting(s.key, o.v);
        for (const sib of $$('button', grp)) sib.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
        changed();
      });
      grp.appendChild(b);
    }
    control.appendChild(grp);
  } else if (s.type === 'select') {
    const sel = el('select', { class: 'field', 'aria-labelledby': 'setlabel-' + s.key });
    for (const o of s.options) sel.appendChild(el('option', { value: o.v, text: o.l, selected: state[s.key] === o.v }));
    sel.value = state[s.key];
    const preview = el('div', { class: 'font-preview' }, [
      el('strong', { text: 'The barn holds 250 crates' }),
      el('span', { text: 'Wheat, corn and carrots ripen on a wall-clock timer — 0123456789.' }),
    ]);
    const syncPreview = () => { preview.style.fontFamily = FONT_STACKS[sel.value] || 'inherit'; };
    syncPreview();
    sel.addEventListener('change', () => { setSetting(s.key, sel.value); syncPreview(); changed(); });
    control.appendChild(sel);
    if (s.key === 'fontFamily') control.appendChild(preview);
  } else if (s.type === 'range') {
    const out = el('span', { class: 'set-value', text: state[s.key] + (s.unit || '') });
    const range = el('input', {
      class: 'field', type: 'range', min: s.min, max: s.max, step: s.step,
      value: state[s.key], 'aria-labelledby': 'setlabel-' + s.key,
    });
    range.addEventListener('input', () => {
      out.textContent = range.value + (s.unit || '');
      setSetting(s.key, Number(range.value));
      changed();
    });
    control.appendChild(range);
    control.appendChild(out);
  } else if (s.type === 'switch') {
    const input = el('input', { type: 'checkbox', id: 'switch-' + s.key });
    input.checked = Boolean(state[s.key]);
    input.addEventListener('change', () => { setSetting(s.key, input.checked); changed(); });
    control.appendChild(el('label', { class: 'switch', for: 'switch-' + s.key }, [
      input,
      el('span', { class: 'switch-track', 'aria-hidden': 'true' }),
      el('span', { text: s.label }),
    ]));
  } else if (s.type === 'color') {
    control.appendChild(buildColourPicker(s, changed));
  }

  control.appendChild(el('div', { class: 'set-foot' }, [resetBtn]));
  row.appendChild(control);
  changed();
  return row;
}

/* Eight hues that clear AA as link text in the light scheme as chosen, and
   adapt cleanly in the dark one. */
const ACCENT_PRESETS = ['#427d12', '#2f7d5a', '#0f6f92', '#4f4bb8', '#7a3fa8', '#a03a10', '#8a5a0c', '#5c4632'];

function buildColourPicker(setting, changed) {
  const wrap = el('div', { class: 'picker' });
  let { h, s: sat, v } = rgbToHsv(hexToRgb(state[setting.key]) || hexToRgb(setting.def));

  const thumb = el('div', { class: 'picker-thumb' });
  const area = el('div', {
    class: 'picker-area', tabindex: '0', role: 'group',
    'aria-label': 'Saturation and brightness field. Drag, or use the arrow keys. The sliders below set the same values by name.',
  }, [thumb]);

  const hue = el('input', {
    class: 'picker-hue', type: 'range', min: '0', max: '360', step: '1',
    'aria-label': 'Hue, 0 to 360 degrees',
  });
  const satRange = el('input', { class: 'field', type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Saturation, percent' });
  const valRange = el('input', { class: 'field', type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Brightness, percent' });

  const hexField = el('input', { class: 'field', type: 'text', spellcheck: 'false', 'aria-label': 'Hex value' });
  const rgbField = el('input', { class: 'field', type: 'text', spellcheck: 'false', 'aria-label': 'RGB value' });
  const hslField = el('input', { class: 'field', type: 'text', spellcheck: 'false', 'aria-label': 'HSL value' });

  const readout = el('div', { class: 'contrast-readout' });


  function currentHex() { return rgbToHex(hsvToRgb({ h, s: sat, v })); }

  /**
   * @param {object} opts
   * @param {boolean} opts.writeFields  refresh the hex/RGB/HSL boxes
   * @param {boolean} opts.commit       write the value through to the setting.
   *   The first paint only mirrors the stored value into the controls, so
   *   merely opening this page never counts as choosing a colour.
   */
  function paint({ writeFields = true, commit = true } = {}) {
    const hex = currentHex();
    area.style.setProperty('--picker-hue-color', 'hsl(' + Math.round(h) + ' 100% 50%)');
    thumb.style.left = (sat * 100) + '%';
    thumb.style.top = ((1 - v) * 100) + '%';
    thumb.style.background = hex;
    hue.value = String(Math.round(h));
    satRange.value = String(Math.round(sat * 100));
    valRange.value = String(Math.round(v * 100));
    if (writeFields) {
      const rgb = hexToRgb(hex);
      const hsl = rgbToHsl(rgb);
      hexField.value = hex;
      rgbField.value = 'rgb(' + Math.round(rgb.r) + ', ' + Math.round(rgb.g) + ', ' + Math.round(rgb.b) + ')';
      hslField.value = 'hsl(' + Math.round(hsl.h) + ', ' + Math.round(hsl.s * 100) + '%, ' + Math.round(hsl.l * 100) + '%)';
    }
    if (commit) setSetting(setting.key, hex);
    paintReadout(hex);
    for (const sw of $$('.swatch', wrap)) sw.setAttribute('aria-pressed', sw.dataset.hex === hex ? 'true' : 'false');
    changed();
  }

  function paintReadout(chosenHex) {
    clear(readout);
    const styles = getComputedStyle(document.documentElement);
    const used = renderedAccent();
    const onAccent = styles.getPropertyValue('--c-on-accent').trim() || '#ffffff';
    const surface = styles.getPropertyValue('--c-surface').trim() || SURFACE_LIGHT;
    const scheme = resolvedTheme();

    readout.appendChild(el('div', { class: 'contrast-line' }, [
      el('span', { text: 'Rendered in the ' + scheme + ' scheme' }),
      el('span', { class: 'contrast-ratio', text: used }),
    ]));
    if (used.toLowerCase() !== String(chosenHex).toLowerCase()) {
      readout.appendChild(el('p', {
        class: 'rb-note', style: 'margin:0',
        text: 'You chose ' + chosenHex + '. In this scheme that would leave link text below 4.5:1, ' +
              'so the same hue is being rendered at a readable lightness. Your choice is kept, and ' +
              'the other scheme adapts on its own terms.',
      }));
    }

    const rows = [
      { label: 'Button text on the accent', ratio: contrastRatio(used, onAccent) },
      { label: 'Link text on the page surface', ratio: contrastRatio(used, surface) },
    ];
    for (const r of rows) {
      const pass = r.ratio >= 4.5;
      readout.appendChild(el('div', { class: 'contrast-line' }, [
        el('span', { text: r.label }),
        el('span', {}, [
          el('span', { class: 'contrast-ratio', text: r.ratio.toFixed(2) + ':1 ' }),
          el('span', { class: pass ? 'pill-pass' : 'pill-fail', text: pass ? 'AA' : 'below AA' }),
        ]),
      ]));
    }
    readout.appendChild(el('p', {
      class: 'rb-note', style: 'margin:4px 0 0',
      text: 'Measured against the colours this page is painting right now, not against the ones ' +
            'it intended to. A failing ratio here is a real one.',
    }));
  }

  /* pointer + keyboard on the 2D field */
  function setFromPointer(ev) {
    const r = area.getBoundingClientRect();
    sat = clamp((ev.clientX - r.left) / r.width, 0, 1);
    v = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1);
    paint();
  }
  area.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    area.setPointerCapture(ev.pointerId);
    setFromPointer(ev);
  });
  area.addEventListener('pointermove', (ev) => {
    if (!area.hasPointerCapture || !area.hasPointerCapture(ev.pointerId)) return;
    setFromPointer(ev);
  });
  area.addEventListener('keydown', (ev) => {
    const step = ev.shiftKey ? 0.1 : 0.01;
    if (ev.key === 'ArrowLeft') sat = clamp(sat - step, 0, 1);
    else if (ev.key === 'ArrowRight') sat = clamp(sat + step, 0, 1);
    else if (ev.key === 'ArrowUp') v = clamp(v + step, 0, 1);
    else if (ev.key === 'ArrowDown') v = clamp(v - step, 0, 1);
    else return;
    ev.preventDefault();
    paint();
  });

  hue.addEventListener('input', () => { h = Number(hue.value); paint(); });
  satRange.addEventListener('input', () => { sat = Number(satRange.value) / 100; paint(); });
  valRange.addEventListener('input', () => { v = Number(valRange.value) / 100; paint(); });

  hexField.addEventListener('input', () => {
    const rgb = hexToRgb(hexField.value);
    if (!rgb) return;
    ({ h, s: sat, v } = rgbToHsv(rgb));
    paint({ writeFields: false });
  });
  rgbField.addEventListener('input', () => {
    const m = /(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/.exec(rgbField.value);
    if (!m) return;
    ({ h, s: sat, v } = rgbToHsv({ r: +m[1], g: +m[2], b: +m[3] }));
    paint({ writeFields: false });
  });
  hslField.addEventListener('input', () => {
    const m = /(\d{1,3})\D+(\d{1,3})\D*%\D+(\d{1,3})\D*%/.exec(hslField.value);
    if (!m) return;
    ({ h, s: sat, v } = rgbToHsv(hslToRgb({ h: +m[1], s: +m[2] / 100, l: +m[3] / 100 })));
    paint({ writeFields: false });
  });
  for (const f of [hexField, rgbField, hslField]) {
    f.addEventListener('blur', () => paint());
  }

  const swatches = el('div', { class: 'picker-swatches', role: 'group', 'aria-label': 'Suggested accent colours' });
  for (const preset of ACCENT_PRESETS) {
    const b = el('button', {
      class: 'swatch', type: 'button', 'data-hex': preset,
      style: 'background:' + preset, 'aria-pressed': 'false',
      'aria-label': 'Use ' + preset,
      title: preset,
    });
    b.addEventListener('click', () => {
      ({ h, s: sat, v } = rgbToHsv(hexToRgb(preset)));
      paint();
    });
    swatches.appendChild(b);
  }

  wrap.appendChild(area);
  wrap.appendChild(hue);
  wrap.appendChild(el('div', { class: 'picker-fields' }, [
    el('label', {}, [document.createTextNode('Saturation'), satRange]),
    el('label', {}, [document.createTextNode('Brightness'), valRange]),
  ]));
  wrap.appendChild(el('div', { class: 'picker-fields' }, [
    el('label', {}, [document.createTextNode('Hex'), hexField]),
    el('label', {}, [document.createTextNode('RGB'), rgbField]),
    el('label', {}, [document.createTextNode('HSL'), hslField]),
  ]));
  wrap.appendChild(swatches);
  wrap.appendChild(readout);

  paint({ commit: false });
  return wrap;
}

/* ---------------------------------------------------------------------------
 * 15. Router and article rendering
 * ------------------------------------------------------------------------ */

function currentRoute() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw || raw === '/' ) return { articleId: 'home', targetId: null };
  const parts = raw.replace(/^\//, '').split('/').filter(Boolean);
  return { articleId: parts[0] || 'home', targetId: parts[1] || null };
}

function currentArticleId() { return currentRoute().articleId; }

function navigate(route, { replace = false, keepFocus = false } = {}) {
  const target = '#' + route;
  if (location.hash === target) { renderRoute({ force: true, keepFocus }); return; }
  if (replace) {
    history.replaceState(null, '', target);
    renderRoute({ keepFocus });
  } else {
    location.hash = target;
  }
}

let lastRenderedRoute = null;

function renderRoute({ force = false, keepFocus = false, keepScroll = false } = {}) {
  const { articleId, targetId } = currentRoute();
  const article = byId.get(articleId);

  if (!article) {
    notify('Unknown page', 'There is no article with the id "' + articleId + '". Showing the start page instead.', 'warn');
    navigate('/home', { replace: true });
    return;
  }

  const routeKey = articleId + '/' + (targetId || '');
  const scrollTop = keepScroll ? $('#doc-main').scrollTop : 0;
  if (routeKey !== lastRenderedRoute || force) {
    renderArticle(article);
    lastRenderedRoute = routeKey;
  }

  setActiveTab(articleId);
  document.title = article.title + ' — Farm Tycoon documentation';
  closeSearchResults();
  closeRailDrawer();

  const main = $('#doc-main');
  if (targetId) {
    requestAnimationFrame(() => teleport(targetId, { focus: !keepFocus }));
  } else if (keepScroll) {
    main.scrollTop = scrollTop;
  } else {
    main.scrollTop = 0;
  }
}

/** Reveal, focus and briefly highlight an element by id or section id. */
function teleport(rawId, { focus = true } = {}) {
  const candidates = [rawId, 's-' + rawId, 'set-' + rawId, 'sec-' + rawId];
  let node = null;
  for (const id of candidates) {
    node = document.getElementById(id);
    if (node) break;
  }
  if (!node) return false;

  const details = node.closest('details');
  if (details && !details.open) details.open = true;

  node.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  if (focus) {
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    try { node.focus({ preventScroll: true }); } catch (_) { node.focus(); }
  }
  node.classList.remove('teleport-flash');
  void node.offsetWidth;
  node.classList.add('teleport-flash');
  setTimeout(() => node.classList.remove('teleport-flash'), 1700);
  return true;
}

function renderArticle(article) {
  const panel = $('#docPanel');
  clear(panel);

  const head = el('header', { class: 'article-head' }, [
    el('p', { class: 'article-kicker' }, [icon(iconFor(article), 'icon icon-sm'), document.createTextNode(article.group)]),
    el('h1', { class: 'article-title', text: article.title }),
    el('p', { class: 'article-summary', text: article.summary }),
  ]);

  const body = el('div', { class: 'article-body' });

  if (typeof article.render === 'function') {
    article.render(body);
  } else {
    for (const section of article.sections) {
      const h = el('h2', { id: 's-' + section.id, text: section.heading });
      const anchor = el('a', {
        class: 'section-anchor', href: '#/' + article.id + '/' + section.id,
        'aria-label': 'Link to the section "' + section.heading + '"',
        text: '#',
      });
      h.appendChild(anchor);
      body.appendChild(h);
      const holder = el('div');
      holder.innerHTML = section.html;
      // Wide tables scroll inside their own container, never the page body.
      for (const table of $$('table', holder)) {
        if (table.parentElement && table.parentElement.classList.contains('table-scroll')) continue;
        const scroller = el('div', { class: 'table-scroll' });
        table.parentNode.insertBefore(scroller, table);
        scroller.appendChild(table);
      }
      while (holder.firstChild) body.appendChild(holder.firstChild);
    }
  }

  const wrap = el('article', { class: 'article' }, [head, body]);
  const related = buildRelated(article);
  if (related) wrap.appendChild(related);
  panel.appendChild(wrap);
}

function buildRelated(article) {
  let targets = (article.related || []).map((id) => byId.get(id)).filter(Boolean);
  let note = 'Where to go next.';
  if (targets.length === 0) {
    targets = articles.filter((a) => a.group === article.group && a.id !== article.id).slice(0, 3);
    note = 'More in ' + article.group + '.';
  }
  if (targets.length === 0) {
    targets = articles.filter((a) => a.id !== article.id && !a.builtIn).slice(0, 3);
    note = 'Elsewhere in the documentation.';
  }
  if (targets.length === 0) {
    // Last resort, so no page is ever a dead end: anything at all but this one.
    targets = articles.filter((a) => a.id !== article.id).slice(0, 3);
    note = 'Elsewhere in the documentation.';
  }
  if (targets.length === 0) return null;

  const grid = el('div', { class: 'related-grid' });
  for (const t of targets) {
    grid.appendChild(el('a', { class: 'related-card', href: '#/' + t.id }, [
      el('span', { class: 'related-card-group', text: t.group }),
      el('span', { class: 'related-card-title', text: t.title }),
      el('span', { class: 'related-card-sum', text: t.summary }),
    ]));
  }
  return el('section', { class: 'related' }, [
    el('h2', { class: 'related-title', text: 'Suggested articles' }),
    el('p', { class: 'related-note', text: note }),
    grid,
  ]);
}

/* ---------------------------------------------------------------------------
 * 16. Command palette
 * ------------------------------------------------------------------------ */

function paletteEntries() {
  const entries = [];
  for (const a of articles) {
    entries.push({ kind: 'Article', title: a.title, sub: a.group + ' — ' + a.summary, route: '/' + a.id, icon: iconFor(a) });
    for (const s of a.sections) {
      if (a.builtIn && !s.heading) continue;
      entries.push({ kind: 'Section', title: s.heading, sub: a.title, route: '/' + a.id + '/' + s.id, icon: 'ui-chevron-right' });
    }
  }
  for (const s of SETTINGS) {
    entries.push({ kind: 'Setting', title: s.label, sub: 'Settings — ' + s.group, route: '/settings/set-' + s.key, icon: 'ui-gear' });
  }
  entries.push({ kind: 'Setting', title: 'Reset every appearance setting', sub: 'Settings — Your data', route: '/settings/set-reset', icon: 'ui-reset' });
  entries.push({ kind: 'Setting', title: 'Article module status', sub: 'Settings — Content modules', route: '/settings/set-diagnostics', icon: 'ui-info' });

  const actions = [
    { title: 'Switch to the light theme', run: () => setSetting('theme', 'light'), icon: 'ui-sun' },
    { title: 'Switch to the dark theme', run: () => setSetting('theme', 'dark'), icon: 'ui-moon' },
    { title: 'Follow the system theme', run: () => setSetting('theme', 'system'), icon: 'ui-monitor' },
    { title: 'Dock the tab strip to the left', run: () => setSetting('dock', 'left'), icon: 'ui-dock-left' },
    { title: 'Dock the tab strip to the top', run: () => setSetting('dock', 'top'), icon: 'ui-dock-top' },
    { title: 'Dock the tab strip to the right', run: () => setSetting('dock', 'right'), icon: 'ui-dock-right' },
    { title: 'Dock the tab strip to the bottom', run: () => setSetting('dock', 'bottom'), icon: 'ui-dock-bottom' },
    { title: 'Show the notification history', run: () => openNotificationHistory($('#notifyBtn')), icon: 'ui-bell' },
  ];
  for (const a of actions) entries.push({ kind: 'Action', title: a.title, sub: 'Runs immediately', run: a.run, icon: a.icon });
  return entries;
}

function scoreEntry(entry, query) {
  if (!query) return 1;
  const hay = (entry.title + ' ' + (entry.sub || '')).toLowerCase();
  const title = entry.title.toLowerCase();
  if (title.startsWith(query)) return 1000 - title.length;
  const idx = title.indexOf(query);
  if (idx > -1) return 700 - idx;
  if (hay.includes(query)) return 400;
  // subsequence fallback, so "arcmod" finds "Architecture — modules"
  let i = 0;
  for (const ch of hay) { if (ch === query[i]) i += 1; if (i === query.length) return 100; }
  return -1;
}

let paletteOpen = false;

function openPalette() {
  if (paletteOpen) return;
  paletteOpen = true;
  closePopover();

  const previouslyFocused = document.activeElement;
  const input = el('input', {
    class: 'palette-input', type: 'text', spellcheck: 'false', autocomplete: 'off',
    placeholder: 'Jump to an article, a section or a setting',
    'aria-label': 'Command palette search',
    role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'paletteList', 'aria-autocomplete': 'list',
  });
  const list = el('div', { class: 'palette-list', id: 'paletteList', role: 'listbox', 'aria-label': 'Results' });
  const panel = el('div', {
    class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette',
  }, [
    el('div', { class: 'palette-head' }, [
      input,
      el('p', { class: 'palette-hint', text: 'Everything in the site is here: every article, every section, every setting. Choosing one takes you to the exact element and highlights it.' }),
    ]),
    list,
    el('div', { class: 'palette-foot' }, [
      el('span', {}, [el('kbd', { text: '↑' }), document.createTextNode(' '), el('kbd', { text: '↓' }), document.createTextNode(' move')]),
      el('span', {}, [el('kbd', { text: 'Enter' }), document.createTextNode(' open')]),
      el('span', {}, [el('kbd', { text: 'Esc' }), document.createTextNode(' close')]),
    ]),
  ]);
  const scrim = el('div', { class: 'palette-scrim' }, [panel]);

  const all = paletteEntries();
  let shown = [];
  let active = 0;

  function render() {
    const q = input.value.trim().toLowerCase();
    shown = all
      .map((e) => ({ e, score: scoreEntry(e, q) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
      .map((r) => r.e);
    active = 0;
    clear(list);
    if (shown.length === 0) {
      list.appendChild(el('p', { class: 'sr-empty', text: 'Nothing matches that.' }));
      input.removeAttribute('aria-activedescendant');
      return;
    }
    shown.forEach((e, i) => {
      const item = el('button', {
        class: 'pal-item', type: 'button', role: 'option',
        id: 'pal-opt-' + i, 'aria-selected': i === 0 ? 'true' : 'false',
      }, [
        icon(e.icon || 'ui-chevron-right', 'icon icon-sm'),
        el('span', { class: 'pal-body' }, [
          el('span', { class: 'pal-title', text: e.title }),
          e.sub ? el('span', { class: 'pal-sub', text: e.sub }) : null,
        ]),
        el('span', { class: 'pal-kind', text: e.kind }),
      ]);
      item.addEventListener('click', () => choose(i));
      list.appendChild(item);
    });
    markActive();
  }

  function markActive() {
    const items = $$('.pal-item', list);
    items.forEach((it, i) => {
      it.classList.toggle('is-active', i === active);
      it.setAttribute('aria-selected', i === active ? 'true' : 'false');
    });
    if (items[active]) {
      items[active].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', items[active].id);
    }
  }

  function choose(i) {
    const entry = shown[i];
    if (!entry) return;
    close();
    if (typeof entry.run === 'function') entry.run();
    else navigate(entry.route);
  }

  function close() {
    if (!paletteOpen) return;
    paletteOpen = false;
    scrim.remove();
    document.removeEventListener('keydown', onKey, true);
    if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
  }

  function onKey(ev) {
    if (!paletteOpen) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); active = Math.min(active + 1, shown.length - 1); markActive(); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); active = Math.max(active - 1, 0); markActive(); return; }
    if (ev.key === 'Enter') { ev.preventDefault(); choose(active); return; }
    if (ev.key === 'Tab') {
      // Modal: keep focus inside.
      const focusables = $$('input, button', panel);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  }

  input.addEventListener('input', render);
  scrim.addEventListener('pointerdown', (ev) => { if (ev.target === scrim) close(); });
  document.addEventListener('keydown', onKey, true);

  $('#overlayRoot').appendChild(scrim);
  render();
  input.focus();
}

/* ---------------------------------------------------------------------------
 * 17. Drawer (narrow widths)
 * ------------------------------------------------------------------------ */

/* Below 720px the rail is slid off the left edge with a transform. A transform
   moves pixels and nothing else: every control inside it stays in the tab order
   and stays in the accessibility tree, so a keyboard user tabbing out of the app
   bar falls into a navigation drawer they cannot see, and a screen reader reads
   out a whole contents list that is not on screen. `inert` is the one thing that
   removes both at once, so it is kept in step with the drawer's own state. */
const drawerQuery = window.matchMedia('(max-width: 720px)');

function syncRailInert() {
  const rail = $('#rail');
  if (!rail) return;
  const hidden = drawerQuery.matches && !$('#app').classList.contains('rail-open');
  if (hidden) rail.setAttribute('inert', '');
  else rail.removeAttribute('inert');
}

function openRailDrawer() {
  const app = $('#app');
  app.classList.add('rail-open');
  $('#drawerBtn').setAttribute('aria-expanded', 'true');
  $('#railScrim').hidden = false;
  syncRailInert();
  const first = $('.tab', $('#railStrip'));
  if (first) first.focus();
}

function closeRailDrawer() {
  const app = $('#app');
  if (!app.classList.contains('rail-open')) return;
  // Take focus back out before the rail goes inert, or the browser drops it on
  // <body> and the next Tab starts again from the top of the document.
  const rail = $('#rail');
  const hadFocus = rail && rail.contains(document.activeElement);
  app.classList.remove('rail-open');
  $('#drawerBtn').setAttribute('aria-expanded', 'false');
  $('#railScrim').hidden = true;
  if (hadFocus) $('#drawerBtn').focus();
  syncRailInert();
}

/* ---------------------------------------------------------------------------
 * 18. Boot
 * ------------------------------------------------------------------------ */

function orderArticles(content) {
  const groupOrder = [];
  for (const a of content) if (!groupOrder.includes(a.group)) groupOrder.push(a.group);
  const sorted = [];
  for (const g of groupOrder) for (const a of content) if (a.group === g) sorted.push(a);
  return [homeArticle, ...sorted, downloadArticle, settingsArticle];
}

function initChrome() {
  $('#paletteBtn').addEventListener('click', openPalette);
  $('#notifyBtn').addEventListener('click', (ev) => openNotificationHistory(ev.currentTarget));
  $('#settingsBtn').addEventListener('click', () => navigate('/settings'));
  $('#railOverflow').addEventListener('click', openRailOverflow);
  $('#drawerBtn').addEventListener('click', () => {
    if ($('#app').classList.contains('rail-open')) closeRailDrawer(); else openRailDrawer();
  });
  $('#railClose').addEventListener('click', () => { closeRailDrawer(); $('#drawerBtn').focus(); });
  // A resize across the 720px line changes whether the rail is a drawer at all.
  if (drawerQuery.addEventListener) drawerQuery.addEventListener('change', syncRailInert);
  else if (drawerQuery.addListener) drawerQuery.addListener(syncRailInert);
  syncRailInert();
  $('#railScrim').addEventListener('click', closeRailDrawer);

  $('#themeBtn').addEventListener('click', () => {
    const order = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(state.theme) + 1) % order.length];
    setSetting('theme', next);
    if (currentArticleId() === 'settings') renderRoute({ force: true, keepScroll: true });
    notify('Theme: ' + next, next === 'system' ? 'Following whatever this device is set to.' : 'Using the ' + next + ' scheme.', 'info');
  });

  document.addEventListener('keydown', (ev) => {
    const key = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && key === 'f') {
      ev.preventDefault();
      openPalette();
      return;
    }
    if (ev.key === 'Escape') {
      closeRailDrawer();
      return;
    }
    if (ev.key === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const t = ev.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!typing) { ev.preventDefault(); $('#searchInput').focus(); }
    }
  });

  window.addEventListener('hashchange', () => renderRoute());
  window.addEventListener('resize', () => requestAnimationFrame(updateRailOverflow));
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => updateRailOverflow()).observe($('#railStrip'));
  }

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const onSchemeChange = () => {
    if (state.theme === 'system') {
      applyAccent(state.accent);
      if (currentArticleId() === 'settings') renderRoute({ force: true, keepScroll: true });
    }
  };
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSchemeChange);
  else if (darkQuery.addListener) darkQuery.addListener(onSchemeChange);
}

async function boot() {
  applySettings();
  initChrome();

  const content = await loadContent();
  articles = orderArticles(content);
  byId.set(homeArticle.id, homeArticle);
  byId.set(downloadArticle.id, downloadArticle);
  byId.set(settingsArticle.id, settingsArticle);

  for (const built of [homeArticle, downloadArticle, settingsArticle]) hydrateBuiltIn(built);

  buildSearchIndex();
  buildRail();
  initRailKeyboard();
  initSearch();
  // Give the first view a real address, so back/forward and copied links behave.
  if (!location.hash) history.replaceState(null, '', '#/home');
  renderRoute({ force: true });
  requestAnimationFrame(updateRailOverflow);

  if (contentProblems.length > 0) {
    notify(
      contentProblems.length + ' content module' + (contentProblems.length === 1 ? '' : 's') + ' could not be used',
      'The rest of the site is unaffected. Settings → Content modules lists each one and why.',
      'warn'
    );
  }
  if (!store.available) {
    notify('Preferences will not be saved', 'This browser is blocking site storage, so appearance changes last for this visit only.', 'info');
  }
}

boot().catch((err) => {
  const panel = document.getElementById('docPanel');
  if (panel) {
    panel.textContent = '';
    panel.appendChild(el('div', { class: 'article' }, [
      el('h1', { class: 'article-title', text: 'The documentation shell failed to start' }),
      el('p', { text: 'This is a defect in the site itself, not in your browser. The error was: ' + (err && err.message ? err.message : String(err)) }),
    ]));
  }
});
