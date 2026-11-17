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

/**
 * Devpost gives dates as "Mar 01 - Apr 15, 2026", "Nov 15 - 17, 2026" (same
 * month, so the end has no month of its own) or "Jan 05, 2027". We want the end
 * date, ISO.
 */
export function parseDevpostDeadline(text) {
  if (!text) return null;
  const [start, end = start] = String(text).split(/\s+[-–]\s+/);
  const m = end.trim().match(/^(?:([A-Z][a-z]{2})\s+)?(\d{1,2}),?\s*(\d{4})?$/);
  if (!m) return null;
  const mon = m[1] ?? start.match(/^[A-Z][a-z]{2}/)?.[0];
  const year = m[3] ?? start.match(/\d{4}/)?.[0] ?? new Date().getFullYear();
  if (!mon) return null;
  const d = new Date(`${mon} ${m[2]}, ${year} UTC`);
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
    // MLH seasons start in the autumn of the previous calendar year, so in
    // November the live season is already next year's. Read both and let the
    // run's expiry filter discard whatever has finished.
    const year = new Date().getFullYear();
    const out = [];

    for (const season of [year, year + 1]) {
    const html = await getText(`https://mlh.io/seasons/${season}/events`);
    const $ = cheerio.load(html);

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
    }

    // The season pages can overlap; keep one copy of each event.
    const seen = new Set();
    return out.filter((e) => !seen.has(e.url) && seen.add(e.url)).slice(0, 40);
  },
};

/**
 * Hack Club's curated list of high school hackathons.
 *
 * An open JSON feed with coordinates, so in-person events skip geocoding.
 * Non-US events that are not online are dropped here, as with MLH.
 */
const hackclub = {
  id: 'hackclub',
  label: 'Hack Club — high school hackathons',
  async fetchAll() {
    const raw = await getText('https://hackathons.hackclub.com/api/events/upcoming');
    let list;
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(list)) return [];

    const out = [];
    for (const h of list) {
      const title = clean(h.name);
      if (!title || !/^https?:\/\//.test(h.website ?? '')) continue;
      const online = Boolean(h.virtual) && !h.hybrid;
      if (!online && h.countryCode !== 'US') continue;

      const place = [h.city, h.state].filter(Boolean).join(', ');
      out.push({
        title,
        org: 'Hack Club',
        description: `High school hackathon. ${online ? 'Runs online.' : place}`.trim(),
        url: h.website,
        type: 'competition',
        cost: 'free',
        format: online ? 'online' : 'local',
        location: online ? '' : place,
        lat: online ? null : h.latitude ?? null,
        lng: online ? null : h.longitude ?? null,
        deadline: h.start ? h.start.slice(0, 10) : null,
        age_min: 14,
        age_max: 18,
      });
    }
    return out;
  },
};

/**
 * CTFtime: capture-the-flag contests in the next 90 days. Open API, no key, but
 * it asks for a descriptive User-Agent. Onsite events are dropped because there
 * are no coordinates to filter by.
 */
const FEED_UA = 'PlanoEastCSClub/1.0 (+https://peshcompsci.org)';

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': FEED_UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res.json().catch(() => null);
}

export function parseCtftime(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    const title = clean(e.title);
    const url = e.url || e.ctftime_url;
    if (!title || !/^https?:\/\//.test(url ?? '') || e.onsite) continue;
    out.push({
      title,
      org: 'CTFtime',
      description: clean(`Online CTF (cybersecurity contest), ${clean(e.format)} format. ${(e.description ?? '').slice(0, 200)}`),
      url,
      type: 'competition',
      cost: 'free',
      format: 'online',
      location: '',
      deadline: e.start ? String(e.start).slice(0, 10) : null,
      age_min: 14,
      age_max: 18,
    });
  }
  return out;
}

const ctftime = {
  id: 'ctftime',
  label: 'CTFtime - online CTF contests',
  async fetchAll() {
    const now = Math.floor(Date.now() / 1000);
    return parseCtftime(
      await getJson(`https://ctftime.org/api/v1/events/?limit=50&start=${now}&finish=${now + 90 * 86400}`)
    );
  },
};

/**
 * Hack Club's official events API (ru.hackclub.com): online programs and
 * hackathons. In-person-only events are skipped (no coordinates). The deadline
 * is the end date, or the start date when no end is announced.
 */
export function parseHackClubEvents(json) {
  const list = Array.isArray(json?.data) ? json.data : [];
  const out = [];
  for (const e of list) {
    const title = clean(e.name);
    if (!title || !/^https?:\/\//.test(e.url ?? '')) continue;
    if (e.status === 'ended' || e.format === 'in-person') continue;
    out.push({
      title,
      org: 'Hack Club',
      description: clean(e.description) || 'Hack Club event for teenagers. Runs online.',
      url: e.url,
      type: 'competition',
      cost: 'free',
      format: 'online',
      location: '',
      deadline: (e.endDate ?? e.startDate ?? '').slice(0, 10) || null,
      age_min: 14,
      age_max: 18,
    });
  }
  return out;
}

const hackclubEvents = {
  id: 'hackclub-events',
  label: 'Hack Club - events API',
  async fetchAll() {
    return parseHackClubEvents(await getJson('https://ru.hackclub.com/api/v1/events?status=upcoming,ongoing&limit=100'));
  },
};

export const SOURCES = [devpost, mlh, hackclub, ctftime, hackclubEvents];

export const SOURCES_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
