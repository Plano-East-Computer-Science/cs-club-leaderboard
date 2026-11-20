/**
 * /club: the meetings page. The next meeting as one big plaque (the page's one
 * loud element), what will happen minute by minute, what is coming up, and the
 * kinds of meetings the club runs. Officers get a way into the kit builder.
 */
import { Link } from 'react-router-dom';
import { CalendarPlus, Broadcast, ClipboardText, MapPin, Clock } from '@phosphor-icons/react';
import { Button, Pill, SkeletonList, useSession } from '../../ui/index.js';
import { useApi } from '../../lib/ui.js';
import { FORMATS } from '../../../shared/next/club/formats.js';
import { chicagoToday, nextWeekday, weekdayOf, monthDay, shortDay, daysFromToday } from './dates.js';
import './club.css';

const isOfficer = (u) => u?.role === 'officer' || u?.role === 'lead';

/** Matches a planned session to a format by its HQ template, for the "what to bring" line. */
const formatFor = (template) => FORMATS.find((f) => f.id === template) ?? FORMATS.find((f) => f.template === template) ?? null;

function whenWords(date) {
  const n = daysFromToday(date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return `In ${n} days`;
  return `In ${Math.round(n / 7)} week${n >= 14 ? 's' : ''}`;
}

/** Clock time for each agenda item, from "4:30 PM". */
function clocked(agenda, start) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(start).trim());
  let t = m ? ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]) : 990;
  return agenda.map((a) => {
    const h = Math.floor(t / 60);
    const at = `${((h + 11) % 12) + 1}:${String(t % 60).padStart(2, '0')}`;
    t += a.minutes || 0;
    return { ...a, at };
  });
}

function Plaque({ meeting, next, live }) {
  const date = next?.date ?? nextWeekday(meeting?.day);
  const fmt = next ? formatFor(next.template) : null;
  return (
    <section className="cl-plaque" aria-labelledby="cl-next">
      <p className="cl-plaque__k" id="cl-next">
        {live ? 'Happening now' : `Next meeting, ${whenWords(date).toLowerCase()}`}
      </p>
      <h1 className="cl-plaque__day">{live ? live.title || 'Meeting' : weekdayOf(date)}</h1>
      {!live && (
        <p className="cl-plaque__date">
          <span className="cl-hl">{monthDay(date)}</span>
        </p>
      )}
      <ul className="cl-plaque__facts">
        <li>
          <Clock size={18} aria-hidden="true" /> {meeting?.time || '4:30 PM'}
        </li>
        {meeting?.place && (
          <li>
            <MapPin size={18} aria-hidden="true" /> {meeting.place}
          </li>
        )}
        {next && !live && <li className="cl-plaque__kind">{next.title}</li>}
      </ul>
      {fmt && !live && <p className="cl-plaque__line">{fmt.line}</p>}
      {next?.speaker && <p className="cl-plaque__line">Speaker: {next.speaker}</p>}
      <div className="cl-plaque__act">
        {live ? (
          <Button variant="primary" to={`/room/${live.code}`} icon={Broadcast}>Join the room</Button>
        ) : (
          <Button variant="primary" href="/api/deadlines.ics" icon={CalendarPlus}>Add to my calendar</Button>
        )}
        {fmt && !live && <span className="cl-plaque__bring">Bring: {fmt.bring}</span>}
      </div>
    </section>
  );
}

export default function Meetings() {
  const { user, live } = useSession();
  const club = useApi('/club');
  const sched = useApi('/club/schedule');
  const meeting = club.data?.meeting;
  const upcoming = sched.data?.upcoming ?? [];
  const next = upcoming[0] ?? null;

  if (!club.data && !club.error)
    return (
      <div className="ui-page">
        <SkeletonList rows={5} label="Loading meetings" />
      </div>
    );

  const agenda = next?.agenda?.length ? clocked(next.agenda, meeting?.time || '4:30 PM') : null;

  return (
    <div className="ui-page cl-page">
      <div className="cl-top">
        <Plaque meeting={meeting} next={next} live={live} />
        <aside className="cl-agenda" aria-label="What happens">
          <h2 className="cl-h2">{agenda ? 'What happens' : 'How a meeting goes'}</h2>
          <ol className="cl-time">
            {(agenda ?? clocked(FORMATS[3].blocks.map((b) => ({ title: b.title, minutes: b.minutes, type: b.type })), meeting?.time || '4:30 PM')).map((a, i) => (
              <li key={i}>
                <span className="cl-time__at">{a.at}</span>
                <span className="cl-time__t">{a.title}</span>
                <span className="cl-time__m">{a.minutes} min</span>
              </li>
            ))}
          </ol>
          {!agenda && <p className="cl-muted">One hour, every Wednesday. The format changes week to week.</p>}
        </aside>
      </div>

      {isOfficer(user) && (
        <div className="cl-officer">
          <ClipboardText size={22} aria-hidden="true" />
          <p>
            <strong>Officers:</strong> pick a format below to get its prep checklist, script and announcement, then send the plan to HQ in one tap.
          </p>
          <Button to="/club/playbook" variant="secondary">Open the playbook</Button>
        </div>
      )}

      {upcoming.length > 1 && (
        <section className="cl-sec" aria-labelledby="cl-up">
          <h2 className="cl-h2" id="cl-up">Coming up</h2>
          <ul className="cl-up">
            {upcoming.slice(1).map((p) => (
              <li key={p.id}>
                <span className="cl-up__d">{shortDay(p.date)}</span>
                <span className="cl-up__t">{p.title}</span>
                <Pill>{p.kind}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cl-sec" aria-labelledby="cl-kinds">
        <div className="cl-sec__h">
          <h2 className="cl-h2" id="cl-kinds">Kinds of meetings</h2>
          <p className="cl-muted">Every week is one of these. Each has a full kit: timing, script, prep and the announcement.</p>
        </div>
        <ul className="cl-kinds">
          {FORMATS.map((f) => (
            <li key={f.id}>
              <Link to={`/club/kits/${f.id}`} className="cl-kind">
                <span className="cl-kind__n">{f.name}</span>
                <span className="cl-kind__l">{f.line}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="cl-foot">Today is {shortDay(chicagoToday())}. Meeting times are Central.</p>
    </div>
  );
}
