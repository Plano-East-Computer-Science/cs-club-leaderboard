import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import ReportButton from '../components/ReportButton.jsx';
import { useReveal } from '../lib/ui.js';

/** D5: code review requests. /build/reviews lists open ones; /build/reviews/:id is one request. */
export default function Reviews() {
  const { id } = useParams();
  return id ? <Request id={id} /> : <List />;
}

const target = (r) => (r.kind === 'repo' ? r.repo_url.replace('https://github.com/', '') : r.file_name);

function List() {
  useReveal();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.get('/reviews').then(setD).catch((e) => setError(e.status === 401 ? 'signin' : e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error === 'signin') return <div className="state-note">Review requests are for members. <Link className="u" to="/signin">Sign in</Link></div>;
  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading...</div>;
  return (
    <>
      <PageHead
        eyebrow="build --review"
        title={<>Get a second pair of <em>eyes</em>.</>}
        lead="Ask for feedback on a repository or one workspace file. Leave a few kind, specific comments on someone else's. When a review helps, the person who asked marks it and you earn mentor points."
        kv={<div className="kv"><div><span>open requests</span><strong>{d.requests.length}</strong></div></div>}
      />
      <section className="sec">
        <div className="wrap cy-grid">
          <NewRequest d={d} reload={load} />
          <Pane file="open-requests" meta="newest first" spot={false}>
            {d.requests.length === 0 && <div className="pn-b"><p className="d">Nothing open right now.</p></div>}
            {d.requests.map((r) => (
              <div className="rv-row" key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <p><Link className="u" to={`/build/reviews/${r.id}`}>{target(r)}</Link> <span className="m">by {r.author}{r.mine ? ' (you)' : ''}</span></p>
                  <p className="d" style={{ fontSize: 13 }}>{r.ask}</p>
                  <p className="m" style={{ fontSize: 12 }}>{r.reviews} {r.reviews === 1 ? 'review' : 'reviews'}{r.reviewed ? ' · you reviewed this' : ''}</p>
                </div>
              </div>
            ))}
          </Pane>
        </div>
      </section>
    </>
  );
}

function NewRequest({ d, reload }) {
  const [kind, setKind] = useState('repo');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState(null);
  const [pick, setPick] = useState('');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (kind === 'file' && !files) api.get('/reviews/my-files').then((r) => setFiles(r.files)).catch((e) => setError(e.message));
  }, [kind, files]);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { kind, ask };
      if (kind === 'repo') body.repo_url = url;
      else {
        const [workspace_id, ...path] = pick.split(':');
        Object.assign(body, { workspace_id: Number(workspace_id), path: path.join(':') });
      }
      await api.post('/reviews', body);
      setUrl(''); setAsk(''); setPick('');
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pane file="ask-for-a-review" meta="shows your first name">
      <form className="pn-b" onSubmit={send} style={{ display: 'grid', gap: 12 }}>
        <div className="chips" role="group" aria-label="What to review">
          <button type="button" aria-pressed={kind === 'repo'} onClick={() => setKind('repo')}>GitHub repo</button>
          <button type="button" aria-pressed={kind === 'file'} onClick={() => setKind('file')}>Workspace file</button>
        </div>
        {kind === 'repo' ? (
          <input className="field" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" aria-label="Repository link" />
        ) : files && files.length === 0 ? (
          <p className="d">You have no workspace files under {d.limits.snapshotBytes / 1024} KB. <Link className="u" to="/workspace">Open the workspace</Link>.</p>
        ) : (
          <>
            <select className="field" required value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Workspace file">
              <option value="">Pick a file</option>
              {(files ?? []).map((f) => <option key={`${f.workspace_id}:${f.path}`} value={`${f.workspace_id}:${f.path}`}>{f.title} / {f.path}</option>)}
            </select>
            <p className="m" style={{ fontSize: 12 }}>A copy is shared with signed-in members while the request is open. Later edits stay private.</p>
          </>
        )}
        <textarea className="field" rows={3} maxLength={d.limits.ask} required value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="What do you want feedback on?" aria-label="What you want feedback on" />
        {error && <p className="dn" role="alert">{error}</p>}
        <div><button className="btn" disabled={busy || ask.trim().length < 10}>{busy ? 'Posting...' : 'Ask for a review'}</button></div>
      </form>
    </Pane>
  );
}

function Request({ id }) {
  useReveal();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.get(`/reviews/${id}`).then(setR).catch((e) => setError(e.status === 401 ? 'Sign in to see review requests.' : e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="state-note bad">{error} <Link className="u" to="/build/reviews">Back to requests</Link></div>;
  if (!r) return <div className="state-note">loading...</div>;
  const open = r.status === 'open';
  const lines = r.snapshot ? r.snapshot.split('\n') : [];
  const mineReviewed = r.reviews.some((v) => v.mine);

  const act = (path, then) => api.post(path).then(then ?? load).catch((e) => setError(e.message));
  return (
    <>
      <PageHead
        eyebrow="build --review"
        title={<>{target(r)}</>}
        lead={r.ask}
        one
        kv={<p className="m">asked by {r.author} · {open ? 'open' : 'closed'}</p>}
      />
      <section className="sec">
        <div className="wrap cy-grid">
          <div style={{ minWidth: 0, display: 'grid', gap: 16 }}>
            {r.kind === 'repo' ? (
              <Pane file="repository" meta="opens on GitHub">
                <div className="pn-b"><p><a className="u" href={r.repo_url} target="_blank" rel="noopener noreferrer">{r.repo_url}</a></p></div>
              </Pane>
            ) : (
              <Pane file={r.file_name} meta={open ? `read-only copy · ${lines.length} lines` : 'closed'} spot={false}>
                {open ? (
                  <pre className="rv-code" tabIndex={0} aria-label={`Code of ${r.file_name}`}>
                    {lines.map((l, i) => <div key={i}><span className="rv-n">{i + 1}</span>{l || ' '}</div>)}
                  </pre>
                ) : <div className="pn-b"><p className="d">The code is no longer shared.</p></div>}
              </Pane>
            )}
            <Pane file="reviews" meta={`${r.reviews.length} shown`} spot={false}>
              {r.reviews.length === 0 && <div className="pn-b"><p className="d">No reviews yet.</p></div>}
              {r.reviews.map((v) => (
                <div className="pn-b rv-rev" key={v.id}>
                  <p><b>{v.author}</b>{v.mine ? ' (you)' : ''} {v.status === 'accepted' && <span className="g">helpful</span>}</p>
                  <ul className="ul">
                    {v.comments.map((c, i) => <li key={i}>{c.line ? <span className="m">line {c.line}: </span> : null}{c.text}</li>)}
                  </ul>
                  {r.mine && v.status === 'posted' && <button type="button" className="btn" onClick={() => act(`/reviews/${v.id}/helpful`)}>Mark helpful</button>}
                  {!v.mine && !r.mine && <ReportButton kind="review" id={v.id} what="this review" />}
                </div>
              ))}
            </Pane>
          </div>
          {r.mine ? (
            <Pane file="your-request" meta="you asked">
              <div className="pn-b">
                <p className="d">Mark up to {r.limits.acceptedPerRequest} reviews helpful. Each one earns its author mentor points, once per person.</p>
                {open && <button type="button" className="btn" onClick={() => act(`/reviews/${r.id}/close`)}>Close request</button>}
              </div>
            </Pane>
          ) : open && !mineReviewed ? (
            <Write r={r} lines={lines.length} reload={load} />
          ) : (
            <Pane file="review"><div className="pn-b"><p className="d">{mineReviewed ? 'You reviewed this. Thank you.' : 'This request is closed.'}</p></div></Pane>
          )}
          {!r.mine && <p><ReportButton kind="review_request" id={r.id} what="this request" /></p>}
        </div>
      </section>
    </>
  );
}

function Write({ r, lines, reload }) {
  const [rows, setRows] = useState([{ line: '', text: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (i, k, v) => setRows((x) => x.map((row, j) => (j === i ? { ...row, [k]: v } : row)));

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/reviews/${r.id}/review`, { comments: rows.filter((x) => x.text.trim()).map((x) => ({ line: x.line === '' ? null : Number(x.line), text: x.text })) });
      await reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Pane file="leave-a-review" meta="shows your first name">
      <form className="pn-b" onSubmit={send} style={{ display: 'grid', gap: 10 }}>
        <p className="d" style={{ fontSize: 13 }}>Be specific and kind: what works, what to try next. At least {r.limits.reviewMinChars} characters in total.</p>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gap: 6 }}>
            {r.kind === 'file' && (
              <input className="field" type="number" min={1} max={lines} value={row.line} onChange={(e) => set(i, 'line', e.target.value)} placeholder="Line number (optional)" aria-label={`Line number for comment ${i + 1}`} />
            )}
            <textarea className="field" rows={2} maxLength={r.limits.commentChars} value={row.text} onChange={(e) => set(i, 'text', e.target.value)} placeholder={`Comment ${i + 1}`} aria-label={`Comment ${i + 1}`} />
          </div>
        ))}
        {rows.length < r.limits.comments && <div><button type="button" className="linkb" onClick={() => setRows([...rows, { line: '', text: '' }])}>Add another comment</button></div>}
        {error && <p className="dn" role="alert">{error}</p>}
        <div><button className="btn" disabled={busy}>{busy ? 'Posting...' : 'Post review'}</button></div>
      </form>
    </Pane>
  );
}
