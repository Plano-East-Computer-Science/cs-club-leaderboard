import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** `?static=1` reveals everything at once (used for screenshots). */
const isStatic = () => /static/.test(location.search);

/**
 * Scroll reveal. Content is always in the DOM; `.rv` only fades it in once it
 * scrolls into view. Elements with a className that changes after render must
 * not carry `.rv`, because React would rewrite the class and drop `.in`.
 */
export function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.rv:not(.in)')];
    if (!els.length) return;
    if (reducedMotion() || isStatic() || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((x) => {
          if (x.isIntersecting) {
            x.target.classList.add('in');
            io.unobserve(x.target);
          }
        }),
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
}

/** Tracks a media query. */
export function useMedia(query) {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [query]);
  return m;
}

/** GET a public endpoint once, with a retry. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null });
  const load = useCallback(() => {
    setState({ data: null, error: null });
    api.get(path).then((data) => setState({ data, error: null })).catch((e) => setState({ data: null, error: e.message }));
  }, [path]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

export const first = (n = '') => n.split(' ')[0];
