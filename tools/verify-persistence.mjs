#!/usr/bin/env node
// verify-persistence.mjs — proves the save survives the process actually dying.
//
// This is deliberately NOT a page reload. A reload keeps the renderer process, its localStorage
// backing store and every in-memory cache alive, so it proves almost nothing about the thing the
// Android checklist actually asks for: "the save survives a force-quit and a relaunch". On a
// phone the OS kills the app outright, and anything still sitting in memory waiting to be flushed
// is simply gone.
//
// So this runs in two halves against two SEPARATE app launches sharing one profile directory. The
// caller starts the app, runs this with --write, kills the process, starts it again, and runs
// this with --read. The state written in the first process is asserted in the second.
//
// Usage:
//   node tools/verify-persistence.mjs write [port]
//   node tools/verify-persistence.mjs read  [port]

const MODE = process.argv[2];
const PORT = process.argv[3] || '9415';
const ENDPOINT = `http://127.0.0.1:${PORT}`;

if (MODE !== 'write' && MODE !== 'read') {
  console.error('usage: verify-persistence.mjs <write|read> [port]');
  process.exit(2);
}

// A recognisable, checkable fingerprint. Fixed rather than random so the two halves agree without
// passing anything between them, and odd enough that it cannot be confused with real play.
const MARK = {
  coins: 555777,
  diamonds: 88,
  level: 44,
};

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

  async ev(expression) {
    const msg = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (msg.error) throw new Error(JSON.stringify(msg.error));
    const r = msg.result;
    if (r.exceptionDetails) throw new Error(`page exception: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result?.value;
  }

  async poll(expression, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (await this.ev(expression)) return true;
      if (Date.now() > deadline) throw new Error(`timed out: ${expression}`);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

async function bridge(cdp) {
  // Wait for boot to FINISH before touching anything. main.js's boot() calls load(), which
  // replaces the state object wholesale, so a mutation made before that lands on an object the
  // game then throws away. That is not a hypothetical: it is what made the first version of this
  // script report the save being lost across a force-quit, when the save path was fine and the
  // harness was writing into a doomed object. window.__farmDebug is only installed at the end of
  // boot, so its presence is the signal.
  await cdp.poll('typeof window.__farmDebug === "object" && window.__farmDebug !== null', 20000);
  await cdp.ev("window.__p={};import('./src/state.js').then((s)=>{window.__p={s,ok:1};}).catch((e)=>{window.__p.err=String(e.message);});");
  await cdp.poll('window.__p.ok === 1 || !!window.__p.err');
  const err = await cdp.ev('window.__p.err || ""');
  if (err) throw new Error(`state.js failed to load: ${err}`);
}

async function main() {
  const cdp = await Cdp.connect();
  await cdp.send('Runtime.enable');
  await bridge(cdp);

  if (MODE === 'write') {
    const wrote = await cdp.ev(`(() => {
      const st = window.__p.s;
      const s = st.state;
      s.coins = ${MARK.coins};
      s.diamonds = ${MARK.diamonds};
      s.level = ${MARK.level};
      st.save();
      // Read it straight back out of localStorage rather than trusting save() to have run, and
      // check ALL THREE fields. An earlier version searched the stored blob for the coins value
      // alone, which a previous run had already left there, so it reported success against stale
      // data while diamonds and level were never written at all.
      const j = JSON.parse(localStorage.getItem('farm-tycoon-save') || '{}');
      return { coins: j.coins, diamonds: j.diamonds, level: j.level, version: j.version ?? null };
    })()`);
    check('save() wrote coins', wrote.coins === MARK.coins, JSON.stringify(wrote));
    check('save() wrote diamonds', wrote.diamonds === MARK.diamonds, JSON.stringify(wrote));
    check('save() wrote level', wrote.level === MARK.level, JSON.stringify(wrote));
    // The exit-route handlers matter more than they look on Android, where beforeunload often
    // never fires at all, so they are checked for real rather than assumed from the source:
    // change the live state WITHOUT saving, fire the event, and see whether storage caught up.
    const onHidden = await cdp.ev(`(() => {
      const s = window.__p.s.state;
      const bump = ${MARK.coins} + 1;
      s.coins = bump;
      const before = JSON.parse(localStorage.getItem('farm-tycoon-save') || '{}').coins;
      document.dispatchEvent(new Event('visibilitychange'));
      const afterVis = JSON.parse(localStorage.getItem('farm-tycoon-save') || '{}').coins;
      window.dispatchEvent(new Event('pagehide'));
      const afterHide = JSON.parse(localStorage.getItem('farm-tycoon-save') || '{}').coins;
      // Restore the marker and save it properly, so the read half asserts on the marker rather
      // than on this probe's bump value.
      s.coins = ${MARK.coins};
      window.__p.s.save();
      return { before, afterVis, afterHide, bump, visible: document.visibilityState };
    })()`);
    // visibilitychange only saves when the page is actually HIDDEN, which it is not under CDP,
    // so the honest assertion is that it did nothing here, and that pagehide did.
    check('a visibilitychange while still visible correctly does not save',
      onHidden.afterVis === onHidden.before, JSON.stringify(onHidden));
    // Asserted against the BUMP value, not the marker. An earlier version compared afterHide to
    // the marker, which the previous run had already left in storage, so it passed with the
    // pagehide handler deleted entirely. That is the third time in this file that asserting on a
    // value stale data already held produced a check that could not fail: if a probe's expected
    // value could have got there any other way, the probe is decoration.
    check('pagehide saves immediately, which beforeunload alone would miss on Android',
      onHidden.afterHide === onHidden.bump, JSON.stringify(onHidden));
    console.log(`\n[write] marked coins=${MARK.coins} diamonds=${MARK.diamonds} level=${MARK.level}`);
    console.log(`${passed} passed, ${failures.length} failed`);
    return failures.length;
  }

  // read: this is a FRESH process. Nothing from the previous one is in memory.
  const got = await cdp.ev(`(() => {
    const s = window.__p.s.state;
    return { coins: s.coins, diamonds: s.diamonds, level: s.level, objects: s.farm.objects.length };
  })()`);
  check('coins survived the process being killed', got.coins === MARK.coins, JSON.stringify(got));
  check('diamonds survived', got.diamonds === MARK.diamonds, JSON.stringify(got));
  check('level survived', got.level === MARK.level, JSON.stringify(got));
  check('the farm itself is still there, not reset to a new game',
    got.objects > 0, JSON.stringify(got));

  console.log(`\n${passed} passed, ${failures.length} failed`);
  return failures.length;
}

main()
  .then((n) => process.exit(n ? 1 : 0))
  .catch((e) => { console.error(e.message); process.exit(1); });
