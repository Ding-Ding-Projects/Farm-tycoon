/**
 * Desktop shell: the custom title bar and the update banner.
 *
 * Both exist only in the Electron build. `window.farmDesktop` is the preload bridge; when it is
 * absent (the browser build, the Android WebView) init() returns immediately and the page is
 * exactly what it always was. Nothing else in the game imports from here.
 */

const bridge = () => (typeof window !== 'undefined' ? window.farmDesktop : undefined);

export function isDesktop() { return !!bridge(); }

/** Build the title bar and wire the window buttons. Returns false when not on desktop. */
export function init() {
  const api = bridge();
  if (!api) return false;
  document.body.classList.add('is-desktop');

  const bar = document.createElement('div');
  bar.className = 'title-bar';
  bar.id = 'title-bar';
  bar.innerHTML = `
    <span class="title-bar-icon" aria-hidden="true">🚜</span>
    <span class="title-bar-name">Farm Tycoon</span>
    <span class="title-bar-version" id="title-bar-version"></span>
    <div class="title-bar-buttons">
      <button type="button" class="title-bar-btn" id="win-min" aria-label="Minimise">&#xE921;</button>
      <button type="button" class="title-bar-btn" id="win-max" aria-label="Maximise">&#xE922;</button>
      <button type="button" class="title-bar-btn danger" id="win-close" aria-label="Close">&#xE8BB;</button>
    </div>`;
  document.body.prepend(bar);

  const maxBtn = bar.querySelector('#win-max');
  // U+E922 is the "maximise" glyph and U+E923 the "restore" one; swapping them is the only
  // difference between the two states, so the button never lies about what it will do.
  const setMaximized = (on) => {
    maxBtn.innerHTML = on ? '&#xE923;' : '&#xE922;';
    maxBtn.setAttribute('aria-label', on ? 'Restore' : 'Maximise');
    document.body.classList.toggle('is-maximized', !!on);
  };
  bar.querySelector('#win-min').addEventListener('click', () => api.minimize());
  maxBtn.addEventListener('click', () => api.toggleMaximize());
  bar.querySelector('#win-close').addEventListener('click', () => api.close());
  bar.addEventListener('dblclick', (e) => {
    if (!e.target.closest('.title-bar-btn')) api.toggleMaximize();
  });
  api.onWindowState?.((s) => setMaximized(s && s.maximized));
  api.isMaximized?.().then(setMaximized).catch(() => {});
  api.version?.().then((v) => {
    const el = document.getElementById('title-bar-version');
    if (el && v) el.textContent = `v${v}`;
  }).catch(() => {});

  initUpdates(api);
  return true;
}

/**
 * The update banner. Non-blocking by contract: it never gates startup, never takes focus, and
 * restarting only ever happens because the player pressed the button.
 */
function initUpdates(api) {
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.id = 'update-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'status');
  banner.innerHTML = `
    <span class="update-icon" aria-hidden="true">⬇️</span>
    <div class="update-text">
      <strong id="update-title">Update ready</strong>
      <span id="update-note"></span>
    </div>
    <button type="button" class="btn-primary" id="update-restart">Restart to install</button>
    <button type="button" class="btn-ghost" id="update-later">Later</button>`;
  document.body.appendChild(banner);

  /**
   * Keep the banner clear of the dock.
   *
   * Both are anchored bottom-right, and the banner's z-index (9100) is above everything, so while
   * an update was ready it sat directly on the dock's buttons and took their clicks. The banner is
   * the more urgent surface, so it stays where it is and the dock is what it must not cover:
   * measure the dock and lift the banner above it. Measured rather than hard-coded, because the
   * dock's height changes with the safe-area inset and with how many buttons are unlocked.
   */
  function placeBanner() {
    if (banner.hidden) return;
    const dock = document.querySelector('.dock');
    const gap = 16;
    if (!dock || dock.hidden || typeof dock.getBoundingClientRect !== 'function') {
      banner.style.bottom = `${gap}px`;
      return;
    }
    const r = dock.getBoundingClientRect();
    if (!r.height) { banner.style.bottom = `${gap}px`; return; }
    // Only lift it if the two would actually overlap horizontally; a narrow layout stacks them
    // anyway and the extra gap would just waste space.
    const b = banner.getBoundingClientRect();
    const overlaps = b.right > r.left && b.left < r.right;
    banner.style.bottom = overlaps
      ? `${Math.round(window.innerHeight - r.top) + gap}px`
      : `${gap}px`;
  }

  window.addEventListener('resize', placeBanner);

  const title = banner.querySelector('#update-title');
  const note = banner.querySelector('#update-note');
  const restart = banner.querySelector('#update-restart');

  banner.querySelector('#update-later').addEventListener('click', () => { banner.hidden = true; });
  restart.addEventListener('click', () => api.restartToUpdate());

  // The error branch below auto-hides the banner after eight seconds. That timer has to be
  // cancelled by whatever state arrives next, or it hides a banner it was never about. Squirrel
  // emits a noisy error from the check subprocess and then succeeds, so the real sequence is
  // error -> ready: the ready banner appeared correctly and was then wiped eight seconds later by
  // the previous state's timer. Measured on a real 0.1.0 -> 0.1.89 upgrade against the live feed:
  // the title said "Update 0.1.89 ready", Restart was visible, and hidden was true - so the one
  // prompt the whole updater exists to show was the one thing the user never saw.
  let hideTimer = null;
  const clearHide = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };

  api.onUpdateState?.((s) => {
    const state = s && s.state;
    clearHide();
    if (state === 'ready') {
      title.textContent = s.version ? `Update ${s.version} ready` : 'Update ready';
      // Say plainly that the build is unsigned - Windows will warn, and a banner that implies a
      // verified publisher would be lying about the one thing the user is about to trust.
      note.textContent = 'Downloaded and staged. These builds are unsigned, so Windows may show an unknown-publisher warning.';
      restart.hidden = false;
      banner.hidden = false;
      placeBanner();
    } else if (state === 'error') {
      title.textContent = 'Update check failed';
      note.textContent = s.message || 'Could not reach the update feed.';
      restart.hidden = true;
      banner.hidden = false;
      placeBanner();
      hideTimer = setTimeout(() => { banner.hidden = true; hideTimer = null; }, 8000);
    }
    // 'checking', 'downloading', 'current' and 'unsupported' stay silent: an update nobody asked
    // about should not put a bar on screen until there is something to act on.
    lastState = state;
  });
}

let lastState = 'unknown';

/** What the settings panel's manual "Check for updates" reports back. */
export function updateState() { return lastState; }

/** Manual check, for the settings panel. Safe to call in the browser build (no-op). */
export function checkForUpdates() { bridge()?.checkForUpdates?.(); }
