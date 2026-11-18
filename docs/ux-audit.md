# UX audit: club-os (November 2026)

Scope: every route in `src/App.jsx`, the site chrome in `src/components/Chrome.jsx`,
the officer areas (`/officer`, `/admin`, `/host/:code`), and the sign-in page.
Checked in a browser at 1366 px and 375 px wide with the demo seed.

The design direction stays "Mission Control" (design E: black and gold
terminal, Big Shoulders display type, JetBrains Mono body). Nothing here
replaces it. The problems are hierarchy and wiring, not the theme.

## 1. Information architecture

### Member pages

36 routes. The chrome reaches them four ways:

| Entry | What it shows |
| --- | --- |
| Tab bar | 7 fixed pages: home, standings, arena, quests, room, build, opportunities |
| "ls all" panel | 23 pages in 5 groups (meet, arena, build, compete, club) |
| Footer | all 25 pages in one flat run, plus privacy and parents |
| Command bar (`/`) | `open <page>` over the same 26-item list, plus shortcuts |

That is workable: the tab bar covers the weekly loop and the panel is a real
site map. Problems:

- **Officer links shown to everyone.** The "ls all" panel ends with
  "officers: run a meeting / admin panel" for every visitor, and `open admin`
  is in the member command bar. Members see officer clutter; officers get no
  better entry than members do.
- **Mobile tab bar collides.** At 375 px the scrolling page list runs under the
  "all" button, so the second tab reads "1 st" and the rest are hidden behind
  it. The account chip and "all" take a third of the bar.
- **The digest footer is on every page**, including sign-in and the officer
  tools, where it is noise. On a phone the footer plus the fixed command bar and
  status line take roughly 100 px at the bottom of every screen.

### Officer tasks: how each is reached today

| Task | Where | How you get there |
| --- | --- | --- |
| Open a meeting room | `/officer` Meeting tab | "ls all" panel, `/officer` URL |
| Run the room, projector | `/host/:code` | "Run it" / "Host" on a room in `/officer` |
| Plan sessions | `/officer` Meeting tab, below rooms | scroll |
| Award points | `/admin` "Award points" | "Full admin panel" button, or panel link |
| Members list, badges | `/admin` | same |
| Officer roles | `/officer` Members tab, 4th of 8 stacked sections | scroll |
| Officer list on the About page | `/admin` "Officers" | separate from roles above |
| Approve claims, editorials, reports, link requests, merges | `/officer` Review tab, 5 stacked sections | scroll |
| Approve scraped opportunities | `/admin` "Pending" | a second review queue in a different console |
| Problem bank, daily, board, CTF, data, quant, cycles | `/officer` Content tab, 10 stacked sections | scroll |
| Puzzles, competitions list, curriculum, opportunities | `/admin` | different console |
| Prep plan and results for a competition | `/officer` Content tab | separate from the competitions list in `/admin` |
| Announcement (Discord/email) | `/officer` Club tab | |
| Weekly digest, test email | `/admin` "Email" | |
| Page text, backup | `/admin` | |

Findings:

- **Two consoles for one job.** `/officer` (5 tabs, account or break-glass
  sign-in) and `/admin` (12 tabs, a different sign-in screen, a sidebar layout,
  a flash bar). They share the same session check but look and behave
  differently, and `/admin` has no way back to `/officer`.
- **Pairs split across them:** roles vs. the About officer list, the review
  queue vs. the opportunity queue, announcements vs. the digest, the competition
  list vs. its prep plan, the puzzle list vs. the problem bank.
- **Tabs that are pages of pages.** Each `/officer` tab stacks every screen in
  its group (Members stacks 8, Content stacks 10), each with the same small
  eyebrow and heading, so they run together and the tab you want is a long
  scroll away.
- **Running a meeting is two places**: open the room in `/officer`, run it in
  `/host/:code`. That split is right (the host screen is full-screen on
  purpose), but nothing on `/officer` makes "open a room" the obvious first
  thing.

## 2. Visual hierarchy

- **Surfaces do not separate.** Page `#0a0a08`, panel `#0f0f0c`, inset
  `#0c0b07`, border `#3a3622`. Panels differ from the page by about 1%
  luminance, and inputs are darker than the panel they sit in. Everything reads
  as one black sheet: the "flat" report.
- **Muted text fails contrast.** `--mute` `#6b6754` on the page is about 3.4:1,
  and it is used for labels, hints, timestamps and eyebrows at 11 to 12 px.
  Placeholder `#4d4a3a` is about 2.2:1.
- **One heading style for four levels.** Uppercase display type is used for
  page titles, section titles inside a tab, and card titles, at similar sizes,
  each over a "$ eyebrow". Nothing says "this is the page" vs "this is a part".
- **Primary action not obvious.** Ghost buttons (`--dim` text on a `#3a3622`
  border) nearly disappear; on the officer pages every form has a gold button,
  so the one action that matters (open a room) has no more weight than "Find".
- **Mobile.** Inputs are 13.5 px, so iOS zooms the page on focus. Body copy is
  13 to 14 px mono, which runs long on a phone.
- **Bugs seen:** in `/admin` standings the tier label runs under the avatar;
  `/officer` shows a 48 px gap before the first section.

## 3. Plan

1. **Sign-in** (done first, separate commit): code in the email, rate limits
   for a shared school IP, one clear flow.
2. **One officer home at `/officer`.** A sidebar grouped by job (Meeting,
   Review, Members, Content, Club, Site) with one screen at a time and the URL
   holding the screen (`?s=`). The `/admin` screens move in as screens of the
   same shell, and `/admin` redirects. One sign-in (account, or break-glass),
   one sign-out, one flash line. "Run a meeting" is the landing screen. The
   review group carries a pending count.
3. **Officer entry only for officers.** An "officer" tab appears in the bar for
   officer and lead accounts. The panel footer link and `open admin` go.
4. **Surfaces and type tokens.** Three distinct surface steps (page, panel,
   raised) with borders that show, inputs lighter than their panel, muted text
   raised to AA, one placeholder colour that is readable. Applied through the
   existing CSS variables so every page picks it up without per-page edits.
5. **Heading levels.** Page title (display, large), section title (display,
   medium, with a rule above it so sections separate), card title (mono, bold,
   sentence case).
6. **Buttons.** Ghost buttons get a visible border and text; primary stays gold
   and is used once per screen where possible.
7. **Mobile.** Tab bar that does not collide, 16 px inputs, the digest footer
   only on public pages, not on sign-in or officer pages.

Not in scope: new features, the boot screen and holiday layer (they are part of
the theme and already skip on reduced motion), and the per-page layouts of the
member pages beyond what the shared tokens change.
