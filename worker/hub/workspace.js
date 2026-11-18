/**
 * D2: the workspace. A member's own multi-file projects (Python or a web
 * page), saved to their account so code written at school is there at home.
 * Every route is the owner's only: another member's workspace answers 404,
 * the same as one that does not exist. Running happens in the browser
 * (Pyodide, and a sandboxed iframe for web pages); the server only stores text.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { LIMITS, KINDS, ENTRY, STARTERS, checkSave, bytes } from '../../shared/workspace.js';

export const workspaceRouter = new Hono();

const cleanTitle = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.title);

const mine = (db, id, userId) =>
  db.prepare('SELECT id, title, kind, created_at, updated_at FROM workspaces WHERE id = ? AND user_id = ?').bind(Number(id) || 0, userId).first();

workspaceRouter.get('/workspaces', requireUser, async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT w.id, w.title, w.kind, w.updated_at, COUNT(f.path) AS files, COALESCE(SUM(length(f.content)), 0) AS size
         FROM workspaces w LEFT JOIN workspace_files f ON f.workspace_id = w.id
         WHERE w.user_id = ? GROUP BY w.id ORDER BY w.updated_at DESC, w.id DESC`
      )
      .bind(c.get('user').id)
      .all()
  ).results;
  return c.json({ workspaces: rows, limits: LIMITS });
});

workspaceRouter.post('/workspaces', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const kind = String(body?.kind ?? '');
  if (!KINDS.includes(kind)) return c.json({ error: 'Pick Python or web page.' }, 400);
  const title = cleanTitle(body?.title) || (kind === 'python' ? 'Python project' : 'Web page');
  const db = c.env.DB;
  const userId = c.get('user').id;
  const n = await db.prepare('SELECT COUNT(*) AS n FROM workspaces WHERE user_id = ?').bind(userId).first();
  if (n.n >= LIMITS.workspaces) return c.json({ error: `You have ${LIMITS.workspaces} workspaces. Delete one first.` }, 400);

  const made = await db.prepare('INSERT INTO workspaces (user_id, title, kind) VALUES (?, ?, ?)').bind(userId, title, kind).run();
  const id = made.meta.last_row_id;
  await db.batch(
    Object.entries(STARTERS[kind]).map(([path, content]) =>
      db.prepare('INSERT INTO workspace_files (workspace_id, path, content) VALUES (?, ?, ?)').bind(id, path, content)
    )
  );
  return c.json({ id });
});

workspaceRouter.get('/workspaces/:id', requireUser, async (c) => {
  const db = c.env.DB;
  const ws = await mine(db, c.req.param('id'), c.get('user').id);
  if (!ws) return c.json({ error: 'No workspace with that id.' }, 404);
  const files = (await db.prepare('SELECT path, content FROM workspace_files WHERE workspace_id = ? ORDER BY path').bind(ws.id).all()).results;
  return c.json({ ...ws, entry: ENTRY[ws.kind], files, limits: LIMITS });
});

/** Saves changed files and deletions (and a new title). Limits are checked against what is stored. */
workspaceRouter.put('/workspaces/:id', requireUser, async (c) => {
  const db = c.env.DB;
  const ws = await mine(db, c.req.param('id'), c.get('user').id);
  if (!ws) return c.json({ error: 'No workspace with that id.' }, 404);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'Send the files to save.' }, 400);

  const stored = (await db.prepare('SELECT path, content FROM workspace_files WHERE workspace_id = ?').bind(ws.id).all()).results;
  const checked = checkSave(new Map(stored.map((f) => [f.path, bytes(f.content)])), body);
  if (checked.error) return c.json({ error: checked.error }, 400);
  // The entry file runs the project, so it cannot be deleted.
  if (checked.deleted.includes(ENTRY[ws.kind])) return c.json({ error: `${ENTRY[ws.kind]} is what runs. Keep it.` }, 400);

  const title = body.title === undefined ? ws.title : cleanTitle(body.title) || ws.title;
  await db.batch([
    ...checked.deleted.map((p) => db.prepare('DELETE FROM workspace_files WHERE workspace_id = ? AND path = ?').bind(ws.id, p)),
    ...checked.files.map((f) =>
      db
        .prepare(
          `INSERT INTO workspace_files (workspace_id, path, content) VALUES (?, ?, ?)
           ON CONFLICT(workspace_id, path) DO UPDATE SET content = excluded.content`
        )
        .bind(ws.id, f.path, f.content)
    ),
    db.prepare(`UPDATE workspaces SET title = ?, updated_at = datetime('now') WHERE id = ?`).bind(title, ws.id),
  ]);
  return c.json({ ok: true, title });
});

workspaceRouter.delete('/workspaces/:id', requireUser, async (c) => {
  const db = c.env.DB;
  const ws = await mine(db, c.req.param('id'), c.get('user').id);
  if (!ws) return c.json({ error: 'No workspace with that id.' }, 404);
  await db.batch([
    db.prepare('DELETE FROM workspace_files WHERE workspace_id = ?').bind(ws.id),
    db.prepare('DELETE FROM workspaces WHERE id = ?').bind(ws.id),
  ]);
  return c.json({ ok: true });
});
