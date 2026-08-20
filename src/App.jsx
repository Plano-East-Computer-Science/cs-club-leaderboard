import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';

import Leaderboard from './pages/Leaderboard.jsx';
import Student from './pages/Student.jsx';
import Opportunities from './pages/Opportunities.jsx';
import About from './pages/About.jsx';
import Admin from './pages/Admin.jsx';
import { api } from './lib/api.js';

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
  { to: '/about', label: 'About' },
];

function Masthead({ settings }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ background: 'color-mix(in srgb, var(--paper) 88%, transparent)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="group flex items-baseline gap-2 no-underline">
          <span
            className="mono rounded px-1.5 py-0.5 text-xs font-bold"
            style={{ background: 'var(--flag)', color: 'light-dark(#fff, #0d1017)' }}
          >
            #
          </span>
          <span className="display text-[0.95rem] font-extrabold" style={{ color: 'var(--ink)' }}>
            {settings.club_name || 'CS Club'}
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className="mono rounded px-3 py-1.5 text-xs font-semibold no-underline transition-colors"
              style={({ isActive }) => ({
                color: isActive ? 'var(--ink)' : 'var(--ink-faint)',
                background: isActive ? 'var(--paper-2)' : 'transparent',
              })}
            >
              {n.label}
            </NavLink>
          ))}
          <Link
            to="/admin"
            className="mono ml-2 rounded border px-3 py-1.5 text-xs font-semibold no-underline"
            style={{ color: 'var(--ink-soft)', borderColor: 'var(--rule)' }}
          >
            Admin
          </Link>
        </nav>

        <button
          className="btn btn-ghost ml-auto sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <nav className="grid gap-1 border-t px-4 py-3 sm:hidden">
          {[...NAV, { to: '/admin', label: 'Admin' }].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className="mono rounded px-3 py-2 text-sm font-semibold no-underline"
              style={({ isActive }) => ({
                color: isActive ? 'var(--ink)' : 'var(--ink-soft)',
                background: isActive ? 'var(--paper-2)' : 'transparent',
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

function Footer({ settings }) {
  return (
    <footer className="mt-20 border-t">
      <div
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 sm:px-6"
        style={{ color: 'var(--ink-faint)' }}
      >
        <p className="mono text-xs">
          {settings.school_name || 'Plano East Senior High School'}
        </p>
        <p className="mono text-xs">Points update whenever an officer awards them.</p>
        {settings.discord_url && (
          <a
            className="mono text-xs no-underline"
            style={{ color: 'var(--flag)' }}
            href={settings.discord_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            Discord
          </a>
        )}
        {settings.email && (
          <a className="mono text-xs no-underline" style={{ color: 'var(--flag)' }} href={`mailto:${settings.email}`}>
            {settings.email}
          </a>
        )}
      </div>
    </footer>
  );
}

function Shell() {
  const settings = useSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <Masthead settings={settings} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Routes>
          <Route path="/" element={<Leaderboard settings={settings} />} />
          <Route path="/student/:id" element={<Student />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/about" element={<About settings={settings} />} />
          <Route path="/admin" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="py-24 text-center">
                <p className="display text-3xl font-extrabold">Nothing here</p>
                <Link className="mono mt-4 inline-block text-sm" style={{ color: 'var(--flag)' }} to="/">
                  Back to the standings
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer settings={settings} />
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
