#!/usr/bin/env node
// Generates release notes for a Farm Tycoon Windows release.
//
// Usage:
//   node tools/release-notes.mjs --version 0.1.0 --sha <full-sha> \
//     --artifact-dir dist/squirrel-windows \
//     --workflow-start 2026-01-01T00:00:00Z --workflow-end 2026-01-01T00:10:00Z \
//     --out RELEASE_NOTES.md
//
// Writes markdown release notes to --out (default: stdout) and also emits a
// JSON summary to --json-out when given, so the calling workflow can read
// individual fields (e.g. the chosen code name) without re-parsing markdown.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function sha256File(filePath) {
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

function humanBytes(n) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n;
  let u = -1;
  do {
    v /= 1024;
    u++;
  } while (v >= 1024 && u < units.length - 1);
  return `${v.toFixed(2)} ${units[u]}`;
}

function collectArtifacts(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isFile()) {
      out.push({
        name,
        path: full,
        size: st.size,
        sha256: sha256File(full),
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function isoDuration(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = Math.max(0, end.getTime() - start.getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'farm-tycoon-release-notes' },
  });
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: HTTP ${res.status}`);
  }
  return res.json();
}

const CATALOG_URL =
  'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json';
const CODENAMES_FILE = path.join(REPO_ROOT, 'RELEASE-CODENAMES.md');
// Published photo assets for the dim sum catalog live only on these GitHub
// Releases of the catalog repository (never in its raw Git tree), per the
// project's photo-source contract. Look up the real asset filename across
// each one and use the release's own browser_download_url.
const CATALOG_RELEASE_TAGS = ['catalog-v1', 'catalog-v1-part-002', 'catalog-v1-part-003'];
let _assetUrlMapPromise = null;

async function loadCatalogAssetUrlMap() {
  if (_assetUrlMapPromise) return _assetUrlMapPromise;
  _assetUrlMapPromise = (async () => {
    const map = new Map();
    for (const tag of CATALOG_RELEASE_TAGS) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/releases/tags/${tag}`,
          { headers: { 'User-Agent': 'farm-tycoon-release-notes', Accept: 'application/vnd.github+json' } }
        );
        if (!res.ok) continue;
        const data = await res.json();
        for (const asset of data.assets || []) {
          map.set(asset.name, asset.browser_download_url);
        }
      } catch {
        // A single unreachable release page just leaves those dishes without
        // a resolvable photo; pickCodename() reports that honestly.
      }
    }
    return map;
  })();
  return _assetUrlMapPromise;
}

function readUsedSlugs() {
  if (!existsSync(CODENAMES_FILE)) return new Set();
  const text = readFileSync(CODENAMES_FILE, 'utf8');
  const slugs = new Set();
  // Lines look like: | 0.1.0 | <sha> | Classic Har Gow · 蝦餃 | `classic-har-gow` | <link> |
  const re = /`([a-z0-9-]+)`/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    slugs.add(m[1]);
  }
  return slugs;
}

function appendUsedCodename({ version, sha, dish }) {
  const header =
    '# Release code names\n\n' +
    'Each Farm Tycoon release is given a dim sum code name from the public catalog at\n' +
    `${CATALOG_URL}\n` +
    'A dish is used once per project so a code name never becomes ambiguous between builds.\n\n' +
    '| Version | Commit | Code name | Slug | Photo |\n' +
    '|---|---|---|---|---|\n';
  const row = `| ${version} | \`${sha.slice(0, 12)}\` | ${dish.name.en} · ${dish.name.zhHant} | \`${dish.slug}\` | ${dish.imageUrl} |\n`;
  if (!existsSync(CODENAMES_FILE)) {
    writeFileSync(CODENAMES_FILE, header + row, 'utf8');
  } else {
    const existing = readFileSync(CODENAMES_FILE, 'utf8');
    writeFileSync(CODENAMES_FILE, existing.endsWith('\n') ? existing + row : existing + '\n' + row, 'utf8');
  }
}

function candidateImageFilename(candidate) {
  const imagePath =
    typeof candidate.image === 'string'
      ? candidate.image
      : candidate.image && typeof candidate.image === 'object'
        ? candidate.image.path || candidate.image.url || null
        : null;
  if (!imagePath) return null;
  return imagePath.split('/').pop();
}

async function pickCodename({ version, sha, downloadDir }) {
  const used = readUsedSlugs();
  let catalog;
  try {
    catalog = await fetchJson(CATALOG_URL);
  } catch (err) {
    return {
      dish: null,
      error: `Could not reach the public dim sum catalog (${err.message}); release shipped without a code name.`,
    };
  }
  const entries = Array.isArray(catalog) ? catalog : catalog.dishes || catalog.items || [];
  const unused = entries.filter((d) => d && d.slug && !used.has(d.slug));
  if (unused.length === 0) {
    return { dish: null, error: 'Every catalog dish has already been used as a code name for this project.' };
  }

  const assetMap = await loadCatalogAssetUrlMap();
  if (assetMap.size === 0) {
    return {
      dish: null,
      error:
        'Could not reach the dim sum catalog photo releases (catalog-v1, catalog-v1-part-002, ' +
        'catalog-v1-part-003) on the photo repository; release shipped without a code name photo.',
    };
  }

  // Only a dish whose photo is actually published as a release asset is
  // eligible. Never generate, redraw, or substitute an image, and never
  // reach for a dish the catalog lists but has no downloadable photo for.
  let candidate = null;
  let filename = null;
  let downloadUrl = null;
  for (const d of unused) {
    const fn = candidateImageFilename(d);
    if (!fn) continue;
    const url = assetMap.get(fn);
    if (url) {
      candidate = d;
      filename = fn;
      downloadUrl = url;
      break;
    }
  }
  if (!candidate) {
    return {
      dish: null,
      error:
        'No unused catalog dish has a published photo asset across the checked catalog-v1* releases; ' +
        'release shipped without a code name photo.',
    };
  }

  let localImagePath = null;
  try {
    const res = await fetch(downloadUrl, { headers: { 'User-Agent': 'farm-tycoon-release-notes' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    localImagePath = path.join(downloadDir, filename);
    writeFileSync(localImagePath, buf);
  } catch (err) {
    return {
      dish: null,
      error: `Found the photo asset '${filename}' but could not download it (${err.message}); release shipped without a code name photo.`,
    };
  }

  const dish = {
    slug: candidate.slug,
    name: candidate.name || { en: candidate.slug, zhHant: candidate.slug },
    imageUrl: downloadUrl,
    imageFilename: filename,
    localImagePath,
  };
  appendUsedCodename({ version, sha, dish });
  return { dish, error: null };
}

function getLineCounts() {
  try {
    const out = execSync('node tools/count-lines.mjs --json', { cwd: REPO_ROOT, encoding: 'utf8' });
    return { ok: true, data: JSON.parse(out) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version || require('../package.json').version || '0.0.0';
  const sha = args.sha || 'unknown';
  const artifactDir = args['artifact-dir'] || 'dist/squirrel-windows';
  const workflowStart = args['workflow-start'];
  const workflowEnd = args['workflow-end'];
  const outFile = args.out;
  const jsonOutFile = args['json-out'];
  const codenameImageDir = path.resolve(REPO_ROOT, args['codename-image-dir'] || artifactDir);

  const artifacts = collectArtifacts(path.resolve(REPO_ROOT, artifactDir));
  const lineCounts = getLineCounts();
  const codename = await pickCodename({ version, sha, downloadDir: codenameImageDir });

  const duration =
    workflowStart && workflowEnd ? isoDuration(workflowStart, workflowEnd) : null;

  const lines = [];
  lines.push(`# Farm Tycoon v${version}`);
  lines.push('');
  lines.push(`**Commit:** \`${sha}\``);
  lines.push('');

  lines.push('## ⚠️ Status: content-complete Phase A scaffold — not yet playable');
  lines.push('');
  lines.push(
    'This release ships a **content-complete scaffold**, not a finished game. The data layer ' +
      '(`src/data.js` — 14 crops, 7 animals, 15 buildings/52 recipes, 85 goods, the full event ' +
      'and Township systems, 50 levels), its validator, the Squirrel.Windows packaging, the app ' +
      'icon and the vendored fonts are all real and verified. Every other game module ' +
      '(`economy`, `farm`, `production`, `orders`, `render`, `ui`, `input`, and the rest) is a ' +
      'documented API **contract with stub bodies** — the renderer is not implemented. ' +
      '**Installing this build gets you a placeholder splash screen, not a playable farm.** ' +
      'Full implementation (Phase B) has not started yet; see `PLAN.md` and `CLAUDE.md` in the ' +
      'repository for the design and the handoff state.'
  );
  lines.push('');

  lines.push('## Installer');
  lines.push('');
  lines.push(
    '**This installer is unsigned.** Code signing is permanently out of scope for this project. ' +
      'Windows will show a SmartScreen / "Windows protected your PC" unknown-publisher warning — ' +
      'this is expected and does not indicate a corrupted download. Choose "More info" → "Run ' +
      'anyway" if you trust the source. No claim of authenticity or signature verification is made.'
  );
  lines.push('');
  if (artifacts.length === 0) {
    lines.push('_No artifacts were found in the expected packaging output directory._');
  } else {
    lines.push('| File | Size | SHA-256 |');
    lines.push('|---|---|---|');
    for (const a of artifacts) {
      lines.push(`| \`${a.name}\` | ${humanBytes(a.size)} | \`${a.sha256}\` |`);
    }
  }
  lines.push('');

  lines.push('## Code name');
  lines.push('');
  if (codename.dish) {
    lines.push(
      `This release is code-named **${codename.dish.name.en} · ${codename.dish.name.zhHant}**.`
    );
    lines.push('');
    lines.push(
      `The photo asset **\`${codename.dish.imageFilename}\`** is attached to this release ` +
        `(sourced from the public dim sum catalog's photo release: ${codename.dish.imageUrl}).`
    );
    lines.push('');
    lines.push(`![${codename.dish.name.en}](${codename.dish.imageFilename})`);
    lines.push('');
  } else {
    lines.push(`_No code name was assigned: ${codename.error}_`);
    lines.push('');
  }

  lines.push('## Line count evidence');
  lines.push('');
  if (lineCounts.ok) {
    lines.push('```json');
    lines.push(JSON.stringify(lineCounts.data, null, 2));
    lines.push('```');
  } else {
    lines.push(`_Line count evidence unavailable: ${lineCounts.error}_`);
  }
  lines.push('');

  lines.push('## Build timing');
  lines.push('');
  if (workflowStart && workflowEnd) {
    lines.push(`- Workflow started: \`${workflowStart}\``);
    lines.push(`- Workflow completed: \`${workflowEnd}\``);
    lines.push(`- Workflow duration: \`${duration}\``);
  } else {
    lines.push('_Workflow timing was not supplied to this run._');
  }
  lines.push('');

  lines.push('## What CI actually checked');
  lines.push('');
  lines.push(
    'This repository runs no tests and no lint in CI (standing project policy — checking happens ' +
      'locally before a push, never as a release gate). This workflow builds the Squirrel.Windows ' +
      'installer, hashes the produced artifacts, and publishes them. It verified only that ' +
      'packaging succeeded and produced non-empty output; it did not run `npm test`.'
  );
  lines.push('');

  const markdown = lines.join('\n');

  if (outFile) {
    writeFileSync(path.resolve(REPO_ROOT, outFile), markdown, 'utf8');
  } else {
    process.stdout.write(markdown + '\n');
  }

  if (jsonOutFile) {
    writeFileSync(
      path.resolve(REPO_ROOT, jsonOutFile),
      JSON.stringify(
        {
          version,
          sha,
          artifacts: artifacts.map(({ name, size, sha256 }) => ({ name, size, sha256 })),
          codename: codename.dish
            ? {
                en: codename.dish.name.en,
                zhHant: codename.dish.name.zhHant,
                slug: codename.dish.slug,
                imageFilename: codename.dish.imageFilename,
                localImagePath: codename.dish.localImagePath,
                sourceUrl: codename.dish.imageUrl,
              }
            : null,
          workflowStart: workflowStart || null,
          workflowEnd: workflowEnd || null,
          duration,
        },
        null,
        2
      ),
      'utf8'
    );
  }
}

main().catch((err) => {
  console.error('release-notes.mjs failed:', err);
  process.exit(1);
});
