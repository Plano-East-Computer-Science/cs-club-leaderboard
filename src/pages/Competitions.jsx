import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { PageHeader, SectionTitle, Skeleton, ErrorNote } from '../components/bits.jsx';

export default function Competitions() {
  const [competitions, setCompetitions] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/competitions').then((d) => setCompetitions(d.competitions)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  // A recorded result means it already happened, whatever `status` says; rows
  // with neither are treated as upcoming so a half-filled entry still shows up.
  const isPast = (c) => c.status === 'past' || Boolean(c.result?.trim());
  const upcoming = competitions?.filter((c) => !isPast(c)) ?? [];
  const past = competitions?.filter(isPast) ?? [];

  return (
    <div>
      <PageHeader title="Competitions and results">
        Showing up to a competition earns points and a priority spot on the next team. You do
        not have to win to get them, and it reads well on a college app either way.
      </PageHeader>

      {error ? (
        <ErrorNote onRetry={load}>{error}</ErrorNote>
      ) : !competitions ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading competitions">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : competitions.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Nothing scheduled yet. Competitions show up here once dates are set.
        </p>
      ) : (
        <>
          {upcoming.length > 0 && <Group title="Coming up" rows={upcoming} />}
          {past.length > 0 && <Group title="Past results" rows={past} />}
        </>
      )}
    </div>
  );
}

function Group({ title, rows }) {
  return (
    <section className="mb-12">
      <SectionTitle aside={`${rows.length} ${rows.length === 1 ? 'event' : 'events'}`}>{title}</SectionTitle>
      <ul className="divide-y">
        {rows.map((comp, i) => (
          <li
            key={comp.id}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
            style={{ animation: `row-in 0.35s ease-out ${Math.min(i * 0.03, 0.3)}s backwards` }}
          >
            <div className="min-w-0">
              <h3 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
                {comp.name}
              </h3>
              {comp.description && (
                <p className="mt-1 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                  {comp.description}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-col sm:items-end">
              {comp.result && (
                <span
                  className="mono rounded-md px-2 py-0.5 text-xs font-bold"
                  style={{
                    color: 'var(--color-brass)',
                    background: 'color-mix(in srgb, var(--color-brass) 14%, transparent)',
                  }}
                >
                  {comp.result}
                </span>
              )}
              <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                {comp.event_date ? formatDate(comp.event_date) : 'Date TBA'}
              </span>
              {comp.url && (
                <a
                  href={comp.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mono inline-flex items-center gap-1 text-xs font-semibold no-underline hover:underline"
                  style={{ color: 'var(--flag)' }}
                  aria-label={`Details for ${comp.name}`}
                >
                  Details
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
