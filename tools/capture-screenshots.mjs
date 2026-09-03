#!/usr/bin/env node
// capture-screenshots.mjs — drives the REAL BUILT Electron artifact (dist/win-unpacked/Farm
// Tycoon.exe) over the Chrome DevTools Protocol and captures every reachable user-facing
// surface as a PNG under screenshots/, plus a manifest.json describing each one honestly.
//
// This is a one-shot capture tool, not a general automation library: it assumes the app was
// already launched headlessly (see the run-lowlevel-headless-app skill) with
// --remote-debugging-port on a task-only loopback port, and that isolation (exactly one CDP
// page target, matching the expected file:// URL) has already been proven by the caller.
//
// Design notes for whoever maintains this next:
//   - Runtime.evaluate is called WITHOUT awaitPromise (documented Node/Electron hang risk).
//     Anything asynchronous on the page side (dynamic import()) is fired with .then() writing
//     a marker onto window.__cap, then polled synchronously from here.
//   - The game's defining interaction — opening a system by tapping its structure in the
//     world — is exercised for real: we move the live camera to the structure's tile, convert
//     to screen px with the app's own renderer.tileToScreen(), and dispatch real PointerEvents
//     on the canvas so input.js's actual handleTap()/openStructure() code path runs (including
//     the locked/derelict toast). We never call ui.openPanel() directly to skip that check.
//   - Planting/harvesting/feeding drive the real radial-menu flow the same way, for the same
//     reason.
//   - Level/inventory bumps use direct state mutation, exactly like the project's own
//     window.__farmDebug.give() debug hook: mutating values the player could reach through
//     play, never fabricating UI the app doesn't actually render.
//   - Phase B is complete (see HANDOFF.md) — every src/ module has a real implementation body.
//     That does NOT mean every module is wired into the UI: several systems (mine, merge,
//     fishing, town, zoo, trains, airport, museum, laboratory, expeditions, newspaper,
//     collections, boat, market, helicopter, photo, and minigames) have real backend logic
//     confirmed by grep and by direct module calls in this script's exploration pass, but
//     src/ui.js's renderPanelContent() switch has no case for any of them, so their panel
//     always falls through to the generic "X is being built — check back soon!" placeholder.
//     Captured as-is, honestly labelled — never worked around by calling the backend directly
//     and passing that off as what the UI shows. workshop.js and its own panel case ARE now
//     wired (commit 2b33dec) — the crafting-flow and building-queue captures below drive that
//     real UI end to end, never workshop.js directly.
//   - A hand-written REQUIRED_SURFACES list at the bottom is checked against what actually got
//     captured; anything required but neither captured nor in notReachable[] fails the run
//     loudly rather than silently producing an incomplete manifest.
//
// Recaptured 2026-08-31 against commit bb4524e (four real fixes landed since the prior 47-shot
// pass at 556fe8f): 1c117c5 gave fields their own KIND_DISPATCH entry (they no longer render as
// magenta debug circles); 556fe8f and c1b74e4/bb4524e fixed the camera clamp's north/south
// asymmetry and gave tickCamera() the real per-frame world bounds (every structure, not just the
// start zone); 2b33dec wired the Building Workshop panel to workshop.js and gave every
// production building's queue panel a real Collect action. Every previously-stale capture
// touching those four areas — the field/growth-stage world shots, every locked/unlocked
// structure world shot, the Workshop panel, and the building-queue panel — was retaken.

import fs from 'node:fs';
import path from 'node:path';

const ENDPOINT = process.env.FT_CDP_ENDPOINT || 'http://127.0.0.1:9333';
const EXPECTED_URL_SUFFIX = '/index.html';
const OUT_DIR = path.resolve(process.cwd(), 'screenshots');
const COMMIT = process.env.FT_COMMIT || '(unknown — pass FT_COMMIT)';

fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Minimal CDP client: native fetch + native WebSocket, no automation dependency.
// ---------------------------------------------------------------------------
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
    // Isolation proof: exactly one target, a page, matching the app's own index.html.
    if (targets.length !== 1) {
      throw new Error(`isolation failed: expected exactly 1 CDP target, found ${targets.length}`);
    }
    const t = targets[0];
    if (t.type !== 'page') throw new Error(`isolation failed: target type is "${t.type}", not "page"`);
    if (!t.url.endsWith(EXPECTED_URL_SUFFIX)) {
      throw new Error(`isolation failed: target URL does not end with ${EXPECTED_URL_SUFFIX}: ${t.url}`);
    }
    if (!t.webSocketDebuggerUrl) throw new Error('isolation failed: no webSocketDebuggerUrl on target');
    console.log(`[cdp] isolation proven: 1 page target, url=${t.url}`);

    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }
      }, timeoutMs);
      this.pending.set(id, { resolve: (msg) => { clearTimeout(timer); resolve(msg); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Synchronous evaluate (no awaitPromise — see module header). Returns the by-value result. */
  async evaluate(expression) {
    const msg = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (msg.error) throw new Error(`CDP protocol error: ${JSON.stringify(msg.error)}`);
    const r = msg.result;
    if (r.exceptionDetails) {
      const text = r.exceptionDetails.exception?.description || r.exceptionDetails.text;
      throw new Error(`page exception: ${text}`);
    }
    return r.result?.value;
  }

  /** Poll a synchronous boolean expression until true or timeout. */
  async pollUntilTrue(expression, timeoutMs = 8000, intervalMs = 100) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const v = await this.evaluate(expression);
      if (v) return true;
      if (Date.now() > deadline) throw new Error(`poll timeout waiting for: ${expression}`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  async captureScreenshot() {
    const msg = await this.send('Page.captureScreenshot', { format: 'png' }, 15000);
    if (msg.error) throw new Error(`CDP protocol error on capture: ${JSON.stringify(msg.error)}`);
    return msg.result.data; // base64
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 0, mobile: false,
    });
  }

  async clearViewport() {
    await this.send('Emulation.clearDeviceMetricsOverride', {});
  }

  close() { this.ws.close(); }
}

// ---------------------------------------------------------------------------
// Manifest bookkeeping + required-surface completeness guard
// ---------------------------------------------------------------------------
const manifest = [];
const capturedTags = new Set();

// Hand-written, not derived from what actually got captured — a list that only checks the
// captures it already has would pass trivially. Every tag here must end up either captured
// (added to capturedTags by shot()) or explicitly listed in NOT_REACHABLE below; anything that
// is neither fails the run loudly at the end instead of silently shipping an incomplete matrix.
const REQUIRED_SURFACES = [
  'boot', 'tutorial',
  'locked-workshop_yard', 'locked-mine_entrance', 'locked-town_gate', 'locked-zoo_gate',
  'locked-laboratory', 'locked-museum_hall', 'locked-airport',
  'growth-seed', 'growth-sprout', 'growth-growing', 'growth-ready',
  'radial-plant', 'radial-harvest', 'toast-success', 'toast-error',
  'pen-built', 'pen-radial-feed', 'pen-radial-collect',
  'dock-decorate-off', 'dock-decorate-on', 'dock-achievements', 'dock-settings',
  'confirm-dialog',
  'panel-barn', 'panel-silo', 'panel-order_board', 'panel-truck_bay', 'panel-shop_stand',
  'panel-boat_dock', 'panel-lake', 'panel-mine_entrance', 'panel-merge_plot',
  'panel-market_stall', 'panel-train_station', 'panel-airport', 'panel-helipad',
  'panel-workshop_yard', 'panel-museum_hall', 'panel-laboratory', 'panel-expedition_camp',
  'panel-town_gate', 'panel-zoo_gate', 'panel-mailbox', 'panel-bookshelf', 'panel-tripod',
  'building-queue',
  'zoom-out', 'zoom-in',
  'narrow-width', 'wide-width',
  'minigame', 'workshop-crafting-flow', 'mine-panel-content', 'merge-board', 'fishing',
  'expedition', 'dark-theme', 'coop-panel',
];

async function shot(cdp, { name, surface, stateDescription, viewport, alt, tags = [] }) {
  const filename = `${name}.png`;
  const outPath = path.join(OUT_DIR, filename);
  const b64 = await cdp.captureScreenshot();
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  const stat = fs.statSync(outPath);
  manifest.push({
    file: filename,
    surface,
    state: stateDescription,
    viewport: viewport || '896x560 (capture viewport; real app default window is 1280x800)',
    commit: COMMIT,
    bytes: stat.size,
    alt,
  });
  for (const t of tags) capturedTags.add(t);
  console.log(`[shot] ${filename} (${stat.size} bytes) — ${surface}`);
}

// ---------------------------------------------------------------------------
// Page-side helpers
// ---------------------------------------------------------------------------

/** Fire-and-forget dynamic import of every module the capture script needs, stashed on
 * window.__cap. Dynamic import() from page-context resolves relative to the document URL,
 * which is the SAME already-loaded module graph main.js used — these are live references to
 * the app's real running modules, not copies. */
async function bootstrapCaptureBridge(cdp) {
  await cdp.evaluate(`
    (function () {
      window.__cap = window.__cap || {};
      if (window.__cap.ready) return true;
      window.__cap.ready = false;
      const specs = ['./src/state.js','./src/render/renderer.js','./src/data.js',
        './src/farm.js','./src/production.js','./src/tutorial.js','./src/economy.js',
        './src/ui.js'];
      Promise.all(specs.map((s) => import(s))).then(([state, renderer, data, farm,
        production, tutorial, economy, ui]) => {
        window.__cap.state = state; window.__cap.renderer = renderer; window.__cap.data = data;
        window.__cap.farm = farm; window.__cap.production = production;
        window.__cap.tutorial = tutorial; window.__cap.economy = economy; window.__cap.ui = ui;
        window.__cap.ready = true;
      }).catch((e) => { window.__cap.error = String((e && e.stack) || e); window.__cap.ready = true; });
      return true;
    })()
  `);
  await cdp.pollUntilTrue('window.__cap && window.__cap.ready === true');
  const err = await cdp.evaluate('window.__cap && window.__cap.error || null');
  if (err) throw new Error(`capture bridge bootstrap failed: ${err}`);
  console.log('[bridge] live module references acquired');
}

// renderer.tileToScreen centers the AIMED tile at screen (viewportW/2, viewportH*OY_RATIO) —
// OY_RATIO is 0.2375, so a tile centered dead-on lands only ~13% down the screen (133px of
// 560), which is exactly where the fixed toast band sits (styles.css .toast-stack: top:150px).
//
// A first version of this file worked around this, and around clampCamera()'s own former
// symmetric-half-extent defect (it treated the north and south margins as equal, when
// OY_RATIO puts the target near the top so most of the viewport is actually south of it — see
// commit 556fe8f "Fix camera clamp: north/south visible extent is asymmetric, not symmetric"),
// by hand-replicating the clamp math here and pre-computing an "already clamped" value. That
// replica is gone now that the fix has landed: setting camera.x/camera.y/cameraTarget.x/y to
// the raw desired target (with a small downward bias — see REVEAL_BIAS) and then WAITING for
// one real animation frame lets the engine's own corrected clampCamera() do this for real,
// which is simpler and cannot go stale the way a hand-copied formula can. Every helper below
// therefore reads the camera position back AFTER that wait, and computes screen/click
// coordinates from that real, settled value — never from the pre-clamp target.
//
// Deliberate, modest downward/rightward nudge applied to every camera target before clamping
// (subtracted from both tx and ty, which preserves their difference and so preserves
// horizontal centering) so the aimed tile lands a bit past mid-screen rather than dead-center —
// dead-center is only 13% down (OY_RATIO), which the fixed toast band already occupies.
const REVEAL_BIAS = 1.2;

/** Move the live camera near a structure's anchor tile and dispatch a real tap on the canvas,
 * exercising input.js's actual handleTap -> structureAt -> openStructure code path (including
 * the locked/derelict toast). */
async function tapStructure(cdp, key, zoom = 1.6) {
  const info = await cdp.evaluate(`
    (function () {
      const def = window.__cap.data.STRUCTURES['${key}'];
      if (!def) return { ok: false, error: 'no such structure: ${key}' };
      const renderer = window.__cap.renderer;
      // main.js's buildWorld() gives every structure object tx=def.pos.x, ty=def.pos.y (the
      // raw top-left corner of its footprint, not the footprint center) and sprites.js's draw
      // functions treat that (x,y) as their own visual center — so the sprite actually renders
      // anchored at pos.x/pos.y, not at the footprint's true center. Frame the camera on that
      // SAME anchor so the sprite lands where we expect.
      const anchorX = def.pos.x, anchorY = def.pos.y;
      renderer.camera.zoom = ${zoom}; renderer.cameraTarget.zoom = ${zoom};
      renderer.camera.x = anchorX - ${REVEAL_BIAS}; renderer.camera.y = anchorY - ${REVEAL_BIAS};
      renderer.cameraTarget.x = renderer.camera.x; renderer.cameraTarget.y = renderer.camera.y;
      return { ok: true, anchorX, anchorY };
    })()
  `);
  if (!info || !info.ok) return info;
  await new Promise((r) => setTimeout(r, 150)); // let the real clampCamera() settle it
  // The click itself targets pos+0.5/pos+0.5, a tile that is safely inside the footprint for
  // any structure size, computed from the NOW-SETTLED camera so the real screenToTile() +
  // structureAt() hit-test in input.js resolves correctly regardless of where the clamp put it.
  return cdp.evaluate(`
    (function () {
      const renderer = window.__cap.renderer;
      const vp = renderer.getViewport();
      const clickX = ${info.anchorX} + 0.5, clickY = ${info.anchorY} + 0.5;
      const [sx, sy] = renderer.tileToScreen(clickX, clickY, vp.w, vp.h);
      const canvas = document.getElementById('world');
      const opts = { clientX: sx, clientY: sy, pointerId: 1, bubbles: true, cancelable: true,
        button: 0, isPrimary: true };
      canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
      canvas.dispatchEvent(new PointerEvent('pointerup', opts));
      return { ok: true, sx, sy, camera: { x: renderer.camera.x, y: renderer.camera.y } };
    })()
  `);
}

/** Tap a world tile directly (used for field/pen radial menus, not structures). The RESULT
 * here is positioned by the click's own screen coordinates — ui.openRadial(screenX, screenY,
 * ...) plants the popup exactly there — so the camera has to be genuinely settled before the
 * click coordinates are computed, or the radial opens wherever the pre-clamp camera would have
 * put it. Same two-phase shape as tapStructure: set target, wait a real frame, then read back
 * and click from the settled value. */
async function tapTile(cdp, tx, ty, zoom = 2.0) {
  const cx = tx + 0.5, cy = ty + 0.5;
  await cdp.evaluate(`
    (function () {
      const renderer = window.__cap.renderer;
      renderer.camera.zoom = ${zoom}; renderer.cameraTarget.zoom = ${zoom};
      renderer.camera.x = ${cx} - ${REVEAL_BIAS}; renderer.camera.y = ${cy} - ${REVEAL_BIAS};
      renderer.cameraTarget.x = renderer.camera.x; renderer.cameraTarget.y = renderer.camera.y;
      return true;
    })()
  `);
  await new Promise((r) => setTimeout(r, 150)); // let the real clampCamera() settle it
  return cdp.evaluate(`
    (function () {
      const renderer = window.__cap.renderer;
      const vp = renderer.getViewport();
      const [sx, sy] = renderer.tileToScreen(${cx}, ${cy}, vp.w, vp.h);
      const canvas = document.getElementById('world');
      const opts = { clientX: sx, clientY: sy, pointerId: 1, bubbles: true, cancelable: true,
        button: 0, isPrimary: true };
      canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
      canvas.dispatchEvent(new PointerEvent('pointerup', opts));
      return { ok: true, sx, sy };
    })()
  `);
}

/** Point the camera at a tile using the same settle-on-a-real-frame treatment as a tap, but
 * without clicking — used to frame a scene (e.g. the growth-stage field cluster) for a pure
 * observation shot. Waits for the real clampCamera() to settle before returning; callers still
 * add their own short capture-settle delay before shot(), exactly as elsewhere in this script,
 * to give the next drawFrame() a moment to actually paint the new camera position. */
async function panTo(cdp, tx, ty, zoom = 2.0) {
  await cdp.evaluate(`
    (function () {
      const renderer = window.__cap.renderer;
      renderer.camera.zoom = ${zoom}; renderer.cameraTarget.zoom = ${zoom};
      renderer.camera.x = ${tx} - ${REVEAL_BIAS}; renderer.camera.y = ${ty} - ${REVEAL_BIAS};
      renderer.cameraTarget.x = renderer.camera.x; renderer.cameraTarget.y = renderer.camera.y;
      return { ok: true };
    })()
  `);
  await new Promise((r) => setTimeout(r, 150)); // let the real clampCamera() settle it
}

/** Remove any still-visible toast nodes (2.6s auto-remove is slower than this script moves, and
 * unreliable outright on a headless/off-screen page where setTimeout can be throttled) so a
 * capture that isn't specifically about a toast doesn't carry a stale leftover one. */
async function clearToasts(cdp) {
  return cdp.evaluate(`
    (function () {
      document.querySelectorAll('#toasts .toast').forEach((n) => n.remove());
      return true;
    })()
  `);
}

async function clickDock(cdp, panelId) {
  return cdp.evaluate(`
    (function () {
      const btn = document.querySelector('[data-panel="${panelId}"]');
      if (!btn) return { ok: false, error: 'no dock button for ${panelId}' };
      if (btn.hidden) return { ok: false, error: '${panelId} dock button is hidden' };
      btn.click();
      return { ok: true };
    })()
  `);
}

async function clickSelector(cdp, selector) {
  return cdp.evaluate(`
    (function () {
      const el = document.querySelector('${selector}');
      if (!el) return { ok: false, error: 'no element for ${selector}' };
      el.click();
      return { ok: true };
    })()
  `);
}

// ---------------------------------------------------------------------------
// Main capture sequence
// ---------------------------------------------------------------------------
async function main() {
  const cdp = await Cdp.connect();
  await cdp.pollUntilTrue('document.readyState === "complete" && !!window.__farmDebug', 15000);
  console.log('[boot] app fully booted, __farmDebug present');

  // Standard capture viewport: smaller than the default 1280x800 window purely to keep PNGs
  // git-friendly (measured ~160KB at 896x560 vs ~650KB at the default size for the same
  // scene). This is a capture-tool choice, not a claim about any real window size — the
  // dedicated narrow/wide-width captures below use real documented sizes instead.
  await cdp.setViewport(896, 560);
  await new Promise((r) => setTimeout(r, 250));

  // -------------------------------------------------------------------
  // 1. Boot state — captured BEFORE any bootstrap/mutation, the truest "cold open".
  // -------------------------------------------------------------------
  const bootInfo = await cdp.evaluate(`JSON.stringify({
    level: window.__farmDebug.state.level,
    tutorialVisible: document.getElementById('tutorial') && !document.getElementById('tutorial').hidden,
  })`);
  console.log('[boot] state:', bootInfo);
  await shot(cdp, {
    name: '01-boot-tutorial',
    surface: 'World at first boot (level 1, fresh save)',
    stateDescription: 'Cold boot on a brand-new save: level 1, six pre-placed empty fields, ' +
      'the level/coins/diamonds/silo/barn HUD, and the guided tutorial overlay (Farmhand ' +
      'Ellie) auto-started and visible.',
    alt: 'Farm Tycoon at first launch: an isometric meadow with six empty field plots, the ' +
      'top HUD showing level 1, and a tutorial speech bubble overlay.',
    tags: ['boot', 'tutorial'],
  });

  // Now acquire live module references for everything after this.
  await bootstrapCaptureBridge(cdp);

  // Dismiss the tutorial so it doesn't obscure every later panel/structure capture.
  await cdp.evaluate('window.__cap.tutorial.skip(); true');
  await new Promise((r) => setTimeout(r, 150));

  // -------------------------------------------------------------------
  // 2. Locked/derelict structures — the game's defining rule: every structure is visible and
  //    clickable from level 1, but shows an unlock-level toast until the player reaches it.
  //    Captured NOW, while level is still genuinely 1, via real synthetic taps (not direct
  //    ui.openPanel() calls) so input.js's real lock check actually runs. A representative
  //    spread across the unlock curve (level 6 through 60) rather than all 22 — the visual is
  //    the same shape (derelict sprite + toast) for every one; the panels loop below covers all
  //    22 structures for real, unlocked content.
  // -------------------------------------------------------------------
  const lockedSample = [
    { key: 'workshop_yard', file: '02-locked-workshop_yard', tag: 'locked-workshop_yard', level: 6 },
    { key: 'town_gate', file: '02b-locked-town_gate', tag: 'locked-town_gate', level: 20 },
    { key: 'mine_entrance', file: '02c-locked-mine_entrance', tag: 'locked-mine_entrance', level: 24 },
    { key: 'zoo_gate', file: '02d-locked-zoo_gate', tag: 'locked-zoo_gate', level: 34 },
    { key: 'airport', file: '02e-locked-airport', tag: 'locked-airport', level: 38 },
    { key: 'laboratory', file: '02f-locked-laboratory', tag: 'locked-laboratory', level: 54 },
    { key: 'museum_hall', file: '02g-locked-museum_hall', tag: 'locked-museum_hall', level: 60 },
  ];
  for (const l of lockedSample) {
    await clearToasts(cdp);
    const r = await tapStructure(cdp, l.key, 2.5); // max zoom brings the clamp's achievable
    // camera range as close as it can get to the structure's real position (see the
    // clampCamera discovery note above tapStructure).
    console.log(`[tap] ${l.key} (locked, level 1):`, JSON.stringify(r));
    await new Promise((res) => setTimeout(res, 200)); // let the toast element mount
    await shot(cdp, {
      name: l.file,
      surface: `Locked/derelict world structure: ${l.key} (unlocks at level ${l.level})`,
      stateDescription: `Player is still level 1. Tapped the ${l.key} structure, which renders ` +
        'derelict in the world and is still clickable — the real input.js click path fires the ' +
        `red "…unlocks at level ${l.level}." toast instead of opening its panel. Every one of ` +
        'the 22 STRUCTURES entries behaves identically; this is one representative sample of ' +
        'the unlock curve.',
      alt: `The world view with a weathered, derelict-looking ${l.key.replace(/_/g, ' ')} and a ` +
        `red toast notification reading that it unlocks at level ${l.level}.`,
      tags: [l.tag, 'toast-error'], // the red "…unlocks at level N." toast IS the error-toast example
    });
  }

  // -------------------------------------------------------------------
  // 3. All four crop growth stages (drawCropStage's real boundaries: g<=0 seed dots, g<0.5
  //    sprout, 0.5<=g<1 growing stem, g>=1 ready head), using the real production.plant() call
  //    identical to what the radial-menu "plant" option invokes, then backdating plantedAt to
  //    fake elapsed time exactly like window.__farmDebug.timeSkip() does. Plants on four of the
  //    six starting fields; two (field_5, field_6) stay empty soil for contrast.
  // -------------------------------------------------------------------
  const plantInfo = await cdp.evaluate(`
    (function () {
      const production = window.__cap.production;
      const s = window.__cap.state.state;
      const growTimeMs = window.__cap.data.CROPS.wheat.growTime * 1000;
      const now = Date.now();
      const results = [];
      const stageFor = (id, frac) => {
        results.push(production.plant(id, 'wheat'));
        const f = s.farm.objects.find((o) => o.id === id);
        if (f && frac !== 0) { f.plantedAt = now - growTimeMs * frac; f.readyAt = f.plantedAt + growTimeMs; }
      };
      stageFor('field_1', 0);     // seed: g<=0, freshly planted
      stageFor('field_2', 0.25);  // sprout: g<0.5
      stageFor('field_3', 0.75);  // growing: 0.5<=g<1
      stageFor('field_4', 1.2);   // ready: g>=1
      return JSON.stringify(results);
    })()
  `);
  console.log('[plant] results:', plantInfo);
  // Frame the four planted fields (field_1..field_4, x=11..14, y=13) instead of leaving the
  // camera wherever the previous structure tap left it.
  await panTo(cdp, 12.5, 13.5);
  await clearToasts(cdp);
  await new Promise((r) => setTimeout(r, 200)); // let a frame redraw with the new growProgress
  await shot(cdp, {
    name: '03-world-growth-stages',
    surface: 'World view: all four crop growth stages',
    stateDescription: 'Four of the six starting fields planted with wheat via the real ' +
      'production.plant() call, then backdated (same technique as window.__farmDebug.' +
      'timeSkip()) to land in each of drawCropStage\'s four visual bands: field_1 freshly ' +
      'planted (seed dots), field_2 at 25% (sprout leaves), field_3 at 75% (growing stem), ' +
      'field_4 past 100% (full ready head). field_5/field_6 remain empty soil plots for contrast.',
    alt: 'A farm showing wheat at four different growth stages side by side — bare seeded soil, ' +
      'small sprouts, a growing stem, and a fully grown ready-to-harvest head — next to two ' +
      'empty tilled plots.',
    tags: ['growth-seed', 'growth-sprout', 'growth-growing', 'growth-ready'],
  });

  // -------------------------------------------------------------------
  // 4. Real radial-menu interactions: tap an empty field to open the plant-crop radial, then
  //    tap a ready field to open the harvest radial, then click Harvest for a success toast.
  // -------------------------------------------------------------------
  const field5 = await cdp.evaluate(`
    JSON.stringify(window.__cap.state.state.farm.objects.find((o) => o.id === 'field_5'))
  `);
  const f5 = JSON.parse(field5);
  await tapTile(cdp, f5.x, f5.y);
  await clearToasts(cdp); // headless/off-screen pages can throttle setTimeout, so the 2.6s
  // toast auto-remove is not reliable here — clear explicitly rather than trusting the timer.
  await new Promise((r) => setTimeout(r, 150));
  await shot(cdp, {
    name: '04-plant-radial-menu',
    surface: 'Radial menu: planting on an empty field',
    stateDescription: 'Tapped the empty field_5 plot. The radial context menu opened showing ' +
      'every unlocked crop (only Wheat is unlocked at level 1) as a tappable option.',
    alt: 'A circular radial menu floating over an empty field plot, offering a wheat crop icon ' +
      'to plant.',
    tags: ['radial-plant'],
  });

  const field4b = await cdp.evaluate(`
    JSON.stringify(window.__cap.state.state.farm.objects.find((o) => o.id === 'field_4'))
  `);
  const f4b = JSON.parse(field4b);
  await tapTile(cdp, f4b.x, f4b.y);
  await new Promise((r) => setTimeout(r, 150));
  await shot(cdp, {
    name: '05-harvest-radial-menu',
    surface: 'Radial menu: harvesting a ready field',
    stateDescription: 'Tapped field_4, which is ready to harvest (from the growth-stages step ' +
      'above). The radial menu opened with the single Harvest option.',
    alt: 'A circular radial menu over a fully grown wheat field, offering a single harvest ' +
      'basket icon.',
    tags: ['radial-harvest'],
  });

  await clickSelector(cdp, '#radial button');
  await new Promise((r) => setTimeout(r, 250)); // toast mount + field redraw
  await shot(cdp, {
    name: '06-harvest-success-toast',
    surface: 'Toast notification: successful harvest',
    stateDescription: 'Clicked the Harvest option from the radial menu. The real ' +
      'production.harvest() ran, field_4 is cleared back to empty soil, and a green success ' +
      'toast reads "Harvested Wheat!".',
    alt: 'A green success toast reading "Harvested Wheat!" over the farm, with the ' +
      'previously-ready field now empty again.',
    tags: ['toast-success'],
  });

  // -------------------------------------------------------------------
  // 5. Dock panels (the only systems that open from the dock rather than the world, per
  //    CLAUDE.md): decorate (both toggle states), achievements, settings + its Reset game
  //    confirmation modal. Co-op is in the DOM with a `hidden` attribute that nothing in this
  //    build ever clears — genuinely unreachable, recorded in notReachable below.
  // -------------------------------------------------------------------
  await clearToasts(cdp); // drop the intentional harvest-success toast from the previous shot
  await clickDock(cdp, 'decorate');
  await new Promise((r) => setTimeout(r, 150));
  await shot(cdp, {
    name: '07-dock-decorate-off',
    surface: 'Dock panel: Decorate (off)',
    stateDescription: 'Opened via the dock\'s paintbrush button. Shows the "Enter Decorate ' +
      'Mode" toggle from ui.js\'s renderDecorate(), in its default off state.',
    alt: 'A sliding bottom sheet panel titled Decorate with a single "Enter Decorate Mode" button.',
    tags: ['dock-decorate-off'],
  });

  await clickSelector(cdp, '#sheet-content button');
  await new Promise((r) => setTimeout(r, 200));
  await shot(cdp, {
    name: '07b-dock-decorate-on',
    surface: 'Dock panel: Decorate (on) + toast',
    stateDescription: 'Clicked "Enter Decorate Mode". state.decorate.active flips to true and ' +
      'an info toast confirms it, but decorate mode has no other effect anywhere in ' +
      'renderer.js/input.js/farm.js in this build — grepped all three for "decorate" and found ' +
      'nothing beyond this boolean and its toast/button-label. There is no drag-to-arrange UI yet.',
    alt: 'The Decorate panel closed with an info toast reading that decorate mode is on and ' +
      'the player can drag decorations to arrange the farm, though no such dragging exists yet.',
    tags: ['dock-decorate-on'],
  });

  await clickDock(cdp, 'achievements');
  await new Promise((r) => setTimeout(r, 150));
  await shot(cdp, {
    name: '08-dock-achievements-panel',
    surface: 'Dock panel: Achievements',
    stateDescription: 'Opened via the dock\'s star button. Shows the achievement-count summary ' +
      'text from renderAchievements() — 0 unlocked so far on this fresh save.',
    alt: 'A sliding bottom sheet panel titled Achievements reading "0 achievements unlocked so far."',
    tags: ['dock-achievements'],
  });

  await clickDock(cdp, 'settings');
  await new Promise((r) => setTimeout(r, 150));
  await shot(cdp, {
    name: '09-dock-settings-panel',
    surface: 'Dock panel: Settings',
    stateDescription: 'Opened via the dock\'s gear button. Shows the Sound on/off toggle, the ' +
      'language line (English only — no other locales exist in this build), Export save, and ' +
      'the Reset game danger button.',
    alt: 'A sliding bottom sheet panel titled Settings with a Sound toggle, a language line, ' +
      'and Export save / Reset game buttons.',
    tags: ['dock-settings'],
  });

  await clickSelector(cdp, '.btn-danger');
  await new Promise((r) => setTimeout(r, 200));
  await shot(cdp, {
    name: '09b-confirm-reset-dialog',
    surface: 'Confirmation dialog: Reset game',
    stateDescription: 'Clicked "Reset game" in Settings. openModal() shows the real confirmation ' +
      'dialog: "Reset your farm? This deletes all progress and cannot be undone." with Cancel ' +
      'and Reset buttons. Cancel was clicked afterward (not captured) so the run\'s save was ' +
      'never actually reset.',
    alt: 'A modal dialog asking to confirm resetting the farm, warning that it deletes all ' +
      'progress and cannot be undone, with Cancel and Reset buttons.',
    tags: ['confirm-dialog'],
  });
  await clickSelector(cdp, '[data-close]'); // Cancel — never actually reset this run's save
  await new Promise((r) => setTimeout(r, 150));

  // -------------------------------------------------------------------
  // 6. Bump level and coins so every structure/animal/building is reachable, then build a
  //    chicken pen and a feed mill via the real workshop panel (farm.place(), not a shortcut),
  //    to capture animals in a pen and the building-queue panel.
  // -------------------------------------------------------------------
  const buildInfo = await cdp.evaluate(`
    (function () {
      const s = window.__cap.state.state;
      const farm = window.__cap.farm;
      const FARM = window.__cap.data.FARM;
      const STRUCTURES = window.__cap.data.STRUCTURES;
      s.level = 60;
      s.coins = 999999;
      window.__cap.ui.updateHud();
      // Mirrors ui.js's own overlapsAnyStructure()/findFreeTile(): farm.canPlace() only checks
      // other state.farm.objects, not the always-present STRUCTURES footprints (they're world
      // chrome, not farm objects), so a spot free by canPlace() alone can still sit on top of a
      // structure like barn/silo — tapping it later would open THAT structure's panel instead
      // of the newly placed pen/building.
      function overlapsAnyStructure(x, y, w, h) {
        for (const def of Object.values(STRUCTURES)) {
          const [sw, sh] = def.size;
          if (x < def.pos.x + sw && x + w > def.pos.x && y < def.pos.y + sh && y + h > def.pos.y) return true;
        }
        return false;
      }
      function findFree(w, h) {
        for (let y = FARM.startZone.y; y < FARM.startZone.y + FARM.startZone.h - h + 1; y++) {
          for (let x = FARM.startZone.x; x < FARM.startZone.x + FARM.startZone.w - w + 1; x++) {
            if (farm.canPlace(x, y, w, h) && !overlapsAnyStructure(x, y, w, h)) return [x, y];
          }
        }
        return null;
      }
      const spot1 = findFree(2, 2);
      const pen = spot1 ? farm.place('pen', 'chicken', spot1[0], spot1[1]) : null;
      const spot2 = findFree(2, 2);
      const mill = spot2 ? farm.place('building', 'feed_mill', spot2[0], spot2[1]) : null;
      s.silo.items.wheat = (s.silo.items.wheat || 0) + 20;
      s.silo.items.corn = (s.silo.items.corn || 0) + 20;
      // production.feedPen() requires state.barn.items[animal.feed] >= animal.capacity (5 for
      // chicken) before the real Feed radial option succeeds — grant it directly, same as
      // window.__farmDebug.give() would, so the feed->collect flow actually completes for real
      // instead of failing on "No feed available." (confirmed happened without this).
      s.barn.items = s.barn.items || {};
      s.barn.items.chicken_feed = (s.barn.items.chicken_feed || 0) + 10;
      // Raw construction MATERIALS for the Building Workshop crafting-flow capture below —
      // granted directly for the same reason as chicken_feed above: this is the "inventory
      // bump" convention this script already uses throughout, mirroring
      // window.__farmDebug.give(), never a fabricated UI state. Only enough for one Roof
      // Shingle component (slab:1, nails:1, see BUILDINGS.build_workshop.recipes in data.js);
      // the later kit-tier grant happens inline in that section, after the real craft/collect
      // call for the component tier has already run.
      s.barn.items.slab = (s.barn.items.slab || 0) + 1;
      s.barn.items.nails = (s.barn.items.nails || 0) + 1;
      return JSON.stringify({ pen, mill });
    })()
  `);
  console.log('[build] pen + mill:', buildInfo);
  const built = JSON.parse(buildInfo);

  if (built.pen) {
    await cdp.evaluate('window.__cap.ui.closePanel(); true'); // Settings is still open from the
    // Reset-game confirmation step above — Cancel dismisses the modal, not the sheet behind it.
    await panTo(cdp, built.pen.x + 0.5, built.pen.y + 0.5, 2.2);
    await clearToasts(cdp);
    await new Promise((r) => setTimeout(r, 250));
    await shot(cdp, {
      name: '10-pen-built',
      surface: 'World view: a chicken pen built via the real Workshop panel',
      stateDescription: 'A chicken pen placed with farm.place(\'pen\', \'chicken\', ...) — the ' +
        'same call the Workshop panel\'s Build button makes — rendered by sprites.drawPen().',
      alt: 'A fenced chicken pen sitting on the farm.',
      tags: ['pen-built'],
    });

    await tapTile(cdp, built.pen.x, built.pen.y, 2.2);
    await new Promise((r) => setTimeout(r, 150));
    await shot(cdp, {
      name: '10b-pen-radial-feed',
      surface: 'Radial menu: feeding an unfed pen',
      stateDescription: 'Tapped the freshly built, unfed chicken pen. The radial menu opened ' +
        'with the single Feed option (penRadial() in input.js).',
      alt: 'A radial menu over a chicken pen offering a single feed icon.',
      tags: ['pen-radial-feed'],
    });
    await clickSelector(cdp, '#radial button');
    await new Promise((r) => setTimeout(r, 200));

    // Skip the produce timer the same way window.__farmDebug.timeSkip() does, then tap again
    // for the Collect radial.
    await cdp.evaluate(`
      (function () {
        const s = window.__cap.state.state;
        const pen = s.farm.objects.find((o) => o.kind === 'pen' && o.type === 'chicken');
        if (pen && pen.readyAt) pen.readyAt = Date.now() - 1000;
        return true;
      })()
    `);
    await tapTile(cdp, built.pen.x, built.pen.y, 2.2);
    await new Promise((r) => setTimeout(r, 150));
    await shot(cdp, {
      name: '10c-pen-radial-collect',
      surface: 'Radial menu: collecting a ready pen',
      stateDescription: 'Fed the pen (previous step), backdated its readyAt the same way ' +
        'window.__farmDebug.timeSkip() would, then tapped again. The radial menu now offers ' +
        'the Collect option.',
      alt: 'A radial menu over a chicken pen offering a single collect icon.',
      tags: ['pen-radial-collect'],
    });
  } else {
    console.warn('[warn] could not place a chicken pen — no free tile found');
  }

  // -------------------------------------------------------------------
  // 7. Building queue panel — clicking a PLACED production building (not a STRUCTURES entry)
  //    opens ui.js's renderBuildingQueue(). This used to show numbered "0"-"9" cards with a
  //    "?" icon (def.recipes is an ARRAY, and the panel read it with Object.entries() as if it
  //    were a keyed object) and had no way to collect finished output at all. Commit 2b33dec
  //    ("Wire the Building Workshop panel to workshop.js: kits gate placement, not coins")
  //    fixed both: cards now read recipe.id/name for real, and renderQueue() shows a live
  //    progress bar plus a Collect button once an entry's readyAt has passed. Exercised for
  //    real end to end here: real production.enqueue() via the Queue button, a real backdated
  //    readyAt (same technique as window.__farmDebug.timeSkip()), then a real
  //    production.collectBuilding() via the Collect button — never called directly.
  // -------------------------------------------------------------------
  if (built.mill) {
    // Tap the placed building's own tile — farm.objectAt() + the 'building' branch of
    // input.js's handleTap() — rather than calling ui.openPanel() directly, for the same
    // real-interaction-path reason as everywhere else in this script.
    await clearToasts(cdp); // drop the "Fed!" toast left over from the pen-feeding step above
    await tapTile(cdp, built.mill.x, built.mill.y, 2.2);
    await new Promise((res) => setTimeout(res, 150));
    // Queue button on the Chicken Feed card (recipes[0] — the first .build-card in the empty-
    // queue panel) — real production.enqueue(millId, 'chicken_feed') via the click handler,
    // consuming the wheat/corn granted above. Panel auto-refreshes via refreshPanel().
    await clickSelector(cdp, '#sheet-content .build-card button');
    await new Promise((r) => setTimeout(r, 200));
    await shot(cdp, {
      name: '11-building-queue-panel',
      surface: 'Building queue panel (Feed Mill): Chicken Feed queued, in progress',
      stateDescription: 'Opened the placed Feed Mill\'s queue panel and clicked Queue on the ' +
        'Chicken Feed card — real production.enqueue() consuming 2 wheat + 1 corn from the ' +
        'silo. The queue now shows the real recipe NAME (fixed by commit 2b33dec — recipe.id ' +
        'is used for the lookup instead of the array index) with a live progress bar reading ' +
        '"Crafting…". The "❔" beside the name is a separate, still-open gap this run found ' +
        'while capturing, not fixed by 2b33dec and out of this run\'s scope: itemIcon() in ' +
        'ui.js falls back to \'❔\' whenever CROPS/GOODS/ANIMALS/MATERIALS[id].icon is missing, ' +
        'and grepping the whole of data.js for the literal text "icon:" returns zero matches — ' +
        'no crop, good, animal or material in this build defines one, so every itemIcon() call ' +
        'in every DOM panel (barn, silo, orders, this queue, the Workshop\'s own craft/build ' +
        'grids below) shows "❔" instead of a real icon. The world-canvas radial menus are ' +
        'unaffected — they draw crop icons a different way (see 04-plant-radial-menu.png).',
      alt: 'A building queue panel showing a Chicken Feed card with a question-mark icon and a ' +
        'partially filled progress bar with the label Crafting.',
      tags: ['building-queue'],
    });

    // Backdate the real production entry the same way window.__farmDebug.timeSkip() would,
    // then re-tap so the panel re-renders against the now-ready entry.
    await cdp.evaluate(`
      (function () {
        const entry = window.__cap.state.state.production.find(
          (p) => p.objectId === '${built.mill.id}' && p.recipeId === 'chicken_feed');
        if (entry) entry.readyAt = Date.now() - 1000;
        return true;
      })()
    `);
    await tapTile(cdp, built.mill.x, built.mill.y, 2.2);
    await clearToasts(cdp); // drop the "Queued Chicken Feed!" toast from the click above
    await new Promise((res) => setTimeout(res, 150));
    await shot(cdp, {
      name: '11b-building-queue-ready',
      surface: 'Building queue panel (Feed Mill): Chicken Feed ready to collect',
      stateDescription: 'Same real queue entry, backdated to ready. renderQueue() now shows a ' +
        'full progress bar, "Ready to collect!", and a real Collect button — production.js has ' +
        'no per-building collect UI at all before 2b33dec; this is the first capture of it existing.',
      alt: 'A building queue panel showing a Chicken Feed card with a full progress bar, the ' +
        'label Ready to collect, and a Collect button.',
      tags: ['building-queue'],
    });

    // Real production.collectBuilding(millId) via the Collect button.
    await clickSelector(cdp, '#sheet-content .order-card button');
    await new Promise((r) => setTimeout(r, 200));
    await shot(cdp, {
      name: '11c-building-queue-collected',
      surface: 'Building queue panel (Feed Mill): Chicken Feed collected',
      stateDescription: 'Clicked Collect. production.collectBuilding() moved the finished ' +
        'Chicken Feed into the barn, the queue entry is gone, and a green "Collected Chicken ' +
        'Feed!" toast confirms it — the same real production.collectBuilding() call the ' +
        'Workshop\'s own kit/component collect buttons make (see the Workshop crafting-flow ' +
        'captures below).',
      alt: 'A building queue panel with an empty queue and a green toast reading Collected ' +
        'Chicken Feed, over the farm.',
      tags: ['building-queue'],
    });
  } else {
    console.warn('[warn] could not place a feed mill — no free tile found');
  }

  // -------------------------------------------------------------------
  // 8. All 22 STRUCTURES panels, for completeness. Nine have real content (barn/silo/orders/
  //    shop/workshop, already captured above for barn/silo/workshop — recaptured here too for
  //    a complete same-pass set); the rest fall through to the generic "being built" text.
  //    Every one is still opened for real via a synthetic world tap, never ui.openPanel()
  //    directly.
  // -------------------------------------------------------------------
  const structurePanels = [
    { key: 'barn', file: '12-panel-barn', label: 'Barn', tag: 'panel-barn',
      desc: 'Real content: renderBarnOrSilo() shows the empty-inventory message (nothing has ' +
        'been cooked into the barn yet on this save).',
      alt: 'A sliding panel titled Barn with the empty-state text "No goods in the barn yet — cook something up!"' },
    { key: 'silo', file: '13-panel-silo', label: 'Silo', tag: 'panel-silo',
      desc: 'Real content: renderBarnOrSilo() lists the wheat harvested earlier as a sellable item card.',
      alt: 'A sliding panel titled Silo showing a wheat item card with quantity and a sell button.' },
    { key: 'order_board', file: '14-panel-order_board', label: 'Order Board', tag: 'panel-order_board',
      desc: 'renderOrders() is real and wired, but nothing in this build ever calls ' +
        'orders.refreshBoard() to populate state.orders.board, so it shows the same generic ' +
        'fallback as an unwired system.',
      alt: 'A sliding panel titled Orders reading that the order board is being built — check back soon.' },
    { key: 'truck_bay', file: '15-panel-truck_bay', label: 'Truck Bay', tag: 'panel-truck_bay',
      desc: 'panel id "truck" has no case in renderPanelContent()\'s switch — generic fallback.',
      alt: 'A sliding panel titled Truck reading that the Truck Bay is being built — check back soon.' },
    { key: 'shop_stand', file: '16-panel-shop_stand', label: 'Roadside Shop', tag: 'panel-shop_stand',
      desc: 'renderShop() is real, but nothing populates state.shop.listings yet, so it shows the fallback.',
      alt: 'A sliding panel titled Shop reading that the roadside shop is being built — check back soon.' },
    { key: 'boat_dock', file: '17-panel-boat_dock', label: 'Boat Dock', tag: 'panel-boat_dock',
      desc: 'boat.js is implemented but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Boat reading that the Boat Dock is being built — check back soon.' },
    { key: 'lake', file: '18-panel-lake', label: 'Fishing Lake', tag: 'panel-lake',
      desc: 'fishing.js is implemented but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Fishing reading that the Fishing Lake is being built — check back soon.' },
    { key: 'mine_entrance', file: '19-panel-mine_entrance', label: 'Mine Entrance', tag: 'panel-mine_entrance',
      desc: 'mine.js is implemented (153 lines, exercised directly by tools/test-*.mjs) but not ' +
        'wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Mine reading that the Mine Entrance is being built — check back soon.' },
    { key: 'merge_plot', file: '20-panel-merge_plot', label: 'Merge Meadow', tag: 'panel-merge_plot',
      desc: 'merge.js is implemented (219 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Merge reading that the Merge Meadow is being built — check back soon.' },
    { key: 'market_stall', file: '21-panel-market_stall', label: 'Market Stall', tag: 'panel-market_stall',
      desc: 'shop.js has a marketOffers()/buyOffer() pair but ui.js has no "market" case — generic fallback.',
      alt: 'A sliding panel titled Market reading that the Market Stall is being built — check back soon.' },
    { key: 'train_station', file: '22-panel-train_station', label: 'Train Station', tag: 'panel-train_station',
      desc: 'trains.js is implemented (242 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Trains reading that the Train Station is being built — check back soon.' },
    { key: 'airport', file: '23-panel-airport', label: 'Airport', tag: 'panel-airport',
      desc: 'No "airport" case in ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Airport reading that the Airport is being built — check back soon.' },
    { key: 'helipad', file: '24-panel-helipad', label: 'Helicopter Pad', tag: 'panel-helipad',
      desc: 'helicopter.js is implemented (156 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Helicopter reading that the Helicopter Pad is being built — check back soon.' },
    // workshop_yard is deliberately NOT in this generic list — as of commit 2b33dec it has a
    // real, multi-step materials -> components -> kits -> building flow, captured in its own
    // dedicated block (files 25, 25b-25h) right after this loop, not the one-shot pattern
    // every other structure panel gets here.
    { key: 'museum_hall', file: '26-panel-museum_hall', label: 'Museum', tag: 'panel-museum_hall',
      desc: 'museum.js is implemented (74 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Museum reading that the Museum is being built — check back soon.' },
    { key: 'laboratory', file: '27-panel-laboratory', label: 'Laboratory', tag: 'panel-laboratory',
      desc: 'lab.js is implemented (184 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Laboratory reading that the Laboratory is being built — check back soon.' },
    { key: 'expedition_camp', file: '28-panel-expedition_camp', label: 'Expedition Camp', tag: 'panel-expedition_camp',
      desc: 'expeditions.js is implemented (171 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Expeditions reading that the Expedition Camp is being built — check back soon.' },
    { key: 'town_gate', file: '29-panel-town_gate', label: 'Road to Town', tag: 'panel-town_gate',
      desc: 'town.js is implemented (124 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Town reading that the Road to Town is being built — check back soon.' },
    { key: 'zoo_gate', file: '30-panel-zoo_gate', label: 'Road to the Zoo', tag: 'panel-zoo_gate',
      desc: 'zoo.js is implemented (181 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Zoo reading that the Road to the Zoo is being built — check back soon.' },
    { key: 'mailbox', file: '31-panel-mailbox', label: 'Mailbox', tag: 'panel-mailbox',
      desc: 'newspaper.js is implemented (127 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Newspaper reading that the Mailbox is being built — check back soon.' },
    { key: 'bookshelf', file: '32-panel-bookshelf', label: 'Collections Shelf', tag: 'panel-bookshelf',
      desc: 'collections.js is implemented (146 lines) but not wired into ui.js\'s panel switch — generic fallback.',
      alt: 'A sliding panel titled Collections reading that the Collections Shelf is being built — check back soon.' },
    { key: 'tripod', file: '33-panel-tripod', label: 'Camera Tripod', tag: 'panel-tripod',
      desc: 'decorate.js has photo-mode fields but ui.js\'s "photo" case is absent — generic fallback.',
      alt: 'A sliding panel titled Photo Mode reading that the Camera Tripod is being built — check back soon.' },
  ];

  await clearToasts(cdp);
  for (const p of structurePanels) {
    const r = await tapStructure(cdp, p.key);
    if (!r || !r.ok) { console.warn(`[warn] tap failed for ${p.key}:`, JSON.stringify(r)); continue; }
    await new Promise((res) => setTimeout(res, 150));
    await shot(cdp, {
      name: p.file,
      surface: `Structure panel: ${p.label}`,
      stateDescription: p.desc,
      alt: p.alt,
      tags: [p.tag],
    });
  }

  // -------------------------------------------------------------------
  // 8b. Building Workshop crafting flow (workshop.js, wired into ui.js by commit 2b33dec) —
  //     the game's own headline mechanic per CLAUDE.md: buildings are CRAFTED, not bought.
  //     Every craft/collect/build action below is the real click handler in src/ui.js calling
  //     the real workshop.js/production.js functions — never called directly and presented as
  //     what the UI shows. The only direct state mutations are inventory GRANTS (raw materials
  //     for one component, then — after that component's real craft/collect has already run
  //     once — the remaining inputs for one kit recipe), the same "inventory bump" convention
  //     used throughout this script (window.__farmDebug.give() does the same thing).
  // -------------------------------------------------------------------
  await cdp.evaluate('window.__cap.ui.closePanel(); true');
  await clearToasts(cdp);

  // 1. Tap the (still unbuilt) Workshop structure — renderWorkshop() shows only its own
  //    coin-cost Build card until BUILDINGS.build_workshop is actually placed.
  await tapStructure(cdp, 'workshop_yard');
  await new Promise((r) => setTimeout(r, 150));
  await shot(cdp, {
    name: '25-panel-workshop_yard',
    surface: 'Structure panel: Building Workshop (not yet built)',
    stateDescription: 'Tapped the workshop_yard structure before the Workshop itself has been ' +
      'placed. renderWorkshop() shows a single coin-cost "Build the Workshop" card and nothing ' +
      'else — the materials/components/kits chain only exists once this building is up.',
    alt: 'A sliding panel titled Workshop with one card offering to build the Workshop itself for coins.',
    tags: ['panel-workshop_yard'],
  });

  // 2. Build the Workshop for real (farm.place() via the panel's own Build button).
  await clickSelector(cdp, '#sheet-content .build-card button');
  await new Promise((r) => setTimeout(r, 200));
  await clearToasts(cdp); // drop "Built Workshop!" — this block's shots each show their own fresh toast, not a stack of old ones
  const workshopId = await cdp.evaluate(`
    (function () {
      const obj = window.__cap.state.state.farm.objects.find(
        (o) => o.kind === 'building' && o.type === 'build_workshop');
      return obj ? obj.id : null;
    })()
  `);

  if (workshopId) {
    await shot(cdp, {
      name: '25b-workshop-craft-available',
      surface: 'Workshop panel: crafting chain unlocked (materials granted)',
      stateDescription: 'The Workshop is now built. renderWorkshop() shows the real crafting ' +
        'chain: 1 slab + 1 nails were granted directly into the barn (an inventory bump, same ' +
        'convention as chicken_feed above), enough to craft one Roof Shingle. Every other ' +
        'component/kit card on this recipe list shows exactly which inputs are still short — ' +
        'this IS the materials economy CLAUDE.md describes, rendered honestly rather than a ' +
        'blanket "locked" state. Every card shows a "❔" instead of a real icon — see ' +
        '11-building-queue-panel\'s manifest entry for why (data.js defines no icon field on ' +
        'any item; a separate, pre-existing gap this capture pass found but was not asked to fix).',
      alt: 'A Workshop panel showing a grid of craftable components and kits with question-mark ' +
        'icons, most disabled with a note listing which materials are missing, one (Roof Shingle) enabled.',
      tags: ['workshop-crafting-flow'],
    });

    // 3. Craft the Roof Shingle component for real — workshop.craft('shingle') via the Craft
    //    button, which is the first .build-card in the DOM (the queue is empty so renderQueue()
    //    renders nothing yet, and 'shingle' is recipes[0] in BUILDINGS.build_workshop.recipes).
    await clickSelector(cdp, '#sheet-content .build-card button');
    await new Promise((r) => setTimeout(r, 200));
    await shot(cdp, {
      name: '25c-workshop-craft-in-progress',
      surface: 'Workshop panel: Roof Shingle crafting',
      stateDescription: 'Clicked Craft on the Roof Shingle card. Real workshop.craft(\'shingle\') ' +
        '-> production.enqueue() consumed the granted slab + nails and pushed a real queue ' +
        'entry; renderQueue() shows it with a live progress bar and the label "Crafting…".',
      alt: 'A Workshop panel showing a Roof Shingle card with a progress bar partway full and the label Crafting.',
      tags: ['workshop-crafting-flow'],
    });

    // 4. Backdate the real entry (same technique as every other timer in this script), retap
    //    to force a fresh render, then collect it for real.
    await cdp.evaluate(`
      (function () {
        const entry = window.__cap.state.state.production.find(
          (p) => p.objectId === '${workshopId}' && p.recipeId === 'shingle');
        if (entry) entry.readyAt = Date.now() - 1000;
        return true;
      })()
    `);
    await tapStructure(cdp, 'workshop_yard');
    await clearToasts(cdp); // drop the "Crafting Roof Shingle…" toast from step 3
    await new Promise((r) => setTimeout(r, 150));
    await shot(cdp, {
      name: '25d-workshop-craft-ready',
      surface: 'Workshop panel: Roof Shingle ready to collect',
      stateDescription: 'The same real queue entry, backdated to ready. Full progress bar, ' +
        '"Ready to collect!", and a real Collect button — the Workshop\'s own crafting queue ' +
        'uses the exact same renderQueue()/Collect UI as an ordinary production building\'s ' +
        'queue panel (see the Feed Mill captures above), just backed by workshop.collect() ' +
        'instead of production.collectBuilding().',
      alt: 'A Workshop panel showing a Roof Shingle card with a full progress bar, the label Ready to collect, and a Collect button.',
      tags: ['workshop-crafting-flow'],
    });

    await clickSelector(cdp, '#sheet-content .order-card button'); // real workshop.collect(0)
    await new Promise((r) => setTimeout(r, 200));
    await shot(cdp, {
      name: '25e-workshop-component-collected',
      surface: 'Workshop panel: Roof Shingle collected into the barn',
      stateDescription: 'Clicked Collect. Real workshop.collect() moved 1 Roof Shingle into the ' +
        'barn and awarded its XP; a green "Collected Roof Shingle!" toast confirms it and the ' +
        'queue is empty again.',
      alt: 'A Workshop panel with an empty crafting queue and a green toast reading Collected Roof Shingle.',
      tags: ['workshop-crafting-flow'],
    });

    // 5. Kit tier: grant the REMAINING inputs kit_dairy needs (frame:2, panel:2, shingle: 2
    //    more, on top of the 1 real Roof Shingle just collected, for 3 total) directly into the
    //    barn — one tier up from the raw-material grant above, same convention, documented here
    //    rather than spending another dozen captures crafting every intermediate component for
    //    real. The kit itself is still crafted and collected for real, exactly like the
    //    component above.
    await cdp.evaluate(`
      (function () {
        const b = window.__cap.state.state.barn.items;
        b.frame = (b.frame || 0) + 2;
        b.panel = (b.panel || 0) + 2;
        b.shingle = (b.shingle || 0) + 2;
        return true;
      })()
    `);
    await tapStructure(cdp, 'workshop_yard');
    await clearToasts(cdp); // drop "Collected Roof Shingle!" from step 4
    await new Promise((r) => setTimeout(r, 150));

    // Craft the Dairy Kit for real — locate its card by its exact <strong> name (recipes[8] in
    // the list, not recipes[0], so a position-based selector would hit the wrong card).
    const kitCraft = await cdp.evaluate(`
      (function () {
        const cards = Array.from(document.querySelectorAll('#sheet-content .build-card'));
        const card = cards.find((c) => (c.querySelector('strong')?.textContent || '').trim() === 'Dairy Kit');
        if (!card) return { ok: false, error: 'no Dairy Kit card found' };
        const btn = card.querySelector('button');
        if (!btn || btn.disabled) return { ok: false, error: 'Dairy Kit Craft button missing/disabled' };
        btn.click();
        return { ok: true };
      })()
    `);
    if (!kitCraft || !kitCraft.ok) console.warn('[warn] Dairy Kit craft click failed:', JSON.stringify(kitCraft));
    await new Promise((r) => setTimeout(r, 200));

    await cdp.evaluate(`
      (function () {
        const entry = window.__cap.state.state.production.find(
          (p) => p.objectId === '${workshopId}' && p.recipeId === 'kit_dairy');
        if (entry) entry.readyAt = Date.now() - 1000;
        return true;
      })()
    `);
    await tapStructure(cdp, 'workshop_yard');
    await clearToasts(cdp); // drop "Crafting Dairy Kit…" from the click just above
    await new Promise((r) => setTimeout(r, 150));
    await shot(cdp, {
      name: '25f-workshop-kit-ready',
      surface: 'Workshop panel: Dairy Kit ready to collect',
      stateDescription: 'Crafted the Dairy Kit for real (workshop.craft(\'kit_dairy\')) from 2 ' +
        'Timber Frame + 2 Wall Panel + 3 Roof Shingle, backdated to ready. This is the KIT tier ' +
        'of the chain, not the component tier captured above — same real queue/Collect UI, one ' +
        'level higher.',
      alt: 'A Workshop panel showing a Dairy Kit card with a full progress bar, the label Ready to collect, and a Collect button.',
      tags: ['workshop-crafting-flow'],
    });

    const kitCollect = await cdp.evaluate(`
      (function () {
        const cards = Array.from(document.querySelectorAll('#sheet-content .order-card'));
        const card = cards.find((c) => c.textContent.includes('Dairy Kit'));
        const btn = card && card.querySelector('button');
        if (!btn) return { ok: false, error: 'no Dairy Kit Collect button found' };
        btn.click();
        return { ok: true };
      })()
    `);
    if (!kitCollect || !kitCollect.ok) console.warn('[warn] Dairy Kit collect click failed:', JSON.stringify(kitCollect));
    await new Promise((r) => setTimeout(r, 200));
    await clearToasts(cdp); // drop "Collected Dairy Kit!" — this shot is about the Build gate, not the collect toast

    // 6. Scroll to the Build section: the Dairy building card now shows a checked kit line and
    //    an enabled Build button, while every OTHER kit-gated building on the same list still
    //    shows the ❌ gated state — both halves of the gate visible in one honest screenshot.
    await cdp.evaluate(`
      (function () {
        const cards = Array.from(document.querySelectorAll('#sheet-content .build-card'));
        const card = cards.find((c) => (c.querySelector('strong')?.textContent || '').trim() === 'Dairy');
        card && card.scrollIntoView({ block: 'center' });
        return !!card;
      })()
    `);
    await new Promise((r) => setTimeout(r, 150));
    await shot(cdp, {
      name: '25g-workshop-build-gate',
      surface: 'Workshop panel: Build section, kit gate',
      stateDescription: 'Collected 1 Dairy Kit for real. The Dairy building card now shows a ' +
        'checked ✅ Dairy Kit line and an enabled Build button, while neighbouring kit-gated ' +
        'buildings (Sugar Mill, Popcorn Pot, …) still show ❌ and stay disabled — the exact gate ' +
        'commit 2b33dec added: BUILDINGS[x].kit held (workshop.hasKitFor) before Build is ever clickable.',
      alt: 'A Workshop panel Build section: the Dairy card shows a checked kit and an enabled ' +
        'Build button, while other building cards show an unchecked kit requirement and are disabled.',
      tags: ['workshop-crafting-flow'],
    });

    // 7. Place the Dairy for real — farm.place() + workshop.consumeKit('dairy'), never the
    //    other way around, and never on a failed placement (see workshop.consumeKit()).
    const buildClick = await cdp.evaluate(`
      (function () {
        const cards = Array.from(document.querySelectorAll('#sheet-content .build-card'));
        const card = cards.find((c) => (c.querySelector('strong')?.textContent || '').trim() === 'Dairy');
        const btn = card && card.querySelector('button');
        if (!btn || btn.disabled) return { ok: false, error: 'Dairy Build button missing/disabled' };
        btn.click();
        return { ok: true };
      })()
    `);
    if (!buildClick || !buildClick.ok) console.warn('[warn] Dairy build click failed:', JSON.stringify(buildClick));
    await new Promise((r) => setTimeout(r, 250));
    await shot(cdp, {
      name: '25h-workshop-building-placed',
      surface: 'Workshop panel: Dairy built',
      stateDescription: 'Clicked Build on the Dairy card. Real farm.place(\'building\', \'dairy\', ' +
        '...) placed it and workshop.consumeKit(\'dairy\') consumed the 1 Dairy Kit — a green ' +
        '"Built Dairy!" toast confirms it, and the Dairy card is gone from the Build grid (it\'s ' +
        'now a placed object, not an available one).',
      alt: 'A Workshop panel Build section with a green toast reading Built Dairy, and no Dairy card left in the list.',
      tags: ['workshop-crafting-flow'],
    });

    const dairyObj = await cdp.evaluate(`
      (function () {
        const obj = window.__cap.state.state.farm.objects.find((o) => o.type === 'dairy');
        return obj ? JSON.stringify({ x: obj.x, y: obj.y }) : null;
      })()
    `);
    if (dairyObj) {
      const dairy = JSON.parse(dairyObj);
      await cdp.evaluate('window.__cap.ui.closePanel(); true');
      await panTo(cdp, dairy.x + 0.5, dairy.y + 0.5, 2.2);
      await clearToasts(cdp);
      await new Promise((r) => setTimeout(r, 250));
      await shot(cdp, {
        name: '25i-workshop-dairy-in-world',
        surface: 'World view: the real placed Dairy building',
        stateDescription: 'The Dairy placed through the crafting flow above, rendered in the ' +
          'world by sprites.js like any other production building — the payoff of the whole ' +
          'materials -> components -> kit -> building chain.',
        alt: 'A dairy building sitting on the farm, freshly placed.',
        tags: ['workshop-crafting-flow'],
      });
    } else {
      console.warn('[warn] could not find placed Dairy object for the world-view capture');
    }
  } else {
    console.warn('[warn] could not build the Workshop — workshop-crafting-flow captures skipped');
  }

  // -------------------------------------------------------------------
  // 9. World at different zoom levels/positions — the meadow, the structures and the fields
  //    all at once, at two very different scales.
  // -------------------------------------------------------------------
  await cdp.evaluate('window.__cap.ui.closePanel(); true'); // close the last structure loop's panel
  await panTo(cdp, 16, 16, 0.5); // zoomed way out over the whole start zone
  await clearToasts(cdp);
  await new Promise((r) => setTimeout(r, 250));
  await shot(cdp, {
    name: '34-world-zoom-out',
    surface: 'World view zoomed far out (0.5x, the ZOOM_MIN floor)',
    stateDescription: 'Camera zoom set to 0.5 (renderer.js ZOOM_MIN), centered on the start ' +
      'zone, showing the widest slice of meadow, fields and nearby structures the camera can ' +
      'frame at once.',
    alt: 'A wide, zoomed-out view of the farm showing the meadow, several fields and nearby buildings together.',
    tags: ['zoom-out'],
  });

  await panTo(cdp, 12.5, 13.5, 2.5); // zoomed way in on the planted field cluster
  await new Promise((r) => setTimeout(r, 250));
  await shot(cdp, {
    name: '35-world-zoom-in',
    surface: 'World view zoomed far in (2.5x, the ZOOM_MAX ceiling)',
    stateDescription: 'Camera zoom set to 2.5 (renderer.js ZOOM_MAX), close on the planted ' +
      'field cluster — crop art and ground detail at their largest on-screen size.',
    alt: 'A close-up, zoomed-in view of a few farm fields and ground texture.',
    tags: ['zoom-in'],
  });
  await clearToasts(cdp);

  // -------------------------------------------------------------------
  // 10. Narrow-width layout — the documented 1024x640 floor (electron/main.cjs minWidth/
  //     minHeight, and styles.css's own `@media (max-width: 1100px), (max-height: 700px)`
  //     compact-HUD breakpoint) — and a wide layout at the app's real configured default
  //     (1280x800, electron/main.cjs BrowserWindow width/height).
  // -------------------------------------------------------------------
  await tapStructure(cdp, 'workshop_yard');
  await clearToasts(cdp);
  await new Promise((r) => setTimeout(r, 150));
  await cdp.setViewport(1024, 640);
  await new Promise((r) => setTimeout(r, 300)); // let resize listener + one rAF frame settle
  await shot(cdp, {
    name: '36-narrow-width-layout',
    surface: 'Narrow-width layout at the documented minimum (1024x640)',
    stateDescription: 'Viewport forced to 1024x640, the exact floor declared by electron/' +
      'main.cjs (minWidth/minHeight) and styles.css\'s own compact-HUD media query. Shows the ' +
      'HUD, dock, and the Workshop panel at the smallest supported size.',
    viewport: '1024x640 (documented minimum window size)',
    alt: 'The game at its minimum supported window size, 1024 by 640 pixels, with a compact ' +
      'HUD and the Workshop panel open.',
    tags: ['narrow-width'],
  });

  await cdp.setViewport(1280, 800);
  await new Promise((r) => setTimeout(r, 300));
  await shot(cdp, {
    name: '37-wide-width-layout',
    surface: 'Wide layout at the app\'s real configured default (1280x800)',
    stateDescription: 'Viewport set to 1280x800 — electron/main.cjs\'s BrowserWindow width/' +
      'height, the size the app actually opens at on a real desktop. Shows the HUD, dock, and ' +
      'the Workshop panel at full default size, for contrast with the narrow-width capture above.',
    viewport: '1280x800 (the app\'s real default window size)',
    alt: 'The game at its default window size, 1280 by 800 pixels, with the full HUD, dock, and the Workshop panel open.',
    tags: ['wide-width'],
  });
  await cdp.clearViewport();

  // -------------------------------------------------------------------
  // Write manifest.json
  // -------------------------------------------------------------------
  // Re-audited at HEAD before this run. Five entries that stood here for the 2026-08-31 pass
  // (co-op panel, per-factory minigames, mine content, merge board, fishing, expeditions) are
  // GONE, and deliberately so rather than by oversight: src/ui.js's panel switch now has a real
  // case for fishing, mine, merge and expeditions, it imports minigames.js and renders a stage
  // chain from it, and the co-op dock button is un-hidden by level rather than never. Leaving
  // them listed would have published a manifest describing a build that no longer exists.
  const NOT_REACHABLE = [
    {
      surface: 'Dark theme', tag: 'dark-theme',
      reason: 'Grepped styles.css for prefers-color-scheme and every settings render function '
        + 'for a theme toggle; neither exists at this commit. The app ships exactly one visual '
        + 'theme (the wood and parchment palette), so there is no dark variant to capture.',
    },
  ];

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    commit: COMMIT,
    method: 'Chrome DevTools Protocol against the real built Electron artifact ' +
      '(dist/win-unpacked/Farm Tycoon.exe), launched headlessly on an off-screen Windows ' +
      'desktop via the cheap Lowlevel MCP route, with --remote-debugging-port on a task-only ' +
      'loopback port. No mockups, no dev-server captures.',
    knownConstraint: 'RESOLVED, as of commits c1b74e4 and bb4524e (both landed after the prior ' +
      '47-shot capture pass at 556fe8f, and present in the commit this run captured from — see ' +
      '"commit" above). Three real, separate camera-clamp defects existed in sequence: (1) ' +
      'clampCamera() treated the north and south visible margins as equal, when tileToScreen ' +
      'actually places the camera target near the TOP of the screen (OY_RATIO=0.2375), fixed by ' +
      '556fe8f; (2) main.js\'s boot() called clampCamera() with no bounds argument at all, so it ' +
      'fell back to worldBounds([], []) — the padded FARM.startZone rectangle only ' +
      '({minX:9,minY:9,maxX:23,maxY:23}), never STRUCTURES positions or unlocked expansions — ' +
      'meaning only 1 of 22 structures could ever be centred on boot, fixed by c1b74e4, which ' +
      'made main.js union every STRUCTURES footprint (locked or not) plus every unlocked ' +
      'expansion into the real bounds; (3) renderer.js\'s tickCamera() — which clamps EVERY ' +
      'ANIMATION FRAME, before drawFrame — still called clampCamera(viewportW, viewportH) with ' +
      'no bounds argument, silently discarding boot()\'s wider bounds on frame 1 and reverting ' +
      'to the tiny start-zone default every frame after, fixed by bb4524e via a registered ' +
      'setBoundsProvider() callback that both boot() and tickCamera() now read from the same ' +
      'live source. With all three fixed, every one of the 22 STRUCTURES entries — locked or ' +
      'unlocked — sits inside worldBounds() and is reachable by camera assignment; this run\'s ' +
      'locked/unlocked structure world-background captures show the real structure sprite ' +
      'behind its toast/panel, not leftover terrain. (Panel-opening itself was never affected by ' +
      'any of this: the tap always resolved synchronously against the live camera, before the ' +
      'next clamp ran — only the world-background scenery around a tap was ever wrong.)',
    secondaryDefectResolved: 'The prior pass recorded that src/data.js defined no icon field on '
      + 'any entry, so src/ui.js itemIcon() always fell through to a placeholder glyph and every '
      + 'DOM list showed it beside every item name. Re-checked at this commit: all 303 crop and '
      + 'good entries define an icon, and itemIcon() resolves a real one. The defect is fixed, '
      + 'and captions naming a real item icon are accurate again.',
    notReachable: NOT_REACHABLE,
    captures: manifest,
  }, null, 2));
  console.log(`\n[done] ${manifest.length} captures written to ${OUT_DIR}`);
  console.log(`[done] manifest: ${manifestPath}`);

  // -------------------------------------------------------------------
  // Completeness guard: fail loudly if a required surface is neither captured nor documented
  // as unreachable, rather than silently shipping a matrix with a hole in it.
  // -------------------------------------------------------------------
  const notReachableTags = new Set(NOT_REACHABLE.map((n) => n.tag));
  const missing = REQUIRED_SURFACES.filter((t) => !capturedTags.has(t) && !notReachableTags.has(t));
  if (missing.length) {
    console.error(`\n[FAIL] ${missing.length} required surface(s) neither captured nor marked unreachable:`);
    for (const m of missing) console.error(`  - ${m}`);
    cdp.close();
    process.exitCode = 1;
    return;
  }
  console.log(`[ok] every required surface (${REQUIRED_SURFACES.length}) is either captured or documented as unreachable.`);

  cdp.close();
}

main().catch((e) => {
  console.error('[fatal]', e && e.stack || e);
  process.exitCode = 1;
});
