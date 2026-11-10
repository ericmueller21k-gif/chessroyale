# HunChess: outside review, findings (Nov 10, 2026; second, deeper pass)

Answer to `notes/fable-audit.md`. Nothing in the game was changed. Code read at `main` a706681.

**How it was done.** A first pass by reading, then a second pass with tests run locally and six read-only
reviewers, one per area. Three had reported when this was written (Squads and 1 v 1; rewards and auto chess;
accounts, admin, fair play and chat). Three had not (phone performance with a real build; the rules engine and
bosses; tests and dead code): see "Still to come" at the end. I spot-checked each reviewer's top claims in the code.

**Confidence labels.** "Ran it": a test showed it. "Read": the lines cited were read. "Docs": from an area page.
"Guess": neither.

**Proof tests** (beside this file; copy into `packages/server/test/` and run with `npx vitest run <file>`):
- `fable-lying-host.test.ts`: the boss thrown, and a junk move shown as best.
- `fable-many-seats.test.ts`: one account, three seats.
- `fable-match-end-save.test.ts`: database calls per player at a match's end, and results written twice.

## The short version

The wallet, crates, sign-in and ranked 1 v 1's rules are well built: no way found to pay twice, roll a crate
unfairly, or decide a 1 v 1 result from the app. The weak spot is one idea used in three places: **work sent to
players' devices is trusted when too few devices, or the wrong devices, check it.** Scores, the boss's moves and
Squads' bot moves can each be decided by one player. Because fair play bans on its own from those same numbers,
the same hole can be used to get an honest player banned.

Four fixes close most of it: one seat per account per lobby; never trust a device's claimed speed; the boss's
moves checked or made by the server; fair play set to "review", not "ban", until its evidence is the server's own.

## Top findings, by impact

### 1. One account can sit in many seats of one lobby, and be both judges
- **What.** A `hello` with no seat token always makes a new seat; nothing checks the account already has one.
  Judges are drawn by weight = (claimed speed)³, and the speed is the device's own word, up to 50 million.
- **Evidence.** `lobby.ts:829-866` (no account check), `:2602-2605` (speed), `judges.ts:116-119`,
  `settings.ts:2403` (`speedWeight: 3`). Squads: `squads-lobby.ts:673-714`, `squads-do.ts:334-361`.
- **Ran it.** Three connects on one account gave seats p1, p2, p3. In Squads, 32 connects gave 32 seats, one in
  every squad. With the cube, two tabs claiming 50M outweigh 95 honest computers at 2M by about 300 to 1.
- **Why it matters.** Two tabs of one person are both judges of nearly every round, agree with each other, and
  are accepted with no check: full control of scoring, in a ranked 100-player match too. Each extra seat is also
  an extra vote in Crowd. In Squads, ghost seats can fill a lobby, keep an empty match alive, and inflate the
  online count that feeds the overload cap.
- **Do.** One seat per account per lobby (a second socket takes over the first seat). Ignore claimed speed: time
  the first job. Never draw two judges from one account, party, address or device marker. Lower the cube.
- **Confidence.** High. The seat part is run; "both judges nearly always" is arithmetic on read code.

### 2. In a raid, one of the raiders plays the boss
- **Evidence.** `lobby.ts:1324-1326`: the host's `bossMove` is played if the rules allow it.
- **Ran it.** A host that sent the boss's worst move each turn won the raid in 8 moves; all raiders got the win.
- **Do.** Refuse a boss move that loses more than the blunder guard by the round's judged numbers, or run the
  boss's brain on the engine server for raids that pay rewards.
- **Confidence.** High.

### 3. Fair play can ban an honest player on numbers a cheater supplied
- **What.** `FAIRPLAY.enforcement` is `"ban"` (`settings.ts:3375`). The signals are the judges' numbers. The "deep
  re-check" on the engine server searches only the candidate moves those judges supplied plus the pick
  (`fairplay-deep.ts:96`), so it confirms a forged list.
- **Why it matters.** With finding 1, two tabs can report a victim's picks as best among poor candidates, match
  after match, until the victim is banned and emailed. On the host path (finding 5) one device can do it.
- **Do.** Set enforcement to `"review"` now. Make the deep re-check choose its own candidates (the engine's own
  top moves). Then turn bans back on.
- **Confidence.** Medium to high. Every link was read; the whole chain was not run end to end.

### 4. Anyone can switch off the engine server for the day
- **Evidence.** `index.ts:197-209`: `POST /api/engine/score` needs no sign-in and spends the shared daily budget
  (3,000; `engine.ts:129-132`). The per-address limit is 10,000 a minute.
- **Why it matters.** One loop ends all verdicts, spot checks and re-checks until midnight UTC: the only check on
  findings 1 and 5. `/api/engine/ping` keeps a paid container awake.
- **Do.** Require sign-in, a small durable per-account cap, and a budget for matches apart from solo's.
- **Confidence.** High (read by two reviewers independently).

### 5. With few people, one device scores the match or moves the bots
- **Main lobby.** Under two judging devices, the host scores every round, and a pick it leaves out "counts as the
  best" (`lobby.ts:2372-2374`, `:2398`). **Ran it:** `a2a3` came back as the best move, loss 0. The host also
  sends the bots' picks (`:2390-2392`), so it chooses the crowd's move when bots are the majority.
- **Squads.** With one human, their device alone answers for every bot's moves and the answer stands
  (`squads-lobby.ts:2116-2131`, `:2288-2290`). **Ran it:** 20 of 30 opposing bot moves were the dictated blunder.
  First place pays 100 coins and a crate, with no daily cap.
- **Squads' shared cache.** Two agreeing devices write their answer into a cache every Squads lobby on that
  server instance reads (`squads-lobby.ts:515-519`). **Ran it:** a fresh lobby used the planted answer and asked
  no one.
- **Why it matters.** At launch most matches are a few people and bots, so these are the normal paths.
- **Do.** A lone device's answer never stands alone where a reward depends on it: sample it on the engine
  server, or pay nothing extra for results only one device vouched for. Cache only server-checked answers. Give
  Squads' rewards a daily cap like ranked's.
- **Confidence.** High.

### 6. The automated reviewer's token can ban any account
- **Evidence.** `fairplay.ts:247-260`. **Ran it:** a ban with the token succeeded for a player with no case, no
  reports and no matches. The same API returns admins' emails in the case log.
- **Why it matters.** A leaked token, or a reviewer bot steered by text in a name or an appeal, can ban everyone.
- **Do.** For the reviewer, let the server allow a ban only when the case already meets the ban bar (or allow it
  only review, watch and clear). Strip emails from its answers.
- **Confidence.** High.

### 7. Ranked 1 v 1 has no automatic cheat detection, and loses results after a minute of trouble
- **Detection.** No signals at all for 1 v 1; games are checked only after a report (`docs/areas/fairplay.md:69`),
  and Stockfish is already in every page. Two accounts on two devices can trade wins; the same-device guard is a
  cookie, and nothing limits meeting the same opponent again and again.
- **Lost results.** A finished game tries to record 4 times, 15 s apart, then gives up for good
  (`duel-room.ts:132-133, 315-319`). A 60-second D1 outage loses every rating change in it. Squads retries for
  24 hours.
- **Do.** Sample finished ranked games on the fair-play engine off-peak; add move-time and repeat-pairing
  signals; retry recording for hours, not a minute.
- **Confidence.** Docs for detection; read for the rest. The game's own rules are solid (see "What's solid").

### 8. Sign-in by email code is weak for the accounts that matter most
- **Evidence.** `accounts.ts:629-687`. The code is 6 digits; the attempt count resets on each resend; 5 sends an
  hour. **Ran it:** 25 counted guesses in one hour window, about 600 a day per address, no lockout across codes.
  A stranger's request also replaces the owner's code and uses up their sends.
- **Why it matters.** Admin is decided by email address alone (`admin.ts:43`). An attacker who knows an admin's
  address has roughly a 1 in 5 chance a year of the admin pages. Anyone can block a known address from signing in.
- **Do.** Tie the code to the browser that asked (a nonce cookie), count failures per address per day, 8 digits,
  and put Cloudflare Access (or a second factor) in front of `/admin/*` for good, not only until launch.
- **Confidence.** High.

### 9. A match's end is about 2,200 database calls in a row, and can write results twice
- **Evidence.** `lobby-do.ts:161-204`. **Ran it:** 14 to 22 D1 calls per signed-in player (22 at 10 players), so
  about 2,200 for 100, one after another. Saving again, as after a restart before `resultsSaved` was stored,
  doubled the rows (10 became 20): `recordResult` is called without its `once` guard (line 190).
- **Why it matters.** Cloudflare's D1 page lists 1,000 queries per invocation on the paid plan; its Workers page
  lists 10,000 subrequests. If the first applies, the last players saved get nothing, silently (errors are
  swallowed). Either way it is tens of seconds in which a deploy doubles results. Main deploys on every merge.
- **Do.** One batch per player; pass `once`; count failed saves on the ops page. Then run a 100-account match on
  staging and count the rows.
- **Correction to my first pass.** I said staging may never have run this path. Guests get guest accounts, so it
  has run; what hasn't been checked is the count at 100 signed-in players.
- **Confidence.** High on the numbers; medium on which limit bites.

### 10. Free rewards from requests alone
- **Welcome Crates.** Any posted solo result counts as a finished game (`welcome.ts:48`; `api.ts:627-661`).
  **Ran it:** 25 empty posts earned two Welcome Crates, which opened to two Mythic rides.
- **Idle farming.** Solo XP trusts the browser for moves and wins; only time is the server's. **Ran it:** one day
  of open timers gave 1,950 XP, 3 crates, a key and 2 boss tokens. The daily caps hold per account; accounts are
  free.
- **The shop route.** `/api/shop/buy` gives every item free by direct call while `SHOP_FREE` is on
  (`core/shop.ts:70`), though the tabs are hidden. When it's turned off the server charges full price and ignores
  the 50% the page shows.
- **Do.** Count a solo game for the Welcome Crate only when the server timed it. Decide now whether items will
  ever be traded or gifted: if not, idle farming is tolerable; if so, it must be closed first. Close the route.
- **Confidence.** High.

### 11. Most of the code is not the game, and the launch crowd will be thin
- App source: town 63k lines, character art 52k, components 34k, all game screens 14k, the board 1.6k. Six modes
  plus the town and a shop, and no match yet played by strangers. 200 people online over six queues is bots
  everywhere, which is exactly where findings 2 and 5 live.
- **Do.** Launch with one headline mode and 1 v 1; open Crowd at set hours; hold Squads, auto chess and the town
  until a few hundred play daily. Take Classic (on hold) out of the build and CI.
- **Confidence.** High on the numbers; the advice is judgment.

### 12. Money: paid keys for random crates is a loot box; the "50% off" is its own risk
- A struck-through "full price" nobody was charged is a deceptive-pricing risk (US, EU, UK). Paid random rewards
  are banned or restricted in Belgium and, for under-18s, Brazil; stores require odds shown; the bundle's "chance
  at a Mythic Crate" is a random reward inside one. EU buyers have a 14-day withdrawal right unless waived at
  purchase. The age gate only knows "under 13" and is an unsigned cookie.
- **Do.** Start by selling things directly (a named item, a pack whose contents are shown, coins); keep random
  crates as free rewards; add paid keys later with an 18+ check and region blocks. No trading, no cash-out.
- **Confidence.** Medium. I'm not a lawyer and these are from memory.

## Other findings

**Abuse and safety**
- One guest session sent 200 sign-in emails to 200 addresses (ran it): the cap is per address only. Risks email
  cost and the sender's reputation. Every cookie-less `GET /api/me` makes a user and session row never cleaned up.
- Two "cheating" reports from `name+1@` and `name+2@` accounts put a newer player into review, out of ranked
  until a person clears it (ran it; `fairplay.ts:330-379`).
- The name and chat filter drops emoji-style letters: a slur in squared letters passed as a name and in chat;
  "snap: kid_2012" passed as a name (ran it; `text-filter.ts:87-89, 127-133`). Typed lines outside the town can't
  be reported with their words. No block or mute yet, with 13-year-olds able to type.
- A ban is evaded with a new email and cleared cookies. Sessions last 365 days with no "sign out everywhere".
- The repo is public, so every fair-play threshold is too.

**Squads and matchmaking**
- A seat token moves the seat, its result and its reward to whichever account connects with it
  (`squads-lobby.ts:664`; ran it). The main lobby refuses this. It allows selling or boosting wins.
- Party seat reservations never expire (`squads-lobby.ts:638-643`; ran it): after 8 re-queues a filling lobby
  takes no more real players.
- The matchmaker's queue is memory only (`matchmaker.ts:64-70`): a deploy forgets everyone in line.

**Reliability**
- When a deploy drops every socket, every app reconnects at the same instants (500 ms, 1 s, 2 s…) with no random
  spread (`net.ts:505`). Each reconnect is several D1 reads and a full record write. Add jitter.
- Seat tokens are made with `Math.random` (`lobby.ts:839`). The account check limits the harm; use
  `crypto.getRandomValues` anyway.
- A guest merging into an account gets level rewards paid again (`rewards.ts:58-69`; ran it). A second solo start
  cancels the first game's XP (`xp.ts:50-61`). A solo boss turn that throws has no fallback and would hang on
  "boss thinking" (`solo.ts:911`; not reproduced).

**Code health** (measured parts are in "Still to come")
- The Durable Object shell is written four times (`lobby-do.ts`, `squads-do.ts` twice, `duel-do.ts`), and
  "device work checked across devices" twice with drifting rules: that drift is why Squads lacks guards the main
  lobby has. One shared module for seats, sockets and device checks would have prevented findings 1 and 5 in
  Squads.
- Boss names inside shared files ("hollow" 31 times in `runner.ts`, 16 in `lobby.ts`): a boss still edits the
  engine, which is why a boss PR runs everything.
- First load: 836 kB of compressed script and a 26,186-line stylesheet (your Nov 9 numbers).
- Area pages total 8,000 lines and read as history; every helper reads them first.

## What's solid

- **Ranked 1 v 1's rules:** seats by account, moves checked with chess.js, the server's clocks, one guarded
  transaction per result. Nothing the app sends reaches a result.
- **The ledger:** every grant one batch, keyed, replay-safe; no double pay or negative balance found; it
  reconciled after an abuse run.
- **Rolls:** secure randomness on the server; 400,000 simulated rolls matched the odds (39.9/26.1/18.0/14.0/2.0).
- **Test switches:** refused in production, admins included.
- **Admin pages:** every user string escaped; no GET changes state; the Access token check is complete.
- **Sign-in with Google, sessions, privacy:** tokens stored hashed, emails never shown to players, deletion covers
  every table, no secrets in the repo or its history, CI gives forks nothing.
- **Auto chess:** grants nothing and calls no server route; no rule bugs found in what was read.

## Quick wins (under an hour each)

1. `FAIRPLAY.enforcement` to `"review"`.
2. One seat per account per lobby, main lobby and Squads.
3. Clamp claimed speed to a sane top (say 5M) and drop `speedWeight` to 1, until speed is measured.
4. Sign-in required on `/api/engine/score` and `/api/engine/ping`.
5. Pass `once` to `recordResult` (`lobby-do.ts:190`).
6. Reviewer token: no bans without an open case at the ban bar.
7. Welcome Crate: count only server-timed solo games.
8. Stop Squads' cache taking device answers.
9. Refuse a seat token from another account in Squads (`squads-lobby.ts:664`), as the main lobby does.
10. Jitter on reconnect (`net.ts:505`).
11. Record a ranked game for hours, not four tries.
12. Take the struck-through price off the shop until a full price has been charged.

## Still to come

Three reviewers had not reported when this was written: phone performance (a real build, bundle contents, load
and idle cost on an emulated phone), the rules engine and every boss (scoring math, broken positions, state lost
on save and restore), and tests and dead code (unused code, duplication, tests that can't fail, docs the code
contradicts). If their results follow, they are in `fable-audit-findings-2.md` beside this file.

## Not covered

The town's and auto chess's screens beyond what a reviewer read; `search.ts` and `eval.ts` of the auto chess
engine; most app screens; anything on a real phone; real load.
