/**
 * Compiles and runs every piece of Java in the Learn courses with the real
 * in-browser compiler (public/teavm, the same one the lesson player uses):
 *   - examples and predict steps must print exactly their `output`,
 *   - each exercise's `solution` must pass every test,
 *   - each exercise's `starter` must compile and fail at least one test.
 *
 *   node test/learn-next-java.js            every lesson (about 2 minutes)
 *   node test/learn-next-java.js u2-        only lessons whose "course/lesson" contains "u2-"
 *
 * Not part of `npm test` (too slow); run it after editing lesson content.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// --liftoff-only: Node 24's optimising WebAssembly tier miscompiles the
// compiler after a few dozen compiles ("array element access out of bounds"
// on every compile after that, even in a new instance). V8's baseline tier
// runs it correctly. --experimental-wasm-exnref: Node 24 keeps exception
// references behind a flag.
if (!process.execArgv.includes('--liftoff-only')) {
  const r = spawnSync(
    process.execPath,
    ['--liftoff-only', '--experimental-wasm-exnref', '--disable-warning=ExperimentalWarning', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit' }
  );
  process.exit(r.status ?? 1);
}

const { COURSES } = await import('../shared/next/learn/courses/index.js');
const { normOutput, judgedSource, lessonsOf, validateLesson } = await import('../shared/next/learn/schema.js');

const dir = new URL('../public/teavm/', import.meta.url);
const { load } = await import(new URL('compiler.wasm-runtime.js', dir).href);
const { createJavaEngine } = await import(pathToFileURL(fileURLToPath(new URL('../src/lib/run/javaEngine.js', import.meta.url))).href);
const read = (f) => new Int8Array(fs.readFileSync(new URL(f, dir)));
const engine = await createJavaEngine({
  load,
  files: { compiler: read('compiler.wasm'), sdk: read('compile-classlib-teavm.bin'), classlib: read('runtime-classlib-teavm.bin'), deobfuscator: read('deobfuscator.wasm') },
});

const filter = process.argv[2] || '';
const failures = [];
let programs = 0;

async function exec(source, stdins) {
  programs++;
  let c;
  try {
    c = await engine.compile(source);
  } catch (e) {
    return { error: `the compiler crashed (${e.message})` };
  }
  if (!c.ok) return { error: c.diagnostics.map((d) => `line ${d.line}: ${d.message}`).join('; ') };
  const runs = [];
  for (const s of stdins) runs.push(await engine.run(s));
  return { runs };
}

const show = (s) => JSON.stringify(s.length > 300 ? `${s.slice(0, 300)}...` : s);

for (const course of COURSES) {
  if (course.lang !== 'java') continue;
  for (const lesson of lessonsOf(course)) {
    const key = `${course.id}/${lesson.id}`;
    if (!key.includes(filter)) continue;
    let bad = 0;
    for (const e of validateLesson(lesson, key)) {
      bad++;
      failures.push(`schema: ${e}`);
    }
    for (const [i, s] of lesson.steps.entries()) {
      const at = `${key} step ${i + 1} (${s.kind})`;
      const fail = (msg) => {
        bad++;
        failures.push(`${at}: ${msg}`);
      };
      if (s.kind === 'example' || s.kind === 'predict') {
        const r = await exec(s.code, [s.stdin || '']);
        if (r.error) fail(`does not compile: ${r.error}`);
        else if (r.runs[0].exitCode !== 0 && !s.crashes) fail(`crashed: ${r.runs[0].stderr.trim()}`);
        else if (normOutput(r.runs[0].stdout) !== normOutput(s.output)) fail(`prints ${show(r.runs[0].stdout)}, lesson says ${show(s.output)}`);
      } else if (s.kind === 'exercise') {
        const stdins = s.tests.map((t) => t.stdin || '');
        const sol = await exec(judgedSource(s, s.solution), stdins);
        if (sol.error) fail(`solution does not compile: ${sol.error}`);
        else
          sol.runs.forEach((r, j) => {
            if (r.exitCode !== 0) fail(`solution crashes on test "${s.tests[j].name}": ${r.stderr.trim()}`);
            else if (normOutput(r.stdout) !== normOutput(s.tests[j].stdout))
              fail(`solution prints ${show(r.stdout)} on test "${s.tests[j].name}", expected ${show(s.tests[j].stdout)}`);
          });
        const st = await exec(judgedSource(s, s.starter), stdins);
        if (st.error) fail(`starter does not compile: ${st.error}`);
        else if (st.runs.every((r, j) => r.exitCode === 0 && normOutput(r.stdout) === normOutput(s.tests[j].stdout))) fail('starter already passes every test');
      }
    }
    console.log(`  ${bad ? 'FAIL' : 'ok  '} ${key}`);
  }
}

console.log(`\n${programs} programs compiled.`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('learn-next-java: every example, predict and exercise checks out');
