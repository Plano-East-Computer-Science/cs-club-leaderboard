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

  return (
    <>
      <form className="sub-form" onSubmit={submit}>
        <span>&gt;</span>
        <input
          type="email"
          placeholder="you@gmail.com"
          aria-label="Email address"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button disabled={state.busy}>{state.busy ? 'sending...' : 'subscribe'}</button>
      </form>
      <div className="sub-out" aria-live="polite" style={state.error ? { color: 'var(--down)' } : undefined}>
        {state.done && `> confirmation sent to ${email}. click the link in it to finish subscribing.`}
        {state.error && `> ${state.error}`}
      </div>
    </>
  );
}
