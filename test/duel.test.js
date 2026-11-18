/**
 * Duel block (B2) and pair maker (B9): matching, the round lifecycle, what
 * the server refuses, the ledger mapping, and the room Durable Object glue
 * (host-only controls, results written to D1 with code) over a fake D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hono } from 'hono';

import { makeTestDb } from './d1-shim.js';
import { makePairs, groupKeys, pairKey } from '../worker/hub/pairs.js';
import { newDuel, setDivision, startRound, submit, endRound, everyoneSolved, pickSpotlight, finish, duelView } from '../worker/hub/duel.js';
import { duelActivities } from '../worker/hub/duel-awards.js';
import { Room } from '../worker/hub/room-do.js';
import { mountHub } from '../worker/hub/index.js';

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

// Seeded generator so failures reproduce.
function rng(seed = 7) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
const ids = (n) => Array.from({ length: n }, (_, i) => `u${i + 1}`);
const flat = (groups) => groups.flat().sort();

/* ------------------------------ B9 pair maker ----------------------------- */

{
  const g6 = makePairs(ids(6), { rng: rng() });
  assert.equal(g6.length, 3);
  assert.ok(g6.every((g) => g.length === 2));
  assert.deepEqual(flat(g6), ids(6).sort(), 'everyone placed exactly once');

  const g5 = makePairs(ids(5), { rng: rng() });
  assert.deepEqual(g5.map((g) => g.length).sort(), [2, 3], 'odd count: one trio');
  assert.deepEqual(flat(g5), ids(5).sort());

  assert.deepEqual(makePairs(['solo']), [['solo']]);
  assert.deepEqual(makePairs([]), []);
  assert.equal(makePairs(['a', 'a', 'b']).length, 1, 'duplicates collapse');

  // Rotation: ten presses in a row, never the same two as the press before.
  // Odd counts: a trio after a trio of five people cannot always avoid one repeat.
  for (const n of [4, 5, 6, 7, 8, 9, 12]) {
    let prev = [];
    const r = rng(n);
    for (let i = 0; i < 10; i++) {
      const groups = makePairs(ids(n), { avoid: prev, rng: r });
      const keys = groupKeys(groups);
      assert.ok(keys.filter((k) => prev.includes(k)).length <= (n % 2 && n <= 5 ? 1 : 0), `repeat pair with ${n} people on press ${i}`);
      prev = keys;
    }
  }
  // Two people: a repeat is unavoidable, so they are paired anyway.
  assert.deepEqual(flat(makePairs(['a', 'b'], { avoid: [pairKey('a', 'b')] })), ['a', 'b']);

  // Mixed: strongest with weakest.
  const mixed = makePairs(['a', 'b', 'c', 'd'], { mode: 'mixed', levels: { a: 3, b: 2, c: 1, d: 0 }, rng: rng() });
  assert.deepEqual(mixed.map((g) => [...g].sort().join('')).sort(), ['ad', 'bc']);

  // Squad: same squad together when possible.
  const sq = makePairs(['a', 'b', 'c', 'd'], { mode: 'squad', squads: { a: 1, c: 1, b: 2, d: 2 }, rng: rng() });
  assert.deepEqual(sq.map((g) => [...g].sort().join('')).sort(), ['ac', 'bd']);
}

/* ------------------------------- B2 matching ------------------------------ */

const P = (slug) => ({ slug, title: slug.toUpperCase() });
const setup = (over = {}) => newDuel({ problems: { new: [P('n1'), P('n2')], comfortable: [P('c1')], contest: [P('k1'), P('k2'), P('k3'), P('k4')] }, ...over }).duel;

assert.ok(newDuel({ problems: {} }).error, 'no problems is refused');
assert.ok(newDuel({ problems: { new: [P('a')] }, minutes: 0 }).error);
assert.ok(newDuel({ problems: { new: [P('a')] }, rounds: 9 }).error);
assert.equal(setup().problems.contest.length, 3, 'at most three problems per division');
assert.equal(setup().minutes, 10);
assert.equal(setup().rounds, 3);

{
  const d = setup();
  assert.ok(setDivision(d, 'x', 'expert').error);
  for (const u of ['a', 'b', 'c']) setDivision(d, u, 'new');
  for (const u of ['d', 'e']) setDivision(d, u, 'comfortable');
  setDivision(d, 'f', 'contest');
  setDivision(d, 'gone', 'contest');
  assert.ok(startRound(d, { now: 0, present: [] }).error, 'nobody present');
  assert.equal(d.phase, 'lobby', 'a refused start changes nothing');

  assert.ok(startRound(d, { now: 1000, present: ['a', 'b', 'c', 'd', 'e', 'f'], ghostTimes: { k1: 90_000 }, rng: rng() }).ok);
  const byDiv = (div) => d.matches.filter((m) => m.div === div);
  assert.equal(byDiv('new').length, 1, 'three in New: one 3-way');
  assert.equal(byDiv('new')[0].sides.length, 3);
  assert.equal(byDiv('new')[0].slug, 'n1');
  assert.equal(byDiv('comfortable').length, 1);
  assert.equal(byDiv('comfortable')[0].sides.length, 2);
  const ghost = byDiv('contest')[0];
  assert.ok(ghost.ghost && ghost.sides.length === 1 && ghost.ghostMs === 90_000, 'alone: races the ghost');
  assert.ok(!d.matches.some((m) => m.sides.some((s) => s.uids.includes('gone'))), 'absent students are not matched');
  assert.equal(d.endsAt, 1000 + 10 * 60_000);
  assert.ok(setDivision(d, 'a', 'contest').error, 'no switching mid-match');
  assert.ok(startRound(d, { now: 1, present: ['a'] }).error, 'one round at a time');
}

{
  // 2v2 for New: four people become two driver/navigator teams in one match.
  const d = setup({ newMode: '2v2' });
  for (const u of ['a', 'b', 'c', 'd']) setDivision(d, u, 'new');
  startRound(d, { now: 0, present: ['a', 'b', 'c', 'd'], rng: rng() });
  assert.equal(d.matches.length, 1);
  assert.deepEqual(d.matches[0].sides.map((s) => s.uids.length), [2, 2]);

  // Fewer than four: plain 1v1.
  const d3 = setup({ newMode: '2v2' });
  for (const u of ['a', 'b']) setDivision(d3, u, 'new');
  startRound(d3, { now: 0, present: ['a', 'b'], rng: rng() });
  assert.deepEqual(d3.matches[0].sides.map((s) => s.uids.length), [1, 1]);
}

{
  // No repeat opponents between rounds.
  const d = setup({ rounds: 3 });
  const people = ids(6);
  for (const u of people) setDivision(d, u, 'contest');
  let prev = [];
  const r = rng(3);
  for (let round = 1; round <= 3; round++) {
    assert.ok(startRound(d, { now: round * 1e6, present: people, rng: r }).ok);
    const keys = d.matches.flatMap((m) => groupKeys([m.sides.map((s) => s.uids[0])]));
    assert.ok(!keys.some((k) => prev.includes(k)), `round ${round} repeats an opponent`);
    assert.equal(d.matches[0].slug, `k${round}`, 'problems used in order');
    prev = keys;
    endRound(d, round * 1e6 + 1);
  }
  assert.ok(startRound(d, { now: 9e6, present: people }).error, 'no round after the last');
}

/* ---------------------------- B2 round lifecycle --------------------------- */

{
  const d = setup();
  for (const u of ['a', 'b']) setDivision(d, u, 'comfortable');
  setDivision(d, 'z', 'contest');
  setDivision(d, 'late', 'comfortable');
  startRound(d, { now: 0, present: ['a', 'b', 'z'], ghostTimes: { k1: 60_000 }, rng: rng() });

  assert.equal(submit(d, 'a', { round: 1, slug: 'c1', passed: false }, 5_000).ok, true);
  assert.equal(submit(d, 'a', { round: 1, slug: 'k1', passed: true }, 6_000).error, 'That is not your problem this round.');
  assert.ok(submit(d, 'late', { round: 1, slug: 'c1', passed: true }, 6_000).error, 'not in this round');
  assert.ok(submit(d, 'a', { round: 2, slug: 'c1', passed: true }, 6_000).error, 'wrong round');
  assert.deepEqual(submit(d, 'a', { round: 1, slug: 'c1', passed: true }, 30_000), { ok: true, solved: true });
  assert.ok(submit(d, 'a', { round: 1, slug: 'c1', passed: true }, 31_000).error, 'already solved');
  assert.equal(submit(d, 'b', { round: 1, slug: 'c1', passed: true }, 40_000).ok, true);
  assert.equal(submit(d, 'z', { round: 1, slug: 'k1', passed: true }, 50_000).ok, true, 'ghost race');
  assert.ok(everyoneSolved(d));
  assert.ok(submit(d, 'b', { round: 1, slug: 'c1', passed: true }, 10 * 60_000).error, 'after the clock');

  const res = endRound(d, 50_001);
  assert.equal(d.phase, 'spotlight');
  assert.equal(d.spotlightEndsAt, 50_001 + 3 * 60_000);
  const row = (u) => res.rows.find((r) => r.user_id === u);
  assert.deepEqual({ ...row('a') }, { round: 1, division: 'comfortable', match_no: row('a').match_no, user_id: 'a', slug: 'c1', attempts: 2, solved_ms: 30_000, won: 1 });
  assert.equal(row('b').won, 0, 'second to accept loses');
  assert.equal(row('z').won, 1, 'beat the ghost (50s < 60s)');
  assert.ok(submit(d, 'b', { round: 1, slug: 'c1', passed: true }, 50_002).error, 'after the round ends');
  assert.ok(endRound(d, 1).error, 'cannot end twice');

  assert.ok(pickSpotlight(d, 'late').error, 'spotlight only someone who solved');
  assert.ok(pickSpotlight(d, 'a').ok);
  assert.equal(d.spotlight, 'a');

  // What screens see: never code, never a cross-division ranking.
  const names = { a: 'Ana', b: 'Ben', z: 'Zed' };
  const host = duelView(d, { role: 'host', names, present: ['a', 'b', 'z'] });
  const me = duelView(d, { role: 'student', uid: 'b', names });
  assert.ok(!JSON.stringify(host).includes('code') && !JSON.stringify(me).includes('code'));
  assert.ok(!('board' in host) && !('ranking' in host));
  assert.equal(me.match.sides[me.match.me].names[0], 'Ben');
  assert.equal(me.spotlight.name, 'Ana');
  assert.ok(!JSON.stringify(me).includes('"uids"'), 'students do not see user ids');
  assert.equal(duelView(d, { role: 'student', uid: 'late', names }).match, null);

  // Ghost not beaten / nobody solved.
  const g = setup();
  setDivision(g, 'q', 'contest');
  startRound(g, { now: 0, present: ['q'], ghostTimes: { k1: 10_000 } });
  submit(g, 'q', { round: 1, slug: 'k1', passed: true }, 20_000);
  assert.equal(endRound(g, 20_001).rows[0].won, 0, 'slower than the ghost');
  assert.ok(finish(g).ok);
  assert.equal(g.phase, 'done');
  assert.ok(setDivision(g, 'q', 'new').error);
}

/* ------------------------------ duelActivities ----------------------------- */

{
  const rows = [
    { room_code: 'ABCD', round: 1, division: 'new', user_id: 5, slug: 'n1', attempts: 2, solved_ms: 1000, won: 1 },
    { room_code: 'ABCD', round: 1, division: 'new', user_id: 6, slug: 'n1', attempts: 1, solved_ms: null, won: 0 },
    { room_code: 'ABCD', round: 1, division: 'new', user_id: 7, slug: 'n1', attempts: 0, solved_ms: null, won: 0 },
  ];
  const acts = duelActivities(rows);
  assert.equal(acts.length, 3, 'winner: played + win; tried: played; idle: nothing');
  assert.ok(acts.every((a) => a.kind === 'duel'));
  assert.deepEqual(acts.filter((a) => a.userId === 5).map((a) => a.ref), ['duel:ABCD:1', 'duel-win:ABCD:1']);
  assert.equal(acts.find((a) => a.ref.startsWith('duel-win')).meta.result, 'win');
  assert.equal(acts.find((a) => a.userId === 6).meta.result, 'played');
  assert.ok(!acts.some((a) => a.userId === 7));
  assert.deepEqual(duelActivities([]), []);
  assert.deepEqual(duelActivities(undefined), []);
}

/* ------------------------- room Durable Object glue ------------------------ */

{
  const db = makeTestDb(schema);
  db.exec(`INSERT INTO students (id, name) VALUES (10, 'Ana')`);
  db.exec(`INSERT INTO users (id, email, name, student_id) VALUES (1, 'a@x.org', 'Ana', 10), (2, 'b@x.org', 'Ben', NULL)`);
  db.exec(`INSERT INTO problems (slug, title, cases, solution, status) VALUES ('sum', 'Sum', '[]', 'x', 'live'), ('hidden', 'H', '[]', '', 'draft')`);

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
  const ben = new Ws({ role: 'student', uid: '2', name: 'Ben' });
  const store = new Map();
  const ctx = {
    storage: {
      get: async (k) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k)),
      put: async (k, v) => void store.set(k, v),
      setAlarm: async (t) => void (ctx.alarmAt = t),
    },
    blockConcurrencyWhile: (fn) => fn(),
    getWebSockets: () => [host, ana, ben],
  };
  const room = new Room(ctx, { DB: db });
  await new Promise((r) => setTimeout(r, 0));
  Object.assign(room.s, { code: 'ABCD', names: { 1: 'Ana', 2: 'Ben' } });
  const msg = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m));
  const last = (ws) => ws.sent.at(-1);

  // Students cannot run host controls.
  await msg(ana, { t: 'duel_setup', problems: { new: ['sum'] } });
  await msg(ana, { t: 'pairs', mode: 'random' });
  assert.equal(room.s.duel, null);
  assert.equal(room.s.pairs, null);

  // Draft or unknown problems are dropped; the host is told when nothing is left.
  await msg(host, { t: 'duel_setup', problems: { new: ['hidden', 'nope'] } });
  assert.equal(room.s.duel, null);
  assert.equal(last(host).t, 'notice');

  await msg(host, { t: 'duel_setup', problems: { new: ['sum', 'hidden'] }, minutes: 5, rounds: 2 });
  assert.deepEqual(room.s.duel.problems.new, [{ slug: 'sum', title: 'Sum' }]);
  await msg(ana, { t: 'duel_div', div: 'new' });
  await msg(ben, { t: 'duel_div', div: 'new' });
  await msg(ana, { t: 'duel_submit', round: 1, slug: 'sum', passed: true, code: 'x' });
  assert.equal(last(ana).text, 'The round is over.', 'no submits before the round starts');

  await msg(host, { t: 'duel_start' });
  assert.equal(room.s.duel.phase, 'live');
  assert.equal(ctx.alarmAt, room.s.duel.endsAt, 'alarm set for the round end');
  await msg(ana, { t: 'duel_submit', round: 1, slug: 'other', passed: true, code: 'nope' });
  assert.equal(last(ana).text, 'That is not your problem this round.');
  await msg(ana, { t: 'duel_submit', round: 1, slug: 'sum', passed: true, code: 'print(sum(map(int, input().split())))' });
  assert.equal(last(ana).t, 'state');
  assert.ok(!JSON.stringify(last(host)).includes('print('), 'code never goes to the projector');
  await msg(ben, { t: 'duel_submit', round: 1, slug: 'sum', passed: false, code: 'print(1)' });

  // Round ends on the alarm and results land in D1 with the code.
  room.s.duel.endsAt = Date.now() - 1;
  await msg(ben, { t: 'duel_submit', round: 1, slug: 'sum', passed: true, code: 'late' });
  assert.equal(last(ben).text, 'The round is over.', 'submit after the clock is refused');
  await room.alarm();
  assert.equal(room.s.duel.phase, 'spotlight');
  const saved = (await db.prepare('SELECT * FROM duel_results ORDER BY user_id').all()).results;
  assert.equal(saved.length, 2);
  assert.deepEqual(
    saved.map((r) => [r.room_code, r.round, r.division, r.user_id, r.slug, r.attempts, r.won, r.code]),
    [
      ['ABCD', 1, 'new', 1, 'sum', 1, 1, 'print(sum(map(int, input().split())))'],
      ['ABCD', 1, 'new', 2, 'sum', 1, 0, 'print(1)'],
    ]
  );
  assert.ok(saved[0].solved_ms >= 0 && saved[1].solved_ms === null);
  assert.equal(duelActivities(saved).length, 3);
  // Round end pays through the ledger: Ana played and won; Ben has no leaderboard entry yet.
  const acts = (await db.prepare(`SELECT student_id, kind, ref FROM activity WHERE kind = 'duel' ORDER BY ref`).all()).results;
  assert.deepEqual(acts.map((a) => [a.student_id, a.ref]), [[10, 'duel-win:ABCD:1'], [10, 'duel:ABCD:1']]);

  // Pair maker for the room.
  await msg(host, { t: 'pairs', mode: 'random' });
  assert.deepEqual(flat(room.s.pairs), ['1', '2']);
  room.broadcast();
  assert.deepEqual(last(ana).pairs, ['Ben']);

  // Quiz still works alongside.
  await msg(host, { t: 'ask', text: 'Q?', options: ['a', 'b'], correct: 0, seconds: 10 });
  await msg(ana, { t: 'answer', choice: 0 });
  assert.equal(last(host).answered, 1);
}

/* --------------------------- officer route guard --------------------------- */

{
  const app = new Hono();
  mountHub(app);
  const env = { DB: makeTestDb(schema), ADMIN_PASSWORD: 'x', SESSION_SECRET: 's' };
  const res = await app.request('/api/admin/hub/rooms/ABCD/duel', {}, env);
  assert.equal(res.status, 401, 'duel code is officers only');
}

console.log('duel: ok');
