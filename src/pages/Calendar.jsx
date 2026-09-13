import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatDate, daysUntil } from '../lib/format.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';
import { useAuth } from '../lib/auth.jsx';

const MONTH = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export default function CalendarPage({ settings }) {
  const { member } = useAuth();
  const [opps, setOpps] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/opportunities').then((d) => setOpps(d.opportunities)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const deadlines = useMemo(() => {
    if (!opps) return [];
    return opps
      .filter((o) => o.deadline && daysUntil(o.deadline) >= 0)
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [opps]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const o of deadlines) {
      const key = MONTH(o.deadline);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return [...map.entries()];
  }, [deadlines]);

  // The feed carries a key because a calendar app cannot send a cookie, and
  // the deadlines are members-only. The key is personal: sharing the URL shares
  // access.
  const subscribeUrl =
    member && typeof window !== 'undefined'
      ? `https://${window.location.host}/api/deadlines.ics?key=${member.feed_token}`
      : '';
  const webcalUrl = subscribeUrl.replace(/^https?:\/\//, 'webcal://');

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">When things happen</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          Calendar.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          Meetings and club events on the left. Every opportunity deadline on the right — subscribe
          once and it stays current on its own, since it comes straight from the{' '}
          <Link to="/opportunities" style={{ color: 'var(--flag)' }}>
            opportunity board
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="card overflow-hidden p-0">
          <div className="border-b p-5">
            <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
              Meetings &amp; events
            </h2>
          </div>
          {settings.meetings_calendar_embed_url ? (
            <iframe
              src={settings.meetings_calendar_embed_url}
              title="Club meetings calendar"
              width="100%"
              height="600"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
            />
          ) : (
            <div className="p-5">
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                No calendar linked yet. An officer can set one up in a couple of minutes:
              </p>
              <ol className="mono mt-3 grid gap-1.5 text-[0.75rem]" style={{ color: 'var(--ink-faint)' }}>
                <li>1. Create a Google Calendar for the club (or use an existing one).</li>
                <li>2. Settings → that calendar → Access permissions → make it public.</li>
                <li>3. Settings → Integrate calendar → copy the embed URL and the public URL.</li>
                <li>4. Paste both into Admin → Page text.</li>
              </ol>
            </div>
          )}
        </section>

        <aside className="grid gap-4">
          {settings.meetings_calendar_subscribe_url && (
            <a
              className="btn btn-primary"
              href={settings.meetings_calendar_subscribe_url}
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'none' }}
            >
              Add meetings to your calendar
            </a>
          )}

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="eyebrow">Deadlines</h2>
              {subscribeUrl && (
                <a
                  className="mono text-[0.7rem] font-semibold no-underline"
                  style={{ color: 'var(--flag)' }}
                  href={webcalUrl}
                  title="Opens your calendar app's subscribe dialog"
                >
                  + Subscribe
                </a>
              )}
            </div>

            {error ? (
              <ErrorNote onRetry={load}>{error}</ErrorNote>
            ) : !opps ? (
              <Spinner label="Loading deadlines" />
            ) : deadlines.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                Nothing with a deadline right now — check the{' '}
                <Link to="/opportunities" style={{ color: 'var(--flag)' }}>
                  opportunity board
                </Link>{' '}
                for rolling ones.
              </p>
            ) : (
              <div className="grid gap-4">
                {grouped.map(([month, items]) => (
                  <div key={month}>
                    <p className="mono mb-1.5 text-[0.65rem] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-faint)' }}>
                      {month}
                    </p>
                    <ul className="grid gap-1.5">
                      {items.map((o) => {
                        const days = daysUntil(o.deadline);
                        return (
                          <li key={o.id} className="flex items-baseline gap-2 text-[0.82rem]">
                            <span className="mono shrink-0" style={{ color: days <= 7 ? '#c42e2e' : 'var(--ink-faint)' }}>
                              {formatDate(o.deadline).replace(/,.*/, '')}
                            </span>
                            <span className="min-w-0 truncate" style={{ color: 'var(--ink)' }}>
                              {o.title}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <p className="mono mt-4 border-t pt-3 text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
              Subscribing adds a live feed to your own calendar app — it updates on its own as
              deadlines change. It does not download a one-time file.
            </p>
            {subscribeUrl && (
              <>
                <p className="mono mt-3 text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                  Your personal feed URL — keep it to yourself:
                </p>
                <input
                  className="field mono mt-1.5 text-[0.65rem]"
                  readOnly
                  value={subscribeUrl}
                  onFocus={(e) => e.target.select()}
                />
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
