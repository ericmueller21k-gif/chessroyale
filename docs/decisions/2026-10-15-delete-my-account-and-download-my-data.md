# Delete my account and download my data (Oct 15, 2026)

Launch readiness: a player can download everything the game keeps about their account, and delete the account, from
Settings, without emailing anyone. Built in `packages/server/src/account-data.ts` (the server) and
`packages/app/src/components/AccountData.tsx` (Settings → ACCOUNT). The privacy policy's "Your rights" and new
"Deleting your account" sections say exactly what follows here.

## One list of every store

`ACCOUNT_STORES` has one entry per store that keeps something about a player: its part of the download and what
deleting the account does to it. The account itself (`users`) and its sessions are handled after the stores. A unit
test reads every table in the schema and fails if one has an account column (`user_id`, `reporter`, `target`,
`from_id`, `to_id`, `friend_id`, `blocked_id`, `account`) and no entry. So a new table can't be forgotten: the PR that
adds it adds its entry, or its CI is red. Friends (#230) is covered through `deleteSocial`.

## What deleting removes, and what it keeps

**Removed:**
- the account row (name, icon, email, Google id, created and last seen, rating, the friends settings);
- every session, so the account is signed out on every device;
- the sign-in code's record;
- the shop and the locker: coins, crates, items, equipped items, quick-chat picks;
- reports the player made and reports about them;
- friends, requests, blocks, invites and the caps' counts, on both sides (`deleteSocial`);
- fair play's judged moves, match summaries and appeals;
- for an account that isn't banned, all of fair play: its case, log, identities and device markers;
- in the live hub: the account's "online" and "in a match" status, and its lines in the global chat (their drawn
  icons go with them).

**Kept, and why:**
- **Results, without the player.** Their rows move to the account id `deleted` (`DELETED_ID`), shared by every deleted
  account, and lose their lobby code. The game's own numbers (how often each boss wins, typical placements) stay right,
  and nothing ties a row to a person:
  - no account has that id (real ids are 16 random characters), so no profile shows them;
  - rows of different deleted players can't be told apart;
  - without the lobby code, a row can't be matched to a match.
- **A ban, if the account is banned.** Its case, log, the hashed email or Google id (`fairplay_identities`) and the
  device markers stay, under the deleted account's random id, and the log gets an "account deleted" line. So deleting
  never lifts a ban:
  - a new account signed in with the same email or Google account is banned again;
  - a new account on the same device goes to review, as before.

  The id is the account's own random one, not a hash of it. With the account gone it points at nothing. The ban was
  public on the profile anyway. Hashing it would add code and protect nothing. The review page lists such a case as
  "Deleted player", and an admin can still decide it: lifting the ban forgets the identities.
- **A match being played** keeps the player's name on its screens until the lobby closes (at most
  `LOBBY_LIFE.lobbyResultsKeepMinutes` after it ends; the lobby's storage is deleted then). Nothing is recorded for them:
  `recordResult`, `grantReward` and the lobby's fair-play recording skip an account that no longer exists.
  - Why not reach into the lobby: no index says which lobby an account is in, and the name goes with the lobby
    minutes later.

**The order:** the stores first, then the account, then its sessions. A deletion that stops halfway leaves the session
working, and running it again is harmless.

**On the device,** the app forgets everything it keeps (`brc.*` and `hunchess-*` in local storage, settings
included) and starts afresh, as a new visitor. The response clears the session cookie. The fair-play device marker
cookie stays: for an account that isn't banned it points at nothing any more, and for a banned one it's what keeps
the ban working.

## The download

- **GET /api/me/data** answers a JSON file, `hunchess-data-YYYY-MM-DD.json`. Settings → "Download my data" is a plain
  link to it.
- **It holds:**
  - every column of the account row (`SELECT *`, so a column added later appears without a change here);
  - the sessions' dates (never their hashes);
  - the latest sign-in code's record (never the code's hash);
  - results, shop, locker and reports made;
  - friends, requests sent and received, blocks made, invites sent and received, and the caps' counts;
  - the player's fair-play standing and appeals;
  - from the live hub, their lines in the global chat.
- **Times are written as dates (UTC).**
- **Left out, and why:**
  - **Who has blocked the player:** the app never shows it either.
  - **Fair play's detection records** (judged moves, match scores, case notes, reports about the player, device
    markers): they'd show how cheating is found. The file says to email for them, and a person answers.
  - **A lawyer's call:** whether to send that part on request, or only a summary of it. It's the same retention decision
    the privacy policy's draft notice lists.

## Two privacy fixes on the way

- **Sign-in code records go an hour after their code was sent.** They used to stay forever, one per email address, even
  for addresses that never made an account. After an hour the code has expired and its hour's send count has reset,
  so nothing is lost. They're cleared when someone asks for a code, at most every 10 minutes per Worker instance.
- **A new account is called "Player"** until its owner picks a name. A brand-new account made at sign-in took its name
  from the Google account (a real name) or the email before the @ (often a real name), and everyone sees a profile's
  name. A guest who signs in keeps their guest name, as before.

## Errors and problem reports (ops, #227), when they land

`ops_reports` keeps a signed-in player's account id on a bug report. Feedback and ideas keep none. `ops_errors` keeps no
account at all. Whichever of this PR and #227 merges second covers it:
- **Delete** the account's own `ops_reports` rows: their note and diagnostics are the player's.
- **Include them in the download.**

The coverage test already lists `account` as an account column, so #227's CI fails until its table has an entry in
`ACCOUNT_STORES`.

Chat moderation is paused and not on main. When it lands, its tables need entries too:
- the player's own reports: deleted;
- a chat ban: kept with a hashed id only if it must outlive the account, as fair play's are.

## Testing

**Full lane** (stored data, sign-in, privacy). GitHub's e2e run is the gate.

**Unit:** `packages/server/test/account-data.test.ts`:
- every table with an account column is covered;
- the download has every store's rows, readable, with nothing of anyone else's, and leaves out who has blocked the
  player;
- deleting leaves no row naming the account in any table or column, signs out both devices, keeps the results under
  `deleted` without lobby codes, removes the friendships from the other side, and leaves other players' rows alone;
- signing in again with the same email makes a new, empty account, and deleting twice is harmless;
- a result or reward after the deletion records nothing;
- a ban is kept (case, log, identity, device marker), catches a new account by email and by device, and an admin can
  list it and lift it;
- sign-in code records go after an hour;
- the API: the file, no deletion without the confirmation, the cookie cleared, the hub told, the old session refused,
  the profile gone;
- the global chat and the live board forget the account.

`accounts.test.ts`: a new account is "Player".

**e2e:** `e2e/account-delete.spec.ts`:
- a guest with a name, a solo result, a crate item and a setting downloads the file (its keys and rows);
- "Keep it" keeps the account;
- "Delete my account" starts the app afresh with the setting forgotten;
- the old session cookie on another device is a new visitor, and the profile is a 404;
- the local D1 has no row naming the account, and the result is under `deleted` with no lobby code.
