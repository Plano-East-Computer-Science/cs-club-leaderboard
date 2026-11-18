/**
 * The onboarding compass (E1): six questions, one at a time, then the path
 * they lead to and the first three things to do. Retake any time.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { QUESTIONS, PATHS } from '../../shared/compass.js';

export default function Compass() {
  const { user, loading } = useUser();
  const nav = useNavigate();
  const [answers, setAnswers] = useState({});
  const [i, setI] = useState(0);
  const [path, setPath] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Retaking starts from the last answers.
  useEffect(() => {
    if (user) api.get('/me/compass').then((r) => r.answers && setAnswers(r.answers)).catch(() => {});
  }, [user]);

  if (loading) return <div className="state-note">loading...</div>;
  if (!user)
    return (
      <div className="state-note">
        <p>The compass picks a path for you and shapes your Today page. Sign in to take it.</p>
        <Link className="btn pri" to="/signin" style={{ marginTop: 14 }}>Sign in</Link>
      </div>
    );

  if (path) return <Result path={path} />;

  const q = QUESTIONS[i];
  const val = answers[q.id];
  const picked = q.multi ? (Array.isArray(val) ? val : []) : val;
  const ready = q.multi ? picked.length > 0 : Boolean(picked);
  const last = i === QUESTIONS.length - 1;

  const choose = (v) => {
    setErr('');
    if (!q.multi) return setAnswers((a) => ({ ...a, [q.id]: v }));
    // "Not sure" and a real pick do not go together.
    const cur = picked.filter((x) => (v === 'unsure' ? false : x !== 'unsure'));
    setAnswers((a) => ({ ...a, [q.id]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }));
  };

  const next = async (e) => {
    e.preventDefault();
    if (!ready) return;
    if (!last) return setI(i + 1);
    setBusy(true);
    try {
      const r = await api.put('/me/compass', { answers });
      setPath(r.path);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    await api.post('/me/compass/skip').catch(() => {});
    nav('/');
  };

  return (
    <section className="cmp">
      <div className="wrap">
        <div className="cmp-bar" role="progressbar" aria-label="Compass progress" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={i + 1}>
          {QUESTIONS.map((x, k) => <i key={x.id} className={k <= i ? 'on' : undefined} />)}
        </div>
        <p className="eb"><span className="g">$</span>compass {i + 1}/{QUESTIONS.length}</p>
        <form onSubmit={next}>
          <fieldset className="cmp-q">
            <legend><h1>{q.q}</h1></legend>
            {q.hint && <p className="d cmp-hint">{q.hint}</p>}
            <div className="cmp-opts">
              {q.options.map(([v, label]) => {
                const on = q.multi ? picked.includes(v) : picked === v;
                return (
                  <label key={v} className={on ? 'on' : undefined}>
                    <input type={q.multi ? 'checkbox' : 'radio'} name={q.id} value={v} checked={on} onChange={() => choose(v)} />
                    <span className="bx" aria-hidden="true">{q.multi ? (on ? '[x]' : '[ ]') : on ? '(*)' : '( )'}</span>
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {err && <p className="dn" role="status">{err}</p>}
          <div className="cmp-nav">
            <button className="btn pri" disabled={!ready || busy}>{last ? 'See my path' : 'Next'}</button>
            {i > 0 && <button type="button" className="btn" onClick={() => setI(i - 1)}>Back</button>}
            <button type="button" className="linkb cmp-skip" onClick={skip}>Skip for now</button>
          </div>
        </form>
      </div>
    </section>
  );
}

function Result({ path }) {
  const p = PATHS[path];
  return (
    <section className="cmp">
      <div className="wrap">
        <p className="eb"><span className="g">$</span>compass --result</p>
        <h1 className="cmp-path">Your path: <span className="g">{p.name}</span></h1>
        <p className="cmp-about">{p.about}</p>
        <h2 className="cmp-h">Start with these three</h2>
        <ol className="cmp-first">
          {p.first.map((f) => (
            <li key={f.title}><Link to={f.to}>{f.title}</Link></li>
          ))}
        </ol>
        <p className="cmp-about">Have a goal in mind, like USACO Silver or a first internship? <Link to="/pathways">Pick a pathway</Link> and Today will show its next step.</p>
        <div className="cmp-nav">
          <Link className="btn pri" to="/">Go to Today</Link>
          <button type="button" className="linkb" onClick={() => location.reload()}>Retake it</button>
        </div>
      </div>
    </section>
  );
}
