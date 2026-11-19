/**
 * The meeting as a system: run-of-show blocks (B1), lab (B3), check-in and
 * attendance eligibility (B4), show (B6), help queue (B7), speaker (B8) and
 * drop-ins (B10). Pure rules first, then the room Durable Object over a fake
 * D1, then the real Worker routes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { BLOCK_TYPES, LENGTHS, TEMPLATES, cleanBlocks, templateBlocks } from '../shared/session-templates.js';
import * as S from '../worker/hub/session.js';
import { exportFor } from '../worker/hub/safety.js';
import { Room, labCheckpoints } from '../worker/hub/room-do.js';
import { awardAttendance, checkinToken, currentToken, tokenOk, CHECKIN_MS } from '../worker/hub/rooms.js';
import { pointsFor, POINT_RULES } from '../shared/points.js';

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

/* ------------------------------ B1 templates ------------------------------ */

// V3-A: every template in both lengths, each filling its length exactly.
for (const [id, t] of Object.entries(TEMPLATES)) for (const len of LENGTHS) {
  const blocks = templateBlocks(id, len);
  const at = `${id} ${len}`;
  assert.equal(blocks.length, t.lengths[len].length, `${at}: nothing dropped by the validator`);
  assert.ok(blocks.every((b) => BLOCK_TYPES.includes(b.type) && b.title && b.minutes > 0), `${at}: typed, titled, timed`);
  assert.equal(new Set(blocks.map((b) => b.id)).size, blocks.length, `${at}: unique ids`);
  assert.deepEqual(cleanBlocks(blocks), blocks, `${at}: validating twice changes nothing`);
  assert.equal(blocks.reduce((n, b) => n + b.minutes, 0), len, `${at}: fills the meeting`);
  assert.equal(blocks.at(-1).type, 'close', `${at}: ends with a close`);
  assert.equal(blocks.some((b) => b.type === 'break'), len === 120, `${at}: a break in the long version only`);
  for (const b of blocks.filter((x) => x.type === 'lab')) {
    assert.equal(b.lab.tiers.length, 3, `${at}: three tiers`);
    assert.ok(labCheckpoints(b).every((c) => c.length > 0), `${at}: every tier has checkpoints from a real course`);
  }
}
assert.deepEqual(templateBlocks('duel'), templateBlocks('duel', 120), '120 is the default');
assert.deepEqual(templateBlocks('duel', 45), templateBlocks('duel', 120), 'an odd length falls back to the default');
// The 120-minute duel night from the officer audit, block by block.
assert.deepEqual(
  templateBlocks('duel', 120).map((b) => [b.type, b.minutes]),
  [['hook', 10], ['hook', 10], ['duel', 45], ['break', 10], ['duel', 20], ['show', 15], ['close', 10]]
);
assert.equal(S.newSession({ template: 'build', minutes: '60' }).blocks.length, templateBlocks('build', 60).length, 'a room opens at its length');
assert.ok(templateBlocks('mock').some((b) => b.type === 'contest'), 'mock contest runs the B5 team contest block');
assert.deepEqual(templateBlocks('nope'), []);
// Validation: bad types dropped, text trimmed, minutes bounded, bad lab sources fall back.
{
  const out = cleanBlocks([
    { type: 'poll', title: '  Hi  ', minutes: 500 },
    { type: 'rm -rf', title: 'x' },
    { type: 'lab', lab: { tiers: [{ name: 'A', source: 'javascript:alert(1)' }] } },
    { id: 'b1', type: 'close' },
  ]);
  assert.deepEqual(out.map((b) => b.type), ['poll', 'lab', 'close']);
  assert.equal(out[0].title, 'Hi');
  assert.equal(out[0].minutes, 0);
  assert.equal(out[1].lab.tiers.length, 3, 'unusable tiers fall back to the defaults');
  assert.equal(new Set(out.map((b) => b.id)).size, 3);
}

/* ---------------------------- B1 state machine ---------------------------- */

{
  const sess = S.newSession({ template: 'build', minutes: 60 });
  assert.equal(sess.cur, -1, 'starts on the join screen');
  assert.ok(S.goTo(sess, 0, 1000).ok);
  assert.equal(sess.endsAt, 1000 + sess.blocks[0].minutes * 60_000, 'block timer starts');
  assert.ok(S.goTo(sess, 99, 1).error);
  assert.ok(S.goTo(sess, -2, 1).error);
  S.goTo(sess, 2, 5000);
  assert.equal(S.currentBlock(sess).type, 'lab');
  assert.ok(S.addTime(sess, 2, 6000).ok);
  assert.equal(sess.endsAt, 5000 + (sess.blocks[2].minutes + 2) * 60_000);
  // Edit during the meeting: the current block survives a reorder and keeps its timer.
  const lab = sess.blocks[2];
  const ends = sess.endsAt;
  assert.ok(S.setBlocks(sess, [lab, ...sess.blocks.filter((b) => b !== lab)], 7000).ok);
  assert.equal(sess.cur, 0);
  assert.equal(sess.endsAt, ends);
  // Removing the current block moves to the block now at that place, fresh.
  assert.ok(S.setBlocks(sess, sess.blocks.slice(1), 8000).ok);
  assert.equal(sess.cur, 0);
  assert.equal(sess.startedAt, 8000);
  assert.ok(S.setBlocks(sess, [], 1).error, 'cannot empty the agenda');
  const drop = S.newSession({ kind: 'dropin' });
  assert.deepEqual(drop.blocks, []);
  assert.ok(S.goTo(drop, 0, 1).error, 'drop-ins have no agenda');
}

/* ------------------------------- B7 help queue ------------------------------ */

{
  const h = [];
  assert.ok(S.helpAsk(h, 'a', 'no', 1).error, 'too short');
  assert.ok(S.helpAsk(h, 'a', 'my loop never ends', 1).ok);
  assert.ok(S.helpOffer(h, 'a', 1).error, 'cannot offer on your own');
  assert.ok(S.helpSolve(h, 'a', 1, 'b').error, 'helper must have offered');
  assert.ok(S.helpOffer(h, 'b', 1).ok);
  assert.ok(S.helpSolve(h, 'b', 1, 'b').error, 'only the asker marks it solved');
  assert.deepEqual(S.helpSolve(h, 'a', 1, 'b'), { ok: true, helper: 'b', topic: 'my loop never ends' });
  assert.ok(S.helpSolve(h, 'a', 1, 'b').error, 'solving twice is refused');
  S.helpAsk(h, 'a', 'second thing', 2);
  S.helpAsk(h, 'a', 'third thing', 3);
  assert.ok(S.helpAsk(h, 'a', 'fourth thing', 4).error, 'two open at a time');
  assert.ok(S.helpClose(h, 2, 'b').error, 'only the asker withdraws');
  assert.ok(S.helpClose(h, 2, 'a').ok);
  assert.ok(S.helpClose(h, 3).ok, 'an officer clears it');
}

/* -------------------------------- B8 speaker ------------------------------- */

{
  const sp = S.freshSpeaker();
  S.sqAsk(sp, 'a', 'How did you get started?', 1);
  S.sqAsk(sp, 'b', 'What do you use daily?', 2);
  assert.ok(S.sqVote(sp, 'a', 1).error, 'no upvoting your own');
  assert.ok(S.sqVote(sp, 'b', 1).ok);
  assert.ok(S.sqVote(sp, 'c', 1).ok);
  assert.equal(sp.qs[0].votes.length, 2, 'one vote each');
  S.sqVote(sp, 'c', 1);
  assert.equal(sp.qs[0].votes.length, 1, 'pressing again takes it back');
  S.sqVote(sp, 'c', 1);
  S.sqVote(sp, 'c', 1);
  S.sqVote(sp, 'c', 1);
  assert.equal(sp.qs[0].votes.filter((v) => v === 'c').length, 1, 'never more than one per member');
  assert.deepEqual(S.sqOrder(sp.qs).map((q) => q.id), [1, 2], 'most votes first');
  S.sqAnswered(sp, 1);
  assert.deepEqual(S.sqOrder(sp.qs).map((q) => q.id), [2, 1], 'answered sink');
  assert.ok(S.sqVote(sp, 'd', 1).error, 'no votes on answered questions');
  for (let i = 0; i < 3; i++) S.sqAsk(sp, 'z', `question ${i}`, 10 + i);
  assert.ok(S.sqAsk(sp, 'z', 'one more', 20).error);
}

/* --------------------------------- B6 show --------------------------------- */

{
  const sh = S.freshShow();
  assert.ok(S.showSubmit(sh, 'a', { kind: 'link', url: 'http://x.com', line: 'my site' }, {}, 1).error, 'https only');
  assert.ok(S.showSubmit(sh, 'a', { kind: 'link', url: 'javascript:alert(1)', line: 'xss' }, {}, 1).error);
  assert.ok(S.showSubmit(sh, 'a', { kind: 'lab', line: 'my lab' }, { lab: null }, 1).error, 'a result must be earned');
  assert.ok(S.showSubmit(sh, 'a', { kind: 'lab', line: 'my lab' }, { lab: 'Passed 2' }, 1).ok);
  assert.ok(S.showSubmit(sh, 'a', { kind: 'link', url: 'https://a.dev', line: 'better' }, {}, 2).ok);
  assert.equal(sh.items.length, 1, 'one per member: resubmitting replaces');
  S.showSubmit(sh, 'b', { kind: 'link', url: 'https://b.dev', line: 'b thing' }, {}, 3);
  assert.ok(S.showKudos(sh, 'a', 2).error, 'no kudos for yourself');
  assert.ok(S.showKudos(sh, 'b', 2).ok);
  assert.ok(S.showKudos(sh, 'b', 2).error, 'one kudos per artifact');
  for (const id of [2, 3]) assert.ok(S.showPick(sh, id).ok);
  S.showSubmit(sh, 'c', { kind: 'link', url: 'https://c.dev', line: 'c' }, {}, 4);
  S.showSubmit(sh, 'd', { kind: 'link', url: 'https://d.dev', line: 'd' }, {}, 5);
  S.showPick(sh, 4);
  assert.ok(S.showPick(sh, 5).error, 'three on screen at most');
  S.showPick(sh, 4);
  assert.deepEqual(sh.picked, [2, 3]);
}

/* ---------------------------------- B3 lab --------------------------------- */

{
  const tiers = [{ name: 'A' }, { name: 'B' }];
  const cps = [['s1', 's2', 's3'], ['p1']];
  const lab = S.freshLab();
  assert.ok(S.labPass(lab, 'u1', 's1', cps).error, 'pick a tier first');
  for (const u of ['u1', 'u2', 'u3']) S.labPick(lab, u, 0, tiers);
  S.labPick(lab, 'u4', 1, tiers);
  assert.ok(S.labPick(lab, 'u5', 7, tiers).error);
  assert.ok(S.labPass(lab, 'u1', 'p1', cps).error, 'checkpoint from another tier');
  S.labPass(lab, 'u1', 's1', cps);
  S.labPass(lab, 'u1', 's2', cps);
  S.labPass(lab, 'u2', 's1', cps);
  assert.ok(S.labPass(lab, 'u2', 's1', cps).repeat);
  assert.deepEqual(S.labCounts(lab, tiers, cps), [
    { name: 'A', people: 3, past: [2, 1, 0] },
    { name: 'B', people: 1, past: [0] },
  ]);
  // Pair swap: seat 0 drives for the first 7 minutes, then seat 1.
  assert.equal(S.pairRole(0, 0, 60_000).driving, true);
  assert.equal(S.pairRole(1, 0, 60_000).driving, false);
  assert.equal(S.pairRole(0, 0, S.SWAP_MS + 1).driving, false);
  assert.equal(S.pairRole(0, 0, 1).swapAt, S.SWAP_MS);
}

/* ------------------------------ B4 token rules ----------------------------- */

{
  const t0 = 10 * CHECKIN_MS + 1000;
  const { token, rotatesAt } = await currentToken('sec', 'ABCD', t0);
  assert.match(token, /^[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(rotatesAt, 11 * CHECKIN_MS);
  assert.ok(await tokenOk('sec', 'ABCD', token, t0));
  assert.ok(await tokenOk('sec', 'ABCD', token.toLowerCase(), t0), 'case does not matter');
  assert.ok(!(await tokenOk('sec', 'WXYZ', token, t0)), 'tokens are per room');
  assert.ok(!(await tokenOk('other', 'ABCD', token, t0)), 'tokens depend on the secret');
  assert.ok(await tokenOk('sec', 'ABCD', token, rotatesAt + 30_000), 'a few seconds of grace after it flips');
  assert.ok(!(await tokenOk('sec', 'ABCD', token, rotatesAt + 60_000)), 'stale after the grace');
  assert.ok(!(await tokenOk('sec', 'ABCD', token, t0 + 3 * CHECKIN_MS)), 'a code from the group chat stops working');
  assert.notEqual(await checkinToken('sec', 'ABCD', 10), await checkinToken('sec', 'ABCD', 11));
  assert.ok(!(await tokenOk('sec', 'ABCD', '', t0)));
}

/* -------------------------- the room Durable Object ------------------------- */

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

function makeRoom(db, sockets, code = 'ROOM') {
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
  return room;
}

{
  const db = makeTestDb(schema);
  db.exec(`INSERT INTO students (id, name) VALUES (10, 'Ana'), (11, 'Ben'), (12, 'Cy'), (13, 'Dee'), (14, 'Eli'), (15, 'Fay')`);
  db.exec(`INSERT INTO users (id, email, name, student_id) VALUES
    (1, 'a@x.org', 'Ana A', 10), (2, 'b@x.org', 'Ben B', 11), (3, 'c@x.org', 'Cy C', 12),
    (4, 'd@x.org', 'Dee D', 13), (5, 'e@x.org', 'Eli E', 14), (6, 'f@x.org', 'Fay F', 15)`);
  db.exec(`INSERT INTO rooms (code, title, kind, template) VALUES ('ROOM', 'Build night', 'meeting', 'build')`);
  db.exec(`INSERT INTO room_checkins (code, user_id) VALUES ('ROOM', 1), ('ROOM', 2), ('ROOM', 3), ('ROOM', 4), ('ROOM', 5), ('ROOM', 6)`);
  db.exec(`INSERT INTO problems (slug, title, cases, solution, status) VALUES ('sum', 'Sum', '[]', 'x', 'live')`);

  const host = new Ws({ role: 'host', uid: 'host' });
  const st = [1, 2, 3, 4, 5, 6].map((i) => new Ws({ role: 'student', uid: String(i), name: `S${i}` }));
  const [ana, ben, cy, dee, eli, fay] = st;
  const room = makeRoom(db, [host, ...st]);
  await new Promise((r) => setTimeout(r, 0));
  Object.assign(room.s, { code: 'ROOM', names: { 1: 'Ana A', 2: 'Ben B', 3: 'Cy C', 4: 'Dee D', 5: 'Eli E', 6: 'Fay F' } });
  room.s.session = S.newSession({ template: 'build', minutes: 60 });
  const msg = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m));
  const last = (ws) => ws.sent.at(-1);
  const sess = () => room.s.session;
  const exitOf = async (uid) => (await db.prepare('SELECT exit_kind FROM room_checkins WHERE user_id = ?').bind(uid).first()).exit_kind;

  // Host-only control: a student cannot move, time or edit the run-of-show.
  for (const m of [{ t: 'block_go', i: 2 }, { t: 'block_next' }, { t: 'blocks_set', blocks: [] }, { t: 'block_time', minutes: 5 }, { t: 'takeaways', text: 'x' }, { t: 'show_pick', id: 1 }]) {
    await msg(ana, m);
  }
  assert.equal(sess().cur, -1);
  assert.equal(sess().blocks.length, 5);
  assert.equal(room.s.speaker.takeaways, '');

  // Poll block: the existing quiz. Answering is an exit artifact.
  await msg(host, { t: 'block_next' });
  assert.equal(last(ana).session.cur, 0, 'every screen follows');
  await msg(host, { t: 'ask', text: 'Q?', options: ['a', 'b'], correct: 0, seconds: 10 });
  await msg(ana, { t: 'answer', choice: 0 });
  assert.equal(last(host).answered, 1, 'quiz still works');
  assert.equal(await exitOf(1), 'poll');
  assert.equal(last(ana).exit, 'poll', 'the student sees what counted');
  assert.equal(last(ben).exit, null);

  // Lab block: tiers, checkpoints, anonymous counts on the projector.
  await msg(host, { t: 'block_go', i: 2 });
  assert.equal(last(host).q, null, 'leaving the poll block clears its question');
  assert.equal(last(ben).lab.tiers.length, 3);
  await msg(ben, { t: 'lab_pass', step: 'fill-template' });
  assert.equal(last(ben).t, 'notice', 'pick a tier first');
  await msg(ben, { t: 'lab_tier', tier: 0 });
  await msg(cy, { t: 'lab_tier', tier: 0 });
  await msg(dee, { t: 'lab_tier', tier: 1 });
  const cp0 = last(ben).lab.checkpoints;
  assert.ok(cp0.length >= 3);
  await msg(ben, { t: 'lab_pass', step: cp0[0] });
  await msg(ben, { t: 'lab_pass', step: cp0[1] });
  await msg(cy, { t: 'lab_pass', step: cp0[0] });
  await msg(cy, { t: 'lab_pass', step: 'not-a-step' });
  assert.equal(last(cy).t, 'notice');
  assert.equal(await exitOf(2), 'lab');
  assert.equal(await exitOf(3), 'lab');
  assert.equal(await exitOf(4), null, 'picking a tier is not enough');
  const hv = last(host).lab;
  assert.deepEqual(hv.counts[0].past.slice(0, 2), [2, 1], '"2 past checkpoint 1"');
  assert.equal(hv.counts[1].people, 1);
  const projector = JSON.stringify(hv);
  for (const n of ['Ana', 'Ben', 'Cy', 'Dee', '"2"', '"3"', 'uids', 'picks', 'passed'])assert.ok(!projector.includes(n), `projector lab view has no ${n}`);
  assert.deepEqual(last(ben).lab.passed, cp0.slice(0, 2), 'a student sees their own progress');

  // Pair mode: partner and seat for the swap timer.
  await msg(host, { t: 'pairs', mode: 'random' });
  assert.equal(last(ben).pairs.length >= 1, true);
  assert.ok([0, 1, 2].includes(last(ben).lab.seat));

  // Duel inside the run-of-show: an attempt is an exit artifact.
  await msg(host, { t: 'duel_setup', problems: { new: ['sum'] }, minutes: 5, rounds: 1 });
  await msg(dee, { t: 'duel_div', div: 'new' });
  await msg(eli, { t: 'duel_div', div: 'new' });
  await msg(host, { t: 'duel_start' });
  await msg(dee, { t: 'duel_submit', round: 1, slug: 'sum', passed: false, code: 'print(0)' });
  await msg(eli, { t: 'duel_submit', round: 1, slug: 'sum', passed: true, code: 'print(1)' });
  assert.equal(await exitOf(4), 'duel');
  assert.equal(await exitOf(5), 'duel');

  // Help queue: a peer helper is paid once, through the ledger, as mentor.
  await msg(fay, { t: 'help_ask', topic: 'my loop never ends' });
  const hid = last(fay).help[0].id;
  assert.equal(last(host).helpOpen, 1);
  assert.equal(last(ben).help[0].name, 'Fay', 'members see first names so they can go help');
  await msg(ben, { t: 'help_offer', id: hid });
  assert.deepEqual(last(fay).help[0].helpers, [{ uid: '2', name: 'Ben B' }]);
  await msg(fay, { t: 'help_solve', id: hid, helper: '2' });
  await msg(fay, { t: 'help_solve', id: hid, helper: '2' });
  const mentor = (await db.prepare(`SELECT student_id, ref, status FROM activity WHERE kind = 'mentor'`).all()).results;
  assert.deepEqual(mentor, [{ student_id: 11, ref: `help:ROOM:${hid}`, status: 'pending' }], 'one mentor activity, pending officer approval');
  assert.equal(last(host).helpOpen, 0);
  assert.equal(await exitOf(6), null, 'asking for help is not an exit artifact');

  // Show block: a link and an earned result; kudos once; host picks; saved to D1.
  await msg(host, { t: 'block_go', i: 3 });
  await msg(eli, { t: 'show_submit', kind: 'duel', line: 'I won my match' });
  await msg(ben, { t: 'show_submit', kind: 'link', url: 'https://ben.dev/game', line: 'A text adventure' });
  await msg(fay, { t: 'show_submit', kind: 'lab', line: 'Nothing passed' });
  assert.equal(last(fay).t, 'notice', 'a lab result must be earned');
  const benItem = last(host).show.items.find((x) => x.name === 'Ben B');
  await msg(cy, { t: 'show_kudos', id: benItem.id });
  await msg(cy, { t: 'show_kudos', id: benItem.id });
  await msg(ben, { t: 'show_kudos', id: benItem.id });
  await msg(host, { t: 'show_pick', id: benItem.id });
  const arts = (await db.prepare('SELECT user_id, kind, url, line, result, kudos, shown FROM artifacts ORDER BY user_id').all()).results;
  assert.deepEqual(arts, [
    { user_id: 2, kind: 'link', url: 'https://ben.dev/game', line: 'A text adventure', result: '', kudos: 1, shown: 1 },
    { user_id: 5, kind: 'duel', url: '', line: 'I won my match', result: 'Solved Sum in a duel', kudos: 0, shown: 0 },
  ]);
  // G5: the member's own export includes what they showed.
  const exp = await exportFor(db, { id: 2, student_id: null });
  assert.deepEqual(exp.artifacts.map((a) => [a.room_code, a.kind, a.url, a.kudos]), [['ROOM', 'link', 'https://ben.dev/game', 1]]);
  const points = (await db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE kind NOT IN ('mentor', 'duel')`).first()).n;
  assert.equal(points, 0, 'artifacts and kudos write nothing to the ledger');

  // Close block: the one-line "what I did" is the last exit path.
  await msg(fay, { t: 'note', text: 'paired with Ben on the lab' });
  assert.equal(last(fay).t, 'notice', 'the exit line opens at the close');
  await msg(host, { t: 'block_go', i: 4 });
  await msg(fay, { t: 'note', text: 'x' });
  assert.equal(last(fay).t, 'notice');
  await msg(fay, { t: 'note', text: 'paired with Ben on the lab' });
  assert.equal(await exitOf(6), 'note');

  // Speaker controls through the room, and takeaways saved with the room.
  await msg(host, { t: 'blocks_set', blocks: [...sess().blocks, { type: 'speaker', title: 'Guest', minutes: 10 }] });
  assert.equal(sess().cur, 4, 'editing keeps the current block');
  await msg(ana, { t: 'sq_ask', text: 'Too early?' });
  assert.equal(last(ana).t, 'notice', 'questions open in the speaker block');
  await msg(host, { t: 'block_next' });
  await msg(ana, { t: 'sq_ask', text: 'How did you start?' });
  const qid = last(ben).speaker.qs[0].id;
  await msg(ben, { t: 'sq_vote', id: qid });
  await msg(ana, { t: 'sq_vote', id: qid });
  assert.equal(last(host).speaker.qs[0].votes, 1);
  assert.ok(!JSON.stringify(last(host).speaker).includes('Ana'), 'questions are anonymous');
  await msg(host, { t: 'takeaways', text: 'Ship small things.' });
  assert.equal((await db.prepare(`SELECT takeaways FROM rooms WHERE code = 'ROOM'`).first()).takeaways, 'Ship small things.');

  // V3-A: closing pays attendance to everyone who checked in, and the `active` bonus to the
  // members with an exit artifact: Ana poll, Ben and Cy lab, Dee and Eli duel, Fay note.
  // Add a seventh who only checked in: paid attendance, no bonus.
  db.exec(`INSERT INTO users (id, email, name, student_id) VALUES (7, 'g@x.org', 'Gus', NULL); INSERT INTO room_checkins (code, user_id) VALUES ('ROOM', 7)`);
  const paid = await awardAttendance(db, 'ROOM');
  assert.deepEqual(paid, { awarded: 7, alreadyHad: 0, unlinked: 0, noExit: 1, bonus: 6 });
  const att = (await db.prepare(`SELECT student_id, json_extract(meta, '$.exit') AS exit FROM activity WHERE kind = 'attend' ORDER BY student_id`).all()).results;
  assert.deepEqual(att.map((a) => a.exit), ['poll', 'lab', 'lab', 'duel', 'duel', 'note', null]);
  const bonus = (await db.prepare(`SELECT COUNT(*) AS n, SUM(points) AS pts FROM activity WHERE kind = 'active'`).first());
  assert.deepEqual({ ...bonus }, { n: 6, pts: 6 * POINT_RULES.active.points });
  assert.equal(await (await db.prepare(`SELECT COUNT(*) AS n FROM students WHERE name = 'Gus'`).first()).n, 1, 'checking in alone puts Gus on the board');
  assert.deepEqual(await awardAttendance(db, 'ROOM'), { awarded: 0, alreadyHad: 7, unlinked: 0, noExit: 1, bonus: 0 }, 'a second close pays nobody twice');
}

/* ------------------------------ B10 drop-in ------------------------------- */

{
  assert.ok(POINT_RULES.dropin.points < POINT_RULES.attend.points, 'a drop-in is worth less than a meeting');
  const at = '2026-11-16 15:00:00';
  const hist = [{ kind: 'dropin', at: '2026-11-17 15:00:00', points: 5 }, { kind: 'dropin', at: '2026-11-18 15:00:00', points: 5 }];
  assert.equal(pointsFor('dropin', {}, [], undefined, at), 5);
  assert.equal(pointsFor('dropin', {}, hist, undefined, '2026-11-19 15:00:00'), 0, 'two a week');
  assert.equal(pointsFor('dropin', {}, hist, undefined, '2026-11-24 15:00:00'), 5, 'next week pays again');

  const db = makeTestDb(schema);
  db.exec(`INSERT INTO students (id, name) VALUES (10, 'Ana');
    INSERT INTO users (id, email, name, student_id) VALUES (1, 'a@x.org', 'Ana', 10);
    INSERT INTO rooms (code, title, kind) VALUES ('DROP', 'Panther Pause', 'dropin');
    INSERT INTO room_checkins (code, user_id) VALUES ('DROP', 1)`);
  const host = new Ws({ role: 'host', uid: 'host' });
  const ana = new Ws({ role: 'student', uid: '1', name: 'Ana' });
  const room = makeRoom(db, [host, ana], 'DROP');
  await new Promise((r) => setTimeout(r, 0));
  Object.assign(room.s, { code: 'DROP', names: { 1: 'Ana' }, session: S.newSession({ kind: 'dropin' }) });
  const msg = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m));
  await msg(host, { t: 'block_next' });
  assert.equal(ana.sent.length, 0, 'no agenda to move');
  await msg(ana, { t: 'help_ask', topic: 'APCSA arrays' });
  await msg(ana, { t: 'note', text: 'Got arrays working' });
  const paid = await awardAttendance(db, 'DROP');
  assert.equal(paid.awarded, 1);
  const a = await db.prepare(`SELECT kind, points, json_extract(meta, '$.dropin') AS d FROM activity`).first();
  assert.deepEqual(a, { kind: 'dropin', points: 5, d: 1 });
}

/* ------------------------------ Worker routes ------------------------------ */

{
  const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(schema) };
  const db = env.DB;
  db.exec(`INSERT INTO users (id, email, name) VALUES (1, 'a@x.org', 'Ana'); INSERT INTO rooms (code, title) VALUES ('ABCD', 'Week 1')`);
  const cookie = `${USER_COOKIE}=${await signValue(env, `1:${Date.now() + 60_000}`)}`;
  const call = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await worker.fetch(
      new Request(`https://club.test/api${path}`, {
        method,
        headers: { Cookie: cookie, ...(body && { 'Content-Type': 'application/json' }), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
      { waitUntil() {}, passThroughOnException() {} }
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  // Officer-only routes.
  const anon = (p, m = 'GET') => worker.fetch(new Request(`https://club.test/api${p}`, { method: m }), env, { waitUntil() {} });
  assert.equal((await anon('/admin/hub/rooms/ABCD/checkin')).status, 401, 'the token is officers only');
  assert.equal((await call('/admin/hub/rooms/ABCD/checkin')).status, 401, 'a member cannot read the token');
  assert.equal((await call('/admin/hub/rooms', { method: 'POST', body: { template: 'build' } })).status, 401);

  // Stale or wrong token: refused, no check-in row, and the socket is refused too.
  const stale = await checkinToken('test-secret', 'ABCD', Math.floor(Date.now() / CHECKIN_MS) - 2);
  assert.equal((await call('/rooms/ABCD/checkin', { method: 'POST', body: { token: stale } })).status, 403);
  assert.equal((await call('/rooms/ABCD')).body.checkedIn, false);
  assert.equal((await call('/rooms/ABCD/ws', { headers: { Upgrade: 'websocket' } })).status, 403, 'no check-in, no room');

  const { token } = await currentToken('test-secret', 'ABCD');
  const ok = await call('/rooms/ABCD/checkin', { method: 'POST', body: { token } });
  assert.equal(ok.status, 200);
  assert.equal((await call('/rooms/ABCD')).body.checkedIn, true);
  assert.equal((await call('/rooms/NOPE/checkin', { method: 'POST', body: { token } })).status, 404);
  // The portfolio route's quest stats use ?1 parameters the fake D1 cannot bind; it is checked in the browser instead.
}

console.log('session: ok');
