// Rewrites src/build-info.js with this build's real provenance. Run by the release workflow
// immediately before packaging; never run on a developer checkout, where the honest answer is the
// unstamped placeholder.
import { readFileSync, writeFileSync } from 'node:fs';

const [version, builtAt, commit] = process.argv.slice(2);
if (!version || !builtAt || !commit) {
  console.error('usage: stamp-build-info.mjs <version> <builtAtIso> <commitSha>');
  process.exit(2);
}
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(builtAt)) {
  console.error(`builtAt must be an ISO-8601 UTC instant with seconds, got: ${builtAt}`);
  process.exit(2);
}

const path = new URL('../src/build-info.js', import.meta.url);
const src = readFileSync(path, 'utf8');
const stamped = src
  .replace(/version: '[^']*'/, `version: '${version}'`)
  .replace(/builtAt: [^,]*/, `builtAt: '${builtAt}'`)
  .replace(/commit: [^,]*/, `commit: '${commit}'`);

// A replace that matched nothing would leave the placeholder in place and ship a build claiming
// no provenance, so prove each one landed rather than trusting the call.
for (const [label, needle] of [['version', `'${version}'`], ['builtAt', `'${builtAt}'`], ['commit', `'${commit}'`]]) {
  if (!stamped.includes(needle)) {
    console.error(`stamp failed: ${label} did not land in build-info.js`);
    process.exit(1);
  }
}
writeFileSync(path, stamped);
console.log(`build-info.js stamped: ${version} @ ${builtAt} (${commit})`);
