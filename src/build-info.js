/**
 * Build provenance: which version is running, and when THAT version was built.
 *
 * The release workflow overwrites this file in the packaging step, so a shipped artifact carries
 * the real values. A source checkout keeps the placeholder below, and the HUD then says the
 * provenance is unavailable rather than inventing one - launch time and a file's mtime both
 * answer a different question than "when was this build made", and answering with either would be
 * a confident lie about the one thing the reader is checking.
 */
export const BUILD_INFO = {
  version: '0.1.0',
  /** ISO-8601 UTC instant this exact build was produced, or null when it was not stamped. */
  builtAt: null,
  /** Commit the build came from, or null. */
  commit: null,
};

/**
 * Format the provenance for display: the version always, and the build time rendered in the
 * reader's own timezone down to the second, with the zone named so the number means something.
 */
export function buildStamp(info = BUILD_INFO) {
  const version = `v${info.version || '0.0.0'}`;
  if (!info.builtAt) return { version, when: 'build date unavailable', title: 'This checkout was not stamped by the release workflow.' };
  const d = new Date(info.builtAt);
  if (Number.isNaN(d.getTime())) return { version, when: 'build date unavailable', title: 'Build provenance was present but unreadable.' };
  const pad = (n) => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { zone = ''; }
  return {
    version,
    when: `built ${local}${zone ? ` ${zone}` : ''}`,
    title: info.commit ? `Commit ${info.commit}` : '',
  };
}
