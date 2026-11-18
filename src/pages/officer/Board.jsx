/**
 * Officer screen for the Board (C1) and the USACO dates (C5). Paste a link
 * and a hint, pick the track; the page title is fetched for you. Reorder
 * within a tier with the arrows. Hiding keeps members' history.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner } from '../../components/bits.jsx';
import { TRACKS, VERIFY, ladderOf, trackOf, hostOf } from '../../../shared/board.js';

const BAD = '#c42e2e';
const EMPTY = { url: '', title: '', hint: '', track: 'contest', tier: 'bronze', difficulty: 1, verify: 'checkbox', answer: '', tags: '' };
const VERIFY_LABEL = {
  checkbox: 'Member ticks it',
  answer: 'Member types an answer',
  codeforces: 'Codeforces (ticked by hand until sync)',
  internal: 'Club judge (/p/ links)',
};

export default function Board() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState('contest');
  const [usaco, setUsaco] = useState('');
  const [usacoMsg, setUsacoMsg] = useState('');

  const load = useCallback(() => {
    api.get('/admin/hub/board/rungs').then((d) => setRows(d.rungs)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    api.get('/admin/hub/board/usaco').then((d) => setUsaco(d.text)).catch(() => {});
  }, [load]);

  const set = (k, v) => setF((x) => {
    const n = { ...x, [k]: v };
    if (k === 'track') n.tier = trackOf(v).tiers[0][0];
    if (k === 'url' && v.startsWith('/p/')) n.verify = 'internal';
    return n;
  });

  const peek = async () => {
    if (f.title || !/^https:\/\//.test(f.url)) return;
    const { title } = await api.post('/admin/hub/board/peek', { url: f.url }).catch(() => ({ title: '' }));
    if (title) setF((x) => (x.title ? x : { ...x, title }));
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...f, difficulty: Number(f.difficulty) };
      if (editing) await api.put(`/admin/hub/board/rungs/${editing}`, body);
      else await api.post('/admin/hub/board/rungs', body);
      setShow(f.track);
      setF({ ...EMPTY, track: f.track, tier: f.tier });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const act = (path, body) => api.post(`/admin/hub/board/rungs/${path}`, body).then(load).catch((e) => setError(e.message));
  const edit = (r) => {
    setEditing(r.id);
    setF({ ...EMPTY, ...r, tags: r.tags.join(', '), answer: '' });
    window.scrollTo({ top: document.getElementById('board-form')?.offsetTop ?? 0 });
  };

  const saveUsaco = async () => {
    setUsacoMsg('');
    try {
      const r = await api.put('/admin/hub/board/usaco', { text: usaco });
      setUsacoMsg(r.next ? `Saved. Next: ${r.next.name}, ${r.next.start}.` : 'Saved. No upcoming dates, so the board says they are not posted.');
    } catch (e) {
      setUsacoMsg(e.message);
    }
  };

  const track = trackOf(show);
  const ladder = rows ? ladderOf(rows.map((r) => ({ ...r, hidden: false })), show) : [];

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Arena</p>
        <h2 className="display mt-1 text-2xl font-bold">The Board</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Paste a link and a one-line hint. The title fills itself in from the page. New rungs go to the end of their
          tier; use the arrows to move them.
        </p>
      </div>
      {error && <p className="mono mb-3 text-xs" style={{ color: BAD }} role="alert">{error}</p>}

      <form id="board-form" className="card mb-5 grid gap-3 p-4" onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="eyebrow">Link (https://..., /p/problem-slug, /learn/course)</span>
            <input className="field" value={f.url} onChange={(e) => set('url', e.target.value.trim())} onBlur={peek} required />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="eyebrow">Hint (one line: what to notice or try first)</span>
            <input className="field" value={f.hint} onChange={(e) => set('hint', e.target.value)} maxLength={240} />
          </label>
          <label className="grid gap-1">
            <span className="eyebrow">Title (filled from the link)</span>
            <input className="field" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />
          </label>
          <label className="grid gap-1">
            <span className="eyebrow">Tags (comma list)</span>
            <input className="field" value={f.tags} onChange={(e) => set('tags', e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="eyebrow">Track</span>
            <select className="field" value={f.track} onChange={(e) => set('track', e.target.value)}>
              {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="eyebrow">Tier</span>
            <select className="field" value={f.tier} onChange={(e) => set('tier', e.target.value)}>
              {trackOf(f.track).tiers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="eyebrow">Difficulty (1 easy, 5 hard)</span>
            <select className="field" value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="eyebrow">How it is checked</span>
            <select className="field" value={f.verify} onChange={(e) => set('verify', e.target.value)}>
              {VERIFY.map((v) => <option key={v} value={v}>{VERIFY_LABEL[v]}</option>)}
            </select>
          </label>
          {f.verify === 'answer' && (
            <label className="grid gap-1 sm:col-span-2">
              <span className="eyebrow">Answer (stored as a hash; case and spaces do not matter){editing ? '. Leave blank to keep the current one.' : ''}</span>
              <input className="field mono" value={f.answer} onChange={(e) => set('answer', e.target.value)} autoComplete="off" />
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn pri" disabled={busy || !f.url}>{editing ? 'Save rung' : 'Add rung'}</button>
          {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setF(EMPTY); }}>Cancel</button>}
        </div>
      </form>

      <div className="chips mb-3" role="group" aria-label="Show track">
        {TRACKS.map((t) => (
          <button key={t.id} type="button" aria-pressed={show === t.id} onClick={() => setShow(t.id)}>{t.name}</button>
        ))}
      </div>

      {!rows ? (
        <Spinner />
      ) : (
        track.tiers.map(([tid, tname]) => {
          const list = ladder.filter((r) => r.tier === tid);
          return (
            <div key={tid} className="mb-4">
              <h3 className="eyebrow mb-2">{tname} ({list.length})</h3>
              {list.length === 0 ? (
                <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Nothing here yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {list.map((r, i) => (
                    <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm" style={r.hidden ? { opacity: 0.5 } : undefined}>
                      <span className="min-w-0">
                        <b>{r.title}</b>{' '}
                        <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
                          {hostOf(r.url)} / level {r.difficulty} / {r.verify}{r.hasAnswer ? ' (answer set)' : ''}{r.hidden ? ' / hidden' : ''}
                        </span>
                      </span>
                      <span className="flex gap-2">
                        <button type="button" className="btn" disabled={i === 0} onClick={() => act(`${r.id}/move`, { dir: -1 })} aria-label={`Move ${r.title} up`}>Up</button>
                        <button type="button" className="btn" disabled={i === list.length - 1} onClick={() => act(`${r.id}/move`, { dir: 1 })} aria-label={`Move ${r.title} down`}>Down</button>
                        <button type="button" className="btn" onClick={() => edit(r)}>Edit</button>
                        <button type="button" className="btn" onClick={() => act(`${r.id}/hide`, { hidden: !r.hidden })}>{r.hidden ? 'Show' : 'Hide'}</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}

      <div className="card mt-6 grid gap-2 p-4">
        <label className="grid gap-1">
          <span className="eyebrow">USACO contest dates, one per line: start end name (e.g. 2027-01-08 2027-01-11 First contest)</span>
          <textarea className="field mono" rows={4} value={usaco} onChange={(e) => setUsaco(e.target.value)} spellCheck={false} />
        </label>
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          usaco.org has not posted the 2026-27 dates yet. Copy them from its home page when it does; the contest track shows a countdown.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn" onClick={saveUsaco}>Save dates</button>
          {usacoMsg && <span className="mono text-xs" role="status">{usacoMsg}</span>}
        </div>
      </div>
    </section>
  );
}
