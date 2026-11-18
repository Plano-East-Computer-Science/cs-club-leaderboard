import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';

import Home from './pages/Home.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Student from './pages/Student.jsx';
import Opportunities from './pages/Opportunities.jsx';
import CalendarPage from './pages/Calendar.jsx';
import Curriculum from './pages/Curriculum.jsx';
import Competitions from './pages/Competitions.jsx';
import Competition from './pages/Competition.jsx';
import Puzzles from './pages/Puzzles.jsx';
import Cyber from './pages/Cyber.jsx';
import Join from './pages/Join.jsx';
import About from './pages/About.jsx';
import Admin from './pages/Admin.jsx';
import Learn from './pages/Learn.jsx';
import Course from './pages/Course.jsx';
import Arena from './pages/Arena.jsx';
import DataArena from './pages/DataArena.jsx';
import DataChallenge from './pages/DataChallenge.jsx';
import Problem from './pages/Problem.jsx';
import SignIn from './pages/SignIn.jsx';
import Room from './pages/Room.jsx';
import Host from './pages/Host.jsx';
import Officer from './pages/Officer.jsx';
import Gateway from './pages/Gateway.jsx';
import Build from './pages/Build.jsx';
import Starter from './pages/Starter.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Quests from './pages/Quests.jsx';
import Ideas from './pages/Ideas.jsx';
import Daily from './pages/Daily.jsx';
import Compass from './pages/Compass.jsx';
import Privacy from './pages/Privacy.jsx';
import Parents from './pages/Parents.jsx';
import Verify from './pages/Verify.jsx';
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
  if (pathname.startsWith('/student')) return 'standings';
  return pathname.split('/')[1] || 'home';
}

/** Frame for the club-hub pages: site width, padding, terminal-style headings. */
function HubLayout() {
  return (
    <div className="hub">
      <Outlet />
    </div>
  );
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
            <Link to="/privacy">privacy</Link>
            <Link to="/parents">for parents</Link>
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

  // The projector page is full-screen, no site chrome.
  if (pathname.startsWith('/host/')) {
    return (
      <Routes>
        <Route path="/host/:code" element={<div className="hub"><Host /></div>} />
      </Routes>
    );
  }

  return (
    <>
      <TabBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/standings" element={<Leaderboard />} />
          <Route path="/student/:id" element={<Student />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/curriculum" element={<Curriculum />} />
          <Route path="/competitions" element={<Competitions />} />
          <Route path="/competitions/:id" element={<Competition />} />
          <Route path="/puzzles" element={<Puzzles />} />
          <Route path="/join" element={<Join />} />
          <Route path="/about" element={<About />} />
          <Route path="/cyber" element={<Cyber />} />
          <Route path="/quests" element={<Quests />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/arena" element={<Arena />} />
          <Route path="/arena/data" element={<DataArena />} />
          <Route path="/arena/data/:id" element={<DataChallenge />} />
          <Route path="/compass" element={<Compass />} />
          <Route path="/build" element={<Build />} />
          <Route path="/build/start/:slug" element={<Starter />} />
          <Route element={<HubLayout />}>
            <Route path="/p/:slug" element={<Problem />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/learn/:slug" element={<Course />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/room" element={<Room />} />
            <Route path="/room/:code" element={<Room />} />
            <Route path="/officer" element={<Officer />} />
            <Route path="/gateway" element={<Gateway />} />
            <Route path="/projects" element={<Navigate to="/build" replace />} />
            <Route path="/u/:id" element={<Portfolio />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/parents" element={<Parents />} />
            <Route path="/verify/:code" element={<Verify />} />
          </Route>
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
