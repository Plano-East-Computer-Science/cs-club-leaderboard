/**
 * H3 reader mode: URL and allowlist checks (userinfo, IP literals, ports,
 * suffix tricks), redirects re-checked on every hop, the size cap, content
 * types, that extraction emits text only (no scripts, handlers or markup),
 * and that the route refuses anonymous callers. No network: fetch is injected.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { checkUrl, fetchPage, extract, readerHosts, readCapped, READER_DEFAULT_HOSTS, MAX_BYTES } from '../worker/hub/reader.js';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

const hosts = readerHosts('', '');
const page = (body, type = 'text/html; charset=utf-8', status = 200) =>
  new Response(body, { status, headers: { 'content-type': type } });
const redirect = (location) => new Response(null, { status: 302, headers: { location } });

await check('allowlist: defaults plus gateway hosts, exact match only', () => {
  for (const h of READER_DEFAULT_HOSTS) assert.ok(hosts.includes(h));
  assert.ok(hosts.includes('github.com'));
  assert.ok(checkUrl('https://docs.python.org/3/tutorial/', hosts).url);
  assert.ok(checkUrl('https://DOCS.python.org/3/', hosts).url);
  assert.equal(checkUrl('https://evil.com/', hosts).status, 403);
  assert.equal(checkUrl('https://docs.python.org.evil.com/', hosts).status, 403);
  assert.equal(checkUrl('https://evildocs.python.org/', hosts).status, 403);
  assert.equal(readerHosts('a.example.com', '')[0], 'a.example.com');
});

await check('url tricks are refused', () => {
  assert.ok(checkUrl('https://docs.python.org@evil.com/', hosts).error); // host is evil.com
  assert.ok(checkUrl('https://evil.com@docs.python.org/', hosts).error); // any userinfo is refused
  assert.ok(checkUrl('http://docs.python.org/', hosts).error);
  assert.ok(checkUrl('ftp://docs.python.org/', hosts).error);
  assert.ok(checkUrl('https://docs.python.org:8443/', hosts).error);
  assert.ok(checkUrl('https://docs.python.org:443/x', hosts).url);
  // Even if an officer typed an IP or localhost into the list, they never pass.
  const wide = ['127.0.0.1', '[::1]', 'localhost', '2130706433', '169.254.169.254', ...hosts];
  for (const u of ['https://127.0.0.1/', 'https://[::1]/', 'https://2130706433/', 'https://0x7f.1/', 'https://169.254.169.254/', 'https://localhost/', 'not a url', '']) {
    assert.ok(checkUrl(u, wide).error, u);
  }
});

await check('redirects: followed within the list, refused outside it, capped at 3', async () => {
  const calls = [];
  const via = (map) => async (u, init) => {
    calls.push(u);
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.cookie, undefined);
    return map[u] ?? page('gone', 'text/html', 404);
  };
  const start = new URL('https://docs.python.org/a');
  const ok = await fetchPage(start, hosts, via({
    'https://docs.python.org/a': redirect('/b'),
    'https://docs.python.org/b': page('<p>hi</p>'),
  }));
  assert.equal(ok.url.pathname, '/b');

  const bad = await fetchPage(start, hosts, via({
    'https://docs.python.org/a': redirect('https://evil.com/x'),
    'https://evil.com/x': page('secret'),
  }));
  assert.equal(bad.status, 403);
  assert.ok(!calls.includes('https://evil.com/x'), 'never contacted the disallowed host');

  const toHttp = await fetchPage(start, hosts, via({ 'https://docs.python.org/a': redirect('http://docs.python.org/x') }));
  assert.equal(toHttp.status, 403);

  let hops = 0;
  const many = await fetchPage(start, hosts, async () => { hops++; return redirect('/again'); });
  assert.equal(many.status, 502);
  assert.equal(hops, 4); // the first request plus 3 redirects
});

await check('content types and the size cap', async () => {
  const u = new URL('https://docs.python.org/a');
  assert.equal((await fetchPage(u, hosts, async () => page('{}', 'application/json'))).status, 415);
  assert.equal((await fetchPage(u, hosts, async () => page('x', 'image/png'))).status, 415);
  assert.equal((await fetchPage(u, hosts, async () => page('x', 'text/html', 500))).status, 502);
  assert.equal((await fetchPage(u, hosts, async () => { throw new Error('down'); })).status, 502);
  const big = await fetchPage(u, hosts, async () => page('a'.repeat(MAX_BYTES + 5000)));
  assert.equal(big.truncated, true);
  assert.equal(big.text.length, MAX_BYTES);
  assert.deepEqual(await readCapped(page('abc'), 10), { text: 'abc', truncated: false });
});

await check('extraction keeps text and code, drops everything else', () => {
  const html = `<!doctype html><html><head><title>List &amp; tuple</title><script>alert('head')</script></head>
  <body onload="steal()"><nav><a href="/nav">NAVTEXT</a></nav>
  <h1 onclick="x()">Lists</h1>
  <p class="a" style="x">Use <code>append()</code>. See <a href="/3/tutorial/" onclick="evil()">the tutorial</a>,
  <a href="https://evil.com/x">elsewhere</a> and <a href="javascript:alert(1)">js</a>.</p>
  <script>document.cookie='SCRIPTBODY'</script><style>.x{color:red}STYLEBODY</style>
  <iframe src="https://evil.com">IFRAMEBODY</iframe><form action="/x"><input value="FORMBODY"></form>
  <img src="x.png" onerror="bad()" alt="ALT">
  <ul><li>one</li><li>two <b>bold</b></li></ul>
  <pre><span class="k">def</span> f(x):\n    return x &lt; 1</pre>
  <!-- COMMENTBODY --><p>tail</p></body></html>`;
  const out = extract(html, new URL('https://docs.python.org/3/library/'), hosts);
  const json = JSON.stringify(out);
  assert.equal(out.title, 'List & tuple');
  for (const bad of ['alert', 'onclick', 'onerror', 'onload', 'SCRIPTBODY', 'STYLEBODY', 'IFRAMEBODY', 'FORMBODY', 'NAVTEXT', 'COMMENTBODY', 'steal', 'javascript:', '<script', '<a ', 'style']) {
    assert.ok(!json.includes(bad), `output must not contain ${bad}`);
  }
  const h = out.blocks.find((b) => b.t === 'h');
  assert.equal(h.level, 1);
  assert.equal(h.runs[0].s, 'Lists');
  const p = out.blocks.find((b) => b.t === 'p');
  assert.equal(p.runs.map((r) => r.s).join(''), 'Use append(). See the tutorial, elsewhere and js.');
  const links = p.runs.filter((r) => r.to);
  assert.equal(links.length, 1); // only the readable target becomes a link
  assert.equal(links[0].to, `/read?url=${encodeURIComponent('https://docs.python.org/3/tutorial/')}`);
  assert.deepEqual(out.blocks.filter((b) => b.t === 'li').map((b) => b.runs.map((r) => r.s).join('')), ['one', 'two bold']);
  assert.equal(out.blocks.find((b) => b.t === 'pre').text, 'def f(x):\n    return x < 1');
});

await check('extraction survives hostile and broken markup', () => {
  const base = new URL('https://docs.python.org/');
  const out = extract('<p>a < b <script>never</scr' + 'ipt><p><a href="https://docs.python.org@evil.com/">x</a><div><iframe><iframe>deep</iframe>after</iframe>shown</div><unclosed', base, hosts);
  const json = JSON.stringify(out);
  assert.ok(!json.includes('never') && !json.includes('deep') && !json.includes('after'));
  assert.ok(json.includes('shown'));
  assert.ok(!json.includes('evil.com'));
  assert.deepEqual(extract('', base, hosts).blocks, []);
  assert.ok(extract('<p>x</p>'.repeat(10000), base, hosts).blocks.length <= 3000);
});

/* ------------------------------ the route ------------------------------ */

const env = { SESSION_SECRET: 'test-secret', ADMIN_PASSWORD: 'pw', DB: makeTestDb(fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8')) };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path, cookie) => worker.fetch(new Request(`https://club.test/api${path}`, { headers: cookie ? { Cookie: cookie } : {} }), env, ctx);
const q = (u) => `/read?url=${encodeURIComponent(u)}`;

await check('route: anonymous callers are refused', async () => {
  const realFetch = globalThis.fetch;
  let touched = false;
  globalThis.fetch = async () => { touched = true; return page('x'); };
  try {
    assert.equal((await get(q('https://docs.python.org/3/'))).status, 401);
    assert.equal((await get('/read/hosts')).status, 401);
    assert.equal(touched, false);
    const put = await worker.fetch(new Request('https://club.test/api/admin/hub/reader', { method: 'PUT', body: '{}' }), env, ctx);
    assert.ok([401, 403].includes(put.status));
  } finally { globalThis.fetch = realFetch; }
});

await check('route: member reads an allowed page, a blocked host is 403, and the limit holds', async () => {
  const s = await env.DB.prepare('INSERT INTO students (name, grade) VALUES (?, 11)').bind('Rita Reader').run();
  const u = await env.DB.prepare('INSERT INTO users (email, name, student_id, role) VALUES (?, ?, ?, ?)').bind('rita@example.com', 'Rita Reader', s.meta.last_row_id, 'member').run();
  const cookie = `${USER_COOKIE}=${await signValue(env, `${u.meta.last_row_id}:${Date.now() + 60_000}`)}`;
  const realFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async () => { n++; return page('<title>T</title><h2>Hello</h2><script>x()</script>'); };
  try {
    const ok = await get(q('https://docs.python.org/3/'), cookie);
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.title, 'T');
    assert.equal(body.blocks[0].t, 'h');
    assert.ok(!JSON.stringify(body).includes('x()'));
    assert.equal((await get(q('https://evil.com/'), cookie)).status, 403);
    assert.equal((await get(q('https://docs.python.org@evil.com/'), cookie)).status, 400);
    assert.equal(n, 1);
    let last = 200;
    for (let i = 0; i < 25 && last !== 429; i++) last = (await get(q(`https://docs.python.org/${i}`), cookie)).status;
    assert.equal(last, 429);
  } finally { globalThis.fetch = realFetch; }
});

console.log(`reader: ${passed} checks passed`);
