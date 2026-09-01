#!/usr/bin/env node
// build-web.mjs — stages exactly the files the game needs at runtime into www/, which is what
// Capacitor packs into the APK.
//
// This exists because capacitor.config.json originally set webDir to ".", the repository root.
// That is not a small inefficiency: it would have packed node_modules (639 MB), .git, design/,
// screenshots/, docs/ and tools/ into the installed app, shipping the entire source tree and
// every development dependency to anyone who installed it. The game itself is four things.
//
// There is no bundler and no transform here, and there must not be one: the project's hard
// convention is plain ES modules with no build step, so this only ever COPIES. If this file ever
// starts rewriting source, the thing being tested on a phone has stopped being the thing that
// runs in the browser.
//
// Run: node tools/build-web.mjs

import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');

// Everything the game loads at runtime, and nothing else. index.html pulls in styles.css,
// src/main.js and fonts/fonts.css; src/ reaches nothing outside itself.
const INCLUDE = ['index.html', 'styles.css', 'src', 'fonts'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of INCLUDE) {
  const from = path.join(root, entry);
  if (!existsSync(from)) throw new Error(`build-web: ${entry} is missing - refusing to stage an incomplete app`);
  cpSync(from, path.join(out, entry), { recursive: true });
}

/** Total bytes and file count under a directory, so the result can be checked rather than assumed. */
function measure(dir) {
  let bytes = 0;
  let files = 0;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { const r = measure(p); bytes += r.bytes; files += r.files; }
    else { bytes += st.size; files += 1; }
  }
  return { bytes, files };
}

// Guard, not decoration. The failure this catches is webDir quietly widening again: if node_modules
// or .git ever end up staged, the size explodes and this stops the build rather than shipping it.
const { bytes, files } = measure(out);
const MB = bytes / (1024 * 1024);
if (existsSync(path.join(out, 'node_modules'))) throw new Error('build-web: node_modules got staged - webDir is wrong');
if (existsSync(path.join(out, '.git'))) throw new Error('build-web: .git got staged - webDir is wrong');
if (MB > 25) throw new Error(`build-web: staged ${MB.toFixed(1)} MB, which is far more than this game is - something extra got in`);

// index.html must actually be at the root of the staged tree, or the WebView loads nothing.
if (!existsSync(path.join(out, 'index.html'))) throw new Error('build-web: no index.html at the staged root');

console.log(`www/ staged: ${files} files, ${MB.toFixed(2)} MB (${INCLUDE.join(', ')})`);
