import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/data.jsx';
import { parseSections } from '../lib/md.js';
import { useReveal } from '../lib/ui.js';
import { PageHead } from '../components/Pane.jsx';

export default function Join() {
  const { settings } = useData();
  const [done, setDone] = useState(() => new Set());
  useReveal();

  const code = settings.join_classroom_code?.trim();
  const meeting = settings.join_meeting_info?.trim();
  const toggle = (n) =>
    setDone((s) => {
      const x = new Set(s);
      x.has(n) ? x.delete(n) : x.add(n);
      return x;
    });
  const mark = (n) => (done.has(n) ? <span className="ok">[x]</span> : <span className="wt">[ ]</span>);

  const toggleBtn = (n) => (
    <button key={n} className="btn tg" type="button" aria-pressed={done.has(n)} onClick={() => toggle(n)}>
      {done.has(n) ? '[x] marked done' : '[ ] mark done'}
    </button>
  );

  return (
    <>
      <PageHead
        eyebrow="get involved"
        title={<>How to <em>join</em></>}
        lead={
          <>
            {settings.join_intro || 'No experience needed. Beginners and returning competitors are both covered.'} See the{' '}
            <Link className="g uline" to="/curriculum">Curriculum</Link> page for what that looks like week to week.
          </>
        }
        kv={
          <div className="kv two2">
            <div><span>steps</span><strong>3</strong></div>
            <div><span>progress</span><strong>{done.size} of 2 done</strong></div>
          </div>
        }
      />
      <section className="sec" style={{ border: 0 }}>
        <div className="wrap">
          <div className="jsteps">
            <article className={`pn stp sp ${done.has(1) ? 'done' : ''}`}>
              <div className="pane-h"><span><b>step_1</b></span><span>required</span></div>
              <div className="pn-b">
                <div className="hd"><span className="no">01</span><h2>Parent consent form</h2><span className="tagr rq">Required</span></div>
                <p className="d">You cannot attend meetings until this is submitted.</p>
                <div className="act">
                  {settings.join_consent_url ? (
                    <a className="btn pri" href={settings.join_consent_url} target="_blank" rel="noreferrer noopener">Open the consent form &#8599;</a>
                  ) : (
                    <span className="soon">Link not set yet. Ask an officer.</span>
                  )}
                  {toggleBtn(1)}
                </div>
              </div>
            </article>

            <article className={`pn stp sp ${done.has(2) ? 'done' : ''}`}>
              <div className="pane-h"><span><b>step_2</b></span><span /></div>
              <div className="pn-b">
                <div className="hd"><span className="no">02</span><h2>Google Classroom</h2></div>
                <p className="d">Everything: slides, problems, competition signups, lives there.</p>
                <div className="act">
                  {code ? <span className="g" style={{ border: '1px solid var(--gold-d)', padding: '3px 10px', fontWeight: 700 }}>{code}</span> : <span className="soon">Code coming soon. Check back or ask an officer.</span>}
                  {toggleBtn(2)}
                </div>
              </div>
            </article>

            <article className="pn stp sp">
              <div className="pane-h"><span><b>step_3</b></span><span /></div>
              <div className="pn-b">
                <div className="hd"><span className="no">--</span><h2>Meeting</h2></div>
                {meeting ? (
                  parseSections(meeting).flatMap((s, i) => [
                    s.h && <p key={`h${i}`} className="g">{s.h}</p>,
                    ...s.blocks.map((b, k) => (b.p ? <p key={`${i}p${k}`} className="d">{b.p}</p> : <ul key={`${i}u${k}`} className="ul">{b.ul.map((t, j) => <li key={j}>{t}</li>)}</ul>)),
                  ])
                ) : (
                  <p className="d">Day, time, and room have not been posted here yet. Ask an officer or check the school announcements.</p>
                )}
              </div>
            </article>
          </div>

          <div className="jf">
            <section className="pn term">
              <div className="pane-h"><span><b>join.sh</b> your checklist</span><span>marks stay on this page only</span></div>
              <pre aria-live="polite">
                {'$ ./join.sh --status\n'}
                {mark(1)} 1  parent consent form  <b>required</b>{'\n'}
                {mark(2)} 2  google classroom{'\n'}
                {'    3  meeting  '}<b>{meeting ? 'see above' : 'ask an officer'}</b>{'\n\n'}
                {done.has(1) ? (
                  <span className="ok">consent marked done. you can attend meetings once it is on file.</span>
                ) : (
                  <span className="wt">waiting on step 1. you cannot attend meetings until it is submitted.</span>
                )}
              </pre>
            </section>
            <section className="pn">
              <div className="pane-h"><span><b>next.txt</b> while you wait</span></div>
              <ul className="ul" style={{ padding: '6px 18px 10px' }}>
                <li><Link className="g" to="/curriculum">Curriculum</Link> : what the weeks look like</li>
                <li><Link className="g" to="/puzzles">Puzzles</Link> : try the Problem of the Week</li>
                <li><Link className="g" to="/">Standings</Link> : see how points work in practice</li>
                <li><Link className="g" to="/about">About</Link> : officers and meeting details</li>
              </ul>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
