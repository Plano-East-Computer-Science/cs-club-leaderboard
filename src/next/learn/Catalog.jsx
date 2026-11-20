/** /learn: the course catalog. AP CSA first; the older courses stay reachable below. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, PageHeader, Section } from '../../ui/index.js';
import { api } from '../../lib/api.js';
import { COURSES } from '../../../shared/next/learn/courses/index.js';
import { lessonsOf } from '../../../shared/next/learn/schema.js';
import { readProgress, pickNext } from './progress.js';
import './learn.css';

export function courseProgress(course, p = readProgress()) {
  const lessons = lessonsOf(course).map((l) => ({ ...l, key: `${course.id}/${l.id}` }));
  const done = lessons.filter((l) => p.lessons[l.key]?.done).length;
  const started = lessons.some((l) => p.lessons[l.key]);
  return { lessons, done, started, next: pickNext(lessons, { ...p, last: p.last?.startsWith(`${course.id}/`) ? p.last : null }) };
}

function Featured({ course }) {
  const { lessons, done, started, next } = courseProgress(course);
  const pct = Math.round((done / lessons.length) * 100);
  return (
    <section className="lr-feature" aria-labelledby={`c-${course.id}`}>
      <div className="lr-feature__text">
        <h2 id={`c-${course.id}`} className="lr-feature__title">{course.title}</h2>
        <p className="lr-feature__blurb">{course.blurb}</p>
        <p className="lr-feature__meta">
          {course.units.length - 1} units and exam practice, {lessons.length} lessons, in Java.
        </p>
      </div>
      <div className="lr-feature__side">
        {started && (
          <div className="lr-meter">
            <div className="lr-meter__label">{done} of {lessons.length} lessons done</div>
            <div className="lr-meter__bar" role="progressbar" aria-label={`${course.title} progress`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <div className="lr-feature__actions">
          {next && (
            <Button variant="primary" to={`/learn/${course.id}/${next.id}`}>
              {started ? `Continue: ${next.title}` : 'Start the first lesson'}
            </Button>
          )}
          <Button variant="secondary" to={`/learn/${course.id}`}>See every lesson</Button>
        </div>
      </div>
    </section>
  );
}

function Legacy() {
  const [list, setList] = useState(null);
  useEffect(() => {
    api.get('/learn').then((d) => setList(d.courses || []), () => setList([]));
  }, []);
  if (!list?.length) return null;
  return (
    <Section title="More courses">
      <p className="lr-sub">These older courses still work while they are rewritten in the new format.</p>
      <ul className="lr-legacy">
        {list.map((c) => (
          <li key={c.slug}>
            <Link to={`/learn/legacy/${c.slug}`} className="lr-legacy__row">
              <span className="lr-legacy__title">{c.title}</span>
              <span className="lr-legacy__blurb">{c.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export default function Catalog() {
  useEffect(() => {
    document.title = 'Courses | Learn';
  }, []);
  return (
    <div className="ui-page lr">
      <PageHeader title="Courses" subtitle="Lessons that explain each idea, run it, and check you really have it." />
      {COURSES.map((c) => <Featured key={c.id} course={c} />)}
      <Legacy />
    </div>
  );
}
