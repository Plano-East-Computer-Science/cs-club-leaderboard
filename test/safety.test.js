/**
 * G5 and E7, plus the fixes from the security review: officer password rate
 * limit, no forgeable default secret, export holds only your own data,
 * deletion removes what it says, reports are officer-only to read, public
 * names are first names by default, verify codes cannot be enumerated and a
 * revoked code fails. Routes run through the real Worker on the fake D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, verifyValue, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { recordActivity } from '../worker/hub/ledger.js';
import { purgeDeleted } from '../worker/hub/safety.js';
import { makeRecordCode, normRecordCode, CODE_LEN } from '../worker/hub/records.js';
import { okLink } from '../worker/routes/admin.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

const env = { ADMIN_PASSWORD: 'right-horse', SESSION_SECRET: 'test-secret', DEV_LOGIN: '1', DB: makeTestDb(SCHEMA) };
const db = env.DB;

async function addUser(name, { role = 'member', email } = {}) {
  const s = await db.prepare('INSERT INTO students (name, grade) VALUES (?, 11)').bind(name).run();
  const mail = email ?? `${name.split(' ')[0].toLowerCase()}@example.com`;
  const u = await db.prepare('INSERT INTO users (email, name, student_id, role) VALUES (?, ?, ?, ?)').bind(mail, name, s.meta.last_row_id, role).run();
  const id = u.meta.last_row_id;
  return { id, sid: s.meta.last_row_id, email: mail, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
}
const officerCookie = `${COOKIE}=${await signSession(env)}`;

async function call(path, { cookie, method = 'GET', body, ip } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (ip) headers['cf-connecting-ip'] = ip;
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

/* ------------------------- officer password rate limit ------------------------- */

await check('shared password: five misses lock the source out, even for the right password', async () => {
  const bad = (ip) => call('/admin/login', { method: 'POST', body: { password: 'hunter2-attempt' }, ip });
  for (let i = 0; i < 5; i++) assert.equal((await bad('9.9.9.9')).status, 401);
  assert.equal((await bad('9.9.9.9')).status, 429);
  const right = await call('/admin/login', { method: 'POST', body: { password: 'right-horse' }, ip: '9.9.9.9' });
  assert.equal(right.status, 429, 'locked out means locked out');
  // Another source is not affected, and the right password works there.
  assert.equal((await call('/admin/login', { method: 'POST', body: { password: 'right-horse' }, ip: '8.8.8.8' })).status, 200);
});

await check('failed logins are logged without the attempted password or the address', async () => {
  const log = (await db.prepare(`SELECT action, detail FROM officer_log WHERE action LIKE 'login-%'`).all()).results;
  assert.equal(log.filter((r) => r.action === 'login-failed').length, 5);
  assert.equal(log.filter((r) => r.action === 'login-locked').length, 1);
  const all = JSON.stringify(log);
  assert.ok(!all.includes('hunter2'), 'attempted password is not stored');
  assert.ok(!all.includes('9.9.9.9'), 'raw address is not stored');
});

await check('the window slides: old failures stop counting', async () => {
  await db.prepare(`UPDATE rate_hits SET ts = ts - 16 * 60000 WHERE key = 'admin-login:9.9.9.9'`).run();
  assert.equal((await call('/admin/login', { method: 'POST', body: { password: 'right-horse' }, ip: '9.9.9.9' })).status, 200);
});

await check('sign-in link requests are capped per source', async () => {
  let last;
  for (let i = 0; i < 9; i++) last = await call('/auth/request', { method: 'POST', body: { email: `x${i}@example.org`, name: 'Test Kid' }, ip: '7.7.7.7' });
  assert.equal(last.status, 429);
  assert.equal((await call('/auth/request', { method: 'POST', body: { email: 'y@example.org', name: 'Test Kid' }, ip: '6.6.6.6' })).status, 200);
});

await check('no secret configured: nothing verifies and nothing can be signed with a default', async () => {
  const bare = {};
  assert.equal(await verifyValue(bare, 'x.deadbeef'), null);
  await assert.rejects(() => signValue(bare, 'x'));
});

await check('opportunity and competition links must be http(s)', () => {
  assert.ok(okLink('https://a.org/x') && okLink('http://a.org') && okLink('') && okLink(null));
  assert.ok(!okLink('javascript:alert(1)') && !okLink('data:text/html,hi') && !okLink('//evil.example'));
});

/* ------------------------------- public names ------------------------------- */

await check('public pages show first names; the opt-in shows the full name; officer-typed entries are kept', async () => {
  await db.prepare(`INSERT INTO students (name) VALUES ('Jordan Lee')`).run(); // officer-typed, no account
  await db.prepare(`INSERT INTO ideas (user_id, body) VALUES (?, 'Run a weekend hackathon')`).bind(maya.id).run();
  await db.prepare(`INSERT INTO projects (user_id, title, description) VALUES (?, 'Lunch bot', 'A bot')`).bind(maya.id).run();
  const names = async () => (await call('/leaderboard')).body.students.map((s) => s.name);
  assert.ok((await names()).includes('Maya') && !(await names()).includes('Maya Patel'));
  assert.ok((await names()).includes('Jordan Lee'), 'officer-entered names stay');
  await db.prepare('INSERT OR IGNORE INTO portfolio_public (user_id) VALUES (?)').bind(maya.id).run(); // D6: private until the owner opts in
  assert.equal((await call(`/portfolio/${maya.id}`)).body.name, 'Maya');
  assert.equal((await call('/projects')).body.projects[0].author, 'Maya');
  assert.equal((await call(`/student/${maya.sid}`)).body.name, 'Maya');
  // The A4 standings page names its top five and your neighbours: same rule.
  await db.prepare(`INSERT INTO point_events (student_id, delta, reason) VALUES (?, 50, 'x')`).bind(maya.sid).run();
  const st = (await call('/standings?season=all')).body;
  assert.ok(st.top.some((r) => r.name === 'Maya') && !JSON.stringify(st).includes('Maya Patel'), 'standings shows a first name');
  await db.prepare(`DELETE FROM point_events WHERE reason = 'x'`).run();

  assert.equal((await call('/me', { method: 'PATCH', cookie: maya.cookie, body: { show_full_name: true } })).status, 200);
  assert.ok((await names()).includes('Maya Patel'));
  assert.equal((await call(`/portfolio/${maya.id}`)).body.name, 'Maya Patel');
  assert.equal((await call('/me', { method: 'PATCH', cookie: maya.cookie, body: { show_full_name: false } })).status, 200);
  assert.ok(!(await names()).includes('Maya Patel'));
});

await check('no public endpoint carries an account email', async () => {
  await recordActivity(db, { studentId: maya.sid, kind: 'ship', ref: 'self:bot', meta: { title: 'Lunch bot', proof_url: 'https://x.test/p' }, status: 'approved' });
  for (const p of ['/leaderboard', '/ideas', '/projects', `/portfolio/${maya.id}`, `/student/${maya.sid}`, '/feed', '/officers', '/site']) {
    const r = await call(p);
    assert.equal(r.status, 200, p);
    assert.ok(!/example\.com/.test(r.text), `${p} must not carry an email`);
  }
});

/* --------------------------------- reports --------------------------------- */

await check('reports: members file them, only officers read them, hiding removes the content', async () => {
  const idea = (await db.prepare(`INSERT INTO ideas (user_id, body) VALUES (?, 'Something rude here')`).bind(maya.id).run()).meta.last_row_id;
  assert.equal((await call('/reports', { method: 'POST', body: { kind: 'idea', id: idea } })).status, 401);
  assert.equal((await call('/reports', { method: 'POST', cookie: sam.cookie, body: { kind: 'user', id: 1 } })).status, 400);
  assert.equal((await call('/reports', { method: 'POST', cookie: sam.cookie, body: { kind: 'idea', id: 99999 } })).status, 404);
  assert.equal((await call('/reports', { method: 'POST', cookie: sam.cookie, body: { kind: 'idea', id: idea, reason: 'rude' } })).status, 200);
  await call('/reports', { method: 'POST', cookie: sam.cookie, body: { kind: 'idea', id: idea } }); // twice is one report
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM reports').first()).n, 1);

  // Not readable by the public or by an ordinary member, including the reporter.
  assert.equal((await call('/admin/hub/reports')).status, 401);
  assert.equal((await call('/admin/hub/reports', { cookie: sam.cookie })).status, 401);
  assert.equal((await call(`/admin/hub/reports/1/hide`, { method: 'POST', cookie: sam.cookie })).status, 401);

  const list = (await call('/admin/hub/reports', { cookie: officerCookie })).body.reports;
  assert.equal(list.length, 1);
  assert.equal(list[0].content, 'Something rude here');
  assert.equal(list[0].reporter, 'Sam Ortiz');
  assert.equal((await call(`/admin/hub/reports/${list[0].id}/hide`, { method: 'POST', cookie: officerCookie })).status, 200);
  assert.ok(!(await call('/ideas')).body.ideas.some((i) => i.id === idea));
  assert.equal((await call('/admin/hub/reports', { cookie: officerCookie })).body.reports.length, 0);
});

await check('reports: dismiss keeps the content, feed items can be hidden', async () => {
  const p = (await db.prepare(`INSERT INTO projects (user_id, title, description) VALUES (?, 'Odd one', 'x')`).bind(maya.id).run()).meta.last_row_id;
  await call('/reports', { method: 'POST', cookie: sam.cookie, body: { kind: 'project', id: p } });
  const r = (await call('/admin/hub/reports', { cookie: officerCookie })).body.reports[0];
  await call(`/admin/hub/reports/${r.id}/dismiss`, { method: 'POST', cookie: officerCookie });
  assert.ok((await call('/projects')).body.projects.some((x) => x.title === 'Odd one'));

  const act = (await db.prepare(`SELECT id FROM activity WHERE student_id = ? AND kind = 'ship'`).bind(maya.sid).first()).id;
  assert.ok((await call('/feed')).body.feed.some((f) => f.id === act));
  await call('/reports', { method: 'POST', cookie: sam.cookie, body: { kind: 'feed', id: act } });
  const fr = (await call('/admin/hub/reports', { cookie: officerCookie })).body.reports[0];
  await call(`/admin/hub/reports/${fr.id}/hide`, { method: 'POST', cookie: officerCookie });
  assert.ok(!(await call('/feed')).body.feed.some((f) => f.id === act), 'hidden from the feed');
  assert.equal((await call(`/feed/${act}/kudos`, { method: 'POST', cookie: sam.cookie })).status, 404, 'and cannot be kudos-ed');
});

/* ---------------------------------- export ---------------------------------- */

const noa = await addUser('Noa Kim', { email: 'noa.secret@example.net' });

await check('export holds the requester\'s data and nobody else\'s', async () => {
  await db.prepare(`INSERT INTO step_progress (user_id, course, step, passed_at, code) VALUES (?, 'python-basics', 's1', datetime('now'), 'print(42)')`).bind(noa.id).run();
  await db.prepare(`INSERT INTO ideas (user_id, body) VALUES (?, 'Noa idea about robots')`).bind(noa.id).run();
  await recordActivity(db, { studentId: noa.sid, kind: 'attend', ref: 'room:NOA1', meta: { title: 'Week 3' } });
  assert.equal((await call('/me/export')).status, 401);
  const r = await call('/me/export', { cookie: noa.cookie });
  assert.equal(r.status, 200);
  const data = JSON.parse(r.text);
  assert.equal(data.account.email, 'noa.secret@example.net');
  assert.equal(data.course_progress[0].code, 'print(42)');
  assert.equal(data.ideas[0].body, 'Noa idea about robots');
  assert.ok(data.point_events.length >= 1);
  assert.ok(!r.text.includes('maya@') && !r.text.includes('sam@'), 'no other member email');
  assert.ok(!r.text.includes('Maya') && !r.text.includes('Something rude'), 'no other member data');
  const other = JSON.parse((await call('/me/export', { cookie: maya.cookie })).text);
  assert.ok(!JSON.stringify(other).includes('Noa') && !JSON.stringify(other).includes('noa.secret'));
});

/* --------------------------------- deletion --------------------------------- */

await check('deletion needs confirmation and refuses officers', async () => {
  assert.equal((await call('/me/account', { method: 'DELETE', cookie: noa.cookie, body: {} })).status, 400);
  const boss = await addUser('Lee Officer', { role: 'officer' });
  assert.equal((await call('/me/account', { method: 'DELETE', cookie: boss.cookie, body: { confirm: 'delete' } })).status, 409);
});

await check('deleting without keeping points: signed out at once, then the purge removes everything', async () => {
  await db.prepare(`INSERT INTO opportunities (title, url, status) VALUES ('Contest', 'https://a.test', 'live')`).run();
  const opp = (await db.prepare('SELECT id FROM opportunities').first()).id;
  await db.prepare('INSERT INTO opportunity_interest (user_id, opportunity_id) VALUES (?, ?)').bind(noa.id, opp).run();
  const act = (await db.prepare(`SELECT id FROM activity WHERE student_id = ?`).bind(maya.sid).first()).id;
  await db.prepare('INSERT INTO kudos (activity_id, user_id) VALUES (?, ?)').bind(act, noa.id).run();
  await db.prepare('INSERT INTO subscribers (email, confirm_token, unsubscribe_token, confirmed) VALUES (?, ?, ?, 1)').bind(noa.email, 'a', 'b').run();
  await db.prepare('INSERT INTO login_tokens (token, email, created_at) VALUES (?, ?, ?)').bind('tok', noa.email, Date.now()).run();

  const res = await call('/me/account', { method: 'DELETE', cookie: noa.cookie, body: { confirm: 'delete' } });
  assert.equal(res.status, 200);
  assert.equal((await call('/me', { cookie: noa.cookie })).body.user, null, 'session is dead at once');
  assert.equal((await call('/me/export', { cookie: noa.cookie })).status, 401);
  assert.equal((await call('/auth/request', { method: 'POST', body: { email: noa.email } })).status, 403, 'cannot sign back in during the grace window');
  assert.ok(!(await call('/leaderboard')).body.students.some((s) => s.id === noa.sid), 'off the leaderboard at once');
  assert.ok(!JSON.stringify((await call('/ideas')).body).includes('robots'), 'content hidden at once');
  assert.equal((await call(`/portfolio/${noa.id}`)).status, 404);

  // Inside the grace period nothing is erased yet.
  assert.equal((await purgeDeleted(db)).purged, 0);
  assert.ok(await db.prepare('SELECT 1 AS x FROM users WHERE id = ?').bind(noa.id).first());

  assert.equal((await purgeDeleted(db, { graceMs: 0, now: Date.now() + 1000 })).purged, 1);
  for (const [t, col] of [
    ['users', 'id'], ['step_progress', 'user_id'], ['ideas', 'user_id'], ['kudos', 'user_id'], ['opportunity_interest', 'user_id'],
  ]) {
    assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ?`).bind(noa.id).first()).n, 0, `${t} emptied`);
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE email = ?').bind(noa.email).first()).n, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM login_tokens WHERE email = ?').bind(noa.email).first()).n, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM activity WHERE student_id = ?').bind(noa.sid).first()).n, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM point_events WHERE student_id = ?').bind(noa.sid).first()).n, 0);
  const entry = await db.prepare('SELECT name, active FROM students WHERE id = ?').bind(noa.sid).first();
  assert.deepEqual(entry, { name: 'Former member', active: 0 }, 'entry deactivated and anonymous');
  // Other members are untouched.
  assert.ok(await db.prepare('SELECT 1 AS x FROM users WHERE id = ?').bind(maya.id).first());
});

await check('deleting but keeping points: an anonymous entry keeps its points, proof links go', async () => {
  const pia = await addUser('Pia Gomez', { email: 'pia@example.com' });
  await recordActivity(db, { studentId: pia.sid, kind: 'ship', ref: 'self:app', meta: { title: 'Pia app', proof_url: 'https://pia.test/secret', note: 'my note', by_user: pia.id }, status: 'approved' });
  const pts = (await db.prepare('SELECT SUM(delta) AS n FROM point_events WHERE student_id = ?').bind(pia.sid).first()).n;
  assert.ok(pts > 0);
  assert.equal((await call('/me/account', { method: 'DELETE', cookie: pia.cookie, body: { confirm: 'delete', keep_history: true } })).status, 200);
  let board = (await call('/leaderboard')).body.students.find((s) => s.id === pia.sid);
  assert.equal(board.name, 'Former member');
  assert.equal(board.points, pts);
  await purgeDeleted(db, { graceMs: 0, now: Date.now() + 1000 });
  board = (await call('/leaderboard')).body.students.find((s) => s.id === pia.sid);
  assert.equal(board.points, pts, 'points survive the purge');
  assert.equal(board.name, 'Former member');
  const meta = (await db.prepare('SELECT meta FROM activity WHERE student_id = ?').bind(pia.sid).first()).meta;
  assert.deepEqual(JSON.parse(meta), { title: 'Pia app' });
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').bind('pia@example.com').first()).n, 0);
  // The address is free again after the purge.
  assert.equal((await call('/auth/request', { method: 'POST', body: { email: 'pia@example.com', name: 'Pia G' }, ip: '5.5.5.5' })).status, 200);
});

/* ------------------------------ verified record ------------------------------ */

await check('record codes are random, long, and case and dash insensitive', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const c = makeRecordCode();
    assert.equal(c.length, CODE_LEN);
    assert.ok(CODE_LEN >= 10);
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]+$/);
    seen.add(c);
  }
  assert.equal(seen.size, 200);
  const c = makeRecordCode();
  assert.equal(normRecordCode(`${c.slice(0, 4)}-${c.slice(4, 8).toLowerCase()} ${c.slice(8)}`), c);
});

await check('verify: officers issue, anyone can check, facts exclude proof links and emails', async () => {
  await db.prepare(`UPDATE users SET role = 'officer' WHERE id = ?`).bind(sam.id).run();
  await db.prepare(`INSERT INTO rooms (code, title) VALUES ('AAAA', 'Week 1'), ('BBBB', 'Week 2')`).run();
  await db.prepare(`INSERT INTO room_checkins (code, user_id) VALUES ('AAAA', ?), ('BBBB', ?)`).bind(maya.id, maya.id).run();
  await recordActivity(db, { studentId: maya.sid, kind: 'place', ref: 'self:usaco', meta: { title: 'USACO Silver', place: 2, proof_url: 'https://proof.test/x' }, status: 'approved' });
  await recordActivity(db, { studentId: maya.sid, kind: 'compete', ref: 'self:pending', meta: { title: 'Not approved yet' } }); // pending

  assert.equal((await call('/admin/hub/records', { method: 'POST', body: { user_id: maya.id } })).status, 401);
  assert.equal((await call('/admin/hub/records', { method: 'POST', cookie: maya.cookie, body: { user_id: maya.id } })).status, 401, 'a member cannot issue');
  const issued = await call('/admin/hub/records', { method: 'POST', cookie: officerCookie, body: { user_id: maya.id } });
  assert.equal(issued.status, 201);
  const code = issued.body.code;
  assert.ok(code.length >= 10);

  const r = await call(`/verify/${code.slice(0, 8).toLowerCase()}-${code.slice(8).toLowerCase()}`);
  assert.equal(r.status, 200);
  const rec = r.body.record;
  assert.equal(rec.name, 'Maya Patel');
  assert.equal(rec.attended, 2);
  assert.equal(rec.issued_by, 'shared login');
  assert.ok(rec.results.some((x) => x.title === 'USACO Silver' && x.place === 2));
  assert.ok(!rec.results.some((x) => x.title === 'Not approved yet'), 'only approved results');
  assert.ok(!/proof\.test|@/.test(r.text), 'no proof links or emails');
  assert.deepEqual((await call(`/verify/${code}`)).body.record.roles, []);
  await db.prepare(`UPDATE users SET role = 'lead' WHERE id = ?`).bind(maya.id).run();
  assert.deepEqual((await call(`/verify/${code}`)).body.record.roles, ['Club lead']);
  await db.prepare(`UPDATE users SET role = 'member' WHERE id = ?`).bind(maya.id).run();

  // The member can see their own codes, nobody else's.
  assert.equal((await call('/me/records', { cookie: maya.cookie })).body.codes[0].code, code);
  assert.equal((await call('/me/records', { cookie: noa.cookie })).status, 401);
  globalThis.__code = code;
});

await check('verify: unknown, malformed and revoked codes all fail the same way', async () => {
  const code = globalThis.__code;
  const unknown = await call(`/verify/${makeRecordCode()}`, { ip: '4.4.4.4' });
  const short = await call('/verify/abc', { ip: '4.4.4.4' });
  assert.equal(unknown.status, 404);
  assert.equal(short.status, 404);
  assert.equal((await call('/admin/hub/records/' + code + '/revoke', { method: 'POST', cookie: maya.cookie })).status, 401);
  assert.equal((await call('/admin/hub/records/' + code + '/revoke', { method: 'POST', cookie: officerCookie })).status, 200);
  const revoked = await call(`/verify/${code}`, { ip: '4.4.4.4' });
  assert.equal(revoked.status, 404);
  assert.equal(revoked.text, unknown.text, 'a revoked code is indistinguishable from an unknown one');
  assert.equal((await call('/admin/hub/records/' + code + '/revoke', { method: 'POST', cookie: officerCookie })).status, 404);
});

await check('verify: lookups are rate limited so codes cannot be guessed in bulk', async () => {
  let last;
  for (let i = 0; i < 40; i++) last = await call(`/verify/${makeRecordCode()}`, { ip: '3.3.3.3' });
  assert.equal(last.status, 429);
  assert.equal((await call(`/verify/${makeRecordCode()}`, { ip: '2.2.2.2' })).status, 404, 'other sources unaffected');
});

await check('a deleted member\'s code stops working at once', async () => {
  const quin = await addUser('Quin Ray', { email: 'quin@example.com' });
  const code = (await call('/admin/hub/records', { method: 'POST', cookie: officerCookie, body: { user_id: quin.id } })).body.code;
  assert.equal((await call(`/verify/${code}`, { ip: '1.1.1.1' })).status, 200);
  await call('/me/account', { method: 'DELETE', cookie: quin.cookie, body: { confirm: 'delete' } });
  assert.equal((await call(`/verify/${code}`, { ip: '1.1.1.1' })).status, 404);
});

await check('public leaderboard and member pages never show a grade', async () => {
  const lb = await call('/leaderboard');
  assert.ok(lb.body.students.length > 0);
  assert.ok(lb.body.students.every((s) => s.grade === null));
  assert.equal((await call(`/student/${maya.sid}`)).body.grade, null);
});

await check('signing out ends every session of the account, including a copied cookie', async () => {
  const lee = await addUser('Lee Park', { email: 'lee.signout@example.com' });
  const other = await signValue(env, `${lee.id}:${Date.now() + 60_000}:0`);
  assert.equal((await call('/me', { cookie: lee.cookie })).body.user.id, lee.id);
  assert.equal((await call('/auth/logout', { method: 'POST', cookie: lee.cookie })).status, 200);
  for (const ck of [lee.cookie, `${USER_COOKIE}=${other}`]) {
    const r = await call('/me', { cookie: ck });
    assert.equal(r.body.user, null, 'an old cookie is signed out');
  }
});

console.log(`safety: ${passed} checks passed`);
