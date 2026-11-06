# Build pipeline audit (Nov 6, 2026)

Read-only. Code at `origin/main` 24a6bf2d (#523). Measured from today's GitHub runs: 16 main e2e runs (874-929, logs of every
shard parsed), 28 finished PR e2e runs, 39 `check` runs, one `check` log with per-file times; plus a local Vite build and
import-graph scans of an export of main. Not repeated from this morning's audit (audit-2026-11-06.md §4): the stills and
docs-volume findings, the 2D/WebGL double runs (now retired by #519), the pixel-check list. "h" = helper-hours. "Director"
= a fix under 30 minutes; "helper" = its own PR. A note: the local full `npm test` did not finish in 25 minutes on the
shared 4-core machine (stopped at its time limit), so unit timings below come from CI.

## Baseline metrics (later sweeps compare against this)

| Metric | Today |
| --- | --- |
| Lines of code, src / test | app 213,961 / 30,771; chess 23,381 / 22,413; server 19,684 / 21,249; core 9,665 / 3,878 (settings.ts alone 3,923); maia-worker 487 / 614; sim 475 / 0 |
| Lines, e2e and scripts | e2e 36,846 (109 spec files, 108 in CI); scripts/ 11,157 (33 `frames-*` + 4 other stills/perf runners) |
| Test count | Unit: 4,396 tests in 294 files. E2e: 1,108 test runs per full run (both projects), 214 skipped by project |
| Unit and typecheck time (CI) | `check` job median 10.2 min (n=39, 6.2-20.1, queue included); `npm test` 5.7-9.8 min (589 s: collect 304 s, tests 1,361 s summed); typecheck 36-57 s |
| E2e test time | 24,621 test-seconds per full run (phone 13,800, desktop 10,822) |
| Slowest 10 specs (s, both projects, run 929) | autochess 1,297; recluse 972; shop 904; boss-challenge 895; town-chat 888; boss-bar-same 651; crowd 619; boss-side 595; king-attack 564; town 522 |
| CI wall time, full run (main) | Median 34.2 min (n=11 ten-shard runs; 30.1-47.0), plus up to 30 min queued behind the previous main run. Shards end 14.9-38.3 min after start |
| CI wall time, PR e2e | Median 33.6 min (n=28; 7.0-53.6). CLAUDE.md still says 4-8 min |
| Intermittent failures on main today | 39 (34 passed on retry, 5 failed twice) in 16 runs; 17 spec files; 14 of 16 runs retried something; 5 of 16 red, all flakes |
| Repo size | .git 543 MB (pack 254 MiB; image blobs in history 420 MB); tree 272 MB |
| docs/ images | 475 files, 181 MB (+40 images and +6 MB since this morning; 28 of them from #514 and #515) |
| Largest bundle chunks (min / gzip, kB) | index 2,629 / 847; you-look 336 / 132; Town 153 / 56; Colosseum 94 / 33; ShopRoom 88 / 33. dist 66 MB (engine 42, sounds 18) |
| PR bodies since the lean rules (09:25 UTC) | Median 23 lines, 409 words (n=11, none over 40 lines); the 14 before them on the same page: 35.5 lines, 610 words |
| Decision notes since the lean rules | 7-9 lines but 186-240 words each (n=5); #515's was 78 lines, 1,228 words |
| Area pages | 6,416 lines (town-square 1,259, bosses 1,027) |
| Worktrees on this machine | 17 copies of node_modules at 683 MB = 11 GB of the 19 GB in /home/user; 4.5 GB free on the disk |

## Quick wins (each under an hour, clear saving)

| # | Change | Evidence | Saving | Effort | Risk | Size |
| --- | --- | --- | --- | --- | --- | --- |
| Q1 | Regenerate `e2e/ci-timings.json` from run 929 (the parsed per-file sums are in this audit's scratch data; or the `result` summary's table) | Last refreshed Nov 2. 13 CI specs are missing and count as the 141 s median: shop (904 s), boss-challenge (895), town-fixed, squads-replay, town-controls, town-street, town-rows, welcome-crate, boss-review, timber, dash, home-card, walkthrough. boss-side is listed at 88 s, measured 595. The stale table predicts the slowest shard at 30.7 test-min; run 929's was 30.2 | Simulated with today's times: slowest shard 30.7 → 20.6 min. About 9 min off every full run (main and full-suite PRs) | 0.25 h | Low | Director |
| Q2 | Shards and `perf`: run in `container: mcr.microsoft.com/playwright:v1.56.1-noble` and drop "Cache the Playwright browser" and "Install Chromium" (e2e.yml:124-135, :204-214). Fallback if the image won't do: `timeout-minutes: 3` on the install plus a retry | Install Chromium is 10-23 s normally, but 8 of 60 shards sampled took 2-13.3 min: the apt fonts (fonts-wqy-zenhei, fonts-unifont, …) came at 18 kB/s from the runner's mirror. At that rate 76% of 10-shard runs have at least one slow shard. Run 929: three shards lost 9-13 min, and shard 1 finished last because of it | Up to 13 min off most full runs; makes run time predictable | 0.5-1 h, verify with one `full-e2e` PR | Low-medium (image's Node and workerd; check one run) | Director |
| Q3 | e2e.yml:137 (and :216): `npm run build -w maia-worker && (cd packages/app && npx vite build)` instead of `npm run build`, whose app script runs `tsc --noEmit` first | The app's tsc takes ~16 s of the 25-45 s build on every shard; `check` already typechecks | ~16 s per shard on the critical path | 0.1 h | Low | Director (bundle with Q2) |
| Q4 | check.yml:9: group PR runs by PR number and cancel superseded ones: `format('check-{0}', github.event.pull_request.number)` with `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` | Today: tour-spotlight 4 `check` runs in an hour, boss-bubbles 3 in 35 min, each 7-12 min, none cancelled (the group is the run id). They also hold runner slots a full e2e run (12 jobs) needs | Runner minutes and queue time on busy afternoons | 0.1 h | Low | Director |
| Q5 | `.gitignore`: add `stills/`, `frames/`; a step in `check` that fails when a PR adds a .png/.gif/.jpg under docs/ outside an allowlist of test fixtures (today one: docs/welcome-crate/hunchess-rides.png, read by hunchess-rides.test.ts) | 40 images added to docs/ since this morning's audit; history already holds 420 MB of image blobs, which only a force-push could remove, so stopping growth is what's left. The rule says "never git add" but nothing ignores the folder | Stops ~5-25 MB a day of growth; every clone and worktree checks out less | 0.5 h | Low | Director |
| Q6 | playwright.config.ts:13-20: port from `E2E_PORT` (default 8788), `reuseExistingServer: !!process.env.E2E_REUSE` (off by default), and `--persist-to` a fresh temp folder unless `E2E_KEEP_STATE=1` | `reuseExistingServer: true` on a fixed 8788, while 9 scripts (frames-chat-move, -home-queue, -lobby-chat, -lobby-close, -matchmaking, -queue-browse, -queue-pop, -versus, -ranked-tiers, plus perf-boss) also start wrangler on 8788: a helper's run can silently test another worktree's server and code. Nothing resets local D1; the schema is made at runtime (accounts.ts:298 `ensureSchema`, 3 `ALTER TABLE`s), so an old .wrangler keeps old rows and columns: the stale-D1 breakage seen today | Ends wrong-server and stale-state runs; replaces the hand-copied config the rules ask for | 0.5-1 h (a foundation file: the PR runs everything once) | Low | Director |
| Q7 | Correct the stale numbers in CLAUDE.md ("Test lanes": PR fast check "about 4 to 8 minutes", main "about 44 minutes on 5 runners") and e2e.yml:9 ("about 25 minutes") | Measured: PR median 33.6 min, main 34.2 min on 10 shards | Helpers and the director plan waits on real numbers | 0.2 h | None | Director |
| Q8 | Bump actions/checkout, setup-node, cache, upload-/download-artifact to their Node 24 majors | Every job warns "Node.js 20 is deprecated … forced to run on Node.js 24" | Avoids a sudden break when GitHub drops the shim | 0.2 h | Low | Director |

With Q1 to Q3, a full run should drop from 34 min to about 23-24 min (test time ~21 min plus ~1.5 min setup), and stop
swinging to 38-47.

## Ranked proposals

### 1. Keep shard timings fresh automatically (after Q1)
- **Change.** e2e/ci-shard.mjs and ci-select.mjs `readTimings`: read the timings from the last green main run's
  `e2e-summary-*` artifacts (the plan job already calls the API for main's last run, e2e.yml:87) and fall back to the committed
  file. Weigh each file per project, so the 2 workers in a shard balance (autochess alone is 21.6 test-min across both).
- **Evidence.** The table drifted 24% in four days (19,802 → 24,621 s), and every new spec starts at the median.
- **Saving.** Keeps the ~9 min of Q1 without anyone remembering to refresh. **Effort** 1-2 h. **Risk** low (falls back). **Helper.**

### 2. PR e2e runs the whole suite too often
- **Change.** e2e/areas.json `full` and `traced`:
  - move `packages/core/src/**` (except index.ts) and the server modules in `full` (accounts.ts, api.ts, locker.ts,
    boss-tokens.ts, ranked.ts, account-data.ts) to `traced` or to their areas;
  - a PR that only touches `.github/workflows/*.yml` or `e2e/ci-*.mjs` runs the smoke set plus ci-select's own unit tests, not every spec.
- **Evidence.**
  - PR e2e median 33.6 min against the documented 4-8.
  - Replaying today's 17 merged PRs through `select()`: 10 ran everything, triggered by account.ts, core/src (crates.ts),
    server/api.ts and account-data.ts, e2e.yml or ci-select.mjs, e2e/helpers.ts, and new files (since added).
    This replay treats traced modules as plain paths, so it overcounts a little.
  - 111 of 709 source files are foundations.
  - Even a targeted PR picks ~16 specs on 6 shards (~17 min) because the smoke set includes boss-smoke (419 s).
- **Saving.** About 15 min of waiting on each PR that becomes targeted; at ~5 a day, over an hour of helper wall time a day.
  Main still runs everything after each merge.
- **Effort** 3-4 h. **Risk** medium (a miss shows up on main, not on the PR). **Helper.**

### 3. The desktop project repeats logic tests
- **Change.** Tag specs whose subject is game logic, server or flow (boss powers, whole matches, chat, ledger) `@phone-only`
  and give the desktop project `grepInvert: /@phone-only/` (playwright.config.ts:22-25). Keep both projects for layout,
  board, home and every guard test of a standing rule. List each moved test old → new in the PR.
- **Evidence.**
  - Desktop is 10,822 of 24,621 test-seconds (44%).
  - 80 specs run over 20 s in both projects, 9,532 desktop seconds between them. The biggest: autochess 560 s, boss-challenge 448,
    shop 422, boss-side 404, town-chat 395, recluse 360, ranked-1v1 275, sawyer 267.
  - multiplayer.spec's desktop whole match alone is 312 s.
- **Saving.** Up to ~30% of e2e time: a PR's shards shorter by the same share, or main on 7 shards in today's wall time.
- **Effort** 3-5 h. **Risk** medium (a computer-only bug in a logic flow); never move a guard test off a project.
  **Helper**, with the director's sign-off on the list.

### 4. Flakes: 39 intermittent events on main today
- **Evidence** (main runs 874-929; runs = how many of the 16 it hit):

  | Spec:line | Runs | Pattern |
  | --- | --- | --- |
  | colosseum:162 (3D draw calls, desktop) | 7, red once | GPU sampling under software WebGL (fix in #523) |
  | home-polish:149 (pawn hop, desktop) | 5 | Fake clock paused after a real-time frame race |
  | town-rows:98 (sky) | 4, red once | Canvas pixel sampling (fix in progress) |
  | account:5 (solo stall) | 3, red once | Whole bot match; each stall costs 3.2 + 3.3 min before the retry (fix in #523) |
  | boss-challenge (Timber 1120, Smudgy 650, Alfil 123) | 3 | Intro beats polled at 50 ms on 2 workers per 2-core runner |
  | shop:515, :1063 | 3, red once | Room walk and aim timing |
  | sound:60, autochess:1301 and :1965, town-chat:1268 and :1378 | 2 each | Real-time windows ("every 3 s", "within a few seconds") |
  | multiplayer:18, formats:276 (Play now, red), age-gate:78, ranked-tiers:137, crate-banner:41, board-tools:111, alfil:247, squads-replay:88 | 1 each | Whole matches and lobbies with bots; layout reads |

- **Change.**
  - home-polish:149: install the clock paused before `goto`, so no real frame runs.
  - sound:60, autochess:1301, town-chat:1268: run on `page.clock`.
  - The intro polls: 200 ms intervals plus a hook that reports each beat once.
  - Per-test timeouts at about 2× the measured p95: 47 tests sit at 240 s, 13 at 400 s and 4 at 600 s, so a stall burns
    minutes twice before it reports.
  - Then drop `--retries 1` to 0 on main first.
- **Saving.**
  - Red main runs 5/16 → about 1/16.
  - Each red run today cost a "re-run failed jobs" (~20-30 min) and a look from the director.
  - Retries also hide real bugs.
- **Effort** 4-6 h, beyond the first three already in hand. **Risk** low. **Helper.**

### 5. `check` takes 6-12 min; most of it is the boss simulations
- **Change.** check.yml: two parallel jobs.
  - (a) typecheck plus every test outside `packages/chess/test`.
  - (b) `packages/chess/test` split with `vitest --shard=1/2` and `2/2`.
  - Or: run the 10 heaviest chess files only when `packages/chess/**` or `packages/core/**` changes, and always on main.
- **Evidence** (CI log, run 42246888558):
  - packages/chess is 828 of 1,361 test-seconds (61%).
  - The heaviest files: boss-kit 106 s, pig 79, maia-bosses 69, rage 61, smudgy 57, tiger 44, gardener 42, bigboy 36,
    carrots 35, ginger 31.
  - 36 files of 10 s or more make 77% of test time.
  - Collect is 304 s, the module imports: app tests pull in the drawing code.
- **Saving.** `check` from ~10 to ~5 min per PR push. **Effort** 1-2 h. **Risk** low. **Helper** (or director for the path split alone).

### 6. Shared node_modules and worktree cleanup
- **Change.** A new `scripts/worktree-init.sh`:
  - when package-lock.json matches main's, `cp -al /home/user/chessroyale/node_modules ./node_modules`;
    the hardlinks cost no disk, and the relative `@chessroyale/*` links then point into the new worktree; otherwise `npm ci`;
  - a `--clean` that removes `.wrangler/`, `test-results/`, `playwright-report/` and `packages/app/dist/` from finished worktrees;
  - rule: never `npm install` inside a hardlinked tree. Remove node_modules first.
- **Evidence.**
  - 17 × 683 MB = 11 GB of node_modules.
  - Also .wrangler 950 MB, dist 918 MB, test results 692 MB (cr-bubbles alone 575 MB).
  - 4.5 GB free on the disk.
- **Saving.** About 10 GB of disk now and 0.6 GB per new worktree; 1-2 min per `npm ci`. **Effort** 1 h. **Risk** low. **Director.**

### 7. One local e2e and stills runner with a port allocator (with Q6)
- **Change.** A new `scripts/e2e.sh [spec…] [--stills DIR]`:
  - picks a free port in 8800-8899 by trying to bind it, and sets `E2E_PORT`;
  - runs Playwright under `flock /tmp/claude-0/e2e.lock` with a fresh `--persist-to`; wrangler dies with the run,
    so no `fuser -k` and no respawn;
  - stills: one `STILLS` env var for every spec. Today there are 8 names: LAYOUT_SHOTS, CHALLENGE_SHOTS, SHOTS_DIR,
    KING_ATTACK_SHOTS, SHOP_SHOTS, STILLS, WELCOME_SHOTS, SHOTS.
  - Then retire the `frames-*.mjs` scripts not touched since Oct 20 (most were last changed Oct 14-15) and the 29
    `frames:*` npm scripts. New frame needs become a spec's stills hook.
- **Evidence.**
  - 33 frames scripts (6,358 lines) and 4 more runners.
  - Ports are fixed: 5196-5199 across 20+ scripts, and 8788 (the Playwright port) across 10.
  - The respawn and the port block: rules-common "Local servers" (Nov 6).
- **Saving.** No port fights or hours-long blocks; each stills job is one command. **Effort** 3-4 h. **Risk** low. **Helper.**

### 8. Main re-runs what the PR just ran
- **Change.** e2e.yml plan job, push branch: skip (green) when the merge commit's tree equals the tree of a green
  full-suite PR run. That holds when main didn't move between the PR's last run and the merge.
- **Evidence.**
  - 10 of today's 17 merges had run the full suite on the PR.
  - Main runs queue one at a time: #523's run waited 30 min behind #518's.
- **Saving.** Up to a full run (~34 runner-min × 10 jobs) per merge where it applies, and shorter queues in bursts.
- **Effort** 2-3 h. **Risk** low-medium (tree equality is exact). **Helper.**

### 9. Fixed waits
- **Change.** Replace `waitForTimeout` of 1 s or more with clock control or polls. The biggest: town-chat.spec.ts:1440 (15.5 s),
  :1313 (6 s); desktop-board.spec.ts:287-288 (8 s + 15 s); matchmaking.spec.ts:92 (10 s); gardener.spec.ts:323 (9 s),
  :238 (4.5 s); tiger.spec.ts:318 (7 s); pig.spec.ts:167 (6 s).
- **Evidence.** 92 such calls in 40 files, 237 s per project per full run; 295 `waitForTimeout` calls in 72 files in all.
- **Saving.** ~8 runner-min per full run, under a minute of wall time. Mostly a flake fix. **Effort** 2-3 h. **Risk** low. **Helper** (with #4).

### 10. Bundle
- **Change.** Load each boss's character code with his match or intro (dynamic import, as the shop art already is,
  ShopRoom.tsx:117), and load chess/data/openings.json on first use.
- **Evidence** (local build with module stats).
  - Main chunk: 2,629 kB min, 847 kB gzip, past Vite's 1 MB warning.
  - What it holds: app/src/characters 1,184 kB pre-minify (27%), openings.json 460 kB (11%), components 633 kB, screens 483 kB,
    chess/src/bosses 296 kB, faq/content.ts 109 kB, chess.js 104 kB, settings.ts 101 kB.
  - One mixed import: smudgy-intro-art.ts is both dynamic and static, so it isn't split.
- **Saving.** Roughly 35-40% of first-load JavaScript on a phone. Not a CI saving: the build is 8 s of Vite and 16 s of tsc in CI.
- **Effort** 3-5 h. **Risk** medium (intro timing on first load; needs one still per touched intro). **Helper.**

### 11. Deploy
- **Finding.** Workers Builds deploys main on push, independent of CI, so the deploy waits on nothing; it runs
  `npm run build` (≈25 s including tsc). Nothing to cut.
- **Change.** The "Workers Builds" preview check fails instantly on every PR branch (CLAUDE.md says to ignore it). Turn off
  non-production branch builds in the Cloudflare dashboard. That is the owner's account, so it is his to do or delegate.
  **Effort** 5 min. **Risk** none.

### 12. Dead code, flags and shims (small)
- **Unimported files.**
  - components/PauseMenu.tsx (40 lines): delete.
  - characters/sidekicks/*.ts (≈12,000 lines) have no importers, but they are scripts/bake-sidekicks.ts' inputs and
    town-bots.test checks their hashes: keep them.
- **Exports.** 54 used nowhere, even in their own file, in 41 files (most in sim/src: skill.ts 6, poolsim.ts 2,
  hunchess-starts.ts 2; app/src/account.ts `welcomeProgress`, `bossCrateCount`). 706 more exports are used only by tests or scripts.
- **Flags.**
  - `TIMER_BAR_BELOW = true` (Countdown.tsx:41) leaves a dead branch.
  - `SHOP_FREE` and `CRATES_FREE` (core/shop.ts:70, crates.ts:412) stay true until launch, and flipping them is the owner's call.
  - `STREET_TOWN`: 64 references (the street-town work handles it).
- **Shims.** prefs.ts:251-272 moves the pre-Oct `brc.underBoard`/`brc.miniTower` keys. Pre-launch, only the owner's
  devices ever had them, so delete it. `legacyCapSeconds` (settings.ts:3317, squads-lobby.ts:438-446) keeps old Squads test links working.
- **Generated files committed.** Sidekick sheets and PNGs (justified: phone load time). ci-timings.json goes once #1 lands.
- **Saving.** Under 1,000 lines, and a little typecheck and collect time. **Effort** 1 h. **Risk** low. **Director.**

### 13. Process (rules-common.md)
- **The line caps are met by writing longer lines.**
  - Decision notes since the lean rules: 7-9 lines but 186-240 words each, against "about five lines" in CLAUDE.md.
  - PR bodies fell from 610 to 409 words (median).
  - Fix: state the caps in words (decision ≤ 120 words, PR body ≤ 300 words), and cap area-page lines at 160 characters.
- **Shared e2e lock.** "Run local e2e under the shared lock" serializes every helper's local e2e. With Q6 and #7 (own port,
  own state) the lock only guards CPU, so it can allow 2 runs at once (`flock` on one of two lock files) once disk is freed (#6).
- **Push as you go.** It is fine; it only costs CI because `check` never cancels (Q4).
- **The director's re-runs.** "The director checks main's full run after every merge" plus a 31% red rate from flakes is
  the director's biggest wait today. #4 and Q1-Q2 shorten it most.

## Checked, nothing to cut
- **Jobs.** The WebGL jobs are gone (#519); `perf` runs only by hand; engine-container is path-filtered; `plan` takes 14 s.
- **Caches.** The npm cache (286 MB) and browser cache (102 MB) restore in 2-4 s a shard at 75-95 MB/s; `npm ci` takes 6-12 s.
  Their cost is small. The apt step is the cost (Q2).
- **Concurrency on e2e.** PR runs cancel superseded runs; main runs one at a time and the newest waiting run replaces older
  ones (e2e.yml:43-45). Working as designed; #8 trims the rest.
