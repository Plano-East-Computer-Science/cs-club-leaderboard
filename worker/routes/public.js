/**
 * Read-only API, in two halves.
 *
 * PUBLIC: the recruiting surface -- what the club is, who runs it, what it
 * teaches, where it competes, how to join. No student names, no personal data,
 * readable by a prospective member, a parent, or the sponsor (who has a
 * @pisd.edu address and so could never pass a district-student check).
 *
 * MEMBER-ONLY: anything naming a specific student, plus the resources the club
 * curates for its own members. Gating this takes 23 minors' names, grades and
 * activity off the open internet, where they are currently indexed.
 */
import { Hono } from 'hono';
import {
  getLeaderboard, getStudent, listOpportunities, getAllSettings,
  getOfficers, getCurriculum, getCompetitions, getPuzzles, getCurrentPuzzle,
  getMemberByFeedToken,
} from '../db.js';
import { RADIUS_MILES, SCHOOL } from '../geo.js';
import { opportunitiesToICS } from '../ics.js';
import { requireMember } from './auth.js';

export const publicRouter = new Hono();

/* =============================== MEMBER-ONLY =============================== */

publicRouter.use('/leaderboard', requireMember);
publicRouter.use('/student/*', requireMember);
publicRouter.use('/opportunities', requireMember);
publicRouter.use('/puzzles', requireMember);

publicRouter.get('/leaderboard', async (c) => {
  return c.json({ students: await getLeaderboard(c.env.DB) });
});

publicRouter.get('/student/:id', async (c) => {
  const student = await getStudent(c.env.DB, c.req.param('id'));
  if (!student) return c.json({ error: 'No student with that id.' }, 404);
  return c.json(student);
});

publicRouter.get('/opportunities', async (c) => {
  return c.json({
    opportunities: await listOpportunities(c.env.DB, { status: 'live' }),
    radius_miles: RADIUS_MILES,
    school: SCHOOL.name,
  });
});

publicRouter.get('/officers', async (c) => {
  return c.json({ officers: await getOfficers(c.env.DB) });
});

publicRouter.get('/curriculum', async (c) => {
  return c.json({ topics: await getCurriculum(c.env.DB) });
});

publicRouter.get('/competitions', async (c) => {
  return c.json({ competitions: await getCompetitions(c.env.DB) });
});

publicRouter.get('/puzzles', async (c) => {
  return c.json({
    puzzles: await getPuzzles(c.env.DB),
    current: await getCurrentPuzzle(c.env.DB),
  });
});

/* ================================= PUBLIC ================================== */

/**
 * A live iCalendar feed of every live opportunity's deadline. A student
 * subscribes to this URL once (Google Calendar: Other calendars -> From URL),
 * and it silently reflects the real, officer-approved opportunity list
 * forever after -- there is no second copy of deadline data to keep in sync.
 */
publicRouter.get('/deadlines.ics', async (c) => {
  // A calendar client cannot send a cookie, so this one route authenticates
  // with a per-member key in the URL instead. Without it the feed would be the
  // one hole in the gate -- every deadline, readable by anyone.
  const key = c.req.query('key');
  const member = key ? await getMemberByFeedToken(c.env.DB, key) : null;
  if (!member) {
    return c.json({ error: 'This calendar feed needs your personal key.' }, 401);
  }

  const opportunities = (await listOpportunities(c.env.DB, { status: 'live' })).filter(
    (o) => o.deadline
  );
  const ics = opportunitiesToICS(opportunities, { domain: new URL(c.req.url).hostname });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="cs-club-deadlines.ics"',
      // Subscribed calendars are polled by the client on their own schedule
      // (often hourly), so this is just a courtesy against pathological
      // re-fetching, not the source of the refresh cadence.
      // Private: the URL carries a personal key, so no shared cache should
      // ever hold this response.
      'Cache-Control': 'private, max-age=1800',
    },
  });
});

/**
 * Only the settings the public site actually renders. An explicit list rather
 * than "everything", so an operational setting added later (scrape targets,
 * anything internal) does not become world-readable by accident.
 */
const PUBLIC_SETTINGS = [
  'club_name', 'school_name', 'tagline',
  'prize_title', 'prize_blurb',
  'about_heading', 'about_body',
  'discord_url', 'email',
  'cyber_intro', 'cyber_body',
  'join_intro', 'join_consent_url', 'join_classroom_code', 'join_meeting_info',
  'meetings_calendar_embed_url', 'meetings_calendar_subscribe_url',
];

publicRouter.get('/site', async (c) => {
  const all = await getAllSettings(c.env.DB);
  const settings = Object.fromEntries(
    PUBLIC_SETTINGS.filter((k) => k in all).map((k) => [k, all[k]])
  );
  return c.json({ settings, radius_miles: RADIUS_MILES });
});
