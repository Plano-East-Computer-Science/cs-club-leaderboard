/**
 * Officer screen for the quant game (C14). Opens a round of the simulated
 * trading game on synthetic prices and closes one early. A weekly round opens
 * by itself whenever nothing else is open. Closing reveals the seed, so a
 * closed round cannot be reopened.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner } from '../../components/bits.jsx';
import { SHORT_CAPS } from '../../../shared/quant.js';

const BAD = '#c42e2e';
const EMPTY = { title: '', days: 60, step: 5, shortCap: 0, closesInDays: 7, seed: '' };

export default function QuantAdmin() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/hub/quant/rounds').then((d) => setRows(d.rounds)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const act = async (fn) => {
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    await act(async () => {
      await api.post('/admin/hub/quant/rounds', { ...f, days: Number(f.days), step: Number(f.step), shortCap: Number(f.shortCap), closesInDays: Number(f.closesInDays) });
      setF(EMPTY);
    });
    setBusy(false);
  };

  const num = (id, label, k, min, max) => (
    <div>
      <label className="eyebrow" htmlFor={id} style={{ display: 'block' }}>{label}</label>
      <input id={id} className="field" type="number" min={min} max={max} value={f[k]} onChange={(e) => set(k, e.target.value)} required />
    </div>
  );

  return (
    <section className="grid gap-3" style={{ marginTop: 28 }} aria-labelledby="quant-admin-h">
      <header>
        <p className="eyebrow">Quant game</p>
        <h2 id="quant-admin-h" className="text-xl font-semibold">Quant game rounds</h2>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          A simulated game on synthetic prices, not investment advice. It gives no club points. A weekly round opens by itself when nothing is open.
          The seed stays hidden until the round closes; leave it blank for a random one.
        </p>
      </header>
      {error && <p className="mono text-sm" role="alert" style={{ color: BAD }}>{error}</p>}

      <form className="card grid gap-3 p-4" onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="eyebrow" htmlFor="qr-title" style={{ display: 'block' }}>Title</label>
            <input id="qr-title" className="field" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={80} required />
          </div>
          <div>
            <label className="eyebrow" htmlFor="qr-short" style={{ display: 'block' }}>Shorting</label>
            <select id="qr-short" className="field" value={f.shortCap} onChange={(e) => set('shortCap', e.target.value)}>
              {SHORT_CAPS.map((c) => <option key={c} value={c}>{c ? `up to ${c * 100}%` : 'not allowed'}</option>)}
            </select>
          </div>
          {num('qr-days', 'Days to play (20 to 120)', 'days', 20, 120)}
          {num('qr-step', 'Days per step (1 to 10)', 'step', 1, 10)}
          {num('qr-close', 'Open for how many days', 'closesInDays', 1, 30)}
          <div>
            <label className="eyebrow" htmlFor="qr-seed" style={{ display: 'block' }}>Seed (optional)</label>
            <input id="qr-seed" className="field" inputMode="numeric" value={f.seed} onChange={(e) => set('seed', e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <div>
          <button className="btn pri" disabled={busy}>{busy ? 'Opening...' : 'Open round'}</button>
        </div>
      </form>

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>No rounds yet.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-1 text-sm">
                <b>{r.title}</b>
                <span className="chip" style={{ marginLeft: 8 }}>{r.status}</span>
                {r.weekly && <span className="chip" style={{ marginLeft: 6 }}>weekly</span>}
                <span className="mono text-xs" style={{ marginLeft: 8, color: 'var(--ink-faint)' }}>
                  {r.steps} steps of {r.step} days, {r.finished}/{r.players} finished
                  {r.status === 'open' ? `, ends ${new Date(r.closesAt).toLocaleDateString()}` : `, seed ${r.seed}`}
                </span>
              </span>
              {r.status === 'open' && (
                <button type="button" className="btn" onClick={() => window.confirm(`Close "${r.title}" now? Play stops and the seed is shown to everyone.`) && act(() => api.post(`/admin/hub/quant/rounds/${r.id}/close`))}>
                  Close now
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
