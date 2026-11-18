import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';
import RepoStats from '../components/RepoStats.jsx';

export const TRACKS = {
  cp: 'Competitive programming',
  cyber: 'Cybersecurity',
  projects: 'Projects and tools',
  llm: 'LLMs and AI',
  data: 'Data analysis',
  circuits: 'Circuits and hardware',
};

function day(v) {
  if (v == null) return '';
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const isHttps = (s) => {
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
};

export default function Projects({ embedded = false }) {
  const { user, loading } = useUser();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [track, setTrack] = useState('all');

  const load = useCallback(() => {
    setError(null);
    api.get('/projects').then((d) => setProjects(d.projects)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const remove = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await api.del(`/projects/${id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const shown = projects ? projects.filter((p) => track === 'all' || p.track === track) : [];

  return (
    <div>
      {!embedded && <header className="mb-8">
        <p className="eyebrow">Member projects</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          Things members built.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          Share what you have made, from a contest solution write-up to a hardware build.
        </p>
      </header>}

      {!loading && (user ? (
        <ShareForm onDone={load} />
      ) : (
        <p className="card mb-6 p-4 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Link to="/signin" style={{ color: 'var(--flag)', fontWeight: 600 }}>Sign in</Link> to share a
          project of your own.
        </p>
      ))}

      <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filter by track">
        {['all', ...Object.keys(TRACKS)].map((t) => {
          const active = track === t;
          return (
            <button
              key={t}
              onClick={() => setTrack(t)}
              aria-pressed={active}
              className="mono rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold transition-colors"
              style={{
                color: active ? 'light-dark(#fff, #0d1017)' : 'var(--ink-soft)',
                background: active ? 'var(--flag)' : 'transparent',
                borderColor: active ? 'var(--flag)' : 'var(--rule)',
              }}
            >
              {t === 'all' ? 'All' : TRACKS[t]}
            </button>
          );
        })}
      </div>

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!projects && !error && <Spinner label="Loading projects" />}

      {projects && shown.length === 0 && (
        <Empty title={projects.length ? 'Nothing in this track yet' : 'No projects yet. Post the first one.'}>
          Be the first to share something. If GitHub is blocked at school, the{' '}
          <Link to="/gateway" style={{ color: 'var(--flag)' }}>gateway</Link> gets you to it during meetings.
        </Empty>
      )}

      {shown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((p) => (
            <article key={p.id} className="card flex flex-col p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span
                  className="mono rounded border px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase"
                  style={{ color: 'var(--flag)', background: 'var(--flag-soft)' }}
                >
                  {TRACKS[p.track] ?? p.track}
                </span>
                <span className="mono text-[0.68rem]" style={{ color: 'var(--ink-faint)' }}>
                  {day(p.created_at)}
                </span>
              </div>
              <h2 className="display text-lg leading-snug font-bold">{p.title}</h2>
              <p className="mono mt-0.5 text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
                by{' '}
                <Link to={`/u/${p.user_id}`} style={{ color: 'var(--ink-soft)', textDecoration: 'underline' }}>
                  {p.author}
                </Link>
              </p>
              <p className="mt-3 flex-1 text-[0.85rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {p.description}
              </p>
              <RepoStats stats={p.stats} />
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                {p.repo_url && (
                  <a className="btn btn-ghost" style={{ textDecoration: 'none' }} href={p.repo_url} target="_blank" rel="noreferrer noopener">
                    Repo ↗
                  </a>
                )}
                {p.demo_url && (
                  <a className="btn btn-ghost" style={{ textDecoration: 'none' }} href={p.demo_url} target="_blank" rel="noreferrer noopener">
                    Demo ↗
                  </a>
                )}
                {user && user.id === p.user_id && (
                  <button className="btn btn-danger ml-auto" onClick={() => remove(p.id)}>
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ShareForm({ onDone }) {
  const blank = { title: '', description: '', track: 'projects', repo_url: '', demo_url: '' };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.title.trim()) errs.title = 'Give it a title.';
    if (!f.description.trim()) errs.description = 'Say what it is.';
    if (!isHttps(f.repo_url.trim())) errs.repo_url = 'Repo link must be an https:// URL.';
    if (f.demo_url.trim() && !isHttps(f.demo_url.trim())) errs.demo_url = 'Demo link must be an https:// URL.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await api.post('/projects', {
        title: f.title.trim(),
        description: f.description.trim(),
        track: f.track,
        repo_url: f.repo_url.trim(),
        demo_url: f.demo_url.trim(),
      });
      setF(blank);
      setOpen(false);
      onDone();
    } catch (err) {
      setErrors({ form: err.status === 401 ? 'Your session ended. Sign in again.' : err.message });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="btn btn-primary mb-6" onClick={() => setOpen(true)}>
        Share a project
      </button>
    );
  }

  const Err = ({ k }) =>
    errors[k] ? <span className="mono text-xs" style={{ color: '#c42e2e' }}>{errors[k]}</span> : null;

  return (
    <form onSubmit={submit} className="card mb-6 grid gap-3 p-5" noValidate>
      <p className="eyebrow">Share a project</p>
      <label className="grid gap-1.5">
        <span className="eyebrow">Title</span>
        <input className="field" value={f.title} maxLength={80} onChange={set('title')} />
        <Err k="title" />
      </label>
      <label className="grid gap-1.5">
        <span className="eyebrow">Description</span>
        <textarea className="field" rows={3} value={f.description} maxLength={500} onChange={set('description')} />
        <Err k="description" />
      </label>
      <label className="grid gap-1.5">
        <span className="eyebrow">Track</span>
        <select className="field" value={f.track} onChange={set('track')}>
          {Object.entries(TRACKS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="eyebrow">Repo URL</span>
          <input className="field" type="url" placeholder="https://github.com/you/thing" value={f.repo_url} onChange={set('repo_url')} />
          <Err k="repo_url" />
        </label>
        <label className="grid gap-1.5">
          <span className="eyebrow">Demo URL (optional)</span>
          <input className="field" type="url" placeholder="https://" value={f.demo_url} onChange={set('demo_url')} />
          <Err k="demo_url" />
        </label>
      </div>
      {errors.form && <p className="mono text-xs" style={{ color: '#c42e2e' }}>{errors.form}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Posting' : 'Post project'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
