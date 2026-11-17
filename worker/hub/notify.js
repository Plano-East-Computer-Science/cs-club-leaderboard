/**
 * Posts a line to the club's Discord channel through a webhook.
 *
 * The webhook URL is a setting (`discord_webhook_url`) an officer pastes in, so
 * it is checked before every use: only real Discord webhook URLs are accepted,
 * otherwise a mistyped or hostile setting would make the Worker POST anywhere.
 * `allowed_mentions: { parse: [] }` means no text can ever ping @everyone.
 * Never throws: a Discord outage must not break opening a room.
 */
import { getSetting } from '../db.js';

const WEBHOOK_PREFIXES = ['https://discord.com/api/webhooks/', 'https://discordapp.com/api/webhooks/'];

export const isDiscordWebhook = (url) =>
  typeof url === 'string' && WEBHOOK_PREFIXES.some((p) => url.startsWith(p) && url.length > p.length);

/** @returns {Promise<boolean>} true when Discord accepted the message. */
export async function notify(env, db, text) {
  try {
    const url = (await getSetting(db, 'discord_webhook_url', '')).trim();
    if (!url) return false;
    if (!isDiscordWebhook(url)) {
      console.error('notify: discord_webhook_url is not a Discord webhook URL, ignoring');
      return false;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: String(text).slice(0, 2000), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`notify: Discord returned HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error('notify failed:', err?.message ?? err);
    return false;
  }
}
