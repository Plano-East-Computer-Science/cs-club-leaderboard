/**
 * Mock contest block (B5): the pure scoring, freeze and reveal rules in
 * shared/contest.js, then the room Durable Object over a fake D1 (who may
 * submit, closing time, surviving eviction, attendance, account export).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import { Room } from '../worker/hub/room-do.js';
import { exportFor } from '../worker/hub/safety.js';
import * as C from '../shared/contest.js';
import { BLOCK_TYPES, TEMPLATES, templateBlocks } from '../shared/session-templates.js';

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const MIN = 60_000;

/* ------------------------------- the template ------------------------------ */

assert.ok(BLOCK_TYPES.includes('contest'));
const mock = templateBlocks('mock');
assert.ok(mock.some((b) => b.type === 'contest' && b.contest.freeze === 10 && b.contest.penalty === 20), 'Mock contest uses the contest block');
assert.ok(!mock.some((b) => b.type === 'duel'), 'Mock contest no longer stands in a duel');
assert.ok(TEMPLATES.mock.blurb.includes('freez'));

/* ---------------------------------- setup ---------------------------------- */

const probs = (n) => Array.from({ length: n }, (_, i) => ({ slug: `p${i + 1}`, title: `P${i + 1}` }));
assert.ok(C.newContest({ problems: probs(2) }).error, 'fewer than three problems');
assert.ok(C.newContest({ problems: probs(9) }).error, 'more than eight problems');
assert.ok(C.newContest({ problems: probs(3), minutes: 10, freeze: 10 }).error, 'freeze must be shorter than the contest');
assert.ok(C.newContest({ problems: probs(3), penalty: -1 }).error);
{
  const { contest } = C.newContest({ problems: probs(3) });
  assert.deepEqual([contest.minutes, contest.freeze, contest.penalty], [30, 10, 20], 'defaults');
}

// Teams: up to three, as even as possible; mixed spreads the strong across teams.
{
  const ids = ['1', '2', '3', '4', '5', '6', '7'];
  const t = C.dealTeams(ids, { mode: 'random' });
  assert.equal(t.length, 3);
  assert.deepEqual(t.map((x) => x.length).sort(), [2, 2, 3]);
  assert.deepEqual(t.flat().sort(), ids, 'everyone is on exactly one team');
  const lv = { 1: 9, 2: 8, 3: 7, 4: 1, 5: 1, 6: 1 };
  const mixed = C.dealTeams(['1', '2', '3', '4', '5', '6'], { mode: 'mixed', levels: lv });
  assert.equal(mixed.length, 2);
  assert.ok(mixed.every((g) => g.length === 3 && g.filter((u) => lv[u] >= 7).length >= 1), 'each team gets a strong member');
  assert.deepEqual(C.dealTeams([]), []);
}

/* ---------------------------- scoring and the freeze ---------------------------- */

/** 30 min contest, 10 min freeze, 20 min penalty, three teams of one. Returns helpers. */
function game() {
  const { contest: c } = C.newContest({ problems: probs(3) });
  C.setTeams(c, [['1'], ['2'], ['3']]);
  const t0 = 1_000_000;
  C.startContest(c, t0);
  const at = (min) => t0 + min * MIN;
  return { c, t0, at, sub: (uid, slug, min, passed) => C.submit(c, uid, { slug, passed }, at(min)) };
}

// ICPC penalty: solve minutes plus 20 per wrong attempt before the solve; wrong tries on unsolved problems are free.
{
  const { c, sub } = game();
  sub('1', 'p1', 3, false); // wrong, then solved: 20 + 7
  sub('1', 'p1', 7, true);
  sub('1', 'p2', 9, false); // never solved: costs nothing
  sub('1', 'p2', 12, false);
  sub('2', 'p1', 5, true); // 5
  sub('2', 'p2', 8, true); // 8
  const rows = C.scoreRows(c);
  assert.deepEqual(rows.map((r) => [r.id, r.solved, r.penalty]), [[1, 1, 27], [2, 2, 13], [3, 0, 0]], 'penalty only counts on solved problems');
  assert.equal(rows[0].cells[1].wrong, 2, 'the unsolved problem still shows its tries');
  const ranked = C.rank(rows);
  assert.deepEqual(ranked.map((r) => [r.id, r.place]), [[2, 1], [1, 2], [3, 3]]);
  assert.equal(C.submit(c, '1', { slug: 'p1', passed: true }, c.startedAt + 20 * MIN).error, 'Your team already solved that one.');
}

// Solved count beats penalty; equal on both shares a place (1, 1, 3).
{
  const { c, sub } = game();
  sub('1', 'p1', 4, true);
  sub('2', 'p2', 4, true);
  sub('3', 'p1', 1, true);
  sub('3', 'p2', 2, true);
  assert.deepEqual(C.rank(C.scoreRows(c)).map((r) => [r.id, r.place]), [[3, 1], [1, 2], [2, 2]], 'two solves lead; the other two tie for second');
}

// The freeze: from minute 20 the public board stops moving, but your own team's live result does not.
{
  const { c, t0, at, sub } = game();
  assert.equal(C.freezeAt(c), at(20));
  sub('1', 'p1', 5, true);
  sub('2', 'p1', 15, true);
  sub('3', 'p1', 25, true); // after the freeze
  sub('2', 'p2', 26, true);
  let pub = C.publicBoard(c, at(19));
  assert.equal(pub.frozen, false);
  pub = C.publicBoard(c, at(27));
  assert.equal(pub.frozen, true);
  const byId = Object.fromEntries(pub.rows.map((r) => [r.id, r]));
  assert.equal(byId[3].solved, 0, 'a solve after the freeze is hidden from the public board');
  assert.equal(byId[2].solved, 1, 'a solve before the freeze shows');
  assert.equal(byId[2].cells[1].ok, false, 'and so does what came after it stay hidden');
  const own = C.ownRow(c, 3);
  assert.equal(own.solved, 1, 'your own team still sees its live result');
  assert.equal(C.ownRow(c, 2).solved, 2);
  assert.equal(C.nextDue(c, at(5)), at(20), 'the room wakes at the freeze first');
  assert.equal(C.nextDue(c, at(21)), at(30), 'then at the end');
  assert.equal(C.nextDue(c, at(31)), at(30));
  void t0;
}

// No freeze: the board is live and final at the end.
{
  const { contest: c } = C.newContest({ problems: probs(3), minutes: 10, freeze: 0 });
  C.setTeams(c, [['1'], ['2']]);
  C.startContest(c, 0);
  C.submit(c, '2', { slug: 'p1', passed: true }, 2 * MIN);
  assert.equal(C.freezeAt(c), null);
  assert.equal(C.publicBoard(c, 9 * MIN).frozen, false);
  C.endContest(c);
  const pub = C.publicBoard(c, 11 * MIN);
  assert.ok(pub.final && !pub.frozen && pub.rows[0].id === 2);
  assert.ok(C.revealNext(c).error, 'nothing to reveal without a freeze');
}

// The reveal: after the end, bottom team first, board changes one team at a time, then final places.
{
  const { c, at, sub } = game();
  sub('1', 'p1', 2, true); // before the freeze: team 1 leads at the freeze with one solve
  sub('2', 'p1', 18, true);
  sub('3', 'p1', 22, true); // after the freeze
  sub('3', 'p2', 23, true);
  sub('3', 'p3', 24, true); // team 3 wins on the final board: 3 solved
  assert.ok(C.revealNext(c).error, 'not while the contest is running');
  C.endContest(c);
  let pub = C.publicBoard(c, at(31));
  assert.ok(pub.frozen && !pub.final, 'frozen until revealed');
  assert.deepEqual(pub.rows.map((r) => [r.id, r.solved]), [[1, 1], [2, 1], [3, 0]], 'the frozen board is what it was at the freeze');
  // Final standings: 3 (3 solved), 1 (1 at 2 min), 2 (1 at 18 min). Bottom up: 2, 1, 3.
  assert.deepEqual(C.revealOrder(c), [2, 1, 3]);
  assert.equal(C.revealNext(c).team, 2);
  pub = C.publicBoard(c, at(31));
  assert.deepEqual(pub.rows.map((r) => r.id), [1, 2, 3], 'team 2 revealed: nothing new for them, order holds');
  assert.equal(C.revealNext(c).team, 1);
  assert.equal(C.revealNext(c).team, 3);
  pub = C.publicBoard(c, at(31));
  assert.ok(pub.final && !pub.frozen);
  assert.deepEqual(pub.rows.map((r) => [r.id, r.place, r.solved]), [[3, 1, 3], [1, 2, 1], [2, 3, 1]], 'final places');
  assert.ok(C.revealNext(c).error, 'all revealed');
}

// Moving members: three per team, locked teams still allow a late arrival.
{
  const { c } = game();
  assert.ok(C.moveMember(c, '4', 99).error, 'no such team');
  assert.equal(C.moveMember(c, '4', 1).ok, true);
  assert.equal(C.moveMember(c, '5', 1).ok, true);
  assert.equal(C.moveMember(c, '6', 1).error, 'That team already has three.');
  assert.equal(C.moveMember(c, '6', 'new').ok, true);
  assert.equal(C.teamOf(c, '6').id, 4);
  C.moveMember(c, '6', null);
  assert.equal(C.teamOf(c, '6'), null);
  assert.ok(C.setTeams(c, [['1']]).error, 'teams are locked after the start');
}

/* ----------------------------- the room, over a fake D1 ----------------------------- */

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

function makeCtx(sockets, store = new Map()) {
  const ctx = {
    store,
    alarmAt: 0,
    storage: {
      get: async (k) => store.get(k),
      put: async (k, v) => void store.set(k, structuredClone(v)), // a real DO stores a copy
      setAlarm: async (t) => void (ctx.alarmAt = t),
    },
    blockConcurrencyWhile: (fn) => fn(),
    getWebSockets: () => sockets,
  };
  return ctx;
}

{
  const db = makeTestDb(schema);
  db.exec(`INSERT INTO students (id, name) VALUES (10, 'Ana'), (11, 'Ben'), (12, 'Cy'), (13, 'Dee'), (14, 'Eli'), (15, 'Fay'), (16, 'Gus')`);
  db.exec(`INSERT INTO users (id, email, name, student_id) VALUES
    (1, 'a@x.org', 'Ana A', 10), (2, 'b@x.org', 'Ben B', 11), (3, 'c@x.org', 'Cy C', 12),
    (4, 'd@x.org', 'Dee D', 13), (5, 'e@x.org', 'Eli E', 14), (6, 'f@x.org', 'Fay F', 15), (7, 'g@x.org', 'Gus G', 16)`);
  db.exec(`INSERT INTO rooms (code, title, kind, template) VALUES ('ROOM', 'Mock', 'meeting', 'mock')`);
  db.exec(`INSERT INTO room_checkins (code, user_id) VALUES ('ROOM', 1), ('ROOM', 2), ('ROOM', 3), ('ROOM', 4), ('ROOM', 5), ('ROOM', 6), ('ROOM', 7)`);
  db.exec(`INSERT INTO problems (slug, title, cases, solution, status) VALUES
    ('p1', 'One', '[]', 'x', 'live'), ('p2', 'Two', '[]', 'x', 'live'), ('p3', 'Three', '[]', 'x', 'live'), ('p4', 'Draft', '[]', 'x', 'draft')`);
  db.exec(`INSERT INTO point_events (student_id, delta, reason) VALUES (10, 500, 'x'), (11, 400, 'x'), (12, 300, 'x')`);

  const host = new Ws({ role: 'host', uid: 'host' });
  const st = [1, 2, 3, 4, 5, 6, 7].map((i) => new Ws({ role: 'student', uid: String(i), name: `S${i}` }));
  const [ana, ben, cy, dee, eli, fay, gus] = st;
  const sockets = [host, ...st.slice(0, 6)]; // Gus is not connected, so is not put on a team
  const ctx = makeCtx(sockets);
  let room = new Room(ctx, { DB: db });
  await new Promise((r) => setTimeout(r, 0));
  Object.assign(room.s, { code: 'ROOM', names: { 1: 'Ana A', 2: 'Ben B', 3: 'Cy C', 4: 'Dee D', 5: 'Eli E', 6: 'Fay F', 7: 'Gus G' } });
  const msg = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m));
  const last = (ws) => ws.sent.at(-1);
  const exitOf = async (uid) => (await db.prepare('SELECT exit_kind FROM room_checkins WHERE user_id = ?').bind(uid).first()).exit_kind;

  // Students cannot run any contest control.
  await msg(ana, { t: 'contest_setup', problems: ['p1', 'p2', 'p3'] });
  assert.equal(room.s.contest, null);

  // Draft or unknown problems are dropped; under three left is refused.
  await msg(host, { t: 'contest_setup', problems: ['p1', 'p2', 'p4', 'nope'] });
  assert.equal(room.s.contest, null);
  assert.equal(last(host).t, 'notice');

  await msg(host, { t: 'contest_setup', problems: ['p1', 'p2', 'p3'], minutes: 30, freeze: 10, penalty: 20 });
  assert.equal(room.s.contest.phase, 'setup');
  await msg(ana, { t: 'contest_submit', slug: 'p1', passed: true, code: 'x' });
  assert.equal(last(ana).text, 'The contest has not started.');
  await msg(host, { t: 'contest_start' });
  assert.equal(last(host).text, 'Make teams first.');

  await msg(host, { t: 'contest_teams', mode: 'mixed' });
  const teams = room.s.contest.teams;
  assert.equal(teams.length, 2);
  assert.deepEqual(teams.flatMap((t) => t.members).sort(), ['1', '2', '3', '4', '5', '6']);
  // Pin the teams so the rest of the test is deterministic: Ana+Ben+Cy and Dee+Eli, Fay left out.
  await msg(host, { t: 'contest_move', uid: '1', to: null });
  for (const u of ['2', '3', '4', '5', '6']) await msg(host, { t: 'contest_move', uid: u, to: null });
  await msg(host, { t: 'contest_move', uid: '1', to: 'new' });
  const idOf = (u) => room.s.contest.teams.find((t) => t.members.includes(u)).id;
  await msg(host, { t: 'contest_move', uid: '2', to: idOf('1') });
  await msg(host, { t: 'contest_move', uid: '3', to: idOf('1') });
  await msg(host, { t: 'contest_move', uid: '4', to: 'new' });
  await msg(host, { t: 'contest_move', uid: '5', to: idOf('4') });
  const t1 = room.s.contest.teams.find((t) => t.members.includes('1'));
  const t2 = room.s.contest.teams.find((t) => t.members.includes('4'));
  assert.deepEqual([t1.members, t2.members], [['1', '2', '3'], ['4', '5']]);
  assert.deepEqual(last(host).contest.unassigned.map((u) => u.uid), ['6'], 'the host sees who has no team');
  await msg(host, { t: 'contest_move', uid: '6', to: t1.id });
  assert.equal(last(host).t, 'notice', 'a fourth member is refused');

  const t0 = Date.now();
  await msg(host, { t: 'contest_start' });
  const c = () => room.s.contest;
  assert.equal(c().phase, 'live');
  assert.ok(c().endsAt - c().startedAt === 30 * MIN);
  assert.equal(ctx.alarmAt, c().endsAt - 10 * MIN, 'the first alarm is the freeze');

  // A student with no team, or outside the team, cannot submit for it.
  await msg(fay, { t: 'contest_submit', slug: 'p1', passed: true, code: 'x' });
  assert.equal(last(fay).text, 'You are not on a team. Ask an officer to add you.');
  await msg(dee, { t: 'contest_submit', team: t1.id, slug: 'p1', passed: true, code: 'steal' });
  assert.equal(last(dee).text, 'You are not on that team.', 'a non-member cannot submit for another team');
  assert.equal(c().subs.length, 0);
  await msg(ana, { t: 'contest_submit', slug: 'zzz', passed: true, code: 'x' });
  assert.equal(last(ana).text, 'That problem is not in this contest.');

  // Any member submits for the team; wrong then right is penalised.
  await msg(ben, { t: 'contest_submit', team: t1.id, slug: 'p1', passed: false, code: 'print(0)' });
  await msg(cy, { t: 'contest_submit', slug: 'p1', passed: true, code: 'print(1)' });
  await msg(dee, { t: 'contest_submit', slug: 'p2', passed: true, code: 'print(2)' });
  assert.equal(c().subs.length, 3);
  const saved = (await db.prepare('SELECT * FROM contest_attempts ORDER BY id').all()).results;
  assert.deepEqual(saved.map((r) => [r.room_code, r.team_id, r.user_id, r.slug, r.ok, r.code]), [
    ['ROOM', t1.id, 2, 'p1', 0, 'print(0)'],
    ['ROOM', t1.id, 3, 'p1', 1, 'print(1)'],
    ['ROOM', t2.id, 4, 'p2', 1, 'print(2)'],
  ], 'every attempt and its code is kept for spot checks');
  assert.equal(await exitOf(2), 'contest', 'playing a contest is the exit artifact for attendance');
  assert.equal(await exitOf(4), 'contest');
  assert.equal(await exitOf(1), null, 'a member who did not submit has no exit artifact yet');

  // Code never goes to the projector or other members.
  const everything = JSON.stringify([host.sent.at(-1), ana.sent.at(-1), dee.sent.at(-1)]);
  assert.ok(!everything.includes('print('), 'no code in any view');
  assert.ok(!JSON.stringify(last(host).contest.board).includes('Ana'), 'the board shows team names, not people');

  // The freeze: move the clock so we are in the last ten minutes.
  c().startedAt -= 21 * MIN;
  c().endsAt -= 21 * MIN;
  await msg(dee, { t: 'contest_submit', slug: 'p3', passed: true, code: 'late' }); // team 2's second solve, after the freeze
  const boardOf = (ws) => Object.fromEntries(last(ws).contest.board.map((r) => [r.id, r]));
  assert.ok(last(host).contest.frozen && last(ana).contest.frozen);
  assert.equal(boardOf(ana)[t2.id].solved, 1, 'Ana sees the other team as of the freeze');
  assert.equal(last(dee).contest.team.row.solved, 2, 'but Dee sees her own team live');
  assert.equal(boardOf(dee)[t2.id].solved, 1, 'the public board does not move for her either');
  assert.equal(last(host).contest.live.find((r) => r.id === t2.id).solved, 2, 'the console has the true standings');
  assert.ok(last(ana).contest.live === undefined && last(ana).contest.teams === undefined, 'members get neither');

  // Eviction mid-contest: a new Room over the same storage keeps teams, attempts and clock.
  const stored = new Map(ctx.store);
  const ctx2 = makeCtx(sockets, stored);
  room = new Room(ctx2, { DB: db });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(c().phase, 'live');
  assert.equal(c().subs.length, 4);
  assert.deepEqual(c().teams.map((t) => t.members), [['1', '2', '3'], ['4', '5']]);
  await msg(ana, { t: 'contest_submit', slug: 'p2', passed: true, code: 'print(3)' });
  assert.equal(c().subs.length, 5, 'still accepting after the room woke up');
  await room.alarm();
  assert.equal(ctx2.alarmAt, c().endsAt, 'the wake-up alarm is re-armed for the end');

  // The end: the alarm closes it, submissions are refused, the board stays frozen for the reveal.
  c().endsAt = Date.now() - 1;
  await room.alarm();
  assert.equal(c().phase, 'ended');
  await msg(ben, { t: 'contest_submit', slug: 'p3', passed: true, code: 'too late' });
  assert.equal(last(ben).text, 'The contest is over.');
  assert.equal(c().subs.length, 5);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contest_attempts').first()).n, 5, 'nothing recorded after the end');
  assert.ok(last(ana).contest.frozen && !last(ana).contest.final, 'frozen until the reveal');

  // Reveal, host only, one team at a time from the bottom.
  await msg(ana, { t: 'contest_reveal' });
  assert.equal(c().revealed.length, 0, 'a student cannot reveal');
  // Bottom of the final standings goes first; the order comes from the rules, checked by hand in the pure tests.
  const order = C.revealOrder(c());
  await msg(host, { t: 'contest_reveal' });
  assert.deepEqual(c().revealed, [order[0]]);
  await msg(host, { t: 'contest_reveal' });
  assert.ok(last(host).contest.final, 'final once every team is revealed');
  assert.deepEqual(last(host).contest.board.map((r) => r.id), C.rank(C.scoreRows(c())).map((r) => r.id));
  await msg(host, { t: 'contest_close' });
  assert.equal(room.s.contest, null);

  // Account export carries the member's attempts.
  const exp = await exportFor(db, { id: 2, email: 'b@x.org', name: 'Ben B' });
  assert.equal(exp.contest_attempts.length, 1);
  assert.equal(exp.contest_attempts[0].code, 'print(0)');
  void [eli, gus, t0];
}

console.log('contest: ok');
