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
- Game modes (Oct 3, 2026): **Classic** (64 players, 8 boards, players rotate) and **Crowd** (100 players, one board,
  most popular move played; 50 v 50 or everyone moves; augment votes). A mode is a preset over the same engine:
  `modeSettings()` / `CROWD_SETTINGS` in settings.ts. The pre-modes Classic is commit `bd726b5` on main.
- Next phase (accounts, profiles, matchmaking, ranked, coins/icons/emotes): see `ROADMAP.md` for the order and what
  needs Eric.
- Explain rules and scoring in plain language on screen. Real playtests drive changes, so make tweaks easy.
- Never merge red: every PR runs the typecheck and unit tests on GitHub (`.github/workflows/check.yml`); wait for it
  to pass, and run the e2e suite (`npm run e2e`) yourself before merging anything that changes gameplay or screens.
- Classic (8 boards) will be reworked (Eric, Oct 5, 2026): don't invest in it until he decides the new design.
- Merge PRs with a **merge commit**, not squash: the working branch then stays part of `main`'s history, so the next
  push is a plain fast-forward (squash merges left the branch diverged, needing a force-push). After merging, bring
  the branch up to date with `git pull origin main` before the next change.
- The "Workers Builds: chessroyale" check fails instantly on PR branches: it's Cloudflare's preview build for
  non-production branches, not a code failure. Only `check` (and the e2e run) decide whether a PR is green. Production
  builds from `main` deploy as usual.

## Delegates

Specialist agents live in `.claude/agents/` (one file each: a name, when to use it, its instructions). The main session
directs; a delegate does one kind of work and reports back. Eric can also open a new session and talk to one directly
("use the item-builder agent to add …"). Each session works on its own branch and opens its own PR.

- `item-builder`: crate items and shop cosmetics (definition, art, fit, odds, tests, shipping). Its fitting sheet:
  `npm run preview:items -- out.png items=<id>`.
- `engine`: Stockfish everywhere: the judge's fairness, the hybrid (host device + engine server), boss strength,
  engine costs and their sim reports.
- `god-king`: the God King and the boss battle's presentation: his powers (rules, server, protocol), sprite,
  portrait, banners, lines, sounds, the boss dock and its animations.
- Lanes keep sessions out of each other's files. Run one delegate per lane at a time. In `DECISIONS.md`, add to your
  own sections rather than rewriting others'.

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
