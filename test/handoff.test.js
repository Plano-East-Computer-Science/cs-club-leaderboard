/**
 * G4 handoff: the eligibility function, the application window, privacy of
 * applications, officer-only routes, export and purge, and first names in the archive.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { exportFor, softDelete, purgeUser } from '../worker/hub/safety.js';
import { eligibility, thresholdsFrom, cleanThresholds, schoolYearOf, yearRange, DEFAULT_THRESHOLDS } from '../shared/handoff.js';

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
  const mail = `${name.replace(/\s+/g, '.').toLowerCase()}@example.com`;
  const u = await db.prepare('INSERT INTO users (email, name, student_id, role) VALUES (?, ?, ?, ?)').bind(mail, name, s.meta.last_row_id, role).run();
  const id = u.meta.last_row_id;
  return { id, sid: s.meta.last_row_id, name, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
}

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

/* ----------------------------- pure functions ----------------------------- */

await check('school year runs June to May and ranges are half open', () => {
  assert.equal(schoolYearOf('2026-06-01 00:00:00'), '2026');
  assert.equal(schoolYearOf('2026-11-18'), '2026');
  assert.equal(schoolYearOf(new Date('2027-05-31T23:00:00Z')), '2026');
  assert.equal(schoolYearOf('2027-06-01 00:00:00'), '2027');
  assert.deepEqual(yearRange('2026'), { start: '2026-06-01 00:00:00', end: '2027-06-01 00:00:00' });
  for (const bad of ['26', '2026-27', 'abc', '1999', '']) assert.equal(yearRange(bad), null, bad);
});

await check('eligibility lists criteria met and not met', () => {
  const none = eligibility({}, DEFAULT_THRESHOLDS);
  assert.equal(none.total, 5);
  assert.equal(none.met, 0);
  assert.equal(none.eligible, false);
  const full = eligibility({ meetings: 8, mentor: 2, content: 1, reviews: 2, hosted: 1 }, DEFAULT_THRESHOLDS);
  assert.equal(full.eligible, true);
  const edge = eligibility({ meetings: 7, mentor: 2, content: 1, reviews: 2, hosted: 1 }, DEFAULT_THRESHOLDS);
  assert.equal(edge.eligible, false);
  assert.deepEqual(edge.criteria.filter((c) => !c.met).map((c) => c.id), ['meetings']);
  // A threshold of 0 switches the criterion off; with all off nobody is eligible by record alone.
  assert.equal(eligibility({ meetings: 1 }, { ...DEFAULT_THRESHOLDS, mentor: 0, content: 0, reviews: 0, hosted: 0, meetings: 1 }).eligible, true);
  assert.equal(eligibility({ meetings: 99 }, { meetings: 0, mentor: 0, content: 0, reviews: 0, hosted: 0 }).eligible, false);
});

await check('thresholds: officer overrides merge over defaults, bad input is refused', () => {
  assert.deepEqual(thresholdsFrom(''), DEFAULT_THRESHOLDS);
  assert.deepEqual(thresholdsFrom('not json'), DEFAULT_THRESHOLDS);
  assert.equal(thresholdsFrom('{"meetings":3}').meetings, 3);
  assert.equal(thresholdsFrom('{"meetings":3}').mentor, DEFAULT_THRESHOLDS.mentor);
  for (const bad of [{ meetings: -1 }, { meetings: 1.5 }, { meetings: 101 }, { nope: 1 }, [], null]) {
    assert.ok(cleanThresholds(bad).error, JSON.stringify(bad));
  }
});

/* ------------------------------- the routes ------------------------------- */

const maya = await addUser('Maya Patel');
const sam = await addUser('Sam Ortiz');
const ofc = await addUser('Olive Reyes', { role: 'officer' });
const post = (path, u, body) => call(path, { cookie: u?.cookie, method: 'POST', body });
const put = (path, u, body) => call(path, { cookie: u?.cookie, method: 'PUT', body });
const YEAR = schoolYearOf(new Date());
const ANSWERS = { why: 'I want the club to keep going after I graduate.', plan: 'Start a weekly beginner hour for new members.', time: 'About two hours a week, plus robotics.' };

await check('/officers/apply data needs a signed-in member', async () => {
  assert.equal((await call('/handoff/me')).status, 401);
  assert.equal((await post('/handoff/apply', null, { answers: ANSWERS })).status, 401);
});

await check('the window is closed by default and answers are validated', async () => {
  assert.equal((await call('/handoff/me', { cookie: maya.cookie })).body.open, false);
  assert.equal((await post('/handoff/apply', maya, { answers: ANSWERS })).status, 403);
});

await check('only officers may open the window, set thresholds or decide', async () => {
  for (const u of [null, maya]) {
    assert.ok([401, 403].includes((await put('/admin/hub/handoff/settings', u, { open: true })).status));
    assert.ok([401, 403].includes((await call('/admin/hub/handoff', { cookie: u?.cookie })).status));
    assert.ok([401, 403].includes((await put(`/admin/hub/handoff/summary/${YEAR}`, u, { body: 'x' })).status));
    assert.ok([401, 403].includes((await post('/admin/hub/handoff/applications/1/decide', u, { status: 'accepted' })).status));
  }
  assert.equal((await put('/admin/hub/handoff/settings', ofc, { thresholds: { meetings: -3 } })).status, 400);
  assert.equal((await put('/admin/hub/handoff/settings', ofc, { open: 'yes' })).status, 400);
  const r = await put('/admin/hub/handoff/settings', ofc, { open: true, thresholds: { meetings: 1, mentor: 0, content: 0, reviews: 0, hosted: 0 } });
  assert.equal(r.status, 200);
  assert.equal(r.body.open, true);
});

await check('a member sees their own progress', async () => {
  const room = await db.prepare(`INSERT INTO rooms (code, title, kind) VALUES ('AAAA', 'Meeting', 'meeting')`).run();
  assert.ok(room);
  await db.prepare(`INSERT INTO room_checkins (code, user_id) VALUES ('AAAA', ?)`).bind(maya.id).run();
  const me = (await call('/handoff/me', { cookie: maya.cookie })).body;
  assert.equal(me.open, true);
  assert.equal(me.eligibility.eligible, true);
  assert.equal(me.eligibility.criteria[0].have, 1);
  assert.equal((await call('/handoff/me', { cookie: sam.cookie })).body.eligibility.eligible, false);
});

await check('apply: short answers refused, then saved, editable until decided', async () => {
  assert.equal((await post('/handoff/apply', maya, { answers: { ...ANSWERS, why: 'hi' } })).status, 400);
  assert.equal((await post('/handoff/apply', maya, {})).status, 400);
  assert.equal((await post('/handoff/apply', maya, { answers: ANSWERS })).status, 201);
  assert.equal((await post('/handoff/apply', maya, { answers: { ...ANSWERS, plan: 'Run a mock contest every month.' } })).status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM officer_applications').first()).n, 1);
  assert.equal((await post('/handoff/apply', ofc, { answers: ANSWERS })).status, 409, 'officers do not apply');
});

await check('applications are private to the member and officers', async () => {
  assert.equal((await call('/handoff/me', { cookie: sam.cookie })).body.application, null);
  const mine = (await call('/handoff/me', { cookie: maya.cookie })).body.application;
  assert.equal(mine.answers.plan, 'Run a mock contest every month.');
  const list = (await call('/admin/hub/handoff', { cookie: ofc.cookie })).body;
  assert.equal(list.applications.length, 1);
  assert.equal(list.applications[0].name, 'Maya Patel');
  assert.equal(list.applications[0].eligibility.eligible, true);
  // Nothing about it leaks to other members, the archive or the public pages.
  assert.ok(!(await call('/archive/' + YEAR)).text.includes('mock contest'));
  assert.ok(!(await call(`/archive/${YEAR}`, { cookie: sam.cookie })).text.includes('Maya Patel'));
});

await check('officers decide; the note stays off the member view; decided is locked', async () => {
  const id = (await call('/admin/hub/handoff', { cookie: ofc.cookie })).body.applications[0].id;
  assert.equal((await post(`/admin/hub/handoff/applications/${id}/decide`, ofc, { status: 'maybe' })).status, 400);
  assert.equal((await post('/admin/hub/handoff/applications/999/decide', ofc, { status: 'accepted' })).status, 404);
  assert.equal((await post(`/admin/hub/handoff/applications/${id}/decide`, ofc, { status: 'accepted', note: 'Strong plan, secret note' })).status, 200);
  const me = await call('/handoff/me', { cookie: maya.cookie });
  assert.equal(me.body.application.status, 'accepted');
  assert.ok(!me.text.includes('secret note'));
  assert.equal((await post('/handoff/apply', maya, { answers: ANSWERS })).status, 409);
});

await check('closing the window stops new applications', async () => {
  await put('/admin/hub/handoff/settings', ofc, { open: false });
  assert.equal((await post('/handoff/apply', sam, { answers: ANSWERS })).status, 403);
});

await check('export includes the application (not the officer note); purge erases it', async () => {
  const data = await exportFor(db, { id: maya.id, student_id: maya.sid });
  assert.equal(data.officer_applications.length, 1);
  assert.equal(data.officer_applications[0].status, 'accepted');
  assert.ok(!JSON.stringify(data.officer_applications).includes('secret note'));
  await softDelete(db, { id: maya.id, student_id: maya.sid }, false);
  await purgeUser(db, maya.id);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM officer_applications').first()).n, 0);
});

await check('the archive is built from existing data, public, with first names only', async () => {
  const lee = await addUser('Lee Chen');
  const ava = await addUser('Ava Kim');
  await db.prepare(`INSERT INTO rooms (code, title, kind, template) VALUES ('BBBB', 'Duel night', 'meeting', 'duel-night')`).run();
  await db.prepare(`INSERT INTO rooms (code, title, kind) VALUES ('CCCC', 'Pause', 'dropin')`).run();
  for (const u of [lee, ava]) await db.prepare(`INSERT INTO room_checkins (code, user_id) VALUES ('BBBB', ?)`).bind(u.id).run();
  for (let i = 0; i < 2; i++) {
    await db.prepare(`INSERT INTO activity (student_id, kind, ref, status, points) VALUES (?, 'mentor', ?, 'approved', 15)`).bind(lee.sid, `t${i}`).run();
  }
  await db.prepare(`INSERT INTO projects (user_id, title) VALUES (?, 'Chess bot')`).bind(ava.id).run();
  await db.prepare(`INSERT INTO competitions (name, result, event_date, status) VALUES ('USACO Open', '2nd', ?, 'past')`).bind(`${YEAR}-12-05`).run();
  await put(`/admin/hub/handoff/summary/${YEAR}`, ofc, { body: 'A good year. We grew from ten members to thirty.' });

  const list = (await call('/archive')).body; // no cookie: public
  assert.ok(list.years.some((y) => y.year === YEAR));
  const a = await call(`/archive/${YEAR}`);
  assert.equal(a.status, 200);
  assert.equal(a.body.totals.meetings, 2, 'AAAA and BBBB');
  assert.equal(a.body.totals.dropins, 1);
  assert.equal(a.body.totals.people, 2, 'Maya was purged');
  assert.equal(a.body.competitions[0].name, 'USACO Open');
  assert.deepEqual(a.body.projects.list, [{ title: 'Chess bot', by: 'Ava' }]);
  assert.deepEqual(a.body.top.mentoring, [{ name: 'Lee', n: 2 }]);
  assert.equal(a.body.summary, 'A good year. We grew from ten members to thirty.');
  assert.ok(!a.text.includes('Chen') && !a.text.includes('Kim') && !a.text.includes('example.com'));
  assert.equal((await call('/archive/2026-27')).status, 400);
  assert.equal((await call('/archive/1999')).status, 400);
  assert.equal((await call('/archive/2020')).body.totals.meetings, 0, 'an empty year still answers');
});

await check('summary length is capped and an empty body removes it', async () => {
  assert.equal((await put(`/admin/hub/handoff/summary/${YEAR}`, ofc, { body: 'x'.repeat(1600) })).status, 400);
  await put(`/admin/hub/handoff/summary/${YEAR}`, ofc, { body: '' });
  assert.equal((await call(`/archive/${YEAR}`)).body.summary, '');
});

console.log(`handoff: ${passed} checks passed`);
