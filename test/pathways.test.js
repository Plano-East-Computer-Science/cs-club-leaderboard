/**
 * E5 pathways: every step points at something that exists, the done rules,
 * ticks are private, nothing pays points, follows are capped, export and
 * purge cover the new tables, and a followed pathway feeds Today.
 * Routes run through the real Worker on the fake D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { purgeDeleted } from '../worker/hub/safety.js';
import { pickNext } from '../worker/hub/dashboard.js';
import { PATHWAYS, MAX_FOLLOW, autoDone, stepStates, nextPathwayStep, linkOf } from '../shared/pathways.js';
import { STARTERS } from '../src/lib/starters.js';
import { OPPORTUNITIES, COMPETITIONS } from '../shared/seed-data.js';
import { COURSES } from '../shared/courses.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

/* ------------------------------ content ------------------------------ */

const RUNG_SQL = read('../worker/seed-rungs.sql');
const ROUTES = [...read('../src/App.jsx').matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const routeExists = (to) => {
  const path = to.split(/[?#]/)[0];
  return ROUTES.some((r) => new RegExp(`^${r.replace(/:[a-z]+/g, '[^/]+')}$`).test(path));
};

await check('every pathway has 5 to 9 steps with unique ids, a time and a why', async () => {
  assert.equal(PATHWAYS.length, 5);
  assert.equal(new Set(PATHWAYS.map((p) => p.id)).size, PATHWAYS.length);
  for (const p of PATHWAYS) {
    assert.ok(p.steps.length >= 5 && p.steps.length <= 9, `${p.id} has ${p.steps.length} steps`);
    assert.equal(new Set(p.steps.map((s) => s.id)).size, p.steps.length, `${p.id} step ids are unique`);
    for (const s of p.steps) {
      assert.ok(s.title && s.time && s.why, `${p.id}/${s.id} has title, time and why`);
      assert.ok(/^[a-z0-9-]+$/.test(s.id), `${p.id}/${s.id} is a safe id`);
    }
  }
});

await check('copy follows the house rules: no em dashes, no exclamation marks', async () => {
  const text = JSON.stringify(PATHWAYS);
  assert.ok(!text.includes('—'), 'no em dash');
  assert.ok(!text.includes('!'), 'no exclamation mark');
});

await check('every step reference resolves to something that exists', async () => {
  for (const p of PATHWAYS) {
    for (const s of p.steps) {
      const where = `${p.id}/${s.id}`;
      if (s.kind === 'rung') {
        assert.ok(RUNG_SQL.includes(`'${s.track}', `) && new RegExp(`VALUES \\('${s.track}', '[a-z]+', \\d+, '(?:[^']|'')*', '${s.url.replace(/[.?]/g, '\\$&')}'`).test(RUNG_SQL), `${where}: rung ${s.track} ${s.url} is in the seed`);
        if (s.url.startsWith('/learn/')) assert.ok(COURSES.some((c) => c.slug === s.url.slice(7)), `${where}: course exists`);
      } else if (s.kind === 'starter') {
        assert.ok(STARTERS.some((x) => x.slug === s.slug), `${where}: starter ${s.slug} exists`);
      } else if (s.kind === 'opp') {
        const f = { opps: OPPORTUNITIES };
        assert.ok(autoDone(s, { ...f, rungs: new Set(), courses: new Set(), comps: [] }), `${where}: a seeded opportunity matches`);
      } else if (s.kind === 'comp') {
        assert.ok(COMPETITIONS.some((c) => c.name.toLowerCase().includes(s.match.toLowerCase())), `${where}: a seeded competition matches`);
      } else if (s.kind === 'cycle') {
        assert.ok(['enter', 'ship'].includes(s.need), where);
      } else if (s.kind === 'portfolio') {
        assert.ok(['public', 'signoff', 'record'].includes(s.need), where);
      } else {
        assert.ok(['link', 'project'].includes(s.kind), `${where}: known kind ${s.kind}`);
      }
      const to = linkOf(s, 7);
      if (to.startsWith('/')) assert.ok(routeExists(to), `${where}: route ${to} exists`);
      else if (to) assert.ok(to.startsWith('https://'), `${where}: outside links are https`);
    }
  }
});

/* ------------------------------ done rules ------------------------------ */

const none = { rungs: new Set(), courses: new Set(), opps: [], comps: [], entered: false, shipped: false, projects: 0, public: false, signoff: false, record: false };

await check('auto-completion reads the data, and hand-only steps never tick themselves', async () => {
  const rung = { kind: 'rung', track: 'contest', url: '/learn/python-contests' };
  assert.equal(autoDone(rung, none), false);
  assert.equal(autoDone(rung, { ...none, rungs: new Set(['contest /learn/python-contests']) }), true);
  assert.equal(autoDone(rung, { ...none, courses: new Set(['python-contests']) }), true, 'a finished course counts for its rung');
  assert.equal(autoDone(rung, { ...none, rungs: new Set(['build /learn/python-contests']) }), false, 'track matters');
  assert.equal(autoDone({ kind: 'opp', type: 'internship' }, { ...none, opps: [{ title: 'X', org: '', type: 'program' }] }), false);
  assert.equal(autoDone({ kind: 'opp', type: 'internship' }, { ...none, opps: [{ title: 'X', org: '', type: 'internship' }] }), true);
  assert.equal(autoDone({ kind: 'opp', match: 'usaco' }, { ...none, opps: [{ title: 'USA Computing Olympiad (USACO)', org: '', type: 'competition' }] }), true);
  assert.equal(autoDone({ kind: 'comp', match: 'UIL' }, { ...none, comps: ['HP CodeWars'] }), false);
  assert.equal(autoDone({ kind: 'comp', match: '' }, { ...none, comps: ['HP CodeWars'] }), true, 'empty match is any competition');
  assert.equal(autoDone({ kind: 'cycle', need: 'enter' }, { ...none, shipped: true }), true, 'shipping implies entering');
  assert.equal(autoDone({ kind: 'cycle', need: 'ship' }, { ...none, entered: true }), false);
  assert.equal(autoDone({ kind: 'portfolio', need: 'record' }, { ...none, record: true }), true);
  assert.equal(autoDone({ kind: 'link', url: 'https://usaco.org/' }, { ...none, rungs: new Set(['x']) }), false);
  assert.equal(autoDone({ kind: 'starter', slug: 'personal-site' }, none), false);
});

await check('the next step skips what is done, by data or by tick, across followed pathways', async () => {
  const p = PATHWAYS[0];
  const ticks = new Set([p.steps[1].id]);
  const facts = { ...none, rungs: new Set([`${p.steps[0].track} ${p.steps[0].url}`]) };
  const st = stepStates(p, facts, ticks);
  assert.deepEqual(st.slice(0, 3).map((s) => [s.auto, s.ticked, s.done]), [[true, false, true], [false, true, true], [false, false, false]]);
  const n = nextPathwayStep([{ id: p.id, ticks }], facts);
  assert.equal(n.step.id, p.steps[2].id);
  assert.equal(n.n, 3);
  // A finished pathway hands over to the second one.
  const all = new Set(p.steps.map((s) => s.id));
  const m = nextPathwayStep([{ id: p.id, ticks: all }, { id: 'ap-csa', ticks: new Set() }], none);
  assert.equal(m.pathway.id, 'ap-csa');
  assert.equal(nextPathwayStep([{ id: p.id, ticks: all }], none), null);
  assert.equal(nextPathwayStep([{ id: 'gone', ticks: new Set() }], none), null, 'an unknown id is ignored');
});

await check('Today: a followed pathway beats the compass path, but not the compass or an open claim', async () => {
  const base = { compassDone: true, path: 'contest', openClaim: null, daily: { available: true, done: false }, arena: { rung: null }, firsts: [], quest: null };
  const pathway = { pathway: { id: 'usaco-silver', title: 'USACO Silver by March' }, step: { title: 'Time complexity' }, n: 4, total: 9 };
  assert.equal(pickNext(base).kind, 'daily', 'unchanged without a pathway');
  const n = pickNext({ ...base, pathway });
  assert.equal(n.kind, 'pathway');
  assert.equal(n.title, 'Time complexity');
  assert.equal(n.to, '/pathways/usaco-silver');
  assert.match(n.why, /Step 4 of 9/);
  assert.equal(pickNext({ ...base, pathway, compassDone: false }).kind, 'compass');
  assert.equal(pickNext({ ...base, pathway, openClaim: { id: 1, title: 'USACO' } }).kind, 'claim');
});

/* ------------------------------ routes ------------------------------ */

const env = { ADMIN_PASSWORD: 'x', SESSION_SECRET: 'test-secret', DEV_LOGIN: '1', DB: makeTestDb(read('../worker/schema.sql')) };
const db = env.DB;
db.exec(RUNG_SQL);

async function addUser(name) {
  const s = await db.prepare('INSERT INTO students (name, grade) VALUES (?, 11)').bind(name).run();
  const u = await db.prepare('INSERT INTO users (email, name, student_id) VALUES (?, ?, ?)').bind(`${name.toLowerCase()}@example.com`, name, s.meta.last_row_id).run();
  const id = u.meta.last_row_id;
  return { id, sid: s.meta.last_row_id, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
}

async function call(path, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, {
    waitUntil() {},
    passThroughOnException() {},
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
}

const maya = await addUser('Maya');
const sam = await addUser('Sam');
const count = async (t, col, v) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ?`).bind(v).first()).n;

await check('signed-out callers get 401, unknown pathways and steps 404, bad bodies 400', async () => {
  assert.equal((await call('/me/pathways')).status, 401);
  assert.equal((await call('/me/pathways/usaco-silver/follow', { method: 'POST' })).status, 401);
  assert.equal((await call('/me/pathways/nope', { cookie: maya.cookie })).status, 404);
  assert.equal((await call('/me/pathways/nope/follow', { method: 'POST', cookie: maya.cookie })).status, 404);
  assert.equal((await call('/me/pathways/usaco-silver/steps/nope', { method: 'PUT', cookie: maya.cookie, body: { done: true } })).status, 404);
  assert.equal((await call('/me/pathways/usaco-silver/steps/time', { method: 'PUT', cookie: maya.cookie, body: { done: 'yes' } })).status, 400);
});

await check('a done rung ticks its step without a hand tick', async () => {
  const rung = await db.prepare(`SELECT id FROM rungs WHERE track = 'contest' AND url = 'https://usaco.guide/bronze/time-comp'`).first();
  await db.prepare(`INSERT INTO rung_progress (user_id, rung_id, status, done_at, method) VALUES (?, ?, 'done', datetime('now'), 'self')`).bind(maya.id, rung.id).run();
  const r = await call('/me/pathways/usaco-silver', { cookie: maya.cookie });
  const s = r.body.steps.find((x) => x.id === 'time');
  assert.deepEqual([s.auto, s.ticked, s.done], [true, false, true]);
  assert.equal((await call('/me/pathways', { cookie: maya.cookie })).body.progress['usaco-silver'].done, 1);
});

await check('ticks are private to the member and pay no points', async () => {
  const before = [await count('activity', 'student_id', maya.sid), await count('point_events', 'student_id', maya.sid)];
  assert.equal((await call('/me/pathways/usaco-silver/steps/account', { method: 'PUT', cookie: maya.cookie, body: { done: true } })).status, 200);
  assert.equal((await call('/me/pathways/usaco-silver/follow', { method: 'POST', cookie: maya.cookie })).status, 200);
  const mine = (await call('/me/pathways/usaco-silver', { cookie: maya.cookie })).body;
  assert.equal(mine.steps.find((x) => x.id === 'account').ticked, true);
  assert.equal(mine.following, true);
  const theirs = (await call('/me/pathways/usaco-silver', { cookie: sam.cookie })).body;
  assert.equal(theirs.steps.find((x) => x.id === 'account').done, false, 'Sam does not see Maya\'s tick');
  assert.equal(theirs.following, false);
  assert.deepEqual([await count('activity', 'student_id', maya.sid), await count('point_events', 'student_id', maya.sid)], before, 'no ledger rows');
  // Unticking removes it.
  await call('/me/pathways/usaco-silver/steps/account', { method: 'PUT', cookie: maya.cookie, body: { done: false } });
  assert.equal((await call('/me/pathways/usaco-silver', { cookie: maya.cookie })).body.steps.find((x) => x.id === 'account').ticked, false);
});

await check(`a member follows at most ${MAX_FOLLOW} pathways`, async () => {
  assert.equal((await call('/me/pathways/ap-csa/follow', { method: 'POST', cookie: maya.cookie })).status, 200);
  const third = await call('/me/pathways/science-fair/follow', { method: 'POST', cookie: maya.cookie });
  assert.equal(third.status, 409);
  assert.match(third.body.error, /Stop following one/);
  assert.equal((await call('/me/pathways/ap-csa/follow', { method: 'POST', cookie: maya.cookie })).status, 200, 'following again is a no-op');
  assert.equal((await call('/me/pathways/ap-csa/follow', { method: 'DELETE', cookie: maya.cookie })).status, 200);
  assert.deepEqual((await call('/me/pathways', { cookie: maya.cookie })).body.following, ['usaco-silver']);
});

await check('Today shows the followed pathway\'s next step', async () => {
  await db.prepare(`UPDATE users SET path = 'contest', compass_at = datetime('now') WHERE id = ?`).bind(maya.id).run();
  const r = await call('/me/dashboard', { cookie: maya.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.body.next.kind, 'pathway');
  assert.equal(r.body.next.title, 'Python for contests', 'first undone step');
  assert.equal(r.body.next.to, '/pathways/usaco-silver');
  await db.prepare(`UPDATE users SET path = 'contest', compass_at = datetime('now') WHERE id = ?`).bind(sam.id).run();
  assert.notEqual((await call('/me/dashboard', { cookie: sam.cookie })).body.next.kind, 'pathway', 'no pathway, no pathway action');
});

await check('export includes follows and ticks; purge removes them', async () => {
  await call('/me/pathways/usaco-silver/steps/mock', { method: 'PUT', cookie: maya.cookie, body: { done: true } });
  const ex = JSON.parse((await call('/me/export', { cookie: maya.cookie })).text);
  assert.deepEqual(ex.pathways_followed.map((r) => r.pathway), ['usaco-silver']);
  assert.deepEqual(ex.pathway_ticks.map((r) => r.step), ['mock']);
  assert.equal(JSON.parse((await call('/me/export', { cookie: sam.cookie })).text).pathway_ticks.length, 0);

  assert.equal((await call('/me/account', { method: 'DELETE', cookie: maya.cookie, body: { confirm: 'delete' } })).status, 200);
  await purgeDeleted(db, { graceMs: 0, now: Date.now() + 1000 });
  assert.equal(await count('pathway_follows', 'user_id', maya.id), 0);
  assert.equal(await count('pathway_ticks', 'user_id', maya.id), 0);
});

console.log(`pathways: ${passed} checks passed`);
