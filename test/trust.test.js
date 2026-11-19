/**
 * V3-A trust fixes: private block notes, attendance on check-in, auto-close,
 * one points table (GET /api/club), readable point labels, 60/120 templates.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import { Room } from '../worker/hub/room-do.js';
import * as S from '../worker/hub/session.js';
import { cleanBlocks, endWarning } from '../shared/session-templates.js';
import { awardAttendance, autoCloseRooms, staleRooms } from '../worker/hub/rooms.js';
import { POINT_RULES, pointsFor, pointsTable, capText, pointLabel, groupLabels } from '../shared/points.js';
import { recordActivity } from '../worker/hub/ledger.js';
import { buildDigest, groupPoints } from '../worker/digest.js';
import worker from '../worker/index.js';
import { chicagoDate } from '../shared/daily.js';
import { signSession, COOKIE } from '../worker/auth.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

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

function makeRoom(db, sockets, code) {
  const store = new Map();
  const ctx = {
    storage: {
      get: async (k) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k)),
      put: async (k, v) => void store.set(k, v),
      setAlarm: async () => {},
    },
    blockConcurrencyWhile: (fn) => fn(),
    getWebSockets: () => sockets,
  };
  const room = new Room(ctx, { DB: db });
  room.s.code = code;
  return room;
}

/* ------------------------------ 1. private notes ------------------------------ */

await check('a student socket never receives block notes; the host does', async () => {
  const SECRET = 'answer is 42, ask Sam first';
  const db = makeTestDb(SCHEMA);
  const host = new Ws({ role: 'host', uid: 'host' });
  const ana = new Ws({ role: 'student', uid: '1', name: 'Ana' });
  const room = makeRoom(db, [host, ana], 'NOTE');
  await new Promise((r) => setTimeout(r, 0));
  room.s.session = S.newSession({
    template: 'build',
    blocks: [
      { type: 'poll', title: 'Warm-up', minutes: 5, notes: SECRET, screen: 'Answer the poll' },
      // A block saved before `screen` existed: its old text is officer-only now.
      { type: 'close', title: 'Close', minutes: 2, notes: `legacy ${SECRET}` },
    ],
  });
  const msg = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m));
  await msg(host, { t: 'block_next' });
  await msg(host, { t: 'blocks_set', blocks: [...room.s.session.blocks, { type: 'show', title: 'Show', minutes: 3, notes: SECRET }] });
  await msg(ana, { t: 'pulse', v: 'fast' });
  assert.ok(ana.sent.length >= 3);
  for (const view of ana.sent) {
    const text = JSON.stringify(view);
    assert.ok(!text.includes(SECRET), 'no officer note text in a student payload');
    assert.ok(!text.includes('"notes"'), 'no notes field in a student payload');
  }
  assert.equal(ana.sent.at(-1).session.blocks[0].screen, 'Answer the poll', 'students get the on-screen text');
  assert.equal(host.sent.at(-1).session.blocks[0].notes, SECRET, 'the host console keeps the notes');
});

await check('cleanBlocks keeps notes and screen apart and bounds both', async () => {
  const [x] = cleanBlocks([{ type: 'hook', title: 'Hi', minutes: 3, notes: ` ${'n'.repeat(600)} `, screen: '  Look up  ' }]);
  assert.equal(x.notes.length, 500);
  assert.equal(x.screen, 'Look up');
  const [legacy] = cleanBlocks([{ type: 'hook', title: 'Old', minutes: 3, notes: 'old text' }]);
  assert.deepEqual([legacy.notes, legacy.screen], ['old text', ''], 'legacy notes stay officer-only');
});

/* --------------------------- 2. attendance on check-in --------------------------- */

await check('ending mid-lab pays all three who checked in; doing something adds the capped bonus', async () => {
  const db = makeTestDb(SCHEMA);
  db.exec(`INSERT INTO students (id, name) VALUES (10, 'Ana'), (11, 'Ben'), (12, 'Cy');
    INSERT INTO users (id, email, name, student_id) VALUES (1, 'a@x.org', 'Ana', 10), (2, 'b@x.org', 'Ben', 11), (3, 'c@x.org', 'Cy', 12);
    INSERT INTO rooms (code, title, kind, template) VALUES ('LAB1', 'Lab night', 'meeting', 'build'), ('LAB2', 'Second room', 'meeting', 'build');
    INSERT INTO room_checkins (code, user_id, exit_kind) VALUES ('LAB1', 1, NULL), ('LAB1', 2, NULL), ('LAB1', 3, 'lab'), ('LAB2', 3, 'poll')`);
  const r = await awardAttendance(db, 'LAB1');
  assert.deepEqual(r, { awarded: 3, alreadyHad: 0, unlinked: 0, noExit: 2, bonus: 1 }, 'was 0 of 3 before V3-A');
  // Only attendance and its bonus here: a first meeting also finishes a quest, which pays on its own.
  const MEET = `SELECT student_id, SUM(points) AS p FROM activity WHERE kind IN ('attend', 'active')`;
  const pts = (await db.prepare(`${MEET} GROUP BY student_id ORDER BY student_id`).all()).results;
  const attend = POINT_RULES.attend.points * 2; // first three meetings double
  assert.deepEqual(pts.map((x) => x.p), [attend, attend, attend + POINT_RULES.active.points]);
  // Same day, second room: attendance is once a day, and so is the bonus.
  await awardAttendance(db, 'LAB2');
  const cy = await db.prepare(`${MEET} AND student_id = 12`).first();
  assert.equal(cy.p, attend + POINT_RULES.active.points, 'caps hold across rooms on one day');
  assert.equal(pointsFor('active', {}, [{ kind: 'active', at: '2026-11-18 15:00:00', points: 3 }], undefined, '2026-11-18 18:00:00'), 0);
});

/* ----------------------------- 3. end-room warning ----------------------------- */

await check('the end-room warning says who is paid and what is unusual', async () => {
  assert.deepEqual(endWarning({ joined: 12, exits: 9 }), ['12 checked in will be paid attendance.', '3 have not done anything else yet, so no bonus.']);
  assert.deepEqual(endWarning({ joined: 2, exits: 1, dropin: true }), ['2 checked in will be paid the drop-in amount.', '1 has not done anything else yet, so no bonus.']);
  assert.deepEqual(endWarning({ joined: 4, exits: 4 }), ['4 checked in will be paid attendance.']);
  assert.equal(endWarning({ joined: 0 })[0], 'Nobody has checked in, so nobody is paid.');
  const w = endWarning({ joined: 3, exits: 3, duelLive: true, contestLive: true, helpOpen: 1 });
  assert.ok(w.some((l) => l.startsWith('A duel round')) && w.some((l) => l.startsWith('The contest')) && w.includes('1 help request is still open.'));
});

await check('the host view counts who joined; a student view does not', async () => {
  const db = makeTestDb(SCHEMA);
  const host = new Ws({ role: 'host', uid: 'host' });
  const ana = new Ws({ role: 'student', uid: '1', name: 'Ana' });
  const room = makeRoom(db, [host, ana], 'JOIN');
  await new Promise((r) => setTimeout(r, 0));
  Object.assign(room.s, { names: { 1: 'Ana', 2: 'Ben' }, exits: { 1: 'poll' } });
  assert.equal(room.view('host', 'host').joined, 2);
  assert.equal(room.view('host', 'host').exits, 1);
  assert.equal(room.view('student', '1').joined, undefined);
});

/* -------------------------------- 4. auto-close -------------------------------- */

await check('the cron closes and pays only rooms open longer than eight hours', async () => {
  const db = makeTestDb(SCHEMA);
  db.exec(`INSERT INTO students (id, name) VALUES (10, 'Ana');
    INSERT INTO users (id, email, name, student_id) VALUES (1, 'a@x.org', 'Ana', 10);
    INSERT INTO rooms (code, title, created_at, closed_at) VALUES
      ('OLD1', 'Forgotten', '2026-11-18 08:00:00', NULL),
      ('EDGE', 'Exactly eight hours', '2026-11-18 12:00:00', NULL),
      ('NEW1', 'Running now', '2026-11-18 19:00:00', NULL),
      ('DONE', 'Closed already', '2026-11-17 08:00:00', '2026-11-17 09:00:00');
    INSERT INTO room_checkins (code, user_id, joined_at) VALUES ('OLD1', 1, '2026-11-18 08:05:00')`);
  const now = new Date('2026-11-18T20:00:00Z');
  assert.deepEqual(await staleRooms(db, now), ['OLD1'], 'eight hours to the second is not yet stale');
  assert.deepEqual(await autoCloseRooms({ DB: db }, now), { closed: ['OLD1'], failed: [] });
  assert.ok((await db.prepare(`SELECT closed_at FROM rooms WHERE code = 'OLD1'`).first()).closed_at);
  const att = await db.prepare(`SELECT points, created_at FROM activity WHERE kind = 'attend'`).first();
  assert.equal(att.created_at, '2026-11-18 08:05:00', 'paid on the day they came');
  assert.deepEqual(await autoCloseRooms({ DB: db }, now), { closed: [], failed: [] }, 'nothing left to close');
});

/* ---------------------------- 5. one points table ---------------------------- */

await check('the points table comes from the rules, with caps in words, and no manual row', async () => {
  const t = pointsTable();
  assert.ok(!t.some((r) => r.kind === 'manual'));
  const attend = t.find((r) => r.kind === 'attend');
  assert.deepEqual(attend, { kind: 'attend', label: 'Come to a meeting', points: POINT_RULES.attend.points, cap: 'once a day, your first 3 count double' });
  assert.equal(t.find((r) => r.kind === 'place').cap, 'up to 50 points a season, an officer checks it');
  assert.equal(capText({ points: 1 }), null);
  assert.ok(t.every((r) => r.label && Number.isInteger(r.points)));
});

await check('GET /api/club is public: meeting settings, the next unheld session, live point rules', async () => {
  const db = makeTestDb(SCHEMA);
  const env = { DB: db, ADMIN_PASSWORD: 'pw', SESSION_SECRET: 's' };
  const get = async () => {
    const res = await worker.fetch(new Request('https://club.test/api/club'), env, { waitUntil() {} });
    return { status: res.status, body: await res.json() };
  };
  let r = await get();
  assert.equal(r.status, 200, 'no sign-in needed');
  assert.deepEqual(r.body.meeting, { day: '', time: '', place: '', note: '' });
  assert.equal(r.body.next, null);
  const today = chicagoDate();
  db.exec(`INSERT INTO settings (key, value) VALUES ('meeting_day', 'Tuesdays'), ('meeting_time', ' 4:15 pm '), ('meeting_place', 'Room 2104'),
      ('point_rules', '{"attend":{"points":12}}');
    INSERT INTO rooms (code, title) VALUES ('HELD', 'Held');
    INSERT INTO planned_sessions (date, title, template, blocks, room_code) VALUES
      ('${today}', 'Already running', 'build', '[{"type":"hook","title":"x","minutes":3,"notes":"secret"}]', 'HELD'),
      ('2099-01-05', 'Duel night', 'duel', '[{"type":"hook","title":"x","minutes":3,"notes":"secret"}]', NULL),
      ('2000-01-01', 'Long ago', 'build', '[]', NULL)`);
  r = await get();
  assert.deepEqual(r.body.meeting, { day: 'Tuesdays', time: '4:15 pm', place: 'Room 2104', note: '' });
  assert.deepEqual(r.body.next, { date: '2099-01-05', title: 'Duel night', kind: 'Duel night' });
  assert.equal(r.body.points.find((p) => p.kind === 'attend').points, 12, 'officer overrides show up');
  assert.ok(!JSON.stringify(r.body).includes('secret'), 'no block notes');
});

/* ------------------------------ 6. readable labels ------------------------------ */

await check('ledger reasons read as plain words, old and hand-written ones untouched', async () => {
  const cases = {
    'duel: duel-win:H72R:3': 'Duel night: won a round',
    'duel: duel:H72R:3': 'Duel night: played a round',
    'attend: Week 12 meeting': 'Meeting: Week 12 meeting',
    'attend: room:ABCD': 'Came to a meeting',
    'active: Lab night': 'Took part in: Lab night',
    'daily: 2026-11-10': 'Daily problem: Nov 10',
    'solve: rung:12': 'Practice: solved a problem',
    'solve: cf:1234A': 'Practice: solved a problem',
    'solve: Data: Titanic': 'Data: Titanic',
    'place: USACO Bronze #2': 'USACO Bronze: 2nd place',
    'place: USACO Bronze #11': 'USACO Bronze: 11th place',
    'place: USACO Bronze': 'Placed: USACO Bronze',
    'compete: comp:3': 'Entered a competition',
    'mentor: help:ROOM:4': 'Helped another member',
    'quest: In the room': 'Quest: In the room',
    'Meeting: Week 1 (ABCD)': 'Meeting: Week 1 (ABCD)',
    'Taught a workshop': 'Taught a workshop',
    '': 'Points',
  };
  for (const [reason, want] of Object.entries(cases)) assert.equal(pointLabel(reason), want, reason);
  assert.deepEqual(groupLabels(['duel: duel-win:A:1', 'duel: duel:A:1', 'duel: duel-win:A:2', 'duel: duel:A:2', 'attend: Week 1', 'attend: Week 1']), [
    'Duel night: won 2 rounds',
    'Duel night: played 2 rounds',
    'Meeting: Week 1 (x2)',
  ]);
});

await check('a placing is written with its place, so the label says it', async () => {
  const db = makeTestDb(SCHEMA);
  db.exec(`INSERT INTO students (id, name) VALUES (10, 'Ana')`);
  await recordActivity(db, { studentId: 10, kind: 'place', ref: 'comp:1', meta: { title: 'USACO Bronze', place: 2 }, status: 'approved' });
  const { reason } = await db.prepare('SELECT reason FROM point_events').first();
  assert.equal(pointLabel(reason), 'USACO Bronze: 2nd place');
});

await check('the digest groups points by member, drops zero rows and shows no raw refs', async () => {
  const members = groupPoints([
    { student_id: 1, name: 'Ana', delta: 2, reason: 'duel: duel-win:H72R:1' },
    { student_id: 1, name: 'Ana', delta: 2, reason: 'duel: duel-win:H72R:2' },
    { student_id: 1, name: 'Ana', delta: 0, reason: 'duel: duel:H72R:3' },
    { student_id: 2, name: 'Ben', delta: 25, reason: 'place: USACO Bronze #2' },
    { student_id: 3, name: 'Cy', delta: 0, reason: 'solve: rung:4' },
  ]);
  assert.deepEqual(members, [
    { name: 'Ben', total: 25, items: ['USACO Bronze: 2nd place'] },
    { name: 'Ana', total: 4, items: ['Duel night: won 2 rounds'] },
  ]);
  const db = makeTestDb(SCHEMA);
  db.exec(`INSERT INTO students (id, name) VALUES (10, 'Ana Lee');
    INSERT INTO point_events (student_id, delta, reason) VALUES (10, 0, 'duel: duel:H72R:3')`);
  assert.equal(await buildDigest(db, '2000-01-01T00:00:00Z'), null, 'a week of +0 rows sends nothing');
  db.exec(`INSERT INTO point_events (student_id, delta, reason) VALUES (10, 2, 'duel: duel-win:H72R:3')`);
  const d = await buildDigest(db, '2000-01-01T00:00:00Z');
  assert.equal(d.members.length, 1);
  assert.deepEqual(d.members[0].items, ['Duel night: won a round']);
});

/* --------------------------- 7. 60 and 120 minute rooms --------------------------- */

await check('a room remembers the length the officer picked; odd lengths fall back to 120', async () => {
  const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
  const officer = `${COOKIE}=${await signSession(env)}`;
  const open = async (body) => {
    const res = await worker.fetch(
      new Request('https://club.test/api/admin/hub/rooms', { method: 'POST', headers: { Cookie: officer, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      env,
      { waitUntil() {} }
    );
    return res.json();
  };
  const short = await open({ title: 'Quick duel', template: 'duel', minutes: 60 });
  const odd = await open({ title: 'Odd', template: 'duel', minutes: 45 });
  const plain = await open({ title: 'Plain', template: 'build' });
  assert.deepEqual([short.minutes, odd.minutes, plain.minutes], [60, 120, 120]);
  const row = await env.DB.prepare('SELECT minutes FROM rooms WHERE code = ?').bind(short.code).first();
  assert.equal(row.minutes, 60);
});

/* ------------------------------ 8. dev content seeds ------------------------------ */

await check('every seed the dev deploy loads is safe to re-run and adds no members', async () => {
  const yml = fs.readFileSync(new URL('../.github/workflows/deploy-dev.yml', import.meta.url), 'utf8');
  const step = yml.slice(yml.indexOf('Load content seeds'));
  const files = [...step.slice(0, step.indexOf('done')).matchAll(/worker\/(seed[\w-]*\.sql)/g)].map((m) => m[1]);
  assert.ok(files.includes('seed-problems.sql') && files.includes('seed-rungs.sql'), 'the step lists the content seeds');
  for (const bad of ['seed.sql', 'seed-demo-standings.sql', 'seed-cycles.sql']) assert.ok(!files.includes(bad), `${bad} holds made-up members`);
  const db = makeTestDb(SCHEMA);
  const tables = (await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all()).results.map((r) => r.name);
  const counts = async () => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, (await db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).first()).n])));
  for (const f of files) {
    const url = new URL(`../worker/${f}`, import.meta.url);
    if (!fs.existsSync(url)) continue; // seed-packs.sql arrives with V3-B
    const sql = fs.readFileSync(url, 'utf8');
    db.exec(sql);
    const once = await counts();
    db.exec(sql);
    assert.deepEqual(await counts(), once, `${f}: a second run adds nothing`);
  }
  const after = await counts();
  assert.ok(after.problems > 0 && after.rungs > 0 && after.data_challenges > 0, 'content arrived');
  assert.equal(after.students + after.users, 0, 'no members');
});

console.log(`trust: ${passed} checks passed`);
