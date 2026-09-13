/**
 * Self-checks for the paths where a bug is expensive: points arithmetic, the
 * 15-mile rule, the admin lock, and backup/restore.
 *
 * The database queries run against Node's built-in SQLite through a small
 * D1-shaped wrapper, so these are the real queries the Worker uses.
 *
 * No test framework on purpose -- `npm test` is plain node.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeTestDb } from './d1-shim.js';
import {
  getLeaderboard, getStudent, addPointEvent, listOpportunities,
  getOfficers, getCurriculum, getCompetitions, getPuzzles,
  getSetting, setSetting, getAllSettings, exportBackup, restoreBackup,
  upsertMember, getMemberById, getMemberByFeedToken, setMemberPrefs,
  unsubscribeByToken, listDigestRecipients, linkMemberToStudent,
  getCurrentPuzzle, setCurrentPuzzle,
} from '../worker/db.js';
import {
  haversineMiles, milesFromSchool, withinRadius, fingerprintOf, RADIUS_MILES,
} from '../worker/geo.js';
import {
  signSession, verifySession, checkPassword, checkIngestToken, safeEqual,
  signMemberSession, verifyMemberSession, isDistrictDomain, randomToken,
} from '../worker/auth.js';
import { buildDigest } from '../worker/digest.js';
import { parseDevpostDeadline } from '../ingest/sources.js';
import { OPPORTUNITIES, OFFICERS, CURRICULUM, COMPETITIONS, PUZZLES } from '../shared/seed-data.js';
import { opportunitiesToICS } from '../worker/ics.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'worker', 'schema.sql'), 'utf8');
const SEED_SQL = path.join(ROOT, 'worker', 'seed.sql');

const ENV = { ADMIN_PASSWORD: 'test-password', SESSION_SECRET: 'test-secret', INGEST_TOKEN: 'ingest-token' };

const checks = [];
const test = (name, fn) => checks.push([name, fn]);

async function fresh() {
  const db = makeTestDb(SCHEMA);
  await db.prepare("INSERT INTO students (name, grade) VALUES ('Test Student', 11)").run();
  return db;
}

/* ------------------------------ points math ------------------------------ */

test('a total is the sum of its point events', async () => {
  const db = await fresh();
  await addPointEvent(db, { student_id: 1, delta: 30, reason: 'hackathon' });
  await addPointEvent(db, { student_id: 1, delta: 12, reason: 'meeting' });
  assert.equal((await getLeaderboard(db))[0].points, 42);
});

test('a negative delta subtracts', async () => {
  const db = await fresh();
  await addPointEvent(db, { student_id: 1, delta: 50, reason: 'award' });
  await addPointEvent(db, { student_id: 1, delta: -20, reason: 'correction' });
  assert.equal((await getLeaderboard(db))[0].points, 30);
});

test('deleting an event undoes it exactly', async () => {
  const db = await fresh();
  await addPointEvent(db, { student_id: 1, delta: 25, reason: 'keep' });
  const bad = await addPointEvent(db, { student_id: 1, delta: 999, reason: 'mistake' });
  assert.equal((await getLeaderboard(db))[0].points, 1024);
  await db.prepare('DELETE FROM point_events WHERE id = ?').bind(bad).run();
  assert.equal((await getLeaderboard(db))[0].points, 25);
});

test('a student with no events shows zero, not null', async () => {
  assert.equal((await getLeaderboard(await fresh()))[0].points, 0);
});

test('tied students share a rank and the next rank skips', async () => {
  const db = await fresh();
  await db.prepare("INSERT INTO students (name) VALUES ('B')").run();
  await db.prepare("INSERT INTO students (name) VALUES ('C')").run();
  await addPointEvent(db, { student_id: 1, delta: 100, reason: 'x' });
  await addPointEvent(db, { student_id: 2, delta: 100, reason: 'x' });
  await addPointEvent(db, { student_id: 3, delta: 90, reason: 'x' });
  assert.deepEqual((await getLeaderboard(db)).map((s) => s.rank), [1, 1, 3]);
});

test('hidden students stay off the board but keep their points', async () => {
  const db = await fresh();
  await addPointEvent(db, { student_id: 1, delta: 40, reason: 'x' });
  await db.prepare('UPDATE students SET active = 0 WHERE id = 1').run();
  assert.equal((await getLeaderboard(db)).length, 0);
  const kept = await db.prepare('SELECT COUNT(*) AS n FROM point_events').first();
  assert.equal(kept.n, 1);
});

test('deleting a student removes their point events too', async () => {
  const db = await fresh();
  await addPointEvent(db, { student_id: 1, delta: 10, reason: 'x' });
  await db.prepare('DELETE FROM students WHERE id = 1').run();
  const row = await db.prepare('SELECT COUNT(*) AS n FROM point_events').first();
  assert.equal(row.n, 0);
});

test('a profile lists its events newest first', async () => {
  const db = await fresh();
  await addPointEvent(db, { student_id: 1, delta: 5, reason: 'first' });
  await addPointEvent(db, { student_id: 1, delta: 7, reason: 'second' });
  const profile = await getStudent(db, 1);
  assert.equal(profile.events[0].reason, 'second');
  assert.equal(profile.points, 12);
  assert.equal(profile.total_students, 1);
});

test('an unknown student id returns null rather than throwing', async () => {
  assert.equal(await getStudent(await fresh(), 9999), null);
});

/* ------------------------------ distance rule ------------------------------ */

test('haversine matches a known distance', () => {
  // Dallas to Houston is roughly 225 miles.
  const miles = haversineMiles(32.7767, -96.797, 29.7604, -95.3698);
  assert.ok(miles > 215 && miles < 240, `got ${miles}`);
});

test('UT Dallas is inside the radius', () => {
  assert.ok(milesFromSchool(32.9857, -96.7501) < RADIUS_MILES);
});

test('Houston is outside the radius', () => {
  assert.ok(milesFromSchool(29.7604, -95.3698) > RADIUS_MILES);
});

test('a nearby local opportunity is kept with a distance attached', async () => {
  const r = await withinRadius({ format: 'local', lat: 32.9857, lng: -96.7501 });
  assert.equal(r.keep, true);
  assert.ok(r.distance_mi > 0 && r.distance_mi < RADIUS_MILES);
});

test('a far local opportunity is rejected', async () => {
  const r = await withinRadius({ format: 'local', lat: 29.7604, lng: -95.3698 });
  assert.equal(r.keep, false);
});

test('online opportunities bypass the distance check entirely', async () => {
  const r = await withinRadius({ format: 'online', location: 'Anchorage, AK' });
  assert.equal(r.keep, true);
  assert.equal(r.distance_mi, null);
});

test('residential programs bypass the distance check', async () => {
  const r = await withinRadius({ format: 'residential', location: 'Cambridge, MA' });
  assert.equal(r.keep, true);
});

test('an in-person address we cannot locate is flagged, not dropped', async () => {
  const r = await withinRadius(
    { format: 'local', location: 'somewhere unfindable' },
    { geocodeImpl: async () => null }
  );
  assert.equal(r.keep, true);
  assert.equal(r.needs_review, 1);
});

test('the same listing always fingerprints the same, and different ones differ', () => {
  const a = { title: 'Cool  Camp', url: 'https://www.example.com/a' };
  const b = { title: 'cool camp', url: 'https://example.com/a?utm=1' };
  const c = { title: 'Other Camp', url: 'https://example.com/a' };
  assert.equal(fingerprintOf(a), fingerprintOf(b));
  assert.notEqual(fingerprintOf(a), fingerprintOf(c));
});

/* --------------------------------- auth --------------------------------- */

test('a freshly signed session verifies', async () => {
  assert.equal(await verifySession(ENV, await signSession(ENV)), true);
});

test('a tampered session is rejected', async () => {
  const token = await signSession(ENV);
  const [payload, sig] = token.split('.');
  const flipped = sig[0] === 'a' ? 'b' + sig.slice(1) : 'a' + sig.slice(1);
  assert.equal(await verifySession(ENV, `${payload}.${flipped}`), false);
});

test('a session signed with a different secret is rejected', async () => {
  const other = await signSession({ SESSION_SECRET: 'someone-elses-secret' });
  assert.equal(await verifySession(ENV, other), false);
});

test('an expired session is rejected', async () => {
  assert.equal(await verifySession(ENV, await signSession(ENV, Date.now() - 1000)), false);
});

test('garbage is rejected without throwing', async () => {
  for (const bad of [null, '', 'abc', 'a.b', undefined, '12345.deadbeef']) {
    assert.equal(await verifySession(ENV, bad), false);
  }
});

test('the password check accepts only the configured password', () => {
  assert.equal(checkPassword(ENV, 'test-password'), true);
  assert.equal(checkPassword(ENV, 'test-passwore'), false);
  assert.equal(checkPassword(ENV, ''), false);
  assert.equal(checkPassword(ENV, 'test-password-longer'), false);
});

test('with no password configured, nothing gets in', () => {
  assert.equal(checkPassword({}, ''), false);
  assert.equal(checkPassword({}, 'anything'), false);
  assert.equal(checkPassword({ ADMIN_PASSWORD: '' }, ''), false);
});

test('safeEqual compares correctly', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'ab'), false);
  assert.equal(safeEqual(null, undefined), true); // both become ''
});

test('the ingest token is checked, with or without a Bearer prefix', () => {
  assert.equal(checkIngestToken(ENV, 'Bearer ingest-token'), true);
  assert.equal(checkIngestToken(ENV, 'ingest-token'), true);
  assert.equal(checkIngestToken(ENV, 'Bearer wrong'), false);
  assert.equal(checkIngestToken(ENV, undefined), false);
  assert.equal(checkIngestToken({}, 'Bearer anything'), false);
});

/* ------------------------------ member access ----------------------------- */

test('only the exact district domain passes, and only from the hd claim', () => {
  assert.equal(isDistrictDomain('mypisd.net'), true);
  assert.equal(isDistrictDomain('MyPISD.net'), true);
  // The trap an email-suffix check would fall into.
  assert.equal(isDistrictDomain('notmypisd.net'), false);
  assert.equal(isDistrictDomain('mypisd.net.evil.com'), false);
  assert.equal(isDistrictDomain('gmail.com'), false);
  assert.equal(isDistrictDomain(undefined), false);
  assert.equal(isDistrictDomain(null), false);
  assert.equal(isDistrictDomain(''), false);
});

test('a member session round-trips to the member id', async () => {
  assert.equal(await verifyMemberSession(ENV, await signMemberSession(ENV, 7)), 7);
});

test('a member session signed with another secret is rejected', async () => {
  const other = await signMemberSession({ SESSION_SECRET: 'someone-elses-secret' }, 7);
  assert.equal(await verifyMemberSession(ENV, other), null);
});

test('an expired member session is rejected', async () => {
  assert.equal(await verifyMemberSession(ENV, await signMemberSession(ENV, 7, Date.now() - 1000)), null);
});

test('an admin session is not a member session, and vice versa', async () => {
  // Same secret, same signer -- the payload shape is what keeps them apart.
  assert.equal(await verifyMemberSession(ENV, await signSession(ENV)), null);
  assert.equal(await verifySession(ENV, await signMemberSession(ENV, 7)), false);
});

test('member session garbage is rejected without throwing', async () => {
  for (const bad of [null, '', 'abc', 'a.b', undefined, '0:1.deadbeef', '-3:99999999999999.x']) {
    assert.equal(await verifyMemberSession(ENV, bad), null);
  }
});

test('signing in twice is the same member, with the same feed token', async () => {
  const db = await fresh();
  const first = await upsertMember(db, { school_email: 'Kid@MyPISD.net', full_name: 'Kid', tokenFactory: randomToken });
  const again = await upsertMember(db, { school_email: 'kid@mypisd.net', full_name: 'Kid', tokenFactory: randomToken });
  assert.equal(again.id, first.id);
  // Rotating this would silently break an already-subscribed calendar.
  assert.equal(again.feed_token, first.feed_token);
  assert.equal(first.school_email, 'kid@mypisd.net');
});

test('the feed token finds its member, and a wrong one finds nobody', async () => {
  const db = await fresh();
  const m = await upsertMember(db, { school_email: 'kid@mypisd.net', full_name: '', tokenFactory: randomToken });
  assert.equal((await getMemberByFeedToken(db, m.feed_token)).id, m.id);
  assert.ok(!(await getMemberByFeedToken(db, 'not-a-token')));
  assert.ok(!(await getMemberByFeedToken(db, '')));
});

test('unsubscribing by token stops the email and nothing else', async () => {
  const db = await fresh();
  const m = await upsertMember(db, { school_email: 'kid@mypisd.net', full_name: '', tokenFactory: randomToken });
  await setMemberPrefs(db, m.id, { personal_email: 'kid@gmail.com', email_opt_in: true });
  assert.equal((await listDigestRecipients(db)).length, 1);

  await unsubscribeByToken(db, m.unsubscribe_token);
  assert.equal((await listDigestRecipients(db)).length, 0);
  const after = await getMemberById(db, m.id);
  assert.equal(after.personal_email, 'kid@gmail.com');
  assert.equal(after.school_email, 'kid@mypisd.net');
});

test('an opted-in member with no personal address gets nothing', async () => {
  const db = await fresh();
  const m = await upsertMember(db, { school_email: 'kid@mypisd.net', full_name: '', tokenFactory: randomToken });
  await db.prepare('UPDATE members SET email_opt_in = 1 WHERE id = ?').bind(m.id).run();
  assert.equal((await listDigestRecipients(db)).length, 0);
});

test('a member links to a roster student and back to nobody', async () => {
  const db = await fresh();
  const m = await upsertMember(db, { school_email: 'kid@mypisd.net', full_name: '', tokenFactory: randomToken });
  await linkMemberToStudent(db, m.id, 1);
  assert.equal((await getMemberById(db, m.id)).student_id, 1);
  await linkMemberToStudent(db, m.id, null);
  assert.equal((await getMemberById(db, m.id)).student_id, null);
});

test('members are in the backup, so a restore does not orphan sign-ins', async () => {
  const db = await fresh();
  await upsertMember(db, { school_email: 'kid@mypisd.net', full_name: 'Kid', tokenFactory: randomToken });
  const backup = await exportBackup(db);
  assert.equal(backup.data.members.length, 1);
});

/* --------------------------------- digest --------------------------------- */

test('nothing new means no email at all', async () => {
  const db = await fresh();
  assert.equal(await buildDigest(db, new Date().toISOString()), null);
});

test('a new point award is worth an email', async () => {
  const db = await fresh();
  const before = new Date(Date.now() - 60_000).toISOString();
  await addPointEvent(db, { student_id: 1, delta: 5, reason: 'meeting' });
  const digest = await buildDigest(db, before);
  assert.equal(digest.points.length, 1);
  assert.equal(digest.points[0].name, 'Test Student');
});

test('upcoming deadlines alone do not trigger an email', async () => {
  const db = await fresh();
  await db
    .prepare(
      `INSERT INTO opportunities (title, deadline, status, created_at)
       VALUES ('Old listing, deadline soon', date('now', '+3 days'), 'live', '2000-01-01T00:00:00Z')`
    )
    .run();
  // Same deadlines as last week; nagging weekly is how a sender gets muted.
  assert.equal(await buildDigest(db, new Date(Date.now() - 60_000).toISOString()), null);
});

test('a new opportunity brings its close-by deadlines along', async () => {
  const db = await fresh();
  await db
    .prepare(
      `INSERT INTO opportunities (title, deadline, status) VALUES ('New program', date('now', '+3 days'), 'live')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO opportunities (title, deadline, status) VALUES ('Far off', date('now', '+60 days'), 'live')`
    )
    .run();
  const digest = await buildDigest(db, new Date(Date.now() - 60_000).toISOString());
  assert.equal(digest.opportunities.length, 2);
  // Only the one inside the two-week window is listed as closing.
  assert.equal(digest.deadlines.length, 1);
  assert.equal(digest.deadlines[0].title, 'New program');
});

test('a pending opportunity is never emailed out', async () => {
  const db = await fresh();
  await db
    .prepare("INSERT INTO opportunities (title, status) VALUES ('Unreviewed', 'pending')")
    .run();
  assert.equal(await buildDigest(db, new Date(Date.now() - 60_000).toISOString()), null);
});

/* --------------------------- problem of the week --------------------------- */

test('exactly one puzzle is current', async () => {
  const db = await fresh();
  for (const t of ['One', 'Two', 'Three']) {
    await db.prepare("INSERT INTO puzzles (title, prompt, posted_at) VALUES (?, 'p', '2026-01-01')").bind(t).run();
  }
  await setCurrentPuzzle(db, 1);
  await setCurrentPuzzle(db, 3);
  const rows = (await db.prepare('SELECT id FROM puzzles WHERE is_current = 1').all()).results;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 3);
  assert.equal((await getCurrentPuzzle(db)).title, 'Three');
});

test("the current puzzle's answer is redacted until revealed, but its hints are not", async () => {
  const db = await fresh();
  await db
    .prepare(
      `INSERT INTO puzzles (title, prompt, answer, hints, posted_at, revealed, is_current)
       VALUES ('This week', 'p', 'THE ANSWER', 'first nudge
second nudge', '2026-01-01', 0, 1)`
    )
    .run();
  const current = await getCurrentPuzzle(db);
  assert.equal(current.answer, '');
  // Hints exist to help someone stuck this week -- withholding them would
  // defeat the point.
  assert.match(current.hints, /first nudge/);
});

test('no current puzzle is a null, not a crash', async () => {
  assert.equal(await getCurrentPuzzle(await fresh()), null);
});

/* ---------------------------- backup / restore ---------------------------- */

test('a backup round-trips to identical data', async () => {
  const db = makeTestDb(SCHEMA);
  db.exec(fs.readFileSync(SEED_SQL, 'utf8'));
  await addPointEvent(db, { student_id: 1, delta: 77, reason: 'round trip' });
  await setSetting(db, 'club_name', 'Round Trip Club');

  const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
  const before = await getLeaderboard(db);

  const target = makeTestDb(SCHEMA);
  await restoreBackup(target, backup);

  assert.deepEqual(await getLeaderboard(target), before);
  assert.equal(await getSetting(target, 'club_name'), 'Round Trip Club');
});

test('a malformed backup is refused before any data is touched', async () => {
  const db = await fresh();
  await addPointEvent(db, { student_id: 1, delta: 10, reason: 'keep me' });
  await assert.rejects(() => restoreBackup(db, { data: { students: 'not a list' } }));
  await assert.rejects(() => restoreBackup(db, null));
  await assert.rejects(() => restoreBackup(db, { nope: true }));
  assert.equal((await getLeaderboard(db))[0].points, 10, 'existing data survived a bad restore');
});

/* --------------------------------- seed --------------------------------- */

test('the generated seed loads and is idempotent', async () => {
  const db = makeTestDb(SCHEMA);
  const sql = fs.readFileSync(SEED_SQL, 'utf8');
  db.exec(sql);
  const counts = async () => ({
    s: (await db.prepare('SELECT COUNT(*) AS n FROM students').first()).n,
    o: (await db.prepare('SELECT COUNT(*) AS n FROM opportunities').first()).n,
    e: (await db.prepare('SELECT COUNT(*) AS n FROM point_events').first()).n,
  });
  const before = await counts();
  db.exec(sql); // running it twice must not duplicate anything
  assert.deepEqual(await counts(), before);
  assert.ok(before.o > 20, 'ships with a real catalogue');
  assert.ok(before.s >= 10);
});

test('every seeded local opportunity is inside the radius', () => {
  const locals = OPPORTUNITIES.filter((o) => o.format === 'local');
  assert.ok(locals.length > 0);
  for (const o of locals) {
    const miles = milesFromSchool(o.lat, o.lng);
    assert.ok(miles <= RADIUS_MILES, `${o.title} is ${miles.toFixed(1)} mi away`);
  }
});

test('every seeded opportunity has a plausible url and age range', () => {
  for (const o of OPPORTUNITIES) {
    assert.match(o.url, /^https:\/\/\S+\.\S+/, `${o.title} has a bad url`);
    const min = o.age_min ?? 14;
    const max = o.age_max ?? 17;
    assert.ok(min <= max, `${o.title} has an inverted age range`);
    assert.ok(min <= 17 && max >= 14, `${o.title} does not overlap ages 14-17`);
  }
});

test('seeded opportunities only use known types and formats', () => {
  const types = new Set(['internship', 'competition', 'program', 'resource', 'scholarship']);
  const formats = new Set(['online', 'local', 'residential']);
  for (const o of OPPORTUNITIES) {
    assert.ok(types.has(o.type ?? 'program'), `${o.title}: bad type ${o.type}`);
    assert.ok(formats.has(o.format ?? 'online'), `${o.title}: bad format ${o.format}`);
  }
});

test('the live board never includes pending rows', async () => {
  const db = makeTestDb(SCHEMA);
  await db
    .prepare(
      "INSERT INTO opportunities (title, url, status, fingerprint) VALUES ('Live one', 'https://e.com/1', 'live', 'a')"
    )
    .run();
  await db
    .prepare(
      "INSERT INTO opportunities (title, url, status, fingerprint) VALUES ('Pending one', 'https://e.com/2', 'pending', 'b')"
    )
    .run();
  const live = await listOpportunities(db, { status: 'live' });
  assert.equal(live.length, 1);
  assert.equal(live[0].title, 'Live one');
  assert.equal((await listOpportunities(db, { status: 'all' })).length, 2);
});

test('settings read back what was written', async () => {
  const db = makeTestDb(SCHEMA);
  await setSetting(db, 'club_name', 'First');
  await setSetting(db, 'club_name', 'Second'); // upsert, not duplicate
  assert.equal(await getSetting(db, 'club_name'), 'Second');
  assert.equal(await getSetting(db, 'missing', 'fallback'), 'fallback');
  assert.deepEqual(await getAllSettings(db), { club_name: 'Second' });
});

/* -------------------------------- sources -------------------------------- */

test('devpost deadline strings become ISO dates', () => {
  assert.equal(parseDevpostDeadline('Mar 01 - Apr 15, 2026'), '2026-04-15');
  assert.equal(parseDevpostDeadline('Jan 05, 2027'), '2027-01-05');
  assert.equal(parseDevpostDeadline('sometime soon'), null);
  assert.equal(parseDevpostDeadline(null), null);
});

/* ----------------------------- club info pages ---------------------------- */

test('officers come back sorted by sort_order', async () => {
  const db = makeTestDb(SCHEMA);
  await db.prepare("INSERT INTO officers (name, role, sort_order) VALUES ('B', 'Officer', 1)").run();
  await db.prepare("INSERT INTO officers (name, role, sort_order) VALUES ('A', 'President', 0)").run();
  const officers = await getOfficers(db);
  assert.deepEqual(officers.map((o) => o.name), ['A', 'B']);
});

test('curriculum topics are grouped by track and ordered within it', async () => {
  const db = makeTestDb(SCHEMA);
  await db.prepare("INSERT INTO curriculum_topics (track, title, sort_order) VALUES ('spring', 'Graphs', 0)").run();
  await db.prepare("INSERT INTO curriculum_topics (track, title, sort_order) VALUES ('fall', 'Loops', 0)").run();
  const topics = await getCurriculum(db);
  assert.deepEqual(topics.map((t) => t.track), ['fall', 'spring']);
});

test('toggling a topic covered is a plain boolean flip, not a re-insert', async () => {
  const db = makeTestDb(SCHEMA);
  const info = await db
    .prepare("INSERT INTO curriculum_topics (track, title) VALUES ('fall', 'Recursion')")
    .run();
  const id = info.meta.last_row_id;
  await db.prepare('UPDATE curriculum_topics SET covered = 1 WHERE id = ?').bind(id).run();
  const topics = await getCurriculum(db);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].covered, 1);
});

test('competitions come back in sort order', async () => {
  const db = makeTestDb(SCHEMA);
  await db.prepare("INSERT INTO competitions (name, sort_order) VALUES ('UIL', 0)").run();
  await db.prepare("INSERT INTO competitions (name, sort_order) VALUES ('HP CodeWars', 1)").run();
  const list = await getCompetitions(db);
  assert.deepEqual(list.map((c) => c.name), ['UIL', 'HP CodeWars']);
});

test('an unrevealed puzzle never leaks its answer through the public read', async () => {
  const db = makeTestDb(SCHEMA);
  await db
    .prepare(
      "INSERT INTO puzzles (title, prompt, answer, revealed) VALUES ('This week', 'Solve it', 'the secret answer', 0)"
    )
    .run();
  const [puzzle] = await getPuzzles(db);
  assert.equal(puzzle.answer, '');
  assert.equal(puzzle.revealed, 0);
});

test('a revealed puzzle shows its answer', async () => {
  const db = makeTestDb(SCHEMA);
  await db
    .prepare("INSERT INTO puzzles (title, prompt, answer, revealed) VALUES ('Archived', 'Solve it', 'the answer', 1)")
    .run();
  const [puzzle] = await getPuzzles(db);
  assert.equal(puzzle.answer, 'the answer');
});

test('officers, curriculum, competitions, and puzzles are included in a backup', async () => {
  const db = makeTestDb(SCHEMA);
  await db.prepare("INSERT INTO officers (name, role) VALUES ('Test Officer', 'President')").run();
  await db.prepare("INSERT INTO curriculum_topics (track, title) VALUES ('fall', 'Loops')").run();
  await db.prepare("INSERT INTO competitions (name) VALUES ('UIL')").run();
  await db.prepare("INSERT INTO puzzles (title, prompt) VALUES ('Test', 'Solve it')").run();

  const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
  const target = makeTestDb(SCHEMA);
  await restoreBackup(target, backup);

  assert.equal((await getOfficers(target)).length, 1);
  assert.equal((await getCurriculum(target)).length, 1);
  assert.equal((await getCompetitions(target)).length, 1);
  const puzzles = await all_puzzles(target);
  assert.equal(puzzles.length, 1);
});

async function all_puzzles(db) {
  return (await db.prepare('SELECT * FROM puzzles').all()).results;
}

test('the generated seed loads the real officers, curriculum, and competitions once each', async () => {
  const db = makeTestDb(SCHEMA);
  const sql = fs.readFileSync(SEED_SQL, 'utf8');
  db.exec(sql);
  db.exec(sql); // re-running must not duplicate anything

  assert.equal((await getOfficers(db)).length, OFFICERS.length);
  assert.equal((await getCurriculum(db)).length, CURRICULUM.length);
  assert.equal((await getCompetitions(db)).length, COMPETITIONS.length);
  assert.equal((await getPuzzles(db)).length, PUZZLES.length);
});

/* ------------------------------- ICS feed -------------------------------- */

test('a basic ICS feed has the required calendar wrapper and one VEVENT per opportunity', () => {
  const ics = opportunitiesToICS([
    { id: 1, title: 'USACO', org: 'USACO', url: 'https://usaco.org', deadline: '2026-09-01' },
    { id: 2, title: 'CAC', org: 'Congress', url: 'https://cac.gov', deadline: '2026-10-15' },
  ]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal((ics.match(/END:VEVENT/g) || []).length, 2);
  assert.match(ics, /VERSION:2\.0/);
});

test('an all-day deadline is DTSTART;VALUE=DATE with DTEND the following day', () => {
  const ics = opportunitiesToICS([{ id: 1, title: 'X', deadline: '2026-02-28' }]);
  assert.match(ics, /DTSTART;VALUE=DATE:20260228/);
  assert.match(ics, /DTEND;VALUE=DATE:20260301/); // crosses a month boundary correctly
});

test('the UID is stable across two calls for the same opportunity', () => {
  const opp = { id: 42, title: 'X', deadline: '2026-01-01' };
  const a = opportunitiesToICS([opp], { domain: 'example.org' });
  const b = opportunitiesToICS([opp], { domain: 'example.org' });
  const uid = (s) => s.match(/UID:([^\r\n]+)/)[1];
  assert.equal(uid(a), uid(b));
  assert.equal(uid(a), 'opp-42@example.org');
});

test('commas, semicolons, backslashes, and newlines are escaped in text fields', () => {
  const ics = opportunitiesToICS([
    { id: 1, title: 'Fair; Science, Tech\\Eng\nRound 2', org: '', deadline: '2026-01-01' },
  ]);
  // Raw control characters must never appear unescaped in a text value.
  assert.match(ics, /SUMMARY:Deadline: Fair\\; Science\\, Tech\\\\Eng\\nRound 2/);
});

test('a long description is folded at 75 octets with a leading-space continuation', () => {
  const longOrg = 'A'.repeat(120);
  const ics = opportunitiesToICS([{ id: 1, title: 'X', org: longOrg, deadline: '2026-01-01' }]);
  const lines = ics.split('\r\n');
  const descLines = [];
  let capturing = false;
  for (const l of lines) {
    if (l.startsWith('DESCRIPTION:')) capturing = true;
    else if (capturing && !l.startsWith(' ')) break;
    if (capturing) descLines.push(l);
  }
  assert.ok(descLines.length > 1, 'a 120-char line should have folded into more than one line');
  assert.ok(descLines[1].startsWith(' '), 'continuation line must start with a single space');
  // No line (the fold width, not the string length) may exceed 75 octets.
  for (const l of lines) {
    assert.ok(new TextEncoder().encode(l).length <= 75, `line exceeded 75 octets: ${l.slice(0, 20)}...`);
  }
});

test('folding never splits inside a multi-byte UTF-8 character', () => {
  // Emoji are 4 bytes in UTF-8; repeating one past the fold width forces a
  // split decision right at a multi-byte boundary.
  const ics = opportunitiesToICS([{ id: 1, title: '🎉'.repeat(30), deadline: '2026-01-01' }]);
  // If a split landed mid-character, decoding would have produced U+FFFD.
  assert.ok(!ics.includes('�'), 'a multi-byte character was split mid-sequence');
});

test('opportunities with no URL still produce a valid event, just without a URL line', () => {
  const ics = opportunitiesToICS([{ id: 1, title: 'No link', org: 'Somewhere', deadline: '2026-01-01' }]);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.doesNotMatch(ics, /\r\nURL:/);
});

test('an empty list produces a structurally valid, empty calendar', () => {
  const ics = opportunitiesToICS([]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n[\s\S]*\r\nEND:VCALENDAR\r\n$/);
  assert.doesNotMatch(ics, /VEVENT/);
});

/* --------------------------------- run ---------------------------------- */

let passed = 0;
let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
