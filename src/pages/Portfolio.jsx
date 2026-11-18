import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Spinner, ErrorNote } from '../components/bits.jsx';
import RepoStats from '../components/RepoStats.jsx';

const TRACKS = {
  cp: 'Competitive programming',
  cyber: 'Cybersecurity',
  projects: 'Projects and tools',
  llm: 'LLMs and AI',
  data: 'Data analysis',
  labs: 'Labs',
  circuits: 'Circuits and hardware',
};

function day(v) {
  if (v == null) return '';
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const PRINT_CSS = `
@media print {
  header, nav, footer, .no-print { display: none !important; }
  body { background: #fff !important; color: #000 !important; }
  .pf-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; }
  .pf-sheet, .pf-sheet * { color: #000 !important; }
  .pf-item { break-inside: avoid; }
  a { text-decoration: none; }
}`;

export default function Portfolio() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api.get(`/portfolio/${encodeURIComponent(id)}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Spinner label="Loading portfolio" />;

  const courses = data.courses ?? [];
  const projects = data.projects ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <style>{PRINT_CSS}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>← Back to the club</Link>
        <button className="btn btn-primary" onClick={() => window.print()}>Print / save as PDF</button>
      </div>

      <article className="pf-sheet card p-8 sm:p-10">
        <div className="border-b pb-5">
          <p className="eyebrow">Computer Science Club record</p>
          <h1 className="display mt-2 text-4xl font-extrabold">{data.name}</h1>
          <p className="mono mt-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
            Member since {day(data.since) || 'this year'} · {data.meetings} meeting{data.meetings === 1 ? '' : 's'} attended
            {data.rank && <> · club rank: <b style={{ color: 'var(--flag)' }}>{data.rank}</b>, {data.points} lifetime points</>}
          </p>
          {data.badges?.length > 0 && (
            <p className="mono mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
              Earned: {data.badges.join(' · ')}
            </p>
          )}
        </div>

        <section className="mt-6">
          <h2 className="eyebrow mb-3">Courses</h2>
          {courses.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>No courses started yet.</p>
          ) : (
            <ul className="grid gap-3">
              {courses.map((c) => (
                <li key={c.slug} className="pf-item flex flex-wrap items-baseline justify-between gap-x-4">
                  <div>
                    <span className="font-semibold">{c.title}</span>
                    <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
                      {TRACKS[c.track] ?? c.track}
                    </span>
                  </div>
                  <span
                    className="mono text-xs font-semibold"
                    style={{ color: c.complete ? '#2f8f5b' : 'var(--ink-soft)' }}
                  >
                    {c.complete ? 'Completed' : `${c.passed} of ${c.steps} steps`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="eyebrow mb-3">Projects</h2>
          {projects.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>No projects shared yet.</p>
          ) : (
            <ul className="grid gap-5">
              {projects.map((p) => (
                <li key={p.id} className="pf-item">
                  <p className="font-semibold">
                    {p.title}
                    <span className="mono ml-2 text-xs font-normal" style={{ color: 'var(--ink-faint)' }}>
                      {TRACKS[p.track] ?? p.track}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                    {p.description}
                  </p>
                  <p className="mono mt-1 text-xs break-all" style={{ color: 'var(--ink-soft)' }}>
                    {p.repo_url && <a href={p.repo_url} target="_blank" rel="noreferrer noopener">{p.repo_url}</a>}
                    {p.repo_url && p.demo_url && ' · '}
                    {p.demo_url && <a href={p.demo_url} target="_blank" rel="noreferrer noopener">{p.demo_url}</a>}
                  </p>
                  <RepoStats stats={p.stats} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  );
}
