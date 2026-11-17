/**
 * Problem bank (C2): no solution leaks, input validation, the routes against
 * a real SQLite (fake D1), and the import covering every course code step,
 * with each imported solution run through a real Python.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Hono } from 'hono';

import { makeTestDb } from './d1-shim.js';
import { publicProblem, validateProblem, problemsRouter, problemsAdminRouter } from '../worker/hub/problems.js';
import { mountHub } from '../worker/hub/index.js';
import { buildProblems, toSql } from '../scripts/import-problems.mjs';
import { COURSES } from '../shared/courses.js';

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const good = { slug: 'add-two', title: 'Add', difficulty: 2, tags: 'CP, intro', cases: [{ stdin: '1 2\n', stdout: '3' }], solution: 'print(3)', status: 'live' };

/* ------------------------------ pure checks ------------------------------ */

const pub = publicProblem({ id: 1, slug: 's', solution: 'SECRET', tags: 'a,b', cases: '[{"stdin":"","stdout":"x"}]' });
assert.ok(!('solution' in pub) && !JSON.stringify(pub).includes('SECRET'));
assert.deepEqual(pub.tags, ['a', 'b']);
assert.equal(pub.cases[0].stdout, 'x');
assert.deepEqual(publicProblem({ cases: 'not json', tags: '' }).cases, []);

assert.equal(validateProblem(good).value.tags, 'cp,intro');
for (const [why, patch] of [
  ['difficulty 0', { difficulty: 0 }],
  ['difficulty 6', { difficulty: 6 }],
  ['difficulty 2.5', { difficulty: 2.5 }],
  ['cases bad JSON', { cases: '[{' }],
  ['cases not a list', { cases: { stdin: '', stdout: '' } }],
  ['case missing stdout', { cases: [{ stdin: 'x' }] }],
  ['bad slug', { slug: 'Has Space' }],
  ['bad status', { status: 'public' }],
  ['no title', { title: ' ' }],
  ['http source', { source_url: 'http://x.com' }],
  ['live with no cases', { cases: [] }],
  ['live with no solution', { solution: ' ' }],
]) assert.ok(validateProblem({ ...good, ...patch }).error, `should reject: ${why}`);
assert.ok(validateProblem({ ...good, cases: JSON.stringify(good.cases) }).value, 'cases as a JSON string is accepted');
assert.ok(validateProblem({ ...good, status: 'draft', cases: [] }).value, 'a draft may be empty');
assert.equal(validateProblem({ ...good, slug: 'BAD SLUG' }, { partial: true }).value.slug, undefined, 'slug ignored on update');

/* -------------------------------- routes --------------------------------- */

const env = { DB: makeTestDb(schema) };
const app = new Hono();
app.route('/api', problemsRouter);
app.route('/admin', problemsAdminRouter);
const call = async (method, url, body) => {
  const res = await app.request(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }, env);
  return { status: res.status, json: await res.json() };
};

let r = await call('POST', '/admin/problems', good);
assert.equal(r.status, 201);
const id = r.json.id;
assert.equal((await call('POST', '/admin/problems', good)).status, 409, 'duplicate slug');
assert.equal((await call('POST', '/admin/problems', { ...good, slug: 'x', difficulty: 9 })).status, 400);
await call('POST', '/admin/problems', { ...good, slug: 'draft-one', status: 'draft', difficulty: 4, tags: 'data' });

r = await call('GET', '/api/problems/add-two');
assert.equal(r.status, 200);
assert.ok(!('solution' in r.json) && !JSON.stringify(r.json).includes('print(3)'), 'public route leaks no solution');
assert.equal((await call('GET', '/api/problems/draft-one')).status, 404, 'drafts are not public');

r = await call('GET', '/api/problems');
assert.deepEqual(r.json.problems.map((p) => p.slug), ['add-two']);
assert.ok(r.json.problems.every((p) => !('solution' in p) && !('cases' in p)));
assert.equal((await call('GET', '/api/problems?tag=intro')).json.problems.length, 1);
assert.equal((await call('GET', '/api/problems?tag=in')).json.problems.length, 0, 'tag match is exact, not a substring');
assert.equal((await call('GET', '/api/problems?difficulty=3')).json.problems.length, 0);
assert.equal((await call('GET', '/api/problems?q=add')).json.problems.length, 1);

assert.equal((await call('GET', '/admin/problems')).json.problems.length, 2);
assert.equal((await call('GET', '/admin/problems?status=draft')).json.problems.length, 1);
assert.equal((await call('GET', `/admin/problems/${id}`)).json.solution, 'print(3)');
r = await call('POST', `/admin/problems/${id}/selfcheck`);
assert.deepEqual(r.json, { solution: 'print(3)', cases: good.cases });

assert.equal((await call('PUT', `/admin/problems/${id}`, { ...good, title: 'Add numbers', slug: 'hijack' })).status, 200);
r = await call('GET', '/api/problems/add-two');
assert.equal(r.json.title, 'Add numbers', 'update applied and slug unchanged');
assert.equal((await call('PUT', '/admin/problems/999', good)).status, 404);

assert.equal((await call('POST', `/admin/problems/${id}/retire`)).status, 200);
assert.equal((await call('GET', '/api/problems/add-two')).status, 404, 'retired leaves the public bank');

// The real mount: officer routes refuse a caller with no officer cookie.
{
  const full = new Hono();
  mountHub(full);
  for (const [m, u] of [['GET', '/api/admin/hub/problems'], ['POST', '/api/admin/hub/problems'], ['POST', '/api/admin/hub/problems/1/selfcheck'], ['GET', '/api/admin/hub/problems/1']]) {
    const res = await full.request(u, { method: m }, { ...env, ADMIN_PASSWORD: 'x', SESSION_SECRET: 'y' });
    assert.equal(res.status, 401, `${m} ${u} must need an officer`);
  }
}

/* --------------------------------- import --------------------------------- */

const rows = buildProblems();
const codeSteps = COURSES.flatMap((c) => c.steps.filter((s) => s.kind === 'code').map((s) => `${c.slug}-${s.id}`));
assert.equal(rows.length, codeSteps.length);
assert.deepEqual(rows.map((x) => x.slug).sort(), [...codeSteps].sort());
assert.equal(new Set(rows.map((x) => x.slug)).size, rows.length, 'imported slugs are unique');
for (const row of rows) assert.ok(validateProblem(row).value, `${row.slug} passes validation`);

// The committed SQL is current, loads into the schema, and loading twice adds nothing.
// Git on Windows may check the file out with CRLF line endings; compare content, not bytes.
const sql = fs.readFileSync(new URL('../worker/seed-problems.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.equal(sql, toSql(rows), 'worker/seed-problems.sql is stale: run npm run build:problems');
const db = makeTestDb(schema);
db.exec(sql);
db.exec(sql);
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM problems').first()).n, rows.length);
const one = await db.prepare('SELECT * FROM problems WHERE slug = ?').bind(rows[0].slug).first();
assert.deepEqual(JSON.parse(one.cases), JSON.parse(rows[0].cases), 'cases survive SQL escaping');
assert.equal(one.solution, rows[0].solution);

const py = ['python', 'python3', 'py'].find((bin) => spawnSync(bin, ['--version']).status === 0);
if (!py) {
  console.log('problems: python not found, skipped running imported solutions');
} else {
  const norm = (s) => s.replace(/\r\n/g, '\n').trim();
  let ran = 0;
  for (const row of (await db.prepare('SELECT * FROM problems').all()).results) {
    for (const [i, cs] of JSON.parse(row.cases).entries()) {
      const p = spawnSync(py, ['-c', row.solution], { input: cs.stdin, encoding: 'utf8', timeout: 10_000 });
      assert.equal(p.status, 0, `${row.slug} case ${i} crashed: ${p.stderr}`);
      assert.equal(norm(p.stdout), norm(cs.stdout), `${row.slug} case ${i}`);
      ran++;
    }
  }
  console.log(`problems: ran ${ran} imported cases through ${py}`);
}
console.log('problems: ok');
