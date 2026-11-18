/**
 * G1: the meeting planner. The variety warning (pure), the officer routes and
 * who may call them, opening a room for a plan, and that member-facing
 * surfaces (Today, the digest, the calendar feed) never carry block notes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { buildDigest } from '../worker/digest.js';
import { setSetting } from '../worker/db.js';
import { newSession } from '../worker/hub/session.js';
import { publicPlan, validDate, varietyWarning } from '../shared/planner.js';
import { templateBlocks } from '../shared/session-templates.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

/* ------------------------------ variety warning ------------------------------ */

const tl = (...t) => t.map((template, i) => ({ date: `2026-10-0${i + 1}`, template, planId: null }));
const plan = { id: null, date: '2026-11-01', template: 'build' };

await check('warns when the last three meetings match the planned kind', () => {
  assert.match(varietyWarning(tl('build', 'build', 'build'), plan), /last 3 meetings were all Build night/);
});
await check('no warning with a different kind in the last three, or fewer than three', () => {
  assert.equal(varietyWarning(tl('build', 'duel', 'build'), plan), null);
  assert.equal(varietyWarning(tl('build', 'build'), plan), null);
  assert.equal(varietyWarning(tl('build', 'build', 'build'), { ...plan, template: 'duel' }), null);
});
await check('only the three before the date count, in date order, and a plan is not compared to itself', () => {
  const t = [...tl('duel', 'build', 'build', 'build'), { date: '2026-12-01', template: 'duel', planId: 9 }];
  assert.ok(varietyWarning(t, plan)); // the December one is after the plan
  // unsorted input still looks at the latest three: duel, build, build, build in any order
  assert.ok(varietyWarning([...tl('duel', 'build', 'build', 'build')].reverse(), plan));
  const self = [...tl('build', 'build'), { date: '2026-10-03', template: 'build', planId: 5 }];
  assert.equal(varietyWarning(self, { ...plan, id: 5 }), null);
});
await check('dates are validated', () => {
  assert.ok(validDate('2026-11-24'));
  for (const bad of ['2026-02-30', '24-11-2026', '', 'x', '2026-13-01']) assert.ok(!validDate(bad), bad);
});

/* ---------------------------------- public view ---------------------------------- */

const SECRET = 'SECRET-OFFICER-NOTE';
const blocksWithNotes = templateBlocks('build').map((b) => ({ ...b, notes: SECRET }));

await check('publicPlan carries date, title, kind and agenda only', () => {
  const pub = publicPlan({ id: 1, date: '2026-11-24', title: 'T', template: 'build', blocks: blocksWithNotes, ideaId: 3, roomCode: null });
  assert.equal(pub.kind, 'Build night');
  assert.ok(pub.agenda.length && pub.agenda.every((a) => Object.keys(a).sort().join() === 'minutes,title,type'));
  assert.ok(!JSON.stringify(pub).includes(SECRET));
  assert.ok(!('ideaId' in pub) && !('roomCode' in pub) && !('blocks' in pub));
});

await check('a planned session starts a room with its own blocks, validated', () => {
  const s = newSession({ kind: 'meeting', template: 'build', blocks: [{ type: 'hook', title: 'Custom', minutes: 4 }, { type: 'nope' }] });
  assert.deepEqual(s.blocks.map((b) => b.title), ['Custom']);
  assert.equal(newSession({ template: 'duel', blocks: null }).blocks.length, templateBlocks('duel').length);
});

/* ----------------------------------- routes ----------------------------------- */

const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;
const ctx = { waitUntil() {}, passThroughOnException() {} };
async function call(path, { cookie, method = 'GET', body, raw } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  return { status: res.status, body: raw ? await res.text() : await res.json().catch(() => null) };
}
const officer = `${COOKIE}=${await signSession(env)}`;
const uid = (await db.prepare(`INSERT INTO users (email, name, role) VALUES ('m@example.com', 'Mia', 'member')`).run()).meta.last_row_id;
const member = `${USER_COOKIE}=${await signValue(env, `${uid}:${Date.now() + 60_000}`)}`;
const A = '/api/admin/hub/planner';
const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);

await check('only officers reach the planner routes', async () => {
  assert.equal((await call(A)).status, 401);
  assert.equal((await call(A, { cookie: member })).status, 401);
  assert.equal((await call(A, { method: 'POST', cookie: member, body: { date: future, title: 'x', template: 'build' } })).status, 401);
});

let planId;
await check('create validates date, title, template and idea', async () => {
  const ok = { date: future, title: 'Build night', template: 'build', blocks: blocksWithNotes };
  for (const bad of [{ date: 'soon' }, { title: '  ' }, { template: 'dropin' }, { template: 'zzz' }, { ideaId: 9999 }]) {
    const r = await call(A, { method: 'POST', cookie: officer, body: { ...ok, ...bad } });
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.ok(r.body.error);
  }
  const r = await call(A, { method: 'POST', cookie: officer, body: ok });
  assert.equal(r.status, 200);
  planId = r.body.id;
  assert.equal(r.body.blocks[0].notes, SECRET);
  // no blocks sent: the template's own are used
  const r2 = await call(A, { method: 'POST', cookie: officer, body: { date: future, title: 'Bare', template: 'duel' } });
  assert.equal(r2.body.blocks.length, templateBlocks('duel').length);
  await call(`${A}/${r2.body.id}`, { method: 'DELETE', cookie: officer });
});

await check('linking an idea marks it planned, and deleting the plan reopens it', async () => {
  const idea = (await db.prepare(`INSERT INTO ideas (user_id, kind, body) VALUES (?, 'lesson', 'Teach me about sorting')`).bind(uid).run()).meta.last_row_id;
  const r = await call(A, { method: 'POST', cookie: officer, body: { date: future, title: 'Sorting', template: 'build', ideaId: idea } });
  assert.equal((await db.prepare('SELECT status FROM ideas WHERE id = ?').bind(idea).first()).status, 'planned');
  await call(`${A}/${r.body.id}`, { method: 'DELETE', cookie: officer });
  assert.equal((await db.prepare('SELECT status FROM ideas WHERE id = ?').bind(idea).first()).status, 'open');
});

await check('edit changes a plan; a missing one is 404', async () => {
  const r = await call(`${A}/${planId}`, { method: 'PUT', cookie: officer, body: { date: future, title: 'Build night 2', template: 'build', blocks: blocksWithNotes } });
  assert.equal(r.body.title, 'Build night 2');
  assert.equal((await call(`${A}/9999`, { method: 'PUT', cookie: officer, body: { date: future, title: 'x', template: 'build' } })).status, 404);
  assert.equal((await call(`${A}/9999`, { method: 'DELETE', cookie: officer })).status, 404);
});

await check('Today, the digest and the calendar feed show the plan without block notes', async () => {
  const today = await call('/api/me/dashboard', { cookie: member, raw: true });
  assert.equal(today.status, 200);
  assert.ok(today.body.includes('Build night 2'));
  assert.ok(!today.body.includes(SECRET));

  await setSetting(db, 'digest_notes', JSON.stringify(['hello']));
  const digest = await buildDigest(db, '2000-01-01T00:00:00Z');
  assert.equal(digest.session.title, 'Build night 2');
  assert.ok(!JSON.stringify(digest).includes(SECRET));

  const ics = await call('/api/deadlines.ics', { raw: true });
  assert.ok(ics.body.includes('SUMMARY:CS Club: Build night 2'));
  assert.ok(!ics.body.includes(SECRET));
});

await check('opening a room from a plan uses its blocks and marks the plan held', async () => {
  const r = await call('/api/admin/hub/rooms', { method: 'POST', cookie: officer, body: { planId } });
  assert.equal(r.status, 200);
  assert.equal(r.body.template, 'build');
  assert.equal(r.body.title, 'Build night 2');
  const p = await db.prepare('SELECT room_code FROM planned_sessions WHERE id = ?').bind(planId).first();
  assert.equal(p.room_code, r.body.code);
  // a second room for the same plan is refused; an unknown plan is 404
  assert.equal((await call('/api/admin/hub/rooms', { method: 'POST', cookie: officer, body: { planId } })).status, 409);
  assert.equal((await call('/api/admin/hub/rooms', { method: 'POST', cookie: officer, body: { planId: 9999 } })).status, 404);
  // held plans leave the member-facing "next meeting"
  const today = await call('/api/me/dashboard', { cookie: member, raw: true });
  assert.ok(!today.body.includes('Build night 2') || today.body.includes('"kind":"live"'));
  const list = await call(A, { cookie: officer });
  assert.equal(list.body.plans.find((x) => x.id === planId).roomCode, r.body.code);
  assert.ok(list.body.held.some((h) => h.template === 'build'));
});

console.log(`planner: ${passed} checks passed`);
