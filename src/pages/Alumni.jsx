/**
 * E6 alumni directory. Members never see how to reach a graduate: they send a
 * question through the club and an officer forwards it.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';

function Person({ a }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/alumni/${a.id}/ask`, { question: q });
      setQ('');
      setOpen(false);
      setMsg({ text: 'Sent. An officer will pass it on and share any answer.' });
    } catch (x) {
      setMsg({ text: x.message, bad: true });
    }
  };
  return (
    <div className="rs-note">
      <p><b>{a.name}</b>{a.grad_year ? ` · class of ${a.grad_year}` : ''}</p>
      {a.doing && <p>{a.doing}</p>}
      {a.topics && <p className="m" style={{ fontSize: 12.5 }}>Ask about: {a.topics}</p>}
      {msg && <p className={msg.bad ? 'dn' : 'm'} role="status" style={{ fontSize: 12.5 }}>{msg.text}</p>}
      {open ? (
        <form onSubmit={send} style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <textarea className="field" rows={3} maxLength={500} required value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Your question for ${a.name}`} placeholder="Your question" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={q.trim().length < 10}>Send through the club</button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => setOpen(true)}>Ask a question</button>
      )}
    </div>
  );
}

export default function Alumni() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useReveal();
  const load = useCallback(() => api.get('/alumni').then(setD).catch((e) => setError(e)), []);
  useEffect(() => { load(); }, [load]);

  if (error?.status === 401) return <div className="state-note">The alumni list is for signed-in members. <Link to="/signin">Sign in</Link></div>;
  if (error) return <div className="state-note bad">{error.message}</div>;
  if (!d) return <div className="state-note">loading alumni...</div>;

  return (
    <>
      <PageHead
        eyebrow="alumni --ask"
        title={<>Graduates who <em>answer questions</em>.</>}
        lead="Send a question through the club. An officer passes it on and shares what comes back. You never contact anyone directly."
      />
      <section className="sec">
        <div className="wrap ideas-grid">
          <Pane file="alumni" meta={`${d.alumni.length} listed`}>
            <div className="pn-b" style={{ display: 'grid', gap: 12 }}>
              {d.alumni.length === 0 && <p className="d">No graduates listed yet.</p>}
              {d.alumni.map((a) => <Person key={a.id} a={a} />)}
            </div>
          </Pane>
          <Pane file="ask-me-anything" meta="speaker sessions" spot={false}>
            <div className="pn-b">
              {d.sessions.length === 0 ? <p className="d">No speaker session is planned yet.</p> : (
                <ul className="ul">{d.sessions.map((s) => <li key={s.id}>{s.date} · {s.title}</li>)}</ul>
              )}
              <p className="d" style={{ marginTop: 8 }}><Link to="/calendar">See the calendar</Link></p>
            </div>
          </Pane>
        </div>
      </section>
    </>
  );
}
