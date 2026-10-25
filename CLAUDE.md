# Battle Royale Chess

## Follow the spec

`buildspec.md` is the brief. Read it before doing anything, and follow it. Where it's ambiguous, make the call and
record it in a new file in `docs/decisions/`.

## Language

American English everywhere: game text, lines, FAQ, docs, commits, PR text and chat (Eric, Oct 13). New code uses US
spelling in names too; older names (e.g. `colour`) stay until touched.

## Start here: how it works now

- **`docs/areas/`**: one short page per area (bosses, the God King, the match, matchmaking, the front door, accounts,
  chat, the shop, the engine, fair play, ops): how it works today, where the code is, its settings, its tests and
  the lessons that apply. Read your area's page before changing anything in it; `docs/areas/README.md` lists them.
- **`DECISIONS.md`**: why things are the way they are. It indexes every decision up to Oct 10, 2026 (now word for word
  in `docs/history/<area>.md`) and keeps the sections added up to Oct 15.
- **`docs/decisions/`**: every newer decision, one file each (`YYYY-MM-DD-short-title.md`), with the date and the
  reason. Never append to `DECISIONS.md`: one shared end made every pair of open PRs conflict (Oct 15, 2026).
- A PR that changes how an area works updates its page in `docs/areas/` in the same PR.

## How Eric likes to work (carried over from Word Trap)

- Keep Eric's involvement minimal. Make judgment calls yourself and record each one, with the reason, in its own
  file in `docs/decisions/`. Stop and ask Eric only for things only Eric can do: accounts or anything that costs
  money, testing on his real phone or computer, or reversing a rule he set.
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
  most popular move played; always 50 v 50 by team turns since Oct 15; pre-game votes always on). A boss raid is
  the one mode where everyone picks every move (`crowdTeams: false`). A mode is a preset over the same engine:
  `modeSettings()` / `CROWD_SETTINGS` in settings.ts. The pre-modes Classic is commit `bd726b5` on main.
- Next phase (accounts, profiles, matchmaking, ranked, coins/icons/emotes): see `ROADMAP.md` for the order and what
  needs Eric.
- Explain rules and scoring in plain language on screen. Real playtests drive changes, so make tweaks easy.
- **Simple beats flashy (Eric, Oct 14: "we want easier code and less lag over all else, fewer bug risks").** When an
  effect or feature can be built several ways, pick the one with the least code, the least lag on a phone and the
  fewest ways to break, and reuse what already works (e.g. an existing animation or effect) before writing new.
- **Nothing hidden, nothing shifts (Eric, Oct 18 and Oct 25).** Containers keep their size and place; a button, option or
  panel is never hidden behind another tap: it shows greyed until it applies. **Eric's standing rules** are in
  `docs/rules/eric.md`, each with the test that guards it: a change that breaks one, or edits a guard test, needs Eric's OK
  first, and every PR lists the test checks it changed or removed.
- **Computing priorities (Eric, Oct 8), in this order:**
  1. **Never compromise the game.** Fair scoring, correct results and smooth play come first, whatever it costs.
  2. **Use players' devices wherever they can do the job.** Judging, deep checks and other engine work go to
     connected devices first (computers before phones, checked against each other), so we don't spend when we
     don't need to.
  3. **Use our servers when they're truly needed:** too few capable devices, devices disagreeing, or a check that
     must be beyond any player's reach. Never skimp on the server when it's needed; never use it when a device would
     do.
- Never merge red: every PR runs the typecheck and unit tests on GitHub (`.github/workflows/check.yml`) and the e2e
  fast check (`.github/workflows/e2e.yml`: the specs of the areas it changes plus a smoke set); wait for `check` to pass
  and read the e2e run's result before merging anything that changes gameplay or screens.
- **Test lanes** (Eric, Oct 13: "why are we going through so many checks for changing numbers?"; Oct 18: "This game
  will never finish unless we work together to figure out a way to stop all these tests for every tiny thing taking an
  entire day. I should be able to tell you to add a boss and it should take an hour of a few agents running in
  parallel to finish and push, the testing is getting out of hand."):
  - **A trial** (Eric, Oct 18: "make a note that it's a test still and we may revert to our ways if quality
    degrades"). If quality drops, meaning bugs reach Eric's playtests that the old process would have caught, we go
    back to the previous rules: they're kept word for word in `docs/decisions/2026-10-18-faster-pipeline.md`.
  - **CI: the fast check on PRs, the full suite on main** (Oct 18). On a PR the `e2e` workflow runs the specs of the
    areas the PR changes plus a smoke set (the app boots, a solo battle plays, a lobby works, and every boss's smoke
    once the boss kit lands): about 4 to 8 minutes in all (measured Oct 18: 3 m 44 s for the smoke set alone, 5 m 28 s
    for one boss's file). `e2e/areas.json` maps paths to specs; a shared
    foundation (package.json, the lockfile, the Playwright config, `packages/core`, the runner, the protocol, the board,
    …) or a path it doesn't know runs the whole suite, and so does the `full-e2e` label. Every push to `main` runs the
    whole suite, both projects, on 5 runners (about 17 minutes). `docs/areas/ops.md`, "CI e2e". A new boss (or any new
    area) adds its paths and spec to `e2e/areas.json`, or its PRs keep running everything. CI retries a failed test
    once until the flaky-test batch lands (the goal is no retries); its `result` job lists flaky tests (passed only on
    the retry) first, then failed ones, each with its shard, `file:line`, project and error. Not a required check yet
    (the director decides when). Flakes only: "Re-run failed jobs" once; a test that fails again is real. Locally, run
    just the specs you're working on, and the `@perf` specs (frame budgets, which CI leaves out:
    `npx playwright test --grep @perf --project phone`), under the shared e2e lock.
  - **The director checks main's full run after every merge** and fixes red forward right away, before the next merge
    (or reverts). A red spec: re-run it once; if it's real, find the PR that caused it and fix it forward.
  - **Light lane** (numbers or data in settings or vote data, copy, CSS-only, docs): `check` and the PR's e2e run, plus
    the live check after the deploy. No sims: estimate instead.
  - **Targeted lane** (pre-launch default for logic: rules, the board, shared components, screens): `check` and the
    PR's e2e run (the touched areas' specs: the PR lists them and why), plus the live check. Eric, Oct 14: "if an agent
    is confident in its code we can reduce token usage and testing to a minimum". What a change touches decides its
    lane, never how confident its author is: the misses (the resign confirm over the board, Wrangler's showdown never
    firing, Oct 13-14) were all confident code.
  - **Boss lane** (boss content: powers, ults, art, wiring; Eric, Oct 18): targeted, plus the shared boss test kit
    (`packages/chess/test/boss-kit.test.ts`, `e2e/boss-smoke.spec.ts`), plus one quick review pass by a fresh helper
    (about 30 minutes, read-only, no fuzz marathons). No fix/re-review loops: its findings go into the same PR or a
    follow-up, and the author doesn't wait for a second review.
  - **Full lane** (the whole suite on the PR: add the `full-e2e` label; plus an independent review and delta
    re-reviews) stays for: stored data (D1 schema, migrations), money, odds and wallets, sign-in and security, fair
    play, changes to the shared client-server protocol's core (not a boss's optional fields), and anything the
    director marks.
  - **Helper testing budget** (Eric, Oct 18): prove a change with the fast checks (typecheck, the unit tests of the
    packages you touched), the touched area's e2e and the boss kit. No fuzz marathons or mutation runs unless the lane
    asks for them. One sim run at one setting. One set of visuals at the end. Aim for about an hour per helper.
  - When unsure, the targeted lane, and say so in the PR: the director decides.
  - **Pre-launch only.** `main` deploys to Eric alone (Zero Trust), so a slip costs a playtest, not players. At
    launch every logic change goes back to the full lane per PR, and PRs go back to the full suite.
- Classic (8 boards) will be reworked (Eric, Oct 5, 2026): don't invest in it until he decides the new design.
- Merge PRs with a **merge commit**, not squash: the working branch then stays part of `main`'s history, so the next
  push is a plain fast-forward (squash merges left the branch diverged, needing a force-push). After merging, bring
  the branch up to date with `git pull origin main` before the next change.
- The "Workers Builds: chessroyale" check fails instantly on PR branches: it's Cloudflare's preview build for
  non-production branches, not a code failure. Only `check` (and the e2e run) decide whether a PR is green. Production
  builds from `main` deploy as usual.

## Lessons

Read `.claude/LESSONS.md` before changing anything a player sees. When something slips past the tests, write its
story at the end of `docs/history/lessons.md` and add its rules to `.claude/LESSONS.md` (and to its area's page).
Above all: watch any board, move or animation change frame by frame with real taps (`npm run frames:boss`).

## Delegates

Specialist agents live in `.claude/agents/` (one file each: a name, when to use it, its instructions).
- **One director at a time:** the window Eric is using for the app as a whole. It designs, hands work to delegates,
  reviews what comes back and merges.
- **How the director runs a delegate:** it can run the delegate itself as a sub-agent in its own window (the Agent
  tool, with the agent's name), which is simplest for Eric. Or Eric can open a window for a delegate and paste a brief.
- **Same model, always (Eric, Oct 7):** delegates and every other helper run on the director's own model (the agent
  files say `model: inherit`). Never pick a smaller or cheaper model for any helper, built-in ones included: when
  starting one, leave the model unset or set it to the director's. Eric pays for the top model and wants it on all work.
- **Effort per task (Eric, Oct 11):** the model stays the same; the *effort* is chosen per task so the weekly usage
  goes further. Before starting a helper, the director weighs the task and sets the Agent tool's `effort` to `medium`,
  `high` or `xhigh`: never lower than `medium`, never higher than `xhigh`, and when torn between two, the higher one.
  Say which and why in one line of the brief.
  - `xhigh`: rules, scoring, the engine and judge, boss brains and their calibration, odds, coins and wallets, the
    server, protocol, accounts, stored data and migrations, security, online sync; anything where a bug could break a
    match or lose a player's data.
  - `high`: new features or screens with logic or stored settings; animation and timing work; research that needs
    judgment (licenses, design); docs that must match the code exactly (the FAQ); crate item art Eric reviews.
  - `medium`: CSS, layout and stacking tweaks; text and copy; docs-only updates; small investigations; one obvious bug
    with a clear fix and a test.
- **Working lean (Eric, Oct 17):** most of a helper's usage is re-reading its own history at every step (measured Oct
  17: the costliest helpers re-read 300 to 500 million tokens each and wrote 7 to 40 thousand), so steps times
  history is what to keep down. Checks are sized to the risk, not maxed out (Eric, Oct 18: "the testing is getting
  out of hand"; "I should be able to tell you to add a boss and it should take an hour of a few agents running in
  parallel to finish and push"): each change gets exactly what its lane and the helper testing budget under "Test
  lanes" ask for, no more and no less, at the effort its task calls for. A trial: see "Test lanes".
  - A review round, or a fix round after a merge, goes to a fresh helper with a one-page handoff (the PR, the
    findings, the files), not to a resumed one carrying hundreds of thousands of tokens. A helper mid-task keeps going.
  - Waiting (CI, a deploy, a local run) is one background command that reports when it's done, never a loop of looks.
  - Big output goes to a file: read its tail or grep it. Screenshots: look at the final ones, not every attempt.
    Small checks go together in one command.
  - After each batch of work the director runs `python3 .claude/tools/helper-usage.py <its task folder>` (one line per
    helper: steps, peak history, re-read, hours, waits, big outputs, images). Only when a helper stands out or a new
    waste pattern shows, it starts an audit helper (same model, `medium`, read-only) on those helpers. The audit only
    proposes: the director weighs each proposal, and Eric approves any that touch a quality gate (tests, reviews, CI,
    effort) or this file. Two audits in a row that change nothing retire it. `docs/decisions/2026-10-17-working-lean.md`.
- **Any other window works only in its own lane** and doesn't act as the director.
- **Before starting,** check `git log origin/main` and open PRs for work already in flight.
- Each piece of work goes on its own branch and PR.

- `item-builder`: crate items and shop cosmetics (definition, art, fit, odds, tests, shipping). Its fitting sheet:
  `npm run preview:items -- out.png items=<id>`.
- `engine`: Stockfish everywhere: the judge's fairness, the hybrid (host device + engine server), boss strength,
  engine costs and their sim reports.
- `god-king`: the God King and the boss battle's presentation: his powers (rules, server, protocol), sprite,
  portrait, banners, lines, sounds, the boss dock and its animations.
- `characters`: the raid bosses as characters: each boss's pixel-art sprite, portrait, animation pack and sound
  pack, the boss sprite component and its wiring to game events. Its previews: `npm run preview:characters -- <dir>`
  (GIFs and sheets) and `npm run frames:character -- <dir>` (in the game, phone and computer).
- `hub`: the front door: home, queue, online count, profiles (later leaderboards, ranked, friends), phone and desktop,
  front end and the server pieces behind them.
- `social`: how players talk to each other: quick chat (preset messages) now; emotes, friends, parties and muting
  later. Its panel sits in the game screens only where its design says.
- `ranked`: hidden skill ratings, ranks and rank points, seasons, ranked queues and skill-based matchmaking,
  leaderboard numbers (the `hub` shows them).
- `ops`: capacity, load tests, scaling choke points, monitoring, rate limits, graceful overload, running costs.
- `fairplay`: reports, cheat detection (signals from each match's judged moves, the suspicion score), flags, bans,
  the review page (`/admin/fairplay`) and appeals, and the cheater simulations that tune them.
- Lanes keep sessions out of each other's files. Run one delegate per lane at a time. Each decision is its own file in
  `docs/decisions/`: add your own files rather than rewriting others'. Each lane keeps its area pages in `docs/areas/`
  true.

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
  (`src/runner.ts`), the lobby protocol (`src/protocol.ts`) and Squads' rules (`src/squads/`, imported as
  `@chessroyale/chess/squads`; see `docs/areas/squads.md`).
- `packages/sim`: bot simulation that writes `reports/playtest.md`; `scripts/calibrate-rating.ts` fits the engine-rating
  curve (`packages/core/src/rating-curve.ts`, report in `reports/rating-calibration.md`) against Stockfish's UCI_Elo.
- `packages/app`: the web app (Vite + Preact, our own board in `src/board/`, Stockfish in Web Workers). Screens in `src/screens/`;
  `src/solo.ts` is solo play, `src/net.ts` multiplayer.
- `packages/server`: `src/lobby.ts` is pure, testable lobby logic; `src/lobby-do.ts` the Durable Object;
  `src/index.ts` routes `/api/*` and serves the app. Squads' lobby and parties: `src/squads-lobby.ts`,
  `squads-party.ts` (pure) and `squads-do.ts`. Config: `wrangler.jsonc` at the repo root.
- `packages/maia-worker`: the Maia box (Maia-3 in its own Web Worker; AGPL-3.0, its own README and license). A separate
  program: the game never imports it, only exchanges UCI-style text with the built worker (`/engine/maia/`).
- `e2e/`: Playwright tests that play full solo and two-player matches on emulated phones.

```sh
npm install
npm test                                       # vitest (engine tests run real Stockfish)
npm run typecheck
npm run dev                                    # app dev server (solo only; no API)
npx wrangler dev                               # app + API + Durable Objects at http://localhost:8787
npm run e2e                                    # Playwright, the whole suite (CI runs it on every push to main)
node e2e/ci-select.mjs files <path>...         # which e2e specs a PR changing these paths runs (e2e/areas.json)
npx playwright test e2e/solo.spec.ts           # one spec (locally: under the shared e2e lock)
npx playwright test --grep @perf --project phone   # the perf specs (frame budgets; CI leaves them out)
npm run simulate                               # bot simulation -> reports/playtest.md (about 1–2 hours)
npm run sim:squads                             # Squads bot simulation -> reports/squads-sim.md (about 15 min)
npx tsx packages/sim/scripts/calibrate-rating.ts   # refit the engine-rating curve (~20 min)
npx tsx packages/chess/scripts/build-openings.ts   # rebuild the opening library (~15 min, 4 engines)
```
