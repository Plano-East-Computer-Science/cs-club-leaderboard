/**
 * Sending mail from the Worker, via Resend.
 *
 * Workers cannot open an SMTP connection (no raw sockets in a V8 isolate), so
 * every option here is an HTTPS API. Resend is Cloudflare's own documented
 * choice and its free tier is 3,000 messages a month -- a weekly digest to
 * this club is roughly 90, so it stays free.
 *
 * Club mail goes to members' PERSONAL addresses, never their @mypisd.net ones:
 * districts routinely filter external senders to student accounts, and a
 * digest that silently lands in a quarantine is worse than no digest.
 */

const ENDPOINT = 'https://api.resend.com/emails';

export function emailEnabled(env) {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}

/**
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 *   Never throws. A failed send must not take down a cron run or a request.
 */
export async function sendEmail(env, { to, subject, text, html, headers }) {
  if (!emailEnabled(env)) {
    return { ok: false, error: 'Email is not configured (RESEND_API_KEY / MAIL_FROM).' };
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
        ...(headers ? { headers } : {}),
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.message || `Resend returned HTTP ${res.status}` };
    }
    return { ok: true, id: body?.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Escapes text before it goes anywhere near an HTML email body. */
export function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * One-click unsubscribe, as CAN-SPAM expects. The List-Unsubscribe headers let
 * a mail client offer it without the reader hunting for a link.
 */
export function unsubscribeHeaders(url) {
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
