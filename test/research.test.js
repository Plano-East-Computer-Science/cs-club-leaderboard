/**
 * C15 research track: the paper link is https only, only officers set it, notes
 * are visible to signed-in members with first names, a report hides a note, the
 * science-fair card is private to its owner and officers, research opportunities
 * are filtered from the existing table, and export / purge cover the new tables.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { exportFor, softDelete, purgeUser } from '../worker/hub/safety.js';
import { httpsUrl } from '../worker/hub/research.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'right-horse', SESSION_SECRET: 'test-secret', DEV_LOGIN: '1', DB: makeTestDb(SCHEMA) };
const db = env.DB;

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

async function addUser(name, { role = 'member' } = {}) {
  const s = await db.prepare('INSERT INTO students (name, grade) VALUES (?, 11)').bind(name).run();
  const mail = `${name.split(' ')[0].toLowerCase()}@example.com`;
  const u = await db.prepare('INSERT INTO users (email, name, student_id, role) VALUES (?, ?, ?, ?)').bind(mail, name, s.meta.last_row_id, role).run();
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
const sam = await addUser('Sam Ortiz');
const PAPER = { title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', why: 'Where transformers started.' };

await check('httpsUrl accepts https only', () => {
  assert.equal(httpsUrl('https://arxiv.org/abs/1'), 'https://arxiv.org/abs/1');
  for (const bad of ['http://a.com', 'javascript:alert(1)', 'ftp://a.com', 'not a url', '', null]) assert.equal(httpsUrl(bad), null, String(bad));
});

await check('only officers set the paper, and the link must be https', async () => {
  assert.equal((await call('/admin/hub/research/paper', { method: 'POST', body: PAPER })).status, 401, 'signed out');
  assert.equal((await call('/admin/hub/research/paper', { cookie: maya.cookie, method: 'POST', body: PAPER })).status, 401, 'member');
  assert.equal((await call('/admin/hub/research/paper', { cookie: sharedLogin, method: 'POST', body: { ...PAPER, url: 'http://x.com' } })).status, 400);
  assert.equal((await call('/admin/hub/research/paper', { cookie: sharedLogin, method: 'POST', body: PAPER })).status, 200);
  assert.equal((await call('/research')).body.paper.title, PAPER.title, 'public can see the paper');
});

await check('notes need an account; signed-out readers get none; authors show first name only', async () => {
  assert.equal((await call('/research/notes', { method: 'POST', body: { comment: 'nice' } })).status, 401);
  assert.equal((await call('/research/notes', { cookie: maya.cookie, method: 'POST', body: { quote: 'Section 3', comment: 'Why multi-head?' } })).status, 200);
  assert.equal((await call('/research/notes', { cookie: maya.cookie, method: 'POST', body: { comment: 'x' } })).status, 400, 'too short');
  assert.deepEqual((await call('/research')).body.notes, [], 'signed out sees none');
  const seen = await call('/research', { cookie: sam.cookie });
  assert.equal(seen.body.notes.length, 1);
  assert.equal(seen.body.notes[0].author, 'Maya');
  assert.ok(!seen.text.includes('Patel') && !seen.text.includes('maya@'), 'no surname or email');
});

await check('a report hides the note; only the author can delete their own', async () => {
  const id = (await db.prepare('SELECT id FROM paper_notes').first()).id;
  assert.equal((await call(`/research/notes/${id}`, { cookie: sam.cookie, method: 'DELETE' })).status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM paper_notes').first()).n, 1, 'not sam note, still there');
  assert.equal((await call('/reports', { cookie: sam.cookie, method: 'POST', body: { kind: 'paper_note', id } })).status, 200);
  const rep = await call('/admin/hub/reports', { cookie: sharedLogin });
  const r = rep.body.reports.find((x) => x.kind === 'paper_note');
  assert.equal(r.content, 'Why multi-head?');
  assert.equal((await call(`/admin/hub/reports/${r.id}/hide`, { cookie: sharedLogin, method: 'POST' })).status, 200);
  assert.deepEqual((await call('/research', { cookie: sam.cookie })).body.notes, []);
  assert.equal((await call('/reports', { cookie: sam.cookie, method: 'POST', body: { kind: 'paper_note', id } })).status, 404, 'hidden is not reportable');
});

await check('the science-fair card is private to its owner and officers', async () => {
  const card = { question: 'Does music change typing speed?', mentor: 'Dr. Lin', data_plan: 'Survey', writeup: '', deadline: '2027-01-15', stage: 'data' };
  assert.equal((await call('/research/project', { method: 'PUT', body: card })).status, 401);
  assert.equal((await call('/research/project', { cookie: maya.cookie, method: 'PUT', body: { ...card, deadline: 'soon' } })).status, 400);
  assert.equal((await call('/research/project', { cookie: maya.cookie, method: 'PUT', body: card })).status, 200);
  assert.equal((await call('/research', { cookie: maya.cookie })).body.project.stage, 'data');
  for (const who of [undefined, sam.cookie]) {
    const r = await call('/research', { cookie: who });
    assert.equal(r.body.project, null);
    assert.ok(!r.text.includes('typing speed'), 'card text must not reach another viewer');
  }
  assert.equal((await call('/admin/hub/research/projects', { cookie: sam.cookie })).status, 401);
  const list = await call('/admin/hub/research/projects', { cookie: sharedLogin });
  assert.equal(list.body.projects.length, 1);
  assert.equal(list.body.projects[0].name, 'Maya Patel');
});

await check('research opportunities come from the existing board', async () => {
  const ins = (title, desc, status = 'live') =>
    db.prepare(`INSERT INTO opportunities (title, description, status, fingerprint) VALUES (?, ?, ?, ?)`).bind(title, desc, status, title).run();
  await ins('Summer Research Program', 'Work in a lab.');
  await ins('Hackathon', 'Build things.');
  await ins('Old Research Thing', 'research', 'archived');
  const o = (await call('/research')).body.opportunities;
  assert.deepEqual(o.map((x) => x.title), ['Summer Research Program']);
});

await check('export and purge cover notes and the project card', async () => {
  await call('/research/notes', { cookie: maya.cookie, method: 'POST', body: { comment: 'Second thought here' } });
  const ex = await exportFor(db, { id: maya.id, student_id: maya.sid });
  assert.equal(ex.paper_notes.length, 2);
  assert.equal(ex.science_project.stage, 'data');
  await softDelete(db, { id: maya.id, student_id: maya.sid }, false);
  await purgeUser(db, maya.id);
  for (const t of ['paper_notes', 'science_projects']) {
    assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).bind(maya.id).first()).n, 0, `${t} purged`);
  }
  assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE kind = 'paper_note'`).first()).n, 0, 'reports about the notes go too');
});

console.log(`research: ${passed} checks passed`);
