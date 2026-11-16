import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { PageHeader, SectionTitle, Skeleton, ErrorNote } from '../components/bits.jsx';

export default function Puzzles() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/puzzles').then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const current = data?.current;
  // The featured puzzle is already in the archive list; showing it twice would
  // just be the same card printed under two headings.
  const archive = data?.puzzles.filter((p) => p.id !== current?.id) ?? [];

  return (
    <div>
      <PageHeader title="Problem of the Week">
        Every meeting opens with one of these. No syntax, no compiler, just the part of computer
        science that is actually thinking. Hints are there when you are stuck. The solution is
        there when you are done.
      </PageHeader>

      {error ? (
        <ErrorNote onRetry={load}>{error}</ErrorNote>
      ) : !data ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading puzzles">
          <Skeleton className="h-48" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : !current && archive.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          The first puzzle goes up at the first meeting.
        </p>
      ) : (
        <>
          {current && (
            <section className="mb-12">
              <PuzzleCard puzzle={current} featured />
            </section>
          )}

          {archive.length > 0 && (
            <section>
              <SectionTitle aside={`${archive.length} ${archive.length === 1 ? 'puzzle' : 'puzzles'}`}>
                Archive
              </SectionTitle>
              <ul className="divide-y">
                {archive.map((p, i) => (
                  <li
                    key={p.id}
                    className="py-5"
                    style={{ animation: `row-in 0.35s ease-out ${Math.min(i * 0.03, 0.3)}s backwards` }}
                  >
                    <PuzzleCard puzzle={p} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const DIFFICULTY_COLORS = { easy: 'var(--ok)', medium: 'var(--color-brass)', hard: 'var(--danger)' };

function PuzzleCard({ puzzle, featured = false }) {
  // Hints come out one at a time, so "I need a nudge" and "just tell me" stay
  // different actions.
  const [hintsShown, setHintsShown] = useState(0);
  const [solved, setSolved] = useState(false);

  const hints = (puzzle.hints ?? '')
    .split('\n')
    .map((h) => h.trim())
    .filter(Boolean);
  const hasAnswer = Boolean(puzzle.answer?.trim());
  const difficultyColor = DIFFICULTY_COLORS[String(puzzle.difficulty).toLowerCase()];
  const Heading = featured ? 'h2' : 'h3';

  return (
    <article
      className={featured ? 'rounded-lg border p-6' : ''}
      style={
        featured
          ? {
              background: 'color-mix(in srgb, var(--flag) 8%, var(--card))',
              borderColor: 'color-mix(in srgb, var(--flag) 30%, var(--rule))',
            }
          : undefined
      }
    >
      {featured && (
        <p className="mono mb-2 text-xs font-semibold" style={{ color: 'var(--flag)' }}>
          This week
        </p>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Heading
          className={`display font-bold ${featured ? 'text-2xl' : 'text-lg'}`}
          style={{ color: 'var(--ink)' }}
        >
          {puzzle.title}
        </Heading>
        <div className="flex items-center gap-2">
          {difficultyColor && (
            <span
              className="mono rounded-md px-2 py-0.5 text-xs font-semibold"
              style={{
                color: difficultyColor,
                background: `color-mix(in srgb, ${difficultyColor} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${difficultyColor} 28%, transparent)`,
              }}
            >
              {puzzle.difficulty}
            </span>
          )}
          <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
            {formatDate(puzzle.posted_at)}
          </span>
        </div>
      </div>

      <p
        className={`mt-2 max-w-2xl whitespace-pre-line leading-relaxed ${featured ? 'text-base' : 'text-sm'}`}
        style={{ color: featured ? 'var(--ink)' : 'var(--ink-soft)' }}
      >
        {puzzle.prompt}
      </p>

      {hints.length > 0 && (
        <div className="mt-4 grid max-w-2xl gap-2">
          {hints.slice(0, hintsShown).map((h, i) => (
            <div
              key={i}
              className="rounded-md p-3 text-sm leading-relaxed"
              style={{ background: 'var(--paper-2)', color: 'var(--ink-soft)' }}
            >
              <span className="mono mr-2 text-xs font-semibold" style={{ color: 'var(--ink-faint)' }}>
                Hint {i + 1}
              </span>
              {h}
            </div>
          ))}
          {hintsShown < hints.length && (
            <button
              type="button"
              className="btn btn-ghost justify-self-start"
              onClick={() => setHintsShown((n) => n + 1)}
            >
              {hintsShown === 0 ? `Show a hint (${hints.length} available)` : 'Next hint'}
            </button>
          )}
        </div>
      )}

      <div className="mt-4">
        {!hasAnswer ? (
          <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
            Solution posted after the next meeting.
          </p>
        ) : solved ? (
          <div className="max-w-2xl">
            <p className="mono mb-1 text-xs font-semibold" style={{ color: 'var(--ink-faint)' }}>
              Solution
            </p>
            <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
              {puzzle.answer}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => setSolved(true)}>
              Show solution
            </button>
            <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
              No points for reading the answer. That is the whole deal.
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
