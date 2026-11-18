/**
 * F1, F2, E1: the next-action choice for each persona, compass path
 * derivation, the season helpers, kudos, and the feed's shape. Routes run
 * through the real Worker against the fake D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { pickNext, seasonRange, weekStart, neighbours } from '../worker/hub/dashboard.js';
import { recordActivity } from '../worker/hub/ledger.js';
import { QUESTIONS, PATHS, PATH_IDS, BLOCK_ORDER, cleanAnswers, derivePath } from '../shared/compass.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

/* ------------------------------ next action ------------------------------ */

const firstsOf = (path, over = {}) => PATHS[path].first.map((f) => ({ ...f, done: false, started: false, ...(over[f.title] ?? {}) }));
const base = (path, extra = {}) => ({
  compassDone: true,
  path,
  openClaim: null,
  daily: { available: false, done: false },
  arena: false,
  firsts: firstsOf(PATHS[path] ? path : 'explorer'),
  quest: null,
  ...extra,
});
const quest = { title: 'Showing up', desc: 'Check in to 3 meetings.', have: 2, need: 3, to: '/room' };

await check('new member: the compass comes first, whatever else is waiting', () => {
  const n = pickNext(base(null, { compassDone: false, openClaim: { id: 4, title: 'USACO' }, daily: { available: true, done: false } }));
  assert.equal(n.kind, 'compass');
  assert.equal(n.to, '/compass');
});

await check('a passed deadline you marked becomes "did you compete?"', () => {
  const n = pickNext(base('builder', { openClaim: { id: 7, title: 'HackDFW' } }));
  assert.equal(n.kind, 'claim');
  assert.equal(n.oppId, 7);
  assert.equal(n.oppTitle, 'HackDFW');
});

await check('contest persona: daily, then arena, then the path', () => {
  const on = { daily: { available: true, done: false }, arena: true };
  assert.equal(pickNext(base('contest', on)).kind, 'daily');
  assert.equal(pickNext(base('contest', { ...on, daily: { available: true, done: true } })).kind, 'arena');
  const n = pickNext(base('contest'));
  assert.equal(n.kind, 'path');
  assert.equal(n.to, '/learn/python-contests');
  assert.equal(n.cta, 'Start the lesson');
});

await check('builder persona: the path before the daily problem', () => {
  const n = pickNext(base('builder', { daily: { available: true, done: false } }));
  assert.equal(n.kind, 'path');
  assert.equal(n.to, '/learn/git-and-the-gateway');
  // Lesson done: next is posting a project, a counted check.
  const m = pickNext(base('builder', { firsts: firstsOf('builder', { 'Git, GitHub and the club gateway': { done: true } }) }));
  assert.equal(m.to, '/projects');
  assert.equal(m.cta, 'Post a project');
  assert.match(m.why, /Step 2 of 3/);
});

await check('ai, data and cyber personas: arena first when it exists', () => {
  for (const p of ['ai', 'data', 'cyber']) {
    assert.equal(pickNext(base(p, { arena: true, daily: { available: true, done: false } })).kind, 'arena', p);
    assert.equal(pickNext(base(p)).kind, 'path', p);
  }
  assert.equal(pickNext(base('ai')).to, '/learn/llm-how-it-works');
  // An unfinished rung is named.
  const n = pickNext(base('cyber', { arena: { rung: { title: 'picoCTF: Obedient Cat' } } }));
  assert.equal(n.title, 'picoCTF: Obedient Cat');
  assert.equal(n.cta, 'Back to the rung');
});

await check('started lessons say continue; untracked links are never picked', () => {
  const n = pickNext(base('data', { firsts: firstsOf('data', { 'Your first dataset': { started: true } }) }));
  assert.equal(n.cta, 'Continue the lesson');
  // Cyber's last two are plain links: once the lesson is done the path has nothing trackable left.
  const done = firstsOf('cyber', { 'First flags': { done: true } });
  assert.equal(pickNext(base('cyber', { firsts: done, quest })).kind, 'quest');
});

await check('quiet or finished member: a near quest, then the ideas board', () => {
  const all = (p) => firstsOf(p, Object.fromEntries(PATHS[p].first.map((f) => [f.title, { done: true }])));
  assert.equal(pickNext(base('explorer', { firsts: all('explorer'), quest })).kind, 'quest');
  const idle = pickNext(base('explorer', { firsts: all('explorer') }));
  assert.equal(idle.kind, 'idle');
  assert.equal(idle.to, '/ideas');
});

await check('unknown or missing path behaves as explorer', () => {
  assert.equal(pickNext(base('bogus', { firsts: firstsOf('explorer'), daily: { available: true, done: false } })).kind, 'daily');
  assert.equal(pickNext(base(null, { firsts: firstsOf('explorer') })).to, '/learn/lab-madlibs');
});

await check('every path has three first things and a block order', () => {
  for (const p of PATH_IDS) {
    assert.equal(PATHS[p].first.length, 3, p);
    assert.equal(BLOCK_ORDER[p].length, 4, p);
    assert.ok(!/[–—]/.test(PATHS[p].about), `${p} copy has a dash`);
  }
});

/* --------------------------------- compass -------------------------------- */

const ans = (o) => ({ coded: 'little', fun: ['unsure'], goal: 'fun', grade: '9', time: 'mid', teammate: 'yes', ...o });

await check('path derivation', () => {
  assert.equal(derivePath(ans({ fun: ['contests'] })), 'contest');
  assert.equal(derivePath(ans({ fun: ['apps'] })), 'builder');
  assert.equal(derivePath(ans({ fun: ['ai'] })), 'ai');
  assert.equal(derivePath(ans({ fun: ['data'] })), 'data');
  assert.equal(derivePath(ans({ fun: ['security'] })), 'cyber');
  assert.equal(derivePath(ans({ fun: ['unsure'] })), 'explorer');
  assert.equal(derivePath(ans({ fun: ['unsure'], goal: 'competitions' })), 'contest');
  assert.equal(derivePath(ans({ fun: ['unsure'], goal: 'internship' })), 'builder');
  // The goal breaks a tie between two things that sound fun.
  assert.equal(derivePath(ans({ fun: ['ai', 'apps'], goal: 'internship' })), 'builder');
  assert.equal(derivePath(ans({ fun: ['ai', 'contests'], goal: 'competitions' })), 'contest');
  assert.equal(derivePath(ans({ fun: ['data', 'security'] })), 'data'); // tie: PATH_IDS order
  // A beginner who picks nearly everything has not chosen.
  assert.equal(derivePath(ans({ coded: 'never', fun: ['contests', 'apps', 'ai', 'data'] })), 'explorer');
  assert.equal(derivePath(ans({ coded: 'contests', fun: ['contests', 'apps', 'ai', 'data'] })), 'contest');
  assert.equal(derivePath({}), 'explorer');
});

await check('answers are validated', () => {
  assert.ok(cleanAnswers(null).error);
  assert.ok(cleanAnswers(ans({ grade: '13' })).error);
  assert.ok(cleanAnswers(ans({ fun: [] })).error);
  assert.ok(cleanAnswers(ans({ fun: ['ai', 'hacking'] })).error);
  const { answers } = cleanAnswers({ ...ans({ fun: ['ai', 'ai'] }), extra: 'x' });
  assert.deepEqual(answers.fun, ['ai']);
  assert.equal(answers.extra, undefined);
  assert.equal(QUESTIONS.length, 6);
});

/* ---------------------------- season helpers ---------------------------- */

await check('season range and week start', () => {
  assert.deepEqual(seasonRange(new Date('2026-11-17T12:00:00Z')), ['2026-06-01 00:00:00', '2027-01-01 00:00:00']);
  assert.deepEqual(seasonRange(new Date('2027-03-02T12:00:00Z')), ['2027-01-01 00:00:00', '2027-06-01 00:00:00']);
  assert.equal(weekStart(new Date('2026-11-17T12:00:00Z')), '2026-11-16 00:00:00'); // Tuesday -> Monday
  assert.equal(weekStart(new Date('2026-11-22T23:00:00Z')), '2026-11-16 00:00:00'); // Sunday
  assert.equal(weekStart(new Date('2026-11-16T00:00:00Z')), '2026-11-16 00:00:00');
});

await check('neighbours: you and two either side, ties share a rank, first names only', () => {
  const rows = [
    { id: 1, name: 'Ava Li', points: 90 }, { id: 2, name: 'Ben', points: 80 }, { id: 3, name: 'Cam', points: 80 },
    { id: 4, name: 'Dee', points: 50 }, { id: 5, name: 'Eli', points: 40 }, { id: 6, name: 'Fay', points: 10 },
  ];
  const r = neighbours(rows, 4);
  assert.equal(r.rank, 4);
  assert.equal(r.of, 6);
  assert.deepEqual(r.near.map((x) => x.rank), [2, 2, 4, 5, 6]);
  assert.ok(r.near.find((x) => x.me).name === 'Dee');
  assert.equal(neighbours(rows, 1).near[0].name, 'Ava');
  assert.equal(neighbours(rows, 1).near.length, 3);
  assert.equal(neighbours(rows, 99).rank, null);
});

/* ------------------------------ routes, kudos ------------------------------ */

const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;
async function addUser(name) {
  const s = await db.prepare('INSERT INTO students (name) VALUES (?)').bind(name).run();
  const u = await db
    .prepare('INSERT INTO users (email, name, student_id) VALUES (?, ?, ?)')
    .bind(`${name.toLowerCase()}@example.com`, name, s.meta.last_row_id)
    .run();
  return { id: u.meta.last_row_id, sid: s.meta.last_row_id, cookie: `${USER_COOKIE}=${await signValue(env, `${u.meta.last_row_id}:${Date.now() + 60_000}`)}` };
}
async function call(path, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(
    new Request(`https://club.test/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    env,
    { waitUntil() {}, passThroughOnException() {} }
  );
  return { status: res.status, body: await res.json().catch(() => null) };
}

const maya = await addUser('Maya Patel');
const sam = await addUser('Sam Ortiz');
const { activityId } = await recordActivity(db, { studentId: maya.sid, kind: 'attend', ref: 'room:ABCD', meta: { title: 'Week 12' } });

await check('feed has no emails and no proof links', async () => {
  await recordActivity(db, { studentId: sam.sid, kind: 'ship', ref: 'self:bot', meta: { title: 'Discord bot', proof_url: 'https://x.test/p' }, status: 'approved' });
  const r = await call('/feed');
  assert.equal(r.status, 200);
  const text = JSON.stringify(r.body);
  assert.ok(!text.includes('@'), 'no email in the feed');
  assert.ok(!text.includes('x.test'), 'no proof link in the feed');
  assert.deepEqual(Object.keys(r.body.feed[0]).sort(), ['at', 'id', 'kind', 'kudos', 'mine', 'name', 'own', 'points', 'title']);
  assert.ok(r.body.feed.every((f) => !f.name.includes(' ')), 'first names only');
});

await check('kudos: sign-in needed, one per person, not on your own, undo works', async () => {
  assert.equal((await call(`/feed/${activityId}/kudos`, { method: 'POST' })).status, 401);
  assert.equal((await call(`/feed/${activityId}/kudos`, { method: 'POST', cookie: maya.cookie })).status, 403);
  assert.equal((await call('/feed/99999/kudos', { method: 'POST', cookie: sam.cookie })).status, 404);
  const a = await call(`/feed/${activityId}/kudos`, { method: 'POST', cookie: sam.cookie });
  const b = await call(`/feed/${activityId}/kudos`, { method: 'POST', cookie: sam.cookie });
  assert.equal(a.body.kudos, 1);
  assert.equal(b.body.kudos, 1, 'a second tap does not count twice');
  const feed = (await call('/feed', { cookie: sam.cookie })).body.feed.find((f) => f.id === activityId);
  assert.equal(feed.kudos, 1);
  assert.equal(feed.mine, true);
  assert.equal((await call('/feed', { cookie: maya.cookie })).body.feed.find((f) => f.id === activityId).own, true);
  assert.equal((await call(`/feed/${activityId}/kudos`, { method: 'DELETE', cookie: sam.cookie })).body.kudos, 0);
  // Pending activity cannot be kudos'd.
  const p = await recordActivity(db, { studentId: maya.sid, kind: 'compete', ref: 'self:x', meta: { title: 'x' } });
  assert.equal((await call(`/feed/${p.activityId}/kudos`, { method: 'POST', cookie: sam.cookie })).status, 404);
});

await check('compass: due for a new account, saved answers set the path and change Today', async () => {
  let d = (await call('/me/dashboard', { cookie: sam.cookie })).body;
  assert.equal(d.compassDue, true);
  assert.equal(d.next.kind, 'compass');
  assert.equal((await call('/me/compass', { method: 'PUT', cookie: sam.cookie, body: { answers: ans({ fun: ['grade'] }) } })).status, 400);
  const r = await call('/me/compass', { method: 'PUT', cookie: sam.cookie, body: { answers: ans({ fun: ['apps'] }) } });
  assert.equal(r.body.path, 'builder');
  d = (await call('/me/dashboard', { cookie: sam.cookie })).body;
  assert.equal(d.compassDue, false);
  assert.equal(d.path, 'builder');
  assert.equal(d.next.to, '/learn/git-and-the-gateway');
  assert.deepEqual(d.order, BLOCK_ORDER.builder);
  assert.equal((await call('/me/compass', { cookie: sam.cookie })).body.answers.fun[0], 'apps');
});

await check('compass skip makes you an explorer and stops the redirect', async () => {
  assert.equal((await call('/me/compass/skip', { method: 'POST' })).status, 401);
  await call('/me/compass/skip', { method: 'POST', cookie: maya.cookie });
  const d = (await call('/me/dashboard', { cookie: maya.cookie })).body;
  assert.equal(d.compassDue, false);
  assert.equal(d.path, 'explorer');
});

await check('dashboard: live room, season strip and no other member emails', async () => {
  await db.prepare(`INSERT INTO rooms (code, title) VALUES ('WXYZ', 'Build night')`).run();
  const d = (await call('/me/dashboard', { cookie: maya.cookie })).body;
  assert.deepEqual([d.meeting.kind, d.meeting.code, d.meeting.here], ['live', 'WXYZ', false]);
  assert.equal(d.season.points, 20); // first meeting doubles
  assert.equal(d.season.rank, 2); // Sam's ship paid 30
  assert.equal(d.season.week, 1);
  assert.ok(!JSON.stringify(d).includes('@'));
  assert.equal((await call('/me/dashboard')).status, 401);
});

await check('dashboard: the daily problem leads for a contest member until solved', async () => {
  const kim = await addUser('Kim');
  await call('/me/compass', { method: 'PUT', cookie: kim.cookie, body: { answers: ans({ fun: ['contests'] }) } });
  assert.equal((await call('/me/dashboard', { cookie: kim.cookie })).body.next.kind, 'path', 'no problem in the bank yet');
  await db.prepare(`INSERT INTO problems (slug, title, difficulty, status) VALUES ('two-sum', 'Two sum', 1, 'live')`).run();
  assert.equal((await call('/me/dashboard', { cookie: kim.cookie })).body.next.kind, 'daily');
  const date = (await call('/daily')).body.date;
  await db.prepare('INSERT INTO daily_results (user_id, date, attempts, ms) VALUES (?, ?, 1, 60000)').bind(kim.id, date).run();
  assert.equal((await call('/me/dashboard', { cookie: kim.cookie })).body.next.kind, 'path');
});

await check('dashboard: a started Arena rung comes back for an AI member', async () => {
  const ivy = await addUser('Ivy');
  await call('/me/compass', { method: 'PUT', cookie: ivy.cookie, body: { answers: ans({ fun: ['ai'] }) } });
  const r = await db.prepare(`INSERT INTO rungs (track, tier, title, url) VALUES ('ai', 'start', 'Tokenize a sentence', 'https://x.test/a')`).run();
  assert.equal((await call('/me/dashboard', { cookie: ivy.cookie })).body.next.title, 'Climb your next rung');
  await db.prepare('INSERT INTO rung_progress (user_id, rung_id) VALUES (?, ?)').bind(ivy.id, r.meta.last_row_id).run();
  assert.equal((await call('/me/dashboard', { cookie: ivy.cookie })).body.next.title, 'Tokenize a sentence');
});

console.log(`today: ${passed} checks passed`);
