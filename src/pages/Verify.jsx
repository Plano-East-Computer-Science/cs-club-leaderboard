/**
 * E7: the verified record. /verify/<code> shows what an officer vouched for and
 * prints cleanly, so a college or volunteer coordinator can check the same
 * page the member handed them.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Spinner, ErrorNote } from '../components/bits.jsx';

const KIND = { compete: 'Competed in', place: 'Placed in', ship: 'Shipped' };

const PRINT_CSS = `
@media print {
  header, nav, footer, .no-print, .tabbar, .dock { display: none !important; }
  body { background: #fff !important; color: #000 !important; }
  .vr-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; background: #fff !important; }
  .vr-sheet, .vr-sheet * { color: #000 !important; }
  .vr-item { break-inside: avoid; }
}`;

const fmt = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');
const grouped = (c) => c.replace(/(.{4})(?=.)/g, '$1-');

export default function Verify() {
  const { code } = useParams();
  const [rec, setRec] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Verified record';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    api.get(`/verify/${encodeURIComponent(code)}`).then((r) => setRec(r.record)).catch((e) => setError(e.status === 404 ? 'No current record has that code. It may have been withdrawn.' : e.message));
    return () => meta.remove();
  }, [code]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!rec) return <Spinner label="Checking the record" />;

  const place = (n) => (n ? ` (place ${n})` : '');
  return (
    <div className="mx-auto max-w-3xl">
      <style>{PRINT_CSS}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Back to the club</Link>
        <button className="btn btn-primary" onClick={() => window.print()}>Print / save as PDF</button>
      </div>

      <article className="vr-sheet card p-8 sm:p-10">
        <div className="border-b pb-5">
          <p className="eyebrow">Verified record</p>
          <h1 className="display mt-2 text-4xl font-extrabold">{rec.name}</h1>
          <p className="mono mt-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
            {rec.club}, {rec.school}. Member since {fmt(rec.since)}.
          </p>
        </div>

        <section className="mt-6">
          <h2 className="eyebrow mb-3">Attendance and roles</h2>
          <p className="text-sm">Meetings attended: <b>{rec.attended}</b></p>
          <p className="mt-1 text-sm">Current role: <b>{rec.roles.length ? rec.roles.join(', ') : 'Member'}</b></p>
        </section>

        <section className="mt-6">
          <h2 className="eyebrow mb-3">Competitions and projects approved by an officer</h2>
          {rec.results.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>None recorded yet.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {rec.results.map((r, i) => (
                <li key={i} className="vr-item">
                  {KIND[r.kind] ?? r.kind} <b>{r.title || 'an event'}</b>{place(r.place)}
                  {r.date && <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>{fmt(r.date)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="vr-item mt-8 border-t pt-5 text-sm">
          <p>Issued by <b>{rec.issued_by}</b> for the club on {fmt(rec.issued_at)}.</p>
          <p className="mt-3">
            To check this record, open <span className="mono">{window.location.origin}/verify/{grouped(rec.code)}</span>. If it
            does not open, the record has been withdrawn.
          </p>
          <p className="mono mt-2 text-sm">Code: <b>{grouped(rec.code)}</b></p>
        </section>
      </article>
    </div>
  );
}
