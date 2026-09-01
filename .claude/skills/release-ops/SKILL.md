---
name: release-ops
description: Build, package, verify-unsigned, drive, capture, and release Farm Tycoon's Windows Squirrel installer — the operations layer above run-game/playtest. Use when you need the packaged app running (not the dev server), a Windows installer, or to understand what CI actually gates.
---

# Release operations

Everything here has been run for real in this repository. Where something is described but
not verified this session, it's marked so explicitly.

## Build

```bash
npm run dist   # electron-builder --win squirrel
```

Produces, under `dist/squirrel-windows/`:
- `Farm Tycoon-Setup-0.1.0.exe` (~114 MB) — the installer
- `farm-tycoon-0.1.0-full.nupkg` (~113 MB) — the Squirrel package
- `RELEASES` — Squirrel's package index

This is **Squirrel.Windows**, never NSIS — `package.json`'s `build.win.target` is `squirrel`
and `build.forceCodeSigning` is `false`. Don't add or suggest an NSIS/MSI path; that would be
a second installer format this project has deliberately never shipped.

Also produced, unpacked (useful for driving without installing — see below):
`dist/win-unpacked/Farm Tycoon.exe`.

## Verify unsigned

**Code signing is permanently prohibited for this project.** Never request, generate,
discover, or invoke a signer. CI verifies every setup executable really is unsigned rather
than assuming it — the exact check, copied from `.github/workflows/release.yml`:

```bash
powershell -NoProfile -Command "(Get-AuthenticodeSignature -LiteralPath '<path-to-Setup.exe>').Status"
```

Must print `NotSigned`. Anything else — including `Valid`, meaning it somehow got signed —
fails the build in CI (`Verify unsigned packaging output` step) and should fail your local
check too. The resulting unknown-publisher / SmartScreen warning on first run is expected;
state it plainly rather than treating it as a defect to fix.

## Drive the built artifact (CDP)

The verified route for talking to the packaged Electron app — used by
`tools/capture-screenshots.mjs` and by anyone else who needs to interact with (not just eyeball)
the real installed build:

1. Launch with a remote debugging port on a loopback-only port, e.g.
   `"dist\win-unpacked\Farm Tycoon.exe" --remote-debugging-port=9333`.
2. Read the target list: `GET http://127.0.0.1:9333/json/list`.
3. **Require exactly one target before touching anything**, of `type: "page"`, whose `url`
   ends in `/index.html` (Electron loads via `win.loadFile()`, i.e. a `file://…/index.html`
   URL — see `electron/main.cjs`). More or fewer targets means you're not isolated; stop and
   diagnose rather than picking "the one that looks right."
4. Connect a WebSocket to that target's `webSocketDebuggerUrl` and speak CDP directly:
   `Page.captureScreenshot` for pixels, `Runtime.evaluate` for driving the page.
5. **Pass `suppress_origin=True`** to the WebSocket client, or Chromium rejects the CDP
   handshake outright.
6. **On Node 26.x, `Runtime.evaluate` with `awaitPromise: true` can hang indefinitely, even for
   a synchronous expression that doesn't need it.** Omit `awaitPromise`. For anything genuinely
   asynchronous on the page side (a dynamic `import()`), fire it, have it write a marker onto a
   `window.__*` object, then poll that marker synchronously with repeated non-awaiting
   `Runtime.evaluate` calls instead of awaiting the promise across the wire.

Once connected, the same dynamic-`import()` bridge technique from `run-game`/`playtest`
applies here too — `import('./src/production.js')` etc. from page context gets you live
references into the running app, which is how you drive planting/harvesting/state mutation
against the packaged build instead of the dev server.

## Capture

Screenshot capture of the built artifact is owned by `tools/capture-screenshots.mjs` and
writes to `screenshots/` — don't duplicate that tooling or write into that directory from a
different script; extend or run the existing one instead.

## CI / release

`.github/workflows/release.yml` runs on every push to `main` and on manual dispatch. What it
actually does, in order: checkout → install → build (`npm run dist`) → verify unsigned →
generate release notes (including a dim-sum code name) → **publish the GitHub Release** →
**commit the updated code-name ledger**. That last step deliberately runs *after* publish.

**It was not always that order, and getting it backwards cost a real release once.** With the
ledger commit before publish, a losing race against a concurrent push on the ledger-commit step
discarded an entire successful build without ever shipping it — the installer was built,
verified unsigned, ready, and then thrown away because of an unrelated git-push race on a
bookkeeping file. Publish first, so a ledger-commit race (which is retried with a warning, not
treated as a build failure) can never cost a shipped release. If you ever touch this workflow,
preserve that ordering deliberately rather than "tidying" it back to a more obvious-looking
sequence.

**Nothing in CI runs tests or lint** — this is a standing decision by the repository owner
(see the comment directly above the tag-determination step in the workflow), not an oversight.
Don't add a test or lint job to `release.yml`. `npm test` still exists and still matters — it
runs locally, before a push, gating what a developer or agent commits, not what CI publishes.

## Local test suite

```bash
npm test
```

Runs `tools/validate-data.mjs` (a full data-integrity check — crop/animal/building/recipe/
level counts and cross-references) followed by 8 assertion suites (camera, core, logistics,
crafting, township, research, deadtime, social). Verified count as of this pass: **147
assertions, 0 failed**, across those 8 suites, plus the data validator green separately.
