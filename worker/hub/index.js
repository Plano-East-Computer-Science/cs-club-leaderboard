/**
 * Everything added for the club hub, mounted from worker/index.js in one place
 * so the original leaderboard routes stay exactly as they were.
 */
import { Hono } from 'hono';

import { requireOfficer, auditWrites, teamAdminRouter } from './team.js';
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
import { announceAdminRouter } from './announce.js';
import { ledgerRouter, ledgerAdminRouter } from './ledger.js';
import { claimsRouter, claimsAdminRouter } from './claims.js';
import { dailyRouter, dailyAdminRouter } from './daily.js';
import { boardRouter, boardAdminRouter } from './board.js';
import { codeforcesRouter } from './codeforces.js';
import { standingsRouter, standingsAdminRouter } from './standings.js';

import { safetyRouter, safetyAdminRouter } from './safety.js';
import { recordsRouter, recordsAdminRouter } from './records.js';

export { Room } from './room-do.js';

/** Officer-only hub controls (rooms, gateway codes, team). Same guard as the admin panel. */
const hubAdmin = new Hono();
hubAdmin.use('*', requireOfficer);
hubAdmin.use('*', auditWrites);
hubAdmin.route('/', teamAdminRouter);
hubAdmin.route('/', roomsAdminRouter);
hubAdmin.route('/', gatewayAdminRouter);
hubAdmin.route('/', linksAdminRouter);
hubAdmin.route('/', ideasAdminRouter);
hubAdmin.route('/', problemsAdminRouter);
hubAdmin.route('/', announceAdminRouter);
hubAdmin.route('/', ledgerAdminRouter);
hubAdmin.route('/', claimsAdminRouter);
hubAdmin.route('/', dailyAdminRouter);
hubAdmin.route('/', boardAdminRouter);
hubAdmin.route('/', standingsAdminRouter);

hubAdmin.route('/', safetyAdminRouter);
hubAdmin.route('/', recordsAdminRouter);

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
  app.route('/api', ledgerRouter);
  app.route('/api', claimsRouter);
  app.route('/api', dailyRouter);
  app.route('/api', boardRouter);
  app.route('/api', codeforcesRouter);
  app.route('/api', standingsRouter);

  app.route('/api', safetyRouter);
  app.route('/api', recordsRouter);
}
