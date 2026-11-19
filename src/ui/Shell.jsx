/**
 * The app shell (Wave 4): top bar with the five doors, the Live pill, search,
 * HQ for officers and the account menu; bottom tabs on phones; a slim footer.
 * Replaces the tmux tab bar, the "ls all" panel, the status line and the
 * footer site map. Every route renders inside it.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as RTooltip from '@radix-ui/react-tooltip';
import { MagnifyingGlass, Gauge, UserCircle, GearSix, SignOut, Files } from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { useData } from '../lib/data.jsx';
import { initials } from '../lib/format.js';
import { SubscribeBox } from '../components/Subscribe.jsx';
import { DOORS } from './doors.js';
import { Button, cx } from './primitives.jsx';
import { Menu, ToastProvider } from './overlays.jsx';
import CommandPalette from './CommandPalette.jsx';

/* -------------------------------- session -------------------------------- */

const SessionCtx = createContext({ user: null, live: null, loading: true, refresh: () => {} });
export const useSession = () => useContext(SessionCtx);

/**
 * Who is signed in and whether a room is live. Re-read on every page change
 * (cheap, and keeps the account chip honest after signing in or out) and when
 * the tab comes back into focus, so the Live pill appears without a reload.
 */
function useSessionState() {
  const { pathname } = useLocation();
  const [s, setS] = useState({ user: null, live: null, loading: true });
  const refresh = useCallback(async () => {
    const user = await api.get('/me').then((r) => r.user).catch(() => null);
    const live = user ? await api.get('/me/live').then((r) => r.live).catch(() => null) : null;
    setS({ user, live, loading: false });
  }, []);
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);
  useEffect(() => {
    const f = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [refresh]);
  return { ...s, refresh };
}

/* ---------------------------------- bits ---------------------------------- */

/** The club mark (the existing panther-ear glyph) and wordmark. */
function Brand() {
  return (
    <Link to="/" className="ui-brand" aria-label="Plano East CS Club, home">
      <span className="ui-brand__mark" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 1l3 3h6l3-3v7l-2 2 1 5-4-2h-2l-4 2 1-5-2-2z" />
        </svg>
      </span>
      <span className="ui-brand__word">Plano East CS</span>
    </Link>
  );
}

/** Green, gently pulsing, one tap to the room. The only decorative dot allowed: it is real state. */
export function LivePill({ live, className }) {
  if (!live) return null;
  return (
    <Link to={`/room/${live.code}`} className={cx('ui-live', className)} aria-label={`Live now: ${live.title || 'meeting'}. Open the room`}>
      <i className="ui-live__dot" aria-hidden="true" />
      <span className="ui-live__k">Live</span>
      <span className="ui-live__t">{live.title || 'Meeting'}</span>
    </Link>
  );
}

function AccountMenu({ user, onSignOut }) {
  const first = (user.name || '').split(' ')[0] || 'Account';
  return (
    <Menu
      label="Account"
      trigger={
        <button type="button" className="ui-avbtn" aria-label={`Account menu for ${user.name}`}>
          <span className="ui-av ui-av--gold" aria-hidden="true">{initials(user.name) || '?'}</span>
          <span className="ui-avbtn__n">{first}</span>
        </button>
      }
      items={[
        { heading: user.email },
        { label: 'Your portfolio', icon: UserCircle, to: '/me' },
        { label: 'Points record', icon: Files, to: user.student_id ? `/student/${user.student_id}` : '/me' },
        { label: 'Account', icon: GearSix, to: '/signin' },
        { separator: true },
        { label: 'Sign out', icon: SignOut, onSelect: onSignOut },
      ]}
    />
  );
}

const isOfficerRole = (u) => u?.role === 'officer' || u?.role === 'lead';

/* --------------------------------- TopBar --------------------------------- */

export function TopBar({ onSearch }) {
  const { user, live, refresh } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const signOut = async () => {
    await api.post('/auth/logout').catch(() => {});
    await refresh();
    navigate('/');
  };
  return (
    <header className="ui-top">
      <div className="ui-top__in">
        <Brand />
        <nav className="ui-doors" aria-label="Main">
          {DOORS.map((d) => {
            const on = d.match(pathname);
            return (
              <Link key={d.id} to={d.to} className="ui-door" aria-current={on ? 'page' : undefined}>
                <d.icon size={20} weight={on ? 'fill' : 'regular'} aria-hidden="true" />
                <span>{d.id === 'today' && !user ? 'Home' : d.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ui-top__end">
          <LivePill live={live} />
          <button type="button" className="ui-search" onClick={onSearch} aria-label="Search and commands (Ctrl K)" aria-keyshortcuts="Control+K /">
            <MagnifyingGlass size={18} aria-hidden="true" />
            <span className="ui-search__t">Search</span>
            <kbd className="ui-kbd ui-search__k">Ctrl K</kbd>
          </button>
          {isOfficerRole(user) && (
            <NavLink to="/hq" className="ui-hq" aria-label="HQ, officer tools">
              <Gauge size={20} aria-hidden="true" />
              <span>HQ</span>
            </NavLink>
          )}
          {user ? (
            <AccountMenu user={user} onSignOut={signOut} />
          ) : pathname === '/' || pathname === '/signin' ? null : (
            // The front door already carries "Sign in" next to its one primary button.
            <Button to="/signin" variant="secondary" className="ui-top__signin">Sign in</Button>
          )}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------- BottomTabs -------------------------------- */

export function BottomTabs() {
  const { pathname } = useLocation();
  const { user } = useSession();
  return (
    <nav className="ui-tabbar" aria-label="Main">
      {DOORS.map((d) => {
        const on = d.match(pathname);
        return (
          <Link key={d.id} to={d.to} className="ui-tabbar__i" aria-current={on ? 'page' : undefined}>
            <d.icon size={22} weight={on ? 'fill' : 'regular'} aria-hidden="true" />
            <span>{d.id === 'today' && !user ? 'Home' : d.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* --------------------------------- Footer --------------------------------- */

function Footer() {
  const { settings } = useData();
  return (
    <footer className="ui-foot">
      <div className="ui-foot__in">
        <div className="ui-foot__digest">
          <h2 className="ui-heading">Get the weekly digest</h2>
          <p className="ui-small">Opportunities, deadlines and the standings, once a week. Use a personal address.</p>
          <SubscribeBox />
        </div>
        <div className="ui-foot__links">
          <Link to="/about">About the club</Link>
          <Link to="/parents">For parents</Link>
          <Link to="/privacy">Privacy</Link>
          {settings.discord_url && (
            <a href={settings.discord_url} target="_blank" rel="noreferrer noopener">Discord</a>
          )}
          {settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}
        </div>
        <p className="ui-foot__fine">{settings.school_name || 'Plano East Senior High School'}. Go Panthers.</p>
      </div>
    </footer>
  );
}

/* --------------------------------- AppShell --------------------------------- */

const typing = (el) => el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

/** Top bar, page, footer, bottom tabs, and the palette on Ctrl+K or "/". */
export function AppShell({ children, footer = true }) {
  const session = useSessionState();
  const [cmd, setCmd] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmd((v) => !v);
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(document.activeElement)) {
        e.preventDefault();
        setCmd(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SessionCtx.Provider value={session}>
      <ToastProvider>
        <RTooltip.Provider>
          <a className="ui-skip" href="#main">Skip to content</a>
          <TopBar onSearch={() => setCmd(true)} />
          <main id="main" tabIndex={-1} className="ui-main">
            {children}
          </main>
          {footer && <Footer />}
          <BottomTabs />
          <CommandPalette open={cmd} onOpenChange={setCmd} isOfficer={isOfficerRole(session.user)} />
        </RTooltip.Provider>
      </ToastProvider>
    </SessionCtx.Provider>
  );
}
