/**
 * E6 alumni: contact details never appear in a member response, members reach
 * graduates only by sending a question through the club, the directory and the
 * officer routes are guarded, AMA sessions are just upcoming speaker plans, and
 * export / purge cover the questions.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { exportFor, softDelete, purgeUser } from '../worker/hub/safety.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'right-horse', SESSION_SECRET: 'test-secret', DEV_LOGIN: '1', DB: makeTestDb(SCHEMA) };
const db = env.DB;

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

async function addUser(name) {
  const s = await db.prepare('INSERT INTO students (name, grade) VALUES (?, 11)').bind(name).run();
  const mail = `${name.split(' ')[0].toLowerCase()}@example.com`;
  const u = await db.prepare('INSERT INTO users (email, name, student_id) VALUES (?, ?, ?)').bind(mail, name, s.meta.last_row_id).run();
  const id = u.meta.last_row_id;
  return { id, sid: s.meta.last_row_id, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
}
const sharedLogin = `${COOKIE}=${await signSession(env)}`;

async function call(path, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(
    new Request(`https://club.test/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    env,
    { waitUntil() {}, passThroughOnException() {} }
  );
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
}

const maya = await addUser('Maya Patel');
const SECRET = 'jordan.kim.private@gmail.com 555-0142';
const ENTRY = { name: 'Jordan Kim', grad_year: 2021, doing: 'Software engineer', topics: 'internships, college CS', contact: SECRET };
let aid;

await check('only officers add alumni', async () => {
  assert.equal((await call('/admin/hub/alumni', { method: 'POST', body: ENTRY })).status, 401);
  assert.equal((await call('/admin/hub/alumni', { cookie: maya.cookie, method: 'POST', body: ENTRY })).status, 401);
  assert.equal((await call('/admin/hub/alumni', { cookie: sharedLogin, method: 'POST', body: { ...ENTRY, grad_year: 'abc' } })).status, 400);
  const r = await call('/admin/hub/alumni', { cookie: sharedLogin, method: 'POST', body: ENTRY });
  assert.equal(r.status, 200);
  aid = r.body.id;
});

await check('contact details never appear in a member response', async () => {
  assert.equal((await call('/alumni')).status, 401, 'directory needs sign-in');
  const r = await call('/alumni', { cookie: maya.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.body.alumni[0].name, 'Jordan Kim');
  assert.ok(!('contact' in r.body.alumni[0]));
  assert.ok(!r.text.includes('gmail') && !r.text.includes('555'), 'no contact text anywhere');
});

await check('a question is stored for officers, never sent to the graduate', async () => {
  assert.equal((await call(`/alumni/${aid}/ask`, { method: 'POST', body: { question: 'How did you get your internship?' } })).status, 401);
  assert.equal((await call(`/alumni/${aid}/ask`, { cookie: maya.cookie, method: 'POST', body: { question: 'short' } })).status, 400);
  assert.equal((await call('/alumni/9999/ask', { cookie: maya.cookie, method: 'POST', body: { question: 'How did you get your internship?' } })).status, 404);
  const ok = await call(`/alumni/${aid}/ask`, { cookie: maya.cookie, method: 'POST', body: { question: 'How did you get your internship?' } });
  assert.equal(ok.status, 200);
  assert.ok(!ok.text.includes('gmail'));
  assert.equal((await call('/admin/hub/alumni', { cookie: maya.cookie })).status, 401, 'members cannot read the officer view');
  const adm = await call('/admin/hub/alumni', { cookie: sharedLogin });
  assert.equal(adm.body.alumni[0].contact, SECRET, 'officers do see contact');
  assert.equal(adm.body.questions.length, 1);
  assert.equal(adm.body.questions[0].member, 'Maya Patel');
  assert.equal((await call(`/admin/hub/alumni/questions/${adm.body.questions[0].id}/forwarded`, { cookie: sharedLogin, method: 'POST' })).status, 200);
  assert.equal((await db.prepare('SELECT status FROM alumni_questions').first()).status, 'forwarded');
});

await check('questions are rate limited per member', async () => {
  for (let i = 0; i < 2; i++) await call(`/alumni/${aid}/ask`, { cookie: maya.cookie, method: 'POST', body: { question: `Another question number ${i}` } });
  assert.equal((await call(`/alumni/${aid}/ask`, { cookie: maya.cookie, method: 'POST', body: { question: 'One more question please' } })).status, 429);
});

await check('hiding an entry removes it from the directory', async () => {
  await call(`/admin/hub/alumni/${aid}`, { cookie: sharedLogin, method: 'PATCH', body: { ...ENTRY, active: false } });
  assert.deepEqual((await call('/alumni', { cookie: maya.cookie })).body.alumni, []);
  assert.equal((await call(`/alumni/${aid}/ask`, { cookie: maya.cookie, method: 'POST', body: { question: 'Are you still around?' } })).status, 404);
});

await check('upcoming speaker sessions are listed; other templates and past dates are not', async () => {
  const ins = (date, title, template) => db.prepare('INSERT INTO planned_sessions (date, title, template) VALUES (?, ?, ?)').bind(date, title, template).run();
  await ins('2999-01-01', 'AMA with Jordan', 'speaker');
  await ins('2999-01-02', 'Build night', 'build');
  await ins('2000-01-01', 'Old AMA', 'speaker');
  assert.deepEqual((await call('/alumni', { cookie: maya.cookie })).body.sessions.map((s) => s.title), ['AMA with Jordan']);
});

await check('export includes questions; purge removes them', async () => {
  assert.equal((await exportFor(db, { id: maya.id, student_id: maya.sid })).alumni_questions.length, 3);
  await softDelete(db, { id: maya.id, student_id: maya.sid }, false);
  await purgeUser(db, maya.id);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM alumni_questions').first()).n, 0);
});

console.log(`alumni: ${passed} checks passed`);
