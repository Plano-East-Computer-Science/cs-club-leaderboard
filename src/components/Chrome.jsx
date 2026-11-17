/**
 * Shared chrome for design E: the tmux-style tab bar, the command bar with its
 * status line, the boot screen and the holiday layer (snow + string lights).
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../lib/data.jsx';
import { TIERS } from '../lib/tiers.js';
import { formatDate, daysUntil } from '../lib/format.js';
import { reducedMotion } from '../lib/ui.js';
import { setXmas, useXmas, xmasOn } from '../lib/xmas.js';

export const PAGES = [
  ['home', '/'],
  ['standings', '/standings'],
  ['learn', '/learn'],
  ['projects', '/projects'],
  ['room', '/room'],
  ['opportunities', '/opportunities'],
  ['calendar', '/calendar'],
  // Below here the tab bar tucks pages into a "more" menu.
  ['curriculum', '/curriculum'],
  ['competitions', '/competitions'],
  ['cyber', '/cyber'],
  ['puzzles', '/puzzles'],
  ['gateway', '/gateway'],
  ['about', '/about'],
  ['join', '/join'],
  ['admin', '/admin'],
];
const MAIN = 7; // how many tabs stay on the bar
const ALIAS = { opps: 'opportunities', comps: 'competitions', lb: 'standings', board: 'standings', home: 'home' };

const Logo = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M2 1l3 3h6l3-3v7l-2 2 1 5-4-2h-2l-4 2 1-5-2-2z" />
  </svg>
);

/* ------------------------------- tab bar ------------------------------- */

export function TabBar() {
  const { pathname } = useLocation();
  const on = useXmas();
  const navRef = useRef(null);
  const moreRef = useRef(null);
  const [open, setOpen] = useState(false);
  const cur = (to) => (to === '/' ? pathname === '/' : to === '/standings' ? pathname.startsWith('/standings') || pathname.startsWith('/student') : pathname.startsWith(to));

  const main = PAGES.slice(0, MAIN);
  const more = PAGES.slice(MAIN).filter(([n]) => n !== 'admin');
  const admin = PAGES.find(([n]) => n === 'admin');
  const moreActive = more.some(([, to]) => cur(to));

  useEffect(() => {
    setOpen(false);
    navRef.current?.querySelector('[aria-current]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!moreRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <header className="tabs">
      <Link className="brand" to="/">
        <Logo />
        PEHS//CS
      </Link>
      <nav aria-label="Primary" ref={navRef}>
        {main.map(([name, to], i) => {
          const active = cur(to);
          return (
            <Link key={name} to={to} aria-current={active ? 'page' : undefined}>
              <b>{i}</b>
              {name}
              {active ? '*' : ''}
            </Link>
          );
        })}
      </nav>
      <div className="more" ref={moreRef}>
        <button type="button" className={moreActive ? 'on' : undefined} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
          more<span aria-hidden="true">{open ? ' ▴' : ' ▾'}</span>
        </button>
        {open && (
          <div className="more-menu" role="menu">
            {more.map(([name, to]) => (
              <Link key={name} to={to} role="menuitem" aria-current={cur(to) ? 'page' : undefined}>
                {name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Link className={`adm${cur(admin[1]) ? ' on' : ''}`} to={admin[1]} aria-current={cur(admin[1]) ? 'page' : undefined}>
        admin
      </Link>
      <div className="hint">
        <kbd>/</kbd>command
        <button className="xtog" type="button" title="Toggle holiday theme" aria-pressed={on} onClick={() => setXmas(!on)}>
          {on ? 'xmas: on' : 'xmas: off'}
        </button>
      </div>
      <div className="lights" aria-hidden="true" />
    </header>
  );
}

/* ---------------------------- command bar + status ---------------------------- */

const CMDS = [
  ['open <page>', 'jump to a page'],
  ['rank <name>', 'show a member rank and tier'],
  ['grep <text>', 'search the opportunity board'],
  ['top', 'print the top three'],
  ['prize', 'what first place wins'],
  ['tiers', 'list the 7 tiers'],
  ['xmas', 'toggle the holiday theme'],
  ['help', 'list commands'],
];

const tierOf = (p) => {
  let i = 0;
  TIERS.forEach((t, k) => {
    if (p >= t.min) i = k;
  });
  return i;
};

export function Dock() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { students, opportunities, totalPoints, season, settings } = useData();
  const [value, setValue] = useState('');
  const [sugg, setSugg] = useState([]);
  const [si, setSi] = useState(0);
  const [outText, setOutText] = useState(null);
  const inputRef = useRef(null);

  const prize = settings.prize_title || 'Meta Ray-Ban Display Glasses';
  const next = opportunities
    .filter((o) => o.deadline && daysUntil(o.deadline) >= 0)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const out = (t) => {
    setOutText(t);
    setSugg([]);
  };
  const close = () => {
    setOutText(null);
    setSugg([]);
  };

  const go = (n) => {
    n = ALIAS[n] || n;
    const p = PAGES.find((x) => x[0] === n);
    if (!p) return out(`open: no such page "${n}". try: ${PAGES.map((x) => x[0]).join(', ')}`);
    navigate(p[1]);
    close();
  };

  const fillOf = (c) => c.split(' ')[0] + (c.includes(' ') ? ' ' : '');

  const suggest = (raw) => {
    const v = raw.trim().toLowerCase();
    let L = [];
    if (!v) L = CMDS.map((c) => ({ k: c[0], d: c[1], fill: fillOf(c[0]) }));
    else if (/^open\s/.test(v)) {
      const q = v.slice(5);
      L = PAGES.filter(
        (p) => p[0].startsWith(q) || Object.entries(ALIAS).some(([a, t]) => t === p[0] && a.startsWith(q))
      ).map((p) => ({ k: `open ${p[0]}`, d: `go to ${p[1]}`, fill: `open ${p[0]}` }));
    } else if (/^rank\s/.test(v)) {
      const q = v.slice(5);
      L = students
        .filter((m) => m.name.toLowerCase().includes(q))
        .map((m) => ({
          k: `rank ${m.name.split(' ')[0].toLowerCase()}`,
          d: `${m.name}, ${m.points} pts`,
          fill: `rank ${m.name.split(' ')[0].toLowerCase()}`,
        }));
    } else L = CMDS.filter((c) => c[0].startsWith(v)).map((c) => ({ k: c[0], d: c[1], fill: fillOf(c[0]) }));
    setSugg(L);
    setSi(0);
    setOutText(null);
  };

  const run = (raw) => {
    const s = raw.trim();
    setValue('');
    if (!s) return close();
    const [c, ...r] = s.split(/\s+/);
    const a = r.join(' ');
    switch (c.toLowerCase()) {
      case 'open':
      case 'cd':
      case 'goto':
        return go(a.toLowerCase());
      case 'rank': {
        const q = a.toLowerCase();
        const i = students.findIndex((m) => m.name.toLowerCase().includes(q));
        if (!q || i < 0) return out(`rank: no member matches "${a}"`);
        const m = students[i];
        const ti = tierOf(m.points);
        const nx = TIERS[ti + 1];
        if (pathname === '/standings') window.dispatchEvent(new CustomEvent('select-member', { detail: i }));
        return out(
          `#${m.rank}  ${m.name}  ${m.grade ? `grade ${m.grade}` : 'member'}\n${m.points} pts  tier ${TIERS[ti].name.toUpperCase()}\n${
            nx ? `${nx.min - m.points} pts to ${nx.name}` : 'top tier reached'
          }${
            i
              ? `   gap to #${students[i - 1].rank}: ${students[i - 1].points - m.points} pts`
              : students[1]
                ? `   leading by ${m.points - students[1].points} pts`
                : ''
          }`
        );
      }
      case 'grep':
      case 'find':
      case 'search':
        navigate(`/opportunities${a ? `?q=${encodeURIComponent(a)}` : ''}`);
        return close();
      case 'top':
        return out(students.slice(0, 3).map((m, i) => `#${i + 1}  ${m.name.padEnd(14)} ${m.points} pts`).join('\n') || 'no members yet');
      case 'prize':
        return out(`First place wins ${prize}.\nPoints are earned all year. Every meeting, project and competition counts.`);
      case 'tiers':
        return out(TIERS.map((t) => `${String(t.min).padStart(3)}  ${t.name}`).join('\n'));
      case 'xmas':
      case 'holiday':
      case 'christmas': {
        const v = a === 'on' ? true : a === 'off' ? false : !xmasOn();
        setXmas(v, true);
        return out(v ? 'happy holidays. type xmas again to turn it off.' : 'holiday theme off.');
      }
      case 'clear':
        return close();
      case 'help':
      case '?':
        return out(CMDS.map((c) => c[0].padEnd(14) + c[1]).join('\n'));
      default:
        return out(`${c}: command not found. type "help"`);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const t = value.trim();
    if (sugg.length && t.split(/\s+/).length < 2 && sugg[si] && t !== sugg[si].fill.trim()) {
      const f = sugg[si].fill;
      setValue(f);
      if (f.endsWith(' ')) return suggest(f);
      return run(f);
    }
    run(value);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') return inputRef.current?.blur();
    if (!sugg.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSi((si + 1) % sugg.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSi((si - 1 + sugg.length) % sugg.length); }
    if (e.key === 'Tab') {
      e.preventDefault();
      setValue(sugg[si].fill);
      suggest(sugg[si].fill);
    }
  };

  const pick = (s) => {
    setValue(s.fill);
    inputRef.current?.focus();
    if (!s.fill.endsWith(' ')) run(s.fill);
    else suggest(s.fill);
  };

  return (
    <div className="dock">
      <div className={`pop ${sugg.length || outText ? 'on' : ''}`} role="listbox">
        {outText ? (
          <div className="out">{outText}</div>
        ) : (
          sugg.map((s, i) => (
            <div
              key={s.k}
              className={`it ${i === si ? 'on' : ''}`}
              role="option"
              aria-selected={i === si}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
            >
              <b>{s.k}</b>
              <span>{s.d}</span>
            </div>
          ))
        )}
      </div>
      <form className="cmd" autoComplete="off" onSubmit={onSubmit}>
        <span className="ps">$</span>
        <input
          ref={inputRef}
          value={value}
          aria-label="Command bar"
          placeholder="type / for commands: open opps, rank ava, grep ctf"
          spellCheck="false"
          onChange={(e) => {
            setValue(e.target.value);
            suggest(e.target.value);
          }}
          onFocus={() => suggest(value)}
          onBlur={() => setTimeout(close, 120)}
          onKeyDown={onKeyDown}
        />
        <span className="k">/</span>
      </form>
      <div className="stat">
        <span className="live">
          <i />
          {season.label}
        </span>
        <span>day {season.day}</span>
        <span>{totalPoints} pts awarded</span>
        <span className="opt">{students.length} members</span>
        {next && (
          <span className="fl">
            next deadline: {next.title.length > 34 ? `${next.title.slice(0, 33)}…` : next.title}, {formatDate(next.deadline).replace(/, \d{4}$/, '')}
          </span>
        )}
      </div>
    </div>
  );
}

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
        'calculating tiers ......... 7 tiers',
        `arming prize .............. ${d.settings.prize_title || 'Meta Ray-Ban Display Glasses'}`,
        '',
        'welcome back, panther.',
        'press / for the command bar',
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
