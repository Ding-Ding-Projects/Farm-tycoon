---
name: run-game
description: Launch Farm Tycoon in a browser (headless or not), take screenshots, and check the console for errors. Use whenever you need to see the game running or verify a change visually.
---

# Run the game

The game is plain ES modules — no build step. It needs an HTTP server (module imports
fail on `file://` in some contexts).

## Serve

```bash
cd /path/to/Farm-tycoon
npm run serve    # python3 -m http.server 8123 under the hood
```

**Always browse to `http://127.0.0.1:8123`, never `http://localhost:8123`.** Verified trap: a
stale server left running from an earlier session can be bound to a different resolution of
`localhost` than the one your browser or `curl` picks, so the two ends up talking past each
other — one serves the file on disk, the other an old snapshot — with no error from either
side. `127.0.0.1` is unambiguous; `localhost` is not. If a page looks stale after an edit,
suspect a second `http.server` still running before suspecting your change:
`lsof -i :8123` / `netstat -ano | findstr :8123` (Windows) finds it.

## The debug hook

`src/main.js` exposes, on boot:

```js
window.__farmDebug = {
  get state() { /* live reference to the real state object */ },
  timeSkip(ms),       // shifts every stored readyAt back by ms, then re-ticks all systems
  give(itemId, qty),  // drops qty of itemId straight into silo or barn, whichever owns it
};
```

`timeSkip` is the whole offline-progress simulation in one call — it is exactly what a
real elapsed-wall-clock gap does on load.

**For anything beyond those three calls — driving `production.plant()`, reading
`production.growthStage()`, checking `economy` directly — don't reimplement the logic in your
probe. Dynamic-`import()` the real module from page context instead**, e.g. inside
`page.evaluate()`:

```js
const [state, production, economy, data] = await Promise.all(
  ['./src/state.js', './src/production.js', './src/economy.js', './src/data.js'].map((s) => import(s))
);
```

Dynamic `import()` from page context resolves against the already-loaded module graph, so
these are live references to the app's real running modules, not copies — the same technique
`tools/capture-screenshots.mjs` uses to drive the packaged build. A probe that reimplements a
module's math (recomputing a growth fraction, re-deriving a sell price) tests the probe, not
the module; call the export.

## Headless screenshot + console check (Playwright)

Chromium is preinstalled; do NOT run `playwright install`.

```bash
cd "$SCRATCHPAD" && npm init -y >/dev/null 2>&1 && npm i playwright >/dev/null 2>&1
node - <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch(); // finds /opt/pw-browsers via PLAYWRIGHT_BROWSERS_PATH
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:8123', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // let the first frames render
  await page.screenshot({ path: 'game.png' });
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})();
EOF
```

Read `game.png` to inspect visually. Zero console errors is the bar — a module-load
failure renders a blank page silently otherwise.

**Sampling trap:** if you `getImageData` the canvas right after fronting a tab/window, you can
read back an all-transparent frame mid-repaint. Take the PNG screenshot as ground truth for
pixel checks, or sample twice a beat apart, rather than trusting one immediate `getImageData`.

## The real game vs. static markup

`index.html` ships static placeholder text in the HUD (`0` coins, `0/50` silo) that only
becomes real once `ui.updateHud()` runs against live state. A boot that never wires the HUD
still renders a page with zero console errors — screenshotting it and eyeballing "looks like
the game" is not enough. See the `playtest` skill for the concrete assertion (real new-game
state is 150 coins / 5 diamonds / 6-of-50 silo, not zero).

## Electron

`npm install && npm start` launches the packaged shell (`electron/main.cjs` loads
`index.html` via `loadFile`, i.e. a `file://…/index.html` URL) — needs a display; in headless
containers use `xvfb-run -a npm start` if xvfb is available, otherwise verify in the browser
only (Electron loads the identical files, so a browser-clean boot is strong evidence).

To drive or screenshot the actual **packaged** artifact (`dist/win-unpacked/Farm Tycoon.exe`
or the installed app) rather than a dev launch, see the `release-ops` skill — it documents
the verified `--remote-debugging-port` + Chrome DevTools Protocol route, including the one
Node 26.x hang to avoid.
