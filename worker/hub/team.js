/**
 * Officer identity (A7). One guard decides who counts as an officer for every
 * officer route: a signed-in account whose role is officer or lead, or the
 * shared password cookie as break-glass. The role is read from the database on
 * every request, never from the cookie, so a demotion takes effect at once.
 *
 * Also owns the audit log (`officer_log`) and the Team routes that promote and
 * demote officers.
 */
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';

import { COOKIE, verifySession } from '../auth.js';
import { currentUser } from './users.js';

export const ROLES = ['member', 'officer', 'lead'];
const STAFF = new Set(['officer', 'lead']);

/** What the shared password stands for. It must be able to fix a broken team, so it acts as lead. */
export const BREAK_GLASS = Object.freeze({ userId: null, name: 'shared login', role: 'lead' });

/**
 * `{ userId, name, role }` for whoever is acting as an officer, or null.
 * An officer account wins over the shared cookie so actions are attributed to a person.
 */
export async function officerOf(c) {
  const user = await currentUser(c);
  if (user && STAFF.has(user.role)) return { userId: user.id, name: user.name, role: user.role };
  if (await verifySession(c.env, getCookie(c, COOKIE))) return BREAK_GLASS;
  return null;
}

/** Hono middleware for every officer route. Sets c.get('officer'). */
export async function requireOfficer(c, next) {
  const officer = await officerOf(c);
  if (!officer) return c.json({ error: 'Sign in as an officer first.' }, 401);
  c.set('officer', officer);
  await next();
}

export function logOfficer(db, officer, action, detail = '') {
  return db
    .prepare('INSERT INTO officer_log (ts, officer_user_id, officer_name, action, detail) VALUES (?, ?, ?, ?, ?)')
    .bind(Date.now(), officer?.userId ?? null, officer?.name ?? 'unknown', action, String(detail).slice(0, 300))
    .run();
}

/**
 * Middleware: after a successful write, record method and path. Routes that
 * write a more specific entry themselves set c.set('logged', true).
 */
export async function auditWrites(c, next) {
  await next();
  if (c.req.method === 'GET' || c.res.status >= 400 || c.get('logged')) return;
  await logOfficer(c.env.DB, c.get('officer'), 'write', `${c.req.method} ${c.req.path}`);
}

/* ---------------------------------- routes --------------------------------- */

export const teamAdminRouter = new Hono();

teamAdminRouter.get('/team', async (c) => {
  const db = c.env.DB;
  const officers = (
    await db
      .prepare(`SELECT id, name, email, role FROM users WHERE role IN ('officer', 'lead') ORDER BY role = 'lead' DESC, name`)
      .all()
  ).results;
  const log = (await db.prepare('SELECT * FROM officer_log ORDER BY ts DESC, rowid DESC LIMIT 50').all()).results;
  return c.json({ me: c.get('officer'), officers, log });
});

teamAdminRouter.get('/team/search', async (c) => {
  const q = String(c.req.query('q') ?? '').trim().slice(0, 40);
  if (q.length < 2) return c.json({ members: [] });
  const members = (
    await c.env.DB
      .prepare(`SELECT id, name, email, role FROM users WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 20`)
      .bind(`%${q.replace(/[\\%_]/g, '\\$&')}%`)
      .all()
  ).results;
  return c.json({ members });
});

teamAdminRouter.post('/team/:id/role', async (c) => {
  const officer = c.get('officer');
  if (officer.role !== 'lead') return c.json({ error: 'Only a lead can change roles.' }, 403);

  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const role = String(body?.role ?? '');
  if (!Number.isInteger(id) || id < 1) return c.json({ error: 'No such account.' }, 404);
  if (!ROLES.includes(role)) return c.json({ error: 'Role must be member, officer or lead.' }, 400);

  const db = c.env.DB;
  const target = await db.prepare('SELECT id, name, role FROM users WHERE id = ?').bind(id).first();
  if (!target) return c.json({ error: 'No such account.' }, 404);
  if (target.role === role) return c.json({ ok: true, role });

  // The lead count is checked inside the UPDATE so two leads demoting each
  // other at the same moment cannot leave the club with none.
  const res = await db
    .prepare(
      `UPDATE users SET role = ? WHERE id = ?
         AND (role != 'lead' OR ? = 'lead' OR (SELECT COUNT(*) FROM users WHERE role = 'lead') > 1)`
    )
    .bind(role, id, role)
    .run();
  if (!res.meta?.changes) {
    return c.json({ error: 'That is the last lead. Make someone else lead first.' }, 409);
  }

  await logOfficer(db, officer, 'role', `${target.name} (#${id}): ${target.role || 'member'} to ${role}`);
  c.set('logged', true);
  return c.json({ ok: true, role });
});
