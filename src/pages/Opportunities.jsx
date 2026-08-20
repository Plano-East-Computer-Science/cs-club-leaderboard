import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import {
  formatDate, daysUntil, TYPE_LABELS, FORMAT_LABELS, COST_LABELS,
} from '../lib/format.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';

const TYPE_COLORS = {
  internship: '#2f8f5b',
  competition: '#c42e2e',
  program: '#2b5fd9',
  resource: '#128c93',
  scholarship: '#b8720e',
};

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

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.opportunities.filter((o) => {
      if (type !== 'all' && o.type !== type) return false;
      if (format !== 'all' && o.format !== format) return false;
      if (freeOnly && o.cost === 'paid') return false;
      if (q && !`${o.title} ${o.org} ${o.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, type, format, freeOnly, query]);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!data) return <Spinner label="Loading opportunities" />;

  const types = ['all', ...new Set(data.opportunities.map((o) => o.type))];
  const formats = ['all', 'online', 'local', 'residential'];

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">Opportunity board</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          Things worth applying to.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          Internships, competitions, programs, and free resources for ages 14–17. Anything you
          would have to drive to is within {data.radius_miles} miles of {data.school} — the rest is
          online, or houses you.
        </p>
      </header>

      <div className="card mb-6 grid gap-4 p-4">
        <label className="block">
          <span className="sr-only">Search opportunities</span>
          <input
            className="field"
            type="search"
            placeholder="Search by name, organisation, or keyword"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <FilterGroup label="Type" value={type} onChange={setType} options={types}
            render={(v) => (v === 'all' ? 'All' : TYPE_LABELS[v] ?? v)} />
          <FilterGroup label="Where" value={format} onChange={setFormat} options={formats}
            render={(v) => (v === 'all' ? 'All' : FORMAT_LABELS[v] ?? v)} />
          <div>
            <p className="eyebrow mb-1.5">Cost</p>
            <label className="mono flex cursor-pointer items-center gap-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
              <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />
              Hide anything that costs money
            </label>
          </div>
        </div>
      </div>

      <p className="mono mb-4 text-xs" style={{ color: 'var(--ink-faint)' }}>
        {filtered.length} of {data.opportunities.length} shown
      </p>

      {filtered.length === 0 ? (
        <Empty title="Nothing matches those filters">
          Try widening the search, or clear a filter.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((o, i) => (
            <OpportunityCard key={o.id} o={o} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, value, onChange, options, render }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className="mono rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold transition-colors"
              style={{
                color: active ? 'light-dark(#fff, #0d1017)' : 'var(--ink-soft)',
                background: active ? 'var(--flag)' : 'transparent',
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

function OpportunityCard({ o, index }) {
  const days = daysUntil(o.deadline);
  const urgent = days !== null && days >= 0 && days <= 21;
  const color = TYPE_COLORS[o.type] ?? '#6b7689';

  return (
    <article
      className="card flex flex-col p-5"
      style={{ animation: `row-in 0.4s ease-out ${Math.min(index * 0.03, 0.4)}s backwards` }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span
          className="mono rounded px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`,
          }}
        >
          {TYPE_LABELS[o.type] ?? o.type}
        </span>

        <span className="mono rounded border px-1.5 py-0.5 text-[0.65rem]" style={{ color: 'var(--ink-soft)' }}>
          {FORMAT_LABELS[o.format] ?? o.format}
          {o.format === 'local' && o.distance_mi != null && ` · ${o.distance_mi} mi`}
        </span>

        {o.cost !== 'paid' && (
          <span
            className="mono rounded px-1.5 py-0.5 text-[0.65rem] font-semibold"
            style={{
              color: '#2f8f5b',
              background: 'color-mix(in srgb, #2f8f5b 12%, transparent)',
            }}
          >
            {COST_LABELS[o.cost]}
          </span>
        )}
      </div>

      <h2 className="display text-lg leading-snug font-bold" style={{ color: 'var(--ink)' }}>
        {o.title}
      </h2>
      {o.org && (
        <p className="mono mt-0.5 text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
          {o.org}
        </p>
      )}

      <p className="mt-3 flex-1 text-[0.85rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {o.description}
      </p>

      {o.location && o.format === 'local' && (
        <p className="mono mt-3 text-[0.68rem]" style={{ color: 'var(--ink-faint)' }}>
          {o.location}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="mono text-[0.7rem]" style={{ color: urgent ? '#c42e2e' : 'var(--ink-faint)' }}>
          {o.deadline
            ? days < 0
              ? `Closed ${formatDate(o.deadline)}`
              : `Due ${formatDate(o.deadline)} · ${days} day${days === 1 ? '' : 's'} left`
            : 'Rolling / varies'}
        </span>
        <a
          className="btn btn-primary"
          href={o.url}
          target="_blank"
          rel="noreferrer noopener"
          style={{ textDecoration: 'none' }}
        >
          Open ↗
        </a>
      </div>

      <p className="mono mt-2 text-[0.6rem]" style={{ color: 'var(--ink-faint)' }}>
        Ages {o.age_min}–{o.age_max}
      </p>
    </article>
  );
}
