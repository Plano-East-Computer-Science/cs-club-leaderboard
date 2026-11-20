/**
 * `/` on the `next` site. Signed out: the front door, with the daily puzzle as
 * the hook. Signed in: today, in one screen: the games, the lesson to pick up,
 * the daily problem, the next meeting and the deadlines that are close.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GameController, BookOpenText, Lightning, CalendarBlank, RocketLaunch, CheckCircle, ArrowRight } from '@phosphor-icons/react';
import { Button, Skeleton, useSession } from '../../ui/index.js';
import { useApi } from '../../lib/ui.js';
import { usePlayToday, continueLesson, upcoming } from './sources.js';
import { chicagoToday, nextWeekday, weekdayOf, monthDay, shortDay, daysFromToday } from '../club/dates.js';
import './home.css';

const first = (n = '') => n.split(' ')[0] || 'there';

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Chicago' }).format(now));
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

/** The word-game tiles used as the front door's picture. Decorative. */
function Tiles() {
  const rows = [
    ['L', 'O', 'G', 'I', 'C'],
    ['A', 'R', 'R', 'A', 'Y'],
  ];
  const marks = [
    ['miss', 'hit', 'miss', 'near', 'miss'],
    ['hit', 'hit', 'hit', 'hit', 'hit'],
  ];
  return (
    <div className="hm-tiles" aria-hidden="true">
      {rows.map((r, i) => (
        <div key={i} className="hm-tiles__row">
          {r.map((ch, j) => (
            <span key={j} className={`hm-tile hm-tile--${marks[i][j]}`} style={{ '--d': `${(i * 5 + j) * 70}ms` }}>
              {ch}
            </span>
          ))}
        </div>
      ))}
      <div className="hm-tiles__row">
        {Array.from({ length: 5 }, (_, j) => (
          <span key={j} className="hm-tile hm-tile--empty" />
        ))}
      </div>
    </div>
  );
}

function FrontDoor() {
  const club = useApi('/club').data;
  const opps = useApi('/opportunities').data?.opportunities ?? [];
  const soon = opps
    .filter((o) => o.deadline && daysFromToday(o.deadline.slice(0, 10)) >= 0)
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1))
    .slice(0, 3);
  const meetDate = club?.next?.date ?? nextWeekday(club?.meeting?.day);
  return (
    <div className="hm-front">
      <section className="hm-hero">
        <div className="hm-hero__t">
          <h1 className="hm-hero__h">Get good at computer science, one day at a time.</h1>
          <p className="hm-hero__s">
            The Plano East CS Club. A daily coding puzzle, Java lessons that actually teach, every opportunity worth applying to, and a meeting every Wednesday.
          </p>
          <div className="hm-hero__act">
            <Button variant="primary" to="/play" icon={GameController}>Play today's puzzle</Button>
            <Button variant="secondary" to="/signin">Create an account</Button>
          </div>
          <p className="hm-hero__fine">The puzzle works without an account. Your streak saves when you sign in.</p>
        </div>
        <Tiles />
      </section>

      <section className="hm-doors" aria-label="What is here">
        <Link to="/learn" className="hm-door">
          <BookOpenText size={26} aria-hidden="true" />
          <span className="hm-door__n">Learn</span>
          <span className="hm-door__l">AP Computer Science A, start to finish, with code you run in the browser.</span>
        </Link>
        <Link to="/future" className="hm-door">
          <RocketLaunch size={26} aria-hidden="true" />
          <span className="hm-door__n">Future</span>
          <span className="hm-door__l">
            {soon.length ? `Next deadline: ${soon[0].title}, ${shortDay(soon[0].deadline.slice(0, 10))}.` : 'Competitions, summer programs, internships and a plan for college.'}
          </span>
        </Link>
        <Link to="/club" className="hm-door">
          <CalendarBlank size={26} aria-hidden="true" />
          <span className="hm-door__n">Club</span>
          <span className="hm-door__l">
            Next meeting {weekdayOf(meetDate)}, {monthDay(meetDate)} at {club?.meeting?.time || '4:30 PM'}
            {club?.next?.title ? `: ${club.next.title}` : ''}.
          </span>
        </Link>
      </section>
    </div>
  );
}

function GamesRow() {
  const games = usePlayToday();
  if (!games.length)
    return (
      <Link to="/play" className="hm-games hm-games--one">
        <GameController size={28} aria-hidden="true" />
        <span>Today's puzzles are waiting</span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    );
  const done = games.filter((g) => g.done).length;
  return (
    <section aria-labelledby="hm-g">
      <div className="hm-sec__h">
        <h2 className="hm-h2" id="hm-g">Today's puzzles</h2>
        <span className="hm-muted">{done} of {games.length} done</span>
      </div>
      <ul className="hm-games">
        {games.map((g) => (
          <li key={g.slug}>
            <Link to={g.href} className={`hm-game${g.done ? ' is-done' : ''}`}>
              <span className="hm-game__n">{g.name}</span>
              {g.done ? <CheckCircle size={22} weight="fill" aria-label="Done" /> : <span className="hm-game__go">Play</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Deadlines({ user }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let live = true;
    upcoming(Boolean(user))
      .then((l) => live && setList(l))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [user]);
  return (
    <section className="hm-card" aria-labelledby="hm-d">
      <h2 className="hm-h2" id="hm-d">Deadlines</h2>
      {list === null ? (
        <Skeleton />
      ) : list.length ? (
        <ul className="hm-dl">
          {list.slice(0, 4).map((d) => {
            const n = daysFromToday(d.due);
            return (
              <li key={`${d.title}-${d.due}`}>
                <Link to={d.href}>{d.title}</Link>
                <span className={n <= 7 ? 'hm-soon' : 'hm-muted'}>{n === 0 ? 'today' : n === 1 ? 'tomorrow' : `${n} days`}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hm-muted">
          Save an opportunity and its deadline shows up here. <Link to="/future">Browse opportunities</Link>
        </p>
      )}
    </section>
  );
}

function Today({ user }) {
  const club = useApi('/club').data;
  const daily = useApi('/daily').data;
  const lesson = continueLesson();
  const meetDate = club?.next?.date ?? nextWeekday(club?.meeting?.day);
  const meetIn = daysFromToday(meetDate);
  return (
    <div className="hm-today">
      <header className="hm-greet">
        <h1 className="hm-greet__h">
          {greeting()}, {first(user.name)}.
        </h1>
        <p className="hm-muted">{weekdayOf(chicagoToday())}, {monthDay(chicagoToday())}</p>
      </header>

      <GamesRow />

      <div className="hm-grid">
        <div className="hm-col">
          <section className="hm-card hm-card--lesson" aria-labelledby="hm-l">
            <h2 className="hm-h2" id="hm-l">{lesson ? 'Pick up where you left off' : 'Start learning'}</h2>
            {lesson ? (
              <>
                <p className="hm-lesson__c">{lesson.course}</p>
                <p className="hm-lesson__t">{lesson.title}</p>
                <div className="hm-bar" role="progressbar" aria-valuenow={Math.round(lesson.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
                  <span style={{ width: `${Math.round(lesson.progress * 100)}%` }} />
                </div>
                <Button variant="primary" to={lesson.href}>Continue</Button>
              </>
            ) : (
              <>
                <p className="hm-muted">AP Computer Science A, from your first line of Java to the exam.</p>
                <Button variant="primary" to="/learn">See the courses</Button>
              </>
            )}
          </section>

          {daily?.problem && (
            <Link to="/daily" className="hm-card hm-daily">
              <Lightning size={22} weight="fill" aria-hidden="true" />
              <span className="hm-daily__b">
                <span className="hm-daily__k">Daily problem</span>
                <span className="hm-daily__t">{daily.problem.title}</span>
              </span>
              <span className="hm-muted">{daily.mine?.solved_at ? 'Solved' : daily.stats?.solved ? `${daily.stats.solved} solved` : 'New'}</span>
            </Link>
          )}
        </div>

        <div className="hm-col">
          <Link to="/club" className="hm-card hm-meet">
            <span className="hm-meet__k">{meetIn === 0 ? 'Meeting today' : meetIn === 1 ? 'Meeting tomorrow' : `Next meeting in ${meetIn} days`}</span>
            <span className="hm-meet__d">{weekdayOf(meetDate)}</span>
            <span className="hm-muted">
              {monthDay(meetDate)}, {club?.meeting?.time || '4:30 PM'}
              {club?.next?.title ? `. ${club.next.title}` : ''}
            </span>
          </Link>
          <Deadlines user={user} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading } = useSession();
  if (loading)
    return (
      <div className="ui-page" role="status" aria-label="Loading">
        <Skeleton kind="title" />
      </div>
    );
  return <div className="ui-page">{user ? <Today user={user} /> : <FrontDoor />}</div>;
}
