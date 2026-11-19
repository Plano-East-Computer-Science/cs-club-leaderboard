/**
 * Holiday theme: an `xmas` class on <html>. Persisted in localStorage `e-xmas`,
 * forced by `?xmas=1` / `?xmas=0`. Off unless asked for: since Wave 4 the bar no
 * longer has a toggle, so it is the `xmas` command in the palette.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'e-xmas';
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (v) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* private mode: the theme just will not persist */
  }
};

const q = new URLSearchParams(location.search).get('xmas');
if (q === '1' || q === '0') write(q === '1' ? 'on' : 'off');

let on = read() === 'on';
const subs = new Set();
const apply = () => document.documentElement.classList.toggle('xmas', on);
apply();

export function setXmas(v, save = true) {
  on = v;
  apply();
  if (save) write(on ? 'on' : 'off');
  subs.forEach((f) => f());
}

export const xmasOn = () => on;

export function useXmas() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => on
  );
}
