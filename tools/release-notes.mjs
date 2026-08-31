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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GitHub's REST API is rate-limited per source IP for unauthenticated
// requests (60/hour), which GitHub-hosted runners share heavily -- so a
// single unauthenticated pass across several release lookups is exactly the
// kind of thing that works on one build and silently fails on the next.
// Always send the workflow's own token when we have one, and retry a
// transient failure (network hiccup, secondary rate limit, 5xx) a few times
// before giving up, so "the photo repository was briefly unreachable" does
// not read the same as "there is no photo for this dish".
async function fetchWithRetry(url, { headers = {}, token, attempts = 3, baseDelayMs = 750 } = {}) {
  const finalHeaders = { 'User-Agent': 'farm-tycoon-release-notes', ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { headers: finalHeaders });
      if (res.ok) return res;
      const transient = res.status === 403 || res.status === 429 || res.status >= 500;
      lastErr = new Error(`HTTP ${res.status} fetching ${url}`);
      if (!transient || attempt === attempts) {
        throw lastErr;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === attempts) throw lastErr;
    }
    await sleep(baseDelayMs * attempt);
  }
  throw lastErr;
}

async function fetchJson(url, opts) {
  const res = await fetchWithRetry(url, opts);
  return res.json();
}

const CATALOG_URL =
  'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json';
const CODENAMES_FILE = path.join(REPO_ROOT, 'RELEASE-CODENAMES.md');
const CATALOG_REPO = 'Ding-Ding-Projects/dim-sum-photos';
let _assetUrlMapPromise = null;

// Published photo assets for the dim sum catalog live only on GitHub
// Releases of the catalog repository (never in its raw Git tree), split
// across an unbounded and growing number of "catalog-v1*" part releases --
// a single dish's photo lives in exactly ONE of those parts, so hard-coding
// a fixed list of tags is exactly how a resolvable dish stops resolving the
// moment a new part is published and this list is not updated to match.
// Enumerate every release once, keep the ones whose tag starts with
// "catalog-v1", and build the whole asset-name -> download-URL map from
// their own embedded `assets` array (the list endpoint already returns it,
// so this needs no further per-tag lookups at all).
async function listCatalogReleases(token) {
  const headers = { Accept: 'application/vnd.github+json' };
  const releases = [];
  let page = 1;
  for (;;) {
    const res = await fetchWithRetry(
      `https://api.github.com/repos/${CATALOG_REPO}/releases?per_page=100&page=${page}`,
      { headers, token }
    );
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const rel of batch) {
      if (rel && typeof rel.tag_name === 'string' && rel.tag_name.startsWith('catalog-v1')) {
        releases.push(rel);
      }
    }
    if (batch.length < 100) break;
    page++;
  }
  return releases;
}

async function loadCatalogAssetUrlMap(token) {
  if (_assetUrlMapPromise) return _assetUrlMapPromise;
  _assetUrlMapPromise = (async () => {
    const releases = await listCatalogReleases(token);
    if (releases.length === 0) {
      throw new Error(`no "catalog-v1*" releases were found on ${CATALOG_REPO}`);
    }
    const map = new Map();
    for (const rel of releases) {
      for (const asset of rel.assets || []) {
        map.set(asset.name, asset.browser_download_url);
      }
    }
    return { map, tags: releases.map((r) => r.tag_name) };
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

async function pickCodename({ version, sha, downloadDir, token }) {
  const used = readUsedSlugs();
  let catalog;
  try {
    catalog = await fetchJson(CATALOG_URL, { token });
  } catch (err) {
    return {
      dish: null,
      error: `Could not reach the public dim sum catalog at ${CATALOG_URL} (${err.message}); a code name is required and none could be assigned.`,
    };
  }
  const entries = Array.isArray(catalog) ? catalog : catalog.dishes || catalog.items || [];
  const unused = entries.filter((d) => d && d.slug && !used.has(d.slug));
  if (unused.length === 0) {
    return {
      dish: null,
      error: 'Every catalog dish has already been used as a code name for this project; a code name is required and none could be assigned.',
    };
  }

  let assetMapResult;
  try {
    assetMapResult = await loadCatalogAssetUrlMap(token);
  } catch (err) {
    return {
      dish: null,
      error: `Could not enumerate the "catalog-v1*" photo releases on ${CATALOG_REPO} (${err.message}); a code name is required and none could be assigned.`,
    };
  }
  const { map: assetMap, tags: releaseTags } = assetMapResult;
  if (assetMap.size === 0) {
    return {
      dish: null,
      error: `Found "catalog-v1*" releases (${releaseTags.join(', ')}) on ${CATALOG_REPO} but none carried any assets; a code name is required and none could be assigned.`,
    };
  }

  // Only a dish whose photo is actually published as a release asset is
  // eligible. Never generate, redraw, or substitute an image, and never
  // reach for a dish the catalog lists but has no downloadable photo for.
  let candidate = null;
  let filename = null;
  let downloadUrl = null;
  const searched = [];
  for (const d of unused) {
    const fn = candidateImageFilename(d);
    searched.push(d.slug);
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
        `Checked ${searched.length} unused catalog dish(es) against the ${assetMap.size} asset(s) published ` +
        `across ${releaseTags.join(', ')} on ${CATALOG_REPO}, and none matched a published photo filename; ` +
        'a code name is required and none could be assigned.',
    };
  }

  let localImagePath = null;
  try {
    const res = await fetchWithRetry(downloadUrl, { token });
    const buf = Buffer.from(await res.arrayBuffer());
    localImagePath = path.join(downloadDir, filename);
    writeFileSync(localImagePath, buf);
  } catch (err) {
    return {
      dish: null,
      error: `Found the photo asset '${filename}' at ${downloadUrl} but could not download it (${err.message}); a code name is required and none could be assigned.`,
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
  const token =
    args.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || undefined;
  const requireCodename = args['allow-missing-codename'] !== 'true';

  const artifacts = collectArtifacts(path.resolve(REPO_ROOT, artifactDir));
  const lineCounts = getLineCounts();
  const codename = await pickCodename({ version, sha, downloadDir: codenameImageDir, token });

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
          codenameError: codename.dish ? null : codename.error,
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

  // A dim sum photo asset is a mandatory part of every release, not a
  // best-effort extra. Warning and quietly publishing without one (as an
  // earlier build did) let a resolution bug ship silently; failing here
  // fails the workflow step outright, before the release is ever created,
  // so a broken lookup is a red run someone actually sees.
  if (!codename.dish && requireCodename) {
    console.error(
      `release-notes.mjs: no dim sum code-name photo could be resolved for this release: ${codename.error}`
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('release-notes.mjs failed:', err);
  process.exit(1);
});
