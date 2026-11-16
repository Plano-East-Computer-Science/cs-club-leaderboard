import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu } from 'lucide-react';

import Leaderboard from './pages/Leaderboard.jsx';
import Student from './pages/Student.jsx';
import Opportunities from './pages/Opportunities.jsx';
import CalendarPage from './pages/Calendar.jsx';
import Curriculum from './pages/Curriculum.jsx';
import Competitions from './pages/Competitions.jsx';
import Puzzles from './pages/Puzzles.jsx';
import Cyber from './pages/Cyber.jsx';
import Join from './pages/Join.jsx';
import About from './pages/About.jsx';
import Admin from './pages/Admin.jsx';
import { api } from './lib/api.js';
import { SubscribeBox } from './components/Subscribe.jsx';
import { Toaster } from '@/components/ui/sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const SiteContext = { settings: {} };

function useSettings() {
  const [settings, setSettings] = useState(SiteContext.settings);
  useEffect(() => {
    api
      .get('/site')
      .then((d) => {
        SiteContext.settings = d.settings;
        setSettings(d.settings);
      })
      .catch(() => {});
  }, []);
  return settings;
}

const NAV = [
  { to: '/', label: 'Standings', end: true },
  { to: '/opportunities', label: 'Opportunities' },
];
const CLUB = [
  { to: '/curriculum', label: 'Curriculum', blurb: 'What we teach, fall and spring' },
  { to: '/competitions', label: 'Competitions', blurb: 'Where we compete and how we did' },
  { to: '/cyber', label: 'Cybersecurity', blurb: 'The CTF and systems committee' },
  { to: '/puzzles', label: 'Problem of the Week', blurb: 'One puzzle every meeting' },
];
const TAIL = [{ to: '/about', label: 'About' }];

const linkClass =
  'mono rounded-md px-2.5 py-1.5 text-[0.8rem] font-semibold no-underline transition-colors';
const linkStyle = (active) => ({
  color: active ? 'var(--ink)' : 'var(--ink-soft)',
  background: active ? 'var(--paper-2)' : 'transparent',
});

function ClubMenu({ pathname }) {
  const active = CLUB.some((c) => pathname.startsWith(c.to));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`${linkClass} inline-flex items-center gap-1`}
        style={linkStyle(active)}
        aria-current={active ? 'page' : undefined}
      >
        Club
        <ChevronDown size={14} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-64 p-1.5">
        {CLUB.map((c) => (
          <DropdownMenuItem key={c.to} asChild className="cursor-pointer rounded-md px-3 py-2">
            <NavLink to={c.to} className="grid gap-0.5 no-underline">
              <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {c.label}
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                {c.blurb}
              </span>
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu({ settings, pathname }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const all = [...NAV, ...CLUB, ...TAIL, { to: '/join', label: 'Join' }];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="btn btn-ghost" aria-label="Open menu">
        <Menu size={16} aria-hidden="true" />
        Menu
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(20rem,90vw)] gap-0 p-0"
        style={{ background: 'var(--paper)' }}
      >
        <SheetTitle
          className="display border-b px-5 py-4 text-base font-extrabold"
          style={{ color: 'var(--ink)' }}
        >
          {settings.club_name || 'CS Club'}
        </SheetTitle>
        <nav className="grid p-2" aria-label="Site">
          {all.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className="display rounded-md px-3 py-2.5 text-lg font-bold no-underline"
              style={({ isActive }) => ({
                color: isActive ? 'var(--flag)' : 'var(--ink)',
                background: isActive ? 'var(--flag-soft)' : 'transparent',
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function Masthead({ settings }) {
  const { pathname } = useLocation();

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ background: 'color-mix(in srgb, var(--paper) 88%, transparent)' }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <span
            className="mono grid h-7 w-7 place-items-center rounded-md text-sm font-bold"
            style={{ background: 'var(--flag)', color: 'var(--on-flag)' }}
            aria-hidden="true"
          >
            #
          </span>
          <span className="display text-[0.95rem] font-extrabold" style={{ color: 'var(--ink)' }}>
            {settings.club_name || 'CS Club'}
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Site">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={linkClass}
              style={({ isActive }) => linkStyle(isActive)}
            >
              {n.label}
            </NavLink>
          ))}
          <ClubMenu pathname={pathname} />
          {TAIL.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={linkClass}
              style={({ isActive }) => linkStyle(isActive)}
            >
              {n.label}
            </NavLink>
          ))}
          <Link to="/join" className="btn btn-primary ml-2">
            Join
          </Link>
        </nav>

        <div className="ml-auto md:hidden">
          <MobileMenu settings={settings} pathname={pathname} />
        </div>
      </div>
    </header>
  );
}

function Footer({ settings }) {
  const links = [
    { to: '/calendar', label: 'Calendar' },
    { to: '/join', label: 'Join' },
    { to: '/admin', label: 'Officer admin' },
  ];
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1.4fr]">
        <div>
          <p className="display text-base font-extrabold" style={{ color: 'var(--ink)' }}>
            {settings.club_name || 'CS Club'}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            {settings.school_name || 'Plano East Senior High School'}
          </p>
          <p className="mt-3 text-xs" style={{ color: 'var(--ink-faint)' }}>
            Points update whenever an officer awards them.
          </p>
        </div>

        <nav className="grid content-start gap-1.5 text-sm" aria-label="Footer">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="no-underline hover:underline"
              style={{ color: 'var(--ink-soft)' }}
            >
              {l.label}
            </Link>
          ))}
          {settings.discord_url && (
            <a
              className="no-underline hover:underline"
              style={{ color: 'var(--flag)' }}
              href={settings.discord_url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Discord
            </a>
          )}
          {settings.email && (
            <a
              className="no-underline hover:underline"
              style={{ color: 'var(--flag)' }}
              href={`mailto:${settings.email}`}
            >
              {settings.email}
            </a>
          )}
        </nav>

        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Weekly email
          </p>
          <p className="mt-1 mb-3 text-xs" style={{ color: 'var(--ink-faint)' }}>
            Points, new opportunities, and deadlines, once a week. Use a personal address, not a
            school one.
          </p>
          <SubscribeBox id="footer-subscribe" />
        </div>
      </div>
    </footer>
  );
}

function Shell() {
  const settings = useSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <Masthead settings={settings} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Routes>
          <Route path="/" element={<Leaderboard settings={settings} />} />
          <Route path="/student/:id" element={<Student />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/calendar" element={<CalendarPage settings={settings} />} />
          <Route path="/curriculum" element={<Curriculum />} />
          <Route path="/competitions" element={<Competitions />} />
          <Route path="/puzzles" element={<Puzzles />} />
          <Route path="/join" element={<Join settings={settings} />} />
          <Route path="/about" element={<About settings={settings} />} />
          <Route path="/cyber" element={<Cyber settings={settings} />} />
          <Route path="/admin" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="py-24 text-center">
                <p className="display text-3xl font-extrabold">Nothing here</p>
                <Link
                  className="mono mt-4 inline-block text-sm"
                  style={{ color: 'var(--flag)' }}
                  to="/"
                >
                  Back to the standings
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer settings={settings} />
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
