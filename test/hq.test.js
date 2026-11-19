/**
 * Wave 5, Officer HQ: the old-address map, the readiness checklist, the
 * drifting invite, and the read-only HQ routes (officer only, and the inbox's
 * shape across every review queue). Drives the real Worker against the fake D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { OLD_SCREENS, oldOfficerTarget, INBOX_KINDS, readiness, nextWeekday, daysBetween, driftInvite } from '../shared/hq.js';
import { drifting } from '../worker/hub/hq.js';

/* ------------------------------ redirect map ------------------------------ */

// Every screen the old console had (src/pages/Officer.jsx GROUPS, 41 ids) has a home in HQ.
const OLD_IDS = [
  'rooms', 'planner', 'points', 'claims', 'editorials', 'reports', 'links', 'queue', 'merge', 'members', 'team', 'badges',
  'records', 'signoffs', 'squads', 'raffle', 'analytics', 'handoff', 'alumni', 'problems', 'sets', 'daily', 'board', 'puzzles',
  'competitions', 'prep', 'ctf', 'data', 'quant', 'cycles', 'research', 'opportunities', 'curriculum', 'announce', 'email',
  'ideas', 'gateway', 'reader', 'officers', 'text', 'backup',
];
for (const id of OLD_IDS) {
  const to = oldOfficerTarget(`?s=${id}`);
  assert.ok(OLD_SCREENS[id], `old screen ${id} is mapped`);
  assert.match(to, /^\/hq(\/|\?|$)/, `${id} lands in HQ`);
}
assert.equal(Object.keys(OLD_SCREENS).length, OLD_IDS.length);
assert.equal(oldOfficerTarget('?s=claims'), '/hq/inbox?kind=claims');
assert.equal(oldOfficerTarget('?s=queue'), '/hq/inbox?kind=opportunities');
assert.equal(oldOfficerTarget('?s=ctf'), '/hq/library/ctf');
assert.equal(oldOfficerTarget('?s=planner'), '/hq/meetings');
assert.equal(oldOfficerTarget('?s=team'), '/hq/settings/officers');
assert.equal(oldOfficerTarget('?tab=review'), '/hq/inbox?kind=claims');
assert.equal(oldOfficerTarget(''), '/hq');
assert.equal(oldOfficerTarget('?s=nope'), '/hq');
assert.equal(oldOfficerTarget('?s=__proto__'), '/hq');
assert.equal(oldOfficerTarget('?s=toString'), '/hq');
// Inbox filters the map points at are real kinds.
for (const to of Object.values(OLD_SCREENS)) {
  const kind = new URLSearchParams(to.split('?')[1] ?? '').get('kind');
  if (kind) assert.ok(INBOX_KINDS.includes(kind), `${to} uses a known kind`);
}

/* -------------------------------- readiness -------------------------------- */

const ok = (checks, id) => checks.find((c) => c.id === id)?.ok;
const duel = (set) => ({ type: 'duel', title: 'Rounds', minutes: 36, ...(set && { duel: { set } }) });
let r = readiness({ blocks: [{ type: 'hook', minutes: 10 }, duel(), { type: 'close', minutes: 5 }] }, { packs: 2 });
assert.equal(ok(r, 'length'), true, '51 of 60 is close enough');
assert.equal(ok(r, 'duel'), false);
assert.match(r.find((c) => c.id === 'duel').hint, /Rounds/);
assert.equal(ok(r, 'packs'), true);
assert.equal(ok(r, 'room'), true);
assert.equal(ok(r, 'speaker'), undefined, 'no speaker block, no speaker check');
r = readiness({ blocks: [{ type: 'hook', minutes: 20 }, duel('duel-pack-1'), { type: 'close', minutes: 20 }] }, { packs: 0 });
assert.equal(ok(r, 'duel'), true);
assert.equal(ok(r, 'packs'), false);
assert.equal(ok(readiness({ blocks: [{ type: 'lab', minutes: 75 }] }), 'length'), false, '75 is over 60 and under 110');
assert.equal(ok(readiness({ blocks: [{ type: 'lab', minutes: 115 }] }), 'length'), true, 'read as a 120 minute plan');
assert.equal(ok(readiness({ blocks: [{ type: 'lab', minutes: 30 }] }), 'length'), false);
assert.equal(ok(readiness({ blocks: [{ type: 'speaker', minutes: 60 }] }), 'speaker'), false);
assert.equal(ok(readiness({ blocks: [{ type: 'speaker', minutes: 60, speaker: { name: 'Dr. Okafor' } }] }), 'speaker'), true);
assert.equal(ok(readiness({ blocks: [], roomCode: 'ABCD' }), 'room'), false);

/* ---------------------------- dates and invite ---------------------------- */

assert.equal(nextWeekday('2026-11-19', 1), '2026-11-23'); // Thursday -> Monday
assert.equal(nextWeekday('2026-11-23', 1), '2026-11-23'); // a Monday is today
assert.equal(daysBetween('2026-11-19', '2026-11-23'), 4);
const invite = driftInvite('Ava Chen', { next: { date: '2026-11-25', title: 'Duel night' }, meeting: { time: '4:30 PM', place: 'Room 2104' } });
assert.match(invite, /^Hi Ava,/);
assert.match(invite, /Wednesday, Nov 25 at 4:30 PM in Room 2104/);
assert.ok(!/[!—]/.test(invite), 'no exclamation marks or em dashes');
assert.match(driftInvite('', {}), /^Hi there,.*Wednesday\./);

/* --------------------------------- drifting --------------------------------- */

const now = new Date('2026-11-19T18:00:00Z');
const d = drifting(
  [
    { id: 1, name: 'Ava', active: true, lastSeenDate: '2026-10-01' },
    { id: 2, name: 'Ben', active: true, lastSeenDate: '2026-11-12' },
    { id: 3, name: 'Cam', active: false, lastSeenDate: '2026-09-01' },
    { id: 4, name: 'Dee', active: true, lastSeenDate: null },
    { id: 5, name: 'Eli', active: true, lastSeenDate: '2026-10-29' },
  ],
  now
);
assert.deepEqual(d.map((x) => x.id), [1, 5], 'oldest first; hidden, recent and never-seen are left out');

/* ---------------------------------- routes ---------------------------------- */

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;
const run = (sql, ...a) => db.prepare(sql).bind(...a).run();

async function addUser(name, role = 'member', studentId = null) {
  return (await run('INSERT INTO users (email, name, role, student_id) VALUES (?, ?, ?, ?)', `${name.toLowerCase()}@example.com`, name, role, studentId)).meta.last_row_id;
}
const addStudent = async (name) => (await run('INSERT INTO students (name) VALUES (?)', name)).meta.last_row_id;
const userCookie = async (id) => `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}`;

async function call(path, cookie) {
  const res = await worker.fetch(new Request(`https://club.test/api${path}`, { headers: cookie ? { Cookie: cookie } : {} }), env, {
    waitUntil() {},
    passThroughOnException() {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const ava = await addStudent('Ava Chen');
const ben = await addStudent('Ben Ortiz');
const lead = await addUser('Lena', 'lead');
const officer = await addUser('Omar', 'officer');
const member = await addUser('Mia', 'member', ava);
const benUser = await addUser('Ben', 'member', null);
const [L, O, M] = [await userCookie(lead), await userCookie(officer), await userCookie(member)];
const G = `${COOKIE}=${await signSession(env)}`;

// Officer only, every route.
for (const path of ['/admin/hub/inbox', '/admin/hub/home', '/admin/hub/roster', '/admin/hub/meetings']) {
  assert.equal((await call(path)).status, 401, `anonymous ${path}`);
  assert.equal((await call(path, M)).status, 401, `member ${path}`);
  assert.equal((await call(path, O)).status, 200, `officer ${path}`);
  assert.equal((await call(path, L)).status, 200, `lead ${path}`);
  assert.equal((await call(path, G)).status, 200, `break-glass ${path}`);
}

// Empty inbox: every kind counted, zero items.
let inbox = (await call('/admin/hub/inbox', O)).body;
assert.deepEqual(Object.keys(inbox.counts).sort(), [...INBOX_KINDS].sort());
assert.equal(inbox.total, 0);
assert.deepEqual(inbox.items, []);

// One of each kind.
await run(`INSERT INTO activity (student_id, kind, ref, meta, status, created_at) VALUES (?, 'compete', 'comp:1', ?, 'pending', '2026-11-18 10:00:00')`, ava, JSON.stringify({ title: 'USACO Bronze', proof_url: 'https://usaco.org/x', note: 'Took it Saturday' }));
await run(`INSERT INTO activity (student_id, kind, ref, meta, status) VALUES (?, 'ship', 'proj:9', '{}', 'approved')`, ava); // decided: not in the inbox
await run(`INSERT INTO problems (slug, title) VALUES ('two-sum', 'Two sum')`);
await run(`INSERT INTO editorials (slug, user_id, body, status) VALUES ('two-sum', ?, 'Use a hash map.', 'pending')`, member);
await run(`INSERT INTO ctf_challenges (slug, title, category, difficulty, points, body, flag_hash, status, author_user_id, author_name) VALUES ('c1', 'Hidden byte', 'forensics', 2, 100, 'Find it', 'h', 'pending', ?, 'Mia')`, member);
await run('INSERT INTO link_requests (user_id, student_id) VALUES (?, ?)', benUser, ben);
await run(`INSERT INTO ideas (user_id, kind, body) VALUES (?, 'teach', 'Rust night')`, member);
await run(`INSERT INTO reports (kind, target_id, reason, reporter_user_id) VALUES ('idea', 1, 'Off topic', ?)`, officer);
await run(`INSERT INTO opportunities (title, org, url, status) VALUES ('Summer lab', 'UTD', 'https://utd.edu', 'pending')`);
await run(`INSERT INTO opportunities (title, status) VALUES ('Already live', 'live')`);
await run(`INSERT INTO alumni (name, contact) VALUES ('Priya R', 'priya@example.com')`);
await run(`INSERT INTO alumni_questions (alumni_id, user_id, question) VALUES (1, ?, 'How did you pick a major?')`, member);

inbox = (await call('/admin/hub/inbox', O)).body;
for (const k of INBOX_KINDS) assert.equal(inbox.counts[k], 1, `one ${k}`);
assert.equal(inbox.total, INBOX_KINDS.length);
assert.equal(inbox.items.length, INBOX_KINDS.length);
for (const it of inbox.items) {
  assert.ok(INBOX_KINDS.includes(it.kind));
  assert.ok(it.id != null && typeof it.who === 'string' && it.who && typeof it.what === 'string' && it.what, `${it.kind} has who and what`);
  assert.ok(typeof it.at === 'number' && it.at > 0, `${it.kind} time is ms, not raw UTC text`);
  assert.ok(it.points === null || (Number.isInteger(it.points) && it.points > 0));
}
const byKind = Object.fromEntries(inbox.items.map((i) => [i.kind, i]));
assert.equal(byKind.claims.who, 'Ava Chen');
assert.match(byKind.claims.what, /Enter a competition: USACO Bronze/);
assert.equal(byKind.claims.link, 'https://usaco.org/x');
assert.equal(byKind.claims.points, 15);
assert.equal(byKind.editorials.points, 15);
assert.equal(byKind.ctf.points, 30);
assert.equal(byKind.links.id, benUser, 'link requests are keyed by the account, as their approve route is');
assert.equal(byKind.links.points, null);
assert.match(byKind.reports.detail, /Rust night/);
assert.match(byKind.alumni.detail, /priya@example.com/);
// Newest first.
assert.ok(inbox.items.every((it, i, a) => i === 0 || (a[i - 1].at ?? 0) >= (it.at ?? 0)));

// Home carries the same counts and the shape the screen draws.
const home = (await call('/admin/hub/home', O)).body;
assert.deepEqual(home.inbox.counts, inbox.counts);
assert.equal(home.next, null);
assert.ok(Array.isArray(home.open) && 'digest' in home.due && 'backup' in home.due);
assert.equal(home.due.backup.due, true, 'never backed up');

// Roster: last seen and season points, leaderboard-only entries included.
await run(`INSERT INTO point_events (student_id, delta, reason, created_at) VALUES (?, 20, 'manual', datetime('now', '-40 days'))`, ben);
const roster = (await call('/admin/hub/roster', O)).body;
const benRow = roster.members.find((m) => m.id === ben);
assert.equal(benRow.points, 20);
assert.equal(benRow.drifting, true, 'a leaderboard-only member with old points is drifting');
assert.ok(typeof benRow.lastSeen === 'number');

// A backup download is logged, and then nothing is due.
const bk = await worker.fetch(new Request('https://club.test/api/admin/backup', { headers: { Cookie: O } }), env, { waitUntil() {}, passThroughOnException() {} });
assert.equal(bk.status, 200);
assert.equal((await call('/admin/hub/home', O)).body.due.backup.due, false);

console.log('hq ok');
