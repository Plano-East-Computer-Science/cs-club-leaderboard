import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { tierFor } from '../lib/tiers.js';
import { formatDate, relativeDate } from '../lib/format.js';
import { Avatar, TierMark, TierProgress, BadgeChip, CountUp, Spinner, ErrorNote } from '../components/bits.jsx';

export default function Student() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    setData(null);
    api.get(`/student/${id}`).then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, [id]);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!data) return <Spinner label="Loading profile" />;

  const tier = tierFor(data.points);
  const earned = data.events.filter((e) => e.delta > 0);
  const best = earned.reduce((a, b) => (b.delta > (a?.delta ?? 0) ? b : a), null);

  return (
    <div>
      <Link className="mono text-xs no-underline" style={{ color: 'var(--ink-faint)' }} to="/">
        ← Standings
      </Link>

      <header className="mt-4 mb-10 flex flex-wrap items-center gap-5">
        <Avatar name={data.name} seed={data.avatar_seed} points={data.points} size={72} />
        <div className="min-w-0">
          <h1 className="display text-[clamp(1.9rem,5vw,3rem)] leading-none font-extrabold">
            {data.name}
          </h1>
          <p className="mono mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
            {data.grade ? `Grade ${data.grade}` : 'Member'}
            <span aria-hidden="true">·</span>
            joined {formatDate(data.joined_at)}
          </p>
        </div>
        <div className="ml-auto text-right">
          <CountUp
            value={data.points}
            className="mono block text-5xl leading-none font-bold"
            style={{ color: tier.color }}
          />
          <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
            points · rank {data.rank} of {data.total_students}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section>
          <h2 className="eyebrow mb-3">Point history</h2>
          {data.events.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                No points awarded yet. Show up to a meeting and that changes.
              </p>
            </div>
          ) : (
            <ol className="card divide-y overflow-hidden p-0">
              {data.events.map((e, i) => (
                <li
                  key={e.id}
                  className="flex items-center gap-4 px-4 py-3"
                  style={{ animation: `row-in 0.4s ease-out ${Math.min(i * 0.04, 0.5)}s backwards` }}
                >
                  <span
                    className="mono w-14 shrink-0 text-right text-base font-bold"
                    style={{ color: e.delta >= 0 ? tier.color : '#c42e2e' }}
                  >
                    {e.delta > 0 ? '+' : ''}
                    {e.delta}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm" style={{ color: 'var(--ink)' }}>
                      {e.reason || 'No reason recorded'}
                    </span>
                    <span className="mono block text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                      {formatDate(e.created_at)} · {relativeDate(e.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="grid gap-6">
          <div className="card p-5">
            <h2 className="eyebrow mb-3">Tier</h2>
            <TierMark points={data.points} size="lg" />
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {tier.blurb}
            </p>
            <TierProgress points={data.points} className="mt-4" />
          </div>

          <div className="card p-5">
            <h2 className="eyebrow mb-3">Badges</h2>
            {data.badges.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                None yet. Badges are awarded by officers for specific wins.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.badges.map((b) => (
                  <BadgeChip key={b.id} badge={b} size="lg" />
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="eyebrow mb-3">At a glance</h2>
            <dl className="mono grid gap-2 text-xs">
              <Stat label="Awards received" value={data.award_count} />
              <Stat label="Biggest single award" value={best ? `+${best.delta}` : '—'} />
              <Stat
                label="Last award"
                value={data.last_award ? relativeDate(data.last_award) : '—'}
              />
            </dl>
            {best?.reason && (
              <p className="mt-3 text-[0.78rem]" style={{ color: 'var(--ink-soft)' }}>
                Best haul: {best.reason}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt style={{ color: 'var(--ink-faint)' }}>{label}</dt>
      <dd className="font-semibold" style={{ color: 'var(--ink)' }}>
        {value}
      </dd>
    </div>
  );
}
