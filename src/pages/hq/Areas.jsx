/**
 * HQ's four occasional areas: Library (content), Announce, Season and
 * Settings. Each one reuses the existing officer screens as they are; only
 * the page header, the tabs (route tabs, so the URL holds the sub-screen) and
 * the frame around each screen are new.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { PageHeader, Section } from '../../ui/index.js';
import { HqTabs, Old } from './bits.jsx';
import { Gateway } from './legacy.jsx';
import Problems from '../officer/Problems.jsx';
import Sets from '../officer/Sets.jsx';
import AnnounceComposer from '../officer/Announce.jsx';
import Team from '../officer/Team.jsx';
import Raffle from '../officer/Raffle.jsx';
import Squads from '../officer/Squads.jsx';
import DailyAdmin from '../officer/Daily.jsx';
import Board from '../officer/Board.jsx';
import Cycles from '../officer/Cycles.jsx';
import CtfAdmin from '../officer/Ctf.jsx';
import CompetitionAdmin from '../officer/Competition.jsx';
import Analytics from '../officer/Analytics.jsx';
import DataAdmin from '../officer/Data.jsx';
import ReaderAdmin from '../officer/Reader.jsx';
import Handoff from '../officer/Handoff.jsx';
import AlumniAdmin from '../officer/Alumni.jsx';
import ResearchAdmin from '../officer/Research.jsx';
import QuantAdmin from '../officer/Quant.jsx';
import {
  BadgesTab,
  OpportunitiesTab,
  QueueTab,
  OfficersTab,
  CurriculumTab,
  CompetitionsTab,
  PuzzlesTab,
  EmailTab,
  TextTab,
  BackupTab,
} from '../officer/AdminScreens.jsx';
// The meeting settings (worker/hub/club.js MEETING_KEYS), kept here so the worker stays out of the page bundle.
const MEETING_KEYS = ['meeting_day', 'meeting_time', 'meeting_place', 'meeting_note'];

/**
 * An area with route tabs. tabs: [{ path, label, C }]; `C` gets `say` and
 * `actionsUrl` like it did in the old console. The area's own URL lands on
 * the first tab.
 */
function Area({ base, title, subtitle, tabs }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <HqTabs label={title} items={tabs.map((t) => ({ to: `${base}/${t.path}`, label: t.label }))} />
      <Routes>
        <Route index element={<Navigate to={tabs[0].path} replace />} />
        {tabs.map((t) => (
          <Route key={t.path} path={t.path} element={<Old C={t.C} />} />
        ))}
        <Route path="*" element={<Navigate to={`${base}/${tabs[0].path}`} replace />} />
      </Routes>
    </>
  );
}

/* --------------------------------- Library --------------------------------- */

/** The scraper queue and the live list are one object, so they share a tab. */
function Opportunities(props) {
  return (
    <>
      <QueueTab {...props} />
      <div className="mt-6">
        <OpportunitiesTab {...props} />
      </div>
    </>
  );
}

export const Library = () => (
  <Area
    base="/hq/library"
    title="Library"
    subtitle="The content meetings and practice draw from."
    tabs={[
      { path: 'packs', label: 'Duel packs and sets', C: Sets },
      { path: 'problems', label: 'Problem bank', C: Problems },
      { path: 'daily', label: 'Daily pins', C: DailyAdmin },
      { path: 'board', label: 'Board rungs', C: Board },
      { path: 'ctf', label: 'CTF', C: CtfAdmin },
      { path: 'data', label: 'Data challenges', C: DataAdmin },
      { path: 'opportunities', label: 'Opportunities', C: Opportunities },
      { path: 'research', label: 'Research', C: ResearchAdmin },
      { path: 'quant', label: 'Quant', C: QuantAdmin },
      { path: 'puzzles', label: 'Puzzles', C: PuzzlesTab },
      { path: 'curriculum', label: 'Curriculum', C: CurriculumTab },
    ]}
  />
);

/* --------------------------------- Announce --------------------------------- */

export function Announce() {
  return (
    <>
      <PageHeader title="Announce" subtitle="Write it once for Discord and the digest, then preview the digest." />
      <Section title="Announcement" className="hq-first">
        <Old C={AnnounceComposer} />
      </Section>
      <Section title="Weekly digest">
        <Old C={EmailTab} />
      </Section>
    </>
  );
}

/* --------------------------------- Season --------------------------------- */

export const Season = () => (
  <Area
    base="/hq/season"
    title="Season"
    subtitle="The once-a-semester jobs: teams, prizes, cycles and the handoff."
    tabs={[
      { path: 'competitions', label: 'Competitions', C: CompetitionsTab },
      { path: 'prep', label: 'Prep and results', C: CompetitionAdmin },
      { path: 'squads', label: 'Squads', C: Squads },
      { path: 'raffle', label: 'Raffle', C: Raffle },
      { path: 'cycles', label: 'Build cycles', C: Cycles },
      { path: 'badges', label: 'Badges', C: BadgesTab },
      { path: 'handoff', label: 'Handoff', C: Handoff },
      { path: 'alumni', label: 'Alumni', C: AlumniAdmin },
      { path: 'stats', label: 'Stats', C: Analytics },
    ]}
  />
);

/* --------------------------------- Settings --------------------------------- */

const isMeeting = (k) => MEETING_KEYS.includes(k);

/** Roles and the About page's officer list are one list of people, so one screen. */
function Officers(props) {
  return (
    <>
      <Team {...props} />
      <div className="mt-8">
        <OfficersTab {...props} />
      </div>
    </>
  );
}

const MeetingText = (props) => (
  <TextTab
    {...props}
    show={isMeeting}
    title="Meeting time and place"
    hint="Shown on the front door, Join and About. Leave a field blank to use the default."
    submitLabel="Save meeting time"
  />
);
const PageText = (props) => <TextTab {...props} show={(k) => !isMeeting(k)} />;

export const Settings = () => (
  <Area
    base="/hq/settings"
    title="Settings"
    subtitle="Who the officers are, when the club meets, and site setup."
    tabs={[
      { path: 'officers', label: 'Officers', C: Officers },
      { path: 'meeting', label: 'Meeting time', C: MeetingText },
      { path: 'gateway', label: 'Gateway', C: Gateway },
      { path: 'reader', label: 'Reader sites', C: ReaderAdmin },
      { path: 'text', label: 'Page text', C: PageText },
      { path: 'backup', label: 'Backup', C: BackupTab },
    ]}
  />
);
