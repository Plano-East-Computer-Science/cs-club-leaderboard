/**
 * Future door: the curated programs and colleges are well formed, the
 * tracker validation and deadline sorting are right, and the tracker API
 * only lets a member read and write their own items, within size limits.
 * Routes run through the real Worker on the fake D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { PROGRAMS, REQUIRED, TYPE_LABEL, COST_LABEL, WHERE_LABEL, SELECT_LABEL, fitsGrade } from '../shared/next/future/programs.js';
import { COLLEGES, ADMIT_LABEL, TEST_LABEL } from '../shared/next/future/colleges.js';
import { ROADMAP, MONTHLY, gradeOf, classOfFor } from '../shared/next/future/roadmap.js';
import { cleanItem, upcoming, mergeItems, daysBetween, isDate, countdown, monthsUntil, nextDateOf, LIMITS } from '../shared/next/future/tracker.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

const httpsUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && x.hostname.includes('.');
  } catch {
    return false;
  }
};
const houseRules = (label, text) => {
  assert.ok(!text.includes('—'), `${label}: no em dash`);
  assert.ok(!text.includes('!'), `${label}: no exclamation mark`);
};

/* ------------------------------ curated data ------------------------------ */

await check('at least 60 curated programs, each with every required field', async () => {
  assert.ok(PROGRAMS.length >= 60, `only ${PROGRAMS.length} programs`);
  for (const p of PROGRAMS) {
    for (const f of REQUIRED) assert.ok(p[f] != null && p[f] !== '', `${p.id ?? '?'} is missing ${f}`);
    assert.ok(/^[a-z0-9-]+$/.test(p.id), `${p.id} is a safe id`);
    assert.ok(TYPE_LABEL[p.type], `${p.id}: known type ${p.type}`);
    assert.ok(p.cost === null || COST_LABEL[p.cost], `${p.id}: known cost ${p.cost}`);
    assert.ok(WHERE_LABEL[p.where], `${p.id}: known place ${p.where}`);
    assert.ok(SELECT_LABEL[p.selectivity], `${p.id}: known selectivity`);
    assert.ok(p.month === null || (Number.isInteger(p.month) && p.month >= 1 && p.month <= 12), `${p.id}: month is 1 to 12 or null`);
    assert.ok(Array.isArray(p.grades) && p.grades.length && p.grades.every((g) => [9, 10, 11, 12].includes(g)), `${p.id}: grades are 9 to 12`);
    assert.ok(httpsUrl(p.url), `${p.id}: ${p.url} is an https URL`);
    assert.equal(p.checked, '2026-11', `${p.id}: checked date`);
    assert.ok(p.why.length >= 30 && p.why.length <= 300, `${p.id}: why is one or two honest sentences`);
  }
});

await check('program ids and URLs are unique', async () => {
  assert.equal(new Set(PROGRAMS.map((p) => p.id)).size, PROGRAMS.length);
  assert.equal(new Set(PROGRAMS.map((p) => p.url)).size, PROGRAMS.length);
});

await check('the library covers every kind of opportunity the brief names', async () => {
  for (const t of ['competition', 'summer', 'research', 'internship', 'scholarship', 'hackathon']) {
    assert.ok(PROGRAMS.some((p) => p.type === t), `has a ${t}`);
  }
  for (const id of ['usaco', 'acsl', 'amc', 'cac', 'picoctf', 'cyberpatriot', 'uil-cs', 'uil-calc', 'uil-ns', 'tsa', 'scioly', 'frc', 'ftc', 'isef', 'sts', 'think', 'technovation', 'rsi', 'ssp', 'promys', 'ross', 'mites-summer', 'simr', 'cosmos', 'garcia', 'clark', 'gwc', 'kwk', 'coke', 'qb-cps', 'ncwit']) {
    assert.ok(PROGRAMS.some((p) => p.id === id), `has ${id}`);
  }
  assert.ok(PROGRAMS.filter((p) => p.where === 'dfw').length >= 5, 'several in DFW');
});

await check('grade filter keeps only programs open to that grade', async () => {
  const rsi = PROGRAMS.find((p) => p.id === 'rsi');
  assert.ok(fitsGrade(rsi, 11) && !fitsGrade(rsi, 9) && fitsGrade(rsi, ''));
  assert.ok(PROGRAMS.filter((p) => fitsGrade(p, 9)).length >= 20, 'a freshman has plenty to do');
});

await check('40 colleges with tests, deadlines, sources and checked dates', async () => {
  assert.equal(COLLEGES.length, 40);
  assert.equal(new Set(COLLEGES.map((c) => c.id)).size, COLLEGES.length);
  for (const c of COLLEGES) {
    assert.ok(c.name && /^[A-Z]{2}$/.test(c.state) && c.cs, `${c.id}: name, state, notes`);
    assert.equal(c.checked, '2026-11', `${c.id}: checked`);
    assert.ok(c.admit === null || ADMIT_LABEL[c.admit], `${c.id}: admit is known or null`);
    if (c.admit) assert.ok(c.admitNote, `${c.id}: says how CS admission works`);
    assert.ok(TEST_LABEL[c.tests], `${c.id}: test policy`);
    assert.ok(c.deadlines.length && c.deadlines.every(([plan, d]) => plan && /^[A-Z][a-z]{2} \d{1,2}$/.test(d)), `${c.id}: deadlines`);
    assert.ok(c.sources.length && c.sources.every(httpsUrl), `${c.id}: https sources`);
    if (c.rate) assert.ok(c.rate.value && c.rate.what && httpsUrl(c.rate.source), `${c.id}: a rate always cites its source`);
  }
  for (const id of ['utaustin', 'tamu', 'rice', 'utd']) assert.ok(COLLEGES.find((c) => c.id === id)?.texas, `${id} is a Texas school`);
});

await check('roadmap covers every grade and every month', async () => {
  for (const g of [9, 10, 11, 12]) {
    const r = ROADMAP.find((x) => x.grade === g);
    assert.ok(r && r.courses.length && r.compete.length && r.build.length, `grade ${g} has courses, contests and building`);
    for (let m = 1; m <= 12; m++) assert.ok(MONTHLY[g]?.[m]?.length, `grade ${g} month ${m} has something to do`);
  }
});

await check('grade is worked out from the class year and the date', async () => {
  // School years start in August.
  assert.equal(gradeOf(2030, new Date('2026-11-20T12:00:00')), 9);
  assert.equal(gradeOf(2027, new Date('2026-11-20T12:00:00')), 12);
  assert.equal(gradeOf(2030, new Date('2027-06-15T12:00:00')), 9, 'June is the summer after 9th grade');
  assert.equal(gradeOf(2030, new Date('2027-08-10T12:00:00')), 10);
  assert.equal(classOfFor(10, new Date('2026-11-20T12:00:00')), 2029);
  assert.equal(gradeOf(classOfFor(11, new Date('2026-09-01T12:00:00')), new Date('2026-09-01T12:00:00')), 11);
  assert.equal(gradeOf(2020, new Date('2026-11-20T12:00:00')), null, 'graduated');
});

await check('copy follows the house rules: no em dashes, no exclamation marks', async () => {
  houseRules('programs', JSON.stringify(PROGRAMS));
  houseRules('colleges', JSON.stringify(COLLEGES));
  houseRules('roadmap', JSON.stringify({ ROADMAP, MONTHLY }));
});

/* ------------------------------ tracker logic ------------------------------ */

const ok = (over = {}) => cleanItem({ id: 'abcd1234', title: 'USACO', status: 'preparing', deadline: '2027-01-15', ...over });

await check('cleanItem accepts a good item and normalises it', async () => {
  const { item, error } = ok({ checklist: [{ text: ' Essay ', done: true }, { text: 'Rec' }], extra: 'dropped' });
  assert.equal(error, undefined);
  assert.deepEqual(item.checklist, [{ text: 'Essay', done: true }, { text: 'Rec', done: false }]);
  assert.equal(item.extra, undefined);
  assert.equal(cleanItem({ id: 'abcd1234', title: 'x' }).item.status, 'interested');
});

await check('cleanItem rejects bad input with a readable error', async () => {
  for (const bad of [
    ok({ id: 'a' }),
    ok({ id: '../../x' }),
    ok({ title: '' }),
    ok({ title: 'x'.repeat(LIMITS.title + 1) }),
    ok({ status: 'won' }),
    ok({ deadline: '2027-02-30' }),
    ok({ deadline: 'soon' }),
    ok({ notes: 'x'.repeat(LIMITS.notes + 1) }),
    ok({ url: 'javascript:alert(1)' }),
    ok({ ref: 'drop table' }),
    ok({ checklist: 'essay' }),
    ok({ checklist: Array.from({ length: LIMITS.checklist + 1 }, () => ({ text: 'a' })) }),
    ok({ checklist: [{ text: '' }] }),
    ok({ checklist: [{ text: 'x'.repeat(LIMITS.checkText + 1) }] }),
    cleanItem(null),
    cleanItem([]),
  ]) {
    assert.ok(bad.error && /\.$/.test(bad.error), `rejected with a sentence: ${JSON.stringify(bad)}`);
  }
});

await check('dates and countdowns', async () => {
  assert.ok(isDate('2028-02-29') && !isDate('2027-02-29') && !isDate('2027-13-01'));
  assert.equal(daysBetween('2026-11-20', '2026-12-01'), 11);
  assert.equal(daysBetween('2026-11-20', '2026-11-19'), -1);
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2, 'no daylight saving off-by-one');
  assert.equal(countdown(0), 'Due today');
  assert.equal(countdown(1), 'Due tomorrow');
  assert.equal(countdown(-3), 'Closed');
  assert.equal(monthsUntil(10, 11), 0, 'November deadline in November is this month');
  assert.equal(monthsUntil(10, 2), 3);
  assert.equal(nextDateOf('Nov 30', '2026-11-20'), '2026-11-30');
  assert.equal(nextDateOf('Nov 1', '2026-11-20'), '2027-11-01', 'a passed date rolls to next year');
  assert.equal(nextDateOf('Jan 4', '2026-11-20'), '2027-01-04');
  assert.equal(nextDateOf('Someday', '2026-11-20'), '');
  for (const c of COLLEGES) for (const [, d] of c.deadlines) assert.ok(nextDateOf(d, '2026-11-20'), `${c.id}: ${d} reads as a date`);
});

await check('upcoming sorts by deadline and skips past, missing and decided items', async () => {
  const list = upcoming(
    [
      { title: 'B', deadline: '2026-12-01' },
      { title: 'Past', deadline: '2026-11-01' },
      { title: 'None', deadline: '' },
      { title: 'A', deadline: '2026-12-01' },
      { title: 'Soon', deadline: '2026-11-20' },
      { title: 'Done', deadline: '2026-11-25', status: 'result' },
      { title: 'Later', deadline: '2027-02-01' },
    ],
    '2026-11-20',
    3
  );
  assert.deepEqual(list.map((x) => x.title), ['Soon', 'A', 'B']);
  assert.deepEqual(list.map((x) => x.days), [0, 11, 11]);
});

await check('mergeItems keeps the newer copy of each item', async () => {
  const merged = mergeItems([{ id: 'a', v: 1, updatedAt: 5 }, { id: 'b', v: 1, updatedAt: 9 }], [{ id: 'a', v: 2, updatedAt: 7 }, { id: 'b', v: 2, updatedAt: 3 }, { id: 'c', v: 2 }]);
  assert.deepEqual(merged.map((x) => `${x.id}${x.v}`), ['a2', 'b1', 'c2']);
});

/* --------------------------------- API --------------------------------- */

const env = { ADMIN_PASSWORD: 'x', SESSION_SECRET: 'test-secret', DEV_LOGIN: '1', DB: makeTestDb(read('../worker/schema.sql')) };
const db = env.DB;

async function addUser(name) {
  const s = await db.prepare('INSERT INTO students (name, grade) VALUES (?, 10)').bind(name).run();
  const u = await db.prepare('INSERT INTO users (email, name, student_id) VALUES (?, ?, ?)').bind(`${name.toLowerCase()}@example.com`, name, s.meta.last_row_id).run();
  const id = u.meta.last_row_id;
  return { id, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
}

async function call(path, { cookie, method = 'GET', body, raw } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body || raw) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test/api${path}`, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) }), env, {
    waitUntil() {},
    passThroughOnException() {},
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json };
}

const maya = await addUser('Maya');
const sam = await addUser('Sam');
const item = { title: 'RSI', status: 'preparing', deadline: '2026-12-09', checklist: [{ text: 'Essay', done: false }] };

await check('signed out: every tracker route says sign in', async () => {
  assert.equal((await call('/future/tracker')).status, 401);
  assert.equal((await call('/future/tracker/abcd1234', { method: 'PUT', body: item })).status, 401);
  assert.equal((await call('/future/tracker/abcd1234', { method: 'DELETE' })).status, 401);
});

await check('a member saves, edits, reads and deletes their own items', async () => {
  const put = await call('/future/tracker/rsi00001', { method: 'PUT', cookie: maya.cookie, body: item });
  assert.equal(put.status, 200);
  assert.equal(put.body.item.id, 'rsi00001');
  assert.ok(put.body.item.updatedAt > 0);
  await call('/future/tracker/rsi00001', { method: 'PUT', cookie: maya.cookie, body: { ...item, status: 'applied', updatedAt: 42 } });
  const got = await call('/future/tracker', { cookie: maya.cookie });
  assert.deepEqual(got.body.items.map((x) => [x.id, x.status]), [['rsi00001', 'applied']]);
  assert.equal((await call('/future/tracker/rsi00001', { method: 'DELETE', cookie: maya.cookie })).status, 200);
  assert.deepEqual((await call('/future/tracker', { cookie: maya.cookie })).body.items, []);
});

await check('the URL id wins over any id in the body', async () => {
  await call('/future/tracker/maya0001', { method: 'PUT', cookie: maya.cookie, body: { ...item, id: 'other999' } });
  assert.deepEqual((await call('/future/tracker', { cookie: maya.cookie })).body.items.map((x) => x.id), ['maya0001']);
});

await check("nobody can read, overwrite or delete another member's items", async () => {
  assert.deepEqual((await call('/future/tracker', { cookie: sam.cookie })).body.items, [], 'Sam sees none of Maya');
  // Same id from Sam creates Sam's own row; Maya's is untouched.
  await call('/future/tracker/maya0001', { method: 'PUT', cookie: sam.cookie, body: { ...item, title: 'Hijack' } });
  await call('/future/tracker/maya0001', { method: 'DELETE', cookie: sam.cookie });
  const mine = (await call('/future/tracker', { cookie: maya.cookie })).body.items;
  assert.deepEqual(mine.map((x) => x.title), ['RSI']);
  assert.equal((await call('/future/tracker', { cookie: sam.cookie })).body.items.length, 0, "Sam's delete removed only Sam's copy");
});

await check('bad items and oversized bodies are refused', async () => {
  const bad = await call('/future/tracker/abcd1234', { method: 'PUT', cookie: maya.cookie, body: { ...item, deadline: '2027-02-31' } });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /real date/);
  assert.equal((await call('/future/tracker/x', { method: 'PUT', cookie: maya.cookie, body: item })).status, 400, 'bad id');
  assert.equal((await call('/future/tracker/abcd1234', { method: 'PUT', cookie: maya.cookie, raw: '{not json' })).status, 400);
  const huge = await call('/future/tracker/abcd1234', { method: 'PUT', cookie: maya.cookie, raw: JSON.stringify({ ...item, notes: 'x'.repeat(LIMITS.bytes) }) });
  assert.equal(huge.status, 413);
});

await check('a tracker holds at most the item limit, but existing items can still be edited', async () => {
  const stmt = db.prepare('INSERT INTO future_tracker (user_id, id, data) VALUES (?, ?, ?)');
  const have = (await db.prepare('SELECT COUNT(*) AS n FROM future_tracker WHERE user_id = ?').bind(sam.id).first()).n;
  for (let i = have; i < LIMITS.items; i++) await stmt.bind(sam.id, `fill${String(i).padStart(4, '0')}`, JSON.stringify({ id: `fill${i}`, title: 'x' })).run();
  const full = await call('/future/tracker/new00001', { method: 'PUT', cookie: sam.cookie, body: item });
  assert.equal(full.status, 409);
  assert.equal((await call('/future/tracker/fill0001', { method: 'PUT', cookie: sam.cookie, body: item })).status, 200);
});

console.log(`future: ${passed} checks passed`);
