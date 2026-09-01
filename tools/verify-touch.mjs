#!/usr/bin/env node
// verify-touch.mjs — drives real multi-pointer gestures at a phone viewport against the running
// app, to prove the touch paths actually work.
//
// This exists because of a trap recorded in the shared notes: a desktop browser narrowed to phone
// width is NOT evidence for a touch claim, because it still has a mouse and a wheel. On a real
// phone there is no wheel at all, so pinch is the only way to zoom, and a game that cannot zoom is
// a game you cannot play. These checks dispatch genuine PointerEvents with distinct pointerIds
// through input.js's own listeners rather than calling any zoom function directly.
//
// Assumes the app is already running headlessly with --remote-debugging-port (see the
// run-lowlevel-headless-app skill). Isolation is proven before anything is touched.
//
// Usage: node tools/verify-touch.mjs [port]

const PORT = process.argv[2] || '9412';
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

// One page-side helper that fires a real PointerEvent through the canvas, so input.js's own
// listeners run. Nothing here calls renderer.setZoom or input internals directly.
const HELPERS = `
window.__t = {
  cv: document.getElementById('world') || document.querySelector('canvas'),
  fire(type, id, x, y) {
    const ev = new PointerEvent(type, {
      clientX: x, clientY: y, pointerId: id, pointerType: 'touch',
      bubbles: true, cancelable: true, isPrimary: id === 1,
    });
    (type === 'pointerdown' ? window.__t.cv : window).dispatchEvent(ev);
  },
};
'ready'
`;

async function main() {
  const cdp = await Cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // A real phone viewport, with touch actually emulated. Resizing alone would leave the page
  // believing it has a mouse, which is exactly the false-confidence trap this file exists for.
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cdp.send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 3500));

  await cdp.ev(`window.__r={};import('./src/render/renderer.js').then((m)=>{window.__r={m,ok:1};});`);
  await cdp.poll('window.__r.ok === 1');
  const ready = await cdp.ev(HELPERS);
  check('the world canvas exists at a phone viewport', ready === 'ready' && await cdp.ev('!!window.__t.cv'));

  const layout = await cdp.ev(`(() => ({
    bodyScrollsSideways: document.body.scrollWidth > window.innerWidth + 1,
    width: window.innerWidth,
    dockVisible: (() => { const d = document.getElementById('dock'); if (!d) return false;
      const r = d.getBoundingClientRect();
      return r.width > 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1; })(),
  }))()`);
  check('the page does not scroll sideways at 390px', layout.bodyScrollsSideways === false, JSON.stringify(layout));
  check('the dock stays fully on screen at 390px', layout.dockVisible === true, JSON.stringify(layout));

  // --- pinch to zoom out ---------------------------------------------------------------
  const zoomOut = await cdp.ev(`(() => {
    const before = window.__r.m.cameraTarget.zoom;
    window.__t.fire('pointerdown', 1, 120, 400);
    window.__t.fire('pointerdown', 2, 270, 400);       // 150px apart
    window.__t.fire('pointermove', 1, 170, 400);
    window.__t.fire('pointermove', 2, 220, 400);       // now 50px apart: a pinch IN
    const after = window.__r.m.cameraTarget.zoom;
    window.__t.fire('pointerup', 1, 170, 400);
    window.__t.fire('pointerup', 2, 220, 400);
    return { before, after };
  })()`);
  check('pinching in zooms out', zoomOut.after < zoomOut.before - 0.05,
    `${zoomOut.before.toFixed(3)} -> ${zoomOut.after.toFixed(3)}`);

  // --- pinch to zoom in ----------------------------------------------------------------
  const zoomIn = await cdp.ev(`(() => {
    const before = window.__r.m.cameraTarget.zoom;
    window.__t.fire('pointerdown', 3, 180, 400);
    window.__t.fire('pointerdown', 4, 210, 400);       // 30px apart
    window.__t.fire('pointermove', 3, 100, 400);
    window.__t.fire('pointermove', 4, 290, 400);       // now 190px apart: a spread
    const after = window.__r.m.cameraTarget.zoom;
    window.__t.fire('pointerup', 3, 100, 400);
    window.__t.fire('pointerup', 4, 290, 400);
    return { before, after };
  })()`);
  check('spreading two fingers zooms in', zoomIn.after > zoomIn.before + 0.05,
    `${zoomIn.before.toFixed(3)} -> ${zoomIn.after.toFixed(3)}`);

  // --- zoom stays inside its bounds ----------------------------------------------------
  const bounds = await cdp.ev(`(() => {
    window.__t.fire('pointerdown', 5, 195, 400);
    window.__t.fire('pointerdown', 6, 200, 400);       // 5px apart
    for (let i = 0; i < 6; i++) { window.__t.fire('pointermove', 5, 10, 400); window.__t.fire('pointermove', 6, 380, 400); }
    const hi = window.__r.m.cameraTarget.zoom;
    window.__t.fire('pointerup', 5, 10, 400); window.__t.fire('pointerup', 6, 380, 400);
    window.__t.fire('pointerdown', 7, 10, 400);
    window.__t.fire('pointerdown', 8, 380, 400);
    for (let i = 0; i < 6; i++) { window.__t.fire('pointermove', 7, 194, 400); window.__t.fire('pointermove', 8, 196, 400); }
    const lo = window.__r.m.cameraTarget.zoom;
    window.__t.fire('pointerup', 7, 194, 400); window.__t.fire('pointerup', 8, 196, 400);
    return { hi, lo };
  })()`);
  check('an extreme pinch cannot push zoom past its limits',
    bounds.hi <= 2.5 + 1e-6 && bounds.lo >= 0.5 - 1e-6, JSON.stringify(bounds));

  // --- two-finger pan ------------------------------------------------------------------
  const pan = await cdp.ev(`(() => {
    const bx = window.__r.m.cameraTarget.x, by = window.__r.m.cameraTarget.y;
    window.__t.fire('pointerdown', 9, 150, 300);
    window.__t.fire('pointerdown', 10, 250, 300);
    // Move BOTH fingers together: separation constant, so this is pan with no zoom.
    window.__t.fire('pointermove', 9, 150, 420);
    window.__t.fire('pointermove', 10, 250, 420);
    const ax = window.__r.m.cameraTarget.x, ay = window.__r.m.cameraTarget.y;
    window.__t.fire('pointerup', 9, 150, 420); window.__t.fire('pointerup', 10, 250, 420);
    return { moved: Math.hypot(ax - bx, ay - by) };
  })()`);
  check('two fingers moving together pan the camera', pan.moved > 0.2, JSON.stringify(pan));

  // --- a two-finger touch must never decay into a tap -------------------------------------
  //
  // Framing matters here. An earlier version of this check moved the fingers 10px apart and
  // asserted no panel opened, and it passed even with BOTH tap suppressions deleted: 10px is over
  // input.js's own 6px tap threshold, so that gesture could never have produced a tap under any
  // implementation. It was asserting nothing.
  //
  // The real hazard is the opposite gesture: two fingers that land, barely move and lift, which
  // is what an accidental two-finger touch actually looks like. That IS within the tap threshold.
  // A panel is opened first so the failure has somewhere visible to land, because a stray tap on
  // empty ground closes whatever panel is open.
  await cdp.ev("window.__u = null; import('./src/ui.js').then((m) => { window.__u = m; });");
  await cdp.poll('!!window.__u');
  const noTap = await cdp.ev(`(() => {
    window.__u.openPanel('settings');
    const before = window.__u.isPanelOpen();
    window.__t.fire('pointerdown', 11, 150, 400);
    window.__t.fire('pointerdown', 12, 250, 400);
    window.__t.fire('pointermove', 11, 152, 400);      // 2px, well inside the tap threshold
    window.__t.fire('pointermove', 12, 248, 400);
    window.__t.fire('pointerup', 11, 152, 400);
    window.__t.fire('pointerup', 12, 248, 400);
    const after = window.__u.isPanelOpen();
    window.__u.closePanel();
    return { before, after };
  })()`);
  check('a two-finger touch never decays into a tap', noTap.before === true && noTap.after === true,
    JSON.stringify(noTap));

  // --- one finger still pans -------------------------------------------------------------
  const single = await cdp.ev(`(() => {
    const bx = window.__r.m.cameraTarget.x, by = window.__r.m.cameraTarget.y;
    window.__t.fire('pointerdown', 13, 200, 300);
    for (let i = 1; i <= 6; i++) window.__t.fire('pointermove', 13, 200 + i * 12, 300 + i * 8);
    window.__t.fire('pointerup', 13, 272, 348);
    const ax = window.__r.m.cameraTarget.x, ay = window.__r.m.cameraTarget.y;
    return { moved: Math.hypot(ax - bx, ay - by) };
  })()`);
  check('a single finger still pans, unchanged by the pinch work', single.moved > 0.2, JSON.stringify(single));

  // --- a dual finger keeps its side when it crosses the middle -----------------------------
  //
  // Worth stating precisely, because the first version of this check asserted the wrong thing and
  // passed against both implementations. Two fingers sitting one per half ALREADY worked: each
  // pointermove landed in its own half and set its own value, so the old position rule handled it
  // fine. The case that actually differs is a finger CROSSING the midline mid-gesture. Under the
  // position rule it silently starts driving the other side, clobbering the value the other
  // finger is holding and freezing its own - a real defect for throw_shuttles and blend_notes,
  // where the two values genuinely travel and can pass each other.
  const dual = await cdp.ev(`(() => {
    const host = document.createElement('div');
    Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', width: '300px', height: '300px' });
    document.body.appendChild(host);
    return import('./src/minigames/input.js').then((m) => {
      const inp = m.createInput('dual', host, {});
      const fire = (type, id, x, y) => {
        const ev = new PointerEvent(type, {
          clientX: x, clientY: y, pointerId: id, pointerType: 'touch',
          bubbles: true, cancelable: true,
        });
        (type === 'pointerdown' ? host : document).dispatchEvent(ev);
      };
      fire('pointerdown', 21, 60, 150);      // lands LEFT
      fire('pointerdown', 22, 240, 60);      // lands RIGHT, held high
      fire('pointermove', 22, 240, 60);      // right = 0.8, and it must stay there
      const rightBefore = inp.read(16).right;
      // Now walk the LEFT finger across the middle to the right-hand side, low down.
      fire('pointermove', 21, 240, 270);
      const after = inp.read(16);
      fire('pointerup', 21, 240, 270);
      fire('pointerup', 22, 240, 60);
      inp.destroy();
      host.remove();
      window.__d = { rightBefore, rightAfter: after.right, leftAfter: after.left };
      return 'done';
    });
  })()`);
  await cdp.poll('!!window.__d');
  const d = await cdp.ev('JSON.stringify(window.__d)');
  const dd = JSON.parse(d);
  check('a crossing finger keeps driving its own side', Math.abs(dd.leftAfter - 0.1) < 0.05, d);
  check('and does not clobber the value the other finger is holding',
    Math.abs(dd.rightAfter - dd.rightBefore) < 0.05, d);

  // --- the browser must not steal a gesture that belongs to a verb -------------------------
  //
  // On a WebView, a drag across a minigame stage would otherwise scroll the page or start the
  // browser's own pinch-zoom, and either one fires pointercancel and ENDS the run rather than
  // merely feeling wrong. Drag, path, balance and steer verbs are all "a finger dragging across
  // a stage", so that is most of the library. Checked as computed style on real elements rather
  // than by reading the stylesheet, because a later rule could override it.
  const gestures = await cdp.ev(`(() => {
    const mk = (cls, parent) => { const d = document.createElement('div'); d.className = cls; (parent || document.body).appendChild(d); return d; };
    const back = mk('modal-backdrop');
    const card = mk('modal-card', back);
    const stage = mk('game-stage', card);
    const cs = (e) => getComputedStyle(e);
    const out = {
      backdrop: cs(back).touchAction,
      card: cs(card).touchAction,
      stage: cs(stage).touchAction,
      stageSelect: cs(stage).userSelect || cs(stage).webkitUserSelect,
      cardScrolls: cs(card).overflowY,
    };
    back.remove();
    return out;
  })()`);
  check('a minigame stage owns every gesture that starts on it',
    gestures.stage === 'none', JSON.stringify(gestures));
  check('a drag on a stage cannot select the stage text instead',
    gestures.stageSelect === 'none', JSON.stringify(gestures));
  check('the modal backdrop does not pan the farm behind it',
    gestures.backdrop === 'none', JSON.stringify(gestures));
  check('but a tall dialog can still be scrolled on a phone',
    gestures.card === 'pan-y' && gestures.cardScrolls === 'auto', JSON.stringify(gestures));

  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  return failures.length;
}

main()
  .then((n) => process.exit(n ? 1 : 0))
  .catch((e) => { console.error(e.message); process.exit(1); });
