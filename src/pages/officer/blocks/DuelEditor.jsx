/**
 * Duel block payload (Wave 6, officer audit finding 1): pick a live duel pack
 * and its settings in the plan, so the host opens the lobby in one tap.
 */
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { Field } from '../../../ui/index.js';
import { duelMinutes } from '../../../../shared/session-templates.js';
import './blocks.css';

const EMPTY = { set: '', minutes: 10, rounds: 3, newMode: '1v1', spotlight: true };

export default function DuelEditor({ value, onChange, blockMinutes }) {
  const v = { ...EMPTY, ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const [packs, setPacks] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api
      .get('/admin/hub/sets?kind=duel&status=live')
      .then((d) => setPacks(d.sets))
      .catch((e) => setErr(e.message));
  }, []);
  const need = duelMinutes({ ...v, minutes: Number(v.minutes) || 0, rounds: Number(v.rounds) || 0 });
  const short = v.set && Number(blockMinutes) > 0 && need > Number(blockMinutes);
  return (
    <fieldset className="bk">
      <legend className="ui-label">Duel</legend>
      <Field
        as="select"
        label="Duel pack"
        value={v.set}
        onChange={(e) => set({ set: e.target.value })}
        error={err || undefined}
        helper={packs && !packs.length ? 'No live duel packs yet. Make one in Library, Duel packs.' : 'The host opens the lobby with this pack in one tap.'}
      >
        <option value="">Pick on the night</option>
        {(packs ?? []).map((p) => (
          <option key={p.slug} value={p.slug}>{p.title}</option>
        ))}
        {v.set && packs && !packs.some((p) => p.slug === v.set) && <option value={v.set}>{v.set} (not live)</option>}
      </Field>
      <div className="bk-row bk-row--4">
        <Field label="Minutes per round" type="number" min={1} max={60} value={v.minutes} onChange={(e) => set({ minutes: e.target.value })} />
        <Field label="Rounds" type="number" min={1} max={6} value={v.rounds} onChange={(e) => set({ rounds: e.target.value })} />
        <Field as="select" label="New division" value={v.newMode} onChange={(e) => set({ newMode: e.target.value })}>
          <option value="1v1">1v1</option>
          <option value="2v2">2v2, driver and navigator</option>
        </Field>
        <label className="bk-check">
          <input type="checkbox" checked={v.spotlight} onChange={(e) => set({ spotlight: e.target.checked })} />
          <span>3-minute spotlight after each round</span>
        </label>
      </div>
      {short && (
        <p className="bk-warn" role="status">
          {v.rounds} rounds need {need} minutes but the block has {blockMinutes}. Add time or drop a round.
        </p>
      )}
    </fieldset>
  );
}
