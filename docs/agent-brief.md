# Working rules for any thread building from the roadmap

Read this, then `docs/hub-roadmap.md` (Part 1 for the why, "Shared contracts", and your items
in Part 3). Build only your items. If something you need from another item does not exist yet,
build against the contract and leave a clearly marked stub, do not build the other item.

## Setup (worktree)

1. If `node_modules` is missing, link the main checkout's copy (Git Bash):
   `cmd //c mklink /J node_modules "C:\Users\sujay\CS club leaderboard\node_modules"`
2. If `.dev.vars` is missing, copy it from `C:\Users\sujay\CS club leaderboard\.dev.vars`.
   It is gitignored; never commit it.
3. `npm test` must pass before you change anything. If it does not, report and stop.
4. Local server (only if you need one): `npm run build`, apply the schema with
   `npx wrangler d1 execute cs-club --local --persist-to .wrangler/state --file worker/schema.sql`
   and the seed with `--file worker/seed.sql`, then
   `npx wrangler dev --port <your port> --inspector-port <your port + 1000> --persist-to .wrangler/state`
   run in the background. Use the port you were given; others are in use.
   `DEV_LOGIN=1` makes `/api/auth/request` return the sign-in link instead of emailing it.

## Hard rules

- Never deploy, never push, never run anything with `--remote`. Production is off limits.
- Commit your work on your worktree's branch before you finish (stage only your files, never
  `git add -A`; `.review/`, `.playwright-mcp/`, `.wrangler/`, `node_modules` stay out). End the
  message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: put new checks in a new `test/<area>.test.js` (plain `node:assert`, no framework; see
  `test/hub.js` and `test/d1-shim.js` for a fake D1 over `node:sqlite`). `npm test` runs every
  `*.test.js`. Pure logic (point rules, matching, scoring, parsing) must have a test. Security
  checks (who may call what) must have a test.
- Schema: append new tables to the end of `worker/schema.sql` under a comment naming your item
  ID. New columns on existing tables also go in `worker/migrations/NNN-<name>.sql` (next free
  number) as `ALTER TABLE`, and in the `CREATE TABLE` for fresh installs.
- Officer screens: new file `src/pages/officer/<Name>.jsx`, added to `src/pages/Officer.jsx`
  with one import and one entry in the tab list (`TABS`). Officer API routes go on `hubAdmin` (see
  `worker/hub/index.js`).
- New API routers live in `worker/hub/<area>.js` and are mounted in `worker/hub/index.js`.

## Code style

- Match the existing code: small modules, a comment at the top saying what the file is for,
  comments that explain why rather than what. Validate input at every route. Return
  `{ error: 'Readable sentence.' }` with a real status code on failure.
- Reuse before writing: `src/lib/api.js`, `src/lib/useUser.js`, `src/lib/pyrunner.js`,
  `src/components/Pane.jsx` (`Pane`, `PageHead`), `useReveal()` from `src/lib/ui.js` (any page
  using `Pane` must call it or the panes stay invisible), `worker/hub/users.js`
  (`requireUser`, `currentUser`), the Durable Object in `worker/hub/room-do.js`.
- Look: the site is a dark terminal theme ("Mission Control"). Use the CSS tokens and classes
  in `src/index.css`: `var(--gold)`, `var(--dim)`, `var(--mute)`, `var(--panel)`,
  `var(--line)`, `.pn`, `.pane-h`, `.pn-b`, `.kv`, `.sec`, `.wrap`, `.btn`, `.field`, `.chips`,
  `.g`, `.d`. Append page CSS to the end of `src/index.css` under a comment with your item ID.
  No new UI libraries.
- Copy: plain, short, no em dashes, no exclamation marks, no "Let's", no emojis. Text at least
  12px. Every interactive element is keyboard reachable and labelled. Works at 390px wide.

## When you finish, report (under 250 words)

Branch name and commit hash; what you built per item ID; files touched; tests added and the
`npm test` result; anything you could not verify; any migration or setting an officer must
apply; anything you stubbed for another item.
