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
python3 -m http.server 8123 &   # or: npm run serve
```

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
  await page.goto('http://localhost:8123', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // let the first frames render
  await page.screenshot({ path: 'game.png' });
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})();
EOF
```

Read `game.png` to inspect visually. Zero console errors is the bar — a module-load
failure renders a blank page silently otherwise.

## Electron

`npm install && npm start` needs a display; in headless containers use
`xvfb-run -a npm start` if xvfb is available, otherwise verify in the browser only
(Electron loads the identical files).
