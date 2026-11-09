# Pipeline audit, bloat sweep (Nov 9, 2026)

Read-only. Code at `origin/main` d1ae9c8 (#586). Compared against the Nov 6 baseline (notes/pipeline-audit-2026-11-06.md,
code at 24a6bf2, #523). Measured from GitHub's API:
- 60 main e2e runs since Nov 6 12:00 UTC (jobs and steps of each), plus the `e2e-summary-*` artifacts of the 52 runs from #938 on (every flaky and failed test, per file and project);
- 194 PR runs (84 e2e, 110 `check`) since Nov 6 20:00;
- one `check` log (run 1599, per-file test times);
- the 62 PRs merged since Nov 6 20:00 replayed through `ci-select.mjs`;
- a local Vite build;
- line counts at both commits, counted the same way as Nov 6 (src = .ts/.tsx/.css).

"Director" = a fix under 30 minutes. "Helper" = its own PR.

## What was fixed since Nov 6

Nearly all of Nov 6's quick wins and four of its ranked items landed that evening (dd74fc7, 5ad49c1, 7c92236, f8c58f0, c3769e7, 182bdca, 4567a56, #536, #562, #564):
- **Shards and caches.** Shard timings come from main's last green run (Q1, #1). Shards run in the Playwright image, so the apt font stall is gone (Q2): setup is now about 1 min a shard, 28 s of it container start. The build is lean (Q3).
- **Superseded runs.** `check` cancels superseded PR runs (Q4).
- **Docs images.** No new images under docs/ (Q5). The gate works: #573's PNG was caught and removed within the PR.
- **Local runs.** Each run gets its own `E2E_PORT` and fresh state (Q6). CLAUDE.md now has measured times (Q7). Actions are on their Node 24 majors (Q8).
- **PR scope.** Fewer PRs run everything (#2). `@phone-only` is in 51 spec files, and desktop test time is down 23% (#3).
- **`check` split.** `check` runs as two parallel jobs (#5).
- **Main e2e.** Main runs on 15 shards since Nov 9. The flaky batch is in (#564; part of #4).
- **Earlier items.** The opening library is its own chunk (part of #10). The Workers Builds preview check no longer shows on PRs (#11).
- **Helper setup.** Helpers now run as their own cloud sessions with GitHub CI as the default lane (RULES, Nov 8). That made #6 (shared node_modules) and most of #7 (port fights) moot. The disk has 29 GB free.

## 1. Trend (Nov 6 → Nov 9)

| Metric | Nov 6 | Nov 9 | Change | Flag |
| --- | --- | --- | --- | --- |
| LOC app src / test | 213,961 / 30,771 | 223,825 / 32,665 | +4.6% / +6.2% | |
| LOC chess src / test | 23,381 / 22,413 | 23,988 / 23,282 | +2.6% / +3.9% | |
| LOC server src / test | 19,684 / 21,249 | 22,198 / 23,942 | **+12.8%** / **+12.7%** | Feature: ranked L1 leave rules, XP and levels (3 phases), quests, friends, typed chat |
| LOC core src / test | 9,665 / 3,878 | 10,656 / 4,349 | **+10.3%** / **+12.1%** | Feature: xp.ts, quests.ts, ranked-leaves.ts, friends.ts |
| settings.ts | 3,923 | 4,291 | +9.4% | Borderline; +392/−24, all new features' tunables |
| maia-worker, sim | 487 / 614; 475 / 9 | unchanged | 0 | |
| e2e lines (ts + mjs) | 37,625 | 41,806 | **+11.1%** | Feature: 11 new spec files (xp, xp-rewards, quests, friends, ranked, town-afk, town-leave, …). See F6 on waits |
| e2e spec files | 109 | 120 | +10.1% | Same |
| scripts/ lines | 13,028 | 10,521 | −19% | |
| `frames-*` scripts | 33 | 35 | +2 | Small; see F8 |
| Unit tests | 4,396 in 294 files | 4,781 in 318 files | +8.8% | |
| Unit test time (CI) | `npm test` 5.7-9.8 min; 1,361 test-s; collect 304 s | Two jobs: unit 316 s wall (521 test-s, **collect 323 s**), chess 220 s wall (592 test-s) | Wall −45% | |
| `check` PR wall | median 10.2 min (n=39) | **median 7.2 min** (n=110; p75 10.5) | −29% | Critical path: the unit job (median 6.7 min; chess 4.4) |
| E2e test time, full run | 24,621 s (phone 13,800, desktop 10,822) | 23,522 s (phone 15,207, desktop 8,315) | −4.5% (phone **+10.2%**, desktop −23%) | Phone grew with the 11 new specs; it is now the bulk |
| Slowest 10 specs (s, both projects, run 1166) | autochess 1,297; recluse 972; shop 904; boss-challenge 895; town-chat 888; … | boss-challenge 969 (phone 482, desktop 487); shop 961 (500/461); autochess 943 (700/243); town-chat 786; crowd 762 (627/135); town 680; recluse 670 (556/114); boss-bar-same 624 (phone only); king-attack 578; boss-side 568 (**phone 190 / desktop 378**) | Autochess −27%, recluse −31%. **boss-challenge +8%, crowd +23%** | |
| CI wall, full main run | median 34.2 min (10 shards, n=11) | 10 shards after Nov 6's fixes: **median 25.4** (n=24, 22.2-39.4). 15 shards (Nov 9): **median 20.8** (n=23, 16.9-42.9); 17-19 min when runners are free | −39% | Slowest shard ~17 min. Shard runtimes spread 11.5-18.8 min |
| Queue for runners (main) | up to 30 min behind the previous main run | 15-shard runs: the last shard starts 0.4 min after the run when idle, but 11-29 min on busy afternoons (runs 1094, 1097, 1101, 1152, 1155, 1166) | | See F2 |
| CI wall, PR e2e | median 33.6 min (n=28) | **median 17.7 min** (n=84; p25 9.1, p75 26.6) | −47% | |
| PRs that run every spec | 10 of 17 | 17 of 62 by replay (27%) | | Still triggered by foundations; see F3 |
| Intermittent failures on main | 39 events in 16 runs (2.4 a run); 5 of 16 red | Before #564 (runs 938-1103): 2.21 a run, 29 of 34 runs touched. After #564 (1105-1173): **1.28 a run**, 12 of 18 touched, 3 hard failures | −47% a run | Retries still 1. See F1 |
| Red main runs | 5 of 16 | 9 of 50 since #938 (1020, 1079, 1094, 1101, 1103, 1107, 1157, 1159, 1171) | 31% → 18% | Two (1157, 1159) red with no failed test: see F2 |
| Repo size (GitHub) | .git 543 MB local | 538 MB (API `size`) | flat | |
| docs/ images | 475 files, 181 MB | 475 files, 182 MB | flat | Q5 holds |
| Remote branches | (not measured) | **570** (525 `claude/*`, 17 `stills/*` about 19 MB, 10 `review/*`); delete-branch-on-merge is off | | F9 |
| Bundle, main chunk (min / gzip) | 2,629 / 847 kB | 2,395 / 836 kB | −9% / −1% | The openings moved out (350 kB / 49 kB) |
| Other chunks (min kB) | you-look 336; Town 153; Colosseum 94; ShopRoom 88 | you-look 346; Town 159; ShopRoom **113.5 (+29%)**; Colosseum 94; main CSS **438 (89 gzip)** | | ShopRoom: feature (#585 shop page). A new mixed import (boingo-art.ts, F7) |
| Vite build (local) | 8 s Vite, 16 s tsc | 11 s Vite; 38 s with tsc (`npm run build -w app`) | | |
| PR bodies | median 23 lines, 409 words | n=64: **median 25.5 lines, 330 words**; 11 over the 40-line cap; max 91 lines / 933 words (#582) | words −19% | F5 |
| Decision notes | 7-9 lines, 186-240 words (n=5) | **76 notes in 3.5 days**, 21,045 words; median 11 lines, 220 words; **40 of 76 over the 10-line cap**; the longest 1,334 (welcome-crate), 1,174 (smudgy-home), 950 (admin-abilities) | | F5 |
| Area pages | 6,416 lines | 6,709 | +4.6% | |
| `waitForTimeout` | 295 in 72 files; 92 calls of 1 s or more (237 s) | 322 in 81 files; 101 calls of 1 s or more (249 s) | +9% | F6 |

Over 10% without a clear feature reason: none. Server, core and e2e grew 10-13%, all from the XP, quests, ranked, friends
and chat work merged since. Two things grew faster than the features behind them: decision-note volume (F5) and
phone e2e time (F4).

## 2. Findings

### F1. Flakes: halved, not gone; retries still mask them
- **Evidence.** 98 flaky or failed events across 52 main runs.
- **The top offenders since #564** (runs 1105-1173):

  | Spec:line | Events | Error |
  | --- | --- | --- |
  | dash.spec.ts:241 (Scramble Rush) | 15 in all, 5 since #564; the worst by far | `toContain "c3"` on the watcher's piece list |
  | home-ranked.spec.ts:240/242/300 (390×844 ranked's y) | 6 | Off by 3 px instead of ≤ 1 |
  | sound.spec.ts:61 (Big Boy drawn) | 8 | Still flaky after Nov 6's batch |
  | autochess.spec.ts:2986 | 2 | Reads `undefined.x` |
  | town-chat.spec.ts:1187/1194 ("stays put as the log fades") | 2 | 30 px vs < 15; red in 1171 |
  | squads-three-boards.spec.ts:152/181 | 5 | Red in 1171 |
  | formats.spec.ts:194 | 5 | 11-13 px vs ≥ 16; red in 1107 |

- **Fixed by #564.** squads-watch:167 (red 3 times before) and shop:1067.
- **Change.**
  1. A small batch (dash:241, home-ranked's y, sound:61, town-chat:1194, formats:194, squads-three-boards:181), with the same method as #564.
  2. Then retries to 0 on main. Main is now 15 shards × ~14 min, so a retry hides the flake, while a red run costs a 15-runner re-run.
- **Saving.** About 1 red main run a day to near zero. Each red run costs the director a "re-run failed jobs" (~15 min of runners at 15 shards) and a look.
- **Size.** Helper, 3-4 h. Medium effort.

### F2. 15 shards hit the runner limit on busy afternoons, and two runs went red with no failing test
- **Queue evidence.** A full main run is now 15 shards + plan + result. A PR's run can be up to 15 shards too, plus 2 `check` jobs per push.
  - GitHub's free plan runs 20 jobs at once.
  - In 6 of 23 fifteen-shard main runs, the last shard started 11-29 min after the run (1094: 29 min, wall 42.9 against 17-19 idle).
  - Runner-minutes per full run are unchanged: 15 × ~14.5 = ~218, against 10 × ~22 = ~220. The gain is wall time only when runners are free.
- **The two anomalies.**
  - Run 1157 (ca53571): all 15 shards green, no `result` job, conclusion failure.
  - Run 1159 (bf5d383): the plan succeeded with 15 shards, but no shard job was ever created; conclusion failure.
  - Both ran during the 17:50-18:30 burst (four merges in 40 min). This looks like a GitHub-side drop of jobs, not our code. Either way, the director saw two red mains with nothing to fix.
- **Change.**
  1. (a) Cap a PR run at 8 shards (`MAX_SHARDS` stays 15 for a push or the `full-e2e` label). Then a PR run and a main run fit in 20 together: 8 + 15 + plan/result/check ≈ 20 at worst.
  2. (b) Make the `result` job's summary say "no shard ran" in plain words when `needs.shard.result` is `skipped`, so the director doesn't hunt.
  3. (c) If a run is red with no failed shard, re-run it once (the CLAUDE.md flake rule already allows "Re-run failed jobs" once).
- **Saving.** Up to 10-25 min off main runs that land in busy hours (about a quarter of them today), and no phantom red.
- **Size.** Director, 20 min for (a) and (b): `e2e/ci-select.mjs:24,271` and `e2e.yml` result step.

### F3. New core and server modules default to "run everything"
- **Evidence.**
  - The traced list in `e2e/areas.json` (`traced.modules`) is hand-kept.
  - `packages/core/src/**` is in `full`. So `packages/core/src/xp.ts`, new on Nov 8, made both XP PRs that touched it run every spec on the PR ("packages/core/src/xp.ts is a shared foundation").
  - The same goes for any new core module (quests.ts and ranked-leaves.ts were added to the list by hand).
  - quests-mock.ts (app, since deleted) ran everything twice as "not in areas.json".
- **Full-suite triggers in the replay of 62 PRs.**
  - playwright.config.ts 3, core/index.ts 3, server/lobby.ts 2, core/xp.ts 2, unknown file 2.
  - One each: ledger, runner, protocol, Play.tsx, board/logic.ts.
  - The replay can't trace (no repo), so it overcounts the traced ones a little.
- **Change.** In `traceChanges`, treat every `packages/core/src/*.ts` except `index.ts` as traced by default, and drop the per-file list for core. Add a `check` step that fails when a PR adds a file under `packages/` that no area, `traced` or `none` entry matches. The miss then shows in the PR's first minute, not as a full e2e run.
- **Saving.** About 2-3 full PR runs a day become targeted: 15 min of PR wall each, and 15 runners freed (helps F2).
- **Size.** Helper, 2 h. Targeted lane.

### F4. Phone time grew 10% in three days; the desktop project still repeats long logic flows
- **Evidence (run 1166).** Phone is 15,207 test-s, up from 13,800. Desktop flows still costing over 290 s:
  - boss-challenge 487 s;
  - shop 461 s;
  - boss-side 378 s (twice its phone time);
  - town 316 s;
  - town-chat 291 s;
  - dash 237 s;
  - autochess 243 s.
- **The floor.** The slowest single files, phone side: autochess 700 s, crowd 627, boss-bar-same 624, recluse 556. Total test time over 30 workers is 13.1 min, so shards are already balanced (runtimes 690-986 s). Only less test time or more runners lowers the floor now.
- **Change.**
  1. Review those seven desktop flows for `@phone-only` (keep layout and the `docs/rules/eric.md` guards on both). Look first at why boss-side's desktop takes twice its phone time.
  2. Split autochess.spec.ts and crowd.spec.ts into two files each, so no single file is over ~6 min a project.
- **Saving.** ~1,500-2,000 test-s (~7%) and a lower shard floor: about 2 min off every full run.
- **Size.** Helper, 3 h. Targeted lane; the director signs off the list.

### F5. Docs volume: the caps are written down but not met
- **Evidence.**
  - 76 decision notes in 3.5 days (21,045 words). Median 11 lines and 220 words; 40 of 76 over the 10-line cap in rules-common.
  - The longest: welcome-crate 1,334 words, smudgy-home 1,174, admin-abilities 950, xp-rules 691, smudgy-paint-report 600, boss-result-v2 570.
  - PR bodies improved (median 330 words) but 11 of 64 are over 40 lines. The longest: #582 91 lines and #569 77 lines.
  - Every word is re-read by the next helper on the area and by reviewers.
- **Change.**
  1. A `check` step (warning, not failure, at first) that counts words in added `docs/decisions/*.md` files and flags any over 150.
  2. Put "≤ 120 words" next to "≤ 10 lines" in rules-common and in the brief template.
  3. Long design content (xp-rules, admin-abilities) belongs on the area page or in `docs/ideas/`, linked from a short note.
- **Saving.** Roughly 15k words a week less for helpers to read. Small but steady token savings.
- **Size.** Director, 20 min.

### F6. Fixed waits keep growing
- **Evidence.** 101 `waitForTimeout` calls of 1 s or more (249 s per project per run), up from 92. The new ones include town-afk.spec.ts:254 (4 s). The biggest are unchanged from Nov 6:
  - town-chat.spec.ts:1466 (15.5 s);
  - desktop-board.spec.ts:287-288 (8 + 15 s);
  - matchmaking.spec.ts:110 (10 s);
  - gardener.spec.ts:323 (9 s);
  - tiger.spec.ts:319 (7 s);
  - pig.spec.ts:167 (6 s).
- **Long timeouts.** The config's default test timeout is 300 s. 14 tests set 400 s and 6 set 600 s or more: boss-bar-same:282 1,200 s, town-rows:174 900 s, town-controls:460, town-fixed:298/389, boss-bar-same:406. A stall there burns 10-20 min twice before it reports.
- **Change.**
  1. Fold the top 8 waits into F1's batch (clock or polls).
  2. A lint in `check` that warns on a new `waitForTimeout(≥1000)` in a diff.
  3. Lower the default timeout to 180 s and the 900-1,200 s ones to 2× their measured p95.
- **Saving.** ~4 runner-min a full run, and faster failure on stalls.
- **Size.** Helper, with F1.

### F7. `check`'s critical path: the typecheck sits on the slower job
- **Evidence (run 1599).**
  - The unit job: typecheck 56 s, then vitest 316 s. It ends 2.6 min after the chess job, which has no typecheck.
  - Collect is 323 s summed (38% of the unit job's work): app tests import the drawing modules.
- **Change.**
  1. Move `npm run typecheck` to the chess job (`check.yml:44` → after line 57).
  2. Later: find the 5 slowest-collecting app test files (`vitest --reporter=verbose` locally) and point them at narrower imports.
- **Saving.** ~1 min off every `check` run, about 110 runs in 3.5 days.
- **Size.** Director, 5 min (the collect work is a helper's).

### F8. Bundle: the main chunk is still 2.4 MB, and one dynamic import is defeated
- **Evidence.**
  - Vite warns that `town/shops/boingo-art.ts` is imported dynamically by ShopRoom.tsx but statically by `town/kit/models/claw-cabinet.ts`, so it stays in the eager graph. This is a new instance of Nov 6's smudgy-intro case, which is fixed.
  - The main chunk is 2,395 kB min / 836 kB gzip; Nov 6 found the characters were 27% of it.
  - The main CSS is 438 kB (89 kB gzip), not measured before.
- **Change.**
  1. claw-cabinet imports boingo-art dynamically (or the art constants it needs move to a small shared module).
  2. Nov 6's #10, loading each boss's character code with his match, stays the big win.
- **Saving.** About 30-40% of first-load JS on a phone. No CI saving.
- **Size.** Director for the claw-cabinet line (10 min); helper for the character split, 3-5 h.

### F9. 570 remote branches, and every clone fetches them
- **Evidence.**
  - 525 `claude/*` heads, 17 `stills/*` (about 19 MB of PNGs), 10 `review/*`.
  - `delete_branch_on_merge` is false.
  - A full clone of a helper's cloud session fetches every head. RULES: "Deleting a remote branch is blocked by the permission classifier (Nov 8)."
- **Change.**
  1. Eric turns on "Automatically delete head branches" (repo Settings → General), one click.
  2. Eric bulk-deletes merged `claude/*` and old `stills/*` and `review/*` (or allows the director to).
  3. Helpers' `create_session` already passes `source_revision`; add `clone_depth` 1-5.
- **Saving.** Faster session starts. Fewer refs for `git fetch` to compare.
- **Size.** Eric, 5 min.

### F10. Two rule files disagree on helper models and the local lane
- **Evidence.**
  - CLAUDE.md "Same model, always (Eric, Oct 7) … never pick a smaller or cheaper model".
  - RULES.md (Nov 8 throughput rules): helpers run on `claude-haiku-5-5` unless the job needs Opus; "Models: Haiku for UI, docs and simple jobs".
  - CLAUDE.md still describes local e2e "under the shared e2e lock" as the way, while RULES makes GitHub CI the default lane, with local runs only for the 1-3 tests being changed.
  - A helper reading CLAUDE.md alone (every cloud helper does) follows the old rules: Opus, and local runs.
- **Change.** The director asks Eric which model rule stands, then updates CLAUDE.md "Delegates" and "Test lanes" in one docs PR. Changing CLAUDE.md is Eric's to approve.
- **Saving.** Avoids helpers taking the slow local lane, which cost 4-5 h a helper on Nov 8, and avoids helpers on the wrong model.
- **Size.** Director, 15 min plus Eric's answer.

### F11. Dead code and flags from Nov 6, still there (small)
- **Still there.**
  - components/PauseMenu.tsx: no importers.
  - `TIMER_BAR_BELOW = true` (Countdown.tsx:41) with its dead branch.
  - `STREET_TOWN`: 65 references (64 on Nov 6).
  - prefs.ts' pre-October key move.
- **Stills env names.** 24 different variables across specs (CHALLENGE_SHOTS, TYPED_STILLS, RESULT_SHOTS, XP_SHOTS, …), up from 8. One `STILLS` dir variable read by a helper in e2e/helpers.ts would let every spec share it.
- **Change.** One small cleanup PR.
- **Saving.** Lines, and one less thing per still job to look up.
- **Size.** Director, 30 min, or a Haiku helper. Light lane.

### Checked, nothing to cut
- **Shard setup.** ~1 min: container start 28 s, checkout 7 s, setup-node 5 s, `npm ci` 7 s, build 12 s. The apt stall is gone.
- **The plan job.** 18 s.
- **`perf`.** It shows as skipped on every run and costs nothing.
- **Shard balance.** Fine: runtimes are within 690-986 s at 15 shards.
- **Main concurrency.** Working: 9 main runs were superseded and cancelled instead of queued.
- **Workers Builds preview check.** Gone from PRs.
- **docs/ images.** Flat. The orphan `stills/*` branches keep images out of main.

## 3. Top 5, in order

1. **F1 + F6: a second flaky batch, then retries 0 on main.** dash:241, home-ranked's y, sound:61, town-chat:1194, formats:194, squads-three-boards:181, plus the top 8 fixed waits. Helper, 3-4 h.
2. **F2: cap PR runs at 8 shards, and say "no shard ran" in `result`.** Director, 20 min. Ends the 11-29 min runner queue on busy afternoons and the phantom red.
3. **F7: move the typecheck to the chess job.** Director, 5 min, ~1 min off every `check`.
4. **F3: trace every core module by default, and fail `check` on an unmapped new file.** Helper, 2 h. Turns about a quarter of today's full-suite PRs into targeted runs.
5. **F10 + F9: ask Eric which helper-model rule stands, fix CLAUDE.md to match RULES on the CI-first lane, and have Eric turn on delete-branch-on-merge.** Director, 15 min plus Eric's one-click.

Next after these: F4 (phone-only review and splitting the two biggest specs), F5 (a word cap check), F8 (the claw-cabinet
import), F11 (cleanup).
