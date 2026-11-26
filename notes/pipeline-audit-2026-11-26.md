# Pipeline audit, bloat sweep (Nov 26, 2026)

Read-only. Code at `origin/main` 5134b2e (#984). Compared against Nov 23 (notes/pipeline-audit-2026-11-23.md, base 82bf8db = #895).
About 88 PRs merged since (#896-#984). Features since then: Birdie (Train, Fall, home), the 1 v 1 and 50 v 50 computer frames and
Eric's column rule, end screens round 2, payments PRs 1-6 (who may buy, purchases storage), play coins, the bonus crate and coin boost,
the ladder, residents (town bots), Chandy upgrades, crate opening, ult danger.

Sources:
- GitHub API (`gh api`): 79 non-cancelled main e2e runs since 82bf8db (Nov 23 04:08 to Nov 26 15:51 UTC; 9 more cancelled); 122 PR e2e
  runs and 143 PR `check` runs over the same window; job times of the last 30 green PR `check` runs.
- Per-spec e2e times: the 15 `e2e-summary` artifacts of today's green full run 45846914256 (5134b2e), against Nov 23's 45109994107
  (same method, both read today). One run each, so read about ±5% as noise.
- Intermittent failures: the `e2e-summary` artifacts of all 22 red main runs since Nov 23.
- Unit: the vitest `Duration` line of the `unit` job, run 45845268431 against Nov 23's 45105568947.
- Bundle: local `vite build` of 5134b2e today (15.3 s). LOC, tests, waits, sizes: both revisions measured today from `git show`, so
  the pair is comparable. Two baselines differ from Nov 23's report by method (e2e lines, scripts lines): today's re-measure of
  82bf8db is used for both.
- Not re-measured: the `stills/*` content size (a depth-1 fetch of 117 branches; skipped to keep the sweep lean). Branch counts are
  from `git ls-remote`.

## What landed since Nov 23

- **Q1 (chess halves by time), done, but it overshot.** Half 1 (typecheck + the six slowest files) is now the long pole (N2).
- **Q2 (stills cleanup), done.** `branch-cleanup.yml` deletes a stills branch 7 days after the last merged PR naming it, or at 30
  days if no PR names it. `stills/*` went 160 → 117.
- **Q3 (videos off git), not done.** `stills/trailer-v2` (159 MiB), `stills/reel-music` and `stills/reel-music-fable` are still
  there. No PR names the trailer, so it goes at 30 days (about Dec 23) unless someone deletes it sooner.
- **N4 (battle-tower desktop), done.** battle-tower went 1,196 → 836 s; its desktop run 576 → 248 s.
- **N3 (PR bodies, notes' home), not done.** PR bodies grew again (N1 below).
- **N5 (end battles via a hook, not by playing), not done.** "play"/"results" flakes are down to 2 of 27 (hopper:301, xp:381).

## Trend (Nov 23 → Nov 26)

| Metric | Nov 23 | Nov 26 | Change | Flag |
| --- | --- | --- | --- | --- |
| LOC app src / test | 272,486 / 43,692 | 291,073 / 46,086 | +6.8% / +5.5% | |
| LOC chess src / test | 29,525 / 29,478 | 30,588 / 30,753 | +3.6% / +4.3% | |
| LOC server src / test | 30,063 / 35,973 | 32,636 / 40,933 | +8.6% / **+13.8%** | Feature: purchases, who-buys, residents, ladder, bonus crate, coin boost tests |
| LOC core src / test | 13,245 / 5,397 | 14,766 / 6,363 | **+11.5% / +17.9%** | Feature: payments.ts, play-coins.ts |
| settings.ts | 5,724 | 6,300 | **+10.1%** | Feature: payments and play coins (+668 lines) |
| scripts/ lines (all .ts/.mjs/.js); `frames-*` scripts | 12,971; 37 | 15,291; 37 | **+17.9%** | Feature: `scripts/residents/` (about 1,600 lines, the town bots) |
| e2e lines / spec files | 50,271 / 130 | 53,138 / 132 | +5.7% / +2 (birdie, birdie-home) | |
| Unit tests (static `it(`/`test(`) | 5,546 cases in 407 files | 6,006 in 434 files | +8.3% | |
| Unit time, CI (vitest Duration) | 266 s (334 files) | 287 s (360 files) | +8% | Job median 363 s (p25 320, p75 478), n=30 |
| Chess, CI (job medians, n=30) | half 1: 65 s typecheck + 181 s; half 2: 499 s (8.8 min job) | **half 1: 421 s (p75 536; typecheck 78 s + six files 405 s); half 2: 304 s** | critical path about −20% | **N2: half 1 is now the long pole; the halves are 1.4 : 1** |
| `check` PR wall | median 7.7 min (n=63; p25 6.8, p75 8.9) | **8.8 (n=143; p25 7.3, p75 9.3)** | **+14%** | Job times fell, the wall rose: runner variance (unit p75 478 s, half 1 p75 536 s). N2 |
| E2e test time, full run | 24,081 s (phone 16,121, desktop 7,960) | 25,362 s (phone 16,880, desktop 8,482) | +5.3% | |
| Slowest 10 specs (s, phone/desktop) | battle-tower 1,196; town 894; shop 804; town-chat 774; recluse 713; boss-challenge 698; boss-bar-same 621; dash 595; boss-side 541; town-controls 496 | shop 911 (681/230); **desktop-board 907 (0/907)**; battle-tower 836 (588/248); town 826 (617/209); boss-challenge 808 (685/123); town-chat 793 (585/208); recluse 762 (664/98); boss-bar-same 590; dash 566 (357/209); boss-side 543 (181/362) | **desktop-board +163% (345 → 907)**; shop +13%; boss-challenge +16%; battle-tower −30% | **N3** |
| Other specs that grew >25% | | ranked-1v1 141 → 263 (+87%, desktop 10 → 86); crate-banner 123 → 195 (+59%); town-afk 326 → 426 (+31%); tiger 232 → 315 (+36%, desktop 85 → 154); boss-smoke 407 → 512 (+26%) | | ranked-1v1, tiger and boss-smoke: no feature reason found in this sweep. N3 |
| Shards | 597-1,048 s | **590-1,196 s** | slowest +14%; spread 451 → 606 s | Shard 7 = boss-challenge (808) + boss-smoke (512): both grew. N3 |
| CI wall, full main run | median 20.2 (n=71; green 19.4; p25 18.2, p75 24.5) | 20.1 (n=79; green 19.8; p25 19.0, p75 23.1; max 40.9) | flat | |
| CI wall, PR e2e | median 17.9 (n=49; p25 12.3, p75 20.5) | 18.4 (n=122; p25 12.2, p75 20.4) | +3% | 14 of 122 red |
| Red main runs | 20 of 71 (28%) | **22 of 79 (28%)**; all 22 `FLAKY_RED: true` | flat | 27 flaky or failed tests in 25 places. N4 |
| `waitForTimeout` | 360 in 87 files; 124 ≥ 1 s (254.9 s) | 390 in 91 files; 133 ≥ 1 s (276.7 s) | +8.3% (+8.6% by seconds) | |
| Remote branches | 204: 160 stills, 29 claude, 12 review | **185: 117 stills, 41 claude, 24 review, 2 design, main** | −9% | stills −27% (Q2). `claude/*` +41%, `review/*` doubled: cleanup's 3-day rule, fine |
| docs/ images | 475 files, 181 MiB | 475 files, 181 MiB | flat | The gate holds |
| Tracked files, total | 350.4 MB | 356.2 MB | +1.7% | |
| `packages/app/public` (music) | 82.5 MB (35 tracks, 52.4 MB) | 85.0 MB (37 tracks, 54.8 MB) | +3.0% (+4.7%) | |
| Bundle, main chunk (min / gzip) | 1,380 / 488 kB | **1,474 / 522 kB** | +6.8% / +7.0% | |
| Other chunks (min kB) | boss-blitz 430; you-look 421; openings 350; game-screens 327; kits 271; Town 213; hidden boss 179; ShopRoom 143; Faq 133; sound-worker 86; CSS 493 | CSS 531; boss-blitz 458; you-look 441; game-screens 351; openings 351; kits 282; Town 222; hidden boss 202; ShopRoom 147; Faq 142; **sound-worker 124**; birdie-cutscene.png 109 | CSS +7.8%; hidden boss +13%; **sound-worker +44%** | sound-worker: Birdie's and the crate opening's sounds (feature). Every boss's sounds load in one worker chunk. Note only |
| Vite build | 11.9 s | 15.3 s | +29% | One local sample, different machine load. Noise |
| PR bodies | n=81: median 29 lines, 398 words; 12 over 40, 3 over 60 | **n=88: median 34 lines, 502 words; 34 over 40, 8 over 60**; longest #896 2,519 words, #953 2,310, #967 2,108, #944 1,629, #956 1,603 | **lines +17%, words +26%; over-40 ×2.8** | **No feature reason. N1** |
| Decision notes | 73 in 4 days, 30,141 words; median 256 words / 12 lines | 109 in 3.5 days, 36,535 words; median 224 words / 9 lines; 63 over 200; 7 over 1,000 (purchases-storage 1,440, who-may-buy 1,412, play-coins 1,318, end-screens-2 1,301, chandy-upgrades 1,191, ult-danger 1,060) | median −12%; **words per day +39%**; notes per day +71% | **N1** |
| Area pages | 8,342 lines | 9,047 | +8.5% | |

**Grew more than 10% with no feature reason:**
- PR bodies: words +26%, and 34 of 88 are over 40 lines (12 of 81 on Nov 23). The 60-line warning fires on only 8 (N1).
- Decision-note words per day, +39% (notes per day +71%). The median fell, so the volume is many notes plus seven over 1,000 words (N1).
- `check` PR wall, +14%, while its job times fell: the long pole moved to chess half 1, and its p75 is 536 s (N2).
- desktop-board.spec, +163% (345 → 907 s, 7 → 10 tests): Eric's column-rule guard and the real-screen sizes. The guard is a feature,
  but about 90 s per test is not (N3).
- ranked-1v1 (+87%), tiger (+36%) and boss-smoke (+26%): no feature PR found for them in this sweep (N3).

**Grew more than 10% with a feature reason:** server and core tests, core src, settings.ts, scripts/ (residents), the sound worker.

**Fell:** battle-tower (−30%), stills branches (−27%), solo (−53%), town-leave (−37%), town-fixed (−32%), town-controls (−21%).

## Quick wins (under 30 minutes each, director-sized)

- **Q1. Rebalance chess again: move the typecheck to half 2** (N2). `.github/workflows/check.yml` lines 93-94: change
  `matrix.shard == 1` to `matrix.shard == 2` on the typecheck step, and move `packages/chess/test/edge-layer-twin.test.ts` from
  `HALF1` (line 84) to half 2. Expected: half 1 about 421 → 330 s, half 2 about 304 → 400 s; `check` about 1 min faster at the median
  and more at p75. A `check.yml` edit is a gate edit: Eric's OK, the same as #819 and Q1 on Nov 23.
- **Q2. Delete the video stills branches now** (`stills/trailer-v2`, `stills/reel-music`, `stills/reel-music-fable`; about 190 MiB
  of the stills total). The cleanup would take the trailer on about Dec 23. First ask Eric whether the trailer has a home outside git
  (R2 or a drive); then `git push origin --delete` the three. 10 min plus Eric's yes. Then add one line to the stills script's header:
  "videos go to R2 or a drive, not a branch".
- **Q3. PR body cap where the body is written, not another check** (N1). `notes/briefs/rules-common.md` (the brief every helper
  reads): add "The PR-body file is at most 40 lines: what changed, what players see, the changed checks old → new. Design text goes
  on the area page; test lists go nowhere (CI lists them)." And in `check.yml`'s "The PR body is short" step, lower the warning from
  60 to 40 lines (same gate, Eric's OK). 15 min.
- **Q4. Decision notes for payments go to the area page.** The seven notes over 1,000 words are designs (payments PRs 4-6, play coins,
  end screens 2, Chandy upgrades, ult danger). Add one line to the decision-note template's top, "a design or an audit is not a
  decision: designs go to `docs/ideas/` until shipped, then the area page; audits go to `notes/`". This is Nov 19's and Nov 23's N3,
  still the cause; `docs/ideas/` got one commit in three days. 10 min (the moves themselves are Helper-sized H3).

## N1. PR bodies and notes keep growing

- **Evidence.** PR body median 21 (Nov 19) → 29 (Nov 23) → 34 lines; words 338 → 398 → 502. 34 of 88 over 40 lines. The five longest
  (#896 Birdie, #953 1 v 1 frame, #967 payments 6, #944 end screens 2, #956 50 v 50 frame) are 1,600-2,500 words each. Notes: 109 in
  3.5 days, seven over 1,000 words; the 200-word warning fired on 63 of 109.
- **Cause.** Both checks only warn, and the PR-body warning starts at 60 lines, so a 59-line body passes silently. The text is written
  in the helper's PR-body file, from a brief that sets no size. A designed feature's text has no home but the PR and the note.
- **Change.** Q3 and Q4: the size goes in the brief (where the text is written), and designs get their home. No new checker.
- **Saving.** About 15k words a week less for helpers and the director to re-read; PR reviews faster.

## N2. `check`: half 1 is now the long pole

- **Evidence.** Half 1 job median 421 s (p75 536): typecheck 78 s, then six files in 405 s (boss-kit-side 282 s, several-bosses
  202 s, boss-kit 128 s, square-layer-twin 120 s, edge-layer-twin 66 s, held-layer-twin 55 s; run 45845268431). Half 2 median 304 s.
  Unit median 363 s. `check` wall 7.7 → 8.8 min.
- **Change.** Q1. Still open from Nov 19 and Nov 23: retire the four `*-layer-twin` tests (241 s of CI file time) once the layer
  migration closes, and sample boss-kit-side's pairs on PRs (every pair on main).
- **Saving.** About 1 min per PR from Q1; about 2 more from retiring the twins.

## N3. Specs that grew without a reason in this sweep

- **desktop-board** 345 → 907 s, all desktop, 10 tests (about 90 s each). The column-rule test (line 558) walks 8 screens × 2 sizes;
  the "real screens" tests (line 380) four sizes per screen; the 50 v 50 test (line 476) four sizes. Each screen is reached by playing
  into it. It's the guard for Eric's column rule, so changing it needs Eric's OK. Reaching each screen once and resizing (not
  reloading) per size may halve it: a helper's read.
- **Shard 7 at 1,196 s** holds boss-challenge (808, +16%) and boss-smoke (512, +26%). The planner balances by last green times, but a
  whole spec file is the unit, so a spec over about 800 s sets a floor. Splitting boss-challenge into two files would bring the
  slowest shard to about 1,000 s.
- **ranked-1v1** 141 → 263 s (desktop 10 → 86), **tiger** desktop 85 → 154, **crate-banner** 123 → 195, **town-afk** 326 → 426. Not
  diagnosed here.

## N4. Intermittent failures on main since Nov 23

All 22 red main runs were `FLAKY_RED` (a retry passed, or a re-run job did). 27 tests in 25 places:

- **Already fixed at their cause (listed, not re-diagnosed):** town guard report length (#976), XP decode (#977: xp:223, xp:381),
  tower floorThenMatch (#979: battle-tower:723), three flakes (#981), Dash joke move timing (#984: dash:778 ×2, Nov 26 14:19 and 15:08,
  both before #984's merge).
- **Still open:** `birdie.spec.ts:426` fall cutscene [desktop]: not among main's 22 red runs this window; the proposed cause is two
  software-WebGL towns drawing at once on one runner (3-4 fps). #978 (ranked flake fix) is held for Eric.
- **Geometry asserts on the edge (7 of 27, new pattern):** match-menu:71 (912 against ≥ 947), boss-select:602 (708.6 against ≥ 709.5),
  boss-result:132 and formats:174 (both 14.3 px against ≥ 16, the same run), panel:282 ×2, birdie-home:35 (30 against > 30). A
  check that misses by under 1 px (boss-select) or by an off-by-one (birdie-home) is a tolerance written to today's pixel, not to the
  rule. Two of them (boss-result, formats) failed together in one run, so that may be a real layout race, not tolerance.
- **Timeouts (6):** boss-bar:301 (300 s), crate-banner:118 (180 s), town:1244, town-street:428, town-controls:347, xp:223.
- **Game ended a move early or late (2):** hopper:301, squads-replay:125 (N5 from Nov 23: down from 7 of 20).
- **Real failures that turned green on a re-run:** sawyer:104, zebra-home:273 (its second time; Nov 20 too), match-menu:71,
  town-street:428.
- **Others, one each:** squads-play:103, squads:60, crowd-play:256, town-afk:55, hidden-boss-room:111, boss-smoke:98.

## Helper-sized

- **H1. desktop-board's time** (N3): reach each screen once and resize in place; keep every assert. Opus `high`, 1.5 h, targeted lane;
  a guard test, so Eric's OK on the PR.
- **H2. Geometry tolerances from the rule, not the pixel** (N4): the seven edge asserts above; each threshold derived from the rule it
  guards (e.g. "16 px" checked with the sub-pixel rounding the browser gives), and boss-result/formats looked at as one layout race.
  Opus `high`, 1 h, targeted lane; any guard test in eric.md needs Eric's OK.
- **H3. Move the seven long notes** (N1/Q4): the payments, play-coins, end-screens-2, Chandy and ult-danger notes become five-line
  decisions, their design text moved to the area pages or `docs/ideas/`. Haiku, `medium`, 1 h.
- **H4. Split boss-challenge.spec** into two files at a natural seam (N3), and look at why boss-smoke grew 26%. Opus `high`, 1 h.
- **H5. Retire the layer twins** (N2) once the layer migration is closed: a note saying when, then delete the four files. Opus
  `high`, 30 min plus the call.
- **H6. ranked-1v1 and tiger desktop growth** (N3): find what doubled their desktop time. Opus `medium`, 45 min, read-only first.
