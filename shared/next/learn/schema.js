/**
 * Lesson content schema for the Learn area of the `next` site.
 *
 * A course is plain data in shared/next/learn/courses/<course>.js. The lesson
 * player (src/next/learn/) renders it; the server only reads ids from it.
 * `validateCourse(course)` below is run over every course by
 * test/learn-next.test.js, and test/learn-next-java.js compiles and runs every
 * piece of code in it. docs/next-lessons.md is the authoring guide.
 *
 * Course
 *   { id, title, blurb, lang: 'java' | 'python', level, units: Unit[] }
 *   id is the URL slug (/learn/<id>): lowercase letters, digits and dashes.
 *
 * Unit
 *   { id, title, blurb, lessons: Lesson[] }
 *
 * Lesson
 *   { id, title, minutes, summary, topics?: string[], kind?: 'lesson' | 'frq', steps: Step[] }
 *   id is the URL slug (/learn/<course>/<id>), unique in the course.
 *   summary is one sentence. topics are the framework topic numbers ('1.2').
 *   A normal lesson has 8 to 15 steps, starts with `explain`, ends with
 *   `recap`, and has at least one example, one predict, two checks and one
 *   exercise. An 'frq' lesson (free-response practice) has 3 to 15 steps, an
 *   explain, a recap, and at least one exercise whose every test names the
 *   rubric point it checks.
 *
 * Step (every step has `kind`; `title` is optional on all of them)
 *   explain   { body, diagram? }
 *   example   { body?, code, output, stdin?, editable? }
 *             Runnable code. `output` is exactly what it prints. Add
 *             `crashes: true` (example or predict) when the point is the crash;
 *             `output` is then what prints before it.
 *   predict   { body?, code, output, choices?, explain }
 *             The student commits to a guess, then sees it run. With
 *             `choices` (2 to 5 strings, one equal to `output`) it is multiple
 *             choice; without, the student types the output.
 *   check     { prompt, code?, options } or { prompt, code?, answer, why }
 *             options: 2 to 5 of { text, correct?: true, why }, exactly one
 *             correct; every option's `why` explains why it is right or wrong.
 *             answer: a short typed answer (string or list of accepted
 *             strings, compared case-insensitively, spaces ignored).
 *             `code` is shown, never run.
 *   exercise  { body, starter, solution, tests, hints, harness? }
 *             tests: 1 or more of { name, stdout, stdin?, rubric? }.
 *             The program judged is the student's code, plus `harness` (a
 *             non-public class with main, for "write this method" tasks)
 *             when given. `solution` must pass every test and `starter`
 *             must compile and fail at least one. hints: 1 to 3, gentlest
 *             first.
 *   recap     { takeaways, mistakes }   two or more takeaways, one or more mistakes.
 *
 * Text fields marked body/prompt/why/explain/hints/takeaways/mistakes/text
 * are markdown, the small subset in src/next/learn/Markdown.jsx: paragraphs,
 * **bold**, *italic*, `code`, "- " and "1. " lists, "### " headings and
 * ```java fenced blocks.
 *
 * Diagram (on explain steps)
 *   { type: 'vars', vars: [{ name, type?, value }] }               boxes in memory
 *   { type: 'refs', vars: [{ name, type?, value?, to? }],
 *                   objects: [{ id, type, fields: [{ name, value }] }] }
 *                   a variable with `to` points at the object with that id
 *   { type: 'array', name?, values: [], highlight?: [index] }
 *   { type: 'grid', name?, rows: [[]], highlight?: [[row, col]] }
 *   { type: 'trace', columns: [], rows: [[]] }                      a tracing table
 *   Every diagram may have a `caption`.
 */

export const STEP_KINDS = ['explain', 'example', 'predict', 'check', 'exercise', 'recap'];
const DIAGRAMS = ['vars', 'refs', 'array', 'grid', 'trace'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const str = (v) => typeof v === 'string' && v.trim().length > 0;
const list = (v) => Array.isArray(v);

/** Output comparison used everywhere: Windows newlines and trailing whitespace do not count. */
export const normOutput = (s) =>
  String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trimEnd();

/** Short typed answers: case and spaces do not count. */
export const normAnswer = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');

/** The program an exercise judges: the student's code plus the hidden harness. */
export const judgedSource = (step, code) => (step.harness ? `${code}\n\n${step.harness}\n` : code);

function validateDiagram(d, at, errs) {
  if (!d || !DIAGRAMS.includes(d.type)) return errs.push(`${at}: diagram type must be one of ${DIAGRAMS.join(', ')}`);
  if (d.type === 'vars' && !(list(d.vars) && d.vars.every((v) => str(v.name)))) errs.push(`${at}: vars diagram needs vars with names`);
  if (d.type === 'refs') {
    if (!list(d.vars) || !list(d.objects)) return errs.push(`${at}: refs diagram needs vars and objects`);
    const ids = new Set(d.objects.map((o) => o.id));
    for (const v of d.vars) if (v.to != null && !ids.has(v.to)) errs.push(`${at}: ${v.name} points at missing object ${v.to}`);
  }
  if (d.type === 'array' && !list(d.values)) errs.push(`${at}: array diagram needs values`);
  if (d.type === 'grid' && !(list(d.rows) && d.rows.every(list))) errs.push(`${at}: grid diagram needs rows`);
  if (d.type === 'trace' && !(list(d.columns) && list(d.rows) && d.rows.every((r) => list(r) && r.length === d.columns.length)))
    errs.push(`${at}: trace rows must match columns`);
}

function validateStep(s, at, errs, frq) {
  if (!s || !STEP_KINDS.includes(s.kind)) return errs.push(`${at}: kind must be one of ${STEP_KINDS.join(', ')}`);
  switch (s.kind) {
    case 'explain':
      if (!str(s.body)) errs.push(`${at}: explain needs a body`);
      if (s.diagram) validateDiagram(s.diagram, at, errs);
      break;
    case 'example':
      if (!str(s.code)) errs.push(`${at}: example needs code`);
      if (typeof s.output !== 'string') errs.push(`${at}: example needs the exact output`);
      break;
    case 'predict':
      if (!str(s.code)) errs.push(`${at}: predict needs code`);
      if (typeof s.output !== 'string') errs.push(`${at}: predict needs the exact output`);
      if (!str(s.explain)) errs.push(`${at}: predict needs an explanation`);
      if (s.choices != null) {
        if (!list(s.choices) || s.choices.length < 2 || s.choices.length > 5) errs.push(`${at}: predict needs 2 to 5 choices`);
        else {
          const hits = s.choices.filter((c) => normOutput(c) === normOutput(s.output)).length;
          if (hits !== 1) errs.push(`${at}: exactly one choice must equal the output (found ${hits})`);
          if (new Set(s.choices.map(normOutput)).size !== s.choices.length) errs.push(`${at}: choices repeat`);
        }
      }
      break;
    case 'check':
      if (!str(s.prompt)) errs.push(`${at}: check needs a prompt`);
      if (s.options) {
        if (!list(s.options) || s.options.length < 2 || s.options.length > 5) errs.push(`${at}: check needs 2 to 5 options`);
        else {
          if (s.options.filter((o) => o.correct === true).length !== 1) errs.push(`${at}: check needs exactly one correct option`);
          s.options.forEach((o, i) => {
            if (!str(o.text)) errs.push(`${at}: option ${i} needs text`);
            if (!str(o.why)) errs.push(`${at}: option ${i} needs a why`);
          });
        }
      } else {
        const answers = list(s.answer) ? s.answer : [s.answer];
        if (!answers.length || !answers.every(str)) errs.push(`${at}: check needs options or an answer`);
        if (!str(s.why)) errs.push(`${at}: a typed check needs a why`);
      }
      break;
    case 'exercise':
      if (!str(s.body)) errs.push(`${at}: exercise needs a body`);
      if (typeof s.starter !== 'string') errs.push(`${at}: exercise needs starter code`);
      if (!str(s.solution)) errs.push(`${at}: exercise needs a reference solution`);
      if (!list(s.tests) || s.tests.length < 1) errs.push(`${at}: exercise needs at least one test`);
      else
        s.tests.forEach((t, i) => {
          if (!str(t.name)) errs.push(`${at}: test ${i} needs a name`);
          if (typeof t.stdout !== 'string') errs.push(`${at}: test ${i} needs stdout`);
          if (frq && !str(t.rubric)) errs.push(`${at}: FRQ test ${i} needs the rubric point it checks`);
        });
      if (!list(s.hints) || s.hints.length < 1 || s.hints.length > 3 || !s.hints.every(str)) errs.push(`${at}: exercise needs 1 to 3 hints`);
      if (s.harness != null && (!str(s.harness) || /\bpublic\s+class\b/.test(s.harness))) errs.push(`${at}: harness must be a non-public class`);
      break;
    case 'recap':
      if (!list(s.takeaways) || s.takeaways.length < 2 || !s.takeaways.every(str)) errs.push(`${at}: recap needs two or more takeaways`);
      if (!list(s.mistakes) || s.mistakes.length < 1 || !s.mistakes.every(str)) errs.push(`${at}: recap needs one or more mistakes`);
      break;
  }
}

/** Every rule a lesson must meet. Returns readable error strings (empty when valid). */
export function validateLesson(lesson, at = lesson?.id || 'lesson') {
  const errs = [];
  if (!lesson || !SLUG.test(lesson.id || '')) return [`${at}: id must be a lowercase slug`];
  if (!str(lesson.title)) errs.push(`${at}: needs a title`);
  if (!str(lesson.summary)) errs.push(`${at}: needs a one-sentence summary`);
  if (!(Number.isInteger(lesson.minutes) && lesson.minutes > 0)) errs.push(`${at}: minutes must be a positive integer`);
  const frq = lesson.kind === 'frq';
  if (lesson.kind != null && lesson.kind !== 'lesson' && !frq) errs.push(`${at}: kind must be lesson or frq`);
  const steps = list(lesson.steps) ? lesson.steps : [];
  steps.forEach((s, i) => validateStep(s, `${at} step ${i + 1}`, errs, frq));
  const n = (k) => steps.filter((s) => s?.kind === k).length;
  const [min, max] = frq ? [3, 15] : [8, 15];
  if (steps.length < min || steps.length > max) errs.push(`${at}: needs ${min} to ${max} steps (has ${steps.length})`);
  if (steps.at(-1)?.kind !== 'recap') errs.push(`${at}: last step must be a recap`);
  if (frq) {
    if (n('explain') < 1) errs.push(`${at}: needs an explain step`);
    if (n('exercise') < 1) errs.push(`${at}: needs an exercise`);
  } else {
    if (steps[0]?.kind !== 'explain') errs.push(`${at}: first step must be explain`);
    if (n('example') < 1) errs.push(`${at}: needs a runnable example`);
    if (n('predict') < 1) errs.push(`${at}: needs a predict step`);
    if (n('check') < 2) errs.push(`${at}: needs two checks`);
    if (n('exercise') < 1) errs.push(`${at}: needs a judged exercise`);
  }
  return errs;
}

export function validateCourse(course) {
  const errs = [];
  if (!course || !SLUG.test(course.id || '')) return ['course: id must be a lowercase slug'];
  const at = course.id;
  if (!str(course.title) || !str(course.blurb)) errs.push(`${at}: needs a title and blurb`);
  if (!['java', 'python'].includes(course.lang)) errs.push(`${at}: lang must be java or python`);
  if (!list(course.units) || !course.units.length) return [...errs, `${at}: needs units`];
  const unitIds = new Set();
  const lessonIds = new Set();
  for (const u of course.units) {
    if (!SLUG.test(u?.id || '')) errs.push(`${at}: unit id must be a slug`);
    else if (unitIds.has(u.id)) errs.push(`${at}: unit id ${u.id} repeats`);
    unitIds.add(u?.id);
    if (!str(u?.title)) errs.push(`${at}/${u?.id}: unit needs a title`);
    if (!list(u?.lessons) || !u.lessons.length) errs.push(`${at}/${u?.id}: unit needs lessons`);
    for (const l of u?.lessons || []) {
      if (lessonIds.has(l?.id)) errs.push(`${at}: lesson id ${l.id} repeats`);
      lessonIds.add(l?.id);
      errs.push(...validateLesson(l, `${at}/${l?.id}`));
    }
  }
  return errs;
}

/** Lessons in course order, each with its unit. */
export const lessonsOf = (course) => course.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u })));
