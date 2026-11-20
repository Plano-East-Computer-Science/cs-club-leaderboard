/**
 * next Learn: every course passes the schema validator, the validator catches
 * broken lessons, friendly error explanations, and the progress API (sign-in
 * required, one row per lesson, unknown lessons rejected, only your own rows).
 * The Java in every lesson is compiled and run by test/learn-next-java.js.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { COURSES, findLesson } from '../shared/next/learn/courses/index.js';
import { validateCourse, validateLesson, normOutput, normAnswer, judgedSource, lessonsOf } from '../shared/next/learn/schema.js';
import { explainError } from '../shared/next/learn/errors.js';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

await check('every course passes the schema', () => {
  for (const c of COURSES) assert.deepEqual(validateCourse(c), [], c.id);
});

await check('AP CSA covers four units plus FRQ practice, 24+ lessons', () => {
  const ap = COURSES.find((c) => c.id === 'apcsa');
  assert.equal(ap.units.length, 5);
  const normal = lessonsOf(ap).filter((l) => l.kind !== 'frq');
  const frq = lessonsOf(ap).filter((l) => l.kind === 'frq');
  assert.ok(normal.length >= 24, `${normal.length} lessons`);
  assert.ok(frq.length >= 4, `${frq.length} FRQ lessons`);
  for (const l of normal) assert.ok(l.steps.length >= 8 && l.steps.length <= 15, l.id);
});

await check('the validator catches broken lessons', () => {
  const ok = lessonsOf(COURSES[0])[0];
  assert.deepEqual(validateLesson(ok), []);
  const broken = structuredClone(ok);
  broken.steps = broken.steps.filter((s) => s.kind !== 'predict' && s.kind !== 'exercise');
  const errs = validateLesson(broken).join('\n');
  assert.match(errs, /predict/);
  assert.match(errs, /exercise/);
  const twoRight = structuredClone(ok);
  const c = twoRight.steps.find((s) => s.kind === 'check' && s.options);
  c.options.forEach((o) => (o.correct = true));
  assert.match(validateLesson(twoRight).join('\n'), /exactly one correct/);
  const noWhy = structuredClone(ok);
  delete noWhy.steps.find((s) => s.kind === 'check' && s.options).options[1].why;
  assert.match(validateLesson(noWhy).join('\n'), /needs a why/);
  const badPredict = structuredClone(ok);
  const p = badPredict.steps.find((s) => s.kind === 'predict' && s.choices);
  p.choices = p.choices.filter((x) => normOutput(x) !== normOutput(p.output));
  assert.match(validateLesson(badPredict).join('\n'), /choice must equal/);
  const pub = structuredClone(ok);
  pub.steps.find((s) => s.kind === 'exercise').harness = 'public class Grader {}';
  assert.match(validateLesson(pub).join('\n'), /non-public/);
  const dup = { ...COURSES[0], units: [...COURSES[0].units, { id: 'x', title: 'X', lessons: [ok] }] };
  assert.match(validateCourse(dup).join('\n'), /repeats/);
});

await check('output and answer comparison ignore what should not count', () => {
  assert.equal(normOutput('a  \r\nb\n\n'), normOutput('a\nb'));
  assert.notEqual(normOutput('a\n b'), normOutput('a\nb'));
  assert.equal(normAnswer(' Logic  Error '), normAnswer('logicerror'));
  assert.equal(judgedSource({}, 'X'), 'X');
  assert.match(judgedSource({ harness: 'class G {}' }, 'X'), /^X\n\nclass G \{\}/);
});

await check('common errors get a plain-English explanation', () => {
  assert.match(explainError("Main.java:3: error: cannot find symbol")[0], /does not know a name/);
  assert.match(explainError("error: ';' expected")[0], /semicolon/);
  assert.match(explainError('incompatible types: possible lossy conversion from double to int')[0], /cast/);
  assert.match(explainError('missing return statement')[0], /return/);
  const aioobe = explainError('Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException');
  assert.equal(aioobe.length, 1);
  assert.match(aioobe[0], /length - 1/);
  assert.match(explainError('java.lang.NullPointerException')[0], /null/);
  assert.deepEqual(explainError('all good'), []);
});

await check('continue picks the right next lesson', async () => {
  const { pickNext } = await import('../src/next/learn/progress.js');
  const L = ['a', 'b', 'c', 'd'].map((key) => ({ key }));
  const p = (last, done) => ({ last, lessons: Object.fromEntries(done.map((k) => [k, { done: true }])) });
  assert.equal(pickNext(L, p(null, [])).key, 'a');
  assert.equal(pickNext(L, p('b', [])).key, 'b', 'unfinished last lesson');
  assert.equal(pickNext(L, p('b', ['a', 'b'])).key, 'c', 'the one after a finished lesson');
  assert.equal(pickNext(L, p('c', ['c', 'd'])).key, 'a', 'wraps to the first unfinished');
  assert.equal(pickNext(L, p('d', ['a', 'b', 'c', 'd'])), null);
});

/* ------------------------------ progress API ------------------------------ */

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;

async function addUser(name) {
  const u = await db.prepare('INSERT INTO users (email, name) VALUES (?, ?)').bind(`${name.toLowerCase()}@example.com`, name).run();
  const id = u.meta.last_row_id;
  return { id, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
}
async function call(p, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(
    new Request(`https://club.test/api/lessons${p}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }),
    env,
    { waitUntil() {}, passThroughOnException() {} }
  );
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json };
}

const ap = COURSES.find((c) => c.id === 'apcsa');
const [l1, l2] = lessonsOf(ap);
const ada = await addUser('Ada');
const bo = await addUser('Bo');

await check('progress needs a signed-in student', async () => {
  assert.equal((await call('/progress')).status, 401);
  assert.equal((await call('/progress', { method: 'POST', body: { course: 'apcsa', lesson: l1.id, step: 1 } })).status, 401);
});

await check('saving keeps one row per lesson, step moves, done never undoes', async () => {
  let r = await call('/progress', { cookie: ada.cookie, method: 'POST', body: { course: 'apcsa', lesson: l1.id, step: 2 } });
  assert.equal(r.status, 200);
  r = await call('/progress', { cookie: ada.cookie, method: 'POST', body: { course: 'apcsa', lesson: l1.id, step: 5, done: true } });
  r = await call('/progress', { cookie: ada.cookie, method: 'POST', body: { items: [{ course: 'apcsa', lesson: l1.id, step: 0, done: false }, { course: 'apcsa', lesson: l2.id, step: 1 }] } });
  assert.equal(r.status, 200);
  const rows = await db.prepare('SELECT * FROM lesson_progress WHERE user_id = ?').bind(ada.id).all();
  assert.equal(rows.results.length, 2);
  const mine = (await call('/progress', { cookie: ada.cookie })).body.progress;
  assert.deepEqual(mine.find((x) => x.lesson === l1.id), { course: 'apcsa', lesson: l1.id, step: 0, done: true });
  assert.deepEqual(mine.find((x) => x.lesson === l2.id), { course: 'apcsa', lesson: l2.id, step: 1, done: false });
});

await check('unknown lessons and bad steps are rejected with a sentence', async () => {
  for (const body of [
    { course: 'apcsa', lesson: 'no-such-lesson', step: 0 },
    { course: 'nope', lesson: l1.id, step: 0 },
    { course: 'apcsa', lesson: l1.id, step: l1.steps.length },
    { course: 'apcsa', lesson: l1.id, step: -1 },
    { course: 'apcsa', lesson: l1.id, step: 1.5 },
    { course: 'apcsa', lesson: l1.id, step: 0, done: 'yes' },
    { items: [] },
    { items: Array.from({ length: 101 }, () => ({ course: 'apcsa', lesson: l1.id })) },
    { items: [{ course: 'apcsa', lesson: l1.id }, { course: 'apcsa', lesson: '../x' }] },
  ]) {
    const r = await call('/progress', { cookie: bo.cookie, method: 'POST', body });
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
    assert.match(r.body.error, /\.$/);
  }
  // A rejected batch writes nothing, not even its valid items.
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id = ?').bind(bo.id).first()).n, 0);
});

await check('nobody can read or write someone else\'s progress', async () => {
  const r = await call('/progress', { cookie: bo.cookie, method: 'POST', body: { user_id: ada.id, userId: ada.id, course: 'apcsa', lesson: l2.id, step: 3, done: true } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.progress, [{ course: 'apcsa', lesson: l2.id, step: 3, done: true }]);
  const adaL2 = await db.prepare('SELECT step, done_at FROM lesson_progress WHERE user_id = ? AND lesson = ?').bind(ada.id, l2.id).first();
  assert.equal(adaL2.step, 1);
  assert.equal(adaL2.done_at, null);
  const seen = (await call('/progress', { cookie: bo.cookie })).body.progress;
  assert.ok(seen.every((x) => x.lesson === l2.id));
  assert.ok(findLesson('apcsa', l2.id));
});

console.log(`learn-next: ${passed} checks passed`);
