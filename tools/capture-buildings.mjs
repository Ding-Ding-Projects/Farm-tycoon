#!/usr/bin/env node
// capture-buildings.mjs — renders every production building twice, idle and working, into one
// contact sheet so the art can be judged as pixels rather than as code.
//
// Why a sheet rather than a screenshot of the farm: the farm shows whichever four buildings the
// save happens to own, at whatever moment the frame lands. The claim being checked here is
// "these forty factories no longer read as one hut in different paint", and that claim is only
// falsifiable when they are all next to each other.
//
// It draws through the app's own sprites.js inside the running Electron page, so what lands in
// the PNG is the real renderer and not a reimplementation of it. Assumes the app was already
// launched headlessly with --remote-debugging-port on a task-only loopback port (see the
// run-lowlevel-headless-app skill); isolation is proven below before anything is drawn.
//
// Usage: node tools/capture-buildings.mjs [port] [outfile]

import { writeFileSync } from 'node:fs';

const PORT = process.argv[2] || '9222';
const OUT = process.argv[3] || 'screenshots/buildings-sheet.png';
const ENDPOINT = `http://127.0.0.1:${PORT}`;

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolve(msg);
      }
    });
  }

  static async connect() {
    const res = await fetch(`${ENDPOINT}/json/list`);
    if (!res.ok) throw new Error(`CDP /json/list HTTP ${res.status}`);
    const targets = await res.json();
    // Isolation proof: exactly one target, of page type. Finding one acceptable target among
    // several proves nothing, so this refuses rather than picking the convenient one.
    if (targets.length !== 1) throw new Error(`isolation failed: ${targets.length} CDP targets, expected 1`);
    const t = targets[0];
    if (t.type !== 'page') throw new Error(`isolation failed: target type "${t.type}"`);
    if (!t.webSocketDebuggerUrl) throw new Error('isolation failed: no webSocketDebuggerUrl');
    console.log(`[cdp] isolation proven: 1 page target, url=${t.url}`);
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }
      }, timeoutMs);
      this.pending.set(id, { resolve: (m) => { clearTimeout(timer); resolve(m); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // No awaitPromise: it can hang indefinitely on some Node/Electron pairs (recorded dead end).
  // Anything async on the page side sets a marker that pollUntilTrue reads synchronously.
  async evaluate(expression) {
    const msg = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (msg.error) throw new Error(`CDP protocol error: ${JSON.stringify(msg.error)}`);
    const r = msg.result;
    if (r.exceptionDetails) {
      throw new Error(`page exception: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    }
    return r.result?.value;
  }

  async pollUntilTrue(expression, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (await this.evaluate(expression)) return true;
      if (Date.now() > deadline) throw new Error(`timed out waiting for: ${expression}`);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

// The page-side draw. Kept as one string so it is a single Runtime.evaluate: every building,
// idle on the left of its cell and working on the right, with a caption underneath.
const DRAW = `
(() => {
  window.__sheet = 'loading';
  Promise.all([import('./src/render/sprites.js'), import('./src/data.js')]).then(([sprites, data]) => {
    const ids = Object.keys(data.BUILDINGS).sort();
    const COLS = 5, CELL_W = 320, CELL_H = 236, PAD = 24;
    const rows = Math.ceil(ids.length / COLS);
    const W = COLS * CELL_W + PAD * 2;
    const H = rows * CELL_H + PAD * 2 + 70;

    const cv = document.createElement('canvas');
    cv.id = '__sheet_canvas';
    cv.width = W; cv.height = H;
    Object.assign(cv.style, {
      position: 'fixed', inset: '0', zIndex: '99999',
      width: W + 'px', height: H + 'px', background: '#8ecb36',
    });
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#8ecb36';
    ctx.fillRect(0, 0, W, H);
    sprites.drawMeadow(ctx, W, H);

    ctx.fillStyle = '#3a2510';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Farm Tycoon buildings - left: idle   right: working', PAD, 46);

    // A fixed timestamp, not Date.now(), so two runs of this script are comparable. Chosen so
    // the smoke sits mid-rise and the wheels are visibly off their rest angle.
    const NOW = 1730;

    ids.forEach((id, i) => {
      const col = i % COLS, row = (i / COLS) | 0;
      const cx = PAD + col * CELL_W;
      const cy = PAD + 70 + row * CELL_H;

      ctx.save();
      ctx.strokeStyle = 'rgba(58,37,16,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 4, cy + 4, CELL_W - 8, CELL_H - 8);
      ctx.restore();

      sprites.drawBuilding(ctx, cx + CELL_W * 0.28, cy + CELL_H * 0.62, 0.78, id, { working: false, now: NOW });
      sprites.drawBuilding(ctx, cx + CELL_W * 0.74, cy + CELL_H * 0.62, 0.78, id, { working: true, now: NOW });

      ctx.fillStyle = '#3a2510';
      ctx.font = '15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.BUILDINGS[id].name || id, cx + CELL_W / 2, cy + CELL_H - 12);
    });

    window.__sheetSize = { w: W, h: H, count: ids.length };
    window.__sheet = 'ready';
  }).catch((e) => { window.__sheet = 'error: ' + (e && e.message); });
  return 'started';
})()
`;

async function main() {
  const cdp = await Cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.evaluate(DRAW);
  await cdp.pollUntilTrue("window.__sheet === 'ready' || String(window.__sheet).startsWith('error')");
  const status = await cdp.evaluate('window.__sheet');
  if (String(status).startsWith('error')) throw new Error(`page-side draw failed: ${status}`);

  const size = await cdp.evaluate('JSON.stringify(window.__sheetSize)');
  const { w, h, count } = JSON.parse(size);
  console.log(`[sheet] ${count} buildings drawn, ${w}x${h}`);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 1, mobile: false,
  });

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
    captureBeyondViewport: true,
  });
  if (!shot.result?.data) throw new Error('captureScreenshot returned no data');
  writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
  console.log(`[sheet] wrote ${OUT}`);

  // Leave the page as it was found, so a later capture run is not looking at this overlay.
  await cdp.evaluate("document.getElementById('__sheet_canvas')?.remove(); window.__sheet = null;");
  await cdp.send('Emulation.clearDeviceMetricsOverride');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
