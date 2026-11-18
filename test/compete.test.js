/**
 * E2 saved opportunities, E4 competition pages, G2 officer analytics.
 * Drives the real Worker app against the fake D1 (same pattern as roles.test.js),
 * plus pure checks for the retention and not-seen maths.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { validateResults, ordinal } from '../worker/hub/compete.js';
import { retention, notSeen, seasonRange, byTemplate } from '../worker/hub/analytics.js';
import { seasonOf } from '../shared/points.js';
import { myDeadlines } from '../worker/digest.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

async function addUser(name, role = 'member') {
  const email = `${name.split(" ")[0].toLowerCase()}@example.com`;
  const sid = (await db.prepare('INSERT INTO students (name) VALUES (?)').bind(name).run()).meta.last_row_id;
  const r = await db.prepare('INSERT INTO users (email, name, role, student_id) VALUES (?, ?, ?, ?)').bind(email, name, role, sid).run();
  return { id: r.meta.last_row_id, sid };
}
const cookie = async (u) => `${USER_COOKIE}=${await signValue(env, `${u.id}:${Date.now() + 60_000}`)}`;
async function call(path, { as, method = 'GET', body } = {}) {
  const headers = {};
  if (as) headers.Cookie = await cookie(as);
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(
    new Request(`https://club.test/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    env,
    { waitUntil() {}, passThroughOnException() {} }
  );
  return { status: res.status, body: await res.json().catch(() => null) };
}
const pts = async (sid) => (await db.prepare('SELECT COALESCE(SUM(delta), 0) AS n FROM point_events WHERE student_id = ?').bind(sid).first()).n;
const acts = async (sid) => (await db.prepare('SELECT kind, status, meta FROM activity WHERE student_id = ? ORDER BY id').bind(sid).all()).results;

const ana = await addUser('Ana Lopez');
const ben = await addUser('Ben Ito');
const cam = await addUser('Cam Ray');
const off = await addUser('Olive Officer', 'officer'); // an officer who is also on the roster
const off2 = await addUser('Omar Officer', 'officer');
await db.exec(`INSERT INTO competitions (id, name, description, status) VALUES (1, 'HP CodeWars', 'One day.', 'upcoming')`);

/* ---------------------------------- pure ---------------------------------- */

await check('placement validation', () => {
  const roster = [1, 2];
  const bad = (rows) => assert.ok(validateResults(rows, roster).error, JSON.stringify(rows));
  bad([]);
  bad([{ userId: 3, participated: true }]); // not on the roster
  bad([{ userId: 1, participated: true }, { userId: 1, participated: true }]);
  bad([{ userId: 1, placement: 0 }]);
  bad([{ userId: 1, placement: 1.5 }]);
  bad([{ userId: 1, placement: 'first' }]);
  bad([{ userId: 1, placement: 1000 }]);
  bad([{ userId: 1, participated: false }, { userId: 2 }]); // nobody took part
  const ok = validateResults([{ userId: 1, placement: '2' }, { userId: 2, participated: true, placement: '' }], roster);
  assert.deepEqual(ok.rows, [
    { userId: 1, placement: 2, participated: true }, // a placement implies taking part
    { userId: 2, placement: null, participated: true },
  ]);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 112].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '112th']);
});

const at = (s) => new Date(`${s}T15:00:00Z`);
const m = (date, ...userIds) => ({ date, userIds });

await check('seasonRange agrees with seasonOf', () => {
  assert.deepEqual(seasonRange('2026-fall'), { start: '2026-06-01', end: '2027-01-01' });
  assert.deepEqual(seasonRange('2027-spring'), { start: '2027-01-01', end: '2027-06-01' });
  assert.equal(seasonRange('fall'), null);
  assert.equal(seasonOf('2026-12-31 10:00:00'), '2026-fall');
});

await check('attendance by template answers "did duel night work?"', () => {
  const t = byTemplate([
    { template: 'duel', kind: 'meeting', n: 12 },
    { template: 'duel', kind: 'meeting', n: 9 },
    { template: 'build', kind: 'meeting', n: 8 },
    { template: '', kind: 'dropin', n: 3 },
    { template: '', kind: 'meeting', n: 6 },
  ]);
  assert.deepEqual(t.map((x) => [x.name, x.meetings, x.avg]), [['Duel night', 2, 10.5], ['Build night', 1, 8], ['No template', 1, 6], ['Drop-in', 1, 3]]);
});

await check('retention: first month vs last four weeks', () => {
  const ms = [
    m('2026-09-01', 1, 2, 3, 4),
    m('2026-09-20', 5), // still inside the first 30 days
    m('2026-10-01', 9), // day 30: outside the first month
    m('2026-11-05', 1, 2, 9),
    m('2026-11-12', 5, 7),
  ];
  const r = retention(ms, at('2026-11-17'));
  assert.equal(r.base, 5); // 1,2,3,4,5
  assert.equal(r.kept, 3); // 1,2,5 came back; 9 and 7 are not in the base
  assert.equal(r.pct, 60);
  assert.equal(r.firstMeeting, '2026-09-01');
  assert.equal(r.recentFrom, '2026-10-20');
  assert.equal(r.overlap, false);
  // Exactly 28 days back is inside the window, 29 is not.
  assert.equal(retention([m('2026-09-01', 1), m('2026-10-20', 1)], at('2026-11-17')).kept, 1);
  assert.equal(retention([m('2026-09-01', 1), m('2026-10-19', 1)], at('2026-11-17')).kept, 0);
  assert.equal(retention([], at('2026-11-17')).pct, null);
  assert.equal(retention([m('2026-11-10', 1)], at('2026-11-17')).overlap, true);
});

await check('not seen in 3 weeks: the 21 day edge, ordering, time of day', () => {
  const last = [
    { userId: 1, name: 'Edge', last: '2026-10-27 23:59:59' }, // 21 days before the 17th: counts
    { userId: 2, name: 'Almost', last: '2026-10-28 00:00:00' }, // 20 days: does not
    { userId: 3, name: 'Gone', last: '2026-09-02 15:00:00' },
    { userId: 4, name: 'Today', last: '2026-11-17 08:00:00' },
  ];
  const r = notSeen(last, new Date('2026-11-17T00:00:01Z'));
  assert.deepEqual(r.map((x) => [x.name, x.days, x.last]), [['Gone', 76, '2026-09-02'], ['Edge', 21, '2026-10-27']]);
  assert.deepEqual(notSeen([], new Date()), []);
});

/* ------------------------------- competitions ------------------------------ */

await check('roster: sign-in required, join once, leave, names only for members', async () => {
  assert.equal((await call('/competitions/1/roster', { method: 'POST' })).status, 401);
  assert.equal((await call('/competitions/99/roster', { method: 'POST', as: ana })).status, 404);
  for (const u of [ana, ben, cam, off]) assert.equal((await call('/competitions/1/roster', { method: 'POST', as: u })).status, 200);
  assert.equal((await call('/competitions/1/roster', { method: 'POST', as: ana })).status, 200); // a second tap is harmless
  const anon = (await call('/competitions/1')).body;
  assert.equal(anon.roster.count, 4);
  assert.deepEqual(anon.roster.members, []);
  const me = (await call('/competitions/1', { as: ana })).body;
  assert.equal(me.roster.mine, true);
  assert.deepEqual(me.roster.members.map((x) => x.name), ['Ana', 'Ben', 'Cam', 'Olive']);
  assert.equal((await call('/competitions/1/roster', { method: 'DELETE', as: cam })).status, 200);
  assert.equal((await call('/competitions/1')).body.roster.count, 3);
  assert.equal((await call('/competitions/1/roster', { method: 'POST', as: cam })).status, 200);
});

await check('results are officer-only and reject bad input', async () => {
  const row = { userId: ana.id, participated: true };
  assert.equal((await call('/admin/hub/competitions/1/results', { method: 'POST', body: { results: [row] } })).status, 401);
  assert.equal((await call('/admin/hub/competitions/1/results', { method: 'POST', as: ana, body: { results: [row] } })).status, 401);
  const r = await call('/admin/hub/competitions/1/results', { method: 'POST', as: off2, body: { results: [{ userId: ana.id, placement: 0 }] } });
  assert.equal(r.status, 400);
  assert.equal(await pts(ana.sid), 0);
});

await check('results write compete and place once, approved by the officer', async () => {
  const body = { result: '2nd place team', results: [
    { userId: ana.id, participated: true, placement: 2 },
    { userId: ben.id, participated: true },
    { userId: cam.id, participated: false },
  ] };
  const r = await call('/admin/hub/competitions/1/results', { method: 'POST', as: off2, body });
  assert.equal(r.status, 200);
  assert.equal(r.body.compete, 2);
  assert.equal(r.body.place, 1);
  assert.equal(r.body.points, 15 + 15 + 25);
  assert.deepEqual((await acts(ana.sid)).map((a) => [a.kind, a.status]), [['compete', 'approved'], ['place', 'approved']]);
  assert.equal(JSON.parse((await acts(ana.sid))[1].meta).placement, 2);
  assert.deepEqual((await acts(ben.sid)).map((a) => a.kind), ['compete']);
  assert.deepEqual(await acts(cam.sid), []);
  assert.equal(await pts(ana.sid), 40);
  const who = (await db.prepare(`SELECT decided_by FROM activity WHERE student_id = ? AND kind = 'compete'`).bind(ana.sid).first()).decided_by;
  assert.equal(who, off2.id);
  assert.equal((await db.prepare('SELECT status, result FROM competitions WHERE id = 1').first()).status, 'past');

  // Saving the same form again pays nothing more.
  const again = await call('/admin/hub/competitions/1/results', { method: 'POST', as: off2, body });
  assert.equal(again.body.points, 0);
  assert.equal(again.body.already, 3);
  assert.equal(await pts(ana.sid), 40);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE ref = 'comp:1'`).first()).n, 3);
});

await check('the roster closes once results are in', async () => {
  assert.equal((await call('/competitions/1/roster', { method: 'DELETE', as: ana })).status, 409);
  assert.equal((await call('/competitions/1/roster', { method: 'POST', as: off2 })).status, 409);
  const page = (await call('/competitions/1', { as: ben })).body;
  assert.equal(page.roster.members[0].name, 'Ana'); // placers first
  assert.equal(page.roster.members[0].placement, 2);
});

await check('an officer on the roster cannot approve their own points', async () => {
  await db.exec(`INSERT INTO competitions (id, name) VALUES (2, 'UIL')`);
  await call('/competitions/2/roster', { method: 'POST', as: off });
  await call('/competitions/2/roster', { method: 'POST', as: ben });
  const r = await call('/admin/hub/competitions/2/results', { method: 'POST', as: off, body: { results: [{ userId: off.id, participated: true }, { userId: ben.id, participated: true }] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.compete, 1);
  assert.equal(r.body.held.length, 1);
  assert.deepEqual((await acts(off.sid)).map((a) => a.status), ['pending']); // waits for another officer
  assert.equal(await pts(off.sid), 0);
});

await check('prep plan: officer sets rungs and problems, public page shows live ones', async () => {
  await db.exec(`INSERT INTO rungs (id, track, tier, title, url) VALUES (1, 'contest', 'bronze', 'Simulation basics', 'https://example.com/a'), (2, 'contest', 'bronze', 'Hidden one', 'https://example.com/b');
    UPDATE rungs SET hidden = 1 WHERE id = 2;
    INSERT INTO problems (id, slug, title, status) VALUES (1, 'two-sum', 'Two sum', 'live'), (2, 'draft-one', 'Draft', 'draft');
    INSERT INTO rung_progress (user_id, rung_id, status) VALUES (${ana.id}, 1, 'done')`);
  const put = (as, body) => call('/admin/hub/competitions/1/prep', { method: 'PUT', as, body });
  assert.equal((await put(ana, { rungs: [1], problems: [] })).status, 401);
  assert.equal((await put(off2, { rungs: 'x', problems: [] })).status, 400);
  assert.equal((await put(off2, { rungs: [2, 1, 77, 1], problems: [2, 1] })).status, 200); // 77 does not exist, 1 is repeated
  const page = (await call('/competitions/1', { as: ana })).body;
  assert.deepEqual(page.prep.rungs.map((r) => [r.id, r.done]), [[1, true]]); // the hidden rung is not shown
  assert.deepEqual(page.prep.problems.map((p) => p.slug), ['two-sum']); // the draft is not shown
  assert.deepEqual((await call('/admin/hub/competitions/1/manage', { as: off2 })).body.prep, { rungs: [2, 1], problems: [2, 1] });
});

/* ------------------------------ saved opportunities ------------------------ */

await check('who else is doing an opportunity: counts public, first names for members', async () => {
  await db.exec(`INSERT INTO opportunities (id, title, deadline, status) VALUES (10, 'USACO Open', date('now', '+10 days'), 'live'), (11, 'Old', date('now', '+5 days'), 'live'), (12, 'Far', date('now', '+90 days'), 'live')`);
  for (const [u, o] of [[ana, 10], [ben, 10], [ana, 12], [ben, 11]]) assert.equal((await call(`/me/interests/${o}`, { method: 'POST', as: u })).status, 200);
  const anon = (await call('/opp-interest')).body;
  assert.deepEqual(anon.counts, { 10: 2, 11: 1, 12: 1 });
  assert.deepEqual(anon.names, {});
  const me = (await call('/opp-interest', { as: ana })).body;
  assert.deepEqual(me.names, { 10: ['Ben'], 11: ['Ben'] }); // never my own name, never a full name
  assert.deepEqual(me.mine.sort(), [10, 12]);
});

await check('the digest lists each reader\'s own deadlines within 30 days, matched by email', async () => {
  assert.deepEqual((await myDeadlines(db, 'ANA@example.com')).map((d) => d.title), ['USACO Open']); // 12 is 90 days out
  assert.deepEqual((await myDeadlines(db, 'ben@example.com')).map((d) => d.title), ['Old', 'USACO Open']); // soonest first
  assert.deepEqual(await myDeadlines(db, 'stranger@example.com'), []);
});

/* -------------------------------- analytics -------------------------------- */

await check('analytics endpoint: attendance, retention, not seen, activity, ideas', async () => {
  const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
  const season = seasonOf(new Date());
  const rooms = [['AAAA', 'Opening night', 40], ['BBBB', 'Duel night', 30], ['CCCC', 'Mock contest', 5]];
  for (const [code, title, ago] of rooms) await db.prepare('INSERT INTO rooms (code, title, created_at) VALUES (?, ?, ?)').bind(code, title, day(ago)).run();
  const here = { AAAA: [ana, ben, cam], BBBB: [ana, ben], CCCC: [ana] };
  for (const [code, us] of Object.entries(here)) for (const u of us) await db.prepare('INSERT INTO room_checkins (code, user_id) VALUES (?, ?)').bind(code, u.id).run();
  await db.exec(`INSERT INTO ideas (id, user_id, body, status) VALUES (1, ${ana.id}, 'Duel night', 'done'), (2, ${ben.id}, 'Mock ICPC', 'planned'), (3, ${ben.id}, 'Open one', 'open')`);

  assert.equal((await call('/admin/hub/analytics')).status, 401);
  assert.equal((await call('/admin/hub/analytics?season=soon', { as: off2 })).status, 400);
  const d = (await call('/admin/hub/analytics', { as: off2 })).body;
  // The season may have started after 40 days ago (early June or January), so only
  // check what does not depend on today's date when a room falls outside it.
  const inSeason = rooms.filter(([, , ago]) => seasonOf(day(ago)) === season).length;
  assert.equal(d.meetings.length, inSeason);
  assert.ok(d.seasons.includes(season));
  assert.deepEqual(d.ideas.map((i) => [i.body, i.status]), [['Mock ICPC', 'planned'], ['Duel night', 'done']]);
  assert.equal(d.neverCame, 2); // the two officers
  assert.deepEqual(d.notSeen.map((x) => x.name), ['Cam', 'Ben']); // 40 and 30 days; Ana came 5 days ago
  assert.equal(d.notSeen[0].days, 40);
  assert.equal(d.notSeen[0].last, day(40).slice(0, 10));
  assert.ok(d.activity.some((a) => a.kind === 'compete'));
  if (inSeason === 3) {
    assert.deepEqual(d.meetings.map((x) => x.n), [3, 2, 1]);
    assert.equal(d.retention.base, 3);
    assert.equal(d.retention.kept, 1); // only Ana came in the last 4 weeks
  }
});

console.log(`compete: ${passed} checks ok`);
