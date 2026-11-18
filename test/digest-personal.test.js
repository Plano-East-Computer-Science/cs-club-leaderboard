/**
 * F3: the personal weekly email. The personal section is built without sending
 * anything; the run sends one message per address, account holders get their
 * own section inside it, unsubscribed addresses get nothing, and member-written
 * text is escaped.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import { buildPersonal, personalContext, runDigest } from '../worker/digest.js';
import { seasonOf } from '../shared/points.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

const db = makeTestDb(SCHEMA);
const season = seasonOf(new Date());
const INJECT = '<img src=x onerror=alert(1)>';

const student = async (name) => (await db.prepare('INSERT INTO students (name) VALUES (?)').bind(name).run()).meta.last_row_id;
const user = async (email, name, sid) =>
  (await db.prepare('INSERT INTO users (email, name, student_id) VALUES (?, ?, ?)').bind(email, name, sid).run()).meta.last_row_id;
const sub = (email, confirmed = 1) =>
  db.prepare('INSERT INTO subscribers (email, confirmed, confirm_token, unsubscribe_token) VALUES (?, ?, ?, ?)').bind(email, confirmed, `c-${email}`, `u-${email}`).run();
const act = (sid, kind, title, status = 'approved', points = 10) =>
  db
    .prepare(`INSERT INTO activity (student_id, kind, ref, meta, status, points, decided_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
    .bind(sid, kind, `${kind}:${title}`, JSON.stringify({ title }), status, points)
    .run();

const maya = await student('Maya Rivera');
const sam = await student('Sam Lee');
const lena = await student('Lena Park');
const quin = await student('Quin Ortiz');
await user('maya@example.com', 'Maya Rivera', maya);
await user('sam@example.com', 'Sam Lee', sam);
await user('lena@example.com', 'Lena Park', lena);
await user('quin@example.com', 'Quin Ortiz', quin);

const squadId = (await db.prepare('INSERT INTO squads (season, name) VALUES (?, ?)').bind(season, `Squad ${INJECT}`).run()).meta.last_row_id;
for (const s of [maya, sam]) await db.prepare('INSERT INTO squad_members (squad_id, student_id, season) VALUES (?, ?, ?)').bind(squadId, s, season).run();

await act(maya, 'compete', `Contest ${INJECT}`);
await act(maya, 'attend', 'Build night');
await act(maya, 'place', 'PENDING-PLACE', 'pending');
await act(maya, 'ship', 'REJECTED-SHIP', 'rejected');
await act(sam, 'attend', 'Build night');
await act(lena, 'attend', 'Build night');
// a point event so the club-wide digest has something to report
await db.prepare(`INSERT INTO point_events (student_id, delta, reason) VALUES (?, 10, 'attendance')`).bind(maya).run();

const since = '2000-01-01T00:00:00Z';
const ctx = await personalContext(db, since);

await check('the personal block lists only what the member did, approved only', () => {
  const p = buildPersonal(ctx, { name: 'Maya Rivera', student_id: maya });
  assert.equal(p.first, 'Maya');
  assert.equal(p.did.length, 2);
  assert.equal(p.total, 20);
  const all = JSON.stringify(p);
  assert.ok(!all.includes('PENDING-PLACE') && !all.includes('REJECTED-SHIP'));
});

await check('the squad part reports place and what teammates did, not who', () => {
  const p = buildPersonal(ctx, { name: 'Maya Rivera', student_id: maya });
  assert.equal(p.squad.place, 1);
  assert.equal(p.squad.of, 1);
  assert.equal(p.squad.teammateActivity, 1); // Sam's one row; Lena is in no squad
  assert.ok(!JSON.stringify(p).includes('Sam'));
  assert.equal(buildPersonal(ctx, { name: 'Lena Park', student_id: lena }).squad, undefined);
});

await check('a member with no activity gets an empty block, not a crash', () => {
  const p = buildPersonal(ctx, { name: 'Quin Ortiz', student_id: quin });
  assert.deepEqual(p.did, []);
  assert.equal(p.total, 0);
});

// Capture what would be sent. Nothing leaves the process.
const sent = [];
globalThis.fetch = async (_url, init) => {
  sent.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
};
const env = { DB: db, RESEND_API_KEY: 'k', MAIL_FROM: 'club@test.example', SITE_ORIGIN: 'https://club.test' };

await sub('maya@example.com');
await sub('Maya@Example.com'); // the same person typed differently
await sub('sam@example.com', 0); // unsubscribed
await sub('plain@example.com'); // no account
await sub('lena@example.com');

await check('one message per person: an account holder gets a personal one, never two', async () => {
  const r = await runDigest(env);
  assert.equal(r.failed.length, 0);
  const to = sent.map((m) => m.to[0].toLowerCase()).sort();
  assert.deepEqual(to, ['lena@example.com', 'maya@example.com', 'plain@example.com']);
  const maya1 = sent.find((m) => m.to[0].toLowerCase() === 'maya@example.com');
  assert.match(maya1.text, /YOUR WEEK, MAYA/);
  assert.match(maya1.subject, /your week/);
  const plain = sent.find((m) => m.to[0] === 'plain@example.com');
  assert.ok(!/YOUR WEEK/.test(plain.text) && !/Your week/.test(plain.html)); // plain subscribers keep the existing digest
});

await check('an unsubscribed address gets nothing, even with an account', () => {
  assert.ok(!sent.some((m) => m.to[0].toLowerCase() === 'sam@example.com'));
});

await check('member-written text is escaped in the HTML, and carries a one-click unsubscribe', () => {
  const m = sent.find((x) => x.to[0].toLowerCase() === 'maya@example.com');
  assert.ok(!m.html.includes(INJECT));
  assert.ok(m.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(m.headers['List-Unsubscribe']);
});

await check('a second run the same week sends nothing more', async () => {
  const before = sent.length;
  const r = await runDigest(env);
  assert.equal(r.sent, 0);
  assert.equal(sent.length, before);
});

console.log(`digest-personal: ${passed} checks passed`);
