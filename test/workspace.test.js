/**
 * D2 workspace: path and size rules, the multi-file Python program, the web
 * preview sandbox, the zip writer, and who may read or write a workspace.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { LIMITS, STARTERS, pathError, checkSave, pythonProgram, buildPreview, zip } from '../shared/workspace.js';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;

async function addUser(name) {
  const u = await db.prepare('INSERT INTO users (email, name) VALUES (?, ?)').bind(`${name.toLowerCase()}@example.com`, name).run();
  const id = u.meta.last_row_id;
  return { id, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
}
async function call(p, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(
    new Request(`https://club.test/api${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    env,
    { waitUntil() {}, passThroughOnException() {} }
  );
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json };
}

await check('paths: names and folders only, no tricks', () => {
  for (const p of ['main.py', 'lib/util.py', 'a/b/c/d.txt', 'style.css']) assert.equal(pathError(p), null, p);
  for (const p of ['', '/etc/passwd', '../x.py', 'a/../b.py', '.env', 'a\\b.py', 'a/b/c/d/e.py', 'sp ace.py']) assert.ok(pathError(p), p);
});

await check('save limits are checked against what is stored', () => {
  const big = 'x'.repeat(LIMITS.fileBytes + 1);
  assert.match(checkSave(new Map(), { files: [{ path: 'a.py', content: big }] }).error, /KB/);
  const nearly = new Map(Array.from({ length: LIMITS.files }, (_, i) => [`f${i}.py`, 1]));
  assert.match(checkSave(nearly, { files: [{ path: 'one-more.py', content: '' }] }).error, /at most/);
  assert.equal(checkSave(nearly, { files: [{ path: 'one-more.py', content: '' }], deleted: ['f0.py'] }).error, undefined);
  assert.match(checkSave(new Map(), { files: [{ path: 'a.py', content: 3 }] }).error, /text/);
});

await check('the web preview has no network and inlines local files', () => {
  const html = buildPreview(STARTERS.web);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.ok(!/connect-src/.test(html), 'fetch and XHR fall back to none');
  assert.ok(html.includes('font-family: system-ui') && html.includes('clicked'), 'style.css and script.js inlined');
  assert.ok(!/src="script.js"/.test(html));
  // A file cannot close the inline tag early.
  assert.ok(!buildPreview({ 'index.html': '<script src="a.js"></script>', 'a.js': 'x = "</script><b>"' }).includes('"</script><b>"'));
});

await check('zip has one entry per file', () => {
  const z = zip({ 'a.py': 'print(1)', 'b/c.txt': 'hi' });
  const text = Buffer.from(z).toString('latin1');
  assert.equal(text.split('PK\x01\x02').length - 1, 2);
  assert.ok(text.includes('workspace/b/c.txt'));
});

await check('a multi-file Python project runs (real Python, when installed)', () => {
  const py = spawnSync('python', ['--version']);
  if (py.status !== 0) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  // Point the scratch folder inside the temp dir so the test leaves nothing behind.
  const prog = pythonProgram(STARTERS.python).replace("'/home/pyodide/workspace'", JSON.stringify(path.join(dir, 'ws')));
  fs.writeFileSync(path.join(dir, 'prog.py'), prog);
  const r = spawnSync('python', ['-I', path.join(dir, 'prog.py')], { input: 'Ana\n', encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Hello, Ana\./);
});

const ana = await addUser('Ana');
const bo = await addUser('Bo');

await check('only the owner can read, save or delete a workspace', async () => {
  assert.equal((await call('/workspaces', { method: 'POST', body: { kind: 'python' } })).status, 401);
  assert.equal((await call('/workspaces', { method: 'POST', cookie: ana.cookie, body: { kind: 'java' } })).status, 400);
  const made = await call('/workspaces', { method: 'POST', cookie: ana.cookie, body: { kind: 'python', title: 'Mine' } });
  const id = made.body.id;
  const got = await call(`/workspaces/${id}`, { cookie: ana.cookie });
  assert.deepEqual(got.body.files.map((f) => f.path), ['helpers.py', 'main.py']);
  for (const [method, body] of [['GET'], ['PUT', { files: [{ path: 'x.py', content: 'evil' }] }], ['DELETE']]) {
    assert.equal((await call(`/workspaces/${id}`, { method, body, cookie: bo.cookie })).status, 404, `${method} by another member`);
  }
  assert.equal((await call('/workspaces', { cookie: bo.cookie })).body.workspaces.length, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM workspace_files WHERE path = ?').bind('x.py').first()).n, 0);
});

await check('save writes, deletes and keeps the entry file', async () => {
  const id = (await call('/workspaces', { method: 'POST', cookie: ana.cookie, body: { kind: 'web' } })).body.id;
  let r = await call(`/workspaces/${id}`, { method: 'PUT', cookie: ana.cookie, body: { title: 'Site', files: [{ path: 'about.html', content: '<p>hi</p>' }], deleted: ['style.css'] } });
  assert.equal(r.status, 200);
  const paths = (await call(`/workspaces/${id}`, { cookie: ana.cookie })).body.files.map((f) => f.path);
  assert.deepEqual(paths, ['about.html', 'index.html', 'script.js']);
  r = await call(`/workspaces/${id}`, { method: 'PUT', cookie: ana.cookie, body: { deleted: ['index.html'] } });
  assert.equal(r.status, 400);
  r = await call(`/workspaces/${id}`, { method: 'PUT', cookie: ana.cookie, body: { files: [{ path: '../x', content: '' }] } });
  assert.equal(r.status, 400);
  assert.equal((await call(`/workspaces/${id}`, { method: 'DELETE', cookie: ana.cookie })).status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM workspace_files WHERE workspace_id = ?').bind(id).first()).n, 0);
});

console.log(`workspace: ${passed} checks passed`);
