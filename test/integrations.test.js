/**
 * C4 Codeforces and D3 GitHub: challenge verification against recorded
 * fixtures, blocked-response handling, rung URL matching, request pacing,
 * the sync into the Board and ledger, the browser fallback, repo URL parsing,
 * staleness and the repo cache.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hono } from 'hono';

import { makeTestDb } from './d1-shim.js';
import { challengeMet, solvedFrom, problemOfUrl, cleanHandle, makePacer, rungsSolved, BLOCKED_MSG } from '../shared/codeforces.js';
import { parseRepo, isStale } from '../shared/github.js';
import { cfGet, runCodeforcesSync } from '../worker/hub/codeforces.js';
import { refreshRepoStats } from '../worker/hub/github.js';
import { mountHub } from '../worker/hub/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const fx = JSON.parse(read('./fixtures/cf-challenge-status.json')).result;
const blockedHtml = read('./fixtures/cf-blocked.html');
const jsonRes = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/* ------------------------- challenge verification ------------------------- */

const issued = 1800000000 * 1000; // the fixture's CE is 300 s later
assert.equal(challengeMet(fx, issued), true, 'a CE on 4A inside the window');
assert.equal(challengeMet(fx, issued + 20 * 60_000), false, 'issued 20 minutes later: the CE predates the challenge');
assert.equal(challengeMet(fx, issued - 20 * 60_000), false, 'window of 15 minutes has passed');
assert.equal(challengeMet(fx, issued + 299_000), true, 'just before the CE, inside clock skew');
assert.equal(challengeMet(fx.filter((s) => s.verdict !== 'COMPILATION_ERROR'), issued), false, 'accepted and wrong answers do not count');
assert.equal(challengeMet(fx.map((s) => ({ ...s, problem: { ...s.problem, index: 'B' } })), issued), false, 'wrong problem');
assert.equal(challengeMet(null, issued), false);
assert.equal(cleanHandle(' tourist '), 'tourist');
for (const bad of ['', 'ab', 'a b c', 'x'.repeat(25), '../etc', '<b>']) assert.equal(cleanHandle(bad), '', bad);

/* ------------------------------ solved problems ------------------------------ */

const solved = solvedFrom(fx, { nowSec: 1800001000 });
assert.deepEqual(solved.map((s) => `${s.contest_id}${s.idx}`).sort(), ['1A', '4A'], 'unique, only accepted');
assert.equal(solved.find((s) => s.contest_id === 4).solved_at, 1799900000, 'earliest accepted wins');
assert.equal(solved.find((s) => s.contest_id === 1).rating, 1000);
assert.deepEqual(solvedFrom([{ verdict: 'OK', creationTimeSeconds: 1, problem: { contestId: 100001, index: 'A' } }, { verdict: 'OK', problem: null }, null, 'x']), [], 'gym and junk skipped');
assert.deepEqual(solvedFrom([{ verdict: 'OK', creationTimeSeconds: 4e9, problem: { contestId: 5, index: 'A' } }], { nowSec: 1.8e9 }), [], 'timestamps from the future skipped');

// Real answers recorded from codeforces.com parse too.
const realStatus = JSON.parse(read('./fixtures/cf-user-status.json')).result;
assert.ok(solvedFrom(realStatus).length > 0 || realStatus.every((s) => s.verdict !== 'OK'));
assert.equal(JSON.parse(read('./fixtures/cf-user-info.json')).result[0].handle, 'tourist');

/* ------------------------- rung URL to problem matching ------------------------- */

assert.deepEqual(problemOfUrl('https://codeforces.com/problemset/problem/4/A'), { contest: 4, idx: 'A' });
assert.deepEqual(problemOfUrl('https://codeforces.com/contest/1850/problem/B/'), { contest: 1850, idx: 'B' });
assert.deepEqual(problemOfUrl('https://www.codeforces.com/problemset/problem/1234/C2?x=1'), { contest: 1234, idx: 'C2' });
for (const bad of ['https://codeforces.com/', 'https://codeforces.com/problemset/problem/4', 'https://evil.com/codeforces.com/problemset/problem/4/A', 'http://codeforces.com/problemset/problem/4/A', 'https://cses.fi/problemset/task/1068', '/p/x', '']) {
  assert.equal(problemOfUrl(bad), null, bad);
}
assert.deepEqual(
  rungsSolved([{ url: 'https://codeforces.com/problemset/problem/4/A' }, { url: 'https://codeforces.com/contest/9/problem/A' }, { url: '/p/x' }], solved).map((r) => r.url),
  ['https://codeforces.com/problemset/problem/4/A']
);

/* --------------------------------- pacing --------------------------------- */

{
  let t = 10_000;
  const slept = [];
  const wait = makePacer(2000, () => t, async (ms) => { slept.push(ms); t += ms; });
  await wait(); // first call goes straight through
  await wait();
  t += 500;
  await wait();
  t += 3000;
  await wait();
  assert.deepEqual(slept, [2000, 1500], 'never closer than 2 s, no sleep once 2 s have passed');
}

/* ------------------------------ blocked answers ------------------------------ */

assert.deepEqual(await cfGet('user.info?handles=x', async () => new Response('Forbidden', { status: 403 })), { error: 'blocked' });
assert.deepEqual(await cfGet('user.info?handles=x', async () => new Response(blockedHtml, { status: 200 })), { error: 'blocked' }, 'an HTML 200 is a bot check');
assert.deepEqual(await cfGet('user.info?handles=x', async () => { throw new Error('network'); }), { error: 'blocked' });
assert.deepEqual(
  await cfGet('user.info?handles=x', async () => jsonRes({ status: 'FAILED', comment: 'handles: User with handle x not found' })),
  { error: 'cf', message: 'handles: User with handle x not found' }
);
assert.deepEqual((await cfGet('user.status?handle=a', async () => jsonRes({ status: 'OK', result: [1] }))).data, [1]);

/* ---------------------------- the database side ---------------------------- */

const env = { DB: makeTestDb(read('../worker/schema.sql')), SESSION_SECRET: 'test-secret' };
env.DB.exec(read('../worker/seed-rungs.sql'));
env.DB.exec(`INSERT INTO students (id, name) VALUES (601, 'Ava'), (602, 'Ben')`);
env.DB.exec(`INSERT INTO users (id, email, name, student_id) VALUES (1, 'a@x.com', 'Ava', 601), (2, 'b@x.com', 'Ben', 602), (3, 'c@x.com', 'Cy', NULL)`);
const app = new Hono();
mountHub(app);
const cookie = async (id) => `${USER_COOKIE}=${encodeURIComponent(await signValue(env, `${id}:${Date.now() + 60_000}`))}`;
const call = async (method, url, body, who) => {
  const res = await app.request(url, { method, headers: { 'Content-Type': 'application/json', ...(who && { Cookie: await cookie(who) }) }, body: body ? JSON.stringify(body) : undefined }, env);
  return { status: res.status, json: await res.json() };
};
const realFetch = globalThis.fetch;
const withFetch = async (fn, body) => {
  globalThis.fetch = fn;
  try {
    return await body();
  } finally {
    globalThis.fetch = realFetch;
  }
};

const watermelon = await env.DB.prepare(`SELECT id, verify FROM rungs WHERE url = 'https://codeforces.com/problemset/problem/4/A'`).first();
assert.equal(watermelon.verify, 'codeforces', 'seeded Codeforces rungs use the codeforces verify mode');
const points = async (sid) => (await env.DB.prepare('SELECT COALESCE(SUM(delta), 0) AS n FROM point_events WHERE student_id = ?').bind(sid).first()).n;

// Linking needs an account; bad handles are rejected.
assert.equal((await call('GET', '/api/codeforces/me')).status, 401);
assert.equal((await call('POST', '/api/codeforces/link', { handle: 'a b' }, 1)).status, 400);
let r = await call('POST', '/api/codeforces/link', { handle: 'club_tester' }, 1);
assert.equal(r.status, 200);
assert.match(r.json.challenge.problem, /problem\/4\/A$/);
assert.equal(r.json.challenge.expiresAt - r.json.challenge.issuedAt, 15 * 60_000);
const issuedAt = r.json.challenge.issuedAt;
const resetTry = () => env.DB.prepare('UPDATE cf_challenges SET tried_at = 0').run();

// Verify while Codeforces blocks us: the browser path is offered, not a success.
await withFetch(async () => new Response(blockedHtml), async () => {
  r = await call('POST', '/api/codeforces/verify', {}, 1);
  assert.equal(r.status, 502);
  assert.equal(r.json.blocked, true);
  assert.equal(r.json.error, BLOCKED_MSG);
  r = await call('POST', '/api/codeforces/verify', {}, 1);
  assert.equal(r.status, 429, 'verify cannot be hammered');
});
await resetTry();

// The recorded CE re-dated to sit inside this run's window; accepted ones an hour ago.
const shift = Math.floor(issuedAt / 1000) + 30 - fx[0].creationTimeSeconds;
const live = fx.map((s) => ({ ...s, creationTimeSeconds: s.verdict === 'OK' ? Math.floor(Date.now() / 1000) - 3600 : s.creationTimeSeconds + shift }));

// Someone else's submissions do not verify us.
await withFetch(async () => jsonRes({ status: 'OK', result: live.map((s) => ({ ...s, author: { members: [{ handle: 'someone_else' }] } })) }), async () => {
  r = await call('POST', '/api/codeforces/verify', {}, 1);
  assert.equal(r.json.verified, false);
});
await resetTry();

// A blocked server plus a browser-supplied list works for the handle's own submissions.
await withFetch(async () => new Response('no', { status: 403 }), async () => {
  r = await call('POST', '/api/codeforces/verify', { submissions: live.filter((s) => s.verdict === 'OK') }, 1);
  assert.equal(r.json.verified, false, 'no CE in the browser list');
});
await resetTry();

// Verified through the server's own call. The solved 4A ticks the Watermelon rung and pays once.
await withFetch(async () => jsonRes({ status: 'OK', result: live }), async () => {
  r = await call('POST', '/api/codeforces/verify', {}, 1);
});
assert.equal(r.json.verified, true);
assert.equal(r.json.solved, 2);
assert.deepEqual(r.json.ticked, [watermelon.id]);
let me = (await call('GET', '/api/codeforces/me', null, 1)).json;
assert.equal(me.verified, true);
assert.equal(me.handle, 'club_tester');
assert.equal(me.solved, 2);
assert.equal(me.challenge, null);
const prog = await env.DB.prepare('SELECT status, method FROM rung_progress WHERE user_id = 1 AND rung_id = ?').bind(watermelon.id).first();
assert.deepEqual({ ...prog }, { status: 'done', method: 'codeforces' });
const afterFirst = await points(601);
assert.ok(afterFirst > 0, 'the ledger paid for the solves');

// One handle, one member.
assert.equal((await call('POST', '/api/codeforces/link', { handle: 'CLUB_TESTER' }, 2)).status, 409, 'handles are case-insensitive and unique');

// Hourly sync: pacing, rating, 20 per run oldest first, no double pay.
{
  for (let i = 0; i < 25; i++) env.DB.exec(`INSERT INTO users (id, email, name, cf_handle, cf_verified_at, cf_synced_at) VALUES (${100 + i}, 'u${i}@x.com', 'U${i}', 'user_${i}', datetime('now'), ${1000 + i})`);
  const calls = [];
  let t = 1_000_000;
  const get = async (path) => {
    calls.push({ path, at: t });
    if (path.startsWith('user.info')) return { data: path.includes('club_tester') ? [{ handle: 'club_tester', rating: 1234 }] : [] };
    return { data: path.includes('club_tester') ? live : [] };
  };
  const pacer = makePacer(2000, () => t, async (ms) => { t += ms; });
  env.DB.exec('UPDATE users SET cf_synced_at = 0 WHERE id = 1');
  const res = await runCodeforcesSync(env, { get, now: () => t, pacer });
  assert.equal(res.attempted, 20, 'at most 20 handles per run');
  assert.equal(calls.filter((c) => c.path.startsWith('user.status')).length, 20);
  assert.equal(calls.filter((c) => c.path.startsWith('user.info')).length, 1, 'ratings in one batched call');
  assert.ok(calls.every((c, i) => i === 0 || c.at - calls[i - 1].at >= 2000), 'two seconds between requests');
  assert.match(calls[0].path, /handle=club_tester/, 'never-synced comes first');
  assert.ok(!calls.some((c) => c.path.includes('user_24')), 'the most recently synced wait for the next run');
  me = (await call('GET', '/api/codeforces/me', null, 1)).json;
  assert.equal(me.rating, 1234);
  assert.ok(me.syncedAt > 0 && me.error === null);
  assert.equal(await points(601), afterFirst, 'syncing the same solves again pays nothing new');
}

// A blocked run records the message for the UI and stops after the first request.
{
  env.DB.exec('UPDATE users SET cf_synced_at = 0 WHERE id = 1');
  let n = 0;
  const res = await runCodeforcesSync(env, { get: async () => { n++; return { error: 'blocked' }; }, pacer: async () => {} });
  assert.equal(n, 1, 'stops asking once blocked');
  assert.equal(res.blocked, true);
  me = (await call('GET', '/api/codeforces/me', null, 1)).json;
  assert.equal(me.error, BLOCKED_MSG);
  assert.equal(me.verified, true, 'a blocked sync does not unlink anyone');
}

// Browser fallback: shape checked, needs a verified handle.
assert.equal((await call('POST', '/api/codeforces/sync-from-browser', { submissions: 'x' }, 1)).status, 400);
assert.equal((await call('POST', '/api/codeforces/sync-from-browser', { submissions: [1] }, 1)).status, 400);
assert.equal((await call('POST', '/api/codeforces/sync-from-browser', { submissions: Array(201).fill({ problem: {} }) }, 1)).status, 400);
assert.equal((await call('POST', '/api/codeforces/sync-from-browser', { submissions: [] }, 3)).status, 400, 'no linked handle');
assert.equal((await call('POST', '/api/codeforces/sync-from-browser', { submissions: [] })).status, 401);
{
  const extra = { verdict: 'OK', creationTimeSeconds: Math.floor(Date.now() / 1000) - 60, problem: { contestId: 71, index: 'A', rating: 800 }, author: { members: [{ handle: 'club_tester' }] } };
  const before = await points(601);
  r = await call('POST', '/api/codeforces/sync-from-browser', { submissions: [extra], rating: 1500 }, 1);
  assert.equal(r.status, 200);
  assert.equal(r.json.solved, 1);
  me = (await call('GET', '/api/codeforces/me', null, 1)).json;
  assert.equal(me.solved, 3);
  assert.equal(me.rating, 1500);
  assert.equal(me.error, null, 'a browser sync clears the blocked note');
  assert.ok((await points(601)) > before, 'fresh solves pay through the ledger');
}

// Unlinking drops the solves; rungs already ticked stay.
assert.equal((await call('POST', '/api/codeforces/unlink', {}, 1)).status, 200);
me = (await call('GET', '/api/codeforces/me', null, 1)).json;
assert.deepEqual({ h: me.handle, v: me.verified, s: me.solved }, { h: null, v: false, s: 0 });
assert.equal((await env.DB.prepare('SELECT status FROM rung_progress WHERE user_id = 1 AND rung_id = ?').bind(watermelon.id).first()).status, 'done');

/* ------------------------------ GitHub (D3) ------------------------------ */

assert.equal(parseRepo('https://github.com/Owner/Repo'), 'Owner/Repo');
assert.equal(parseRepo('https://github.com/Owner/Repo.git'), 'Owner/Repo', '.git');
assert.equal(parseRepo('https://github.com/Owner/Repo/'), 'Owner/Repo', 'trailing slash');
assert.equal(parseRepo('https://github.com/Owner/Repo.git/'), 'Owner/Repo');
assert.equal(parseRepo('https://www.github.com/o/r/tree/main/src'), 'o/r', 'deep links');
assert.equal(parseRepo(' https://github.com/o/my.repo-x '), 'o/my.repo-x');
for (const bad of ['https://gitlab.com/o/r', 'https://github.com.evil.com/o/r', 'https://evil.com/github.com/o/r', 'http://github.com/o/r', 'https://github.com/o', 'https://github.com/', 'https://github.com/o/..', 'https://github.com/o r/x', 'git@github.com:o/r.git', '', null]) {
  assert.equal(parseRepo(bad), null, String(bad));
}

const now = Date.parse('2026-11-17T12:00:00Z');
assert.equal(isStale('2026-09-17T12:00:00Z', now), true, '61 days is stale');
assert.equal(isStale('2026-09-18T12:00:00Z', now), false, 'exactly 60 is not');
assert.equal(isStale('2026-09-19T12:00:00Z', now), false, 'under 60 days is not');
assert.equal(isStale('2026-11-16T00:00:00Z', now), false);
assert.equal(isStale(null, now), false, 'unknown is not stale');

// The repo cache: one fetch per repo per six hours, token sent when set, errors kept apart.
{
  env.DB.exec(`INSERT INTO projects (id, user_id, title, repo_url) VALUES
    (1, 2, 'A', 'https://github.com/Owner/Alpha.git'), (2, 2, 'B', 'https://github.com/owner/alpha/'),
    (3, 2, 'C', 'https://github.com/owner/beta'), (4, 2, 'D', 'https://github.com/owner/gone'), (5, 2, 'E', 'https://gitlab.com/o/r')`);
  const seen = [];
  const ok = { stargazers_count: 7, pushed_at: '2026-06-01T00:00:00Z', language: 'Python', open_issues_count: 2 };
  const fetchFn = async (url, init) => {
    seen.push({ url, auth: init.headers.Authorization });
    return url.endsWith('/gone') ? new Response('{}', { status: 404 }) : jsonRes(ok);
  };
  const keyed = { ...env, GITHUB_TOKEN: 'tok' };
  assert.deepEqual(await refreshRepoStats(keyed, { fetchFn, now }), { refreshed: 3, due: 3 });
  assert.equal(seen.length, 3, 'alpha is fetched once for two projects, gitlab never');
  assert.ok(seen.every((s) => s.auth === 'Bearer tok'));
  assert.deepEqual(await refreshRepoStats(keyed, { fetchFn, now: now + 3600_000 }), { refreshed: 0, due: 0 }, 'inside six hours: no calls');
  seen.length = 0;
  assert.deepEqual(await refreshRepoStats(env, { fetchFn, now: now + 7 * 3600_000 }), { refreshed: 3, due: 3 });
  assert.equal(seen[0].auth, undefined, 'no token, no Authorization header');

  // Rate limited: stop the run and leave the cache alone.
  const checked = () => env.DB.prepare('SELECT checked_at FROM repo_stats WHERE repo = ?').bind('owner/alpha').first();
  const before = await checked();
  const out = await refreshRepoStats(env, { fetchFn: async () => new Response('', { status: 403 }), now: now + 20 * 3600_000 });
  assert.equal(out.refreshed, 0);
  assert.deepEqual(await checked(), before);

  r = await call('GET', '/api/projects');
  const byId = Object.fromEntries(r.json.projects.map((p) => [p.id, p]));
  assert.deepEqual({ ...byId[1].stats }, { stars: 7, pushed_at: '2026-06-01T00:00:00Z', language: 'Python', open_issues: 2, stale: true });
  assert.deepEqual(byId[1].stats, byId[2].stats, 'both spellings of the URL share one cache row');
  assert.equal(byId[4].stats, null, 'a repo that 404s shows no stats');
  assert.equal(byId[5].stats, null, 'non-GitHub links show none');
  // (/api/portfolio uses the same withRepoStats; its quests query needs ?1 binds the test shim lacks.)
}

console.log('integrations: ok');
