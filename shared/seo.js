/**
 * What a link to a page looks like before the app loads: its tab title, its
 * search snippet and its share card (Discord, iMessage, Instagram, search).
 * Crawlers and link previews do not run JavaScript, so the Worker writes these
 * into the page's <head> (worker/index.js), and the app keeps the tab title in
 * step as a member moves around (src/App.jsx). One table, used by both.
 */

export const SITE = 'Plano East CS';

const DEFAULT = {
  title: 'Plano East CS Club',
  description:
    'The Plano East Senior High School computer science club: weekly meetings, free practice and lessons you run in the browser, projects, competitions and opportunities.',
};

/** Public pages worth sharing and indexing, in sitemap order. Anything not listed gets the default card. */
export const PAGES = {
  '/': { title: DEFAULT.title, description: DEFAULT.description },
  '/about': { title: `About the club | ${SITE}`, description: 'Who we are, when we meet, and what a Plano East CS meeting looks like. Open to grades 9 to 12, no experience needed.' },
  '/join': { title: `How to join | ${SITE}`, description: 'Join the Plano East CS club in a minute: make an account, come to a Wednesday meeting, and start earning points.' },
  '/compete': { title: `Standings | ${SITE}`, description: 'The season standings for the Plano East CS club. Every point counts toward the prize, and from the first tier up each point is a raffle ticket.' },
  '/competitions': { title: `Competitions and results | ${SITE}`, description: 'USACO, UIL, hackathons and more: where Plano East CS competes, how to prepare, and how we have done.' },
  '/opportunities': { title: `Opportunities | ${SITE}`, description: 'Summer programs, internships, contests and scholarships for high school students interested in computer science, with deadlines.' },
  '/calendar': { title: `Calendar | ${SITE}`, description: 'Club meetings, contest dates and application deadlines in one calendar you can add to your phone.' },
  '/curriculum': { title: `What we teach | ${SITE}`, description: 'The Plano East CS curriculum: Java, Python, contest problems, AI, data and cybersecurity, all year.' },
  '/learn': { title: `Learn | ${SITE}`, description: 'Short lessons, quick checks and real code you run in the page. Nothing to install and no account needed to start.' },
  '/practice': { title: `Practice | ${SITE}`, description: 'Five ladders of free problems and lessons, from your first program to USACO. Pick a rung and run your code right in the page.' },
  '/play': { title: `Play | ${SITE}`, description: 'Daily CS puzzles: guess the term, trace the code, sort the groups. A new set every day, keep your streak.' },
  '/build': { title: `Build | ${SITE}`, description: 'Ship something real this cycle. Pitch it, post devlogs, show it at the demo, and the club votes.' },
  '/puzzles': { title: `Problem of the week | ${SITE}`, description: 'A new computer science problem every week from the Plano East CS club.' },
  '/cyber': { title: `Cybersecurity | ${SITE}`, description: 'Capture the flag and the basics of cybersecurity, from your first decoded message to CyberPatriot and picoCTF.' },
  '/quests': { title: `Quests | ${SITE}`, description: 'Small things to do on the club site that earn bonus points as you go.' },
  '/ideas': { title: `Ideas board | ${SITE}`, description: 'Post what you want the club to teach, build or host, and vote on what others posted.' },
  '/parents': { title: `For parents | ${SITE}`, description: 'What the Plano East CS club site is, what it keeps about students, and who runs it.' },
  '/privacy': { title: `Privacy | ${SITE}`, description: 'Exactly what this site keeps about you, and how to delete it.' },
};

const clean = (pathname) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname);

/** The meta for a path, ignoring a trailing slash. */
export function pageMeta(pathname) {
  return PAGES[clean(pathname)] || DEFAULT;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The shell page with this path's title, snippet and share card written into <head>. */
export function withMeta(html, origin, pathname) {
  const m = pageMeta(pathname);
  const url = origin + clean(pathname);
  const image = `${origin}/og.png`;
  const tags = [
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ].join('\n    ');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(m.title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, () => `<meta name="description" content="${esc(m.description)}" />`)
    .replace('</head>', () => `    ${tags}\n  </head>`);
}

/** sitemap.xml: every public page above. */
export function sitemapXml(origin) {
  const urls = Object.keys(PAGES)
    .map((p) => `  <url><loc>${origin}${p}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** robots.txt: the dev site is closed to crawlers, the live site is open except for the signed-in areas. */
export function robotsTxt(origin, closed) {
  if (closed) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nDisallow: /api/\nDisallow: /hq\nDisallow: /me\nDisallow: /signin\nDisallow: /room\nDisallow: /host/\n\nSitemap: ${origin}/sitemap.xml\n`;
}
