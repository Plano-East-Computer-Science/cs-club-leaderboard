/**
 * The weekly-email signup. Rendered in the footer on every page and as the
 * last step on the Join page, so the same form is never built twice.
 */
import { useState } from 'react';
import { api } from '../lib/api.js';

export function SubscribeBox({ id = 'subscribe-email' }) {
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
      <p className="text-sm" role="status" style={{ color: 'var(--ink-soft)' }}>
        If you are not already on the list, a confirmation email is on its way. Click the link
        in it to finish.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Email address
      </label>
      <input
        id={id}
        className="field min-w-0 flex-1"
        type="email"
        placeholder="you@gmail.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button className="btn btn-primary" disabled={state.busy}>
        {state.busy ? 'Sending' : 'Subscribe'}
      </button>
      {state.error && (
        <p className="w-full text-xs" role="alert" style={{ color: 'var(--danger)' }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
