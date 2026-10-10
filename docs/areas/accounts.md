# Accounts and sign-in

Lane: `hub`. What a profile shows is on [hub.md](hub.md).

## How it works today

- **Guest by default.** The first visit makes a guest account with a session cookie (`hc_session`, HttpOnly, 365
  days). Guests get a profile and stats too.
- **Two ways to sign in:** Google, and a 6-digit code sent by email (Resend). No passwords. A code works for 10 minutes
  and once, allows 5 tries, needs 30 s between resends and 5 sends an hour per address. Codes and session tokens are
  stored hashed (SHA-256). Google's ID token comes straight from Google's token endpoint over TLS; `aud` is checked and
  the email used only when Google marks it verified.
- **Signing in keeps what you played as a guest.** A new identity attaches to your current account; one that already
  belongs to an account switches you to it, moves your guest results over and deletes the empty guest.
- **Sign-in buttons appear only once their secrets are set** (`/api/auth/config`): `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` for Google, `RESEND_API_KEY` for email. They live in the account's Secrets Store (bound in
  `wrangler.jsonc`, `secrets_store_secrets`); `withSecrets()` reads them from the store or as Worker secrets.
- **The database** is Cloudflare D1. The schema is made at runtime (`CREATE TABLE IF NOT EXISTS`, once per Worker
  instance; later columns by `ALTER TABLE` migrations that tolerate re-runs), so a deploy needs no migration step.
- **Results.** The server records online matches when a lobby reaches results, for every connected player with an
  account (`results.ranked` says whether it counts for ranking). The browser posts solo matches (`online = 0`).
- **Admins** are the emails in `ADMIN_EMAILS` (a Worker variable or secret, never in the repo): the fair-play review
  page and the boss battle's "Trigger ultimate (testing)" button.
- **Bans** (from [fairplay.md](fairplay.md)) stop online play; solo stays open.

## Where the code is

| What | Where |
| --- | --- |
| Accounts, sessions, identities, profiles, results (D1, behind a tiny SQL interface) | `packages/server/src/accounts.ts` |
| The account API (`/api/me`, `/api/auth/*`, `/api/profile/*`, `/api/results`, …) | `packages/server/src/api.ts`, routed from `index.ts` |
| App side: your account, signing in | `packages/app/src/account.ts`, `components/SignIn.tsx` |
| Fair play's tables (made with the rest of the schema) | `packages/server/src/fairplay-schema.ts` |

## Settings

Worker variables and secrets (see `DEPLOY.md`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`,
`EMAIL_FROM`, `ADMIN_EMAILS`; the D1 binding `DB`. Rate limits on the API: `CAPACITY.rateLimits`.

## Tests

- Unit: `packages/server/test/accounts.test.ts` (an in-memory SQLite, `memory-db.ts`).
- e2e: `e2e/account.spec.ts`, `profile.spec.ts`.

## Rules for this area

- Secrets never in the repo or in output; Eric does sign-ups and purchases.
- A profile others can see never shows an email, a sign-in method or anything not on the approved list.
