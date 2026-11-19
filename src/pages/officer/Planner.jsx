/**
 * Meeting planner (G1): the plan editor. Pick a date, a title, a template and
 * its length, link an idea from the board, and edit the blocks. A warning
 * shows when the last three meetings were the same kind. The block list is
 * edited with the host screen's BlockEditor (src/pages/Session.jsx), and the
 * server validates it the same way. Wave 5 moved the plan list into HQ
 * Meetings (src/pages/hq/Meetings.jsx), which hosts this editor.
 */
import { useState } from 'react';
import { api } from '../../lib/api.js';
import { BlockEditor } from '../Session.jsx';
import { BLOCK_LABEL, DEFAULT_LENGTH, LENGTHS, TEMPLATES, templateBlocks } from '../../../shared/session-templates.js';
import { varietyWarning } from '../../../shared/planner.js';
import { Button, Field, Pill, useToast } from '../../ui/index.js';
import { Warning } from '@phosphor-icons/react';

const minutes = (blocks) => blocks.reduce((n, b) => n + (Number(b.minutes) || 0), 0);

/** Held rooms plus plans without a room: the meetings the variety warning looks back over. */
export const timelineOf = (d) => [
  ...d.held.map((h) => ({ date: h.date, template: h.template, planId: null })),
  ...d.plans.filter((p) => !p.roomCode).map((p) => ({ date: p.date, template: p.template, planId: p.id })),
];

/** A blank plan on `date` (the next club day, ideally). */
export const blankPlan = (date) => ({ date, title: '', template: 'build', minutes: DEFAULT_LENGTH, blocks: templateBlocks('build'), ideaId: '' });

/**
 * The editor for one plan. `plan` is a planner row or blankPlan(); `data` is
 * GET /admin/hub/planner (for the ideas and the variety warning). onSaved gets
 * the saved plan.
 */
export function PlanEditor({ plan, data, onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({ ...plan, minutes: plan.minutes ?? (minutes(plan.blocks) > 90 ? 120 : 60), ideaId: plan.ideaId ?? '' }));
  const [editBlocks, setEditBlocks] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { date: form.date, title: form.title, template: form.template, blocks: form.blocks, ideaId: form.ideaId || null };
    try {
      const saved = form.id ? await api.put(`/admin/hub/planner/${form.id}`, body) : await api.post('/admin/hub/planner', body);
      toast(form.id ? 'Plan saved.' : 'Planned. Members see it on Today.');
      onSaved(saved);
    } catch (err) {
      toast(err.message, { tone: 'bad' });
      setBusy(false);
    }
  };

  const warn = form.date ? varietyWarning(timelineOf(data), { id: form.id ?? null, date: form.date, template: form.template }) : null;
  const total = minutes(form.blocks);

  return (
    <form onSubmit={save} className="hq-plan" aria-label={form.id ? `Edit ${plan.title}` : 'Plan a meeting'}>
      <div className="hq-plan__row">
        <Field label="Date" type="date" required value={form.date} onChange={(e) => set({ date: e.target.value })} />
        <Field label="Title" required maxLength={80} value={form.title} placeholder="Build night: text adventures" onChange={(e) => set({ title: e.target.value })} />
        <Field
          label="Template"
          as="select"
          value={form.template}
          onChange={(e) => {
            set({ template: e.target.value, blocks: templateBlocks(e.target.value, form.minutes) });
            setEditBlocks(false);
          }}
        >
          {Object.entries(TEMPLATES).map(([id, t]) => (
            <option key={id} value={id}>{t.name}</option>
          ))}
        </Field>
      </div>

      <div className="ui-field">
        <span className="ui-field__l" id="plan-length">Length (picking one resets the blocks to that version)</span>
        <div className="hq-seg" role="group" aria-labelledby="plan-length">
          {LENGTHS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={form.minutes === m}
              onClick={() => {
                set({ minutes: m, blocks: templateBlocks(form.template, m) });
                setEditBlocks(false);
              }}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      {warn && (
        <p className="hq-warn" role="status">
          <Warning size={18} aria-hidden="true" />
          {warn}
        </p>
      )}

      <Field label="From the ideas board (optional)" as="select" value={form.ideaId ?? ''} onChange={(e) => set({ ideaId: e.target.value })}>
        <option value="">None</option>
        {data.ideas.map((i) => (
          <option key={i.id} value={i.id}>
            {i.kind}: {i.body.slice(0, 70)}
            {i.status === 'planned' ? ' (planned)' : ''}
          </option>
        ))}
      </Field>

      {editBlocks ? (
        <BlockEditor key={form.template} blocks={form.blocks} planId={form.id} send={(m) => set({ blocks: m.blocks })} onDone={() => setEditBlocks(false)} />
      ) : (
        <div className="hq-panel hq-plan__blocks">
          <div>
            <p className="hq-meet__t">
              {form.blocks.length} blocks, <span className="hq-num">{total}</span> of {form.minutes} min
            </p>
            <p className="hq-plan__chips">
              {form.blocks.map((b) => (
                <Pill key={b.id}>
                  {b.title || BLOCK_LABEL[b.type]} {b.minutes}
                </Pill>
              ))}
            </p>
          </div>
          <Button onClick={() => setEditBlocks(true)}>Edit blocks</Button>
        </div>
      )}

      {/* While the blocks are open, their own Save and Cancel are the only buttons. */}
      <div className="hq-row-actions" hidden={editBlocks}>
        <Button type="submit" variant="primary" disabled={busy || !form.title.trim() || !form.date}>
          {busy ? 'Saving' : 'Save plan'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
