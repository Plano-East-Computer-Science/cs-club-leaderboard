/**
 * Wave 6, the live meeting: the speaker block end to end (payload, Zoom link
 * privacy, early questions carried into the room, the speaker's private link),
 * concept checks, who is stuck, duel champions and the recap.
 * Pure rules first, then the room Durable Object over a fake D1, then the
 * real Worker routes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { cleanBlocks, studentBlocks, speakerOf, templateBlocks, duelMinutes } from '../shared/session-templates.js';
import { publicPlan } from '../shared/planner.js';
import { champions, earlyWindow, isStuck, meetingStart, parseMeetingTime } from '../shared/live.js';
import { chicagoDate } from '../shared/daily.js';
import * as S from '../worker/hub/session.js';
import * as T from '../worker/hub/teach.js';
import { Room } from '../worker/hub/room-do.js';
import { speakerToken, speakerTokenOk } from '../worker/hub/live.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

const ZOOM = 'https://zoom.us/j/123456789?pwd=SECRETPASS';
const NOTE = 'passcode is on the officer chat';
const speakerBlocks = () =>
  cleanBlocks([
    { type: 'hook', title: 'Join', minutes: 5 },
    { type: 'hook', title: 'Welcome', minutes: 3, notes: NOTE },
    {
      type: 'speaker',
      title: 'Talk',
      minutes: 30,
      notes: NOTE,
      speaker: { name: 'Priya Shah', title: 'Engineer', intro: 'Priya builds compilers.', zoomUrl: ZOOM, seedQuestions: ['How did you start?', 'x'], openEarlyHours: 24, projector: 'zoom' },
    },
    { type: 'speaker', title: 'Questions', minutes: 15 },
    { type: 'close', title: 'Close', minutes: 7 },
  ]);

/* --------------------------------- pure rules --------------------------------- */

await check('the 60-minute speaker template: join 5, welcome 3, talk 30, questions 15, close 7', () => {
  assert.deepEqual(
    templateBlocks('speaker', 60).map((b) => [b.type, b.title, b.minutes]),
    [['hook', 'Join', 5], ['hook', 'Welcome', 3], ['speaker', 'Talk', 30], ['speaker', 'Questions', 15], ['close', 'Close', 7]]
  );
  // The duel templates' packs fit their blocks: rounds x (round + spotlight).
  for (const len of [60, 120]) for (const b of templateBlocks('duel', len).filter((x) => x.type === 'duel')) assert.ok(duelMinutes(b.duel) <= b.minutes, `${b.title} fits`);
});

await check('block payloads are validated: https only, bounded, defaults filled', () => {
  const [sp, duel, teach] = cleanBlocks([
    { type: 'speaker', speaker: { name: ' A  B ', zoomUrl: 'javascript:alert(1)', seedQuestions: ['ok?', '', 'no'], openEarlyHours: 500, projector: 'nope' } },
    { type: 'duel', duel: { set: 'Pack One!', minutes: '12', rounds: 9, newMode: '2v2' } },
    { type: 'teach', teach: { slides: 'http://x.org', checks: [{ text: 'int x = 7 / 2;\nx?', options: ['3', '3.5', ''], answer: 5 }, { text: 'one option', options: ['a'] }] } },
  ]);
  assert.deepEqual(sp.speaker, { name: 'A B', title: '', intro: '', zoomUrl: '', seedQuestions: ['ok?'], openEarlyHours: 24, projector: 'questions' });
  assert.deepEqual(duel.duel, { set: '', minutes: 12, rounds: 3, newMode: '2v2', spotlight: true });
  assert.deepEqual(teach.teach, { slides: '', checks: [{ text: 'int x = 7 / 2;\nx?', options: ['3', '3.5'], answer: 0 }] });
  assert.equal(cleanBlocks([{ type: 'speaker', speaker: { zoomUrl: ZOOM } }])[0].speaker.zoomUrl, ZOOM);
  assert.deepEqual(cleanBlocks(cleanBlocks([sp, duel, teach])), cleanBlocks([sp, duel, teach]), 'validating twice changes nothing');
});

await check('zoomUrl, notes and check answers never leave officer payloads: studentBlocks and publicPlan', () => {
  const blocks = speakerBlocks();
  blocks.push(cleanBlocks([{ type: 'teach', teach: { checks: [{ text: 'Q', options: ['a', 'b'], answer: 1 }] } }])[0]);
  const out = JSON.stringify(studentBlocks(blocks));
  for (const s of [ZOOM, 'zoom.us', NOTE, '"answer"', 'zoomUrl', 'intro']) assert.ok(!out.includes(s), `members and the projector never get ${s}`);
  assert.equal(studentBlocks(blocks)[2].speaker.name, 'Priya Shah', 'the name is public');
  const pub = JSON.stringify(publicPlan({ id: 1, date: '2026-12-02', title: 'Speaker night', template: 'speaker', blocks }));
  assert.ok(!pub.includes('zoom') && !pub.includes(NOTE));
  assert.equal(speakerOf(blocks).name, 'Priya Shah', 'the first named speaker block is the speaker');
});

await check('meeting start in Central time, across daylight saving', () => {
  assert.deepEqual(parseMeetingTime('4:30 PM'), { h: 16, m: 30 });
  assert.deepEqual(parseMeetingTime('4 pm'), { h: 16, m: 0 });
  assert.deepEqual(parseMeetingTime('16:45'), { h: 16, m: 45 });
  assert.deepEqual(parseMeetingTime('12:15 AM'), { h: 0, m: 15 });
  assert.deepEqual(parseMeetingTime('soon'), { h: 16, m: 30 });
  assert.equal(new Date(meetingStart('2026-12-02', '4:30 PM')).toISOString(), '2026-12-02T22:30:00.000Z', 'CST is UTC-6');
  assert.equal(new Date(meetingStart('2026-09-02', '4:30 PM')).toISOString(), '2026-09-02T21:30:00.000Z', 'CDT is UTC-5');
  const w = earlyWindow({ date: '2026-12-02', time: '4:30 PM', hours: 24, now: Date.parse('2026-12-01T22:29:00Z') });
  assert.equal(w.open, false, 'one minute before the window');
  assert.equal(earlyWindow({ date: '2026-12-02', time: '4:30 PM', hours: 24, now: Date.parse('2026-12-01T22:30:00Z') }).open, true);
});

await check('the queue: most votes first, seeds win ties; skip drops one; two reports hide it until an officer keeps it', () => {
  const sp = S.freshSpeaker();
  let id = 0;
  S.sqLoad(sp, { seeds: ['Seed one'], early: [{ uid: 7, text: 'Early, two votes', votes: [1, 2] }] }, () => ++id);
  S.sqLoad(sp, { seeds: ['Seed one'], early: [{ uid: 7, text: 'Early, two votes', votes: [1, 2] }] }, () => ++id);
  assert.equal(sp.qs.length, 2, 'loading twice adds nothing');
  S.sqAsk(sp, '3', 'Live, no votes', ++id);
  S.sqAsk(sp, '4', 'Live, three votes', ++id);
  for (const u of ['1', '2', '5']) S.sqVote(sp, u, id);
  assert.deepEqual(S.sqOrder(sp.qs).map((q) => q.text), ['Live, three votes', 'Early, two votes', 'Seed one', 'Live, no votes']);
  assert.deepEqual(sp.qs.find((q) => q.early).votes, ['1', '2'], 'early votes carry, as member ids');
  S.sqSkip(sp, sp.qs[0].id);
  assert.equal(S.sqOrder(sp.qs)[0].text, 'Live, three votes', 'a skipped question waits behind the rest');
  S.sqAnswered(sp, id, true);
  S.sqAnswered(sp, id, true);
  assert.equal(sp.qs.find((q) => q.id === id).answered, true, 'the moderator button sets, never toggles back');
  const early = sp.qs.find((q) => q.early);
  assert.ok(S.sqReport(sp, '7', early.id).error, 'not your own');
  S.sqReport(sp, '1', early.id);
  S.sqReport(sp, '1', early.id);
  assert.ok(!early.hidden, 'one member reporting twice is one report');
  S.sqReport(sp, '2', early.id);
  assert.ok(early.hidden, 'two reports take it off the screens');
  S.sqHide(sp, early.id, false);
  S.sqReport(sp, '3', early.id);
  assert.ok(!early.hidden, 'an officer kept it');
});

await check('concept checks: the room sees the split without the answer, then the answer at the reveal', () => {
  const block = cleanBlocks([{ type: 'teach', teach: { checks: [{ text: 'int x = 7 / 2;', options: ['3', '3.5', '4'], answer: 0 }] } }])[0];
  assert.ok(T.startCheck(block, 3, 1).error);
  assert.ok(T.startCheck({ ...block, type: 'hook' }, 0, 1).error, 'only in a teach block');
  const { check: c } = T.startCheck(block, 0, 1);
  T.castVote(c, 'a', 1);
  T.castVote(c, 'b', 1);
  T.castVote(c, 'c', 0);
  assert.ok(T.castVote(c, 'd', 7).error);
  let v = T.checkView(c, 'screen');
  assert.equal(v.answer, null);
  assert.equal(v.first, null, 'no split while the first vote is open');
  assert.equal(v.voted, 3);
  assert.equal(T.checkView(c, 'host').answer, 0, 'officers see the answer all along');
  assert.deepEqual(T.checkView(c, 'student', 'a').mine, 1);
  T.nextPhase(c, 1000);
  assert.equal(c.discussEndsAt, 1000 + T.DISCUSS_MS, 'a 60-second talk timer');
  assert.ok(T.castVote(c, 'a', 0).error, 'no voting while talking');
  v = T.checkView(c, 'student', 'a');
  assert.deepEqual(v.first, [1, 2, 0], 'the split shows once discussion starts');
  assert.equal(v.answer, null, 'still no answer');
  T.nextPhase(c, 2000);
  assert.equal(c.discussEndsAt, 0);
  T.castVote(c, 'a', 0);
  T.castVote(c, 'b', 0);
  v = T.checkView(c, 'screen');
  assert.equal(v.second, null, 'the revote split waits for the reveal');
  assert.equal(v.voted, 2);
  T.nextPhase(c, 3000);
  v = T.checkView(c, 'screen');
  assert.equal(v.answer, 0);
  assert.deepEqual(v.second, [2, 0, 0]);
  assert.ok(T.nextPhase(c, 4000).error, 'nothing after the reveal');
  // Straight to the answer when the first vote is clear.
  const { check: d } = T.startCheck(block, 0, 2);
  T.reveal(d);
  assert.equal(T.checkView(d, 'student', 'z').answer, 0);
});

await check('who is stuck: same checkpoint 10+ minutes, here, not finished', () => {
  const lab = S.freshLab();
  const tiers = [{ name: 'Guided' }, { name: 'Build' }];
  const cps = [['a', 'b', 'c'], ['x']];
  const t0 = 1_000_000;
  S.labPick(lab, '1', 0, tiers, t0);
  S.labPick(lab, '2', 0, tiers, t0);
  S.labPick(lab, '3', 1, tiers, t0);
  S.labPick(lab, '4', 0, tiers, t0);
  S.labPass(lab, '2', 'a', cps, t0 + 8 * 60_000);
  S.labPass(lab, '3', 'x', cps, t0 + 60_000);
  S.labPick(lab, '1', 0, tiers, t0 + 9 * 60_000); // picking the same tier again does not reset the clock
  const now = t0 + 12 * 60_000;
  const p = S.labProgress(lab, tiers, cps, ['1', '2', '3']);
  assert.deepEqual(p.map((x) => x.uid), ['1', '2'], 'finished (3) and gone (4) are left out');
  assert.deepEqual(p.filter((x) => isStuck(x, now)).map((x) => [x.uid, x.at, x.of]), [['1', 1, 3]]);
  assert.equal(isStuck(p[1], now + 6 * 60_000), true, 'Ben passed one, then stalled');
  assert.equal(isStuck({ since: null }, now), false, 'unknown start is not stuck');
});

await check('duel champions: most wins, then solves, then time; empty divisions have none', () => {
  const rows = [
    { division: 'new', user_id: 1, name: 'Ana A', won: 1, solved_ms: 1000 },
    { division: 'new', user_id: 2, name: 'Ben B', won: 1, solved_ms: 900 },
    { division: 'new', user_id: 2, name: 'Ben B', won: 0, solved_ms: 5000 },
    { division: 'new', user_id: 1, name: 'Ana A', won: 0, solved_ms: null },
    { division: 'contest', user_id: 3, name: 'Cy C', won: 0, solved_ms: null },
  ];
  assert.deepEqual(champions(rows).map((c) => [c.division, c.name, c.wins, c.solved]), [['new', 'Ben B', 1, 2]]);
});

/* ------------------------------ the room DO ------------------------------ */

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
async function makeRoom(env, sockets) {
  const store = new Map();
  const ctx = {
    storage: { get: async (k) => store.get(k), put: async (k, v) => void store.set(k, v), setAlarm: async () => {} },
    blockConcurrencyWhile: (fn) => fn(),
    getWebSockets: () => sockets,
  };
  const room = new Room(ctx, env);
  await new Promise((r) => setTimeout(r, 0)); // let the constructor load its (empty) storage first
  return room;
}

/* ------------------------------- Worker routes ------------------------------- */

const rooms = new Map(); // code -> Room, behind a fake ROOMS namespace
const env = {
  ADMIN_PASSWORD: 'pw',
  SESSION_SECRET: 'test-secret',
  DB: makeTestDb(SCHEMA),
  ROOMS: { idFromName: (n) => n, get: (id) => ({ fetch: (req) => rooms.get(id).fetch(req) }) },
};
const db = env.DB;
const ctx = { waitUntil() {}, passThroughOnException() {} };
async function call(path, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  return { status: res.status, body: await res.json().catch(() => null) };
}
const officer = `${COOKIE}=${await signSession(env)}`;
db.exec(`INSERT INTO users (id, email, name) VALUES (1, 'a@x.org', 'Ana Alvarez'), (2, 'b@x.org', 'Ben Bose'), (3, 'c@x.org', 'Cy Chen')`);
const as = async (id) => `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 600_000}`)}`;
const [ana, ben, cy] = [await as(1), await as(2), await as(3)];
const today = chicagoDate();
const later = new Date(Date.now() + 6 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

await check('early questions: closed until openEarlyHours before the meeting', async () => {
  const r = await call('/api/admin/hub/planner', { method: 'POST', cookie: officer, body: { date: later, title: 'Far off', template: 'speaker', blocks: speakerBlocks() } });
  assert.equal(r.status, 200);
  const g = await call('/api/speaker-questions', { cookie: ana });
  assert.equal(g.body.night.id, r.body.id);
  assert.equal(g.body.open, false);
  assert.deepEqual(g.body.questions, []);
  assert.ok(!JSON.stringify(g.body).includes('zoom'), 'the Zoom link is not in the member payload');
  assert.equal((await call('/api/speaker-questions', { method: 'POST', cookie: ana, body: { planId: r.body.id, text: 'Too soon?' } })).status, 409);
  assert.equal((await call('/api/speaker-questions')).status, 401, 'signed in only');
  await call(`/api/admin/hub/planner/${r.body.id}`, { method: 'DELETE', cookie: officer });
});

let planId;
await check('early questions: ask, upvote, report, seeds first; officers see names', async () => {
  const r = await call('/api/admin/hub/planner', { method: 'POST', cookie: officer, body: { date: today, title: 'Speaker night', template: 'speaker', blocks: speakerBlocks() } });
  planId = r.body.id;
  const g = await call('/api/speaker-questions', { cookie: ana });
  assert.equal(g.body.open, true);
  assert.deepEqual(g.body.questions.map((q) => [q.text, Boolean(q.seed)]), [['How did you start?', true]], 'seeds show first, marked');
  assert.equal(g.body.night.speaker.name, 'Priya Shah');
  assert.ok(!JSON.stringify(g.body).includes('zoom') && !JSON.stringify(g.body).includes(NOTE));
  assert.equal((await call('/api/speaker-questions', { method: 'POST', cookie: ana, body: { planId, text: 'x' } })).status, 400);
  const a1 = await call('/api/speaker-questions', { method: 'POST', cookie: ana, body: { planId, text: 'What was your first project?' } });
  assert.equal(a1.status, 200);
  await call('/api/speaker-questions', { method: 'POST', cookie: ben, body: { planId, text: 'Do you use AI at work?' } });
  const qa = a1.body.questions.find((q) => q.mine).id;
  assert.equal((await call(`/api/speaker-questions/${qa}/vote`, { method: 'POST', cookie: ana })).status, 400, 'not your own');
  await call(`/api/speaker-questions/${qa}/vote`, { method: 'POST', cookie: ben });
  const v = await call(`/api/speaker-questions/${qa}/vote`, { method: 'POST', cookie: cy });
  const mine = v.body.questions.find((q) => q.id === qa);
  assert.equal(mine.votes, 2);
  assert.equal(mine.voted, true);
  assert.ok(!JSON.stringify(v.body).includes('Ana') && !JSON.stringify(v.body).includes('Ben'), 'anonymous to members');
  // A report goes to the officers' reports queue; officers see who asked.
  assert.equal((await call('/api/reports', { method: 'POST', cookie: cy, body: { kind: 'question', id: qa } })).status, 200);
  const o = await call(`/api/admin/hub/planner/${planId}/questions`, { cookie: officer });
  assert.equal(o.body.questions[0].name, 'Ana Alvarez');
  assert.equal(o.body.questions[0].reports, 1);
  assert.equal((await call(`/api/admin/hub/planner/${planId}/questions`, { cookie: ana })).status, 401, 'officers only');
  for (let i = 0; i < 3; i++) await call('/api/speaker-questions', { method: 'POST', cookie: cy, body: { planId, text: `Question number ${i}` } });
  assert.equal((await call('/api/speaker-questions', { method: 'POST', cookie: cy, body: { planId, text: 'A fourth one' } })).status, 429, 'three each');
  const hid = o.body.questions.find((q) => q.text.startsWith('Do you')).id;
  await call(`/api/admin/hub/early-questions/${hid}/hide`, { method: 'POST', cookie: officer, body: { hidden: true } });
  assert.ok(!(await call('/api/speaker-questions', { cookie: ana })).body.questions.some((q) => q.id === hid), 'a hidden question is gone for members');
});

let code;
await check('early questions carry into the room, votes and all; then Today stops taking them', async () => {
  const r = await call('/api/admin/hub/rooms', { method: 'POST', cookie: officer, body: { planId } });
  code = r.body.code;
  const host = new Ws({ role: 'host', uid: 'host' });
  const screen = new Ws({ role: 'screen', uid: 'screen' });
  const st = new Ws({ role: 'student', uid: '3', name: 'Cy' });
  const room = await makeRoom(env, [host, screen, st]);
  rooms.set(code, room);
  room.s.code = code;
  const plan = await db.prepare('SELECT blocks FROM planned_sessions WHERE id = ?').bind(planId).first();
  room.s.session = S.newSession({ template: 'speaker', blocks: JSON.parse(plan.blocks) });
  await room.loadQuestions();
  await room.loadQuestions();
  room.broadcast();
  const qs = st.sent.at(-1).speaker.qs;
  assert.deepEqual(
    qs.map((q) => [q.text, q.votes, q.seed]),
    [['What was your first project?', 2, false], ['How did you start?', 0, true], ['Question number 0', 0, false], ['Question number 1', 0, false], ['Question number 2', 0, false]],
    'most votes first, seeds win ties; hidden ones stay out; loading twice adds nothing'
  );
  assert.equal(qs[0].voted, true, 'Cy upvoted it on Today and still has the vote in the room');
  assert.equal(host.sent.at(-1).speaker.qs[0].name, 'Ana Alvarez', 'officers see who asked early');
  assert.ok(!JSON.stringify(screen.sent.at(-1).speaker).includes('Ana'));
  assert.equal(screen.sent.at(-1).speaker.mode, 'zoom', 'the plan put Zoom on the projector');
  const g = await call('/api/speaker-questions', { cookie: ana });
  assert.equal(g.body.room, code, 'Today points at the open room');
  assert.equal((await call('/api/speaker-questions', { method: 'POST', cookie: ana, body: { planId, text: 'Late question?' } })).status, 409);
});

await check('zoomUrl and officer notes reach officer sockets only, never members, the projector or the speaker link', async () => {
  const room = rooms.get(code);
  const host = new Ws({ role: 'host', uid: 'host' });
  const screen = new Ws({ role: 'screen', uid: 'screen' });
  const st = new Ws({ role: 'student', uid: '1', name: 'Ana' });
  room.ctx.getWebSockets = () => [host, screen, st];
  await room.webSocketMessage(host, JSON.stringify({ t: 'block_go', i: 2 }));
  await room.webSocketMessage(screen, JSON.stringify({ t: 'block_go', i: 4 }));
  assert.equal(room.s.session.cur, 2, 'the projector socket cannot drive the room');
  assert.ok(JSON.stringify(host.sent.at(-1)).includes(ZOOM), 'the officer console has the Zoom link');
  assert.ok(JSON.stringify(host.sent.at(-1)).includes(NOTE));
  for (const ws of [screen, st]) {
    const out = JSON.stringify(ws.sent.at(-1));
    assert.ok(!out.includes('zoom.us') && !out.includes('SECRETPASS') && !out.includes(NOTE), `${ws.att.role} never sees the Zoom link or notes`);
  }
  const guest = await (await room.fetch(new Request('https://room.internal/guest', { headers: { 'x-role': 'guest' } }))).json();
  assert.ok(!JSON.stringify(guest).includes('zoom.us') && !JSON.stringify(guest).includes('Ana Alvarez'));
  assert.equal(guest.speaker.name, 'Priya Shah');
});

await check('speaker link: 128-bit token, unguessable, for one room, and it dies with the room', async () => {
  const t = await speakerToken('test-secret', code);
  assert.match(t, /^[A-Za-z0-9_-]{22}$/, '16 bytes, base64url');
  assert.equal(t, await speakerToken('test-secret', code), 'stable for the room');
  assert.notEqual(t, await speakerToken('test-secret', 'ZZZZ'), 'one room only');
  assert.notEqual(t, await speakerToken('other-secret', code), 'depends on the secret');
  assert.ok(await speakerTokenOk('test-secret', code, t));
  assert.ok(!(await speakerTokenOk('test-secret', code, `${t.slice(0, -1)}${t.at(-1) === 'A' ? 'B' : 'A'}`)));
  assert.ok(!(await speakerTokenOk('test-secret', code, '')));
  assert.ok(!(await speakerTokenOk('test-secret', 'ZZZZ', t)));
  const link = await call(`/api/admin/hub/rooms/${code}/speaker-link`, { cookie: officer });
  assert.equal(link.body.path, `/speaker/${code}/${t}`);
  assert.equal((await call(`/api/admin/hub/rooms/${code}/speaker-link`, { cookie: ana })).status, 401, 'officers hand it out');
  const g = await call(link.body.path.replace('/speaker/', '/api/speaker/'));
  assert.equal(g.status, 200, 'no account needed');
  assert.ok(g.body.waiting.length >= 4);
  assert.ok(!JSON.stringify(g.body).includes('zoom.us') && !JSON.stringify(g.body).includes('Alvarez'));
  assert.equal((await call(`/api/speaker/${code}/${'A'.repeat(22)}`)).status, 404, 'a guessed token is refused');
  // The moderator marks the top question answered; the speaker sees it move.
  const room = rooms.get(code);
  const host = new Ws({ role: 'host', uid: 'host' });
  room.ctx.getWebSockets = () => [host];
  const top = room.questions('host')[0];
  await room.webSocketMessage(host, JSON.stringify({ t: 'sq_answered', id: top.id, value: true }));
  const second = room.questions('host').find((q) => !q.answered);
  await room.webSocketMessage(host, JSON.stringify({ t: 'sq_answered', id: second.id, value: true }));
  assert.equal((await call(link.body.path.replace('/speaker/', '/api/speaker/'))).body.answered, 2);
  // Closing the room ends the link.
  await call(`/api/admin/hub/rooms/${code}/close`, { method: 'POST', cookie: officer });
  assert.equal((await call(link.body.path.replace('/speaker/', '/api/speaker/'))).status, 410);
  assert.equal((await call(`/api/admin/hub/rooms/${code}/speaker-link`, { cookie: officer })).status, 410);
});

await check('recap: public once closed, first names only, answered questions, champions, shown', async () => {
  db.exec(`INSERT INTO room_checkins (code, user_id) VALUES ('${code}', 1), ('${code}', 2)`);
  db.exec(`INSERT INTO duel_results (room_code, round, division, match_no, user_id, slug, attempts, solved_ms, won) VALUES ('${code}', 1, 'new', 1, 2, 'sum', 1, 1000, 1)`);
  db.exec(`INSERT INTO artifacts (room_code, user_id, kind, url, line, result, shown) VALUES ('${code}', 1, 'link', 'https://github.com/ana/secret-repo', 'A text adventure', '', 1)`);
  const r = await call(`/api/recap/${code}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.came, 2);
  assert.deepEqual(r.body.questions.map((q) => q.text).sort(), ['How did you start?', 'What was your first project?']);
  assert.deepEqual(r.body.champions, [{ division: 'New', name: 'Ben', wins: 1, solved: 1 }]);
  assert.deepEqual(r.body.shown.map((s) => [s.name, s.line]), [['Ana', 'A text adventure']]);
  assert.equal(r.body.speaker.name, 'Priya Shah');
  const out = JSON.stringify(r.body);
  for (const s of ['Alvarez', 'Bose', 'a@x.org', 'github.com', 'zoom', NOTE]) assert.ok(!out.includes(s), `no ${s} in the public recap`);
  const open = (await call('/api/admin/hub/rooms', { method: 'POST', cookie: officer, body: { template: 'build' } })).body.code;
  assert.equal((await call(`/api/recap/${open}`)).status, 404, 'no recap while the room is open');
});

await check('a concept check through the room: members vote, the projector never gets the answer early', async () => {
  const blocks = cleanBlocks([{ type: 'teach', title: 'Integer division', minutes: 10, teach: { checks: [{ text: '7 / 2 in Java?', options: ['3', '3.5'], answer: 0 }] } }]);
  const host = new Ws({ role: 'host', uid: 'host' });
  const screen = new Ws({ role: 'screen', uid: 'screen' });
  const a = new Ws({ role: 'student', uid: '1', name: 'Ana' });
  const room = await makeRoom({ DB: db }, [host, screen, a]);
  room.s.session = S.newSession({ template: 'build', blocks });
  const send = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m));
  await send(host, { t: 'block_go', i: 0 });
  assert.ok(!JSON.stringify(a.sent.at(-1).session).includes('"answer"'), 'the plan answer never reaches a member');
  await send(a, { t: 'check_start', i: 0 });
  assert.equal(room.s.check, null, 'members cannot start a check');
  await send(host, { t: 'check_start', i: 0 });
  await send(a, { t: 'check_vote', choice: 1 });
  assert.equal(screen.sent.at(-1).check.answer, null);
  assert.equal(screen.sent.at(-1).check.first, null);
  assert.equal(host.sent.at(-1).check.answer, 0);
  await send(host, { t: 'check_next' });
  assert.deepEqual(screen.sent.at(-1).check.first, [0, 1]);
  assert.equal(a.sent.at(-1).check.answer, null);
  await send(host, { t: 'check_reveal' });
  assert.equal(a.sent.at(-1).check.answer, 0);
  await send(host, { t: 'block_go', i: -1 });
  assert.equal(room.s.check, null, 'a check belongs to its block');
});

await check('room socket: a client cannot send its own x- headers to the room', async () => {
  db.exec(`INSERT INTO rooms (code, title, template) VALUES ('HDRS', 'Unplanned', 'build')`);
  db.exec(`INSERT INTO room_checkins (code, user_id) VALUES ('HDRS', 1)`);
  let seen = null;
  rooms.set('HDRS', { fetch: (req) => ((seen = req.headers), new Response(null, { status: 200 })) });
  const res = await worker.fetch(
    new Request('https://club.test/api/rooms/HDRS/ws', {
      headers: { Upgrade: 'websocket', Cookie: ana, 'x-role': 'host', 'x-blocks': encodeURIComponent('[{"type":"poll"}]'), 'x-uid': '999' },
    }),
    env,
    ctx
  );
  assert.equal(res.status, 200);
  assert.equal(seen.get('x-role'), 'student');
  assert.equal(seen.get('x-uid'), '1', 'the uid comes from the session, not the client');
  assert.equal(seen.get('x-blocks'), null, 'an unplanned room never takes blocks from the client');
});

console.log(`live: ${passed} checks passed`);
