/**
 * Reader mode (H3): fetch a documentation page on the server and hand the
 * browser only text and code as structured JSON. Upstream HTML never reaches
 * the page, so there is nothing to sandbox: the React side renders text nodes.
 *
 * Safety, in the order it is applied:
 *   - signed-in members only, rate limited per member;
 *   - https, port 443, no userinfo, no IP literals, and the hostname must
 *     exactly match the allowlist (re-checked on every redirect hop, max 3);
 *   - no cookies or credentials are sent; text/html and text/plain only;
 *   - the body is read through a byte cap, with a timeout per hop;
 *   - the extractor below emits text only: scripts, styles, forms, iframes,
 *     images and every attribute (handlers included) are dropped.
 *
 * Pure parts (checkUrl, extract, fetchPage with an injected fetch) are tested
 * in test/reader.test.js without a network.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { hitOrRefuse } from './ratelimit.js';
import { DEFAULT_HOSTS, hostsFrom, parseHostList } from './gateway.js';

export const readerRouter = new Hono(); // mounted at /api
export const readerAdminRouter = new Hono(); // officers, mounted at /api/admin/hub

/** Documentation hosts readable without the gateway. Officers can replace this list. */
export const READER_DEFAULT_HOSTS = ['docs.python.org', 'developer.mozilla.org', 'en.cppreference.com', 'usaco.guide', 'cses.fi'];

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const MAX_BLOCKS = 3000;
const MAX_TEXT = 6000;
const PER_MINUTE = 20;

/* ------------------------------ allowlist ------------------------------ */

/** The reader list from settings (or the default), plus everything the gateway already approves. */
export function readerHosts(readerSetting, gatewaySetting) {
  const custom = String(readerSetting ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return [...new Set([...(custom.length ? custom : READER_DEFAULT_HOSTS), ...hostsFrom(gatewaySetting)])];
}

/**
 * Validates a URL a member asked to read. Returns { url } (a URL object) or
 * { error, status }. The hostname must be on the list exactly: WHATWG parsing
 * has already resolved userinfo tricks like https://docs.python.org@evil.com/
 * (host becomes evil.com), and any userinfo at all is refused as well.
 */
export function checkUrl(raw, hosts) {
  let url;
  try {
    url = new URL(String(raw ?? '').trim());
  } catch {
    return { error: 'That is not a web address.', status: 400 };
  }
  if (url.protocol !== 'https:') return { error: 'Only https pages can be read.', status: 400 };
  if (url.username || url.password) return { error: 'Addresses with a login in them are not allowed.', status: 400 };
  if (url.port && url.port !== '443') return { error: 'Only the standard https port is allowed.', status: 400 };
  const host = url.hostname.toLowerCase();
  // IPv6 literals keep their brackets; IPv4 (any notation the parser normalised) is all digits and dots.
  if (host.startsWith('[') || /^[0-9.]+$/.test(host) || !host.includes('.') || host === 'localhost') {
    return { error: 'Addresses must use a site name, not a number.', status: 400 };
  }
  if (!hosts.includes(host)) return { error: `${host} is not on the reader list. Ask an officer to add it.`, status: 403 };
  url.hash = '';
  return { url };
}

/* ------------------------------ fetching ------------------------------ */

/** Reads at most `max` bytes. Returns { text, truncated }. */
export async function readCapped(res, max = MAX_BYTES) {
  if (!res.body) return { text: '', truncated: false };
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      chunks.push(value.subarray(0, value.byteLength - (size - max)));
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return { text: new TextDecoder('utf-8').decode(all), truncated };
}

/**
 * Fetches `startUrl`, following up to MAX_REDIRECTS redirects by hand and
 * re-checking the allowlist on every hop. `fetchImpl` is injectable for tests.
 * Returns { url, text, truncated } or { error, status }.
 */
export async function fetchPage(startUrl, hosts, fetchImpl = fetch) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ok = checkUrl(current.href, hosts);
    if (ok.error) return hop === 0 ? ok : { error: 'That page sends you to a site that is not on the reader list.', status: 403 };
    let res;
    try {
      res = await fetchImpl(ok.url.href, {
        method: 'GET',
        redirect: 'manual',
        headers: { accept: 'text/html,text/plain;q=0.9', 'user-agent': 'cs-club-reader' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return { error: 'Could not reach that page.', status: 502 };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      if (!loc) return { error: 'That page sent a bad redirect.', status: 502 };
      try { current = new URL(loc, ok.url); } catch { return { error: 'That page sent a bad redirect.', status: 502 }; }
      continue;
    }
    if (!res.ok) { await res.body?.cancel().catch(() => {}); return { error: `That site answered ${res.status}.`, status: 502 }; }
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!type.startsWith('text/html') && !type.startsWith('text/plain')) {
      await res.body?.cancel().catch(() => {});
      return { error: 'Reader mode only handles web pages and plain text.', status: 415 };
    }
    const { text, truncated } = await readCapped(res);
    return { url: ok.url, text, truncated, plain: type.startsWith('text/plain') };
  }
  return { error: 'That page redirects too many times.', status: 502 };
}

/* ------------------------------ extraction ------------------------------ */

// Elements dropped together with everything inside them.
const SKIP = new Set(['script', 'style', 'iframe', 'form', 'svg', 'noscript', 'template', 'object', 'embed', 'nav', 'footer', 'aside', 'button', 'select', 'textarea', 'canvas', 'audio', 'video', 'picture', 'math']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']); // content is not markup
const BLOCK = new Set(['p', 'div', 'section', 'article', 'main', 'header', 'blockquote', 'tr', 'dd', 'dt', 'figure', 'figcaption', 'table', 'ul', 'ol', 'dl', 'details', 'summary', 'caption']);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>?/y; // sticky: no slicing per tag
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', hellip: '...', mdash: '-', ndash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', rarr: '->', larr: '<-', times: 'x', middot: '.', bull: '*' };

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 8 && n < 0x110000 && !(n >= 0xd800 && n < 0xe000) ? String.fromCodePoint(n) : ' ';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Parses a start tag's attributes into a plain object (lowercase names). Only href is ever used. */
function attrs(src) {
  const out = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (let m; (m = re.exec(src)); ) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

/**
 * Turns HTML into { title, blocks } where a block is
 *   { t: 'h', level, runs } | { t: 'p', runs } | { t: 'li', runs } | { t: 'pre', text }
 * and a run is { s: text } or { s: text, to: '/read?url=...' } for a link whose
 * target is itself readable. Nothing else survives. `hosts` decides which links
 * become reader links; `baseUrl` resolves relative hrefs.
 */
export function extract(html, baseUrl, hosts) {
  const blocks = [];
  let title = '';
  let runs = [];
  let kind = { t: 'p' };
  let link = null; // { to } while inside <a>
  let pre = null; // string while inside <pre>
  let skip = null; // { name, depth } while inside a dropped element

  const flush = () => {
    if (pre != null) return;
    const merged = [];
    for (const r of runs) {
      const last = merged[merged.length - 1];
      if (last && !r.to && !last.to) last.s += r.s;
      else merged.push({ ...r });
    }
    if (merged.length) {
      merged[0].s = merged[0].s.trimStart();
      merged[merged.length - 1].s = merged[merged.length - 1].s.trimEnd();
    }
    const clean = merged.filter((r) => r.s);
    if (clean.length && blocks.length < MAX_BLOCKS) {
      let used = 0;
      for (const r of clean) { r.s = r.s.slice(0, Math.max(0, MAX_TEXT - used)); used += r.s.length; }
      blocks.push({ ...kind, runs: clean.filter((r) => r.s) });
    }
    runs = [];
    kind = { t: 'p' };
  };
  const addText = (raw) => {
    const t = decode(raw);
    if (pre != null) { pre += t; return; }
    const s = t.replace(/\s+/g, ' ');
    if (s) runs.push(link?.to ? { s, to: link.to } : { s });
  };
  const target = (href) => {
    try {
      const u = new URL(href, baseUrl);
      if (u.protocol !== 'https:' || !checkUrl(u.href, hosts).url) return null;
      u.hash = '';
      return `/read?url=${encodeURIComponent(u.href)}`;
    } catch {
      return null;
    }
  };

  const lower = html.toLowerCase();
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { if (!skip) addText(html.slice(i)); break; }
    if (lt > i && !skip) addText(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    TAG.lastIndex = lt;
    const m = TAG.exec(html);
    if (!m) {
      // "<!doctype", "<?xml", "<" in text: step over it as one unit or as a literal "<".
      const end = html[lt + 1] === '!' || html[lt + 1] === '?' ? html.indexOf('>', lt) : -1;
      if (end >= 0) i = end + 1;
      else { if (!skip) addText('<'); i = lt + 1; }
      continue;
    }
    i = lt + m[0].length;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();

    if (RAW.has(name) && !closing) {
      const end = lower.indexOf(`</${name}`, i);
      const body = html.slice(i, end < 0 ? html.length : end);
      if (name === 'title' && !title && !skip) title = decode(body).replace(/\s+/g, ' ').trim().slice(0, 200);
      const close = end < 0 ? -1 : lower.indexOf('>', end);
      i = close < 0 ? html.length : close + 1;
      continue;
    }

    if (skip) {
      if (name === skip.name && !VOID.has(name)) {
        skip.depth += closing ? -1 : 1;
        if (skip.depth === 0) skip = null;
      }
      continue;
    }
    if (SKIP.has(name) && !closing) {
      flush();
      skip = { name, depth: 1 };
      continue;
    }

    if (name === 'pre') {
      if (closing) {
        if (pre != null) {
          const text = pre.replace(/^\n+|\s+$/g, '').slice(0, MAX_TEXT * 2);
          pre = null;
          if (text && blocks.length < MAX_BLOCKS) blocks.push({ t: 'pre', text });
        }
      } else { flush(); pre = ''; }
    } else if (pre != null) {
      if (name === 'br') pre += '\n';
    } else if (/^h[1-6]$/.test(name)) {
      flush();
      if (!closing) kind = { t: 'h', level: Number(name[1]) };
    } else if (name === 'li') {
      flush();
      if (!closing) kind = { t: 'li' };
    } else if (BLOCK.has(name)) {
      flush();
    } else if (name === 'br') {
      addText(' ');
    } else if (name === 'a') {
      if (closing) link = null;
      else { const to = attrs(m[3]).href ? target(attrs(m[3]).href) : null; link = { to }; }
    }
  }
  flush();
  if (pre != null && pre.trim()) blocks.push({ t: 'pre', text: pre.trim().slice(0, MAX_TEXT * 2) });
  return { title, blocks };
}

/** Plain-text responses become one code block. */
export const extractPlain = (text) => ({ title: '', blocks: text.trim() ? [{ t: 'pre', text: text.slice(0, MAX_TEXT * 8) }] : [] });

/* -------------------------------- routes -------------------------------- */

async function loadHosts(db) {
  const rows = (await db.prepare(`SELECT key, value FROM settings WHERE key IN ('reader_hosts', 'gateway_hosts')`).all()).results;
  const get = (k) => rows.find((r) => r.key === k)?.value;
  return readerHosts(get('reader_hosts'), get('gateway_hosts'));
}

readerRouter.get('/read', requireUser, async (c) => {
  const user = c.get('user');
  const hosts = await loadHosts(c.env.DB);
  const ok = checkUrl(c.req.query('url'), hosts);
  if (ok.error) return c.json({ error: ok.error }, ok.status);

  // Brief shared cache, keyed by URL. Only reached after sign-in and the allowlist check.
  const cacheKey = new Request(`https://reader.cache.invalid/?u=${encodeURIComponent(ok.url.href)}`);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const hit = cache ? await cache.match(cacheKey).catch(() => null) : null;
  if (hit) return c.json(await hit.json());

  if (await hitOrRefuse(c.env.DB, `reader:${user.id}`, PER_MINUTE, 60_000)) {
    return c.json({ error: 'You are reading very fast. Wait a minute and try again.' }, 429);
  }

  const page = await fetchPage(ok.url, hosts);
  if (page.error) return c.json({ error: page.error }, page.status);
  const out = { url: page.url.href, truncated: page.truncated, ...(page.plain ? extractPlain(page.text) : extract(page.text, page.url, hosts)) };
  if (cache) {
    c.executionCtx.waitUntil(
      cache.put(cacheKey, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' } })).catch(() => {})
    );
  }
  return c.json(out);
});

/** The list members can read from, for the "what can I read" hint on the page. */
readerRouter.get('/read/hosts', requireUser, async (c) => c.json({ hosts: await loadHosts(c.env.DB) }));

readerAdminRouter.get('/reader', async (c) => {
  const row = await c.env.DB.prepare(`SELECT value FROM settings WHERE key = 'reader_hosts'`).first();
  const custom = String(row?.value ?? '').split(',').filter(Boolean);
  return c.json({ hosts: custom.length ? custom : READER_DEFAULT_HOSTS, always: DEFAULT_HOSTS });
});

/** Replace the reader list. An empty list restores the defaults. */
readerAdminRouter.put('/reader', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = parseHostList(body?.hosts);
  if (parsed.error) return c.json({ error: parsed.error }, 400);
  await c.env.DB
    .prepare(`INSERT INTO settings (key, value) VALUES ('reader_hosts', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(parsed.hosts.join(','))
    .run();
  return c.json({ hosts: parsed.hosts.length ? parsed.hosts : READER_DEFAULT_HOSTS, always: DEFAULT_HOSTS });
});
