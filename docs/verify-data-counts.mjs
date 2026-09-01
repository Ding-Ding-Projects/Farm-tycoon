#!/usr/bin/env node
// verify-data-counts.mjs — the guard. Fails (exit 1) the moment docs/content/data-counts.js
// disagrees with what src/data.js actually contains.
//
// Without this, the generated file would be exactly as fragile as the hand-typed numbers it
// replaces: correct the day someone runs the generator, silently wrong the next time content
// is added to src/data.js and nobody remembers to regenerate. This script is what makes that
// an error instead of a silent drift.
//
// Run: node docs/verify-data-counts.mjs
// Exit 0 and "OK" when docs/content/data-counts.js matches src/data.js.
// Exit 1 and a diff when it does not — the fix is `node docs/generate-data-counts.mjs`.
//
// This never runs in the browser and makes no network request; it is a maintainer-time check,
// the doc-site equivalent of tools/validate-data.mjs.

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const generatorPath = join(here, 'generate-data-counts.mjs');
const committedPath = join(here, 'content', 'data-counts.js');

// A CRLF-vs-LF checkout difference is not drift in what the file says, only in how it is
// stored on disk -- git's core.autocrlf can check this repository out with CRLF on Windows
// while the generator (and a Linux/mac checkout, and CI) always writes LF. Comparing raw
// bytes would make the guard cry wolf on every single Windows checkout, and a guard everyone
// learns to ignore stops guarding anything. Split on the carriage-return-plus-linefeed pair
// and rejoin on a bare linefeed so both sides compare on content alone.
function normaliseLineEndings(text) {
  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  return text.split(CR + LF).join(LF);
}

// Rerun the real generator in place — same file, same relative import of ../src/data.js —
// but redirected to a scratch output path, so this guard is read-only against the working
// tree: it reports drift, it never fixes it.
const scratchDir = mkdtempSync(join(tmpdir(), 'farm-tycoon-doc-counts-'));
try {
  const scratchOut = join(scratchDir, 'data-counts.js');

  execFileSync(process.execPath, [generatorPath], {
    env: { ...process.env, FARM_TYCOON_DOC_COUNTS_OUT: scratchOut },
    stdio: 'pipe',
  });

  let committedRaw;
  try {
    committedRaw = readFileSync(committedPath, 'utf8');
  } catch {
    console.error('FAIL: docs/content/data-counts.js does not exist.');
    console.error('Run: node docs/generate-data-counts.mjs');
    process.exit(1);
  }
  const freshRaw = readFileSync(scratchOut, 'utf8');

  const committed = normaliseLineEndings(committedRaw);
  const fresh = normaliseLineEndings(freshRaw);

  if (committed !== fresh) {
    console.error('FAIL: docs/content/data-counts.js has drifted from src/data.js.');
    console.error('');
    console.error('The committed counts no longer match what src/data.js actually contains —');
    console.error('probably because data.js changed since the file was last regenerated.');
    console.error('');
    console.error('Fix: node docs/generate-data-counts.mjs   (then commit the result)');
    console.error('');
    const committedLines = committed.split(String.fromCharCode(10));
    const freshLines = fresh.split(String.fromCharCode(10));
    const max = Math.max(committedLines.length, freshLines.length);
    let shown = 0;
    for (let i = 0; i < max && shown < 40; i++) {
      if (committedLines[i] !== freshLines[i]) {
        console.error(`  line ${i + 1}:`);
        console.error(`    committed: ${committedLines[i] ?? '(missing)'}`);
        console.error(`    expected:  ${freshLines[i] ?? '(missing)'}`);
        shown++;
      }
    }
    process.exit(1);
  }

  console.log('OK — docs/content/data-counts.js matches src/data.js.');
} finally {
  rmSync(scratchDir, { recursive: true, force: true });
}
