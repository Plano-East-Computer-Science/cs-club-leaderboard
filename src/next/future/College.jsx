/**
 * /future/college: the grade-by-grade plan, the applying guide, and a
 * browser over 40 CS and engineering programs. Asks the student's grade
 * once (stored as a class year in next:future) and leads with this month.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Check, MagnifyingGlass } from '@phosphor-icons/react';
import { Button, EmptyState, PageHeader, Pill, Tabs, useToast } from '../../ui/index.js';
import { ROADMAP, MONTHLY, GUIDE, CATALOG_URL } from '../../../shared/next/future/roadmap.js';
import { COLLEGES, ADMIT_LABEL, TEST_LABEL } from '../../../shared/next/future/colleges.js';
import { PROGRAMS, MONTHS, fitsGrade } from '../../../shared/next/future/programs.js';
import { nextDateOf, todayIn } from '../../../shared/next/future/tracker.js';
import { useGrade, useTracker, fromCollege } from './store.js';
import './future.css';

const ord = (g) => `${g}th`;

export default function College() {
  const { grade, setGrade } = useGrade();
  return (
    <div className="ui-page fu">
      <PageHeader title="College plan" subtitle="What to take, enter, build and send, year by year." />
      {grade ? <ThisMonth grade={grade} onChange={() => setGrade(null)} /> : <AskGrade onPick={setGrade} />}
      <Tabs
        label="College plan sections"
        defaultValue="roadmap"
        listClassName="fu-tabs"
        items={[
          { value: 'roadmap', label: 'Roadmap', content: <Roadmap grade={grade} /> },
          { value: 'apply', label: 'Applying', content: <Guide /> },
          { value: 'colleges', label: 'Colleges', content: <Colleges /> },
        ]}
      />
    </div>
  );
}

function AskGrade({ onPick }) {
  return (
    <section className="fu-now fu-now--ask" aria-labelledby="fu-ask">
      <h2 id="fu-ask" className="fu-now__h">What grade are you in?</h2>
      <p className="fu-now__p">The plan highlights your year and what to do this month. Saved on this device.</p>
      <div className="fu-grades">
        {[9, 10, 11, 12].map((g) => (
          <Button key={g} variant={g === 9 ? 'primary' : 'secondary'} size="lg" onClick={() => onPick(g)}>
            {ord(g)} grade
          </Button>
        ))}
      </div>
    </section>
  );
}

function ThisMonth({ grade, onChange }) {
  const now = new Date();
  const m = now.getMonth() + 1;
  const tasks = MONTHLY[grade][m];
  const due = PROGRAMS.filter((p) => p.month === m && fitsGrade(p, grade));
  return (
    <section className="fu-now" aria-labelledby="fu-now">
      <div className="fu-now__top">
        <h2 id="fu-now" className="fu-now__month">{MONTHS[m - 1]}</h2>
        <p className="fu-now__who">
          {ord(grade)} grade{m === 6 || m === 7 ? ', summer' : ''}{' '}
          <button type="button" className="fu-link" onClick={onChange}>Change grade</button>
        </p>
      </div>
      <ul className="fu-now__list">
        {tasks.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {due.length > 0 && (
        <p className="fu-now__due">
          Usually due this month:{' '}
          {due.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <a href={p.url} target="_blank" rel="noreferrer noopener">{p.name}</a>
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}

function Roadmap({ grade }) {
  return (
    <div className="fu-road">
      <p className="fu-lede">
        Course names are from the Plano ISD 2026-2027 course catalog. What is offered can differ by campus, so check the{' '}
        <a href={CATALOG_URL} target="_blank" rel="noreferrer noopener">current catalog</a> and your counselor before you pick.
      </p>
      {ROADMAP.map((r) => (
        <details key={r.grade} className={`fu-year ${r.grade === grade ? 'is-now' : ''}`} open={!grade || r.grade === grade}>
          <summary>
            <span className="fu-year__g">{ord(r.grade)} grade</span>
            {r.grade === grade && <Pill tone="gold">You are here</Pill>}
            <span className="fu-year__f">{r.focus}</span>
          </summary>
          <div className="fu-year__body">
            <Block title="Courses" items={r.courses} />
            <Block title="Contests" items={r.compete} />
            <Block title="Build" items={r.build} />
            <Block title={`Summer after ${ord(r.grade)} grade`} items={r.summer} />
          </div>
        </details>
      ))}
      <p className="fu-foot">
        Find the contests and programs named here in <Link to="/future">Opportunities</Link>.
      </p>
    </div>
  );
}

const Block = ({ title, items }) => (
  <div className="fu-block">
    <h3 className="fu-block__h">{title}</h3>
    <ul>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  </div>
);

function Guide() {
  return (
    <div className="fu-guide">
      {GUIDE.map((s) => (
        <section key={s.id} className="fu-guide__s" aria-labelledby={`fu-g-${s.id}`}>
          <h3 id={`fu-g-${s.id}`} className="ui-title">{s.title}</h3>
          <ul>
            {s.points.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Colleges() {
  const [q, setQ] = useState('');
  const [tx, setTx] = useState(false);
  const [direct, setDirect] = useState(false);
  const [tests, setTests] = useState('');
  const tracker = useTracker();
  const toast = useToast();
  const today = todayIn();
  const titles = useMemo(() => new Set(tracker.items.map((i) => i.title)), [tracker.items]);

  const needle = q.trim().toLowerCase();
  const list = COLLEGES.filter(
    (c) =>
      (!tx || c.texas) &&
      (!direct || c.admit === 'direct') &&
      (!tests || c.tests === tests) &&
      (!needle || `${c.name} ${c.state} ${c.cs}`.toLowerCase().includes(needle))
  );

  const track = (c) => {
    const next = c.deadlines.map(([, d]) => nextDateOf(d, today)).filter(Boolean).sort()[0] ?? '';
    tracker.upsert(fromCollege(c, next));
    toast(`${c.name} is in your tracker with its next deadline.`);
  };

  return (
    <div className="fu-colleges">
      <p className="fu-lede">
        Forty strong CS and engineering programs, checked in November 2026 for students applying this fall. Policies change every year; confirm on each school&apos;s site.
      </p>
      <div className="fu-filters" role="search" aria-label="Filter colleges">
        <label className="fu-search">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="sr-only">Search colleges</span>
          <input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or state" />
        </label>
        <label className="fu-select">
          <span className="sr-only">Test policy</span>
          <select className="ui-input" value={tests} onChange={(e) => setTests(e.target.value)}>
            <option value="">Any test policy</option>
            {Object.entries(TEST_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <div className="fu-chips" role="group" aria-label="More filters">
          <button type="button" className="fu-chip" aria-pressed={tx} onClick={() => setTx(!tx)}>In Texas</button>
          <button type="button" className="fu-chip" aria-pressed={direct} onClick={() => setDirect(!direct)}>Direct admit to CS</button>
        </div>
      </div>
      {list.length ? (
        <ul className="fu-list">
          {list.map((c) => (
            <li key={c.id} className="fu-row fu-row--col">
              <details className="fu-col">
                <summary>
                  <span className="fu-col__n">{c.name}</span>
                  <span className="fu-meta">
                    <span>{c.state}</span>
                    <span>{TEST_LABEL[c.tests]}</span>
                    <span>{c.admit ? ADMIT_LABEL[c.admit] : 'CS admission: check the school'}</span>
                  </span>
                </summary>
                <div className="fu-col__body">
                  <p>{c.cs}</p>
                  {c.admitNote && <p><b>Getting into CS.</b> {c.admitNote}</p>}
                  {c.testsNote && <p><b>Tests.</b> {c.testsNote}</p>}
                  <p>
                    <b>Deadlines.</b> {c.deadlines.map(([plan, d]) => `${plan} ${d}`).join(', ')}
                  </p>
                  {c.rate && (
                    <p>
                      <b>{c.rate.value}</b> {c.rate.what} (<a href={c.rate.source} target="_blank" rel="noreferrer noopener">source</a>).
                    </p>
                  )}
                  <p className="fu-src">
                    Checked November 2026. Sources:{' '}
                    {c.sources.map((s, i) => (
                      <span key={s}>
                        {i > 0 && ', '}
                        <a href={s} target="_blank" rel="noreferrer noopener">{new URL(s).hostname.replace(/^www\./, '')}</a>
                      </span>
                    ))}
                  </p>
                  {titles.has(`Apply: ${c.name}`) ? (
                    <Button variant="ghost" to="/future/tracker" icon={Check}>In tracker</Button>
                  ) : (
                    <Button icon={Plus} onClick={() => track(c)}>Track this application</Button>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState action={<Button onClick={() => { setQ(''); setTx(false); setDirect(false); setTests(''); }}>Clear filters</Button>}>
          No college matches these filters.
        </EmptyState>
      )}
      <p className="fu-src">
        Overall admit rates are left out on purpose: they say little about CS. Where a school publishes a number for CS or engineering, it is shown with its source.
      </p>
    </div>
  );
}
