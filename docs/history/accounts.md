# History: Accounts and profiles

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/accounts.md).

## Accounts and profiles (Oct 4, 2026)

- **Guest by default.** The first visit makes a guest account with a session cookie (`hc_session`, HttpOnly, 365 days). Nobody has to sign in to play, and guests still get a profile with stats.
- **Two ways to sign in: Google, and a 6-digit code sent by email (Resend).** These are the two options Eric asked for, and there are no passwords to store. A code works for 10 minutes and only once, allows 5 tries, needs 30 s between resends and is limited to 5 sends an hour per address. Codes and session tokens are stored hashed (SHA-256).
- **Signing in keeps what you played as a guest.** If the Google account or email is new, it is attached to your current account. If it already belongs to an account, you switch to that account, your guest results move over to it and the empty guest account is deleted.
- **Sign-in buttons appear only once the secrets are set.** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` turn Google on and `RESEND_API_KEY` turns email on. `/api/auth/config` tells the app what is available, so nothing breaks before Eric finishes the setup.
- **The database schema is made at runtime** (`CREATE TABLE IF NOT EXISTS`, once per Worker instance). Workers Builds runs `wrangler deploy` and doesn't apply D1 migrations, so this way no extra deploy step is needed.
- **Who records results.** The server records online matches when a lobby reaches results, for every player connected with an account. The browser posts solo matches against bots, since no server sees them. Solo results are marked `online = 0`, so ranked can ignore them later.
- **Stats** are shown for All, Classic and Crowd: matches, wins, final four, average placement and best placement, plus team wins in Crowd. A Crowd team win goes on your record, not your score, as decided earlier.
- **Google's ID token is read without checking its signature.** It comes straight from Google's token endpoint over TLS in exchange for our client secret. We still check `aud`, and we use the email only when Google marks it verified.

## Sign-in secrets in the Secrets Store (Oct 4, 2026)

Eric put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY` in the account Secrets Store (store `c4aab92a84ec4217acd83a530a799d80`), not in the Worker's own secrets. I bound them in `wrangler.jsonc` (`secrets_store_secrets`) instead of asking him to redo it, since the store keeps them in one place for the whole account. `withSecrets()` reads each one as a plain string whether it comes from the store (`.get()`, cached for 5 minutes) or is a Worker secret, so either setup works. `keep_vars` is also on, so variables set in the dashboard survive deploys.
