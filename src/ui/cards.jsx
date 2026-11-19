/**
 * Each kind of thing has its own shape (v2-spec principle 6): problems,
 * projects, opportunities, meetings and people. All of them take real data;
 * none of them invent numbers.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  CircleDashed,
  BookmarkSimple,
  Sword,
  Microphone,
  Flask,
  Trophy,
  CalendarBlank,
  Code,
  MapPin,
} from '@phosphor-icons/react';
import { Card, TrackChip, Button, Pill, cx, trackClass } from './primitives.jsx';
import { daysUntil, initials } from '../lib/format.js';

/* ------------------------------- ProblemCard ------------------------------- */

const STATUS = {
  done: { icon: CheckCircle, label: 'Solved', cls: 'ui-st--done' },
  started: { icon: CircleDashed, label: 'Started', cls: 'ui-st--started' },
};

/** Five small segments; no track background behind them. */
export function Difficulty({ level = 1 }) {
  const n = Math.max(1, Math.min(5, Number(level) || 1));
  return (
    <span className="ui-diff" role="img" aria-label={`Difficulty ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= n ? 'on' : undefined} />
      ))}
    </span>
  );
}

export function ProblemCard({ title, track, difficulty, solvedBy, status, to, href, hint }) {
  const st = STATUS[status];
  return (
    <Card to={to} href={href} className="ui-problem">
      <div className="ui-problem__top">
        <TrackChip track={track} />
        <Difficulty level={difficulty} />
      </div>
      <h3 className="ui-heading">{title}</h3>
      {hint && <p className="ui-small ui-clamp2">{hint}</p>}
      <div className="ui-problem__foot">
        <span className="ui-small">
          {solvedBy > 0 ? `Solved by ${solvedBy}` : 'No solves yet'}
        </span>
        {st && (
          <span className={cx('ui-st', st.cls)}>
            <st.icon size={18} weight={status === 'done' ? 'fill' : 'regular'} aria-hidden="true" />
            {st.label}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------- ProjectCard ------------------------------- */

/** GitHub's social preview for a public repo URL, or null. A real image of the real repo. */
export function repoImage(url) {
  const m = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(url ?? '').trim());
  return m ? `https://opengraph.githubassets.com/1/${m[1]}/${m[2]}` : null;
}

export function ProjectCard({ title, blurb, image, track, people = [], to, href }) {
  const [broken, setBroken] = useState(false);
  return (
    <Card to={to} href={href} className="ui-project">
      <div className={cx('ui-project__img', trackClass(track))}>
        {image && !broken ? (
          <img src={image} alt="" loading="lazy" decoding="async" width="1200" height="750" onError={() => setBroken(true)} />
        ) : (
          <Code size={28} aria-hidden="true" />
        )}
      </div>
      <div className="ui-project__body">
        <h3 className="ui-heading">{title}</h3>
        {blurb && <p className="ui-small ui-clamp2">{blurb}</p>}
        {people.length > 0 && (
          <p className="ui-project__people">
            <span className="ui-avs" aria-hidden="true">
              {people.slice(0, 3).map((p) => (
                <span key={p} className={cx('ui-av', 'ui-av--sm', trackClass(track))}>{initials(p)}</span>
              ))}
            </span>
            <span className="ui-small">{people.join(', ')}</span>
          </p>
        )}
      </div>
    </Card>
  );
}

/* ----------------------------- OpportunityCard ----------------------------- */

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "Closes Dec 12, in 24 days". Rolling when there is no deadline. */
export function deadlineLine(iso) {
  const n = daysUntil(iso);
  if (n == null) return { text: 'Rolling deadline', soon: false };
  if (n < 0) return { text: `Closed ${shortDate(iso)}`, soon: false };
  if (n === 0) return { text: 'Closes today', soon: true };
  if (n === 1) return { text: `Closes ${shortDate(iso)}, tomorrow`, soon: true };
  return { text: `Closes ${shortDate(iso)}, in ${n} days`, soon: n <= 7 };
}

export function OpportunityCard({ title, org, deadline, tags = [], logo, saved, onSave, to, href }) {
  const d = deadlineLine(deadline);
  return (
    <Card className="ui-opp" as="article">
      <p className={cx('ui-opp__dl', d.soon && 'ui-opp__dl--soon')}>{d.text}</p>
      <div className="ui-opp__main">
        {logo && <img className="ui-opp__logo" src={logo} alt="" width="32" height="32" loading="lazy" />}
        <div>
          <h3 className="ui-heading">
            {to ? (
              <Link to={to} className="ui-stretch">{title}</Link>
            ) : href ? (
              <a href={href} target="_blank" rel="noreferrer noopener" className="ui-stretch">{title}</a>
            ) : (
              title
            )}
          </h3>
          {org && <p className="ui-small">{org}</p>}
        </div>
      </div>
      <div className="ui-opp__foot">
        <span className="ui-tags">
          {tags.slice(0, 3).map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </span>
        {onSave && (
          <Button
            variant="ghost"
            className="ui-opp__save"
            icon={BookmarkSimple}
            aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
            aria-pressed={Boolean(saved)}
            onClick={onSave}
          />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------- MeetingCard ------------------------------- */

const KIND_ICON = [
  [/duel|race|contest/i, Sword],
  [/speaker|talk/i, Microphone],
  [/lab|build|workshop/i, Flask],
  [/compet|usaco|uil/i, Trophy],
];
export const kindIcon = (kind = '') => KIND_ICON.find(([re]) => re.test(kind))?.[1] ?? CalendarBlank;

/**
 * Day and time large, then place, title, kind and speaker. `today` marks a
 * meeting-day card. `action` is the one button ("I'm coming", "Join").
 */
export function MeetingCard({ when, time, place, title, kind, speaker, today, action, note, className }) {
  const KindIcon = kindIcon(kind);
  return (
    <Card className={cx('ui-meet', today && 'ui-meet--today', className)}>
      <div className="ui-meet__when">
        {today && <Pill tone="gold">Today</Pill>}
        <p className="ui-meet__day">{when}</p>
        <p className="ui-meet__time">{time}</p>
      </div>
      <div className="ui-meet__what">
        {title && (
          <p className="ui-meet__title">
            <KindIcon size={18} aria-hidden="true" />
            <span>{title}</span>
          </p>
        )}
        {kind && title !== kind && <p className="ui-small">{kind}{speaker ? `, with ${speaker}` : ''}</p>}
        {!kind && speaker && <p className="ui-small">With {speaker}</p>}
        {place && (
          <p className="ui-small ui-meet__place">
            <MapPin size={16} aria-hidden="true" />
            {place}
          </p>
        )}
        {note && <p className="ui-small">{note}</p>}
      </div>
      {action && <div className="ui-meet__act">{action}</div>}
    </Card>
  );
}

/* -------------------------------- PersonRow -------------------------------- */

/** Avatar initials on a track-tinted circle, the name, one stat. */
export function PersonRow({ name, track, stat, rank, me, to, className }) {
  const body = (
    <>
      {rank != null && <span className="ui-person__rank">{rank}</span>}
      <span className={cx('ui-av', trackClass(track))} aria-hidden="true">{initials(name)}</span>
      <span className="ui-person__name">{me ? 'You' : name}</span>
      {stat != null && <span className="ui-person__stat">{stat}</span>}
    </>
  );
  const cls = cx('ui-person', me && 'ui-person--me', className);
  return to ? <Link to={to} className={cls} aria-current={me ? 'true' : undefined}>{body}</Link> : <div className={cls} aria-current={me ? 'true' : undefined}>{body}</div>;
}

