/**
 * Pathways (E5): follow a goal page, see each step's state, tick steps by
 * hand. Content and the done rules are in shared/pathways.js; this file only
 * gathers what the data already says about a member (`factsFor`) and stores
 * follows and hand ticks. Nothing here writes to the ledger: a pathway is a
 * plan, not a points source.
 */
import { Hono } from 'hono';

import { COURSES } from '../../shared/courses.js';
import { PATHWAYS, MAX_FOLLOW, pathwayOf, stepStates, nextPathwayStep } from '../../shared/pathways.js';
import { requireUser } from './users.js';

export const pathwaysRouter = new Hono();

const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
const one = async (db, sql, ...args) => Boolean(await db.prepare(sql).bind(...args).first());

/** Everything the done rules read, for one member, in a handful of queries. */
export async function factsFor(db, user) {
  const sid = user.student_id ?? 0;
  const rungs = await all(db, `SELECT r.track, r.url FROM rung_progress g JOIN rungs r ON r.id = g.rung_id WHERE g.user_id = ? AND g.status = 'done'`, user.id);
  const steps = await all(db, 'SELECT course, COUNT(DISTINCT step) AS n FROM step_progress WHERE user_id = ? AND passed_at IS NOT NULL GROUP BY course', user.id);
  const courses = new Set(steps.filter((s) => s.n >= (COURSES.find((c) => c.slug === s.course)?.steps.length ?? Infinity)).map((s) => s.course));
  const opps = await all(
    db,
    `SELECT o.title, o.org, o.type FROM opportunity_interest i JOIN opportunities o ON o.id = i.opportunity_id WHERE i.user_id = ?
     UNION SELECT o.title, o.org, o.type FROM activity a JOIN opportunities o ON a.ref = 'opp:' || o.id
       WHERE a.student_id = ? AND a.kind = 'compete' AND a.status != 'rejected'`,
    user.id,
    sid
  );
  const comps = (await all(db, 'SELECT c.name FROM competition_roster r JOIN competitions c ON c.id = r.competition_id WHERE r.user_id = ?', user.id)).map((r) => r.name);
  return {
    rungs: new Set(rungs.map((r) => `${r.track} ${r.url}`)),
    courses,
    opps,
    comps,
    entered: await one(db, 'SELECT 1 AS x FROM cycle_members WHERE user_id = ?', user.id),
    shipped: await one(db, `SELECT 1 AS x FROM activity WHERE student_id = ? AND kind = 'ship' AND ref LIKE 'cycle:%' AND status = 'approved'`, sid),
    projects: (await db.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?').bind(user.id).first()).n,
    public: await one(db, 'SELECT 1 AS x FROM portfolio_public WHERE user_id = ?', user.id),
    signoff: await one(db, 'SELECT 1 AS x FROM portfolio_signoffs WHERE user_id = ?', user.id),
    record: await one(db, 'SELECT 1 AS x FROM record_codes WHERE user_id = ? AND revoked_at IS NULL', user.id),
  };
}

/** The pathways a member follows, oldest first, each with a Set of ticked step ids. */
async function followedBy(db, userId) {
  const follows = await all(db, 'SELECT pathway FROM pathway_follows WHERE user_id = ? ORDER BY created_at, rowid', userId);
  const ticks = await all(db, 'SELECT pathway, step FROM pathway_ticks WHERE user_id = ?', userId);
  const tickSet = (id) => new Set(ticks.filter((t) => t.pathway === id).map((t) => t.step));
  return { list: follows.map((f) => ({ id: f.pathway, ticks: tickSet(f.pathway) })), tickSet };
}

/** For Today: the first undone step of the pathways a member follows, or null. */
export async function pathwayNextFor(db, user) {
  const { list } = await followedBy(db, user.id);
  if (!list.length) return null;
  return nextPathwayStep(list, await factsFor(db, user));
}

/** Every pathway with done counts, and which ones you follow. */
pathwaysRouter.get('/me/pathways', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const facts = await factsFor(db, user);
  const { list, tickSet } = await followedBy(db, user.id);
  const progress = Object.fromEntries(
    PATHWAYS.map((p) => [p.id, { done: stepStates(p, facts, tickSet(p.id)).filter((s) => s.done).length, total: p.steps.length }])
  );
  return c.json({ following: list.map((f) => f.id), progress, max: MAX_FOLLOW });
});

const pathwayParam = (c) => pathwayOf(c.req.param('id'));

pathwaysRouter.get('/me/pathways/:id', requireUser, async (c) => {
  const p = pathwayParam(c);
  if (!p) return c.json({ error: 'No such pathway.' }, 404);
  const db = c.env.DB;
  const user = c.get('user');
  const { list, tickSet } = await followedBy(db, user.id);
  return c.json({ following: list.some((f) => f.id === p.id), followCount: list.length, max: MAX_FOLLOW, steps: stepStates(p, await factsFor(db, user), tickSet(p.id)) });
});

pathwaysRouter.post('/me/pathways/:id/follow', requireUser, async (c) => {
  const p = pathwayParam(c);
  if (!p) return c.json({ error: 'No such pathway.' }, 404);
  const db = c.env.DB;
  const id = c.get('user').id;
  if (await one(db, 'SELECT 1 AS x FROM pathway_follows WHERE user_id = ? AND pathway = ?', id, p.id)) return c.json({ following: true });
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM pathway_follows WHERE user_id = ?').bind(id).first()).n;
  if (n >= MAX_FOLLOW) return c.json({ error: `You can follow ${MAX_FOLLOW} pathways at a time. Stop following one first.` }, 409);
  await db.prepare('INSERT OR IGNORE INTO pathway_follows (user_id, pathway) VALUES (?, ?)').bind(id, p.id).run();
  return c.json({ following: true });
});

pathwaysRouter.delete('/me/pathways/:id/follow', requireUser, async (c) => {
  const p = pathwayParam(c);
  if (!p) return c.json({ error: 'No such pathway.' }, 404);
  await c.env.DB.prepare('DELETE FROM pathway_follows WHERE user_id = ? AND pathway = ?').bind(c.get('user').id, p.id).run();
  return c.json({ following: false });
});

/** Tick or untick one step. Ticks are kept even if you stop following, so picking it up again keeps your place. */
pathwaysRouter.put('/me/pathways/:id/steps/:step', requireUser, async (c) => {
  const p = pathwayParam(c);
  if (!p) return c.json({ error: 'No such pathway.' }, 404);
  const step = p.steps.find((s) => s.id === c.req.param('step'));
  if (!step) return c.json({ error: 'No such step.' }, 404);
  const body = await c.req.json().catch(() => null);
  if (typeof body?.done !== 'boolean') return c.json({ error: 'Say whether the step is done.' }, 400);
  const db = c.env.DB;
  const id = c.get('user').id;
  if (body.done) await db.prepare('INSERT OR IGNORE INTO pathway_ticks (user_id, pathway, step) VALUES (?, ?, ?)').bind(id, p.id, step.id).run();
  else await db.prepare('DELETE FROM pathway_ticks WHERE user_id = ? AND pathway = ? AND step = ?').bind(id, p.id, step.id).run();
  return c.json({ done: body.done });
});
