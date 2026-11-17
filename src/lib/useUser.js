import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * The signed-in student, or null. `loading` is true until the first answer so
 * pages can avoid flashing a sign-in prompt at someone who is already in.
 */
export function useUser() {
  const [state, setState] = useState({ user: null, loading: true });

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/me');
      setState({ user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.post('/auth/logout');
    setState({ user: null, loading: false });
  }, []);

  return { ...state, refresh, signOut };
}
