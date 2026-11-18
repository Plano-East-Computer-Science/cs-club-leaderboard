/**
 * Checks for the club hub: the gateway's guard rails and the course content.
 * Plain node, no framework (same as selftest.js).
 *
 * The course check runs every code step's reference solution through a real
 * Python against its own cases, so a lesson with a wrong expected answer fails
 * here instead of in front of the club. Skipped when no python is installed.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import {
  DEFAULT_HOSTS, GATEWAY_CSP, hostsFrom, parseHostList, searchTarget, isAllowedHost, isBlockedPath, toGateway, methodAllowed,
} from '../worker/hub/gateway.js';
import { COURSES, publicStep } from '../shared/courses.js';

/* ------------------------------- gateway ------------------------------- */

const hosts = hostsFrom('');

// Gateway pages run in an opaque-origin sandbox, so their scripts cannot use
// the member's club cookie. allow-same-origin would undo that.
assert.match(GATEWAY_CSP, /^sandbox /);
assert.ok(!/allow-same-origin|allow-top-navigation/.test(GATEWAY_CSP));
assert.deepEqual(hosts, DEFAULT_HOSTS);
assert.deepEqual(hostsFrom('a.com, B.com'), ['a.com', 'b.com']);

assert.ok(isAllowedHost(hosts, 'github.com'));
assert.ok(isAllowedHost(hosts, 'GitHub.com'));
assert.ok(!isAllowedHost(hosts, 'evil.com'));
// A lookalike or subdomain trick must not pass.
assert.ok(!isAllowedHost(hosts, 'github.com.evil.com'));
assert.ok(!isAllowedHost(hosts, 'notgithub.com'));

for (const p of ['/login', '/login?return_to=/', '/session', '/sessions/two-factor', '/signup', '/settings/profile', '/password_reset', '/login/oauth/authorize']) {
  assert.ok(isBlockedPath(p), `should block ${p}`);
}
for (const p of ['/', '/octocat/Hello-World', '/octocat/Hello-World.git/info/refs', '/loginfo', '/join-us-readme']) {
  assert.ok(!isBlockedPath(p), `should allow ${p}`);
}

// Links are rewritten to the gateway only when the target host is allowed.
const base = 'https://github.com/octocat/Hello-World';
assert.equal(toGateway('/octocat/Spoon-Knife', base, 'ABC', hosts), '/gw/ABC/github.com/octocat/Spoon-Knife');
assert.equal(toGateway('issues?q=1', base, 'ABC', hosts), '/gw/ABC/github.com/octocat/issues?q=1');
assert.equal(
  toGateway('https://raw.githubusercontent.com/o/r/main/x.py', base, 'ABC', hosts),
  '/gw/ABC/raw.githubusercontent.com/o/r/main/x.py'
);
assert.equal(toGateway('https://evil.com/phish', base, 'ABC', hosts), null);
assert.equal(toGateway('javascript:alert(1)', base, 'ABC', hosts), null);
assert.equal(toGateway('mailto:a@b.c', base, 'ABC', hosts), null);

assert.ok(methodAllowed('GET', 'github.com', '/x'));
assert.ok(methodAllowed('POST', 'github.com', '/o/r.git/git-receive-pack'));
assert.ok(!methodAllowed('POST', 'github.com', '/o/r/issues'));
assert.ok(!methodAllowed('DELETE', 'github.com', '/o/r'));
assert.ok(methodAllowed('POST', 'api.github.com', '/repos/o/r/issues'));

assert.deepEqual(parseHostList('Docs.Python.org, pypi.org pypi.org').hosts, ['docs.python.org', 'pypi.org']);
assert.deepEqual(parseHostList('').hosts, []);
for (const bad of ['localhost', '127.0.0.1', 'evil.com/path', 'a.com:8080', '*.github.com', 'x.internal', 'nodot'])
  assert.ok(parseHostList(bad).error, `should reject ${bad}`);

const bing = (u) => `?u=a1${u}&ntb=1`;
assert.equal(searchTarget('www.bing.com', '/ck/a', bing('aHR0cHM6Ly9yZWFscHl0aG9uLmNvbS9saXN0LWNvbXByZWhlbnNpb24tcHl0aG9uLz94PTE')).hostname, 'realpython.com');
assert.equal(searchTarget('www.bing.com', '/ck/a', bing('amF2YXNjcmlwdDphbGVydCgxKQ')), null);
assert.equal(searchTarget('www.bing.com', '/ck/a', bing('L2ltYWdlcy9zZWFyY2g_cT14')).pathname, '/images/search');
assert.equal(searchTarget('www.bing.com', '/search', bing('aHR0cHM6Ly9yZWFscHl0aG9uLmNvbS9saXN0LWNvbXByZWhlbnNpb24tcHl0aG9uLz94PTE')), null);
assert.equal(searchTarget('evil.com', '/ck/a', bing('aHR0cHM6Ly9yZWFscHl0aG9uLmNvbS9saXN0LWNvbXByZWhlbnNpb24tcHl0aG9uLz94PTE')), null);
assert.equal(searchTarget('www.bing.com', '/ck/a', '?u=notencoded'), null);

/* ------------------------------- dashboard ------------------------------- */

import { streakOf } from '../worker/hub/dashboard.js';
const noon = Date.parse('2026-11-16T12:00:00Z');
assert.equal(streakOf([], noon), 0);
assert.equal(streakOf(['2026-11-16 09:00:00', '2026-11-15 20:00:00', '2026-11-14 01:00:00'], noon), 3);
assert.equal(streakOf(['2026-11-15 20:00:00'], noon), 1); // yesterday still counts
assert.equal(streakOf(['2026-11-13 20:00:00'], noon), 0); // gap breaks it

/* ------------------------------ quests, ranks ------------------------------ */

import { QUESTS, questProgress } from '../shared/quests.js';
import { RANKS, rankFor } from '../shared/ranks.js';
import { stepStats } from '../worker/hub/quests.js';
import { cleanStage } from '../worker/hub/room-do.js';
import { verifyGoogleIdToken } from '../worker/hub/google.js';

const zero = { steps: 0, coursesDone: 0, tracks: 0, flags: 0, meetings: 0, projects: 0, ideas: 0, streak: 0 };
assert.ok(questProgress(zero).quests.every((q) => !q.done));
assert.equal(rankFor(0).rank, 'newcomer');
assert.equal(new Set(QUESTS.map((q) => q.id)).size, QUESTS.length, 'quest ids must be unique');
assert.ok(questProgress({ ...zero, steps: 1 }).quests.find((q) => q.id === 'first-step').done);
// Progress never reads above the target.
assert.ok(questProgress({ ...zero, meetings: 99 }).quests.every((q) => q.have <= q.need));
assert.equal(rankFor(RANKS[2].min).rank, RANKS[2].id);
assert.equal(rankFor(RANKS[2].min - 1).rank, RANKS[1].id);
assert.equal(rankFor(1e9).next, null);

const demo = [
  { slug: 'a', track: 'cp', steps: [{ id: 'x', kind: 'code' }, { id: 'y', kind: 'flag' }] },
  { slug: 'b', track: 'data', steps: [{ id: 'x', kind: 'read' }] },
];
const at = '2026-11-16 09:00:00';
const st = stepStats(
  [{ course: 'a', step: 'x', passed_at: at }, { course: 'a', step: 'y', passed_at: at }, { course: 'a', step: 'deleted', passed_at: at }, { course: 'gone', step: 'x', passed_at: at }],
  demo,
  noon
);
assert.deepEqual(st, { steps: 2, coursesDone: 1, flags: 1, tracks: 1, streak: 1 });

/* ------------------------------- room agenda ------------------------------- */

assert.deepEqual(
  cleanStage([
    { label: 'Lesson', url: '/learn/python-contests' },
    { label: 'CSES', url: 'https://cses.fi/problemset' },
    { label: 'other site', url: '//evil.com' },
    { label: 'script', url: 'javascript:alert(1)' },
    { label: 'plain http', url: 'http://example.com' },
    { label: '', url: '/x' },
  ]).map((i) => i.url),
  ['/learn/python-contests', 'https://cses.fi/problemset']
);
assert.deepEqual(cleanStage('nope'), []);

/* ------------------------------ Google sign-in ------------------------------ */

{
  const b64 = (buf) => Buffer.from(buf).toString('base64url');
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const keys = [{ ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' }];
  const mint = async (claims, key = pair.privateKey, alg = 'RS256') => {
    const head = b64(JSON.stringify({ alg, kid: 'k1' }));
    const body = b64(JSON.stringify(claims));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64(sig)}`;
  };
  const now = Date.now();
  const good = { iss: 'https://accounts.google.com', aud: 'client-1', exp: now / 1000 + 600, email: 'a@b.c', email_verified: true, name: 'A' };
  const check = (t, id = 'client-1') => verifyGoogleIdToken(t, id, { keys, now });

  assert.equal((await check(await mint(good)))?.email, 'a@b.c');
  assert.equal(await check(await mint(good), 'another-site'), null, 'token minted for a different site');
  assert.equal(await check(await mint({ ...good, exp: now / 1000 - 1 })), null, 'expired');
  assert.equal(await check(await mint({ ...good, iss: 'https://evil.example' })), null, 'wrong issuer');
  assert.equal(await check(await mint({ ...good, email_verified: false })), null, 'unverified email');
  const other = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  assert.equal(await check(await mint(good, other.privateKey)), null, 'signed by someone else');
  const [h, , sg] = (await mint(good)).split('.');
  assert.equal(await check(`${h}.${b64(JSON.stringify({ ...good, email: 'x@y.z' }))}.${sg}`), null, 'tampered body');
  assert.equal(await check('garbage'), null);
  assert.equal(await check(await mint(good), ''), null, 'no client id configured');
}

/* -------------------------------- courses -------------------------------- */

const slugs = new Set();
for (const course of COURSES) {
  assert.ok(!slugs.has(course.slug), `duplicate course ${course.slug}`);
  slugs.add(course.slug);
  const ids = new Set();
  for (const step of course.steps) {
    assert.ok(!ids.has(step.id), `duplicate step ${course.slug}/${step.id}`);
    ids.add(step.id);
    if (step.kind === 'mcq') {
      assert.ok(Number.isInteger(step.answer) && step.answer >= 0 && step.answer < step.options.length, `${step.id}: bad answer index`);
    }
    if (step.kind === 'flag') assert.ok(step.flag, `${step.id}: no flag`);
    if (step.kind === 'code') assert.ok(step.cases?.length && step.solution && step.starter, `${step.id}: incomplete code step`);

    // Nothing that gives the answer away may survive publicStep.
    const pub = publicStep(step);
    for (const secret of ['answer', 'flag', 'solution', 'explain']) assert.ok(!(secret in pub), `${step.id} leaks ${secret}`);
  }
}

const py = ['python', 'python3', 'py'].find((bin) => spawnSync(bin, ['--version']).status === 0);
if (!py) {
  console.log('hub: python not found, skipped running course solutions');
} else {
  let ran = 0;
  for (const course of COURSES) {
    for (const step of course.steps.filter((s) => s.kind === 'code')) {
      for (const [i, cs] of step.cases.entries()) {
        const r = spawnSync(py, ['-c', step.solution], { input: cs.stdin, encoding: 'utf8', timeout: 10_000 });
        assert.equal(r.status, 0, `${course.slug}/${step.id} case ${i} crashed: ${r.stderr}`);
        const norm = (s) => s.replace(/\r\n/g, '\n').trim();
        assert.equal(norm(r.stdout), norm(cs.stdout), `${course.slug}/${step.id} case ${i}`);
        ran++;
      }
    }
  }
  console.log(`hub: ran ${ran} course cases through ${py}`);
}

console.log('hub: ok');
