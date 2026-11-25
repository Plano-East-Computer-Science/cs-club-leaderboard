/**
 * Share cards and search: the Worker writes each public page's title and
 * preview into the shell's <head>, and serves a real sitemap and robots.txt.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import worker from '../worker/index.js';
import { PAGES, pageMeta } from '../shared/seo.js';

const shell = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ASSETS = {
  async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === '/index.html') return new Response(shell, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (p === '/og.png') return new Response('png', { headers: { 'Content-Type': 'image/png' } });
    return new Response('not found', { status: 404 });
  },
};
const get = async (path, env = {}) => {
  const res = await worker.fetch(new Request(`https://club.test${path}`), { ASSETS, ...env }, { waitUntil() {}, passThroughOnException() {} });
  return { res, text: await res.text() };
};

// every public page has a distinct title and a snippet short enough for a search result
const titles = new Set();
for (const [p, m] of Object.entries(PAGES)) {
  assert.ok(m.title && m.description, `${p} has a title and snippet`);
  assert.ok(m.description.length <= 200, `${p} snippet fits a search result`);
  assert.ok(!titles.has(m.title), `${p} has its own title`);
  titles.add(m.title);
}

// a page link gets its own card, written into the HTML
const about = await get('/about');
assert.equal(about.res.status, 200);
assert.ok(about.text.includes(`<title>${PAGES['/about'].title}</title>`), 'title');
assert.ok(about.text.includes('property="og:title"'), 'og:title');
assert.ok(about.text.includes('content="https://club.test/og.png"'), 'og:image is absolute');
assert.ok(about.text.includes('rel="canonical" href="https://club.test/about"'), 'canonical');
assert.equal((about.text.match(/<title>/g) || []).length, 1, 'one title');
assert.equal((about.text.match(/name="description"/g) || []).length, 1, 'one description');
assert.ok(about.text.includes('id="root"'), 'the app shell is still there');

// a trailing slash is the same page; an unknown page and the home page get the default card
assert.equal(pageMeta('/about/').title, PAGES['/about'].title);
assert.ok((await get('/student/12')).text.includes(`<title>${PAGES['/'].title}</title>`));
assert.ok((await get('/')).text.includes('rel="canonical" href="https://club.test/"'));

// files that are not the shell pass through untouched
assert.equal((await get('/og.png')).text, 'png');

// the API is not the app
assert.equal((await get('/api/nope')).res.status, 404);

// sitemap lists every public page; robots points to it, and dev stays closed
const map = await get('/sitemap.xml');
assert.ok(map.res.headers.get('Content-Type').includes('xml'));
for (const p of Object.keys(PAGES)) assert.ok(map.text.includes(`<loc>https://club.test${p}</loc>`), `sitemap has ${p}`);
const live = await get('/robots.txt');
assert.ok(live.text.includes('Sitemap: https://club.test/sitemap.xml') && !/^Disallow: \/$/m.test(live.text), 'live robots is open');
assert.ok(live.text.includes('Disallow: /hq'), 'signed-in areas stay out of search');
assert.equal((await get('/robots.txt', { NOINDEX: '1' })).text, 'User-agent: *\nDisallow: /\n', 'dev robots is closed');

console.log('seo: all checks passed');
