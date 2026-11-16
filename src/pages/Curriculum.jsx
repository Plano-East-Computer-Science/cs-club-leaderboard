import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { PageHeader, SectionTitle, Skeleton, ErrorNote } from '../components/bits.jsx';

const TRACKS = [
  { id: 'fall', label: 'Fall, beginner', blurb: 'Print statements to object-oriented programming. No experience assumed.' },
  { id: 'spring', label: 'Spring, advanced', blurb: 'Searching, sorting, data structures, graphs, and dynamic programming.' },
];

export default function Curriculum() {
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/curriculum').then((d) => setTopics(d.topics)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  return (
    <div>
      <PageHeader title="What we teach, all year">
        The fall track assumes nothing. The spring track goes further. A checked topic has
        already been taught this year.
      </PageHeader>

      {error ? (
        <ErrorNote onRetry={load}>{error}</ErrorNote>
      ) : !topics ? (
        <div className="grid gap-10 md:grid-cols-2" aria-busy="true" aria-label="Loading curriculum">
          {TRACKS.map((t) => (
            <div key={t.id} className="grid gap-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-6" />
              <Skeleton className="h-6" />
              <Skeleton className="h-6" />
            </div>
          ))}
        </div>
      ) : topics.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Topics get posted here as the semester is planned.
        </p>
      ) : (
        <div className="grid gap-10 md:grid-cols-2">
          {TRACKS.map((track) => (
            <Track key={track.id} track={track} items={topics.filter((t) => t.track === track.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Track({ track, items }) {
  const done = items.filter((t) => t.covered).length;
  const pct = items.length ? (done / items.length) * 100 : 0;

  return (
    <section className="min-w-0">
      <SectionTitle aside={`${done} of ${items.length} covered`}>{track.label}</SectionTitle>
      <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
        {track.blurb}
      </p>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--paper-2)' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
        aria-label={`${track.label} topics covered`}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--flag)' }} />
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Topics get posted here as the semester is planned.
        </p>
      ) : (
        <ol className="mt-4 grid gap-2.5">
          {items.map((t, i) => (
            <li
              key={t.id}
              className="flex items-center gap-3 text-sm"
              style={{ animation: `row-in 0.35s ease-out ${Math.min(i * 0.03, 0.3)}s backwards` }}
            >
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                style={
                  t.covered
                    ? { background: 'var(--ok)', color: 'var(--on-flag)' }
                    : { border: '1.5px solid var(--rule)' }
                }
                aria-hidden="true"
              >
                {t.covered ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span style={{ color: t.covered ? 'var(--ink)' : 'var(--ink-soft)' }}>
                {t.title}
                <span className="sr-only">{t.covered ? ', covered' : ', not yet covered'}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
