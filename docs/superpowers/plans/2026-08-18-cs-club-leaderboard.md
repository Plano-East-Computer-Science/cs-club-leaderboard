# CS Club Leaderboard Implementation Plan

**Goal:** Ship a deployable Replit site with a points leaderboard, a geo-filtered STEM opportunities board, an About page, and a password-protected admin panel that requires no SQL knowledge to operate.

**Architecture:** One Node process. Express serves a JSON API and the Vite-built React SPA from a single port. All state lives in one SQLite file. Opportunity ingest is a separate module that only ever writes to a pending queue.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, Framer Motion, React Router, Express 4, better-sqlite3, undici, cheerio.

**Spec:** `docs/superpowers/specs/2026-08-18-cs-club-leaderboard-design.md`

## Global Constraints

- School origin for all distance math: **33.0357, -96.6689** (3000 Los Rios Blvd, Plano, TX 75074).
- In-person opportunity radius: **15 miles**. Online listings bypass the check.
- Target age range: **14–17**.
- The site must run with **zero paid services**. Firecrawl is optional and on-demand only; its absence must not break anything.
- Admin password comes from `ADMIN_PASSWORD`. The server refuses to start in production if it is unset.
- Points totals are **always** derived as `SUM(delta)` over `point_events`. No stored total column anywhere.
- Scraped rows always enter as `status = 'pending'`.

---

## File Structure

| File | Responsibility |
|---|---|
| `server/index.js` | Express app, static serving, route mounting, weekly ingest timer, startup checks |
| `server/db.js` | Open database, create schema, seed, export query helpers |
| `server/seed.js` | Initial students, badges, settings, and the verified opportunity catalogue |
| `server/auth.js` | Password check, cookie signing, `requireAdmin` middleware |
| `server/routes/public.js` | Read-only endpoints |
| `server/routes/admin.js` | Mutating endpoints, all behind `requireAdmin` |
| `server/ingest/geo.js` | Haversine distance, Nominatim geocode, 15-mile decision |
| `server/ingest/sources.js` | Source definitions and per-source parsers |
| `server/ingest/run.js` | Scrape orchestration, dedupe, queue write |
| `server/selftest.js` | Assert-based checks for points math, geo filter, auth, backup round-trip |
| `src/main.jsx`, `src/App.jsx` | SPA entry and routing |
| `src/lib/api.js` | Fetch wrapper, shared error handling |
| `src/pages/*.jsx` | Leaderboard, Student, Opportunities, About, Admin |
| `src/components/*.jsx` | Podium, RankRow, BadgeChip, OpportunityCard, filters, admin forms |
| `LEARN-DATABASE.md` | Plain-English operator guide |
| `README.md` | Setup and Replit deploy steps |

---

## Task 1: Project scaffold and database layer

**Files:** Create `package.json`, `vite.config.js`, `server/db.js`, `server/seed.js`, `.env.example`, `.gitignore`

**Produces:** `db` (better-sqlite3 handle), `getLeaderboard()`, `getStudent(id)`, `addPointEvent({student_id, delta, reason})`, `listOpportunities({status})`, `getSetting(key)`, `setSetting(key, value)`

- [ ] Scaffold Vite React app and install dependencies
- [ ] Write `server/db.js`: open `data/club.db`, `CREATE TABLE IF NOT EXISTS` for all five tables, enable foreign keys and WAL
- [ ] Write `server/seed.js`: insert demo students, badges, settings, and the verified opportunity catalogue, but only when the tables are empty
- [ ] Verify: run the server once and confirm `data/club.db` is created and the leaderboard query returns seeded rows

**Test:** points math self-check — insert two events for one student, assert the leaderboard total equals their sum; insert a negative delta, assert the total drops.

## Task 2: Auth

**Files:** Create `server/auth.js`

**Consumes:** nothing
**Produces:** `login(password)`, `requireAdmin(req, res, next)`, `signSession()`, `verifySession(cookie)`

- [ ] Implement HMAC-signed session cookie using `crypto`, httpOnly, SameSite=Lax
- [ ] Implement `requireAdmin` returning 401 JSON when the cookie is missing or invalid
- [ ] Refuse startup when `NODE_ENV=production` and `ADMIN_PASSWORD` is unset
- [ ] Verify: self-check asserts a mutating route rejects both a missing cookie and a tampered one

## Task 3: Geo filter

**Files:** Create `server/ingest/geo.js`

**Produces:** `haversineMiles(lat1, lng1, lat2, lng2)`, `geocode(query)`, `withinRadius(opportunity)`

- [ ] Implement haversine against the school origin constant
- [ ] Implement Nominatim geocode with a descriptive User-Agent and a failure path that returns `null` rather than throwing
- [ ] Implement `withinRadius`: online passes unconditionally, geocoded in-person passes under 15 miles, ungeocodable is flagged for review
- [ ] Verify: self-check asserts UT Dallas (near) passes, Houston (far) fails, an online listing passes with no coordinates

## Task 4: Ingest pipeline

**Files:** Create `server/ingest/sources.js`, `server/ingest/run.js`

**Consumes:** `withinRadius`, `geocode`, db helpers
**Produces:** `runIngest({ useFirecrawl })` returning `{ added, skipped, errors }`

- [ ] Define the no-key source list with a `parse(html)` per source
- [ ] Implement `runIngest`: fetch each source, parse, apply the geo filter, compute a fingerprint, insert with `status='pending'`, skip duplicates
- [ ] Isolate per-source failures so one dead source cannot abort the pass
- [ ] Add the optional Firecrawl branch, skipped entirely when `FIRECRAWL_API_KEY` is absent
- [ ] Verify: run against a fixture HTML string and assert rows land as pending with a distance attached

## Task 5: API routes

**Files:** Create `server/routes/public.js`, `server/routes/admin.js`, `server/index.js`

**Consumes:** db helpers, `requireAdmin`, `runIngest`

Public: `GET /api/leaderboard`, `/api/student/:id`, `/api/opportunities`, `/api/about`
Admin: `POST /api/admin/login`, `/logout`; CRUD for students, points, badges, opportunities; `POST /api/admin/ingest`; `GET /api/admin/backup`; `POST /api/admin/restore`

- [ ] Implement public routes
- [ ] Implement admin routes behind `requireAdmin`
- [ ] Wire `server/index.js`: JSON body parsing, cookie parsing, route mounting, SPA fallback, weekly ingest timer
- [ ] Verify: self-check asserts backup export followed by restore reproduces identical data

## Task 6: Frontend shell and leaderboard

**Files:** Create `src/main.jsx`, `src/App.jsx`, `src/index.css`, `src/lib/api.js`, `src/pages/Leaderboard.jsx`, `src/components/Podium.jsx`, `src/components/RankRow.jsx`, `src/components/BadgeChip.jsx`

- [ ] Set up routing, the shared nav, and the design tokens
- [ ] Build the podium with the first-place Meta Ray-Ban prize callout
- [ ] Build ranked rows with avatars, count-up totals, and badge chips
- [ ] Verify in the browser at 375px and 1280px

## Task 7: Student profile, opportunities, about

**Files:** Create `src/pages/Student.jsx`, `src/pages/Opportunities.jsx`, `src/pages/About.jsx`, `src/components/OpportunityCard.jsx`

- [ ] Profile: rank, total, badge shelf, point-event timeline
- [ ] Opportunities: filters for type, online vs local, cost, deadline; cards show distance and days remaining
- [ ] About: renders editable settings content
- [ ] Verify each route in the browser

## Task 8: Admin panel

**Files:** Create `src/pages/Admin.jsx` and its form components

- [ ] Login screen and session handling
- [ ] Award-points form (student, amount, reason) as the primary action
- [ ] Student, badge, and opportunity management
- [ ] Pending-queue review with approve and reject
- [ ] About-text editor, backup download, restore upload, manual ingest trigger
- [ ] Verify the full flow end to end in the browser

## Task 9: Docs, self-test, deploy config

**Files:** Create `LEARN-DATABASE.md`, `README.md`, `.replit`, `replit.nix`, `server/selftest.js`

- [ ] Write the plain-English database guide for a non-SQL operator
- [ ] Write README with local setup and Replit deploy steps including Secrets
- [ ] Add Replit config so Run and Deploy work untouched
- [ ] Run the full self-test suite and confirm every check passes

---

## Self-Review

**Spec coverage:** data model → Task 1; auth → Task 2; distance filter → Task 3; two-tier ingest and approval queue → Task 4; backup/restore and error handling → Tasks 4–5; all five pages → Tasks 6–8; testing → Tasks 1–5 and 9; operator docs → Task 9. No gaps.

**Placeholders:** none. Every task names exact files and a verification step.

**Type consistency:** `runIngest`, `withinRadius`, `requireAdmin`, and the db helper names are used identically across tasks.
