# Club OS: strategy and build roadmap

Written 2026-11-17 on branch `hub-engage`. This is the plan for turning peshcompsci.org from a
website with tabs into the web app that runs the Plano East CS Club. Part 1 is the thinking.
Part 2 is the product shape. Part 3 is every buildable item as a self-contained brief, so any one
of them can be handed to a separate thread. Part 4 is the order to build them in. Part 5 is what
needs a human decision.

Sources: the officers' meeting notes, the lead's review of the `hub-engage` build, and three
research passes (how the best learning products keep teenagers, which outside APIs are usable from
a Cloudflare Worker, and what is known about why teenagers stay in or leave a club). Facts from the
API research are marked **verified** or **unverified**; test the unverified ones before relying on
them.

---

## Part 1. What is actually wrong, and the bet

### The diagnosis

Attendance fell from about 20 to 5-10. The site did not cause that and no single page will fix it.
The likely causes, most likely first:

1. **The meeting is something you can do alone.** Slides, then solo contest problems. A beginner
   solves zero problems and talks to nobody. A strong member gets nothing they could not get on
   Codeforces at home. Both stop coming, for opposite reasons.
2. **The club offers one thing and members want several.** Contest problems pay off for contest
   kids. The officers' own notes say people want projects, AI, data.
3. **Friend groups leave together.** A drop of ten people is usually two or three groups.
4. **Nobody leaves with anything.** No artifact, no recognition. The notes say it directly:
   members "don't see their impact."

The current Learn tab repeats cause 1 on a screen: a list of text courses is solo reading. That is
why it feels wrong. Polishing it will not help. It has to be replaced by things that are either
social (in the meeting) or short and self-directed (at home).

### The bet

Three statements the rest of this document depends on. If you disagree with one, say so before
building, because the build order changes.

1. **The meeting is the product. The app exists to run a better meeting.** Every meeting must give
   each person something they could not get alone (a live match against someone at their level, a
   partner, an audience) and something to show for it before they leave.
2. **Curate, do not write.** The world already has better free content than a club can write:
   USACO Guide, CSES, Codeforces, picoCTF, Kaggle. The club's value is choosing the next thing,
   doing it together, and recognising it. Officers should spend their time on people, not on
   authoring courses.
3. **One ledger.** Everything a member does (shows up, solves, ships, competes, places, helps)
   becomes one row in one activity log, and standings are computed from it by rules. No officer
   types points in by hand except to approve a claim. This is what "the leaderboard updates
   itself" means in practice.

### Who the app is for

Five members. Every feature below should serve at least one of them by name.

| Persona | Wants | Quits when | Brings a friend when |
|---|---|---|---|
| **Undecided** (9th-10th, in intro CS) | To build something cool, fast, with friends | They are visibly behind | They have a thing to show |
| **Contest** (UIL, USACO) | Hard problems, a team, a ranking | Meetings are pitched at beginners | There are timed mock contests and a mentoring role |
| **Builder** | To ship AI and web projects for a portfolio | Told to grind contest problems | Their project needs a teammate and there is a demo day |
| **Resume** (junior) | Credentials, leadership, internships | No tangible payoff | There are opportunities, officer slots, a verified record |
| **Quiet** | To code well without a spotlight | Forced presenting, public last place | Activities are built for pairs |

### What the app cannot fix

Officers have to do these in person, and no feature replaces them: invite each lapsed member by
name and tell them to bring a friend; name a member's work in front of the room; make it safe to
be bad at this by debugging out loud and shutting down sneering.

---

## Part 2. The product shape

Stop thinking in tabs. The app has three loops, and each page belongs to one.

### Loop 1: the meeting (45 minutes, in the room)

An officer opens a **session**. A session is an ordered list of **blocks** with timers. The
projector shows the current block; laptops show the member's side of it. One code joins the room,
checks you in, and turns on the gateway for the session.

A repeatable default ("build night"):

| Min | Block | Projector | Laptops |
|---|---|---|---|
| 0-5 | Join + warm-up poll | Join code, poll results | Join, see your partner |
| 5-12 | Hook | A member demos last week's best artifact | Closed |
| 12-15 | Briefing | Today's theme in three tiers | The lab opens |
| 15-38 | Build in pairs | Anonymous progress ("14 past checkpoint 1"), help queue | Tiered lab with checkpoints and hints |
| 38-43 | Show | Gallery, 2-3 pairs, 60 seconds each | Submit artifact (goes to portfolio) |
| 43-45 | Close | Next theme, one opportunity | Vote on next theme |

Other templates swap the middle: **duel night** (matched races), **mock contest** (teams of
three, frozen scoreboard), **speaker** (upvoted Q&A), **demo day** (end of a ship cycle).
Rotating templates is the officers' note "rotate from lesson to project" made concrete.

### Loop 2: on your own (5 minutes, at home or between classes)

The home screen is **Today**: the next meeting and its theme, one next action on your path, the
daily problem, deadlines you saved, and what clubmates did this week. Behind it sits **the
Board**: ladders of problems per track that mostly point at outside sites, with the club's own
judge for the ones that must work on school wifi.

### Loop 3: the season

One activity ledger. **Season points** reset each semester and decide the prize. **Lifetime rank**
never goes down and is the label on your portfolio. Members belong to mixed-skill **squads**.
Ship cycles (three-week build themes ending in a demo day) and competitions give the season its
shape.

### Navigation that follows from this

`today` · `meet` · `arena` · `build` · `compass` · `standings`, plus the existing `ls all` panel.
`arena` replaces `learn` (the Board, daily problem, duels, CTF, data). `compass` is opportunities
plus pathways plus competitions. The terminal look, command bar and `ls all` stay; they are the
identity.

---

## Part 3. Everything buildable

Each brief has: what it is, why, where it lives in the code, when it is done, size (S about a
session, M a day, L several days), and what it needs first. "Model" is the cheapest model I would
trust with it.

Conventions for every thread: branch from `hub-engage`; run `npm test` before finishing; add a
plain-node test to `test/hub.js` for any pure logic; pages built from `<Pane>` must call
`useReveal()`; hub API routers live in `worker/hub/` and are mounted in `worker/hub/index.js`;
schema changes go at the bottom of `worker/schema.sql` and need `npm run db:schema:local`; never
deploy. Local dev: `npx wrangler dev --port 8799 --inspector-port 9339 --persist-to .wrangler/state`.

### A. Foundation: identity, ledger, points

**A1. One identity.** Today a signed-in account (`users`) and a leaderboard entry (`students`) are
separate rows joined by an officer-approved link request. Make sign-up create or claim the
leaderboard entry directly: a new account gets a `students` row automatically; an officer screen
merges a duplicate into an existing entry. Removes the link-request friction that leaves most
attendees "unlinked" when points are awarded. *Where:* `worker/hub/users.js` (`startSession`),
`worker/hub/links.js`, `src/pages/Home.jsx` (`LinkPanel`), `src/pages/Officer.jsx`. *Done when:* a
brand-new account that joins a room gets attendance points with no officer action, and a merge
moves all history. *Size:* M. *Needs:* nothing. *Model:* Opus (data migration).

**A2. Activity ledger and points rules.** Add an `activity` table (`student_id`, `kind`, `ref`,
`at`, `status`) and a `point_rules` settings blob: points per kind, per-season caps, whether
approval is required. A single function turns an activity into a `point_events` row. Kinds to
start: `attend`, `compete`, `place`, `ship`, `mentor`, `solve`, `idea`. Suggested defaults:
attend 10 (one per day, first three meetings double), compete 15 (max 4 a season), place up to 50
a season, ship 30 (max 2 a season, must be demoed), mentor 15, solve 1 (max 10 a week).
*Where:* new `worker/hub/ledger.js`, `shared/points.js` for the pure rules, `worker/db.js`
(`getLeaderboard` already sums `point_events`). *Done when:* closing a room writes attendance
points by rule with no button press, caps hold under test, and every auto-awarded row can be
traced to its activity. *Size:* M. *Needs:* A1. *Model:* Opus.

**A3. Claims queue.** A member says "I entered X", "I placed Nth", "I shipped Y" with a proof link
or photo; an officer approves or rejects in one tap; approval writes the activity. Opportunities
get an "I'm doing this" button that later prompts "did you compete?". *Where:* new
`worker/hub/claims.js`, `src/pages/Opportunities.jsx`, `src/pages/Officer.jsx`. *Done when:* a
competition result reaches the leaderboard in two taps total and officers cannot approve their
own claim. *Size:* M. *Needs:* A2. *Model:* Sonnet.

**A4. Seasons and one rank system.** There are currently two ladders: leaderboard tiers
(`src/lib/tiers.js`, by points) and XP ranks (`shared/quests.js`). Collapse to one ledger with two
views: season points (reset per semester, drive the prize) and lifetime rank (all-time, never
drops). Quests become bonus rules on the ledger. Honour-system items stay capped so they cannot
decide the prize. *Where:* `shared/quests.js`, `src/lib/tiers.js`, `worker/db.js`,
`src/pages/Leaderboard.jsx`, `src/pages/Quests.jsx`. *Done when:* there is one number called
points and one label called rank everywhere on the site. *Size:* M. *Needs:* A2. *Model:* Opus.

**A5. Squads.** Mixed-skill groups of 4-6, assigned by officers (with a "suggest balanced squads"
button). Squad score is the median member's season points, so helping the weakest member is the
winning move. *Where:* new table and `worker/hub/squads.js`, Today and standings pages. *Done
when:* standings show squads and a member's dashboard shows their squad's position. *Size:* M.
*Needs:* A2. *Model:* Sonnet.

**A6. Standings that do not crush the bottom half.** Show the top five, your own rank and the two
people either side of you, not a full ranked list. Add fixed tiers (for example 60, 120, 200
season points) and a raffle where everyone above the first tier holds tickets equal to their
points. Includes an officer raffle-draw tool. *Where:* `src/pages/Leaderboard.jsx`. *Done when:* a
member in last place sees neighbours and a reachable tier, not a wall of names. *Size:* S.
*Needs:* A4. *Model:* Sonnet. *Decision needed, see Part 5.*

**A7. Officer accounts and roles.** Officers currently share one password. Give each officer a
role on their own account (`officer`, `lead`, `mentor`), keep the shared password only as a
break-glass, and log who did what. Needed before auto-points, because approvals must be
attributable. *Where:* `worker/auth.js`, `worker/hub/index.js` (`hubAdmin` guard), new `roles`
column on `users`. *Done when:* an approval row records which officer approved it and removing an
officer is one click. *Size:* M. *Needs:* A1. *Model:* Opus (auth).

### B. The meeting

**B1. Session run-of-show.** Extend the room (`worker/hub/room-do.js`) from "quiz + pulse +
agenda links" to an ordered list of typed blocks with a current-block pointer and timer. Host
advances; everyone's screen follows. Ship with templates: build night, duel night, mock contest,
speaker, demo day. The existing quiz, pulse, agenda and question box become block types.
*Where:* `room-do.js`, `src/pages/Host.jsx`, `src/pages/Room.jsx`, new `shared/session-templates.js`.
*Done when:* an officer can run a whole meeting from one screen without opening slides. *Size:* L.
*Needs:* nothing. *Model:* Fable or Opus (Durable Object state design).

**B2. Duel block.** The first reason to show up. Officer picks three problems per division (New,
Comfortable, Contest); members choose their own division; each gets matched with someone near
them; same problem, first accepted wins. Tests run in the browser with the existing Pyodide
runner; the server records attempts, first-accept time and the submitted code for spot checks.
Projector shows solved and attempt counts per division, never code and never an overall rank.
Beginners can play 2v2 as driver and navigator. *Where:* `room-do.js`, `src/lib/pyrunner.js`,
`src/pages/Room.jsx`, `src/pages/Host.jsx`; problems come from C2. *Done when:* eight people can
play three ten-minute rounds from a room code. *Size:* L. *Needs:* C2 (or reuse existing course
code steps for a first cut). *Model:* Opus.

**B3. Lab block.** One theme, three tiers (fill in the blanks, build from a spec, stretch with a
contest twist or an LLM twist). Auto-checked checkpoints, a hint ladder, pair mode with a
driver/navigator swap timer. The seven courses already in `shared/courses/` are the first lab
content; they work far better here than as a reading list. *Where:* `src/pages/Course.jsx`
(reuse the step renderer), `room-do.js` for shared progress. *Done when:* the projector shows how
many pairs are past each checkpoint, anonymously. *Size:* M. *Needs:* B1. *Model:* Sonnet.

**B4. Check-in that means something.** Rotate the join code on the projector every five minutes,
and count attendance only for members who joined and submitted an exit artifact (a solved
checkpoint, a poll answer, a one-line "what I did"). Stops remote check-ins and gives everyone a
thing they did. *Where:* `worker/hub/rooms.js`, `room-do.js`. *Done when:* a code shared in a
group chat stops working within five minutes. *Size:* S. *Needs:* A2. *Model:* Sonnet.

**B5. Mock contest block.** Teams of three (the UIL format), a problem set, a scoreboard that
freezes for the last ten minutes, penalty time. Every fourth meeting. *Where:* `room-do.js`, new
`src/pages/Contest.jsx`. *Done when:* a 30-minute team contest runs with a frozen-board reveal.
*Size:* L. *Needs:* B2, C2. *Model:* Opus.

**B6. Show block and gallery.** Members submit an artifact (link, screenshot, code); the host
puts two or three on the projector; everyone can give one "kudos" each. Submitted artifacts land
on the member's portfolio and in the club feed. *Where:* `room-do.js`,
`worker/hub/projects.js`. *Done when:* an artifact shown in a meeting is on the member's public
page afterwards. *Size:* M. *Needs:* B1. *Model:* Sonnet.

**B7. Help queue with peer helpers.** Turn the question box into a queue. Any member can tap "I
can help"; when the asker marks it solved, the helper gets a `mentor` activity. *Where:*
`room-do.js`, `src/pages/Room.jsx`. *Done when:* officers are not the only people answering
questions. *Size:* S. *Needs:* A2. *Model:* Sonnet.

**B8. Speaker block.** Upvoted audience questions, a "takeaways" pad that becomes a post, and the
speaker's links pinned. *Size:* S. *Needs:* B1. *Model:* Sonnet.

**B9. Pair maker.** One button pairs the room: by squad, by mixed level, or at random, and
rotates each meeting so the same two people are not always together. *Size:* S. *Needs:* B1.
*Model:* Sonnet.

**B10. Panther Pause drop-in.** A lightweight always-open room type with no agenda: help queue
and check-in only, worth a small attendance activity. *Size:* S. *Needs:* B4. *Model:* Sonnet.

### C. Arena: the replacement for Learn

**C1. The Board.** Tracks (contest, build, AI, data, cyber) as ladders of rungs. A rung is a URL,
a one-line hint, a difficulty and a tag; most point at USACO Guide, CSES, Codeforces, picoCTF or
Kaggle. A three-question placement check drops a new member at the right rung. Credit is
automatic where an API can confirm it (C4) and a checkbox or answer-paste elsewhere. Officers add
a rung by pasting a link. *Where:* new `rungs` table, `worker/hub/board.js`, new
`src/pages/Arena.jsx`; retire `src/pages/Learn.jsx` as the entry point. *Done when:* an officer
adds a rung in under a minute without touching git, and a new member reaches their first problem
in under a minute. *Size:* L. *Needs:* nothing. *Model:* Opus. *Caveat:* school wifi may block
the outside sites; the gateway allowlist (H1) or the club's own judge (C2) covers meetings.

**C2. Problem bank and editor.** Move problems out of git into the database: statement, tests,
difficulty, tags, reference solution. An in-app editor with a "run my solution against my tests"
button. Import every code step from `shared/courses.js` and `shared/courses/*.js` as the seed.
*Where:* new `problems` table, `worker/hub/problems.js`, `src/pages/Officer.jsx`. *Done when:*
duels, the daily problem and mock contests all draw from one bank. *Size:* M. *Needs:* nothing.
*Model:* Sonnet.

**C3. Daily problem.** One short problem a day from the bank, a result grid you can paste into a
group chat, and a weekly count with one free miss (not a daily streak: loss aversion turns into
guilt, and one broken streak becomes the reason to quit). *Where:* `worker/hub/daily.js`, Today
page; extend the existing `puzzles` table or supersede it. *Done when:* the same problem shows
for everyone on a given day and a solve takes under five minutes. *Size:* M. *Needs:* C2.
*Model:* Sonnet.

**C4. Codeforces link and sync.** A member proves they own a handle (the app asks them to submit
a deliberate compile error to a named problem, then checks `user.status`), after which solved
problems and rating sync on a schedule and Board rungs tick themselves. **Verified:** the API is
free, needs no key for public data, and allows one request every two seconds. **Unverified:**
whether Codeforces serves requests from Cloudflare Worker IPs (it has returned 403 to some
automated callers); test this first, with a browser-side fallback. *Where:* new
`worker/hub/codeforces.js`, a cron in `wrangler.toml`. *Done when:* a linked member's Codeforces
solves appear on their Board within an hour. *Size:* M. *Needs:* C1. *Model:* Opus.

**C5. USACO and UIL tracker.** No USACO API exists (**verified**), so division is self-reported
through the claims queue (A3). Add contest-window countdowns, a promotion announcement in the
club feed, and an "upsolve" thread per contest. *Size:* S. *Needs:* A3. *Model:* Sonnet.

**C6. Editorials by members.** After solving, a member can read or write a short explanation.
Writing one that an officer accepts is a `mentor` activity. *Size:* S. *Needs:* C2. *Model:*
Sonnet.

**C7. Ghost races.** Replay a clubmate's recorded solve time on a problem and race it alone.
Asynchronous duels for the days between meetings. *Size:* M. *Needs:* B2. *Model:* Sonnet.

**C8. C++ and Java.** USACO and UIL are mostly C++ and Java, and the site only runs Python. This
is the hardest item here. The hosted runners are no longer an option: Piston's public API closed
in February 2026 (**verified**) and Judge0's free tier is unclear. Realistic routes, in order:
(1) keep C++ and Java off-site and credit them through C4; (2) self-host a WebAssembly C++
compiler from the club's own domain (large download, real effort); (3) CheerpJ for Java, which is
free for educational use but loads from a third-party domain the school may block. Do route 1
now and treat 2 as a research spike. *Size:* L. *Model:* Fable.

**C9. Hint tutor.** A helper that gives the next hint for a problem and never the solution, on
Cloudflare Workers AI (**verified:** 10,000 free neurons a day). The system prompt forbids full
solutions and the server checks replies before sending them. *Do not ship without advisor
sign-off:* serving AI output to under-18s carries extra obligations (age-appropriate filtering,
disclosure that it is an AI). *Where:* new `worker/hub/tutor.js`, an `AI` binding. *Size:* M.
*Needs:* C2 and a yes from the sponsor. *Model:* Opus.

**C10. Retire the course list.** Remove `learn` as a destination. Keep "Python for contests" as
the onboarding path for someone who has never coded, and move everything else into labs (B3).
*Size:* S. *Needs:* B3, C1. *Model:* Sonnet.

**C11. CTF board.** Flags grouped by category (crypto, web, forensics, reversing), a team
scoreboard, and a feed of upcoming events from the CTFtime API (**verified:** no auth, events
endpoint, cache daily, set a descriptive User-Agent). Members can author challenges, which
counts as shipping. *Where:* reuse the `flag` step kind, `ingest/sources.js` for the feed.
*Size:* M. *Needs:* C2. *Model:* Sonnet.

**C12. Data arena.** A club-sized Kaggle. Each challenge is a dataset plus hidden answers; a
member submits a predictions file; the server scores it and shows a leaderboard. Analysis runs
in the browser with pandas and matplotlib, self-hosted beside the existing Pyodide files
(**verified:** current Pyodide ships numpy, pandas, matplotlib and scikit-learn and they can be
served from our own domain; check the per-file size limit for Workers static assets, and use R2
if they exceed it). *Where:* `scripts/copy-pyodide.mjs`, `src/lib/py.worker.js`, new
`worker/hub/data.js`. *Done when:* a member loads a CSV, plots it, and submits predictions that
get a score, all on school wifi. *Size:* L. *Needs:* nothing. *Model:* Opus.

**C13. AI lab.** Three activities that teach how these systems behave rather than how to chat
with one: **prompt battles** (two members write a prompt for the same task, the room votes blind
on the outputs), an **eval bench** (write test cases, score a prompt, improve it), and **build a
bot** (a system prompt plus tools, shareable inside the club). Same sign-off requirement as C9.
*Size:* L. *Needs:* C9's plumbing. *Model:* Opus.

**C14. Quant sandbox.** A paper-trading game on replayed historical prices, and a backtest
sandbox in the browser. Simulated only: no real money, no brokerage connection, no investment
advice, clearly labelled as a game. Scored on risk-adjusted return so that gambling does not
win. *Size:* L. *Needs:* C12 (pandas). *Model:* Opus.

**C15. Research track.** A paper of the month with shared annotations, a science-fair pipeline
tracker (question, mentor, data, write-up, deadline), and the research opportunities already on
the board grouped into one place. *Size:* M. *Model:* Sonnet.

### D. Build

**D1. Ship cycles.** A three-week theme: pitch in one line, post short devlogs, demo on the last
meeting, peer votes, reward. This is the club's version of Hack Club's "you ship, we ship", and
it can point members at the real programs. The ideas board feeds the themes. *Where:* new
`cycles` table, `worker/hub/cycles.js`, `src/pages/Projects.jsx`. *Done when:* a cycle runs
start to finish with a demo-day block (B6) and shipped projects earn points through A2. *Size:*
M. *Needs:* A2. *Model:* Sonnet.

**D2. Workspace.** An in-browser editor with several files, saved to the account, that runs
Python and previews HTML and JavaScript in a sandboxed frame. This, not a proxy, is the answer
to "we want something like Replit at school" (see H2). Add push to GitHub through the gateway
with the member's own token. *Where:* new `src/pages/Workspace.jsx`, a `files` table or R2,
`src/lib/pyrunner.js`. *Done when:* a member writes a small web page and a Python script at
school, comes back at home, and it is still there. *Size:* L. *Needs:* nothing. *Model:* Fable
or Opus (sandboxing).

**D3. GitHub activity.** With one server token (**verified:** 5,000 requests an hour; without a
token Workers share IPs and get 60), show last commit, languages and commit activity on each
project card, and flag stale projects. No member OAuth needed for public repositories. *Where:*
new `worker/hub/github.js`, `worker/hub/projects.js`. *Size:* S. *Model:* Sonnet.

**D4. Teammate board.** "Looking for a teammate" posts attached to projects, opportunities and
ship cycles. *Size:* S. *Model:* Sonnet.

**D5. Code review requests.** A member asks for a review of a repository or a workspace file;
another member leaves comments; an accepted review is a `mentor` activity. *Size:* M. *Needs:*
A2. *Model:* Sonnet.

**D6. Portfolio v2.** A public page a member would put on a college application: verified
attendance, competition results, shipped projects with live repository data, rank, and an
officer-signed line. Print to PDF already exists. *Where:* `src/pages/Portfolio.jsx`. *Size:* M.
*Needs:* A2, D3. *Model:* Sonnet.

**D7. Starter templates.** One click opens a starter in the workspace: Discord bot, web page,
data notebook, text game, an LLM tool. Each is the first step of a ship cycle. *Size:* S.
*Needs:* D2. *Model:* Sonnet.

### E. Compass: finding what to do

**E1. Onboarding compass.** Six questions on first sign-in ("have you coded before?", "what
sounds fun?", "what are you aiming at?") that set a path and the first three things to do. This
is the feature for the member who does not know what they want. *Where:* new
`src/pages/Compass.jsx`, a `path` column on `users`, Today page. *Done when:* a new account sees
a dashboard that differs by answer. *Size:* M. *Model:* Sonnet.

**E2. Saved opportunities.** Save one, see who else in the club saved it, form a team, get the
deadline in the weekly digest. Finds the members who enter competitions but skip meetings and
gives them a reason to coordinate through the club. *Where:* `src/pages/Opportunities.jsx`,
`worker/digest.js`. *Size:* M. *Needs:* A1. *Model:* Sonnet.

**E3. More feeds.** CTFtime events and the Hack Club events API (**verified:** official, no
auth) alongside the existing Devpost and MLH scrapers. *Where:* `ingest/sources.js`. *Size:* S.
*Model:* Sonnet.

**E4. Competition pages.** Each club competition gets a sign-up roster, a prep plan made of
Board rungs and a mock contest, and a results entry that awards points to the whole roster in
one step. *Where:* `src/pages/Competitions.jsx`, the `competitions` table. *Size:* M. *Needs:*
A2. *Model:* Sonnet.

**E5. Pathways.** Goal pages with a concrete sequence: "USACO Silver by March", "first
internship", "science fair project", "AP CSA 5", "build a portfolio for college". Each step
links to a rung, an opportunity or a ship cycle. Content work more than code. *Size:* M.
*Model:* Opus for the content.

**E6. Alumni and mentors.** A directory of graduates willing to answer questions, and scheduled
ask-me-anything sessions run as speaker blocks. Needs outreach, not just code. *Size:* S.
*Model:* Sonnet.

**E7. Verified record.** A generated letter or certificate listing attendance, roles and
results, for applications and volunteer hours. *Size:* S. *Needs:* D6. *Model:* Sonnet.

### F. Today: the dashboard

**F1. Today view.** Replace the grid of equal panes with a ranked page: the next meeting
(countdown, theme, "I'm coming"), one next action from your path, the daily problem, your squad,
saved deadlines, and the club feed. One primary action above the fold. *Where:*
`src/pages/Home.jsx`, `worker/hub/dashboard.js`. *Done when:* a member knows what to do next
without scrolling. *Size:* M. *Needs:* better with E1, C3. *Model:* Opus (this is the page that
felt basic; it needs taste).

**F2. Club feed.** "Maya shipped a Discord bot", "Sam reached Silver", "Squad 3 passed 200".
Read straight from the activity ledger, with one-tap kudos. Recognition is the thing members
said was missing. *Size:* S. *Needs:* A2. *Model:* Sonnet.

**F3. Personal digest.** The weekly email already exists (`worker/digest.js`). Make it personal
for account holders: what you did, what your squad did, your saved deadlines, next meeting's
theme. One message a week, not more. *Size:* M. *Needs:* A2. *Model:* Sonnet.

**F4. Room-open ping.** Post to a Discord channel by webhook when an officer opens a room and
when a ship cycle starts (**unverified** but standard: a plain POST from the Worker). *Size:* S.
*Model:* Sonnet.

**F5. Command bar as the fast path.** The dock already takes `open`, `rank`, `grep`. Add
`join ABCD`, `daily`, `next`, `claim`. Cheap, and it makes the terminal look functional rather
than decorative. *Where:* `src/components/Chrome.jsx` (`Dock`). *Size:* S. *Model:* Sonnet.

**F6. Installable app.** A web manifest and a service worker so the site installs to a phone
home screen and the shell loads offline. Prerequisite for push notifications later (on iPhone,
push only works for installed apps; **verified**). *Size:* S. *Model:* Sonnet.

### G. Running the club

**G1. Meeting planner.** A calendar of upcoming sessions, each built from a template with its
blocks filled in, that warns when the last three meetings were the same kind. Planned sessions
show on Today and in the digest. *Size:* M. *Needs:* B1. *Model:* Sonnet.

**G2. Officer analytics.** Attendance by meeting and by template, a retention view (of the
people who came in September, who is still here), a list of members not seen in three weeks so
an officer can invite them personally, and which ideas became meetings. *Where:*
`src/pages/Officer.jsx`, the ledger. *Done when:* officers can answer "did duel night work?"
with a number. *Size:* M. *Needs:* A2. *Model:* Sonnet.

**G3. Announce once.** Write a message once; it goes to Discord by webhook and into the digest,
and the page gives copy-ready text for the Google Classroom stream and a social caption. Google
Classroom has no usable API for a student-run app (**verified:** needs district admin approval
and a teacher account), so copy and paste is the honest answer. *Size:* S. *Model:* Sonnet.

**G4. Handoff.** A year archive, an officer application form, and contribution-based
eligibility (authored rungs, reviews given, sessions hosted) so officer positions are earned
visibly. Keeps the club alive after the current officers graduate. *Size:* M. *Needs:* A7.
*Model:* Sonnet.

**G5. Safety and privacy.** A plain-language privacy page, a report button on member-written
content, first-name-only display on public pages by default, account export and deletion, and an
information page for parents and the sponsor. The app now holds accounts for minors; this is not
optional. *Size:* M. *Model:* Opus.

### H. Gateway

**H1. One code, session-scoped.** Joining a room turns the gateway on for that member until the
room closes; no separate gateway code to hand out. Add allowlist presets officers can toggle per
session: documentation (Python docs, MDN, cppreference), practice (usaco.guide, cses.fi),
data. *Where:* `worker/hub/gateway.js`, `worker/hub/rooms.js`. *Size:* M. *Model:* Opus
(security-sensitive). *Needs district approval for any host beyond what was already approved.*

**H2. What the gateway cannot do.** It will not make Replit, Colab or similar apps work. They
need sign-in (which the gateway blocks on purpose, because anything typed passes through a
server the member does not control), long-lived connections, and they detect proxies. The
workspace (D2) is the replacement. Write this on the gateway page so nobody waits for it.
*Size:* S.

**H3. Reader mode.** For documentation and editorials, fetch the page server-side and show
text and code only. Safer and faster than proxying a whole site, and enough for most "I need to
read this" cases. *Size:* M. *Model:* Sonnet.

**H4. Test what exists.** The gateway has not been tried on the school network. Do that before
building H1 or H3. *Size:* S, in person.

---

## Part 4. Build order

**Wave 0. The leaderboard runs itself.** A1 identity, A7 officer accounts, A2 ledger and rules,
A3 claims. Nothing visible changes much, but every later feature writes to this. About a week
of threads. *This is what you asked for most directly.*

**Wave 1. A reason to come.** C2 problem bank, B2 duel block, B4 real check-in, F1 Today. Run
duel night at the next meeting and watch attendance for three weeks. If one thing in this
document gets built, build this wave.

**Wave 2. A reason to open it at home.** C1 the Board, C3 daily problem, E1 compass, C4
Codeforces sync, C10 retire the course list, F2 feed.

**Wave 3. The meeting as a system.** B1 run-of-show, B3 labs, B6 show, B7 help queue, G1
planner, D1 ship cycles, A4 one rank system, A6 standings.

**Wave 4. Breadth.** D2 workspace, D3 GitHub, C12 data arena, C11 CTF board, A5 squads, G2
analytics, E2 saved opportunities, D6 portfolio.

**Wave 5. The ambitious ones.** B5 mock contests, C9 and C13 AI features (after sign-off), C14
quant, C15 research, C8 C++ and Java, G4 handoff.

Small items that can ride along with any wave: E3 feeds, F4 Discord ping, F5 command bar, G3
announce, B9 pair maker, C5 USACO tracker.

Threads that can run in parallel without touching the same files: A-series (worker auth and
ledger) with C2 (problem bank) with F5/E3/G3 (small, isolated). B1 and B2 both rewrite
`room-do.js`; run them one after the other.

---

## Part 5. Decisions only you can make

1. **Full ranked leaderboard, or relative view with tiers and a raffle (A6)?** The research says
   a full public ranking demotivates the bottom half. The current site and the season prize are
   built around a full ranking. Recommendation: relative view plus tiers, keep a top five.
2. **One currency or two (A4)?** Recommendation: one ledger, with honour-system items capped.
3. **Point values and caps (A2).** The defaults above are a starting point; officers should set
   them.
4. **Season length.** Semester or grading period.
5. **AI features with under-18 users (C9, C13).** Needs the sponsor's approval and probably the
   district's. Ask before building.
6. **Gateway scope (H1).** Any new host needs the same approval the GitHub gateway got.
7. **Squads (A5).** Officers assign, or members choose? Recommendation: officers assign, mixed
   by level, reshuffled each season.
8. **Do you want to retire `learn` entirely (C10)?** Recommendation: yes, once the Board and
   labs exist.

### Decided (2026-11-17, by the club lead)

1. Relative standings: top five, your rank and two either side, fixed tiers, a raffle.
2. One ledger. Honour-system items (self-checked lessons, daily problems) are capped so they
   cannot decide the prize.
3. The default point values in A2 stand until officers change them in settings.
4. A season is a semester (fall: August to December, spring: January to May).
5. AI features: deferred. Do not build C9 or C13 yet.
6. Gateway scope: deferred. H1 ships with the hosts already approved; presets are editable
   lists with nothing new enabled by default.
7. Officers assign squads, mixed by level, reshuffled each season.
8. Retire `learn` as a destination once the Board and labs exist.

All of this is built on branch `club-os`, never deployed without an explicit go.

## Shared contracts (every thread builds against these)

Written before Wave 0 so parallel threads agree on names.

- **Officer identity.** Officer-only routes sit behind `hubAdmin` in `worker/hub/index.js` (and
  `adminRouter` in `worker/routes/admin.js`). After A7, the guard sets
  `c.set('officer', { userId, name, role })`; for the shared break-glass password it sets
  `{ userId: null, name: 'shared login', role: 'lead' }`. Any code recording who approved
  something reads `c.get('officer')` and must tolerate `userId === null`.
- **Ledger.** `worker/hub/ledger.js` exports
  `recordActivity(db, { studentId, kind, ref, meta, status })` returning
  `{ activityId, awarded }`, and `approveActivity(db, id, officer)` /
  `rejectActivity(db, id, officer, reason)`. Pure rules live in `shared/points.js`
  (`POINT_RULES`, `pointsFor(kind, meta, history, rules)`, `seasonOf(date)`). Nothing outside
  the ledger inserts into `point_events` for automatic awards. `ref` makes an activity
  idempotent: the same `(studentId, kind, ref)` is never awarded twice.
- **Activity kinds:** `attend`, `compete`, `place`, `ship`, `mentor`, `solve`, `idea`, `daily`,
  `duel`, `manual`.
- **Member to leaderboard.** After A1 every `users` row has a `student_id`. Code that needs a
  member's leaderboard id uses `user.student_id` and may assume it is set for any account
  created after A1.
- **Problems.** `worker/hub/problems.js` owns the `problems` table:
  `{ id, slug, title, body, difficulty (1-5), tags, starter, cases (JSON), solution (server-only),
  source_url, status }`. `publicProblem(row)` strips `solution`. Duels, the daily problem, labs
  and contests read from it.
- **Feed.** The club feed reads `activity` rows with `status = 'approved'`; no separate feed
  table.
- **Officer UI.** New officer screens go in `src/pages/officer/<Name>.jsx` and are added to
  `src/pages/Officer.jsx` with one import and one line, to keep merges clean.
- **Schema.** New tables are appended to the end of `worker/schema.sql` under a comment with
  the item ID. Columns added to existing tables use `ALTER TABLE` in
  `worker/migrations/NNN-<name>.sql` (003 is the next free number) as well, because `CREATE TABLE IF NOT EXISTS` will not
  add them to a live database.

## What I would not build

Daily streaks with guilt mechanics. Push notifications more than once a week. Badges for
counting things. Points for live-quiz answers (it invites cheating and turns learning into a
score). A Google Classroom integration. A LeetCode or Kaggle account sync. A custom chat system
(Discord exists). Anything that proxies sign-in pages.
