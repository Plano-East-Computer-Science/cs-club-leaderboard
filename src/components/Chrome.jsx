/**
 * The boot screen (once per session, skippable, off under reduced motion) and
 * the opt-in holiday layer. The tab bar and command dock that lived here were
 * replaced by the Wave 4 app shell in src/ui/Shell.jsx.
 */
import { useEffect, useRef, useState } from 'react';
import { useData } from '../lib/data.jsx';
import { reducedMotion } from '../lib/ui.js';
import { useXmas } from '../lib/xmas.js';

/* ------------------------------- boot screen ------------------------------- */

export function Boot() {
  const data = useData();
  const live = useRef(data);
  live.current = data;
  const [gone, setGone] = useState(() => {
    try {
      return reducedMotion() || !!sessionStorage.getItem('booted') || /static/.test(location.search);
    } catch {
      return true;
    }
  });
  const [out, setOut] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (gone) return;
    let dead = false;
    let li = 0;
    let ci = 0;
    let t;
    const lines = () => {
      const d = live.current;
      return [
        `PEHS-CS BIOS v${String(d.season.start.getFullYear()).slice(2)}.08  (c) Plano East Computer Science`,
        'mounting /club ............ ok',
        `loading roster.db ......... ${d.students.length} members`,
        `loading opportunities ..... ${d.opportunities.length} entries`,
        'calculating ranks ......... 7 ranks',
        `arming prize .............. ${d.settings.prize_title || 'Meta Ray-Ban Display Glasses'}`,
        '',
        'welcome back, panther.',
        'press / to search',
      ];
    };
    const end = () => {
      if (dead) return;
      dead = true;
      try {
        sessionStorage.setItem('booted', '1');
      } catch {
        /* ignore */
      }
      setOut(true);
      setTimeout(() => setGone(true), 300);
    };
    window.addEventListener('keydown', end);
    window.__bootEnd = end;
    const tick = () => {
      if (dead) return;
      const L = lines();
      if (li >= L.length) {
        t = setTimeout(end, 500);
        return;
      }
      ci += 3;
      setText(`${L.slice(0, li).join('\n')}${li ? '\n' : ''}${L[li].slice(0, ci)}█`);
      if (ci >= L[li].length) {
        li++;
        ci = 0;
        t = setTimeout(tick, li < 4 ? 70 : 110);
      } else t = setTimeout(tick, 12);
    };
    tick();
    return () => {
      dead = true;
      clearTimeout(t);
      window.removeEventListener('keydown', end);
    };
  }, [gone]);

  if (gone) return null;
  return (
    <div id="boot" className={out ? 'out' : ''} onClick={() => window.__bootEnd?.()}>
      <pre>{text}</pre>
      <div className="skip">click or press any key to skip</div>
    </div>
  );
}

/* ----------------------------- holiday layer ----------------------------- */

export function Snow() {
  const on = useXmas();
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    if (!on || reducedMotion() || !cv) return;
    const ctx = cv.getContext('2d');
    let fl = [];
    let raf = 0;
    let W = 0;
    let H = 0;
    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth;
      H = innerHeight;
      cv.width = W * d;
      cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const seed = () => {
      const n = Math.round(Math.min(140, W / 10));
      fl = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 2 + 0.8,
        v: Math.random() * 0.7 + 0.35,
        p: Math.random() * 6.28,
      }));
    };
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (const f of fl) {
        f.y += f.v;
        f.p += 0.012;
        f.x += Math.sin(f.p) * 0.4;
        if (f.y > H + 4) {
          f.y = -4;
          f.x = Math.random() * W;
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, 6.28);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (document.hidden) return;
      size();
      seed();
      tick();
    };
    start();
    const onResize = () => start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', start);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', start);
    };
  }, [on]);

  return <canvas id="snow" ref={ref} aria-hidden="true" />;
}
