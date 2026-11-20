/**
 * /learn/:course/:lesson. One step at a time, a segmented progress bar, Back
 * and Continue. A lesson is done when its exercise passes (or, with no
 * exercise, when every check has been answered).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from '@phosphor-icons/react';

import { Button, useSession } from '../../ui/index.js';
import { warmUp } from '../../lib/run/index.js';
import { findLesson } from '../../../shared/next/learn/courses/index.js';
import { lessonsOf } from '../../../shared/next/learn/schema.js';
import { readProgress, lessonState, saveStep, saveCode, loadCode, syncProgress } from './progress.js';
import { ExplainStep, ExampleStep, PredictStep, CheckStep, ExerciseStep, RecapStep, STEP_TITLE, stepReady } from './Steps.jsx';
import './learn.css';

const BODY = { explain: ExplainStep, example: ExampleStep, predict: PredictStep, check: CheckStep, exercise: ExerciseStep, recap: RecapStep };

let synced = false;

export default function Player() {
  const { course: courseId, lesson: lessonId } = useParams();
  const found = findLesson(courseId, lessonId);
  if (!found) return <Navigate to={`/learn/${courseId}`} replace />;
  return <Lesson key={`${courseId}/${lessonId}`} {...found} />;
}

function Lesson({ course, unit, lesson }) {
  const { user } = useSession();
  const nav = useNavigate();
  const steps = lesson.steps;
  const saved = lessonState(readProgress(), course.id, lesson.id);
  const [i, setI] = useState(() => (saved && !saved.done ? Math.min(saved.step, steps.length - 1) : 0));
  const [done, setDone] = useState(Boolean(saved?.done));
  const [state, setState] = useState(() =>
    steps.map((s, n) => {
      const code = s.kind === 'exercise' ? loadCode(course.id, lesson.id, n) : null;
      return code != null ? { code } : {};
    })
  );
  const heading = useRef(null);
  const first = useRef(true);

  const all = lessonsOf(course);
  const at = all.findIndex((l) => l.id === lesson.id);
  const next = all[at + 1];

  useEffect(() => {
    document.title = `${lesson.title} | Learn`;
    document.body.dataset.lrFocus = '1';
    if (course.lang === 'java') warmUp('java');
    return () => delete document.body.dataset.lrFocus;
  }, [lesson.title, course.lang]);

  useEffect(() => {
    if (user && !synced) {
      synced = true;
      syncProgress().catch(() => (synced = false));
    }
  }, [user]);

  // Remember the step; move focus to the new step's heading (not on first load).
  useEffect(() => {
    saveStep(course.id, lesson.id, i, { signedIn: Boolean(user) });
    if (first.current) first.current = false;
    else {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
    // user is read at save time only; a sign-in mid-lesson syncs through syncProgress
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, course.id, lesson.id]);

  const set = useCallback((n) => (patch) => setState((prev) => prev.map((x, j) => (j === n ? { ...x, ...patch } : x))), []);

  const finish = useCallback(() => {
    setDone(true);
    saveStep(course.id, lesson.id, i, { done: true, signedIn: Boolean(user) });
  }, [course.id, lesson.id, i, user]);

  // No exercise: answering every check finishes the lesson.
  const hasExercise = steps.some((s) => s.kind === 'exercise');
  useEffect(() => {
    if (!done && !hasExercise && steps.every((s, n) => s.kind !== 'check' || state[n].answered)) finish();
  }, [state, done, hasExercise, steps, finish]);

  const s = steps[i];
  const st = state[i];
  const Body = BODY[s.kind];
  const last = i === steps.length - 1;
  const ready = stepReady(s, st);
  const exerciseAt = steps.findIndex((x) => x.kind === 'exercise');

  const forward = () => {
    if (!last) setI(i + 1);
    else nav(next ? `/learn/${course.id}/${next.id}` : `/learn/${course.id}`);
  };

  return (
    <div className="lr lr-player">
      <header className="lr-bar">
        <Link to={`/learn/${course.id}`} className="lr-bar__back">
          <ArrowLeft size={18} aria-hidden="true" />
          <span>{course.title}</span>
        </Link>
        <span className="lr-bar__count" aria-hidden="true">{i + 1} / {steps.length}</span>
      </header>
      <div
        className="lr-progress"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={i + 1}
        aria-valuetext={`Step ${i + 1} of ${steps.length}`}
      >
        {steps.map((x, n) => (
          <button
            key={n}
            type="button"
            className={`lr-progress__seg${n < i ? ' is-past' : ''}${n === i ? ' is-now' : ''}`}
            aria-label={`Go to step ${n + 1}: ${x.title || STEP_TITLE[x.kind]}`}
            disabled={n > i && !done}
            onClick={() => setI(n)}
          />
        ))}
      </div>

      <div className="lr-stage">
        <p className="lr-lesson-name" title={unit.title}>{lesson.title}</p>
        <article className="lr-step" key={i}>
          <h1 className="lr-step__title" tabIndex={-1} ref={heading}>{s.title || STEP_TITLE[s.kind]}</h1>
          <Body
            s={s}
            st={st}
            set={set(i)}
            lang={course.lang}
            onPass={finish}
            saveDraft={(code) => saveCode(course.id, lesson.id, i, code)}
          />
          {last && (
            <div className={`lr-finish${done ? ' is-done' : ''}`}>
              {done ? (
                <p><CheckCircle size={22} weight="fill" aria-hidden="true" /> Lesson complete. {next ? `Next up: ${next.title}.` : 'That was the last lesson in this course.'}</p>
              ) : (
                <>
                  <p>One thing left: pass the exercise to finish this lesson.</p>
                  {exerciseAt >= 0 && <Button onClick={() => setI(exerciseAt)}>Go to the exercise</Button>}
                </>
              )}
            </div>
          )}
        </article>
      </div>

      <nav className="lr-nav" aria-label="Lesson steps">
        <div className="lr-nav__in">
          <Button variant="ghost" onClick={() => setI(i - 1)} disabled={i === 0}>Back</Button>
          {!ready && <span className="lr-nav__why">{s.kind === 'predict' ? 'Make a guess to continue' : 'Answer to continue'}</span>}
          <Button variant="primary" onClick={forward} disabled={!ready}>
            {last ? (next ? 'Next lesson' : 'Back to the course') : s.kind === 'exercise' && !st.passed ? 'Skip for now' : 'Continue'}
          </Button>
        </div>
      </nav>
    </div>
  );
}
