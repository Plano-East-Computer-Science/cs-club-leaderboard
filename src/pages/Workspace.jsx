/**
 * D2: the workspace. A member's own multi-file projects, saved to their
 * account: Python runs in the browser (Pyodide, the same runner as lessons),
 * web pages preview in a sandboxed frame with no network. Replaces "can we
 * use Replit at school" (see H2 on the gateway page).
 *
 *   /workspace       your projects, make a new one
 *   /workspace/:id   the editor
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { useReveal } from '../lib/ui.js';
import { useCodeKeys } from '../lib/codeKeys.js';
import { runCases, warmUp } from '../lib/pyrunner.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { LIMITS, pathError, pythonProgram, buildPreview, zip } from '../../shared/workspace.js';

const SAVE_MS = 1500;
const RUN_MS = 10_000;
const ago = (s) => {
  const d = new Date(`${String(s).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function Workspace() {
  const { id } = useParams();
  return id ? <Editor id={id} /> : <List />;
}

/* ---------------------------------- list ---------------------------------- */

function List() {
  const { user, loading } = useUser();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  useReveal();
  const load = useCallback(() => api.get('/workspaces').then(setD).catch((e) => setError(e.message)), []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const make = async (kind) => {
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/workspaces', { kind });
      nav(`/workspace/${r.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  const remove = async (w) => {
    if (!window.confirm(`Delete "${w.title}" and all its files? This cannot be undone.`)) return;
    try {
      await api.del(`/workspaces/${w.id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="workspace"
        title="Your code, saved."
        lead="Write Python or a web page here at school and it is still here at home. Python runs in your browser and web pages preview right beside the code, both from this site, so they work on school wifi."
      />
      <section className="sec">
        <div className="wrap">
          {loading ? (
            <p className="state-note">loading...</p>
          ) : !user ? (
            <p className="state-note">
              <Link className="uline" to="/signin">Sign in</Link> to keep projects in your account.
            </p>
          ) : (
            <Pane file="projects" meta={d ? `${d.workspaces.length} of ${LIMITS.workspaces}` : ''}>
              <div className="pn-b">
                <div className="ar-row ws-new">
                  <button type="button" className="btn pri" disabled={busy} onClick={() => make('python')}>New Python project</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => make('web')}>New web page</button>
                  {error && <span className="dn" role="alert">{error}</span>}
                </div>
                {!d ? (
                  <p className="d">loading...</p>
                ) : d.workspaces.length === 0 ? (
                  <p className="d">Nothing yet. Start one above: it opens with a small example you can change.</p>
                ) : (
                  <ul className="ws-list">
                    {d.workspaces.map((w) => (
                      <li key={w.id}>
                        <Link to={`/workspace/${w.id}`}><b>{w.title}</b></Link>
                        <span className="d">{w.kind === 'web' ? 'web page' : 'python'} / {w.files} file{w.files === 1 ? '' : 's'} / {ago(w.updated_at)}</span>
                        <button type="button" className="linkb" onClick={() => remove(w)} aria-label={`Delete ${w.title}`}>Delete</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Pane>
          )}
        </div>
      </section>
    </>
  );
}

/* --------------------------------- editor --------------------------------- */

function Editor({ id }) {
  const [ws, setWs] = useState(null);
  const [files, setFiles] = useState({});
  const [cur, setCur] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [save, setSave] = useState('saved'); // saved | unsaved | saving | error text
  const pending = useRef({ changed: new Set(), deleted: new Set(), title: false });
  const timer = useRef(0);
  useReveal();

  useEffect(() => {
    api
      .get(`/workspaces/${id}`)
      .then((w) => {
        setWs(w);
        setTitle(w.title);
        setFiles(Object.fromEntries(w.files.map((f) => [f.path, f.content])));
        setCur(w.entry);
        if (w.kind === 'python') warmUp();
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Refs so a delayed save sends the latest text.
  const filesRef = useRef(files);
  filesRef.current = files;
  const titleRef = useRef(title);
  titleRef.current = title;

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const p = pending.current;
    if (!p.changed.size && !p.deleted.size && !p.title) return true;
    pending.current = { changed: new Set(), deleted: new Set(), title: false };
    setSave('saving');
    try {
      const body = { files: [...p.changed].filter((x) => x in filesRef.current).map((path) => ({ path, content: filesRef.current[path] })), deleted: [...p.deleted] };
      if (p.title) body.title = titleRef.current;
      await api.put(`/workspaces/${id}`, body);
      setSave(pending.current.changed.size || pending.current.deleted.size ? 'unsaved' : 'saved');
      return true;
    } catch (e) {
      // Put it back so the next save tries again.
      p.changed.forEach((x) => pending.current.changed.add(x));
      p.deleted.forEach((x) => pending.current.deleted.add(x));
      pending.current.title ||= p.title;
      setSave(e.message);
      return false;
    }
  }, [id]);

  const later = () => {
    setSave('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_MS);
  };
  useEffect(() => () => { clearTimeout(timer.current); flush(); }, [flush]);
  useEffect(() => {
    const warn = (e) => {
      if (pending.current.changed.size || pending.current.deleted.size) e.preventDefault();
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, []);

  const edit = (path, text) => {
    setFiles((f) => ({ ...f, [path]: text }));
    pending.current.changed.add(path);
    pending.current.deleted.delete(path);
    later();
  };
  const addFile = (path) => {
    edit(path, '');
    setCur(path);
  };
  const removeFile = (path) => {
    if (!window.confirm(`Delete ${path}?`)) return;
    setFiles((f) => {
      const n = { ...f };
      delete n[path];
      return n;
    });
    pending.current.changed.delete(path);
    pending.current.deleted.add(path);
    if (cur === path) setCur(ws.entry);
    later();
  };
  const rename = (t) => {
    setTitle(t);
    pending.current.title = true;
    later();
  };

  const download = () => {
    const blob = new Blob([zip(files, (title || 'workspace').replace(/[^\w-]+/g, '-'))], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(title || 'workspace').replace(/[^\w-]+/g, '-')}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (error) return <div className="wrap sec"><p className="state-note bad">{error} <Link className="uline" to="/workspace">Back to your projects</Link></p></div>;
  if (!ws) return <div className="wrap sec"><p className="state-note">loading...</p></div>;

  const paths = Object.keys(files).sort((a, b) => (a === ws.entry ? -1 : b === ws.entry ? 1 : a.localeCompare(b)));
  const saveText = save === 'saved' ? 'saved' : save === 'saving' ? 'saving...' : save === 'unsaved' ? 'unsaved' : null;

  return (
    <section className="sec ws">
      <div className="wrap">
        <div className="ws-top">
          <Link className="d uline" to="/workspace">your projects</Link>
          <label className="ws-title">
            <span className="sr-only">Project title</span>
            <input className="field" value={title} maxLength={LIMITS.title} onChange={(e) => rename(e.target.value)} />
          </label>
          <span className={`ws-save ${saveText ? '' : 'bad'}`} role="status">{saveText ?? `Not saved: ${save}`}</span>
          <button type="button" className="btn" onClick={flush} disabled={save === 'saved' || save === 'saving'}>Save now</button>
          <button type="button" className="btn" onClick={download}>Download .zip</button>
        </div>

        <div className="ws-grid">
          <Files paths={paths} cur={cur} entry={ws.entry} files={files} onPick={setCur} onAdd={addFile} onRemove={removeFile} />
          <div className="ws-main">
            <Code key={cur} path={cur} value={files[cur] ?? ''} onChange={(t) => edit(cur, t)} run={ws.kind === 'python' ? 'python' : 'web'} />
          </div>
          <div className="ws-side">
            {ws.kind === 'python' ? <PyRun files={files} entry={ws.entry} beforeRun={flush} /> : <WebRun files={files} beforeRun={flush} />}
          </div>
        </div>

        <Push files={files} />
      </div>
    </section>
  );
}

function Files({ paths, cur, entry, files, onPick, onAdd, onRemove }) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const add = (e) => {
    e.preventDefault();
    const p = name.trim();
    const err = pathError(p) ?? (p in files ? 'That file already exists.' : null) ?? (paths.length >= LIMITS.files ? `At most ${LIMITS.files} files.` : null);
    if (err) return setMsg(err);
    setMsg('');
    setName('');
    onAdd(p);
  };
  return (
    <nav className="ws-files" aria-label="Files">
      <ul>
        {paths.map((p) => (
          <li key={p} className={p === cur ? 'on' : ''}>
            <button type="button" aria-current={p === cur ? 'true' : undefined} onClick={() => onPick(p)}>{p}</button>
            {p !== entry && <button type="button" className="ws-x" aria-label={`Delete ${p}`} onClick={() => onRemove(p)}>x</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="ws-add">
        <label className="sr-only" htmlFor="ws-new">New file name</label>
        <input id="ws-new" className="field" placeholder="new file, e.g. utils.py" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()}>Add</button>
      </form>
      {msg && <p className="dn" role="alert">{msg}</p>}
    </nav>
  );
}

function Code({ path, value, onChange }) {
  const keys = useCodeKeys(value, onChange);
  return (
    <div className="ws-code">
      <label className="eyebrow" htmlFor="ws-text">{path}</label>
      <textarea
        id="ws-text"
        className="mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...keys}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <p className="d ws-hint">Saves as you type. Tab indents, Esc then Tab moves on.</p>
    </div>
  );
}

function PyRun({ files, entry, beforeRun }) {
  const [stdin, setStdin] = useState('');
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    beforeRun();
    try {
      const [r] = await runCases(pythonProgram(files, entry), [{ stdin }], { timeoutMs: RUN_MS });
      setOut(r);
    } catch (e) {
      setOut({ stdout: '', stderr: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pane file="run" meta={entry} spot={false}>
      <div className="pn-b">
        <button type="button" className="btn pri" disabled={busy} onClick={run}>{busy ? 'Running...' : `Run ${entry}`}</button>
        <div className="ws-stdin">
          <label className="eyebrow" htmlFor="ws-stdin">Input (what input() reads, one line each)</label>
          <textarea id="ws-stdin" className="field mono" rows={3} value={stdin} onChange={(e) => setStdin(e.target.value)} />
        </div>
        <div aria-live="polite">
          {out && (
            <>
              <pre className="ws-out">{out.stdout || (out.stderr ? '' : '(no output)')}</pre>
              {out.stderr && <pre className="ws-out bad">{out.stderr}</pre>}
            </>
          )}
        </div>
      </div>
    </Pane>
  );
}

function WebRun({ files, beforeRun }) {
  const frame = useRef(null);
  const [doc, setDoc] = useState(() => buildPreview(files));
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    const on = (ev) => {
      // Only messages from our own preview frame, which posts { wsConsole: 1, level, text }.
      if (ev.source !== frame.current?.contentWindow || !ev.data?.wsConsole) return;
      setLogs((l) => [...l.slice(-49), { level: String(ev.data.level), text: String(ev.data.text).slice(0, 2000) }]);
    };
    addEventListener('message', on);
    return () => removeEventListener('message', on);
  }, []);
  const run = () => {
    beforeRun();
    setLogs([]);
    setDoc(buildPreview(files));
  };
  return (
    <Pane file="preview" meta="no network" spot={false}>
      <div className="pn-b">
        <button type="button" className="btn pri" onClick={run}>Run</button>
        {/* allow-scripts without allow-same-origin: an opaque origin, so the page cannot read the club site or its cookies. */}
        <iframe ref={frame} title="Preview of your page" className="ws-frame" sandbox="allow-scripts allow-modals" srcDoc={doc} />
        <div className="ws-console" aria-live="polite">
          <span className="eyebrow">console</span>
          {logs.length === 0 ? <p className="d">console.log output shows here.</p> : logs.map((l, i) => <pre key={i} className={l.level === 'error' ? 'bad' : ''}>{l.text}</pre>)}
        </div>
      </div>
    </Pane>
  );
}

/* ----------------------------- push to GitHub ----------------------------- */

const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/**
 * Commits every file to a GitHub repo through the club gateway, with the
 * member's own token. The token lives only in this component's memory and is
 * cleared after the push; it is never saved.
 */
function Push({ files }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: '', owner: '', repo: '', branch: 'main', token: '', message: 'Update from the club workspace' });
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ready = f.code.trim() && f.owner.trim() && f.repo.trim() && f.token.trim();
  const say = (t) => setLog((l) => [...l, t]);

  const push = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLog([]);
    const code = f.code.trim().toUpperCase();
    const base = `/gw/${encodeURIComponent(code)}/api.github.com/repos/${encodeURIComponent(f.owner.trim())}/${encodeURIComponent(f.repo.trim())}/contents/`;
    const headers = { Authorization: `Bearer ${f.token.trim()}`, Accept: 'application/vnd.github+json' };
    const branch = encodeURIComponent(f.branch.trim() || 'main');
    let ok = 0;
    try {
      for (const [path, content] of Object.entries(files)) {
        const url = base + path.split('/').map(encodeURIComponent).join('/');
        const got = await fetch(`${url}?ref=${branch}`, { headers });
        const sha = got.ok ? (await got.json()).sha : undefined;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: f.message || 'Update', content: b64(content), branch: f.branch.trim() || 'main', ...(sha ? { sha } : {}) }),
        });
        if (!res.ok) {
          const why = res.status === 403 && !res.headers.get('content-type')?.includes('json') ? 'the gateway code is not active' : (await res.json().catch(() => ({}))).message || `error ${res.status}`;
          say(`${path}: ${why}`);
          break;
        }
        ok++;
        say(`${path}: pushed`);
      }
      if (ok === Object.keys(files).length) say('Done. Open the repo on GitHub to see the commit.');
    } catch (err) {
      say(`Stopped: ${err.message}`);
    } finally {
      setF((x) => ({ ...x, token: '' }));
      setBusy(false);
    }
  };

  return (
    <div className="ws-push">
      <button type="button" className="linkb" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Push to GitHub'}
      </button>
      {open && (
        <form className="pn ws-push-f" onSubmit={push}>
          <p className="d">
            Pushes every file to a repo you own, through the club gateway, so it works on school wifi during a meeting. Use a
            fine-grained personal access token that can only write this one repo. It is used for this push and then forgotten,
            never saved. Never use your GitHub password.
          </p>
          <div className="ws-push-g">
            <label><span className="eyebrow">Gateway code</span><input className="field mono" value={f.code} onChange={set('code')} autoComplete="off" /></label>
            <label><span className="eyebrow">Owner</span><input className="field" value={f.owner} onChange={set('owner')} autoComplete="off" /></label>
            <label><span className="eyebrow">Repo</span><input className="field" value={f.repo} onChange={set('repo')} autoComplete="off" /></label>
            <label><span className="eyebrow">Branch</span><input className="field" value={f.branch} onChange={set('branch')} autoComplete="off" /></label>
            <label><span className="eyebrow">Token</span><input className="field" type="password" value={f.token} onChange={set('token')} autoComplete="off" /></label>
            <label><span className="eyebrow">Commit message</span><input className="field" value={f.message} maxLength={120} onChange={set('message')} /></label>
          </div>
          <button className="btn pri" disabled={!ready || busy}>{busy ? 'Pushing...' : 'Push'}</button>
          {log.length > 0 && <pre className="ws-out" aria-live="polite">{log.join('\n')}</pre>}
        </form>
      )}
    </div>
  );
}
