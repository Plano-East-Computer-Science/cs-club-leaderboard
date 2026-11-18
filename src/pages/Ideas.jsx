import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import ReportButton from '../components/ReportButton.jsx';

const KIND_HINT = {
  lesson: 'Something you want taught. "How do neural nets actually learn?"',
  project: 'Something to build together. "A Discord bot for lunch menus."',
  speaker: 'Someone you want to hear from. "A UTD student who interned at a startup."',
  event: 'Something to do. "A 2-hour mini hackathon during Panther Pause."',
  site: 'Something this website should do.',
};

export default function Ideas() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [kind, setKind] = useState('lesson');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  useReveal();

  const load = useCallback(() => api.get('/ideas').then(setD).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading ideas...</div>;

  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api.post('/ideas', { kind, body });
      setBody('');
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const vote = async (idea) => {
    // Move the number now; put it back if the server says no.
    const flip = (x) => (x.id === idea.id ? { ...x, voted: !x.voted, votes: x.votes + (x.voted ? -1 : 1) } : x);
    setD((cur) => ({ ...cur, ideas: cur.ideas.map(flip) }));
    try {
      await api.post(`/ideas/${idea.id}/vote`);
    } catch {
      setD((cur) => ({ ...cur, ideas: cur.ideas.map(flip) }));
    }
  };

  const remove = async (idea) => {
    if (!window.confirm('Delete your idea?')) return;
    await api.del(`/ideas/${idea.id}`).catch(() => {});
    load();
  };

  const shown = d.ideas.filter((i) => filter === 'all' || i.kind === filter);
  const planned = d.ideas.filter((i) => i.status === 'planned').length;
  const shipped = d.ideas.filter((i) => i.status === 'done').length;

  return (
    <>
      <PageHead
        eyebrow="ideas --vote"
        title={<>You pick <em>what we run</em>.</>}
        lead="Post what you want the club to teach, build or host, and vote for what others posted. Officers plan meetings from the top of this list and mark what gets done."
        kv={
          <div className="kv">
            <div><span>ideas</span><strong>{d.ideas.length}</strong></div>
            <div><span>planned</span><strong>{planned}</strong></div>
            <div><span>done</span><strong>{shipped}</strong></div>
          </div>
        }
      />

      <section className="sec">
        <div className="wrap ideas-grid">
          <Pane file="new-idea" meta={d.signedIn ? '280 characters' : 'needs an account'}>
            <div className="pn-b">
              {d.signedIn ? (
                <form onSubmit={post} style={{ display: 'grid', gap: 12 }}>
                  <div className="chips" role="group" aria-label="Kind of idea">
                    {d.kinds.map((k) => (
                      <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>
                    ))}
                  </div>
                  <p className="d" style={{ fontSize: 12.5 }}>{KIND_HINT[kind]}</p>
                  <textarea
                    className="field"
                    rows={4}
                    maxLength={280}
                    required
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What should we do?"
                    aria-label="Your idea"
                  />
                  {formError && <p className="dn" role="alert">{formError}</p>}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn" style={{ whiteSpace: 'nowrap' }} disabled={busy || body.trim().length < 8}>{busy ? 'Posting...' : 'Post idea'}</button>
                    <span className="m" style={{ fontSize: 12 }}>{body.length}/280 · shows your first name</span>
                  </div>
                </form>
              ) : (
                <>
                  <p>Anyone can read the board. Posting and voting need an account so each person gets one vote.</p>
                  <Link className="btn" to="/signin">Sign in</Link>
                </>
              )}
            </div>
          </Pane>

          <div style={{ minWidth: 0 }}>
            <div className="chips" role="group" aria-label="Filter ideas" style={{ marginBottom: 10 }}>
              {['all', ...d.kinds].map((k) => (
                <button type="button" key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{k}</button>
              ))}
            </div>
            <Pane file="ideas" meta={`${shown.length} shown · most votes first`} spot={false}>
              {shown.length === 0 ? (
                <div className="pn-b"><p className="d">Nothing here yet. Be the first.</p></div>
              ) : (
                shown.map((i) => (
                  <div className="idea" key={i.id}>
                    <button
                      type="button"
                      className="vote"
                      aria-pressed={i.voted}
                      disabled={!d.signedIn || i.status === 'done'}
                      onClick={() => vote(i)}
                      aria-label={`${i.votes} votes. ${i.voted ? 'Remove your vote' : 'Vote for this'}`}
                      title={d.signedIn ? undefined : 'Sign in to vote'}
                    >
                      <span aria-hidden="true">▲</span>
                      <b>{i.votes}</b>
                    </button>
                    <div className="ib">
                      <p>{i.body}</p>
                      <div className="im">
                        <span className="chip">{i.kind}</span>
                        {i.status !== 'open' && <span className={`chip ${i.status}`}>{i.status}</span>}
                        <span>{i.author}</span>
                        {i.mine
                          ? <button type="button" className="linkb" onClick={() => remove(i)}>delete</button>
                          : d.signedIn && <ReportButton kind="idea" id={i.id} what="this idea" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Pane>
          </div>
        </div>
      </section>
    </>
  );
}
