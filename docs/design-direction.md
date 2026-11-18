# Design direction: Mission Control v2

Written 2026-11-18 on `club-os`. This is the contract for every UI change. Read it before touching
a page. Screenshots are the test: if a page looks like "a black box with a title bar and some
text and a button", it is not done.

## Design read

A web app for teenagers at one school. It has to feel like a place with things happening in it,
not a documentation site. Black and gold, the panther, and the terminal chrome stay as the
identity. What changes is everything inside the chrome.

Dials: variance 7 (offset, asymmetric), motion 5 (one orchestrated moment per page, plus feedback
on actions), density 5 (an app, not a poster).

## Diagnosis of v1 (why it felt dull)

1. One unit everywhere: a square bordered box with a `file ... meta` title bar. Every page was a
   stack of the same box.
2. One type voice: monospace body, all-caps condensed headings, `$ eyebrow` over every title.
3. One surface: flat near-black with 1px lines. No depth, no hierarchy between "main thing" and
   "supporting thing".
4. No pictures of progress. Rank, tiers, checkpoints, attendance were all sentences.
5. Empty states were a grey sentence. A new club has mostly empty states, so most screens looked
   dead.
6. Scanline texture and a blinking cursor on every page header turned the identity into wallpaper.

## System

**Chrome is terminal; content is app.** The tab bar, command dock and status line stay square,
monospace, gold. Everything between them is a soft-surface app.

**Type (three voices, each with one job)**
- `Geist` (sans): body, UI, card titles, page titles. Sentence case. Weight 500 and 600 carry
  hierarchy.
- `JetBrains Mono`: data and machine things only: codes, numbers in tables, points, timers,
  keyboard hints, the chrome.
- `Big Shoulders Display` (condensed): rationed. One hero line or one hero number per page, and
  tier names. Never for section titles.
- No ALL-CAPS labels except tier names and the room code. No `$` eyebrows. Numbers use
  `tabular-nums`.

**Color.** One accent: gold `#FFC20E`. Semantic only: green for live/done, red for error/danger.
Tier colors stay in `src/lib/tiers.js` and appear only on tier things. Off-black warm neutrals,
no pure black. Muted text is `--mute` `#8a8570` or lighter (passes contrast); never darker.

**Surfaces (depth instead of borders).** `--bg` page, `--panel` card, `--panel2` raised, `--s3`
hovered or selected. A card is separated by surface and a faint top highlight, not a hard outline.
Hero moments get a tinted gold radial, never a neon glow. A fixed, non-interactive grain overlay
breaks flatness.

**Shape lock.** Cards 16px radius. Controls (buttons, inputs, chips) 10px. Tags 6px. Chrome stays
square. Nothing else.

**Hierarchy rule.** Every page has exactly one primary thing, drawn larger and on a raised
surface, and everything else is visibly secondary: smaller type, flatter surface, no accent.
If two things are gold, one is wrong.

**Components (use these, do not invent look-alikes).** All live in `src/components/ui.jsx` with
styles in `src/styles/system.css`.
- `Card` / `Pane`: a surface. `tone="hero"` raised with gold tint; `tone="live"` green pulse;
  default flat.
- `Stat`: big mono or condensed number with a label; counts up once.
- `Ring`: SVG progress ring with a centred value. For season points, rank progress.
- `Track`: a horizontal ladder with labelled stops and a "you are here" marker. For tiers,
  Board rungs, checkpoints.
- `Empty`: panther glyph, one plain sentence saying what goes here, one button that fills it.
  Required for every list.
- `Avatar`: rounded square (not circle), color from the seed.
- `Pill` for state (live, done, due soon). Square-ish, 6px.

**Motion.** Page entry is one stagger via `useReveal()` (already present). Numbers count up once.
Live things pulse. Buttons press (`scale(.97)`). Do not animate on hover for every card. All of
it stops under `prefers-reduced-motion`.

**Copy.** Sentence case, active voice, no exclamation marks, no em-dashes, say what the thing is.
Empty states explain how to fill them.

## Page treatments (what each page should feel like)

| Page | Primary thing | Composition |
|---|---|---|
| Today | The one next move, or the live room | Hero card left, a ring and a short week strip right, feed below as a timeline |
| Standings | Your position | Podium of three with real presence, your row pinned, tier ladder as a `Track` |
| Arena | Your next rung | A ladder per track drawn as a path with your marker, not a form |
| Meet (room, host, session) | The current block | Big stage, a progress rail of blocks, calm controls |
| Build | The current ship cycle | Cycle as a timeline with a demo-day marker, projects as a mixed grid |
| Compass | One question at a time | Single focus, large choices, progress dots, a result that shows your path |
| Officer | The queue that needs you | Tabs for sections, each with a count badge, not a 16-section scroll |
| Public (landing, about) | Why join | Image-led, one story per screen, real members' work |

## Rules for agents

1. Read this file and `src/styles/system.css`. Reuse components. New page CSS goes in
   `src/styles/<page>.css` imported by that page, never appended to `src/index.css`.
2. Do not change routes, API shapes, or labels the tests rely on. Run `npm test`.
3. Check the page empty, with data, and at 390px wide. Empty states are part of the job.
4. Before finishing, list the "AI tells" you removed (all-caps labels, eyebrows, equal card rows,
   dots, em-dashes) and confirm none were added.
5. Screenshots: at most four, viewport only, one empty state included.
