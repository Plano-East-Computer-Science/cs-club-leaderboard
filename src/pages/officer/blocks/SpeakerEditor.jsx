/**
 * Speaker block payload (Wave 6): who is speaking, the officer-only Zoom link,
 * seed questions, when the question window opens on Today, and what the
 * projector shows. With a saved plan, also the questions members have asked
 * early, with names, so officers can hide one before the meeting.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash, Eye, EyeSlash, LockSimple } from '@phosphor-icons/react';
import { api } from '../../../lib/api.js';
import { Button, Field, Pill } from '../../../ui/index.js';
import { OPEN_EARLY_HOURS } from '../../../../shared/session-templates.js';
import './blocks.css';

const EMPTY = { name: '', title: '', intro: '', zoomUrl: '', seedQuestions: [], openEarlyHours: OPEN_EARLY_HOURS, projector: 'questions' };

function EarlyQuestions({ planId }) {
  const [qs, setQs] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api.get(`/admin/hub/planner/${planId}/questions`).then((d) => setQs(d.questions)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps
  const hide = async (q, hidden) => {
    try {
      await api.post(`/admin/hub/early-questions/${q.id}/hide`, { hidden });
      load();
    } catch (e) {
      setErr(e.message);
    }
  };
  if (err) return <p className="ui-field__e" role="alert">{err}</p>;
  if (!qs) return null;
  return (
    <div className="bk-early">
      <p className="ui-label">Asked early on Today ({qs.filter((q) => !q.hidden).length})</p>
      {qs.length === 0 ? (
        <p className="ui-small">None yet. Members can ask once the window opens.</p>
      ) : (
        <ul className="bk-early__list">
          {qs.map((q) => (
            <li key={q.id} className={q.hidden ? 'is-hidden' : ''}>
              <span className="bk-early__v">{q.votes}</span>
              <span className="bk-early__t">
                {q.text}
                <span className="ui-small"> {q.name}</span>
                {q.reports > 0 && <Pill tone="need">{q.reports} report{q.reports === 1 ? '' : 's'}</Pill>}
              </span>
              <Button variant="ghost" icon={q.hidden ? Eye : EyeSlash} onClick={() => hide(q, !q.hidden)}>{q.hidden ? 'Put back' : 'Hide'}</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SpeakerEditor({ value, onChange, planId }) {
  const v = { ...EMPTY, ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const seeds = v.seedQuestions;
  return (
    <fieldset className="bk">
      <legend className="ui-label">Speaker</legend>
      <div className="bk-row">
        <Field label="Name" maxLength={80} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="Priya Shah" />
        <Field label="Title" maxLength={120} value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="Software engineer at a startup" />
      </div>
      <Field as="textarea" rows={3} label="Intro (an officer reads it at Welcome)" maxLength={800} value={v.intro} onChange={(e) => set({ intro: e.target.value })} />
      <Field
        label="Zoom link"
        type="url"
        maxLength={500}
        value={v.zoomUrl}
        onChange={(e) => set({ zoomUrl: e.target.value })}
        placeholder="https://zoom.us/j/..."
        helper="Officers only. Never sent to members, the projector or the speaker link."
      />
      <div className="bk-seeds">
        <p className="ui-field__l">Seed questions (shown first, marked from the officers)</p>
        {seeds.map((q, k) => (
          <div key={k} className="bk-seed">
            <input
              className="ui-input"
              maxLength={200}
              value={q}
              aria-label={`Seed question ${k + 1}`}
              onChange={(e) => set({ seedQuestions: seeds.map((x, j) => (j === k ? e.target.value : x)) })}
            />
            <Button variant="ghost" icon={Trash} aria-label={`Remove seed question ${k + 1}`} onClick={() => set({ seedQuestions: seeds.filter((_, j) => j !== k) })} />
          </div>
        ))}
        {seeds.length < 5 && (
          <Button variant="ghost" icon={Plus} onClick={() => set({ seedQuestions: [...seeds, ''] })}>Add a seed question</Button>
        )}
      </div>
      <div className="bk-row">
        <Field
          label="Questions open on Today (hours before)"
          type="number"
          min={0}
          max={72}
          value={v.openEarlyHours}
          onChange={(e) => set({ openEarlyHours: e.target.value })}
        />
        <Field as="select" label="Projector during the talk" value={v.projector} onChange={(e) => set({ projector: e.target.value })}>
          <option value="questions">Questions on the projector</option>
          <option value="zoom">Zoom on the projector, questions on a phone</option>
        </Field>
      </div>
      <p className="ui-small bk-note"><LockSimple size={14} aria-hidden="true" /> The room never sends the Zoom link or officer notes to members or the projector.</p>
      {planId && <EarlyQuestions planId={planId} />}
    </fieldset>
  );
}
