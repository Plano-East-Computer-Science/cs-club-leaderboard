import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { relativeDate } from '../lib/format.js';
import { tierFor, nextTier, TIERS } from '../lib/tiers.js';
import {
  Avatar, TierMark, BadgeChip, CountUp, ErrorNote, Empty, Skeleton, SectionTitle,
} from '../components/bits.jsx';

export default function Leaderboard({ settings }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/leaderboard').then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const students = data?.students ?? null;

  return (
    <div>
      <Hero settings={settings} />

      {error ? (
        <ErrorNote onRetry={load}>{error}</ErrorNote>
      ) : !students ? (
        <Loading />
      ) : students.length === 0 ? (
        <Empty title="No standings yet">
          Points show up here as soon as the first ones are awarded.
        </Empty>
      ) : (
        <>
          <Podium podium={students.slice(0, 3)} />
          <div className="mb-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <StandingsTable rows={students.slice(3)} total={students.length} />
            <RecentActivity recent={data.recent ?? []} />
          </div>
          <TierLadder students={students} />
        </>
      )}
    </div>
  );
}

/* --------------------------------- hero --------------------------------- */

function Hero({ settings }) {
  return (
    <section className="mb-12 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-end">
      <div>
        <p className="eyebrow">Season standings</p>
        <h1
          className="display mt-3 max-w-[12ch] text-[clamp(2.6rem,7vw,4.75rem)] leading-[0.92] font-extrabold"
          style={{ color: 'var(--ink)' }}
        >
          Every point is on the record.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {settings.tagline || 'Build things. Win things. Get better together.'} Every award
          comes with a reason, so you always know where your points came from.
        </p>
      </div>
      <PrizeTicket settings={settings} />
    </section>
  );
}

/**
 * The prize, as a ticket stub. Deliberately the one ornamental object on the
 * page; everything else stays a plain standings sheet.
 */
function PrizeTicket({ settings }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border p-5"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-brass) 40%, transparent)',
        background: 'color-mix(in srgb, var(--color-brass) 9%, var(--card))',
      }}
    >
      <div
        className="absolute inset-y-0 left-12 w-px"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, color-mix(in srgb, var(--color-brass) 55%, transparent) 0 5px, transparent 5px 11px)',
        }}
        aria-hidden="true"
      />
      <div className="pl-10">
        <div className="min-w-0">
          <p className="mono text-xs font-semibold" style={{ color: 'var(--color-brass)' }}>
            Season prize, first place
          </p>
          <p
            className="display mt-1 text-xl leading-tight font-extrabold"
            style={{ color: 'var(--ink)' }}
          >
            {settings.prize_title || 'Meta Ray-Ban Display Glasses'}
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {settings.prize_blurb ||
              'First place at the end of the year takes them home. Every meeting, project, and competition counts.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- loading ------------------------------- */

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading standings">
      <div className="mb-14 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-44" />
        <Skeleton className="h-52" />
        <Skeleton className="h-44" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- podium -------------------------------- */

// Rank order on mobile (1,2,3 top to bottom); centre stage on desktop (2,1,3).
const DESKTOP_ORDER = ['md:order-2', 'md:order-1', 'md:order-3'];

function Podium({ podium }) {
  return (
    <section className="mb-14">
      <SectionTitle>Top three</SectionTitle>
      <div className="grid gap-4 md:grid-cols-3 md:items-end">
        {podium.map((s, i) => (
          <PodiumCard key={s.id} student={s} className={DESKTOP_ORDER[i]} />
        ))}
      </div>
    </section>
  );
}

function PodiumCard({ student, className = '' }) {
  const tier = tierFor(student.points);
  const isFirst = student.rank === 1;
  const next = nextTier(student.points);

  return (
    <Link
      to={`/student/${student.id}`}
      className={`relative block overflow-hidden rounded-lg border no-underline transition-transform duration-200 hover:-translate-y-0.5 ${isFirst ? 'md:pb-2' : ''} ${className}`}
      style={{
        borderColor: `color-mix(in srgb, ${tier.color} 35%, var(--rule))`,
        background: `color-mix(in srgb, ${tier.color} ${isFirst ? 14 : 9}%, var(--card))`,
      }}
    >
      <div className="h-1.5" style={{ background: tier.color }} aria-hidden="true" />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className="mono text-6xl leading-none font-bold"
            style={{ color: isFirst ? 'var(--color-brass)' : tier.color }}
          >
            {student.rank}
          </span>
          {isFirst && (
            <span
              className="mono max-w-[60%] truncate rounded-md px-2 py-1 text-xs font-bold"
              style={{
                color: 'var(--color-brass)',
                background: 'color-mix(in srgb, var(--color-brass) 14%, transparent)',
              }}
            >
              Prize winner
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Avatar name={student.name} seed={student.avatar_seed} points={student.points} size={44} />
          <div className="min-w-0">
            <p className="display truncate text-lg font-bold" style={{ color: 'var(--ink)' }}>
              {student.name}
            </p>
            <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
              {student.grade ? `Grade ${student.grade}` : 'Member'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <CountUp
              value={student.points}
              className="mono block text-4xl leading-none font-bold"
              style={{ color: 'var(--ink)' }}
            />
            <p className="mono mt-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
              {next ? `${next.min - student.points} to ${next.name}` : 'Top tier'}
            </p>
          </div>
          <TierMark points={student.points} />
        </div>

        {student.badges.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {student.badges.slice(0, 3).map((b) => (
              <BadgeChip key={b.id} badge={b} />
            ))}
            {student.badges.length > 3 && (
              <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                +{student.badges.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

/* -------------------------------- table -------------------------------- */

function StandingsTable({ rows, total }) {
  if (!rows.length) return null;
  return (
    <section className="min-w-0">
      <SectionTitle aside={`${total} members`}>Everyone else</SectionTitle>
      <table className="w-full border-collapse">
        <caption className="sr-only">Club standings, ranks 4 and below</caption>
        <thead>
          <tr className="mono text-xs uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>
            <th scope="col" className="w-12 py-2 pr-3 text-left font-semibold">
              #
            </th>
            <th scope="col" className="py-2 pr-3 text-left font-semibold">
              Member
            </th>
            <th scope="col" className="hidden py-2 pr-3 text-left font-semibold sm:table-cell">
              Tier
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              Points
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s, i) => (
            <RankRow key={s.id} student={s} index={i} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RankRow({ student, index }) {
  const tier = tierFor(student.points);
  return (
    <tr
      className="transition-colors hover:bg-paper-2"
      style={{ animation: `row-in 0.35s ease-out ${Math.min(index * 0.03, 0.3)}s backwards` }}
    >
      <td className="py-3 pr-3">
        <span className="mono text-xl font-bold" style={{ color: tier.color }}>
          {student.rank}
        </span>
      </td>
      <td className="py-3 pr-3">
        <Link
          to={`/student/${student.id}`}
          className="flex min-w-0 items-center gap-3 no-underline"
        >
          <Avatar name={student.name} seed={student.avatar_seed} points={student.points} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {student.name}
            </span>
            <span className="mono flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
              {student.grade ? `Grade ${student.grade}` : 'Member'}
              {student.badges.slice(0, 2).map((b) => (
                <span key={b.id} title={b.name} aria-label={b.name}>
                  {b.emoji}
                </span>
              ))}
            </span>
          </span>
        </Link>
      </td>
      <td className="hidden py-3 pr-3 sm:table-cell">
        <TierMark points={student.points} />
      </td>
      <td className="py-3 text-right">
        <span className="mono text-lg font-bold" style={{ color: 'var(--ink)' }}>
          {student.points}
        </span>
      </td>
    </tr>
  );
}

/* ------------------------------- activity ------------------------------- */

function RecentActivity({ recent }) {
  return (
    <section>
      <SectionTitle>Latest awards</SectionTitle>
      {recent.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Nothing awarded yet. The first award will show up here.
        </p>
      ) : (
        <ol className="divide-y">
          {recent.map((e, i) => (
            <li
              key={e.id}
              className="flex gap-3 py-3"
              style={{ animation: `row-in 0.35s ease-out ${Math.min(i * 0.04, 0.3)}s backwards` }}
            >
              <span
                className="mono w-10 shrink-0 text-right text-base font-bold"
                style={{ color: e.delta >= 0 ? 'var(--ok)' : 'var(--danger)' }}
              >
                {e.delta > 0 ? '+' : ''}
                {e.delta}
              </span>
              <span className="min-w-0">
                <Link
                  to={`/student/${e.student_id}`}
                  className="block truncate text-sm font-semibold no-underline hover:underline"
                  style={{ color: 'var(--ink)' }}
                >
                  {e.name}
                </Link>
                <span className="block text-sm" style={{ color: 'var(--ink-soft)' }}>
                  {e.reason || 'No reason recorded'}
                </span>
                <span className="mono block text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {relativeDate(e.created_at)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------ tier ladder ------------------------------ */

function TierLadder({ students }) {
  const counts = new Map();
  for (const s of students) {
    const t = tierFor(s.points).name;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  return (
    <section>
      <SectionTitle>How tiers work</SectionTitle>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Your color is your standing. Everyone has a threshold in front of them, not just the top
        three. Crossing into the next tier is its own win.
      </p>

      <ol className="grid grid-cols-7 items-end gap-1 sm:gap-2">
        {TIERS.map((t, i) => {
          const n = counts.get(t.name) ?? 0;
          return (
            <li key={t.name} className="min-w-0">
              <div
                className="flex items-end justify-center rounded-t-md pb-2"
                style={{
                  background: t.color,
                  height: `${2.75 + i * 0.55}rem`,
                  color: 'var(--on-flag)',
                }}
              >
                <span className="mono text-lg leading-none font-bold" aria-label={`${n} members`}>
                  {n}
                </span>
              </div>
              <div className="mt-2 hidden sm:block">
                <p className="mono truncate text-xs font-bold" style={{ color: t.color }}>
                  {t.name}
                </p>
                <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {t.min}+
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:hidden">
        {TIERS.map((t) => (
          <div key={t.name} className="flex items-baseline gap-2">
            <dt className="mono text-xs font-bold" style={{ color: t.color }}>
              {t.name}
            </dt>
            <dd className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
              {t.min}+
            </dd>
          </div>
        ))}
      </dl>

      <ul
        className="mt-6 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3"
        style={{ color: 'var(--ink-soft)' }}
      >
        {TIERS.map((t) => (
          <li key={t.name} className="flex gap-2">
            <span className="mono font-bold" style={{ color: t.color }}>
              {t.name}
            </span>
            <span>{t.blurb}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
