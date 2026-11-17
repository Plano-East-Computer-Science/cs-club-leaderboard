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
  DEFAULT_HOSTS, hostsFrom, isAllowedHost, isBlockedPath, toGateway, methodAllowed,
} from '../worker/hub/gateway.js';
import { COURSES, publicStep } from '../shared/courses.js';

/* ------------------------------- gateway ------------------------------- */

const hosts = hostsFrom('');
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
