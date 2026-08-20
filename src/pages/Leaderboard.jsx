import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { tierFor, TIERS } from '../lib/tiers.js';
import { Avatar, TierMark, TierProgress, BadgeChip, CountUp, Spinner, ErrorNote, Empty } from '../components/bits.jsx';

export default function Leaderboard({ settings }) {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api
      .get('/leaderboard')
      .then((d) => setStudents(d.students))
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!students) return <Spinner label="Loading standings" />;

  const podium = students.slice(0, 3);
  const rest = students.slice(3);
  const totalPoints = students.reduce((n, s) => n + s.points, 0);

  return (
    <div>
      <Masthead settings={settings} count={students.length} totalPoints={totalPoints} />

      {students.length === 0 ? (
        <Empty title="No members yet">
          Add your first club members from the admin panel and they will appear here.
        </Empty>
      ) : (
        <>
          <Podium podium={podium} prizeTitle={settings.prize_title} />
          <Sheet rest={rest} startIndex={podium.length} />
          <TierLadder students={students} />
        </>
      )}
    </div>
  );
}

/* ------------------------------- masthead ------------------------------- */

function Masthead({ settings, count, totalPoints }) {
  return (
    <section className="mb-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <p className="eyebrow">Season standings</p>
        <h1
          className="display mt-2 text-[clamp(2.6rem,7vw,4.5rem)] leading-[0.92] font-extrabold"
          style={{ color: 'var(--ink)' }}
        >
          Every point
          <br />
          is on the record.
        </h1>
        <p className="mt-4 max-w-lg text-base" style={{ color: 'var(--ink-soft)' }}>
          {settings.tagline || 'Build things. Win things. Get better together.'} Points are
          awarded with a reason attached, so you can always see exactly where yours came from.
        </p>

        <dl className="mono mt-6 flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <div>
            <dt style={{ color: 'var(--ink-faint)' }}>Members</dt>
            <dd className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {count}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--ink-faint)' }}>Points awarded</dt>
            <dd className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {totalPoints}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--ink-faint)' }}>Tiers</dt>
            <dd className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {TIERS.length}
            </dd>
          </div>
        </dl>
      </div>

      <PrizeTicket settings={settings} />
    </section>
  );
}

/**
 * The prize, as a ticket stub. Deliberately the one ornamental object on the
 * page -- everything else stays a plain standings sheet.
 */
function PrizeTicket({ settings }) {
  return (
    <div
      className="relative w-full max-w-sm overflow-hidden rounded-lg border p-5 lg:w-80"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-brass) 40%, transparent)',
        background: 'color-mix(in srgb, var(--color-brass) 8%, var(--card))',
      }}
    >
      {/* perforation */}
      <div
        className="absolute inset-y-0 left-14 w-px"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, color-mix(in srgb, var(--color-brass) 55%, transparent) 0 5px, transparent 5px 11px)',
        }}
        aria-hidden="true"
      />
      <div className="flex gap-5">
        <div
          className="mono grid w-9 shrink-0 place-items-center text-[0.6rem] font-bold tracking-[0.3em]"
          style={{ color: 'var(--color-brass)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          1ST PLACE
        </div>
        <div className="min-w-0">
          <p className="eyebrow" style={{ color: 'color-mix(in srgb, var(--color-brass) 80%, var(--ink))' }}>
            Season prize
          </p>
          <p className="display mt-1 text-xl leading-tight font-extrabold" style={{ color: 'var(--ink)' }}>
            {settings.prize_title || 'Meta Ray-Ban Display Glasses'}
          </p>
          <p className="mt-2 text-[0.8rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {settings.prize_blurb ||
              'First place at the end of the year takes them home. Every meeting, project, and competition counts.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- podium -------------------------------- */

// Rank order on mobile (1,2,3 top to bottom); centre-stage order on desktop
// (2,1,3). Done with CSS order rather than a width check so it survives a resize.
const DESKTOP_ORDER = ['md:order-2', 'md:order-1', 'md:order-3'];

function Podium({ podium, prizeTitle }) {
  if (!podium.length) return null;
  return (
    <section className="mb-12">
      <h2 className="eyebrow mb-3">Top three</h2>
      <div className="flex flex-col items-stretch gap-4 md:grid md:grid-cols-3 md:items-end">
        {podium.map((s, i) => (
          <PodiumCard
            key={s.id}
            student={s}
            prizeTitle={prizeTitle}
            className={DESKTOP_ORDER[i]}
          />
        ))}
      </div>
    </section>
  );
}

function PodiumCard({ student, prizeTitle, className = '' }) {
  const tier = tierFor(student.points);
  const isFirst = student.rank === 1;

  return (
    <Link
      to={`/student/${student.id}`}
      className={`card group relative block overflow-hidden p-5 no-underline transition-transform duration-200 hover:-translate-y-0.5 ${className}`}
      style={{
        borderColor: isFirst ? 'color-mix(in srgb, var(--color-brass) 45%, transparent)' : 'var(--rule)',
        paddingTop: isFirst ? '2rem' : '1.25rem',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: tier.color }} aria-hidden="true" />

      {isFirst && (
        <p
          className="mono absolute top-2.5 right-4 text-[0.6rem] font-bold tracking-[0.16em]"
          style={{ color: 'var(--color-brass)' }}
        >
          WINS {(prizeTitle || 'THE PRIZE').toUpperCase()}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span
          className="mono text-4xl leading-none font-bold"
          style={{ color: isFirst ? 'var(--color-brass)' : 'var(--ink-faint)' }}
        >
          {student.rank}
        </span>
        <Avatar name={student.name} seed={student.avatar_seed} points={student.points} size={isFirst ? 52 : 44} />
        <div className="min-w-0">
          <p className="display truncate text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {student.name}
          </p>
          <p className="mono text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
            {student.grade ? `Grade ${student.grade}` : 'Member'}
          </p>
        </div>
        <div className="ml-auto text-right">
          <CountUp
            value={student.points}
            className="mono block text-3xl leading-none font-bold"
            style={{ color: 'var(--ink)' }}
          />
          <span className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
            points
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <TierMark points={student.points} />
        {student.badges.slice(0, 3).map((b) => (
          <BadgeChip key={b.id} badge={b} />
        ))}
        {student.badges.length > 3 && (
          <span className="mono text-[0.6875rem]" style={{ color: 'var(--ink-faint)' }}>
            +{student.badges.length - 3}
          </span>
        )}
      </div>

      <TierProgress points={student.points} className="mt-4" />
    </Link>
  );
}

/* -------------------------------- sheet -------------------------------- */

function Sheet({ rest, startIndex }) {
  if (!rest.length) return null;
  return (
    <section className="mb-12">
      <h2 className="eyebrow mb-3">Everyone else</h2>
      <div className="card sheet-grain overflow-hidden p-0">
        <div
          className="mono hidden grid-cols-[3rem_1fr_9rem_5rem] gap-4 border-b px-4 py-2.5 text-[0.65rem] font-semibold tracking-[0.12em] uppercase sm:grid"
          style={{ color: 'var(--ink-faint)' }}
        >
          <span>Rank</span>
          <span>Member</span>
          <span>Tier</span>
          <span className="text-right">Points</span>
        </div>
        {rest.map((s, i) => (
          <RankRow key={s.id} student={s} index={startIndex + i} />
        ))}
      </div>
    </section>
  );
}

function RankRow({ student, index }) {
  const tier = tierFor(student.points);
  return (
    <Link
      to={`/student/${student.id}`}
      className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b px-4 py-3 no-underline transition-colors last:border-b-0 sm:grid-cols-[3rem_1fr_9rem_5rem]"
      style={{ animation: `row-in 0.4s ease-out ${Math.min(index * 0.03, 0.5)}s backwards` }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span className="mono text-sm font-semibold" style={{ color: 'var(--ink-faint)' }}>
        {String(student.rank).padStart(2, '0')}
      </span>

      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={student.name} seed={student.avatar_seed} points={student.points} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {student.name}
          </span>
          <span className="mono flex flex-wrap items-center gap-1.5 text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
            {student.grade ? `Grade ${student.grade}` : 'Member'}
            {student.badges.slice(0, 2).map((b) => (
              <span key={b.id} title={b.name} aria-hidden="true">
                {b.emoji}
              </span>
            ))}
          </span>
        </span>
      </span>

      <span className="hidden sm:block">
        <TierMark points={student.points} />
      </span>

      <span className="text-right">
        <span className="mono block text-base font-bold" style={{ color: tier.color }}>
          {student.points}
        </span>
      </span>
    </Link>
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
      <h2 className="eyebrow mb-3">How tiers work</h2>
      <div className="card p-5">
        <p className="mb-5 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Your colour is your standing. Everyone has a threshold in front of them, not just the
          top three — crossing into the next tier is its own win.
        </p>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <li key={t.name} className="flex items-start gap-3">
              <span
                className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ background: t.color }}
                aria-hidden="true"
              />
              <span>
                <span className="mono block text-xs font-bold" style={{ color: t.color }}>
                  {t.name}
                  <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> · {t.min}+</span>
                </span>
                <span className="block text-[0.78rem]" style={{ color: 'var(--ink-soft)' }}>
                  {t.blurb}
                </span>
                <span className="mono block text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                  {counts.get(t.name) ?? 0} member{(counts.get(t.name) ?? 0) === 1 ? '' : 's'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
