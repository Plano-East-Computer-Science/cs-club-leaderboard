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

const KIND = { compete: 'Competed in', place: 'Placed in', ship: 'Shipped' };
const ymd = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');

// Light page, no site chrome. Chrome is the tab bar, dock, footer, boot and snow layers.
const PRINT_CSS = `
@media print {
  .tabs, .dock, footer, #boot, #snow, .no-print { display: none !important; }
  html, body { background: #fff !important; color: #000 !important; padding: 0 !important; }
  .hub { padding: 0 !important; max-width: none !important; }
  .pf-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; background: #fff !important; }
  .pf-sheet, .pf-sheet * { color: #000 !important; background: transparent !important; }
  .pf-item { break-inside: avoid; }
  a { text-decoration: none; }
}`;

export default function Portfolio() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const setPublic = async (on) => {
    setBusy(true);
    try {
      await api.put('/me/portfolio', { public: on });
      setData((d) => ({ ...d, public: on }));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  // A page about a minor is not for search engines.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    api.get(`/portfolio/${encodeURIComponent(id)}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Spinner label="Loading portfolio" />;

  const courses = data.courses ?? [];
  const projects = data.projects ?? [];
  const results = data.results ?? [];
  const signoffs = data.signoffs ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <style>{PRINT_CSS}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>← Back to the club</Link>
        <button className="btn pri" onClick={() => window.print()}>Print / save as PDF</button>
      </div>

      {data.owner && (
        <div className="no-print card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            {data.public
              ? 'Anyone with this link can see this page. It shows your first name unless you chose to show your full name, and never your email or grade.'
              : 'Only you can see this page. Make it public to share the link on an application.'}
          </p>
          <button className="btn" disabled={busy} onClick={() => setPublic(!data.public)}>
            {data.public ? 'Make private' : 'Make public'}
          </button>
        </div>
      )}

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

        {signoffs.length > 0 && (
          <section className="mt-6" aria-label="Signed by officers">
            <h2 className="eyebrow mb-3">From the officers</h2>
            <ul className="grid gap-3">
              {signoffs.map((g) => (
                <li key={g.id} className="pf-item">
                  <p className="leading-relaxed">{g.line}</p>
                  <p className="mono mt-1 text-xs" style={{ color: 'var(--ink-faint)' }}>Signed {g.by}, {ymd(g.date)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {results.length > 0 && (
          <section className="mt-8" aria-label="Approved results">
            <h2 className="eyebrow mb-3">Competitions and shipped work</h2>
            <ul className="grid gap-2">
              {results.map((r, i) => (
                <li key={i} className="pf-item flex flex-wrap items-baseline justify-between gap-x-4">
                  <span>
                    <span className="font-semibold">{KIND[r.kind] ?? r.kind}</span> {r.title}
                    {r.place ? <span className="mono ml-2 text-xs">place {r.place}</span> : null}
                  </span>
                  <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{ymd(r.date)}</span>
                </li>
              ))}
            </ul>
            <p className="mono mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>Each line was approved by a club officer.</p>
          </section>
        )}

        <section className="mt-8">
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

        {data.artifacts?.length > 0 && (
          <section className="mt-8" aria-label="Shown at meetings">
            <h2 className="eyebrow mb-3">Shown at meetings</h2>
            <ul className="grid gap-4">
              {data.artifacts.map((a) => (
                <li key={a.id} className="pf-item">
                  <p className="font-semibold">
                    {a.line}
                    {a.shown ? <span className="mono ml-2 text-xs font-normal" style={{ color: 'var(--flag)' }}>on the projector</span> : null}
                  </p>
                  <p className="mono mt-1 text-xs break-all" style={{ color: 'var(--ink-soft)' }}>
                    {a.url ? <a href={a.url} target="_blank" rel="noreferrer noopener">{a.url}</a> : a.result}
                  </p>
                  <p className="mono mt-0.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {a.meeting || 'Meeting'} · {day(a.created_at)}
                    {a.kudos > 0 && ` · ${a.kudos} kudos`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

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
