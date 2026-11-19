/**
 * Problem sets (V3-B): shape and bank validation, the officer routes and who
 * may call them, a duel opened from a pack in the room, and the starter
 * format (plain string or { java, python }) every reader gets through
 * publicProblem.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hono } from 'hono';

import { makeTestDb } from './d1-shim.js';
import { checkSet, slugsOf, setsAdminRouter } from '../worker/hub/sets.js';
import { publicProblem, problemsRouter, problemsAdminRouter } from '../worker/hub/problems.js';
import { parseStarter } from '../shared/starter.js';
import { mountHub } from '../worker/hub/index.js';
import { Room } from '../worker/hub/room-do.js';

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

/* ------------------------------ pure checks ------------------------------ */

const full = { practice: 'p0', new: ['n1', 'n2', 'n3'], comfortable: ['c1', 'c2', 'c3'], contest: ['x1', 'x2', 'x3'], final: 'f' };
const duel = { slug: 'pack-a', kind: 'duel', title: 'Pack A', status: 'live', body: full };

assert.ok(checkSet(duel).value, 'a full live duel pack passes');
assert.deepEqual(slugsOf('duel', full), ['p0', 'n1', 'n2', 'n3', 'c1', 'c2', 'c3', 'x1', 'x2', 'x3', 'f']);
assert.ok(checkSet({ ...duel, body: { ...full, final: null } }).value, 'the final is optional');
assert.ok(checkSet({ ...duel, status: 'draft', body: { new: ['n1'] } }).value, 'a draft may be partial');
assert.deepEqual(checkSet({ ...duel, status: 'draft', body: {} }).value.body, { practice: null, final: null, new: [], comfortable: [], contest: [] });
for (const [why, patch] of [
  ['live with 2 in a division', { body: { ...full, contest: ['x1', 'x2'] } }],
  ['live with no practice', { body: { ...full, practice: null } }],
  ['4 in a division', { status: 'draft', body: { new: ['a', 'b', 'c', 'd'] } }],
  ['duplicate across divisions', { body: { ...full, contest: ['x1', 'x2', 'n1'] } }],
  ['practice repeated as final', { body: { ...full, final: 'p0' } }],
  ['division not a list', { status: 'draft', body: { new: 'n1' } }],
  ['slug not a string', { status: 'draft', body: { new: [7] } }],
  ['bad problem slug', { status: 'draft', body: { new: ['Has Space'] } }],
  ['bad set slug', { slug: 'Pack A' }],
  ['no title', { title: '  ' }],
  ['bad kind', { kind: 'quiz' }],
  ['bad status', { status: 'public' }],
]) assert.ok(checkSet({ ...duel, ...patch }).error, `should reject: ${why}`);

const contest = { slug: 'set-b', kind: 'contest', title: 'Set B', status: 'live', body: { problems: ['x1', 'x2'] } };
assert.deepEqual(checkSet(contest).value.body.problems, ['x1', 'x2'], 'contest order kept');
assert.ok(checkSet({ ...contest, body: { problems: [] } }).error, 'a live contest set needs a problem');
assert.ok(checkSet({ ...contest, status: 'draft', body: { problems: [] } }).value);
assert.ok(checkSet({ ...contest, body: { problems: ['x1', 'x1'] } }).error, 'no duplicates in a contest set');
assert.ok(checkSet({ ...contest, body: { problems: Array.from({ length: 13 }, (_, i) => `p${i}`) } }).error, 'contest size capped');
assert.equal(checkSet({ ...duel, kind: 'contest' }, { partial: true, kind: 'duel' }).value.kind, 'duel', 'kind fixed on update');

/* ------------------------------- starters ------------------------------- */

assert.deepEqual(parseStarter('n = int(input())\n'), { java: '', python: 'n = int(input())\n' }, 'plain string is Python');
assert.deepEqual(parseStarter(JSON.stringify({ java: 'class Main {}', python: 'x = 1' })), { java: 'class Main {}', python: 'x = 1' });
assert.deepEqual(parseStarter('{ not json'), { java: '', python: '{ not json' });
assert.deepEqual(parseStarter('{"a": 1}'), { java: '', python: '{"a": 1}' }, 'JSON without a language is left as text');
assert.deepEqual(parseStarter(null), { java: '', python: '' });
{
  const both = publicProblem({ slug: 's', tags: '', cases: '[]', solution: 'x', starter: JSON.stringify({ java: 'J', python: 'P' }) });
  assert.equal(both.starter, 'P', 'readers of .starter get the Python text');
  assert.deepEqual(both.starters, { java: 'J', python: 'P' });
  const legacy = publicProblem({ slug: 's', tags: '', cases: '[]', solution: 'x', starter: 'print(1)' });
  assert.equal(legacy.starter, 'print(1)');
  assert.deepEqual(legacy.starters, { java: '', python: 'print(1)' });
}

/* -------------------------------- routes --------------------------------- */

const db = makeTestDb(schema);
const env = { DB: db };
for (const s of ['p0', 'n1', 'n2', 'n3', 'c1', 'c2', 'c3', 'x1', 'x2', 'x3', 'f']) {
  db.exec(`INSERT INTO problems (slug, title, difficulty, cases, solution, status, starter) VALUES ('${s}', 'T ${s}', 2, '[]', 'x', 'live', '{"java":"J","python":"P"}')`);
}
db.exec(`INSERT INTO problems (slug, title, cases, solution, status) VALUES ('old', 'Old', '[]', 'x', 'retired'), ('wip', 'Wip', '[]', '', 'draft')`);
db.exec(`INSERT INTO users (id, email, name) VALUES (1, 'a@x.org', 'Ana'), (2, 'b@x.org', 'Ben')`);
db.exec(`INSERT INTO problem_solves (user_id, slug, ms) VALUES (1, 'n1', 5), (2, 'n1', 9)`);
db.exec(`INSERT INTO duel_results (room_code, round, division, match_no, user_id, slug, attempts, solved_ms, won) VALUES ('R', 1, 'new', 1, 1, 'n1', 1, 4, 1), ('R', 1, 'new', 1, 2, 'n2', 2, NULL, 0)`);

const app = new Hono();
app.use('*', async (c, next) => {
  c.set('officer', { userId: null, name: 'tester', role: 'lead' });
  await next();
});
app.route('/admin', setsAdminRouter);
app.route('/admin', problemsAdminRouter);
app.route('/api', problemsRouter);
const call = async (method, url, body) => {
  const res = await app.request(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }, env);
  return { status: res.status, json: await res.json() };
};

let r = await call('GET', '/admin/sets/bank');
assert.equal(r.status, 200);
assert.equal(r.json.problems.find((p) => p.slug === 'n1').solvers, 2, 'a member counted once across practice and duels');
assert.equal(r.json.problems.find((p) => p.slug === 'n2').solvers, 0, 'an unsolved duel attempt does not count');
assert.ok(!r.json.problems.some((p) => ['old', 'wip'].includes(p.slug)), 'the picker lists live problems only');

r = await call('POST', '/admin/sets', duel);
assert.equal(r.status, 201);
const id = r.json.id;
assert.equal((await call('POST', '/admin/sets', duel)).status, 409, 'duplicate slug');
r = await call('POST', '/admin/sets', { ...duel, slug: 'pack-b', body: { ...full, final: 'old' } });
assert.equal(r.status, 400);
assert.match(r.json.error, /old/, 'a retired problem is refused by name');
assert.equal((await call('POST', '/admin/sets', { ...duel, slug: 'pack-c', status: 'draft', body: { new: ['wip'] } })).status, 400, 'a draft problem is refused even in a draft set');
assert.equal((await call('POST', '/admin/sets', { ...duel, slug: 'pack-d', status: 'draft', body: { new: ['nope'] } })).status, 400, 'an unknown slug is refused');
assert.equal((await call('POST', '/admin/sets', { ...duel, slug: 'pack-e', body: { ...full, new: ['n1'] } })).status, 400, 'live needs 3 per division');

r = await call('GET', `/admin/sets/${id}`);
assert.equal(r.json.body.new.length, 3);
assert.equal(r.json.problems.x3.title, 'T x3', 'titles come with the set');
assert.equal((await call('GET', '/admin/sets/999')).status, 404);
assert.equal((await call('GET', '/admin/sets/abc')).status, 404);

// Update keeps the slug and kind; a live set stays complete.
assert.equal((await call('PUT', `/admin/sets/${id}`, { title: 'Pack A2', slug: 'hijack', kind: 'contest', body: { ...full, final: null } })).status, 200);
r = await call('GET', `/admin/sets/${id}`);
assert.deepEqual([r.json.slug, r.json.kind, r.json.title, r.json.body.final], ['pack-a', 'duel', 'Pack A2', null]);
assert.equal((await call('PUT', `/admin/sets/${id}`, { title: 'x', body: { ...full, comfortable: ['c1'] } })).status, 400, 'a live set cannot lose problems');
assert.equal((await call('PUT', '/admin/sets/999', { title: 'x', body: full })).status, 404);

// Status: back to draft, then a partial draft cannot go live.
assert.equal((await call('POST', `/admin/sets/${id}/status`, { status: 'draft' })).status, 200);
assert.equal((await call('PUT', `/admin/sets/${id}`, { title: 'Pack A2', body: { ...full, contest: ['x1'] } })).status, 200, 'a draft may be partial');
assert.equal((await call('POST', `/admin/sets/${id}/status`, { status: 'live' })).status, 400);
assert.equal((await call('POST', `/admin/sets/${id}/status`, { status: 'gone' })).status, 400);
await call('PUT', `/admin/sets/${id}`, { title: 'Pack A2', body: full });
assert.equal((await call('POST', `/admin/sets/${id}/status`, { status: 'live' })).status, 200);

r = await call('POST', '/admin/sets', contest);
assert.equal(r.status, 201);
assert.deepEqual((await call('GET', '/admin/sets?kind=duel&status=live')).json.sets.map((s) => s.slug), ['pack-a']);
assert.equal((await call('GET', '/admin/sets')).json.sets.length, 2);

// The officer editor keeps the raw starter; the public page gets the Python text.
const pid = (await db.prepare(`SELECT id FROM problems WHERE slug = 'n1'`).first()).id;
assert.equal((await call('GET', `/admin/problems/${pid}`)).json.starter, '{"java":"J","python":"P"}');
r = await call('GET', '/api/problems/n1');
assert.equal(r.json.starter, 'P');
assert.equal(r.json.starters.java, 'J');

// The real mount: every set route needs an officer.
{
  const site = new Hono();
  mountHub(site);
  for (const [m, u] of [['GET', '/api/admin/hub/sets'], ['GET', '/api/admin/hub/sets/bank'], ['GET', `/api/admin/hub/sets/${id}`], ['POST', '/api/admin/hub/sets'], ['PUT', `/api/admin/hub/sets/${id}`], ['POST', `/api/admin/hub/sets/${id}/status`]]) {
    const res = await site.request(u, { method: m }, { ...env, ADMIN_PASSWORD: 'x', SESSION_SECRET: 'y' });
    assert.equal(res.status, 401, `${m} ${u} must need an officer`);
  }
}

/* ----------------------- a duel from a pack, in the room ----------------------- */

{
  class Ws {
    constructor(att) {
      this.att = att;
      this.sent = [];
    }
    deserializeAttachment() {
      return this.att;
    }
    send(x) {
      this.sent.push(JSON.parse(x));
    }
  }
  const host = new Ws({ role: 'host', uid: 'host' });
  const ana = new Ws({ role: 'student', uid: '1', name: 'Ana' });
  const store = new Map();
  const ctx = {
    storage: {
      get: async (k) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k)),
      put: async (k, v) => void store.set(k, v),
      setAlarm: async () => {},
    },
    blockConcurrencyWhile: (fn) => fn(),
    getWebSockets: () => [host, ana],
  };
  const room = new Room(ctx, { DB: db });
  await new Promise((res) => setTimeout(res, 0));
  Object.assign(room.s, { code: 'PACK', names: { 1: 'Ana' } });
  const msg = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m));

  await msg(ana, { t: 'duel_setup', set: 'pack-a' });
  assert.equal(room.s.duel, null, 'a student cannot open a duel from a pack');

  await msg(host, { t: 'duel_setup', set: 'set-b' });
  assert.equal(room.s.duel, null, 'a contest set is not a duel pack');
  assert.equal(host.sent.at(-1).text, 'That duel pack is not live.');

  // The message's own problem list is ignored when a set is named.
  await msg(host, { t: 'duel_setup', set: 'pack-a', problems: { new: ['wip'] }, minutes: 12 });
  assert.deepEqual(room.s.duel.problems.new.map((p) => p.slug), ['n1', 'n2', 'n3']);
  assert.deepEqual(room.s.duel.problems.contest, [{ slug: 'x1', title: 'T x1' }, { slug: 'x2', title: 'T x2' }, { slug: 'x3', title: 'T x3' }]);
  assert.equal(room.s.duel.minutes, 12);
  await msg(host, { t: 'duel_close' });

  await call('POST', `/admin/sets/${id}/status`, { status: 'draft' });
  await msg(host, { t: 'duel_setup', set: 'pack-a' });
  assert.equal(room.s.duel, null, 'a draft pack cannot be played');
}

console.log('sets: ok');
