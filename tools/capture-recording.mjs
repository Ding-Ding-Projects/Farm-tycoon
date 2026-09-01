#!/usr/bin/env node
// capture-recording.mjs — records the desktop app by capturing its own renderer, frame by frame,
// and driving it with real input events while it does.
//
// It deliberately does NOT record a screen. Capturing a monitor picks up whatever the person at
// the machine was actually doing, which is their private business and none of the project's, and
// a recording like that reaching a public repository is a privacy incident rather than an
// oversight. Page.captureScreenshot returns the page's own pixels and nothing else, so there is
// no window to accidentally include and no desktop behind it.
//
// The frames are assembled by ffmpeg afterwards; this tool only produces the JPEG sequence and
// tells you the exact command. Keeping those separate means a failed encode does not cost the
// capture run, which on a slow machine is the expensive half.
//
// Assumes the app is already running headlessly with --remote-debugging-port (see the
// run-lowlevel-headless-app skill). Isolation is proven before anything is touched.
//
// Usage: node tools/capture-recording.mjs [port] [outDir] [seconds]

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const PORT = process.argv[2] || '9411';
const OUT = process.argv[3] || 'recording-frames';
const SECONDS = Number(process.argv[4] || 22);
const FPS = 12;                       // enough to read as motion, cheap enough to keep up with
const ENDPOINT = `http://127.0.0.1:${PORT}`;

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
    if (targets.length !== 1) throw new Error(`isolation failed: ${targets.length} CDP targets, expected 1`);
    if (targets[0].type !== 'page') throw new Error(`isolation failed: target type "${targets[0].type}"`);
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

  // No awaitPromise: it can hang indefinitely on some Node/Electron pairs (recorded dead end).
  async ev(expression) {
    const msg = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (msg.error) throw new Error(JSON.stringify(msg.error));
    const r = msg.result;
    if (r.exceptionDetails) throw new Error(`page exception: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result?.value;
  }

  async poll(expression, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (await this.ev(expression)) return true;
      if (Date.now() > deadline) throw new Error(`timed out: ${expression}`);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

/** One real pointer gesture on the canvas, so input.js's own handlers run. */
const GESTURE = `
window.__rec = window.__rec || {};
window.__rec.fire = (type, x, y, id) => {
  const cv = document.getElementById('world') || document.querySelector('canvas');
  const b = cv.getBoundingClientRect();
  const ev = new PointerEvent(type, {
    clientX: b.left + x, clientY: b.top + y,
    pointerId: id || 1, pointerType: 'mouse', bubbles: true, cancelable: true, isPrimary: true,
  });
  (type === 'pointerdown' ? cv : window).dispatchEvent(ev);
};
window.__rec.tap = (x, y) => { window.__rec.fire('pointerdown', x, y); window.__rec.fire('pointerup', x, y); };
window.__rec.drag = (x1, y1, x2, y2, steps) => {
  window.__rec.fire('pointerdown', x1, y1);
  for (let i = 1; i <= (steps || 12); i++) {
    const t = i / (steps || 12);
    window.__rec.fire('pointermove', x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
  }
  window.__rec.fire('pointerup', x2, y2);
};
'ready'
`;

async function main() {
  const cdp = await Cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.poll('typeof window.__farmDebug === "object" && window.__farmDebug !== null');
  const ready = await cdp.ev(GESTURE);
  if (ready !== 'ready') throw new Error('could not install the gesture helper');

  // Start from a fresh farm, so the recording shows the real opening rather than test state.
  await cdp.ev("window.__rr = 0; import('./src/state.js').then((s) => {"
    + " try { localStorage.clear(); } catch (e) {} s.resetGame(); s.save(); window.__rr = 1; });");
  await cdp.poll('window.__rr === 1');
  await new Promise((r) => setTimeout(r, 1200));

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const total = SECONDS * FPS;
  const interval = 1000 / FPS;

  // Gestures aimed at REAL tiles, not at guessed pixels.
  //
  // The first version hardcoded screen coordinates and every one of them missed: the recording
  // came out as the camera drifting over an untouched farm with the tutorial still on its opening
  // line, which looks like a demo until you read the seed counter and see it never moved. Field
  // positions depend on the camera, so they have to be computed through the app's own
  // renderer.tileToScreen, exactly as tools/capture-screenshots.mjs already does.
  await cdp.ev(`
    window.__rec.tapField = (n) => Promise.all([
      import('./src/render/renderer.js'), import('./src/state.js'),
    ]).then(([r, s]) => {
      const fields = s.state.farm.objects.filter((o) => o.kind === 'field');
      const f = fields[n % fields.length];
      if (!f) return 'no field';
      const vp = r.getViewport();
      const [x, y] = r.tileToScreen(f.x, f.y, vp.w, vp.h);
      window.__rec.fire('pointerdown', x, y);
      window.__rec.fire('pointerup', x, y);
      return 'tapped ' + f.x + ',' + f.y;
    });
    window.__rec.centreOnFarm = () => Promise.all([
      import('./src/render/renderer.js'), import('./src/state.js'),
    ]).then(([r, s]) => {
      const fields = s.state.farm.objects.filter((o) => o.kind === 'field');
      if (!fields.length) return 'none';
      const cx = fields.reduce((a, f) => a + f.x, 0) / fields.length;
      const cy = fields.reduce((a, f) => a + f.y, 0) / fields.length;
      const vp = r.getViewport();
      // Set the TARGET as well as the current camera. focusTile alone moves the camera, then
      // tickCamera eases it straight back toward whatever cameraTarget still says, so the farm
      // slid off the top of frame within a second and the recording showed empty meadow.
      r.focusTile(cx, cy, vp.w, vp.h);
      r.cameraTarget.x = r.camera.x;
      r.cameraTarget.y = r.camera.y;
      r.cameraTarget.zoom = r.camera.zoom;
      return 'centred';
    });
    // Tapping a field opens the radial; something then has to CHOOSE from it. Without this the
    // recording showed the menu popping open and nothing ever being planted.
    window.__rec.chooseRadial = () => {
      const radial = document.getElementById('radial');
      if (!radial || radial.hidden) return 'no radial';
      const btn = [...radial.querySelectorAll('button')].find((b) => !b.classList.contains('locked'));
      if (!btn) return 'no option';
      btn.click();
      return 'chose ' + (btn.title || btn.textContent);
    };
    'ok'
  `);

  // A script of real gestures, keyed to the frame they fire on. Timed rather than interleaved so
  // the capture loop keeps a steady cadence and the video does not stutter where input happens.
  const script = new Map([
    [FPS * 1, () => cdp.ev('window.__rec.centreOnFarm()')],
    // Each plant is two beats: open the radial on the field, then choose from it.
    [FPS * 3, () => cdp.ev('window.__rec.tapField(0)')],
    [Math.round(FPS * 3.7), () => cdp.ev('window.__rec.chooseRadial()')],
    [FPS * 5, () => cdp.ev('window.__rec.tapField(1)')],
    [Math.round(FPS * 5.7), () => cdp.ev('window.__rec.chooseRadial()')],
    [FPS * 7, () => cdp.ev('window.__rec.tapField(2)')],
    [Math.round(FPS * 7.7), () => cdp.ev('window.__rec.chooseRadial()')],
    // MILLISECONDS. timeSkip(900) is nine tenths of a second, and wheat takes 120 SECONDS to
    // grow, so the first version skipped nothing and every harvest in the recording came back
    // "Still growing - check back soon!". 150000 clears the 120s growth with room to spare.
    [FPS * 10, () => cdp.ev('window.__farmDebug.timeSkip(150000)')],
    // Then harvest the same three, which is the same two beats again.
    [FPS * 13, () => cdp.ev('window.__rec.tapField(0)')],
    [Math.round(FPS * 13.7), () => cdp.ev('window.__rec.chooseRadial()')],
    [FPS * 15, () => cdp.ev('window.__rec.tapField(1)')],
    [Math.round(FPS * 15.7), () => cdp.ev('window.__rec.chooseRadial()')],
    [FPS * 17, () => cdp.ev('window.__rec.tapField(2)')],
    [Math.round(FPS * 17.7), () => cdp.ev('window.__rec.chooseRadial()')],
    [FPS * 20, () => cdp.ev("window.__rec.drag(500, 420, 620, 340)")],
  ]);

  console.log(`[rec] capturing ${total} frames at ${FPS}fps into ${OUT}/`);
  const started = Date.now();
  for (let i = 0; i < total; i++) {
    const due = started + i * interval;
    const wait = due - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const action = script.get(i);
    if (action) { try { await action(); } catch (e) { console.log(`  [frame ${i}] gesture failed: ${e.message}`); } }

    // JPEG, not PNG, and the reason is the difference between a recording and a time-lapse.
    // PNG capture managed about 3 frames a second, so 22 seconds of intended content took 84
    // seconds of wall clock and would have played back at roughly four times speed - every
    // animation frantic, and the video quietly lying about how the game moves.
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
    if (!shot.result?.data) throw new Error(`frame ${i}: captureScreenshot returned no data`);
    writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(shot.result.data, 'base64'));
    if (i % (FPS * 4) === 0) console.log(`  frame ${i}/${total}`);
  }

  const elapsed = (Date.now() - started) / 1000;
  console.log(`\n[rec] ${total} frames in ${elapsed.toFixed(1)}s (${(total / elapsed).toFixed(1)} captured/sec)`);
  console.log('\nAssemble with:');
  // Encode at the rate frames were ACTUALLY captured, not at the rate they were requested, so the
  // video runs at real speed even when the capture could not keep up.
  const realFps = Math.max(1, Math.round(total / elapsed));
  console.log(`    ffmpeg -y -framerate ${realFps} -i "${OUT}/f%05d.jpg" -c:v libx264 -pix_fmt yuv420p -vf "scale=900:-2" -crf 30 screenshots/farm-tycoon-desktop.mp4`);
  console.log(`
(framerate ${realFps} is the MEASURED capture rate, not the requested ${FPS}: encoding at`);
  console.log(' the requested rate would speed the video up by whatever the capture fell short by.)');
  console.log('\nThen LOOK at the result before trusting it. A recording of the wrong thing has a');
  console.log('perfectly plausible duration and file size; only the frames say what is in it.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
