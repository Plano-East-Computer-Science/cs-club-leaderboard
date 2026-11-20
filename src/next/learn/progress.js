/**
 * Lesson progress. Always kept in localStorage (`next:learn`) so signed-out
 * students keep their place; pushed to /api/lessons/progress when signed in.
 *
 *   { lessons: { 'apcsa/variables': { step, done, at } }, last: 'apcsa/variables' }
 *
 * getContinue() is for the Home page: the lesson a student should open next.
 * It loads the course content lazily, so importing this file stays cheap.
 */
import { api } from '../../lib/api.js';

const KEY = 'next:learn';
const codeKey = (course, lesson, step) => `next:learn:code:${course}/${lesson}/${step}`;

export function readProgress() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v === 'object' && v.lessons) return v;
  } catch {
    /* private mode or bad JSON: start fresh */
  }
  return { lessons: {}, last: null };
}

function write(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked: progress just is not kept */
  }
}

export const lessonState = (p, course, lesson) => p.lessons[`${course}/${lesson}`] || null;

/** Remembers where a student is. `done` is sticky. Syncs when `signedIn`. */
export function saveStep(course, lesson, step, { done = false, signedIn = false } = {}) {
  const p = readProgress();
  const k = `${course}/${lesson}`;
  const was = p.lessons[k];
  p.lessons[k] = { step, done: Boolean(was?.done || done), at: Date.now() };
  p.last = k;
  write(p);
  if (signedIn) api.post('/lessons/progress', { course, lesson, step, done: p.lessons[k].done }).catch(() => {});
  return p;
}

/**
 * After sign-in: merge the server's rows into local progress and send up
 * anything only this browser knows. Unknown lessons (content changed) are
 * dropped by the server, so the push is best effort.
 */
export async function syncProgress() {
  const { progress } = await api.get('/lessons/progress');
  const p = readProgress();
  const server = new Map(progress.map((r) => [`${r.course}/${r.lesson}`, r]));
  for (const [k, r] of server) {
    const mine = p.lessons[k];
    p.lessons[k] = { step: mine?.step ?? r.step, done: Boolean(mine?.done || r.done), at: mine?.at ?? 0 };
  }
  write(p);
  const push = Object.entries(p.lessons)
    .filter(([k, v]) => !server.has(k) || server.get(k).done !== v.done || server.get(k).step !== v.step)
    .map(([k, v]) => {
      const [course, lesson] = k.split('/');
      return { course, lesson, step: v.step, done: v.done };
    })
    .slice(0, 100);
  if (push.length) await api.post('/lessons/progress', { items: push }).catch(() => {});
  return p;
}

export function loadCode(course, lesson, step) {
  try {
    return localStorage.getItem(codeKey(course, lesson, step));
  } catch {
    return null;
  }
}
export function saveCode(course, lesson, step, code) {
  try {
    localStorage.setItem(codeKey(course, lesson, step), code);
  } catch {
    /* ignore */
  }
}

/**
 * The next lesson for this student, given ordered lessons and progress:
 * the last lesson they opened if unfinished, else the first unfinished lesson
 * after it, else the first unfinished one anywhere. null when all are done.
 * Pure, so it can be tested; `lessons` is [{ key, ... }].
 */
export function pickNext(lessons, p) {
  const isDone = (l) => p.lessons[l.key]?.done;
  const at = lessons.findIndex((l) => l.key === p.last);
  if (at >= 0 && !isDone(lessons[at])) return lessons[at];
  return lessons.slice(at + 1).find((l) => !isDone(l)) || lessons.find((l) => !isDone(l)) || null;
}

/**
 * For Home: { course, courseTitle, lesson, title, unitTitle, href, started, step, steps, done, total } or null.
 * Starts from the course the student last worked in (AP CSA by default).
 */
export async function getContinue() {
  const { COURSES } = await import('../../../shared/next/learn/courses/index.js');
  const p = readProgress();
  const courseId = p.last?.split('/')[0];
  const course = COURSES.find((c) => c.id === courseId) || COURSES[0];
  const lessons = course.units.flatMap((u) => u.lessons.map((l) => ({ key: `${course.id}/${l.id}`, l, u })));
  const next = pickNext(lessons, p);
  if (!next) return null;
  const st = p.lessons[next.key];
  return {
    course: course.id,
    courseTitle: course.title,
    lesson: next.l.id,
    title: next.l.title,
    unitTitle: next.u.title,
    href: `/learn/${course.id}/${next.l.id}`,
    started: Boolean(st),
    step: st?.step ?? 0,
    steps: next.l.steps.length,
    done: lessons.filter((x) => p.lessons[x.key]?.done).length,
    total: lessons.length,
  };
}
