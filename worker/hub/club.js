/**
 * GET /api/club (V3-A, v2-spec section 6): the public facts every page agrees
 * on. When and where the club meets (settings an officer edits under Page
 * text), the next planned session, and the points table generated from the
 * live rules in shared/points.js. Public and cacheable: nothing here is private.
 */
import { Hono } from 'hono';

import { getAllSettings } from '../db.js';
import { loadRules } from './ledger.js';
import { pointsTable } from '../../shared/points.js';
import { kindName } from '../../shared/planner.js';
import { chicagoDate } from '../../shared/daily.js';

export const clubRouter = new Hono();

export const MEETING_KEYS = ['meeting_day', 'meeting_time', 'meeting_place', 'meeting_note'];

/** The next not-yet-held planned session in public form, or null. */
async function nextSession(db, today) {
  const r = await db
    .prepare('SELECT date, title, template, blocks FROM planned_sessions WHERE date >= ? AND room_code IS NULL ORDER BY date, id LIMIT 1')
    .bind(today)
    .first();
  if (!r) return null;
  let blocks = [];
  try {
    blocks = JSON.parse(r.blocks || '[]');
  } catch {
    /* a bad row still has a date and title */
  }
  // Wave 6 adds a speaker payload to the speaker block; only its public name is read.
  const speaker = blocks.find((b) => b?.type === 'speaker' && typeof b.speaker?.name === 'string' && b.speaker.name.trim())?.speaker.name.trim();
  return { date: r.date, title: r.title, kind: kindName(r.template), ...(speaker && { speaker }) };
}

export async function clubInfo(db, today = chicagoDate()) {
  const settings = await getAllSettings(db);
  const [day, time, place, note] = MEETING_KEYS.map((k) => String(settings[k] ?? '').trim());
  return {
    meeting: { day, time, place, note },
    next: await nextSession(db, today),
    points: pointsTable(await loadRules(db)),
  };
}

clubRouter.get('/club', async (c) => {
  const body = await clubInfo(c.env.DB);
  return c.json(body, 200, { 'Cache-Control': 'public, max-age=300' });
});
