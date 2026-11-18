/**
 * A1-A3: point rules and caps, seasons, the ledger's idempotency and payout,
 * self-approval, merges, and the A1 auto-created leaderboard entry.
 * Runs the real SQL against node:sqlite through test/d1-shim.js.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeTestDb } from './d1-shim.js';
import { POINT_RULES, pointsFor, seasonOf, cleanRules, rulesFrom } from '../shared/points.js';
import { recordActivity, approveActivity, rejectActivity, mergeStudents, LedgerError } from '../worker/hub/ledger.js';
import { ensureStudent } from '../worker/hub/users.js';
import { awardAttendance } from '../worker/hub/rooms.js';
import { cleanProof } from '../worker/hub/claims.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'worker', 'schema.sql'), 'utf8');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

const h = (kind, at, points = 1) => ({ kind, at, points });

/* --------------------------------- rules --------------------------------- */

await check('seasons are semesters; June and July count toward fall', () => {
  assert.equal(seasonOf('2026-08-01 00:00:00'), '2026-fall');
  assert.equal(seasonOf('2026-12-31 23:59:59'), '2026-fall');
  assert.equal(seasonOf('2027-01-01 00:00:00'), '2027-spring');
  assert.equal(seasonOf('2027-05-31 23:59:59'), '2027-spring');
  assert.equal(seasonOf('2027-06-01 00:00:00'), '2027-fall');
  assert.equal(seasonOf(new Date('2027-07-15T12:00:00Z')), '2027-fall');
});

await check('attend: double for the first three meetings, one per day', () => {
  const at = '2026-11-10 21:00:00';
  assert.equal(pointsFor('attend', {}, [], POINT_RULES, at), 20);
  const three = [h('attend', '2026-11-01 21:00:00', 20), h('attend', '2026-11-03 21:00:00', 20), h('attend', '2026-11-05 21:00:00', 20)];
  assert.equal(pointsFor('attend', {}, three, POINT_RULES, at), 10);
  assert.equal(pointsFor('attend', {}, [...three, h('attend', '2026-11-10 15:00:00', 10)], POINT_RULES, at), 0);
});

await check('compete caps at 4 a season and resets the next season', () => {
  const four = ['09-01', '09-10', '10-01', '11-01'].map((d) => h('compete', `2026-${d} 12:00:00`, 15));
  assert.equal(pointsFor('compete', {}, four.slice(0, 3), POINT_RULES, '2026-12-01 12:00:00'), 15);
  assert.equal(pointsFor('compete', {}, four, POINT_RULES, '2026-12-01 12:00:00'), 0);
  assert.equal(pointsFor('compete', {}, four, POINT_RULES, '2027-01-15 12:00:00'), 15);
});

await check('place is capped at 50 points a season, partially paying the last one', () => {
  assert.equal(pointsFor('place', {}, [], POINT_RULES, '2026-10-01 12:00:00'), 25);
  assert.equal(pointsFor('place', {}, [h('place', '2026-09-01 12:00:00', 25), h('place', '2026-09-02 12:00:00', 20)], POINT_RULES, '2026-10-01 12:00:00'), 5);
  assert.equal(pointsFor('place', {}, [h('place', '2026-09-01 12:00:00', 50)], POINT_RULES, '2026-10-01 12:00:00'), 0);
});

await check('ship 2 a season, solve 10 a week (weeks start Monday)', () => {
  const ships = [h('ship', '2026-09-01 12:00:00', 30), h('ship', '2026-10-01 12:00:00', 30)];
  assert.equal(pointsFor('ship', {}, ships, POINT_RULES, '2026-11-01 12:00:00'), 0);
  // 2026-11-16 is a Monday.
  const ten = Array.from({ length: 10 }, () => h('solve', '2026-11-16 10:00:00'));
  assert.equal(pointsFor('solve', {}, ten, POINT_RULES, '2026-11-22 23:00:00'), 0); // Sunday, same week
  assert.equal(pointsFor('solve', {}, ten, POINT_RULES, '2026-11-23 00:30:00'), 1); // next Monday
});

await check('manual uses meta.points; unknown kinds pay nothing', () => {
  assert.equal(pointsFor('manual', { points: -5 }, [], POINT_RULES), -5);
  assert.equal(pointsFor('bogus', {}, []), 0);
});

await check('officer overrides merge over defaults and are validated', () => {
  const r = rulesFrom(JSON.stringify({ attend: { points: 5 }, compete: { approval: false } }));
  assert.equal(r.attend.points, 5);
  assert.equal(r.attend.perDay, 1);
  assert.equal(r.compete.approval, false);
  assert.deepEqual(rulesFrom('not json'), rulesFrom({}));
  assert.ok(cleanRules({ hack: {} }).error);
  assert.ok(cleanRules({ attend: { points: -1 } }).error);
  assert.ok(cleanRules({ attend: { points: 1.5 } }).error);
  assert.ok(cleanRules({ attend: { approval: 'yes' } }).error);
  assert.ok(cleanRules({ attend: { owner: 1 } }).error);
  assert.ok(cleanRules([]).error);
});

await check('proof links must be https', () => {
  assert.equal(cleanProof('').url, '');
  assert.equal(cleanProof('https://example.com/x').url, 'https://example.com/x');
  assert.ok(cleanProof('http://example.com').error);
  assert.ok(cleanProof('javascript:alert(1)').error);
  assert.ok(cleanProof('nope').error);
});

/* --------------------------------- ledger -------------------------------- */

function freshDb() {
  const db = makeTestDb(SCHEMA);
  db.exec(`INSERT INTO students (id, name) VALUES (1, 'Ada Lovelace'), (2, 'Grace Hopper'), (3, 'Ada L')`);
  return db;
}
const count = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).first()).n;
const officer = { userId: null, name: 'shared login', role: 'lead' };

await check('auto-approved activity writes exactly one traceable point_event; repeats are no-ops', async () => {
  const db = freshDb();
  const a = await recordActivity(db, { studentId: 1, kind: 'attend', ref: 'room:ABCD', meta: { title: 'Week 1' } }, '2026-11-10 21:00:00');
  assert.equal(a.awarded, 20);
  const b = await recordActivity(db, { studentId: 1, kind: 'attend', ref: 'room:ABCD' }, '2026-11-10 21:00:00');
  assert.deepEqual(b, { activityId: a.activityId, awarded: 0, duplicate: true });
  assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM point_events'), 1);
  const act = await db.prepare('SELECT * FROM activity WHERE id = ?').bind(a.activityId).first();
  const ev = await db.prepare('SELECT * FROM point_events WHERE id = ?').bind(act.point_event_id).first();
  assert.equal(act.status, 'approved');
  assert.equal(ev.delta, 20);
  assert.match(ev.reason, /^attend: Week 1/);
});

await check('claims wait for approval; approving twice pays once; reject is final', async () => {
  const db = freshDb();
  const r = await recordActivity(db, { studentId: 2, kind: 'compete', ref: 'opp:1', meta: { title: 'USACO' } });
  assert.equal(r.awarded, 0);
  assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM point_events'), 0);
  const ok = await approveActivity(db, r.activityId, officer);
  assert.equal(ok.awarded, 15);
  await assert.rejects(approveActivity(db, r.activityId, officer), (e) => e instanceof LedgerError && e.status === 409);
  assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM point_events'), 1);
  const row = await db.prepare('SELECT decided_name, decided_by FROM activity WHERE id = ?').bind(r.activityId).first();
  assert.deepEqual(row, { decided_name: 'shared login', decided_by: null });

  const x = await recordActivity(db, { studentId: 2, kind: 'ship', ref: 'self:thing', meta: { title: 'Thing' } });
  await rejectActivity(db, x.activityId, officer, 'No demo yet');
  await assert.rejects(approveActivity(db, x.activityId, officer), /already rejected/);
  assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM point_events'), 1);
});

await check('an officer cannot approve a claim for their own linked entry', async () => {
  const db = freshDb();
  db.exec(`INSERT INTO users (id, email, name, student_id) VALUES (7, 'o@x.com', 'Officer', 2)`);
  const r = await recordActivity(db, { studentId: 2, kind: 'place', ref: 'comp:1', meta: { title: 'UIL' } });
  await assert.rejects(approveActivity(db, r.activityId, { userId: 7, name: 'Officer', role: 'officer' }), (e) => e.status === 403);
  assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM point_events'), 0);
  // Someone else's claim is fine.
  const s = await recordActivity(db, { studentId: 1, kind: 'place', ref: 'comp:1', meta: { title: 'UIL' } });
  assert.equal((await approveActivity(db, s.activityId, { userId: 7, name: 'Officer', role: 'officer' })).awarded, 25);
});

await check('caps hold through the ledger: one attendance per day across rooms', async () => {
  const db = freshDb();
  await recordActivity(db, { studentId: 1, kind: 'attend', ref: 'room:AAAA' }, '2026-11-10 20:00:00');
  const second = await recordActivity(db, { studentId: 1, kind: 'attend', ref: 'room:BBBB' }, '2026-11-10 22:00:00');
  assert.equal(second.awarded, 0);
  assert.equal(await count(db, 'SELECT COALESCE(SUM(delta), 0) AS n FROM point_events WHERE student_id = 1'), 20);
});

/* ---------------------------------- A1 ----------------------------------- */

await check('a new account gets its own leaderboard entry, once', async () => {
  const db = freshDb();
  db.exec(`INSERT INTO users (id, email, name) VALUES (10, 'new@x.com', 'Newbie Person')`);
  const user = await db.prepare('SELECT * FROM users WHERE id = 10').first();
  const sid = await ensureStudent(db, user);
  assert.ok(sid);
  assert.equal(await ensureStudent(db, user), sid); // stale row (student_id null) does not make a second one
  assert.equal(await count(db, `SELECT COUNT(*) AS n FROM students WHERE name = 'Newbie Person'`), 1);
});

await check('an account with an open link request is left for the officer to link', async () => {
  const db = freshDb();
  db.exec(`INSERT INTO users (id, email, name) VALUES (11, 'old@x.com', 'Old'); INSERT INTO link_requests (user_id, student_id) VALUES (11, 3)`);
  assert.equal(await ensureStudent(db, await db.prepare('SELECT * FROM users WHERE id = 11').first()), null);
});

await check('closing a room pays a brand-new account with no officer action, and re-running is idempotent', async () => {
  const db = freshDb();
  db.exec(`INSERT INTO users (id, email, name) VALUES (12, 'a@x.com', 'Fresh Face');
           INSERT INTO rooms (code, title) VALUES ('WXYZ', 'Week 3');
           INSERT INTO room_checkins (code, user_id, joined_at) VALUES ('WXYZ', 12, '2026-11-12 21:00:00')`);
  assert.deepEqual(await awardAttendance(db, 'WXYZ'), { awarded: 1, alreadyHad: 0, unlinked: 0 });
  assert.deepEqual(await awardAttendance(db, 'WXYZ'), { awarded: 0, alreadyHad: 1, unlinked: 0 });
  const sid = (await db.prepare('SELECT student_id FROM users WHERE id = 12').first()).student_id;
  // 20 for attending (doubled, first meeting) + 3 for the "In the room" quest bonus (A4).
  assert.equal(await count(db, 'SELECT SUM(delta) AS n FROM point_events WHERE student_id = ?', sid), 23);
});

await check('merge moves points, activity, badges and accounts, drops shared activity, deactivates', async () => {
  const db = freshDb();
  db.exec(`INSERT INTO badges (id, name) VALUES (1, 'First'), (2, 'Second');
           INSERT INTO student_badges (student_id, badge_id) VALUES (1, 1), (3, 1), (3, 2);
           INSERT INTO users (id, email, name, student_id) VALUES (20, 'ada@x.com', 'Ada', 3);
           INSERT INTO point_events (student_id, delta, reason) VALUES (3, 7, 'manual old')`);
  await recordActivity(db, { studentId: 1, kind: 'attend', ref: 'room:SAME' }, '2026-11-10 21:00:00');
  await recordActivity(db, { studentId: 3, kind: 'attend', ref: 'room:SAME' }, '2026-11-10 21:00:00');
  await recordActivity(db, { studentId: 3, kind: 'attend', ref: 'room:ONLY' }, '2026-11-11 21:00:00');
  await mergeStudents(db, 1, 3);
  assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM point_events WHERE student_id = 3'), 0);
  assert.equal(await count(db, 'SELECT SUM(delta) AS n FROM point_events WHERE student_id = 1'), 20 + 20 + 7);
  assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM activity WHERE student_id = 1'), 2);
  assert.equal(await count(db, 'SELECT COUNT(*) AS n FROM student_badges WHERE student_id = 1'), 2);
  assert.equal((await db.prepare('SELECT student_id FROM users WHERE id = 20').first()).student_id, 1);
  assert.equal((await db.prepare('SELECT active FROM students WHERE id = 3').first()).active, 0);
  await assert.rejects(mergeStudents(db, 1, 1), LedgerError);
  await assert.rejects(mergeStudents(db, 3, 2), /must be active/);
});

console.log(`\n${passed} passed, 0 failed\n`);
