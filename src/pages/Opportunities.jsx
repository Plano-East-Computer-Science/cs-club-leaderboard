import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { api } from '../lib/api.js';
import {
  formatDate, daysUntil, upcomingDeadlines, TYPE_LABELS, FORMAT_LABELS, COST_LABELS,
} from '../lib/format.js';
import { PageHeader, Skeleton, ErrorNote, Empty } from '../components/bits.jsx';

const TYPE_COLORS = {
  internship: 'var(--ok)',
  competition: 'var(--tier-expert)',
  program: 'var(--tier-specialist)',
  resource: 'var(--tier-builder)',
  scholarship: 'var(--color-brass)',
};

const FORMATS = ['all', 'online', 'local', 'residential'];
const TINT = 'color-mix(in srgb, var(--flag) 8%, var(--card))';

export default function Opportunities() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [type, setType] = useState('all');
  const [format, setFormat] = useState('all');
  const [freeOnly, setFreeOnly] = useState(false);
  const [query, setQuery] = useState('');

  const load = () => {
    setError(null);
    api.get('/opportunities').then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const all = data?.opportunities ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((o) => {
      if (type !== 'all' && o.type !== type) return false;
      if (format !== 'all' && o.format !== format) return false;
      if (freeOnly && o.cost === 'paid') return false;
      if (q && !`${o.title} ${o.org} ${o.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, type, format, freeOnly, query]);

  const open = filtered.filter((o) => (daysUntil(o.deadline) ?? 0) >= 0);
  const closed = filtered.filter((o) => (daysUntil(o.deadline) ?? 0) < 0);
  const types = ['all', ...new Set(all.map((o) => o.type))];

  return (
    <div>
      <PageHeader title="Things worth applying to.">
        Internships, competitions, programs, and free resources for ages 14 to 17. Anything you
        would have to drive to is within {data?.radius_miles ?? 30} miles of{' '}
        {data?.school ?? 'school'}. The rest is online, or houses you.
      </PageHeader>

      <div className="mb-8 grid gap-4 rounded-lg border p-4" style={{ background: TINT }}>
        <div>
          <label htmlFor="opp-search" className="sr-only">
            Search opportunities
          </label>
          <input
            id="opp-search"
            className="field"
            type="search"
            placeholder="Search by name, organization, or keyword"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Pills label="Type" value={type} onChange={setType} options={types}
            render={(v) => (v === 'all' ? 'All' : TYPE_LABELS[v] ?? v)} />
          <Pills label="Where" value={format} onChange={setFormat} options={FORMATS}
            render={(v) => (v === 'all' ? 'All' : FORMAT_LABELS[v] ?? v)} />
          <label
            htmlFor="opp-free"
            className="mono flex min-h-8 cursor-pointer items-center gap-2 self-end text-xs font-semibold"
            style={{ color: 'var(--ink-soft)' }}
          >
            <input
              id="opp-free"
              type="checkbox"
              checked={freeOnly}
              onChange={(e) => setFreeOnly(e.target.checked)}
            />
            Free only
          </label>
        </div>
      </div>

      {error ? (
        <ErrorNote onRetry={load}>{error}</ErrorNote>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <section className="order-2 min-w-0 lg:order-1">
            {!data ? (
              <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading opportunities">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-56" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Empty title="Nothing matches those filters">Widen the search or clear a filter.</Empty>
            ) : (
              <>
                <p className="mono mb-4 text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {open.length} open
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {open.map((o, i) => (
                    <OpportunityCard key={o.id} o={o} index={i} />
                  ))}
                </div>
                {closed.length > 0 && <ClosedList rows={closed} />}
              </>
            )}
          </section>
          <NextDeadlines rows={data ? upcomingDeadlines(all, 5) : null} />
        </div>
      )}
    </div>
  );
}

function Pills({ label, value, onChange, options, render }) {
  return (
    <div>
      <p className="mono mb-1.5 text-xs font-semibold" style={{ color: 'var(--ink-faint)' }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className="mono rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                color: active ? 'var(--on-flag)' : 'var(--ink-soft)',
                background: active ? 'var(--flag)' : 'var(--card)',
                borderColor: active ? 'var(--flag)' : 'var(--rule)',
              }}
              aria-pressed={active}
            >
              {render(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- rail --------------------------------- */

function NextDeadlines({ rows }) {
  return (
    <aside className="order-1 lg:order-2">
      <h2 className="display mb-3 text-xl font-bold" style={{ color: 'var(--ink)' }}>
        Next deadlines
      </h2>
      {!rows ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Nothing with a deadline right now. Everything listed is rolling.
        </p>
      ) : (
        <ol className="divide-y border-t">
          {rows.map((o) => {
            const days = daysUntil(o.deadline);
            return (
              <li key={o.id} className="flex items-start gap-3 py-3">
                <span
                  className="mono w-10 shrink-0 text-2xl leading-none font-bold"
                  style={{ color: days <= 7 ? 'var(--danger)' : 'var(--ink)' }}
                  aria-label={`${days} days left`}
                >
                  {days}
                </span>
                <span className="min-w-0">
                  <a
                    href={o.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Open ${o.title}`}
                    className="block truncate text-sm font-semibold no-underline hover:underline"
                    style={{ color: 'var(--ink)' }}
                  >
                    {o.title}
                  </a>
                  <span className="mono block text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {formatDate(o.deadline)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <Link
        to="/calendar"
        className="mono mt-3 inline-block text-xs font-semibold"
        style={{ color: 'var(--flag)' }}
      >
        Every deadline, and a calendar feed
      </Link>
    </aside>
  );
}

/* --------------------------------- cards --------------------------------- */

function Chip({ color, children }) {
  return (
    <span
      className="mono rounded-md px-1.5 py-0.5 text-xs font-semibold"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

function OpportunityCard({ o, index }) {
  const days = daysUntil(o.deadline);
  const urgent = days !== null && days <= 21;
  const color = TYPE_COLORS[o.type] ?? 'var(--tier-newcomer)';
  const meta = [`Ages ${o.age_min} to ${o.age_max}`];
  if (o.format === 'local' && o.distance_mi != null) meta.push(`${o.distance_mi} mi away`);

  return (
    <article
      className="flex flex-col rounded-lg border bg-card p-5"
      style={{ animation: `row-in 0.35s ease-out ${Math.min(index * 0.03, 0.3)}s backwards` }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Chip color={color}>{TYPE_LABELS[o.type] ?? o.type}</Chip>
        <Chip color="var(--ink-soft)">{FORMAT_LABELS[o.format] ?? o.format}</Chip>
        {o.cost !== 'paid' && <Chip color="var(--ok)">{COST_LABELS[o.cost]}</Chip>}
      </div>

      <h3 className="display text-lg leading-snug font-bold" style={{ color: 'var(--ink)' }}>
        {o.title}
      </h3>
      {o.org && (
        <p className="mono mt-0.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
          {o.org}
        </p>
      )}

      <p
        className="mt-3 flex-1 overflow-hidden text-sm leading-relaxed [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"
        style={{ color: 'var(--ink-soft)' }}
      >
        {o.description}
      </p>

      <p className="mono mt-3 text-xs" style={{ color: 'var(--ink-faint)' }}>
        {meta.join(', ')}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span
          className="mono text-xs"
          style={{ color: urgent ? 'var(--danger)' : 'var(--ink-faint)' }}
        >
          {o.deadline
            ? `Due ${formatDate(o.deadline)}, ${days} day${days === 1 ? '' : 's'} left`
            : 'Rolling'}
        </span>
        <a
          className="btn btn-primary"
          href={o.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Open ${o.title}`}
        >
          Open
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function ClosedList({ rows }) {
  return (
    <details className="group mt-8">
      <summary
        className="mono flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden"
        style={{ color: 'var(--ink-soft)' }}
      >
        <ChevronRight
          size={16}
          className="transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        Closed ({rows.length})
      </summary>
      <ul className="mt-3 divide-y border-t">
        {rows.map((o) => (
          <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="min-w-0">
              <a
                href={o.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Open ${o.title}`}
                className="text-sm font-semibold no-underline hover:underline"
                style={{ color: 'var(--ink-soft)' }}
              >
                {o.title}
              </a>
              {o.org && (
                <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {o.org}
                </span>
              )}
            </span>
            <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
              Closed {formatDate(o.deadline)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
