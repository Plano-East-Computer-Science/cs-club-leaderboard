/**
 * Data arena (C12): CSV parsing, metrics, prediction-file validation, the
 * public/final split, and the routes through the real Worker against the fake
 * D1 (answers never leave, only officers create challenges, the ledger pays
 * once, rate limit).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import {
  parseCsv, toNumber, normLabel, score, readColumns, validatePredictions, scoreSubmission, isPublic, rankRows, checkChallengeFiles,
  MAX_CSV_BYTES, PUBLIC_PERCENT,
} from '../shared/data.js';

/* ------------------------------ parse and metrics ------------------------------ */

assert.deepEqual(parseCsv('a,b\r\n1,"x,y"\n\n2,"he said ""hi"""\n'), [['a', 'b'], ['1', 'x,y'], ['2', 'he said "hi"']]);
assert.deepEqual(parseCsv('﻿id,v\n1,2'), [['id', 'v'], ['1', '2']], 'BOM is dropped');
assert.deepEqual(parseCsv(''), []);
assert.equal(toNumber(' 12 '), 12);
assert.equal(toNumber('-3.5e2'), -350);
for (const bad of ['', 'abc', 'NaN', 'Infinity', '1,5', '0x10', '1 2']) assert.equal(toNumber(bad), null, `not a number: ${bad}`);
assert.equal(normLabel('1.0'), '1');
assert.equal(normLabel(' cat '), 'cat');

assert.equal(score('accuracy', ['1', '0', '1', '1'], ['1', '1', '1', '0']), 0.5);
assert.equal(score('accuracy', ['1.0'], ['1']), 1, 'numeric labels compare as numbers');
assert.equal(score('rmse', [1, 2, 3], [1, 2, 3]), 0);
assert.equal(score('rmse', [0, 0], [3, 4]), 3.535534, 'scores round to six places');
assert.equal(score('mae', [0, 0], [3, -5]), 4);
assert.equal(score('mae', [], []), null, 'nothing to score');
assert.equal(score('mae', [1], [1, 2]), null, 'length mismatch');
assert.equal(score('nope', [1], [1]), null);

const better = rankRows([{ name: 'B', s: 0.7 }, { name: 'A', s: 0.9 }, { name: 'C', s: 0.9 }], 'accuracy', (r) => r.s).map((r) => r.name);
assert.deepEqual(better, ['A', 'C', 'B'], 'higher is better for accuracy, ties by name');
assert.deepEqual(rankRows([{ name: 'B', s: 3 }, { name: 'A', s: 2 }], 'rmse', (r) => r.s).map((r) => r.name), ['A', 'B'], 'lower is better for error');

/* ------------------------------ validating a file ------------------------------ */

const ids = Array.from({ length: 40 }, (_, i) => i + 1);
const clsAnswers = 'id,y\n' + ids.map((i) => `${i},${i % 3 === 0 ? 'cat' : 'dog'}`).join('\n') + '\n';
const regAnswers = 'id,y\n' + ids.map((i) => `${i},${i * 2.5}`).join('\n') + '\n';
const cls = readColumns(clsAnswers, 'id', 'y').map;
const reg = readColumns(regAnswers, 'id', 'y').map;
const opts = (metric) => ({ idCol: 'id', targetCol: 'y', metric });
const perfectCls = clsAnswers;

assert.equal(validatePredictions(perfectCls, cls, opts('accuracy')).preds.size, 40);
assert.match(validatePredictions('', cls, opts('accuracy')).error, /empty/);
assert.match(validatePredictions('id\n1\n', cls, opts('accuracy')).error, /columns "id" and "y"/);
assert.match(validatePredictions('id,y\n1,cat\n', cls, opts('accuracy')).error, /1 rows but this challenge expects 40/);
assert.match(validatePredictions(perfectCls.replace(/\n40,dog\n?$/, '\n41,dog\n'), cls, opts('accuracy')).error, /missing/, 'a wrong id is named');
assert.match(validatePredictions(perfectCls.replace('\n2,dog', '\n1,dog'), cls, opts('accuracy')).error, /more than once/);
assert.match(validatePredictions(perfectCls.replace('1,dog', '1,wolf'), cls, opts('accuracy')).error, /"wolf".*not one this challenge uses/);
assert.match(validatePredictions('id,y\n1,cat,extra\n', cls, opts('accuracy')).error, /row 2 has 3 values/);
assert.match(validatePredictions(regAnswers.replace('1,2.5', '1,abc'), reg, opts('rmse')).error, /not a number/);
assert.match(validatePredictions(regAnswers.replace('1,2.5', '1,'), reg, opts('rmse')).error, /not a number/, 'blank is not a number');
assert.match(validatePredictions(regAnswers.replace('1,2.5', '1,NaN'), reg, opts('rmse')).error, /not a number/);
assert.match(validatePredictions('x'.repeat(MAX_CSV_BYTES + 1), cls, opts('accuracy')).error, /too big/);
// Extra columns and column order do not matter.
assert.equal(validatePredictions('note,y,id\n,cat,1\n' + ids.slice(1).map((i) => `,${i % 3 === 0 ? 'cat' : 'dog'},${i}`).join('\n'), cls, opts('accuracy')).preds.size, 40);

/* ------------------------------ public and final scores ------------------------------ */

const salt = 7;
const share = ids.filter((i) => isPublic(i, salt)).length / ids.length;
assert.ok(share > 0.1 && share < 0.5, `public slice is roughly ${PUBLIC_PERCENT}% (got ${share})`);
assert.equal(isPublic(5, salt), isPublic(5, salt), 'stable');
const perfect = validatePredictions(regAnswers, reg, opts('rmse')).preds;
assert.deepEqual(scoreSubmission('rmse', perfect, reg, salt), { public: 0, final: 0 });
const off = new Map([...perfect].map(([k, v]) => [k, v + 2]));
const sc = scoreSubmission('rmse', off, reg, salt);
assert.equal(sc.final, 2);
assert.equal(sc.public, 2);
// Wrong only on public rows: the public score drops further than the final one.
const wrongPublic = new Map([...cls].map(([k, v]) => [k, isPublic(k, salt) ? (v === 'cat' ? 'dog' : 'cat') : v]));
const sp = scoreSubmission('accuracy', wrongPublic, cls, salt);
assert.equal(sp.public, 0);
assert.ok(sp.final > 0.4);

/* ------------------------------ officer upload checks ------------------------------ */

const feat = (rows) => 'id,x\n' + rows.map((i) => `${i},${i}`).join('\n') + '\n';
const trainCsv = 'id,x,y\n' + ids.map((i) => `${i},${i},${i % 2 ? 'a' : 'b'}`).join('\n') + '\n';
const testIds = ids.map((i) => i + 100);
const testAns = 'id,y\n' + testIds.map((i) => `${i},${i % 2 ? 'a' : 'b'}`).join('\n') + '\n';
const good = { train: trainCsv, test: feat(testIds), answers: testAns, idCol: 'id', targetCol: 'y', metric: 'accuracy' };
assert.equal(checkChallengeFiles(good).rows, 40);
assert.match(checkChallengeFiles({ ...good, metric: 'f1' }).error, /Metric is one of/);
assert.match(checkChallengeFiles({ ...good, targetCol: 'id' }).error, /must differ/);
assert.match(checkChallengeFiles({ ...good, test: 'id,x,y\n' + testIds.map((i) => `${i},1,a`).join('\n') }).error, /must not contain "y"/);
assert.match(checkChallengeFiles({ ...good, answers: testAns.replace('\n101,', '\n999,') }).error, /exactly the ids/);
assert.match(checkChallengeFiles({ ...good, answers: testAns.replace(/,[ab]/g, ',a') }).error, /two labels/);
assert.match(checkChallengeFiles({ ...good, metric: 'rmse' }).error, /not a number/);
assert.match(checkChallengeFiles({ ...good, train: '' }).error, /empty/);
assert.match(checkChallengeFiles({ ...good, test: feat([1, 2, 3]), answers: 'id,y\n1,a\n2,b\n3,a\n' }).error, /rows/);

/* ------------------------------------ routes ------------------------------------ */

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;
const addUser = async (name, role = 'member') =>
  (await db.prepare('INSERT INTO users (email, name, role) VALUES (?, ?, ?)').bind(`${name.toLowerCase()}@example.com`, name, role).run()).meta.last_row_id;
const cookie = async (id) => `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}`;

async function call(path, { as, method = 'GET', body, raw } = {}) {
  const headers = {};
  if (as) headers.Cookie = as;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {}, passThroughOnException() {} });
  const text = await res.text();
  return { status: res.status, text, body: raw ? null : (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

const officerId = await addUser('Olive', 'officer');
const ana = await addUser('Ana Lopez');
const ben = await addUser('Ben Kim');
const [O, A, B] = [await cookie(officerId), await cookie(ana), await cookie(ben)];

// Only officers create challenges.
const SECRET_ANSWERS = 'id,price\n' + ids.map((i) => `${i},${i * 3 + 0.123}`).join('\n') + '\n';
const regChallenge = {
  title: 'Prices', summary: 'Guess the price.', metric: 'rmse', idCol: 'id', targetCol: 'price',
  train: 'id,size,price\n' + ids.map((i) => `${i},${i},${i * 3}`).join('\n') + '\n',
  test: 'id,size\n' + ids.map((i) => `${i},${i}`).join('\n') + '\n',
  answers: SECRET_ANSWERS,
};
assert.equal((await call('/admin/hub/data/challenges', { method: 'POST', body: regChallenge })).status, 401, 'anonymous');
assert.equal((await call('/admin/hub/data/challenges', { method: 'POST', body: regChallenge, as: A })).status, 401, 'member');
assert.equal((await call('/admin/hub/data/challenges', { as: A })).status, 401, 'member cannot list the officer view');
assert.equal((await call('/admin/hub/data/challenges', { method: 'POST', body: { ...regChallenge, metric: 'nope' }, as: O })).status, 400);
const made = await call('/admin/hub/data/challenges', { method: 'POST', body: regChallenge, as: O });
assert.equal(made.status, 201);
const cid = made.body.id;
assert.equal((await call(`/admin/hub/data/challenges/${cid}/status`, { method: 'POST', body: { status: 'closed' }, as: A })).status, 401, 'member cannot close');

// Submitting needs an account.
const submit = (as, csv) => call(`/data/challenges/${cid}/submit`, { method: 'POST', body: { csv }, as });
const perfectCsv = 'id,price\n' + ids.map((i) => `${i},${i * 3 + 0.123}`).join('\n') + '\n';
const offBy = (d) => 'id,price\n' + ids.map((i) => `${i},${i * 3 + 0.123 + d}`).join('\n') + '\n';
assert.equal((await submit(null, perfectCsv)).status, 401);
assert.equal((await submit(A, '')).status, 400);
let r = await submit(A, 'id,price\n1,2\n');
assert.equal(r.status, 400);
assert.match(r.body.error, /rows/);
assert.equal((await submit(A, 'x'.repeat(MAX_CSV_BYTES + 5))).status, 413);

// A first valid submission scores and pays once.
r = await submit(A, offBy(2));
assert.equal(r.status, 200);
assert.equal(r.body.publicScore, 2);
assert.equal(r.body.awarded, 1, 'the first valid submission pays');
r = await submit(A, offBy(1));
assert.equal(r.status, 200);
assert.equal(r.body.awarded, 0, 'a second submission does not');
const solves = await db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE kind = 'solve' AND ref = ?`).bind(`data:${cid}`).first();
assert.equal(solves.n, 1, 'one ledger row');
const pts = await db.prepare(`SELECT COUNT(*) AS n, SUM(delta) AS d FROM point_events WHERE reason LIKE 'solve: Data:%'`).first();
assert.deepEqual({ n: pts.n, d: pts.d }, { n: 1, d: 1 }, 'one point event');
// Rank earns nothing: Ben takes first place and gets the same single payout as anyone.
r = await submit(B, perfectCsv);
assert.equal(r.body.publicScore, 0);
assert.equal(r.body.awarded, 1);
assert.equal(r.body.leaderboard[0].name, 'Ben');
assert.equal(r.body.leaderboard[0].mine, true);

// Leaderboard: first names, best score per person, nothing identifying.
r = await call(`/data/challenges/${cid}`, { as: A });
assert.deepEqual(r.body.leaderboard.map((x) => [x.rank, x.name, x.score, x.tries]), [[1, 'Ben', 0, 1], [2, 'Ana', 1, 2]]);
assert.equal(r.body.mine.tries, 2);
assert.ok(!/Lopez|Kim|@example|user_id/.test(r.text), 'first names only');

// Closing shows the final score and stops uploads.
assert.equal((await call(`/admin/hub/data/challenges/${cid}/status`, { method: 'POST', body: { status: 'closed' }, as: O })).status, 200);
assert.equal((await submit(A, offBy(1))).status, 409);
r = await call(`/data/challenges/${cid}`);
assert.equal(r.body.status, 'closed');
assert.equal(r.body.signedIn, false);
await call(`/admin/hub/data/challenges/${cid}/status`, { method: 'POST', body: { status: 'open' }, as: O });

// The hidden answers are in no response, for anyone, on any route.
const leaks = [];
const sweep = async (path, opt = {}) => {
  const res = await call(path, { ...opt, raw: true });
  if (/answers_csv|\.123/.test(res.text) || res.text.includes(SECRET_ANSWERS.slice(0, 60))) leaks.push(path);
  return res;
};
for (const as of [undefined, A, O]) {
  await sweep('/data/challenges', { as });
  await sweep(`/data/challenges/${cid}`, { as });
  await sweep(`/data/challenges/${cid}/train.csv`, { as });
  await sweep(`/data/challenges/${cid}/test.csv`, { as });
}
await sweep('/admin/hub/data/challenges', { as: O });
await sweep('/me/export', { as: A });
for (const row of (await call(`/data/challenges/${cid}`, { as: A })).body.leaderboard) assert.ok(!('answers' in row));
assert.deepEqual(leaks, [], `answers leaked from: ${leaks.join(', ')}`);
const test = await call(`/data/challenges/${cid}/test.csv`, { raw: true });
assert.equal(test.status, 200);
assert.ok(!test.text.includes('price'), 'the test file has no target column');
const train = await call(`/data/challenges/${cid}/train.csv`, { raw: true });
assert.ok(train.text.startsWith('id,size,price'));
assert.equal((await call('/data/challenges/999', { raw: true })).status, 404);
assert.equal((await call('/data/challenges/999/train.csv', { raw: true })).status, 404);

// The export of a member's data covers their submissions.
r = await call('/me/export', { as: A });
assert.equal(r.body.data_submissions.length, 2);

// Rate limit: every upload counts, valid or not.
let limited = 0;
for (let i = 0; i < 22; i++) if ((await submit(B, 'id,price\n1,1\n')).status === 429) limited++;
assert.ok(limited >= 1, 'uploads are rate limited per member and challenge');
assert.notEqual((await submit(A, offBy(1))).status, 429, 'another member is unaffected');

// Deleting a member removes their submissions.
const { purgeUser, softDelete } = await import('../worker/hub/safety.js');
const benRow = await db.prepare('SELECT * FROM users WHERE id = ?').bind(ben).first();
await softDelete(db, benRow, false);
await purgeUser(db, ben);
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM data_submissions WHERE user_id = ?').bind(ben).first()).n, 0);

// Deleting a challenge removes its submissions.
assert.equal((await call(`/admin/hub/data/challenges/${cid}`, { method: 'DELETE', as: A })).status, 401);
assert.equal((await call(`/admin/hub/data/challenges/${cid}`, { method: 'DELETE', as: O })).status, 200);
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM data_submissions').first()).n, 0);

console.log('data: ok');
