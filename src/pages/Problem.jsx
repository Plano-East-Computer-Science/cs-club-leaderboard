/**
 * /p/<slug>: one problem from the bank (C2) with the in-browser judge. Passing
 * every test ticks any Board rung that points here (C1).
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { warmUp } from '../lib/pyrunner.js';
import { Spinner, ErrorNote } from '../components/bits.jsx';
import CodeRunner from '../components/CodeRunner.jsx';
import { Body } from './Course.jsx';

export default function Problem() {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [solved, setSolved] = useState(null); // null | 'saved' | 'local'

  const load = () => {
    setError(null);
    setP(null);
    setSolved(null);
    api.get(`/problems/${encodeURIComponent(slug)}`).then((x) => {
      setP(x);
      warmUp();
    }).catch((e) => setError(e.message));
  };
  useEffect(load, [slug]);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!p) return <Spinner label="Loading problem" />;

  const onResults = async (_res, passed) => {
    if (!passed || solved) return;
    try {
      await api.post('/board/solve', { slug, passed: true });
      setSolved('saved');
    } catch {
      setSolved('local'); // signed out: the pass shows, nothing is saved
    }
  };

  return (
    <div className="pb-page">
      <header className="mb-6">
        <Link to="/arena" className="eyebrow hover:underline">Back to the board</Link>
        <h1 className="display mt-2 text-[clamp(1.8rem,5vw,2.8rem)] leading-[1] font-extrabold">{p.title}</h1>
        <p className="mono mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          Difficulty {p.difficulty} of 5{p.tags.length ? `, ${p.tags.join(', ')}` : ''}
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <article className="card p-5 min-w-0">
          <Body text={p.body} />
          {p.cases[0] && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0"><p className="eyebrow mb-1">Example input</p><pre className="mono overflow-auto rounded border p-2.5 text-[0.8rem]">{p.cases[0].stdin || '(none)'}</pre></div>
              <div className="min-w-0"><p className="eyebrow mb-1">Example output</p><pre className="mono overflow-auto rounded border p-2.5 text-[0.8rem]">{p.cases[0].stdout}</pre></div>
            </div>
          )}
        </article>
        <section className="min-w-0" aria-label="Your solution">
          <CodeRunner id={`p-${p.slug}`} cases={p.cases} initial={p.starter} onResults={onResults} />
          {solved && (
            <p className="mt-4 text-sm" role="status" style={{ color: 'var(--up)' }}>
              {solved === 'saved' ? 'Solved. The rung is ticked on your board. ' : 'Solved. Sign in to save it to your board. '}
              <Link className="uline" to="/arena">Back to the board</Link>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
