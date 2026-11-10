# HunChess: outside review, findings (Nov 10, 2026)

Answer to `notes/fable-audit.md`. Read-only: nothing in the game was changed. Code read at `main` a706681.

**How to read the confidence labels.** "Read the code" means I opened the lines cited. "From the docs" means I
trust the area page and did not check the code. "Guess" means neither.

**What I did not read**, so say nothing about: Squads' server, the town's and auto chess's code, the admin pages'
internals, `fairplay.ts`'s scoring math, and nearly all of the app's screens. I ran nothing: no tests, no build, no
load. Sign-in, sessions and cookies I only skimmed; what I saw looked careful.

## The short version

The server is in charge of the chess rules, the clock, crates and the wallet. It is **not** in charge of two things
that decide who wins: the boss's moves and, in a match with few people, the scores. Both come from one player's
device. Fix those two, close one open door on the engine server, and the integrity story is good.

The larger risk is not in the code. About 60% of the app is the town and character art, there are six modes, and no
match has yet been played by real strangers. A launch crowd spread over six queues will mostly meet bots.

## Top 10, by impact

### 1. In a boss raid, one of the raiders plays the boss
- **What.** The boss's move comes from the host's device, and the host is a player on the crowd's side. The server
  takes whatever the host sends as long as it is a move the rules allow.
- **Evidence.** `packages/server/src/lobby.ts:1324-1326` (`bossMove`: only checks the sender is the host, the phase
  and the key). `docs/areas/engine.md`: "the host's device plays Maia's move and the server sends that one move to
  everyone"; `applyBossMove` "plays the first allowed move for anything else a host sends".
- **Why it matters.** A changed app that is host makes the boss play its worst allowed move every turn. The whole
  raid wins. Wins pay XP and finish win quests, which pay crates. `pickHost` prefers a computer, so a cheater on a
  computer is the likely host. The power fields on the same message (`drag`, `showdown`, `beam`, `balloon`) are the
  host's word too.
- **What I'd do.** Cheapest: the round's two judges already search the boss's position; have the server refuse a
  boss move that loses more than the blunder guard allows by their agreed numbers, and play their best instead.
  Better: run the boss's brain on the engine server for any raid that pays rewards (Maia is about 80 ms a move).
  This is the computing rule's own third case: "a check that must be beyond any player's reach".
- **Confidence.** High (read the code). I did not check what each power field can do when forged.

### 2. Anyone can switch off the engine server for the day
- **What.** `POST /api/engine/score` needs no sign-in, and every call takes one search from the same daily budget
  (3,000) that every lobby's re-checks and dispute verdicts use. The budget is taken before the search runs.
- **Evidence.** `packages/server/src/index.ts:197-205`; `engine.ts:129-132` and `:47` (`takeBudget`, instance
  `engine-1`); the per-address limit is 10,000 a minute per Worker instance (`settings.ts:3098`).
- **Why it matters.** One loop of 3,000 requests, a few seconds from one address, and for the rest of the UTC day
  no close call is re-checked and no judges' dispute gets a verdict, site-wide. Disputes then fall to "the faster
  device stands" (`lobby.ts:3003-3011`), which a cheater can be (finding 3). `/api/engine/ping` is open too and
  wakes a paid container.
- **What I'd do.** Require a signed-in session, give each account a small daily count, and keep solo's budget apart
  from the lobbies' so one can never starve the other.
- **Confidence.** High (read the code).

### 3. With few people in a match, the host scores its own moves
- **What.** Two judges are used only when two devices can judge. Otherwise the host scores every round. A pick the
  host leaves out "counts as the best (no loss)".
- **Evidence.** `lobby.ts:2372-2374` (`scores`: host only), `:2398` (unscored pick = best), `:2565-2569`
  (`judging()`). Also: judges are drawn weighted by a speed each device reports itself, up to 50 million
  (`:2602-2605`), and when one judge is late the other's answer is used alone (`:2833-2846`), spot-checked on the
  engine server 25% of the time, and only while that server has budget (finding 2).
- **Why it matters.** At launch nearly every match is a few people and bots, so the host path is the normal one.
  The rating is protected (a match counts only with 30 real players of 100, `settings.ts:2316`). Placement,
  profile stats, "brilliant" counts and fair play's signals are not: fair-play.md says signals are "never numbers a
  browser makes up", but on this path they are one browser's numbers. Two friends who both claim a huge speed are
  likely drawn as both judges and can agree on anything.
- **What I'd do.** Cap the claimed speed to what the device then proves (time its first job). Never draw two judges
  from one party, one address or one device marker. On the host path, send a sample of rounds to the engine server
  and treat a host caught wrong as a fair-play signal. Write a "lying host" unit test for `lobby.ts` (it is pure, so
  this is cheap) and keep it as a guard.
- **Confidence.** High on the code. Medium on how much it matters before real stakes exist.

### 4. Ranked 1 v 1, the mode with the visible rank, has no automatic cheat detection
- **What.** 1 v 1 has "no judged picks, so no signals and no part in the suspicion score". Its games are checked
  only after a report opens a case and an admin presses the button.
- **Evidence.** `docs/areas/fairplay.md:69-77`. Stockfish is already loaded in every player's page.
- **Why it matters.** This is the mode where an engine helps most and where rank and coins are paid. A cheater
  needs no second device: a short script can ask the engine the page already has. Two accounts on two devices can
  also trade wins for rank and coins; the device marker only stops the same device.
- **What I'd do.** Sample finished ranked games on the fair-play engine instance off-peak (winners with a fast
  climb first), and add the cheap signals that need no engine: move-time flatness, and the same pair meeting again
  and again. Until that exists, treat the ladder as unverified.
- **Confidence.** High from the docs; I did not read `fairplay-duel.ts`.
- **A related point.** The repo is public, so every fair-play threshold and the reports that tuned them are public.
  Before launch, move the numbers to Worker secrets or make the repo private.

### 5. Saving a 100-player match's results is one long chain of database calls
- **What.** At the end of a match the lobby saves each person in turn: fair play, the ranked hold, XP and quests,
  the result, the welcome crate, the boss token. That is roughly 10 to 20 D1 queries a person, one after another,
  inside one handler.
- **Evidence.** `packages/server/src/lobby-do.ts:161-204`. `docs/areas/ops.md:121-123` already counts 300 to 500
  queries for quests alone and calls it "fine for now".
- **Why it matters.** Three ways it can hurt.
  1. Cloudflare's D1 page lists 1,000 queries per invocation on the paid plan; its Workers page now lists 10,000
     subrequests. I can't tell which applies here. If it is 1,000, the players saved last get nothing, silently:
     every call's error is swallowed (`.catch(() => undefined)` on `recordResult`, line 190).
  2. It may take tens of seconds. `resultsSaved` is set in memory first and stored after. A deploy in that window
     (main deploys on every merge) restarts the object and runs the loop again. XP and tokens are keyed, so they are
     safe; `recordResult` is called without its `once` guard, so results can be written twice.
  3. D1 runs one query at a time. Several big matches ending together queue behind each other.
- **What I'd do.** One batch per player (D1's `batch`), pass `once` to `recordResult`, and log a failed save
  instead of swallowing it. Staging lets guests play, and guests have no account, so the load tests may never have
  run this path: check that first.
- **Confidence.** Medium. The code is read; the limit and the timing need a run (see "To run").

### 6. Most of the code is not the game
- **What.** App source by folder: town 63k lines, character art 52k, shared components 34k, all game screens 14k,
  the board 1.6k. The town and the art are about 60% of the app. There are six modes plus the town and a shop, and
  no match has been played by strangers.
- **Evidence.** Line counts at a706681 (`packages/app/src/town`, `characters`, `screens`, `board`).
- **Why it matters.** Three costs. Every helper pays to read and test around it. First load carries it (finding
  8). And a launch crowd is small: 200 people online, over six queues and regions, is bots everywhere, and Crowd's
  rating never counts because no match reaches 30 real players.
- **What I'd do.** Pick the one mode that is the reason to come (I'd guess boss raids: they work with 1 to 50 people
  and bots feel natural there) and launch with it and 1 v 1. Open Crowd at set hours so people land together. Keep
  Squads, auto chess and the town behind "coming soon" until a few hundred people play daily. Take Classic out of
  the build and CI until its redesign (it is on hold and still the default mode of `/api/lobby`,
  `index.ts:252`; commit bd726b5 keeps it).
- **Confidence.** High on the numbers. The advice is judgment, and Eric knows his players; I don't.

### 7. Money: paid keys for random crates is a loot box, and the "50% off" is a risk of its own
- **What.** Crates are earned free, but opening one needs a key, and keys are to be sold. Legally that is a paid
  random reward. The shop page also shows a struck-through "full price" beside a 50% beta price.
- **Evidence.** `docs/areas/shop.md` ("Crates need keys", "The Shop tab's page", `SHOP.discount`).
- **Why it matters.** I am not a lawyer; confirm each point.
  - **The strike-through.** A "was" price nobody was ever charged is a deceptive-pricing problem in the US (FTC's
    former-price guides, California) and in the EU and UK (the reference must be a real recent price). This one is
    easy to walk into and easy to avoid.
  - **Regions.** Belgium treats paid loot boxes as gambling. Brazil bans them for under-18s as of 2026. Others
    (Netherlands, Spain, Australia's age ratings) are tightening. The age gate today only knows "under 13".
  - **Stores.** Apple and Google require odds shown before purchase, and Apple requires its own payment for
    digital goods inside an app. As a website with Stripe this doesn't bite; a store app changes it.
  - **The bundle.** "A chance at a Mythic Crate" is a random reward inside a random reward. Its odds need showing
    too.
  - **Refunds and tax.** EU buyers have 14 days to withdraw unless they agree to waive it at purchase. Digital
    sales owe VAT or sales tax in the buyer's place from the first sale.
- **What I'd do.** Launch money with things sold directly: a named item, a pack whose contents are shown, coins.
  Keep random crates as free rewards only. That removes nearly all of the above. Add paid keys later, with an 18+
  check and region blocks, once there's revenue to pay for the legal review. Whatever is sold: no trading and no
  cash-out, ever. Show "50% off" only against a price that was really charged.
- **Confidence.** Medium. The laws named are from memory, not looked up today.

### 8. The first load is heavy for a phone-first game
- **What.** The main chunk is 2.4 MB (836 kB compressed) and the one CSS file 438 kB (89 kB compressed):
  `styles.css` is 26,186 lines.
- **Evidence.** Your own Nov 9 audit's table; `packages/app/src/styles.css`.
- **Why it matters.** On a mid-range phone, parsing 2.4 MB of script is about a second or more before anything
  runs, on top of the 1.4 s of boss art you found. A new player's first ten seconds decide whether they stay.
- **What I'd do.** Give the home screen a size budget and a CI check that fails over it. Load each mode's screen,
  its boss and its CSS on entry. Split `styles.css` by screen, which also ends it as a merge-conflict magnet.
- **Confidence.** Medium (your numbers; I didn't build).

### 9. The docs have become a history log, and helpers pay to read it
- **What.** "One short page per area" is now 8,000 lines: town-square 1,268, bosses 1,066, squads 745. Single
  bullets run 300 words with dates, quotes and what it used to be. Code comments carry the same history. 76
  decision notes were written in 3.5 days.
- **Evidence.** `docs/areas/*.md`; `docs/areas/engine.md`'s "The boss's brain" bullet; your Nov 9 audit, F5.
- **Why it matters.** Your own measurement says a helper's cost is steps times history. These pages are read at
  the start of every job. A new reader (I was one) can't find the present state inside the story of how it got
  there.
- **What I'd do.** Area pages say only what is true today, in under 150 lines, with links. Dates, quotes and
  "before Oct 13" go to the decision notes, which already exist for that. One Haiku job per page.
- **Confidence.** Medium. It is a judgment about cost, not a bug.

### 10. Adding a boss still touches the shared engine
- **What.** Boss names appear inside the shared files: "hollow" 31 times in `runner.ts` and 16 in `lobby.ts`;
  "alfil" 22 and 15. Each boss also shows up in the protocol, `net.ts` and `solo.ts`.
- **Evidence.** grep counts at a706681; `packages/chess/src/bosses/` has 22 files, so a hook layer exists but leaks.
- **Why it matters.** This is why "add a boss in an hour" is hard: a boss edits the files every mode depends on,
  which then runs the whole e2e suite. It is also where one boss's fix breaks another.
- **What I'd do.** Before boss 21, move what's left into `BossRules` hooks until a grep for a boss's name in
  `runner.ts` and `lobby.ts` finds nothing. Make that grep a test. Then a boss is one folder and its own spec.
- **Confidence.** Medium. Counts are exact; I didn't read each mention, and some may be comments.

## By section

**1. Integrity.** Findings 1 to 4. Also:
- The good news, read in code: ratings come from the account, never the app (`lobby-do.ts:501-503`); practice mode
  is admin-only; a solo result never counts for rank; crates open on the server; purchases are one transaction.
- Solo XP is the browser's word, capped per day. Fine while items can't be traded. If trading or gifting is ever
  added, every free account becomes a farm.

**2. Launch risk.** Finding 5. Also:
- Every merge to main deploys, and a deploy restarts every match object. State is stored on each message, so
  matches should survive, but an engine-server answer in flight is lost. I found no test for "deploy in the middle
  of a match". Your gradual-deploy proposal is the right fix; add that test.
- The engine server is one single-thread container at about one search a second. 3,000 searches a day is perhaps a
  few dozen full matches. Past that, fairness quietly drops to the devices. Decide the real budget before launch
  and show "budget spent" on the ops page as an alert, not a number.
- Each message rewrites the whole lobby record (about 80 kB at 100 players). Likely fine; watch storage cost.
- Rate limits live in each Worker instance's memory, so they bound a script, not a determined person.

**3. Security.** Finding 2. Also:
- Client test switches can't be enforced on the client, and don't need to be, as long as the server ignores them.
  The server side I read does check (`testSwitches`, `squadsTestAllowed`).
- Public repo: account id, database id and the Access tag are not secrets. The fair-play numbers are the exposure.
- Typed chat is open to signed-in 13 to 17 year olds. CLAUDE.md lists muting as "later". A way to block or mute a
  person should ship before strangers can type to each other.

**4. Money and law.** Finding 7.

**5. Phones.** Finding 8. Battery: the town draws all the time; I didn't measure it. Worth one check that it stops
drawing when the tab is hidden or a sheet covers it.

**6. Code health.** Finding 10. Also:
- 234 references to test hooks across the app's game code (`testSwitchesAllowed`, `__town*`, `testParams`). They
  are there because e2e drives canvases. A single test bridge module would get them out of the render paths.
- Three lobby implementations (`lobby.ts` 3,713 lines, `squads-lobby.ts` 2,462, `duel-room.ts`) plus parties.
  Guess: they repeat connect, reconnect, leave and timers. Worth one read to see what can be shared.
- `settings.ts` is 4,342 lines. Keep "one place" as one folder with one index.

**7. Scope.** Finding 6. What a new player would find confusing, as a guess from the docs: six modes at the door;
"the most popular move is played" versus being scored on your own pick; why a boss exists in a chess game. One
30-second first match that teaches by playing would do more than any text.

**8. How you build.** Finding 9. Also:
- What's missing is people. Tests check what the builders thought of. Ten strangers for an hour will find what
  122 specs can't, and tell you which mode is the game.
- What's missing in tests: a cheating client. Every test plays an honest app. A small set of "the app lies" unit
  tests (host scores, boss moves, judge reports, made-up tickets) would guard findings 1 and 3 for good.
- Monitoring and alerts: already proposed on Nov 9. I agree it comes before launch.
- 62 PRs merged in 3 days is fast, and much of it is process fixing process. That is normal at this size, and the
  cure is less surface (finding 6), not more pipeline.

**9. Anything else.**
- Results that fail to save are swallowed in several places (`.catch(() => undefined)`). Count them on the ops
  page so a silent loss is visible.
- Before real players' data exists, rehearse one D1 restore.

## Quick wins (under an hour each)

1. Require sign-in on `/api/engine/score` and `/api/engine/ping`; give solo its own budget counter.
2. Pass `once` to `recordResult` in `lobby-do.ts:190`, and log its failure.
3. Clamp a device's claimed speed to what its first job measured (`lobby.ts:2602`).
4. Don't draw two judges with the same party or device marker.
5. Take the struck-through price off the shop page until a full price has really been charged.
6. Add the bundle's Mythic odds to the odds shown.
7. Alert when the engine budget passes 80%.
8. A grep test: no boss id inside `runner.ts` or `lobby.ts` beyond today's count, so it only goes down.

## To run (I couldn't)

- **Match-end save at size.** On staging with sign-in on, finish a Crowd match with 100 signed-in accounts. Count
  result rows (expect 100), time `saveResults`, and look for "Too many API requests" or subrequest errors in the
  logs.
- **Deploy mid-match.** Start a raid on staging, deploy during a scoring phase, and check the round finishes and
  results are written once.
- **The lying host.** In `packages/server/test`, drive `LobbyCore` as a host that (a) sends `bossMove` with the
  boss's worst allowed move each turn, and (b) sends `scores` that leave out its own pick. Today both should be
  accepted; that is the bug to pin.
- **Budget drain.** Against staging with an engine server, send 3,000 `POST /api/engine/score` and confirm lobbies
  then get no verdicts.
