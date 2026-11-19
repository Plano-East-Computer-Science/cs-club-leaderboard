/**
 * Teach block payload (Wave 6): an optional slides link and up to five
 * concept checks, each a question, 2 to 6 options and the right one. The
 * answer stays with officers until the reveal.
 */
import { Plus, Trash } from '@phosphor-icons/react';
import { Button, Field } from '../../../ui/index.js';
import './blocks.css';

const LETTERS = 'ABCDEF';
const blank = () => ({ text: '', options: ['', '', '', ''], answer: 0 });

export default function TeachEditor({ value, onChange }) {
  const v = { slides: '', checks: [], ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const setCheck = (k, patch) => set({ checks: v.checks.map((c, j) => (j === k ? { ...c, ...patch } : c)) });
  return (
    <fieldset className="bk">
      <legend className="ui-label">Teach</legend>
      <Field label="Slides link (optional)" type="url" maxLength={500} value={v.slides} onChange={(e) => set({ slides: e.target.value })} placeholder="https://docs.google.com/presentation/..." />
      {v.checks.map((c, k) => (
        <div key={k} className="bk-check-q">
          <div className="bk-check-q__h">
            <p className="ui-field__l">Concept check {k + 1}</p>
            <Button variant="ghost" icon={Trash} aria-label={`Remove concept check ${k + 1}`} onClick={() => set({ checks: v.checks.filter((_, j) => j !== k) })} />
          </div>
          <Field
            as="textarea"
            rows={3}
            label="Question (code is fine, line breaks are kept)"
            maxLength={400}
            value={c.text}
            onChange={(e) => setCheck(k, { text: e.target.value })}
            placeholder={'int x = 7 / 2;\nWhat is x?'}
          />
          <div className="bk-opts" role="radiogroup" aria-label={`Right answer for check ${k + 1}`}>
            {c.options.map((o, i) => (
              <div key={i} className="bk-opt">
                <input
                  type="radio"
                  name={`teach-answer-${k}`}
                  checked={c.answer === i}
                  aria-label={`Option ${LETTERS[i]} is right`}
                  onChange={() => setCheck(k, { answer: i })}
                />
                <span className="ui-mono">{LETTERS[i]}</span>
                <input
                  className="ui-input"
                  maxLength={120}
                  value={o}
                  aria-label={`Check ${k + 1} option ${LETTERS[i]}`}
                  onChange={(e) => setCheck(k, { options: c.options.map((x, j) => (j === i ? e.target.value : x)) })}
                />
              </div>
            ))}
            <div className="bk-opt-btns">
              {c.options.length < 6 && <Button variant="ghost" icon={Plus} onClick={() => setCheck(k, { options: [...c.options, ''] })}>Option</Button>}
              {c.options.length > 2 && (
                <Button variant="ghost" onClick={() => setCheck(k, { options: c.options.slice(0, -1), answer: Math.min(c.answer, c.options.length - 2) })}>
                  Remove last option
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
      {v.checks.length < 5 && <Button icon={Plus} onClick={() => set({ checks: [...v.checks, blank()] })}>Add a concept check</Button>}
      <p className="ui-small bk-note">The room votes, sees the split without the answer, talks for a minute, votes again, then you reveal. Nothing is scored.</p>
    </fieldset>
  );
}
