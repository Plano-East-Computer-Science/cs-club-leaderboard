/**
 * The public front door (`/` signed out, Wave 4). In order: what the club is,
 * when and where it meets, one button; what you can do here by track, shown
 * with real problems and opportunities from the app; recent member work; how
 * meetings work; the prize and the points table from /api/club.
 *
 * Nothing on this page is invented. Counts, problems, projects and points all
 * come from the database. Club photos go in the PHOTOS slots below.
 */
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarBlank, Image as ImageIcon } from '@phosphor-icons/react';
import { useData } from '../lib/data.jsx';
import { useApi } from '../lib/ui.js';
import { useClub } from '../lib/club.js';
import { whenLabel } from '../../shared/planner.js';
import { daysUntil } from '../lib/format.js';
import {
  Button,
  Tabs,
  ProblemCard,
  ProjectCard,
  OpportunityCard,
  MeetingCard,
  Skeleton,
  repoImage,
  trackClass,
  cx,
} from '../ui/index.js';

/**
 * PHOTO SLOTS: the lead will send real club photos. Drop each file in
 * /public/photos/ and put its path here ('/photos/meeting.jpg'). An empty slot
 * renders nothing (add ?slots=1 to the URL to see where each one goes).
 *   meeting  a normal Wednesday meeting, people working in pairs. 4:3, 1600x1200.
 *   duel     a duel night, the projector with the race on it. 4:3, 1600x1200.
 *   demo     someone showing a project to the room. 16:10, 1600x1000.
 */
const PHOTOS = { meeting: '', duel: '', demo: '' };
const PHOTO_ALT = {
  meeting: 'Members working in pairs at a club meeting',
  duel: 'A duel night, the race on the projector',
  demo: 'A member showing their project to the club',
};

function Photo({ slot, className }) {
  const { search } = useLocation();
  const src = PHOTOS[slot];
  if (src) return <img className={cx('fd-photo', className)} src={src} alt={PHOTO_ALT[slot]} loading="lazy" decoding="async" />;
  if (!/slots=1/.test(search)) return null;
  return (
    <div className={cx('fd-photo', 'fd-photo--slot', className)} role="img" aria-label={`Photo slot: ${slot}`}>
      <ImageIcon size={28} aria-hidden="true" />
      <span>Photo slot: {slot}</span>
      <span>{PHOTO_ALT[slot]}</span>
    </div>
  );
}

/* Tracks in the order a new member meets them. Engineering has no Arena ladder yet, so it shows opportunities. */
const TRACKS = [
  { id: 'contest', name: 'Contest', blurb: 'USACO, UIL and Codeforces. Problems with a judge and a clock.', re: /usaco|codeforces|olympiad|uil|acsl|programming contest|coding contest/i },
  { id: 'build', name: 'Build', blurb: 'Git, a web page, a bot. Things you can show someone.', re: /hackathon|hack club|app challenge|congressional app|web/i },
  { id: 'ai', name: 'AI', blurb: 'How models work, from a tiny one you write to real deep learning.', re: /\bai\b|artificial intelligence|machine learning/i },
  { id: 'data', name: 'Data', blurb: 'Python, pandas and your first model, on real datasets.', re: /\bdata\b|statistic|kaggle/i },
  { id: 'cyber', name: 'Cyber', blurb: 'Capture the flag: decode, inspect, break in, legally.', re: /cyber|ctf|security|picoctf/i },
  { id: 'eng', name: 'Engineering', blurb: 'Robots, circuits and science fair builds, with a team.', re: /robot|engineer|science fair|isef|tsa\b|first /i },
];

const linkProps = (url) => (/^https?:/.test(url ?? '') ? { href: url } : { to: url || '/practice' });

function TrackPanel({ track, rungs, opps }) {
  const problems = rungs
    .filter((r) => r.track === track.id)
    .sort((a, b) => a.difficulty - b.difficulty || b.n - a.n)
    .slice(0, track.id === 'eng' ? 0 : 2);
  const opp = opps.filter((o) => track.re.test(`${o.title} ${o.org} ${o.description}`)).slice(0, problems.length ? 1 : 2);
  return (
    <div className={cx('fd-track', trackClass(track.id))}>
      <p className="fd-track__blurb">{track.blurb}</p>
      <div className="fd-track__items">
        {problems.map((r) => (
          <ProblemCard key={r.id} title={r.title} track={r.track} difficulty={r.difficulty} solvedBy={r.n} hint={r.hint} {...linkProps(r.url)} />
        ))}
        {opp.map((o) => (
          <OpportunityCard key={o.id} title={o.title} org={o.org} deadline={o.deadline} tags={[o.type, o.cost === 'free' ? 'Free' : null].filter(Boolean)} to={`/opportunities?q=${encodeURIComponent(o.title)}`} />
        ))}
        {!problems.length && !opp.length && <p className="ui-small">Officers are adding this track now.</p>}
      </div>
    </div>
  );
}

/** "join ABCD" on the projector, typed here. A real, working form. */
function RoomCode() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  return (
    <form
      className="fd-code"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) nav(`/room/${code.trim()}`);
      }}
    >
      <label htmlFor="fd-code" className="ui-field__l">Room code from the projector</label>
      <div className="fd-code__row">
        <input id="fd-code" className="ui-input fd-code__in" value={code} maxLength={8} placeholder="ABCD" autoComplete="off" spellCheck="false"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        <Button type="submit" variant="secondary" disabled={!code} icon={ArrowRight} aria-label="Join the room" />
      </div>
    </form>
  );
}

export default function FrontDoor() {
  const { students, opportunities, settings } = useData();
  const club = useClub();
  const board = useApi('/board');
  const projects = useApi('/projects');

  const meeting = club?.meeting;
  const next = club?.next;
  const prize = settings.prize_title || 'Meta Ray-Ban Display Glasses';
  const open = useMemo(() => opportunities.filter((o) => { const n = daysUntil(o.deadline); return n == null || n >= 0; }).sort((a, b) => (a.deadline ?? '9').localeCompare(b.deadline ?? '9')), [opportunities]);
  const rungs = board.data?.rungs ?? [];
  const work = (projects.data?.projects ?? []).slice(0, 6);

  return (
    <div className="fd">
      {/* 1. what, when, where, one button */}
      <section className="fd-hero">
        <div className="fd-hero__in">
          <div className="fd-hero__copy ui-enter">
            <h1 className="ui-display-xl">The computer science club at Plano East</h1>
            <p className="fd-lead">Contests, projects, AI, data and cyber. We meet every week, and you can practise here any time.</p>
            <div className="fd-cta">
              <Button to="/signin" variant="primary" size="lg">Create your account</Button>
              <Button to="/signin" variant="ghost" size="lg">Sign in</Button>
            </div>
          </div>
          <div className="fd-hero__meet ui-enter">
            {meeting ? (
              <MeetingCard
                when={next ? whenLabel(next.date) : `${meeting.day}s`}
                time={meeting.time}
                place={meeting.place}
                title={next ? next.title : 'Weekly meeting'}
                kind={next?.kind}
                speaker={next?.speaker}
                note={next ? `We meet ${meeting.day}s at ${meeting.time}.` : meeting.note || 'Open to every Plano East student. Bring a laptop if you have one.'}
              />
            ) : (
              <div className="ui-card"><Skeleton kind="title" /><Skeleton kind="line" /></div>
            )}
          </div>
        </div>
      </section>

      <div className="fd-body">
        {/* 2. what you can do here, by track, with real things from the app */}
        <section className="fd-sec" aria-labelledby="fd-tracks">
          <h2 id="fd-tracks" className="fd-h2">Pick a track, or try all six</h2>
          <p className="fd-sub">
            {students.length > 0 && <>{students.length} members this season. </>}
            {open.length > 0 && <>{open.length} open opportunities on the board.</>}
          </p>
          {board.data ? (
            <Tabs
              label="Tracks"
              listClassName="fd-tabs"
              items={TRACKS.map((t) => ({ value: t.id, label: t.name, className: trackClass(t.id), content: <TrackPanel track={t} rungs={rungs} opps={open} /> }))}
            />
          ) : (
            <div className="fd-track__items"><Skeleton kind="block" /><Skeleton kind="block" /></div>
          )}
        </section>

        {/* 3. recent member work */}
        {work.length > 0 && (
          <section className="fd-sec" aria-labelledby="fd-work">
            <div className="fd-sec__h">
              <h2 id="fd-work" className="fd-h2">Built by members</h2>
              <Button to="/build" variant="ghost" iconRight={ArrowRight}>All projects</Button>
            </div>
            <div className="fd-work ui-stagger">
              <Photo slot="demo" className="fd-work__photo" />
              {work.map((p) => (
                <ProjectCard
                  key={p.id}
                  title={p.title}
                  blurb={p.description}
                  track={p.track}
                  image={repoImage(p.repo_url)}
                  people={[p.author]}
                  href={p.demo_url || p.repo_url || undefined}
                  to={p.demo_url || p.repo_url ? undefined : `/u/${p.user_id}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* 4. how meetings work, in three sentences */}
        <section className="fd-sec fd-how" aria-labelledby="fd-how">
          <div className="fd-how__copy">
            <h2 id="fd-how" className="fd-h2">How a meeting works</h2>
            <p>An officer opens a room and puts a code on the projector.</p>
            <p>You type the code here to check in, then play the plan for the day: a duel, a lab in pairs, or a speaker.</p>
            <p>When the room closes, everyone who checked in gets their points.</p>
            {meeting && (
              <p className="fd-how__when">
                <CalendarBlank size={18} aria-hidden="true" />
                {meeting.day}s, {meeting.time}{meeting.place ? `, ${meeting.place}` : ''}
              </p>
            )}
          </div>
          <div className="fd-how__side">
            <Photo slot="meeting" />
            <Photo slot="duel" />
            <RoomCode />
          </div>
        </section>

        {/* 5. the prize and how points work */}
        <section className="fd-sec fd-prize" aria-labelledby="fd-prize">
          <div className="fd-prize__win">
            <p className="ui-label">This season</p>
            <h2 id="fd-prize" className="ui-display-xl fd-prize__t">First place wins {prize}</h2>
            <p className="fd-sub">Every point counts toward the standings, and from the first tier up each point is also a raffle ticket.</p>
          </div>
          <div className="fd-points">
            <h3 className="ui-heading">How points work</h3>
            {club ? (
              <ul className="fd-points__list">
                {club.points.map((p) => (
                  <li key={p.kind}>
                    <span className="fd-points__l">
                      {p.label}
                      {p.cap && <span className="ui-small"> ({p.cap})</span>}
                    </span>
                    <span className="fd-points__n">+{p.points}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Skeleton kind="block" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
