import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { useData } from '../lib/data.jsx';
import { formatDate, daysUntil, TYPE_LABELS, FORMAT_LABELS, COST_LABELS } from '../lib/format.js';
import { useMedia } from '../lib/ui.js';
import TeamPosts from '../components/TeamPosts.jsx';

const TYPE_ORDER = ['competition', 'program', 'internship', 'resource', 'scholarship'];
const COST_NOTE = {
  free: 'No cost to students.',
  paid: 'Fees apply. Ask about financial aid.',
  stipend: 'You are paid to take part.',
};
const ddl = (o) => (o.deadline ? formatDate(o.deadline).replace(/, \d{4}$/, '') : 'Rolling');

const Bookmark = ({ on }) => (
  <svg viewBox="0 0 24 24" className={`bmi ${on ? 'on' : ''}`} aria-hidden="true">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </svg>
);

function Mark({ text, q }) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function Opportunities() {
  const { opportunities: all, radius, errors, reload, opps } = useData();
  const [params] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const [type, setType] = useState('');
  const [fmt, setFmt] = useState('');
  const [cost, setCost] = useState('');
  const [onlySaved, setOnlySaved] = useState(false);
  const [sel, setSel] = useState(() => Number((location.hash.match(/o=(\d+)/) || [])[1] ?? -1));
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('e-saved') || '[]'));
    } catch {
      return new Set();
    }
  });
  const listRef = useRef(null);
  const wide = useMedia('(min-width:960px)');
  const [teams, setTeams] = useState({}); // D4: open teammate posts per opportunity
  useEffect(() => { api.get('/team-posts/counts').then((r) => setTeams(r.counts)).catch(() => {}); }, []);

  // The `grep` command (and calendar links) arrive as ?q=
  useEffect(() => setQ(urlQ), [urlQ]);

  const persist = (s) => {
    try {
      localStorage.setItem('e-saved', JSON.stringify([...s]));
    } catch {
      /* private mode */
    }
  };

  const pass = (o, skip) => {
    const needle = q.trim().toLowerCase();
    return (
      (skip === 'type' || !type || o.type === type) &&
      (!fmt || o.format === fmt) &&
      (!cost || o.cost === cost) &&
      (!onlySaved || saved.has(o.id)) &&
      (!needle || `${o.title} ${o.org} ${o.description} ${o.type} ${o.format} ${o.cost} ${o.location}`.toLowerCase().includes(needle))
    );
  };

  const vis = useMemo(() => all.filter((o) => pass(o)), [all, q, type, fmt, cost, onlySaved, saved]); // eslint-disable-line
  const types = TYPE_ORDER.filter((t) => all.some((o) => o.type === t)).concat([...new Set(all.map((o) => o.type))].filter((t) => !TYPE_ORDER.includes(t)));
  const count = (k) => all.filter((o) => pass(o, 'type') && (!k || o.type === k)).length;
  const cur = vis.find((o) => o.id === sel) ?? vis[0] ?? null;

  const pick = (id, openSheet) => {
    setSel(id);
    history.replaceState(null, '', `#o=${id}`);
    if (openSheet && !wide) setOpen(true);
  };
  const toggleSave = (id) =>
    setSaved((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      persist(n);
      return n;
    });

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches?.('input,select,textarea') || e.ctrlKey || e.metaKey || !vis.length) return;
      const i = vis.findIndex((o) => o.id === cur?.id);
      const go = (n) => {
        if (!vis[n]) return;
        pick(vis[n].id);
        listRef.current?.querySelector(`[data-id="${vis[n].id}"]`)?.scrollIntoView({ block: 'nearest' });
      };
      if (e.key === 'j') { e.preventDefault(); go(i + 1); }
      if (e.key === 'k') { e.preventDefault(); go(i - 1); }
      if (e.key === 's' && cur) toggleSave(cur.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (errors.opps && !opps)
    return (
      <div className="state-note bad">
        {errors.opps}
        <br />
        <button className="btn btn-ghost" onClick={reload}>Try again</button>
      </div>
    );
  if (!opps) return <div className="state-note">loading opportunities...</div>;

  const reset = () => {
    setQ('');
    setType('');
    setFmt('');
    setCost('');
    setOnlySaved(false);
  };

  return (
    <>
      <div className="ctl">
        <div className="wrap">
          <div className="tabs2" role="tablist" aria-label="Opportunity type">
            {[['', 'all'], ...types.map((t) => [t, `${(TYPE_LABELS[t] ?? t).toLowerCase()}s`])].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={type === k} className={k ? `t-${k}` : undefined} onClick={() => setType(k)}>
                <span>{l}</span>
                <b>{count(k)}</b>
              </button>
            ))}
            <button className="svb" aria-pressed={onlySaved} onClick={() => setOnlySaved(!onlySaved)}>
              <Bookmark on={false} />
              saved <b>{saved.size}</b>
            </button>
          </div>
          <div className="row2">
            <div className="grepbar">
              <span className="ps">grep -i</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="usaco, ctf, free, mit ..."
                aria-label="Filter opportunities"
                spellCheck="false"
                autoComplete="off"
              />
              <span className="cnt">{vis.length}/{all.length}</span>
            </div>
            <div className="cg">
              <span>--where</span>
              <span className="cgi">
                {[['online', 'online'], ['local', `within ${radius} mi`], ['residential', 'on-campus']].map(([v, l]) => (
                  <button key={v} className="chip" aria-pressed={fmt === v} onClick={() => setFmt(fmt === v ? '' : v)}>{l}</button>
                ))}
              </span>
            </div>
            <div className="cg">
              <span>--cost</span>
              <span className="cgi">
                {[['free', 'free'], ['paid', 'costs money']].map(([v, l]) => (
                  <button key={v} className="chip" aria-pressed={cost === v} onClick={() => setCost(cost === v ? '' : v)}>{l}</button>
                ))}
              </span>
            </div>
            <button className="clr" onClick={reset}>reset</button>
          </div>
        </div>
      </div>

      <section className="sec" style={{ border: 0, paddingTop: 14 }}>
        <div className="wrap">
          <div className="md">
            <div className="list" ref={listRef} role="listbox" aria-label="Opportunities">
              {vis.length ? (
                vis.map((o, i) => (
                  <div
                    key={o.id}
                    className={`it b-${o.type} ${cur?.id === o.id ? 'on' : ''}`}
                    role="option"
                    aria-selected={cur?.id === o.id}
                    tabIndex={0}
                    data-id={o.id}
                    style={{ '--i': Math.min(i, 12) }}
                    onClick={() => pick(o.id, true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pick(o.id, true);
                      }
                    }}
                  >
                    <h3><Mark text={o.title} q={q.trim()} /></h3>
                    <p><Mark text={o.org || ''} q={q.trim()} /></p>
                    <div className="meta2">
                      <span className={`ty t-${o.type}`}>{o.type}</span>
                      <span className={`ff-${o.format}`}>
                        {o.format === 'local' && o.distance_mi != null ? `${Number(o.distance_mi).toFixed(1)} mi` : (FORMAT_LABELS[o.format] ?? o.format).toLowerCase()}
                      </span>
                      <span>{ddl(o)}</span>
                      {teams[o.id] > 0 && <span className="tmc">{teams[o.id]} looking for a team</span>}
                    </div>
                    <button
                      className={`bk ${saved.has(o.id) ? 'on' : ''}`}
                      aria-label={saved.has(o.id) ? 'remove bookmark' : 'save for later'}
                      aria-pressed={saved.has(o.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSave(o.id);
                      }}
                    >
                      <Bookmark on={saved.has(o.id)} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <b>grep: no lines match.</b>
                  {onlySaved ? 'Bookmark something first.' : 'Clear a filter, or try "free".'}
                </div>
              )}
            </div>
            <article className={`dt sp ${open ? 'open' : ''}`} aria-live="polite">
              {cur ? (
                <Detail key={cur.id} o={cur} radius={radius} on={saved.has(cur.id)} onSave={() => toggleSave(cur.id)} onBack={() => setOpen(false)} />
              ) : (
                <div className="empty"><b>Pick an opportunity</b>Details show up here.</div>
              )}
            </article>
          </div>
        </div>
      </section>
    </>
  );
}

function Detail({ o, radius, on, onSave, onBack }) {
  const [w, setW] = useState(0);
  const mi = o.distance_mi != null ? Number(o.distance_mi) : null;
  const scale = radius / 0.75; // the 15 mile tick sits at 75% of the meter
  const pct = o.format === 'local' && mi != null ? Math.min(100, (mi / scale) * 100) : 0;
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const days = daysUntil(o.deadline);
  const where =
    o.format === 'online'
      ? ['Online', 'No travel, join from home']
      : o.format === 'residential'
        ? ['On-campus', `${o.location || ''}${o.location ? '. ' : ''}Housing is part of the program`]
        : ['In person', o.location || 'Near Plano'];
  const ages = o.age_min != null && o.age_max != null ? `Ages ${o.age_min} to ${o.age_max}` : 'Check the official page for ages';

  return (
    <div className="in2">
      <button className="back" onClick={onBack}>&larr; all opportunities</button>
      <div className="dbody">
        <div className="dtags">
          <span className={`ty t-${o.type} tb-${o.type}`}>{o.type}</span>
          <span className="tg2">{FORMAT_LABELS[o.format] ?? o.format}</span>
          <span className={`tg2 ${o.cost !== 'paid' ? 'f' : ''}`}>{COST_LABELS[o.cost] ?? o.cost}</span>
        </div>
        <h2 className={`t-${o.type}`}>{o.title}</h2>
        <p className="org">{o.org}</p>
        <p className="desc">{o.description}</p>
        <div className="cells">
          <div className="cell">
            <small>deadline</small>
            <b>{o.deadline ? formatDate(o.deadline) : 'Rolling'}</b>
            <span>
              {o.deadline
                ? days < 0
                  ? 'This deadline has passed. Check the official page for next year.'
                  : `${days} day${days === 1 ? '' : 's'} left. Confirm on the official page.`
                : 'No fixed date. Check the official page.'}
            </span>
          </div>
          <div className="cell"><small>where</small><b>{where[0]}</b><span>{where[1]}</span></div>
          {o.format === 'local' && mi != null ? (
            <div className="cell">
              <small>distance from school</small>
              <b>{mi.toFixed(1)} miles</b>
              <div className="meter"><i style={{ width: `${w}%` }} /><u style={{ left: '75%' }} /></div>
              <span>{mi <= radius ? 'Inside' : 'Outside'} the {radius} mile limit (the tick marks {radius})</span>
            </div>
          ) : (
            <div className="cell">
              <small>distance from school</small>
              <b>{o.format === 'online' ? 'Not applicable' : 'Away from Plano'}</b>
              <span>{o.format === 'online' ? `Fully online, so the ${radius} mile rule does not apply.` : 'Residential programs house you, so there is no commute.'}</span>
            </div>
          )}
          <div className="cell"><small>cost</small><b>{COST_LABELS[o.cost] ?? o.cost}</b><span>{COST_NOTE[o.cost] ?? ''}</span></div>
        </div>
        <div className="req" id="team">
          <h4>looking for a team</h4>
          <TeamPosts type="opp" id={o.id} />
        </div>
        <div className="req">
          <h4>requirements</h4>
          <ul>
            <li>{ages}</li>
            <li>{o.format === 'local' ? `Able to commute, within ${radius} miles of Plano East` : o.format === 'online' ? 'Internet access and a laptop' : 'Able to travel and stay on site for the program'}</li>
            <li>Apply directly on the official site</li>
          </ul>
        </div>
      </div>
      <div className="dfoot">
        <div className="acts">
          {o.url ? (
            <a className="go" href={o.url} target="_blank" rel="noreferrer noopener">Apply on official site &rarr;</a>
          ) : (
            <span className="go off">No link posted yet</span>
          )}
          <button className={`sv ${on ? 'on' : ''}`} aria-pressed={on} onClick={onSave}>
            <Bookmark on={on} />
            {on ? 'saved' : 'save for later'}
          </button>
          <Doing id={o.id} />
        </div>
        <p className="kh"><kbd>j</kbd> <kbd>k</kbd> move through the list, <kbd>s</kbd> saves.</p>
      </div>
    </div>
  );
}

/**
 * "I'm doing this" (A3). Signed-in members mark an opportunity; after it, the
 * dashboard asks "did you compete?" so the claim is one more tap.
 */
function Doing({ id }) {
  const { user, loading } = useUser();
  const [on, setOn] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (user) api.get('/me/interests').then((d) => setOn(d.ids.includes(id))).catch(() => setOn(false));
  }, [user, id]);

  if (loading) return null;
  if (!user) return <Link className="sv" to="/signin">sign in to track this</Link>;
  const flip = async () => {
    setErr('');
    try {
      await (on ? api.del(`/me/interests/${id}`) : api.post(`/me/interests/${id}`));
      setOn(!on);
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <>
      <button className={`sv ${on ? 'on' : ''}`} aria-pressed={Boolean(on)} disabled={on === null} onClick={flip}>
        {on ? "you're doing this" : "I'm doing this"}
      </button>
      {err && <span className="dn" role="status" style={{ fontSize: 12 }}>{err}</span>}
    </>
  );
}
