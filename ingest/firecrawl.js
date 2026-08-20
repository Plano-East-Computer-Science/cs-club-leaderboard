/**
 * Tier 2 ingest: Firecrawl.
 *
 * Only runs when an admin clicks "Refresh from sources" AND a FIRECRAWL_API_KEY
 * exists. Never on a timer -- that is what keeps a free credit allowance from
 * draining in the background.
 *
 * The list of pages to scrape is a setting (`firecrawl_urls`, one URL per line)
 * so new sources can be added from the admin panel without touching code.
 *
 * If anything at all goes wrong -- no key, bad response, changed API -- this
 * returns an empty list and the free tier-1 sources carry the run on their own.
 */

const ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';

const SCHEMA = {
  type: 'object',
  properties: {
    opportunities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          org: { type: 'string' },
          description: { type: 'string' },
          url: { type: 'string' },
          type: {
            type: 'string',
            enum: ['internship', 'competition', 'program', 'resource', 'scholarship'],
          },
          deadline: { type: 'string', description: 'ISO date YYYY-MM-DD, or empty if rolling' },
          cost: { type: 'string', enum: ['free', 'paid', 'stipend'] },
          format: { type: 'string', enum: ['online', 'local', 'residential'] },
          location: { type: 'string', description: 'City and state if in person, else empty' },
        },
        required: ['title', 'url'],
      },
    },
  },
  required: ['opportunities'],
};

const PROMPT = [
  'Extract STEM and computer science opportunities suitable for high school students aged 14 to 17:',
  'internships, competitions, summer programs, scholarships, and learning resources.',
  'Set format to "local" only when a student must physically attend at a specific address,',
  '"residential" when the program houses participants, and "online" when it is fully remote.',
  'Ignore anything restricted to college students or adults.',
].join(' ');

export function firecrawlEnabled() {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

async function scrapeOne(url, key) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      onlyMainContent: true,
      formats: [{ type: 'json', prompt: PROMPT, schema: SCHEMA }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`Firecrawl returned HTTP ${res.status} for ${url}`);
  const json = await res.json();
  const found = json?.data?.json?.opportunities;
  return Array.isArray(found) ? found : [];
}

/**
 * @param {string[]} urls  pages to scrape
 * @returns {Promise<{items: object[], errors: string[]}>}
 */
export async function runFirecrawl(urls) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key || !urls?.length) return { items: [], errors: [] };

  const items = [];
  const errors = [];
  // Sequential on purpose: gentler on a free-tier rate limit than parallel bursts.
  for (const url of urls) {
    try {
      for (const raw of await scrapeOne(url, key)) {
        items.push({
          title: raw.title,
          org: raw.org || new URL(url).hostname.replace(/^www\./, ''),
          description: raw.description ?? '',
          url: raw.url?.startsWith('http') ? raw.url : url,
          type: raw.type || 'program',
          cost: raw.cost || 'free',
          format: raw.format || 'online',
          location: raw.location ?? '',
          deadline: /^\d{4}-\d{2}-\d{2}$/.test(raw.deadline ?? '') ? raw.deadline : null,
          age_min: 14,
          age_max: 18,
        });
      }
    } catch (err) {
      errors.push(`firecrawl(${url}): ${err.message}`);
    }
  }
  return { items, errors };
}
