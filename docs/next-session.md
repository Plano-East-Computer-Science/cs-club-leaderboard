# Prompt for the next session

Paste everything below the line into a new Claude Code session opened in
`C:\Users\sujay\CS club leaderboard`. Use Opus as the session model.

---

Continue the club app overhaul on branch `club-os`. Quality over speed. Do not deploy, push, or
touch the live site or the remote database.

Read these first, in order, and treat them as the source of truth:
1. Memory notes `club-os-branch`, `quality-over-speed`, `user-workflow-prefs`, `hub-engage-branch`.
2. `docs/hub-roadmap.md`: Part 1, Part 2, "Decided", "Shared contracts", then Part 3 for the items
   you work on.
3. `docs/agent-brief.md`: the working rules every build agent must follow.

State when this prompt was written (2026-11-18, about 1am):
- Merged on `club-os`, all 16 test files passing: A1, A2, A3 (identity, ledger, claims), A7
  (officer accounts), A4, A5, A6 (seasons, one rank system, relative standings, raffle, squads),
  C2 (problem bank), C3 (daily problem), C1 and C5 (Arena board), B2 and B9 (duels, pair maker),
  F1, F2, E1 (Today, feed with kudos, compass), C4 and D3 (Codeforces and GitHub sync), D1, D4,
  D7 (ship cycles, teammate board, starters at /build), G5 and E7 (privacy, export and deletion,
  reports, verified records, plus a security review with fixes), E3, F4, F5, F6, G3 (feeds,
  Discord ping, command bar, installable app, announce).
- The Opus weekly usage limit was hit on 2026-11-18 (resets Nov 22, 4am Chicago). Until then use
  Sonnet for build agents, or wait.
- Unfinished work lives in agent worktrees under `.claude/worktrees/`, all uncommitted. Check each
  with `git -C <worktree> status` and `git -C <worktree> diff --stat`:
  - `agent-a10013b7d81188662`: B1, B3, B4, B6, B7, B8, B10 meeting run-of-show. Backend and its
    tests done, frontend mostly written, was adding CSS. Most important unfinished item.
  - `agent-adee97866d2f27cd7`: E2, E4, G2 competition pages and officer analytics. Built, was
    taking screenshots.
  - `agent-a01c04061b2407ad7`: D2, H2 workspace. Barely started; fine to restart from scratch.
  Each worktree's branch is based on an older `club-os`; rebase onto the current tip before
  merging, and keep both sides of "both added a line" conflicts.
- Open security items from the G5 review (decide or fix):
  - The gateway serves upstream pages from the club origin, so scripts on an allowlisted page
    could call `/api` with the member's cookie. Fix before wider gateway use: serve gateway
    responses with `Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups`
    (opaque origin, so no cookies) and test that GitHub still works, or move the gateway to its
    own subdomain if the school filter allows it.
  - The Codeforces browser fallback trusts submitted JSON. Mark handles linked that way as
    unverified and do not award points from browser-submitted solves.
  - Lower: account-existence hint on sign-in, stateless cookies not revocable on logout, room and
    gateway code enumeration, public `grade` on the leaderboard.
- Migrations now run 004, 005, 006, 007 before `schema.sql` on an existing database; see the
  "Upgrading the live database" section of `DEPLOY.md` (add 007 there).
- The officer console (`src/pages/Officer.jsx`) is now 16 stacked sections; restructure it into
  sections or tabs (G-series polish) before adding more.

How to work:
- First finish and merge the unfinished worktrees above, one at a time. For each, spawn a build
  agent (Agent tool, the matching profile from the roadmap brief, `isolation: "worktree"` is NOT
  needed: point it at the existing worktree path and tell it to continue there), or finish it
  yourself if it is small. Then merge into `club-os` and run `npm test` before committing the merge.
- Then build the remaining roadmap items in this order, at most 3 agents at once, Opus only for
  design, security or real-time state, Sonnet otherwise: B5 mock contest; G1 meeting planner;
  H1 session-scoped gateway (no new hosts enabled) and H3 reader mode; C11 CTF board; C12 data
  arena; C6 editorials and C7 ghost races; D5 code review requests; D6 portfolio v2 and F3
  personal digest; E5 pathways and C15 research track; E6 alumni; G4 handoff; C14 quant sandbox;
  C8 C++/Java spike (research only). Skip C9 and C13 (AI features, deferred by the club lead).
- New worktree agents: worktrees are cut from `main` by mistake, so every agent's first step is
  `git reset --hard club-os`. Assign a distinct local port and the next free migration number
  (007 or later; check `worker/migrations/`).
- After each merge: apply schema and any migration locally with
  `npx wrangler d1 execute cs-club --local --persist-to .wrangler/state --file <file>`, rebuild,
  and RESTART `wrangler dev` (it serves a stale asset list after a rebuild). Use
  `rtk proxy npx wrangler dev --port <port> ...` in the background so its log is readable.
- Verify each merged feature in a browser yourself. To see officer and student at once, sign the
  officer in on `http://localhost:<port>` and the student on `http://127.0.0.1:<port>` (separate
  cookies). Officer break-glass password is in `.dev.vars`; students sign in through the
  DEV_LOGIN link returned by `/api/auth/request` (45-second cooldown per address).
- Integration polish to fold in as you go: the site footer still says "Points update whenever an
  officer awards them" (now false); the Dock `claim` help text says "link your account" (now it
  opens claims); `SignIn.jsx` links to `/learn`; Arena placement and the compass ask overlapping
  questions (use compass answers to place the Board when available); the officer console is one
  long page and needs sections or tabs once more screens land.
- The club lead is often away. After each merge, send 2-3 viewport screenshots with a one-line
  caption via SendUserFile (status proactive). Keep agent screenshots to 3-4 each.
- Before ending, update the `club-os-branch` memory with what merged, and list the deploy steps an
  officer will need (every migration file in order, `worker/schema.sql`, the seed files,
  `GITHUB_TOKEN` secret, Discord webhook setting, first lead via break-glass).

## Update 2026-11-18, about 2am (session 2)

Merged on `club-os` since the list above (all 21 test files pass): B1, B3, B4, B6, B7, B8, B10
(meeting run-of-show, migration 008), E2, E4, G2 (competition pages, analytics, plus attendance by
template), C11 CTF board, C12 data arena (build now downloads Pyodide packages from jsdelivr,
sha256-checked), D2 workspace (`/workspace`), H2 gateway note, integration polish (footer, claim
help, sign-in link, compass places the Board). Security items done: gateway pages served with
CSP sandbox (opaque origin), browser-linked Codeforces handles untrusted and never paid,
sign-out revokes every session (`session_ver`), public pages drop `grade` (migration 009).
Account-existence hint and code enumeration left as accepted risks.

Unfinished, in agent worktrees:
- `agent-a59681a768966f712`: B5 mock contest, DONE and committed (37e1290), not merged. Merge next;
  expect small conflicts in `worker/schema.sql`, `worker/hub/safety.js`, `src/index.css`.
- `agent-a2d4a37f40e694b67`: G1 planner, stopped mid-build, uncommitted. Finish or restart.
- `agent-a21cb269ef6578922`: C6 editorials and C7 ghost races, stopped early. Restart.
- `clubos-verify` (branch `d2-workspace`, merged): a clean checkout for building and screenshots.

Then continue the build order from H1 (session-scoped gateway, Opus) and H3, then D5 onward.
Officer console tabs still to do.

IMPORTANT: another session ("Club app UI/UX redesign") edits this same checkout. Stage files by
exact path only; resolve merges with `git add <conflicted files>`, never `git add -A` or folders.
Build and screenshot from `.claude/worktrees/clubos-verify` (`git -C ... checkout --detach club-os`)
so its uncommitted work is not mixed in. Test students on `localhost`, not `127.0.0.1`: other
agents' logins on 127.0.0.1 share cookies across ports.

## Update 2026-11-18, afternoon (session 3)

Merged on `club-os` this session (all 29 test files pass, each feature checked in a browser):
- B5 mock contest (teams of three, ICPC scoring, frozen board, bottom-up reveal). Ran a real
  4-minute contest with bot students: freeze, alarm end and reveal all behave.
- G1 meeting planner (officer Meeting tab). Warns after three meetings of one kind; "Open room"
  carries the plan's blocks into the room; next unheld plan shows on Today, digest and the .ics feed.
- C6 editorials (locked until you solve; officer accept pays `mentor` once) and C7 ghost races.
- Officer console is now five URL-backed tabs (`?tab=meeting|review|members|content|club`). New
  officer screens: one import and one entry in the `TABS` list in `src/pages/Officer.jsx`.
- H3 reader mode (`/read`). Its host list is separate from the gateway's on purpose: defaults are
  docs.python.org, developer.mozilla.org, en.cppreference.com (already approved). GitHub and Bing
  stay meeting-only behind the gateway. usaco.guide and cses.fi wait for approval.
- H1 session-scoped gateway. Every room gets its own gateway code at creation; checked-in members
  of the open room get it on `/gateway` automatically; it is revoked when the room closes (12-hour
  ceiling). The host console has a preset panel (GitHub and PyPI always on; Documentation, Search
  and Q&A, Tutorials; Practice and Data empty until hosts are approved). Duel and mock rooms start
  with search and tutorials off. Presets are intersected with the approved list on every request.
  Officer-minted codes still work as before. Migration `011-gateway-rooms.sql` (in DEPLOY.md).
  Also fixed: room creation retried the whole block on any error, which could make duplicate rooms.
- D5 code review requests (`/build/reviews`): asker marks a review helpful, pays `mentor` once;
  capped per request, per pair of members ever, and per reviewer per week.
- D6 portfolio v2: PRIVATE BY DEFAULT now (owner clicks Make public); approved results, cached repo
  data, up to three officer-signed lines (officer Members tab, "Signoffs"). Existing portfolios
  become private on deploy until owners opt in. Tell members.
- F3 personal digest: account holders who subscribe get one message with a "Your week" section.
- Polish: `useReveal` now reveals panes taller than the screen (a long reader page stayed
  invisible); feed names quest and drop-in rows.

Deploy needs (when the lead says go): migrations 004 to 009 and 011 in order (no 010), then
`worker/schema.sql` (new tables: contest_attempts, planned_sessions, problem_solves, editorials,
ghost_races, review_requests, reviews, portfolio_public, portfolio_signoffs), then the seeds. See
DEPLOY.md "Upgrading the live database". The GitHub Actions dev deploy still lacks the
CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets (the lead's to add).

Next in the build order: E5 pathways and C15 research track; E6 alumni; G4 handoff; C14 quant
sandbox; C8 C++/Java spike (research only). C9 and C13 stay deferred.

Local testing lessons from this session:
- Killing workerd by port is not enough: wrangler respawns it, and several stale servers ended up
  sharing port 8814 and hanging every request. Kill the whole `rtk proxy npx wrangler dev` tree
  (PowerShell: find `rtk.exe` processes whose command line has `wrangler dev --port 8814`, then
  `taskkill /T`).
- Sign-in links are rate limited per IP. For many test students, mint a session cookie with
  `signValue` from `worker/auth.js` (payload `id:expiry:session_ver`) instead.
- The in-app browser may hold an old HttpOnly `cslb_admin` or `cslb_user` cookie on localhost;
  a member page then acts as host, or a JS-set cookie silently does nothing. Sign in through the
  real dev link, or call `/api/admin/logout`, to clear it.
