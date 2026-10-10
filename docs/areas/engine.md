# The engine and the judge

Lane: `engine`. The bosses' strength is here; their powers are on [bosses.md](bosses.md).

## How it works today

- **The judge.** Every pick is scored by Stockfish as an expected score (win plus half a draw, 0 to 1) at
  `engineNodes` (250k) per position, top lines first; the score a pick gets is its loss against the best move (the line
  with the highest score, not the first line). `packages/chess/src/uci.ts` (`UciEngine`) speaks UCI; the same code runs
  in Node (tests, sims: `src/node.ts`) and in the browser (a Web Worker pool, Stockfish 19 lite WASM:
  `packages/app/src/engine.ts`). The browser engine is deterministic (`reports/judge-determinism.md`).
- **Who scores, online: many judges.** Each board's scoring job (position, picks, bots; no names) goes to **two
  devices** drawn by the lobby, weighted by the speed each reported on joining. A device sends the engine's raw output;
  the lobby works out the board with the same code (`judge.ts`: `runJudgeJob`, `judgedBoard`). Two honest answers are
  identical (`JUDGES.tolerance` 0). A disagreement asks a third device and the engine server at once; strikes bench a
  device. Fewer than two capable devices (or `JUDGES.on` false): the lobby's **host** scores every round (`pickHost`
  prefers a connected computer over a phone). Knocked-out players' devices keep judging while their page is open.
- **Close calls are re-checked deeper** before a cut (`recheckCloseCalls()` in `runner.ts`: `recheckLoss`,
  `recheckMax`, `recheckNodes` 700k), only for groups with a human pick. The re-check goes first to the **engine
  server**: native Stockfish 17.1 (full network) in a Cloudflare Container (`engine/Dockerfile`, `engine/server.mjs`,
  class `EngineServer`, binding `ENGINE`, instance `standard-2`) at 2M nodes (`SERVER_RECHECK_NODES`). If it doesn't
  answer in time, the host re-checks on its own device. Server searches are capped per day by
  `ENGINE_DAILY_SEARCHES` (3000), counted in D1 (`engine_usage`); `ENGINE_OFF=1` turns the server off (local, e2e).
- **Deep checks on players' computers** (`JUDGES.deepOnDevices`) are built and ship **off**: the browsers' lite network
  is less accurate than the server's (`reports/deep-accuracy.md`), and fairness comes first.
- **Bosses' strength.** `bossMoveFrom` in `runner.ts` plays at a UCI_Elo set from the lobby's ratings (`bossElo`:
  weighted towards the best players, `bossEloOffset`, `bossEloRange`; the raid's tiers `BOSS_TIERS`, `bossFixedElo`;
  each boss's `offset` in `BOSS_ROSTER`; solo's difficulty `BOSS_DIFFICULTY`). Below `bossStumbleBelow` it may slip
  slightly (`bossSlipLoss`). The **blunder guard** (`bossMaxLoss`, `bossMaxLogitLoss`) forbids any move that throws
  material: "It's boss mode, not idiot mode." A power can limit the boss's moves too (it plays the best allowed one).
- **Judging with a power.** When a boss power limits the crowd's moves, the best move is the best of the allowed ones
  (`judgeTop`, `judgeCandidates`, `allowedSearch` in `boss-powers.ts`); Jefferson's fire counts a piece left to burn as
  gone (`fireJudged`). Shared with the `god-king` lane by agreement.
- **Brilliant moves** never come from a power-up move.

## Where the code is

| What | Where |
| --- | --- |
| UCI, top moves, scoring moves | `packages/chess/src/uci.ts`, `node.ts` |
| The judging job, the board's numbers | `packages/chess/src/judge.ts` |
| Re-checks, the boss's moves, bot picks | `packages/chess/src/runner.ts` |
| The browser's engine pool | `packages/app/src/engine.ts` |
| Many judges (lobby side) | `packages/server/src/judges.ts` (pure helpers), the flow in `lobby.ts` ("Many judges") |
| The engine server | `engine/`, `packages/server/src/engine.ts`; routes `/api/engine/ping`, `/api/engine/score` |
| Ratings from move losses | `packages/core/src/rating.ts`, `rating-curve.ts` |

## Settings

`engineNodes`, `recheck*`, `boss*` (strength, stumble, slip, blunder guard), `BOSS_TIERS`, `BOSS_DIFFICULTY`, `JUDGES`
in settings.ts; Worker variables `ENGINE_DAILY_SEARCHES`, `ENGINE_OFF`.

## Tests and tools

- Unit: `packages/chess/test/uci.test.ts`, `judge.test.ts`, `boss-guard.test.ts`, `top-cache.test.ts`, `bots.test.ts`,
  `packages/server/test/judges.test.ts`. (Engine tests run real Stockfish.)
- e2e: `e2e/judges.spec.ts` (with containers off).
- The container: Docker locally, or live via `/api/engine/ping` and `/api/engine/score` with the Access service-token
  headers (never print their values).
- Sims (`packages/sim/scripts/`, write to `reports/`): `judge-accuracy.ts`, `judge-cuts.ts`, `judge-determinism.ts`,
  `many-judges.ts`, `deep-accuracy.ts`, `deep-timing.ts`, `boss-blunders.ts`, `boss-sim.ts`, `calibrate-rating.ts`.

## Rules for this area

- Never compromise the game; use players' devices wherever they can do the job; the servers only when truly needed,
  and then without skimping (Eric's computing priorities, `CLAUDE.md`).
- Money is Eric's: never raise `ENGINE_DAILY_SEARCHES`, the container's size or count, or add a paid service without
  asking, with a monthly estimate.
- Measure before and after: a judge or boss change comes with a sim's before/after table in `reports/`.
- Never break the fallback: every server path degrades to the host's own engine.
- "The engine's best move" is the line with the highest score, not the first line.
