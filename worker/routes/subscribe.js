/**
 * The weekly-email subscription, with no account behind it.
 *
 * Because nobody signs in, the only proof that an address belongs to the
 * person typing it is a click on a link we send to it. Until that click the
 * row exists but receives nothing. This is what stops one student signing up
 * another, and it is also the CAN-SPAM shape a mail provider expects.
 */
import { Hono } from 'hono';

import {
  addSubscriber, markConfirmSent, confirmSubscriber, unsubscribeByToken,
} from '../db.js';
import { randomToken, DISTRICT_DOMAIN } from '../auth.js';
import { sendEmail, emailEnabled, esc } from '../email.js';

export const subscribeRouter = new Hono();

/** Do not re-send a confirmation to the same address inside this window. */
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8">
   <title>${esc(title)}</title>
   <body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">
     <h1 style="font-size:1.25rem">${esc(title)}</h1>
     ${body}
     <p><a href="/">Back to the site</a></p>
   </body>`;

subscribeRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.json({ error: 'That does not look like an email address.' }, 400);
  }
  if (email.endsWith(`@${DISTRICT_DOMAIN}`)) {
    return c.json(
      { error: 'Use a personal address (Gmail, Outlook). School mail filters block club email.' },
      400
    );
  }
  if (!emailEnabled(c.env)) {
    return c.json({ error: 'Email is not switched on yet. Ask an officer.' }, 503);
  }

  const sub = await addSubscriber(c.env.DB, email, randomToken);

  // Same reply whether or not the address was already confirmed, so the form
  // cannot be used to check who is subscribed.
  if (sub.confirmed) return c.json({ ok: true });

  // ponytail: per-address cooldown only. Per-IP limiting needs KV or a
  // Durable Object; add it if someone actually abuses the form.
  const lastSent = sub.confirm_sent_at ? Date.parse(`${sub.confirm_sent_at}Z`) : 0;
  if (Date.now() - lastSent < RESEND_COOLDOWN_MS) return c.json({ ok: true });

  const origin = new URL(c.req.url).origin;
  const link = `${origin}/api/subscribe/confirm?t=${sub.confirm_token}`;
  const result = await sendEmail(c.env, {
    to: email,
    subject: 'Confirm your CS Club email',
    text: `Click to get the weekly Plano East CS Club email:\n\n${link}\n\nIf you did not ask for this, ignore it and nothing will be sent.`,
    html: `<p>Click to get the weekly Plano East CS Club email:</p>
           <p><a href="${link}">${link}</a></p>
           <p style="color:#6b7689">If you did not ask for this, ignore it and nothing will be sent.</p>`,
  });
  if (!result.ok) return c.json({ error: `Could not send the confirmation: ${result.error}` }, 502);

  await markConfirmSent(c.env.DB, sub.id);
  return c.json({ ok: true });
});

subscribeRouter.get('/confirm', async (c) => {
  const token = c.req.query('t');
  const ok = token ? await confirmSubscriber(c.env.DB, token) : false;
  return c.html(
    ok
      ? page('You are on the list', '<p>The club email arrives Monday mornings, and only when something happened.</p>')
      : page('That link did not work', '<p>It may have been cut off by your mail app. Try subscribing again from the site.</p>'),
    ok ? 200 : 400
  );
});

/** No login, one click -- what a mail client's unsubscribe button expects. */
subscribeRouter.all('/unsubscribe', async (c) => {
  const token = c.req.query('t');
  if (token) await unsubscribeByToken(c.env.DB, token);
  return c.html(page('Unsubscribed', '<p>You will not get any more club email.</p>'));
});
