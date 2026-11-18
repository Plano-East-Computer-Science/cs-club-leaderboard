/**
 * H3 reader mode: documentation as text and code only. The server fetches the
 * page and sends structured blocks; this renders them as React text nodes (no
 * HTML from the site ever reaches the DOM). Links inside the page that point at
 * readable sites stay in reader mode.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { useUser } from '../lib/useUser.js';

function Runs({ runs }) {
  return runs.map((r, i) => (r.to ? <Link key={i} className="g uline" to={r.to}>{r.s}</Link> : <span key={i}>{r.s}</span>));
}

function Block({ b }) {
  if (b.t === 'pre') return <pre className="mono rd-code" tabIndex={0}>{b.text}</pre>;
  if (b.t === 'h') {
    const H = `h${Math.min(6, Math.max(2, b.level + 1))}`; // the page title is the h1
    return <H className="rd-h"><Runs runs={b.runs} /></H>;
  }
  if (b.t === 'li') return <p className="rd-li"><span aria-hidden="true">- </span><Runs runs={b.runs} /></p>;
  return <p><Runs runs={b.runs} /></p>;
}

export default function Reader() {
  const [params] = useSearchParams();
  const url = params.get('url') || '';
  const nav = useNavigate();
  const { user, loading } = useUser();
  const [draft, setDraft] = useState(url);
  const [page, setPage] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [error, setError] = useState('');
  useReveal();

  useEffect(() => setDraft(url), [url]);
  useEffect(() => {
    if (!user) return;
    api.get('/read/hosts').then((d) => setHosts(d.hosts)).catch(() => {});
  }, [user]);
  useEffect(() => {
    setPage(null);
    setError('');
    if (!url || !user) return undefined;
    let off = false;
    api.get(`/read?url=${encodeURIComponent(url)}`)
      .then((d) => { if (!off) { setPage(d); window.scrollTo(0, 0); } })
      .catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [url, user]);

  const go = (e) => {
    e.preventDefault();
    if (draft.trim()) nav(`/read?url=${encodeURIComponent(draft.trim())}`);
  };

  if (loading) return <div className="state-note">loading...</div>;
  if (!user) {
    return (
      <div className="wrap">
        <p className="state-note">Reader mode is for signed-in members. <Link className="g uline" to="/signin">Sign in</Link> and come back.</p>
      </div>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="read"
        title="Reader mode"
        lead="Documentation as plain text and code. Nothing from the site runs here, so it also loads fast on a school machine."
      />
      <div className="wrap rd">
        <Pane file="address.txt" meta="https only">
          <form className="pn-b rd-form" onSubmit={go}>
            <label className="eb" htmlFor="rd-url">Page to read</label>
            <input id="rd-url" className="field" type="url" value={draft} placeholder="https://docs.python.org/3/tutorial/" onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
            <button className="btn" disabled={!draft.trim()}>Read</button>
          </form>
          {hosts.length > 0 && <p className="mono d rd-hosts">Works for: {hosts.join(', ')}</p>}
        </Pane>

        {error && <p className="mono" role="alert" style={{ color: 'var(--down)' }}>{error}</p>}
        {url && !page && !error && <p className="state-note">fetching...</p>}
        {page && (
          <Pane file={page.title || 'page'} meta={new URL(page.url).host}>
            <article className="pn-b rd-body">
              <h1 className="rd-title">{page.title || page.url}</h1>
              {page.blocks.length === 0 && <p className="d">There was no readable text on that page.</p>}
              {page.blocks.map((b, i) => <Block key={i} b={b} />)}
              {page.truncated && <p className="mono d">The page was cut short because it is very long.</p>}
              <p className="mono d">Source: {page.url}</p>
            </article>
          </Pane>
        )}
      </div>
    </>
  );
}
