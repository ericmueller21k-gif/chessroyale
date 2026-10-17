# The engine and the judge

Lane: `engine`. The bosses' strength is here; their powers are on [bosses.md](bosses.md).

## How it works today

- **The judge.** Every pick is scored by Stockfish as an expected score (win plus half a draw, 0 to 1) at
  `engineNodes` (250k) per position, top lines first; the score a pick gets is its loss against the best move.
  `packages/chess/src/uci.ts` (`UciEngine`) speaks UCI; the same code runs in Node (tests, sims: `src/node.ts`) and in
  the browser (a Web Worker pool, Stockfish 19 lite WASM: `packages/app/src/engine.ts`). The browser engine is
  deterministic (`reports/judge-determinism.md`).
- **The best move is the highest-scored pick** (`docs/decisions/2026-10-16-the-best-move-is-the-highest-scored.md`):
  the judge's best (the top-8 search's first line, or what the re-check made best), unless a pick scored above it
  (`bestOf` in `packages/core/src/scoring.ts`; a tie keeps the judge's best). `resolveBoard` names it on every path, so
  the reveal, the God King's move and the exchange check follow the move every loss is measured from. Before that, the
  re-check weighs such a pick against the first line like for like: the re-check stays anchored on the first line, and
  a pick above it is searched with any re-check, and starts one when the first line's pickers lose 5+ points to it (1+
  near the cut) (`recheckTargets`). It happens in about 3% of positions, nearly always another line of the top-8 search
  (a line not searched again at the last depth keeps the depth before's score), hardly ever the second search over
  picks outside the top 8 (`reports/best-move-gap.md`).
- **Positions Stockfish refuses** (DECISIONS.md, "Engines' exits never reach the page", Oct 15): Stockfish 19 ends its
  process on a position it refuses (a ninth pawn, more pieces than promotions could make, the side not to move in
  check, …), and a browser worker's exit was thrown into the page. `stockfishRefuses` (`uci.ts`) holds its rules
  (checked against the real engine), and `UciEngine` never sends such a position: no lines, no scores, or "no move".
  One rule more than Stockfish 19's own: a castling right without its rook and king in place (19 drops it; the engine
  server's 17.1 crashes on it). Every engine worker's error stays in the worker (`preventDefault` in `engine.ts`,
  `maia.ts`).
- **The engine server never gets one either** (DECISIONS.md, "The engine server never gets a position Stockfish
  refuses", Oct 15): one would end the container's Stockfish, and every lobby's re-checks with it. Every search the
  Worker sends the container goes through `containerScore` (`packages/server/src/engine.ts`: `serverScoreAt`'s and
  fair play's), which checks first: not sent, "no answer", one log line. `/api/engine/score` answers 400 for one,
  before the day's budget; fair play's deep re-check passes one over. `engine/server.mjs` has no copy of the rules
  (only the Worker can reach it). Its own Stockfish (17.1) is checked against the same rules in CI (DECISIONS.md, "The
  engine server's own Stockfish, checked in CI", Oct 15): `.github/workflows/engine-container.yml` builds the image
  and sends it every case in `packages/chess/test/stockfish-refuses-cases.ts` through `server.mjs`; each one
  `stockfishRefuses` lets through must be searched with the server answering on (`engine-container.test.ts`). It
  runs when `engine/`, `uci.ts` or the check change, or by hand, in about a minute.
- **Who scores, online: many judges.** Each board's scoring job (position, picks, bots; no names) goes to **two
  devices** drawn by the lobby, weighted by the speed each reported on joining. A device sends the engine's raw output;
  the lobby works out the board with the same code (`judge.ts`: `runJudgeJob`, `judgedBoard`). Two honest answers are
  identical (`JUDGES.tolerance` 0). A disagreement asks a third device and the engine server at once; strikes bench a
  device. Fewer than two capable devices (or `JUDGES.on` false): the lobby's **host** scores every round (`pickHost`
  prefers a connected computer over a phone). Knocked-out players' devices keep judging while their page is open.
- **Squads' bots** get their engine's top moves from players' devices the same way (the page's one speed check,
  `engineSpeed()`, then `botWork` jobs on the engine pool; [squads.md](squads.md), "The server" and "The screens").
- **Close calls are re-checked deeper** before a cut (`recheckCloseCalls()` in `runner.ts`: `recheckLoss`,
  `recheckMax`, `recheckNodes` 700k), only for groups with a human pick, in one search with the best move (the anchor),
  and with any pick scored above it. A device's re-check that leaves out only the picks above the first line (an older
  app's pattern) isn't compared with the server's for blame; any other omission is. The re-check goes first to the
  **engine server**: native Stockfish 17.1 (full network) in a Cloudflare Container (`engine/Dockerfile`, `engine/server.mjs`,
  class `EngineServer`, binding `ENGINE`, instance `standard-2`) at 2M nodes (`SERVER_RECHECK_NODES`). If it doesn't
  answer in time, the host re-checks on its own device. Server searches are capped per day by
  `ENGINE_DAILY_SEARCHES` (3000), counted in D1 (`engine_usage`); `ENGINE_OFF=1` turns the server off (local, e2e).
  The reports measured the re-check with the full-network Stockfish 19 build standing in for the server; the
  container's own 17.1 reads the same re-checks 3.2 points apart on average (`reports/container-accuracy.md`), so
  moving it to Stockfish 19 (built from the browsers' stockfish.js source) is recommended (DECISIONS.md, "The engine
  server's own Stockfish, checked in CI").
- **Deep checks on players' computers** (`JUDGES.deepOnDevices`) are built and ship **off**: the browsers' lite network
  is less accurate than the server's (`reports/deep-accuracy.md`), and fairness comes first. A device whose re-check
  leaves out only the picks above the first line (an older app's pattern) is never blamed, which a device could copy
  to dodge blame: revisit before turning this on.
- **Bosses' strength.** `bossMoveFrom` in `runner.ts` plays at a UCI_Elo set from the lobby's ratings (`bossElo`:
  weighted toward the best players, `bossEloOffset`, `bossEloRange`; the raid's tiers `BOSS_TIERS`, `bossFixedElo`;
  each boss's `offset` in `BOSS_ROSTER`; solo's difficulty `BOSS_DIFFICULTY`). Below `bossStumbleBelow` it may slip
  slightly (`bossSlipLoss`). The **blunder guard** (`bossMaxLoss`, `bossMaxLogitLoss`) forbids any move that throws
  material: "It's boss mode, not idiot mode." A power can limit the boss's moves too (it plays the best allowed one).
- **The boss's brain (DECISIONS.md: "A human-like boss: Maia-3 for Ginger", Oct 11; "Every boss on Maia", Oct 12).**
  Every boss plays its normal moves with **Maia-3** (CSSLab, University of Toronto: human moves at a rating), not
  Stockfish, up to the strength where Stockfish must take over (`BOSS_BRAIN`, `bossBrainFor`, `maiaRatingFor`).
  - **The Maia box:** a separate AGPL program (`packages/maia-worker/`, its own README and license): a module worker at
    `/engine/maia/` (the official 23M checkpoint converted to int8 ONNX, 24 MiB, run by onnxruntime-web on one thread,
    about 80 ms a move here). The game only exchanges UCI-style text with it (`HumanUciEngine`).
  - **Its source, on the site** (DECISIONS.md, "The Maia box's source on the site", Oct 14): the box's build writes its
    complete source as `maia-box-source.tar.gz` beside the worker (`scripts/source-archive.mjs`: every box file but the
    model, plus a lockfile cut from the workspace's, `model/README.txt` and `SHA256SUMS.txt`), served at
    `/engine/maia/maia-box-source.tar.gz`; extracted, `npm ci` and `node scripts/build.mjs` rebuild the served files
    byte for byte. The model is linked (served beside it; CSSLab's checkpoint pinned), not bundled again. Stockfish's
    build's source is served the same way: `/engine/stockfish-source.tar.gz`, committed in
    `packages/app/stockfish-source/` (the npm package has none; the build refuses a version without its archive).
  - **The rule** (`BOSS_BRAIN`): the boss's **level** is its strength, plus `crowdMargin` (400) when more than one picks
    the crowd's moves. Maia plays at `maiaRatingFor(level)`: 600 (its floor) up to a level of 1800, 850 at 2000, 1100
    at 2250, 2000 at 2400, held at 2500 from 2650 (`reports/maia-calibration.md`; Eric, Oct 12: the boss clearly
    favored, a crowd or a lone player scoring about 0.30 in plain chess). Below a level of `bridgeFrom` (2400) Maia's
    own draw (`maia-raw`, no guard: Eric) at temperature 0.8, top-p 0.9; from 2400 the light guard (25 points / 2
    logits), from `bridgeStrictFrom` (2800) the strict one (4 / 0.5): the guard follows the level, so a crowd meets it
    sooner (one player never meets the strict guard: Stockfish takes over at a strength of 2800).
    Stockfish's share of the moves follows the strength: none up to `bridgeShareFrom` (2500), then growing in a line to
    all of them (`bridgeStockfishShare`) just under `stockfishFrom` (2800); from 2800 Stockfish, as before. The guards
    veto from the boss's own top-8 search (no extra search): Maia's next likely move, else Stockfish's best.
  - **Within the powers:** Maia is asked for the allowed moves only (`searchmoves`), and nothing else is played; none of
    its moves allowed: today's Stockfish move. The King's strike, Boingo's funhouse move for the crowd, Hollow's extra
    move and Big Boy's bounce keep their own Stockfish picks; a reply its power's search scored (Wrangler's to the
    showdown's duel: `BossRules.bestReply`, `bossRequest.best`) is Stockfish's best at full strength, Maia not asked;
    Maia's own mistakes replace the slips. **The last checks** (Oct 17; docs/decisions/2026-10-17-power-limits-said-on-screen.md):
    whatever path picked it, `bossMoveFrom` checks its own pick against the allowed moves (any legal move when nothing
    limits him): one that isn't (an engine's answer for another position, a Maia move not legal here) is logged and
    his best allowed move played (`bestReplyFrom`); the runner's `applyBossMove` (solo and the server) plays the first
    allowed move for anything else a host sends, and logs it. Every power × brain path is tested
    (`packages/chess/test/boss-power-legal.test.ts`).
  - **Never waited on, move by move:** not ready, failed, or no answer in 1.5 s (`timeoutMs`): today's move. A slow
    or old device falls back to Stockfish this way. Only a solo battle's start waits for it (the loading step, below).
  - **Where:** every boss battle, solo (`startBrain` in `solo.ts`, the runner's `humanBrain`) and online (the lobby
    decides the battle's plan once, `bossBrainNow`; the host is told as the intro starts, `bossBrain`, and each boss
    request carries it; the host's device plays Maia's move and the server sends that one move to everyone).
  - **Who:** everyone. `forPlayers` is on since Oct 14 (Eric: "flip it", once the source was published), so players
    meet Maia by the same rule as admins, in every mode; admins also get the Brain picker and the debug line
    (`MAIA_TEST=1` in `wrangler dev` for the e2e). A device that may not run Maia never downloads
    it and plays Stockfish's move as host. `forPlayers` is the only gate: on, a player's device runs the same rule
    (`maiaAllowed`, `soloBrain`; online `bossBrainNow`), with no admin's pick and no debug line.
  - **Loading:** the files are fetched ahead when a battle on Maia may come (the boss menu, a Solo raid's queue, a raid
    lobby on a device that may run it, the Crowd's vote for a boss battle; files the service worker already keeps
    aren't read again); the worker ends with the battle.
  - **The loading step, solo** (DECISIONS.md, "Maia's loading step", Oct 14; Eric's iPhone failed to load Maia beside
    the battle's Stockfish): before the intro of a solo battle on Maia (Boss alone, a Solo raid, the Crowd's boss
    battle), the boss screen holds the intro's first frame under a card, "Loading the boss…", with the download's bar
    (bytes of the three files, their sizes written in by the build since live the worker and the WebAssembly come
    compressed; a sliding bar when unknown; "First time only: about 40 MB, then it's saved on this device."), then
    "Starting…" while Maia starts (at once when its files are kept), and Leave (before move 1). Meanwhile this device's
    **Stockfish is paused**: its workers end once the work asked for is done (their WebAssembly memory freed), work
    asked for meanwhile waits, and fresh workers start once the step ends (`UciEngine.pause`, `pauseEngines`); Maia's
    model loads only after they've ended. A load that fails short of memory or with no backend is tried once more
    from a fresh worker. At most `BOSS_BRAIN.loadGateMs` (20 s) from the start; then the battle begins whatever
    happened (not ready: Stockfish until it is, as before). If a fresh Stockfish doesn't answer within
    `stockfishBackMs`, Maia is closed and Stockfish started again (the battle needs Stockfish, not Maia).
    `maia-gate.ts` (`MaiaGate`), `startBrain` in `solo.ts`, `BrainLoading.tsx`.
  - **Online, unchanged:** nothing waits; the host's device starts Maia as the intro begins (the lobby's `bossBrain`),
    with its Stockfish running (judging, the boss's moves), and plays Stockfish's move until Maia is ready (or for the
    battle, if it fails).
  - **Its memory:** onnxruntime's build is the threaded one (one thread here) and its WebAssembly memory is shared, with a
    4 GiB maximum that a shared memory reserves up front; the box caps it at 512 MiB (`MEMORY_MAX_PAGES` in its
    `model.ts`; the model uses about 70 MB of it). Its load errors come whole, on one line (`errorText`), and a phone's
    admins' line wraps (a computer's pill stays one line, the whole text on hover).
- **Judging with a power.** When a boss power limits the crowd's moves, the best move is the best of the allowed ones
  (`judgeTop`, `judgeCandidates`, `allowedSearch` in `boss-powers.ts`); Jefferson's fire counts a piece left to burn as
  gone (`fireJudged`). Shared with the `god-king` lane by agreement.
- **Brilliant moves** never come from a power-up move.
- **Chess960 (Fischer Random)** (DECISIONS.md, "Chess960's rules", Oct 14): the rules foundation for the hidden boss's
  phase 2, not wired into any boss yet. A Chess960 position is a FEN whose castling field names its rooks by file
  (Shredder-FEN: "HAha", "HFhf"); `UciEngine` and the engine server switch `UCI_Chess960` on just before one and off
  before the next normal position, judged from the FEN (a normal search sends exactly the commands it always did).
  With it on, Stockfish writes castling as the king taking its own rook (e1h1), which is how our Chess960 rules
  (`packages/chess/src/chess960.ts`) write it, so its moves need no translation; scores, top moves and `playAtElo` work
  as they are. `rules.ts` routes Chess960 positions to those rules (normal ones run chess.js as before), so the judge's
  `scoreAfter` fallback works on them too.

## Where the code is

| What | Where |
| --- | --- |
| UCI, top moves, scoring moves | `packages/chess/src/uci.ts`, `node.ts` |
| The judging job, the board's numbers | `packages/chess/src/judge.ts` |
| Re-checks, the boss's moves, bot picks | `packages/chess/src/runner.ts` |
| The browser's engine pool | `packages/app/src/engine.ts` |
| Many judges (lobby side) | `packages/server/src/judges.ts` (pure helpers), the flow in `lobby.ts` ("Many judges") |
| The engine server | `engine/`, `packages/server/src/engine.ts` (`containerScore`: the one way in); routes `/api/engine/ping`, `/api/engine/score`; its CI check `.github/workflows/engine-container.yml` (`packages/chess/test/engine-container.test.ts`) |
| The positions refused (rules, cases) | `stockfishRefuses` in `packages/chess/src/uci.ts`; `packages/chess/test/stockfish-refuses-cases.ts` |
| Ratings from move losses | `packages/core/src/rating.ts`, `rating-curve.ts` |
| The boss's brain: the rule, the text client | `packages/chess/src/boss-brain.ts`, `human-uci.ts`; `bossMoveFrom` in `runner.ts` |
| Maia in the browser (start, prefetch, free) | `packages/app/src/maia.ts`, `boss-brain.ts` (who may run it; the admins' pick), `solo.ts` (`startBrain`), `net.ts` (`useBrain`, `hostBoss`) |
| The loading step (solo): Stockfish paused, Maia alone | `packages/app/src/maia-gate.ts`, `components/BrainLoading.tsx`; `pauseEngines` in `engine.ts`; `UciEngine.pause` (`uci.ts`), `HumanUciEngine.loaded` |
| The online plan | `packages/server/src/lobby.ts` (`bossBrainNow`, the `bossBrain` message, the boss request's `brain`) |
| The Maia box (AGPL: worker, conversion, model) | `packages/maia-worker/` (README.md), built into `/engine/maia/` |
| The engines' source archives | `packages/maia-worker/scripts/source-archive.mjs` (→ `/engine/maia/maia-box-source.tar.gz`); `packages/app/stockfish-source/` (→ `/engine/stockfish-source.tar.gz`, copied by `vite.config.ts`) |
| Chess960: start positions, rules, SAN, perft; `UCI_Chess960` | `packages/chess/src/chess960.ts`, routed from `rules.ts`; `setPosition` in `uci.ts`; `engine/server.mjs` |

## Settings

`engineNodes`, `recheck*`, `boss*` (strength, stumble, slip, blunder guard), `BOSS_BRAIN` (Maia; its loading step:
`loadGateMs`, `stockfishBackMs`, `downloadMb`), `BOSS_TIERS`,
`BOSS_DIFFICULTY`, `JUDGES` in settings.ts; Worker variables `ENGINE_DAILY_SEARCHES`, `ENGINE_OFF`.

## Tests and tools

- Unit: `packages/chess/test/uci.test.ts`, `stockfish-refuses.test.ts` (each rule against the real engine, on the
  cases in `stockfish-refuses-cases.ts`; never a real game's position, Chess960 too; never sent), `judge.test.ts`, `boss-guard.test.ts`, `top-cache.test.ts`, `bots.test.ts`,
  `packages/server/test/judges.test.ts`, `engine-server.test.ts` (a refused position never reaches the container, from
  any path; a legal one does, Chess960 too). (Engine tests run real Stockfish.)
- The best move (a pick above the first line): `packages/chess/test/best-move.test.ts` (solo, the lobby's numbers, a
  judge's board, the re-check's targets and anchor, other re-checked picks, the exchange check, the God King with and
  without a re-check, every judge alike), `packages/app/test/host-score.test.ts` (the host), `judges.test.ts` ("the
  best move is the highest-scored pick": two judges, the engine server's re-check, devices' re-checks, an older host,
  an older app's device beside this one's, any other omission from a re-check still blamed), `bestOf` in `packages/core/test/scoring.test.ts`; `e2e/boss-dock.spec.ts` (the dock's
  "Best move · You: …", and the verdict whole at 320/360/390 px).
- e2e: `e2e/judges.spec.ts` (with containers off); `e2e/sawyer.spec.ts`'s last test (a refused position never sent;
  a worker's exit kept off the page, the engine answering on).
- Chess960: `packages/chess/test/chess960.test.ts` (perft against the published table, each castling rule, FEN, SAN,
  random games against chess.js), `chess960-engine.test.ts` (the commands sent, Stockfish's FEN, perft and moves
  against ours, scoring and `playAtElo` on Chess960).
- The container: in CI, `engine-container.yml` (the image built, its own Stockfish over HTTP on every refusal case,
  each case's verdict in the run's summary, and one search as the game asks, 2M nodes: about 2.5 s there); Docker
  locally (`ENGINE_IMAGE=<tag> npx vitest run packages/chess/test/engine-container.test.ts`, skipped without it); or
  live via `/api/engine/ping` and `/api/engine/score` with the Access service-token headers (never print their
  values). `npx tsx packages/sim/scripts/container-accuracy.ts` (Docker) sets its numbers on the re-checks against
  the Stockfish 19 stand-in of `reports/deep-accuracy.md` (`reports/container-accuracy.md`).
- The brain: `packages/chess/test/boss-brain.test.ts` (the rating lines, the bridge, the brains' choices with made-up
  candidates, the fallbacks, the text client), `maia-bosses.test.ts` (every boss's Maia path in a battle),
  `packages/server/test/boss-powers-lobby.test.ts` ("the boss's brain online"); `packages/app/test/maia-players.test.ts`
  (`forPlayers` on: a player's boss on Maia by the rule, solo); `packages/app/test/maia-gate.test.ts` (the loading
  step: Stockfish first, the time limit, the one retry, leaving; the bar's sums; `downloadMb` against the files);
  `packages/chess/test/uci-pause.test.ts` (`UciEngine.pause`, its revive; `HumanUciEngine.loaded`);
  `packages/maia-worker/test/` (the encoder against the official tokenizer, the protocol and its whole error text, the
  int8 model in onnxruntime-web and its capped memory, the source archive);
  `packages/app/test/engine-source.test.ts` (Stockfish's archive); `e2e/maia.spec.ts` (also: both archives served; the
  loading step: Stockfish's workers ended before Maia's load and no search in it, then the battle on Maia; a missing
  model: the step gives up, Stockfish plays, the line says why);
  `npx tsx packages/sim/scripts/maia-calibration.ts` (`reports/maia-calibration.md`), `maia-sim.ts`
  (`reports/maia-boss.md`).
- Sims (`packages/sim/scripts/`, write to `reports/`): `judge-accuracy.ts`, `judge-cuts.ts`, `judge-determinism.ts`,
  `best-move-gap.ts` (how often a pick scores above the first line, and what a like-for-like search says),
  `many-judges.ts`, `deep-accuracy.ts`, `container-accuracy.ts` (Docker), `deep-timing.ts`, `boss-blunders.ts`,
  `boss-sim.ts`, `calibrate-rating.ts`.

## Rules for this area

- Never compromise the game; use players' devices wherever they can do the job; the servers only when truly needed,
  and then without skimping (Eric's computing priorities, `CLAUDE.md`).
- A power that changes the position outside a move (a piece added, removed or moved) never makes one Stockfish
  refuses (`stockfishRefuses`): check it there, as Sawyer's `splitRoom` does; the engine's own check is the last line.
  That includes castling rights: a rook or king moved or removed takes its rights with it (`withoutPiece`, Pig's
  `fenWith`).
- A new kind of position to refuse (or let through) goes in `stockfish-refuses-cases.ts`: `npm test` checks it against
  the browsers' Stockfish 19, `engine-container` against the server's. A change to `engine/` (a new Stockfish, say)
  runs that check: keep it green.
- Every search sent to the engine server goes through `containerScore` (`packages/server/src/engine.ts`), never a
  `fetch` of its own: it's where positions Stockfish refuses stop.
- Money is Eric's: never raise `ENGINE_DAILY_SEARCHES`, the container's size or count, or add a paid service without
  asking, with a monthly estimate.
- Measure before and after: a judge or boss change comes with a sim's before/after table in `reports/`.
- Never break the fallback: every server path degrades to the host's own engine.
- "The engine's best move" is the line with the highest score, not the first line. A board's best is `bestOf`'s,
  named in `resolveBoard` after any re-check; the re-check's choice of moves is `recheckTargets`'s, the same for every
  judge. Neither is worked out anywhere else.
- Stockfish's output goes through `searchLines` (`uci.ts`, the same in `engine/server.mjs`; keep the two the same): a
  slot's last exact line may name another move, so a move listed twice is read again by move (DECISIONS.md, "The
  engine reader", Oct 14).
- The FAQ explains the judge, the re-check and the boss's brain and strength to players (`packages/app/src/faq/content.ts`):
  a change to how they work changes its words in the same PR.
- The Maia box stays a separate program: nothing in the game imports it, and nothing in it imports the game; only
  text goes between them (Eric's license decision). Its source is public (`/engine/maia/maia-box-source.tar.gz`): a
  new file in the box lands in the archive by itself, and nothing from the game may go in it (its test checks).
- A new Stockfish version needs its source archive in `packages/app/stockfish-source/` first (the build stops
  without one; its README says how it was made).
