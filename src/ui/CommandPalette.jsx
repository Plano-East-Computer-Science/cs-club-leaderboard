/**
 * Search and commands (Ctrl+K or "/"). Replaces the old dock and the "ls all"
 * panel: typing a word finds a page; the terminal commands from the dock still
 * work (open, join, daily, rank, grep, top, prize, tiers, claim, help).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as RDialog from '@radix-ui/react-dialog';
import {
  MagnifyingGlass,
  ArrowRight,
  Terminal,
  CalendarCheck,
  UserCircle,
  Lightning,
} from '@phosphor-icons/react';
import { useData } from '../lib/data.jsx';
import { TIERS, tierIndex } from '../lib/tiers.js';
import { tiersFrom, tierOf, TIER_NAMES } from '../../shared/standings.js';
import { setXmas, xmasOn } from '../lib/xmas.js';
import { DOORS } from './doors.js';
import { cx } from './primitives.jsx';

/** Every page, with what it is for. Searched by name and description. */
export const PAGES = [
  ['home', '/', 'Your games, lessons, deadlines and the next meeting'],
  ['play', '/play', 'Daily coding games'],
  ['learn', '/learn', 'Courses with real lessons: AP CSA, Python, USACO'],
  ['future', '/future', 'Opportunities, summer programs and your college plan'],
  ['club', '/club', 'Meetings, standings and the officer playbook'],
  ['me', '/me', 'Your portfolio and points record'],
  ['practice', '/practice', 'Track ladders and problems'],
  ['build', '/build', 'Ship cycles, templates and projects'],
  ['college', '/future/college', 'Grade-by-grade plan for a top CS program'],
  ['tracker', '/future/tracker', 'Applications and deadlines you are tracking'],
  ['playbook', '/club/playbook', 'How to run every kind of meeting'],
  ['compete', '/compete', 'Standings, tiers and the prize'],
  ['room', '/room', 'Join the live meeting'],
  ['daily', '/daily', 'One problem a day'],
  ['ctf', '/arena/ctf', 'Capture the flag puzzles and events'],
  ['data', '/arena/data', 'Datasets to predict, pandas in the browser'],
  ['quant', '/arena/quant', 'Estimation and probability games'],
  ['courses', '/learn', "The club's own lessons"],
  ['puzzles', '/puzzles', 'Problem of the week'],
  ['research', '/research', 'Paper of the month, science fair tracker'],
  ['workspace', '/workspace', 'Your saved code: Python and web pages'],
  ['gateway', '/gateway', 'GitHub on school wifi'],
  ['standings', '/standings', 'Season points, tiers and the prize'],
  ['competitions', '/competitions', 'USACO, UIL, BOT and more'],
  ['opportunities', '/opportunities', 'Contests, programs and internships'],
  ['calendar', '/calendar', 'Meetings and deadlines'],
  ['cyber', '/cyber', 'The cyber team'],
  ['quests', '/quests', 'Small point bonuses'],
  ['pathways', '/pathways', 'Goal plans: USACO, AP CSA, internships'],
  ['compass', '/compass', 'Six questions that pick your path'],
  ['ideas', '/ideas', 'Tell us what to run next'],
  ['alumni', '/alumni', 'Ask graduates a question'],
  ['curriculum', '/curriculum', 'What we teach, by track'],
  ['about', '/about', 'Who runs the club'],
  ['parents', '/parents', 'For parents'],
  ['privacy', '/privacy', 'What we store and why'],
  ['account', '/signin', 'Sign in, your name and privacy'],
];
const ALIAS = { projects: 'build', opps: 'opportunities', comps: 'competitions', lb: 'standings', board: 'practice', arena: 'practice', learn: 'courses', today: 'home', portfolio: 'me', hq: 'officer' };

const CMDS = [
  ['join', 'join <code>', 'Enter a meeting room, for example join ABCD', CalendarCheck],
  ['daily', 'daily', "Today's problem", Lightning],
  ['rank', 'rank <name>', 'Rank, season points and tier', UserCircle],
  ['open', 'open <page>', 'Jump to a page', ArrowRight],
  ['grep', 'grep <text>', 'Search the opportunity board', MagnifyingGlass],
  ['claim', 'claim', 'Claim a competition, a placing or a shipped project', Terminal],
  ['top', 'top', 'The top five this season', Terminal],
  ['prize', 'prize', 'What first place wins', Terminal],
  ['tiers', 'tiers', 'Season tiers and the seven ranks', Terminal],
  ['help', 'help', 'List commands', Terminal],
];
const WANTS_ARG = new Set(['join', 'rank', 'open', 'grep']);

export default function CommandPalette({ open, onOpenChange, isOfficer }) {
  const navigate = useNavigate();
  const { students, settings } = useData();
  const seasonTiers = tiersFrom(settings.season_tiers);
  const prize = settings.prize_title || 'Meta Ray-Ban Display Glasses';
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [out, setOut] = useState(null);
  const listId = useId();
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setOut(null);
      setActive(0);
    }
  }, [open]);

  const go = (to) => {
    onOpenChange(false);
    navigate(to);
  };

  const pagePath = (name) => {
    const n = ALIAS[name] || name;
    if (n === 'officer' || n === 'admin') return isOfficer ? '/hq' : null;
    return PAGES.find((p) => p[0] === n)?.[1] ?? null;
  };

  /** Runs a typed command. Returns nothing when it navigated, else the text to print. */
  const run = (raw) => {
    const s = raw.trim();
    if (!s) return;
    const [c, ...r] = s.split(/\s+/);
    const a = r.join(' ');
    switch (c.toLowerCase()) {
      case 'open':
      case 'cd':
      case 'goto': {
        const to = pagePath(a.toLowerCase());
        return to ? go(to) : setOut(`No page called "${a}". Try: ${PAGES.map((p) => p[0]).join(', ')}`);
      }
      case 'join': {
        const code = a.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        return code ? go(`/room/${code}`) : setOut('Add the room code from the screen, for example join ABCD.');
      }
      case 'daily':
        return go('/daily');
      case 'next':
        return go('/');
      case 'claim':
        return go('/?claim=1');
      case 'grep':
      case 'find':
      case 'search':
        return go(`/opportunities${a ? `?q=${encodeURIComponent(a)}` : ''}`);
      case 'rank': {
        // A6: a member's own numbers, never their place among everyone else.
        const m = a && students.find((x) => x.name.toLowerCase().includes(a.toLowerCase()));
        if (!m) return setOut(`No member matches "${a}".`);
        const ri = tierIndex(m.peak);
        const nx = TIERS[ri + 1];
        const t = tierOf(m.points, seasonTiers);
        return setOut(
          `${m.name}${m.grade ? `, grade ${m.grade}` : ''}\nRank ${TIERS[ri].name}, ${m.lifetime} points all time${nx ? `, ${nx.min - m.peak} to ${nx.name}` : ''}\n${m.points} season points, tier ${t >= 0 ? TIER_NAMES[t] : 'none yet'}`
        );
      }
      case 'top':
        return setOut(students.slice(0, 5).map((m) => `${String(m.place).padStart(2)}  ${m.name.padEnd(16)} ${m.points}`).join('\n') || 'No members yet.');
      case 'prize':
        return setOut(`First place this season wins ${prize}.\nReach ${TIER_NAMES[0]} (${seasonTiers[0]} points) and every season point is a raffle ticket.`);
      case 'tiers':
        return setOut(
          `Season tiers\n${seasonTiers.map((v, k) => `${String(v).padStart(5)}  ${TIER_NAMES[k]}`).join('\n')}\n\nRanks (all time, never drop)\n${TIERS.map((t) => `${String(t.min).padStart(5)}  ${t.name}`).join('\n')}`
        );
      case 'xmas':
      case 'holiday': {
        const v = a === 'on' ? true : a === 'off' ? false : !xmasOn();
        setXmas(v, true);
        return setOut(v ? 'Holiday theme on. Run xmas again to turn it off.' : 'Holiday theme off.');
      }
      case 'help':
      case '?':
        return setOut(CMDS.map(([, k, d]) => `${k.padEnd(14)}${d}`).join('\n'));
      default: {
        const to = pagePath(c.toLowerCase());
        return to && !a ? go(to) : setOut(`"${c}" is not a page or a command. Run help for the list.`);
      }
    }
  };

  const items = useMemo(() => {
    const v = q.trim().toLowerCase();
    const word = v.split(/\s+/)[0];
    const rest = v.slice(word.length).trim();
    const pageItem = (p) => ({ id: `p-${p[0]}`, label: p[0][0].toUpperCase() + p[0].slice(1), hint: p[2], icon: DOORS.find((d) => d.to === p[1])?.icon ?? ArrowRight, act: () => go(p[1]) });

    if (!v) {
      return [
        ...DOORS.map((d) => PAGES.find((p) => p[1] === d.to)).filter(Boolean).map(pageItem),
        ...CMDS.slice(0, 4).map(([k, label, hint, icon]) => ({ id: `c-${k}`, label, hint, icon, mono: true, fill: WANTS_ARG.has(k) ? `${k} ` : null, act: () => run(k) })),
      ];
    }
    if (word === 'open' && /\s/.test(q)) {
      return PAGES.filter((p) => p[0].startsWith(rest)).map(pageItem);
    }
    if (word === 'rank' && /\s/.test(q)) {
      return students
        .filter((m) => m.name.toLowerCase().includes(rest))
        .slice(0, 8)
        .map((m) => ({ id: `r-${m.id}`, label: m.name, hint: `${m.points} season points`, icon: UserCircle, act: () => run(`rank ${m.name}`) }));
    }
    if (WANTS_ARG.has(word) && /\s/.test(q)) {
      const c = CMDS.find((x) => x[0] === word);
      return [{ id: 'run', label: q.trim(), hint: c[2], icon: c[3], mono: true, act: () => run(q) }];
    }
    const cmds = CMDS.filter(([k]) => k.startsWith(word)).map(([k, label, hint, icon]) => ({
      id: `c-${k}`,
      label,
      hint,
      icon,
      mono: true,
      fill: WANTS_ARG.has(k) ? `${k} ` : null,
      act: () => run(k),
    }));
    const pages = PAGES.filter((p) => p[0].includes(v) || p[2].toLowerCase().includes(v) || Object.entries(ALIAS).some(([al, t]) => t === p[0] && al.startsWith(v))).map(pageItem);
    const opps = { id: 'grep', label: `Search opportunities for "${q.trim()}"`, hint: 'Opportunity board', icon: MagnifyingGlass, act: () => run(`grep ${q.trim()}`) };
    return [...pages, ...cmds, opps];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, students]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (it) => {
    if (!it) return run(q);
    if (it.fill) {
      setQ(it.fill);
      return;
    }
    it.act();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(items.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // A full command typed out ("join ABCD") runs as typed.
      const word = q.trim().split(/\s+/)[0]?.toLowerCase();
      if (q.trim().includes(' ') && (WANTS_ARG.has(word) || word === 'xmas') && !(word === 'rank' && items[active])) return run(q);
      choose(items[active]);
    } else if (e.key === 'Tab' && items[active]?.fill) {
      e.preventDefault();
      setQ(items[active].fill);
    }
  };

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="ui-overlay ui-overlay--cmd" />
        <RDialog.Content className="ui-cmd" aria-describedby={undefined}>
          <RDialog.Title className="sr-only">Search and commands</RDialog.Title>
          <div className="ui-cmd__in">
            <MagnifyingGlass size={20} aria-hidden="true" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOut(null);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search pages, or type a command: join ABCD, rank maya"
              aria-label="Search pages or type a command"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={items[active] ? `${listId}-${items[active].id}` : undefined}
              aria-autocomplete="list"
              spellCheck="false"
              autoComplete="off"
            />
            <kbd className="ui-kbd">Esc</kbd>
          </div>
          {out ? (
            <pre className="ui-cmd__out" role="status">{out}</pre>
          ) : (
            <ul className="ui-cmd__list" role="listbox" id={listId} ref={listRef} aria-label="Results">
              {items.map((it, i) => (
                <li
                  key={it.id}
                  id={`${listId}-${it.id}`}
                  role="option"
                  aria-selected={i === active}
                  className={cx('ui-cmd__item', i === active && 'is-on')}
                  onMouseMove={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(it);
                  }}
                >
                  <it.icon size={18} aria-hidden="true" />
                  <span className={cx('ui-cmd__label', it.mono && 'ui-mono')}>{it.label}</span>
                  <span className="ui-cmd__hint">{it.hint}</span>
                </li>
              ))}
              {items.length === 0 && <li className="ui-cmd__none">Nothing matches. Press Enter to run it as a command.</li>}
            </ul>
          )}
          <p className="ui-cmd__foot">
            <span><kbd className="ui-kbd">Enter</kbd> open</span>
            <span><kbd className="ui-kbd">Tab</kbd> complete</span>
            <span><kbd className="ui-kbd">/</kbd> or <kbd className="ui-kbd">Ctrl K</kbd> anywhere</span>
          </p>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

