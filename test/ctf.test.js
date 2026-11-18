/**
 * CTF board (C11). Drives the real Worker app against the fake D1: flags never
 * leave the server, guesses are rate limited, nobody approves their own
 * challenge, officer routes are officers only, and a solve pays once.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { resetSeedFlag, scoreboard } from '../worker/hub/ctf.js';
import { STARTERS } from '../worker/hub/ctf-seed.js';
import { exportFor, softDelete, purgeUser } from '../worker/hub/safety.js';
import { validateChallenge, ctfPoints, CATEGORIES } from '../shared/ctf.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;
resetSeedFlag();

const addUser = async (name, role = 'member') =>
  (await db.prepare('INSERT INTO users (email, name, role) VALUES (?, ?, ?)').bind(`${name.toLowerCase()}@example.com`, name, role).run()).meta.last_row_id;
const cookieOf = async (id) => `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}`;
async function call(path, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (method === 'GET') body = undefined;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {}, passThroughOnException() {} });
  const text = await res.text();
  return { status: res.status, text, body: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

/* ------------------------------ pure checks ------------------------------ */

const form = { title: 'Rot13 puzzle', category: 'crypto', difficulty: 1, body: 'Decode the file.', file_data: 'pbqr', hint: '', flag: 'csclub{secret_one}' };
assert.equal(validateChallenge(form).value.file_name, 'challenge.txt', 'a file with no name gets one');
for (const [why, patch] of [
  ['no title', { title: ' ' }], ['bad category', { category: 'pwn' }], ['difficulty 4', { difficulty: 4 }],
  ['empty body', { body: '' }], ['short flag', { flag: 'ab' }], ['huge file', { file_data: 'x'.repeat(20_001) }],
  ['flag in the description', { body: 'The answer is csclub{secret_one}.' }], ['bad file name', { file_name: '../x' }],
]) assert.ok(validateChallenge({ ...form, ...patch }).error, `should reject: ${why}`);
assert.deepEqual([ctfPoints(1), ctfPoints(2), ctfPoints(3)], [50, 100, 200]);
assert.ok(STARTERS.length >= 6 && STARTERS.length <= 10, 'six to ten starter challenges');
for (const s of STARTERS) {
  assert.ok(CATEGORIES.includes(s.category) && /^[0-9a-f]{64}$/.test(s.flag_hash), s.slug);
  assert.ok(!('flag' in s), 'seed carries a hash, not a flag');
}

/* -------------------------------- people --------------------------------- */

const ana = await addUser('Ana Lee', 'officer'); // writes a challenge, then tries to approve it
const ben = await addUser('Ben Ray', 'officer');
const cam = await addUser('Cam Fox');
const dee = await addUser('Dee Kim');
const [A, B, C, D] = await Promise.all([ana, ben, cam, dee].map(cookieOf));

/* ------------------------------- seed + list ------------------------------ */

let r = await call('/ctf');
assert.equal(r.status, 200);
assert.equal(r.body.challenges.length, STARTERS.length, 'starters are seeded on first read');
assert.ok(!/flag_hash|"flag"/.test(r.text), 'the list carries no flag or hash');
const starter = r.body.challenges[0];
r = await call(`/ctf/challenges/${starter.slug}`);
assert.equal(r.status, 200);
assert.ok(r.body.file_data && !/flag_hash|"flag"/.test(r.text), 'detail has the file but no flag or hash');

/* --------------------------- authoring and approval ------------------------- */

const SECRET = 'csclub{only_ana_knows_this_one}';
assert.equal((await call('/ctf/challenges', { method: 'POST', body: { ...form, flag: SECRET } })).status, 401, 'signing in is required to author');
r = await call('/ctf/challenges', { cookie: A, method: 'POST', body: { ...form, flag: SECRET } });
assert.equal(r.status, 201);
const mineId = r.body.id;
assert.ok(!r.text.includes(SECRET), 'creating a challenge does not echo the flag');
const mine = await call('/ctf/mine', { cookie: A });
assert.equal(mine.body.challenges[0].status, 'pending');
assert.ok(!mine.text.includes(SECRET) && !/flag_hash/.test(mine.text), 'the author cannot read the flag back either');

const slug = (await db.prepare('SELECT slug FROM ctf_challenges WHERE id = ?').bind(mineId).first()).slug;
assert.equal((await call(`/ctf/challenges/${slug}`)).status, 404, 'a pending challenge is not public');
assert.ok(!(await call('/ctf')).body.challenges.some((c) => c.slug === slug));
// Three pending at a time, per member.
await call('/ctf/challenges', { cookie: A, method: 'POST', body: { ...form, title: 'Two', flag: 'csclub{b}' } });
await call('/ctf/challenges', { cookie: A, method: 'POST', body: { ...form, title: 'Three', flag: 'csclub{c}' } });
assert.equal((await call('/ctf/challenges', { cookie: A, method: 'POST', body: { ...form, title: 'Four', flag: 'csclub{d}' } })).status, 429);

// Only officers reach the officer routes.
for (const [cookie, label] of [[undefined, 'signed out'], [C, 'a member']]) {
  for (const [path, method] of [['/admin/hub/ctf', 'GET'], [`/admin/hub/ctf/${mineId}/approve`, 'POST'], [`/admin/hub/ctf/${mineId}/reject`, 'POST'], [`/admin/hub/ctf/${mineId}/retire`, 'POST'], [`/admin/hub/ctf/${mineId}/check`, 'POST']]) {
    const x = await call(path, { cookie, method, body: {} });
    assert.equal(x.status, 401, `${label}: ${method} ${path}`);
  }
}
assert.equal((await db.prepare('SELECT status FROM ctf_challenges WHERE id = ?').bind(mineId).first()).status, 'pending');

// An officer reading the queue sees the puzzle but never the flag.
r = await call('/admin/hub/ctf?status=pending', { cookie: B });
assert.equal(r.status, 200);
assert.ok(r.body.challenges.some((c) => c.id === mineId) && !r.text.includes(SECRET) && !/flag_hash/.test(r.text));
assert.equal((await call(`/admin/hub/ctf/${mineId}/check`, { cookie: B, method: 'POST', body: { flag: SECRET } })).body.correct, true);
assert.equal((await call(`/admin/hub/ctf/${mineId}/check`, { cookie: B, method: 'POST', body: { flag: 'nope' } })).body.correct, false);

// Nobody approves their own work, even an officer.
r = await call(`/admin/hub/ctf/${mineId}/approve`, { cookie: A, method: 'POST' });
assert.equal(r.status, 403);
assert.equal((await db.prepare('SELECT status FROM ctf_challenges WHERE id = ?').bind(mineId).first()).status, 'pending');

r = await call(`/admin/hub/ctf/${mineId}/approve`, { cookie: B, method: 'POST' });
assert.equal(r.status, 200);
assert.equal(r.body.awarded, 30, 'an approved challenge counts as one ship');
assert.equal((await call(`/admin/hub/ctf/${mineId}/approve`, { cookie: B, method: 'POST' })).status, 409, 'approving twice is refused');
const ships = (await db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE kind = 'ship' AND ref = ?`).bind(`ctf-author:${mineId}`).first()).n;
assert.equal(ships, 1, 'one ship activity, idempotent by ref');
assert.ok((await call('/ctf')).body.challenges.some((c) => c.slug === slug), 'approved challenges go public');
assert.ok(!(await call('/ctf')).text.includes(SECRET));

/* --------------------------------- solving --------------------------------- */

assert.equal((await call(`/ctf/challenges/${slug}/solve`, { method: 'POST', body: { flag: SECRET } })).status, 401);
assert.equal((await call(`/ctf/challenges/${slug}/solve`, { cookie: A, method: 'POST', body: { flag: SECRET } })).status, 403, 'authors do not score on their own challenge');
r = await call(`/ctf/challenges/${slug}/solve`, { cookie: C, method: 'POST', body: { flag: 'csclub{wrong}' } });
assert.deepEqual(r.body, { correct: false });
r = await call(`/ctf/challenges/${slug}/solve`, { cookie: C, method: 'POST', body: { flag: `  ${SECRET.toUpperCase()} ` } });
assert.equal(r.body.correct, true, 'flags are matched after normalising case and spacing');
assert.equal(r.body.awarded, 1);
assert.ok(!r.text.includes(SECRET));
r = await call(`/ctf/challenges/${slug}/solve`, { cookie: C, method: 'POST', body: { flag: SECRET } });
assert.equal(r.body.already, true);
assert.equal(r.body.awarded, 0, 'a second solve never pays twice');
const camSid = (await db.prepare('SELECT student_id FROM users WHERE id = ?').bind(cam).first()).student_id;
assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE student_id = ? AND kind = 'solve'`).bind(camSid).first()).n, 1);
assert.equal((await call('/ctf', { cookie: C })).body.challenges.find((c) => c.slug === slug).solved, true);

// Guess limit: ten a minute per member, correct or not, and it stops the correct one too.
let last;
for (let i = 0; i < 12; i++) last = await call(`/ctf/challenges/${starter.slug}/solve`, { cookie: D, method: 'POST', body: { flag: `csclub{guess_${i}}` } });
assert.equal(last.status, 429, 'the eleventh guess in a minute is refused');
assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM rate_hits WHERE key = ?`).bind(`ctf:${dee}`).first()).n, 10);
assert.equal((await call(`/ctf/challenges/${slug}/solve`, { cookie: D, method: 'POST', body: { flag: SECRET } })).status, 429, 'a right answer does not bypass the limit');
assert.equal((await call(`/ctf/challenges/${slug}/solve`, { cookie: C, method: 'POST', body: { flag: SECRET } })).status, 200, 'other members are unaffected');

/* ------------------------- scoreboard and events -------------------------- */

const camStudent = camSid;
const season = (await import('../shared/points.js')).seasonOf(new Date());
const sq = (await db.prepare('INSERT INTO squads (season, name) VALUES (?, ?)').bind(season, 'Falcons').run()).meta.last_row_id;
await db.prepare('INSERT INTO squad_members (squad_id, student_id, season) VALUES (?, ?, ?)').bind(sq, camStudent, season).run();
r = await call('/ctf/scoreboard');
assert.deepEqual(r.body.solo, [{ place: 1, name: 'Cam', solves: 1, score: 50 }], 'first names only');
assert.deepEqual(r.body.squads.map((s) => [s.name, s.score]), [['Falcons', 50]]);
assert.ok(!/@|example\.com/.test(r.text));
assert.equal((await scoreboard(db)).solo.length, 1);

await db.prepare(`INSERT INTO opportunities (title, url, source, status, deadline) VALUES ('Future CTF', 'https://ctftime.org/event/1', 'ctftime', 'live', date('now', '+5 days'))`).run();
await db.prepare(`INSERT INTO opportunities (title, url, source, status, deadline) VALUES ('Old CTF', 'https://ctftime.org/event/2', 'ctftime', 'live', date('now', '-5 days'))`).run();
await db.prepare(`INSERT INTO opportunities (title, url, source, status, deadline) VALUES ('Pending CTF', 'https://ctftime.org/event/3', 'ctftime', 'pending', date('now', '+5 days'))`).run();
assert.deepEqual((await call('/ctf')).body.events.map((e) => e.title), ['Future CTF'], 'only live, upcoming CTFtime rows');

/* ----------------------- export, deletion, and rejection ------------------- */

const cUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(cam).first();
const exp = await exportFor(db, cUser);
assert.equal(exp.ctf_solves.length, 1);
const aUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(ana).first();
const aExp = await exportFor(db, aUser);
assert.equal(aExp.ctf_challenges_written.length, 3);
assert.ok(!JSON.stringify(aExp).includes('flag_hash'), 'the export carries no flag hash');

await softDelete(db, cUser, false);
assert.ok(await purgeUser(db, cam));
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM ctf_solves WHERE user_id = ?').bind(cam).first()).n, 0);
await softDelete(db, aUser, true);
assert.ok(await purgeUser(db, ana));
const left = await db.prepare('SELECT status, author_user_id, author_name FROM ctf_challenges WHERE id = ?').bind(mineId).first();
assert.deepEqual(left, { status: 'live', author_user_id: null, author_name: 'Former member' }, 'an approved challenge outlives its author, anonymised');
assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ctf_challenges WHERE author_name = 'Former member'`).first()).n, 1, 'unapproved ones are deleted with the account');

const eve = await addUser('Eve Poe');
const E = await cookieOf(eve);
const rej = (await call('/ctf/challenges', { cookie: E, method: 'POST', body: { ...form, title: 'Weak one', flag: 'csclub{weak}' } })).body.id;
assert.equal((await call(`/admin/hub/ctf/${rej}/reject`, { cookie: B, method: 'POST', body: { reason: 'Too easy to guess' } })).status, 200);
assert.equal((await call('/ctf/mine', { cookie: E })).body.challenges[0].reject_reason, 'Too easy to guess');

console.log('ctf: all checks passed');
