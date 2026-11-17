import { useState } from 'react';
import { formatDate } from '../lib/format.js';
import { useApi, useReveal } from '../lib/ui.js';
import { Pane, PageHead } from '../components/Pane.jsx';

/**
 * One problem: prompt, hints one at a time, solution on demand. Used for the
 * featured problem and for each archive row, so "I need a nudge" and "just tell
 * me" stay different actions.
 */
function Body({ puzzle, feat }) {
  const [shown, setShown] = useState(0);
  const [solved, setSolved] = useState(false);
  const hints = (puzzle.hints ?? '').split('\n').map((h) => h.trim()).filter(Boolean);
  const has = Boolean(puzzle.answer?.trim());
  const diff = String(puzzle.difficulty || '').toLowerCase();

  return (
    <div className={feat ? 'pc' : 'dsi'}>
      {feat && (
        <>
          <div className="top">
            <span className="g" style={{ fontSize: 12 }}>this_week</span>
            {diff && <span className={`diff ${diff}`}>{diff}</span>}
            <span className="date">{formatDate(puzzle.posted_at)}</span>
          </div>
          <h2>{puzzle.title}</h2>
        </>
      )}
      <p className="prompt">{puzzle.prompt}</p>
      {hints.length > 0 && (
        <div className="hints">
          <div className="hl">
            {hints.slice(0, shown).map((h, i) => (
              <div key={i} className="hint"><b>HINT {i + 1}</b>{h}</div>
            ))}
          </div>
          {shown < hints.length && (
            <button className="btn" type="button" onClick={() => setShown(shown + 1)}>
              {shown === 0 ? `Show a hint (${hints.length} available)` : 'Next hint'}
            </button>
          )}
        </div>
      )}
      <div className="sol">
        {!has ? (
          <p className="none">Solution posted after the next meeting.</p>
        ) : solved ? (
          <div className="so"><h4>solution</h4><pre>{puzzle.answer}</pre></div>
        ) : (
          <div className="row">
            <button className="btn" type="button" onClick={() => setSolved(true)}>Show solution</button>
            <small>No points for reading it. That is the whole deal.</small>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Puzzles() {
  const { data, error, reload } = useApi('/puzzles');
  const [diff, setDiff] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => new Set());
  useReveal();

  // With no puzzle flagged as this week's, feature the newest rather than leave the page empty.
  const current = data?.current ?? data?.puzzles?.[0] ?? null;
  // The featured problem is already in the archive list; showing it twice would
  // just be the same card printed under two headings.
  const arch = (data?.puzzles ?? []).filter((p) => p.id !== current?.id);
  const needle = q.trim().toLowerCase();
  const list = arch.filter(
    (p) => (diff === 'all' || String(p.difficulty).toLowerCase() === diff) && (!needle || `${p.title} ${p.prompt}`.toLowerCase().includes(needle))
  );

  return (
    <>
      <PageHead
        eyebrow="what practice looks like"
        title={<>Problem of the <em>Week</em>.</>}
        lead="Every meeting opens with one of these. No syntax, no compiler, just the part of computer science that is actually thinking. Hints are there when you are stuck; the solution is there when you are done. Reading either one costs you nothing but the point of doing it yourself."
      />
      <section className="sec" style={{ border: 0 }}>
        <div className="wrap">
          {error ? (
            <div className="state-note bad">{error}<br /><button className="btn btn-ghost" onClick={reload}>Try again</button></div>
          ) : !data ? (
            <div className="state-note">loading puzzles...</div>
          ) : !current && !arch.length ? (
            <div className="state-note">No puzzles posted yet.</div>
          ) : (
            <div className="pz">
              <div>
                {current ? (
                  <Pane file="potw.txt" meta="Problem of the Week" cls="gd">
                    <Body puzzle={current} feat />
                  </Pane>
                ) : (
                  <div className="state-note">No problem of the week is set. Pick one from the archive.</div>
                )}
              </div>
              <section className="pn sp" aria-label="Earlier problems">
                <div className="pane-h">
                  <span><b>archive/</b> earlier problems</span>
                  <span>{list.length} of {arch.length}</span>
                </div>
                <div className="arf">
                  <div className="grepbar">
                    <span className="ps">grep -i</span>
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="coins, bridge, eggs ..." aria-label="Filter earlier problems" spellCheck="false" autoComplete="off" />
                  </div>
                  <div className="cg">
                    <span>--difficulty</span>
                    <span className="cgi">
                      {['all', 'easy', 'medium', 'hard'].map((d) => (
                        <button key={d} className="chip" type="button" aria-pressed={diff === d} onClick={() => setDiff(d)}>{d}</button>
                      ))}
                    </span>
                  </div>
                </div>
                {list.length ? (
                  list.map((p) => {
                    const isOpen = open.has(p.id);
                    const d = String(p.difficulty || '').toLowerCase();
                    return (
                      <div key={p.id} className="ar" data-open={isOpen}>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setOpen((s) => {
                              const n = new Set(s);
                              n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                              return n;
                            })
                          }
                        >
                          <span className="ch" aria-hidden="true">&gt;</span>
                          <span className="t">{p.title}</span>
                          <span className="meta">
                            {d && <span className={`diff ${d}`}>{d}</span>}
                            <span>{formatDate(p.posted_at)}</span>
                          </span>
                        </button>
                        <div className="ds"><div><Body puzzle={p} /></div></div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty">
                    {arch.length ? 'No problems match. ' : 'Nothing in the archive yet. '}
                    {arch.length > 0 && (
                      <button className="clr" type="button" onClick={() => { setDiff('all'); setQ(''); }}>reset</button>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
