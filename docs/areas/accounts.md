# Accounts and sign-in

Lane: `hub`. What a profile shows is on [hub.md](hub.md).

## How it works today

- **Guest by default.** The first visit makes a guest account with a session cookie (`hc_session`, HttpOnly, 365
  days). Guests get a profile and stats too.
- **Two ways to sign in:** Google, and a 6-digit code sent by email (Resend). No passwords. A code works for 10 minutes
  and once, allows 5 tries, needs 30 s between resends and 5 sends an hour per address. One statement counts a try and
  uses a right code up, so checks at once can't share a code or get extra tries. Codes and session tokens are stored
  hashed (SHA-256). Google's ID token comes straight from Google's token endpoint over TLS; `aud` is checked and the
  email used only when Google marks it verified.
- **Signing in keeps what you played as a guest.** A new identity attaches to your current account; one that already
  belongs to an account switches you to it, moves your guest results, items, coins and crates over and deletes the
  empty guest. The coins and crates move in one transaction, so two sign-ins at once move them once
  (`sign-in-races.test.ts`; [docs/decisions/2026-10-16-sign-in-races.md](../decisions/2026-10-16-sign-in-races.md)).
- **Sign-in buttons appear only once their secrets are set** (`/api/auth/config`): `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` for Google, `RESEND_API_KEY` for email. They live in the account's Secrets Store (bound in
  `wrangler.jsonc`, `secrets_store_secrets`); `withSecrets()` reads them from the store or as Worker secrets.
- **The database** is Cloudflare D1. The schema is made at runtime (`CREATE TABLE IF NOT EXISTS`, once per Worker
  instance; later columns by `ALTER TABLE` migrations that tolerate re-runs), so a deploy needs no migration step.
- **Results.** The server records online matches when a lobby reaches results, for every connected player with an
  account (`results.ranked` says whether it counts for ranking). The browser posts solo matches (`online = 0`). Each
  result keeps whether its player had the eval bar on (`results.eval_bar`, NULL from older apps; see [hub.md](hub.md)).
- **Squads' placements** (unranked): a result with mode "squads" (placement 1, 2, 3 or 5 of 8 squads) and its reward:
  coins into `wallets.coins`, crates counted in `wallets.crates` (for when crates stop being free), both carried over
  when a guest signs in (`grantReward`).
- **Admins** are the emails in `ADMIN_EMAILS` (a Worker variable or secret, never in the repo): the fair-play review
  page, the boss battle's "Trigger ultimate (testing)" button, and the test switches in the address (`?debug`,
  `?rounds=`, …; [ops.md](ops.md), "Test switches").
- **Bans** (from [fairplay.md](fairplay.md)) stop online play; solo stays open.
- **Download my data and Delete account** (Settings → ACCOUNT, for guests too;
  [docs/decisions/2026-10-15-delete-my-account-and-download-my-data.md](../decisions/2026-10-15-delete-my-account-and-download-my-data.md)):
  - **The download:** GET `/api/me/data` answers a JSON file of everything kept about the account (every store's rows,
    the global chat's lines from the live hub). It leaves out who has blocked them and fair play's detection records
    (on request, by email).
  - **Deleting:** POST `/api/me/delete` `{confirm: "delete"}`, from the site's own origin, as JSON, after the app's
    confirmation. It removes everything personal in every store, in one batch (one transaction), and signs the
    account out on every device. The live hub forgets it (online, global chat lines). The app clears its local
    storage and starts afresh.
  - **What stays:**
    - results, written again under the shared account id `deleted` with new ids, only their day, and without their
      lobby code, rating, best move or eval-bar flag;
    - fair play's file if banned or in review (case, log, hashed identities, device markers, under the old id, shown
      on the review page as "Deleted player"). A new account with the identity is banned again, or goes to review.
  - **A lobby or a reward that finishes later** records nothing for a deleted account: its writes say `WHERE EXISTS`
    the account.
  - **Every table is accounted for:** each is in a store in `ACCOUNT_STORES` (`account-data.ts`) or listed in
    `NO_ACCOUNT_DATA`. `account-data.test.ts` fails on a table in neither, from the schema or any `CREATE TABLE` in
    the server. It also pins every table's columns (`SCHEMA_COLUMNS`), so any schema change means checking the two
    lists first.
- **Sign-in code records** go an hour after their code was sent (the Worker's 15-minute schedule, `purgeEmailCodes`). A new account is called "Player" until its owner picks
  a name (never a Google name or the start of an email).
- **The privacy policy, terms and copyright page** (`/privacy`, `/terms`, `/copyright`, `screens/Legal.tsx`) are drafts
  written from the code, with the decisions still to make at the top. They list every kind of personal data the game keeps, why and for how long:
  a PR that stores something new, or keeps it for a different time, changes the policy in the same PR. Linked from the
  landing page's footer, Settings and the FAQ.
- **Friends and invites** (Oct 15; [docs/decisions/2026-10-15-friends-and-invites.md](../decisions/2026-10-15-friends-and-invites.md)): signed-in accounts only where signing in is
  set up. Add a friend from their profile (any name opens it); they accept or decline. Invite anyone to your private
  lobby or Squads party, as their setting allows (everyone, the default; friends only; no one); an invite lasts
  `FRIENDS.inviteMinutes`. Block ends a friendship and keeps the other's requests (kept unseen), invites (refused with
  the same words as a setting) and chat lines (hidden in the app) away. "Show when I'm online" off hides online and
  last seen on your profile and in friends' lists, for everyone, and others get only the day of your recent matches. Not while banned (requests and invites). Switched off
  for everyone by the Worker variable `PAUSE_FRIENDS` ("1"). The screens are on [hub.md](hub.md).

## Data stored by friends (for the privacy page and account deletion)

Every row is about two accounts; `deleteSocial(sql, userId)` (`friends.ts`) deletes an account's rows on both sides.
A guest's merge into the account it signs in to calls it, and so does deleting an account (`account-data.ts`, whose
download has the account's own rows: friends, requests sent and received, blocks made, invites, the caps' counts). The privacy
policy's "Friends" entry (`screens/Legal.tsx`) says the same in plain words.

| Table / column | What | Kept |
| --- | --- | --- |
| `friends` (user_id, friend_id, since) | A friendship, one row per side | Until either removes it, blocks, or deletes their account |
| `friend_requests` (from_id, to_id, at) | A request waiting for an answer | Until answered or taken back; unanswered, `FRIENDS.requestDays` (30) |
| `blocks` (user_id, blocked_id, at) | Who you've blocked | Until you unblock (or either account is deleted) |
| `invites` (from_id, to_id, kind, code, at, expires_at) | An open invite: the lobby's mode or "squads", and its code | `FRIENDS.inviteMinutes` (10), then pruned within 10 minutes; one per pair |
| `friend_limits` (user_id, kind, window_start, n) | Requests sent today, invites sent this hour (the caps) | A day |
| `users.allow_invites` | Who may invite you: NULL everyone, "friends", "none" | With the account |
| `users.hide_online` | 1: online and last seen hidden from everyone | With the account |

Nothing else is stored: no friend codes, no search index, no chat between friends. Who's online and who's in a match
stay in the live hub's memory (never written).

## Where the code is

| What | Where |
| --- | --- |
| Accounts, sessions, identities, profiles, results (D1, behind a tiny SQL interface) | `packages/server/src/accounts.ts` |
| The account API (`/api/me`, `/api/auth/*`, `/api/profile/*`, `/api/results`, …) | `packages/server/src/api.ts`, routed from `index.ts` |
| App side: your account, signing in | `packages/app/src/account.ts`, `components/SignIn.tsx` |
| The privacy policy, terms and copyright page | `packages/app/src/screens/Legal.tsx` |
| Download my data and deleting an account: every store's part (`ACCOUNT_STORES`), the routes `/api/me/data` and `/api/me/delete` | `packages/server/src/account-data.ts`, `api.ts`; the live hub's part `live-hub.ts` (`accountData`, `forgetAccount`) |
| App side: Settings → ACCOUNT's download link and delete confirmation | `packages/app/src/components/AccountData.tsx`, `account.ts` (`deleteMyAccount`) |
| Fair play's tables (made with the rest of the schema) | `packages/server/src/fairplay-schema.ts` |
| Friends: requests, blocks, invites, settings, caps (D1); the API (`/api/friends`, its kill switch) | `packages/server/src/friends.ts`, `friends-api.ts`; shared types `packages/core/src/friends.ts` |
| App side: the friends list, actions, the invite toast, who's blocked | `packages/app/src/friends.ts`; screens on [hub.md](hub.md) |

## Settings

Worker variables and secrets (see `DEPLOY.md`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`,
`EMAIL_FROM`, `ADMIN_EMAILS`, `PAUSE_FRIENDS`; the D1 binding `DB`. Rate limits on the API: `CAPACITY.rateLimits` (its
`friends` burst limit); friends' caps and expiries: `FRIENDS`.

## Tests

- Unit: `packages/server/test/accounts.test.ts` (an in-memory SQLite, `memory-db.ts`); `account-data.test.ts` (every
  table covered, the download, deleting in every store, a kept ban, the API, the live hub's part); `friends.test.ts` (requests,
  blocks, invites and the settings, the caps, expiry, hidden status, `deleteSocial`, the API and its kill switch, the
  live board's news and "in a match"); `packages/app/test/friends.test.ts` (the list, the toast, hiding blocked chat,
  inviting from the front door).
- e2e: `e2e/account.spec.ts`, `account-delete.spec.ts` (download, the confirmation, deleting; reads the local D1),
  `profile.spec.ts`, `legal.spec.ts` (the privacy policy, terms and copyright page),
  `friends.spec.ts` (two players: request, accept, online, the invites setting, an invite joined from its toast, a
  block).

## Rules for this area

- Secrets never in the repo or in output; Eric does sign-ups and purchases.
- A profile others can see never shows an email, a sign-in method or anything not on the approved list.
- A new table goes in `ACCOUNT_STORES` (`account-data.ts`: its part of the download, and what deleting does to it)
  with its line in the privacy policy, or in `NO_ACCOUNT_DATA` with why it holds nothing about anyone, in the same PR.
