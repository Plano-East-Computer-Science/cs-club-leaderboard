/**
 * Small pieces every HQ area shares: relative times, a load-with-states hook,
 * route tabs, the `say` the old officer screens report through, and a frame
 * that hosts one of those older screens inside the new layout.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useToast, ErrorState, SkeletonList, Button } from '../../ui/index.js';
import { endWarning } from '../../../shared/session-templates.js';

/** HQ-wide state: who is signed in and the inbox counts the sidebar shows. */
export const HqCtx = createContext({ officer: null, counts: {}, refreshCounts: () => {} });
export const useHq = () => useContext(HqCtx);

/** ms (or SQLite UTC text) to "just now", "5 min ago", "3 hours ago", "yesterday", "12 days ago", "Mar 4". */
export function timeAgo(v, now = Date.now()) {
  if (v == null) return '';
  const t = typeof v === 'number' ? v : Date.parse(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`);
  if (!Number.isFinite(t)) return '';
  const s = Math.round((now - t) / 1000);
  if (s < 0) return 'just now';
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 45) return `${d} days ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d > 300 ? 'numeric' : undefined });
}

/** "Wed, Nov 25" for YYYY-MM-DD. */
export const dayLabel = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "today", "tomorrow", "in 6 days", "3 days ago" for a whole-day difference. */
export const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`);

/** GET `path` with loading and error state. `reload` refetches without blanking the screen. */
export function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(() => {
    setError(null);
    return api.get(path).then(setData).catch((e) => setError(e.message));
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload, setData };
}

/** Skeleton while loading, an error with a retry, else the content. */
export function Loaded({ state, rows = 4, label = 'Loading', children }) {
  if (state.error && !state.data) return <ErrorState onRetry={state.reload}>{state.error}</ErrorState>;
  if (!state.data) return <SkeletonList rows={rows} label={label} />;
  return children(state.data);
}

/** The old screens report through say(message, tone); in HQ that is a toast. */
export function useSay() {
  const toast = useToast();
  return useCallback((message, tone = 'ok') => toast(message, { tone: tone === 'ok' ? 'ok' : 'bad' }), [toast]);
}

/** Underline tabs that are routes: the URL holds the sub-screen. items: [{ to, label, end? }]. */
export function HqTabs({ items, label }) {
  return (
    <nav className="hq-tabs ui-tabs__list" aria-label={label}>
      {items.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="ui-tab">
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Hosts one of the older officer screens: only its frame and header change (Wave 5). */
export function Old({ C }) {
  const say = useSay();
  const { actionsUrl } = useHq();
  return (
    <div className="hq-old">
      <C say={say} actionsUrl={actionsUrl} />
    </div>
  );
}

/** What closing a room paid, in one sentence (closing pays attendance through the ledger). */
export const paidMessage = (d) =>
  `Closed. Paid attendance to ${d.awarded} member${d.awarded === 1 ? '' : 's'}` +
  (d.alreadyHad ? `, ${d.alreadyHad} already paid` : '') +
  (d.noExit ? `, ${d.noExit} with no bonus` : '') +
  (d.unlinked ? `. ${d.unlinked} still waiting on a link request.` : '.');

/**
 * The in-page "Close and pay" confirmation (Wave 3's endWarning): says who gets
 * paid before anything happens, then uses the existing close route.
 */
export function CloseConfirm({ room, onCancel, onClosed }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const close = async () => {
    setBusy(true);
    try {
      const d = await api.post(`/admin/hub/rooms/${room.code}/close`);
      toast(paidMessage(d));
      onClosed?.(d);
    } catch (e) {
      toast(e.message, { tone: 'bad' });
      setBusy(false);
    }
  };
  return (
    <div className="hq-confirm" role="alertdialog" aria-label={`Close room ${room.code}?`}>
      {endWarning({ joined: room.attendees, exits: room.eligible ?? 0, dropin: room.kind === 'dropin' }).map((l) => (
        <p key={l}>{l}</p>
      ))}
      <div className="hq-row-actions">
        <Button variant="danger" autoFocus disabled={busy} onClick={close}>
          {busy ? 'Closing' : 'Close and pay'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Keep it open
        </Button>
      </div>
    </div>
  );
}

/** Copies text; falls back to a prompt where the clipboard is blocked. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy this:', text);
    return false;
  }
}
