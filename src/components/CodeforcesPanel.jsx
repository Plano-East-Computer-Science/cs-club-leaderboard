/**
 * Codeforces panel (C4): link a handle by submitting a deliberate Compilation
 * Error to problem 4A, then see rating, solved count and last sync. Used on
 * /arena (contest track) and on the account page.
 *
 * If Codeforces refuses the club server, the browser can ask Codeforces itself
 * (its API allows cross-origin GET) and hand the list to the server. That path
 * is the honour system, the same as the in-browser judge.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { CHALLENGE, CHALLENGE_URL, BLOCKED_MSG, STATUS_COUNT } from '../../shared/codeforces.js';

async function cfBrowser(path) {
  const res = await fetch(`https://codeforces.com/api/${path}`);
  const j = await res.json();
  if (j.status !== 'OK') throw new Error(j.comment || 'Codeforces refused the request.');
  return j.result;
}

const ago = (ms) => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export default function CodeforcesPanel({ onSynced }) {
  const [me, setMe] = useState(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [left, setLeft] = useState(0);

  const load = useCallback(() => api.get('/codeforces/me').then(setMe).catch((e) => setMsg({ bad: true, t: e.message })), []);
  useEffect(() => { load(); }, [load]);

  // Countdown to the end of the challenge window.
  const expires = me?.challenge?.expiresAt;
  useEffect(() => {
    if (!expires) return undefined;
    const tick = () => setLeft(Math.max(0, Math.round((expires - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expires]);

  const run = (name, fn) => async () => {
    setBusy(name);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ bad: true, t: e.message });
    }
    setBusy('');
  };

  const link = run('link', async () => {
    await api.post('/codeforces/link', { handle });
    await load();
  });

  const reverify = run('link', async () => {
    await api.post('/codeforces/link', { handle: me.handle });
    await load();
  });

  const verify = run('verify', async () => {
    let r;
    try {
      r = await api.post('/codeforces/verify', {});
    } catch (e) {
      if (e.status !== 502) throw e;
      // The club server is blocked: look it up from here and pass the list on.
      const submissions = await cfBrowser(`user.status?handle=${encodeURIComponent(me.challenge.handle)}&from=1&count=10`);
      r = await api.post('/codeforces/verify', { submissions });
    }
    if (r.verified) {
      setMsg({ t: r.trusted ? 'Linked. Your solves are on the board.' : 'Linked from this browser. Your solves show here, but they earn points only once the club server confirms the handle.' });
      onSynced?.();
    } else setMsg({ bad: true, t: r.error });
    await load();
  });

  const syncNow = run('sync', async () => {
    const r = await api.post('/codeforces/sync', {});
    setMsg(r.error ? { bad: true, t: r.error } : { t: 'Synced.' });
    onSynced?.();
    await load();
  });

  const syncHere = run('here', async () => {
    const h = encodeURIComponent(me.handle);
    const submissions = await cfBrowser(`user.status?handle=${h}&from=1&count=${STATUS_COUNT}`);
    const info = await cfBrowser(`user.info?handles=${h}`).catch(() => []);
    await api.post('/codeforces/sync-from-browser', { submissions, rating: Number.isInteger(info[0]?.rating) ? info[0].rating : undefined });
    setMsg({ t: 'Synced from this browser.' });
    onSynced?.();
    await load();
  });

  const unlink = run('unlink', async () => {
    if (!window.confirm('Unlink your Codeforces handle? Rungs already ticked stay ticked.')) return;
    await api.post('/codeforces/unlink', {});
    await load();
  });

  if (!me) return <section className="cf" aria-label="Codeforces"><p className="cf-note">{msg?.t ?? 'Loading Codeforces...'}</p></section>;

  return (
    <section className="cf" aria-labelledby="cf-h">
      <h3 id="cf-h">Codeforces</h3>

      {me.verified && !me.challenge ? (
        <>
          <div className="cf-stats">
            <div><span>handle</span><strong>{me.handle}</strong></div>
            <div><span>rating</span><strong>{me.rating ?? 'unrated'}</strong></div>
            <div><span>solved</span><strong>{me.solved}</strong></div>
            <div><span>last sync</span><strong>{me.syncedAt ? ago(me.syncedAt) : 'not yet'}</strong></div>
          </div>
          <p className="cf-note">Solves sync every hour and tick matching rungs on the Board. The latest 100 submissions are read.</p>
          {!me.trusted && (
            <p className="cf-err" role="status">
              Not confirmed: this handle was checked in your browser, which anyone could fake. Solves show here but earn no points
              and do not tick Board rungs. Verify again when the club server can reach Codeforces.
            </p>
          )}
          {me.error && <p className="cf-err" role="status">{me.error}</p>}
          <div className="cf-row">
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={syncNow}>Sync now</button>
            {(me.error === BLOCKED_MSG || me.syncedAt === null) && (
              <button type="button" className="btn" disabled={Boolean(busy)} onClick={syncHere}>Sync from this browser</button>
            )}
            {!me.trusted && (
              <button type="button" className="btn" disabled={Boolean(busy)} onClick={reverify}>Verify again</button>
            )}
            <button type="button" className="linkb" disabled={Boolean(busy)} onClick={unlink}>Unlink</button>
          </div>
        </>
      ) : me.challenge ? (
        <>
          <p className="cf-note">
            To show the handle <b>{me.challenge.handle}</b> is yours, submit a program that does not compile to{' '}
            <a className="uline" href={CHALLENGE_URL} target="_blank" rel="noreferrer noopener">problem {CHALLENGE.contestId}{CHALLENGE.index}, {CHALLENGE.name}<span className="sr-only"> (opens in a new tab)</span></a>.
            Any text that is not valid code works. Do it within {CHALLENGE.minutes} minutes, then press Verify.
          </p>
          <p className="cf-count" role="timer" aria-live="off">{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left` : 'Time is up. Start again.'}</p>
          <div className="cf-row">
            <button type="button" className="btn pri" disabled={Boolean(busy) || left === 0} onClick={verify}>{busy === 'verify' ? 'Checking...' : 'Verify'}</button>
            <button type="button" className="linkb" disabled={Boolean(busy)} onClick={() => api.post('/codeforces/unlink', {}).then(load)}>Use another handle</button>
          </div>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (handle.trim()) link(); }}>
          <p className="cf-note">Link your Codeforces handle and your solves tick the Board by themselves. We ask you to prove the handle is yours.</p>
          <div className="cf-row">
            <label htmlFor="cf-handle" className="sr-only">Codeforces handle</label>
            <input id="cf-handle" className="field" placeholder="Codeforces handle" value={handle} maxLength={24} onChange={(e) => setHandle(e.target.value)} autoComplete="off" spellCheck={false} />
            <button className="btn pri" disabled={Boolean(busy) || !handle.trim()}>Link handle</button>
          </div>
        </form>
      )}
      {msg && <p className={msg.bad ? 'cf-err' : 'cf-ok'} role="status">{msg.t}</p>}
    </section>
  );
}
