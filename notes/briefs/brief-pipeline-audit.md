# Brief: a full sweep of the build pipeline (read-only), proposing cleanups

**Eric, Nov 6:** "send the auditor out to a full sweep and look for areas that are stalling, redundant, bloated, have it send you the proposed cleanup or changes and then you can fix it, for our entire build pipeline."
Earlier the same day: "it shouldn't be this complicated … something has gotten bloated."

Read first: `/home/user/cr-notes/notes/audit-2026-11-06.md` (this morning's architecture audit; don't repeat it) and `notes/briefs/rules-common.md`.

**Repo:** /home/user/chessroyale. Fetch origin main and read it. READ-ONLY: no commits, pushes or servers. You may run read-only commands, plus local unit tests and timings if useful.

## Sweep everything between "a helper starts a change" and "it's live"
1. **CI** (.github/workflows/*.yml, e2e/ci-select.mjs, ci-shard.mjs, ci-summary*, ci-timings.json):
   - wall time per job, and the setup steps (apt installs, the 300 MB and 107 MB cache downloads in every shard, the build per shard);
   - duplicate work across jobs, such as building the app or Playwright browsers in every shard;
   - whether timings are stale;
   - the shard balance (today shards finished between 17 and 38 minutes);
   - unneeded jobs;
   - the `check` job's 6 minutes;
   - concurrency and cancel-in-progress.
   Use the GitHub MCP tools (mcp__github__actions_list, get_job_logs) to measure real runs from today.
2. **The e2e suite:**
   - the slowest specs;
   - fixed waits (waitForTimeout ≥ 1 s);
   - long timeouts hiding stalls;
   - retries masking flakiness;
   - specs testing the same thing twice;
   - specs that could be unit tests;
   - the intermittent failures seen today (account.spec solo stall, colosseum.spec 3D draw calls, town-rows sky, formats lobby, autochess-sounds timing). A separate helper is fixing the first three; just note the pattern.
3. **Unit tests and typecheck:** total time; the slowest files; anything rebuilding the world per test.
4. **Local dev and helper workflow:**
   - each worktree runs its own `npm ci` and keeps its own node_modules and .wrangler state (disk filled up today);
   - stale local D1 state broke a helper's run;
   - wrangler respawning after `fuser -k`;
   - the shared /tmp/claude-0/e2e.lock;
   - stills and frames scripts (37 of them);
   - port conventions.
   Propose concrete fixes: shared node_modules via a store, a clean-state flag for local D1, one stills runner, a port allocator script.
5. **Repo bloat:**
   - images and GIFs in docs/ (175 MB);
   - generated files committed;
   - dead code (unused exports, files nothing imports: use a quick import-graph scan);
   - duplicate helpers;
   - feature flags that are always on or off;
   - old migration shims;
   - areas.json and docs that are out of date.
6. **Build and deploy:** Vite build time and bundle size (the largest chunks and what's in them); the Workers build; whether the deploy waits on anything unneeded.
7. **Process:** the PR body, decision note and area-page volume since the lean rules (Nov 6); whether any rule in rules-common.md causes needless work.

## Output
Write `/home/user/cr-notes/notes/pipeline-audit-2026-11-06.md` with:
- a ranked list of proposed changes, each with:
  - what to change (files and lines);
  - the measured evidence;
  - the expected saving (minutes per PR or per day, MB, flake rate);
  - the effort (helper-hours);
  - the risk;
  - whether it's a director-sized fix (under 30 minutes) or a helper PR;
- a "quick wins" section at the top: things doable in under an hour with clear savings.

No commits. Report a 15-line summary back.

## Rules
- American English.
- Don't list processes, read env or auth files, print env vars, or call session tools.
- Never name or hint at a real person.
