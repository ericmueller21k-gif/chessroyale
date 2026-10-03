# Battle Royale Chess

## Follow the spec

`buildspec.md` is the brief. Read it before doing anything, and follow it. Where it's ambiguous, make the call and
record it in `DECISIONS.md`.

## How Eric likes to work (carried over from Word Trap)

- Keep Eric's involvement minimal. Make judgement calls yourself and record each one, with the reason, in
  `DECISIONS.md`. Stop and ask Eric only for things only Eric can do: accounts or anything that costs money, testing on
  his real phone or computer, or reversing a rule he set.
- Don't stop for review between milestones (Eric, Oct 2, 2026, overriding the spec's "stop after each milestone"):
  commit, push and keep going. Opening and merging your own PRs into `main` is fine; `main` auto-deploys.
- Hosting: Cloudflare (Workers + Durable Objects, deployed from GitHub) on Eric's account, same as Word Trap. Eric is
  happy to pay for hosting and services where it helps, including a good domain (Oct 3, 2026). Prefer Cloudflare's own
  products (custom domain, D1, KV, R2, Workers Paid if needed) so everything stays in one account. The actual
  purchase or sign-up is still Eric's to do: recommend what to buy, with the price, and ask.
- Phone-first and app-like, also good on a computer: big tap targets, no accidental scrolling or zoom, light and dark
  mode.
- Keep every tunable in one settings file (`packages/core/src/settings.ts`).
- Explain rules and scoring in plain language on screen. Real playtests drive changes, so make tweaks easy.

## Progress

- [x] 1. Match engine and scoring (`packages/core`, `packages/chess`)
- [x] 2. Simulation and playtest report (`reports/playtest.md`; settings decided in `DECISIONS.md`)
- [x] 3. Solo build (`packages/app`)
- [x] 4. Multiplayer lobbies (`packages/server`: Worker + Durable Object; deploy steps in `DEPLOY.md`)
- [x] 5. Spectating and polish (eval bar, install). Real-phone check by Eric: `TESTING.md`

## Layout and commands

- npm workspaces, TypeScript throughout.
- `packages/core`: pure match logic (stages, grouping, scoring, the draw, retirement, bot picks). No UI, network or
  chess-engine code.
- `packages/chess`: chess rules (chess.js), the Stockfish interface over UCI (`src/uci.ts`; Node transport in
  `src/node.ts`), the opening library (`data/openings.json`, built by `scripts/build-openings.ts`), the match runner
  (`src/runner.ts`) and the lobby protocol (`src/protocol.ts`).
- `packages/sim`: bot simulation that writes `reports/playtest.md`; `scripts/calibrate-rating.ts` fits the engine-rating
  curve (`packages/core/src/rating-curve.ts`, report in `reports/rating-calibration.md`) against Stockfish's UCI_Elo.
- `packages/app`: the web app (Vite + Preact, chessground board, Stockfish in Web Workers). Screens in `src/screens/`;
  `src/solo.ts` is solo play, `src/net.ts` multiplayer.
- `packages/server`: `src/lobby.ts` is pure, testable lobby logic; `src/lobby-do.ts` the Durable Object;
  `src/index.ts` routes `/api/*` and serves the app. Config: `wrangler.jsonc` at the repo root.
- `e2e/`: Playwright tests that play full solo and two-player matches on emulated phones.

```sh
npm install
npm test                                       # vitest (engine tests run real Stockfish)
npm run typecheck
npm run dev                                    # app dev server (solo only; no API)
npx wrangler dev                               # app + API + Durable Objects at http://localhost:8787
npm run e2e                                    # Playwright: solo, multiplayer, install (multiplayer takes ~5 min)
npm run simulate                               # bot simulation -> reports/playtest.md (about 1–2 hours)
npx tsx packages/sim/scripts/calibrate-rating.ts   # refit the engine-rating curve (~20 min)
npx tsx packages/chess/scripts/build-openings.ts   # rebuild the opening library (~15 min, 4 engines)
```
