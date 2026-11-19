# Club OS v2: design language

Companion to `docs/v2-spec.md` section 4. This is the exact target for the Wave 4 design system.
When this file and older styling in `src/index.css` disagree, this file wins.

**Design read:** a product app for high-school students (14 to 18) and the student officers who
run it, plus a public front door. The bar is a product people use daily (Linear, Raycast,
Duolingo, HackerRank), with the club's own identity: black and Plano East gold, a terminal
streak used with intent. Dials: variance 5 (app) / 7 (front door), motion 4, density 5 (app) /
3 (front door).

## Why the current site reads as "vibe coded"

- Every section opens with a `$ label` eyebrow, then a giant uppercase headline, then a paragraph.
  That rhythm on every page is the strongest AI tell. v2 rations it.
- One font (mono) for everything, so nothing has hierarchy.
- One box for everything, so nothing has a shape.
- Decoration in place of content: ASCII art, stat tiles of vanity numbers, status bar, holiday
  toggle, site map in every footer.
- No real images. No icons. No states (loading skeletons, errors, empty states) designed.

## Tokens

Dark is the brand and the default. A light theme is a later, optional wave; define every colour
as a token now so it can be added without touching components.

```
/* surfaces */
--bg:        #0b0b09;   /* page */
--s1:        #131310;   /* panel, card */
--s2:        #1b1a15;   /* raised: hover, menus, inputs sit here */
--s3:        #24221b;   /* pressed, selected */
--line:      #2e2b20;   /* hairline */
--line-2:    #45402c;   /* visible border, focus-adjacent */

/* text (all AA on --bg and --s1) */
--t1:        #efeadb;   /* primary */
--t2:        #b9b29a;   /* secondary */
--t3:        #8f8973;   /* tertiary, labels; never below 12px */

/* brand and semantic */
--gold:      #ffc20e;   /* brand, single primary action per screen */
--gold-2:    #e0a800;   /* hover/pressed */
--on-gold:   #141108;   /* text on gold */
--live:      #3ddc84;   /* happening now */
--need:      #ff7a59;   /* needs you: inbox, deadlines, errors */
--ok:        #3ddc84;
--warn:      #ffb547;

/* tracks: used on chips, icons, a 3px edge, charts. Never as large fills. */
--tr-contest:  #ffc20e;
--tr-build:    #6cb6ff;
--tr-ai:       #c49bff;
--tr-data:     #4fd1c5;
--tr-cyber:    #ff6b6b;
--tr-eng:      #7bd88f;
--tr-explore:  #b9b29a;
```

Shadows: none on cards. Menus and dialogs: `0 12px 40px rgb(0 0 0 / .45)` plus a 1px `--line-2`
border. Focus: 2px `--gold` outline, 2px offset, on every interactive element.

## Shape

One radius system, documented: **controls and cards 6px; pills and avatars fully round; the
projector 0**. Borders are 1px. Do not mix sharp and soft corners anywhere else.

## Type

Self-hosted with `@fontsource` (school wifi may block Google Fonts):

| Role | Face | Size / weight | Use |
|---|---|---|---|
| Display XL | Big Shoulders Display 800 | 64-80px, uppercase, 0.95 line | Front door headline, the prize, projector |
| Display L | Big Shoulders Display 800 | 40-48px, uppercase | One page title per page |
| Title | IBM Plex Sans 600 | 20-22px | Section titles, sentence case |
| Heading | IBM Plex Sans 600 | 16-17px | Card titles |
| Body | IBM Plex Sans 400 | 15px / 1.6 (16px on phones) | All running text, max 65ch |
| Small | IBM Plex Sans 400 | 13px | Meta, captions |
| Label | JetBrains Mono 500 | 12px, uppercase, .08em | Rationed: at most one per three sections |
| Code / numbers | JetBrains Mono | 13-15px, tabular | Code, codes, stats, timers |

Numbers that change (points, timers, ranks) use tabular figures.

## Icons

`@phosphor-icons/react`, regular weight, 18px in UI, 20px in nav. One family only. Every icon
button has a text label or `aria-label`.

## Components (`src/ui/`)

Each component ships with its loading (skeleton), empty and error states.

- **AppShell**: TopBar (64px, one line at 1024px), content max 1200px, BottomTabs on phones.
- **TopBar**: logo + wordmark, five doors with icons, Live pill, search (Ctrl+K), HQ (officers),
  avatar menu. Active door: gold text and a 2px gold underline.
- **LivePill**: green, gently pulsing dot, "Live: <room title>", one tap to the room. The only
  decorative dot allowed, because it is real state.
- **PageHeader**: Display L title, one-line subtitle (max 15 words), right-aligned actions.
  No eyebrow by default.
- **Tabs**: underline tabs inside a door (Practice: Ladder, Daily, Races, CTF, Data, Quant).
- **Card**: `--s1`, 1px `--line`, 6px radius, 16-20px padding. Interactive cards lift to `--s2`
  on hover. Use cards only when the thing is an object (a problem, a project, an opportunity).
  Group everything else with spacing and hairlines.
- **ProblemCard**: title, track chip, difficulty as five small segments (no track background),
  solved-by count, your status icon.
- **ProjectCard**: real screenshot or the repo's social image (16:10), title, one line, people.
- **OpportunityCard**: deadline first ("Closes Dec 12, in 24 days"), org logo when available,
  title, tags, save (bookmark icon).
- **MeetingCard**: day and time large, place, title, kind icon, speaker if any, "I'm coming".
- **PersonRow**: avatar initials on a track-tinted circle, name, one stat.
- **Stat**: number in mono tabular, label below. Only where the number changes what you do.
- **EmptyState**: icon, one sentence, one button.
- **Button**: primary (gold, one per screen), secondary (`--s2` + `--line-2` border), ghost
  (text only, underline on hover), danger (`--need` border). 36px tall, 44px on touch.
- **Field**: label above, `--s2` fill, 1px `--line-2`, 16px text on phones (no iOS zoom),
  helper and error below.
- **Dialog, Menu, Popover, Tooltip**: Radix primitives styled with the tokens.
- **Toast**: bottom-right, 4 seconds, for confirmations ("Saved", "+20 points").
- **Skeleton**: shapes of the real content, a slow shimmer, off under reduced motion.

## Copy

- Sentence case everywhere except Display type.
- Page subtitles under 15 words. No paragraph above the first action.
- Rules and explanations live behind "How this works" (a popover or a side sheet).
- Numbers and names are real; never invent stats for decoration.
- No em dashes, no exclamation marks, no emojis, no "Let's", no "Unleash/Elevate/Seamless".

## Imagery

The front door needs real photos of the club (a meeting, a duel night, a demo). Until the lead
sends them, use real product screenshots of the app itself and real member project images, and
leave clearly marked image slots. No illustrations, no fake UI made of divs, no stock photos.

## Motion

150 to 250ms, ease-out `cubic-bezier(.2,.8,.2,1)`. Motivated only: page enter (fade 8px up),
list stagger on first load, button press (scale .98), toast in/out, points counting up on gain,
Live pulse. All of it off under `prefers-reduced-motion`.

## Terminal flavour, kept

- Command palette on Ctrl+K and "/" with `open`, `join`, `daily`, `rank` and search.
- One mono label per page at most, where it earns it (for example the room code).
- The boot screen once per session on first visit, skippable, off under reduced motion.
- Removed: `$` before every heading, the status bar, the holiday toggle in the bar, the site map
  in every footer, ASCII art on content pages.
