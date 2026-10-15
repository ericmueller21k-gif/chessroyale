# Ops: hosting, deploy, capacity and limits

Lane: `ops`. Step-by-step setup is in `DEPLOY.md`.

## How it works today

- **Hosting:** Cloudflare, on Eric's account (Workers Paid, $5/month, which Containers need): one Worker
  (`chessroyale`) serves the built app and routes `/api/*`, `/admin/fairplay` and `/admin/ops`; Durable Objects for
  each lobby (`Lobby`), the matchmaker (`Matchmaker`), the live hub (`LiveHub`), and Squads' lobbies and parties
  (`SquadsLobby`, `SquadsParty`); the engine server as a Container (`EngineServer`, `standard-2`, `max_instances` 2);
  D1 (`hunchess`) for accounts, results, the locker, fair play and budgets. The domain is hunchess.com.
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
  - **Rate limits:** per address, per account and (PLAY, new lobbies) per account again (`CAPACITY.rateLimits`,
    `limits.ts`), counted in each Worker instance's memory; past a limit, a friendly 429 with when to try again.
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
- **Errors and player reports** (below): every device reports its errors, the server its own, players report bugs
  and send feedback and ideas, and admins read them all on `/admin/ops`.
- **Health** (below): one snapshot of the game for an admin (`/admin/ops`) or a script (`npm run ops:report`).

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

## Errors and player reports

- **On a device** (`packages/app/src/problems.ts`): the page's `error` and `unhandledrejection`, the Stockfish, Maia and
  sound workers' error events (each handled in its worker with `preventDefault`, as #216 made the engines'), and render
  errors through the one error boundary at the app's root (`components/Problems.tsx`: "Something went wrong" and
  Reload instead of a blank page; the error is still thrown on once as a page error, so the console and the e2e
  error checks see it). Each kind of error is sent once per page load, at most `OPS.client.maxErrorsPerPage`, a few
  seconds at a time (`OPS.client.batchMs`), by sendBeacon when the page is hidden. Browser extensions' errors and
  "Script error." are skipped.
- **What each error carries:** the message and a trimmed stack (12 lines); the build's version (the commit's first 12
  characters, put in by `vite.config.ts` from `WORKERS_CI_COMMIT_SHA` or git; `dist/version.json` says the same for
  the deploy); the screen (a boss battle's moment too: loading, intro, lights out, fall, the turn's power events), mode,
  boss and lobby code; the user agent, viewport and memory class (`navigator.deviceMemory`, where there is one); the
  last 20 breadcrumbs (screens and moments, moves sent: never chat, emails or anything typed); the account id if signed
  in (kept only if it's the request's own session's).
- **The feedback sheet** (Eric, Oct 15): "We'd love your feedback", with three kinds: 🐞 Report a bug (an optional
  note, sent with the same diagnostics and the page's last 5 errors; the answer is "Report AB12CD — share this id": 6
  characters, no look-alikes), 💬 Feedback and 💡 Suggest an idea (a note, required, sent alone: no diagnostics, no
  account; the answer is a thank-you). One sheet over any screen (rendered beside the ban notice, so a match redrawing
  never takes the form away). Opened on Report a bug from the match menu (a phone's "⋯" sheet; a computer's 🐞 button
  beside the sound button, except where an admin's testing items fill that line), and on Feedback from Settings
  (HELP).
- **The endpoint:** `POST /api/problems` (`packages/server/src/problems.ts`), `{kind: "errors"}`, or a report:
  `{kind: "bug" | "feedback" | "idea"}`:
  every field checked and cut to size, emails scrubbed from any text; 413 past `OPS.endpoint.maxBytes` (read in pieces,
  never held whole), 400 if it isn't one, 429 past its own limits per address and per account (`problemLimited` in
  `limits.ts`, on top of the API's; reports of all three kinds share theirs), 503 past `OPS.store.maxReportsPerMinute`
  reports a minute per instance.
- **The server's own errors:** the Worker's fetch (a plain 500 answer), the cron and the Durable Objects' entry points
  (Lobby, Matchmaker, LiveHub, SquadsLobby, SquadsParty: their fetch, WebSocket handlers, alarm and every method the
  Worker calls; `guardEntries` in `index.ts`, thrown on as before) and the matchmaker's batches: one structured log
  line (`{ops: "error", kind, route, code, version, message, fingerprint}`, the first of each kind per write window)
  and the same store. The deploy's version is read from the app's `version.json` through the assets binding.
- **Bounded writes:** errors are counted in memory per Worker instance (and Durable Object instance) by fingerprint
  (source, kind, the message with numbers, ids and build hashes taken out, the top file without its hash) and written
  at most every `OPS.store.flushMs` (the first at once), at most `OPS.store.maxRowsPerFlush` rows a time (the most
  frequent; one row per kind of error per hour, upserted); past `maxGroups` kinds in memory or the rows a write takes,
  they're dropped and logged as a number. So writes grow with instances, never with errors. Player reports are one row
  each, written at once (for the id).
- **Stored** (D1, made at runtime with the rest of the schema): `ops_errors` (fingerprint, hour, source, kind, message,
  version, count, first and last seen, the latest occurrence's diagnostics) and `ops_reports` (id, when, kind, a bug's
  account id or none, a bug's version, the note, a bug's diagnostics).
- **The ops page:** `/admin/ops` (admins only, as `/admin/fairplay`: `isAdmin`; anyone else gets "Not found"): the
  most frequent errors of the last 7 days (the last 24 hours' first, then the newest), with their versions, first and
  last seen, and the latest diagnostics a tap away; a search by message (`?q=`); player reports by id (`?report=ID`)
  and the latest 50, all or of one kind (`?kind=bug|feedback|idea`: the ideas as a list), a bug's with its full
  diagnostics.

### Data and retention

- **Kept:** only what's listed above: an error's message, trimmed stack, version, screen, mode, boss, lobby code, user
  agent, viewport, memory class and breadcrumbs (screens, moments, moves sent), a report's kind and note, and the
  account id of a signed-in player (errors and bugs). Feedback and ideas keep only their note. Counts per kind of error
  per hour.
- **Never kept:** IP addresses (the rate limits use them as keys in an instance's memory only), email addresses
  (scrubbed from any text, notes and messages included), chat text, or anything a player types other than a report's
  note.
- **For 30 days** (`OPS.store.keepDays`): the 15-minute cron deletes older errors (by hour) and player reports
  (`pruneProblems`).
- The privacy policy (`/privacy`, `screens/Legal.tsx`) says the same in plain words.

## Health

- **The view:** `GET /api/admin/health` (JSON; `packages/server/src/health.ts`), and the first section of `/admin/ops`:
  - the deployed build (`version.json`: version, commit, when built);
  - the live hub's numbers: online, people in lobbies, and each mode's lobbies waiting and playing and their people,
    Squads included (`LiveBoard.health`);
  - errors this hour, the hour before and in the last 24 hours (rows are per clock hour), how many kinds, the top 10;
  - the Durable Objects' own errors (kinds named `Class.method`) by class and entry point;
  - players' reports in the last 24 hours by kind, and the latest 5;
  - the engine server: on or off, searches used of today's budget (`engine_usage`, UTC day), its last answer and last
    failure (D1 `meta` "engine.ok" / "engine.fail", written at most once a minute or every 10 s per instance);
  - fair play's deep re-checks used of today's budget (`fairplay_budget`);
  - a timed D1 read (a database that doesn't answer leaves zeros and its error; the rest still shows).
- **Who may read it:** an admin (`isAdmin`, the session), or a script whose request came through Cloudflare Access for
  its application: Access's own token (`Cf-Access-Jwt-Assertion`) is checked in the Worker against the team's public
  keys (RS256, cached an hour), its audience (`ACCESS_AUD`) and its expiry (`packages/server/src/access.ts`). The team
  domain and the AUD tag are public (in `wrangler.jsonc`, `vars`); no secret. Anyone else: "Not found".
- **`npm run ops:report [-- URL]`** (`scripts/ops-report.mjs`): reads the view from hunchess.com with the Access service
  token in `CF_ACCESS_CLIENT_ID2` / `CF_ACCESS_CLIENT_SECRET2` (sent as headers, never printed) and prints a short
  summary, "Needs attention" first: D1 failing, no live hub, errors up (20 or more this hour, or 3 times the hour
  before), Durable Object errors this hour, the engine server's last search failed, a budget 80% used, bug reports to
  read. Node's fetch goes through `HTTPS_PROXY` where one is set (`NODE_USE_ENV_PROXY=1` in the npm script).
- **Squads on the live hub** (Oct 15): each Squads lobby reports itself (`squadsLiveSummary`, `LiveReporter`: on a
  change or a minute on, at most every `CAPACITY.presence.lobbyReportMs`) and is forgotten as it closes. It counts for
  the overload limit and the health view, never on the home page's public line.

## Where the code is

| What | Where |
| --- | --- |
| Worker routes, scheduled jobs | `packages/server/src/index.ts`, `api.ts` |
| Bindings, containers, crons, staging env | `wrangler.jsonc` (repo root) |
| The matchmaker's plumbing (not its matching rules: `ranked`'s) | `packages/server/src/matchmaker.ts`, `queue.ts` |
| Live counts and presence | `packages/server/src/live-hub.ts`, `live.ts`, `presence.ts` |
| Rate limits | `packages/server/src/limits.ts` |
| Load-test counters | `packages/server/src/ops.ts` |
| Errors and player reports: the endpoint, the bounded store, server errors, the guards | `packages/server/src/problems.ts` (guards applied in `index.ts`) |
| The ops page (`/admin/ops`) | `packages/server/src/ops-admin.ts` (its page frame: `admin.ts`, `adminPage`) |
| On a device: capture, breadcrumbs, the feedback sheet | `packages/app/src/problems.ts`, `components/Problems.tsx` (the error boundary, the feedback sheet) |
| The build's version | `packages/app/vite.config.ts` (`__APP_VERSION__`, `dist/version.json`) |
| The health view, its Access check, the report script | `packages/server/src/health.ts`, `access.ts`, `ops-admin.ts`; `scripts/ops-report.mjs` |
| Load tests (simulated players over WebSockets and the API) | `scripts/load/` (`run.ts`, `burst.ts`, `staging.sh`) → `reports/load/` |
| The engine server | `engine/`, `packages/server/src/engine.ts` |
| CI | `.github/workflows/check.yml` (typecheck, unit tests), `e2e.yml` (the e2e suite); `e2e/ci-shard.mjs`, `ci-timings.json`, `ci-summary.ts` |

## Settings

`CAPACITY` (queue, overload, presence, rate limits), `OPS` (error capture, the endpoint's caps and limits, bounded
writes, retention), `LOBBY_LIFE` in settings.ts; Worker variables
`MATCH_FILL_SECONDS`, `ENGINE_DAILY_SEARCHES`, `ENGINE_OFF`, `OPS_STATS`, `LOAD_TEST` (staging only), `SQUADS_TEST`
(local and e2e only: anyone may use Squads' test controls), `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` (public, in
`wrangler.jsonc`: the health view's Access check). Squads lobbies report to the live hub, so the overload limit counts
their players (since Oct 15); the home page's line still leaves them out.

## Tests and tools

- Unit: `packages/server/test/capacity.test.ts`, `matchmaker.test.ts`, `live.test.ts`, `lobby-life.test.ts`,
  `problems.test.ts` (validation, caps, rate limits, bounded writes, pruning, fingerprints, the guards, the ops page),
  `health.test.ts` (Access's token, Squads on the live hub, the engine server's marks, the view and who may read it).
- e2e: `e2e/busy.spec.ts` (servers busy), `lobby-close.spec.ts`, `problems.spec.ts` (errors reach the store, the error
  boundary, a bug report's id and feedback by kind on `/admin/ops`, the size and rate caps). The e2e Worker's
  `ADMIN_EMAILS` has one email per project; a test makes its account an admin with `wrangler d1 execute --local`.
- Load: see `DEPLOY.md`, "Load testing". Run wrangler from a copy you aren't editing (it reloads on every change).

## Rules for this area

- Money is Eric's: never raise instance counts, caps or plans, or add a paid service, without asking him with a
  monthly estimate. The actual purchase or sign-up is his.
- Never load-test production: use the staging copy and tear it down after.
- Measure, fix, measure again: every scaling change comes with before/after numbers in `reports/` and DECISIONS.
- Degrade, don't die: under overload, a clear "busy, you're in line", never a blank screen or a lost match.
- Anything the server starts has an end, with a test for each way it ends (`.claude/LESSONS.md`).
