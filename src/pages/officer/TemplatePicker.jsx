/**
 * B1/B10: pick how a meeting runs when opening a room. Each template is a
 * run-of-show from shared/session-templates.js; "drop-in" is a Panther Pause
 * room with no agenda (help queue and check-in only). V3-A: every template
 * comes in 60 and 120 minutes; `minutes` picks which one is previewed.
 */
import { BLOCK_LABEL, LENGTHS, TEMPLATES } from '../../../shared/session-templates.js';

const options = (minutes) => [
  ...Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name, blurb: t.blurb, blocks: t.lengths[minutes] })),
  { id: 'dropin', name: 'Panther Pause drop-in', blurb: 'No agenda: check-in and a help queue. Pays a smaller attendance.', blocks: [] },
];

/** 60 or 120 minutes, as a pair of toggle buttons. */
export function LengthPicker({ value, onChange }) {
  return (
    <div className="chips" role="group" aria-label="Meeting length">
      {LENGTHS.map((m) => (
        <button key={m} type="button" aria-pressed={value === m} onClick={() => onChange(m)}>
          {m} min
        </button>
      ))}
    </div>
  );
}

export default function TemplatePicker({ value, onChange, minutes, onMinutes }) {
  return (
    <fieldset className="tpl">
      <legend className="eyebrow mb-2">How does this meeting run?</legend>
      {value !== 'dropin' && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="eyebrow">Length</span>
          <LengthPicker value={minutes} onChange={onMinutes} />
        </div>
      )}
      <div className="tpl-grid">
        {options(minutes).map((o) => (
          <label key={o.id} className={`tpl-opt ${value === o.id ? 'on' : ''}`}>
            <input type="radio" name="template" value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <b>{o.name}</b>
            <span className="d">{o.blurb}</span>
            {o.blocks.length > 0 && (
              <span className="tpl-blocks mono">
                {o.blocks.map((b, i) => (
                  <span key={i}>
                    {BLOCK_LABEL[b.type].toLowerCase()} {b.minutes}
                  </span>
                ))}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
