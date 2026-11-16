/**
 * One member's record: the points, and every award that produced them.
 *
 * The history is a real table because it is tabular (amount, reason, date) and
 * screen readers should get the column headers.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import { tierFor } from '../lib/tiers.js';
import { formatDate, relativeDate } from '../lib/format.js';
import {
  Avatar, TierMark, TierProgress, BadgeChip, CountUp, ErrorNote, Skeleton, SectionTitle,
} from '../components/bits.jsx';

const PANEL = {
  background: 'color-mix(in srgb, var(--flag) 8%, var(--card))',
};

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

  return (
    <div>
      <BackLink />

      {error ? (
        <div className="mt-6">
          <ErrorNote onRetry={load}>{error}</ErrorNote>
        </div>
      ) : !data ? (
        <Loading />
      ) : (
        <Profile data={data} />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      className="mono inline-flex items-center gap-1.5 text-sm no-underline hover:underline"
      style={{ color: 'var(--ink-soft)' }}
      to="/"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Standings
    </Link>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <Skeleton className="mt-4 mb-10 h-24" />
      <div className="grid gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}

function Profile({ data }) {
  const tier = tierFor(data.points);
  const earned = data.events.filter((e) => e.delta > 0);
  const best = earned.reduce((a, b) => (b.delta > (a?.delta ?? 0) ? b : a), null);

  return (
    <div>
      <header className="mt-4 mb-10 flex flex-wrap items-center gap-x-5 gap-y-4">
        <Avatar name={data.name} seed={data.avatar_seed} points={data.points} size={72} />
        <div className="min-w-0">
          <h1
            className="display text-[clamp(1.9rem,5vw,3rem)] leading-none font-extrabold"
            style={{ color: 'var(--ink)' }}
          >
            {data.name}
          </h1>
          <p className="mono mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
            {data.grade ? `Grade ${data.grade}` : 'Member'}
            <span aria-hidden="true">·</span>
            joined {formatDate(data.joined_at)}
          </p>
        </div>
        {/* Points drop under the name on narrow screens instead of stranding
            themselves in the right margin. */}
        <div className="basis-full sm:ml-auto sm:basis-auto sm:text-right">
          <CountUp
            value={data.points}
            className="mono block text-5xl leading-none font-bold"
            style={{ color: tier.color }}
          />
          <span className="mono mt-1 block text-xs" style={{ color: 'var(--ink-faint)' }}>
            points · rank {data.rank} of {data.total_students}
          </span>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <section className="min-w-0">
          <SectionTitle aside={`${data.award_count} awards`}>Point history</SectionTitle>
          {data.events.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              No points yet. Show up to a meeting and that changes.
            </p>
          ) : (
            <table className="w-full border-collapse">
              <caption className="sr-only">Every point award for {data.name}</caption>
              <thead>
                <tr className="mono text-xs uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>
                  <th scope="col" className="w-16 py-2 pr-3 text-left font-semibold">
                    Points
                  </th>
                  <th scope="col" className="py-2 pr-3 text-left font-semibold">
                    Reason
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.events.map((e, i) => (
                  <tr
                    key={e.id}
                    style={{ animation: `row-in 0.35s ease-out ${Math.min(i * 0.03, 0.3)}s backwards` }}
                  >
                    <td className="py-3 pr-3">
                      <span
                        className="mono text-lg font-bold"
                        style={{ color: e.delta >= 0 ? tier.color : 'var(--danger)' }}
                      >
                        {e.delta > 0 ? '+' : ''}
                        {e.delta}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-sm" style={{ color: 'var(--ink)' }}>
                      {e.reason || 'No reason recorded'}
                    </td>
                    <td className="py-3 text-right">
                      <span className="mono block text-xs whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>
                        {formatDate(e.created_at)}
                      </span>
                      <span className="mono block text-xs whitespace-nowrap" style={{ color: 'var(--ink-faint)' }}>
                        {relativeDate(e.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="grid gap-4">
          <div className="rounded-lg border p-4" style={PANEL}>
            <h2 className="mono text-xs font-semibold" style={{ color: 'var(--ink-faint)' }}>
              Tier
            </h2>
            <div className="mt-2">
              <TierMark points={data.points} size="lg" />
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {tier.blurb}
            </p>
            <TierProgress points={data.points} className="mt-4" />
          </div>

          <div className="rounded-lg border p-4" style={PANEL}>
            <h2 className="mono text-xs font-semibold" style={{ color: 'var(--ink-faint)' }}>
              Badges
            </h2>
            {data.badges.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                No badges yet.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.badges.map((b) => (
                  <BadgeChip key={b.id} badge={b} size="lg" />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4" style={PANEL}>
            <h2 className="mono text-xs font-semibold" style={{ color: 'var(--ink-faint)' }}>
              At a glance
            </h2>
            <dl className="mono mt-3 grid gap-2 text-xs">
              <Stat label="Awards received" value={data.award_count} />
              <Stat label="Biggest single award" value={best ? `+${best.delta}` : 'n/a'} />
              <Stat
                label="Last award"
                value={data.last_award ? relativeDate(data.last_award) : 'n/a'}
              />
            </dl>
            {best?.reason && (
              <p className="mt-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
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
