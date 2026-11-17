/**
 * Turns every `kind: 'code'` step in shared/courses.js (and shared/courses/*.js,
 * which it re-exports) into a row for the problem bank.
 *
 * Run:  npm run build:problems   then   npm run db:problems:local
 * INSERT OR IGNORE keeps it safe to re-run: problems an officer has already
 * edited in the database are never overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSES } from '../shared/courses.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'worker', 'seed-problems.sql');

// Guess from the course level; officers refine it in the editor.
const LEVEL = { Beginner: 1, 'Beginner-Intermediate': 2, Intermediate: 3, Advanced: 4 };

/** -> problem rows in the shape the table (and validateProblem) uses. */
export function buildProblems(courses = COURSES) {
  const rows = [];
  for (const course of courses) {
    for (const step of course.steps.filter((s) => s.kind === 'code')) {
      rows.push({
        slug: `${course.slug}-${step.id}`,
        title: step.title,
        body: step.body || '',
        difficulty: LEVEL[course.level] ?? 2,
        tags: course.track,
        starter: step.starter || '',
        cases: JSON.stringify(step.cases.map(({ stdin, stdout }) => ({ stdin, stdout }))),
        solution: step.solution,
        source_url: '',
        status: 'live',
        created_by: 'import',
      });
    }
  }
  return rows;
}

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

export function toSql(rows) {
  const cols = ['slug', 'title', 'body', 'difficulty', 'tags', 'starter', 'cases', 'solution', 'source_url', 'status', 'created_by'];
  return [
    '-- GENERATED FILE -- edit shared/courses*.js and run `npm run build:problems`.',
    '-- Safe to re-run: existing slugs are left alone.',
    ...rows.map((r) => `INSERT OR IGNORE INTO problems (${cols.join(', ')}) VALUES (${cols.map((c) => (c === 'difficulty' ? r[c] : q(r[c]))).join(', ')});`),
    '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = buildProblems();
  fs.writeFileSync(OUT, toSql(rows));
  console.log(`wrote ${rows.length} problems to ${path.relative(ROOT, OUT)}`);
}
