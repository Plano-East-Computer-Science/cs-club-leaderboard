/**
 * Everything added for the club hub, mounted from worker/index.js in one place
 * so the original leaderboard routes stay exactly as they were.
 */
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';

import { COOKIE, verifySession } from '../auth.js';
import { usersRouter } from './users.js';
import { learnRouter } from './learn.js';
import { roomsRouter, roomsAdminRouter } from './rooms.js';
import { gatewayRouter, gatewayInfoRouter, gatewayAdminRouter } from './gateway.js';
import { projectsRouter } from './projects.js';
import { dashboardRouter } from './dashboard.js';
import { linksRouter, linksAdminRouter } from './links.js';
import { googleRouter } from './google.js';
import { questsRouter } from './quests.js';
import { ideasRouter, ideasAdminRouter } from './ideas.js';
import { problemsRouter, problemsAdminRouter } from './problems.js';

export { Room } from './room-do.js';

/** Officer-only hub controls (rooms, gateway codes). Same cookie as the admin panel. */
const hubAdmin = new Hono();
hubAdmin.use('*', async (c, next) => {
  if (!(await verifySession(c.env, getCookie(c, COOKIE)))) {
    return c.json({ error: 'Sign in as an officer first.' }, 401);
  }
  await next();
});
hubAdmin.route('/', roomsAdminRouter);
hubAdmin.route('/', gatewayAdminRouter);
hubAdmin.route('/', linksAdminRouter);
hubAdmin.route('/', ideasAdminRouter);
hubAdmin.route('/', problemsAdminRouter);

/** Call BEFORE the catch-all `/api` and static handlers. */
export function mountHub(app) {
  app.route('/gw', gatewayRouter);
  app.route('/api/admin/hub', hubAdmin); // before /api/admin so its own lock applies
  app.route('/api', usersRouter);
  app.route('/api', learnRouter);
  app.route('/api', roomsRouter);
  app.route('/api', gatewayInfoRouter);
  app.route('/api', projectsRouter);
  app.route('/api', dashboardRouter);
  app.route('/api', linksRouter);
  app.route('/api', googleRouter);
  app.route('/api', questsRouter);
  app.route('/api', ideasRouter);
  app.route('/api', problemsRouter);
}
