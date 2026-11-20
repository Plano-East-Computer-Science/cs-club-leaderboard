/**
 * /future: everything worth applying to. Two lists under one set of filters:
 * live opportunities from the club's database (real dates, one-tap save) and
 * the curated library in shared/next/future/programs.js (usual months, add
 * to tracker).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookmarkSimple, ArrowSquareOut, Check, Plus, MagnifyingGlass } from '@phosphor-icons/react';
import { Button, EmptyState, ErrorState, PageHeader, SkeletonList, useToast } from '../../ui/index.js';
import { useData } from '../../lib/data.jsx';
import { formatDate } from '../../lib/format.js';
import { PROGRAMS, TYPE_LABEL, COST_LABEL, WHERE_LABEL, SELECT_LABEL, MONTHS, fitsGrade } from '../../../shared/next/future/programs.js';
import { countdown, daysBetween, monthsUntil, todayIn } from '../../../shared/next/future/tracker.js';
import { useGrade, useSaved, useTracker, fromProgram } from './store.js';
import './future.css';

const KINDS = [
  ['competition', 'Competitions'],
  ['summer', 'Summer programs'],
  ['research', 'Research'],
  ['internship', 'Internships'],
  ['scholarship', 'Scholarships'],
  ['hackathon', 'Hackathons'],
];

/** Live rows use the older type names; map them onto the student-facing kinds. */
function kindOf(o) {
  const text = `${o.title} ${o.description}`.toLowerCase();
  if (o.type === 'competition') return /hack/.test(text) ? 'hackathon' : 'competition';
  if (o.type === 'program') return /research|\blab\b/.test(text) ? 'research' : 'summer';
  return o.type;
}
const whereOf = (o) => ({ local: 'dfw', online: 'online', residential: 'travel' })[o.format] ?? 'online';
/** Ages 14 to 18 map onto grades 9 to 12; a grade fits when its ages overlap the range. */
const fitsAges = (o, grade) => !grade || ((o.age_min ?? 0) <= Number(grade) + 6 && (o.age_max ?? 99) >= Number(grade) + 5);
const progKind = (p) => (p.type === 'program' ? 'summer' : p.type);

export default function Opportunities() {
  const { opportunities, opps, errors, reload } = useData();
  const { grade } = useGrade();
  const [q, setQ] = useState('');
  const [g, setG] = useState(grade ? String(grade) : '');
  const [kind, setKind] = useState('');
  const [free, setFree] = useState(false);
  const [soon, setSoon] = useState(false);
  const [where, setWhere] = useState('');
  const { saved, toggle } = useSaved();
  const tracker = useTracker();
  const toast = useToast();
  const today = todayIn();
  const month0 = new Date().getMonth();

  const needle = q.trim().toLowerCase();
  const live = useMemo(
    () =>
      opportunities
        .map((o) => ({ ...o, kind: kindOf(o), where: whereOf(o), days: o.deadline ? daysBetween(today, String(o.deadline).slice(0, 10)) : null }))
        .filter((o) => o.days == null || o.days >= 0)
        .filter(
          (o) =>
            (!kind || o.kind === kind) &&
            fitsAges(o, g) &&
            (!free || o.cost !== 'paid') &&
            (!soon || (o.days != null && o.days <= 30)) &&
            (!where || o.where === where) &&
            (!needle || `${o.title} ${o.org} ${o.description}`.toLowerCase().includes(needle))
        )
        .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999)),
    [opportunities, kind, g, free, soon, where, needle, today]
  );

  const tracked = useMemo(() => new Set(tracker.items.map((i) => i.ref)), [tracker.items]);
  const curated = PROGRAMS.filter(
    (p) =>
      (!kind || progKind(p) === kind) &&
      fitsGrade(p, g) &&
      (!free || p.cost === 'free' || p.cost === 'stipend') &&
      (!soon || (p.month && monthsUntil(month0, p.month) <= 1)) &&
      (!where || p.where === where) &&
      (!needle || `${p.name} ${p.org} ${p.why} ${p.eligibility}`.toLowerCase().includes(needle))
  ).sort((a, b) => (a.month ? monthsUntil(month0, a.month) : 99) - (b.month ? monthsUntil(month0, b.month) : 99) || a.name.localeCompare(b.name));

  const filtered = Boolean(q || g || kind || free || soon || where);
  const reset = () => {
    setQ('');
    setG('');
    setKind('');
    setFree(false);
    setSoon(false);
    setWhere('');
  };

  const save = async (o) => {
    try {
      const on = await toggle(o.id);
      toast(on ? 'Saved. It shows in your tracker\'s deadlines.' : 'Removed from saved.');
    } catch (e) {
      toast(e.message, { tone: 'bad' });
    }
  };
  const track = (p) => {
    tracker.upsert(fromProgram(p));
    toast(`${p.name} is in your tracker.`);
  };

  const closing = live.filter((o) => o.days != null).slice(0, 3);

  return (
    <div className="ui-page fu">
      <PageHeader title="Opportunities" subtitle="Contests, programs, research and scholarships worth your time." />

      <div className="fu-filters" role="search" aria-label="Filter opportunities">
        <label className="fu-search">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search USACO, research, free..." />
        </label>
        <label className="fu-select">
          <span className="sr-only">Grade</span>
          <select className="ui-input" value={g} onChange={(e) => setG(e.target.value)}>
            <option value="">Any grade</option>
            {[9, 10, 11, 12].map((n) => (
              <option key={n} value={n}>Open to {n}th grade</option>
            ))}
          </select>
        </label>
        <div className="fu-chips" role="group" aria-label="Type">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" className="fu-chip" aria-pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="fu-chips" role="group" aria-label="More filters">
          <button type="button" className="fu-chip" aria-pressed={free} onClick={() => setFree(!free)}>Free</button>
          <button type="button" className="fu-chip" aria-pressed={soon} onClick={() => setSoon(!soon)}>Due soon</button>
          <button type="button" className="fu-chip" aria-pressed={where === 'dfw'} onClick={() => setWhere(where === 'dfw' ? '' : 'dfw')}>In DFW</button>
          <button type="button" className="fu-chip" aria-pressed={where === 'online'} onClick={() => setWhere(where === 'online' ? '' : 'online')}>Online</button>
          {filtered && <Button variant="ghost" onClick={reset}>Clear filters</Button>}
        </div>
      </div>

      {closing.length > 0 && (
        <section className="fu-closing" aria-label="Closing soonest">
          {closing.map((o) => {
            const body = (
              <>
                <span className="fu-closing__n">{o.days}</span>
                <span className="fu-closing__u">{o.days === 1 ? 'day left' : 'days left'}</span>
                <span className="fu-closing__t">{o.title}</span>
              </>
            );
            return o.url ? (
              <a key={o.id} className="fu-closing__i" href={o.url} target="_blank" rel="noreferrer noopener">{body}</a>
            ) : (
              <div key={o.id} className="fu-closing__i">{body}</div>
            );
          })}
        </section>
      )}

      <section className="fu-sec" aria-labelledby="fu-live">
        <div className="fu-sec__h">
          <h2 id="fu-live" className="ui-title">Open now</h2>
          <span className="fu-count">{live.length}</span>
        </div>
        {errors.opps && !opps ? (
          <ErrorState onRetry={reload}>{errors.opps}</ErrorState>
        ) : !opps ? (
          <SkeletonList rows={4} label="Loading opportunities" />
        ) : live.length ? (
          <ul className="fu-list">
            {live.map((o) => (
              <li key={o.id} className="fu-row">
                <div className="fu-row__main">
                  <h3 className="fu-row__t">
                    {o.url ? <a href={o.url} target="_blank" rel="noreferrer noopener">{o.title}</a> : o.title}
                  </h3>
                  <p className="fu-row__org">{o.org}</p>
                  <p className="fu-meta">
                    <span>{TYPE_LABEL[o.kind] ?? 'Resource'}</span>
                    <span>{o.where === 'dfw' ? o.location || 'Near Plano' : WHERE_LABEL[o.where]}</span>
                    <span>{o.cost === 'paid' ? 'Costs money' : o.cost === 'stipend' ? 'Pays you' : 'Free'}</span>
                  </p>
                </div>
                <div className="fu-row__side">
                  <span className={`fu-due ${o.days != null && o.days <= 14 ? 'fu-due--soon' : ''}`}>
                    {o.deadline ? (
                      <>
                        <b>{countdown(o.days)}</b>
                        <span>{formatDate(String(o.deadline).slice(0, 10))}</span>
                      </>
                    ) : (
                      <b>Rolling</b>
                    )}
                  </span>
                  <button
                    type="button"
                    className={`fu-save ${saved.has(o.id) ? 'is-on' : ''}`}
                    aria-pressed={saved.has(o.id)}
                    aria-label={saved.has(o.id) ? `Unsave ${o.title}` : `Save ${o.title}`}
                    onClick={() => save(o)}
                  >
                    <BookmarkSimple size={20} weight={saved.has(o.id) ? 'fill' : 'regular'} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState action={filtered ? <Button onClick={reset}>Clear filters</Button> : null}>Nothing open matches these filters.</EmptyState>
        )}
      </section>

      <section className="fu-sec" aria-labelledby="fu-lib">
        <div className="fu-sec__h">
          <h2 id="fu-lib" className="ui-title">The list that matters</h2>
          <span className="fu-count">{curated.length}</span>
        </div>
        <p className="fu-lede">
          Hand-picked for CS and engineering students and checked in November 2026. Dates move, so always confirm on the official site.
        </p>
        {curated.length ? (
          <ul className="fu-list">
            {curated.map((p) => {
              const inTracker = tracked.has(`prog:${p.id}`);
              const m = p.month ? monthsUntil(month0, p.month) : null;
              return (
                <li key={p.id} className="fu-row fu-row--lib">
                  <div className="fu-row__main">
                    <h3 className="fu-row__t">{p.name}</h3>
                    <p className="fu-row__org">{p.org}</p>
                    <p className="fu-why">{p.why}</p>
                    <p className="fu-meta">
                      <span>{TYPE_LABEL[p.type]}</span>
                      <span>{WHERE_LABEL[p.where]}</span>
                      {p.cost && <span>{COST_LABEL[p.cost]}</span>}
                      <span>{SELECT_LABEL[p.selectivity]}</span>
                    </p>
                    <p className="fu-elig">{p.eligibility}{p.costNote ? ` ${p.costNote}` : ''}</p>
                  </div>
                  <div className="fu-row__side">
                    <span className={`fu-due ${m === 0 ? 'fu-due--soon' : ''}`}>
                      {p.month ? (
                        <>
                          <b>{m === 0 ? 'This month' : m === 1 ? 'Next month' : `In ${m} months`}</b>
                          <span>Usually {MONTHS[p.month - 1]}</span>
                        </>
                      ) : (
                        <b>{p.monthNote ? 'Varies' : 'Check site'}</b>
                      )}
                    </span>
                    <div className="fu-acts">
                      {inTracker ? (
                        <Button variant="ghost" to="/future/tracker" icon={Check}>In tracker</Button>
                      ) : (
                        <Button icon={Plus} onClick={() => track(p)} aria-label={`Add ${p.name} to tracker`}>Track</Button>
                      )}
                      <Button variant="ghost" href={p.url} iconRight={ArrowSquareOut} aria-label={`${p.name} official site (opens in a new tab)`}>Site</Button>
                    </div>
                  </div>
                  {p.monthNote && <p className="fu-note">{p.monthNote}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState action={<Button onClick={reset}>Clear filters</Button>}>No program in the library matches these filters.</EmptyState>
        )}
      </section>

      <p className="fu-foot">
        Planning around these? <Link to="/future/college">See the college plan</Link> or <Link to="/future/tracker">open your tracker</Link>.
      </p>
    </div>
  );
}
