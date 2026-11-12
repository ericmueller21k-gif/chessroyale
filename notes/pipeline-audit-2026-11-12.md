# Pipeline audit, bloat sweep (Nov 12, 2026)

Read-only. Code at `origin/main` cb60a50 (#663; #665 merged during the sweep). Compared against Nov 9
(notes/pipeline-audit-2026-11-09.md, d1ae9c8). Sources:
- GitHub API: the last 60 main e2e runs (Nov 10 09:09 to Nov 12 17:34 UTC). The jobs of run 43261225701 and all 15 of its `e2e-summary` artifacts give per-file, per-project times. Also 77 PR `check` runs, 66 PR e2e runs (Nov 10 21:30 on), and the 90 PRs merged since Nov 9 13:00 (#576-#665).
- Logs: one `check` run (43269578847) and shard 4's build log, for the bundle.
- Intermittent failures: notes/STATUS.md and docs/decisions/2026-11-11-flaky-batch.md. Per-test failure artifacts of red runs weren't pulled, to stay lean.
- Line counts, made the same way as Nov 9 (src = .ts/.tsx/.css).

## What landed since Nov 9

- **Checks.** The typecheck moved to the `chess` job (F7). `check` fails on a new file `areas.json` doesn't place, and every core module is traced (F3).
- **Retries on main.** A test that passes only on its retry now turns main red (Nov 10, F1). Flaky batches 1-3 are merged and batch 4 is in flight.
- **Bundle.** The boingo-art mixed import is gone (F8). `game-screens` is its own chunk.
- **Branches.** A daily branch-cleanup workflow took remote heads from 570 to 110 (F9).
- **Rules.** CLAUDE.md's model rule now matches RULES (Nov 9, F10).
- **Still open.** F2 (no PR shard cap: `MAX_SHARDS` is 15 for every run), F5 (no word check), F6 (timeouts unchanged) and F11 (PauseMenu.tsx, `TIMER_BAR_BELOW`, `STREET_TOWN` at 89 references).

## Trend (Nov 9 → Nov 12)

| Metric | Nov 9 | Nov 12 | Change | Flag |
| --- | --- | --- | --- | --- |
| LOC app src / test | 223,825 / 32,665 | 238,969 / 34,885 | +6.8% / +6.8% | |
| LOC chess src / test | 23,988 / 23,282 | 24,910 / 24,087 | +3.8% / +3.5% | |
| LOC server src / test | 22,198 / 23,942 | 24,643 / 29,441 | **+11.0% / +23.0%** | Feature: sign-in, age gate, boss powers in the lobby (boss-powers-lobby.test.ts is 1,851 lines). Tests outgrew code 2:1; see L3 |
| LOC core src / test | 10,656 / 4,349 | 11,273 / 4,446 | +5.8% / +2.2% | |
| settings.ts | 4,291 | 4,663 | +8.7% | |
| scripts/ lines | 10,521 | 15,775 | **+50%** | Partly a feature (trailer reel, cheater demo). Also generated boss art committed under `scripts/boss-art/out/` (6 PNGs plus generated .ts). See Q4 |
| `frames-*` scripts | 35 | 35 | 0 | |
| e2e lines / spec files | 41,806 / 120 | 44,515 / 125 | +6.5% / +4% | |
| Unit tests (`unit` job) | 4,781 in 318 files (both jobs) | `unit` alone: 3,952 in 289 files. `chess` count not read | n/a | |
| Unit time | unit 316 s wall, collect 323 s; chess 220 s | unit 339 s, **collect 167 s** (−48%); chess 61 s typecheck + 303 s tests | | The two jobs end within 25 s of each other: balanced |
| `check` PR wall | median 7.2 min | **6.4** (n=77, p75 6.8) | −11% | 2 failures |
| E2e test time, full run | 23,522 s (phone 15,207, desktop 8,315) | **20,756 s (phone 14,062, desktop 6,694)** | −12% | |
| Slowest 10 specs (s, phone + desktop) | boss-challenge 969; shop 961; autochess 943; town-chat 786; crowd 762; town 680; recluse 670; boss-bar-same 624; king-attack 578; boss-side 568 | recluse 689 (573/116); shop 677 (508/169); boss-bar-same 636 (phone only); boss-challenge 608 (518/90); boss-side 546 (**178/368**); town-chat 488; king-attack 486; town-controls 474 (280/194); formats 422; dash 404 | Top spec −29% | autochess (309) and crowd (363) are off the list after their splits. boss-side's desktop still takes twice its phone time |
| Shards (run 43261225701) | 690-986 s | **632-847 s** | | 1 min of setup a shard (container 25 s, `npm ci` 7-13 s, build 11-15 s) |
| CI wall, full main run | median 20.8 min (15 shards) | **median 15.9** (n=55; green 16.4). Today: 19.0 (…5701, 3 min queue), 15.6 (…8402), 16.0 (…5802), 14.3 (…6482) | −24% | Nine runs took 24-51 min (1235, 1272, 1313, 1357, 1361, 1362, 1421, 1428, 1436): runner queue in busy hours, F2 still open |
| CI wall, PR e2e | median 17.7 min | **14.1** (n=66; p25 9.3, p75 15.4) | −20% | 11 of 66 red |
| Red main runs | 9 of 50 (18%) | **33 of 55 (60%)** | ×3.3 | Mostly the Nov 10 rule (retry-pass = red), not new breakage. See L1 |
| Intermittent failures on main since Nov 9 (STATUS mentions) | (n/a) | colosseum:42 ×4; boss-bar:204 ×4; zebra-home:93 ×3 (fixed); tiger:305 ×3; matchmaking:22 ×3; gardener:229 ×3; boss-challenge:155 ×3 (fixed); shop:870, shop:1480 (fixed), search-home:61, sawyer:113, recluse:824, multiplayer:18, global-chat:46, dash:241, boss-challenge:1169 ×2 each; ~15 more once | | dash:241 is still there from Nov 9 |
| `waitForTimeout` | 322 in 81 files; 101 calls ≥ 1 s | 343 in 85 files; 108 calls ≥ 1 s (199.5 s by literal value) | +6.5% | |
| Tests with a timeout ≥ 400 s | 20 | 23 (14 × 400 s, 2 × 420, 1 × 500, 4 × 600, 900, 1,200); default 300 s | +3 | |
| Repo: remote branches | 570 | **110** | −81% | |
| docs/ images | 475 files, 182 MB | 475 files, 182 MB | flat | The gate holds (#654's PNG caught) |
| Other committed media | n/a | `packages/app/public/media/hunchess-reel*.mp4` 6 MB (feature: trailer); `scripts/boss-art/out/*.png` 172 kB | | |
| Bundle, main chunk (min / gzip) | 2,395 / 836 kB | **1,879 / 659 kB** | −22% / −21% | game-screens split out (279 / 101 kB) |
| Other chunks (min kB) | you-look 346; Town 159; ShopRoom 113.5; main CSS 438 | you-look **396 (+14%)**; openings 350; game-screens 279; Town **177 (+11%)**; ShopRoom **132 (+16%)**; Faq 122; AutoChess 105; Colosseum 94; CSS **467 (+7%)** | | you-look, Town, ShopRoom: features (Boingo pie, Hidden Boss art, shop rooms). Watch you-look |
| Vite build (CI) | 11 s | 12.3 s | | |
| PR bodies | n=64: median 25.5 lines, 330 words; 11 over 40 lines | **n=90: median 27 lines, 440 words; 19 over 40 lines**; longest #652 1,344 words, #656 105 lines / 1,216 words | **words +33%** | No feature reason. L2 |
| Decision notes | 76 in 3.5 days, 21,045 words; median 11 lines / 220 words; 40 over 10 lines | **116 in 3.5 days, 34,331 words**; median 10 lines / 174 words; **55 over 10 lines**; longest flaky-batch 2,505, signin-without-age 1,887, room-smooth 1,341, boingo-face-pie 1,340, flaky-batch-sweep 1,243 | **count +53%, words +63%** | No feature reason. L2 |
| Area pages | 6,709 lines | 7,061 | +5.2% | |
| PRs with the `full-e2e` label | n/a | 11 of 90 | | |

**Over 10% without a feature reason.** Decision-note volume (+63% words) and PR body words (+33%). The red main rate
(×3.3) comes from a rule change, not code. Server tests (+23%) and scripts/ (+50%) have feature reasons, with the
caveats in L3 and Q4. Everything else is flat or down: CI got faster across the board.

## Quick wins (director, each under 30 min)

- **Q1. Cap PR e2e at 8 shards (F2, still open).**
  - Change: in `e2e/ci-select.mjs:304,314`, `MAX_SHARDS` → 8 when the event is `pull_request` without `full-e2e`.
  - Evidence: nine main runs took 24-51 min against 15-16 when runners were free (1235, 1272, 1313, 1357, 1361, 1362, 1421, 1428, 1436). Today's 43261225701 waited 3 min for the plan alone. 11 PRs carried `full-e2e`, so 15 PR shards plus 15 main shards beat the 20-runner cap.
  - Size: 15 min.
- **Q2. A word cap on decision notes and PR bodies (F5).**
  - Change: a warning step in `check.yml` for added `docs/decisions/*.md` over 150 words.
  - Evidence: 116 notes and 34k words in 3.5 days (+63%). 55 notes are over the 10-line rule. Flaky-batch notes alone are 2,505 + 1,243 words.
  - Also: put "≤ 120 words; tables of fixes go in the PR body, not the note" in rules-common.md.
  - Size: 20 min.
- **Q3. Separate retry-pass reds from hard reds.**
  - Change: the `result` summary already lists flaky first. Make its title say "red: flaky only (N)" or "red: N failed", and have STATUS log the two apart.
  - Evidence: 33 of 55 main runs red. STATUS shows most were retry-passes (age-gate:61, global-chat:116, town-leave:148, matchmaking:22 …). The director can't tell at a glance which reds need a revert.
  - Size: 10 min, `e2e/ci-summary-merge.mjs:35` and the final step.
- **Q4. Stop committing generated boss art.**
  - Change: move `scripts/boss-art/out/` to `.gitignore` (and remove the existing files) or to a `stills/*` branch, as with docs images.
  - Evidence: 6 PNGs plus generated .ts and a .md, part of scripts/ +50%.
  - Size: 10 min.
- **Q5. F11 leftovers.**
  - Change: delete `components/PauseMenu.tsx` (no importers) and the `TIMER_BAR_BELOW` dead branch (`Countdown.tsx:41`).
  - Size: 15 min, light lane.

## Larger items (helper PRs)

- **L1. Flaky batch 5, then hold the line (F1).**
  - Target: colosseum:42 ×4, boss-bar:204 ×4 (in batch 4), tiger:305 ×3, matchmaking:22 ×3 (5,289 ms against a 5 s budget), gardener:229 desktop ×3, dash:241 (open since Nov 9), sawyer:113, recluse:824, search-home:61. The same method as batches 1-3.
  - Evidence: 60% of main runs red. Each costs a re-run (15 runners, about 16 min) and a director look.
  - Size: Opus high, 3-4 h. The lost-Escape `useEffect` pattern was found in 9 pop-ups. A lint for `keydown` listeners in `useEffect` would stop it coming back (30 min inside the same PR).
- **L2. Docs volume.**
  - Change: flaky batches write one table in the PR body and a five-line note. The 2026-11-11-flaky-batch.md (2,505 words) is the model of what not to do: every helper on those areas re-reads it.
  - Also: trim the five longest notes to ≤ 150 words, moving long design text to the area page or `docs/ideas/`.
  - Size: Haiku, 1 h.
- **L3. Server test growth.**
  - Evidence: server tests +23% against code +11%. boss-powers-lobby.test.ts (1,851 lines) and lobby.test.ts (1,152) dominate.
  - Change: review for repeated whole-lobby setups that could share a fixture.
  - Saving: lines, not CI time (the unit job is 339 s and balanced). Low priority.
  - Size: Opus medium, 2 h.
- **L4. Desktop repeats (F4, still open).**
  - Evidence: boss-side desktop is 368 s against 178 phone, tiger desktop 226 against 173, town-controls desktop 194. Desktop is 6,694 s overall (−20% since Nov 9), so the rest has worked.
  - Change: review these three for `@phone-only` (keep the `docs/rules/eric.md` guards on both projects).
  - Saving: about 400 s a full run.
  - Size: Opus medium, 2 h.
- **L5. Long timeouts (F6).**
  - Evidence: 23 tests set ≥ 400 s; boss-bar-same's is 1,200 s and town-rows' 900 s. A stall there burns 20-40 min of a shard across the retry.
  - Change: set each to 2× its measured time (in the e2e-summary artifacts).
  - Size: folds into L1.
- **L6. Bundle watch.**
  - Evidence: you-look grew 50 kB (+14%) and CSS 29 kB in 3 days. The main chunk is still 1.9 MB.
  - Change: the Nov 6 character split (load each boss's code with his match) remains the big win.
  - Size: Opus high, 3-5 h. Not urgent: no CI cost.
