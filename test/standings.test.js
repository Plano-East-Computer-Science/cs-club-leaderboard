/**
 * A4-A6: season sums and boundaries, lifetime rank that never drops, the
 * neighbours window, tier counts, raffle tickets and the draw, balanced
 * squads, median scores, quest bonuses on the ledger, and who may call the
 * officer routes. Runs the real SQL against node:sqlite (test/d1-shim.js).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { getLeaderboard } from '../worker/db.js';
import { syncQuests } from '../worker/hub/quests.js';
import { cryptoInt, seasonParam } from '../worker/hub/standings.js';
import { seasonRange, prevSeason, seasonLabel, seasonOf, pointsFor, POINT_RULES } from '../shared/points.js';
import { rankFor, peakOf, RANKS } from '../shared/ranks.js';
import {
  DEFAULT_TIERS, cleanTiers, tiersFrom, tierOf, tierCounts, placeRows, neighbours, raffleTickets, drawWinner, median, suggestSquads, pairKey,
} from '../shared/standings.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

/* --------------------------------- seasons --------------------------------- */

await check('season ranges are half-open semesters and step back correctly', () => {
  assert.deepEqual(seasonRange('2026-fall'), { start: '2026-06-01 00:00:00', end: '2027-01-01 00:00:00' });
  assert.deepEqual(seasonRange('2027-spring'), { start: '2027-01-01 00:00:00', end: '2027-06-01 00:00:00' });
  assert.equal(seasonRange('2026-winter'), null);
  assert.equal(prevSeason('2026-fall'), '2026-spring');
  assert.equal(prevSeason('2026-spring'), '2025-fall');
  assert.equal(seasonLabel('2026-fall'), 'Fall 2026');
  // Every timestamp's season contains it.
  for (const t of ['2026-05-31 23:59:59', '2026-06-01 00:00:00', '2026-12-31 23:59:59', '2027-01-01 00:00:00']) {
    const r = seasonRange(seasonOf(t));
    assert.ok(t >= r.start && t < r.end, t);
  }
  assert.equal(seasonParam(''), seasonOf(new Date()));
  assert.equal(seasonParam('all'), 'all');
  assert.equal(seasonParam('all', false), null);
  assert.equal(seasonParam("2026-fall' OR 1=1"), null);
});

function boardDb() {
  const db = makeTestDb(SCHEMA);
  db.exec(`INSERT INTO students (id, name) VALUES (1, 'Ada'), (2, 'Bo'), (3, 'Cy');
    INSERT INTO point_events (student_id, delta, reason, created_at) VALUES
      (1, 50, 'old', '2026-05-31 23:59:59'),
      (1, 10, 'first of fall', '2026-06-01 00:00:00'),
      (1, 5, 'last of fall', '2026-12-31 23:59:59'),
      (1, 7, 'spring', '2027-01-01 00:00:00'),
      (2, 30, 'fall', '2026-09-01 12:00:00'),
      (2, -20, 'correction', '2026-10-01 12:00:00')`);
  return db;
}

await check('season sums include the first second and exclude the next season', async () => {
  const db = boardDb();
  const by = (rows) => Object.fromEntries(rows.map((r) => [r.name, r]));
  const fall = by(await getLeaderboard(db, '2026-fall'));
  assert.equal(fall.Ada.points, 15);
  assert.equal(fall.Bo.points, 10);
  assert.equal(fall.Cy.points, 0);
  assert.equal(by(await getLeaderboard(db, '2026-spring')).Ada.points, 50);
  assert.equal(by(await getLeaderboard(db, '2027-spring')).Ada.points, 7);
  const all = by(await getLeaderboard(db, 'all'));
  assert.equal(all.Ada.points, 72);
  assert.equal(fall.Ada.lifetime, 72); // lifetime ignores the season filter
});

await check('lifetime rank comes from the peak, so a correction never lowers it', async () => {
  assert.equal(peakOf([30, -20, 5]), 30);
  assert.equal(peakOf([-5, 3]), 0);
  // Any sequence: the rank label after each step never goes down.
  const deltas = [10, 20, -25, 40, -60, 5, 100, -200];
  let run = [];
  let last = 0;
  for (const d of deltas) {
    run.push(d);
    const i = RANKS.findIndex((r) => r.id === rankFor(peakOf(run)).rank);
    assert.ok(i >= last);
    last = i;
  }
  const db = boardDb();
  const bo = (await getLeaderboard(db, 'all')).find((r) => r.name === 'Bo');
  assert.equal(bo.lifetime, 10);
  assert.equal(bo.peak, 30);
  assert.equal(bo.rank, rankFor(30).rank); // contributor, not newcomer
  assert.equal(rankFor(10).rank, 'newcomer');
});

/* -------------------------------- neighbours ------------------------------- */

const rows = placeRows(
  [['A', 90], ['B', 80], ['C', 80], ['D', 70], ['E', 60], ['F', 50], ['G', 50], ['H', 10]].map(([name, points], i) => ({ id: i + 1, name, points }))
);

await check('places share ties: 90, 80, 80, 70 -> 1, 2, 2, 4', () => {
  assert.deepEqual(rows.map((r) => r.place), [1, 2, 2, 4, 5, 6, 6, 8]);
});

await check('neighbours window: two either side, clipped at the top and bottom, ties kept in order', () => {
  assert.deepEqual(neighbours(rows, 1).map((r) => r.name), ['A', 'B', 'C']);
  assert.deepEqual(neighbours(rows, 8).map((r) => r.name), ['F', 'G', 'H']);
  assert.deepEqual(neighbours(rows, 4).map((r) => r.name), ['B', 'C', 'D', 'E', 'F']);
  // C is tied with B; the window is positional, so B is still shown above C.
  assert.deepEqual(neighbours(rows, 3).map((r) => r.name), ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(neighbours(rows, 99), []);
  assert.deepEqual(neighbours(rows.slice(0, 1), 1).map((r) => r.name), ['A']);
});

/* ---------------------------------- tiers ---------------------------------- */

await check('tier counts and validation of officer tiers', () => {
  assert.deepEqual(tierCounts(rows, DEFAULT_TIERS), {
    below: 3,
    tiers: [{ name: 'Bronze', min: 60, n: 5 }, { name: 'Silver', min: 120, n: 0 }, { name: 'Gold', min: 200, n: 0 }],
  });
  const t = [50, 70, 90];
  const c = tierCounts(rows, t);
  assert.equal(c.below, 1);
  assert.deepEqual(c.tiers.map((x) => x.n), [3, 3, 1]); // 50,50,60 | 80,80,70 | 90
  assert.equal(tierOf(69, t), 0);
  assert.equal(tierOf(70, t), 1);
  assert.equal(tierOf(49, t), -1);
  assert.ok(cleanTiers([60, 60]).error);
  assert.ok(cleanTiers([]).error);
  assert.ok(cleanTiers([1, 2, 3, 4, 5, 6]).error);
  assert.ok(cleanTiers([0.5]).error);
  assert.deepEqual(cleanTiers([10, 20]).tiers, [10, 20]);
  assert.deepEqual(tiersFrom('nonsense'), DEFAULT_TIERS);
  assert.deepEqual(tiersFrom('[5,9]'), [5, 9]);
});

/* ---------------------------------- raffle --------------------------------- */

await check('raffle: tickets equal season points at or above the first tier, draw is deterministic under a fixed RNG', () => {
  const entries = raffleTickets(rows, 70);
  assert.deepEqual(entries.map((e) => [e.name, e.tickets]), [['A', 90], ['B', 80], ['C', 80], ['D', 70]]);
  assert.deepEqual(raffleTickets(rows, 1000), []);
  const at = (k) => drawWinner(entries, () => k);
  assert.equal(at(0).name, 'A');
  assert.equal(at(89).name, 'A');
  assert.equal(at(90).name, 'B');
  assert.equal(at(250).name, 'D');
  assert.equal(at(319).name, 'D');
  assert.equal(at(319).total, 320);
  assert.equal(drawWinner([], () => 0), null);
  // The RNG is asked for a number below the total, nothing else.
  let asked = null;
  drawWinner(entries, (n) => ((asked = n), 0));
  assert.equal(asked, 320);
  for (let i = 0; i < 200; i++) {
    const v = cryptoInt(7);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 7);
  }
});

/* ---------------------------------- squads --------------------------------- */

await check('median score', () => {
  assert.equal(median([]), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 100, 3]), 3);
  assert.equal(median([1, 2, 3, 100]), 2.5);
});

await check('suggested squads snake-draft by lifetime points and avoid last season pairs', () => {
  const members = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, lifetime: 120 - i * 10 }));
  const s = suggestSquads(members, 3);
  // Round one 1,2,3; round two reversed 4->3rd, 5->2nd, 6->1st.
  assert.deepEqual(s, [[1, 6, 7, 12], [2, 5, 8, 11], [3, 4, 9, 10]]);
  const sums = s.map((ids) => ids.reduce((a, id) => a + members[id - 1].lifetime, 0));
  assert.ok(Math.max(...sums) - Math.min(...sums) <= 20, 'totals stay close');
  assert.deepEqual(s.flat().sort((a, b) => a - b), members.map((m) => m.id), 'everyone placed once');
  // If 1 and 6 were together last season, 6 moves to another open squad in its round.
  const past = new Set([pairKey(1, 6)]);
  const t = suggestSquads(members, 3, past);
  assert.ok(!t.some((ids) => ids.includes(1) && ids.includes(6)));
  assert.deepEqual(t.map((x) => x.length), [4, 4, 4]);
  // More squads than members: never an empty crash.
  assert.equal(suggestSquads(members.slice(0, 2), 5).length, 2);
});

/* ----------------------------- quests on the ledger ----------------------------- */

await check('quest bonuses are recorded once each and capped per season', async () => {
  const db = makeTestDb(SCHEMA);
  db.exec(`INSERT INTO students (id, name) VALUES (1, 'Ada');
    INSERT INTO users (id, email, name, student_id) VALUES (5, 'a@x.com', 'Ada', 1);
    INSERT INTO rooms (code) VALUES ('R1'),('R2'),('R3');
    INSERT INTO room_checkins (code, user_id) VALUES ('R1', 5), ('R2', 5), ('R3', 5);
    INSERT INTO ideas (user_id, body) VALUES (5, 'more duels')`);
  const sum = async () => (await db.prepare("SELECT COALESCE(SUM(delta),0) AS n FROM point_events").first()).n;
  await syncQuests(db, 5); // first-room, meet-3, idea-1
  assert.equal(await sum(), 3 * POINT_RULES.quest.points);
  await syncQuests(db, 5);
  assert.equal(await sum(), 9, 'running again pays nothing');
  db.exec(`INSERT INTO projects (user_id, title) VALUES (5, 'a'), (5, 'b'), (5, 'c')`);
  await syncQuests(db, 5); // project-1, project-3: 9 + 6 = 15, the cap
  assert.equal(await sum(), 15);
  db.exec(`INSERT INTO rooms (code) VALUES ('R4'),('R5'),('R6'),('R7'),('R8');
    INSERT INTO room_checkins (code, user_id) SELECT code, 5 FROM rooms WHERE code > 'R3'`);
  await syncQuests(db, 5); // meet-8 is recorded but the season cap pays 0
  assert.equal(await sum(), 15);
  const q = (await db.prepare("SELECT COUNT(*) AS n, SUM(points) AS p FROM activity WHERE kind = 'quest'").first());
  assert.deepEqual(q, { n: 6, p: 15 });
  // The pure rule agrees: a quest after 15 points in the season pays 0.
  assert.equal(pointsFor('quest', {}, [{ kind: 'quest', at: '2026-10-01 00:00:00', points: 15 }], POINT_RULES, '2026-10-02 00:00:00'), 0);
  // An account with no leaderboard entry is skipped, not an error.
  db.exec(`INSERT INTO users (id, email, name) VALUES (6, 'b@x.com', 'Bo')`);
  db.exec(`INSERT INTO link_requests (user_id, student_id) VALUES (6, 1)`);
  assert.equal((await syncQuests(db, 6)).paid.size, 0);
});

/* --------------------------------- routes --------------------------------- */

await check('public standings hide the full list; officer routes refuse members', async () => {
  const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
  const db = env.DB;
  const names = Array.from({ length: 12 }, (_, i) => `Member${i}`);
  db.exec(`INSERT INTO students (name) VALUES ${names.map((n) => `('${n}')`).join(',')}`);
  db.exec(`INSERT INTO point_events (student_id, delta) SELECT id, id * 15 FROM students`);
  db.exec(`INSERT INTO users (id, email, name, student_id, role) VALUES (1, 'm@x.com', 'Member5', 6, 'member'), (2, 'o@x.com', 'Off', NULL, 'officer')`);
  const cookie = async (id) => `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}`;
  const call = async (path, c, method = 'GET', body) => {
    const res = await worker.fetch(
      new Request(`https://club.test/api${path}`, { method, headers: { ...(c && { Cookie: c }), ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) }),
      env,
      { waitUntil() {}, passThroughOnException() {} }
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const anon = await call('/standings');
  assert.equal(anon.status, 200);
  assert.equal(anon.body.top.length, 5);
  assert.equal(anon.body.me, null);
  assert.equal(anon.body.members, 12);
  assert.ok(!('rows' in anon.body) && !('students' in anon.body));

  const M = await cookie(1);
  const mine = await call('/standings', M);
  assert.equal(mine.body.me.points, 90);
  assert.deepEqual(mine.body.me.window.map((r) => r.points), [120, 105, 90, 75, 60]);
  assert.equal(mine.body.me.tickets, 90);
  assert.equal(mine.body.raffle.entrants, 9); // 60, 75, ..., 180

  for (const [path, method, body] of [
    ['/admin/hub/standings/full', 'GET'],
    ['/admin/hub/raffle?season=2026-fall', 'GET'],
    ['/admin/hub/raffle/draw', 'POST', { season: '2026-fall' }],
    ['/admin/hub/season-tiers', 'PUT', { tiers: [1] }],
    ['/admin/hub/squads/apply', 'POST', { season: '2026-fall', squads: [] }],
  ]) {
    assert.equal((await call(path, undefined, method, body)).status, 401, `anonymous ${path}`);
    assert.equal((await call(path, M, method, body)).status, 401, `member ${path}`);
  }

  const O = await cookie(2);
  const season = seasonOf(new Date());
  // 13: signing in gave the officer account its own entry (A1).
  assert.equal((await call(`/admin/hub/standings/full?season=${season}`, O)).body.rows.length, 13);
  const first = await call('/admin/hub/raffle/draw', O, 'POST', { season });
  assert.equal(first.status, 200);
  assert.equal((await call('/admin/hub/raffle/draw', O, 'POST', { season })).status, 400, 'redraw needs a reason');
  const again = await call('/admin/hub/raffle/draw', O, 'POST', { season, reason: 'winner left the club' });
  assert.equal(again.status, 200);
  assert.equal(again.body.draws.length, 2);
  assert.equal(again.body.draws[0].reason, 'winner left the club');
  assert.equal(again.body.draws[0].drawn_name, 'Off');

  // Squads: suggest, apply, move, and the member sees their own squad.
  const plan = await call('/admin/hub/squads/suggest', O, 'POST', { season, count: 3 });
  assert.equal(plan.body.squads.length, 3);
  const applied = await call('/admin/hub/squads/apply', O, 'POST', {
    season,
    squads: plan.body.squads.map((s, i) => ({ name: `Team ${i}`, color: '#ffc20e', members: s.members.map((m) => m.id) })),
  });
  assert.equal(applied.status, 200);
  const sq = await call('/me/squad', M);
  assert.ok(sq.body.squad);
  assert.ok(sq.body.squad.members.some((m) => m.you));
  assert.equal(sq.body.squad.score, median(sq.body.squad.members.map((m) => m.points)));
  const pub = await call('/standings', M);
  assert.equal(pub.body.squads.length, 3);
  assert.equal(pub.body.squads.filter((s) => s.mine).length, 1);
  assert.equal((await call('/admin/hub/squads/apply', O, 'POST', { season, squads: [{ name: 'A', members: [1] }, { name: 'B', members: [1] }] })).status, 400);
  assert.equal((await call('/me/squad')).status, 401);
});

console.log(`\n${passed} passed, 0 failed\n`);
