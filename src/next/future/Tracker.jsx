/**
 * /future/tracker: the student's own board of what they are going for.
 * Works signed out (this device) and syncs when signed in; see store.js.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash, ArrowSquareOut, MagnifyingGlass } from '@phosphor-icons/react';
import { Button, Dialog, EmptyState, Field, PageHeader, Tabs, useToast } from '../../ui/index.js';
import { useData } from '../../lib/data.jsx';
import { formatDate } from '../../lib/format.js';
import { PROGRAMS, TYPE_LABEL } from '../../../shared/next/future/programs.js';
import { STATUSES, STATUS_LABEL, LIMITS, cleanItem, countdown, daysBetween, newId, todayIn, upcoming } from '../../../shared/next/future/tracker.js';
import { useSaved, useTracker, fromOpp, fromProgram } from './store.js';
import './future.css';

export default function Tracker() {
  const { items, upsert, remove, signedIn, syncError } = useTracker();
  const { opportunities } = useData();
  const { saved } = useSaved();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const today = todayIn();

  const refs = useMemo(() => new Set(items.map((i) => i.ref).filter(Boolean)), [items]);
  const savedOpps = opportunities.filter((o) => saved.has(o.id) && !refs.has(`opp:${o.id}`));
  const next = upcoming(
    [
      ...items.map((i) => ({ key: i.id, title: i.title, deadline: i.deadline, status: i.status, item: i })),
      ...savedOpps.filter((o) => o.deadline).map((o) => ({ key: `o${o.id}`, title: o.title, deadline: String(o.deadline).slice(0, 10), opp: o })),
    ],
    today,
    5
  );

  const add = (item, msg) => {
    upsert(item);
    toast(msg ?? `${item.title} added.`);
  };
  const setStatus = (it, status) => upsert({ ...it, status });

  return (
    <div className="ui-page fu">
      <PageHeader
        title="My tracker"
        subtitle="Everything you are going for, with deadlines and what is left to do."
        actions={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add to tracker</Button>}
      />
      {!signedIn && (
        <p className="fu-note fu-note--bar">
          Saved on this device. <Link to="/signin">Sign in</Link> to keep it on every device.
        </p>
      )}
      {syncError && <p className="fu-note fu-note--bad" role="status">Not synced: {syncError}</p>}

      {next.length > 0 && (
        <section className="fu-next" aria-labelledby="fu-next">
          <h2 id="fu-next" className="ui-title">Next deadlines</h2>
          <ol className="fu-next__list">
            {next.map((e) => (
              <li key={e.key} className={e.days <= 7 ? 'is-soon' : ''}>
                <span className="fu-next__d">
                  <b>{e.days}</b> {e.days === 1 ? 'day' : 'days'}
                </span>
                <span className="fu-next__t">
                  {e.item ? (
                    <button type="button" className="fu-link" onClick={() => setEditing(e.item)}>{e.title}</button>
                  ) : (
                    <>
                      {e.title} <span className="fu-next__src">saved</span>
                    </>
                  )}
                </span>
                <span className="fu-next__date">{formatDate(e.deadline)}</span>
                {e.opp && (
                  <Button variant="ghost" onClick={() => add(fromOpp(e.opp))} aria-label={`Track ${e.title}`}>Track</Button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {items.length ? (
        <div className="fu-board">
          {STATUSES.map((s) => {
            const col = items.filter((i) => i.status === s).sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'));
            return (
              <section key={s} className="fu-colm" aria-labelledby={`fu-c-${s}`}>
                <h2 id={`fu-c-${s}`} className="fu-colm__h">
                  {STATUS_LABEL[s]} <span className="fu-count">{col.length}</span>
                </h2>
                {col.map((it) => (
                  <Item key={it.id} it={it} today={today} onOpen={() => setEditing(it)} onStatus={(v) => setStatus(it, v)} />
                ))}
                {!col.length && <p className="fu-colm__empty">Nothing here yet.</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState action={<Button variant="secondary" to="/future">Browse opportunities</Button>}>
          Nothing tracked yet. Add what you are aiming for and its deadline.
        </EmptyState>
      )}

      {editing && (
        <Editor
          key={editing.id}
          item={items.find((i) => i.id === editing.id) ?? editing}
          onClose={() => setEditing(null)}
          onSave={(it) => {
            upsert(it);
            setEditing(null);
            toast('Saved.');
          }}
          onDelete={() => {
            remove(editing.id);
            setEditing(null);
            toast('Removed from your tracker.');
          }}
        />
      )}
      <AddDialog open={adding} onOpenChange={setAdding} refs={refs} savedOpps={savedOpps} onAdd={(it) => add(it)} />
    </div>
  );
}

function Item({ it, today, onOpen, onStatus }) {
  const days = it.deadline ? daysBetween(today, it.deadline) : null;
  const done = it.checklist.filter((c) => c.done).length;
  return (
    <article className="fu-item">
      <button type="button" className="fu-item__t" onClick={onOpen}>{it.title}</button>
      <p className="fu-meta">
        {it.deadline ? (
          <span className={days != null && days >= 0 && days <= 7 && it.status !== 'result' ? 'fu-hot' : ''}>
            {it.status === 'result' ? formatDate(it.deadline) : `${countdown(days)}, ${formatDate(it.deadline)}`}
          </span>
        ) : (
          <span>No deadline</span>
        )}
        {it.checklist.length > 0 && <span>{done} of {it.checklist.length} done</span>}
        {it.outcome && <span>{it.outcome}</span>}
      </p>
      {it.checklist.length > 0 && (
        <div className="fu-bar" aria-hidden="true">
          <i style={{ width: `${(done / it.checklist.length) * 100}%` }} />
        </div>
      )}
      <label className="fu-item__s">
        <span className="sr-only">Status of {it.title}</span>
        <select className="ui-input" value={it.status} onChange={(e) => onStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </label>
    </article>
  );
}

function Editor({ item, onClose, onSave, onDelete }) {
  const [d, setD] = useState(item);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const save = (e) => {
    e.preventDefault();
    const r = cleanItem(d);
    if (r.error) return setError(r.error);
    onSave(r.item);
  };
  const addStep = () => {
    const text = step.trim();
    if (!text) return;
    if (d.checklist.length >= LIMITS.checklist) return setError(`A checklist can have up to ${LIMITS.checklist} steps.`);
    setD({ ...d, checklist: [...d.checklist, { text: text.slice(0, LIMITS.checkText), done: false }] });
    setStep('');
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Edit tracker item" className="fu-dialog">
      <form className="fu-form" onSubmit={save}>
        <Field label="Name" value={d.title} onChange={set('title')} maxLength={LIMITS.title} required />
        <div className="fu-form__row">
          <Field label="Status" as="select" value={d.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Field>
          <Field label="Deadline" type="date" value={d.deadline} onChange={set('deadline')} />
        </div>
        {d.status === 'result' && (
          <Field label="Result" value={d.outcome} onChange={set('outcome')} maxLength={LIMITS.outcome} placeholder="Accepted, waitlisted, Silver..." />
        )}
        <Field label="Link" type="url" value={d.url} onChange={set('url')} maxLength={LIMITS.url} placeholder="https://" />
        <fieldset className="fu-check">
          <legend className="ui-field__l">Checklist</legend>
          {d.checklist.map((c, i) => (
            <div key={i} className="fu-check__i">
              <label>
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => setD({ ...d, checklist: d.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                />
                <span>{c.text}</span>
              </label>
              <Button
                variant="ghost"
                icon={Trash}
                aria-label={`Remove ${c.text}`}
                onClick={() => setD({ ...d, checklist: d.checklist.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <div className="fu-check__add">
            <label className="sr-only" htmlFor="fu-step">New checklist step</label>
            <input
              id="fu-step"
              className="ui-input"
              value={step}
              maxLength={LIMITS.checkText}
              placeholder="Add a step, like Essay draft"
              onChange={(e) => setStep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addStep();
                }
              }}
            />
            <Button onClick={addStep}>Add step</Button>
          </div>
        </fieldset>
        <Field label="Notes" as="textarea" value={d.notes} onChange={set('notes')} maxLength={LIMITS.notes} />
        {error && <p className="ui-field__e" role="alert">{error}</p>}
        <div className="fu-form__acts">
          <Button variant="danger" icon={Trash} onClick={onDelete}>Remove</Button>
          {d.url && <Button variant="ghost" href={d.url} iconRight={ArrowSquareOut}>Open link</Button>}
          <Button variant="primary" type="submit">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}

function AddDialog({ open, onOpenChange, refs, savedOpps, onAdd }) {
  const [q, setQ] = useState('');
  const [own, setOwn] = useState({ title: '', deadline: '', url: '' });
  const [error, setError] = useState('');
  const needle = q.trim().toLowerCase();
  const lib = PROGRAMS.filter((p) => !refs.has(`prog:${p.id}`) && (!needle || `${p.name} ${p.org}`.toLowerCase().includes(needle))).slice(0, 30);
  const done = (it) => {
    onAdd(it);
    onOpenChange(false);
  };
  const addOwn = (e) => {
    e.preventDefault();
    const r = cleanItem({ id: newId(), status: 'interested', checklist: [], ...own });
    if (r.error) return setError(r.error);
    setOwn({ title: '', deadline: '', url: '' });
    setError('');
    done(r.item);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add to tracker" className="fu-dialog">
      <Tabs
        label="Where to add from"
        defaultValue={savedOpps.length ? 'saved' : 'library'}
        items={[
          {
            value: 'saved',
            label: `Saved (${savedOpps.length})`,
            content: savedOpps.length ? (
              <ul className="fu-pick">
                {savedOpps.map((o) => (
                  <li key={o.id}>
                    <span>
                      <b>{o.title}</b>
                      <small>{o.deadline ? formatDate(String(o.deadline).slice(0, 10)) : 'Rolling'}</small>
                    </span>
                    <Button icon={Plus} onClick={() => done(fromOpp(o))} aria-label={`Add ${o.title}`}>Add</Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fu-note">Save opportunities on the Opportunities page and they show up here.</p>
            ),
          },
          {
            value: 'library',
            label: 'Library',
            content: (
              <>
                <label className="fu-search">
                  <MagnifyingGlass size={18} aria-hidden="true" />
                  <span className="sr-only">Search the library</span>
                  <input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search USACO, RSI, Coca-Cola..." />
                </label>
                <ul className="fu-pick">
                  {lib.map((p) => (
                    <li key={p.id}>
                      <span>
                        <b>{p.name}</b>
                        <small>{TYPE_LABEL[p.type]}</small>
                      </span>
                      <Button icon={Plus} onClick={() => done(fromProgram(p))} aria-label={`Add ${p.name}`}>Add</Button>
                    </li>
                  ))}
                  {!lib.length && <li className="fu-note">Nothing matches.</li>}
                </ul>
              </>
            ),
          },
          {
            value: 'own',
            label: 'Your own',
            content: (
              <form className="fu-form" onSubmit={addOwn}>
                <Field label="Name" value={own.title} maxLength={LIMITS.title} onChange={(e) => setOwn({ ...own, title: e.target.value })} required />
                <Field label="Deadline" type="date" value={own.deadline} onChange={(e) => setOwn({ ...own, deadline: e.target.value })} />
                <Field label="Link" type="url" value={own.url} maxLength={LIMITS.url} onChange={(e) => setOwn({ ...own, url: e.target.value })} placeholder="https://" />
                {error && <p className="ui-field__e" role="alert">{error}</p>}
                <div className="fu-form__acts">
                  <Button variant="primary" type="submit">Add to tracker</Button>
                </div>
              </form>
            ),
          },
        ]}
      />
    </Dialog>
  );
}
