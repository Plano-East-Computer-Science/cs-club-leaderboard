/**
 * C6: editorials for a bank problem. Shown after you solve it (the server hides
 * them from everyone else), with a short form to write your own. Member text is
 * rendered only as React text nodes, never as HTML.
 *
 * Props: slug, refreshKey (change it after a solve so the list reloads).
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { parseSections, paras } from '../lib/md.js';
import ReportButton from './ReportButton.jsx';

const STATUS = { pending: 'waiting for an officer to read it', rejected: 'not accepted, edit it and send it again', accepted: 'accepted', hidden: 'hidden' };

function Entry({ e }) {
  const text = parseSections(e.body).flatMap((s) => paras(s));
  return (
    <li className="ed-item">
      <p className="mono ed-who"><b className="g">{e.name}</b> explains{e.mine ? ' (you)' : ''}</p>
      {text.map((t, i) => <p key={i}>{t}</p>)}
      {e.code && <pre className="mono ed-code">{e.code}</pre>}
      {!e.mine && <ReportButton kind="editorial" id={e.id} what="this editorial" />}
    </li>
  );
}

export default function Editorials({ slug, refreshKey = 0 }) {
  const [d, setD] = useState(null); // null until loaded; { locked } hides the whole thing
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    api.get(`/problems/${encodeURIComponent(slug)}/editorials`).then((x) => {
      setD(x);
      if (x.mine && !body) {
        setBody(x.mine.body);
        setCode(x.mine.code);
      }
    }).catch(() => setD({ locked: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  useEffect(load, [load, refreshKey]);

  if (!d || d.locked) return null; // signed out or not solved yet: nothing to show

  const send = async (ev) => {
    ev.preventDefault();
    setMsg(null);
    try {
      await api.post(`/problems/${encodeURIComponent(slug)}/editorials`, { body, code });
      setMsg({ ok: true, text: 'Sent. An officer will read it. If they accept it you earn mentor points.' });
      setOpen(false);
      load();
    } catch (err) {
      setMsg({ text: err.message });
    }
  };

  const decided = d.mine && (d.mine.status === 'accepted' || d.mine.status === 'hidden');
  return (
    <section className="pn in" aria-label="Editorials">
      <div className="pane-h"><span><b>editorials.md</b></span><span className="hide-xs">from members who solved it</span></div>
      <div className="pn-b">
        {d.editorials.length === 0 && <p className="d">No accepted editorials yet. Be the first to explain how you solved it.</p>}
        {d.editorials.length > 0 && <ul className="ed-list">{d.editorials.map((e) => <Entry key={e.id} e={e} />)}</ul>}

        {d.mine && <p className="mono d" role="status">Your editorial: {STATUS[d.mine.status]}.</p>}
        {msg && <p className="mono" role="status" style={{ color: msg.ok ? 'var(--up)' : 'var(--down)' }}>{msg.text}</p>}

        {!decided && !open && (
          <button type="button" className="btn" onClick={() => setOpen(true)}>{d.mine ? 'Edit my editorial' : 'Write an editorial'}</button>
        )}
        {open && (
          <form onSubmit={send} className="ed-form">
            <label className="eb" htmlFor={`ed-body-${slug}`}>Explain the idea (plain text, a few sentences)</label>
            <textarea id={`ed-body-${slug}`} className="field" rows={5} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} required />
            <label className="eb" htmlFor={`ed-code-${slug}`}>Code (optional)</label>
            <textarea id={`ed-code-${slug}`} className="field mono" rows={6} maxLength={4000} value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
            <div className="ed-actions">
              <button type="submit" className="btn pri" disabled={body.trim().length < 20}>Send to officers</button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
