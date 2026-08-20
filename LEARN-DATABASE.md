# How the data works (no SQL required)

You said you don't know how databases work. Good news: **you never have to touch one to run this site.** The admin panel does everything. This document explains what's happening underneath, so that when something looks odd you know where to look.

Read it once. You won't need it again until something breaks.

---

## 1. What a database actually is

A database is a set of **tables**. A table is a spreadsheet: columns across the top, one row per thing.

That's genuinely most of it. The site has six tables:

| Table | One row is… |
|---|---|
| `students` | one club member |
| `point_events` | one time someone was given points |
| `badges` | one kind of badge that exists |
| `student_badges` | one badge held by one member |
| `opportunities` | one internship, competition, program, or resource |
| `settings` | one piece of editable text on the site |

All six live in one SQLite database called **D1**, run for free by Cloudflare. SQLite normally means a single file on a disk; Cloudflare keeps and backs up that database for you instead, so there is no file for you to lose. The **Download backup** button in the admin panel is how you take your own copy.

SQL is just the language used to ask that file questions ("give me every student sorted by points"). The code asks those questions for you. You use forms.

---

## 2. The one design decision worth understanding

**Points are not stored as a number. They are stored as a list of awards.**

The naive way would be a `points` column on each student that you add to and subtract from:

```
Ava Chen | 120 points
```

This site does **not** do that. Instead every award is its own row in `point_events`:

```
Ava Chen | +60 | Won district hackathon        | Aug 12
Ava Chen | +25 | Led intro-to-Python workshop  | Aug 15
Ava Chen | +20 | USACO Silver promotion        | Aug 18
Ava Chen | +15 | Meeting attendance            | Aug 19
```

Her total, 120, is calculated by adding those up **every single time the page loads**. It is never written down anywhere.

### Why this matters to you

**You can undo any mistake.** Typed 500 instead of 50? Open the member's history in the admin panel and hit Undo on that one row. The total corrects itself instantly. With a stored total you'd have to work out the right number and hope you got it right.

**Every point is explainable.** When a student says "why does she have more than me?", their profile page already answers it — every award, with its reason and date. You never have to remember.

**The totals cannot drift.** There is no separate number that can get out of sync with reality. The list *is* the truth.

**To take points away**, award a negative number. Enter `-10` with a reason like "Correction: double-counted attendance". The history stays honest — you can see that a correction happened, which is better than the evidence quietly vanishing.

---

## 3. What each table holds

### `students`
Name, grade, and whether they're **active**. Hiding a member (active = off) takes them off the public board but keeps every point they ever earned. Use this for members who graduate — deleting them destroys their history permanently.

### `point_events`
The award log described above. Student, amount, reason, date.

### `badges` and `student_badges`
Two tables instead of one, for a specific reason: a badge is *defined* once (`badges`) and *awarded* many times (`student_badges`). If badges were stored on each student, renaming "CTF Champ" would mean editing every member who has it. This way you rename it once.

`student_badges` also refuses to store the same badge twice for the same person, so you can't accidentally double-award.

### `opportunities`
Everything on the opportunity board. Three fields drive the behavior:

- **`format`** — `online`, `local`, or `residential`.
  - `local` means a student has to drive there, so it's checked against the 15-mile limit.
  - `online` and `residential` skip that check. Residential covers national programs like MIT Beaver Works that house you — no commute from Plano, so distance is irrelevant.
- **`status`** — `live` (public) or `pending` (waiting for you). Anything found automatically arrives as `pending`. Nothing reaches the public site until you approve it.
- **`fingerprint`** — a hidden ID built from the link and title. It's how re-running a search knows it has seen a listing before, instead of adding it a second time.

### `settings`
Every editable piece of text — club name, tagline, prize description, the whole About page. Stored as text so changing a sentence never requires changing code.

---

## 4. The things that keep you safe

**Deleting a member deletes their points too.** This is deliberate (otherwise you'd accumulate orphaned rows referring to nobody), and it's why the panel asks you to confirm. If you only want them off the board, **hide** them instead.

**Backups are one click.** Admin → Backup → *Download backup file*. You get a `.json` file containing everything: members, points, badges, opportunities, page text. Restoring reads it back.

Do this **before any big change** and **once a month** otherwise. It takes five seconds and it is the difference between an inconvenience and losing a year of club records.

**Restore replaces everything.** It is not a merge. The file's contents become the site's contents. The panel confirms before doing it, and it validates the file first — a corrupt or wrong file is refused before anything is touched, rather than half-applied.

---

## 5. Where the data physically lives

On Cloudflare's servers, in a database called **D1**. You never touch it directly, and there is no file on your laptop that matters.

This is a real improvement over running it on your own computer: the site is up whether or not your laptop is, and Cloudflare is responsible for the disk not failing.

**You should still take backups.** Admin → Backup → *Download backup file* saves everything — members, points, badges, opportunities, page text — as one file on your computer. Do it before any big change and once a month otherwise.

Why bother, if Cloudflare handles the disk? Because the most likely way this club loses data is not a server dying. It is somebody deleting the wrong member, or a future officer restoring the wrong thing. A file on your own computer is the only copy nothing on the internet can reach.

---

## 6. If you ever do want to look inside

You don't need to. But if you're curious, you can run a read-only query from the project folder without breaking anything:

```bash
npx wrangler d1 execute cs-club --remote --command "SELECT name, grade FROM students"
```

**Stick to `SELECT`.** Reading is always safe. Anything that changes data belongs in the admin panel, where the confirmations and the undo buttons are.

---

## Quick reference

| I want to… | Do this |
|---|---|
| Give someone points | Admin → Award points |
| Mark attendance for the whole club | Admin → Award points → *Several at once* |
| Fix a wrong award | Admin → Members → History → Undo |
| Take points away | Award a negative number, with a reason |
| Remove a graduate from the board | Admin → Members → **Hide** (not Delete) |
| Add an opportunity by hand | Admin → Opportunities |
| Look for new opportunities | It runs itself weekly. To run it now: Admin → Pending → *Open the scraper on GitHub* |
| Publish a found opportunity | Admin → Pending → Approve |
| Change any text on the site | Admin → Page text |
| Protect against disaster | Admin → Backup → Download |
