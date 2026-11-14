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
  branches): only `check` (typecheck and unit tests, `.github/workflows/check.yml`: since Nov 6 `unit` and `chess`, packages/chess's tests,
  run side by side and `check` is green when both are) and the e2e run decide whether a PR
  is green. Merge with a merge commit, then confirm the deploy live.
- **CI e2e** (Oct 15, DECISIONS.md "e2e on GitHub Actions for every PR"; fast PR checks since Oct 18,
  `docs/decisions/2026-10-18-faster-pipeline.md`, a trial): `.github/workflows/e2e.yml`, on GitHub's standard runners
  (free: the repository is public).
  - **On a pull request: the fast check.** The `plan` job (`e2e/ci-select.mjs`, plain Node, no install; about 10 s)
    diffs the PR's merge commit against its first parent (main as it is now) and looks each changed path up in
    `e2e/areas.json`: path globs (`*` within a folder, `**` across folders) to spec files, area by area. The PR runs
    the specs of every area it touches, plus any spec it changes, plus the smoke set; on as few shards as those need
    (about 600 s of test time each, both projects; at most 5), so the whole run takes about 4 minutes for a docs-only
    PR (3 m 44 s measured: the smoke set on 1 shard) and about 5 to 8 on the usual one (5 m 28 s measured for one of
    Sawyer's files: his spec, the king attacks and the speech spec plus the smoke set, on 3 shards). The plan's summary on the run's page lists each
    changed path and what it ran.
  - **The smoke set** (every PR): `e2e/boss-smoke.spec.ts` once the boss kit lands (every boss's tile, battle, passive
    and ult, no page errors), plus the three cheapest specs that between them prove the app boots, a solo battle plays
    and a lobby works: `front-door.spec.ts` (home, Settings, the queue and the computer's layout through the real
    server, about 55 s), `boss-character.spec.ts` (a whole Boss alone battle, Boingo, home to results on a phone and a
    computer, about 40 s) and `lobby-chat.spec.ts` (two players in one lobby through the real server, the bots fill
    it, the match starts; Solo's queue; a private lobby, about 85 s). About 3 minutes of test time, so 1 shard.
  - **Traced modules** (Nov 1, `docs/decisions/2026-11-01-ci-selection.md`; `traced` in `areas.json`):
    `packages/core/src/settings.ts`, `packages/core/src/boss.ts`, `e2e/helpers.ts`, the app's `net.ts`, `solo.ts`,
    `main.tsx`, `board/OwnBoard.tsx`, `account.ts`, and since Nov 2 `game.ts`, `prefs.ts`, `test-switches.ts`,
    `screens/Hud.tsx` and `components/EvalBar.tsx`, and every `packages/core/src` module but `index.ts` (since Nov 10 without a list, new ones included:
    `TRACED_BY_DEFAULT` in `ci-select.mjs`; `docs/decisions/2026-11-10-trace-core-by-default.md`) and
    the server's `accounts.ts`, `api.ts`, `account-data.ts`, `locker.ts`, `boss-tokens.ts` and `ranked.ts`, are followed
    through the code instead of running everything (a change that reaches the server's `index.ts` still runs it all). The
    plan reads the module before and after (`traceModule`, plain text, no parser: about a second): the top-level
    declarations the diff changes (a settings object, a helper, a function or class; comments and types don't run),
    anything in the module that uses them (and the module state a changed function names; not a constant holding a plain
    value, a storage key's name say, which nothing can write: Nov 2), then the files that import
    the module, or its package's entry, and name one of them (`usersOf`). Each of those counts as a changed path: its
    area's specs, a spec itself, a unit test nothing. So a settings change runs the specs of the files that read that
    object, and a helper's change the specs that call it. It still runs everything when a user is a shared foundation
    or in no area, when it reaches `App.tsx` (`traced.hubs`: it hands the matches and the account to every screen),
    or when the change can't be placed (the module removed (a new one is followed from all it exports), code outside any declaration, a file that doesn't
    read cleanly). The plan's table says, per traced module, what changed and who uses it. A file reached through a
    trace counts like the table counts its own changes, nothing more: what it passes on to other files isn't followed.
  - **The whole suite on a PR** when it touches a shared foundation (`full` in `areas.json`: package.json, the
    lockfile, the Playwright and Wrangler config, `packages/core/src/index.ts` (its other modules traced), the runner, the protocol and chess's shared rules, the server's entry points (`index.ts`,
    `api.ts`, `lobby.ts`, `lobby-do.ts`) and its stored-data, sign-in, money, ranked and fair-play files, the app's
    entry, board, match flow (`game.ts`; `solo.ts` and `net.ts` traced), the play screen and the components every
    mode shares), or a path no area has. A CI-only change (`e2e.yml`, `e2e/ci-*`) runs the smoke set (Nov 6), (a new file under `packages/`, or a new spec, that no entry places fails `check` in its first minute
    (`node e2e/ci-select.mjs unmapped`, Nov 10): add it to its area, to `none`, or to `full` if every screen shares it). **To force it**, add the `full-e2e` label to the
    PR (that starts a new run, and every push after runs everything until the label is removed): the full lane's PRs
    do. Or Actions → e2e → Run workflow on the PR's branch (a manual run tests everything).
  - **On every push to main: the whole suite**, both projects, on 15 shards since Nov 9 (Eric: "Sure try it"; on 10, about 28 minutes, Nov 6: the slowest
    shard's tests about 26, setup about 1 in Playwright's image): the full run after each merge, which the director checks before the next merge.
    **One main run at a time** (Nov 1; `check` too): a push while main's run is going waits (the run going is never
    cancelled), and a newer push replaces the one waiting. A merge whose own run was skipped is tested by the next run,
    which runs every spec on main with every merge since the last run; its summary starts with "The merges this run
    covers". **When that run is red,** the culprit is one of those merges: the
    failed test's `file:line` and error usually name its area, and the plan table of each merge's own PR run says
    whether it ran that spec; if it isn't clear, re-run the failed spec locally on each merge in turn (`git checkout
    <merge>`, `npx playwright test <spec>`), oldest first.
  - **Layout:** `plan`, then the `shard` jobs side by side, then `result`. Each shard runs whole spec files of the
    plan's list (every spec file on main), spread by the plan (`assign` in `e2e/ci-select.mjs`; `e2e/ci-shard.mjs N
    TOTAL` shows one locally) so the slowest shard ends soonest: by each file's time per project, from main's last green
    run's `e2e-summary-N` records (Nov 6; `e2e/ci-timings.json` for files they lack, and a new spec counts as the median),
    simulating Playwright's order (project by project, files by name, 2 workers). Inside a file the tests run in order. Each runner builds the app once (`E2E_PREBUILT=1` tells Playwright's web server to start
    wrangler without building again) and serves it with the same `wrangler dev` and test variables as locally
    (`playwright.config.ts`). A test tagged `@phone-only` (logic, server and flow; Nov 6) skips the desktop project;
    layout, the board, home, desktop input (mouse drags, the wheel, arrow keys) and every guard test of `docs/rules/eric.md` run
    on both (Nov 10: long boss intros, room tours and town flows went phone-only). No spec file over about 6 minutes a project:
    split a long one in two (autochess, crowd; Nov 10). 2 workers per runner, as locally
    (half the runner's 4 CPUs). Setup (checkout, npm ci, the build) takes about a minute per shard.
  - **Reading a run:** `result`'s summary on the run's page (each shard's reporter, `e2e/ci-summary.ts`, writes a
    record; `e2e/ci-summary-merge.mjs` renders them): the plan's line (what this run tested and why), flaky tests,
    then failed ones, each with its shard, `file:line`, project, the line it failed on and the gist of its error;
    each shard's counts and time; and the test time by file and project as a ready-made `ci-timings.json` (the fallback;
    refreshed Nov 6 from run 943). `result` is red if the plan or any shard is. A shard with a failed or flaky test uploads its HTML
    report with the retries' traces (`e2e-report-shard-N`, kept 7 days; `npx playwright show-report <folder>`).
    Each shard's record (`e2e-summary-N`: its failed and flaky tests) is kept 90 days, for a look at which tests
    catch real bugs and which only flake (Eric, Oct 18; the first look about two weeks on).
  - **Try the table locally:** `node e2e/ci-select.mjs files <path>...` prints what a PR changing those paths runs
    (a traced module's change is read from where your branch left `origin/main` to your working tree); its tests are
    `packages/server/test/ci-select.test.ts` (one area's file, docs only, foundations, unknown paths, changed and
    removed specs, every spec reachable, shard counts; traced: a settings key, a helper, a shared module and the hub,
    comments and types only, changes it can't place; core traced by default; new files no entry places).
  - **Retries and traces:** `--retries 1` in CI (PR and main), kept for the trace it records: traces only on that
    retry (`on-first-retry`; recording every test measured about 8% slower). A test that passes only on its retry is
    "flaky": the summary lists it first, and **on main it turns the run red** (the `result` job's "No flaky test on
    main", Nov 10, audit F1): fix it at its cause from its trace, never with a longer wait or a retry. A PR isn't held
    up by one. The summary's title says which red it is (Nov 12, audit Q3): "red: flaky only (N)" (fix the flakes) or
    "red: N failed" (a real failure: find its cause or revert). A red run with no failed test (GitHub dropped shards): "Re-run failed jobs" once.
  - **Left out: `@perf`** (`e2e/perf.spec.ts`, frame budgets on a 4x-slowed phone), because they measure the machine.
    Run them locally under the e2e lock, or from Actions → e2e → Run workflow with "perf" ticked (a `perf` job, phone,
    1 worker; its report is kept 7 days: read its numbers as a trend, not a verdict).
  - **Caches:** npm (`setup-node`) and Playwright's Chromium (headless shell only, the browser headless runs use;
    `~/.cache/ms-playwright`, keyed by Playwright's version).
  - **Concurrency:** a new push to a PR (or a label added to it) cancels that PR's run still going; pushes to `main`
    each get their own run. A full run takes 7 jobs (plan, 5 shards, result), a PR's fast check 3 to 7: the account's
    limit on jobs at once (20 on GitHub Free) queues the rest.
  - **Not a required check yet;** if it becomes one, require `result` (one name, whatever the shard count).
- **Schema at runtime:** D1 tables are made by the Worker (`CREATE TABLE IF NOT EXISTS`, then `ALTER TABLE` migrations
  that tolerate re-runs), so a deploy needs no migration step: once per instance, 4 round trips after a schema change
  (134 a statement at a time before Nov 10), 1 on a current database ([accounts.md](accounts.md), "The database").
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
  - **Quests at a game's end** (Nov 9, phase 3; review of #575, m5): each player's XP grant adds 3 to 5 D1 queries (the `quest_days`
    read, the quests twice on a new day, the day's deal batch, the paid quests), in turn in the room's `writeResults` loop: about 300
    to 500 more for a 100-player Crowd game. Plus one `quest_games` row write per player per counted game (the replay claim; cleared after a day). Fine for now; if it shows, read `quest_days` and the quests in one query, and skip the claim when no unfinished quest counts the game.
  - **The ban gate** (Nov 13, [fairplay.md](fairplay.md), "A ban means you can't sign in"): every `/api/*` request with a session
    reads its session and case in one D1 query, at most once per session per Worker instance every `FAIRPLAY.banCheckMs` (60 s), so
    the live line's and the town's polls add about one read a minute per signed-in player per instance their polls land on (10k
    players on 2 instances each: about 330 reads a second). Not measured yet: **`ops` load-tests with the gate on before launch**
    (the review of #687, minor 5), and raises `banCheckMs` (a ban counting within 2 minutes costs nothing) if it shows.
  - **Rate limits:** per address, per account and (PLAY, new lobbies; friends' actions) per account again
    (`CAPACITY.rateLimits`, `limits.ts`), counted in each Worker instance's memory; past a limit, a friendly 429 with when to try again.
    The account is a key only for a cookie shaped like a session token (43 characters, as `randomToken` makes them; the
    shape alone, not checked against D1), and the limits are counted in order, stopping at the first that refuses (Oct
    15, `docs/decisions/2026-10-15-health-view-and-ops-report.md`). A made-up cookie of that shape each time still gets
    a fresh account (and PLAY and friends) window; what bounds it is the per-address limit, counted first, and that
    anything such a request asks for needs a real session (a made-up one gets a 401 after one D1 read).
- **Nothing runs for no one:** a match everyone has left (resigned, or gone longer than `LEAVING.awayMs`) ends at once
  and its lobby closes, Squads too (DECISIONS.md, "Resign: leaving a match in every mode"); before Oct 13 such a match
  played itself out for up to an hour or more, counted on the live line all along.
- **A match's end** (Nov 10, the outside review's finding 9; `MATCH_SAVE`): results wait in the lobby's record (`saveQueue`) until
  written in the background (never holding up the match's alarm), `perWake` (20) players a wake (about 20 D1 calls each), every write
  keyed; a failure retries each minute for up to 24 h (fair play, XP and rewards stop holding a result up `strictMinutes`, 30, after
  its first failure) and shows on the ops page as a server error (`Lobby.saveResults`; `Lobby.resultsLost` if it gave up).
- **Costs and guards:** engine server re-checks capped by `ENGINE_DAILY_SEARCHES` (3000 a day, D1 `engine_usage`; solo at most
  `ENGINE_SERVER.soloDailySearches`, and only for accounts; the Hidden Boss's moves never capped (phase 2's, and phase 1's no device
  answered), bounded by the fights, about 1.5 cents a long fight: [engine.md](engine.md));
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
  - **The server's:** a new lobby's `rounds`, `clock`, `finalTurns`, `bossMoves`, `draw`, `power`, `format`, `speed`, `start`,
    `weakbots`, `keep`, `pace=quick` (a test switch since Oct 15: players always play the mode's own pace), `augments=0`
    (no pre-game votes; a test switch since Oct 15: players always vote), `afk=0` (50 v 50's AFK rule off, CrowdMisses: for tests that
    idle on purpose; also with a test `pool` on `/api/play`), a boss's fixed strength (`boss=1600`) and a boss outside a raid (`lobby-options.ts`); a queue's
    own `pool` (`/api/play`, `/api/squads/play`, `/api/squads/party`, `/api/1v1/play`: `testPool` in `index.ts`); a 1 v 1
    game's own `clock=SECONDS` (each side's clock, no increment: `/api/1v1/play`); a crate's forced
    `fischer` and `shiny` (`/api/locker/open`: since Nov 9 only where `TEST_SWITCHES` is "1", never an admin's on production). One check,
    `testSwitchesOn` (`admin.ts`). And the Worker variable `CUTSCENE_HOLD_MS` (1 000 to 120 000, only with `TEST_SWITCHES` "1"; the e2e
    server's is 12 000): the Hidden Boss's cutscene's hold online instead of `RECLUSE_CUTSCENE.holdMs`, the scene sped up to fit it.
  - **The app's** (read only through `testParams()` in `packages/app/src/test-switches.ts`; `/api/auth/config` says
    `testSwitches` where the server has them on, `/api/me` says `admin`): all of the above, and `debug` (the match on
    `window`), `nolanding`, `boss=<id>` (skips the boss menu), `win`, `mate`, `phase`, `cutscene=SECONDS` (1 to 120: the Hidden Boss's
    cutscene sped up into that long, solo), `laststand`, `side`, `wip` and
    `kit`, a crate page's `fischer` and `shiny` and its "Testing:" boxes, and 1 v 1's `fewAfter=SECONDS` (the "Few players
    online" choice sooner) and `clock` (the bot game's clock too), and `quests=mock|done|entry` (the daily quests overlay mockup over home with fake data, Nov 9: `quests-mock.ts`), and `cardMs=MS` (home's Boss Battle card turns to the
  next boss this often instead of every 30 s), and `town=A` or `town=B` (home's Chess Town button shows that picture instead of a random one: not gated, anyone's address), and `barslot=1` (the boss bar's free room for a boss's own prop drawn with a
  dashed outline, so a screenshot shows it; nothing else changes), and `bannerplus=SECONDS` (0 to 3: the extra time on
  every banner over the board, and everything after a banner that much later, for the games on the device; online the
  server's default) and `talkplus=SECONDS` (0 to 3: added to every speech line's read time), both read from the address
  once as the page opens, so they hold for the page (Oct 24), and `rideScale=K` (0.5 to 1.25: every ride drawn at that size
  under its pawn on the page, over RIDES.scale, to try sizes; read once as the page opens; town-square.md, "Rides"; Nov 1). The `sayBoss(text)` hook (speech.tsx: a boss's voice says
  any line at once, for e2e/boss-bar-same.spec.ts).
  - **Kept for everyone** (the home screen's own choices): `mode` and a raid's boss picked from the menu; preferences
    and pages (`anim`, `trail`, `crates`); the town square's `crowd=N` (N more pawns with names, up to 100, wandering the
    square, drawn on this device only) and `fps` (a frame-rate pill), to measure the frame rate: switches until Oct 30, then
    anyone's (Eric: no admin needed, the site is behind Cloudflare Access). Gone on Oct 15: `turns` (Crowd is always team turns), `moves` (Classic plays
    its default opening moves) and `soundlab` (its choice is Settings' Reveal sound).
  - **Testers' options** (Settings → Testing, admins): practice mode counts only where the switches do (`practiceOn` in
    `prefs.ts`); online the lobby takes a `hello`'s practice only from an admin's socket or where TEST_SWITCHES is "1"
    (`lobby-do.ts`; `lobby-do-practice.test.ts`). The eval bar is off for everyone since Nov 1 (`evalBarOn()` is false).
  - **Admins only already:** "Trigger ultimate (testing)" (online the lobby checks too), "Engine move", the boss brain
    picker (`brain`), the Hidden Boss in Boss alone (from the hidden `/bosses` picker since Oct 16: his tile on the Boss
    raid screen is locked for everyone). Squads' test lobbies and controls: admins or `SQUADS_TEST`. One of every item in
    the locker, never stored (admins only, not `TEST_SWITCHES`: [shop.md](shop.md)).
  - **No record from a switched game:** for a player the switches can't apply, so everything the server records
    (results, ranking, fair-play signals, Squads' coins and crates, crate items) comes from a game made without them.
    Solo results are posted by the browser and are never ranked and earn nothing.
  - **XP's** (Nov 9; [2026-11-09-xp-storage.md](../decisions/2026-11-09-xp-storage.md)): `xp=<n>` (the app sets your XP to n once your
    account loads: `POST /api/xp/test`, a ledger op) and `xpgame=MINUTES` (a solo game's start, or a lobby's: it counts as a game that
    long with enough moves, test switches or not; only where TEST_SWITCHES is "1": an admin's on production makes a test game, no XP). Any other lobby test switch marks the lobby `tested`: no XP ("No XP: test game.").
  - **Quests'** (Nov 9, phase 3): `quests=<kind>[:<progress>],…` (e.g. `?quests=warm-up:2,squad-up,regular:9`: your quests replaced by
    these as home loads, `POST /api/quests/test`; only where TEST_SWITCHES is "1").
  - **A new test switch:** read it through `testParams()` (app) or behind `testSwitchesOn` (server), and list it here.
- **Kill switches** (Oct 15; docs/decisions/2026-10-15-kill-switches.md): Worker runtime variables that rest one part
  of the game, set in the dashboard (how: `DEPLOY.md`, "Kill switches and the maintenance banner"). `PAUSE_<NAME>` =
  "1" rests it, deleting it brings it back: `PAUSE_CLASSIC`, `PAUSE_CROWD`, `PAUSE_RAID`, `PAUSE_SQUADS`, `PAUSE_RANKED1V1`,
  `PAUSE_SOLO` (Solo and Boss alone), `PAUSE_SHOP` (buying and crates; the locker stays), `PAUSE_FRIENDS`,
  `PAUSE_TOWN_CHAT` (typing in the town square; its line is "Chat is paused."), `PAUSE_REWARDS` (Nov 9: XP, the daily reward,
  level rewards and quests (no progress, no pay; the overlay says so); games play on, the XP box says "Rewards are paused for a moment.", levels reached are paid at the next game after it:
  [2026-11-09-xp-phase2-pause.md](../decisions/2026-11-09-xp-phase2-pause.md)), `PAUSE_LEAVE_PENALTIES` (Nov 9: ranked's leave
  rules, if they misfire: no dodge or leave is charged or marked, and no lockout or delayed queue applies; games play on;
  [ranked.md](ranked.md), "Leaving early"),
  `PAUSE_BOSS_<ID>` (one boss by its roster id, e.g. `PAUSE_BOSS_PIG` for Wrangler; DEPLOY.md lists them all).
  - **While resting:** the app disables the way in with the part's line ("Squads is resting for a bit. Back soon.";
    `pausedLine`, core's `pauses.ts`), and the server refuses anything new for it with the same line (503,
    `{ message, paused }`: a refusal, not an error, so error capture never counts it). Matches already running finish normally, and lobbies already made still start and take
    joins by code. A Squads party in line waits with the line and goes in once it's back. Admins' Squads test lobbies
    stay open. A boss resting is never met, at random or picked; the Crowd's boss final meets another while his is
    resting (`rosterWithout`, `bossesOff` in a lobby's or solo game's settings).
  - **One module reads them** (`kill-switches.ts`, cached 60 s per Worker instance); the app asks `GET /api/status`
    (`{ paused, banner }`) at start, every minute and when it comes back on screen (`packages/app/src/status.ts`).
  - **How fast:** changing a variable deploys a new version of the Worker, so it applies within seconds of that deploy
    (new instances read it at once). Like any deploy, players in a match reconnect for a moment.
- **The maintenance banner** (`MAINTENANCE_BANNER`, at most 200 characters): a slim band at the top of every screen
  while it's set (`components/MaintenanceBanner.tsx`). The page starts under it and is that much shorter
  (`--banner-h`, `--app-h` in styles.css), so it never covers a control; sheets and menus opened over the page cover
  it. ✕ hides it on that device until the message changes. `useServerStatus` (status.ts) draws an answer that came between its
  first render and its effect (Nov 14: a banner missed that way stayed away a minute; `useAccount` likewise).
- **Rolling back** (`npm run rollback`, `scripts/rollback.ts`, its choice in `rollback-pick.ts`; needs
  `CLOUDFLARE_API_TOKEN`, never printed):
  - With no arguments, it lists the Worker's latest versions, newest first: live now, was live, code upload or
    settings change.
  - `npm run rollback -- previous` goes back to the version live just before the live code went out: it steps back
    past settings changes (saving a variable makes a new version of the same code) to the live code's upload, then
    takes the deployment before it. So bad code with a `PAUSE_` set on top of it never rolls back to that bad code.
    Or name a version by its id. `--dry-run` says which and why. `--env staging` works on the staging Worker.
  - Flags go after `--` (npm keeps those before it): it stops if npm took one.
  - A real rollback runs only in a terminal that isn't CI, where `wrangler rollback` asks before it deploys and about
    any secret changed since that version; outside one, or with `CI` set, wrangler would answer yes by itself, so the
    script refuses.
  - **A rollback lasts until the next deploy from `main`:** revert or fix the bad change on `main` before anything
    else merges.
  - **A version carries its own variables:** rolling back to a version from before a `PAUSE_` or banner change undoes
    that change too. Check the switches after a rollback.
  - The database's schema only grows (columns are added, never removed), so an older version still runs on it.
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

Built Oct 15; why it's built this way: `docs/decisions/2026-10-15-error-capture-and-feedback-sheet.md`.

- **On a device** (`packages/app/src/problems.ts`): the page's `error` and `unhandledrejection`, the Stockfish, Maia and
  sound workers' error events (each handled in its worker with `preventDefault`, as #216 made the engines'), and render
  errors through the one error boundary at the app's root (`components/Problems.tsx`: "Something went wrong" and
  Reload instead of a blank page; the error is still thrown on once as a page error, so the console and the e2e
  error checks see it). Each kind of error is sent once per page load, at most `OPS.client.maxErrorsPerPage`, a few
  seconds at a time (`OPS.client.batchMs`), by sendBeacon when the page is hidden. Browser extensions' errors and
  "Script error." are skipped. The town's WebGL fallback goes the same way as a kind of its own (below, "Health").
- **What each error carries:** the message and a trimmed stack (12 lines, 1000 characters); the build's version (the commit's first 12
  characters, put in by `vite.config.ts` from `WORKERS_CI_COMMIT_SHA` or git; `dist/version.json` says the same for
  the deploy); the screen (a boss battle's moment too: loading, intro, lights out, fall, the turn's power events), mode,
  boss and lobby code; the user agent, viewport and memory class (`navigator.deviceMemory`, where there is one); the
  last 20 breadcrumbs (screens and moments, moves sent: never chat, emails or anything typed); the account id if signed
  in (kept only if it's the request's own session's).
- **The feedback sheet** (Eric, Oct 15): "We'd love your feedback", with three kinds: 🐞 Report a bug (an optional
  note, sent with the same diagnostics and the page's last 3 errors; the answer is "Report AB12CD — share this id": 6
  characters, no look-alikes), 💬 Feedback and 💡 Suggest an idea (a note, required, sent alone: no diagnostics, no
  account; the answer is a thank-you). One sheet over any screen (rendered beside the app at its root, so a match redrawing
  never takes the form away; a banned account sees only the ban screen: [fairplay.md](fairplay.md)). Opened on Report a bug from the match menu (the gear, its list and a confirm first, on a phone and a computer;
  Oct 25), and on Feedback from Settings
  (HELP).
- **Under the age gate** (Oct 16; [docs/decisions/2026-10-16-age-gate-and-real-money.md](../decisions/2026-10-16-age-gate-and-real-money.md)):
  a guest on a device that answered "too young" (the `hc_age=under` cookie) types nothing to us.
  - **The sheet:** opened from anywhere, it's a bug report with no kinds and no note box: "Sends details of this
    screen and device, to help us fix a bug. Nothing you type."
  - **`/api/problems`:** for such a request (any `hc_age=under` in it, and no signed-in session), a bug is kept with
    its diagnostics and an empty note, and feedback or an idea gets a 400. Someone signed in on that device is treated
    as anywhere else.
  - Errors are unchanged.
- **The endpoint:** `POST /api/problems` (`packages/server/src/problems.ts`), `{kind: "errors"}`, or a report:
  `{kind: "bug" | "feedback" | "idea"}`. In order: 415 unless the body is JSON (`content-type: application/json`: a
  form can't send it) and 403 when the browser says another site's page sent it (`sec-fetch-site` other than
  `same-origin`), both before the body is read; 413 past `OPS.endpoint.maxBytes` (read in pieces, never held whole);
  429 past its own limits per address and per account (`problemLimited` in `limits.ts`, on top of the API's; reports
  of all three kinds share theirs; the account counted only for a cookie shaped like a session token and only once the
  address is let through), checked on the body's `kind` before any other field is read; then every field checked and
  cut to size and emails scrubbed from any text (400 if it isn't one); 503 past `OPS.store.maxReportsPerMinute`
  reports a minute per instance or the database's cap. The app sends JSON both ways (fetch, and sendBeacon with a JSON
  blob, falling back to a keepalive fetch where a browser refuses one).
- **The server's own errors:** the Worker's fetch (a plain 500 answer), the cron and the Durable Objects' entry points
  (Lobby, Matchmaker, LiveHub, SquadsLobby, SquadsParty: their fetch, WebSocket handlers, alarm and every method the
  Worker calls; `guardEntries` in `index.ts`, thrown on as before) and the matchmaker's batches: one structured log
  line (`{ops: "error", kind, route, code, version, message, fingerprint}`, the first of each kind per write window)
  and the same store. The deploy's version is read from the app's `version.json` through the assets binding. The
  cron's jobs fail apart: old rows failing to go is logged and counted, and fair play's deep check still runs.
- **Bounded writes:** errors are counted in memory per Worker instance (and Durable Object instance) by fingerprint
  (source, kind, the message with numbers, ids and build hashes taken out, the top file without its hash) and written
  at most every `OPS.store.flushMs` (the first at once), at most `OPS.store.maxRowsPerFlush` rows a time (the most
  frequent; one row per kind of error per hour, upserted); the rest wait for the next write (one is set for a window
  later); past `maxGroups` kinds in memory, new kinds are dropped and logged as a number. So writes grow with
  instances, never with errors. Player reports are one row each, written at once (for the id).
- **Fair counts:** a kind of error counts once per request, and once per address per write window (a set of
  address and fingerprint pairs in memory, cleared at each write, never stored): one device sending the same error
  over and over can't push other errors out of the rows a write takes.
- **The database's own caps** (whatever the instances, so a flood from many addresses can't grow D1 without bound),
  each in the insert itself (an indexed count in its `WHERE`, so instances writing at once can't pass it): at most
  `OPS.store.maxNewErrorsPerHour` (100) new kinds of error an hour (kinds already stored keep counting) and
  `maxReportsPerDay` (2000) reports in any 24 hours. At a cap, one `{ops: "cap"}` log line, and a report gets "Too
  many reports right now. Try again in a minute."
- **Small rows:** an error's row keeps its message and its latest occurrence's stack, place, last
  `OPS.store.sampleCrumbs` (10) breadcrumbs, device, version and account; a bug's its note, place, 20 breadcrumbs (60
  characters each), last 3 errors, device, version and account. At most about 6 KB and 7 KB, with every field full of
  3-byte characters (under 3 KB and 3.5 KB in plain text). With every cap hit every hour for 30 days, about 440 MB of
  each, under 0.9 GB in all (under 0.4 GB in plain text); in real use, a few megabytes.
- **The email scrubber is linear** (it tries a match only where a run of address characters starts) and works on each
  field with control characters dropped first (so none can split an address past it) and cut to its size (with room
  for an address across the cut): a 20 KB field costs a few milliseconds, not a second.
- **Stored** (D1, made at runtime with the rest of the schema): `ops_errors` (fingerprint, hour, source, kind, message,
  version, count, first and last seen, the latest occurrence's diagnostics) and `ops_reports` (id, when, kind, a bug's
  account id or none, a bug's version, the note, a bug's diagnostics). Deleting an account deletes its bug reports and
  takes its id out of error samples (the counts stay); the download has both (`account-data.ts`, "problemReports").
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
- **The 15-minute cron's jobs**, in order, each failing apart (`scheduled()` in `index.ts`): old errors and reports
  (`pruneProblems`), sign-in code records an hour old (`purgeEmailCodes`), chat moderators' decisions past keeping
  (`pruneChatMod`, [chat.md](chat.md)), once a day at `OPS.ledgerCheck.hourUtc` the item ledger's check (`ledgerCheck`: each account whose
  balances and ledger disagree logged, one error on /admin/ops), then fair play's deep re-check. The ledger's one-off backfill:
  an admin's `POST /api/admin/ledger/backfill` from the site (re-runnable: it adds nothing the second time).
- The privacy policy (`/privacy`, `screens/Legal.tsx`) says the same in plain words.

## Health

Built Oct 15; why it's built this way: `docs/decisions/2026-10-15-health-view-and-ops-report.md`.

- **The view:** `GET /api/admin/health` (JSON; `packages/server/src/health.ts`), and the first section of `/admin/ops`:
  - the deployed build (`version.json`: version, commit, when built);
  - the live hub's numbers: online, people in lobbies, and each mode's lobbies waiting and playing and their people,
    Squads included (`LiveBoard.health`);
  - errors this hour, the hour before and in the last 24 hours (rows are per clock hour), how many kinds, the top 10
    (the town's WebGL fallbacks left out: they have their own count, next);
  - **the town's WebGL fallbacks** (Oct 30; docs/decisions/2026-10-30-town-webgl.md, "Oct 30, later"; Nov 6: the street town's): page
    loads whose street town couldn't draw with WebGL (since Nov 13 never today's town: no WebGL 2 says "Chess Town can't run on this
    device."; the others reload once, then say "The town didn't load. Please retry.", reason `retry`), in the last 24 hours and 7
    days, in all and by reason
    (`townFallbacks`). The page reports one at most (`reportTownFallback` in the app's problems.ts, never on the frame
    loop, nothing shown to the player) through the error reporting, as the kind `town-gl-fallback` with its reason as the
    message (`TOWN_GL_FALLBACK` in core's settings.ts: `no-webgl2`, `no-context`, `shader`, `lost-twice` (not raised since Nov 13), `not-back`, `retry`):
    exactly what an error sends (no GPU name, nothing typed), under the same limits, caps, fair counts and 30 days in
    `ops_errors` (no new table or column). Only those six reasons are counted (anyone can post an error of any kind);
    each reason's row, with its latest device, is in `/admin/ops`'s error list. `/admin/ops` shows a line, and
    `npm run ops:report` prints one ("Town WebGL fallbacks (reloaded once, "retry", or "no-webgl2": can't run): 3 in 24 hours, 10 in 7 days (…)");
    never "Needs attention".
  - the Durable Objects' own errors (kinds named `Class.method`) by class and entry point;
  - players' reports in the last 24 hours by kind, and the latest 5;
  - the engine server: on or off, searches used of today's budget (`engine_usage`, UTC day), its last answer and last
    failure (D1 `meta` "engine.ok" / "engine.fail", the match engine's instance "engine-1" only, written at most once a
    minute or every 10 s per instance, never waited on by a search);
  - the Hidden Boss's fights (the review of #683, M2; phase 1's too since Nov 13): his positions searched today (`<day>:recluse`,
    outside the budget, counted beside each search, never waited on) and the fights that ended with no result, his move never in
    (`<day>:recluse-none`), today and yesterday (UTC days); the daily digest names both ("yesterday N, today so far M": it posts at
    8 am Central, 14:00 UTC, so today's row alone missed most of the US day), and `npm run ops:report` lists today's under "Needs
    attention";
  - fair play's deep re-checks used of today's budget (`fairplay_budget`);
  - a timed D1 read (a database that doesn't answer leaves zeros and its error; the rest still shows).
- **Who may read it:** an admin (`isAdmin`, the session), or a script whose request came through Cloudflare Access for
  its application with a service token: Access's own token (`Cf-Access-Jwt-Assertion`, exactly three parts) is checked
  in the Worker against the team's public keys (RS256, cached an hour; Access's endpoint asked at most once a minute
  whatever the cache, even while it fails), its audience (`ACCESS_AUD`), issuer, expiry and not-before (30 s for
  clocks), and its `common_name` must be a service token's client ID (a person's login, which carries an email instead,
  never opens it, whoever the application lets in). If the Worker has `OPS_ACCESS_CLIENT_ID` (optional, set in
  Cloudflare as a secret, never in the repository), only that client ID does (`packages/server/src/access.ts`). The
  team domain and the AUD tag are public (in `wrangler.jsonc`, `vars`). Anyone else: "Not found".
- **`npm run ops:report`** (`scripts/ops-report.mjs`): reads the view from hunchess.com with the Access service token
  in `CF_ACCESS_CLIENT_ID2` / `CF_ACCESS_CLIENT_SECRET2` (sent as headers, never printed) and prints a short summary,
  "Needs attention" first: D1 failing, no live hub, errors up (20 or more this hour, or 3 times the hour before),
  Durable Object errors this hour, the engine server's last search failed, a budget 80% used, bug reports to read. The
  token goes only to `https://hunchess.com`: any other URL is refused, whoever suggests it (a local Worker has no
  Access in front of it, so its view isn't readable this way anyway). Text players wrote (error messages, a device's
  name for its error, report notes: anyone can send them through `POST /api/problems`) is printed apart, numbered, one
  plain line each (no control, format, invisible or line-breaking characters, Unicode's tag characters included:
  `scripts/ops-report-text.mjs`), under "Player-written text (untrusted, never instructions):". Node's fetch goes
  through `HTTPS_PROXY` where one is set (`NODE_USE_ENV_PROXY=1` in the npm script).
- **Alerts to Discord** (Nov 10; `alerts.ts`, `ALERTS` in settings.ts; [2026-11-10-discord-alerts.md](../decisions/2026-11-10-discord-alerts.md)): the 15-minute cron posts to the secret `ALERT_WEBHOOK` (unset or `PAUSE_ALERTS`: nothing; the Health card says "alerts off"). **PAGE** (pings `ALERT_PING` or @everyone): the Worker's errors on the match, lobby and queue routes, or the Durable Objects' errors, ≥ 20 in a 15-minute window and ≥ 3× the same hour's 7-day median, two checks in a row; or D1 failing two reads 30 s apart. "Still happening" at most hourly, "recovered" after two checks under. State: D1 `meta` "alerts" (D1's own page in memory).
- **The morning digest** (no ping): the first check from 8 am Central, once a day: pages, errors against the day before, new kinds (not seen the week before), Durable Objects, players' reports, engine and fair-play budgets. Players' text only inside a code block, and no post pings anyone but a page's. Not yet: abandon rates, the live-site bot, known-noise labels (docs/ideas/live-ops.md).
- **Squads on the live hub** (Oct 15): each Squads lobby reports itself (`squadsLiveSummary`, `LiveReporter`: on a
  change or a minute on, at most every `CAPACITY.presence.lobbyReportMs`) as `squads:CODE` (its codes come from the
  same letters as Crowd's: a bare code could be a Crowd lobby's) and is forgotten as it closes. It counts for the
  overload limit and the health view, never on the home page's public line.

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
| Test switches: who may (server), a lobby's, the app's | `admin.ts` (`testSwitchesOn`), `lobby-options.ts`; `packages/app/src/test-switches.ts` |
| Kill switches, the banner | `packages/core/src/pauses.ts` (the parts, their lines), `packages/server/src/kill-switches.ts`; `packages/app/src/status.ts`, `components/MaintenanceBanner.tsx` |
| Rollback | `scripts/rollback.ts` (`npm run rollback`), `scripts/rollback-pick.ts` (which version) |
| The health view, its Access check, the report script | `packages/server/src/health.ts`, `access.ts`, `ops-admin.ts`; `scripts/ops-report.mjs` |
| Alerts to Discord (pages and the morning digest) | `packages/server/src/alerts.ts`; tests `packages/server/test/alerts.test.ts` |
| Load tests (simulated players over WebSockets and the API) | `scripts/load/` (`run.ts`, `burst.ts`, `staging.sh`) → `reports/load/` |
| The engine server | `engine/`, `packages/server/src/engine.ts` |
| CI | `.github/workflows/check.yml` (typecheck, unit tests), `e2e.yml` (the e2e fast check on PRs, the suite on main); `e2e/areas.json`, `ci-select.mjs`, `ci-shard.mjs`, `ci-timings.json`, `ci-summary.ts`, `ci-summary-merge.mjs` |

## Settings

`CAPACITY` (queue, overload, presence, rate limits), `OPS` (error capture, the endpoint's caps and limits, bounded
writes, retention), `LOBBY_LIFE` in settings.ts; Worker variables
`MATCH_FILL_SECONDS`, `ENGINE_DAILY_SEARCHES`, `ENGINE_OFF`, `OPS_STATS`, `LOAD_TEST` (staging only), `SQUADS_TEST`
(local and e2e only: anyone may use Squads' test controls), `TEST_SWITCHES` (local, e2e and staging only: anyone may
use the test switches), `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` (public, in `wrangler.jsonc`: the health view's Access
check), the kill switches `PAUSE_<NAME>` and `MAINTENANCE_BANNER` (above). Squads lobbies report to the live hub, so
the overload limit counts their players (since Oct 15); the home page's line still leaves them out.

## Tests and tools

- Unit: `packages/server/test/capacity.test.ts`, `matchmaker.test.ts`, `live.test.ts`, `lobby-life.test.ts`;
  `test-switches.test.ts` (server and app: the test switches); `problems.test.ts` (validation, the scrubber's speed
  and its control-character bypass, caps, cross-site refusals, rate limits and their keys, bounded writes, fair
  counts, row sizes, pruning, fingerprints, lobby codes in paths, the guards, the cron's jobs failing apart, the ops
  page); `health.test.ts` (Access's token, Squads on the live hub, the engine server's marks, the view and who may read
  it); `kill-switches.test.ts` (the switches, the cache, each refusal, never counted as an error, a resting boss never
  met, even in a lobby made before); `rollback.test.ts` (which version "previous" is); `ci-select.test.ts` (CI's e2e
  plan: which specs a pull request runs).
- e2e: `e2e/busy.spec.ts` (servers busy), `lobby-close.spec.ts`, `test-switches.spec.ts` (a player's switches
  ignored, an admin's working), `problems.spec.ts` (errors reach the store, the error boundary, a bug report's id and
  feedback by kind on `/admin/ops`, the size and rate caps, the health view), `kill-switches.spec.ts` (its own server
  on port 8789: Squads resting, the banner). The e2e Worker's `ADMIN_EMAILS` has one email per project; a test makes
  its account an admin through `POST /api/e2e/sql` (helpers' `localSql`; `server/src/e2e-sql.ts`): the server's own D1, so a test's
  write never locks it out (SQLITE_BUSY). Only where `E2E_SQL` is "1": playwright.config.ts sets it, wrangler.jsonc never does.
- Load: see `DEPLOY.md`, "Load testing". Run wrangler from a copy you aren't editing (it reloads on every change).

## Rules for this area

- Money is Eric's: never raise instance counts, caps or plans, or add a paid service, without asking him with a
  monthly estimate. The actual purchase or sign-up is his.
- Never load-test production: use the staging copy and tear it down after.
- Measure, fix, measure again: every scaling change comes with before/after numbers in `reports/` and DECISIONS.
- Degrade, don't die: under overload, a clear "busy, you're in line", never a blank screen or a lost match.
- Anything the server starts has an end, with a test for each way it ends (`.claude/LESSONS.md`).
