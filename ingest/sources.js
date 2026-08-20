/**
 * Where new opportunities come from.
 *
 * Tier 1 (here): sources that need no API key and cost nothing, ever. These run
 * on a weekly timer inside the server.
 *
 * Tier 2 (firecrawl.js): sources that need JavaScript rendering. Those only run
 * when an admin clicks "Refresh from sources", so a free credit allowance is
 * never drained in the background.
 *
 * Every parser is defensive: if a site changes its markup, the parser returns an
 * empty list and the ingest run continues with the other sources.
 */
import * as cheerio from 'cheerio';

const UA =
  'PlanoEastCSClub-Leaderboard/1.0 (high school club opportunity board; contact via site)';

async function getText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res.text();
}

/** Trims and collapses whitespace; returns '' for null-ish input. */
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Devpost publishes an open JSON endpoint. No key, no rate limit worth worrying about. */
const devpost = {
  id: 'devpost',
  label: 'Devpost — open online hackathons',
  async fetchAll() {
    const raw = await getText(
      'https://devpost.com/api/hackathons?challenge_type[]=online&status[]=open&order_by=deadline'
    );
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return [];
    }
    const list = Array.isArray(json?.hackathons) ? json.hackathons : [];
    return list.slice(0, 25).map((h) => ({
      title: clean(h.title),
      org: 'Devpost',
      description: clean(
        [h.displayed_location?.location, ...(h.themes ?? []).map((t) => t.name)]
          .filter(Boolean)
          .join(' · ')
      ) || 'Online hackathon listed on Devpost.',
      url: h.url?.startsWith('http') ? h.url : `https:${h.url ?? ''}`,
      type: 'competition',
      cost: 'free',
      format: 'online',
      deadline: parseDevpostDeadline(h.submission_period_dates),
      age_min: 14,
      age_max: 18,
    }));
  },
};

/** Devpost gives dates as "Mar 01 - Apr 15, 2026". We want the end date, ISO. */
export function parseDevpostDeadline(text) {
  if (!text) return null;
  const m = String(text).match(/([A-Z][a-z]{2})\s+(\d{1,2}),?\s*(\d{4})?\s*$/);
  if (!m) return null;
  const [, mon, day, year] = m;
  const d = new Date(`${mon} ${day}, ${year ?? new Date().getFullYear()} UTC`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Major League Hacking season page.
 *
 * Read through schema.org microdata rather than CSS classes. MLH restyles the
 * page regularly, but the structured-data attributes are what search engines
 * consume, so they stay put.
 *
 * Non-US events are dropped here rather than at the distance filter: geocoding
 * a hackathon in Hyderabad only to reject it wastes a network round trip.
 */
const mlh = {
  id: 'mlh',
  label: 'Major League Hacking — season events',
  async fetchAll() {
    const season = new Date().getFullYear();
    const html = await getText(`https://mlh.io/seasons/${season}/events`);
    const $ = cheerio.load(html);
    const out = [];

    $('[itemtype="https://schema.org/Event"]').each((_, el) => {
      const $el = $(el);
      const title = clean($el.find('h4').first().text());
      const url =
        $el.find('[itemprop="url"]').attr('content') ||
        $el.find('[itemprop="url"]').attr('href') ||
        $el.attr('href');
      if (!title || !url) return;

      const country = $el.find('[itemprop="addressCountry"]').attr('content');
      const online = /OnlineEventAttendanceMode/i.test(
        $el.find('[itemprop="eventAttendanceMode"]').attr('content') ?? ''
      );
      if (!online && country !== 'US') return;

      const city = clean($el.find('[itemprop="addressLocality"]').attr('content'));
      const region = clean($el.find('[itemprop="addressRegion"]').attr('content'));
      const start = $el.find('[itemprop="startDate"]').attr('content');

      out.push({
        title,
        org: 'Major League Hacking',
        description: [
          `Student hackathon in the MLH ${season} season.`,
          online ? 'Runs online.' : [city, region].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(' '),
        url,
        type: 'competition',
        cost: 'free',
        format: online ? 'online' : 'local',
        location: online ? '' : [city, region].filter(Boolean).join(', '),
        deadline: start ? start.slice(0, 10) : null,
        age_min: 14,
        age_max: 18,
      });
    });

    return out.slice(0, 40);
  },
};

export const SOURCES = [devpost, mlh];

export const SOURCES_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
