#!/usr/bin/env node
// serve.mjs — the dev static server for `npm run serve`.
//
// It exists for one reason: `python3 -m http.server` sends Last-Modified and no cache
// directives, so a browser heuristically caches every ES module and keeps serving the version
// it saw first. Editing a module and reloading then shows the OLD code — and, worse, a MIX of
// old and new modules, which surfaces as an import error naming an export that plainly exists
// in the file on disk. Two verification passes were spent chasing exactly that ghost. Every
// response here is no-store, so what the browser runs is what is on disk.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.argv[3] || '.');
const PORT = Number(process.argv[2] || process.env.PORT || 8123);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';

  // Resolve inside ROOT or refuse: a dev server still has no business reading the whole disk.
  const target = resolve(join(ROOT, normalize(path)));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('403 outside the served root');
    return;
  }

  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, 'index.html') : target;
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'pragma': 'no-cache',
      'expires': '0',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    res.end('404 not found');
  }
}).listen(PORT, () => console.log(`Farm Tycoon dev server on http://localhost:${PORT} (no-store)`));
