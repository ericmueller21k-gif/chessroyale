# Faster pipeline, a trial: the fast check on PRs, the full suite on main, and the new lanes (Oct 18, 2026)

**Eric:** "This game will never finish unless we work together to figure out a way to stop all these tests for every
tiny thing taking an entire day. I should be able to tell you to add a boss and it should take an hour of a few agents
running in parallel to finish and push, the testing is getting out of hand."

**A trial.** Eric: "make a note that it's a test still and we may revert to our ways if quality degrades." If quality
drops, meaning bugs reach Eric's playtests that the old process would have caught, we go back to the previous rules:
they're quoted word for word at the end of this file, and the old workflow is on `main` at `e80ceb6` (see "Reverting").

## Eric's decisions (asked and answered the same day)

1. **CI:** PRs run a fast check, about 8 minutes: typecheck, unit tests, and the browser tests for the changed area.
   The full browser suite runs after merging to main, and if main goes red the director fixes forward right away.
   (Safe pre-launch: main deploys behind Cloudflare Access to Eric alone.)
2. **Boss content** (powers, ults, art, wiring): one quick review pass per boss, no fix/re-review loops. Findings go
   into the same PR or a follow-up. Full independent reviews stay for money, sign-in and security, stored data (D1),
   and fair play.
3. **A shared boss test kit** (`packages/chess/test/boss-kit.test.ts`, `e2e/boss-smoke.spec.ts`; built separately,
   `2026-10-18-boss-test-kit.md`) runs in the fast check.

## What changed

- **`.github/workflows/e2e.yml`:** a `plan` job first (`e2e/ci-select.mjs`). On a pull request it diffs the PR's merge
  commit against its first parent and looks each changed path up in **`e2e/areas.json`** (path globs to spec files,
  area by area); the PR runs those specs, any spec it changes, and the smoke set, on as few shards as they need. A
  shared foundation, a path no area has, or the **`full-e2e` label** runs every spec. A push to main (and a manual
  run) runs every spec on 5 shards, as before. Retry-once, the traces and the `result` job's report (flaky, then
  failed) are the same for both; `result` now also shows the plan's line and is red if the plan fails.
- **`e2e/ci-shard.mjs`** spreads the plan's files (every spec file when it has none), with the weights shared with
  the plan; **`e2e/ci-timings.json`** refreshed from two full runs of Oct 18 (it lacked the 15 newest specs, so one
  shard of main's run took 21 minutes against 12 for another).
- **`CLAUDE.md`:** "Test lanes" (the fast check, the director's check of main after every merge, the boss lane, the
  full lane's list, the helper testing budget, this trial) and "Working lean" (checks sized to the risk, in place of
  "Never at the cost of a check: tests, reviews, the CI gate and effort stay as they are."). The agent files' "CI runs
  the whole e2e suite on the PR" lines now say what CI runs.
- **`docs/areas/ops.md`, "CI e2e":** how a run is planned, the smoke set, what runs everything, forcing a full run,
  timings.

## Judgment calls

- **A `plan` job and as many shards as the specs need** (about 600 s of test time a shard, both projects, so about 5
  minutes on the clock with 2 workers; at most 5), not 5 fixed shards each filtering the list: one place decides and
  explains (the run's page lists every changed path and what it ran), and a small PR takes 1 to 3 runners instead of
  5, which matters with a few agents' PRs at once against GitHub Free's 20 jobs at a time. It costs about 10 to 15 s
  (no install: plain Node). Never more shards than the full run's 5.
- **The diff:** the PR's merge commit against its first parent (`fetch-depth: 2`), i.e. what the PR changes on top of
  main as it is now, with deleted paths included (`--no-renames`), so a rename's old path counts too.
- **The order a path is looked up in:** `full` first (any match runs everything), then every area that has it (their
  specs, all of them), then `none` (nothing), then the fail-safe: anything else runs everything. So a broad `none`
  glob (`**/*.md`, `packages/*/test/**`) can't hide an area's file, and `full` globs are exact (`packages/core/src/**`,
  so a unit test in `packages/core/test/` doesn't run everything).
- **The smoke set:** `front-door.spec.ts` (home, Settings, the queue and the computer's layout, through the real
  server: the app boots; about 55 s), `boss-character.spec.ts` (a whole Boss alone battle from home to results on
  both layouts: a solo battle plays; about 40 s) and `lobby-chat.spec.ts` (two players in one lobby through the real
  server, bots fill it, the match starts; Solo's queue; a private lobby: a lobby works; about 85 s), plus
  `boss-smoke.spec.ts` once it exists. Cheaper candidates prove less: `install.spec.ts` (2 s) never shows home;
  `busy.spec.ts` (17 s) mocks the server's answer; `solo.spec.ts` (about 7 minutes) and `multiplayer.spec.ts` (about
  5) are the expensive way to prove the same.
- **Foundations (`full`):** the brief's (package.json, the lockfile, the Playwright config, `packages/core`, the
  runner, the protocol), plus what every spec or every mode stands on: `e2e/helpers.ts`, this workflow and its
  scripts, the Wrangler config, the workspace and TypeScript configs, chess's shared rules (`rules.ts`, `judge.ts`,
  `uci.ts`, `bots.ts`, `boards.ts`, `openings.ts` and its data, `chess960.ts`, `index.ts`), the server's entry points
  (`index.ts`, `api.ts`, `lobby.ts`, `lobby-do.ts`, `lobby-options.ts`), the app's entry and build (`main.tsx`,
  `index.html`, `vite.config.ts`, the service worker, the fonts), the board, the match flow (`game.ts`, `solo.ts`,
  `net.ts`, `engine.ts`), `account.ts`, `prefs.ts`, `hooks.ts`, `test-switches.ts`, the play screen and HUD, and the
  components every mode shares (the clocks, the countdown, the eval bar, history, …). And, as a fail-safe for the full
  lane, the server's stored-data, sign-in, money, ranked and fair-play files (`*-schema.ts`, `accounts.ts`,
  `account-data.ts`, `access.ts`, `admin.ts`, `locker.ts`, `ranked.ts`, `fairplay*.ts`): those PRs need the whole
  suite anyway, so it runs even if the label is forgotten.
- **`styles.css` is not a foundation;** it runs the specs that measure layouts (home's, the panel's, the boss dock's,
  the eval bar's, the match screen's, the boss select's) on top of the smoke set and whatever else the PR touches.
  The brief lists "styles that affect every screen" as a foundation, but here every screen's styles are one 17,000-line
  file, touched by 19 of the last 40 PRs: as a foundation it would send most screen work to the full suite. A rule
  that leaks onto another screen is caught by main's full run. **`App.tsx`** likewise runs home's specs (and the smoke
  set boots it). Either is one line to move into `full` if the director prefers.
- **`package.json` stays a foundation, as the brief says,** even when a PR only adds a `frames:*` script (2 of the last
  40, both boss wiring PRs): such a PR runs everything. A boss PR can run its frames script with `node scripts/…`
  instead of adding it.
- **`e2e/areas.json` and `e2e/ci-timings.json` are not foundations:** a new boss's PR adds its area to the table
  without running everything for it (main's run checks every spec anyway).
- **A changed spec runs itself;** a removed one runs nothing; the `@perf` spec never runs on a PR (`leftOut`).
- **The `full-e2e` label:** the workflow also starts on `labeled`, so adding the label starts a full run at once and
  every later push runs everything until it's removed. Any other label restarts the run as it was (labels aren't used
  in this repository, so that's rare). A manual run (Actions → e2e → Run workflow, on the branch) tests everything too.
- **A spec in no area** fails the unit test (`ci-select.test.ts`), so a new spec is always reachable from some change.
  A new source file in no area doesn't fail anything: it runs everything until someone adds it.

## What it means in practice

Replaying the last 40 PRs (#238 to #277) through the table: **14 take the fast path, 26 run everything.** No single
foundation decides it: the 26 each touch several (most logic PRs change `settings.ts`, the runner, the protocol and the
match flow together, which really is shared code; taking any one of those out of `full` turns at most two of them
fast). Boss *rules* PRs (#267, #272, #273, #275) always touch the runner and the protocol, so they keep running
everything; boss *art and wiring* PRs (#271, #274, #276) and screen, chat, ranked and docs PRs are the fast ones:
about 2 to 5 minutes on the clock per shard, plus a minute of setup. #271 and #274 also changed `boss-timing.ts`, a
rule every boss shares, so they'd run every boss's specs on 5 shards, about 9 minutes each.

## Measured (probe PRs #279 and #280, closed unmerged)

- **One area's file** (a comment in `packages/app/src/components/Sawyer.tsx`): the plan picked Sawyer's spec, the king
  attacks and the speech spec plus the smoke set, 6 of 66 spec files on 3 shards. The whole run took **5 m 28 s**
  (plan 7 s, shards 4 m 13 s to 5 m 06 s, each about a minute of setup, `result` 4 s); 57 tests passed.
- **The smoke set alone** (the same PR with its change undone, so nothing changed): 1 shard, **3 m 44 s** in all
  (1.9 minutes of tests, 18 passed). A docs-only PR gets this.
- **A shared foundation** (a comment in `packages/chess/src/runner.ts`): the plan said "Every spec file (66) on 5
  shards: `packages/chess/src/runner.ts` is a shared foundation" and started 5 shards with no file list (then stopped by
  hand: the same path as main's run).
- **The `full-e2e` label** added to the first probe: a new run started at once and planned every spec on 5 shards
  ("the pull request has the full-e2e label"; then stopped by hand).

## Not done: a cheap win in `check.yml`

`check` takes about 5.5 minutes (npm ci 10 s, typecheck 45 s, unit tests 4 m 40 s), now as long as a small PR's e2e
run. Splitting the unit tests over two jobs (`vitest --shard`) and the typecheck into a third would bring it to about
3 minutes; a `concurrency` group would also stop superseded PR runs. Left for the director to decide.

## Reverting

To go back: restore the workflow and the shard script from `main` before this change, delete the plan's files, and put
the rules below back in `CLAUDE.md` (and the agent files' "CI runs the whole e2e suite on the PR").

```sh
git checkout e80ceb6 -- .github/workflows/e2e.yml e2e/ci-shard.mjs e2e/ci-summary-merge.mjs CLAUDE.md docs/areas/ops.md .claude/agents
git rm e2e/areas.json e2e/ci-select.mjs e2e/ci-select.d.mts packages/server/test/ci-select.test.ts
```

(`CLAUDE.md` and `docs/areas/ops.md` will have moved on by then: restore just the sections below rather than the whole
files.)

### The previous rules, word for word (`CLAUDE.md` before Oct 18)

> - Never merge red: every PR runs the typecheck and unit tests on GitHub (`.github/workflows/check.yml`) and the whole
>   e2e suite (`.github/workflows/e2e.yml`); wait for `check` to pass and read the e2e run's result before merging
>   anything that changes gameplay or screens.
> - **Test lanes** (Eric, Oct 13: "why are we going through so many checks for changing numbers?"):
>   - **CI runs the full e2e on every PR; local runs are for targeted checks and perf** (Oct 15). The `e2e` workflow
>     runs the whole suite, both projects, on every PR to `main` and every push to `main`: 5 runners, about 17 minutes
>     (docs/areas/ops.md). CI retries a failed test once until the flaky-test batch lands (the goal is no retries);
>     its `result` job lists flaky tests (passed only on the retry) first, then failed ones, each with its shard,
>     `file:line`, project and error. Not a required check yet (the director decides when). Flakes only: "Re-run
>     failed jobs" once; a test that fails again is real. Locally, run just the specs you're working on, and the
>     `@perf` specs (frame budgets, which CI leaves out: `npx playwright test --grep @perf --project phone`), under the
>     shared e2e lock. The lanes below say which specs a change must have passed; CI runs them all on the PR anyway.
>   - **Light lane** (numbers or data in settings or vote data, copy, CSS-only, docs): `check`, plus the e2e specs for
>     the screens touched, plus the live check after the deploy. No sims: estimate instead.
>   - **Targeted lane** (pre-launch default for logic: rules, the board, shared components, screens, boss powers):
>     `check`, plus the e2e specs of every area the change touches (the PR lists them and why), plus the live check.
>     Eric, Oct 14: "if an agent is confident in its code we can reduce token usage and testing to a minimum". What a
>     change touches decides its lane, never how confident its author is: the misses (the resign confirm over the
>     board, Wrangler's showdown never firing, Oct 13-14) were all confident code.
>   - **Batch full run:** CI's run on each push to `main` is the full run (until Oct 15 the director ran `npm run e2e`
>     locally); the director checks those runs after a batch of targeted-lane merges, at least once a day and before
>     Eric playtests a big feature. A red spec: re-run it once; if it's real, find the PR that caused it and fix it
>     forward (or revert) before the next batch.
>   - **Full lane per PR** (the whole suite green before merging: the PR's own e2e run) stays for the riskiest: stored
>     data (D1 schema, migrations), money, odds and wallets, sign-in and security, the client-server protocol, and
>     anything the director marks.
>   - When unsure, the targeted lane, and say so in the PR: the director decides.
>   - **Pre-launch only.** `main` deploys to Eric alone (Zero Trust), so a slip costs a playtest, not players. At
>     launch every logic change goes back to the full lane per PR.

And in "Working lean (Eric, Oct 17)": "Never at the cost of a check: tests, reviews, the CI gate and effort stay as
they are."
