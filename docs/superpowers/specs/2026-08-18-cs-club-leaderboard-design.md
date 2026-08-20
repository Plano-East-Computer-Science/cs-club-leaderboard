# CS Club Leaderboard — Design Spec

**Date:** 2026-08-18
**Owner:** Plano East Senior High School CS Club
**Status:** Approved for implementation

## Purpose

A public website for the Plano East Senior High School CS Club with three jobs:

1. Show a live leaderboard of club members and their points. First place wins Meta Ray-Ban glasses.
2. Publish a curated board of STEM opportunities (internships, competitions, programs, resources) for students aged 14–17 that are either online or within 15 miles of the school.
3. Explain what the club is on an About page.

A password-protected admin panel is the only way data changes. The club officer running the site is not expected to know SQL, use a terminal, or edit code to operate it.

## Non-goals

- Student-facing accounts or logins. The leaderboard is read-only to the public.
- Real-time multiplayer or websockets. A page refresh is enough.
- Email notifications, mobile apps, or payment handling.
- Multi-club or multi-tenant support.

## Constraints

- **Deploy target:** Replit. One process, one port, one `npm start`.
- **Cost:** must be free to operate indefinitely. No paid API tier may be required for the site to function.
- **Geography:** in-person opportunities must be within 15 miles of 3000 Los Rios Blvd, Plano, TX 75074. Online opportunities have no distance limit.
- **Audience age:** 14–17.
- **Operator skill level:** no database or SQL knowledge assumed.

## Architecture

A single Node process serves both the API and the built React app.

```
Browser
  |
  |  GET /            -> React SPA (static, built by Vite)
  |  GET /api/*       -> Express JSON API
  |
Express (server/)
  |
  +-- better-sqlite3 --> data/club.db      (all persistent state)
  +-- ingest/         --> free scrapers + optional Firecrawl
```

**Why one process:** Replit gives one port per deployment. Serving the SPA from Express avoids a proxy, a second service, and CORS entirely.

**Why SQLite:** zero configuration, no connection string, no external service to provision or pay for. The whole database is one file that can be downloaded as a backup.

### Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `server/db.js` | Opens the database, creates tables on first run, seeds initial data. Exposes prepared statements. | better-sqlite3 |
| `server/routes/public.js` | Read-only API: leaderboard, student profile, opportunities, about text. | db |
| `server/routes/admin.js` | Write API, all behind auth: points, students, badges, opportunities, about, backup/restore. | db, auth |
| `server/auth.js` | Password check against `ADMIN_PASSWORD`, signed httpOnly session cookie, `requireAdmin` middleware. | — |
| `server/ingest/sources.js` | The list of opportunity sources and how to parse each. | undici, cheerio |
| `server/ingest/geo.js` | Geocode an address, compute miles from the school, decide in/out. | Nominatim (free) |
| `server/ingest/run.js` | Orchestrates a scrape pass, dedupes, writes to the pending queue. | sources, geo, db |
| `src/` | React SPA: leaderboard, student profile, opportunities, about, admin. | — |

Each unit is independently testable: `geo.js` is pure math plus one network call, `auth.js` has no database dependency, ingest writes only to the pending queue and never to live data.

## Data model

Five tables. Plain-English meaning given for the operator.

### `students`
One row per club member.

| Column | Type | Meaning |
|---|---|---|
| `id` | INTEGER PK | Internal number for this student |
| `name` | TEXT | Display name |
| `grade` | INTEGER | 9–12 |
| `avatar_seed` | TEXT | Seeds a generated avatar so each student gets a consistent look |
| `joined_at` | TEXT | ISO date |
| `active` | INTEGER | 1 = shown on leaderboard, 0 = hidden (graduated, left) |

### `point_events`
One row per points award. **Totals are never stored** — a student's total is the sum of their events.

| Column | Type | Meaning |
|---|---|---|
| `id` | INTEGER PK | |
| `student_id` | INTEGER FK | Who earned it |
| `delta` | INTEGER | Points added. Negative to take points away. |
| `reason` | TEXT | Why, e.g. "Hackathon 1st place" |
| `created_at` | TEXT | ISO datetime |

**Rationale:** storing a running total invites drift and makes mistakes unfixable. An append-only log means every point is explainable to a student who asks, a wrong award is undone by deleting one row, and the profile page timeline comes free.

### `badges` / `student_badges`
Named achievements, and which students hold them. Split into two tables so a badge is defined once and awarded many times.

`badges`: `id`, `name`, `emoji`, `description`, `color`.
`student_badges`: `student_id`, `badge_id`, `awarded_at`. Primary key is the pair, so a badge cannot be awarded twice.

### `opportunities`
One row per internship, competition, program, or resource.

| Column | Type | Meaning |
|---|---|---|
| `id` | INTEGER PK | |
| `title`, `org`, `description`, `url` | TEXT | The listing itself |
| `type` | TEXT | internship / competition / program / resource / scholarship |
| `deadline` | TEXT | ISO date, nullable for rolling |
| `cost` | TEXT | free / paid / stipend |
| `is_online` | INTEGER | 1 = remote, distance ignored |
| `location`, `lat`, `lng` | TEXT/REAL | For in-person entries |
| `distance_mi` | REAL | Computed miles from the school |
| `age_min`, `age_max` | INTEGER | Eligibility |
| `source` | TEXT | `manual`, or the source id that scraped it |
| `status` | TEXT | `pending` (awaiting approval) / `live` / `rejected` |
| `fingerprint` | TEXT UNIQUE | Dedupe key, so re-scraping does not create duplicates |

### `settings`
Key/value store for editable page text (About content, prize description, club links). Avoids a migration every time a sentence changes.

## Opportunity ingest

Two tiers, both optional to the site working.

**Tier 1 — no-key scrapers (free forever, automatic).** A fixed list of stable listing pages fetched with `undici` and parsed with `cheerio`. Runs on a weekly timer inside the server process, and on demand from the admin panel. Costs nothing, needs no credentials, so this tier alone satisfies the "completely free" requirement.

**Tier 2 — Firecrawl (on-demand only).** For JavaScript-heavy sources that plain HTML parsing cannot read. Triggered *only* by an admin clicking "Refresh from sources" — never on a timer — so a free credit allowance is not drained in the background. If `FIRECRAWL_API_KEY` is absent, this tier is skipped silently and tier 1 still runs.

**Approval queue.** Every scraped row lands with `status = 'pending'`. Nothing is public until an admin approves it. This is the safety valve: a scraper that starts returning garbage produces a messy queue, never a broken public page.

**Distance filter.** Applied at ingest, before the queue:
- `is_online = 1` → always kept.
- Otherwise geocode the location via Nominatim (free, no key), compute the great-circle distance from 33.0357, -96.6689, and reject anything over 15 miles.
- Ungeocodable in-person listings are kept but flagged, so a human decides rather than silently losing a good opportunity.

**Seed data.** The site ships with a hand-verified catalogue of real, currently-live opportunities so day one is useful rather than empty.

## Pages

| Route | Content |
|---|---|
| `/` | Leaderboard. Animated top-3 podium with first place crowned and the Meta Ray-Ban prize called out. Ranked rows below with avatar, points, badges, and rank-change indicator. Numbers count up on load. |
| `/student/:id` | Profile: rank, total, badge shelf, and a reverse-chronological timeline of every point event with its reason. |
| `/opportunities` | Filterable board: by type, online vs local, cost, and deadline. Each card shows distance for in-person entries and days remaining for deadlines. |
| `/about` | Club description, meeting info, officers, how points work. Text editable from admin. |
| `/admin` | Password gate, then: award points, manage students, manage badges, manage opportunities, review the pending queue, edit About text, download/restore backup. |

## Authentication

Single shared password read from the `ADMIN_PASSWORD` environment variable (Replit Secrets). On successful login the server sets a signed, httpOnly, SameSite=Lax cookie. `requireAdmin` middleware guards every mutating route.

Deliberately simple: one club, a handful of officers, no user management to maintain. If per-officer attribution is needed later, `point_events` already has room for an `awarded_by` column.

**Hard requirement:** the server refuses to start if `ADMIN_PASSWORD` is unset in production, rather than defaulting to a guessable value.

## Backup and durability

Replit's free Autoscale tier has an ephemeral filesystem — the database file can be reset on redeploy. Mitigations, in order of effort:

1. **Download backup** in the admin panel exports the entire database as one JSON file. **Restore** reads it back. This works regardless of hosting tier and is the primary safety net.
2. Deploying to a Reserved VM, or attaching persistent storage, keeps the file across restarts.
3. If the risk is unacceptable later, swapping `db.js` for Postgres is a contained change — nothing outside that file knows what the storage engine is.

## Error handling

- API errors return a JSON `{ error }` with a correct status code; the SPA surfaces them inline rather than failing silently.
- Ingest failures are per-source and isolated: one dead source logs a warning and the pass continues.
- Geocoding failures flag the row for human review instead of dropping it.
- Restore validates the backup's shape before touching existing data, and refuses a malformed file.

## Testing

Assert-based self-checks, no framework, on the paths where a bug is expensive:

- **Points math** — totals equal the sum of events, negative deltas subtract, deleting an event changes the total.
- **Distance filter** — a known-near address passes, a known-far one fails, online bypasses the check.
- **Auth gate** — mutating routes reject an absent or wrong cookie.
- **Backup round-trip** — export then restore reproduces identical data.

## Operator documentation

`LEARN-DATABASE.md` ships in the repo: a plain-English explanation of what a database is, what each table holds, why points are stored as a log instead of a number, and how to back up and restore. Written for someone who has never used SQL and does not intend to.
