# Putting the site online

Follow these in order. Nothing here needs you to understand the code.

**What you end up with:** the leaderboard and opportunity board live at your own domain, free forever, with no "waking up" delay for students.

**What it costs:** the domain only (~$12–20/year, or free for a year through the GitHub Student Developer Pack). Cloudflare and GitHub are both free at the size this club will ever be.

---

## Before you start

You need three free accounts:

1. **GitHub** — [github.com](https://github.com) (also holds the code and runs the weekly opportunity search)
2. **Cloudflare** — [cloudflare.com](https://cloudflare.com) (runs the site and holds the database)
3. A **domain** — buy one, or get one free through the [GitHub Student Developer Pack](https://education.github.com/pack) with your school email or student ID

Neither Cloudflare nor GitHub asks for a credit card for what we're using.

> If you're buying from GoDaddy: **buy the domain only.** Skip hosting, website builder, and email add-ons — Cloudflare does all of that for free.

---

## 1. Point your domain at Cloudflare

1. Sign in to Cloudflare → **Add a domain** → type your domain → choose the **Free** plan.
2. Cloudflare shows you **two nameservers**. Copy both.
3. Go to your domain registrar (GoDaddy: **My Products → your domain → Manage DNS → Nameservers → Change → I'll use my own nameservers**).
4. Paste Cloudflare's two nameservers, save.

This takes anywhere from 15 minutes to a few hours. Cloudflare emails you when it's active. HTTPS turns on by itself afterward — you never deal with certificates.

Carry on with the next steps while you wait.

---

## 2. Put the code on GitHub

The repository already exists: [Plano-East-Computer-Science/cs-club-leaderboard](https://github.com/Plano-East-Computer-Science/cs-club-leaderboard). It is public, which is what makes GitHub Actions free.

In a terminal in the project folder:

```bash
git init && git add . && git commit -m "CS club leaderboard"
```

```bash
git remote add origin https://github.com/Plano-East-Computer-Science/cs-club-leaderboard.git
```

```bash
git branch -M main && git push -u origin main
```

> `.gitignore` already keeps `.env`, `.dev.vars`, and `node_modules` out of the repo. Your Firecrawl key will not be published. Never remove those lines.

---

## 3. Create the database

Install the tools and sign in to Cloudflare:

```bash
npm install
```

```bash
npx wrangler login
```

Create the database:

```bash
npx wrangler d1 create cs-club
```

It prints a block ending in a line like `database_id = "abc123-..."`. **Copy that id**, open `wrangler.toml`, and replace `REPLACE_WITH_ID_FROM_WRANGLER_D1_CREATE` with it. The id is not a secret — it's fine to commit.

Now create the tables and load the starting data:

```bash
npx wrangler d1 execute cs-club --remote --file worker/schema.sql
```

```bash
npx wrangler d1 execute cs-club --remote --file worker/seed.sql
```

That's the 8 badges, 10 demo members, and ~30 verified opportunities.

---

## 4. Set your passwords

Five secrets. Run each command, then type the value when it asks.

```bash
npx wrangler secret put ADMIN_PASSWORD
```
The admin panel password. Make it long. Anyone with it can change points.

```bash
npx wrangler secret put SESSION_SECRET
```
Any long random string — mash the keyboard. It signs the login cookie.

```bash
npx wrangler secret put INGEST_TOKEN
```
Another long random string. **Save this one** — you paste it into GitHub in step 6.

```bash
npx wrangler secret put GOOGLE_CLIENT_SECRET
```
From the Google OAuth client in step 4b. Without it, nobody can sign in.

```bash
npx wrangler secret put RESEND_API_KEY
```
From resend.com. Without it, the weekly email is simply never sent — nothing else breaks.

Secrets live on Cloudflare, never in the code, and are never sent to browsers.

---

## 4b. Turn on school sign-in

The standings, profiles, opportunity board, calendar and puzzles are visible
only to people signed in with a district `@mypisd.net` Google account. That is
deliberate: those pages name real students, most of them minors, and until now
they were readable by anyone on the internet. Join, About, Curriculum,
Competitions and Cyber stay public, because they are how someone finds the club
in the first place.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a project (any name).
2. **APIs & Services → OAuth consent screen.** User type **External**, fill in the club name and your email.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
4. Under **Authorized redirect URIs**, add both:
   - `https://peshcompsci.org/api/auth/callback`
   - `http://localhost:8787/api/auth/callback`
5. It gives you a **Client ID** and a **Client secret**.
6. The Client ID is not a secret — put it in `wrangler.toml` under `[vars]`:
   ```toml
   GOOGLE_CLIENT_ID = "1234567890-abcdef.apps.googleusercontent.com"
   ```
7. The Client secret **is** a secret — `npx wrangler secret put GOOGLE_CLIENT_SECRET` (step 4).

The domain check happens on the server, against the `hd` claim inside Google's
signed token. Nothing the browser sends decides who gets in, so there is no way
to fake a district address by editing a form field.

**Add the columns the sign-in needs**, once per database:

```bash
npx wrangler d1 execute cs-club --remote --file worker/migrations/001-members-and-potw.sql
```

Take a backup from the admin panel first. Running it twice is harmless — it
errors with "duplicate column name", which just means it already ran.

---

## 4c. The weekly email

Members add a **personal** email address on their account page and tick the box.
Club mail never goes to `@mypisd.net` addresses: the district filters external
senders, so it would vanish silently.

1. Sign up at [resend.com](https://resend.com/) (free tier: 3,000 messages a month; the club needs about 90).
2. Add `peshcompsci.org` as a domain and paste the DNS records it gives you into Cloudflare.
3. Create an API key with **Sending access** only, and set it with `wrangler secret put RESEND_API_KEY` (step 4).
4. In `wrangler.toml`, set the sender under `[vars]`:
   ```toml
   MAIL_FROM = "CS Club <club@peshcompsci.org>"
   ```

It sends every Monday morning by itself (the `[triggers]` cron in
`wrangler.toml`), and only when something actually happened since the last one.
**Admin → Sign-ins → Preview** shows exactly what would go out.

---

## 5. Deploy

```bash
npm run deploy
```

This builds the site and pushes it to Cloudflare. You get a `*.workers.dev` URL — open it and check the leaderboard loads.

### Attach your domain

In the Cloudflare dashboard: **Workers & Pages → cs-club-leaderboard → Settings → Domains & Routes → Add → Custom domain**, and enter your domain (e.g. `planoeastcs.org`).

Cloudflare handles DNS and HTTPS itself. Give it a minute, then visit your domain.

**Your site is live.** Redeploy any time with `npm run deploy`.

---

## 6. Turn on the weekly opportunity search

In your GitHub repo → **Settings → Secrets and variables → Actions**:

Under the **Variables** tab, **New repository variable**:

| Name | Value |
|---|---|
| `SITE_URL` | `https://your-domain.org` (no trailing slash) |

Under the **Secrets** tab, **New repository secret**:

| Name | Value |
|---|---|
| `INGEST_TOKEN` | the same value from step 4 |
| `FIRECRAWL_API_KEY` | your Firecrawl key (optional — skip it and the free sources still work) |

It now runs every Sunday. To run it immediately: **Actions → Scrape opportunities → Run workflow**.

The admin panel's Pending tab already links straight to this workflow.

---

## 7. First things to do on the live site

1. Go to `your-domain.org/admin` and sign in with `ADMIN_PASSWORD`.
2. **Backup → Download backup file.** Do this before anything else, and monthly after. It's your only real insurance.
3. **Members** → delete the ten demo members (Ava Chen, Marcus Webb, and the rest) and add your real club.
4. **Page text** → set the club name, meeting times, Discord link, and officer list.
5. Give students the plain domain. Keep `/admin` and the password to officers.

---

## Changing things later

| I want to… | Do this |
|---|---|
| Change points, members, opportunities, or text | The admin panel. No deploy needed. |
| Change the code or design | Edit, then `npm run deploy` |
| Change the seeded opportunity list | Edit `shared/seed-data.js`, run `npm run build:seed`, then load it with the `db:seed` command from step 3 |
| Change the points needed for each tier | Edit `src/lib/tiers.js`, then `npm run deploy` |
| See who has signed in, or link them to a roster student | Admin → Sign-ins |
| See or send the weekly email early | Admin → Sign-ins → Preview / Send now |
| Set this week's Problem of the Week | Admin → Puzzles → Make current |
| Check nothing is broken | `npm test` |

## Working on it locally

```bash
npm run dev
```

Opens at `http://localhost:8787` against a local copy of the database, so you can experiment without touching the live site. Passwords for local use are in `.dev.vars`.

First time only, create the local database:

```bash
npx wrangler d1 execute cs-club --local --file worker/schema.sql
```

```bash
npx wrangler d1 execute cs-club --local --file worker/seed.sql
```

```bash
npx wrangler d1 execute cs-club --local --file worker/migrations/001-members-and-potw.sql
```

Locally you usually have no Google OAuth client, so the sign-in page offers a
local-only form instead. It works only because `DEV_LOGIN_SECRET` is set in
`.dev.vars`; that variable is never set in production, and without it the
endpoint behind the form returns 404.

---

## If something goes wrong

**"Not signed in" straight after logging in** — the cookie needs HTTPS. Use the real domain, not an IP address.

**Sign-in bounces back with `?error=domain`** — the Google account used is not on `mypisd.net`. Personal Gmail accounts cannot get in; that is the point.

**Sign-in bounces with `?error=unconfigured`** — `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing. See step 4b.

**A student subscribed to the deadline calendar and it stopped working** — that feed URL carries their personal key (`?key=…`), because a calendar app cannot send a login cookie. Their current URL is on the Calendar page.

**The site loads but the leaderboard is empty** — the database exists but has no data. Re-run the two commands in step 3.

**A deploy fails saying the database isn't found** — `database_id` in `wrangler.toml` doesn't match. Run `npx wrangler d1 list` and copy the right one.

**The weekly search never runs** — GitHub disables scheduled workflows in repos with no activity for 60 days. Open the Actions tab and press **Run workflow** to wake it up.

**You lost data** — Admin → Backup → restore your most recent downloaded file.
