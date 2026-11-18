/** GitHub repo helpers (D3): URL parsing and staleness, pure for tests. */

export const STALE_DAYS = 60;
export const REFRESH_MS = 6 * 3600_000; // per repo
export const MAX_REPOS_PER_RUN = 20;

/** "https://github.com/Owner/Repo.git/" -> "Owner/Repo" (null for anything else). */
export function parseRepo(url) {
  let u;
  try {
    u = new URL(String(url ?? '').trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !/^(www\.)?github\.com$/i.test(u.hostname) || u.port) return null;
  const [owner, repo] = u.pathname.split('/').filter(Boolean);
  const name = repo?.replace(/\.git$/i, '');
  if (!owner || !name || !/^[A-Za-z0-9-]{1,39}$/.test(owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(name) || /^\.+$/.test(name)) return null;
  return `${owner}/${name}`;
}

/** No push in STALE_DAYS (an unknown date is not "stale"). */
export function isStale(pushedAt, now = Date.now()) {
  const t = Date.parse(pushedAt ?? '');
  return Number.isFinite(t) && now - t > STALE_DAYS * 86_400_000;
}
