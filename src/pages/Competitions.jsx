import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';

export default function Competitions() {
  const [competitions, setCompetitions] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/competitions').then((d) => setCompetitions(d.competitions)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!competitions) return <Spinner label="Loading competitions" />;

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">Where we compete</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          Competitions and results.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          Competition attendance earns points toward club standing and priority spots on future
          teams. You don't have to win to get them — and it reads well on a college app either way.
        </p>
      </header>

      {competitions.length === 0 ? (
        <Empty title="Nothing posted yet" />
      ) : (
        <div className="grid gap-4">
          {competitions.map((comp) => (
            <article key={comp.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
                    {comp.name}
                  </h2>
                  {comp.description && (
                    <p className="mt-1 max-w-2xl text-[0.85rem]" style={{ color: 'var(--ink-soft)' }}>
                      {comp.description}
                    </p>
                  )}
                </div>
                {comp.result && (
                  <span
                    className="mono shrink-0 rounded px-2 py-1 text-xs font-bold"
                    style={{ color: 'var(--color-brass)', background: 'color-mix(in srgb, var(--color-brass) 12%, transparent)' }}
                  >
                    {comp.result}
                  </span>
                )}
              </div>
              <p className="mono mt-3 text-[0.68rem]" style={{ color: 'var(--ink-faint)' }}>
                {comp.event_date ? formatDate(comp.event_date) : 'Date not set yet'}
                {comp.url && (
                  <>
                    {' · '}
                    <a href={comp.url} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--flag)' }}>
                      More info ↗
                    </a>
                  </>
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
