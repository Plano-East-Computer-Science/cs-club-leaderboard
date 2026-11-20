import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';

import Home from './next/home/Home.jsx';
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
import Learn from './pages/Learn.jsx';
import Course from './pages/Course.jsx';
import Arena from './pages/Arena.jsx';
import Workspace from './pages/Workspace.jsx';
import Reviews from './pages/Reviews.jsx';
import Ctf from './pages/Ctf.jsx';
import DataArena from './pages/DataArena.jsx';
import Quant from './pages/Quant.jsx';
import DataChallenge from './pages/DataChallenge.jsx';
import Problem from './pages/Problem.jsx';
import SignIn from './pages/SignIn.jsx';
import Room from './pages/Room.jsx';
import Host from './pages/Host.jsx';
import SpeakerLink from './pages/live/SpeakerLink.jsx';
import Recap from './pages/live/Recap.jsx';
import Gateway from './pages/Gateway.jsx';
import Reader from './pages/Reader.jsx';
import Build from './pages/Build.jsx';
import Starter from './pages/Starter.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Quests from './pages/Quests.jsx';
import Ideas from './pages/Ideas.jsx';
import Daily from './pages/Daily.jsx';
import Compass from './pages/Compass.jsx';
import Pathways, { Pathway } from './pages/Pathways.jsx';
import Privacy from './pages/Privacy.jsx';
import Parents from './pages/Parents.jsx';
import Archive from './pages/Archive.jsx';
import OfficerApply from './pages/OfficerApply.jsx';
import Verify from './pages/Verify.jsx';
import Research from './pages/Research.jsx';
import Alumni from './pages/Alumni.jsx';
import Me, { MePoints } from './pages/Me.jsx';
import { DoorLayout } from './next/DoorTabs.jsx';
import Soon from './next/pages/Soon.jsx';
import Meetings from './next/club/Meetings.jsx';
import Kit from './next/club/Kit.jsx';
import Playbook from './next/club/Playbook.jsx';
import AskDock from './next/ask/Ask.jsx';
import { DataProvider } from './lib/data.jsx';
import { AppShell, EmptyState, Button, SkeletonList } from './ui/index.js';
import { oldOfficerTarget } from '../shared/hq.js';

// V3-C: try-it page for the editor; lazy so the editor bundle stays off other pages.
const EditorLab = lazy(() => import('./pages/EditorLab.jsx'));
// Wave 5: Officer HQ. Lazy, so members never download the officer screens.
const Hq = lazy(() => import('./pages/hq/Hq.jsx'));

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
  if (pathname.startsWith('/student') || pathname === '/compete') return 'standings';
  if (pathname === '/practice') return 'arena';
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

/** An old address that now lives somewhere else; keeps the query and hash. */
function Moved({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

/** /officer?s=<old screen id> to its place in Officer HQ. */
function OldOfficer() {
  const { search } = useLocation();
  return <Navigate to={oldOfficerTarget(search)} replace />;
}

function NotFound() {
  return (
    <div className="ui-page">
      <EmptyState action={<Button to="/" variant="secondary">Back to Today</Button>}>There is no page at this address.</EmptyState>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.body.dataset.page = pageKey(pathname);
    if (!location.hash) window.scrollTo(0, 0);
  }, [pathname]);

  // Projectors wash out light themes: the projector screen is always the blueprint (dark) theme.
  const projector = /^\/host\/[^/]+\/screen/.test(pathname);
  useEffect(() => {
    if (!projector) return;
    const root = document.documentElement;
    const before = root.dataset.theme;
    root.dataset.theme = 'dark';
    return () => {
      if (before) root.dataset.theme = before;
      else delete root.dataset.theme;
    };
  }, [projector]);

  // The projector page is full-screen, no site chrome. So are the moderator phone and the speaker's link (Wave 6).
  if (pathname.startsWith('/host/') || pathname.startsWith('/speaker/')) {
    return (
      <Routes>
        <Route path="/host/:code" element={<div className="hub"><Host /></div>} />
        <Route path="/host/:code/screen" element={<div className="hub"><Host screen /></div>} />
        <Route path="/host/:code/mod" element={<div className="hub"><Host mod /></div>} />
        <Route path="/speaker/:code/:token" element={<SpeakerLink />} />
      </Routes>
    );
  }

  return (
    <>
      <AppShell footer={!/^\/(admin|officer|hq|signin)/.test(pathname)}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Soon title="Play" />} />
          <Route path="/play/:game" element={<Soon title="Play" />} />

          <Route element={<DoorLayout door="learn" />}>
            <Route path="/learn" element={<Learn />} />
            <Route path="/practice" element={<Arena />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/build" element={<Build />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/arena/ctf" element={<Ctf />} />
            <Route path="/arena/data" element={<DataArena />} />
            <Route path="/arena/data/:id" element={<DataChallenge />} />
            <Route path="/arena/quant" element={<Quant />} />
            <Route path="/research" element={<Research />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/puzzles" element={<Puzzles />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/workspace/:id" element={<Workspace />} />
            <Route path="/build/start/:slug" element={<Starter />} />
            <Route path="/build/reviews" element={<Reviews />} />
            <Route path="/build/reviews/:id" element={<Reviews />} />
          </Route>

          <Route element={<DoorLayout door="future" />}>
            <Route path="/future" element={<Opportunities />} />
            <Route path="/future/college" element={<Soon title="College plan" />} />
            <Route path="/future/tracker" element={<Soon title="My tracker" />} />
            <Route path="/competitions" element={<Competitions />} />
            <Route path="/competitions/:id" element={<Competition />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/pathways/:id" element={<Pathway />} />
            <Route path="/compass" element={<Compass />} />
            <Route path="/cyber" element={<Cyber />} />
          </Route>
          <Route path="/opportunities" element={<Moved to="/future" />} />

          <Route element={<DoorLayout door="club" />}>
            <Route path="/club" element={<Meetings />} />
            <Route path="/club/kits/:id" element={<Kit />} />
            <Route path="/club/playbook" element={<Playbook />} />
            <Route path="/compete" element={<Leaderboard />} />
            <Route path="/student/:id" element={<Student />} />
            <Route path="/ideas" element={<Ideas />} />
            <Route path="/about" element={<About />} />
            <Route path="/alumni" element={<Alumni />} />
          </Route>
          <Route path="/standings" element={<Moved to="/compete" />} />
          <Route path="/recap/:code" element={<Recap />} />
          <Route path="/join" element={<Join />} />

          <Route element={<DoorLayout door="me" />}>
            <Route path="/me" element={<Me />} />
            <Route path="/me/points" element={<MePoints />} />
            <Route path="/me/account" element={<div className="hub"><SignIn /></div>} />
            <Route path="/quests" element={<Quests />} />
            <Route path="/pathways" element={<Pathways />} />
          </Route>
          <Route element={<HubLayout />}>
            <Route path="/p/:slug" element={<Problem />} />
            <Route path="/learn/:slug" element={<Course />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/room" element={<Room />} />
            <Route path="/room/:code" element={<Room />} />
            <Route path="/gateway" element={<Gateway />} />
            <Route path="/read" element={<Reader />} />
            <Route path="/projects" element={<Navigate to="/build" replace />} />
            <Route path="/u/:id" element={<Portfolio />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/parents" element={<Parents />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/archive/:year" element={<Archive />} />
            <Route path="/officers/apply" element={<OfficerApply />} />
            <Route path="/verify/:code" element={<Verify />} />
          </Route>
          <Route path="/lab/editor" element={<Suspense fallback={null}><EditorLab /></Suspense>} />
          <Route path="/hq/*" element={<Suspense fallback={<div className="ui-page"><SkeletonList rows={5} label="Loading HQ" /></div>}><Hq /></Suspense>} />
          {/* The old officer console: every screen id lands on its place in HQ (shared/hq.js). */}
          <Route path="/officer" element={<OldOfficer />} />
          <Route path="/admin" element={<Navigate to="/hq" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <AskDock />
      </AppShell>
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
