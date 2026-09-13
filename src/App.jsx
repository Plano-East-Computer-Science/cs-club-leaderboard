import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';

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
import SignIn, { SignInPrompt } from './pages/SignIn.jsx';
import { api } from './lib/api.js';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { Spinner } from './components/bits.jsx';

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

/**
 * Stands in front of a members-only page. The Worker refuses these routes
 * outright; this only decides whether to show the page or the reason.
 */
function Gate({ what, children }) {
  const { loading, authed } = useAuth();
  if (loading) return <Spinner label="Checking your sign-in" />;
  if (!authed) return <SignInPrompt what={what} />;
  return children;
}

const NAV = [
  { to: '/', label: 'Standings', end: true },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/curriculum', label: 'Curriculum' },
  { to: '/competitions', label: 'Competitions' },
  { to: '/cyber', label: 'Cyber' },
  { to: '/puzzles', label: 'Puzzles' },
  { to: '/about', label: 'About' },
  { to: '/join', label: 'Join' },
];

/** "Sign in" or "Account", depending. Same slot either way. */
function AccountLink({ className }) {
  const { authed } = useAuth();
  return (
    <Link
      to="/signin"
      className={className}
      style={{ color: 'var(--ink-soft)', borderColor: 'var(--rule)' }}
    >
      {authed ? 'Account' : 'Sign in'}
    </Link>
  );
}

function Masthead({ settings }) {
  const [open, setOpen] = useState(false);
  const { authed: signedIn } = useAuth();
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

        {/* Seven public routes plus Admin no longer fit comfortably at the old
            "sm" breakpoint, so the horizontal bar only takes over at "lg" --
            everything narrower than that gets the hamburger menu below,
            which was already built to show the full NAV list. */}
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className="mono rounded px-2.5 py-1.5 text-xs font-semibold no-underline transition-colors"
              style={({ isActive }) => ({
                color: isActive ? 'var(--ink)' : 'var(--ink-faint)',
                background: isActive ? 'var(--paper-2)' : 'transparent',
              })}
            >
              {n.label}
            </NavLink>
          ))}
          <AccountLink className="mono ml-2 rounded border px-3 py-1.5 text-xs font-semibold no-underline" />
          <Link
            to="/admin"
            className="mono rounded border px-3 py-1.5 text-xs font-semibold no-underline"
            style={{ color: 'var(--ink-soft)', borderColor: 'var(--rule)' }}
          >
            Admin
          </Link>
        </nav>

        {/* `.btn` sets display: inline-flex unconditionally, which beats a
            same-specificity `lg:hidden` on the button itself at the widths
            where it should disappear -- CSS gives the later-in-stylesheet
            rule the win once both are "in effect", regardless of the media
            query. Putting the responsive visibility on a plain wrapper with
            no competing display rule sidesteps the fight entirely. */}
        <span className="ml-auto lg:hidden">
          <button
            className="btn btn-ghost"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Menu"
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </span>
      </div>

      {open && (
        <nav className="grid gap-1 border-t px-4 py-3 lg:hidden">
          {[...NAV, { to: '/signin', label: signedIn ? 'Account' : 'Sign in' }, { to: '/admin', label: 'Admin' }].map((n) => (
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
          <Route
            path="/"
            element={
              <Gate what="the standings">
                <Leaderboard settings={settings} />
              </Gate>
            }
          />
          <Route
            path="/student/:id"
            element={
              <Gate what="member profiles">
                <Student />
              </Gate>
            }
          />
          <Route
            path="/opportunities"
            element={
              <Gate what="the opportunity board">
                <Opportunities />
              </Gate>
            }
          />
          <Route
            path="/calendar"
            element={
              <Gate what="the calendar">
                <CalendarPage settings={settings} />
              </Gate>
            }
          />
          <Route path="/curriculum" element={<Curriculum />} />
          <Route path="/competitions" element={<Competitions />} />
          <Route
            path="/puzzles"
            element={
              <Gate what="Problem of the Week">
                <Puzzles />
              </Gate>
            }
          />
          <Route path="/join" element={<Join settings={settings} />} />
          <Route path="/about" element={<About settings={settings} />} />
          <Route path="/cyber" element={<Cyber settings={settings} />} />
          <Route path="/signin" element={<SignIn />} />
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
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
