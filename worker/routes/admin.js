/**
 * Mutating API. Every route below the login handler requires a valid session.
 *
 * This is what the admin panel talks to. A club officer never sees any of it --
 * they see forms. See LEARN-DATABASE.md.
 */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

import {
  all, first, run,
  getLeaderboard, addPointEvent, listOpportunities,
  getAllSettings, setSetting, exportBackup, restoreBackup,
} from '../db.js';
import {
  COOKIE, checkPassword, signSession, verifySession, sessionCookieOptions,
} from '../auth.js';
import { withinRadius, fingerprintOf, RADIUS_MILES } from '../geo.js';

export const adminRouter = new Hono();

/* ------------------------------- session ------------------------------- */

adminRouter.get('/session', async (c) => {
  return c.json({
    authed: await verifySession(c.env, getCookie(c, COOKIE)),
    // The scraper lives in GitHub Actions now, so the panel links there
    // instead of running it inline.
    actions_url: c.env.ACTIONS_URL ?? '',
  });
});

adminRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!checkPassword(c.env, body?.password)) {
    return c.json({ error: 'Wrong password.' }, 401);
  }
  setCookie(c, COOKIE, await signSession(c.env), sessionCookieOptions());
  return c.json({ ok: true });
});

adminRouter.post('/logout', (c) => {
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

// Everything past this line is locked.
adminRouter.use('*', async (c, next) => {
  if (await verifySession(c.env, getCookie(c, COOKIE))) return next();
  return c.json({ error: 'Not signed in.' }, 401);
});

/* ------------------------------- students ------------------------------- */

adminRouter.get('/students', async (c) => {
  return c.json({
    students: await all(c.env.DB, 'SELECT * FROM students ORDER BY active DESC, name'),
    leaderboard: await getLeaderboard(c.env.DB),
  });
});

adminRouter.post('/students', async (c) => {
  const { name, grade } = await c.req.json().catch(() => ({}));
  if (!name?.trim()) return c.json({ error: 'A name is required.' }, 400);
  const info = await run(
    c.env.DB,
    'INSERT INTO students (name, grade, avatar_seed) VALUES (?, ?, ?)',
    name.trim(),
    Number(grade) || null,
    name.trim().toLowerCase().replace(/\W+/g, '')
  );
  return c.json({ id: info.meta?.last_row_id });
});

adminRouter.patch('/students/:id', async (c) => {
  const id = c.req.param('id');
  const { name, grade, active } = await c.req.json().catch(() => ({}));
  const current = await first(c.env.DB, 'SELECT * FROM students WHERE id = ?', id);
  if (!current) return c.json({ error: 'No student with that id.' }, 404);
  await run(
    c.env.DB,
    'UPDATE students SET name = ?, grade = ?, active = ? WHERE id = ?',
    name?.trim() || current.name,
    grade === undefined ? current.grade : Number(grade) || null,
    active === undefined ? current.active : active ? 1 : 0,
    id
  );
  return c.json({ ok: true });
});

adminRouter.delete('/students/:id', async (c) => {
  await run(c.env.DB, 'DELETE FROM students WHERE id = ?', c.req.param('id'));
  return c.json({ ok: true });
});

/* -------------------------------- points -------------------------------- */

adminRouter.get('/points/:studentId', async (c) => {
  return c.json({
    events: await all(
      c.env.DB,
      'SELECT * FROM point_events WHERE student_id = ? ORDER BY created_at DESC, id DESC',
      c.req.param('studentId')
    ),
  });
});

adminRouter.post('/points', async (c) => {
  const { student_id, delta, reason } = await c.req.json().catch(() => ({}));
  const amount = Number(delta);
  if (!student_id) return c.json({ error: 'Pick a student.' }, 400);
  if (!Number.isFinite(amount) || amount === 0) {
    return c.json({ error: 'Enter a point amount other than zero.' }, 400);
  }
  if (!reason?.trim()) {
    return c.json({ error: 'Give a reason so the student can see why.' }, 400);
  }
  const id = await addPointEvent(c.env.DB, { student_id, delta: amount, reason: reason.trim() });
  return c.json({ id });
});

/** Bulk award -- one reason, many students. This is the meeting-attendance button. */
adminRouter.post('/points/bulk', async (c) => {
  const { student_ids, delta, reason } = await c.req.json().catch(() => ({}));
  const amount = Number(delta);
  if (!Array.isArray(student_ids) || !student_ids.length) {
    return c.json({ error: 'Pick at least one student.' }, 400);
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return c.json({ error: 'Enter a point amount other than zero.' }, 400);
  }
  if (!reason?.trim()) return c.json({ error: 'Give a reason.' }, 400);

  await c.env.DB.batch(
    student_ids.map((sid) =>
      c.env.DB
        .prepare('INSERT INTO point_events (student_id, delta, reason) VALUES (?, ?, ?)')
        .bind(sid, Math.trunc(amount), reason.trim())
    )
  );
  return c.json({ ok: true, count: student_ids.length });
});

adminRouter.delete('/points/:id', async (c) => {
  await run(c.env.DB, 'DELETE FROM point_events WHERE id = ?', c.req.param('id'));
  return c.json({ ok: true });
});

/* -------------------------------- badges -------------------------------- */

adminRouter.get('/badges', async (c) => {
  return c.json({
    badges: await all(c.env.DB, 'SELECT * FROM badges ORDER BY name'),
    awarded: await all(c.env.DB, 'SELECT * FROM student_badges'),
  });
});

adminRouter.post('/badges', async (c) => {
  const { name, emoji, description, color } = await c.req.json().catch(() => ({}));
  if (!name?.trim()) return c.json({ error: 'A badge name is required.' }, 400);
  try {
    const info = await run(
      c.env.DB,
      'INSERT INTO badges (name, emoji, description, color) VALUES (?, ?, ?, ?)',
      name.trim(),
      emoji || '🏅',
      description || '',
      color || 'violet'
    );
    return c.json({ id: info.meta?.last_row_id });
  } catch (err) {
    return c.json(
      {
        error: String(err.message).includes('UNIQUE')
          ? 'A badge with that name already exists.'
          : err.message,
      },
      400
    );
  }
});

adminRouter.delete('/badges/:id', async (c) => {
  await run(c.env.DB, 'DELETE FROM badges WHERE id = ?', c.req.param('id'));
  return c.json({ ok: true });
});

adminRouter.post('/badges/award', async (c) => {
  const { student_id, badge_id } = await c.req.json().catch(() => ({}));
  if (!student_id || !badge_id) {
    return c.json({ error: 'Pick both a student and a badge.' }, 400);
  }
  await run(
    c.env.DB,
    'INSERT OR IGNORE INTO student_badges (student_id, badge_id) VALUES (?, ?)',
    student_id,
    badge_id
  );
  return c.json({ ok: true });
});

adminRouter.post('/badges/revoke', async (c) => {
  const { student_id, badge_id } = await c.req.json().catch(() => ({}));
  await run(
    c.env.DB,
    'DELETE FROM student_badges WHERE student_id = ? AND badge_id = ?',
    student_id,
    badge_id
  );
  return c.json({ ok: true });
});

/* ----------------------------- opportunities ----------------------------- */

adminRouter.get('/opportunities', async (c) => {
  return c.json({ opportunities: await listOpportunities(c.env.DB, { status: 'all' }) });
});

const OPP_FIELDS = [
  'title', 'org', 'description', 'url', 'type', 'deadline', 'cost',
  'format', 'location', 'age_min', 'age_max', 'status',
];

adminRouter.post('/opportunities', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.title?.trim()) return c.json({ error: 'A title is required.' }, 400);

  const geo = await withinRadius(body);
  if (!geo.keep) {
    return c.json(
      {
        error:
          `That location is ${geo.distance_mi} miles from school, past the ` +
          `${RADIUS_MILES}-mile limit. Change the format to online or residential ` +
          `if travel is not required.`,
      },
      400
    );
  }

  const row = Object.fromEntries(OPP_FIELDS.map((f) => [f, body[f] ?? null]));
  const values = {
    ...row,
    type: row.type || 'program',
    cost: row.cost || 'free',
    format: row.format || 'online',
    status: row.status || 'live',
    age_min: Number(row.age_min) || 14,
    age_max: Number(row.age_max) || 18,
    org: row.org ?? '',
    description: row.description ?? '',
    url: row.url ?? '',
    location: row.location ?? '',
    deadline: row.deadline || null,
  };

  try {
    const info = await run(
      c.env.DB,
      `INSERT INTO opportunities
         (${OPP_FIELDS.join(',')}, lat, lng, distance_mi, needs_review, source, fingerprint)
       VALUES (${OPP_FIELDS.map(() => '?').join(',')}, ?, ?, ?, ?, 'manual', ?)`,
      ...OPP_FIELDS.map((f) => values[f]),
      geo.lat,
      geo.lng,
      geo.distance_mi,
      geo.needs_review,
      fingerprintOf(body)
    );
    return c.json({ id: info.meta?.last_row_id });
  } catch (err) {
    return c.json(
      {
        error: String(err.message).includes('UNIQUE')
          ? 'That opportunity is already on the board.'
          : err.message,
      },
      400
    );
  }
});

adminRouter.patch('/opportunities/:id', async (c) => {
  const id = c.req.param('id');
  const current = await first(c.env.DB, 'SELECT * FROM opportunities WHERE id = ?', id);
  if (!current) return c.json({ error: 'No opportunity with that id.' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const merged = { ...current, ...body };

  const locationChanged =
    merged.format !== current.format || merged.location !== current.location;
  const geo = locationChanged
    ? await withinRadius({ ...merged, lat: null, lng: null })
    : {
        keep: true,
        lat: current.lat,
        lng: current.lng,
        distance_mi: current.distance_mi,
        needs_review: current.needs_review,
      };

  if (!geo.keep) {
    return c.json(
      { error: `That location is ${geo.distance_mi} miles from school, past the limit.` },
      400
    );
  }

  await run(
    c.env.DB,
    `UPDATE opportunities SET
       ${OPP_FIELDS.map((f) => `${f} = ?`).join(', ')},
       lat = ?, lng = ?, distance_mi = ?, needs_review = ?
     WHERE id = ?`,
    ...OPP_FIELDS.map((f) => (f === 'deadline' ? merged.deadline || null : merged[f] ?? null)),
    geo.lat,
    geo.lng,
    geo.distance_mi,
    geo.needs_review,
    id
  );
  return c.json({ ok: true });
});

adminRouter.delete('/opportunities/:id', async (c) => {
  await run(c.env.DB, 'DELETE FROM opportunities WHERE id = ?', c.req.param('id'));
  return c.json({ ok: true });
});

/* ------------------------------- settings ------------------------------- */

adminRouter.get('/settings', async (c) => {
  return c.json({ settings: await getAllSettings(c.env.DB) });
});

adminRouter.put('/settings', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const updates = body?.settings ?? {};
  const entries = Object.entries(updates);
  if (entries.length) {
    await c.env.DB.batch(
      entries.map(([k, v]) =>
        c.env.DB
          .prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
          )
          .bind(k, String(v ?? ''))
      )
    );
  }
  return c.json({ ok: true });
});

/* --------------------------- backup / restore --------------------------- */

adminRouter.get('/backup', async (c) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(await exportBackup(c.env.DB), null, 2);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="cs-club-backup-${stamp}.json"`,
    },
  });
});

adminRouter.post('/restore', async (c) => {
  try {
    await restoreBackup(c.env.DB, await c.req.json());
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});

export { setSetting };
