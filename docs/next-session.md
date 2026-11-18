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

State when this prompt was written (2026-11-17, late):
- Merged on `club-os`, all tests passing: A1, A2, A3 (identity, ledger, claims), A7 (officer
  accounts), C2 (problem bank), C3 (daily problem), C1 and C5 (Arena board), B2 and B9 (duels,
  pair maker), F1, F2, E1 (Today, feed with kudos, compass), C4 and D3 (Codeforces and GitHub
  sync), E3, F4, F5, F6, G3 (feeds, Discord ping, command bar, installable app, announce).
- Unfinished work lives in agent worktrees under `.claude/worktrees/`. Check each with
  `git -C <worktree> status` and `git log club-os..<branch>`:
  - `agent-a2c5b8b008181870e`: A4, A5, A6 standings, ranks, squads (2 commits; was fixing a
    blank page when signed in).
  - `agent-a10013b7d81188662`: B1, B3, B4, B6, B7, B8, B10 meeting run-of-show (backend done,
    frontend in progress, uncommitted).
  - `agent-a82c19df08521d3c5`: G5, E7 safety, privacy, security review (uncommitted).
  - `agent-a7410d4fb89e643ab`: D1, D4, D7 ship cycles, teammate board (1 commit, nearly done).
  - `agent-adee97866d2f27cd7`: E2, E4, G2 competition pages, analytics (uncommitted, was taking
    screenshots).
  - `agent-a01c04061b2407ad7`: D2, H2 workspace (just started, uncommitted).
  If the previous session already merged some of these, `git log club-os` will show it; skip those.

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
