/**
 * Officer HQ (Wave 5, v2-spec section 3). Replaces the 40-link officer console
 * with eight areas: Home, Meetings, Inbox and Members every week; Library,
 * Announce, Season and Settings when needed. The URL holds the area and the
 * sub-screen (/hq/inbox?kind=claims, /hq/members/123). The guard is the same
 * as before: an officer account, or the shared password as break-glass.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Gauge,
  CalendarBlank,
  Tray,
  UsersThree,
  Books,
  Megaphone,
  Trophy,
  GearSix,
  SignOut,
  SidebarSimple,
} from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { initials } from '../../lib/format.js';
import { SkeletonList, Tip } from '../../ui/index.js';
import { HqCtx } from './bits.jsx';
import { Login } from './legacy.jsx';
import Home from './Home.jsx';
import Meetings from './Meetings.jsx';
import Inbox from './Inbox.jsx';
import Members from './Members.jsx';
import { Library, Announce, Season, Settings } from './Areas.jsx';
import './hq.css';

const PRIMARY = [
  { to: '/hq', label: 'Home', icon: Gauge, end: true },
  { to: '/hq/meetings', label: 'Meetings', icon: CalendarBlank },
  { to: '/hq/inbox', label: 'Inbox', icon: Tray, count: true },
  { to: '/hq/members', label: 'Members', icon: UsersThree },
];
const SECONDARY = [
  { to: '/hq/library', label: 'Library', icon: Books },
  { to: '/hq/announce', label: 'Announce', icon: Megaphone },
  { to: '/hq/season', label: 'Season', icon: Trophy },
  { to: '/hq/settings', label: 'Settings', icon: GearSix },
];
const AREAS = [...PRIMARY, ...SECONDARY];
const COLLAPSE_KEY = 'hq-side-collapsed';

const areaOf = (pathname) => [...AREAS].reverse().find((a) => (a.end ? pathname === a.to || pathname === `${a.to}/` : pathname.startsWith(a.to))) ?? AREAS[0];

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function NavItem({ item, total, collapsed }) {
  const link = (
    <NavLink to={item.to} end={item.end} className="hq-link" aria-label={collapsed ? `${item.label}${total ? `, ${total} waiting` : ''}` : undefined}>
      <item.icon size={20} aria-hidden="true" />
      <span className="hq-link__t">{item.label}</span>
      {item.count && total > 0 && (
        <span className="hq-count" aria-label={`${total} waiting`}>
          {total > 99 ? '99+' : total}
        </span>
      )}
    </NavLink>
  );
  return collapsed ? <Tip label={item.label} side="right">{link}</Tip> : link;
}

export default function Hq() {
  const [session, setSession] = useState(null);
  const [counts, setCounts] = useState({ total: 0 });
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const check = useCallback(() => {
    api.get('/admin/session').then(setSession).catch(() => setSession({ authed: false }));
  }, []);
  useEffect(check, [check]);

  const refreshCounts = useCallback(() => {
    api
      .get('/admin/hub/inbox')
      .then((d) => setCounts({ ...d.counts, total: d.total }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (session?.authed) refreshCounts();
  }, [session?.authed, refreshCounts]);

  const toggle = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      } catch {
        /* private mode: the choice lasts this visit */
      }
      return !v;
    });

  const ctx = useMemo(
    () => ({ officer: session?.officer ?? null, actionsUrl: session?.actions_url ?? '', counts, refreshCounts }),
    [session, counts, refreshCounts]
  );

  if (session === null) {
    return (
      <div className="ui-page">
        <SkeletonList rows={5} label="Checking your officer session" />
      </div>
    );
  }
  if (!session.authed) {
    return (
      <div className="hub">
        <Login user={session.user} onIn={check} />
      </div>
    );
  }

  const { officer } = session;
  const signOut = async () => {
    await api.post('/admin/logout').catch(() => {});
    if (officer.userId) await api.post('/auth/logout').catch(() => {});
    check();
  };
  const area = areaOf(pathname);

  return (
    <HqCtx.Provider value={ctx}>
      <div className="hq" data-collapsed={collapsed}>
        <aside className="hq-side" aria-label="Officer HQ">
          <div className="hq-side__who">
            <span className="ui-av ui-av--gold" aria-hidden="true">{initials(officer.name) || 'HQ'}</span>
            <p>
              <span className="hq-side__name">{officer.name}</span>
              <span className="hq-side__role">{officer.userId ? officer.role : 'Shared password'}</span>
            </p>
          </div>
          <nav className="hq-nav" aria-label="Weekly">
            {PRIMARY.map((i) => <NavItem key={i.to} item={i} total={counts.total} collapsed={collapsed} />)}
          </nav>
          <nav className="hq-nav" aria-label="More">
            {SECONDARY.map((i) => <NavItem key={i.to} item={i} collapsed={collapsed} />)}
          </nav>
          <div className="hq-side__foot">
            <button type="button" className="hq-side__btn" onClick={toggle} aria-pressed={collapsed} aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}>
              <SidebarSimple size={20} aria-hidden="true" />
              <span>Collapse</span>
            </button>
            <button type="button" className="hq-side__btn" onClick={signOut}>
              <SignOut size={20} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <label className="hq-pick">
          <span className="hq-pick__l">HQ</span>
          <select className="ui-input" value={area.to} onChange={(e) => navigate(e.target.value)} aria-label="HQ area">
            {AREAS.map((a) => (
              <option key={a.to} value={a.to}>
                {a.label}
                {a.count && counts.total ? ` (${counts.total})` : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="hq-main ui-enter" key={area.to}>
          <Routes>
            <Route index element={<Home />} />
            <Route path="meetings/*" element={<Meetings />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="members" element={<Members />} />
            <Route path="members/:id" element={<Members />} />
            <Route path="library/*" element={<Library />} />
            <Route path="announce" element={<Announce />} />
            <Route path="season/*" element={<Season />} />
            <Route path="settings/*" element={<Settings />} />
            <Route path="*" element={<Navigate to="/hq" replace />} />
          </Routes>
        </div>
      </div>
    </HqCtx.Provider>
  );
}
