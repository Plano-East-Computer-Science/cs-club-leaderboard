/**
 * Read-only API. Everything here is safe for anyone on the internet to call.
 */
import { Hono } from 'hono';
import {
  getLeaderboard, getAllPointEvents, getStudent, listOpportunities, getAllSettings,
  getOfficers, getCurriculum, getCompetitions, getPuzzles, getCurrentPuzzle,
} from '../db.js';
import { RADIUS_MILES, SCHOOL } from '../geo.js';
import { seasonOf } from '../../shared/points.js';
import { seasonParam, rankInfo } from '../hub/standings.js';
import { opportunitiesToICS } from '../ics.js';
import { upcomingPublicPlans } from '../hub/planner.js';

export const publicRouter = new Hono();

// A4: `points` is season points (the current season unless ?season= says
// otherwise); `lifetime` and the `rank` label cover all time.
publicRouter.get('/leaderboard', async (c) => {
  const season = seasonParam(c.req.query('season'));
  if (!season) return c.json({ error: 'Unknown season.' }, 400);
  return c.json({
    season,
    students: await getLeaderboard(c.env.DB, season, { publicNames: true }),
    events: await getAllPointEvents(c.env.DB, season),
  });
});

publicRouter.get('/student/:id', async (c) => {
  const season = seasonOf(new Date());
  const student = await getStudent(c.env.DB, c.req.param('id'), season, { publicNames: true });
  if (!student) return c.json({ error: 'No student with that id.' }, 404);
  const squad = await c.env.DB
    .prepare('SELECT q.id, q.name, q.color FROM squad_members m JOIN squads q ON q.id = m.squad_id WHERE m.student_id = ? AND m.season = ?')
    .bind(student.id, season)
    .first();
  return c.json({ ...student, season, ...rankInfo(student), squad });
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

/**
 * A live iCalendar feed of every live opportunity's deadline. A student
 * subscribes to this URL once (Google Calendar: Other calendars -> From URL),
 * and it silently reflects the real, officer-approved opportunity list
 * forever after -- there is no second copy of deadline data to keep in sync.
 */
publicRouter.get('/deadlines.ics', async (c) => {
  const opportunities = (await listOpportunities(c.env.DB, { status: 'live' })).filter(
    (o) => o.deadline
  );
  const sessions = await upcomingPublicPlans(c.env.DB); // G1
  const ics = opportunitiesToICS(opportunities, { domain: new URL(c.req.url).hostname, sessions });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="cs-club-deadlines.ics"',
      // Subscribed calendars are polled by the client on their own schedule
      // (often hourly), so this is just a courtesy against pathological
      // re-fetching, not the source of the refresh cadence.
      'Cache-Control': 'public, max-age=1800',
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
  'prize_title', 'prize_blurb', 'season_start', 'season_end', 'season_tiers',
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
