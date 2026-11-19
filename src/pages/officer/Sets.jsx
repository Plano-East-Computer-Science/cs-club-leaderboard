/**
 * Officer Library screen for problem sets (V3-B): duel packs and contest sets.
 * A duel pack is a practice problem, three problems for each division and an
 * optional final; a contest set is an ordered list. The server checks that every
 * problem is live and that a live pack is complete (worker/hub/sets.js).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner } from '../../components/bits.jsx';
import { Body } from '../Course.jsx';

const BAD = '#c42e2e';
const DUEL_SLOTS = [
  ['practice', 'Practice (warm-up)', 1],
  ['new', 'New', 3],
  ['comfortable', 'Comfortable', 3],
  ['contest', 'Contest', 3],
  ['final', 'Final for pairs (optional)', 1],
];
const MAX_CONTEST = 12;

/** Body slots as lists, so one editor handles single and triple slots. */
const toSlots = (kind, body = {}) =>
  kind === 'contest'
    ? { problems: [...(body.problems ?? [])] }
    : Object.fromEntries(DUEL_SLOTS.map(([k, , n]) => [k, n === 1 ? (body[k] ? [body[k]] : []) : [...(body[k] ?? [])]]));
const toBody = (kind, slots) =>
  kind === 'contest'
    ? { problems: slots.problems }
    : Object.fromEntries(DUEL_SLOTS.map(([k, , n]) => [k, n === 1 ? (slots[k][0] ?? null) : slots[k]]));

export default function Sets() {
  const [sets, setSets] = useState(null);
  const [bank, setBank] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // null = list view

  const load = useCallback(() => {
    api.get('/admin/hub/sets').then((d) => setSets(d.sets)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    api.get('/admin/hub/sets/bank').then((d) => setBank(d.problems)).catch((e) => setError(e.message));
  }, [load]);

  const titles = useMemo(() => Object.fromEntries((bank ?? []).map((p) => [p.slug, p.title])), [bank]);

  const setStatus = async (s, status) => {
    setError(null);
    await api.post(`/admin/hub/sets/${s.id}/status`, { status }).then(load).catch((e) => setError(e.message));
  };
  const edit = async (id) => {
    setError(null);
    try {
      const s = await api.get(`/admin/hub/sets/${id}`);
      setForm({ id: s.id, slug: s.slug, kind: s.kind, title: s.title, status: s.status, slots: toSlots(s.kind, s.body) });
    } catch (e) {
      setError(e.message);
    }
  };
  const fresh = (kind) => setForm({ slug: '', kind, title: '', status: 'draft', slots: toSlots(kind) });

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Library</p>
        <h2 className="display mt-1 text-2xl font-bold">Duel packs and contest sets</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          A live duel pack opens a duel in one tap from the room. Every problem must be live in the problem bank.
        </p>
      </div>
      {error && <p className="mono mb-3 text-xs" style={{ color: BAD }} role="alert">{error}</p>}

      {form ? (
        <Editor
          start={form}
          bank={bank}
          titles={titles}
          onDone={() => {
            setForm(null);
            load();
          }}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className="btn pri" onClick={() => fresh('duel')}>New duel pack</button>
            <button type="button" className="btn" onClick={() => fresh('contest')}>New contest set</button>
          </div>
          {!sets ? (
            <Spinner />
          ) : !sets.length ? (
            <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No sets yet.</p>
          ) : (
            <ul className="grid gap-2">
              {sets.map((s) => (
                <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0">
                    <b>{s.title}</b>{' '}
                    <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
                      {s.slug} / {s.kind === 'duel' ? 'duel pack' : 'contest set'} / {s.status} / {count(s)} problems
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className="btn" onClick={() => edit(s.id)}>Edit</button>
                    {s.status === 'draft' ? (
                      <button type="button" className="btn" onClick={() => setStatus(s, 'live')}>Set live</button>
                    ) : (
                      <button type="button" className="btn" onClick={() => setStatus(s, 'draft')}>Back to draft</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

const count = (s) =>
  s.kind === 'contest'
    ? (s.body.problems ?? []).length
    : DUEL_SLOTS.reduce((n, [k, , one]) => n + (one === 1 ? (s.body[k] ? 1 : 0) : (s.body[k] ?? []).length), 0);

function Editor({ start, bank, titles, onDone }) {
  const [f, setF] = useState(start);
  const [target, setTarget] = useState(start.kind === 'contest' ? 'problems' : 'new');
  const [fText, setFText] = useState('');
  const [fDiff, setFDiff] = useState('');
  const [peek, setPeek] = useState(null); // slug being previewed
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const isNew = !f.id;
  const slots = f.kind === 'contest' ? [['problems', 'Problems, in play order', MAX_CONTEST]] : DUEL_SLOTS;
  const used = new Set(Object.values(f.slots).flat());
  const cap = Object.fromEntries(slots.map(([k, , n]) => [k, n]));

  const setSlot = (k, list) => setF((x) => ({ ...x, slots: { ...x.slots, [k]: list } }));
  const add = (slug) => {
    const cur = f.slots[target];
    if (used.has(slug) || cur.length >= cap[target]) return;
    setSlot(target, [...cur, slug]);
  };
  const move = (k, i, d) => {
    const list = [...f.slots[k]];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    setSlot(k, list);
  };

  const shown = useMemo(() => {
    const t = fText.trim().toLowerCase();
    return (bank ?? []).filter((p) => (!fDiff || p.difficulty === Number(fDiff)) && (!t || `${p.title} ${p.slug} ${p.tags.join(' ')}`.toLowerCase().includes(t)));
  }, [bank, fText, fDiff]);

  const save = async () => {
    setErr(null);
    setBusy(true);
    try {
      const body = { title: f.title, body: toBody(f.kind, f.slots) };
      if (isNew) await api.post('/admin/hub/sets', { ...body, slug: f.slug, kind: f.kind, status: 'draft' });
      else await api.put(`/admin/hub/sets/${f.id}`, body);
      onDone();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="card grid gap-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="eyebrow">Title</span>
          <input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">Slug {isNew ? '(cannot change later)' : '(fixed)'}</span>
          <input className="field mono" value={f.slug} disabled={!isNew} onChange={(e) => setF({ ...f, slug: e.target.value })} />
        </label>
      </div>
      <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
        {f.kind === 'duel' ? 'Duel pack' : 'Contest set'}, {f.status}.
        {f.status === 'live' ? ' A live set must stay complete.' : ' A draft can be saved half done.'}
      </p>

      <div className="sets-slots">
        {slots.map(([k, label, n]) => (
          <fieldset key={k} className="sets-slot">
            <legend className="eyebrow">{label} {f.slots[k].length}/{n}</legend>
            {f.slots[k].length > 0 && (
              <ol>
                {f.slots[k].map((slug, i) => (
                  <li key={slug}>
                    <span>
                      {n > 1 && <span className="mono">{i + 1}. </span>}
                      {titles[slug] ?? <span style={{ color: BAD }}>{slug} (not live)</span>}
                    </span>
                    <span className="flex gap-1">
                      {n > 1 && <button type="button" className="btn" disabled={i === 0} onClick={() => move(k, i, -1)} aria-label={`Move ${titles[slug] ?? slug} up`}>Up</button>}
                      {n > 1 && <button type="button" className="btn" disabled={i === f.slots[k].length - 1} onClick={() => move(k, i, 1)} aria-label={`Move ${titles[slug] ?? slug} down`}>Down</button>}
                      <button type="button" className="btn" onClick={() => setSlot(k, f.slots[k].filter((x) => x !== slug))} aria-label={`Remove ${titles[slug] ?? slug}`}>Remove</button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </fieldset>
        ))}
      </div>

      <div className="grid gap-2">
        <p className="eyebrow">Add problems</p>
        {slots.length > 1 && (
          <div className="chips" role="group" aria-label="Add to">
            {slots.map(([k, label, n]) => (
              <button key={k} type="button" aria-pressed={target === k} onClick={() => setTarget(k)}>
                {label.replace(/ \(.*\)/, '')} {f.slots[k].length}/{n}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">
            <span className="eyebrow">Search</span>
            <input className="field" value={fText} onChange={(e) => setFText(e.target.value)} placeholder="title, slug or tag" />
          </label>
          <label className="grid gap-1">
            <span className="eyebrow">Level</span>
            <select className="field" value={fDiff} onChange={(e) => setFDiff(e.target.value)}>
              <option value="">All</option>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
        <div className="sets-pick">
          {!bank ? (
            <Spinner />
          ) : (
            <ul className="duel-pick" aria-label="Live problems">
              {shown.map((p) => (
                <li key={p.slug}>
                  <button type="button" aria-pressed={peek === p.slug} onClick={() => setPeek(p.slug)}>
                    <span>{p.title}</span>
                    <span className="m">lvl {p.difficulty}</span>
                    <span className="m">{p.solvers} solved</span>
                  </button>
                </li>
              ))}
              {!shown.length && <li className="mono p-3 text-xs">No live problems match.</li>}
            </ul>
          )}
          <Preview slug={peek} bank={bank} used={used} full={f.slots[target].length >= cap[target]} onAdd={add} />
        </div>
      </div>

      {err && <p className="mono text-xs" style={{ color: BAD }} role="alert">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn pri" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

/** Statement, level and solve count of the problem under the cursor, with an add button. */
function Preview({ slug, bank, used, full, onAdd }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setP(null);
    setErr(null);
    if (slug) api.get(`/problems/${encodeURIComponent(slug)}`).then(setP).catch((e) => setErr(e.message));
  }, [slug]);
  if (!slug) return <div className="sets-preview mono text-xs">Pick a problem to read it here.</div>;
  const meta = bank?.find((x) => x.slug === slug);
  return (
    <div className="sets-preview grid gap-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <b>{meta?.title ?? slug}</b>{' '}
          <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>level {meta?.difficulty}, {meta?.solvers ?? 0} members solved</span>
        </span>
        <button type="button" className="btn pri" disabled={used.has(slug) || full} onClick={() => onAdd(slug)}>
          {used.has(slug) ? 'In this set' : full ? 'That slot is full' : 'Add'}
        </button>
      </div>
      {err && <p className="mono text-xs" style={{ color: BAD }}>{err}</p>}
      {p ? <Body text={p.body} /> : !err && <Spinner />}
    </div>
  );
}
