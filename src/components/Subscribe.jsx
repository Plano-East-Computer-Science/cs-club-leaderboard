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
      <form className="ui-sub" onSubmit={submit}>
        <input
          className="ui-input"
          type="email"
          placeholder="you@gmail.com"
          aria-label="Email address"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="ui-btn ui-btn--secondary" disabled={state.busy}>
          {state.busy ? 'Sending' : 'Subscribe'}
        </button>
      </form>
      <p className={state.error ? 'ui-field__e' : 'ui-field__h'} aria-live="polite">
        {state.done && `Check ${email} for a link to confirm.`}
        {state.error}
      </p>
    </>
  );
}
