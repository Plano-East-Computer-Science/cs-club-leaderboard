/**
 * D1, D4: the cycle state machine, vote rules, the close-time ship awards
 * (once per member, idempotent), team size, devlog validation, and the
 * teammate board. Real SQL on node:sqlite; routes through the real router.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hono } from 'hono';

import { makeTestDb } from './d1-shim.js';
import { mountHub } from '../worker/hub/index.js';
import { canMove, cleanDevlog, cleanPitch, winnersOf, MAX_TEAM } from '../worker/hub/cycles.js';
import { cleanPost } from '../worker/hub/team-posts.js';
import { COOKIE, signSession, signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

/* ------------------------------- pure rules ------------------------------- */

await check('state machine only moves forward one step', () => {
  assert.ok(canMove('draft', 'open') && canMove('open', 'demo') && canMove('demo', 'closed'));
  for (const [a, b] of [['draft', 'demo'], ['open', 'closed'], ['demo', 'open'], ['closed', 'open'], ['open', 'open'], ['draft', 'closed']]) {
    assert.ok(!canMove(a, b), `${a} to ${b}`);
  }
});

await check('devlogs: 280 characters, https link only', () => {
  assert.equal(cleanDevlog({ text: 'ok' }).error?.length > 0, true, 'too short');
  assert.equal(cleanDevlog({ text: 'x'.repeat(281) }).error?.length > 0, true, 'too long');
  assert.equal(cleanDevlog({ text: 'x'.repeat(280) }).value.text.length, 280);
  assert.ok(cleanDevlog({ text: 'a real post', url: 'http://x.com/a.png' }).error, 'http link');
  assert.ok(cleanDevlog({ text: 'a real post', url: 'javascript:alert(1)' }).error, 'javascript link');
  assert.ok(cleanDevlog({ text: 'a real post', url: 'not a url' }).error);
  assert.equal(cleanDevlog({ text: '  fixed   the  bug ', url: 'https://i.imgur.com/a.png' }).value.text, 'fixed the bug');
  assert.equal(cleanDevlog({ text: 'a real post' }).value.url, '');
});

await check('pitch is one short line; winners are the top vote count', () => {
  assert.ok(cleanPitch('short').error);
  assert.equal(cleanPitch('x'.repeat(300)).value.length, 140);
  assert.deepEqual(winnersOf([{ id: 1, votes: 2 }, { id: 2, votes: 3 }, { id: 3, votes: 3 }]).map((e) => e.id), [2, 3]);
  assert.deepEqual(winnersOf([{ id: 1, votes: 0 }]), []);
  assert.deepEqual(winnersOf([]), []);
});

await check('team post checks', () => {
  assert.ok(cleanPost({ text: 'short', target_type: 'cycle', target_id: 1 }).error);
  assert.ok(cleanPost({ text: 'needs a designer for a site', target_type: 'club', target_id: 1 }).error);
  assert.ok(cleanPost({ text: 'needs a designer for a site', target_type: 'opp', target_id: 0 }).error);
  assert.equal(cleanPost({ text: 'needs a designer for a site', target_type: 'opp', target_id: 4, skills: 'css' }).value.type, 'opp');
});

/* ------------------------- routes on a real SQLite ------------------------- */

const env = { DB: makeTestDb(schema), ADMIN_PASSWORD: 'x', SESSION_SECRET: 'test-secret' };
const db = env.DB;
const names = ['Ava Kim', 'Ben Ortiz', 'Cy Lee', 'Dee Park', 'Eli Ray', 'Fay Wu', 'Gus Ng'];
names.forEach((n, i) => {
  db.exec(`INSERT INTO students (id, name) VALUES (${600 + i}, '${n}')`);
  db.exec(`INSERT INTO users (id, email, name, student_id) VALUES (${i + 1}, 'u${i + 1}@x.com', '${n}', ${600 + i})`);
});
db.exec(`INSERT INTO ideas (id, user_id, kind, body) VALUES (1, 1, 'project', 'Build a tool that helps the club, in three weeks')`);
db.exec(`INSERT INTO opportunities (id, title) VALUES (9, 'Some contest')`);

const app = new Hono();
mountHub(app);
const cookie = async (id) => `${USER_COOKIE}=${encodeURIComponent(await signValue(env, `${id}:${Date.now() + 60_000}`))}`;
const officer = `${COOKIE}=${encodeURIComponent(await signSession(env))}`;
const call = async (method, url, body, ck) => {
  const res = await app.request(url, { method, headers: { 'Content-Type': 'application/json', ...(ck && { Cookie: ck }) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined }, env);
  return { status: res.status, json: await res.json() };
};
const u = {};
for (let i = 1; i <= 7; i++) u[i] = await cookie(i);
const admin = (method, url, body) => call(method, `/api/admin/hub${url}`, body, officer);
const points = async (sid) => (await db.prepare('SELECT COALESCE(SUM(delta), 0) AS n FROM point_events WHERE student_id = ?').bind(sid).first()).n;

let cycleId;
await check('officer creates a cycle from an idea, which becomes planned', async () => {
  assert.equal((await call('POST', '/api/admin/hub/cycles', { title: 'x' })).status, 401, 'members cannot create cycles');
  assert.equal((await call('POST', '/api/admin/hub/cycles', { title: 'Nope' }, u[1])).status, 401);
  assert.equal((await admin('POST', '/cycles', { title: 'A', theme: '' })).status, 400, 'title too short');
  assert.equal((await admin('POST', '/cycles', { title: 'Bad dates', starts_on: '2026-12-10', demo_on: '2026-12-01' })).status, 400);
  const r = await admin('POST', '/cycles', { title: 'Tools for the club', idea_id: 1, starts_on: '2026-11-20', demo_on: '2026-12-11', rubric: 'Does it run?' });
  assert.equal(r.status, 200);
  cycleId = r.json.id;
  assert.equal((await db.prepare('SELECT status FROM ideas WHERE id = 1').first()).status, 'planned');
  const row = await db.prepare('SELECT * FROM cycles WHERE id = ?').bind(cycleId).first();
  assert.equal(row.status, 'draft');
  assert.match(row.theme, /Build a tool/, 'theme comes from the idea');
  assert.equal((await call('GET', '/api/cycles')).json.current, null, 'a draft is not shown to members');
});

await check('entries need an open cycle; the state machine is enforced over HTTP', async () => {
  assert.equal((await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'A bot that nags', title: 'Nagbot' }, u[1])).status, 409, 'draft takes no entries');
  assert.equal((await admin('POST', `/cycles/${cycleId}/status`, { status: 'demo' })).status, 409, 'cannot skip open');
  assert.equal((await admin('POST', `/cycles/${cycleId}/status`, { status: 'open' })).status, 200);
  const second = (await admin('POST', '/cycles', { title: 'Second' })).json.id;
  assert.equal((await admin('POST', `/cycles/${second}/status`, { status: 'open' })).status, 409, 'only one cycle runs at a time');
  assert.equal((await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'short', title: 'T1' }, u[1])).status, 400);
  assert.equal((await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'A bot that nags' })).status, 401);
});

let e1, e2, e3;
await check('joining makes a project, the owner is on the team, and one person joins once', async () => {
  e1 = (await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'A bot that nags about homework', title: 'Nagbot' }, u[1])).json.id;
  assert.ok(e1);
  assert.equal((await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'Another thing entirely', title: 'Two' }, u[1])).status, 409, 'already in');
  e2 = (await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'A tiny roguelike in Python', title: 'Dungeon' }, u[2])).json.id;
  e3 = (await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'A study timer for finals week', title: 'Timer' }, u[3])).json.id;
  assert.equal((await db.prepare('SELECT title FROM projects WHERE user_id = 1').first()).title, 'Nagbot');
  // Someone else's project cannot be entered.
  const pid = (await db.prepare('SELECT id FROM projects WHERE user_id = 1').first()).id;
  assert.equal((await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'Stealing a project', project_id: pid }, u[4])).status, 404);
});

await check('team size is capped at four; one team per member; only the team adds people', async () => {
  const add = (uid, who, entry = e1) => call('POST', `/api/cycles/${cycleId}/entries/${entry}/team`, { user_id: who }, u[uid]);
  assert.equal((await add(5, 4)).status, 403, 'outsiders cannot add');
  assert.equal((await add(1, 3)).status, 409, 'Cy is already on another team');
  assert.equal((await add(1, 4)).status, 200);
  assert.equal((await add(4, 5)).status, 200, 'any teammate can add');
  assert.equal((await add(1, 6)).status, 200);
  assert.equal(MAX_TEAM, 4);
  const r = await add(1, 7);
  assert.equal(r.status, 409);
  assert.match(r.json.error, /at most 4/);
  assert.equal((await add(1, 99)).status, 404);
  // Removing: a member can leave, the owner cannot.
  const del = (uid, who) => call('DELETE', `/api/cycles/${cycleId}/entries/${e1}/team/${who}`, undefined, u[uid]);
  assert.equal((await del(4, 5)).status, 403, 'a member cannot remove someone else');
  assert.equal((await del(1, 6)).status, 200, 'the owner removes');
  assert.equal((await del(4, 4)).status, 200, 'a member leaves');
  assert.equal((await del(1, 1)).status, 409, 'the owner cannot leave');
  // Put Dee back so Ava's team is Ava, Eli, Dee for the later checks.
  assert.equal((await add(1, 4)).status, 200);
});

await check('member search needs sign-in, shows short names and no emails', async () => {
  assert.equal((await call('GET', '/api/members/search?q=be')).status, 401);
  const r = await call('GET', '/api/members/search?q=be', undefined, u[1]);
  assert.deepEqual(r.json.members, [{ id: 2, name: 'Ben O.' }]);
  assert.deepEqual((await call('GET', '/api/members/search?q=a', undefined, u[1])).json.members, [], 'one letter is too little');
  assert.ok(!JSON.stringify((await call('GET', '/api/members/search?q=ee', undefined, u[1])).json).includes('@'));
});

await check('devlogs: team only, validated, newest first', async () => {
  const post = (uid, entry, b) => call('POST', `/api/cycles/${cycleId}/entries/${entry}/devlogs`, b, u[uid]);
  assert.equal((await post(5, e2, { text: 'I am not on this team' })).status, 403);
  assert.equal((await post(2, e2, { text: 'ok' })).status, 400);
  assert.equal((await post(2, e2, { text: 'x'.repeat(281) })).status, 400);
  assert.equal((await post(2, e2, { text: 'screenshot of the map', url: 'http://x.com/a.png' })).status, 400);
  assert.equal((await post(2, e2, { text: 'Rooms generate now' })).status, 200);
  assert.equal((await post(2, e2, { text: 'Added enemies', url: 'https://i.imgur.com/a.png' })).status, 200);
  assert.equal((await post(4, e1, { text: 'Dee wired up the reminder loop' })).status, 200, 'a teammate can post');
  const mine = (await call('GET', '/api/cycles', undefined, u[2])).json.current.entries.find((e) => e.id === e2);
  assert.equal(mine.devlogs[0].text, 'Added enemies');
  assert.equal(mine.devlog_count, 2);
});

await check('no votes before the demo; entries are locked after', async () => {
  assert.equal((await call('POST', `/api/cycles/${cycleId}/vote`, { entry_id: e2 }, u[5])).status, 409);
  assert.equal((await admin('POST', `/cycles/${cycleId}/entries/${e1}/demoed`, { demoed: true })).status, 200);
  assert.equal((await admin('POST', `/cycles/${cycleId}/entries/${e2}/demoed`, { demoed: true })).status, 200);
  assert.equal((await admin('POST', `/cycles/${cycleId}/status`, { status: 'demo' })).status, 200);
  assert.equal((await call('POST', `/api/cycles/${cycleId}/entries`, { pitch: 'Too late to join', title: 'Late' }, u[7])).status, 409);
  assert.equal((await call('POST', `/api/cycles/${cycleId}/entries/${e1}/team`, { user_id: 7 }, u[1])).status, 409, 'teams are locked');
});

await check('votes: one per member, never your own team, switchable, hidden until close', async () => {
  const vote = (uid, entry) => call('POST', `/api/cycles/${cycleId}/vote`, { entry_id: entry }, u[uid]);
  assert.equal((await vote(1, e2)).status, 200);
  assert.equal((await vote(1, e1)).status, 403, 'own entry');
  assert.equal((await vote(4, e1)).status, 403, 'a teammate is not a neutral voter either');
  assert.equal((await vote(7, 9999)).status, 404);
  assert.equal((await call('POST', `/api/cycles/${cycleId}/vote`, { entry_id: e2 })).status, 401);
  assert.equal((await vote(1, e3)).status, 200, 'voting again moves the vote');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cycle_votes WHERE user_id = 1').first()).n, 1, 'still one vote');
  assert.equal((await vote(5, e2)).status, 200);
  assert.equal((await vote(7, e2)).status, 200);
  const view = (await call('GET', '/api/cycles', undefined, u[1])).json.current;
  assert.equal(view.myVote, e3);
  assert.ok(view.entries.every((e) => e.votes === undefined), 'counts stay hidden during the demo');
  // The entry that is not on the cycle at all.
  assert.equal((await call('POST', `/api/cycles/${cycleId + 50}/vote`, { entry_id: e2 }, u[7])).status, 404);
});

await check('closing pays one approved ship per member of each demoed entry, once', async () => {
  const before = await points(600);
  assert.equal(await points(602), 0, 'Cy was on an entry that was not demoed');
  const r = await admin('POST', `/cycles/${cycleId}/status`, { status: 'closed' });
  assert.equal(r.status, 200);
  assert.equal(r.json.paid, 4, 'Ava, Dee, Eli on Nagbot and Ben on Dungeon');
  const ships = (await db.prepare(`SELECT * FROM activity WHERE kind = 'ship' AND ref = ?`).bind(`cycle:${cycleId}`).all()).results;
  assert.equal(ships.length, 4);
  assert.ok(ships.every((s) => s.status === 'approved' && s.points === 30 && s.decided_name === 'shared login'), 'approved at once, by the closing officer');
  assert.equal(await points(600) - before, 30);
  assert.equal(await points(602), 0, 'not demoed, not paid');
  // Closing again is refused, and the award function itself is idempotent.
  assert.equal((await admin('POST', `/cycles/${cycleId}/status`, { status: 'closed' })).status, 409);
  const { awardShips } = await import('../worker/hub/cycles.js');
  const again = await awardShips(db, await db.prepare('SELECT * FROM cycles WHERE id = ?').bind(cycleId).first(), null);
  assert.equal(again.paid, 0);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE kind = 'ship'`).first()).n, 4);
  assert.equal(await points(600) - before, 30, 'no second payout');
});

await check('after close: winners and counts are public, voting and devlogs are shut', async () => {
  const r = (await call('GET', '/api/cycles')).json;
  assert.equal(r.current, null);
  const past = r.past[0];
  assert.equal(past.cycle.id, cycleId);
  assert.equal(past.shipped, 2);
  assert.deepEqual(past.winners.map((w) => w.title), ['Dungeon'], 'Dungeon has two votes, Timer one');
  assert.equal(past.winners[0].votes, 2);
  assert.equal((await call('POST', `/api/cycles/${cycleId}/vote`, { entry_id: e2 }, u[7])).status, 409);
  assert.equal((await call('POST', `/api/cycles/${cycleId}/entries/${e2}/devlogs`, { text: 'one more after the close' }, u[2])).status, 409);
});

await check('a member with no leaderboard entry yet still gets their ship', async () => {
  db.exec(`INSERT INTO users (id, email, name) VALUES (20, 'new@x.com', 'Nia Fox')`);
  const nia = await cookie(20);
  const c2 = (await admin('POST', '/cycles', { title: 'Cycle two' })).json.id;
  await admin('POST', `/cycles/${c2}/status`, { status: 'open' });
  const e = (await call('POST', `/api/cycles/${c2}/entries`, { pitch: 'A recipe scaler', title: 'Scaler' }, nia)).json.id;
  await admin('POST', `/cycles/${c2}/entries/${e}/demoed`, { demoed: true });
  await admin('POST', `/cycles/${c2}/status`, { status: 'demo' });
  const r = await admin('POST', `/cycles/${c2}/status`, { status: 'closed' });
  assert.equal(r.json.paid, 1);
  const sid = (await db.prepare('SELECT student_id FROM users WHERE id = 20').first()).student_id;
  assert.ok(sid, 'ensureStudent created one');
  assert.equal((await db.prepare(`SELECT status FROM activity WHERE student_id = ? AND kind = 'ship'`).bind(sid).first()).status, 'approved');
});

await check('teammate board: cycle and opportunity targets, caps, owner-only close', async () => {
  const c3 = (await admin('POST', '/cycles', { title: 'Cycle three' })).json.id;
  await admin('POST', `/cycles/${c3}/status`, { status: 'open' });
  const post = (uid, b) => call('POST', '/api/team-posts', b, u[uid]);
  assert.equal((await call('POST', '/api/team-posts', { text: 'Need a designer', target_type: 'opp', target_id: 9 })).status, 401);
  assert.equal((await post(1, { text: 'short', target_type: 'opp', target_id: 9 })).status, 400);
  assert.equal((await post(1, { text: 'Looking for a frontend person', target_type: 'opp', target_id: 12345 })).status, 404);
  assert.equal((await post(1, { text: 'Looking for a frontend person', target_type: 'cycle', target_id: cycleId })).status, 404, 'closed cycle');
  const a = await post(1, { text: 'Looking for a frontend person', skills: 'css, react', target_type: 'opp', target_id: 9 });
  assert.equal(a.status, 200);
  assert.equal((await post(2, { text: 'Need someone who likes algorithms', target_type: 'opp', target_id: 9 })).status, 200);
  assert.equal((await post(1, { text: 'A teammate for the cycle please', target_type: 'cycle', target_id: c3 })).status, 200);
  assert.equal((await post(1, { text: 'Second opportunity post', target_type: 'opp', target_id: 9 })).status, 200);
  assert.equal((await post(1, { text: 'A fourth one is too many', target_type: 'opp', target_id: 9 })).status, 429);
  const list = (await call('GET', '/api/team-posts?type=opp&id=9', undefined, u[1])).json;
  assert.equal(list.posts.length, 3);
  assert.deepEqual(list.posts.map((p) => p.mine), [true, false, true]);
  assert.ok(!JSON.stringify(list).includes('@'), 'no emails');
  assert.equal(list.posts[1].author, 'Ben', 'first name only');
  assert.deepEqual((await call('GET', '/api/team-posts/counts')).json.counts, { 9: 3 });
  assert.equal((await call('POST', `/api/team-posts/${a.json.id}/close`, {}, u[2])).status, 404, 'not your post');
  assert.equal((await call('POST', `/api/team-posts/${a.json.id}/close`, {}, u[1])).status, 200);
  assert.deepEqual((await call('GET', '/api/team-posts/counts')).json.counts, { 9: 2 });
});

console.log(`cycles: ${passed} checks ok`);
