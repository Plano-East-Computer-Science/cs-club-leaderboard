# Working rules for agents building the `next` site

`next` is a ground-up rework of the club site, served at https://next.peshcompsci.org. The lead's
brief, in their words: "abandon all cohesion of UI and make sure the ecosystem is perfect". Two jobs,
in this order:

1. **A high school CS/engineering student's best friend.** Fun daily coding games, real lessons
   that actually teach, opportunities, and everything a student needs to succeed and get into a top
   college.
2. **Meetings.** What to do at them and how to run everything.

Complaints we are fixing: lessons have "not enough teaching"; many things feel half built; tabs
that disappear once you click one (fixed: every door has a layout route with its own tab bar, see
`src/next/DoorTabs.jsx`); too much yellow and black (fixed: the notebook theme).

## Setup (your worktree)

1. `git fetch origin && git reset --hard origin/next` first: worktrees may be cut from the wrong
   branch.
2. `node_modules`: `cmd //c mklink /J node_modules "C:\Users\sujay\CS club leaderboard\.claude\worktrees\next\node_modules"`
   (Git Bash), or `npm ci`.
3. Copy `.dev.vars` from `C:\Users\sujay\CS club leaderboard\.dev.vars` (gitignored, never commit).
4. `npm test` must pass before you change anything.
5. Local server: `npm run build`, then apply `worker/schema.sql` and the seeds with
   `npx wrangler d1 execute cs-club --local --persist-to .wrangler/state --file <file>`
   (schema.sql, seed.sql, seed-problems.sql, seed-rungs.sql, seed-packs.sql), then
   `npx wrangler dev --port <your port> --inspector-port <port+1000> --persist-to .wrangler/state`
   in the background. Restart it after every `npm run build` (it serves a stale asset list).
   Kill your whole wrangler process tree when you finish. `DEV_LOGIN=1` makes
   `/api/auth/request` return the sign-in link instead of emailing it.

## Hard rules

- Never deploy, never push, never run anything with `--remote`.
- Commit on your worktree branch before you finish. Stage your files by exact path (never
  `git add -A`). End the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Only touch your area's files plus the one-line hooks listed below. Other agents are building
  other doors at the same time.
- Shared hook points (keep your edit to these lines so merges stay trivial):
  - `src/App.jsx`: replace the `<Soon ... />` routes for your area with your pages (lazy import is
    fine for heavy pages).
  - `src/next/DoorTabs.jsx`: your door's tab list only.
  - `worker/hub/index.js`: one import and one mount line for your router.
  - `worker/schema.sql`: append your tables at the end under a comment naming your area.
    Additive only (`CREATE TABLE IF NOT EXISTS`, new indexes). The `next` site shares the dev
    database with dev.peshcompsci.org, so never change or drop an existing table or column.
- Tests: new `test/<area>.test.js` (plain `node:assert`; `test/d1-shim.js` is a fake D1 over
  `node:sqlite`; see `test/hub.js` for calling routers). Pure logic (scoring, daily seeding,
  validation, deadlines) and who-may-call-what must have tests. `npm test` and `npm run build`
  must both pass before your final commit.

## Where things go

- Pages and components: `src/next/<area>/` (for example `src/next/play/Play.jsx`). Area CSS in
  `src/next/<area>/<area>.css`, imported by the area's page, classes prefixed with the area
  (`pl-`, `lr-`, `fu-`, `cl-`, `hm-`).
- Content and pure logic shared by client and server: `shared/next/<area>/*.js` (ES modules, no
  DOM). Big authored content (lessons, word lists, programs) lives here as data, not inside JSX.
- API: `worker/hub/<area>.js`, mounted under `/api/<area>`. Use `requireUser` / `currentUser` from
  `worker/hub/users.js`, `requireOfficer` for officer routes (`hubAdmin` in `worker/hub/index.js`).
  Validate every input; failures return `{ error: 'Readable sentence.' }` with a real status.
- Signed-out students must still be able to use games and lessons: keep progress in
  `localStorage` (keys prefixed `next:`, every access wrapped in try/catch) and sync to the server
  when signed in.

## Reuse before writing

- UI kit `src/ui/index.js`: `Button` (primary, secondary, ghost, danger; `to`/`href`), `Pill`,
  `Card`, `PageHeader`, `Section`, `Tabs`, `NavTabs`, `Field`, `EmptyState`, `ErrorState`,
  `Skeleton(List)`, `Stat`, `Tip`, `HowItWorks`, `Dialog`, `Menu`, `useToast`, `useSession`
  (`{ user, live, loading, refresh }`).
- `src/lib/api.js` (`api.get/post/...`, paths without the `/api` prefix), `src/lib/ui.js`
  (`useApi`, `useMedia`, `reducedMotion`), `src/lib/format.js`.
- Running code in the browser: `src/lib/run/index.js` exports `run({ lang, source, stdin })` and
  `judge({ lang, source, cases })` for `'java'` (TeaVM, self-hosted) and `'python'` (Pyodide).
  `src/components/Editor.jsx` is the CodeMirror editor (`value`, `onChange`, `lang`, `onRun`,
  `diagnostics`). Java is the school's language and the default.
- Icons: `@phosphor-icons/react`. No new UI libraries without a strong reason.

## Look: the notebook theme

Tokens are in `src/theme/notebook.css` (read it). Light mode is an engineering notebook (graph
paper, ballpoint-blue ink `--gold`, highlighter lime `--hl`); dark mode is a blueprint (navy sheet,
lime primary). `--gold` is the historic name of the primary colour; use it for the one main action.
Surfaces `--s1/--s2/--s3`, text `--t1/--t2/--t3`, borders `--line/--line-2`, states `--ok`,
`--need`, `--warn`, `--live`, game tiles `--g-hit/--g-near/--g-miss/--on-g`, radius `--r`
(controls) and `--r-lg` (cards), fonts `--disp` (Unbounded, headings and big numbers only),
`--sans` (Figtree, everything else), `--mono` (code only). Never hard-code a colour: both themes
must look right. Test with `document.documentElement.dataset.theme = 'light'` and `'dark'`.

Design rules (the lead dislikes anything that looks templated or "AI"):
- Spend boldness in one place per screen; keep the rest quiet. Not every block is a card.
- No all-caps labels, no tracked-out eyebrows above headings, no monospace for small labels, no
  "→" appended to buttons, no `A · B · C` meta strings, no numbered 01/02/03 unless it is a real
  sequence, no gradient washes, no fade-up on every section.
- Copy: sentence case, plain verbs, buttons say exactly what happens, no em dashes, no
  exclamation marks, no emojis in UI text, empty states are one sentence and one button.
- Text at least 13px (body 15 to 16px). Works at 375px wide with no sideways scroll. Every control
  keyboard reachable with a visible focus ring and a label. Respect `prefers-reduced-motion`.
- Motion only where it answers an action (a tile flips, a check lands).

## When you finish, report (under 300 words)

Branch and commit hash; what you built; files touched; tests added and the `npm test` result;
2 to 3 screenshot paths (save under `.review/next/<area>/`, viewport only, one light and one
dark); anything unverified; anything another area must hook up.
