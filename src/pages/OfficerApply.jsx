import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';

/** G4: your progress toward officer eligibility, and the application form while the window is open. */
export default function OfficerApply() {
  useReveal();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.get('/handoff/me').then((r) => { setD(r); setAnswers(r.application?.answers ?? {}); }).catch((e) => setError(e.status === 401 ? 'signin' : e.message));
  useEffect(() => { load(); }, []);

  if (error === 'signin') return <div className="state-note">Officer applications are for members. <Link className="u" to="/signin">Sign in</Link></div>;
  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading...</div>;

  const app = d.application;
  const locked = app && app.status !== 'new';
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNote('');
    try {
      await api.post('/handoff/apply', { answers });
      setNote('Saved. Officers can see it. You can edit it until they decide.');
      await load();
    } catch (err) {
      setNote(err.message);
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    if (!window.confirm('Withdraw your application?')) return;
    await api.del('/handoff/apply').catch(() => {});
    setAnswers({});
    load();
  };

  const e = d.eligibility;
  return (
    <>
      <PageHead
        eyebrow={`officers --apply ${d.label}`}
        title={<>Earn a seat at the <em>table</em>.</>}
        lead="Officers keep the club running after the last ones graduate. The record below is what the officers look at. It is made of things you did, nothing else."
        kv={<div className="kv"><div><span>criteria met</span><strong>{e.met}/{e.total}</strong></div><div><span>applications</span><strong>{d.open ? 'open' : 'closed'}</strong></div></div>}
      />
      <section className="sec">
        <div className="wrap ar-grid">
          <Pane file="your-record" meta="this school year, private to you">
            <ul className="pn-b ap-crit">
              {e.criteria.map((c) => (
                <li key={c.id}>
                  <span className={c.met ? 'g' : 'd'} aria-hidden="true">{c.met ? '[x]' : '[ ]'}</span>{' '}
                  {c.label}: <b>{c.have}</b> of {c.need} <span className="sr-only">{c.met ? 'met' : 'not met yet'}</span>
                </li>
              ))}
              {e.total === 0 && <li className="d">Officers have not set any criteria. They decide by hand.</li>}
            </ul>
          </Pane>
          <Pane file="application" meta="only you and officers can read it">
            <div className="pn-b">
              {!d.isMember ? (
                <p className="d">You are already an officer.</p>
              ) : !d.open && !app ? (
                <p className="d">Applications are closed right now. Officers open the window once a year. Keep building your record.</p>
              ) : (
                <form onSubmit={send} style={{ display: 'grid', gap: 12 }}>
                  {app && <p className="m">Status: {app.status === 'new' ? 'sent, waiting for the officers' : app.status}</p>}
                  {d.questions.map((q) => (
                    <label key={q.id} style={{ display: 'grid', gap: 4 }}>
                      <span>{q.label}</span>
                      <textarea className="field" rows={3} maxLength={600} required disabled={locked || !d.open} value={answers[q.id] ?? ''} onChange={(ev) => setAnswers({ ...answers, [q.id]: ev.target.value })} />
                    </label>
                  ))}
                  {!e.eligible && e.total > 0 && <p className="m" style={{ fontSize: 12 }}>You can apply before every criterion is met. Officers see which ones are.</p>}
                  {note && <p role="status" className="m">{note}</p>}
                  {!locked && d.open && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" disabled={busy}>{busy ? 'Saving...' : app ? 'Save changes' : 'Send application'}</button>
                      {app && <button type="button" className="btn" onClick={withdraw}>Withdraw</button>}
                    </div>
                  )}
                </form>
              )}
            </div>
          </Pane>
        </div>
      </section>
    </>
  );
}
