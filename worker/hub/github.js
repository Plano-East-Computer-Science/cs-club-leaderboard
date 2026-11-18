/**
 * GitHub activity on projects (D3). The hourly cron caches each project repo's
 * stars, last push, language and open issues in `repo_stats`, refreshing a repo
 * at most every six hours. Browsers never call GitHub; they read the cache.
 *
 * One server token, `GITHUB_TOKEN` (`npx wrangler secret put GITHUB_TOKEN`, a
 * fine-grained token with no permissions is enough for public repos). Without
 * it the calls are unauthenticated: 60 an hour per IP, shared with other
 * Workers, so expect gaps until a token is set.
 */
import { parseRepo, isStale, REFRESH_MS, MAX_REPOS_PER_RUN } from '../../shared/github.js';

export async function fetchRepo(repo, env, fetchFn = fetch) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'PEHS-CS-Club-Sync/1.0', 'X-GitHub-Api-Version': '2022-11-28' };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  let res;
  try {
    res = await fetchFn(`https://api.github.com/repos/${repo}`, { headers, signal: AbortSignal.timeout(10_000) });
  } catch {
    return { error: 'GitHub did not answer.', stop: true };
  }
  if (res.status === 404) return { error: 'Repository not found or private.' };
  if (res.status === 403 || res.status === 429) return { error: 'GitHub rate limit reached.', stop: true };
  if (!res.ok) return { error: `GitHub answered ${res.status}.`, stop: true };
  const j = await res.json().catch(() => null);
  if (!j || typeof j.stargazers_count !== 'number') return { error: 'Unexpected answer from GitHub.' };
  return { stars: j.stargazers_count, pushed_at: j.pushed_at ?? null, language: j.language ?? null, open_issues: j.open_issues_count ?? 0 };
}

/** Refresh the repos whose cache is older than six hours, oldest first. */
export async function refreshRepoStats(env, { fetchFn = fetch, now = Date.now() } = {}) {
  const db = env.DB;
  const urls = (await db.prepare(`SELECT DISTINCT repo_url FROM projects WHERE hidden = 0 AND repo_url != ''`).all()).results;
  const repos = [...new Set(urls.map((r) => parseRepo(r.repo_url)).filter(Boolean).map((r) => r.toLowerCase()))];
  if (!repos.length) return { refreshed: 0 };
  const seen = new Map(
    (await db.prepare(`SELECT repo, checked_at FROM repo_stats WHERE repo IN (${repos.map(() => '?').join(',')})`).bind(...repos).all()).results.map((r) => [r.repo, r.checked_at])
  );
  const due = repos.filter((r) => now - (seen.get(r) ?? 0) >= REFRESH_MS).sort((a, b) => (seen.get(a) ?? 0) - (seen.get(b) ?? 0)).slice(0, MAX_REPOS_PER_RUN);

  let refreshed = 0;
  for (const repo of due) {
    const r = await fetchRepo(repo, env, fetchFn);
    if (r.stop) break; // rate limited or down: try again next hour, do not burn the rest
    // A failed lookup keeps the old numbers and records why.
    await (r.error
      ? db
          .prepare(`INSERT INTO repo_stats (repo, error, checked_at) VALUES (?, ?, ?) ON CONFLICT(repo) DO UPDATE SET error = excluded.error, checked_at = excluded.checked_at`)
          .bind(repo, r.error, now)
      : db
          .prepare(
            `INSERT INTO repo_stats (repo, stars, pushed_at, language, open_issues, error, checked_at) VALUES (?, ?, ?, ?, ?, '', ?)
             ON CONFLICT(repo) DO UPDATE SET stars = excluded.stars, pushed_at = excluded.pushed_at, language = excluded.language,
               open_issues = excluded.open_issues, error = '', checked_at = excluded.checked_at`
          )
          .bind(repo, r.stars, r.pushed_at, r.language, r.open_issues, now)
    ).run();
    refreshed++;
  }
  return { refreshed, due: due.length };
}

/** Adds `stats` ({ stars, pushed_at, language, open_issues, stale } or null) to project rows. */
export async function withRepoStats(db, rows, now = Date.now()) {
  const keys = [...new Set(rows.map((p) => parseRepo(p.repo_url)?.toLowerCase()).filter(Boolean))];
  const found = keys.length
    ? (await db.prepare(`SELECT * FROM repo_stats WHERE repo IN (${keys.map(() => '?').join(',')}) AND checked_at > 0 AND error = ''`).bind(...keys).all()).results
    : [];
  const by = new Map(found.map((s) => [s.repo, s]));
  return rows.map((p) => {
    const s = by.get(parseRepo(p.repo_url)?.toLowerCase());
    return { ...p, stats: s ? { stars: s.stars, pushed_at: s.pushed_at, language: s.language, open_issues: s.open_issues, stale: isStale(s.pushed_at, now) } : null };
  });
}
