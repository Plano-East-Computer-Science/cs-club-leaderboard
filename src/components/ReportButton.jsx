/**
 * G5: "report" on member-written content. One tap and a confirm; an officer
 * sees it in the Reports screen. kind is idea, project or feed.
 */
import { useState } from 'react';
import { api } from '../lib/api.js';

export default function ReportButton({ kind, id, what = 'this' }) {
  const [state, setState] = useState('idle'); // idle | sent | error
  const [msg, setMsg] = useState('');

  async function send() {
    if (!window.confirm(`Report ${what} to the officers? They will take a look.`)) return;
    try {
      await api.post('/reports', { kind, id });
      setState('sent');
    } catch (err) {
      setMsg(err.status === 401 ? 'Sign in to report.' : err.message);
      setState('error');
    }
  }

  if (state === 'sent') return <span className="rpt-done" role="status">reported, thanks</span>;
  return (
    <>
      <button type="button" className="linkb rpt" onClick={send} aria-label={`Report ${what}`}>report</button>
      {state === 'error' && <span className="rpt-done" role="alert">{msg}</span>}
    </>
  );
}
