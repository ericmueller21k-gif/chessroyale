# Accounts and sign-in

Lane: `hub`. What a profile shows is on [hub.md](hub.md).

## How it works today

- **Guest by default.** The first visit makes a guest account with a session cookie (`hc_session`, HttpOnly, 365
  days). Guests get a profile and stats too.
- **Two ways to sign in:** Google, and a 6-digit code sent by email (Resend). No passwords. A code works for 10 minutes
  and once, allows 5 tries, needs 30 s between resends and 5 sends an hour per address. One statement counts a try and
  uses a right code up, so checks at once can't share a code or get extra tries. Likewise one statement checks the
  resend gap and the hour's count and records the send, so starts at once send one email
  ([docs/decisions/2026-10-16-integrity-followups.md](../decisions/2026-10-16-integrity-followups.md)). Codes and session tokens are stored
  hashed (SHA-256). Google's ID token comes straight from Google's token endpoint over TLS; `aud` is checked and the
  email used only when Google marks it verified.
- **The age gate** (Oct 16; [docs/decisions/2026-10-16-age-gate-and-real-money.md](../decisions/2026-10-16-age-gate-and-real-money.md);
  since Nov 12, [2026-11-12-signin-without-age.md](../decisions/2026-11-12-signin-without-age.md)): 13 or older for an account
  (Eric). The sign-in box has **Sign in** first, with no question, and **Sign up** below it, which asks "when were you born?"
  (a month and a year, nothing chosen, no age mentioned) before the account is made.
  - The app works the answer out (`oldEnough` in `packages/core/src/age-gate.ts`, whole months) and posts only
    `{oldEnough}` to POST `/api/auth/age`. The birth date is never sent or stored.
  - **Old enough:** the cookie `hc_age=ok` lets this device make an account (or sign in to one that never answered) once,
    within `AGE_GATE.answerMinutes`. Each sign-in's start (an emailed code, the trip to Google) gives an answer that time
    again, so it can't run out halfway. The sign-in uses it up and sets `users.age_ok_at` (the first time only).
  - **No answer on the device:** the server decides once it knows who is signing in (the code checked, or Google's callback).
    An account that has answered (`age_ok_at` set; or, for an identity new to us, the signed-in account it would join) signs
    in with no question. Anything else (an email or Google account with no account yet, an account from before the question)
    is asked first, with nothing made, moved or signed in: the email's check answers 403 `{askAge, message: AGE_STEP_LINE}`
    and keeps the code live (`verifyEmailCode(…, keep)`); Google's callback sends the page back with `?signin=age-google`. The
    box asks; the answer finishes it: the same code sent again (nothing typed again), or Google once more (one more pick of the
    account; nothing about the Google account is kept before the answer). `signInIfAnswered`, `answeredSignIn` in
    `accounts.ts`; the app's `pending` sign-in in `account.ts`.
  - **Too young:** `hc_age=under` (HttpOnly, `AGE_GATE.tooYoungDays`) and the app's `brc.tooYoung` flag, each putting
    the other back. Every sign-in step refuses that device (email start and verify, Google start and callback), and no
    later answer replaces it. Any `hc_age=under` in a request counts (`ageAnswer`), however many `hc_age` it carries.
  - **Its guest:** the default name and icon (reset at the answer; a guest's PATCH `/api/me` refused; "Edit name &
    icon" hidden). No sign-in prompts: the landing says "Online play needs an account". The feedback sheet sends a bug
    report with no note (`problems.ts` drops a guest's). Someone already signed in on that browser keeps all of these
    (`youngGuest` in the app).
  - "Delete account" keeps the flag.
- **Signing in keeps what you played as a guest.** A new identity attaches to your current account; one that already
  belongs to an account switches you to it, moves your guest results, items, coins, crates, crate keys and boss tokens over and deletes the
  empty guest. That whole merge is one batch (one transaction): two sign-ins at once move the coins once, a buy in
  another tab lands wholly before it or wholly after, and a failure moves nothing (`sign-in-races.test.ts`;
  [docs/decisions/2026-10-16-sign-in-races.md](../decisions/2026-10-16-sign-in-races.md)). The guest's reports (made
  and about it) and fair-play file move in the same batch (`fairPlayMoves`, [fairplay.md](fairplay.md)), so nothing
  stays under the guest's id, where deleting the account couldn't reach it
  ([docs/decisions/2026-10-16-integrity-followups.md](../decisions/2026-10-16-integrity-followups.md)).
- **Sign-in buttons appear only once their secrets are set** (`/api/auth/config`): `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` for Google, `RESEND_API_KEY` for email. They live in the account's Secrets Store (bound in
  `wrangler.jsonc`, `secrets_store_secrets`); `withSecrets()` reads them from the store or as Worker secrets.
- **The database** is Cloudflare D1. The schema is made at runtime (`CREATE TABLE IF NOT EXISTS`, once per Worker
  instance; later columns by `ALTER TABLE` migrations that tolerate re-runs), so a deploy needs no migration step. One
  run per instance (requests meanwhile wait for it), in 4 round trips after a schema change, 1 on a current database
  (`ensureSchema`; `schema-fast.test.ts`; [2026-11-10-schema-fast.md](../decisions/2026-11-10-schema-fast.md)). Check
  new SQL on the local D1 too: it refuses some that node:sqlite takes (more than 5 UNION terms, `pragma_table_info(col)`).
- **Results.** The server records online matches when a lobby reaches results, for every connected player with an
  account (`results.ranked` says whether it counts for ranking). The browser posts solo matches (`online = 0`): the
  browser's word, so they never count for ranking (even the ones from before Oct 7, stored with `ranked` NULL) nor
  toward "Boss tiers beaten" (docs/decisions/2026-10-16-server-side-rating.md). Each
  result keeps whether its player had the eval bar on (`results.eval_bar`, NULL from older apps; see [hub.md](hub.md)).
- **XP and levels** (Nov 9; [2026-11-09-xp-rules.md](../decisions/2026-11-09-xp-rules.md), [storage](../decisions/2026-11-09-xp-storage.md),
  [the box](../decisions/2026-11-09-xp-box.md)): every counted game's XP is decided on the server (`server/xp.ts` `grantXp`, the rules in
  core's `xp.ts`, the numbers `XP` in settings.ts) and granted through the ledger (asset kind `xp`, the wallet's `xp` column), once per game
  per player. 10 XP a whole minute you played (up to 30), +50 a win, from 10 of your own moves; none for leaving, a test game, a banned
  account, or a guest where sign-in is set up. Your level is 1 + XP ÷ 1,000 (`levelOf`). Each result row keeps the game's `play_ms`,
  `moves` and its XP (`xp_before`, `xp_parts`, `xp_none`); a solo game is timed by the server between `POST /api/xp/solo/start` and its
  `POST /api/results` (table `solo_games`); a solo result it never timed earns nothing, a solo win needs 5 of its minutes, and solo time
  XP is capped at `XP.soloMinutesPerDay` (120) minutes an XP day. A friends' lobby's win pays once an XP day per opponent. A match that rested on one device's word (Nov 10: a host scoring alone, a boss move nobody checked; a Squads lobby of one party) pays as a solo game, under both solo caps; in the Hidden Boss's phase 2 online, a move of his from a device or the server's quick move does so for its board players only (`phase2Unvouched`, Nov 13). Merging a guest adds its XP; deleting closes it in the ledger; the download has it all.
- **The daily reward and level rewards** (Nov 9, phase 2; `server/rewards.ts`, decisions `2026-11-09-xp-phase2-*.md`): the XP day's first
  counted game with `XP.dailyMinMoves` (15) of your own moves (solo: also 3 minutes of the server's time) pays +200 XP ("Daily reward
  +200" in the box) and a Winter Crate, once a day (`daily:<day>:<ledger id>`). Each level reached pays 2 Winter Crates and a crate key,
  every 10th also a boss crate to pick (`wallets.boss_picks`), once per level (`level:<n>:<ledger id>`), every level owed at the next
  counted game (at most 20 a game). Both go through the ledger in the game's XP grant; what a game paid is kept on its result
  (`results.xp_rewards`) and shown in a toast at the top once the bar fills (`components/RewardBox.tsx`). `PAUSE_REWARDS` grants
  nothing ("Rewards are paused for a moment."). Merge adds the crates and picks; deleting closes them; the download has them. A level
  a merged guest was paid counts as paid for the account (`owedLevels` reads the merge's ledger legs; Nov 10: it was paid again).
- **Quests** (Nov 9, phase 3; `server/quests.ts`, the rules in core's `quests.ts`, the numbers and pool `QUESTS` in settings.ts; decisions
  `2026-11-09-quests-*.md`): 2 dailies a day and a weekly a week, dealt lazily on the day's first read (GET /api/quests or a game's XP grant)
  from a seed of the account and the day, once (`quest_days`' nonce claim). Unfinished dailies carry over, topped up to 3 at most; the weekly
  resets on Mondays (08:00 UTC). One free reroll a day per daily (POST /api/quests/reroll; Nov 10): the replacement keeps the slot and is marked `quests.rerolled_day`, so it can't be rerolled again that day; two tabs reroll a quest once. Progress (`quest_progress`, one row per quest per game, only from the attempt that first counted the game:
  `quest_games`) and
  completion (op `quest:<kind>:<quest id>:<ledger id>`: 300 XP a daily, some a Winter Crate; the weekly 1,500 XP, a crate and a key) go in the
  game's own XP batch, only for a counted game (online by the room's facts; solo only "finish games" quests and, for a solo Boss Battle (the result's `mode: "boss"`, quest mode `soloBoss`, Nov 10), the boss quests, with 3 of the server's minutes and only while its time XP is paid (not past the day's solo minutes); a
  win only when its win XP went in), so each quest pays once. Its XP is a part of the box ("Quest +300") and can level you up; the quests are in
  the result's rewards (`XpRewards.quests`). Nothing while `PAUSE_REWARDS` is on. A guest's merge drops the guest's quests; deleting removes
  them; the download has them (store `quests`). The screens: [hub.md](hub.md).
- **Squads' placements** (unranked): a result with mode "squads" (placement 1, 2, 3 or 5 of 8 squads) and its reward:
  coins into `wallets.coins`, crates (Winter Crates since Nov 9, in `series_crates`; before, counted in `wallets.crates`), both carried over
  when a guest signs in (`grantReward`).
- **Admins** are the emails in `ADMIN_EMAILS` (a Worker variable or secret, never in the repo): the fair-play review
  page (chat moderation included), the boss battle's "Trigger ultimate (testing)" button, and the test switches in the
  address (`?debug`, `?rounds=`, …; [ops.md](ops.md), "Test switches").
- **Test accounts** (Nov 10; `test-accounts.ts`, [the decision](../decisions/2026-11-10-cheater-demo.md)): `/api/admin/test-accounts` (an admin,
  a script through Access with the one service token `TEST_ACCOUNTS_CLIENT_ID` names in `wrangler.jsonc`'s `vars` (empty: no token gets in;
  emptied before launch, ROADMAP.md), or the e2e's key): POST `{name}` makes `<name>@test.hunchess` (`users.test` = 1; a real account's
  address: 409) and signs a script in as it (not an admin's own browser), GET lists their fair play, DELETE removes them all as any deleted
  account (results re-keyed, ledger kept), fair play's file too. They play as anyone (nothing granted), are left out of the "Top N%" and 1 v
  1's top places, and their reports never count toward a review. `scripts/cheater-demo.ts` plays with them ([fairplay.md](fairplay.md)).
- **Bans** (from [fairplay.md](fairplay.md), "A ban means you can't sign in"; Eric, Nov 13): a banned account can't sign in at all.
  Each sign-in's finish (the emailed code checked, Google's callback, a test account's script) asks `signInBan` before anything is
  made or switched: refused with the ban line, no session. The Worker's ban gate (`ban-gate.ts`) gives a banned session, or a
  browser marked banned, the ban answer on every route, ends that session and marks the browser; the app then shows only the ban
  screen. A lifted ban signs in as before.
- **The default pawn color** (Nov 7; `users.pawn_color`, NULL: white): PATCH `/api/me` `{pawn}` (only "white" or "black"); shown on the profile and
  in the town's presence (`town-here.ts`). A guest keeps it on the device (`brc.pawnColor`, `prefs.ts`). See `core/src/pawn-color.ts`.
- **Names** pass the server's name filter (slurs and hate: [chat.md](chat.md), "Moderation"): a profile can't take
  such a name, and a lobby or Squads seat asked for with one is "Player N". A moderator can reset a name and icon from
  the player's page on fair play's review page. A lobby seat takes its account's name as the player joins.
- **Download my data and Delete account** (Settings → ACCOUNT, for guests too;
  [docs/decisions/2026-10-15-delete-my-account-and-download-my-data.md](../decisions/2026-10-15-delete-my-account-and-download-my-data.md)):
  - **The download:** GET `/api/me/data` answers a JSON file of everything kept about the account (every store's rows,
    the global chat's lines from the live hub). It leaves out who has blocked them and fair play's detection records
    (on request, by email). Ranked's marks for leaving early (`ranked_conduct`, Nov 9) are in its `ranked1v1` part as
    `leaves`; deleting erases them, and a guest's move to the account on sign-in ([ranked.md](ranked.md), "Leaving early").
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
  - **Boss tokens** (store `bossTokens`: `boss_tokens`, `boss_token_drops`, `solo_battles`; crate keys in `wallets.crate_keys`;
    [shop.md](shop.md), "Boss tokens"): the download has the counts, each drop (boss, when, its battle) and an open solo battle's
    start; deleting removes all three. Drops older than 30 days go on the Worker's schedule.
  - **Ranked 1 v 1** (store `ranked1v1`: `ranked_1v1`, `ranked_1v1_games`; [ranked.md](ranked.md), "Data stored"):
    the download has the rank and the player's kept games (the opponent by name); deleting removes the rank and makes
    the player "deleted" in their opponents' games. A guest's rank moves to the account on sign-in only if the account
    has none.
  - **The ledger** (store `ledger`: `ledger`, `ledger_accounts`; `ledger.ts`, Nov 6): the download has every change to the balances;
    deleting closes each balance in it and drops the account's random ledger id, so its rows stay naming nobody (append-only).
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
- **Round trips (Nov 10, [load regression](../decisions/2026-11-10-load-regression.md)):** every D1 read from the Worker is a round trip
  (about 40 ms), so a route reads what it can at once (`Promise.all`): `/api/me` in 4 (5 with the D1 touch; it was 28 one after another),
  `/api/quests` and `/api/friends` in 3. `packages/server/test/me-round-trips.test.ts` counts them on a fake D1; keep new reads beside
  the others, not after them.

## Data stored by friends (for the privacy page and account deletion)

Every row is about two accounts; `deleteSocial(sql, userId)` (`friends.ts`) deletes an account's rows on both sides.
A guest's merge into the account it signs in to runs its statements (`socialDeletes`), and so does deleting an account (`account-data.ts`, whose
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

Nothing else is stored: no friend codes, no chat between friends. The friends page's player search (Nov 11) reads names through an
index on `users.name` (`users_name`, any case: a prefix is a range, never a scan; `searchPlayers` in `friends.ts`), nothing new kept.
Who's online, who's in a match and what they're doing (`?doing=`) stay in the live hub's memory (never written).

## Where the code is

| What | Where |
| --- | --- |
| Accounts, sessions, identities, profiles, results (D1, behind a tiny SQL interface) | `packages/server/src/accounts.ts` |
| The account API (`/api/me`, `/api/auth/*`, `/api/profile/*`, `/api/results`, …) | `packages/server/src/api.ts`, routed from `index.ts` |
| App side: your account, signing in | `packages/app/src/account.ts`, `components/SignIn.tsx` |
| The age gate: its rule and lines (core), the answer's route and checks (`ageAnswer`, `ageRefusal`, POST `/api/auth/age`), the app's question and flag (`answerAge`, `tooYoung`) | `packages/core/src/age-gate.ts`, `packages/server/src/api.ts`, `packages/app/src/account.ts`, `components/SignIn.tsx` |
| The privacy policy, terms and copyright page | `packages/app/src/screens/Legal.tsx` |
| Download my data and deleting an account: every store's part (`ACCOUNT_STORES`), the routes `/api/me/data` and `/api/me/delete` | `packages/server/src/account-data.ts`, `api.ts`; the live hub's part `live-hub.ts` (`accountData`, `forgetAccount`) |
| App side: Settings → ACCOUNT's download link and delete confirmation | `packages/app/src/components/AccountData.tsx`, `account.ts` (`deleteMyAccount`) |
| Fair play's tables (made with the rest of the schema) | `packages/server/src/fairplay-schema.ts` |
| Friends: requests, blocks, invites, settings, caps (D1); the API (`/api/friends`, its kill switch) | `packages/server/src/friends.ts`, `friends-api.ts`; shared types `packages/core/src/friends.ts` |
| App side: the friends list, actions, the invite toast, who's blocked | `packages/app/src/friends.ts`; screens on [hub.md](hub.md) |

## Settings

Worker variables and secrets (see `DEPLOY.md`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`,
`EMAIL_FROM`, `ADMIN_EMAILS`, `PAUSE_FRIENDS`; the D1 binding `DB`. Rate limits on the API: `CAPACITY.rateLimits` (its
`friends` burst limit); friends' caps and expiries: `FRIENDS`. The age gate: `AGE_GATE` (the minimum age, the years
offered, how long each answer lasts).

## Tests

- Quests: `packages/core/test/quests.test.ts` (what counts, the pool, seeded picks, the cap, countdowns, the toast's lines),
  `packages/server/test/quests.test.ts` (dealing, resets, carry-over, the reroll, progress per mode, paid once under replays and races,
  the weekly, the pause, merge, download and delete, the API); `e2e/quests.spec.ts`.
- XP: `packages/core/test/xp.test.ts` (the rules, the fill), `packages/server/test/xp.test.ts` (granted once, races, the caps, each "No
  XP" reason, the result row, the solo clock, merge, download and delete, each match room's facts); `e2e/xp.spec.ts`.
- Unit: `packages/server/test/accounts.test.ts` (an in-memory SQLite, `memory-db.ts`); `ban-sign-in.test.ts` (each sign-in refused
  for a banned account and ban evasion, no session; [fairplay.md](fairplay.md)); `age-gate.test.ts` (Sign up behind the
  answer; Sign in with no question into an account that answered; asked first, with nothing written, for an unknown email or
  Google account and an account from before the question, and the finish; a too-young device refused with every kind of
  account; the kept code's limits; between steps, two tabs, a replayed callback; the guest's defaults; nothing but the answer
  kept), with the rule's in `packages/core/test/age-gate.test.ts` and the app's in `packages/app/test/age-gate.test.ts` (the
  waiting sign-in and its finish); `account-data.test.ts` (every
  table covered, the download, deleting in every store, a kept ban, the API, the live hub's part); `friends.test.ts` (requests,
  blocks, invites and the settings, the caps, expiry, hidden status, `deleteSocial`, the API and its kill switch, the
  live board's news and "in a match"); `packages/app/test/friends.test.ts` (the list, the toast, hiding blocked chat,
  inviting from the front door).
- e2e: `e2e/age-gate.spec.ts` (Sign up's question, the under-13 path into guest play, the 13+ path making an account, a
  fresh browser signing in with no question and an account from before it asked once), `landing.spec.ts` (Sign in first;
  Sign up and back move nothing),
  `e2e/account.spec.ts`, `account-delete.spec.ts` (download, the confirmation, deleting; reads the local D1),
  `profile.spec.ts`, `legal.spec.ts` (the privacy policy, terms and copyright page),
  `friends.spec.ts` (two players: request, accept, online, the invites setting, an invite joined from its toast, a
  block).

## Rules for this area

- Secrets never in the repo or in output; Eric does sign-ups and purchases.
- A profile others can see never shows an email, a sign-in method or anything not on the approved list.
- Every way to sign in is refused for a banned account (`signInBan`, once the identity is proven, before the age question; Eric,
  Nov 13), and every request passes the Worker's ban gate first.
- Every way to sign in goes through `ageRefusal` (a device that's too young is refused at every step, Sign in included) and
  finishes only through `signInWithIdentity` after an "old enough" answer or `signInIfAnswered` without one; a guest under the
  gate gets nothing that takes typed text or lets others reach them (the decision file's guest audit). A new way to sign in, or
  a new place to type, checks the age answer in the same PR. No account is made, and none that never answered signs in,
  without this device's answer (Nov 12).
- A new table goes in `ACCOUNT_STORES` (`account-data.ts`: its part of the download, and what deleting does to it)
  with its line in the privacy policy, or in `NO_ACCOUNT_DATA` with why it holds nothing about anyone, in the same PR.
- The app's `api()` (`account.ts`) never takes an answer it couldn't read for one: a 2xx that isn't a JSON object fails like a server
  error (502, asked again where a server error is), so a cut-off `/api/me` never becomes a profile without its `user` (Nov 11:
  every screen reading `profile.user` threw). `account-load.test.ts`.
