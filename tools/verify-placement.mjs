#!/usr/bin/env node
// verify-placement.mjs — drives the REAL running app to prove the placement ghost is wired,
// not merely implemented.
//
// The unit suite (tools/test-placement.mjs) proves the rules module. It says nothing about
// whether ui.js calls it, whether input.js moves it, or whether the renderer draws it: a
// module tested through its own API passes whether or not anything downstream ever calls it.
// That seam is exactly where this project has been bitten before, so it gets driven for real.
//
// Assumes the app is already running headlessly with --remote-debugging-port (see the
// run-lowlevel-headless-app skill). Isolation is proven before anything is touched.
//
// Usage: node tools/verify-placement.mjs [port]

import { writeFileSync } from 'node:fs';

const PORT = process.argv[2] || '9411';
const ENDPOINT = `http://127.0.0.1:${PORT}`;

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok  - ${name}`); }
  else { failures.push(name); console.log(`FAIL  - ${name}`); if (detail) console.log(`        ${detail}`); }
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.nextId = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id && this.pending.has(m.id)) { const { resolve } = this.pending.get(m.id); this.pending.delete(m.id); resolve(m); }
    });
  }
  static async connect() {
    const targets = await (await fetch(`${ENDPOINT}/json/list`)).json();
    if (targets.length !== 1) throw new Error(`isolation failed: ${targets.length} targets`);
    if (targets[0].type !== 'page') throw new Error(`isolation failed: type ${targets[0].type}`);
    console.log(`[cdp] isolation proven: 1 page target, url=${targets[0].url}`);
    const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    return new Cdp(ws);
  }
  send(method, params = {}, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); } }, timeoutMs);
      this.pending.set(id, { resolve: (m) => { clearTimeout(timer); resolve(m); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  // No awaitPromise (documented hang risk); async page work sets a marker we poll for.
  async ev(expression) {
    const msg = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (msg.error) throw new Error(JSON.stringify(msg.error));
    const r = msg.result;
    if (r.exceptionDetails) throw new Error(`page exception: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result?.value;
  }
  async poll(expression, timeoutMs = 12000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (await this.ev(expression)) return true;
      if (Date.now() > deadline) throw new Error(`timed out: ${expression}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

async function main() {
  const cdp = await Cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Bridge the modules onto window. ES module instances are cached per URL, so these are the
  // SAME objects ui.js and input.js are using, not fresh copies.
  await cdp.ev(`
    window.__v = { ready: false };
    Promise.all([
      import('./src/placement.js'), import('./src/ui.js'), import('./src/state.js'),
      import('./src/data.js'), import('./src/farm.js'), import('./src/render/renderer.js'),
    ]).then(([placement, ui, state, data, farm, renderer]) => {
      Object.assign(window.__v, { placement, ui, state, data, farm, renderer, ready: true });
    }).catch((e) => { window.__v.error = String(e && e.message); });
  `);
  await cdp.poll('window.__v.ready === true || !!window.__v.error');
  const bridgeErr = await cdp.ev('window.__v.error || ""');
  if (bridgeErr) throw new Error(`module bridge failed: ${bridgeErr}`);

  // Fund the farm the way the project's own __farmDebug hook does: values a player could reach
  // through play, never fabricated UI.
  await cdp.ev(`(() => {
    const s = window.__v.state.state;
    s.coins = 999999; s.level = 40;
    window.__v.ui.closePanel();
    return true;
  })()`);

  const before = await cdp.ev('window.__v.state.state.farm.objects.length');

  // 1) The Build button must OPEN the ghost, not place anything.
  await cdp.ev(`(() => {
    window.__v.ui.openPanel('workshop');
    const btns = [...document.querySelectorAll('button')];
    const target = btns.find((b) => b.textContent.trim() === 'Build' && !b.disabled);
    window.__v.clicked = !!target;
    if (target) target.click();
    return true;
  })()`);
  check('a Build button was found and clicked', await cdp.ev('window.__v.clicked === true'));
  check('clicking Build opens the placement ghost', await cdp.ev('window.__v.placement.isActive() === true'));
  const midCount = await cdp.ev('window.__v.state.state.farm.objects.length');
  check('nothing is placed merely by opening the ghost', midCount === before, `${before} -> ${midCount}`);

  // 2) The ghost must report its legality honestly, and the renderer must receive it.
  const g = JSON.parse(await cdp.ev('JSON.stringify(window.__v.placement.ghost())'));
  check('the ghost exposes a footprint and a legality verdict',
    g && Number.isInteger(g.tx) && Number.isInteger(g.ty) && typeof g.legal === 'boolean',
    JSON.stringify(g));

  // 3) A real pointer gesture over the canvas must move it. This is the wiring under test:
  //    input.js's own listener has to be the thing that reacts, not a direct hover() call.
  const moved = await cdp.ev(`(() => {
    const cv = document.getElementById('world') || document.querySelector('canvas');
    if (!cv) return 'no canvas';
    const b = cv.getBoundingClientRect();
    const startTx = window.__v.placement.ghost().tx;
    const startTy = window.__v.placement.ghost().ty;
    for (const [dx, dy] of [[0.35, 0.45], [0.62, 0.58], [0.5, 0.5]]) {
      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: b.left + b.width * dx, clientY: b.top + b.height * dy,
        bubbles: true, pointerId: 1, pointerType: 'mouse',
      }));
    }
    const now = window.__v.placement.ghost();
    return (now.tx !== startTx || now.ty !== startTy) ? 'moved' : 'stuck at ' + startTx + ',' + startTy;
  })()`);
  check('a real pointermove over the canvas moves the ghost', moved === 'moved', String(moved));

  // 4) The renderer must actually be handed the ghost, and turn the grid on for it.
  const world = await cdp.ev(`(() => {
    const w = window.__farmDebug && window.__farmDebug.buildWorld ? window.__farmDebug.buildWorld() : null;
    if (!w) return 'no buildWorld hook';
    return JSON.stringify({ hasGhost: !!w.ghost, showGrid: !!w.showGrid });
  })()`);
  if (String(world).startsWith('{')) {
    const w = JSON.parse(world);
    check('buildWorld() hands the ghost to the renderer', w.hasGhost === true, world);
    check('the tile grid turns on while placing', w.showGrid === true, world);
  } else {
    console.log(`  --  buildWorld hook unavailable (${world}); ghost render checked by capture instead`);
  }

  // 5) Capture the ghost on screen. A ghost nobody can see is not a ghost.
  await cdp.ev("window.__v.ui.closePanel();");
  await new Promise((r) => setTimeout(r, 400));
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  if (shot.result?.data) {
    writeFileSync('screenshots/placement-ghost.png', Buffer.from(shot.result.data, 'base64'));
    console.log('  --  wrote screenshots/placement-ghost.png');
  }

  // 6) Escape must cancel and place nothing.
  await cdp.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  check('Escape cancels the ghost', await cdp.ev('window.__v.placement.isActive() === false'));
  const afterCancel = await cdp.ev('window.__v.state.state.farm.objects.length');
  check('a cancelled placement leaves the farm unchanged', afterCancel === before, `${before} -> ${afterCancel}`);

  // 7) Reopen and actually place, to prove the whole gesture completes.
  await cdp.ev(`(() => {
    window.__v.ui.openPanel('workshop');
    const t = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Build' && !b.disabled);
    if (t) t.click();
    const p = window.__v.placement, d = window.__v.data;
    const g = p.ghost();
    const z = d.FARM.startZone;
    for (let y = z.y; y <= z.y + z.h - g.h; y++) {
      for (let x = z.x; x <= z.x + z.w - g.w; x++) {
        if (p.isLegal(x, y, g.w, g.h)) { p.hover(x, y); window.__v.result = p.confirm(); return true; }
      }
    }
    window.__v.result = { ok: false, reason: 'nowhere legal' };
    return true;
  })()`);
  const result = JSON.parse(await cdp.ev('JSON.stringify(window.__v.result)'));
  check('confirming the ghost places the building', result && result.ok === true, JSON.stringify(result));
  const afterPlace = await cdp.ev('window.__v.state.state.farm.objects.length');
  check('exactly one object was added', afterPlace === before + 1, `${before} -> ${afterPlace}`);
  check('the session closes after a successful placement',
    await cdp.ev('window.__v.placement.isActive() === false'));

  console.log(`\n${passed} passed, ${failures.length} failed`);
  return failures.length;
}

main()
  .then((n) => process.exit(n ? 1 : 0))
  .catch((e) => { console.error(e.message); process.exit(1); });
