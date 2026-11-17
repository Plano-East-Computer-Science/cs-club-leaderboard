import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';

export default function Learn() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/learn').then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!data) return <Spinner label="Loading courses" />;

  const { tracks, courses, signedIn } = data;

  return (
    <div>
      <header className="mb-10">
        <p className="eyebrow">Learn</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          Learn it here. Run it here.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          Short lessons, quick checks, and real code you run in the page. There is nothing to
          install, no IDE to set up and no HackerRank account to make.
          {!signedIn && (
            <>
              {' '}
              <Link to="/signin" className="underline" style={{ color: 'var(--flag)' }}>
                Sign in
              </Link>{' '}
              to keep your progress.
            </>
          )}
        </p>
      </header>

      {tracks.length === 0 ? (
        <Empty title="No courses yet">Check back soon.</Empty>
      ) : (
        <div className="grid gap-10">
          {tracks.map((t) => {
            const list = courses.filter((c) => c.track === t.id);
            return (
              <section key={t.id} aria-labelledby={`track-${t.id}`}>
                <div className="flex flex-wrap items-baseline gap-x-3 border-b pb-2">
                  <h2 id={`track-${t.id}`} className="display text-xl font-bold">
                    {t.name}
                  </h2>
                  {t.soon && <span className="eyebrow">Coming soon</span>}
                </div>
                {t.blurb && (
                  <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
                    {t.blurb}
                  </p>
                )}
                {!t.soon && (
                  <ul>
                    {list.map((c) => (
                      <CourseRow key={c.slug} c={c} signedIn={signedIn} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CourseRow({ c, signedIn }) {
  const pct = c.steps ? Math.round(((c.passed || 0) / c.steps) * 100) : 0;
  return (
    <li className="border-b">
      <Link
        to={`/learn/${c.slug}`}
        className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[1fr_auto] hover:bg-[var(--paper-2)] -mx-3 px-3 rounded"
      >
        <div>
          <p className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {c.title}
          </p>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--ink-soft)' }}>
            {c.blurb}
          </p>
          <p className="mono mt-1.5 text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
            {c.level} · {c.minutes} min · {c.steps} steps
          </p>
        </div>
        {signedIn && (
          <div className="sm:w-32 sm:self-center">
            <p className="mono text-xs sm:text-right" style={{ color: 'var(--ink-soft)' }}>
              {c.passed || 0} / {c.steps}
            </p>
            <div
              className="mt-1 h-1 w-full overflow-hidden rounded-full"
              style={{ background: 'color-mix(in srgb, var(--ink) 10%, transparent)' }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${c.title} progress`}
            >
              <div className="h-full" style={{ width: `${pct}%`, background: 'var(--flag)' }} />
            </div>
          </div>
        )}
      </Link>
    </li>
  );
}
