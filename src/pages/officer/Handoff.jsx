/**
 * G4 officer screen: open or close the application window, edit the eligibility
 * thresholds, read applications beside each applicant's record, mark them
 * decided, and write the short summary shown on the year archive.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

const LABEL = { meetings: 'Meetings attended', mentor: 'Mentor activities', content: 'Content authored', reviews: 'Code reviews given', hosted: 'Presented or helped run' };

export default function Handoff() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [year, setYear] = useState('');
  const [th, setTh] = useState({});
  const [summary, setSummary] = useState('');
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    api.get(`/admin/hub/handoff${year ? `?year=${year}` : ''}`)
      .then((r) => { setD(r); setTh(r.thresholds); setSummary(r.summary); })
      .catch((e) => setError(e.message));
  }, [year]);
  useEffect(load, [load]);

  const act = async (fn, ok) => {
    try {
      await fn();
      setNote({ text: ok });
      load();
    } catch (e) {
      setNote({ text: e.message, bad: true });
    }
  };

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!d) return <Spinner label="Loading handoff" />;
  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Handoff</p>
        <h2 className="display mt-1 text-2xl font-bold">Handoff and applications</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Members see their own progress at /officers/apply. Anyone can apply while the window is open; you see who met the criteria next to their answers. Applications are private to the member and officers.
        </p>
      </div>
      {note && <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>}

      <div className="card mb-4 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.open} onChange={(e) => act(() => api.put('/admin/hub/handoff/settings', { open: e.target.checked }), e.target.checked ? 'Window opened.' : 'Window closed.')} />
          Applications are open
        </label>
        <p className="mono mt-3 text-xs" style={{ color: 'var(--ink-soft)' }}>Eligibility thresholds (0 turns a criterion off)</p>
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          {Object.keys(LABEL).map((k) => (
            <label key={k} className="text-sm">{LABEL[k]}
              <input className="field" type="number" min="0" max="100" value={th[k] ?? 0} onChange={(e) => setTh({ ...th, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <button className="btn btn-ghost mt-3" onClick={() => act(() => api.put('/admin/hub/handoff/settings', { thresholds: th }), 'Thresholds saved.')}>Save thresholds</button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor="ho-year">School year</label>
        <select id="ho-year" className="field" style={{ width: 'auto' }} value={d.year} onChange={(e) => setYear(e.target.value)}>
          {d.years.map((y) => <option key={y} value={y}>{y}-{String(Number(y) + 1).slice(2)}</option>)}
        </select>
      </div>

      {d.applications.length === 0 && <p className="mono mb-4 text-xs" style={{ color: 'var(--ink-soft)' }}>No applications for {d.label}.</p>}
      <ul className="mb-4 grid gap-3">
        {d.applications.map((a) => (
          <li key={a.id} className="card p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><b>{a.name}</b> <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{a.email}</span></span>
              <span className="mono text-xs">{a.status}{a.decided_name ? ` by ${a.decided_name}` : ''} · {a.eligibility.met}/{a.eligibility.total} criteria</span>
            </div>
            <ul className="mono my-2 text-xs">
              {a.eligibility.criteria.map((c) => <li key={c.id}>{c.met ? '[x]' : '[ ]'} {c.label}: {c.have} of {c.need}</li>)}
            </ul>
            {d.questions.map((q) => (
              <p key={q.id} className="mt-2"><span style={{ color: 'var(--ink-soft)' }}>{q.label}</span><br />{a.answers[q.id]}</p>
            ))}
            <Decide a={a} onSave={(status, text) => act(() => api.post(`/admin/hub/handoff/applications/${a.id}/decide`, { status, note: text }), 'Saved.')} />
          </li>
        ))}
      </ul>

      <div className="card p-3">
        <label className="text-sm" htmlFor="ho-sum">Written summary for the {d.label} archive (shown publicly, up to 1500 characters)</label>
        <textarea id="ho-sum" className="field mt-2" rows={4} maxLength={1500} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <button className="btn btn-ghost mt-2" onClick={() => act(() => api.put(`/admin/hub/handoff/summary/${d.year}`, { body: summary }), 'Summary saved.')}>Save summary</button>
      </div>
    </section>
  );
}

function Decide({ a, onSave }) {
  const [text, setText] = useState(a.note);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input className="field" style={{ flex: '1 1 200px', width: 'auto' }} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Private note for officers" aria-label={`Note about ${a.name}`} />
      <button className="btn btn-primary" onClick={() => onSave('accepted', text)}>Accept</button>
      <button className="btn btn-ghost" onClick={() => onSave('declined', text)}>Decline</button>
      {a.status !== 'new' && <button className="btn btn-ghost" onClick={() => onSave('new', text)}>Reopen</button>}
    </div>
  );
}
