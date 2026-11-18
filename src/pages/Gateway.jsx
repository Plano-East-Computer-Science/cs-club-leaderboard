import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const KEY = 'gw_code';

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt('Copy this:', text);
    }
  };
  return (
    <button type="button" className="btn btn-ghost shrink-0" onClick={copy}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Snippet({ label, text }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <div className="flex items-start gap-2">
        <code
          className="mono min-w-0 flex-1 rounded border p-2.5 text-xs break-all"
          style={{ background: 'var(--paper-2)' }}
        >
          {text}
        </code>
        <CopyButton text={text} />
      </div>
    </div>
  );
}

const TOKEN_KEY = 'gh_token';
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };

/**
 * Use your own GitHub account through the gateway without typing a password.
 * The personal access token stays in THIS browser (never sent to the club
 * server for storage) and only travels to GitHub, through the gateway, as an
 * Authorization header. Sign-in pages stay blocked.
 */
function GitHubPanel({ code, host }) {
  const [token, setToken] = useState(readToken());
  const [draft, setDraft] = useState('');
  const [me, setMe] = useState(null);
  const [repos, setRepos] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const call = (path, t) =>
    fetch(`/gw/${code}/api.github.com${path}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' } });

  useEffect(() => {
    if (!token) return;
    let off = false;
    setError('');
    (async () => {
      try {
        const r = await call('/user', token);
        if (!r.ok) throw new Error(r.status === 401 ? 'GitHub rejected that token. Make a new one.' : `GitHub said ${r.status}.`);
        const u = await r.json();
        const rr = await call('/user/repos?sort=pushed&per_page=20', token);
        if (!off) {
          setMe(u);
          setRepos(rr.ok ? await rr.json() : []);
        }
      } catch (e) {
        if (!off) { setMe(null); setError(e.message); }
      }
    })();
    return () => { off = true; };
  }, [token, code]);

  const save = (e) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setBusy(true);
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable: token lives for this page only */ }
    setToken(t);
    setDraft('');
    setBusy(false);
  };
  const forget = () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    setToken(''); setMe(null); setRepos(null); setError('');
  };

  if (!token)
    return (
      <form onSubmit={save} className="card grid gap-3 p-4">
        <p className="eyebrow">Use your GitHub account</p>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Paste a personal access token to see your repos and push code. Make one at home or on your phone
          (GitHub, Settings, Developer settings, Personal access tokens). It stays in this browser and is only sent to GitHub.
          Never type your GitHub password here.
        </p>
        <input className="field mono" type="password" autoComplete="off" spellCheck={false} placeholder="github_pat_..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn btn-primary justify-self-start" disabled={busy || !draft.trim()}>Connect</button>
      </form>
    );

  return (
    <div className="card grid gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">{me ? `Signed in to GitHub as ${me.login}` : 'Checking your token...'}</p>
        <button type="button" className="btn btn-ghost" onClick={forget}>Forget token</button>
      </div>
      {error && <p className="mono text-xs" style={{ color: 'var(--down)' }}>{error}</p>}
      {repos && repos.length === 0 && <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No repos found for this token.</p>}
      {repos && repos.length > 0 && (
        <ul className="grid gap-3">
          {repos.map((r) => (
            <li key={r.id} className="grid gap-1.5">
              <a className="g uline" href={`/gw/${code}/github.com/${r.full_name}`}>{r.full_name}{r.private ? ' (private)' : ''}</a>
              <Snippet label="Clone with your account" text={`git clone https://x-access-token:${token}@${host}/gw/${code}/github.com/${r.full_name}.git`} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
        Clone and push with the commands above. The token is in the command, so do not paste it anywhere public.
      </p>
    </div>
  );
}

export default function Gateway() {
  const [input, setInput] = useState('');
  const [code, setCode] = useState(null); // verified active code
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [query, setQuery] = useState('');
  const [hosts, setHosts] = useState([]);
  const [fromRoom, setFromRoom] = useState(null); // H1: { room, title, presets } when the code came from a meeting

  const check = async (raw) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const d = await api.get(`/gateway/check?code=${encodeURIComponent(c)}`);
      if (d.active) {
        setCode(d.code || c);
        setHosts(d.hosts ?? []);
        try { sessionStorage.setItem(KEY, c); } catch { /* storage unavailable */ }
      } else {
        setCode(null);
        setError('That code is not active. Check it with an officer, or ask for a new one.');
      }
    } catch (err) {
      setCode(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // H1: checked in to a meeting? Its gateway is already yours, no code to type.
    api
      .get('/gateway/mine')
      .then((d) => {
        if (d.gateway) {
          setFromRoom(d.gateway);
          setInput(d.gateway.code);
          return check(d.gateway.code);
        }
        let saved = '';
        try { saved = sessionStorage.getItem(KEY) || ''; } catch { /* ignore */ }
        if (saved) {
          setInput(saved);
          return check(saved);
        }
      })
      .catch(() => {});
  }, []);

  const host = typeof location !== 'undefined' ? location.host : '';
  const o = owner.trim() || 'OWNER';
  const r = repo.trim() || 'REPO';

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="eyebrow">Club gateway</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          GitHub at school.
        </h1>
        <p className="mt-4 text-base" style={{ color: 'var(--ink-soft)' }}>
          Check in to a meeting room and this turns on for you until the room closes. It fetches GitHub
          and the sites the host turned on, so you can clone repos and read docs on a school machine.
        </p>
      </header>

      <div className="card mb-6 grid gap-2 p-5 text-sm" style={{ color: 'var(--ink-soft)' }}>
        <p>
          <strong style={{ color: 'var(--ink)' }}>It does:</strong> reach GitHub and PyPI, plus the
          documentation, search or tutorial sites the host turned on for this meeting, only while it is live.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>It does not:</strong> open any other website,
          pass on cookies, or let you sign in. Sign-in pages are blocked, so never type your GitHub
          password here.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>It will not run:</strong> Replit, Colab or apps like
          them. They need you to sign in, which the gateway blocks on purpose because anything you type
          would pass through a server you do not control. They also hold long connections open and
          refuse proxies. Write and run code in the{' '}
          <a href="/workspace" style={{ color: 'var(--ink)' }}>workspace</a> on this site instead.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Just need to read docs?</strong> Sign in and use{' '}
          <a href="/read" style={{ color: 'var(--ink)' }}>reader mode</a>. It shows documentation as text and
          code and needs no code from an officer.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); check(input); }}
        className="card mb-6 flex flex-wrap items-end gap-3 p-4"
      >
        <label className="grid min-w-48 flex-1 gap-1.5">
          <span className="eyebrow">{fromRoom ? `From room ${fromRoom.room}` : 'Code from your officer'}</span>
          <input
            className="field mono tracking-[0.25em] uppercase"
            value={input}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCDEFGH"
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !input.trim()}>
          {busy ? 'Checking' : 'Unlock'}
        </button>
      </form>

      {error && (
        <p className="mono mb-6 text-xs" role="alert" style={{ color: '#c42e2e' }}>
          {error}
        </p>
      )}

      {code && (
        <section className="grid gap-5">
          {fromRoom && (
            <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
              On for {fromRoom.title}: {['GitHub and PyPI', ...fromRoom.presets.filter((n) => n !== 'GitHub and PyPI')].join(', ')}. It ends when the room closes.
            </p>
          )}
          {hosts.includes('www.bing.com') && <form
            className="card flex flex-wrap items-end gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) location.href = `/gw/${code}/www.bing.com/search?q=${encodeURIComponent(query.trim())}`;
            }}
          >
            <label className="grid min-w-48 flex-1 gap-1.5">
              <span className="eyebrow">Search the web</span>
              <input className="field" value={query} placeholder="python list comprehension" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={!query.trim()}>Search</button>
            <p className="w-full text-xs" style={{ color: 'var(--ink-soft)' }}>
              Results open only if the site is on the approved list (docs, tutorials, GitHub). Others show a notice;
              ask an officer to add them.
            </p>
          </form>}

          <a
            className="btn btn-primary justify-self-start"
            style={{ textDecoration: 'none' }}
            href={`/gw/${code}/github.com/`}
          >
            Browse GitHub
          </a>

          <div className="card grid gap-3 p-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="eyebrow">Owner</span>
              <input className="field" value={owner} placeholder="OWNER" onChange={(e) => setOwner(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="eyebrow">Repo</span>
              <input className="field" value={repo} placeholder="REPO" onChange={(e) => setRepo(e.target.value)} />
            </label>
          </div>

          <GitHubPanel code={code} host={host} />

          <Snippet label="Clone a repo" text={`git clone https://${host}/gw/${code}/github.com/${o}/${r}.git`} />
          <Snippet label="Download a zip" text={`https://${host}/gw/${code}/codeload.github.com/${o}/${r}/zip/refs/heads/main`} />
          <Snippet label="Raw file" text={`https://${host}/gw/${code}/raw.githubusercontent.com/${o}/${r}/main/FILE`} />
          <Snippet label="Install a Python package" text={`pip install --index-url https://${host}/gw/${code}/pypi.org/simple PACKAGE`} />

          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            Cloning, browsing files, raw files and zips are the reliable paths. Heavily interactive
            GitHub pages may not fully work. Pushing needs a personal access token as the password,
            never your account password.
          </p>
        </section>
      )}
    </div>
  );
}
