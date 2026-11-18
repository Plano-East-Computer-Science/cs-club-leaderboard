/**
 * C6 editorials and C7 ghost races: only solvers (and officers) read editorials,
 * accepting pays once and never to yourself, a report hides one, member text is
 * never rendered as HTML, the ghost list has first names and times only, the
 * pacing maths, and account export / deletion cover the new tables.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { exportFor, softDelete, purgeUser } from '../worker/hub/safety.js';
import { ghostProgress, raceResult } from '../shared/ghost.js';
import { parseSections, paras } from '../src/lib/md.js';

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

await db
  .prepare(`INSERT INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, status) VALUES ('two-sum', 'Two Sum', 'b', 1, '', '', '[{"stdin":"1","stdout":"1"}]', 'print(1)', 'live')`)
  .run();

const maya = await addUser('Maya Patel');
const sam = await addUser('Sam Ortiz');
const lee = await addUser('Lee Chen'); // never solves anything
const ofc = await addUser('Olive Reyes', { role: 'officer' });
const ofc2 = await addUser('Omar Reyes', { role: 'officer' });

const solve = (u, ms) => call('/problems/two-sum/solve', { cookie: u.cookie, method: 'POST', body: { ms } });
const GOOD = { body: 'Sort first, then walk two pointers in from both ends.', code: 'print(1)' };

/* ----------------------------- pacing maths ------------------------------ */

await check('ghost pacing: linear, clamped, and the tie goes to the ghost', () => {
  assert.equal(ghostProgress(0, 60_000), 0);
  assert.equal(ghostProgress(15_000, 60_000), 0.25);
  assert.equal(ghostProgress(60_000, 60_000), 1);
  assert.equal(ghostProgress(90_000, 60_000), 1, 'never past the end');
  assert.equal(ghostProgress(-5, 60_000), 0);
  assert.equal(ghostProgress(10, 0), 0, 'no time recorded, no movement');
  assert.deepEqual(raceResult(50_000, 60_000), { won: true, diffMs: 10_000 });
  assert.deepEqual(raceResult(70_000, 60_000), { won: false, diffMs: 10_000 });
  assert.equal(raceResult(60_000, 60_000).won, false);
});

/* ------------------------------ visibility ------------------------------- */

await check('editorials stay locked until you solve the problem; officers can always read', async () => {
  assert.equal((await call('/problems/two-sum/editorials')).status, 401, 'signed out');
  assert.equal((await solve(maya, 120_000)).status, 200);
  assert.equal((await call('/problems/two-sum/editorials', { cookie: maya.cookie, method: 'POST', body: GOOD })).status, 201);
  const id = (await db.prepare('SELECT id FROM editorials').first()).id;
  assert.equal((await call(`/admin/hub/editorials/${id}/accept`, { cookie: ofc2.cookie, method: 'POST' })).status, 200);

  const locked = await call('/problems/two-sum/editorials', { cookie: lee.cookie });
  assert.equal(locked.body.locked, true);
  assert.deepEqual(locked.body.editorials, []);
  assert.ok(!locked.text.includes('two pointers'), 'text must not leak to a non-solver');
  assert.equal((await call('/problems/two-sum/editorials', { cookie: lee.cookie, method: 'POST', body: GOOD })).status, 403, 'cannot write without solving');

  await solve(sam, 300_000);
  const open = await call('/problems/two-sum/editorials', { cookie: sam.cookie });
  assert.equal(open.body.locked, false);
  assert.equal(open.body.editorials.length, 1);
  assert.equal(open.body.editorials[0].name, 'Maya', 'first name only');

  assert.equal((await call('/problems/two-sum/editorials', { cookie: ofc.cookie })).body.editorials.length, 1, 'officer reads without solving');
});

await check('a solved duel also unlocks the problem', async () => {
  await db.prepare(`INSERT INTO duel_results (room_code, round, division, match_no, user_id, slug, attempts, solved_ms) VALUES ('ABCD', 1, 'new', 1, ?, 'two-sum', 1, 90000)`).bind(lee.id).run();
  assert.equal((await call('/problems/two-sum/editorials', { cookie: lee.cookie })).body.locked, false);
});

/* ------------------------------ accept pays once ------------------------------ */

await check('accepting pays one mentor activity, once; self-acceptance is refused', async () => {
  const mentor = () => db.prepare(`SELECT COUNT(*) AS n, SUM(points) AS pts FROM activity WHERE student_id = ? AND kind = 'mentor'`).bind(maya.sid).first();
  const m = await mentor();
  assert.equal(m.n, 1);
  assert.ok(m.pts > 0, 'paid and approved at once');
  const id = (await db.prepare('SELECT id FROM editorials').first()).id;
  assert.equal((await call(`/admin/hub/editorials/${id}/accept`, { cookie: ofc2.cookie, method: 'POST' })).status, 409, 'second click is refused');
  assert.equal((await mentor()).n, 1, 'still one activity');
  assert.equal((await db.prepare(`SELECT ref FROM activity WHERE kind = 'mentor'`).first()).ref, `editorial:${id}`);

  // An officer writes one, then tries to accept it.
  await solve(ofc, 100_000);
  await call('/problems/two-sum/editorials', { cookie: ofc.cookie, method: 'POST', body: GOOD });
  const mine = (await db.prepare('SELECT id FROM editorials WHERE user_id = ?').bind(ofc.id).first()).id;
  assert.equal((await call(`/admin/hub/editorials/${mine}/accept`, { cookie: ofc.cookie, method: 'POST' })).status, 403);
  assert.equal((await db.prepare('SELECT status FROM editorials WHERE id = ?').bind(mine).first()).status, 'pending', 'still pending');
  assert.equal((await call(`/admin/hub/editorials/${mine}/accept`, { cookie: ofc2.cookie, method: 'POST' })).status, 200, 'another officer can');
  assert.equal((await call(`/admin/hub/editorials/${mine}/accept`, { cookie: sharedLogin, method: 'POST' })).status, 409);
});

await check('members cannot use the officer routes', async () => {
  assert.equal((await call('/admin/hub/editorials', { cookie: maya.cookie })).status, 401);
  assert.equal((await call('/admin/hub/editorials/1/accept', { cookie: maya.cookie, method: 'POST' })).status, 401);
});

await check('rejected editorials do not show; an edit goes back to pending', async () => {
  await solve(sam, 300_000);
  await call('/problems/two-sum/editorials', { cookie: sam.cookie, method: 'POST', body: GOOD });
  const id = (await db.prepare('SELECT id FROM editorials WHERE user_id = ?').bind(sam.id).first()).id;
  await call(`/admin/hub/editorials/${id}/reject`, { cookie: sharedLogin, method: 'POST' });
  const names = (await call('/problems/two-sum/editorials', { cookie: sam.cookie })).body.editorials.map((e) => e.id);
  assert.ok(!names.includes(id));
  assert.equal((await call('/problems/two-sum/editorials', { cookie: sam.cookie })).body.mine.status, 'rejected');
  await call('/problems/two-sum/editorials', { cookie: sam.cookie, method: 'POST', body: { ...GOOD, body: 'A better and longer explanation of the idea.' } });
  assert.equal((await db.prepare('SELECT status FROM editorials WHERE id = ?').bind(id).first()).status, 'pending');
});

/* -------------------------------- reports --------------------------------- */

await check('a reported editorial an officer hides disappears for readers', async () => {
  const id = (await db.prepare(`SELECT id FROM editorials WHERE user_id = ?`).bind(maya.id).first()).id;
  assert.equal((await call('/reports', { cookie: sam.cookie, method: 'POST', body: { kind: 'editorial', id } })).status, 200);
  const rep = (await call('/admin/hub/reports', { cookie: sharedLogin })).body.reports.find((r) => r.kind === 'editorial');
  assert.ok(rep.content.includes('two pointers'));
  assert.equal(rep.author, 'Maya Patel', 'officers see the full name');
  assert.equal((await call(`/admin/hub/reports/${rep.id}/hide`, { cookie: sharedLogin, method: 'POST' })).status, 200);
  const after = (await call('/problems/two-sum/editorials', { cookie: sam.cookie })).body.editorials;
  assert.ok(!after.some((e) => e.id === id), 'hidden');
  assert.equal((await call('/reports', { cookie: sam.cookie, method: 'POST', body: { kind: 'editorial', id } })).status, 404, 'cannot report what is not there');
});

/* ----------------------------- safe rendering ---------------------------- */

await check('a script tag in an editorial is stored and returned as plain text, never as markup', async () => {
  const evil = '<script>alert(1)</script> and <img src=x onerror=alert(2)> then more words';
  const el = await addUser('Eve Nash');
  await solve(el, 1000);
  assert.equal((await call('/problems/two-sum/editorials', { cookie: el.cookie, method: 'POST', body: { body: evil, code: '</pre><script>x()</script>' } })).status, 201);
  const row = await db.prepare('SELECT body FROM editorials WHERE user_id = ?').bind(el.id).first();
  assert.equal(row.body, evil, 'stored untouched, escaped on output');
  // The page renders text through React nodes and parseSections: each paragraph is a plain string, so
  // the tag is shown as characters. Nothing here turns it into elements, and the page has no raw-HTML escape hatch.
  const [p] = paras(parseSections(row.body)[0]);
  assert.equal(p, evil);
  const src = fs.readFileSync(new URL('../src/components/Editorials.jsx', import.meta.url), 'utf8');
  assert.ok(!/dangerouslySetInnerHTML|innerHTML/.test(src), 'Editorials.jsx must not inject HTML');
});

/* --------------------------------- ghosts -------------------------------- */

await check('the ghost list is first names and times: no code, no full names, not yourself', async () => {
  await db.prepare(`UPDATE duel_results SET code = 'SECRET_DUEL_CODE' WHERE user_id = ?`).bind(lee.id).run();
  await db.prepare(`UPDATE users SET show_full_name = 1 WHERE id = ?`).bind(maya.id).run();
  const r = await call('/problems/two-sum/ghosts', { cookie: sam.cookie });
  assert.equal(r.status, 200);
  assert.ok(r.body.ghosts.length >= 2);
  for (const g of r.body.ghosts) assert.deepEqual(Object.keys(g).sort(), ['id', 'ms', 'name']);
  const names = r.body.ghosts.map((g) => g.name);
  assert.ok(names.includes('Maya') && names.includes('Lee'));
  assert.ok(!r.text.includes('Patel') && !r.text.includes('Chen'), 'no surnames, even with show_full_name');
  assert.ok(!r.text.includes('SECRET_DUEL_CODE') && !r.text.includes('print(1)'), 'never any code');
  assert.ok(!r.body.ghosts.some((g) => g.id === sam.id), 'you are not your own ghost');
  assert.ok(Number.isInteger(r.body.medianMs));
  assert.equal((await call('/problems/two-sum/ghosts')).status, 401);
  // A member who deleted their account is not a ghost.
  await softDelete(db, { id: lee.id, student_id: lee.sid }, false);
  assert.ok(!(await call('/problems/two-sum/ghosts', { cookie: sam.cookie })).body.ghosts.some((g) => g.name === 'Lee'));
});

await check('ghost results: the server uses its own time for the ghost, records history, awards no points', async () => {
  const before = (await db.prepare('SELECT COUNT(*) AS n FROM activity').first()).n;
  const ghosts = (await call('/problems/two-sum/ghosts', { cookie: sam.cookie })).body.ghosts;
  const maya120 = ghosts.find((g) => g.name === 'Maya');
  const win = await call('/problems/two-sum/ghost-result', { cookie: sam.cookie, method: 'POST', body: { ghost: maya120.id, ms: 100_000, ghostMs: 1 } });
  assert.equal(win.body.won, true);
  assert.equal(win.body.ghostMs, 120_000, 'client-supplied ghost time ignored');
  const lose = await call('/problems/two-sum/ghost-result', { cookie: sam.cookie, method: 'POST', body: { ghost: 'median', ms: 999_999 } });
  assert.equal(lose.body.won, false);
  assert.equal(lose.body.ghostName, 'the club median');
  assert.equal((await call('/problems/two-sum/ghost-result', { cookie: sam.cookie, method: 'POST', body: { ghost: sam.id, ms: 5000 } })).status, 404, 'cannot race yourself');
  assert.equal((await call('/problems/two-sum/ghost-result', { cookie: sam.cookie, method: 'POST', body: { ghost: 'median', ms: -4 } })).status, 400);
  assert.equal((await call('/problems/two-sum/ghost-result', { cookie: sam.cookie, method: 'POST', body: { ghost: 'median', ms: 5 } })).status, 400, 'implausibly fast times are refused');
  const hist = (await call('/problems/two-sum/ghosts', { cookie: sam.cookie })).body.history;
  assert.equal(hist.length, 2);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM activity').first()).n, before, 'no points for winning');
});

/* ----------------------- export and deletion coverage ---------------------- */

await check('account export and purge cover the new per-user tables', async () => {
  const ex = await exportFor(db, { id: sam.id, student_id: sam.sid });
  assert.ok(ex.problem_solves.length >= 1 && ex.editorials_written.length === 1 && ex.ghost_races.length === 2);
  await softDelete(db, { id: sam.id, student_id: sam.sid }, false);
  await purgeUser(db, sam.id);
  for (const t of ['problem_solves', 'editorials', 'ghost_races']) {
    assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).bind(sam.id).first()).n, 0, `${t} purged`);
  }
});

console.log(`editorials: ${passed} checks passed`);
