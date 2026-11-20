/** /learn/:course: units, lessons, your progress and where to pick up. Old course slugs go to /learn/legacy/:slug. */
import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Circle, CircleHalf } from '@phosphor-icons/react';

import { Button } from '../../ui/index.js';
import { findCourse } from '../../../shared/next/learn/courses/index.js';
import { readProgress } from './progress.js';
import { courseProgress } from './Catalog.jsx';
import './learn.css';

export default function CourseMap() {
  const { course: id } = useParams();
  const course = findCourse(id);
  useEffect(() => {
    if (course) document.title = `${course.title} | Learn`;
  }, [course]);
  if (!course) return <Navigate to={`/learn/legacy/${id}`} replace />;

  const p = readProgress();
  const { lessons, done, started, next } = courseProgress(course, p);
  let n = 0;

  return (
    <div className="ui-page lr">
      <Link to="/learn" className="lr-backlink"><ArrowLeft size={16} aria-hidden="true" /> All courses</Link>
      <header className="lr-maphead">
        <div>
          <h1 className="ui-display-l">{course.title}</h1>
          <p className="lr-feature__blurb">{course.blurb}</p>
        </div>
        <div className="lr-maphead__side">
          <p className="lr-meter__label">{done} of {lessons.length} lessons done</p>
          <div className="lr-meter__bar" role="progressbar" aria-label="Course progress" aria-valuenow={Math.round((done / lessons.length) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${(done / lessons.length) * 100}%` }} />
          </div>
          {next && (
            <Button variant="primary" to={`/learn/${course.id}/${next.id}`}>
              {started ? `Continue: ${next.title}` : 'Start the first lesson'}
            </Button>
          )}
        </div>
      </header>

      {course.units.map((u) => (
        <section key={u.id} className="lr-unit" aria-labelledby={`u-${u.id}`}>
          <div className="lr-unit__head">
            <h2 id={`u-${u.id}`} className="lr-unit__title">{u.title}</h2>
            {u.blurb && <p className="lr-sub">{u.blurb}</p>}
          </div>
          <ol className="lr-lessons">
            {u.lessons.map((l) => {
              n++;
              const st = p.lessons[`${course.id}/${l.id}`];
              const isNext = next?.id === l.id;
              const Icon = st?.done ? CheckCircle : st ? CircleHalf : Circle;
              return (
                <li key={l.id}>
                  <Link to={`/learn/${course.id}/${l.id}`} className={`lr-lesson${isNext ? ' is-next' : ''}${st?.done ? ' is-done' : ''}`}>
                    <span className="lr-lesson__n" aria-hidden="true">{n}</span>
                    <span className="lr-lesson__main">
                      <span className="lr-lesson__title">{l.title}</span>
                      <span className="lr-lesson__sum">{l.summary}</span>
                    </span>
                    <span className="lr-lesson__state">
                      <Icon size={20} weight={st?.done ? 'fill' : 'regular'} aria-hidden="true" />
                      <span>
                        {st?.done ? 'Done' : st ? `Step ${st.step + 1} of ${l.steps.length}` : l.kind === 'frq' ? `FRQ, ${l.minutes} min` : `${l.minutes} min`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
