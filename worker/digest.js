/**
 * The weekly club email.
 *
 * Runs from a Cron Trigger (see wrangler.toml). It reports only what actually
 * changed since the last send, and if nothing changed it sends nothing at all
 * -- a weekly "nothing happened" email is how a mailing list dies.
 *
 * Mail goes only to addresses that confirmed by clicking the link we sent
 * them, and every message carries a one-click unsubscribe.
 */
import {
  pointEventsSince, opportunitiesSince, deadlinesWithin,
  listDigestRecipients, getSetting, setSetting, getLeaderboard,
} from './db.js';
import { squadStandings } from './hub/standings.js';
import { seasonOf } from '../shared/points.js';
import { nextPublicPlan } from './hub/planner.js';
import { whenLabel } from '../shared/planner.js';
import { sendEmail, esc, unsubscribeHeaders, emailEnabled } from './email.js';

const DEADLINE_WINDOW_DAYS = 14;
const MINE_WINDOW_DAYS = 30;
/** First run has no "last send" to measure from, so it looks back a week. */
const DEFAULT_LOOKBACK_DAYS = 7;

const originOf = (env) => (env.SITE_ORIGIN || 'https://peshcompsci.org').replace(/\/$/, '');

/**
 * Gathers what happened. Returns null when there is nothing worth an email --
 * upcoming deadlines alone do NOT count, because they are the same deadlines
 * as last week and nagging weekly is what gets a sender muted.
 */
export async function buildDigest(db, since) {
  const [points, opportunities, deadlines, rawNotes] = await Promise.all([
    pointEventsSince(db, since),
    opportunitiesSince(db, since),
    deadlinesWithin(db, DEADLINE_WINDOW_DAYS),
    getSetting(db, 'digest_notes', '[]'),
  ]);
  // Officer announcements queued from the Announce screen (G3). An officer
  // wrote them on purpose, so a note alone is worth an email.
  let notes = [];
  try {
    notes = JSON.parse(rawNotes || '[]').filter((n) => typeof n === 'string' && n.trim());
  } catch {
    /* a corrupt setting just means no notes */
  }

  if (!points.length && !opportunities.length && !notes.length) return null;
  // G1: the next planned meeting rides along like deadlines do; it never decides whether an email goes out.
  return { since, points, opportunities, deadlines, notes, session: await nextPublicPlan(db) };
}

/**
 * E2: the deadlines one reader marked "I'm doing this", matched by email to
 * their club account. A section added per recipient inside the existing
 * one-send-per-address loop, so it costs one small query each. It never
 * decides whether an email goes out (see buildDigest), only what is in it.
 */
export async function myDeadlines(db, email) {
  return (
    await db
      .prepare(
        `SELECT o.title, o.url, o.deadline FROM opportunity_interest i
         JOIN users u ON u.id = i.user_id JOIN opportunities o ON o.id = i.opportunity_id
         WHERE lower(u.email) = lower(?) AND o.status = 'live' AND o.deadline >= date('now') AND o.deadline <= date('now', ?)
         ORDER BY o.deadline`
      )
      .bind(email, `+${MINE_WINDOW_DAYS} days`)
      .all()
  ).results;
}

/* -------------------------------- personal (F3) ------------------------------- */

const KIND_LABEL = {
  attend: 'Came to a meeting', active: 'Took part in', compete: 'Competed in', place: 'Placed in', ship: 'Shipped', mentor: 'Helped someone',
  solve: 'Solved', idea: 'Shared an idea', daily: 'Solved the daily problem', duel: 'Played a duel',
  dropin: 'Dropped in', quest: 'Finished a quest', manual: 'Awarded by an officer',
};
const labelFor = (kind, title) => [KIND_LABEL[kind] ?? 'Activity', title].filter(Boolean).join(' ').trim();

/**
 * What the personal sections of one run are built from. Loaded once per run,
 * not per recipient: the season board, squad standings and every approved
 * activity row since the last send. Only approved rows are ever read.
 */
export async function personalContext(db, since, now = new Date()) {
  const season = seasonOf(now);
  const board = await getLeaderboard(db, season, { publicNames: true });
  const squads = await squadStandings(db, season, board);
  const activity = (
    await db
      .prepare(
        `SELECT student_id, kind, json_extract(meta, '$.title') AS title, points
         FROM activity WHERE status = 'approved' AND COALESCE(decided_at, created_at) > datetime(?)
         ORDER BY COALESCE(decided_at, created_at), id`
      )
      .bind(since)
      .all()
  ).results;
  const squadOf = new Map();
  for (const s of squads) for (const m of s.members) squadOf.set(m.id, s);
  return { activity, squads, squadOf };
}

/**
 * The "your week" block for one account holder: what they did, and where their
 * squad stands. Pure, so it is tested without a database or a mail server.
 * `user` is { name, student_id }.
 */
export function buildPersonal(ctx, user) {
  const sid = user.student_id;
  const did = ctx.activity.filter((a) => a.student_id === sid).map((a) => ({ label: labelFor(a.kind, a.title), points: a.points || 0 }));
  const s = ctx.squadOf.get(sid);
  const squad = s && {
    name: s.name,
    place: s.place,
    of: ctx.squads.length,
    score: s.score,
    teammateActivity: ctx.activity.filter((a) => a.student_id !== sid && s.members.some((m) => m.id === a.student_id)).length,
  };
  return { first: String(user.name ?? '').trim().split(/\s+/)[0] || 'there', did, total: did.reduce((n, d) => n + d.points, 0), squad };
}

/** The account that owns an address, or null. A deleted account is not a person to write to. */
export const userForEmail = (db, email) =>
  db.prepare('SELECT id, name, student_id FROM users WHERE lower(email) = lower(?) AND deleted_at IS NULL').bind(email).first();

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

function personalLines(p) {
  const lines = [];
  if (p.did.length) lines.push(`You did ${p.did.length} thing${p.did.length === 1 ? '' : 's'} this week${p.total ? ` (+${p.total} points)` : ''}:`);
  else lines.push('Nothing logged for you this week. The next meeting is a good time to change that.');
  const squadLine = p.squad
    ? `Your squad, ${p.squad.name}, is ${ordinal(p.squad.place)} of ${p.squad.of}.${p.squad.teammateActivity ? ` Teammates logged ${p.squad.teammateActivity} thing${p.squad.teammateActivity === 1 ? '' : 's'}.` : ''}`
    : null;
  return { lines, squadLine };
}

/* ---------------------------------- render --------------------------------- */

const fmtDate = (iso) =>
  new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

function renderText(digest, origin, unsubscribeUrl) {
  const lines = ['Plano East CS Club — this week', ''];

  if (digest.personal) {
    const { lines: head, squadLine } = personalLines(digest.personal);
    lines.push(`YOUR WEEK, ${digest.personal.first.toUpperCase()}`, ...head.map((l) => `  ${l}`));
    for (const d of digest.personal.did) lines.push(`    ${d.label}${d.points ? `  +${d.points}` : ''}`);
    if (squadLine) lines.push(`  ${squadLine}`);
    lines.push('');
  }

  if (digest.mine?.length) {
    lines.push('YOUR DEADLINES');
    for (const d of digest.mine) lines.push(`  ${fmtDate(d.deadline)}  ${d.title}`);
    lines.push('');
  }

  if (digest.notes?.length) {
    lines.push('FROM THE OFFICERS');
    for (const n of digest.notes) lines.push(`  ${n.replace(/\n/g, '\n  ')}`, '');
  }

  if (digest.session) {
    lines.push('NEXT MEETING', `  ${whenLabel(digest.session.date)}: ${digest.session.title} (${digest.session.kind})`, '');
  }

  if (digest.points.length) {
    lines.push('POINTS AWARDED');
    for (const p of digest.points) {
      lines.push(`  ${p.name}  +${p.delta}${p.reason ? `  (${p.reason})` : ''}`);
    }
    lines.push('', `  Standings: ${origin}/`, '');
  }

  if (digest.opportunities.length) {
    lines.push('NEW OPPORTUNITIES');
    for (const o of digest.opportunities) {
      lines.push(`  ${o.title}${o.deadline ? ` — due ${fmtDate(o.deadline)}` : ''}`);
      if (o.url) lines.push(`    ${o.url}`);
    }
    lines.push('', `  All of them: ${origin}/opportunities`, '');
  }

  if (digest.deadlines.length) {
    lines.push(`CLOSING WITHIN ${DEADLINE_WINDOW_DAYS} DAYS`);
    for (const d of digest.deadlines) lines.push(`  ${fmtDate(d.deadline)}  ${d.title}`);
    lines.push('');
  }

  lines.push('—', `Unsubscribe: ${unsubscribeUrl}`);
  return lines.join('\n');
}

function renderHtml(digest, origin, unsubscribeUrl) {
  const section = (title, body) =>
    `<h2 style="font:600 13px/1.4 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#6b7689;margin:28px 0 8px">${title}</h2>${body}`;

  const parts = [];

  if (digest.personal) {
    const p = digest.personal;
    const { lines: head, squadLine } = personalLines(p);
    parts.push(
      section(
        `Your week, ${esc(p.first)}`,
        `<p style="margin:0 0 6px">${esc(head[0])}</p>${
          p.did.length
            ? `<ul style="margin:0;padding-left:18px">${p.did
                .map((d) => `<li style="margin:4px 0">${esc(d.label)}${d.points ? ` <span style="color:#6b7689">+${d.points}</span>` : ''}</li>`)
                .join('')}</ul>`
            : ''
        }${squadLine ? `<p style="margin:10px 0 0">${esc(squadLine)}</p>` : ''}`
      )
    );
  }

  if (digest.notes?.length) {
    parts.push(
      section(
        'From the officers',
        digest.notes.map((n) => `<p style="margin:0 0 10px;white-space:pre-wrap">${esc(n)}</p>`).join('')
      )
    );
  }

  if (digest.session) {
    parts.push(
      section(
        'Next meeting',
        `<p style="margin:0"><strong>${esc(whenLabel(digest.session.date))}</strong>: ${esc(digest.session.title)} <span style="color:#6b7689">(${esc(digest.session.kind)})</span></p>`
      )
    );
  }

  if (digest.points.length) {
    parts.push(
      section(
        'Points awarded',
        `<ul style="margin:0;padding-left:18px">${digest.points
          .map(
            (p) =>
              `<li style="margin:4px 0"><strong>${esc(p.name)}</strong> +${p.delta}${
                p.reason ? ` <span style="color:#6b7689">${esc(p.reason)}</span>` : ''
              }</li>`
          )
          .join('')}</ul>
         <p style="margin:12px 0 0"><a href="${origin}/">See the standings</a></p>`
      )
    );
  }

  if (digest.opportunities.length) {
    parts.push(
      section(
        'New opportunities',
        `<ul style="margin:0;padding-left:18px">${digest.opportunities
          .map(
            (o) =>
              `<li style="margin:6px 0">${
                o.url ? `<a href="${esc(o.url)}">${esc(o.title)}</a>` : esc(o.title)
              }${o.deadline ? ` <span style="color:#6b7689">— due ${fmtDate(o.deadline)}</span>` : ''}</li>`
          )
          .join('')}</ul>
         <p style="margin:12px 0 0"><a href="${origin}/opportunities">The whole board</a></p>`
      )
    );
  }

  if (digest.deadlines.length) {
    parts.push(
      section(
        `Closing within ${DEADLINE_WINDOW_DAYS} days`,
        `<ul style="margin:0;padding-left:18px">${digest.deadlines
          .map(
            (d) =>
              `<li style="margin:4px 0"><span style="color:#c42e2e;font-variant-numeric:tabular-nums">${fmtDate(
                d.deadline
              )}</span> — ${d.url ? `<a href="${esc(d.url)}">${esc(d.title)}</a>` : esc(d.title)}</li>`
          )
          .join('')}</ul>`
      )
    );
  }

  if (digest.mine?.length) {
    parts.push(
      section(
        `Your deadlines (next ${MINE_WINDOW_DAYS} days)`,
        `<ul style="margin:0;padding-left:18px">${digest.mine
          .map(
            (d) =>
              `<li style="margin:4px 0"><span style="color:#c42e2e;font-variant-numeric:tabular-nums">${fmtDate(
                d.deadline
              )}</span> — ${d.url ? `<a href="${esc(d.url)}">${esc(d.title)}</a>` : esc(d.title)}</li>`
          )
          .join('')}</ul>
         <p style="margin:12px 0 0"><a href="${origin}/opportunities">Your list</a></p>`
      )
    );
  }

  return `<div style="font:400 15px/1.6 system-ui,-apple-system,sans-serif;color:#1a1d23;max-width:34rem;margin:0 auto;padding:24px">
    <p style="font:800 22px/1.1 system-ui;margin:0">Plano East CS Club</p>
    <p style="color:#6b7689;margin:4px 0 0">What happened this week.</p>
    ${parts.join('')}
    <p style="margin:32px 0 0;border-top:1px solid #e3e6ea;padding-top:12px;font-size:12px;color:#6b7689">
      You get this because you opted in on the club site.
      <a href="${unsubscribeUrl}">Unsubscribe</a>.
    </p>
  </div>`;
}

/* ----------------------------------- send ---------------------------------- */

/**
 * Builds and sends. Safe to call by hand from the admin panel.
 *
 * @param {{dry?: boolean}} options `dry` builds and renders without sending or
 *   advancing the last-send timestamp -- what the admin "Preview" uses.
 */
export async function runDigest(env, { dry = false } = {}) {
  const db = env.DB;
  const fallback = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86_400_000).toISOString();
  const since = (await getSetting(db, 'last_digest_at', '')) || fallback;

  const digest = await buildDigest(db, since);
  const recipients = await listDigestRecipients(db);
  const origin = originOf(env);

  if (!digest) {
    return { sent: 0, skipped: 'Nothing new since the last email.', since, recipients: recipients.length };
  }
  if (!emailEnabled(env)) {
    return { sent: 0, skipped: 'Email is not configured.', since, recipients: recipients.length };
  }

  const results = [];
  const ctx = await personalContext(db, since);
  const seen = new Set();

  for (const m of recipients) {
    // One message per address per run, however the address was typed. An
    // account holder gets this one message with their own section in it, never
    // a personal email on top of the plain one.
    const key = m.email.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const unsubscribeUrl = `${origin}/api/subscribe/unsubscribe?t=${m.unsubscribe_token}`;
    const user = await userForEmail(db, m.email);
    const mine = { ...digest, mine: await myDeadlines(db, m.email), personal: user ? buildPersonal(ctx, user) : null };
    const subject = subjectFor(digest, mine.personal);
    const preview = {
      to: m.email,
      subject,
      text: renderText(mine, origin, unsubscribeUrl),
      html: renderHtml(mine, origin, unsubscribeUrl),
      headers: unsubscribeHeaders(unsubscribeUrl),
    };
    // One send per address, not one bcc blast: each carries its own
    // unsubscribe link, and nobody sees anyone else's address.
    results.push(dry ? { ok: true, to: m.email } : { ...(await sendEmail(env, preview)), to: m.email });
  }

  if (!dry) {
    await setSetting(db, 'last_digest_at', new Date().toISOString());
    if (digest.notes.length) await setSetting(db, 'digest_notes', '[]');
  }

  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
    since,
    subject: subjectFor(digest),
    recipients: recipients.length,
    counts: {
      points: digest.points.length,
      opportunities: digest.opportunities.length,
      deadlines: digest.deadlines.length,
    },
    ...(dry ? { sample: renderText(digest, origin, `${origin}/api/subscribe/unsubscribe?t=…`) } : {}),
  };
}

function subjectFor(digest, personal = null) {
  if (personal?.did.length) return `CS Club — your week: ${personal.did.length} thing${personal.did.length === 1 ? '' : 's'} you did`;
  const bits = [];
  if (digest.points.length) bits.push(`${digest.points.length} point award${digest.points.length === 1 ? '' : 's'}`);
  if (digest.opportunities.length) bits.push(`${digest.opportunities.length} new opportunit${digest.opportunities.length === 1 ? 'y' : 'ies'}`);
  if (digest.notes?.length) bits.push('club news');
  return `CS Club — ${bits.join(', ')}`;
}
