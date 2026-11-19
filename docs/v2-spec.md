# Club OS v2: product spec and build contracts

Written 2026-11-18. This supersedes the navigation, page layout and visual rules in
`docs/hub-roadmap.md` (Parts 2 and the "Look" rules in `docs/agent-brief.md`). The roadmap's
diagnosis, personas, ledger contracts and "Decided" list still stand. The evidence behind this
spec (student audit, officer audit, outside research) is in the reframe artifact
https://claude.ai/artifact/KEg6WF5N2U9A4HG99rbDMp and in `.review/reframe-2026-11-18/` on the
lead's machine.

Fallback: everything on dev before v2 is saved as branch and tag `dev-fallback-2026-11-18`.

## 1. What we are building

Club OS is the STEM home of Plano East: a real product, held to the bar of Replit, HackerRank,
Linear or Duolingo, not a club page. Students at the school called the current site "vibe
coded". Every screen we ship must survive that test: deliberate layout, real content, no
filler copy, no template look.

The cycle we design for:
1. **Get them in.** A public front door that says what the club does, when and where it meets,
   shows real recent work, and has one button.
2. **Give them a portal.** After sign-in, the whole app is theirs: opportunities they can save,
   standings they can climb, practice and lessons they can do on their own time at any length,
   projects they can build, a record they can show colleges. Nothing is mandatory before a meeting.
3. **Make the meeting the best hour of their week.** Head-to-head duels, speakers with a live
   question queue, labs in pairs, everyone helped, visible short-term and long-term rewards.
4. **Bring them back.** Recaps, a personal digest, friends' activity, the next meeting.

Language: the school teaches **Java**. Java is the default language for lessons, practice and
duels. Python stays available (it already runs in the browser). C++ is later.

## 2. Principles (every screen)

1. One answer to "what next": the compass sets a track; the track and an optional pathway set
   one next step; Today shows it. No other surface invents its own "next".
2. Prepare before, tap during: every meeting block carries its payload from the plan.
3. The app knows the time: live room, meeting day, between meetings, end of season change the
   shell and Today.
4. Five doors for members: Today, Practice, Build, Compete, Me. Officer tools behind their own door.
5. Show, do not explain: no paragraph above the first action, one-line subtitles, rules behind
   a "How this works" link, empty states are one sentence and one button.
6. Each kind of thing has its own shape and its track has its own colour.
7. Never make anyone feel behind: no rank before the first meeting, small brackets, weekly
   streaks with freezes, quiet students never put on the spot.
8. Curate and credit outside depth (USACO Guide, CSES, Codeforces, picoCTF, Kaggle); spend club
   effort on the social layer.

## 3. Information architecture

### Public (signed out)
`/` front door: what we do, meeting day/time/place, next meeting, recent work (projects, recap),
tracks, one "Create your account" button, sign in. `/about`, `/join` (folded into the sign-up
flow), `/parents`, `/privacy`, `/verify/:code`, `/archive`.

### Member app (signed in)
Top bar: brand, **Today, Practice, Build, Compete, Me**, a green **Live** pill when a room is
open, search (replaces "ls all"), account menu. Officers also see **HQ**. Phone: bottom tab bar
with the five doors; Live pill pinned at the top.

| Door | Contains (old routes it absorbs) |
|---|---|
| Today `/` | meeting card, one next step, this week, since you were here, feed, announcements (home, quests-as-next, deadlines, claims prompt) |
| Practice `/practice` | track ladders (arena board + old courses as lessons), problem pages with the IDE, Daily (+ Problem of the Week), Races, CTF, Data, Quant, Research paper (arena, learn, daily, puzzles, ctf, cyber puzzles, data, quant, research) |
| Build `/build` | ship cycle, start-a-project flow, my projects, gallery, teammates, reviews, workspace, tools: gateway, reader |
| Compete `/compete` | standings (you first, bracket, tiers, raffle), club teams (competitions with roster, dates, prep), opportunities (saved, browse), calendar |
| Me `/me` | portfolio + points record (one page), goals (pathways), bonuses (quests, badges), verified record request, officer application, compass, alumni, account |

Old URLs keep working through redirects. Nothing is deleted; pages are moved and restyled.

### Officer HQ `/hq`
Home (next meeting + readiness, last meeting paid?, inbox counts, drifting members, due this
week), Meetings (calendar + plan editor with per-block payloads), Inbox (claims, editorials,
reports, link requests, opportunity queue, CTF pending, alumni questions), Members (roster +
member drawer), Library (problem sets, lesson kits, poll sets, problem bank, board rungs, daily
pins, CTF, data, opportunities, research, quant), Announce (composer, in-app banner, Discord,
digest preview, Classroom and Instagram post generator), Season (competitions, squads, raffle,
cycles, badges, handoff, stats), Settings (officers, meeting time and place, gateway and reader
hosts, page text, backup). `/officer?s=...` and `/admin` redirect.

## 4. Visual system

- Fonts, self-hosted (school wifi may block Google Fonts): **Big Shoulders Display** for page
  titles and big numbers only; **IBM Plex Sans** for all running text and UI; **JetBrains Mono**
  for labels, codes and code. Install with `@fontsource` packages.
- Sizes: app page titles 40 to 56px; body 15 to 16px; labels 12px mono uppercase; nothing under
  12px. Giant display type only on the projector, the prize and the front door.
- Surfaces: page, panel, raised with visible steps; borders that show; inputs lighter than
  their panel. Muted text at WCAG AA.
- Colour: gold is the brand and the single primary action per screen. Green = live. Coral =
  needs you. Track colours: contest gold, build blue, AI violet, data teal, cyber coral-red,
  engineering green, explorer neutral.
- Components live in `src/ui/` and every new or moved page uses them: AppShell, TopBar,
  BottomTabs, LivePill, Search, PageHeader, Section, Tabs, Card, ProblemCard, ProjectCard,
  OpportunityCard, MeetingCard, PersonRow, Stat, EmptyState, Pill, Button (primary, secondary,
  ghost, danger), Field, Dialog, Menu, Toast, Skeleton. No inline `style={{}}` for layout or
  colour in new code.
- Icons: `lucide-react`. Accessible primitives: `@radix-ui/react-*` (dialog, dropdown-menu,
  tabs, popover, tooltip). Editor: CodeMirror 6.
- Terminal flavour kept with intent: command bar (Ctrl+K / "/"), prompt-style section labels
  used sparingly, boot screen once per session. Removed: holiday toggle in the bar, status bar,
  full site map in every footer.
- Motion: short, purposeful (150 to 250ms), respects reduced motion. Live states pulse.

## 5. The meeting

Blocks: poll, teach (new), hook, lab, duel, contest, show, speaker, track (new), break, close.
Each block has `notes` (officers only, never sent to students) and `screen` (projector and
student text). Payloads prepared in the plan:

- duel `{ set: <problem_set slug>, minutes, rounds, newMode, spotlight }`
- contest `{ set, minutes, freeze, penalty, teamSize }`
- poll `{ questions: [{ text, options, answer?, seconds? }] }`
- lab / track `{ kits: [{ name, source }] }`
- teach `{ slides?: url, checks: [{ text, options, answer }] }` (vote, discuss, revote)
- speaker `{ name, title, intro, zoomUrl (officers only), seedQuestions: [], openEarlyHours }`

Attendance: every checked-in member is paid `attend` when the room closes; activity in the
room adds a bonus. End room warns about anything unusual. A cron closes rooms open longer than
eight hours and pays them. Templates come in 60 and 120 minute versions.

Projector: one clock at a time, names and results at 40px or more at 1366x768, a between-blocks
screen with the join code, a Zoom-safe speaker mode that moves questions to an officer phone view.

## 6. Shared contracts

- `GET /api/club` (public): `{ meeting: { day, time, place, note }, next: { date, title, kind,
  speaker? } | null, points: [{ kind, label, points, cap }] }`. Meeting fields are settings
  edited in HQ Settings (keys `meeting_day`, `meeting_time`, `meeting_place`, `meeting_note`).
  `points` is generated from `shared/points.js` so About, Standings and HQ never disagree.
- `problem_sets` table: `{ id, slug UNIQUE, kind ('duel'|'contest'), title, body JSON, status
  ('draft'|'live'), created_by, created_at, updated_at }`. Duel body:
  `{ practice: slug, new: [slug x3], comfortable: [slug x3], contest: [slug x3], final: slug|null }`.
  Contest body: `{ problems: [slug...] }`. Owned by `worker/hub/sets.js`.
- Problems stay stdin/stdout and language-agnostic. `problems.starter` may hold a JSON object
  `{ java, python }`; readers must accept a plain string (legacy, Python).
- Code execution goes through one client interface, `src/lib/run/index.js`:
  `run({ lang, source, stdin, timeoutMs }) -> { stdout, stderr, exitCode, timeMs, compileError? }`
  and `judge({ lang, source, cases }) -> { passed, results[] }`. Python uses Pyodide. Java's
  backend is decided by the V3-C spike.
- Ledger contracts from `docs/hub-roadmap.md` are unchanged.

## 7. Waves (each wave = PRs into `club-os`, labelled, tagged, logged in `docs/dev-waves.md`)

- **Wave 3 (trust and content):** V3-A trust fixes (private notes, attendance on check-in,
  end-room warning, auto-close cron, one points table, readable digest, meeting settings +
  `/api/club`, 60/120 templates, dev deploy loads content seeds). V3-B problem sets and Duel
  Packs 1 and 2 with Java and Python reference solutions, Library screen, duel block runs from a
  set in one tap. V3-C Java execution and IDE spike (CodeMirror 6 editor component, Java backend
  decision and prototype).
- **Wave 4 (design system and shell):** fonts, tokens, `src/ui/` kit, AppShell with five doors,
  Live pill, search, bottom tabs, front door, Today. Three screens go to the lead for approval
  before other pages move.
- **Wave 5 (Officer HQ).**
- **Wave 6 (the meeting):** speaker block, teach block, projector, who-is-stuck, recap card.
  Must be ready for the Dec 2 speaker meeting (dry run Nov 30 to Dec 1).
- **Wave 7 (member doors):** Practice with the IDE and Java, Build, Compete, Me.
- **Wave 8 (reach):** Instagram post generator and poster, Google Classroom post text,
  personalised newsletter by interest and activity, poster page, bring-a-friend, weekly streak.
- **Wave 9 (depth):** C++, engineering circuit lab, more lesson kits and packs, AI tutor if the
  sponsor approves.

## 8. Rules for build agents (in addition to `docs/agent-brief.md`)

- The "No new UI libraries" rule is replaced by the dependency list in section 4.
- Never push, deploy or use `--remote`. The lead's orchestrator merges and ships.
- Stay in your item's files. If you need something another item owns, build against the
  contract above and leave a marked stub.
- Copy: plain, short, sentence case, no em dashes, no exclamation marks, no emojis.
- Every UI change: check at 1366 and 390 wide, keyboard, and in a real browser before you
  report. Use your own headless Chromium via the cached Playwright package from node (not the
  shared Playwright MCP, not the gstack daemon, not the in-app browser).
