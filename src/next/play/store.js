/**
 * Play results and in-progress games in localStorage (keys start `next:`,
 * every access guarded), synced to /api/play when signed in. Signed-out
 * students keep everything here; on sign-in, today's and yesterday's local
 * results are pushed once and the server's results are merged back.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '../../lib/api.js';
import { addDays, chicagoDate, dateOpen, streakOf } from '../../../shared/next/play/core.js';

const RESULTS = 'next:play:results';
const STATES = 'next:play:states';

export function readLocal(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const keyOf = (game, date) => `${game}:${date}`;

/* --------------------------------- results --------------------------------- */

let results = readLocal(RESULTS, {});
const subs = new Set();
function set(next) {
  results = next;
  writeLocal(RESULTS, results);
  subs.forEach((f) => f());
}
const subscribe = (f) => (subs.add(f), () => subs.delete(f));

/** { 'keyword:2026-11-20': { game, date, score, guesses, ms, detail, synced } } */
export const useResults = () => useSyncExternalStore(subscribe, () => results);
export const getResult = (game, date) => results[keyOf(game, date)] ?? null;
export const streakFrom = (all, today = chicagoDate()) => streakOf(Object.values(all).map((r) => r.date), today);

const body = ({ game, date, score, guesses = null, ms = null, detail = null }) => ({ game, date, score, guesses, ms, detail });

async function push(r) {
  try {
    await api.post('/play/results', body(r));
  } catch (e) {
    if (!e.status || e.status >= 500) return; // offline or server trouble: try again next sync
  }
  set({ ...results, [keyOf(r.game, r.date)]: { ...results[keyOf(r.game, r.date)], synced: true } });
}

/** Save a finished daily game. The first result of the day stands. */
export function recordResult(r, signedIn) {
  const k = keyOf(r.game, r.date);
  if (results[k]) return;
  set({ ...results, [k]: { ...body(r), synced: false } });
  if (signedIn) push(results[k]);
}

let syncing = null;
/** Pull my server results, then push local ones the server has not seen (today and yesterday only). */
export function sync() {
  syncing ??= (async () => {
    try {
      const me = await api.get('/play/me');
      const next = { ...results };
      for (const s of me.results) next[keyOf(s.game, s.date)] = { ...body(s), synced: true };
      set(next);
      const today = chicagoDate();
      for (const r of Object.values(results)) if (!r.synced && dateOpen(r.date, today)) await push(r);
    } catch {
      // signed out or offline: local results still work
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/* ------------------------------ in-progress games ------------------------------ */

let states = readLocal(STATES, {});

/**
 * useState that survives a reload for a daily game. Practice rounds pass
 * persist = false. Old days are dropped when a new one is saved.
 */
export function useGameState(game, date, init, persist) {
  const key = keyOf(game, date);
  const [s, setS] = useState(() => (persist && states[key]) || init());
  useEffect(() => {
    if (!persist) return;
    const keep = addDays(chicagoDate(), -2);
    states = Object.fromEntries(Object.entries({ ...states, [key]: s }).filter(([k]) => k.slice(-10) >= keep));
    writeLocal(STATES, states);
  }, [key, s, persist]);
  return [s, setS];
}
export const hasState = (game, date) => Boolean(states[keyOf(game, date)]);
