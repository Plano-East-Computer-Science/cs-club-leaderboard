/**
 * Who is signed in, fetched once and shared.
 *
 * This is UX only. Every gated route is enforced by the Worker, which is the
 * real gate -- nothing here decides what a person is allowed to read, it only
 * decides whether to show them the page or the sign-in prompt.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext({
  loading: true,
  authed: false,
  configured: false,
  devLogin: false,
  member: null,
  refresh: () => {},
});

const SIGNED_OUT = { loading: false, authed: false, configured: false, devLogin: false, member: null };

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ...SIGNED_OUT, loading: true });

  const refresh = () =>
    api
      .get('/auth/me')
      .then((d) =>
        setState({
          loading: false,
          authed: Boolean(d.authed),
          configured: Boolean(d.configured),
          devLogin: Boolean(d.dev_login),
          member: d.member,
        })
      )
      .catch(() => setState(SIGNED_OUT));

  useEffect(() => {
    refresh();
  }, []);

  return <AuthContext.Provider value={{ ...state, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
