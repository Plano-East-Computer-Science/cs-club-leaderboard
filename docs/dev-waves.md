# Dev waves

Changes reach https://dev.peshcompsci.org in waves. Each feature is one pull
request into `club-os`, merged with a merge commit, labelled `wave-N`. The tip
of each wave is tagged `wave-N`. Every push to `club-os` redeploys dev (the
"Deploy dev" action). The live site is not touched by any of this.

## Rolling back from your phone

- **One feature:** open its PR on GitHub, press **Revert**, then merge the
  revert PR it opens. Dev redeploys without that feature in a few minutes.
- **A whole wave:** revert its PRs one by one, newest first.
- Database changes are additive only (new tables, new columns), so reverting
  code never needs a database rollback. Columns a reverted feature added stay
  and go unused.

## Wave 1: sign-in (2026-11-18)

| PR | What |
| --- | --- |
| [#6](https://github.com/Plano-East-Computer-Science/cs-club-leaderboard/pull/6) | 6-digit code in the sign-in email, rate limits sized for school wifi, clearer sign-in page |

Test on dev:
1. Open /signin on a laptop, enter a personal email (a new one asks for a
   display name). The page moves to "Check your email" with a resend countdown.
2. The email subject starts with the 6-digit code. Type it on the laptop: you
   are signed in there.
3. Request again, then open the email's button on a phone instead: the phone
   signs in, and the code from that email no longer works.
4. Type a wrong code: a clear error. Five wrong codes: "send a new email".
5. Have several people on school wifi sign up at once: nobody should see
   "too many requests".

Roll back: Revert #6. Migration 012 columns stay, unused.

## Wave 2: officer tools and look (2026-11-18)

| PR | What |
| --- | --- |
| [#7](https://github.com/Plano-East-Computer-Science/cs-club-leaderboard/pull/7) | One officer home at /officer (the admin panel moved in, /admin redirects); officer tab only for officers |
| [#8](https://github.com/Plano-East-Computer-Science/cs-club-leaderboard/pull/8) | Visual pass: surfaces that separate, readable muted text, quieter footer, no sideways wobble on phones |
| [#9](https://github.com/Plano-East-Computer-Science/cs-club-leaderboard/pull/9) | Phone nav: brand, menu, account instead of a clipped tab strip |
| [#10](https://github.com/Plano-East-Computer-Science/cs-club-leaderboard/pull/10) | Moves one CSS block so every PR above (and #6) reverts cleanly on its own |

Test on dev:
1. Sign in with an officer account. An **officer** tab appears in the top bar.
   A member account does not see it.
2. /officer opens on "Run a meeting". The sidebar (a dropdown on a phone) has
   every tool: open a room, award points, approve claims, roles, digest,
   page text, backup. Each tool has its own address you can bookmark.
3. Old links: /admin and /officer?tab=members land in the new home.
4. Review queues with pending items show a gold count in the sidebar.
5. Pages look less flat: panels stand off the page, grey labels are easier to
   read, the digest footer at the bottom is smaller.
6. On a phone: the top bar shows the logo, "menu" and your name. "menu" lists
   every page. Pages no longer slide sideways. Typing in a field does not zoom.

Roll back: Revert #9, #8 or #7 on its own (each was checked to revert
cleanly), or #9, #8, #7 in that order for the whole wave. #10 only moves CSS
and never needs reverting. No database changes.

## Wave 3: trust fixes (2026-11-19)

Fallback for everything before v2: branch and tag `dev-fallback-2026-11-18`.

| PR | What |
| --- | --- |
| this PR | Officer notes stay private; attendance pays everyone who checked in (+3 bonus for doing something); End room says what will happen; rooms open over 8 hours close and pay themselves; one points table (`/api/club`) on About and Standings; readable digest; 60-minute meetings by default (120 available); meeting time Wednesday 4:30 PM; dev loads content seeds |

Test on dev:
1. Officer: plan a meeting, put a private note on a block. Join as a student: the note never shows.
2. Open a room (60 minutes is the default). Check a student in, then End room: the confirm says how many will be paid. Close it: the student gets attendance.
3. /about and /standings show the same point values.
4. Practice and the Board are no longer empty on dev.

Roll back: Revert this PR. Migration 013 (`rooms.minutes`) stays, unused.

### Wave 3, PR 2: code editor and Java in the browser

A real editor (CodeMirror 6) and Java that runs in the browser from our own domain (TeaVM javac compiled to WebAssembly, served from /teavm, about 4.5 MB on first use). Not wired into problems yet; try it at /lab/editor?editor=1.

Test on dev, ideally on a school laptop on school wifi:
1. Open https://dev.peshcompsci.org/lab/editor?editor=1, pick Java, type a program that reads with Scanner, put input in the stdin box, press Run (or Ctrl+Enter). The first run takes a few seconds; later runs about 1 second.
2. Make a typo: the error shows on the line in the editor.
3. Switch to Python: it runs too.

Roll back: Revert the PR. Nothing else depends on it yet.

### Wave 3, PR 3: duel packs

Two prepared duel packs (22 original problems, each checked in Java and Python against every test). Officers start a duel from a pack in one tap. Officer tools > Content > "Duel packs and contest sets" to view or build packs.

Test on dev:
1. Officer: open a room with the Duel night template, go to the Duel block, press "Open the lobby with Duel Pack 1".
2. Students pick a division and race. Each round uses the pack's next problem.
3. Officer tools > Content > Duel packs shows both packs with their problems.

Roll back: Revert the PR. The problem_sets table and the pack problems stay in the database, unused.

## Wave 4: new look, shell, front door, Today (2026-11-19)

| PR | What |
| --- | --- |
| this PR | Self-hosted fonts (readable sans for text), new colour and type tokens applied to every page, a component kit in src/ui, the new app shell (Today, Practice, Build, Compete, Me, a green Live pill when a room is open, Ctrl+K search, HQ for officers, phone bottom tabs), the public front door, and a new Today |

Test on dev:
1. Signed out: the front door says Wednesdays 4:30 PM, shows tracks with real problems and opportunities, one "Create your account" button.
2. Signed in: Today shows one next step, this week, the club feed and your standing. A new account sees "Your first meeting earns 10 points" instead of a rank.
3. Open a room as an officer: every page shows a green Live pill; Today puts the room at the top.
4. Phone: five tabs along the bottom. Ctrl+K (or /) opens search on a laptop.
5. Practice, Build, Compete and Me still show the old pages inside the new shell; those are rebuilt in Wave 7.

Roll back: Revert this PR. No database changes (one new members-only route, /api/me/live).

## Wave 5: Officer HQ (2026-11-19)

| PR | What |
| --- | --- |
| this PR | Officer tools move to /hq: Home ("This week": next meeting with a readiness checklist, rooms still open with Close and pay, inbox counts, members not seen in 3 weeks with Copy a message, digest and backup reminders), Meetings (timeline and plan editor), one Inbox for every queue with inline approve and reject, Members with search, last seen and a member drawer, plus Library, Announce, Season and Settings. Old /officer and /admin links redirect. |

Test on dev (officer account):
1. Click HQ in the top bar. Home shows the next meeting and what is missing before it.
2. Inbox: approve or reject a claim in one click.
3. Members: search a name, open the drawer, award points, see readable history.
4. Old bookmarks like /officer?s=claims land in the matching HQ page.

Known gap: Library, Season and Settings still show the older screens inside the new layout; they get restyled later.

Roll back: Revert this PR. No database changes (one officer-only route, /api/admin/hub/inbox).
