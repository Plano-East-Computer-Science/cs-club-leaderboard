# Turning on "Continue with Google"

The code is already in place. The button stays hidden until the Worker has a
`GOOGLE_CLIENT_ID`. That value is public (it ships to every browser), so it is
not a password, and no Google client secret is needed.

## 1. Make the OAuth client (Google Cloud console, about 5 minutes)

1. Open https://console.cloud.google.com and create a project, for example
   "PESH CS Club". Use a personal Google account; school accounts usually
   cannot create projects.
2. **APIs & Services → OAuth consent screen.** User type: **External**. App name
   "Plano East CS Club", support email your address, authorized domain
   `peshcompsci.org`. Scopes: leave the defaults (email, profile, openid).
   Then **Publish app** so any Google account can sign in, not only test users.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   Application type: **Web application**. Name: "club site".
4. **Authorized JavaScript origins**, add all three:
   - `https://peshcompsci.org`
   - `https://dev.peshcompsci.org`
   - `http://localhost` (only for local testing; optional)
5. Leave **Authorized redirect URIs** empty. The site uses Google's button,
   which posts a signed token back to the page; it never redirects.
6. Create, then copy the **Client ID** (ends in `.apps.googleusercontent.com`).

## 2. Dev site (dev.peshcompsci.org)

GitHub repo → **Settings → Secrets and variables → Actions → New repository
secret**. Name `DEV_GOOGLE_CLIENT_ID`, value the client ID. The next push to
`club-os` (or **Actions → Deploy dev → Run workflow**) copies it onto the dev
Worker. The button then shows on `/signin`.

## 3. Live site (peshcompsci.org), when you deploy club-os there

```
npx wrangler secret put GOOGLE_CLIENT_ID
```

Paste the same client ID. One client works for both sites because both origins
are on it.

## Checking it

`https://dev.peshcompsci.org/api/auth/config` should show the client ID instead
of `null`. On `/signin`, "Continue with Google" appears above the email form.
If the button shows but Google says "origin not allowed", the origin in step 4
is missing or has a trailing slash.
