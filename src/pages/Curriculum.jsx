import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';

const TRACKS = [
  { id: 'fall', label: 'Fall — Beginner', blurb: 'Print statements to object-oriented programming. No experience assumed.' },
  { id: 'spring', label: 'Spring — Advanced', blurb: 'Searching, sorting, data structures, graphs, and dynamic programming.' },
];

export default function Curriculum() {
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.get('/curriculum').then((d) => setTopics(d.topics)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!topics) return <Spinner label="Loading curriculum" />;

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">The Java track</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          What we teach, all year.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          Beginners and returning members are both covered — the fall track assumes nothing, the
          spring track goes further. A checked topic has already been taught this year.
        </p>
      </header>

      {topics.length === 0 ? (
        <Empty title="No topics posted yet">Check back once the roadmap is up.</Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {TRACKS.map((track) => {
            const items = topics.filter((t) => t.track === track.id);
            if (!items.length) return null;
            const done = items.filter((t) => t.covered).length;
            return (
              <section key={track.id} className="card p-5">
                <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
                  {track.label}
                </h2>
                <p className="mt-1 text-[0.8rem]" style={{ color: 'var(--ink-soft)' }}>
                  {track.blurb}
                </p>
                <p className="mono mt-3 mb-3 text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                  {done} of {items.length} covered so far
                </p>
                <ol className="grid gap-2">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 text-sm">
                      <span
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.65rem] font-bold"
                        style={{
                          borderColor: t.covered ? 'var(--flag)' : 'var(--rule)',
                          background: t.covered ? 'var(--flag)' : 'transparent',
                          color: t.covered ? 'light-dark(#fff, #0d1017)' : 'var(--ink-faint)',
                        }}
                        aria-hidden="true"
                      >
                        {t.covered ? '✓' : ''}
                      </span>
                      <span style={{ color: t.covered ? 'var(--ink)' : 'var(--ink-soft)' }}>{t.title}</span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
