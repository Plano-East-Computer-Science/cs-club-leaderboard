/**
 * The whole server, as a Cloudflare Worker.
 *
 * Workers never sleep, so there is no cold start -- the leaderboard is
 * immediate whenever a student opens it, which was the whole point of moving
 * here. Static files (the built React app) and the JSON API are served by the
 * same Worker on the same domain, so there is no CORS to configure.
 */
import { Hono } from 'hono';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { ingestRouter } from './routes/ingest.js';
import { subscribeRouter } from './routes/subscribe.js';
import { runDigest } from './digest.js';

const app = new Hono();

app.route('/api/admin', adminRouter);
app.route('/api/subscribe', subscribeRouter);
app.route('/api/ingest', ingestRouter);
app.route('/api', publicRouter);

// Anything else under /api is a genuine 404, not the React app.
app.all('/api/*', (c) => c.json({ error: 'No such endpoint.' }, 404));

/**
 * Everything else is the single-page app.
 *
 * We handle the SPA fallback here rather than with Wrangler's
 * not_found_handling, because that setting would also swallow unmatched /api
 * paths and hand them an HTML page instead of a JSON error.
 */
app.get('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status !== 404) return res;
  const url = new URL(c.req.url);
  url.pathname = '/index.html';
  return c.env.ASSETS.fetch(new Request(url, c.req.raw));
});

app.onError((err, c) => {
  console.error('[worker]', err);
  return c.json({ error: 'Something broke on the server.' }, 500);
});

/**
 * Two entry points, one Worker: HTTP requests, and the weekly Cron Trigger.
 *
 * The cron send is wrapped so a mail failure can never leave a scheduled run
 * in a failed state -- the digest is not important enough to page anyone.
 */
export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runDigest(env)
        .then((r) => console.log('[digest]', JSON.stringify(r)))
        .catch((err) => console.error('[digest]', err))
    );
  },
};
