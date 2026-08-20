/**
 * Receives scraped opportunities from the weekly GitHub Action.
 *
 * The Action does the fetching, HTML parsing, and geocoding, because a free
 * Worker gets 10ms of CPU per request and parsing a few hundred kilobytes of
 * HTML blows straight through that. All this endpoint does is write rows.
 *
 * Everything lands as status='pending'. Nothing reaches the public board until
 * an admin approves it, so a source that starts returning junk produces a
 * messy queue rather than a broken page.
 */
import { Hono } from 'hono';
import { first, run, getSetting } from '../db.js';
import { checkIngestToken } from '../auth.js';
import { fingerprintOf } from '../geo.js';

export const ingestRouter = new Hono();

/**
 * Lets the scraper read the Firecrawl page list that admins edit in the panel,
 * without that list being readable by the public.
 */
ingestRouter.get('/config', async (c) => {
  if (!checkIngestToken(c.env, c.req.header('Authorization'))) {
    return c.json({ error: 'Bad or missing ingest token.' }, 401);
  }
  const raw = await getSetting(c.env.DB, 'firecrawl_urls', '');
  return c.json({
    firecrawl_urls: raw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//.test(s)),
  });
});

const VALID_TYPES = new Set(['internship', 'competition', 'program', 'resource', 'scholarship']);
const VALID_FORMATS = new Set(['online', 'local', 'residential']);
const VALID_COSTS = new Set(['free', 'paid', 'stipend']);

/** Rejects junk before it can reach the queue. */
function normalize(raw) {
  const title = (raw.title ?? '').trim();
  const url = (raw.url ?? '').trim();
  if (title.length < 3 || !/^https?:\/\//.test(url)) return null;
  return {
    title: title.slice(0, 200),
    org: (raw.org ?? '').trim().slice(0, 120),
    description: (raw.description ?? '').trim().slice(0, 1200),
    url,
    type: VALID_TYPES.has(raw.type) ? raw.type : 'program',
    cost: VALID_COSTS.has(raw.cost) ? raw.cost : 'free',
    format: VALID_FORMATS.has(raw.format) ? raw.format : 'online',
    location: (raw.location ?? '').trim().slice(0, 200),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(raw.deadline ?? '') ? raw.deadline : null,
    lat: Number.isFinite(raw.lat) ? raw.lat : null,
    lng: Number.isFinite(raw.lng) ? raw.lng : null,
    distance_mi: Number.isFinite(raw.distance_mi) ? raw.distance_mi : null,
    needs_review: raw.needs_review ? 1 : 0,
    age_min: Number.isInteger(raw.age_min) ? raw.age_min : 14,
    age_max: Number.isInteger(raw.age_max) ? raw.age_max : 18,
    source: (raw.source ?? 'scraper').slice(0, 40),
  };
}

ingestRouter.post('/', async (c) => {
  if (!checkIngestToken(c.env, c.req.header('Authorization'))) {
    return c.json({ error: 'Bad or missing ingest token.' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length > 500) return c.json({ error: 'Too many items in one push.' }, 413);

  let added = 0;
  let skipped = 0;
  const errors = [];

  for (const raw of items) {
    const item = normalize(raw);
    if (!item) {
      skipped++;
      continue;
    }
    const fingerprint = fingerprintOf(item);
    if (await first(c.env.DB, 'SELECT 1 FROM opportunities WHERE fingerprint = ?', fingerprint)) {
      skipped++;
      continue;
    }
    try {
      await run(
        c.env.DB,
        `INSERT INTO opportunities
           (title, org, description, url, type, deadline, cost, format, location,
            lat, lng, distance_mi, age_min, age_max, source, status, needs_review, fingerprint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        item.title, item.org, item.description, item.url, item.type, item.deadline,
        item.cost, item.format, item.location, item.lat, item.lng, item.distance_mi,
        item.age_min, item.age_max, item.source, item.needs_review, fingerprint
      );
      added++;
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) skipped++;
      else errors.push(`${item.title}: ${err.message}`);
    }
  }

  return c.json({ added, skipped, errors });
});
