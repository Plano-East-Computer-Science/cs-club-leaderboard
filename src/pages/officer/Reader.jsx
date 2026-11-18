/**
 * H3 officer screen: which sites members can open in reader mode. Hosts from
 * the gateway list are always readable too, so they are shown but not edited
 * here. Save an empty box to go back to the default documentation sites.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

export default function ReaderAdmin() {
  const [text, setText] = useState(null);
  const [always, setAlways] = useState([]);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    api.get('/admin/hub/reader').then((d) => { setText(d.hosts.join('\n')); setAlways(d.always); }).catch((e) => setError(e.message));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setNote(null);
    try {
      const d = await api.put('/admin/hub/reader', { hosts: text });
      setText(d.hosts.join('\n'));
      setNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      setNote({ text: err.message });
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Reader mode</p>
        <h2 className="display mt-1 text-2xl font-bold">Sites members can read</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          One host per line. Members see text and code only, never the site itself. The gateway sites ({always.length}) are always included.
        </p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {text === null && !error && <Spinner label="Loading reader sites" />}
      {text !== null && (
        <form className="card grid gap-3 p-4" onSubmit={save}>
          <label className="eyebrow" htmlFor="reader-hosts">Reader hosts</label>
          <textarea id="reader-hosts" className="field mono" rows={7} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary">Save</button>
            {note && <span className="mono text-xs" role="status" style={{ color: note.ok ? 'var(--up)' : 'var(--down)' }}>{note.text}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
