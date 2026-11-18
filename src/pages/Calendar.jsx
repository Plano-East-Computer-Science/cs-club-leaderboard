import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/data.jsx';
import { formatDate, TYPE_LABELS } from '../lib/format.js';
import { useReveal } from '../lib/ui.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SY = [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6]; // school year order, Aug first

export default function CalendarPage() {
  const { opportunities, settings, errors, reload, opps } = useData();
  useReveal();

  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const yr = (i) => (SY[i] >= 7 ? startYear : startYear + 1);
  const nowI = SY.indexOf(now.getMonth());

  const [sm, setSm] = useState(nowI);
  const [tf, setTf] = useState('all');
  const [sel, setSel] = useState(null);
  const [copied, setCopied] = useState('copy feed url');

  /* Real deadlines. One bar per deadline month; no deadline means "rolling". */
  const { dated, rolling } = useMemo(() => {
    const dated = [];
    const rolling = [];
    for (const o of opportunities) {
      if (!o.deadline) {
        rolling.push(o);
        continue;
      }
      const d = new Date(`${o.deadline}T12:00:00`);
      const i = (d.getFullYear() - startYear) * 12 + d.getMonth() - 7;
      if (i >= 0 && i < 12) dated.push({ ...o, idx: [i], day: d });
    }
    return { dated, rolling };
  }, [opportunities, startYear]);

  const types = [...new Set(dated.map((o) => o.type))];
  const vis = dated.filter((o) => tf === 'all' || o.type === tf);
  const items = vis.filter((o) => o.idx.includes(sm)).sort((a, b) => a.day - b.day);
  const feed = `${location.host}/api/deadlines.ics`;

  const setMonth = (i) => {
    setSm(i);
    setSel(null);
  };

  if (errors.opps && !opps)
    return (
      <div className="state-note bad">
        {errors.opps}
        <br />
        <button className="btn btn-ghost" onClick={reload}>Try again</button>
      </div>
    );

  return (
    <>
      <section className="oh">
        <div className="wrap oh2 rv">
          <div>
            <h1>Calendar</h1>
            <p className="sub" style={{ margin: '10px 0 0' }}>
              Meetings and club events on one side. Every opportunity deadline on the other. Subscribe once and it stays
              current on its own, since it comes straight from the{' '}
              <Link className="g uline" to="/opportunities">opportunity board</Link>.
            </p>
          </div>
          <a className="webcal" href={`webcal://${feed}`} title="Opens your calendar app's subscribe dialog">
            + subscribe <small>cat deadlines.ics</small>
          </a>
        </div>
      </section>

      <section className="sec" style={{ border: 0, paddingTop: 14 }}>
        <div className="wrap">
          <div className="cal">
            <div className="panel rv" id="yr">
              <div className="pane-h">
                <span><b>deadlines</b> school year {startYear}-{String(startYear + 1).slice(2)}</span>
                <span>{vis.length} dated, {rolling.length} rolling</span>
              </div>
              <div className="cbar">
                <div className="mnav">
                  <button aria-label="Previous month" disabled={sm === 0} onClick={() => setMonth(Math.max(0, sm - 1))}>&lt;</button>
                  <h2 aria-live="polite">
                    {FULL[SY[sm]]} <small className="m" style={{ font: '400 12px var(--mono)' }}>{yr(sm)}</small>
                  </h2>
                  <button aria-label="Next month" disabled={sm === 11} onClick={() => setMonth(Math.min(11, sm + 1))}>&gt;</button>
                  <button className="clr" onClick={() => setMonth(nowI)}>today</button>
                </div>
                <div className="cg">
                  <span>--type</span>
                  <span className="cgi">
                    {['all', ...types].map((k) => (
                      <button key={k} className="chip" aria-pressed={k === tf} onClick={() => { setTf(k); setSel(null); }}>
                        {k} {k === 'all' ? dated.length : dated.filter((o) => o.type === k).length}
                      </button>
                    ))}
                  </span>
                </div>
              </div>
              <div className="gh" role="group" aria-label="Choose a month">
                <span className="gl">opportunity</span>
                <div className="mcells">
                  {MON.map((_, i) => (
                    <button key={i} className={`${i === sm ? 'on' : ''} ${i === nowI ? 'now' : ''}`} aria-pressed={i === sm} title={`${FULL[SY[i]]} ${yr(i)}`} onClick={() => setMonth(i)}>
                      {MON[SY[i]]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="gb">
                {vis.length ? (
                  vis.map((o) => (
                    <button
                      key={o.id}
                      className={`gr ty-${o.type} ${sel === o.id ? 'sel' : ''}`}
                      title={formatDate(o.deadline)}
                      onClick={() => {
                        setSel(o.id);
                        if (!o.idx.includes(sm)) setSm(o.idx[0]);
                      }}
                    >
                      <span className="gn"><i />{o.title}</span>
                      <span className="gs">
                        {MON.map((_, i) => (
                          <u key={i} className={`${o.idx.includes(i) ? 'f' : ''} ${i === sm ? 'col' : ''}`} />
                        ))}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="empty"><b>Nothing here.</b>No dated opportunities of this type.</div>
                )}
              </div>
              <div className="roll">
                <b>{rolling.length} with no fixed date</b> (rolling, weekly, or varies). Find them on the{' '}
                <Link className="g uline" to="/opportunities">opportunity board</Link>.
                <div className="tl">
                  {rolling.map((o) => (
                    <Link key={o.id} to={`/opportunities?q=${encodeURIComponent(o.title)}`}>{o.title}</Link>
                  ))}
                </div>
              </div>
              <p className="note">Deadlines are the dates officers have confirmed on the board. Each bar sits in the month its deadline falls in.</p>
            </div>

            <div className="side">
              <div className="panel rv" style={{ '--d': 1 }}>
                <div className="pane-h">
                  <span><b>closing in {FULL[SY[sm]].toLowerCase()}</b></span>
                  <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                </div>
                <div className="ml" aria-live="polite">
                  {items.length ? (
                    items.map((o) => (
                      <div key={o.id} className={`mi ty-${o.type} ${sel === o.id ? 'sel' : ''}`}>
                        <button aria-expanded={sel === o.id} onClick={() => setSel(sel === o.id ? null : o.id)}>
                          <div className="t1">
                            <span className="ty">{TYPE_LABELS[o.type] ?? o.type}</span>
                            <span className="wd">{formatDate(o.deadline).replace(/, \d{4}$/, '')}</span>
                          </div>
                          <h3>{o.title}</h3>
                          <div className="or">{o.org}</div>
                        </button>
                        <div className="dd">
                          <div>
                            <div className="ddi">
                              {o.description}
                              <div>
                                {o.url && <a className="go" href={o.url} target="_blank" rel="noreferrer noopener">Open</a>}
                                <Link className="lk" to={`/opportunities?q=${encodeURIComponent(o.title)}`}>on the board</Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty">
                      <b>Nothing with a deadline this month.</b>
                      Check the <Link className="g uline" to="/opportunities">opportunity board</Link> for rolling ones.
                    </div>
                  )}
                </div>
              </div>

              <div className="panel rv" style={{ '--d': 2 }}>
                <div className="pane-h"><span><b>subscribe</b> live feed</span><span>webcal</span></div>
                <div className="pad">
                  <p>Subscribing adds a live feed to your own calendar app. It updates on its own as deadlines change. It does not download a one-time file.</p>
                  <div className="acts">
                    <a className="go" href={`webcal://${feed}`}>+ Subscribe</a>
                    <button
                      className="sv"
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(`https://${feed}`);
                          setCopied('copied');
                        } catch {
                          setCopied('copy failed');
                        }
                        setTimeout(() => setCopied('copy feed url'), 1600);
                      }}
                    >
                      {copied}
                    </button>
                  </div>
                  <p className="m" style={{ fontSize: 12, marginTop: 8, wordBreak: 'break-all' }}>https://{feed}</p>
                </div>
              </div>

              <div className="panel rv" style={{ '--d': 3 }}>
                <div className="pane-h">
                  <span><b>meetings &amp; events</b></span>
                  <span>{settings.meetings_calendar_embed_url ? 'linked' : 'not linked'}</span>
                </div>
                {settings.meetings_calendar_embed_url ? (
                  <>
                    <iframe src={settings.meetings_calendar_embed_url} title="Club meetings calendar" width="100%" height="420" style={{ border: 0, display: 'block', background: '#fff' }} loading="lazy" />
                    {settings.meetings_calendar_subscribe_url && (
                      <div className="pad">
                        <a className="go" style={{ display: 'inline-block', background: 'var(--gold)', color: '#000', fontWeight: 800, padding: '6px 14px' }} href={settings.meetings_calendar_subscribe_url} target="_blank" rel="noreferrer noopener">
                          Add meetings to your calendar
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="pad">
                    <p>No calendar linked yet. An officer can set one up in a couple of minutes:</p>
                    <ol className="steps">
                      <li><i>1</i>Create a Google Calendar for the club (or use an existing one).</li>
                      <li><i>2</i>Settings, that calendar, Access permissions, make it public.</li>
                      <li><i>3</i>Settings, Integrate calendar, copy the embed URL and the public URL.</li>
                      <li><i>4</i>Paste both into Officer tools, Page text.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
