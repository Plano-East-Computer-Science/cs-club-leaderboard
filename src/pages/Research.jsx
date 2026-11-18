/**
 * C15 research track: the paper of the month with short annotations, your own
 * science-fair project card (private to you and officers), and the research
 * opportunities from the board in one list.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import ReportButton from '../components/ReportButton.jsx';

const STAGE_LABEL = { question: 'Question', mentor: 'Mentor', data: 'Data', writeup: 'Write-up', done: 'Done' };
const BLANK = { question: '', mentor: '', data_plan: '', writeup: '', deadline: '', stage: 'question' };

function Annotations({ d, reload }) {
  const [quote, setQuote] = useState('');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const post = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/research/notes', { quote, comment });
      setQuote('');
      setComment('');
      reload();
    } catch (x) {
      setErr(x.message);
    }
  };
  const remove = async (n) => {
    await api.del(`/research/notes/${n.id}`).catch(() => {});
    reload();
  };
  return (
    <div className="pn-b" style={{ display: 'grid', gap: 12 }}>
      {d.signedIn ? (
        <form onSubmit={post} style={{ display: 'grid', gap: 8 }}>
          <input className="field" maxLength={200} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="A quote or section, like Section 3.2" aria-label="Quote or section" />
          <textarea className="field" rows={3} maxLength={400} required value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What stood out, or what confused you?" aria-label="Your comment" />
          {err && <p className="dn" role="alert">{err}</p>}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" disabled={comment.trim().length < 3}>Add note</button>
            <span className="m" style={{ fontSize: 12 }}>shows your first name to signed-in members</span>
          </div>
        </form>
      ) : (
        <p>Notes are for signed-in members. <Link to="/signin">Sign in</Link> to read and add them.</p>
      )}
      {d.notes.map((n) => (
        <div className="rs-note" key={n.id}>
          {n.quote && <q>{n.quote}</q>}
          <p>{n.comment}</p>
          <div className="m" style={{ fontSize: 12 }}>
            {n.author}{' '}
            {n.mine ? <button type="button" className="linkb" onClick={() => remove(n)}>delete</button> : <ReportButton kind="paper_note" id={n.id} what="this note" />}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectCard({ d, reload }) {
  const [f, setF] = useState({ ...BLANK, ...(d.project ?? {}), deadline: d.project?.deadline ?? '' });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await api.put('/research/project', f);
      setMsg('Saved.');
      reload();
    } catch (x) {
      setMsg(x.message);
    }
  };
  if (!d.signedIn) return <div className="pn-b"><p>Sign in to keep a project card.</p><Link className="btn" to="/signin">Sign in</Link></div>;
  return (
    <form className="pn-b" onSubmit={save} style={{ display: 'grid', gap: 10 }}>
      <p className="d" style={{ fontSize: 12.5 }}>Only you and the officers can see this card.</p>
      <div className="chips" role="group" aria-label="Stage">
        {d.stages.map((s) => (
          <button type="button" key={s} aria-pressed={f.stage === s} onClick={() => setF((x) => ({ ...x, stage: s }))}>{STAGE_LABEL[s]}</button>
        ))}
      </div>
      <label className="d">Research question<textarea className="field" rows={2} maxLength={300} value={f.question} onChange={set('question')} /></label>
      <label className="d">Mentor<input className="field" maxLength={120} value={f.mentor} onChange={set('mentor')} /></label>
      <label className="d">Data plan<textarea className="field" rows={2} maxLength={400} value={f.data_plan} onChange={set('data_plan')} /></label>
      <label className="d">Write-up<textarea className="field" rows={2} maxLength={400} value={f.writeup} onChange={set('writeup')} /></label>
      <label className="d">Deadline<input className="field" type="date" value={f.deadline} onChange={set('deadline')} /></label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn">Save card</button>
        {msg && <span className="m" role="status" style={{ fontSize: 12 }}>{msg}</span>}
      </div>
    </form>
  );
}

export default function Research() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useReveal();
  const load = useCallback(() => api.get('/research').then(setD).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading research...</div>;

  return (
    <>
      <PageHead
        eyebrow="research --this-month"
        title={<>Read one paper. <em>Ask real questions</em>.</>}
        lead="A paper each month, a place to track a science-fair project, and every research program on the board."
      />
      <section className="sec">
        <div className="wrap ideas-grid">
          <div style={{ minWidth: 0, display: 'grid', gap: 18 }}>
            <Pane file="paper-of-the-month" meta={d.paper ? d.paper.created_at.slice(0, 10) : 'none yet'}>
              <div className="pn-b">
                {d.paper ? (
                  <>
                    <h2 style={{ fontSize: 18 }}><a href={d.paper.url} target="_blank" rel="noopener noreferrer">{d.paper.title}</a></h2>
                    {d.paper.why && <p>{d.paper.why}</p>}
                  </>
                ) : (
                  <p className="d">No paper picked yet. An officer will post one.</p>
                )}
              </div>
              {d.paper && <Annotations d={d} reload={load} />}
            </Pane>
            <Pane file="research-opportunities" meta={`${d.opportunities.length} on the board`} spot={false}>
              <div className="pn-b">
                {d.opportunities.length === 0 && <p className="d">Nothing listed right now.</p>}
                <ul className="ul">
                  {d.opportunities.map((o) => (
                    <li key={o.id}>
                      <a href={o.url} target="_blank" rel="noopener noreferrer">{o.title}</a>
                      <span className="m" style={{ fontSize: 12 }}> {o.org}{o.deadline ? ` · due ${o.deadline}` : ''} · {o.cost}</span>
                    </li>
                  ))}
                </ul>
                <p className="d" style={{ marginTop: 8 }}><Link to="/opportunities">All opportunities</Link></p>
              </div>
            </Pane>
          </div>
          <Pane file="science-fair" meta="private">
            <ProjectCard key={d.project?.updated_at ?? 'new'} d={d} reload={load} />
          </Pane>
        </div>
      </section>
    </>
  );
}
