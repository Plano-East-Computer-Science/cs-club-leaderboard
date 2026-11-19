/**
 * Duel packs (V3-B): checks every problem under scripts/packs/<pack>/ and
 * writes worker/seed-packs.sql. Needs python and a JDK (javac, java) on PATH.
 *
 *   node scripts/packs/build.mjs            check everything, then write the SQL
 *   node scripts/packs/build.mjs --check    check only, write nothing
 *   node scripts/packs/build.mjs --only=box-score,next-bus   check just these
 *   node scripts/packs/build.mjs --pyodide  also time sol.py on each biggest case in
 *                                           Pyodide, the runtime the browser judge uses
 *
 * A pack folder has pack.json (set slug, title, which problem plays where, and
 * per problem its title, level and number of samples) and one folder per problem:
 *   statement.md   prose, input, output, constraints (samples are added from the cases)
 *   gen.py         prints {"cases": [stdin, ...], "fuzz": [stdin, ...]}; samples first.
 *                  fuzz inputs are only for checking and are not stored.
 *   sol.py         reference solution, Python (stored as the problem's solution)
 *   Main.java      reference solution, Java; must print exactly what sol.py prints
 *   naive.py       optional: the obvious slow way. Must agree wherever it finishes;
 *                  its time on the biggest case shows whether speed matters.
 *   starter.py, Starter.java   what a student starts from; must run and compile
 *
 * The SQL is INSERT OR IGNORE, so it never overwrites a problem an officer edited.
 * D1 refuses statements over 100 KB, so big cases are appended in pieces by
 * guarded UPDATEs that only fire on an untouched seed row at the right length.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'worker', 'seed-packs.sql');
const PACKS = ['pack-1', 'pack-2'];
const DIVS = ['new', 'comfortable', 'contest'];
const SEEDER = 'pack-seed';
const MAX_PROBLEM_JSON = 210_000; // the brief: keep each problem's cases around 200 KB
const STMT_BUDGET = 80_000; // under D1's 100 KB statement limit, with room for the rest of the row
const CHUNK = 60_000;

const args = new Set(process.argv.slice(2));
// --only=a,b checks just those problems and writes nothing (while writing a new one).
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
if (only) args.add('--check');
const PY = ['python', 'python3', 'py'].find((b) => spawnSync(b, ['--version']).status === 0);
if (!PY) throw new Error('python not found');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-'));

const norm = (s) => s.replace(/\r\n/g, '\n');

/** Runs a command with stdin; resolves { code, out, err, ms, timedOut }. */
function run(cmd, argv, input, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const p = spawn(cmd, argv, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      p.kill('SIGKILL');
    }, timeoutMs);
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out: norm(Buffer.concat(out).toString('utf8')), err: Buffer.concat(err).toString('utf8'), ms: performance.now() - t0, timedOut });
    });
    p.stdin.on('error', () => {}); // a program that exits without reading its input
    p.stdin.end(input);
  });
}

/** Runs jobs with a few at a time. */
async function pool(jobs, n = Math.max(2, Math.floor(os.cpus().length / 2))) {
  const out = new Array(jobs.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < jobs.length) {
      const k = i++;
      out[k] = await jobs[k]();
    }
  }));
  return out;
}

function javac(src, dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, path.join(dir, 'Main.java'));
  const r = spawnSync('javac', ['-encoding', 'UTF-8', '-d', dir, path.join(dir, 'Main.java')], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`javac ${src}:\n${r.stderr}`);
}

const fail = (slug, msg) => {
  throw new Error(`${slug}: ${msg}`);
};

const fence = (s) => ['```', s.replace(/\n$/, ''), '```'].join('\n');

async function checkProblem(packSlug, slug, meta) {
  const dir = path.join(HERE, packSlug, slug);
  const file = (f) => path.join(dir, f);
  const gen = spawnSync(PY, [file('gen.py')], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (gen.status !== 0) fail(slug, `gen.py failed: ${gen.stderr}`);
  const { cases: inputs, fuzz = [] } = JSON.parse(gen.stdout);
  if (inputs.length < meta.samples + 8) fail(slug, `needs ${meta.samples} samples and at least 8 hidden cases, has ${inputs.length}`);
  for (const s of [...inputs, ...fuzz]) if (!s.endsWith('\n') || /[ \t]\n/.test(s) || s.includes('\r')) fail(slug, 'every input line ends in \\n with no trailing spaces');

  const ref = path.join(TMP, packSlug, slug, 'ref');
  javac(file('Main.java'), ref);
  const all = [...inputs, ...fuzz];
  const hasNaive = fs.existsSync(file('naive.py'));
  const results = await pool(all.flatMap((stdin, i) => [
    () => run(PY, [file('sol.py')], stdin).then((r) => ({ i, who: 'py', r })),
    () => run('java', ['-Xss64m', '-cp', ref, 'Main'], stdin).then((r) => ({ i, who: 'java', r })),
    ...(hasNaive ? [() => run(PY, [file('naive.py')], stdin, 6_000).then((r) => ({ i, who: 'naive', r }))] : []),
  ]));
  const by = (who, i) => results.find((x) => x.who === who && x.i === i).r;

  const cases = [];
  let naiveDone = 0;
  for (let i = 0; i < all.length; i++) {
    const py = by('py', i);
    const jv = by('java', i);
    const tag = i < inputs.length ? `case ${i + 1}` : `fuzz ${i - inputs.length + 1}`;
    if (py.code !== 0 || py.timedOut) fail(slug, `sol.py ${tag}: ${py.err || 'timed out'}`);
    if (jv.code !== 0 || jv.timedOut) fail(slug, `Main.java ${tag}: ${jv.err || 'timed out'}`);
    if (py.out !== jv.out) fail(slug, `Python and Java disagree on ${tag}`);
    const expected = py.out.trimEnd();
    if (!expected) fail(slug, `${tag}: empty output`);
    if (/[ \t]\n/.test(expected)) fail(slug, `${tag}: trailing space in the expected output`);
    if (hasNaive) {
      const nv = by('naive', i);
      if (!nv.timedOut) {
        if (nv.code !== 0) fail(slug, `naive.py ${tag}: ${nv.err}`);
        if (nv.out.trimEnd() !== expected) fail(slug, `naive.py disagrees on ${tag}`);
        naiveDone++;
      }
    }
    if (i < inputs.length) cases.push({ stdin: inputs[i], stdout: expected });
  }

  // Starters: run and compile, and do not already solve the first sample.
  const st = await run(PY, [file('starter.py')], inputs[0]);
  if (st.code !== 0) fail(slug, `starter.py crashes on sample 1: ${st.err}`);
  if (st.out.trimEnd() === cases[0].stdout) fail(slug, 'starter.py already solves sample 1');
  javac(file('Starter.java'), path.join(TMP, packSlug, slug, 'starter'));
  const sj = await run('java', ['-cp', path.join(TMP, packSlug, slug, 'starter'), 'Main'], inputs[0]);
  if (sj.code !== 0) fail(slug, `Starter.java crashes on sample 1: ${sj.err}`);

  // Timing on the biggest input, one program at a time so the numbers mean something.
  const big = inputs.reduce((b, s, i) => (s.length > inputs[b].length ? i : b), 0);
  const tPy = await run(PY, [file('sol.py')], inputs[big]);
  const tJava = await run('java', ['-cp', ref, 'Main'], inputs[big]);
  const tNaive = hasNaive ? await run(PY, [file('naive.py')], inputs[big], 20_000) : null;

  const json = JSON.stringify(cases);
  if (json.length > MAX_PROBLEM_JSON) fail(slug, `cases are ${json.length} characters, over ${MAX_PROBLEM_JSON}`);

  const samples = cases.slice(0, meta.samples);
  const statement = fs.readFileSync(file('statement.md'), 'utf8').replace(/\r\n/g, '\n').trim();
  const body = [
    statement,
    ...samples.flatMap((c, i) => {
      const n = samples.length > 1 ? ` ${i + 1}` : '';
      return [`## Sample input${n}`, fence(c.stdin), `## Sample output${n}`, fence(c.stdout)];
    }),
  ].join('\n\n');

  return {
    slug,
    title: meta.title,
    difficulty: meta.difficulty,
    body,
    starter: JSON.stringify({ java: fs.readFileSync(file('Starter.java'), 'utf8').replace(/\r\n/g, '\n'), python: fs.readFileSync(file('starter.py'), 'utf8').replace(/\r\n/g, '\n') }),
    solution: fs.readFileSync(file('sol.py'), 'utf8').replace(/\r\n/g, '\n'),
    cases,
    report: {
      cases: cases.length,
      fuzz: fuzz.length,
      kb: Math.round(json.length / 1024),
      bigN: inputs[big].length,
      py: Math.round(tPy.ms),
      java: Math.round(tJava.ms),
      naive: tNaive ? (tNaive.timedOut ? '>20s' : `${Math.round(tNaive.ms)}`) : '-',
      naiveAgreed: hasNaive ? `${naiveDone}/${all.length}` : '-',
    },
    bigInput: inputs[big],
  };
}

/* ----------------------------------- SQL ----------------------------------- */

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const COLS = ['slug', 'title', 'body', 'difficulty', 'tags', 'starter', 'cases', 'solution', 'source_url', 'status', 'created_by'];

function problemSql(p, tags) {
  const guard = (extra) => `WHERE slug = ${q(p.slug)} AND created_by = '${SEEDER}' AND updated_at = created_at AND ${extra}`;
  const row = (cases) => ({ ...p, tags, cases: JSON.stringify(cases), source_url: '', status: 'live', created_by: SEEDER });
  const insert = (cases) => {
    const r = row(cases);
    return `INSERT OR IGNORE INTO problems (${COLS.join(', ')}) VALUES (${COLS.map((c) => (c === 'difficulty' ? r[c] : q(r[c]))).join(', ')});`;
  };
  // As many cases as fit in the INSERT; the rest are appended.
  let k = 0;
  while (k < p.cases.length && insert(p.cases.slice(0, k + 1)).length < STMT_BUDGET) k++;
  const out = [insert(p.cases.slice(0, k))];
  for (let i = k; i < p.cases.length; i++) {
    out.push(`UPDATE problems SET cases = json_insert(cases, '$[#]', json_object('stdin', '', 'stdout', '')) ${guard(`json_array_length(cases) = ${i}`)};`);
    for (const field of ['stdin', 'stdout']) {
      const text = p.cases[i][field];
      for (let off = 0; off < text.length; off += CHUNK) {
        const at = `'$[${i}].${field}'`;
        out.push(
          `UPDATE problems SET cases = json_set(cases, ${at}, json_extract(cases, ${at}) || ${q(text.slice(off, off + CHUNK))}) ` +
            `${guard(`json_array_length(cases) = ${i + 1} AND length(json_extract(cases, ${at})) = ${off}`)};`
        );
      }
    }
  }
  for (const s of out) if (Buffer.byteLength(s) > 95_000) throw new Error(`${p.slug}: a statement is ${Buffer.byteLength(s)} bytes`);
  return out;
}

/* ---------------------------------- main ---------------------------------- */

const problems = [];
const sets = [];
const reports = [];
for (const packSlug of PACKS) {
  const pack = JSON.parse(fs.readFileSync(path.join(HERE, packSlug, 'pack.json'), 'utf8'));
  const order = [pack.practice, ...DIVS.flatMap((d) => pack[d]), pack.final].filter(Boolean);
  if (new Set(order).size !== order.length) throw new Error(`${packSlug}: a problem is listed twice`);
  for (const slug of order) {
    if (only && !only.includes(slug)) continue;
    const meta = pack.problems[slug];
    if (!meta) throw new Error(`${packSlug}: no meta for ${slug}`);
    process.stdout.write(`checking ${slug} ... `);
    const p = await checkProblem(packSlug, slug, meta);
    console.log('ok');
    problems.push({ p, tags: `duel,${pack.slug}` });
    reports.push({ pack: pack.slug, slug, level: meta.difficulty, ...p.report });
  }
  sets.push({
    slug: pack.slug,
    title: pack.title,
    body: { practice: pack.practice, new: pack.new, comfortable: pack.comfortable, contest: pack.contest, final: pack.final ?? null },
  });
}

console.table(reports);

if (args.has('--pyodide')) {
  const { loadPyodide } = await import('pyodide');
  const py = await loadPyodide();
  // Same harness as src/lib/py.worker.js: stdin is a StringIO, as in the browser.
  py.runPython(`
import sys, io, json
def _run(code, stdin):
    out, err = io.StringIO(), io.StringIO()
    o, e, i = sys.stdout, sys.stderr, sys.stdin
    sys.stdout, sys.stderr, sys.stdin = out, err, io.StringIO(stdin)
    try:
        exec(compile(code, 'sol.py', 'exec'), {'__name__': '__main__'})
    except BaseException as x:
        err.write(repr(x))
    finally:
        sys.stdout, sys.stderr, sys.stdin = o, e, i
    return json.dumps([out.getvalue(), err.getvalue()])
`);
  const runPy = py.globals.get('_run');
  const rows = [];
  for (const { p } of problems) {
    const big = p.cases.reduce((b, c) => (c.stdin.length > b.stdin.length ? c : b));
    const t0 = performance.now();
    const [out, err] = JSON.parse(runPy(p.solution, big.stdin));
    const ms = Math.round(performance.now() - t0);
    if (err || out.trimEnd() !== big.stdout) throw new Error(`${p.slug}: Pyodide run differs ${err}`);
    rows.push({ slug: p.slug, pyodideMs: ms });
  }
  console.table(rows);
}

if (!args.has('--check')) {
  const lines = [
    '-- GENERATED FILE -- edit scripts/packs/ and run `node scripts/packs/build.mjs`.',
    '-- Duel Packs 1 and 2 (V3-B). Safe to re-run: existing slugs are left alone, and the',
    '-- pieces of big cases only append to an untouched seed row at the expected length.',
    ...problems.flatMap(({ p, tags }) => problemSql(p, tags)),
    ...sets.map(
      (s) => `INSERT OR IGNORE INTO problem_sets (slug, kind, title, body, status, created_by) VALUES (${q(s.slug)}, 'duel', ${q(s.title)}, ${q(JSON.stringify(s.body))}, 'live', '${SEEDER}');`
    ),
    '',
  ];
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`wrote ${problems.length} problems and ${sets.length} sets to ${path.relative(ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
}
fs.rmSync(TMP, { recursive: true, force: true });
