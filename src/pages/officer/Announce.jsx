import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

/**
 * G3: write an announcement once. Discord and the weekly digest are sent from
 * here; Google Classroom and social have no usable API, so they get text blocks
 * to copy.
 */

const SOCIAL_LIMIT = 280;

function CopyBlock({ label, text, limit }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt('Copy this:', text);
    }
  };
  const over = limit && text.length > limit;
  return (
    <div className="card grid gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm">{label}</b>
        <span className="mono text-xs" style={{ color: over ? 'var(--down)' : 'var(--ink-soft)' }}>
          {text.length}
          {limit ? ` / ${limit}` : ''} characters
        </span>
      </div>
      <pre className="mono whitespace-pre-wrap text-xs" style={{ margin: 0 }}>{text || 'Write a message above.'}</pre>
      <button type="button" className="btn btn-ghost justify-self-start" onClick={copy} disabled={!text}>
        {done ? 'Copied' : `Copy for ${label}`}
      </button>
    </div>
  );
}

export default function Announce() {
  const [text, setText] = useState('');
  const [queued, setQueued] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/hub/announce').then((d) => setQueued(d.digestNotes)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const send = async (to) => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/admin/hub/announce', { text, to });
      setMsg({ ok: true, text: to === 'discord' ? 'Posted to Discord.' : 'Added to the next weekly digest.' });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const clearQueue = async () => {
    await api.del('/admin/hub/announce/digest').catch(() => {});
    load();
  };

  const trimmed = text.trim();
  const social = trimmed.length > SOCIAL_LIMIT ? `${trimmed.slice(0, SOCIAL_LIMIT - 1)}…` : trimmed;

  return (
    <section>
      <header className="mb-3">
        <p className="eyebrow">Announce</p>
        <h2 className="display text-xl font-extrabold">Write it once</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Discord and the weekly email send from here. Google Classroom has no way for a student app to post, so copy the
          block below into the stream.
        </p>
      </header>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span>Message</span>
          <textarea
            className="field"
            rows={5}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Meeting moved to room 214 this Thursday."
          />
          <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>{text.length} / 1000</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy || !trimmed} onClick={() => send('discord')}>
            Post to Discord
          </button>
          <button className="btn btn-ghost" disabled={busy || !trimmed} onClick={() => send('digest')}>
            Add to next digest
          </button>
        </div>
        {msg && (
          <p className="mono text-xs" role="status" style={{ color: msg.ok ? 'var(--ink-soft)' : 'var(--down)' }}>
            {msg.text}
          </p>
        )}
        {queued.length > 0 && (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            {queued.length} note{queued.length === 1 ? '' : 's'} waiting for the next digest.{' '}
            <button type="button" className="btn btn-ghost" onClick={clearQueue}>Clear</button>
          </p>
        )}
        <CopyBlock label="Google Classroom" text={trimmed ? `Club announcement\n\n${trimmed}` : ''} />
        <CopyBlock label="social caption" text={social ? `${social}\n\n#PlanoEast #CSClub` : ''} limit={SOCIAL_LIMIT + 20} />
      </div>
    </section>
  );
}
