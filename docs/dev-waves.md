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
