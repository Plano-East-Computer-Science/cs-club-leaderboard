import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

/**
 * "Looking for a teammate" posts (D4) for one ship cycle (type "cycle") or one
 * opportunity (type "opp"). Authors are first names linking to their portfolio.
 */
export default function TeamPosts({ type, id, canPost = true }) {
  const [d, setD] = useState(null);
  const [text, setText] = useState('');
  const [skills, setSkills] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get(`/team-posts?type=${type}&id=${id}`).then(setD).catch((e) => setError(e.message)), [type, id]);
  useEffect(() => { setD(null); load(); }, [load]);

  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/team-posts', { target_type: type, target_id: id, text, skills });
      setText('');
      setSkills('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const close = (p) => api.post(`/team-posts/${p.id}/close`).then(load).catch((e) => setError(e.message));

  if (!d) return <p className="d" style={{ fontSize: 13 }}>{error || 'loading...'}</p>;
  return (
    <div className="tp">
      {d.posts.length === 0 && <p className="d">No one is looking yet.</p>}
      {d.posts.map((p) => (
        <div className="tp-i" key={p.id}>
          <p>
            <Link className="g" to={`/u/${p.author_id}`}>{p.author}</Link>: {p.text}
          </p>
          <p className="m" style={{ fontSize: 12 }}>
            {p.skills ? `needs: ${p.skills}` : 'open to anyone'}
            {p.mine && <> · <button type="button" className="tp-x" onClick={() => close(p)}>found someone, take it down</button></>}
          </p>
        </div>
      ))}
      {canPost && d.signedIn && (
        <form onSubmit={post} className="tp-f">
          <label className="m" htmlFor={`tp-${type}-${id}`} style={{ fontSize: 12 }}>Looking for a teammate? Say what you are doing and how to find you (200 characters).</label>
          <textarea id={`tp-${type}-${id}`} className="field" rows={2} maxLength={200} value={text} onChange={(e) => setText(e.target.value)} required />
          <input className="field" maxLength={60} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Skills you need, e.g. css, python" aria-label="Skills you need" />
          {error && <p className="dn" role="alert" style={{ fontSize: 13 }}>{error}</p>}
          <div><button className="btn" disabled={busy || text.trim().length < 8}>{busy ? 'Posting...' : 'Post'}</button></div>
        </form>
      )}
      {canPost && !d.signedIn && <p className="d" style={{ fontSize: 13 }}><Link className="g" to="/signin">Sign in</Link> to post.</p>}
      {!(canPost && d.signedIn) && error && <p className="dn" role="alert">{error}</p>}
    </div>
  );
}
