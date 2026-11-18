/**
 * D6: portfolio v2. A portfolio is private until its owner turns it on, public
 * ones show a first name only (unless opted in), nothing but approved ledger
 * rows count, and only officers can sign a line.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;
const ctx = { waitUntil() {}, passThroughOnException() {} };
async function call(path, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  const text = await res.text();
  return { status: res.status, text, body: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

const student = (await db.prepare(`INSERT INTO students (name) VALUES ('Maya Rivera')`).run()).meta.last_row_id;
const uid = (await db.prepare(`INSERT INTO users (email, name, student_id) VALUES ('maya.private@example.com', 'Maya Rivera', ?)`).bind(student).run()).meta.last_row_id;
const other = (await db.prepare(`INSERT INTO users (email, name) VALUES ('sam@example.com', 'Sam Lee')`).run()).meta.last_row_id;
const cookieFor = async (id) => `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}:0`)}`;
const owner = await cookieFor(uid);
const stranger = await cookieFor(other);
const officer = `${COOKIE}=${await signSession(env)}`;
const P = `/api/portfolio/${uid}`;

const act = (kind, status, title, hidden = 0) =>
  db
    .prepare(`INSERT INTO activity (student_id, kind, ref, meta, status, points, decided_at, hidden) VALUES (?, ?, ?, ?, ?, 10, datetime('now'), ?)`)
    .bind(student, kind, `${kind}:${title}`, JSON.stringify({ title }), status, hidden)
    .run();
await act('compete', 'approved', 'USACO December');
await act('compete', 'pending', 'PENDING-CONTEST');
await act('place', 'rejected', 'REJECTED-PLACE');
await act('ship', 'approved', 'HIDDEN-SHIP', 1);

await check('a portfolio is private by default: strangers and the signed-out get the same 404 as a missing one', async () => {
  const missing = await call('/api/portfolio/9999');
  for (const who of [undefined, stranger, officer]) {
    const r = await call(P, { cookie: who });
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, missing.body);
  }
});

await check('the owner can see their own private portfolio, and is told it is theirs', async () => {
  const r = await call(P, { cookie: owner });
  assert.equal(r.status, 200);
  assert.equal(r.body.owner, true);
  assert.equal(r.body.public, false);
});

await check('only the signed-in owner can switch it on or off', async () => {
  assert.equal((await call('/api/me/portfolio', { method: 'PUT', body: { public: true } })).status, 401);
  assert.equal((await call('/api/me/portfolio', { method: 'PUT', cookie: owner, body: { public: 'yes' } })).status, 400);
  // a stranger flips their own switch, never someone else's
  await call('/api/me/portfolio', { method: 'PUT', cookie: stranger, body: { public: true } });
  assert.equal((await call(P)).status, 404);
  assert.equal((await call('/api/me/portfolio', { method: 'PUT', cookie: owner, body: { public: true } })).status, 200);
  assert.equal((await call(P)).status, 200);
});

await check('public view: first name only, no email, no grade, owner false', async () => {
  const r = await call(P);
  assert.equal(r.body.name, 'Maya');
  assert.equal(r.body.owner, false);
  assert.ok(!r.text.includes('Rivera'));
  assert.ok(!r.text.includes('maya.private@example.com'));
  assert.ok(!/grade/i.test(r.text));
});

await check('opting in to the full name shows it', async () => {
  await db.prepare('UPDATE users SET show_full_name = 1 WHERE id = ?').bind(uid).run();
  assert.equal((await call(P)).body.name, 'Maya Rivera');
  await db.prepare('UPDATE users SET show_full_name = 0 WHERE id = ?').bind(uid).run();
});

await check('only approved, unhidden ledger rows appear as results', async () => {
  const r = await call(P);
  assert.deepEqual(r.body.results.map((x) => x.title), ['USACO December']);
  assert.ok(!r.text.includes('PENDING-CONTEST') && !r.text.includes('REJECTED-PLACE') && !r.text.includes('HIDDEN-SHIP'));
});

await check('turning it off hides it again', async () => {
  await call('/api/me/portfolio', { method: 'PUT', cookie: owner, body: { public: false } });
  assert.equal((await call(P)).status, 404);
  await call('/api/me/portfolio', { method: 'PUT', cookie: owner, body: { public: true } });
});

const S = '/api/admin/hub/portfolio/signoffs';
await check('only officers can sign: members and the signed-out are refused', async () => {
  for (const who of [undefined, owner, stranger]) {
    assert.equal((await call(S, { method: 'POST', cookie: who, body: { user_id: uid, line: 'Maya mentors new members every week.' } })).status, 401);
    assert.equal((await call(S, { cookie: who })).status, 401);
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM portfolio_signoffs').first()).n, 0);
});

await check('an officer signs; it shows with their name and the date', async () => {
  assert.equal((await call(S, { method: 'POST', cookie: officer, body: { user_id: uid, line: '  too short ' } })).status, 400);
  assert.equal((await call(S, { method: 'POST', cookie: officer, body: { user_id: 9999, line: 'Maya mentors new members every week.' } })).status, 404);
  const r = await call(S, { method: 'POST', cookie: officer, body: { user_id: uid, line: 'Maya mentors   new members\nevery week.' } });
  assert.equal(r.status, 201);
  const v = (await call(P)).body.signoffs;
  assert.equal(v.length, 1);
  assert.equal(v[0].line, 'Maya mentors new members every week.'); // whitespace collapsed to one line
  assert.equal(v[0].by, 'Club officers'); // the shared login has no personal name
  assert.match(v[0].date, /^\d{4}-\d{2}-\d{2}$/);
});

await check('a named officer is recorded by name; a member is capped at three lines; removing works', async () => {
  const off = (await db.prepare(`INSERT INTO users (email, name, role) VALUES ('o@example.com', 'Priya Shah', 'officer')`).run()).meta.last_row_id;
  const named = await cookieFor(off);
  assert.equal((await call(S, { method: 'POST', cookie: named, body: { user_id: uid, line: 'Maya shipped her first bot in October.' } })).status, 201);
  assert.equal((await call(P)).body.signoffs[0].by, 'Priya Shah');
  assert.equal((await call(S, { method: 'POST', cookie: named, body: { user_id: uid, line: 'Maya helps debug during build nights.' } })).status, 201);
  assert.equal((await call(S, { method: 'POST', cookie: named, body: { user_id: uid, line: 'A fourth line is one too many.' } })).status, 409);
  const first = (await call(S, { cookie: officer })).body.signoffs.at(-1);
  assert.equal((await call(`${S}/${first.id}`, { method: 'DELETE', cookie: owner })).status, 401);
  assert.equal((await call(`${S}/${first.id}`, { method: 'DELETE', cookie: officer })).status, 200);
  assert.equal((await call(`${S}/${first.id}`, { method: 'DELETE', cookie: officer })).status, 404);
});

await check('signed lines stay hidden while the portfolio is private', async () => {
  await call('/api/me/portfolio', { method: 'PUT', cookie: owner, body: { public: false } });
  const r = await call(P);
  assert.equal(r.status, 404);
  assert.ok(!r.text.includes('Maya shipped'));
});

console.log(`portfolio: ${passed} checks passed`);
