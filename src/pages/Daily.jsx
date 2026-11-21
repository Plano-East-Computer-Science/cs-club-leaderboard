import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import CodeRunner from '../components/CodeRunner.jsx';
import Editorials from '../components/Editorials.jsx';
import { Body } from './Course.jsx';
import { useReveal } from '../lib/ui.js';
import { formatMs, shareText } from '../../shared/daily.js';

/**
 * C3: one problem a day for the whole club. The browser judges it (same honour
 * system as the bank); a solve is saved when signed in and turns into a line you
 * can paste into a group chat.
 */
export default function Daily() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [solve, setSolve] = useState(null); // { attempts, ms } from this visit
  const [saveError, setSaveError] = useState('');
  const [copied, setCopied] = useState(false);
  const started = useRef(Date.now());
  useReveal();

  const load = useCallback(() => api.get('/daily').then(setD).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading today's problem...</div>;

  const p = d.problem;
  const done = d.mine ? { attempts: d.mine.attempts, ms: d.mine.ms } : solve;
  const share = done ? shareText({ date: d.date, ...done }) : '';

  const onResults = async (_res, passed) => {
    const n = attempts + 1;
    setAttempts(n);
    if (!passed || done) return;
    const result = { attempts: n, ms: Math.min(Date.now() - started.current, 86_400_000) };
    setSolve(result);
    if (!d.signedIn) return;
    try {
      setD(await api.post('/daily/result', result));
    } catch (e) {
      setSaveError(e.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this:', share);
    }
  };

  const week = d.week;
  const weekLine = week
    ? `${week.solved} of ${week.of} this week, ${week.freeMissUsed ? '1 free miss used' : '1 free miss left'}`
    : null;

  return (
    <>
      <PageHead
        eyebrow="daily"
        title="Today's problem"
        lead="Same problem for everyone, new one at midnight. A solve usually takes under five minutes."
      />
      <div className="wrap daily-grid">
        {!p ? (
          <Pane file="daily.md" meta={d.date}>
            <div className="pn-b"><p>There is no daily problem yet. Check back once the problem bank has live problems.</p></div>
          </Pane>
        ) : (
          <>
            <div className="daily-main">
              <Pane file={`${p.slug}.md`} meta={`${d.date}  level ${p.difficulty}`}>
                <div className="pn-b">
                  <h2 className="daily-title">{p.title}</h2>
                  <div className="daily-body"><Body text={p.body} /></div>
                  {p.tags.length > 0 && (
                    <div className="chips" style={{ marginTop: 10 }}>
                      {p.tags.map((t) => <span key={t} className="chip">{t}</span>)}
                    </div>
                  )}
                </div>
              </Pane>
              <Pane file="solution" meta="runs in your browser">
                <div className="pn-b">
                  <CodeRunner id="daily" cases={p.cases} initial={p.starter} onResults={onResults} playground={false} />
                  {saveError && <p className="mono mt-2 text-xs" style={{ color: 'var(--down)' }} role="alert">{saveError}</p>}
                </div>
              </Pane>
            </div>
            <div className="daily-side">
              {done && (
                <Pane file="share.txt" meta="paste it anywhere">
                  <div className="pn-b">
                    <pre className="daily-share">{share}</pre>
                    <button type="button" className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy result'}</button>
                    {!d.signedIn && (
                      <p className="daily-note">
                        Not saved. <Link to="/signin" className="linkb">Sign in</Link> to count this toward your week.
                      </p>
                    )}
                  </div>
                </Pane>
              )}
              {done && d.mine && <Editorials slug={p.slug} refreshKey={1} />}
              <Pane file="today.log" meta={d.date}>
                <div className="pn-b">
                  <dl className="daily-kv">
                    <dt>solved today</dt>
                    <dd>{d.stats.solved}</dd>
                    <dt>median time</dt>
                    <dd>{d.stats.medianMs == null ? 'none yet' : formatMs(d.stats.medianMs)}</dd>
                    <dt>your week</dt>
                    <dd>{weekLine ?? 'sign in to track it'}</dd>
                  </dl>
                </div>
              </Pane>
            </div>
          </>
        )}
      </div>
    </>
  );
}
