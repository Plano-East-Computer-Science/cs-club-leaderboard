/**
 * Site-wide data, fetched once. The standings, opportunity board, command bar,
 * status line and boot screen all read the same copy, so a command like
 * `rank ava` or `grep usaco` works from any page without another request.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { seasonOf } from './season.js';

const Ctx = createContext(null);

export function DataProvider({ children }) {
  const [state, setState] = useState({
    board: null, // { students, events }
    opps: null, // { opportunities, radius_miles, school }
    settings: {},
    errors: {},
  });

  const load = useCallback(() => {
    setState((s) => ({ ...s, errors: {} }));
    const keys = ['board', 'opps', 'site'];
    Promise.allSettled([api.get('/leaderboard'), api.get('/opportunities'), api.get('/site')]).then((r) => {
      const errors = {};
      const next = {};
      r.forEach((x, i) => {
        if (x.status === 'fulfilled') next[keys[i]] = x.value;
        else errors[keys[i]] = x.reason?.message || 'Request failed';
      });
      setState((s) => ({
        board: next.board ?? s.board,
        opps: next.opps ?? s.opps,
        settings: next.site?.settings ?? s.settings,
        errors,
      }));
    });
  }, []);
  useEffect(load, [load]);

  const value = useMemo(() => {
    const students = state.board?.students ?? [];
    return {
      ...state,
      reload: load,
      students,
      events: state.board?.events ?? [],
      opportunities: state.opps?.opportunities ?? [],
      radius: state.opps?.radius_miles ?? 15,
      school: state.opps?.school ?? '',
      totalPoints: students.reduce((n, s) => n + s.points, 0),
      season: seasonOf(state.settings),
    };
  }, [state, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
