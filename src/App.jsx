import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

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
import { SubscribeBox } from './components/Subscribe.jsx';
import { TabBar, Dock, Boot, Snow, PAGES } from './components/Chrome.jsx';
import { DataProvider, useData } from './lib/data.jsx';

document.documentElement.classList.add('js');

// Spotlight border: any `.sp` element follows the pointer.
window.addEventListener(
  'pointermove',
  (e) => {
    const t = e.target.closest?.('.sp');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', `${e.clientX - r.left}px`);
    t.style.setProperty('--my', `${e.clientY - r.top}px`);
  },
  { passive: true }
);

/** The mockup's CSS keys a few layouts off body[data-page]. */
function pageKey(pathname) {
  if (pathname === '/' || pathname.startsWith('/student')) return 'standings';
  return pathname.split('/')[1] || 'standings';
}

function Footer() {
  const { settings } = useData();
  return (
    <footer>
      <div className="wrap">
        <div className="fg">
          <div>
            <h2>Get the weekly digest</h2>
            <p className="d" style={{ marginTop: 8, maxWidth: '50ch' }}>
              New opportunities, deadlines, the problem of the week and the standings, once a week. Use a
              personal address, not a school one. Confirm by email to subscribe.
            </p>
            <SubscribeBox />
          </div>
          <div className="links">
            {PAGES.filter(([n]) => n !== 'admin').map(([n, to]) => (
              <Link key={n} to={to}>
                {n}
              </Link>
            ))}
            {settings.discord_url && (
              <a href={settings.discord_url} target="_blank" rel="noreferrer noopener">
                discord
              </a>
            )}
            {settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}
          </div>
        </div>
        <p className="fine">
          {settings.school_name || 'Plano East Senior High School'}. Go Panthers.
          Points update whenever an officer awards them.
        </p>
      </div>
    </footer>
  );
}

function Shell() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.body.dataset.page = pageKey(pathname);
    if (!location.hash) window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <TabBar />
      <main>
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/student/:id" element={<Student />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/curriculum" element={<Curriculum />} />
          <Route path="/competitions" element={<Competitions />} />
          <Route path="/puzzles" element={<Puzzles />} />
          <Route path="/join" element={<Join />} />
          <Route path="/about" element={<About />} />
          <Route path="/cyber" element={<Cyber />} />
          <Route
            path="/admin"
            element={<Admin />}
          />
          <Route
            path="*"
            element={
              <div className="state-note">
                <p className="display" style={{ fontSize: 40, color: 'var(--text)' }}>
                  Nothing here
                </p>
                <Link className="g uline" to="/">
                  cd ../standings
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      {pathname.startsWith('/admin') ? null : <Footer />}
      <Dock />
      <Boot />
      <Snow />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <Shell />
      </DataProvider>
    </BrowserRouter>
  );
}
