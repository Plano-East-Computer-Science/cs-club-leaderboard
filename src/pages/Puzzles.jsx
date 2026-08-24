import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';

export default function Puzzles() {
  const [puzzles, setPuzzles] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/puzzles').then((d) => setPuzzles(d.puzzles)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!puzzles) return <Spinner label="Loading puzzles" />;

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">What practice looks like</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          Puzzle archive.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          Every meeting opens with one of these. No syntax, no compiler — just the part of
          computer science that is actually thinking.
        </p>
      </header>

      {puzzles.length === 0 ? (
        <Empty title="No puzzles posted yet" />
      ) : (
        <div className="grid gap-4">
          {puzzles.map((p) => (
            <PuzzleCard key={p.id} puzzle={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PuzzleCard({ puzzle }) {
  const [shown, setShown] = useState(false);
  const hasAnswer = Boolean(puzzle.answer?.trim());

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
          {puzzle.title}
        </h2>
        <span className="mono text-[0.68rem]" style={{ color: 'var(--ink-faint)' }}>
          {formatDate(puzzle.posted_at)}
        </span>
      </div>
      <p className="mt-2 text-[0.9rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {puzzle.prompt}
      </p>

      <div className="mt-4 border-t pt-4">
        {!hasAnswer ? (
          <p className="mono text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
            Answer not posted yet.
          </p>
        ) : shown ? (
          <div>
            <p className="eyebrow mb-2">Solution</p>
            <p className="whitespace-pre-line text-[0.85rem] leading-relaxed" style={{ color: 'var(--ink)' }}>
              {puzzle.answer}
            </p>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => setShown(true)}>
            Show solution
          </button>
        )}
      </div>
    </article>
  );
}
