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

Roll back: Revert #9, #8 or #7 on their own (any order works today), or all
three, newest first, for the whole wave. No database changes.
