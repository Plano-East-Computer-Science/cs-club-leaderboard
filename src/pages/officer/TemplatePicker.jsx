/**
 * B1/B10: pick how a meeting runs when opening a room. Each template is a
 * run-of-show from shared/session-templates.js; "drop-in" is a Panther Pause
 * room with no agenda (help queue and check-in only).
 */
import { BLOCK_LABEL, TEMPLATES } from '../../../shared/session-templates.js';

const OPTIONS = [
  ...Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name, blurb: t.blurb, blocks: t.blocks })),
  { id: 'dropin', name: 'Panther Pause drop-in', blurb: 'No agenda: check-in and a help queue. Pays a smaller attendance.', blocks: [] },
];

export default function TemplatePicker({ value, onChange }) {
  return (
    <fieldset className="tpl">
      <legend className="eyebrow mb-2">How does this meeting run?</legend>
      <div className="tpl-grid">
        {OPTIONS.map((o) => (
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
