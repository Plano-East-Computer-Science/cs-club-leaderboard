/**
 * Meeting planner (G1). Plan upcoming sessions from a template with its blocks
 * filled in, see a warning when the last three meetings were the same kind,
 * and open the room for a plan on the day. The block list is edited with the
 * host screen's BlockEditor; the server validates it the same way.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote, Empty } from '../../components/bits.jsx';
import { BlockEditor } from '../Session.jsx';
import { DEFAULT_LENGTH, TEMPLATES, templateBlocks } from '../../../shared/session-templates.js';
import { LengthPicker } from './TemplatePicker.jsx';
import { kindName, varietyWarning, whenLabel } from '../../../shared/planner.js';

const minutes = (blocks) => blocks.reduce((n, b) => n + (Number(b.minutes) || 0), 0);

export default function Planner() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // null = closed, else the plan being edited
  const [editBlocks, setEditBlocks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/hub/planner').then(setD).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // Held rooms plus plans without a room: the meetings the variety warning looks back over.
  const timeline = d
    ? [
        ...d.held.map((h) => ({ date: h.date, template: h.template, planId: null })),
        ...d.plans.filter((p) => !p.roomCode).map((p) => ({ date: p.date, template: p.template, planId: p.id })),
      ]
    : [];

  const start = (plan) => {
    setEditBlocks(false);
    setError(null);
    setForm(plan ?? { date: d.today, title: '', template: 'build', minutes: DEFAULT_LENGTH, blocks: templateBlocks('build'), ideaId: '' });
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { date: form.date, title: form.title, template: form.template, blocks: form.blocks, ideaId: form.ideaId || null };
    try {
      if (form.id) await api.put(`/admin/hub/planner/${form.id}`, body);
      else await api.post('/admin/hub/planner', body);
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    try {
      await api.del(`/admin/hub/planner/${p.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openRoom = async (p) => {
    try {
      setOpened(await api.post('/admin/hub/rooms', { planId: p.id }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const warn = form && form.date ? varietyWarning(timeline, { id: form.id ?? null, date: form.date, template: form.template }) : null;

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Planner</p>
        <h2 className="display mt-1 text-2xl font-bold">Plan the next sessions</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Pick a date and a template, fill in the blocks, and open the room from here on the day. Members see the date, title and kind of the next
          one. Each block has on-screen text, which the room sees, and officer notes, which only officers see.
        </p>
      </div>

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!d && !error && <Spinner label="Loading planner" />}

      {opened && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            <span className="mono font-bold tracking-widest">{opened.code}</span> · {opened.title} is open with the planned blocks.
          </p>
          <Link to={`/host/${opened.code}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Run it
          </Link>
        </div>
      )}

      {d && !form && (
        <div className="mb-4">
          <button className="btn btn-primary" onClick={() => start()}>
            Plan a session
          </button>
        </div>
      )}

      {form && (
        <form onSubmit={save} className="card mb-4 grid gap-4 p-4" aria-label="Plan a session">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5">
              <span className="eyebrow">Date</span>
              <input className="field" type="date" required value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </label>
            <label className="grid min-w-56 flex-1 gap-1.5">
              <span className="eyebrow">Title</span>
              <input className="field" required maxLength={80} value={form.title} placeholder="e.g. Build night: text adventures" onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="eyebrow">Template</span>
              <select
                className="field"
                value={form.template}
                onChange={(e) => {
                  set({ template: e.target.value, blocks: templateBlocks(e.target.value, form.minutes) });
                  setEditBlocks(false);
                }}
              >
                {Object.entries(TEMPLATES).map(([id, t]) => (
                  <option key={id} value={id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">Length</span>
            {/* Picking a length replaces the blocks with that version of the template. */}
            <LengthPicker
              value={form.minutes ?? minutes(form.blocks)}
              onChange={(m) => {
                set({ minutes: m, blocks: templateBlocks(form.template, m) });
                setEditBlocks(false);
              }}
            />
          </div>

          {warn && (
            <p className="pl-warn" role="status">
              {warn}
            </p>
          )}

          <label className="grid gap-1.5">
            <span className="eyebrow">From the ideas board (optional)</span>
            <select className="field" value={form.ideaId ?? ''} onChange={(e) => set({ ideaId: e.target.value })}>
              <option value="">None</option>
              {d.ideas.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.kind}: {i.body.slice(0, 70)}
                  {i.status === 'planned' ? ' (planned)' : ''}
                </option>
              ))}
            </select>
          </label>

          {editBlocks ? (
            <BlockEditor
              key={form.template}
              blocks={form.blocks}
              send={(m) => set({ blocks: m.blocks })}
              onDone={() => setEditBlocks(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="mono text-xs">
                {form.blocks.length} blocks, {minutes(form.blocks)} min: {form.blocks.map((b) => b.title).join(', ')}
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => setEditBlocks(true)}>
                Edit blocks
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || !form.title.trim() || !form.date}>
              {busy ? 'Saving' : form.id ? 'Save changes' : 'Save plan'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {d && d.plans.length === 0 && <Empty title="Nothing planned">Plan a session above. It shows on Today for members.</Empty>}

      {d && d.plans.length > 0 && (
        <ul className="card divide-y">
          {d.plans.map((p) => {
            const w = p.roomCode ? null : varietyWarning(timeline, p);
            return (
              <li key={p.id} className="p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="mono text-sm font-bold">{whenLabel(p.date)}</span>
                  <span className="min-w-40 flex-1 text-sm font-medium">
                    {p.title} <span className="d">{kindName(p.template)}, {minutes(p.blocks)} min</span>
                  </span>
                  {p.roomCode ? (
                    <span className="mono text-xs" style={{ color: '#2f8f5b' }}>
                      held <Link to={`/host/${p.roomCode}`}>{p.roomCode}</Link>
                    </span>
                  ) : (
                    <>
                      <button className="btn btn-primary" onClick={() => openRoom(p)}>
                        Open room
                      </button>
                      <button className="btn btn-ghost" onClick={() => start(p)}>
                        Edit
                      </button>
                    </>
                  )}
                  <button className="btn btn-ghost" onClick={() => remove(p)} aria-label={`Delete ${p.title}`}>
                    Delete
                  </button>
                </div>
                {w && <p className="pl-warn mt-2">{w}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
