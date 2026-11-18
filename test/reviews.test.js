/**
 * D5 code review requests: validation, snapshot privacy and size cap, who may review and accept,
 * mentor paid once, farming caps, report flow, export and purge.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { exportFor, softDelete, purgeUser } from '../worker/hub/safety.js';
import { cleanRepoUrl, cleanComments } from '../shared/reviews.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'right-horse', SESSION_SECRET: 'test-secret', DEV_LOGIN: '1', DB: makeTestDb(SCHEMA) };
const db = env.DB;

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

async function addUser(name, { role = 'member' } = {}) {
  const s = await db.prepare('INSERT INTO students (name, grade) VALUES (?, 11)').bind(name).run();
  const mail = `${name.replace(/\s+/g, '.').toLowerCase()}@example.com`;
  const u = await db.prepare('INSERT INTO users (email, name, student_id, role) VALUES (?, ?, ?, ?)').bind(mail, name, s.meta.last_row_id, role).run();
  const id = u.meta.last_row_id;
  return { id, sid: s.meta.last_row_id, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
}

async function call(path, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(
    new Request(`https://club.test/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    env,
    { waitUntil() {}, passThroughOnException() {} }
  );
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
}

const maya = await addUser('Maya Patel');
const sam = await addUser('Sam Ortiz');
const lee = await addUser('Lee Chen');
const ava = await addUser('Ava Kim');
const ofc = await addUser('Olive Reyes', { role: 'officer' });
const post = (path, u, body) => call(path, { cookie: u?.cookie, method: 'POST', body });
const NICE = [{ text: 'Name this variable something clearer than x, it is hard to follow.' }];
const mentorRows = async (u) => (await db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE student_id = ? AND kind = 'mentor'`).bind(u.sid).first()).n;
const ask = (u, extra = {}) => post('/reviews', u, { kind: 'repo', repo_url: 'https://github.com/maya/cool-bot', ask: 'Is my structure sensible?', ...extra });

await check('repo urls: only https://github.com/owner/repo', () => {
  assert.equal(cleanRepoUrl('https://github.com/a/b'), 'https://github.com/a/b');
  for (const bad of ['http://github.com/a/b', 'https://github.com/a/b/', 'https://github.com/a/b.git', 'https://github.com/a', 'https://github.com/a/b/issues', 'https://evil.com/a/b', 'https://github.com/a/b?x=1', 'javascript:alert(1)']) {
    assert.equal(cleanRepoUrl(bad), null, bad);
  }
});

await check('comment rules: lines only on files, in range, total length', () => {
  assert.ok(cleanComments(NICE, 0).comments);
  assert.ok(cleanComments([{ line: 2, text: NICE[0].text }], 0).error, 'no lines on a repo');
  assert.ok(cleanComments([{ line: 9, text: NICE[0].text }], 5).error, 'out of range');
  assert.ok(cleanComments([{ text: 'lgtm' }], 5).error, 'too short');
  assert.ok(cleanComments(Array(6).fill(NICE[0]), 5).error, 'too many');
  assert.equal(cleanComments([{ line: 3, text: NICE[0].text }], 5).comments[0].line, 3);
});

await check('everything needs a signed-in member', async () => {
  assert.equal((await call('/reviews')).status, 401);
  assert.equal((await call('/reviews/1')).status, 401);
  assert.equal((await post('/reviews', null, { kind: 'repo' })).status, 401);
  assert.equal((await post('/reviews/1/review', null, { comments: NICE })).status, 401);
  assert.equal((await post('/reviews/1/helpful', null)).status, 401);
});

await check('request validation and the open cap', async () => {
  assert.equal((await ask(maya, { repo_url: 'https://github.com/a/b.git' })).status, 400);
  assert.equal((await ask(maya, { ask: 'hi' })).status, 400);
  assert.equal((await post('/reviews', maya, { kind: 'zip', ask: 'Is my structure sensible?' })).status, 400);
  for (let i = 0; i < 3; i++) assert.equal((await ask(maya, { repo_url: `https://github.com/maya/r${i}` })).status, 201);
  assert.equal((await ask(maya)).status, 429, 'fourth open request refused');
  for (const r of (await call('/reviews', { cookie: maya.cookie })).body.requests) await post(`/reviews/${r.id}/close`, maya);
});

await check('workspace snapshot: own files only, size capped, wiped after close, later edits not exposed', async () => {
  const wid = (await post('/workspaces', maya, { kind: 'python', title: 'Bot' })).body.id;
  const other = await post('/workspaces', sam, { kind: 'python', title: 'Secret' });
  const fileAsk = { kind: 'file', workspace_id: wid, path: 'main.py', ask: 'Take a look at my code please' };
  assert.equal((await post('/reviews', sam, fileAsk)).status, 404, "not someone else's file");
  assert.equal((await post('/reviews', maya, { ...fileAsk, workspace_id: other.body.id })).status, 404);
  await db.prepare(`UPDATE workspace_files SET content = ? WHERE workspace_id = ? AND path = 'main.py'`).bind('x'.repeat(21 * 1024), wid).run();
  assert.equal((await post('/reviews', maya, fileAsk)).status, 400, 'over the cap');
  await db.prepare(`UPDATE workspace_files SET content = ? WHERE workspace_id = ? AND path = 'main.py'`).bind('a = 1\nb = 2\nprint(a + b)\nSNAPSHOT_MARK', wid).run();
  const made = await post('/reviews', maya, fileAsk);
  assert.equal(made.status, 201);
  const id = made.body.id;
  await db.prepare(`UPDATE workspace_files SET content = 'edited later' WHERE workspace_id = ?`).bind(wid).run();
  const seen = await call(`/reviews/${id}`, { cookie: lee.cookie });
  assert.ok(seen.body.snapshot.includes('SNAPSHOT_MARK') && !seen.text.includes('edited later'));
  assert.ok(!(await call('/reviews', { cookie: lee.cookie })).text.includes('SNAPSHOT_MARK'), 'list has no code');
  assert.equal((await call('/reviews/my-files', { cookie: lee.cookie })).body.files.length, 0, 'file menu is your own');
  assert.equal((await post(`/reviews/${id}/review`, lee, { comments: [{ line: 4, text: NICE[0].text }] })).status, 201, 'line comments work on files');
  assert.equal((await post(`/reviews/${id}/close`, lee)).status, 404, 'only the asker closes');
  await post(`/reviews/${id}/close`, maya);
  assert.equal((await call(`/reviews/${id}`, { cookie: lee.cookie })).body.snapshot, '');
  assert.equal((await db.prepare('SELECT snapshot FROM review_requests WHERE id = ?').bind(id).first()).snapshot, '', 'wiped in the database too');
  assert.equal((await post(`/reviews/${id}/review`, sam, { comments: NICE })).status, 404, 'closed request takes no reviews');
});

await check('who may review: not the asker, once each, line numbers only on files', async () => {
  const id = (await ask(maya)).body.id;
  assert.equal((await post(`/reviews/${id}/review`, maya, { comments: NICE })).status, 403, 'self-review refused');
  assert.equal((await post(`/reviews/${id}/review`, lee, { comments: [{ line: 1, text: NICE[0].text }] })).status, 400, 'no lines on a repo');
  assert.equal((await post(`/reviews/${id}/review`, lee, { comments: NICE })).status, 201);
  assert.equal((await post(`/reviews/${id}/review`, lee, { comments: NICE })).status, 409, 'one per reviewer');
  assert.equal((await post(`/reviews/${id}/review`, sam, { comments: [{ text: 'ok' }] })).status, 400);
  // Pending reviews are private to the asker and the author.
  assert.equal((await call(`/reviews/${id}`, { cookie: sam.cookie })).body.reviews.length, 0);
  assert.equal((await call(`/reviews/${id}`, { cookie: lee.cookie })).body.reviews.length, 1);
  const asker = await call(`/reviews/${id}`, { cookie: maya.cookie });
  assert.equal(asker.body.reviews.length, 1);
  assert.equal(asker.body.reviews[0].author, 'Lee', 'first name only');
});

await check('helpful: only the asker, pays mentor once through the ledger', async () => {
  const id = (await db.prepare(`SELECT id FROM review_requests WHERE user_id = ? AND status = 'open'`).bind(maya.id).first()).id;
  const rid = (await db.prepare('SELECT id FROM reviews WHERE request_id = ?').bind(id).first()).id;
  assert.equal((await post(`/reviews/${rid}/helpful`, lee)).status, 404, 'reviewer cannot accept own review');
  assert.equal((await post(`/reviews/${rid}/helpful`, sam)).status, 404, 'a bystander cannot');
  assert.equal((await post(`/reviews/${rid}/helpful`, ofc)).status, 404, 'not even an officer');
  const ok = await post(`/reviews/${rid}/helpful`, maya);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.awarded, 15);
  assert.equal((await post(`/reviews/${rid}/helpful`, maya)).status, 409, 'second click');
  // Lee also reviewed Maya's file earlier (closed request, never accepted): only this one paid.
  assert.equal(await mentorRows(lee), 1);
  assert.equal((await db.prepare(`SELECT ref FROM activity WHERE student_id = ? AND kind = 'mentor'`).bind(lee.sid).first()).ref, `review:${rid}`);
  assert.equal((await db.prepare('SELECT SUM(delta) AS n FROM point_events WHERE student_id = ?').bind(lee.sid).first()).n, 15);
  assert.equal((await call(`/reviews/${id}`, { cookie: sam.cookie })).body.reviews.length, 1, 'accepted review is public');
});

await check('farming: the same pair cannot trade thanks, 3 per request, 3 payouts a week', async () => {
  // Maya thanked Lee. Lee asks, Maya reviews: thanking back (either direction) pays nothing.
  const back = (await ask(lee, { repo_url: 'https://github.com/lee/thing' })).body.id;
  const mr = (await post(`/reviews/${back}/review`, maya, { comments: NICE })).body.id;
  assert.equal((await post(`/reviews/${mr}/helpful`, lee)).status, 409, 'reciprocal pair refused');
  assert.equal(await mentorRows(maya), 0);

  const extra = [];
  for (const n of ['Zed One', 'Zed Two', 'Zed Three']) extra.push(await addUser(n));
  const big = (await ask(ava, { repo_url: 'https://github.com/ava/big' })).body.id;
  const ids = [];
  for (const u of [sam, ...extra]) ids.push((await post(`/reviews/${big}/review`, u, { comments: NICE })).body.id);
  for (const rid of ids.slice(0, 3)) assert.equal((await post(`/reviews/${rid}/helpful`, ava)).status, 200);
  assert.equal((await post(`/reviews/${ids[3]}/helpful`, ava)).status, 409, 'fourth on one request refused');

  // Sam has one payout from Ava; two more from other askers are fine, the next is the weekly cap.
  const paid = [];
  for (const n of ['Ann Two', 'Ann Three', 'Ann Four']) {
    const a = await addUser(n);
    const q = (await ask(a, { repo_url: `https://github.com/${a.id}/r` })).body.id;
    const rid = (await post(`/reviews/${q}/review`, sam, { comments: NICE })).body.id;
    paid.push((await post(`/reviews/${rid}/helpful`, a)).status);
  }
  assert.deepEqual(paid, [200, 200, 409], 'third payout in a week refused');
  assert.equal(await mentorRows(sam), 3);
});

await check('a hidden request cannot be viewed or accepted', async () => {
  const q = (await ask(sam, { repo_url: 'https://github.com/sam/x' })).body.id;
  const rid = (await post(`/reviews/${q}/review`, lee, { comments: NICE })).body.id;
  await db.prepare(`UPDATE review_requests SET status = 'hidden' WHERE id = ?`).bind(q).run();
  assert.equal((await call(`/reviews/${q}`, { cookie: lee.cookie })).status, 404);
  assert.equal((await post(`/reviews/${rid}/helpful`, sam)).status, 404);
});

await check('reports: members report open requests and reviews, an officer hides', async () => {
  const q = (await ask(sam, { repo_url: 'https://github.com/sam/y' })).body.id;
  const rid = (await post(`/reviews/${q}/review`, ava, { comments: NICE })).body.id;
  assert.equal((await post('/reports', maya, { kind: 'review_request', id: q })).status, 200);
  assert.equal((await post('/reports', maya, { kind: 'review', id: rid })).status, 200);
  const list = await call('/admin/hub/reports', { cookie: ofc.cookie });
  const rep = list.body.reports.find((r) => r.kind === 'review');
  assert.ok(rep.content.includes('clearer'));
  assert.equal((await post(`/admin/hub/reports/${rep.id}/hide`, ofc)).status, 200);
  assert.equal((await db.prepare('SELECT status FROM reviews WHERE id = ?').bind(rid).first()).status, 'hidden');
  assert.equal((await post('/reports', maya, { kind: 'review', id: rid })).status, 404, 'hidden is not reportable');
});

await check('export includes requests and reviews; purge removes them and what hangs off them', async () => {
  const data = await exportFor(db, { id: lee.id, student_id: lee.sid });
  assert.ok(data.reviews_written.length >= 2 && Array.isArray(data.review_requests));
  const mine = await exportFor(db, { id: sam.id, student_id: sam.sid });
  assert.ok(mine.review_requests.length >= 1);
  await softDelete(db, { id: sam.id, student_id: sam.sid }, false);
  await purgeUser(db, sam.id);
  for (const t of ['reviews', 'review_requests']) {
    assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).bind(sam.id).first()).n, 0, `${t} purged`);
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE request_id NOT IN (SELECT id FROM review_requests)').first()).n, 0, 'no orphan reviews');
  assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE kind = 'review_request' AND target_id NOT IN (SELECT id FROM review_requests)`).first()).n, 0, 'no orphan reports');
});

console.log(`reviews: ${passed} checks passed`);
