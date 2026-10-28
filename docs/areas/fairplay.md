# Fair play

Lane: `fairplay`. The reviewer's brief: `docs/fairplay-reviewer.md`. The numbers behind the thresholds:
`reports/fairplay.md`.

## How it works today

- **Signals come from the server's own judged data** (the judges' or the engine server's scores for each human pick),
  never numbers a browser makes up: strength, hard finds measured against the crowd, timing. The one exception is the
  look-away count (only the browser can see the page hidden), weak evidence that can add a few points, never ban.
- **Recording.** During a match the lobby records each human pick's signals (`noteFair`, the `fair` record). Turns a
  boss power touches (`powerTurn`) don't count, nor a crowd move a power crossed out after it was played (Folio's
  Revision: the runner asks `BossRules.crossedOut` after the move and marks that round `power` in its report;
  [docs/decisions/2026-10-27-folio-rules.md](../decisions/2026-10-27-folio-rules.md)). Where a boss's judge changes the numbers (Chub & Chirp's carrot race),
  a turn counts only when the engine's best move is also the race's best move, and is then recorded with the engine's
  own numbers, as any turn without the race (the runner's `resolveBoard` and its `fairScored`); the other race turns
  don't count (about 4 in 5 of those not already decided, in the review's sample:
  [docs/decisions/2026-10-18-carrot-patch.md](../decisions/2026-10-18-carrot-patch.md)). Nor do picks made with the
  engine's moves on screen that the game showed: a power-up (`powerUp`), or Squads Mercenary's Stockfish token
  (`engineToken`: sanctioned help, skip reason "engineToken"). Squads isn't recorded yet; its matches log which
  choices had a token's lines on screen (`assists`, `isAssisted`), so when it is, they go in with `engineToken`.
- **Premoves** (chess.com's, Oct 28; [docs/decisions/2026-10-28-arrows-and-premoves.md](../decisions/2026-10-28-arrows-and-premoves.md)):
  a premove plays the moment the turn opens, so its think time is a round trip, not thinking, and a premoved hard find
  would read as a fast one. The rule: a pick is marked a premove only if the server had that move before any browser
  could know the position it's played in. The app tells the lobby its first premove ahead (`premove`), kept only while
  the player can't pick, under the lobby's premove seal (`premoveSeal`: up as each round opens, its picks live to the
  watching team, and at every boss step, which the host's browser decides); the round they next pick in takes it as it
  opens only if it was told under an older seal (`takePremoves`). A pick that plays it, says so (`pick`'s `premove`) and
  comes within `FAIRPLAY.signals.premoveMs` (2 s) of the clock's start is marked (`FairMove.premove`), and left out of
  timing only (fast hard finds, the time-difficulty correlation); strength, evidence, streaks and the deep re-check count
  it as any pick. Anything else is timed as every pick was before premoves (a premove made while the boss thinks, or
  while the other team chooses, is). The review page shows "(premove)" by its time. 1 v 1 has no timing signal, so
  nothing there is marked.
- **Someone who resigns mid-match** (or is gone too long) has their match's signals recorded with their result as
  they leave (`takeLeftResults`, the Durable Object's `saveResults`), as everyone's are at the end.
- **The suspicion score** turns a player's evidence into a level; every threshold is in `FAIRPLAY`.
- **A case** is one player's file. Its status: **watch** (recorded only), **review** (a person or the automated
  reviewer decides; meanwhile their online results are held off ranking and `eligibleForRanked` says no), **banned**
  (no online play, solo stays open; an appeal a person decides; their sign-in identities are kept hashed so a new
  account with them is banned too, and a device they played from puts new accounts in review), **cleared** (held
  results count again), **closed** (a watch with nothing new for `FAIRPLAY.evidenceDays`).
- **Each banned account keeps its own identity rows** (`fairplay_identities` is keyed by identity and account), so
  clearing one forgets only its own: another ban with the same email still catches new accounts, banned owners
  first. For an account cleared by a person or the reviewer (its latest "cleared" line in the log), `banCheck`
  leaves out the rows written by then (that clearing weighed them) and the rows of accounts banned by evasion (they
  only repeat a ban). So a cousin cleared of an evasion ban stays cleared through a report, a watch or its closing:
  those open a watch or a review, never a ban. A real ban of another account with its identity after the clearing
  catches it. A watch closing on its own doesn't count as a clearing. An account never cleared counts every row
  ([docs/decisions/2026-10-16-integrity-followups.md](../decisions/2026-10-16-integrity-followups.md)).
- **A guest's file follows it** when it signs in to an existing account, in the sign-in's one batch
  (`fairPlayMoves`, `fairplay-schema.ts`): its reports (made and about it), log, judged matches, appeals and device
  markers become the account's; its log lines are marked "guest …". A guest's open appeal goes if the account has
  one open. Its case does too if it's open or a ban and stricter than the account's (a cleared or closed one stays
  behind), with what opening it does (evidence kept, holds, a ban's identities). A guest's decision never becomes the
  account's (unless it's a ban). Signing in never sheds a case.
- **Reports** never ban anyone: they raise a player's review priority and record their moves. A report of a line in
  the town square's chat ("Offensive chat", Oct 28: [chat.md](chat.md)) carries the line's text and time, read from the
  server's room, and the case page shows it under Reports.
- **Deleting an account never gets around fair play** (`account-data.ts`; [accounts.md](accounts.md)). A banned or
  in-review account's case, log, hashed identities and device markers stay under its old id; its judged moves, match
  summaries and appeals go. A new account with one of its identities is banned again, or goes to review (`banCheck`).
  The review page shows it as "Deleted player", and a person can still decide it (the automated reviewer can't: 409).
  Lifting a ban, or deciding a review any way but a ban, forgets that account's identities (not another's). An account fair play hasn't acted on leaves nothing in fair play's tables.
- **A ban needs the deep re-check:** a flagged player's counted moves searched again on the engine server (its own
  instance, `fairplay-1`, its own daily budget, from the Worker's schedule: cases in review at once, the rest
  off-peak). The judges' quick numbers can open a review, never a ban. A move in a position Stockfish refuses is
  passed over (the engine server never gets one: [engine.md](engine.md)), so it can't stop the queue.
- **1 v 1** ([ranked.md](ranked.md)): no judged picks, so no signals and no part in the suspicion score. Reports from
  the profile, as everywhere (one opened from the game names it). On a case's page, "Check the counted moves with the
  engine server" also checks the player's kept 1 v 1 games (`fairplay-duel.ts`, `checkDuelGames`): reported ones
  first, the player's moves after the book, each against every legal move: the engine server scores at most 8 moves
  a search and has no unrestricted search, so the legal moves go in near-equal groups of at most 8 (`moveGroups`, the
  played move's first; 17 moves are 6, 6 and 5), one search each (about 5 a move); a position whose groups can't all
  be searched (the press's searches or the day's budget run out partway) is dropped and searched whole next time, on `fairplay-1` within the same daily budget (`takeBudget`); each game's
  result kept by side (`ranked_1v1_games.checked`) and shown in the page's "1 v 1 games" section. A player in review
  keeps their rank as it is (their games don't move it) and earns no 1 v 1 coins; their games are kept past 30 days
  only while their case is open (watch or review) or an appeal of a ban is waiting (purgeEvidence's rule).
- **The review page** `/admin/fairplay` (admins only, `ADMIN_EMAILS`) and the reviewer's API `/api/admin/fairplay/*`
  (a bearer token, `FAIRPLAY_REVIEW_TOKEN`). Every decision goes in the case's log with who and why; the automated
  reviewer never decides appeals nor changes a ban. A player's page also has chat moderation's section (warn, chat
  ban, lift, reset the name and icon; admins only: [chat.md](chat.md), "Moderation"), and a box on the list opens any
  player's page by id or profile link.
- **Emails:** a ban notice and a clearing go to the player's sign-in address through Resend.

## Where the code is

| What | Where |
| --- | --- |
| Signals, the suspicion score, levels (pure) | `packages/core/src/fairplay.ts`; thresholds `FAIRPLAY` in settings.ts |
| Recording each human pick's signals | `packages/server/src/lobby.ts` (`noteFair`, the `fair` record only; premoves told ahead: `premoveAhead`, `sealPremoves`, `takePremoves`) |
| Reports, cases, bans, appeals, device markers, `eligibleForRanked` | `packages/server/src/fairplay.ts`, tables `fairplay-schema.ts`, emails `fairplay-mail.ts` |
| The deep re-check | `packages/server/src/fairplay-deep.ts`, `fairplay-engine.ts`; the cron in `wrangler.jsonc`, `scheduled()` in `index.ts` |
| Enforcing bans | small checks in `index.ts` (PLAY, lobbies) and `lobby-do.ts` (the lobby's hello) |
| The review page and API | `packages/server/src/admin.ts` |
| The report sheet, ban notice and appeal form, look-away counter | `packages/app/src/screens/PlayerProfile.tsx`, `components/FairPlay.tsx`, `lookaway.ts`, `net.ts` |
| Simulations | `packages/sim/scripts/fairplay-bank.ts` (the position bank in `packages/sim/data/`), `fairplay-sim.ts` → `reports/fairplay.md` |

## Settings

`FAIRPLAY` in settings.ts; Worker secrets/variables `ADMIN_EMAILS`, `FAIRPLAY_REVIEW_TOKEN`, `RESEND_API_KEY`,
`EMAIL_FROM`.

## Tests

- Unit: `packages/core/test/fairplay.test.ts`, `packages/server/test/fairplay.test.ts`, `fairplay-lobby.test.ts`,
  `fairplay-deep.test.ts`, `fairplay-admin.test.ts`.
- e2e: `e2e/fairplay.spec.ts` (reporting, a banned account; the review token is set in `playwright.config.ts`).

## Rules for this area

- Measure false bans before switching anything on: simulate every threshold change (catch rates per cheater type
  within 1, 2 and 5 matches; false flags and bans per 1,000 honest players at every strength).
- Borderline cases go to review (a person), not a ban. A false ban of an honest player is the worst outcome.
- No invasive fingerprinting; admin emails live in a Worker variable or secret, never in the repo.
