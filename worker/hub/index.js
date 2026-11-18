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
import { cyclesRouter, cyclesAdminRouter } from './cycles.js';
import { teamPostsRouter } from './team-posts.js';

import { safetyRouter, safetyAdminRouter } from './safety.js';
import { recordsRouter, recordsAdminRouter } from './records.js';
import { portfolioRouter, portfolioAdminRouter } from './portfolio.js';
import { competeRouter, competeAdminRouter } from './compete.js';
import { savedRouter } from './saved.js';
import { analyticsAdminRouter } from './analytics.js';
import { workspaceRouter } from './workspace.js';
import { plannerAdminRouter } from './planner.js';
import { ctfRouter, ctfAdminRouter } from './ctf.js';
import { dataRouter, dataAdminRouter } from './data.js';
import { readerRouter, readerAdminRouter } from './reader.js';
import { editorialsRouter, editorialsAdminRouter } from './editorials.js';
import { reviewsRouter } from './reviews.js';
import { handoffRouter, handoffAdminRouter } from './handoff.js';
import { researchRouter, researchAdminRouter } from './research.js';
import { alumniRouter, alumniAdminRouter } from './alumni.js';
import { pathwaysRouter } from './pathways.js';
import { quantRouter, quantAdminRouter } from './quant.js';

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
hubAdmin.route('/', cyclesAdminRouter);

hubAdmin.route('/', safetyAdminRouter);
hubAdmin.route('/', recordsAdminRouter);
hubAdmin.route('/', portfolioAdminRouter);
hubAdmin.route('/', competeAdminRouter);
hubAdmin.route('/', analyticsAdminRouter);
hubAdmin.route('/', plannerAdminRouter);
hubAdmin.route('/', ctfAdminRouter);
hubAdmin.route('/', dataAdminRouter);
hubAdmin.route('/', editorialsAdminRouter);
hubAdmin.route('/', readerAdminRouter);
hubAdmin.route('/', handoffAdminRouter);
hubAdmin.route('/', researchAdminRouter);
hubAdmin.route('/', alumniAdminRouter);
hubAdmin.route('/', quantAdminRouter);

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
  app.route('/api', editorialsRouter);
  app.route('/api', problemsRouter);
  app.route('/api', ledgerRouter);
  app.route('/api', claimsRouter);
  app.route('/api', dailyRouter);
  app.route('/api', boardRouter);
  app.route('/api', codeforcesRouter);
  app.route('/api', standingsRouter);

  app.route('/api', safetyRouter);
  app.route('/api', recordsRouter);
  app.route('/api', portfolioRouter);
  app.route('/api', cyclesRouter);
  app.route('/api', teamPostsRouter);
  app.route('/api', competeRouter);
  app.route('/api', savedRouter);
  app.route('/api', workspaceRouter);
  app.route('/api', ctfRouter);
  app.route('/api', dataRouter);
  app.route('/api', readerRouter);
  app.route('/api', reviewsRouter);
  app.route('/api', handoffRouter);
  app.route('/api', researchRouter);
  app.route('/api', alumniRouter);
  app.route('/api', pathwaysRouter);
  app.route('/api', quantRouter);
}
