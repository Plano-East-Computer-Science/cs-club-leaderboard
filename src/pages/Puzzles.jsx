import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';

export default function Puzzles() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/puzzles').then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!data) return <Spinner label="Loading puzzles" />;

  const current = data.current;
  // The featured puzzle is already in the archive list; showing it twice would
  // just be the same card printed under two headings.
  const archive = data.puzzles.filter((p) => p.id !== current?.id);

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">What practice looks like</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          Problem of the Week.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          Every meeting opens with one of these. No syntax, no compiler — just the part of
          computer science that is actually thinking. Hints are there when you are stuck; the
          solution is there when you are done. Reading either one costs you nothing but the point
          of doing it yourself.
        </p>
      </header>

      {current && (
        <section className="mb-10">
          <PuzzleCard puzzle={current} featured />
        </section>
      )}

      {archive.length === 0 ? (
        !current && <Empty title="No puzzles posted yet" />
      ) : (
        <section>
          <h2 className="eyebrow mb-3">{current ? 'Earlier problems' : 'Archive'}</h2>
          <div className="grid gap-4">
            {archive.map((p) => (
              <PuzzleCard key={p.id} puzzle={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const DIFFICULTY_COLORS = { easy: '#2f8f5b', medium: '#b8720e', hard: '#c42e2e' };

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

  return (
    <article
      className="card p-5"
      style={featured ? { borderColor: 'var(--flag)', borderWidth: 2 } : undefined}
    >
      {featured && <p className="eyebrow mb-2">This week</p>}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className={`display font-bold ${featured ? 'text-2xl' : 'text-lg'}`}
          style={{ color: 'var(--ink)' }}
        >
          {puzzle.title}
        </h2>
        <div className="flex items-center gap-2">
          {difficultyColor && (
            <span
              className="mono rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
              style={{
                color: difficultyColor,
                background: `color-mix(in srgb, ${difficultyColor} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${difficultyColor} 28%, transparent)`,
              }}
            >
              {puzzle.difficulty}
            </span>
          )}
          <span className="mono text-[0.68rem]" style={{ color: 'var(--ink-faint)' }}>
            {formatDate(puzzle.posted_at)}
          </span>
        </div>
      </div>

      <p
        className={`mt-2 whitespace-pre-line leading-relaxed ${featured ? 'text-[0.95rem]' : 'text-[0.9rem]'}`}
        style={{ color: 'var(--ink-soft)' }}
      >
        {puzzle.prompt}
      </p>

      {hints.length > 0 && (
        <div className="mt-4 grid gap-2">
          {hints.slice(0, hintsShown).map((h, i) => (
            <div
              key={i}
              className="rounded p-3 text-[0.85rem] leading-relaxed"
              style={{ background: 'var(--paper-2)', color: 'var(--ink-soft)' }}
            >
              <span className="mono mr-2 text-[0.65rem] font-semibold" style={{ color: 'var(--ink-faint)' }}>
                HINT {i + 1}
              </span>
              {h}
            </div>
          ))}
          {hintsShown < hints.length && (
            <button className="btn btn-ghost justify-self-start" onClick={() => setHintsShown((n) => n + 1)}>
              {hintsShown === 0 ? `Show a hint (${hints.length} available)` : 'Next hint'}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 border-t pt-4">
        {!hasAnswer ? (
          <p className="mono text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
            Solution posted after the next meeting.
          </p>
        ) : solved ? (
          <div>
            <p className="eyebrow mb-2">Solution</p>
            <p className="whitespace-pre-line text-[0.85rem] leading-relaxed" style={{ color: 'var(--ink)' }}>
              {puzzle.answer}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-ghost" onClick={() => setSolved(true)}>
              Show solution
            </button>
            <span className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
              No points for reading it — that is the whole deal.
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
