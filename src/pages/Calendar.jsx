import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { daysUntil, upcomingDeadlines } from '../lib/format.js';
import {
  PageHeader, SectionTitle, Skeleton, ErrorNote, RichText, Empty,
} from '../components/bits.jsx';

const TINT = 'color-mix(in srgb, var(--flag) 8%, var(--card))';

const dateParts = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return {
    month: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    short: d.toLocaleDateString(undefined, { month: 'short' }),
    day: d.getDate(),
  };
};

export default function CalendarPage({ settings }) {
  const [opps, setOpps] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/opportunities').then((d) => setOpps(d.opportunities)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const o of upcomingDeadlines(opps ?? [])) {
      const key = dateParts(o.deadline).month;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return [...map.entries()];
  }, [opps]);

  return (
    <div>
      <PageHeader title="Calendar.">
        Meeting times, every opportunity deadline, and a feed you can subscribe to once.
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section className="min-w-0">
          {error ? (
            <ErrorNote onRetry={load}>{error}</ErrorNote>
          ) : !opps ? (
            <div className="grid gap-3" aria-busy="true" aria-label="Loading deadlines">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <Empty title="No deadlines on the board right now">
              Plenty of listings take applications all year.{' '}
              <Link to="/opportunities" style={{ color: 'var(--flag)' }}>
                Browse the opportunity board
              </Link>
              .
            </Empty>
          ) : (
            grouped.map(([month, items]) => (
              <section key={month} className="mb-8">
                <SectionTitle aside={`${items.length} due`}>{month}</SectionTitle>
                <ol className="divide-y">
                  {items.map((o, i) => (
                    <DeadlineRow key={o.id} o={o} index={i} />
                  ))}
                </ol>
              </section>
            ))
          )}
        </section>

        <aside className="grid gap-4">
          <Panel title="Meetings">
            {settings.join_meeting_info ? (
              <RichText text={settings.join_meeting_info} />
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                Meeting day, time, and room are posted on Discord and in school announcements.
              </p>
            )}
          </Panel>
          <SubscribePanel settings={settings} />
        </aside>
      </div>
    </div>
  );
}

function DeadlineRow({ o, index }) {
  const { short, day } = dateParts(o.deadline);
  const days = daysUntil(o.deadline);
  return (
    <li
      className="flex items-center gap-4 py-3"
      style={{ animation: `row-in 0.35s ease-out ${Math.min(index * 0.03, 0.3)}s backwards` }}
    >
      <span className="w-14 shrink-0 text-center">
        <span
          className="mono block text-3xl leading-none font-bold"
          style={{ color: days <= 7 ? 'var(--danger)' : 'var(--ink)' }}
        >
          {day}
        </span>
        <span className="mono block text-xs" style={{ color: 'var(--ink-faint)' }}>
          {short}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <a
          href={o.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Open ${o.title}`}
          className="block text-sm font-semibold no-underline hover:underline"
          style={{ color: 'var(--ink)' }}
        >
          {o.title}
        </a>
        {o.org && (
          <span className="block text-sm" style={{ color: 'var(--ink-soft)' }}>
            {o.org}
          </span>
        )}
        <span className="mono block text-xs" style={{ color: days <= 7 ? 'var(--danger)' : 'var(--ink-faint)' }}>
          {days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} left`}
        </span>
      </span>
    </li>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border p-5" style={{ background: TINT }}>
      <h2 className="display mb-3 text-lg font-bold" style={{ color: 'var(--ink)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubscribePanel({ settings }) {
  const host = typeof window === 'undefined' ? '' : window.location.host;
  return (
    <Panel title="Subscribe">
      <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        This is a live feed, not a one-time file: deadlines update in your own calendar app as the
        board changes.
      </p>
      <div className="grid gap-2">
        <a className="btn btn-primary" href={`webcal://${host}/api/deadlines.ics`}>
          Add deadlines to your calendar
        </a>
        {settings.meetings_calendar_subscribe_url && (
          <a
            className="btn btn-primary"
            href={settings.meetings_calendar_subscribe_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            Add meetings to your calendar
          </a>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
        If your app does not understand webcal, subscribe to this address instead:
        <code className="mono mt-1 block break-all select-all" style={{ color: 'var(--ink-soft)' }}>
          https://{host}/api/deadlines.ics
        </code>
      </p>
    </Panel>
  );
}
