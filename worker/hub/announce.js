/**
 * G3: write an announcement once, send it where it can be sent. Discord goes
 * out by webhook; the weekly digest picks up queued notes (settings key
 * `digest_notes`, a JSON array, cleared after a real send). Classroom and
 * social text is copied by hand on the officer screen: no API exists for them.
 */
import { Hono } from 'hono';

import { getSetting, setSetting } from '../db.js';
import { notify } from './notify.js';

export const announceAdminRouter = new Hono();

const MAX = 1000;

announceAdminRouter.get('/announce', async (c) => {
  const notes = JSON.parse(await getSetting(c.env.DB, 'digest_notes', '[]') || '[]');
  return c.json({ digestNotes: notes });
});

announceAdminRouter.post('/announce', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const text = String(body?.text ?? '').trim();
  if (!text) return c.json({ error: 'Write a message first.' }, 400);
  if (text.length > MAX) return c.json({ error: `Keep it under ${MAX} characters.` }, 400);

  if (body.to === 'discord') {
    const ok = await notify(c.env, c.env.DB, text);
    if (!ok) return c.json({ error: 'Discord did not take it. Check the webhook URL in settings.' }, 502);
    return c.json({ ok: true });
  }
  if (body.to === 'digest') {
    const notes = JSON.parse((await getSetting(c.env.DB, 'digest_notes', '[]')) || '[]');
    notes.push(text);
    await setSetting(c.env.DB, 'digest_notes', JSON.stringify(notes.slice(-10)));
    return c.json({ ok: true, queued: notes.length });
  }
  return c.json({ error: 'Choose discord or digest.' }, 400);
});

announceAdminRouter.delete('/announce/digest', async (c) => {
  await setSetting(c.env.DB, 'digest_notes', '[]');
  return c.json({ ok: true });
});
