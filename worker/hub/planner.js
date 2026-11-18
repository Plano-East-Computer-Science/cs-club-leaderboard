/**
 * Meeting planner (G1). Officers plan upcoming sessions from a template with
 * its blocks filled in; members see only the next one (date, title, kind) on
 * Today, in the digest and in the calendar feed.
 *
 * Opening a room for a plan is POST /rooms with { planId } (rooms.js): the room
 * takes the plan's template and blocks and the plan records its room code,
 * which is what "held" means. Blocks go through the same cleanBlocks as the
 * host's block editor.
 */
import { Hono } from 'hono';

import { TEMPLATES, cleanBlocks, templateBlocks } from '../../shared/session-templates.js';
import { publicPlan, validDate } from '../../shared/planner.js';
import { chicagoDate } from '../../shared/daily.js';

export const plannerAdminRouter = new Hono();

const rowToPlan = (r) => ({
  id: r.id,
  date: r.date,
  title: r.title,
  template: r.template,
  blocks: JSON.parse(r.blocks || '[]'),
  ideaId: r.idea_id,
  roomCode: r.room_code,
});

export const getPlan = async (db, id) => {
  const r = await db.prepare('SELECT * FROM planned_sessions WHERE id = ?').bind(id).first();
  return r ? rowToPlan(r) : null;
};

/** The next not-yet-held plan on or after today, in member-safe form, or null. */
export async function nextPublicPlan(db, today = chicagoDate()) {
  const r = await db
    .prepare('SELECT * FROM planned_sessions WHERE date >= ? AND room_code IS NULL ORDER BY date, id LIMIT 1')
    .bind(today)
    .first();
  return r ? publicPlan(rowToPlan(r)) : null;
}

/** Upcoming plans for the calendar feed: member-safe form only. */
export async function upcomingPublicPlans(db, today = chicagoDate()) {
  const rows = (await db.prepare('SELECT * FROM planned_sessions WHERE date >= ? ORDER BY date, id LIMIT 50').bind(today).all()).results;
  return rows.map((r) => publicPlan(rowToPlan(r)));
}

/** Validates a body. Returns { error } or the clean fields. */
async function clean(db, body) {
  const date = String(body?.date ?? '');
  if (!validDate(date)) return { error: 'Pick a date.' };
  const title = String(body?.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!title) return { error: 'Give the session a title.' };
  const template = String(body?.template ?? '');
  if (!Object.hasOwn(TEMPLATES, template)) return { error: 'Pick a template.' };
  let blocks = cleanBlocks(body?.blocks);
  if (!blocks.length) blocks = templateBlocks(template);
  let ideaId = null;
  if (body?.ideaId != null && body.ideaId !== '') {
    ideaId = Number(body.ideaId);
    if (!Number.isInteger(ideaId) || !(await db.prepare(`SELECT 1 AS x FROM ideas WHERE id = ? AND status != 'hidden'`).bind(ideaId).first())) {
      return { error: 'That idea is not on the board.' };
    }
  }
  return { date, title, template, blocks, ideaId };
}

/** An idea is "planned" while some plan points at it; releasing the last plan reopens it. */
async function syncIdea(db, ideaId) {
  if (!ideaId) return;
  const used = await db.prepare('SELECT 1 AS x FROM planned_sessions WHERE idea_id = ?').bind(ideaId).first();
  if (used) await db.prepare(`UPDATE ideas SET status = 'planned' WHERE id = ? AND status = 'open'`).bind(ideaId).run();
  else await db.prepare(`UPDATE ideas SET status = 'open' WHERE id = ? AND status = 'planned'`).bind(ideaId).run();
}

plannerAdminRouter.get('/planner', async (c) => {
  const db = c.env.DB;
  const plans = (await db.prepare(`SELECT * FROM planned_sessions WHERE date >= date('now', '-30 days') ORDER BY date, id`).all()).results.map(rowToPlan);
  // Held meetings (not drop-ins) feed the variety warning; plans without a room join them client side.
  const held = (
    await db
      .prepare(`SELECT substr(created_at, 1, 10) AS date, template FROM rooms WHERE kind = 'meeting' AND template != '' ORDER BY created_at DESC LIMIT 12`)
      .all()
  ).results;
  const ideas = (
    await db
      .prepare(
        `SELECT i.id, i.kind, i.body, i.status FROM ideas i WHERE i.status IN ('open', 'planned')
         ORDER BY (SELECT COUNT(*) FROM idea_votes v WHERE v.idea_id = i.id) DESC, i.created_at DESC LIMIT 50`
      )
      .all()
  ).results;
  return c.json({ plans, held, ideas, today: chicagoDate() });
});

plannerAdminRouter.post('/planner', async (c) => {
  const db = c.env.DB;
  const p = await clean(db, await c.req.json().catch(() => ({})));
  if (p.error) return c.json({ error: p.error }, 400);
  const res = await db
    .prepare('INSERT INTO planned_sessions (date, title, template, blocks, idea_id) VALUES (?, ?, ?, ?, ?)')
    .bind(p.date, p.title, p.template, JSON.stringify(p.blocks), p.ideaId)
    .run();
  await syncIdea(db, p.ideaId);
  return c.json(await getPlan(db, res.meta.last_row_id));
});

plannerAdminRouter.put('/planner/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const old = await getPlan(db, id);
  if (!old) return c.json({ error: 'No such session.' }, 404);
  if (old.roomCode) return c.json({ error: 'That session already has a room, so its plan is locked.' }, 409);
  const p = await clean(db, await c.req.json().catch(() => ({})));
  if (p.error) return c.json({ error: p.error }, 400);
  await db
    .prepare('UPDATE planned_sessions SET date = ?, title = ?, template = ?, blocks = ?, idea_id = ? WHERE id = ?')
    .bind(p.date, p.title, p.template, JSON.stringify(p.blocks), p.ideaId, id)
    .run();
  await syncIdea(db, old.ideaId);
  await syncIdea(db, p.ideaId);
  return c.json(await getPlan(db, id));
});

plannerAdminRouter.delete('/planner/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const old = await getPlan(db, id);
  if (!old) return c.json({ error: 'No such session.' }, 404);
  await db.prepare('DELETE FROM planned_sessions WHERE id = ?').bind(id).run();
  await syncIdea(db, old.ideaId);
  return c.json({ ok: true });
});
