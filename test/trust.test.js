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
import { awardAttendance } from '../worker/hub/rooms.js';
import { POINT_RULES, pointsFor } from '../shared/points.js';

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

console.log(`trust: ${passed} checks passed`);
