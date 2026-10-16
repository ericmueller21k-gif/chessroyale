# Delete my account and download my data (Oct 15, 2026)

Launch readiness: a player can download everything the game keeps about their account, and delete the account, from
Settings, without emailing anyone. Built in `packages/server/src/account-data.ts` (the server) and
`packages/app/src/components/AccountData.tsx` (Settings → ACCOUNT). The privacy policy's "Your rights" and "Deleting
your account" sections say what follows here. An independent review of the first version (stored data and sign-in)
found the gaps fixed below: the guard, two policy claims, atomicity, reviews, the origin check and the reads at a
match's end.

## Every table accounted for

`ACCOUNT_STORES` has one entry per store that keeps something about a player: its part of the download, and the
statements that delete it. `NO_ACCOUNT_DATA` lists every other table with why it holds nothing about anyone:
`live_lobbies`, `queue_waits`, `fairplay_budget`, `engine_usage`, `meta`.

**The guard is two tests:**
- **An allow-list.** It collects every table in the schema, plus every `CREATE TABLE` anywhere in the server's code,
  in any folder and any case (`engine_usage` is made outside the schema). It fails on any table in neither list.
- **Every table's columns, pinned.** `SCHEMA_COLUMNS` in the test lists each one. Any schema change, a new table or a
  new column from a `COLUMNS` migration, fails it until someone checks the change against the two lists (and, for
  `results`, the kept columns) and updates it.

This makes forgetting unlikely, not impossible. A store's erase can still be wrong. The no-row-mentions-the-account
test catches that only for columns `world()` fills. The Durable Objects' own SQLite storage is outside the guard:
lobbies, Squads lobbies and parties hold account ids only while a match or party runs, and the live hub holds the
global chat (covered by `forgetAccount`).

The first version only looked for account columns by name. It would have missed `ops_errors` (#227), whose `sample`
JSON holds the account id.

## What deleting removes, and what it keeps

**Removed:**
- the account row (name, icon, email, Google id, dates, rating, the friends settings);
- every session, so the account is signed out on every device;
- the sign-in code's record;
- the shop and the locker: coins, crates, items, equipped items, quick-chat picks;
- reports the player made and reports about them;
- friends, requests, blocks, invites and the caps' counts, on both sides (`socialDeletes`, the statements
  `deleteSocial` runs);
- bug reports the player sent (`ops_reports` with their account), and the account id inside error records' samples
  (`ops_errors`: the count stays);
- fair play's judged moves, match summaries and appeals;
- for an account that isn't banned or in review, all of fair play: its case, log, identities and device markers;
- in the live hub: the account's "online" and "in a match" status, its pending news, and its lines in the global chat
  (their drawn icons go with them).

**Kept, and why:**
- **Results, without the player.** The rows are written again under the account id `deleted` (`DELETED_ID`), shared
  by every deleted account, with new ids, in random order, and the old rows are deleted. They lose their lobby code,
  rating, best move and eval-bar flag, and `played_at` is rounded down to the start of its UTC day. So:
  - the game's own numbers (how often each boss wins, typical placements) stay right;
  - a row can't be tied to a name from the database alone;
  - but a deleted row still leaves a gap among its match's rows (a missing id and placement, with the new block
    landing just after), which someone with database access who saw that match's standings could use. One player's
    rows sit together as one block of new ids. We don't claim more than this: the policy says the results are kept
    without the account, name, match code or exact time.

  Why each step:
  - a lobby saves its players one after another, so an old id sat between rows of the same match, which keep their
    lobby code and exact time;
  - with the exact time, mode and size, a row could have been matched against the others from its lobby (written
    within milliseconds);
  - the rating could have chained one player's rows together.

  Nothing in the code aggregates results across players today. Boss win rates will read `boss_id`, `boss_elo` and
  `team_won`, which stay.
- **Fair play's file, if the account is banned or in review.** Its case, log, the hashed email or Google id
  (`fairplay_identities`) and the device markers stay, under the deleted account's random id, and the log gets an
  "account deleted" line. So deleting never gets around fair play:
  - a new account signed in with the same email or Google account is banned again (a ban), or goes back to review (a
    review: `banCheck` reads the identity's case);
  - a new account on a banned account's device goes to review, as before.

  The id is the account's own random one, not a hash of it: with the account gone, it points at nothing. The review
  page lists such a case as "Deleted player", and a person can still decide it. The automated reviewer can't (409,
  as with banned cases): a deleted account's case has no evidence left to weigh, and a "clear" or "watch" would
  forget its identities. Lifting a ban, or deciding a review any way but a ban, forgets the identities. The download never says whether
  the account is in review: results are exported without `held`, and the policy and the confirmation speak of fair
  play "looking into" an account in general terms only.
- **A match or a Squads party being played** keeps the player's name on its screens until it closes (a match at most
  `LOBBY_LIFE.lobbyResultsKeepMinutes` after it ends; their storage is deleted then).
  - Why not reach into it: no index says which lobby or party an account is in, and the name goes with it minutes
    later.
  - Nothing is recorded for them: `recordResult` and `grantReward` write only `WHERE EXISTS` the account, in the same
    statement (no extra read at a match's end), and `recordFairPlay` stops at the read of the account it already made.

**All in one transaction.** The statements (about 30) are built first: the case and the hashed identities are read
before. They then run as one batch, `Sql.batch`: D1's `batch()`, a transaction; `BEGIN`/`COMMIT` in the in-memory test
database. So:
- a deletion never stops halfway: no orphan session, no half-deleted account;
- a write that lands just before it is deleted with the rest;
- after it, a lobby's results, a reward and fair play's recording find no account and write nothing (they check in the
  same statement, or at the read they already make).

A few other actions that checked the account a moment before the batch can still write just after it (below).

**Backups.** Cloudflare keeps restore points of the database for up to 30 days (D1 Time Travel; Durable Object
storage has the same window), so deleted data is gone from those 30 days after it's deleted. The policy says so:
"Our database host keeps restore points for up to 30 days; after that, what you deleted is gone from them too."

**On the device,** the app forgets everything it keeps (`brc.*` and `hunchess-*` in local storage, settings
included) and starts afresh, as a new visitor. The response clears the session cookie. The fair-play device marker
cookie stays: for an account fair play hasn't acted on it points at nothing any more, and for one it has it's what
keeps the ban or review working.

**Only from the game's own page.** POST `/api/me/delete` needs:
- the request's `Origin` to be the site's own, as the admin pages' posts do;
- a JSON content type, which a form can't send;
- the body `{"confirm":"delete"}`.

So a request from another site, or a same-site neighbor (`www`, another workers.dev app), can't delete an account,
with or without the SameSite=Lax cookie.

## The download

- **GET /api/me/data** answers a JSON file, `hunchess-data-YYYY-MM-DD.json`. Settings → "Download my data" is a plain
  link to it.
- **It holds:**
  - every column of the account row (`SELECT *`, so a column added later appears without a change here);
  - the sessions' dates (never their hashes);
  - the latest sign-in code's record (never the code's hash);
  - results (every column but `held`);
  - shop, locker and reports made;
  - friends, requests sent and received, blocks made, invites sent and received, and the caps' counts;
  - bug reports sent, and error records with the account in their sample;
  - the player's fair-play standing and appeals;
  - from the live hub, their lines in the global chat.
- **Times are written as dates (UTC).**
- **Left out, and why:**
  - **Who has blocked the player:** the app never shows it either.
  - **Fair play's detection records** (judged moves, match scores, case notes, reports about the player, device
    markers): they'd show how cheating is found. The file says to email for them, and a person answers.
  - **A lawyer's call:** whether to send that part on request, or only a summary of it. It's the same retention
    decision the privacy policy's draft notice lists.
- **When the live hub can't be reached,** the download goes without its global chat lines, and the deletion without
  forgetting them. Each failure is logged (`console.error`) for the error capture, rather than failing the whole
  request.

## Two privacy fixes on the way

- **Sign-in code records go an hour after their code was sent.** They used to stay forever, one per email address,
  even for addresses that never made an account. After an hour the code has expired and its hour's send count has
  reset, so nothing is lost.
  - They're cleared by the Worker's 15-minute schedule (`purgeEmailCodes`, before the deep re-check, which skips
    itself without an engine server). So none stays much past the hour, and the policy says "about an hour".
  - The first version cleared them only when someone asked for a code, so with no new requests they'd have stayed.
- **A new account is called "Player"** until its owner picks a name.
  - A brand-new account made at sign-in took its name from the Google account (a real name) or the email before the @
    (often a real name), and everyone sees a profile's name.
  - A guest who signs in keeps their guest name, as before.

## Known gaps, and follow-ups

- **Admins' emails in other players' records.** An admin's email in another player's fair-play log (`by`) or case
  (`decided_by`) stays when that admin deletes their own account. It's the record of who decided, kept with the other
  player's case. No change.
- **One owner per identity.** `fairplay_identities`' key is the identity itself, so an identity has one row. When a
  second account with a banned identity is banned too, its row takes over (`setCase`). If that second ban is later
  lifted, the identity is free again, though the first (deleted) account's ban still stands.
  - Deleting a banned account never takes over an older row (`INSERT OR IGNORE`).
  - A key with the account in it would close this. It's fair play's schema, so it's left to that lane.
- **An error counted in memory** before the deletion (ops' per-instance batching) can still be written with the
  account's id after it. It expires with the rest (`OPS.store.keepDays`, 30 days). Accepted.
- **A bug report from the player's other device, just after deleting.** The problems endpoint (#227) takes the
  account from `cachedUserId`. That cache lasts up to 10 minutes per Worker instance, and `forgetToken` clears only
  the instance that ran the deletion. A bug report sent from another device in that window is stored with the
  deleted id, and expires in 30 days. Accepted.
- **Check-then-write windows.** An action that checked the account just before the batch, and writes just after it,
  can leave a row that points at nothing:
  - fair play's later insert and `actOn`, for a match finishing at that very moment;
  - a report and its `raiseCase`;
  - a friend action;
  - a shop or locker write mid-request.

  Such a row holds the random id and what that action writes: a late fair-play insert keeps the match's summary and
  score; a late shop or locker write keeps item ids; a report keeps its reason and match code. No sweep job for them;
  they're rare and point at no account.
- **Follow-up, not this PR:** a guest signing in to an existing account (`signInWithIdentity`) deletes the guest's
  account row but leaves its reports and fair-play rows under the guest's id. They point at nothing; they should move
  to the account or go with the guest.
- **Chat moderation** is paused and not on main. When it lands, its tables need entries:
  - the player's own reports: deleted;
  - a chat ban: kept with a hashed id only if it must outlive the account, as fair play's are.

  The allow-list test will insist.

## Testing

**Full lane** (stored data, sign-in, privacy). GitHub's e2e run is the gate.

**Unit:** `packages/server/test/account-data.test.ts`:
- every table's columns are as pinned;
- every table, in the schema or created anywhere in the server, is in a store or `NO_ACCOUNT_DATA`;
- the download has every store's rows, readable (results without `held`; the ops rows with the account), with nothing
  of anyone else's, and leaves out who has blocked the player;
- deleting leaves no row anywhere that mentions the account or its email, in any column or inside JSON. It signs out
  both devices, keeps the results as nobody's under new ids after every older row (the day only, no lobby, rating,
  best move or eval bar), removes the
  friendships from the other side, and keeps error counts and anonymous ideas;
- signing in again with the same email makes a new, empty account;
- a statement that fails rolls the whole deletion back, and every write goes through the batch;
- a result, a reward or a fair-play record after the deletion records nothing;
- a ban is kept (case, log, identity, device marker), catches a new account by email and by device, and an admin can
  list it and lift it;
- a review is kept: a new account with the same email goes to review, without piling up notes. The automated
  reviewer can't decide it (409), and a person clearing it frees the identity;
- an identity shared by two deleted bans stays banned;
- sign-in code records go after an hour (the schedule's purge);
- the API:
  - the file;
  - no deletion without the site's own origin, without JSON, or without the confirmation;
  - the cookie cleared and the hub told;
  - the old session refused, and the profile gone;
- the global chat and the live board forget the account.

`accounts.test.ts`: a new account is "Player".

**e2e:** `e2e/account-delete.spec.ts`:
- a guest with a name, a solo result, a crate item and a setting downloads the file (its keys and rows);
- "Keep it" keeps the account;
- "Delete my account" starts the app afresh with the setting forgotten;
- the old session cookie on another device is a new visitor, and the profile is a 404;
- the local D1 has no row naming the account, and the result is under `deleted` with no lobby code.
