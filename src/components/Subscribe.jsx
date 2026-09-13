/**
 * The weekly-email signup. Lives in the footer so it is on every page without
 * being a page of its own.
 */
import { useState } from 'react';
import { api } from '../lib/api.js';

export function SubscribeBox() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, done: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: null });
    try {
      await api.post('/subscribe', { email });
      setState({ busy: false, done: true, error: null });
    } catch (err) {
      setState({ busy: false, done: false, error: err.message });
    }
  };

  if (state.done) {
    return (
      <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
        Check your inbox — click the link to confirm.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-wrap items-center gap-2">
      <label className="mono w-full text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
        Weekly email: points, new opportunities, deadlines. Personal address, not school.
      </label>
      <input
        className="field min-w-0 flex-1"
        type="email"
        placeholder="you@gmail.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button className="btn btn-ghost" disabled={state.busy}>
        {state.busy ? 'Sending…' : 'Subscribe'}
      </button>
      {state.error && (
        <p className="mono w-full text-xs" style={{ color: '#c42e2e' }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
