/**
 * Read-only API. Everything here is safe for anyone on the internet to call.
 */
import { Hono } from 'hono';
import { getLeaderboard, getStudent, listOpportunities, getAllSettings } from '../db.js';
import { RADIUS_MILES, SCHOOL } from '../geo.js';

export const publicRouter = new Hono();

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
];

publicRouter.get('/site', async (c) => {
  const all = await getAllSettings(c.env.DB);
  const settings = Object.fromEntries(
    PUBLIC_SETTINGS.filter((k) => k in all).map((k) => [k, all[k]])
  );
  return c.json({ settings, radius_miles: RADIUS_MILES });
});
