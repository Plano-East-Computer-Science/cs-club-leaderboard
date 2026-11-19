/**
 * HQ Inbox: one queue across every review job (claims, editorials, CTF
 * challenges, link requests, reports, scraped opportunities, alumni
 * questions). GET /admin/hub/inbox gathers them; approving and rejecting go
 * through each kind's own existing route, listed in ACTIONS below.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X, ArrowSquareOut, CheckCircle } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { PageHeader, Button, Pill, EmptyState, Field, useToast } from '../../ui/index.js';
import { INBOX_KINDS } from '../../../shared/hq.js';
import { Loaded, useLoad, timeAgo, useHq } from './bits.jsx';

export const KIND_LABEL = {
  claims: 'Claims',
  editorials: 'Editorials',
  ctf: 'CTF challenges',
  links: 'Link requests',
  reports: 'Reports',
  opportunities: 'Opportunities',
  alumni: 'Alumni questions',
};
const CHIP = { claims: 'Claim', editorials: 'Editorial', ctf: 'CTF', links: 'Link', reports: 'Report', opportunities: 'Opportunity', alumni: 'Alumni' };

/**
 * Per kind: the approve and reject calls. `reason` means the reject route
 * stores an optional reason; `ask` means reject waits for a confirm.
 */
const ACTIONS = {
  claims: {
    yes: ['Approve', (id) => api.post(`/admin/hub/claims/${id}/approve`)],
    no: ['Reject', (id, reason) => api.post(`/admin/hub/claims/${id}/reject`, { reason }), { reason: true }],
  },
  editorials: {
    yes: ['Accept', (id) => api.post(`/admin/hub/editorials/${id}/accept`)],
    no: ['Reject', (id) => api.post(`/admin/hub/editorials/${id}/reject`), { ask: true }],
  },
  ctf: {
    yes: ['Approve', (id) => api.post(`/admin/hub/ctf/${id}/approve`)],
    no: ['Reject', (id, reason) => api.post(`/admin/hub/ctf/${id}/reject`, { reason }), { reason: true }],
  },
  links: {
    yes: ['Approve', (id) => api.post(`/admin/hub/links/${id}/approve`)],
    no: ['Reject', (id) => api.post(`/admin/hub/links/${id}/reject`), { ask: true }],
  },
  reports: {
    yes: ['Hide it', (id) => api.post(`/admin/hub/reports/${id}/hide`)],
    no: ['Dismiss', (id) => api.post(`/admin/hub/reports/${id}/dismiss`)],
  },
  opportunities: {
    yes: ['Publish', (id) => api.patch(`/admin/opportunities/${id}`, { status: 'live' })],
    no: ['Reject', (id) => api.del(`/admin/opportunities/${id}`), { ask: true }],
  },
  alumni: {
    yes: ['Mark forwarded', (id) => api.post(`/admin/hub/alumni/questions/${id}/forwarded`)],
  },
};

const DONE = { Approve: 'Approved', Accept: 'Accepted', 'Hide it': 'Hidden', Publish: 'Published', 'Mark forwarded': 'Marked forwarded', Reject: 'Rejected', Dismiss: 'Dismissed' };

function Item({ it, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const a = ACTIONS[it.kind];
  const [yesLabel, yesCall] = a.yes;
  const [noLabel, noCall, noOpts = {}] = a.no ?? [];

  const run = async (label, call) => {
    setBusy(true);
    try {
      const r = await call(it.id, reason.trim());
      const paid = r?.awarded ? ` ${r.awarded} points paid.` : '';
      toast(`${DONE[label] ?? 'Done'}: ${it.who}.${paid}`);
      onDone(it);
    } catch (e) {
      toast(e.message, { tone: 'bad' });
      setBusy(false);
    }
  };

  return (
    <li className="hq-item">
      <div>
        <div className="hq-item__top">
          <Pill>{CHIP[it.kind]}</Pill>
          <span className="hq-item__who">{it.who}</span>
          <span className="hq-item__when">{timeAgo(it.at)}</span>
        </div>
        <p className="hq-item__what">{it.what}</p>
        {it.detail && <p className="hq-item__d">{it.detail}</p>}
        {it.link && (
          <a className="hq-item__link" href={it.link} target={it.link.startsWith('/') ? undefined : '_blank'} rel="noreferrer noopener">
            <ArrowSquareOut size={14} aria-hidden="true" />
            {it.kind === 'claims' ? 'Proof' : it.kind === 'editorials' ? 'The problem' : 'Open the link'}
          </a>
        )}
      </div>
      <div className="hq-item__a">
        {it.points ? <span className="hq-pts" aria-label={`Pays ${it.points} points`}>+{it.points}</span> : <span />}
        {!rejecting && (
          <div className="hq-row-actions">
            <Button icon={Check} disabled={busy} onClick={() => run(yesLabel, yesCall)} aria-label={`${yesLabel}: ${it.what}`}>
              {yesLabel}
            </Button>
            {noLabel && (
              <Button
                variant="ghost"
                icon={noOpts.reason || noOpts.ask ? X : undefined}
                disabled={busy}
                onClick={() => (noOpts.reason || noOpts.ask ? setRejecting(true) : run(noLabel, noCall))}
                aria-label={`${noLabel}: ${it.what}`}
              >
                {noLabel}
              </Button>
            )}
          </div>
        )}
      </div>
      {rejecting && (
        <form
          className="hq-confirm"
          onSubmit={(e) => {
            e.preventDefault();
            run(noLabel, noCall);
          }}
        >
          {noOpts.reason ? (
            <Field
              label="Reason (optional, the member sees it)"
              value={reason}
              maxLength={200}
              autoFocus
              placeholder="No proof link, so we cannot check it"
              onChange={(e) => setReason(e.target.value)}
            />
          ) : (
            <p>Reject this from {it.who}? It cannot be undone here.</p>
          )}
          <div className="hq-row-actions">
            <Button type="submit" variant="danger" disabled={busy} autoFocus={!noOpts.reason}>
              {busy ? 'Rejecting' : 'Reject'}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const kind = INBOX_KINDS.includes(params.get('kind')) ? params.get('kind') : 'all';
  const state = useLoad('/admin/hub/inbox');
  const { refreshCounts } = useHq();

  const remove = (it) => {
    state.setData((d) => {
      const counts = { ...d.counts, [it.kind]: Math.max(0, d.counts[it.kind] - 1) };
      return { ...d, counts, total: Math.max(0, d.total - 1), items: d.items.filter((x) => !(x.kind === it.kind && x.id === it.id)) };
    });
    refreshCounts();
  };
  const pick = (k) => setParams(k === 'all' ? {} : { kind: k }, { replace: true });

  return (
    <>
      <PageHeader title="Inbox" subtitle="Everything waiting on an officer, newest first." />
      <Loaded state={state} rows={5} label="Loading the inbox">
        {(d) => {
          const items = kind === 'all' ? d.items : d.items.filter((i) => i.kind === kind);
          const shown = kind === 'all' ? d.total : d.counts[kind];
          return (
            <>
              <div className="hq-filters" role="group" aria-label="Filter by kind">
                <button type="button" className="hq-filter" aria-pressed={kind === 'all'} onClick={() => pick('all')}>
                  All <span className="hq-filter__n">{d.total}</span>
                </button>
                {INBOX_KINDS.map((k) => (
                  <button key={k} type="button" className="hq-filter" aria-pressed={kind === k} onClick={() => pick(k)}>
                    {KIND_LABEL[k]} <span className="hq-filter__n">{d.counts[k]}</span>
                  </button>
                ))}
              </div>
              {items.length === 0 ? (
                <div className="hq-panel">
                  <EmptyState icon={CheckCircle}>
                    {kind === 'all' ? 'The inbox is clear. Nothing is waiting on an officer.' : `No ${KIND_LABEL[kind].toLowerCase()} waiting.`}
                  </EmptyState>
                </div>
              ) : (
                <>
                  <ul className="hq-panel hq-list" aria-label={`${KIND_LABEL[kind] ?? 'All items'}, ${shown} waiting`}>
                    {items.map((it) => (
                      <Item key={`${it.kind}-${it.id}`} it={it} onDone={remove} />
                    ))}
                  </ul>
                  {shown > items.length && (
                    <p className="hq-note">
                      Showing the newest {items.length} of {shown}. Clear some and the rest appear.
                    </p>
                  )}
                </>
              )}
            </>
          );
        }}
      </Loaded>
    </>
  );
}
