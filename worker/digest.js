/**
 * The weekly club email.
 *
 * Runs from a Cron Trigger (see wrangler.toml). It reports only what actually
 * changed since the last send, and if nothing changed it sends nothing at all
 * -- a weekly "nothing happened" email is how a mailing list dies.
 *
 * Mail goes to members' personal addresses only, and every message carries a
 * one-click unsubscribe.
 */
import {
  pointEventsSince, opportunitiesSince, deadlinesWithin,
  listDigestRecipients, getSetting, setSetting,
} from './db.js';
import { sendEmail, esc, unsubscribeHeaders, emailEnabled } from './email.js';

const DEADLINE_WINDOW_DAYS = 14;
/** First run has no "last send" to measure from, so it looks back a week. */
const DEFAULT_LOOKBACK_DAYS = 7;

const originOf = (env) => (env.SITE_ORIGIN || 'https://peshcompsci.org').replace(/\/$/, '');

/**
 * Gathers what happened. Returns null when there is nothing worth an email --
 * upcoming deadlines alone do NOT count, because they are the same deadlines
 * as last week and nagging weekly is what gets a sender muted.
 */
export async function buildDigest(db, since) {
  const [points, opportunities, deadlines] = await Promise.all([
    pointEventsSince(db, since),
    opportunitiesSince(db, since),
    deadlinesWithin(db, DEADLINE_WINDOW_DAYS),
  ]);

  if (!points.length && !opportunities.length) return null;
  return { since, points, opportunities, deadlines };
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

  const subject = subjectFor(digest);
  const results = [];

  for (const m of recipients) {
    const unsubscribeUrl = `${origin}/api/auth/unsubscribe?t=${m.unsubscribe_token}`;
    const preview = {
      to: m.personal_email,
      subject,
      text: renderText(digest, origin, unsubscribeUrl),
      html: renderHtml(digest, origin, unsubscribeUrl),
      headers: unsubscribeHeaders(unsubscribeUrl),
    };
    // One send per member, not one bcc blast: each carries its own unsubscribe
    // link, and nobody sees anyone else's address.
    results.push(dry ? { ok: true, to: m.personal_email } : { ...(await sendEmail(env, preview)), to: m.personal_email });
  }

  if (!dry) await setSetting(db, 'last_digest_at', new Date().toISOString());

  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
    since,
    subject,
    recipients: recipients.length,
    counts: {
      points: digest.points.length,
      opportunities: digest.opportunities.length,
      deadlines: digest.deadlines.length,
    },
    ...(dry ? { sample: results.length ? renderText(digest, origin, `${origin}/api/auth/unsubscribe?t=…`) : null } : {}),
  };
}

function subjectFor(digest) {
  const bits = [];
  if (digest.points.length) bits.push(`${digest.points.length} point award${digest.points.length === 1 ? '' : 's'}`);
  if (digest.opportunities.length) bits.push(`${digest.opportunities.length} new opportunit${digest.opportunities.length === 1 ? 'y' : 'ies'}`);
  return `CS Club — ${bits.join(', ')}`;
}
