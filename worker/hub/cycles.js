/**
 * Ship cycles (D1). An officer opens a themed cycle; members enter with a
 * project and a one-line pitch, form a team of up to four, post short devlogs,
 * demo on the last meeting and vote. Closing the cycle pays a `ship` activity
 * to every member of every entry that was demoed, through the ledger (A2), so
 * the claims queue and the points rules stay the one place points come from.
 *
 * The rules (state machine, votes, team size, devlog checks) are plain
 * functions that throw CycleError, so routes and tests call the same code.
 */
import { Hono } from 'hono';

import { currentUser, requireUser, ensureStudent } from './users.js';
import { recordActivity, officerOf, LedgerError } from './ledger.js';

export const cyclesRouter = new Hono();
export const cyclesAdminRouter = new Hono();

export const MAX_TEAM = 4;
export const STATES = ['draft', 'open', 'demo', 'closed'];
const NEXT = { draft: 'open', open: 'demo', demo: 'closed' };
const DEVLOGS_PER_DAY = 10;

export class CycleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const fail = (c, err) => {
  if (err instanceof CycleError || err instanceof LedgerError) return c.json({ error: err.message }, err.status);
  throw err;
};

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'Someone';
/** "Ava K." so two Avas can be told apart when picking a teammate. */
const shortName = (s) => {
  const [a, b] = String(s ?? '').trim().split(/\s+/);
  return b ? `${a} ${b[0]}.` : a || 'Someone';
};
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'cycle';
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/* ------------------------------- pure rules ------------------------------- */

/** Cycles only move forward, one step at a time: draft, open, demo, closed. */
export const canMove = (from, to) => NEXT[from] === to;

/** A devlog is a short post with an optional https link or image. */
export function cleanDevlog(input) {
  const text = clip(input?.text, 280);
  if (text.length < 3) return { error: 'Write a few words about what you did.' };
  if (String(input?.text ?? '').trim().length > 280) return { error: 'Devlogs are 280 characters at most.' };
  const raw = String(input?.url ?? '').trim();
  let url = '';
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' || raw.length > 500) throw new Error();
      url = u.href;
    } catch {
      return { error: 'The link must be a valid https:// address.' };
    }
  }
  return { value: { text, url } };
}

export function cleanPitch(s) {
  const pitch = clip(s, 140);
  return pitch.length < 8 ? { error: 'Pitch it in one line (8 characters or more).' } : { value: pitch };
}

/** Entries ranked by votes; everyone tied on the top count (above zero) wins. */
export function winnersOf(entries) {
  const top = Math.max(0, ...entries.map((e) => e.votes));
  return top > 0 ? entries.filter((e) => e.votes === top) : [];
}

/* ------------------------------ db operations ------------------------------ */

async function cycleById(db, id) {
  const cycle = await db.prepare('SELECT * FROM cycles WHERE id = ?').bind(Number(id)).first();
  if (!cycle) throw new CycleError('No such cycle.', 404);
  return cycle;
}

async function entryOf(db, cycleId, entryId) {
  const e = await db
    .prepare(
      `SELECT e.*, p.title, p.user_id AS project_owner FROM cycle_entries e JOIN projects p ON p.id = e.project_id
       WHERE e.id = ? AND e.cycle_id = ?`
    )
    .bind(Number(entryId), cycleId)
    .first();
  if (!e) throw new CycleError('No such entry.', 404);
  return e;
}

const teamOf = async (db, entryId) =>
  (await db.prepare('SELECT user_id FROM cycle_members WHERE entry_id = ?').bind(entryId).all()).results.map((r) => r.user_id);

export async function createCycle(db, input) {
  const title = clip(input?.title, 80);
  if (title.length < 3) throw new CycleError('Give the cycle a title.');
  let theme = clip(input?.theme, 400);
  const rubric = clip(input?.rubric, 600);
  const starts = String(input?.starts_on ?? '').trim();
  const demo = String(input?.demo_on ?? '').trim();
  if ((starts && !isDate(starts)) || (demo && !isDate(demo))) throw new CycleError('Dates look like 2026-12-04.');
  if (starts && demo && demo < starts) throw new CycleError('The demo has to come after the start.');

  let ideaId = null;
  if (input?.idea_id) {
    const idea = await db.prepare('SELECT id, body FROM ideas WHERE id = ?').bind(Number(input.idea_id)).first();
    if (!idea) throw new CycleError('No such idea.', 404);
    ideaId = idea.id;
    if (!theme) theme = clip(idea.body, 400);
  }
  let slug = slugOf(title);
  for (let n = 2; await db.prepare('SELECT 1 AS x FROM cycles WHERE slug = ?').bind(slug).first(); n++) slug = `${slugOf(title)}-${n}`;
  const res = await db
    .prepare('INSERT INTO cycles (slug, title, theme, rubric, starts_on, demo_on, idea_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(slug, title, theme, rubric, starts || null, demo || null, ideaId)
    .run();
  if (ideaId) await db.prepare(`UPDATE ideas SET status = 'planned' WHERE id = ? AND status = 'open'`).bind(ideaId).run();
  return res.meta.last_row_id;
}

/**
 * Pays one approved `ship` per member of every demoed entry. Idempotent: the
 * ref is `cycle:<id>`, so running it twice, or after a partial failure, never
 * pays anyone twice. The closing officer is recorded as the approver.
 */
export async function awardShips(db, cycle, officer) {
  const rows = (
    await db
      .prepare(
        `SELECT p.title, u.id AS user_id, u.name, u.student_id, u.email
         FROM cycle_entries e JOIN projects p ON p.id = e.project_id
         JOIN cycle_members m ON m.entry_id = e.id JOIN users u ON u.id = m.user_id
         WHERE e.cycle_id = ? AND e.demoed = 1`
      )
      .bind(cycle.id)
      .all()
  ).results;
  let paid = 0;
  let skipped = 0;
  for (const r of rows) {
    const studentId = r.student_id ?? (await ensureStudent(db, { id: r.user_id, name: r.name, student_id: null }));
    if (!studentId) { skipped++; continue; } // waiting on a leaderboard link request; run close again later is not needed, an officer can award by hand
    const ref = `cycle:${cycle.id}`;
    const res = await recordActivity(db, { studentId, kind: 'ship', ref, status: 'approved', meta: { title: r.title, cycle: cycle.title, by_user: r.user_id } });
    if (res.duplicate) continue;
    paid++;
    await db
      .prepare(`UPDATE activity SET decided_by = ?, decided_name = ?, decided_at = datetime('now') WHERE id = ?`)
      .bind(officer?.userId ?? null, officer?.name ?? null, res.activityId)
      .run();
  }
  return { paid, skipped };
}

/** Moves a cycle one step forward. Closing pays the ships first, then flips the status, so a failure can be retried. */
export async function moveCycle(db, id, to, officer) {
  const cycle = await cycleById(db, id);
  if (!STATES.includes(to) || !canMove(cycle.status, to)) {
    throw new CycleError(`A ${cycle.status} cycle cannot go to ${to}.`, 409);
  }
  if (to === 'open') {
    const busy = await db.prepare(`SELECT title FROM cycles WHERE status IN ('open', 'demo') AND id != ?`).bind(cycle.id).first();
    if (busy) throw new CycleError(`"${busy.title}" is still running. Close it first.`, 409);
  }
  let awards = { paid: 0, skipped: 0 };
  if (to === 'closed') awards = await awardShips(db, cycle, officer);
  await db.prepare('UPDATE cycles SET status = ? WHERE id = ? AND status = ?').bind(to, cycle.id, cycle.status).run();
  return { status: to, ...awards };
}

export async function joinCycle(db, cycleId, user, input) {
  const cycle = await cycleById(db, cycleId);
  if (cycle.status !== 'open') throw new CycleError('This cycle is not taking entries.', 409);
  const pitch = cleanPitch(input?.pitch);
  if (pitch.error) throw new CycleError(pitch.error);
  if (await db.prepare('SELECT 1 AS x FROM cycle_members WHERE cycle_id = ? AND user_id = ?').bind(cycle.id, user.id).first()) {
    throw new CycleError('You are already in this cycle.', 409);
  }
  let projectId = Number(input?.project_id) || null;
  if (projectId) {
    const own = await db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ? AND hidden = 0').bind(projectId, user.id).first();
    if (!own) throw new CycleError('That is not one of your projects.', 404);
  } else {
    const title = clip(input?.title, 80);
    if (title.length < 3) throw new CycleError('Name your project.');
    const n = await db.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?').bind(user.id).first();
    if (n.n >= 25) throw new CycleError('That is plenty of projects for now.');
    const res = await db
      .prepare(`INSERT INTO projects (user_id, title, description, track) VALUES (?, ?, ?, 'projects')`)
      .bind(user.id, title, pitch.value)
      .run();
    projectId = res.meta.last_row_id;
  }
  const e = await db.prepare('INSERT INTO cycle_entries (cycle_id, project_id, pitch) VALUES (?, ?, ?)').bind(cycle.id, projectId, pitch.value).run();
  const entryId = e.meta.last_row_id;
  await db.prepare('INSERT INTO cycle_members (entry_id, cycle_id, user_id, is_owner) VALUES (?, ?, ?, 1)').bind(entryId, cycle.id, user.id).run();
  return entryId;
}

export async function addMember(db, cycleId, entryId, acting, targetId) {
  const cycle = await cycleById(db, cycleId);
  if (cycle.status !== 'open') throw new CycleError('Teams are locked once the demo starts.', 409);
  const entry = await entryOf(db, cycle.id, entryId);
  const team = await teamOf(db, entry.id);
  if (!team.includes(acting.id)) throw new CycleError('Only the team can add people.', 403);
  targetId = Number(targetId);
  const target = await db.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
  if (!target) throw new CycleError('No such member.', 404);
  if (team.length >= MAX_TEAM) throw new CycleError(`A team is at most ${MAX_TEAM} people.`, 409);
  if (await db.prepare('SELECT 1 AS x FROM cycle_members WHERE cycle_id = ? AND user_id = ?').bind(cycle.id, targetId).first()) {
    throw new CycleError('They are already on a team in this cycle.', 409);
  }
  await db.prepare('INSERT INTO cycle_members (entry_id, cycle_id, user_id) VALUES (?, ?, ?)').bind(entry.id, cycle.id, targetId).run();
}

/** A member can leave; the owner can remove others. The owner cannot leave (withdraw the entry instead). */
export async function removeMember(db, cycleId, entryId, acting, targetId) {
  const cycle = await cycleById(db, cycleId);
  if (cycle.status !== 'open') throw new CycleError('Teams are locked once the demo starts.', 409);
  const entry = await entryOf(db, cycle.id, entryId);
  const me = await db.prepare('SELECT is_owner FROM cycle_members WHERE entry_id = ? AND user_id = ?').bind(entry.id, acting.id).first();
  if (!me) throw new CycleError('Only the team can change it.', 403);
  targetId = Number(targetId);
  if (targetId !== acting.id && !me.is_owner) throw new CycleError('Only the owner can remove someone else.', 403);
  const t = await db.prepare('SELECT is_owner FROM cycle_members WHERE entry_id = ? AND user_id = ?').bind(entry.id, targetId).first();
  if (!t) throw new CycleError('They are not on this team.', 404);
  if (t.is_owner) throw new CycleError('The owner cannot leave. Withdraw the entry instead.', 409);
  await db.prepare('DELETE FROM cycle_members WHERE entry_id = ? AND user_id = ?').bind(entry.id, targetId).run();
}

export async function withdrawEntry(db, cycleId, entryId, acting) {
  const cycle = await cycleById(db, cycleId);
  if (cycle.status !== 'open') throw new CycleError('Entries are locked once the demo starts.', 409);
  const entry = await entryOf(db, cycle.id, entryId);
  const me = await db.prepare('SELECT is_owner FROM cycle_members WHERE entry_id = ? AND user_id = ?').bind(entry.id, acting.id).first();
  if (!me?.is_owner) throw new CycleError('Only the owner can withdraw the entry.', 403);
  await db.prepare('DELETE FROM cycle_entries WHERE id = ?').bind(entry.id).run();
}

export async function addDevlog(db, cycleId, entryId, user, input) {
  const cycle = await cycleById(db, cycleId);
  if (cycle.status !== 'open' && cycle.status !== 'demo') throw new CycleError('This cycle is not running.', 409);
  const entry = await entryOf(db, cycle.id, entryId);
  if (!(await teamOf(db, entry.id)).includes(user.id)) throw new CycleError('Only the team posts devlogs.', 403);
  const d = cleanDevlog(input);
  if (d.error) throw new CycleError(d.error);
  const today = await db
    .prepare(`SELECT COUNT(*) AS n FROM devlogs WHERE user_id = ? AND created_at > datetime('now', '-1 day')`)
    .bind(user.id)
    .first();
  if (today.n >= DEVLOGS_PER_DAY) throw new CycleError('That is plenty of devlogs for one day.', 429);
  const res = await db.prepare('INSERT INTO devlogs (entry_id, user_id, text, url) VALUES (?, ?, ?, ?)').bind(entry.id, user.id, d.value.text, d.value.url).run();
  return res.meta.last_row_id;
}

/** One vote per member per cycle, only during the demo, never for your own team. Voting again moves the vote. */
export async function castVote(db, cycleId, entryId, user) {
  const cycle = await cycleById(db, cycleId);
  if (cycle.status !== 'demo') throw new CycleError('Voting is only open during the demo.', 409);
  const entry = await entryOf(db, cycle.id, entryId);
  if ((await teamOf(db, entry.id)).includes(user.id)) throw new CycleError('You cannot vote for your own entry.', 403);
  await db
    .prepare(
      `INSERT INTO cycle_votes (cycle_id, entry_id, user_id) VALUES (?, ?, ?)
       ON CONFLICT(cycle_id, user_id, category) DO UPDATE SET entry_id = excluded.entry_id`
    )
    .bind(cycle.id, entry.id, user.id)
    .run();
}

/* --------------------------------- reading --------------------------------- */

/** Everything the page needs for one cycle. Vote counts stay hidden until it closes. */
async function cycleView(db, cycle, userId) {
  const entries = (
    await db
      .prepare(
        `SELECT e.id, e.project_id, e.pitch, e.demoed, p.title, p.repo_url, p.demo_url,
                (SELECT COUNT(*) FROM cycle_votes v WHERE v.entry_id = e.id) AS votes
         FROM cycle_entries e JOIN projects p ON p.id = e.project_id
         WHERE e.cycle_id = ? ORDER BY e.id LIMIT 60`
      )
      .bind(cycle.id)
      .all()
  ).results;
  const members = (
    await db
      .prepare(`SELECT m.entry_id, m.user_id, m.is_owner, u.name FROM cycle_members m JOIN users u ON u.id = m.user_id WHERE m.cycle_id = ? ORDER BY m.is_owner DESC, u.name`)
      .bind(cycle.id)
      .all()
  ).results;
  const logs = (
    await db
      .prepare(
        `SELECT d.id, d.entry_id, d.text, d.url, d.created_at, u.name FROM devlogs d JOIN users u ON u.id = d.user_id
         JOIN cycle_entries e ON e.id = d.entry_id WHERE e.cycle_id = ? ORDER BY d.id DESC`
      )
      .bind(cycle.id)
      .all()
  ).results;
  const myVote = userId
    ? (await db.prepare(`SELECT entry_id FROM cycle_votes WHERE cycle_id = ? AND user_id = ?`).bind(cycle.id, userId).first())?.entry_id ?? null
    : null;
  const closed = cycle.status === 'closed';
  let myEntryId = null;
  const out = entries.map((e) => {
    const team = members.filter((m) => m.entry_id === e.id);
    const mine = team.some((m) => m.user_id === userId);
    if (mine) myEntryId = e.id;
    const all = logs.filter((l) => l.entry_id === e.id);
    return {
      id: e.id, project_id: e.project_id, title: e.title, pitch: e.pitch, repo_url: e.repo_url, demo_url: e.demo_url,
      demoed: Boolean(e.demoed), mine, owner: team.some((m) => m.user_id === userId && m.is_owner),
      votes: closed ? e.votes : undefined,
      team: team.map((m) => ({ id: m.user_id, name: shortName(m.name) })),
      devlog_count: all.length,
      // Your own team sees the whole log; everyone else gets the latest three.
      devlogs: all.slice(0, mine ? 50 : 3).map((l) => ({ id: l.id, text: l.text, url: l.url, at: l.created_at, author: firstName(l.name) })),
    };
  });
  const { id, slug, title, theme, rubric, starts_on, demo_on, status } = cycle;
  return {
    cycle: { id, slug, title, theme, rubric, starts_on, demo_on, status },
    entries: out,
    myEntryId,
    myVote,
    winners: closed ? winnersOf(entries).map((e) => ({ id: e.id, title: e.title, pitch: e.pitch, votes: e.votes, team: out.find((o) => o.id === e.id).team })) : [],
  };
}

cyclesRouter.get('/cycles', async (c) => {
  const db = c.env.DB;
  const user = await currentUser(c);
  const cur = await db.prepare(`SELECT * FROM cycles WHERE status IN ('open', 'demo') ORDER BY id DESC LIMIT 1`).first();
  const past = (await db.prepare(`SELECT * FROM cycles WHERE status = 'closed' ORDER BY id DESC LIMIT 6`).all()).results;
  return c.json({
    signedIn: Boolean(user),
    me: user?.id ?? null,
    maxTeam: MAX_TEAM,
    current: cur ? await cycleView(db, cur, user?.id ?? null) : null,
    past: await Promise.all(past.map(async (p) => {
      const v = await cycleView(db, p, user?.id ?? null);
      return { cycle: v.cycle, winners: v.winners, entries: v.entries.length, shipped: v.entries.filter((e) => e.demoed).length };
    })),
  });
});

/** Teammate search: signed-in members only, short names, never emails. */
cyclesRouter.get('/members/search', requireUser, async (c) => {
  const q = clip(c.req.query('q'), 40);
  if (q.length < 2) return c.json({ members: [] });
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const rows = (
    await c.env.DB
      .prepare(`SELECT id, name FROM users WHERE name LIKE ? ESCAPE '\\' AND id != ? ORDER BY name LIMIT 8`)
      .bind(like, c.get('user').id)
      .all()
  ).results;
  return c.json({ members: rows.map((r) => ({ id: r.id, name: shortName(r.name) })) });
});

const body = (c) => c.req.json().catch(() => ({}));

cyclesRouter.post('/cycles/:id/entries', requireUser, async (c) => {
  try {
    return c.json({ id: await joinCycle(c.env.DB, c.req.param('id'), c.get('user'), await body(c)) });
  } catch (err) {
    return fail(c, err);
  }
});

cyclesRouter.delete('/cycles/:id/entries/:eid', requireUser, async (c) => {
  try {
    await withdrawEntry(c.env.DB, c.req.param('id'), c.req.param('eid'), c.get('user'));
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

cyclesRouter.post('/cycles/:id/entries/:eid/team', requireUser, async (c) => {
  try {
    await addMember(c.env.DB, c.req.param('id'), c.req.param('eid'), c.get('user'), (await body(c)).user_id);
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

cyclesRouter.delete('/cycles/:id/entries/:eid/team/:uid', requireUser, async (c) => {
  try {
    await removeMember(c.env.DB, c.req.param('id'), c.req.param('eid'), c.get('user'), c.req.param('uid'));
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

cyclesRouter.post('/cycles/:id/entries/:eid/devlogs', requireUser, async (c) => {
  try {
    return c.json({ id: await addDevlog(c.env.DB, c.req.param('id'), c.req.param('eid'), c.get('user'), await body(c)) });
  } catch (err) {
    return fail(c, err);
  }
});

cyclesRouter.post('/cycles/:id/vote', requireUser, async (c) => {
  try {
    await castVote(c.env.DB, c.req.param('id'), (await body(c)).entry_id, c.get('user'));
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});

/* -------------------------------- officers -------------------------------- */

cyclesAdminRouter.get('/cycles', async (c) => {
  const db = c.env.DB;
  const rows = (await db.prepare('SELECT * FROM cycles ORDER BY id DESC LIMIT 30').all()).results;
  const out = [];
  for (const cy of rows) {
    const entries = (
      await db
        .prepare(
          `SELECT e.id, e.pitch, e.demoed, p.title,
                  (SELECT COUNT(*) FROM cycle_votes v WHERE v.entry_id = e.id) AS votes,
                  (SELECT group_concat(u.name, ', ') FROM cycle_members m JOIN users u ON u.id = m.user_id WHERE m.entry_id = e.id) AS team
           FROM cycle_entries e JOIN projects p ON p.id = e.project_id WHERE e.cycle_id = ? ORDER BY e.id`
        )
        .bind(cy.id)
        .all()
    ).results;
    out.push({ ...cy, entries: entries.map((e) => ({ ...e, demoed: Boolean(e.demoed) })) });
  }
  return c.json({ cycles: out });
});

cyclesAdminRouter.post('/cycles', async (c) => {
  try {
    return c.json({ id: await createCycle(c.env.DB, await body(c)) });
  } catch (err) {
    return fail(c, err);
  }
});

cyclesAdminRouter.post('/cycles/:id/status', async (c) => {
  try {
    return c.json(await moveCycle(c.env.DB, c.req.param('id'), (await body(c)).status, officerOf(c)));
  } catch (err) {
    return fail(c, err);
  }
});

/** Ticks whether an entry was demoed at the meeting. Only entries ticked here earn a ship at close. */
cyclesAdminRouter.post('/cycles/:id/entries/:eid/demoed', async (c) => {
  try {
    const cycle = await cycleById(c.env.DB, c.req.param('id'));
    if (cycle.status !== 'open' && cycle.status !== 'demo') throw new CycleError('Entries can only be ticked while the cycle runs.', 409);
    const entry = await entryOf(c.env.DB, cycle.id, c.req.param('eid'));
    await c.env.DB.prepare('UPDATE cycle_entries SET demoed = ? WHERE id = ?').bind((await body(c)).demoed ? 1 : 0, entry.id).run();
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});
