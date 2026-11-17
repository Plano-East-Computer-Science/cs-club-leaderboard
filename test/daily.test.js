/**
 * Daily problem (C3): the Chicago day flip (including both DST changes),
 * deterministic and non-repeating picks, officer pins, the weekly count with
 * one free miss, the share line, and the routes against a fake D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hono } from 'hono';

import { makeTestDb } from './d1-shim.js';
import { signValue } from '../worker/auth.js';
import { chicagoDate, addDays, weekStart, pickDaily, weeklyCount, shareText, median, NO_REPEAT_DAYS } from '../shared/daily.js';
import { dailyActivity } from '../worker/hub/daily-awards.js';
import { dailyRouter, dailyAdminRouter } from '../worker/hub/daily.js';

/* ------------------------------ date flip ------------------------------- */

const at = (iso) => chicagoDate(new Date(iso));
assert.equal(at('2026-11-17T05:59:59Z'), '2026-11-16', 'CST midnight is 06:00Z');
assert.equal(at('2026-11-17T06:00:00Z'), '2026-11-17');
assert.equal(at('2026-07-04T04:59:59Z'), '2026-07-03', 'CDT midnight is 05:00Z');
assert.equal(at('2026-07-04T05:00:00Z'), '2026-07-04');
// Spring forward 2026-03-08: the day is only 23 hours long.
assert.equal(at('2026-03-08T05:59:59Z'), '2026-03-07');
assert.equal(at('2026-03-08T06:00:00Z'), '2026-03-08');
assert.equal(at('2026-03-09T04:59:59Z'), '2026-03-08');
assert.equal(at('2026-03-09T05:00:00Z'), '2026-03-09');
// Fall back 2026-11-01: 25 hours long.
assert.equal(at('2026-11-01T05:00:00Z'), '2026-11-01');
assert.equal(at('2026-11-02T05:59:59Z'), '2026-11-01');
assert.equal(at('2026-11-02T06:00:00Z'), '2026-11-02');

assert.equal(addDays('2026-03-07', 2), '2026-03-09');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');
assert.equal(weekStart('2026-11-17'), '2026-11-16'); // Tuesday -> Monday
assert.equal(weekStart('2026-11-22'), '2026-11-16'); // Sunday belongs to the week before
assert.equal(weekStart('2026-11-16'), '2026-11-16');

/* ------------------------------- the pick ------------------------------- */

const pool = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, slug: `p-${String(i).padStart(2, '0')}` }));
const P40 = pool(40);
assert.equal(pickDaily('2026-11-17', P40), pickDaily('2026-11-17', P40), 'deterministic');
assert.equal(pickDaily('2026-11-17', P40), pickDaily('2026-11-17', [...P40].reverse()), 'input order does not matter');
assert.equal(pickDaily('2026-11-17', []), null, 'empty pool');

// No repeat inside the window, for 400 consecutive days.
const seq = [];
for (let i = 0, d = '2026-06-01'; i < 400; i++, d = addDays(d, 1)) seq.push(pickDaily(d, P40));
for (let i = 0; i < seq.length; i++) {
  for (let j = Math.max(0, i - NO_REPEAT_DAYS); j < i; j++) assert.notEqual(seq[i], seq[j], `repeat at ${i} vs ${j}`);
}
assert.ok(new Set(seq).size > 30, 'uses the pool');

// Pool smaller than the window: still never the same problem two days running.
const P5 = pool(5);
for (let i = 1, d = '2026-06-02'; i < 100; i++, d = addDays(d, 1)) assert.notEqual(pickDaily(d, P5), pickDaily(addDays(d, -1), P5));
assert.equal(pickDaily('2026-06-02', pool(1)), 1, 'a one-problem pool still answers');

// Pins override the pick for their date and count as history afterwards.
const free = pickDaily('2026-11-17', P40);
const pinned = P40.find((p) => p.id !== free).id;
assert.equal(pickDaily('2026-11-17', P40, { '2026-11-17': pinned }), pinned);
assert.equal(pickDaily('2026-11-17', [], { '2026-11-17': 9 }), 9, 'pin works with an empty pool');
assert.notEqual(pickDaily('2026-11-18', P40, { '2026-11-17': pinned }), pinned, 'pinned problem is not repeated the next day');

/* ----------------------------- weekly count ------------------------------ */

// Wednesday 2026-11-18: Mon and Tue are past, today still open.
assert.deepEqual(weeklyCount(['2026-11-16', '2026-11-17'], '2026-11-18'), { solved: 2, of: 7, misses: 0, freeMissUsed: 0, onTrack: true });
assert.deepEqual(weeklyCount(['2026-11-17'], '2026-11-18'), { solved: 1, of: 7, misses: 1, freeMissUsed: 1, onTrack: true });
const two = weeklyCount([], '2026-11-18');
assert.equal(two.misses, 2);
assert.equal(two.freeMissUsed, 1);
assert.equal(two.onTrack, false);
assert.equal(weeklyCount([], '2026-11-16').misses, 0,'today is not a miss until it ends');
assert.equal(weeklyCount(['2026-11-09', '2026-11-10'], '2026-11-18').solved, 0, 'last week does not count');
assert.equal(weeklyCount(['2026-11-16'], '2026-11-22').solved, 1, 'Sunday still belongs to the same week');

/* ----------------------------- share and misc ---------------------------- */

assert.equal(shareText({ date: '2026-11-17', attempts: 3, ms: 252000 }), 'PEHS daily 2026-11-17  ⬛⬛🟩  3 tries 4:12');
assert.equal(shareText({ date: '2026-11-17', attempts: 1, ms: 9000 }), 'PEHS daily 2026-11-17  🟩  1 try 0:09');
assert.equal(shareText({ date: '2026-11-17', attempts: 12, ms: 61000 }).split('  ')[1], '⬛⬛⬛⬛⬛🟩', 'grid is capped at six');
assert.equal(median([]), null);
assert.equal(median([3, 1, 2]), 2);
assert.equal(median([1, 2, 3, 4]), 3);

assert.deepEqual(dailyActivity({ userId: 7, date: '2026-11-17', attempts: 2, solvedAt: 'x', ms: 5 }), { userId: 7, kind: 'daily', ref: '2026-11-17', meta: { attempts: 2, ms: 5 } });
assert.equal(dailyActivity({ userId: 7, date: '2026-11-17', attempts: 2 }), null, 'unsolved');
assert.equal(dailyActivity({ date: '2026-11-17', solvedAt: 'x' }), null, 'no user');
assert.equal(dailyActivity(null), null);

/* -------------------------------- routes --------------------------------- */

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const db = makeTestDb(schema);
const env = { DB: db, SESSION_SECRET: 'test' };
db.exec(`INSERT INTO users (id, email, name) VALUES (1, 'a@x.test', 'A'), (2, 'b@x.test', 'B')`);
for (let i = 0; i < 4; i++) {
  db.exec(`INSERT INTO problems (slug, title, difficulty, cases, solution, status) VALUES ('s${i}', 'T${i}', ${i < 3 ? 1 : 5}, '[{"stdin":"","stdout":"1"}]', 'print(1)', 'live')`);
}
db.exec(`INSERT INTO problems (slug, title, difficulty, status) VALUES ('draft', 'Draft', 1, 'draft')`);

const app = new Hono();
app.route('/api', dailyRouter);
app.route('/admin', dailyAdminRouter);
const cookieFor = async (id) => `cslb_user=${await signValue(env, `${id}:${Date.now() + 3600_000}`)}`;
const call = async (method, url, body, user) => {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Cookie = await cookieFor(user);
  const res = await app.request(url, { method, headers, body: body && JSON.stringify(body) }, env);
  return { status: res.status, json: await res.json() };
};

let r = await call('GET', '/api/daily');
assert.equal(r.status, 200);
assert.equal(r.json.date, chicagoDate());
assert.ok(r.json.problem && !('solution' in r.json.problem), 'solution never leaves');
assert.ok(r.json.problem.difficulty <= 3 && r.json.problem.slug !== 'draft', 'only live easy problems');
assert.equal(r.json.signedIn, false);
assert.equal(r.json.stats.solved, 0);

assert.equal((await call('POST', '/api/daily/result', { attempts: 1, ms: 1000 })).status, 401, 'saving needs sign-in');
for (const bad of [{ attempts: 0, ms: 5 }, { attempts: 1.5, ms: 5 }, { attempts: 1, ms: -1 }, { attempts: 1, ms: 9e9 }, {}]) {
  assert.equal((await call('POST', '/api/daily/result', bad, 1)).status, 400, `reject ${JSON.stringify(bad)}`);
}

r = await call('POST', '/api/daily/result', { attempts: 2, ms: 60000 }, 1);
assert.equal(r.status, 200);
assert.equal(r.json.mine.attempts, 2);
assert.equal(r.json.stats.solved, 1);
assert.equal(r.json.week.solved, 1);
// First solve of the day wins: a second post does not overwrite.
r = await call('POST', '/api/daily/result', { attempts: 9, ms: 1 }, 1);
assert.equal(r.json.mine.attempts, 2);
await call('POST', '/api/daily/result', { attempts: 1, ms: 120000 }, 2);
r = await call('GET', '/api/daily');
assert.equal(r.json.stats.solved, 2);
assert.equal(r.json.stats.medianMs, 90000);
assert.ok(!JSON.stringify(r.json).includes('a@x.test') && r.json.mine === null, 'stats carry no names');

// Admin: pin, bad input, unpin.
r = await call('GET', '/admin/daily/plan');
assert.equal(r.json.days.length, 14);
assert.equal(r.json.options.length, 4, 'any live problem can be pinned');
const hard = r.json.options.find((o) => o.difficulty === 5).id;
const day = r.json.days[3].date;
assert.equal((await call('PUT', `/admin/daily/pins/${day}`, { problemId: hard })).status, 200);
r = await call('GET', '/admin/daily/plan');
assert.equal(r.json.days[3].pinned, true);
assert.equal(r.json.days[3].problem.id, hard);
assert.equal((await call('PUT', '/admin/daily/pins/2020-01-01', { problemId: hard })).status, 400, 'past date');
assert.equal((await call('PUT', '/admin/daily/pins/nope', { problemId: hard })).status, 400);
assert.equal((await call('PUT', `/admin/daily/pins/${day}`, { problemId: 999 })).status, 400, 'unknown problem');
const draftId = (await db.prepare(`SELECT id FROM problems WHERE slug = 'draft'`).first()).id;
assert.equal((await call('PUT', `/admin/daily/pins/${day}`, { problemId: draftId })).status, 400, 'draft cannot be pinned');
await call('DELETE', `/admin/daily/pins/${day}`);
r = await call('GET', '/admin/daily/plan');
assert.equal(r.json.days[3].pinned, false);

console.log('daily: ok');
