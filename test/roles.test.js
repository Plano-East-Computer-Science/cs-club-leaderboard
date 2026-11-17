/**
 * A7: officer accounts and roles. Drives the real Worker app against the fake
 * D1, so these are the same routes and SQL the site runs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { BREAK_GLASS } from '../worker/hub/team.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;

async function addUser(name, role = 'member') {
  const r = await db
    .prepare('INSERT INTO users (email, name, role) VALUES (?, ?, ?)')
    .bind(`${name.toLowerCase()}@example.com`, name, role)
    .run();
  return r.meta.last_row_id;
}
const userCookie = async (id) => `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}`;
const glass = async () => `${COOKIE}=${await signSession(env)}`;

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
const setRole = (cookie, id, role) => call(`/admin/hub/team/${id}/role`, { cookie, method: 'POST', body: { role } });
const roleOf = async (id) => (await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first()).role;

const ana = await addUser('Ana', 'lead');
const ben = await addUser('Ben', 'officer');
const cam = await addUser('Cam');
const dee = await addUser('Dee');
const [A, B, C] = [await userCookie(ana), await userCookie(ben), await userCookie(cam)];
const G = await glass();

/* ---------------------------------- guard ---------------------------------- */

for (const path of ['/admin/students', '/admin/hub/team', '/admin/hub/rooms']) {
  assert.equal((await call(path)).status, 401, `anonymous ${path}`);
  assert.equal((await call(path, { cookie: C })).status, 401, `member ${path}`);
  assert.equal((await call(path, { cookie: B })).status, 200, `officer ${path}`);
  assert.equal((await call(path, { cookie: A })).status, 200, `lead ${path}`);
  assert.equal((await call(path, { cookie: G })).status, 200, `break-glass ${path}`);
}
// A forged or tampered cookie is nobody.
assert.equal((await call('/admin/students', { cookie: `${USER_COOKIE}=${ben}:${Date.now() + 60_000}.bad` })).status, 401);

// The contract other threads read.
assert.deepEqual((await call('/admin/hub/team', { cookie: B })).body.me, { userId: ben, name: 'Ben', role: 'officer' });
assert.deepEqual((await call('/admin/hub/team', { cookie: G })).body.me, BREAK_GLASS);
assert.deepEqual(BREAK_GLASS, { userId: null, name: 'shared login', role: 'lead' });
// An officer account is attributed to the person even if the shared cookie is also present.
assert.equal((await call('/admin/hub/team', { cookie: `${B}; ${G}` })).body.me.userId, ben);

const s = (await call('/admin/session', { cookie: C })).body;
assert.equal(s.authed, false);
assert.deepEqual(s.user, { id: cam, name: 'Cam', role: 'member' }, 'session names the signed-in non-officer');
assert.equal((await call('/admin/session', { cookie: A })).body.officer.role, 'lead');

/* ------------------------------- role changes ------------------------------- */

assert.equal((await setRole(B, cam, 'officer')).status, 403, 'an officer cannot promote');
assert.equal((await setRole(C, cam, 'officer')).status, 401, 'a member cannot promote');
assert.equal(await roleOf(cam), 'member');
assert.equal((await setRole(A, cam, 'boss')).status, 400);
assert.equal((await setRole(A, 9999, 'officer')).status, 404);

assert.equal((await setRole(A, cam, 'officer')).status, 200, 'a lead promotes');
assert.equal(await roleOf(cam), 'officer');
assert.equal((await call('/admin/students', { cookie: C })).status, 200, 'promotion takes effect at once');

// Last lead: Ana is the only one. Nobody, not even break-glass, can remove her.
assert.equal((await setRole(A, ana, 'officer')).status, 409, 'last lead cannot demote herself');
assert.equal((await setRole(G, ana, 'member')).status, 409, 'break-glass cannot remove the last lead');
assert.equal(await roleOf(ana), 'lead');

// Bootstrap: break-glass counts as lead and can make a new lead; then Ana may step down.
assert.equal((await setRole(G, dee, 'lead')).status, 200);
assert.equal((await setRole(A, ana, 'officer')).status, 200, 'with two leads one may step down');
assert.equal((await setRole(A, cam, 'member')).status, 403, 'Ana is no longer lead, on the very next request');

// Demotion takes effect on the next request with the same cookie.
assert.equal((await call('/admin/students', { cookie: B })).status, 200);
assert.equal((await setRole(G, ben, 'member')).status, 200);
assert.equal((await call('/admin/students', { cookie: B })).status, 401, 'demoted officer is locked out at once');
assert.equal((await call('/admin/hub/rooms', { cookie: B })).status, 401);

/* ---------------------------------- audit ---------------------------------- */

assert.equal((await call('/admin/students', { cookie: C, method: 'POST', body: { name: 'New Kid' } })).status, 200);
assert.equal((await call('/admin/hub/rooms', { cookie: G, method: 'POST', body: { title: 'Week 1' } })).status, 200);
assert.equal((await call('/admin/students', { cookie: C, method: 'POST', body: {} })).status, 400);
assert.equal((await call('/admin/login', { method: 'POST', body: { password: 'pw' } })).status, 200);

const log = (await db.prepare('SELECT * FROM officer_log ORDER BY rowid').all()).results;
const has = (pred, msg) => assert.ok(log.some(pred), msg);
has((r) => r.action === 'write' && r.officer_user_id === cam && r.detail === 'POST /api/admin/students', 'admin write attributed');
has((r) => r.action === 'write' && r.officer_user_id === null && r.officer_name === 'shared login' && r.detail === 'POST /api/admin/hub/rooms', 'break-glass write');
has((r) => r.action === 'role' && r.officer_user_id === ana && r.detail === 'Cam (#3): member to officer', 'role change');
has((r) => r.action === 'login' && r.officer_name === 'shared login', 'break-glass login');
assert.equal(log.filter((r) => r.action === 'write').length, 2, 'failed writes and role routes are not double-logged');
assert.equal(log.filter((r) => r.action === 'role').length, 4, 'one row per successful role change, none for refused ones');

const team = (await call('/admin/hub/team', { cookie: G })).body;
assert.deepEqual(team.officers.map((o) => [o.name, o.role]), [['Dee', 'lead'], ['Ana', 'officer'], ['Cam', 'officer']]);
assert.equal(team.log[0].action, 'login', 'newest first');
assert.deepEqual((await call('/admin/hub/team/search?q=de', { cookie: C })).body.members.map((m) => m.name), ['Dee']);
assert.deepEqual((await call('/admin/hub/team/search?q=%25%25', { cookie: C })).body.members, [], 'LIKE wildcards are literal');

console.log('roles: ok');
