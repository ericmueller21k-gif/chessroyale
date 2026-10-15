# Ops: hosting, deploy, capacity and limits

Lane: `ops`. Step-by-step setup is in `DEPLOY.md`.

## How it works today

- **Hosting:** Cloudflare, on Eric's account (Workers Paid, $5/month, which Containers need): one Worker
  (`chessroyale`) serves the built app and routes `/api/*` and `/admin/fairplay`; Durable Objects for each lobby
  (`Lobby`), the matchmaker (`Matchmaker`), the live hub (`LiveHub`), and Squads' lobbies and parties (`SquadsLobby`,
  `SquadsParty`); the engine server as a Container
  (`EngineServer`, `standard-2`, `max_instances` 2); D1 (`hunchess`) for accounts, results, the locker, fair play and
  budgets. The domain is hunchess.com.
- **Deploy:** every push to `main` builds (`npm run build`) and deploys (`npx wrangler deploy`) through Workers Builds.
  The "Workers Builds: chessroyale" check fails instantly on PR branches (Cloudflare's preview build for non-production
  branches): only `check` (typecheck and unit tests, `.github/workflows/check.yml`) and the e2e run decide whether a PR
  is green. Merge with a merge commit, then confirm the deploy live.
- **CI e2e** (Oct 15, DECISIONS.md "e2e on GitHub Actions for every PR"): `.github/workflows/e2e.yml` runs the whole
  Playwright suite, both projects, on every PR to `main` and every push to `main`, on GitHub's standard runners (free:
  the repository is public). CI runs the full e2e on every PR; local runs are for targeted checks and perf.
  - **Layout:** 5 `shard` jobs side by side (about 17 minutes in all, 1 for setup), then `result`. Each shard runs whole
    spec files, spread by their measured test time (`e2e/ci-shard.mjs` reads `e2e/ci-timings.json`; a new spec counts
    as the median until the table is refreshed); inside a file the tests run in order, as locally. Each runner builds
    the app once (`E2E_PREBUILT=1` tells Playwright's web server to start wrangler without building again) and serves
    it with the same `wrangler dev` and test variables as locally (`playwright.config.ts`). 2 workers per runner, as
    locally (half the runner's 4 CPUs).
  - **Reading a run:** `result`'s summary on the run's page (each shard's reporter, `e2e/ci-summary.ts`, writes a
    record; `e2e/ci-summary-merge.mjs` renders them): flaky tests first, then failed ones, each with its shard,
    `file:line`, project, the line it failed on and the gist of its error; each shard's counts and time; and the
    test time by file as a ready-made `ci-timings.json`. `result` is red if any shard is. A shard with a failed or
    flaky test uploads its HTML report with the retries' traces (`e2e-report-shard-N`, kept 7 days;
    `npx playwright show-report <folder>`).
  - **Retries and traces:** `--retries 1` in CI until the flaky-test batch lands; the goal is 0, as
    `playwright.config.ts` has it. A test that passes only on its retry is "flaky": the summary lists it first, so
    it stays in view. Traces only on that retry (`on-first-retry`): recording every test measured about 8% slower.
    Flakes only: "Re-run failed jobs" once; a test that fails again is real.
  - **Left out: `@perf`** (`e2e/perf.spec.ts`, frame budgets on a 4x-slowed phone), because they measure the machine.
    Run them locally under the e2e lock, or from Actions → e2e → Run workflow with "perf" ticked (a `perf` job, phone,
    1 worker; its report is kept 7 days: read its numbers as a trend, not a verdict).
  - **Caches:** npm (`setup-node`) and Playwright's Chromium (headless shell only, the browser headless runs use;
    `~/.cache/ms-playwright`, keyed by Playwright's version).
  - **Concurrency:** a new push to a PR cancels that PR's run still going; pushes to `main` each get their own run.
    A run takes 6 jobs at once: the account's limit on jobs at once (20 on GitHub Free) queues the rest.
  - **Not a required check yet;** if it becomes one, require `result` (one name, whatever the shard count).
- **Schema at runtime:** D1 tables are made by the Worker (`CREATE TABLE IF NOT EXISTS`, then `ALTER TABLE` migrations
  that tolerate re-runs), so a deploy needs no migration step.
- **Built for surges** (measured with simulated players on staging):
  - **The matchmaker:** PLAY presses are tickets in memory, seated in batches (one seat reservation per lobby per
    batch), admitted at `CAPACITY.queue` rates; past `CAPACITY.overload` the answer is "Servers are busy, you're in
    line: about N s" with a ticket, never a blank screen or a lost match.
  - **The live line:** the live hub keeps who's online and which lobbies run in memory; Worker instances pass on who
    they've seen in batches (`presence.ts`, at most every `CAPACITY.presence.flushMs`), lobbies report changes at most
    every 2 s, each Worker caches `/api/live` for 3 s, and D1 gets `users.last_seen` once a minute per account.
    Friends ride on it (Oct 15): a batch also says who's in a match (the live line's `?busy=1`), and the hub answers
    with friends' news for anyone in it, which their next `/api/live` passes on as `inbox`; a friends list is one hub
    call (`presenceOf`). No new D1 writes per request. One new request: while a friends list is on screen, for a
    player with a friend who shows when they're online, `/api/friends/online` once a minute (cached session, one D1
    read, one hub call).
  - **Rate limits:** per address, per account and (PLAY, new lobbies; friends' actions) per account again
    (`CAPACITY.rateLimits`, `limits.ts`), counted in each Worker instance's memory; past a limit, a friendly 429 with when to try again.
- **Nothing runs for no one:** a match everyone has left (resigned, or gone longer than `LEAVING.awayMs`) ends at once
  and its lobby closes, Squads too (DECISIONS.md, "Resign: leaving a match in every mode"); before Oct 13 such a match
  played itself out for up to an hour or more, counted on the live line all along.
- **Costs and guards:** engine server re-checks capped by `ENGINE_DAILY_SEARCHES` (3000 a day, D1 `engine_usage`);
  fair play's deep re-checks by `FAIRPLAY.deep.dailySearches` (D1 `fairplay_budget`) on their own instance; the
  deep re-check's cron runs every 15 minutes (`triggers.crons`). Suggested budget alert: $20/month. The engine server
  never gets a position Stockfish refuses, which would take it down (`containerScore`; `/api/engine/score` answers
  400: [engine.md](engine.md)).
- **Load-test counters** at `/api/ops/stats` only where `OPS_STATS` is set and the request's `x-ops-key` matches
  (local and staging, never production).
- **Test switches** (gated Oct 15; DECISIONS.md, "The test switches: admins and test servers only"): playtest
  shortcuts in the address that would make easy wins. They work only for an admin (`ADMIN_EMAILS`) or where the Worker
  variable `TEST_SWITCHES` is "1" (local `wrangler dev --var TEST_SWITCHES:1`, the e2e server, staging; never
  production), and in the app on Vite's dev server. For everyone else they're ignored, silently: the lobby, the queue,
  the crate and the solo game are exactly the ones made without them.
  - **The server's:** a new lobby's `rounds`, `clock`, `finalTurns`, `bossMoves`, `draw`, `power`, `format`, `speed`,
    `weakbots`, `keep`, `pace=quick` (a test switch since Oct 15: players always play the mode's own pace), a boss's
    fixed strength (`boss=1600`) and a boss outside a raid (`lobby-options.ts`); a queue's
    own `pool` (`/api/play`, `/api/squads/play`, `/api/squads/party`: `testPool` in `index.ts`); a crate's forced
    `fischer` and `shiny` (`/api/locker/open`). One check, `testSwitchesOn` (`admin.ts`).
  - **The app's** (read only through `testParams()` in `packages/app/src/test-switches.ts`; `/api/auth/config` says
    `testSwitches` where the server has them on, `/api/me` says `admin`): all of the above, and `debug` (the match on
    `window`), `nolanding`, `boss=<id>` (skips the boss menu), `win`, `mate`, `phase`, `laststand`, `side`, `wip` and
    `kit`, a crate page's `fischer` and `shiny` and its "Testing:" boxes.
  - **Kept for everyone** (the home screen's own choices): `mode`, `augments`, `moves` (opening moves), a raid's boss
    picked from the menu; preferences and pages (`anim`, `trail`, `soundlab`, `crates`). (`turns` is gone: Crowd is
    always team turns since Oct 15.)
  - **Admins only already:** "Trigger ultimate (testing)" (online the lobby checks too), "Engine move", the boss brain
    picker (`brain`), the Hidden Boss in Boss alone. Squads' test lobbies and controls: admins or `SQUADS_TEST`.
  - **No record from a switched game:** for a player the switches can't apply, so everything the server records
    (results, ranking, fair-play signals, Squads' coins and crates, crate items) comes from a game made without them.
    Solo results are posted by the browser and are never ranked and earn nothing.
  - **A new test switch:** read it through `testParams()` (app) or behind `testSwitchesOn` (server), and list it here.
- **Kill switches** (Oct 15; docs/decisions/2026-10-15-kill-switches.md): Worker runtime variables that rest one part
  of the game, set in the dashboard (how: `DEPLOY.md`, "Kill switches and the maintenance banner"). `PAUSE_<NAME>` =
  "1" rests it, deleting it brings it back: `PAUSE_CLASSIC`, `PAUSE_CROWD`, `PAUSE_RAID`, `PAUSE_SQUADS`,
  `PAUSE_SOLO` (Solo and Boss alone), `PAUSE_SHOP` (buying and crates; the locker stays), `PAUSE_FRIENDS`,
  `PAUSE_BOSS_<ID>` (one boss by its roster id, e.g. `PAUSE_BOSS_PIG` for Wrangler; DEPLOY.md lists them all).
  - **While resting:** the app disables the way in with the part's line ("Squads is resting for a bit. Back soon.";
    `pausedLine`, core's `pauses.ts`), and the server refuses anything new for it with the same line (503,
    `{ message, paused }`). Matches already running finish normally, and lobbies already made still start and take
    joins by code. A Squads party in line waits with the line and goes in once it's back. Admins' Squads test lobbies
    stay open. A boss resting is never met, at random or picked; the Crowd's boss final meets another while his is
    resting (`rosterWithout`, `bossesOff` in a lobby's or solo game's settings).
  - **One module reads them** (`kill-switches.ts`, cached 60 s per Worker instance); the app asks `GET /api/status`
    (`{ paused, banner }`) at start, every minute and when it comes back on screen (`packages/app/src/status.ts`).
  - **How fast:** changing a variable deploys a new version of the Worker, so it applies within seconds of that deploy
    (new instances read it at once). Like any deploy, players in a match reconnect for a moment.
- **The maintenance banner** (`MAINTENANCE_BANNER`, at most 200 characters): a slim band over the top of every
  screen while it's set (`components/MaintenanceBanner.tsx`); ✕ hides it on that device until the message changes.
- **Rolling back** (`npm run rollback`, `scripts/rollback.mjs`; needs `CLOUDFLARE_API_TOKEN`, never printed):
  - With no arguments, it lists the Worker's latest 10 versions, newest first, the live one marked.
  - `npm run rollback -- previous` (or a version's id) goes back to the one before the live one, through
    `wrangler rollback`. `--dry-run` shows what it would do. In a terminal it asks first; elsewhere it needs `--yes`.
    `--env staging` works on the staging Worker.
  - **A rollback lasts until the next deploy from `main`:** revert or fix the bad change on `main` before anything
    else merges.
  - **A version carries its own variables:** rolling back to a version from before a `PAUSE_` or banner change undoes
    that change too. Check the switches after a rollback.
  - The database's schema only grows (columns are added, never removed), so an older version still runs on it.

- **Licenses** (`LICENSES.md`, audited Oct 12, 2026): every third-party piece that reaches a player's device, from the
  build's module list and `public/`, its license and its credit. Nothing GPL, AGPL, LGPL, non-commercial or
  share-alike compiled into the game's own code (the engines are separate programs with their own notices). A PR that
  adds or removes a third-party piece updates it, and the notices in `public/licenses/` and the credits in Settings and
  the FAQ.
- **The engines' source, served by the site** (Oct 14, DECISIONS.md "The Maia box's source on the site"): the Maia
  box's (AGPL-3.0) at `/engine/maia/maia-box-source.tar.gz`, written by its build; Stockfish's (GPL-3.0) at
  `/engine/stockfish-source.tar.gz`, from `packages/app/stockfish-source/`. The PyChess sounds' (GPL-3.0, Oct 15) at
  `/sounds/pychess-sounds-source.tar.gz`, written by `scripts/sounds-source.py` (run it after changing
  `scripts/piece-sounds.py`; `sounds-source.test.ts` checks). Static files, so they stay public when the repository
  goes private; not precached by the service worker. Updating the `stockfish` package needs its source
  archive first (the build stops without one).

## Where the code is

| What | Where |
| --- | --- |
| Worker routes, scheduled jobs | `packages/server/src/index.ts`, `api.ts` |
| Bindings, containers, crons, staging env | `wrangler.jsonc` (repo root) |
| The matchmaker's plumbing (not its matching rules: `ranked`'s) | `packages/server/src/matchmaker.ts`, `queue.ts` |
| Live counts and presence | `packages/server/src/live-hub.ts`, `live.ts`, `presence.ts` |
| Rate limits | `packages/server/src/limits.ts` |
| Load-test counters | `packages/server/src/ops.ts` |
| Test switches: who may (server), a lobby's, the app's | `admin.ts` (`testSwitchesOn`), `lobby-options.ts`; `packages/app/src/test-switches.ts` |
| Kill switches, the banner | `packages/core/src/pauses.ts` (the parts, their lines), `packages/server/src/kill-switches.ts`; `packages/app/src/status.ts`, `components/MaintenanceBanner.tsx` |
| Rollback | `scripts/rollback.mjs` (`npm run rollback`) |
| Load tests (simulated players over WebSockets and the API) | `scripts/load/` (`run.ts`, `burst.ts`, `staging.sh`) → `reports/load/` |
| The engine server | `engine/`, `packages/server/src/engine.ts` |
| CI | `.github/workflows/check.yml` (typecheck, unit tests), `e2e.yml` (the e2e suite); `e2e/ci-shard.mjs`, `ci-timings.json`, `ci-summary.ts` |

## Settings

`CAPACITY` (queue, overload, presence, rate limits), `LOBBY_LIFE` in settings.ts; Worker variables
`MATCH_FILL_SECONDS`, `ENGINE_DAILY_SEARCHES`, `ENGINE_OFF`, `OPS_STATS`, `LOAD_TEST` (staging only), `SQUADS_TEST`
(local and e2e only: anyone may use Squads' test controls), `TEST_SWITCHES` (local, e2e and staging only: anyone may
use the test switches), the kill switches `PAUSE_<NAME>` and `MAINTENANCE_BANNER` (above). Squads lobbies aren't on
the live line yet, so the overload limit doesn't count their players.

## Tests and tools

- Unit: `packages/server/test/capacity.test.ts`, `matchmaker.test.ts`, `live.test.ts`, `lobby-life.test.ts`;
  `test-switches.test.ts` (server and app: the test switches).
- Unit: `kill-switches.test.ts` (the switches, the cache, each refusal, a resting boss never met).
- e2e: `e2e/busy.spec.ts` (servers busy), `lobby-close.spec.ts`, `test-switches.spec.ts` (a player's switches
  ignored, an admin's working), `kill-switches.spec.ts` (its own server on port 8789: Squads resting, the banner).
- Load: see `DEPLOY.md`, "Load testing". Run wrangler from a copy you aren't editing (it reloads on every change).

## Rules for this area

- Money is Eric's: never raise instance counts, caps or plans, or add a paid service, without asking him with a
  monthly estimate. The actual purchase or sign-up is his.
- Never load-test production: use the staging copy and tear it down after.
- Measure, fix, measure again: every scaling change comes with before/after numbers in `reports/` and DECISIONS.
- Degrade, don't die: under overload, a clear "busy, you're in line", never a blank screen or a lost match.
- Anything the server starts has an end, with a test for each way it ends (`.claude/LESSONS.md`).
