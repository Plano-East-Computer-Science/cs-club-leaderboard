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

export default function Gateway() {
  const [input, setInput] = useState('');
  const [code, setCode] = useState(null); // verified active code
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');

  const check = async (raw) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const d = await api.get(`/gateway/check?code=${encodeURIComponent(c)}`);
      if (d.active) {
        setCode(d.code || c);
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
    let saved = '';
    try { saved = sessionStorage.getItem(KEY) || ''; } catch { /* ignore */ }
    if (saved) {
      setInput(saved);
      check(saved);
    }
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
          During a meeting an officer can give out a short code. With it, this site fetches GitHub
          for you so you can clone repos and download files on a school machine.
        </p>
      </header>

      <div className="card mb-6 grid gap-2 p-5 text-sm" style={{ color: 'var(--ink-soft)' }}>
        <p>
          <strong style={{ color: 'var(--ink)' }}>It does:</strong> reach GitHub and PyPI, only
          while the code is live.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>It does not:</strong> open any other website,
          pass on cookies, or let you sign in. Sign-in pages are blocked, so never type your GitHub
          password here.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); check(input); }}
        className="card mb-6 flex flex-wrap items-end gap-3 p-4"
      >
        <label className="grid min-w-48 flex-1 gap-1.5">
          <span className="eyebrow">Code from your officer</span>
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
