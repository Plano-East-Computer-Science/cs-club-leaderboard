/**
 * The Board (C1, C5): placement, next-rung choice, answer checking by hash,
 * officer-only writes, the ledger hand-off, and the seed ladder against the
 * real schema, problem bank and course list.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hono } from 'hono';

import { makeTestDb } from './d1-shim.js';
import { placementFor, ladderOf, nextRung, rungStates, normAnswer, parseContests, hostOf, TRACK_IDS, trackOf } from '../shared/board.js';
import { hashAnswer, validateRung, titleFromUrl } from '../worker/hub/board.js';
import { rungActivity } from '../worker/hub/board-awards.js';
import { mountHub } from '../worker/hub/index.js';
import { COOKIE, signSession, signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { COURSES } from '../shared/courses.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const schema = read('../worker/schema.sql');

/* ------------------------------- placement ------------------------------- */

assert.deepEqual(placementFor({ coded: 0, contest: 0, focus: 0 }), { start: { contest: 1, build: 1, ai: 1, data: 1, cyber: 1 }, focus: 'contest' });
assert.equal(placementFor({ coded: 1, contest: 1, focus: 1 }).start.contest, 2, 'a few contest problems starts past the basics');
assert.equal(placementFor({ coded: 2, contest: 2, focus: 3 }).start.contest, 3, 'Bronze or harder starts at difficulty 3');
assert.equal(placementFor({ coded: 2, contest: 0 }).start.contest, 2, 'comfortable coders skip the very first contest rungs');
assert.equal(placementFor({ coded: 2 }).start.data, 2);
assert.equal(placementFor({ coded: 0, focus: 4 }).focus, 'cyber');
assert.equal(placementFor({ coded: 99, contest: -3, focus: 'x' }).start.contest, 2, 'out-of-range answers are clamped');
assert.equal(placementFor({}).focus, 'contest');

/* ------------------------------- next rung ------------------------------- */

const R = (id, tier, ord, difficulty) => ({ id, track: 'contest', tier, ord, difficulty, hidden: false });
const rungs = [R(1, 'silver', 0, 3), R(2, 'bronze', 1, 2), R(3, 'bronze', 0, 1), R(4, 'bronze', 2, 3), R(5, 'silver', 1, 4), { ...R(6, 'bronze', 3, 1), hidden: true }];
const ladder = ladderOf(rungs, 'contest');
assert.deepEqual(ladder.map((r) => r.id), [3, 2, 4, 1, 5], 'tier order, then officer order, hidden left out');
assert.equal(nextRung(ladder, {}, 1).id, 3);
assert.equal(nextRung(ladder, { 3: { status: 'done' } }, 1).id, 2);
assert.equal(nextRung(ladder, { 3: { status: 'started' } }, 1).id, 3, 'started is not done');
assert.equal(nextRung(ladder, {}, 3).id, 4, 'placement skips ahead to the first rung at the starting difficulty');
assert.equal(nextRung(ladder, { 4: { status: 'done' }, 1: { status: 'done' }, 5: { status: 'done' } }, 3).id, 3, 'then comes back for skipped rungs');
assert.equal(nextRung(ladder, Object.fromEntries(ladder.map((r) => [r.id, { status: 'done' }])), 1), null);
assert.equal(nextRung([], {}, 1), null);
assert.equal(nextRung(ladder, {}, 9).id, 3, 'a start above every rung falls back to the top');
assert.deepEqual(rungStates(ladder, { 4: { status: 'done' } }, 3), { 3: 'skipped', 2: 'skipped', 4: 'done', 1: 'next', 5: 'ahead' });

/* ----------------------------- answers, C5, misc ----------------------------- */

assert.equal(normAnswer('  "Club{Ladder}" '), 'club{ladder}');
assert.equal(await hashAnswer('club{ladder}'), await hashAnswer(' CLUB{LADDER} '));
assert.notEqual(await hashAnswer('club{ladder}'), await hashAnswer('club{ladders}'));
assert.match(await hashAnswer('x'), /^[0-9a-f]{64}$/);

const now = new Date('2026-11-17T12:00:00Z');
const sched = 'junk line\n2027-02-19 2027-02-22 Third contest\n2027-01-08 2027-01-11 First contest\n2026-01-09 2026-01-12 Old';
assert.deepEqual(parseContests(sched, now), { start: '2027-01-08', end: '2027-01-11', name: 'First contest', live: false, days: 52 });
assert.equal(parseContests(sched, new Date('2027-01-10T00:00:00Z')).live, true);
assert.equal(parseContests(sched, new Date('2027-03-01T00:00:00Z')), null);
assert.equal(parseContests('', now), null);

assert.equal(hostOf('https://www.kaggle.com/learn/pandas'), 'kaggle.com');
assert.equal(hostOf('/p/x'), 'club judge');
assert.equal(titleFromUrl('https://usaco.guide/silver/two-pointers'), 'Two pointers');

for (const [why, input] of [
  ['http link', { url: 'http://x.com/a', track: 'contest' }],
  ['javascript link', { url: 'javascript:alert(1)', track: 'contest' }],
  ['unknown track', { url: 'https://x.com/a', track: 'chess' }],
  ['tier from another track', { url: 'https://x.com/a', track: 'contest', tier: 'ship' }],
  ['difficulty 6', { url: 'https://x.com/a', track: 'contest', difficulty: 6 }],
  ['answer without answer', { url: 'https://x.com/a', track: 'cyber', verify: 'answer' }],
  ['internal not on /p/', { url: 'https://x.com/a', track: 'contest', verify: 'internal' }],
  ['bad verify', { url: 'https://x.com/a', track: 'contest', verify: 'trust-me' }],
]) assert.ok((await validateRung(input)).error, `should reject: ${why}`);
{
  const { value } = await validateRung({ url: '/p/add-two', track: 'contest', hint: 'h' });
  assert.equal(value.verify, 'internal', '/p/ links default to the judge');
  assert.equal(value.tier, 'bronze', 'tier defaults to the first one');
}

/* -------------------------------- ledger -------------------------------- */

assert.equal(rungActivity({ user_id: 1, rung_id: 2, status: 'started' }), null);
assert.equal(rungActivity(null), null);
assert.deepEqual(rungActivity({ user_id: 7, rung_id: 12, status: 'done', method: 'judge', track: 'contest', tier: 'bronze', difficulty: 2 }), {
  userId: 7,
  kind: 'solve',
  ref: 'rung:12',
  meta: { track: 'contest', tier: 'bronze', difficulty: 2, method: 'judge', honour: false },
});
assert.equal(rungActivity({ user_id: 7, rung_id: 12, status: 'done', method: 'self' }).meta.honour, true);

/* ------------------------- routes on a real SQLite ------------------------- */

const env = { DB: makeTestDb(schema), ADMIN_PASSWORD: 'x', SESSION_SECRET: 'test-secret' };
env.DB.exec(read('../worker/seed-problems.sql'));
env.DB.exec(read('../worker/seed-rungs.sql'));
env.DB.exec(`INSERT INTO students (id, name) VALUES (501, 'Ava')`);
env.DB.exec(`INSERT INTO users (id, email, name, student_id) VALUES (1, 'a@x.com', 'Ava', 501), (2, 'b@x.com', 'Ben', NULL)`);
const app = new Hono();
mountHub(app);

const userCookie = async (id) => `${USER_COOKIE}=${encodeURIComponent(await signValue(env, `${id}:${Date.now() + 60_000}`))}`;
const officerCookie = `${COOKIE}=${encodeURIComponent(await signSession(env))}`;
const call = async (method, url, body, cookie) => {
  const res = await app.request(url, { method, headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined }, env);
  return { status: res.status, json: await res.json() };
};
const ava = await userCookie(1);
const ben = await userCookie(2);

// The seed: 30-60 rungs, every track filled, every internal link and course real.
{
  const all = (await env.DB.prepare('SELECT * FROM rungs').all()).results;
  assert.ok(all.length >= 30 && all.length <= 60, `seed has ${all.length} rungs`);
  for (const t of TRACK_IDS) assert.ok(all.some((r) => r.track === t), `seed fills ${t}`);
  const slugs = new Set((await env.DB.prepare(`SELECT slug FROM problems WHERE status = 'live'`).all()).results.map((r) => r.slug));
  const courses = new Set(COURSES.map((c) => c.slug));
  for (const r of all) {
    assert.ok(trackOf(r.track).tiers.some(([id]) => id === r.tier), `${r.title}: tier`);
    if (r.url.startsWith('/p/')) assert.ok(slugs.has(r.url.slice(3)) && r.verify === 'internal', `${r.url} is a live problem`);
    if (r.url.startsWith('/learn/')) assert.ok(courses.has(r.url.slice(7)), `${r.url} is a course`);
    if (r.verify === 'answer') assert.match(r.answer_hash, /^[0-9a-f]{64}$/);
  }
  env.DB.exec(read('../worker/seed-rungs.sql'));
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM rungs').first()).n, all.length, 'seed is safe to re-run');
}

// Signed out: the board, no progress, no hashes.
let r = await call('GET', '/api/board');
assert.equal(r.status, 200);
assert.equal(r.json.signedIn, false);
assert.deepEqual(r.json.progress, {});
assert.ok(!JSON.stringify(r.json).includes('answer_hash'), 'hash never reaches the browser');
const flag = r.json.rungs.find((x) => x.verify === 'answer');
const checkbox = r.json.rungs.find((x) => x.verify === 'checkbox');
const internal = r.json.rungs.find((x) => x.url === '/p/python-contests-sum-two');
assert.equal((await call('POST', `/api/board/rungs/${checkbox.id}/done`, {})).status, 401, 'ticking needs an account');
assert.equal((await call('POST', '/api/board/placement', { answers: {} })).status, 401);

// Placement is stored per member.
r = await call('POST', '/api/board/placement', { answers: { coded: 2, contest: 2, focus: 4 } }, ava);
assert.deepEqual(r.json, placementFor({ coded: 2, contest: 2, focus: 4 }));
r = await call('GET', '/api/board', null, ava);
assert.equal(r.json.placement.focus, 'cyber');
assert.equal((await call('GET', '/api/board', null, ben)).json.placement, null);

// Answer verification by hash. The answer is the base64 in the hint.
const answer = Buffer.from(flag.hint.match(/[A-Za-z0-9+/=]{12,}/)[0], 'base64').toString();
assert.deepEqual((await call('POST', `/api/board/rungs/${flag.id}/done`, { answer: 'club{nope}' }, ava)).json, { correct: false });
assert.equal((await call('POST', `/api/board/rungs/${flag.id}/done`, { answer: '' }, ava)).status, 400);
assert.deepEqual((await call('POST', `/api/board/rungs/${flag.id}/done`, { answer: ` ${answer.toUpperCase()} ` }, ava)).json, { correct: true, method: 'answer' });

// Checkbox, start, undo.
await call('POST', `/api/board/rungs/${checkbox.id}/start`, null, ava);
r = await call('GET', '/api/board', null, ava);
assert.equal(r.json.progress[checkbox.id].status, 'started');
await call('POST', `/api/board/rungs/${checkbox.id}/done`, {}, ava);
await call('POST', `/api/board/rungs/${checkbox.id}/start`, null, ava);
r = await call('GET', '/api/board', null, ava);
assert.equal(r.json.progress[checkbox.id].status, 'done', 'opening again does not undo a tick');
assert.equal(r.json.rungs.find((x) => x.id === checkbox.id).n, 1, 'done count is public');
assert.equal((await call('POST', `/api/board/rungs/${checkbox.id}/undo`, null, ava)).json.ok, true);
assert.equal((await call('POST', `/api/board/rungs/${flag.id}/undo`, null, ava)).json.ok, false, 'a checked answer cannot be unticked');
assert.ok(!(await call('GET', '/api/board', null, ben)).json.progress[flag.id], 'progress is per member');

// Internal rungs: only a judge pass ticks them.
assert.equal((await call('POST', `/api/board/rungs/${internal.id}/done`, {}, ava)).status, 400);
assert.deepEqual((await call('POST', '/api/board/solve', { slug: 'python-contests-sum-two', passed: true }, ava)).json, { ticked: [internal.id] });
assert.equal((await call('POST', '/api/board/solve', { slug: 'python-contests-sum-two' }, ava)).status, 400);
assert.equal((await call('GET', '/api/board', null, ava)).json.progress[internal.id].method, 'judge');

// Done rungs reach the ledger once each, through award.js.
await call('POST', '/api/board/solve', { slug: 'python-contests-sum-two', passed: true }, ava);
const acts = (await env.DB.prepare(`SELECT kind, ref FROM activity WHERE student_id = 501 ORDER BY ref`).all()).results;
assert.deepEqual(acts.map((a) => a.ref).sort(), [`rung:${flag.id}`, `rung:${internal.id}`, `rung:${checkbox.id}`].sort(), 'one activity per rung, no repeats');
assert.ok(acts.every((a) => a.kind === 'solve'));

// Officer-only writes: every admin route refuses members and strangers.
const adminRoutes = [
  ['GET', '/api/admin/hub/board/rungs'],
  ['POST', '/api/admin/hub/board/rungs'],
  ['PUT', `/api/admin/hub/board/rungs/${checkbox.id}`],
  ['POST', `/api/admin/hub/board/rungs/${checkbox.id}/move`],
  ['POST', `/api/admin/hub/board/rungs/${checkbox.id}/hide`],
  ['POST', '/api/admin/hub/board/peek'],
  ['PUT', '/api/admin/hub/board/usaco'],
];
for (const [m, u] of adminRoutes) {
  assert.equal((await call(m, u, {})).status, 401, `${m} ${u} refuses a stranger`);
  assert.equal((await call(m, u, {}, ava)).status, 401, `${m} ${u} refuses a member`);
}

// Officer: add by link and hint, reorder, hide, set the USACO dates.
r = await call('POST', '/api/admin/hub/board/rungs', { url: 'https://cses.fi/problemset/task/1617', hint: 'Powers of two, modulo.', track: 'contest', tier: 'silver', difficulty: 3 }, officerCookie);
assert.equal(r.status, 201);
const added = r.json.id;
assert.equal((await call('POST', '/api/admin/hub/board/rungs', { url: 'https://cses.fi/problemset/task/1617', track: 'contest' }, officerCookie)).status, 409);
let admin = (await call('GET', '/api/admin/hub/board/rungs', null, officerCookie)).json.rungs;
assert.ok(!JSON.stringify(admin).includes('answer_hash') && admin.find((x) => x.id === flag.id).hasAnswer);
const silver = () => ladderOf(admin, 'contest').filter((x) => x.tier === 'silver').map((x) => x.id);
const before = silver();
assert.equal(before.at(-1), added, 'new rungs go to the end of their tier');
await call('POST', `/api/admin/hub/board/rungs/${added}/move`, { dir: -1 }, officerCookie);
admin = (await call('GET', '/api/admin/hub/board/rungs', null, officerCookie)).json.rungs;
assert.deepEqual(silver(), [...before.slice(0, -2), before.at(-1), before.at(-2)], 'moved up one');
assert.equal((await call('PUT', `/api/admin/hub/board/rungs/${flag.id}`, { ...flag, tags: '', verify: 'answer' }, officerCookie)).status, 200, 'editing keeps the answer');
assert.deepEqual((await call('POST', `/api/board/rungs/${flag.id}/done`, { answer }, ben)).json, { correct: true, method: 'answer' });
await call('POST', `/api/admin/hub/board/rungs/${added}/hide`, {}, officerCookie);
assert.ok(!(await call('GET', '/api/board')).json.rungs.some((x) => x.id === added), 'hidden rungs leave the board');
r = await call('PUT', '/api/admin/hub/board/usaco', { text: '2099-01-08 2099-01-11 First contest' }, officerCookie);
assert.equal(r.json.next.name, 'First contest');
assert.equal((await call('GET', '/api/board')).json.usaco.start, '2099-01-08');

console.log('board: ok');
