# Plano East CS Club — Leaderboard & Opportunity Board

A points leaderboard for the club, a geo-filtered STEM opportunity board for ages 14–17, an About page, and a password-protected admin panel that needs no technical knowledge to operate.

- **Standings** — rating tiers, top-three podium, the Meta Ray-Ban prize, per-member profiles with a full point history.
- **Opportunities** — internships, competitions, programs, and free resources. Anything in person is within **15 miles** of the school; everything else is online or houses you.
- **Admin** — award points, manage members and badges, approve automatically-found opportunities, edit every piece of text on the site, download and restore backups.

**Setting it up for the first time? → [DEPLOY.md](DEPLOY.md)**
**Never used a database? → [LEARN-DATABASE.md](LEARN-DATABASE.md)**

---

## How it's put together

| Piece | What it does | Cost |
|---|---|---|
| **Cloudflare Workers** | Serves the site and the API | Free |
| **Cloudflare D1** | The database — this is SQLite | Free |
| **GitHub Actions** | Weekly opportunity search | Free |
| **Your domain** | The address students type | ~$12–20/yr |

Workers don't sleep, so there's no "waking up" delay — the leaderboard is immediate whenever a student opens it. That was the deciding requirement.

The database is SQLite, which is why the schema in [worker/schema.sql](worker/schema.sql) reads like ordinary SQLite: D1 *is* SQLite, so none of the queries had to be rewritten to get here.

---

## Commands

```bash
npm run dev
```
Local site at `http://localhost:8787` against a local copy of the database. Safe to experiment in.

```bash
npm run deploy
```
Build and publish to Cloudflare.

```bash
npm test
```
36 checks covering points arithmetic, the 15-mile rule, the admin lock, and backup/restore.

```bash
npm run build:seed
```
Regenerate `worker/seed.sql` after editing `shared/seed-data.js`.

---

## How opportunities get found

A GitHub Action runs every Sunday and can be triggered by hand from the Actions tab.

**Free sources, no API key:** Devpost's open JSON endpoint and Major League Hacking's season page. These cost nothing and always run.

**Firecrawl (optional):** for pages that need a real browser to read. Add `FIRECRAWL_API_KEY` as a repo secret and list the pages under **Admin → Page text → Firecrawl pages to scrape**. Without a key this tier is skipped and everything else still works.

**Everything found lands in a pending queue.** Nothing appears on the public site until an officer approves it in **Admin → Pending**. If a source starts returning junk you get a messy queue, never a broken public page.

**The 15-mile rule** is applied before anything reaches the queue. In-person listings are geocoded with OpenStreetMap (free, no key) and dropped if they're more than 15 miles from 3000 Los Rios Blvd. Online and residential listings skip the check. An in-person address that can't be located is kept and flagged rather than silently discarded.

The search runs on GitHub rather than on the site because a free Worker gets 10ms of CPU per request — nowhere near enough to parse a few hundred kilobytes of HTML. The Action does the heavy work and sends finished rows to the site.

---

## Rating tiers

Rank alone only gives three people something to chase. Points also map to a tier, so a member in eleventh place still has a threshold in front of them:

| Tier | Points |
|---|---|
| Newcomer | 0+ |
| Contributor | 25+ |
| Builder | 75+ |
| Specialist | 150+ |
| Expert | 250+ |
| Master | 400+ |
| Legend | 600+ |

Thresholds live in [src/lib/tiers.js](src/lib/tiers.js) — edit that one file to retune them.

---

## Project layout

```
worker/           Runs on Cloudflare
  index.js        Routing, static files, SPA fallback
  db.js           Every database query
  auth.js         Password check, signed session cookie
  geo.js          Distance maths and the 15-mile rule
  schema.sql      The tables
  seed.sql        Generated starting data
  routes/         public.js, admin.js, ingest.js
ingest/           Runs on GitHub Actions (the weekly search)
shared/           seed-data.js — the starting members and opportunities
src/              The React app: pages, components, tier definitions
test/             npm test
docs/superpowers/ Design spec and implementation plan
```

---

## Design

The visual direction is a **competitive programming standings sheet in daylight** — cool paper rather than a terminal-dark hacker theme, with a rating-tier colour system where a member's colour is their standing. Bricolage Grotesque for display, Instrument Sans for body, IBM Plex Mono for anything numeric.

Responsive to mobile, keyboard focus visible throughout, `prefers-reduced-motion` respected, and light and dark themes both defined explicitly.
