/**
 * The weekly opportunity scrape.
 *
 * Runs in GitHub Actions, not in the Worker. A free Worker gets 10ms of CPU per
 * request, and parsing a few hundred kilobytes of HTML with cheerio blows
 * through that immediately. Actions has no such limit, so the heavy work
 * happens here and only finished rows are sent to the site.
 *
 * Flow:  fetch sources -> apply the 15-mile rule -> POST to /api/ingest
 *
 * Everything arrives at the site as status='pending'. Nothing reaches the
 * public board until an admin approves it.
 *
 * Required environment:
 *   SITE_URL      https://your-domain.org
 *   INGEST_TOKEN  the same value set with `wrangler secret put INGEST_TOKEN`
 * Optional:
 *   FIRECRAWL_API_KEY   switches on the Firecrawl tier
 */
import { SOURCES } from './sources.js';
import { runFirecrawl, firecrawlEnabled } from './firecrawl.js';
import { withinRadius } from '../worker/geo.js';

const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/+$/, '');
const INGEST_TOKEN = process.env.INGEST_TOKEN ?? '';

if (!SITE_URL || !INGEST_TOKEN) {
  console.error('SITE_URL and INGEST_TOKEN must both be set.');
  process.exit(1);
}

/** Nominatim asks for no more than one request per second. Be a good citizen. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchConfig() {
  try {
    const res = await fetch(`${SITE_URL}/api/ingest/config`, {
      headers: { Authorization: `Bearer ${INGEST_TOKEN}` },
    });
    if (!res.ok) return { firecrawl_urls: [] };
    return await res.json();
  } catch {
    return { firecrawl_urls: [] };
  }
}

async function main() {
  const collected = [];
  const report = [];

  for (const source of SOURCES) {
    try {
      const items = await source.fetchAll();
      collected.push(...items.map((i) => ({ ...i, source: source.id })));
      report.push(`${source.label}: ${items.length} found`);
    } catch (err) {
      // One dead source must never abort the whole run.
      report.push(`${source.label}: FAILED -- ${err.message}`);
    }
  }

  if (firecrawlEnabled()) {
    const { firecrawl_urls = [] } = await fetchConfig();
    if (firecrawl_urls.length) {
      const { items, errors } = await runFirecrawl(firecrawl_urls);
      collected.push(...items.map((i) => ({ ...i, source: 'firecrawl' })));
      report.push(`Firecrawl: ${items.length} found`);
      for (const e of errors) report.push(`Firecrawl error: ${e}`);
    }
  }

  // The 15-mile rule. Online and residential pass automatically; in-person
  // listings get geocoded and dropped if they are too far to drive to.
  const kept = [];
  let rejected = 0;
  for (const item of collected) {
    if (item.format === 'local') await sleep(1100);
    const geo = await withinRadius(item);
    if (!geo.keep) {
      rejected++;
      continue;
    }
    kept.push({
      ...item,
      lat: geo.lat,
      lng: geo.lng,
      distance_mi: geo.distance_mi,
      needs_review: geo.needs_review,
    });
  }

  const res = await fetch(`${SITE_URL}/api/ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${INGEST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: kept }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Push failed (HTTP ${res.status}):`, result.error ?? '');
    process.exit(1);
  }

  console.log(report.join('\n'));
  console.log(
    `\nScraped ${collected.length}, dropped ${rejected} as too far, sent ${kept.length}.`
  );
  console.log(`Site added ${result.added} new, skipped ${result.skipped} already known.`);
  if (result.errors?.length) console.log('Errors:', result.errors.join('; '));
  console.log('\nNew items are waiting for approval in the admin panel under Pending.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
