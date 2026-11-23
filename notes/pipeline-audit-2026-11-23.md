# Pipeline audit, bloat sweep (Nov 23, 2026)

Read-only. Code at `origin/main` 82bf8db (#895). Compared against Nov 19 (notes/pipeline-audit-2026-11-19.md, base ceab372 = #814).
81 PRs merged since (#815-#895). Features since then: the Battle Tower (PRs 10-12, party play, lives, shared floors, three audits),
levels and the end screen, solo resume and abandon, Moo's Full Moon, Sawyer's Saw Swap, the Pawn Bounce, two themes, God King shouts,
room doors, the level-up reward card, and the Nov 19 quick wins (#817, #819).

Sources:
- GitHub API: 71 non-cancelled main e2e runs since ceab372 (Nov 19 18:01 to Nov 23 04:08 UTC; 10 more cancelled). The API's last 100
  PR `check` runs (63 since Nov 21 02:48) and PR e2e runs (49 since Nov 21 04:16). The 81 merged PR bodies.
- Per-spec e2e times: all 15 `e2e-summary` artifacts of today's green full run 45109994107 (82bf8db). One run only, so read about ±5%
  as noise.
- Intermittent failures: the `e2e-summary` artifacts of all 20 red main runs since Nov 19, read by a helper. This is better than
  Nov 19's STATUS-mention count, which undercounts now that STATUS is kept short.
- `check` timings: the jobs of today's run 45105568947 (#894). Chess files: local `vitest run packages/chess/test --shard=N/2` of
  82bf8db (4 cores, JSON reporter).
- Bundle: local `vite build` of both 82bf8db and ceab372 today, so the two are comparable.
- Lines of code, waits, tests and repo size: the same methods as Nov 19, with both revisions measured today. Remote branches come from
  `git ls-remote`. The stills sizes come from a depth-1 fetch of `stills/*`, keeping only the blobs that aren't anywhere in main's
  history.

## What landed since Nov 19

- **Q1 (bundle), done (#817).** The main chunk went from 2,228 to 1,380 kB (790 to 488 kB gzip). It's now under the split's own
  number from Nov 16 (1,290 kB). The bosses' art left the entry: `boss-blitz` (430 kB, the shared boss-art kit), `kits` (271 kB)
  and `Hollow` (179 kB) are their own chunks now.
- **Q2 (PR-body hint), done (#817).** PR bodies still grew (see N3 below).
- **Q3 (branches), done for `claude/*` and `review/*` (#819).** There are now 29 `claude/*` branches. But `stills/*` is excluded from
  cleanup by design, and it is now 160 of the 204 branches (N1).
- **N2 (chess tests), half done.** #819 split the tests in two, but the halves are unbalanced (N2). The pair sample and the twin
  retirement weren't done.
- **N3 (design docs need a home), not done.** `docs/ideas/` is unchanged. The new long notes are tower audits and designs again.
- **N4 (shard balance).** The plan now uses main's last green run's own times (live). `ci-timings.json` is only the fallback, and
  it's still unchanged since Nov 17.
- **T1 remainder (shop).** shop went from 1,123 to 804 s (−28%).

## Trend (Nov 19 → Nov 23)

| Metric | Nov 19 | Nov 23 | Change | Flag |
| --- | --- | --- | --- | --- |
| LOC app src / test | 259,856 / 39,768 | 272,486 / 43,692 | +4.9% / +9.9% | |
| LOC chess src / test | 28,485 / 28,396 | 29,525 / 29,478 | +3.7% / +3.8% | |
| LOC server src / test | 28,277 / 33,717 | 30,063 / 35,973 | +6.3% / +6.7% | |
| LOC core src / test | 12,769 / 5,244 | 13,245 / 5,397 | +3.7% / +2.9% | |
| settings.ts | 5,408 | 5,724 | +5.8% | |
| scripts/ lines; `frames-*` scripts | 14,158; 36 | 14,491; 37 | +2.4%; +1 | |
| e2e lines / spec files | 47,620 / 128 (today's count) | 50,152 / 130 | +5.3% / +2 (battle-tower, tower-party) | |
| Unit tests (static `it(`/`test(`) | 5,239 cases in 388 files | 5,546 cases in 407 files | +5.9% | |
| Unit time, CI | unit 306-310 s; chess 53-62 s typecheck + 440-497 s tests (one job) | **unit 266 s; chess half 1: 65 s typecheck + 181 s; half 2: 499 s** | unit −13%; **the chess critical path is unchanged** | **N2: the halves are 1 : 2.8** |
| `check` PR wall | median 7.4 min (n=65; p25 6.7, p75 8.6) | **7.7 (n=63; p25 6.8, p75 8.9)**; today: 7.1, 6.1, 6.9, 9.1, 14.1*, 13.3*, 9.6, 6.1 | +4% | *14.1: 8.8 min of jobs, plus 5.2 min waiting for a runner for the final `check` job (N2) |
| E2e test time, full run | 21,838 s (phone 14,764, desktop 7,081) | **24,089 s (phone 16,121, desktop 7,960)** | **+10.3%** | Feature: the two new tower specs are 1,342 s. Without them, +4.2% |
| Slowest 10 specs (s, phone/desktop) | shop 1,123; town 846; town-chat 733; recluse 729; boss-challenge 672; boss-bar-same 567; dash 555; boss-side 545; town-street 525; king-attack 488 | **battle-tower 1,196 (620/576)**; town 894 (592/302); shop 804 (605/199); town-chat 774 (592/182); recluse 713 (625/88); boss-challenge 698 (584/115); boss-bar-same 621; dash 595 (365/230); boss-side 541 (172/370); town-controls 496 (291/205) | shop −28%; town +6%; dash +7%; boss-bar-same +10%; battle-tower is new and the slowest | **battle-tower's desktop run is 93% of its phone run (N4)** |
| Shards | 543-973 s | 597-1,048 s | slowest +7.7% | The spread is 451 s (was 430). Two shards are over 1,000 s |
| CI wall, full main run | median 19.3 (green 19.6; p25 18.0, p75 21.4) | **median 20.2 (n=71; green 19.4; p25 18.2, p75 24.5)**. Today: 20.7, 17.1, 34.5*, 18.1, 18.3, 21.8, 19.6 | +5% (p75 +14%) | *34.5 waited on the run before it (two pushes 12 s apart, 02:12) |
| CI wall, PR e2e | median 15.4 (p25 9.3, p75 19.1) | **17.9 (n=49; p25 12.3, p75 20.5)** | **+16%** | The tower specs: every tower PR runs both of them, 22 min of test time. N4 |
| Red main runs | 19 of 74 (26%) | **20 of 71 (28%)**; since #882 (Nov 22 13:57), 5 of 15 | flat | 19 of the 20 were retry-pass flakes; one real failure (zebra-home:273, Nov 20). N5 |
| Intermittent failures on main since Nov 19 (from the red runs' summaries) | (STATUS mentions) hopper:212 ×7; dash:241 ×4; chat:80 ×3; bigboy:144 ×3; … | hopper:236 ×2; xp:341, xp:376, xp:382; battle-tower:723, :882; recluse:951, :1094; then one each: claw:95, boss-powers:515, dash:577, squads-replay:125, ranked-1v1:241, town:1244, moo:453, boss-bar:207, boss-select:874, alfil:247, shop:1454, smudgy:189 | 20 failures, 19 places | **7 of 20 are "play" when "results" was expected, or the reverse (a battle ending a move early or late). N5** |
| `waitForTimeout` | 340 in 85 files; 119 ≥ 1 s (243.2 s) (today's count) | 358 in 87 files; 123 ≥ 1 s (253.7 s) | +5.3% (+4.3% by seconds) | |
| Remote branches | 197 | **204: 160 `stills/*`, 29 `claude/*`, 12 `review/*`, 2 `design/*`, main** | +3.6% | `stills/*` is never cleaned. N1 |
| `stills/*` content not in main's history | not measured | **671 MiB in 1,468 files (1,140 PNG, 90 GIF, 25 MP4, 55 OGG). About 276 MiB is from the 52 branches since Nov 19 (159 MiB of it is `stills/trailer-v2` alone), against about 396 MiB from the 108 before** | **about +70% in 4 days (+30% without the trailer)** | **No end of life. N1** |
| docs/ images | 475 files, 181 MiB | 475 files, 181 MiB | flat | The gate holds |
| Tracked files, total; main's pack on disk | 341 MB; 590 MiB | 350 MB; 623 MiB | +2.7%; +5.6% | |
| `packages/app/public` (music) | 75.1 MB (32 tracks, 45.0 MB) | 82.5 MB (35 tracks, 52.4 MB) | +9.8% (music +16%) | Feature: the Smudgy, Chub & Chirp and tower themes |
| Bundle, main chunk (min / gzip) | 2,228 / 790 kB (today's build of ceab372) | **1,380 / 488 kB** | **−38%** | Q1 |
| Other chunks (min kB) | you-look 405; openings 350; game-screens 300; Town 192; ShopRoom 137; Faq 129; AutoChess 105; Colosseum 93; sound-worker 86; CSS 489 | boss-blitz 430 (new: the shared boss-art kit); you-look 421; openings 350; game-screens 327; kits 271 (new); Town 213; Hollow 179 (new); ShopRoom 143; Faq 133; AutoChess 105; Colosseum 93; CSS 493 | Town +11%, game-screens +9% | Town, ShopRoom and Colosseum import `boss-blitz`, so the first town visit still loads 430 kB of every boss's art. Note only |
| Vite build | 14.7 s | 11.9 s (both builds today: 11.9 s) | flat | |
| PR bodies | n=74: median 21 lines, 338 words; 7 over 40 lines, 2 over 60 | **n=81: median 29 lines, 398 words; 12 over 40, 3 over 60**; longest #854 1,389 words, #851 1,306, #855 1,209, #885 1,108 | **lines +38%, words +18%** | **No feature reason. N3** |
| Decision notes | 81 in 3 days, 36,841 words; median 214 words / 13 lines | 73 in 4 days, 30,141 words; **median 256 words** / 12 lines; 45 over 200 words; longest battle-tower-audit-2 2,904, tower-party 2,866, tower-shared-audit 1,598, saw-swap-judge 1,207 | words per day −39%; **median +20%** | **The median is over the 200-word warning. N3** |
| Area pages | 7,950 lines | 8,342 | +4.9% | |

**Grew more than 10% with no feature reason:**
- `stills/*` branches, about +70% (about 276 MiB in 4 days, 159 MiB of it one trailer branch). Together they are now bigger than main's whole history (N1).
- PR bodies, +38% by lines and +18% by words (N3).
- Decision notes' median, +20%. This is just over the bar, but it now sits above its own 200-word warning (N3).

**Grew more than 10% with a feature reason, but worth acting on:**
- The e2e total (+10.3%) and PR e2e wall time (+16%), from the two tower specs. battle-tower's desktop run is nearly as long as its
  phone run (N4).
- Music (+16%): three new themes. Fine.

**Fell:** the main bundle chunk (−38%), shop's e2e time (−28%) and the unit job (−13%).

## Quick wins (under an hour each)

- **Q1. Rebalance the chess halves by time, not file count (N2).** Director-sized, 20 min. It's a `check.yml` edit, so it's a
  gate edit and needs Eric's OK, the same as #819 did. It saves about 3 min on every PR's `check`.
- **Q2. Clean old `stills/*` branches (N1).** First decide with Eric how long a still must stay linkable from its PR. Then add
  `stills/*` with that age, for example 7 days after its PR merged, to `branch-cleanup.yml`. Director, 20 min, gate-adjacent: Eric's
  OK.
- **Q3. Videos go off git (N1).** `stills/trailer-v2` (159 MiB, Nov 23) and the reel branches (`landing-reel` 19 MiB, `reel-music`
  16 MiB) are videos, and videos make up most of the growth. Ordinary stills branches are small: the median is about 1 MiB. Video
  and trailer files belong in R2 or a shared drive, not in a branch. Director, 10 min, plus a line in the stills script's header.

## N1. `stills/*` branches: 671 MiB, with no end of life

- **Evidence.**
  - There are 160 `stills/*` branches, against 29 `claude/*`. Their files that aren't anywhere in main's history total 671 MiB, in
    1,468 files (1,140 PNG, 90 GIF, 25 MP4, 55 OGG).
  - The 52 branches pushed since Nov 19 hold about 276 MiB. The 108 before them hold about 396 MiB.
  - The growth is concentrated. `trailer-v2` (Nov 23) is 159 MiB on its own. Next are `recluse-transform-book` 48, `recluse-qa-fixes`
    32, `end-screen-mockup` 22 and `landing-reel` 19 MiB. The median branch is about 1 MiB.
  - Eight branches carry a whole copy of the repo's tree (about 3,000 to 3,400 files each, such as `home-mode-cards-center` and
    `tower-pixel-hearts`), but almost nothing that isn't already in main. They cost refs, not space.
  - `branch-cleanup.yml` line 5 says stills/* are "Never touched". So nothing ever leaves, and the docs/ image gate just moved the
    images here.
  - A plain `git clone` fetches every branch: about 623 MiB of main plus 671 MiB of stills. Every fresh helper container pays that
    unless it clones a single branch. (This session's clone was single-branch, so it didn't.)
- **Cause, not a checker.** Stills have no end of life. A PR body links them, the PR merges, and the branch stays forever.
- **Change.**
  - Give stills a lifetime: Q2 (for example, 7 days after the PR merges or closes). Eric reviews within a day or two.
  - Videos and trailers go to R2 or a drive: Q3. GIFs and MP4s in stills only when the change is an animation.
  - If old PR bodies must keep their pictures, move them to an R2 bucket (Cloudflare, on Eric's account) instead of a git branch.
    That's Eric's call, and the cost is a few cents a month.
- **Saving.** About 30 MiB a day of stills (plus any videos) stops piling up, and the 671 MiB goes away once the old branches are
  cleaned. Clones get lighter.
- **Size.** Director, 20 min, plus Eric's OK on the age.

## N2. The chess halves are 1 : 2.8, so `check` didn't get faster

- **Evidence.**
  - In today's run 45105568947 (#894), half 1 ran the 65 s typecheck and then 181 s of tests. Half 2 ran 499 s of tests (an 8.8 min
    job). The unit job took 4.4 min.
  - So `check` still waits about 8.8 min on chess, the same as Nov 19's 8.6-9.6 min. The `check` median went 7.4 → 7.7 min.
  - Locally (4 cores), half 1 took 117 s with 334 s of file time. Half 2 took 285 s with 599 s of file time. Vitest's `--shard`
    splits by file count (36 : 36), not by time.
  - Half 2 holds boss-kit-side (191 s), boss-kit (72 s), square-layer-twin (64 s) and held-layer-twin (38 s).
  - several-bosses went from 29 to 102 s locally since Nov 19. That's the largest growth of any single file.
  - The final `check` job also waited 5.2 min for a runner in that run, which made it 14.1 min. That's GitHub's queue, not our code.
- **Change.**
  - Q1: split by name instead of `--shard`. For example, half 1 runs typecheck + boss-kit-side + several-bosses, and half 2 runs the
    rest (about 255 + 65 s against about 340 s in CI terms). Or use three halves.
  - Still open from Nov 19: sample the boss-kit-side pairs on PRs, with every pair on main. That's the same "targeted on PR, full on
    main" rule the e2e uses.
  - Still open from Nov 19: retire the four `*-layer-twin` tests (165 s locally) when the tower's layer migration closes. Today no
    note says when that is.
  - Look at what several-bosses added (3.5×) before it doubles again.
- **Saving.** About 3 min per PR on `check` from the rebalance alone.
- **Size.** The rebalance: director, 20 min (gate edit, Eric's OK). The pair sample: Opus `high`, 1 h, boss lane.

## N3. PR bodies grew back, and notes sit above their own warning

- **Evidence.**
  - PR bodies' median went 21 → 29 lines and 338 → 398 words, and 12 of 81 are over 40 lines (7 of 74 on Nov 19).
  - The longest are feature PRs with full design text: #854 (levels, 1,389 words), #851 (tower fixes, 1,306), #855 (end screen,
    1,209) and #885 (solo resume, 1,108).
  - Decision notes' median rose to 256 words, against the 200-word warning, and 45 of 73 are over 200 words.
  - Audits and designs went into `docs/decisions/` again: battle-tower-audit-2 (2,904), tower-party (2,866) and tower-shared-audit
    (1,598). `docs/ideas/` got nothing.
- **Why.** The PR-body and note checks only warn, and both pass. Nov 19's N3 named the cause: there's no named home for a design or
  an audit, so it lands in whatever file the author is writing.
- **Change (the same as Nov 19's N3, still the cause).**
  - Audits go to `notes/` on `claude/director-notes`. Like the pipeline audits, they're read by the director, not by every helper.
  - Designs go to `docs/ideas/` while open and to the area page once shipped.
  - Say this in the decision-note template's first line, and move the three tower files (Haiku, `medium`, 1 h).
  - No new check.
- **Saving.** Tower helpers re-read about 7,400 fewer words (about 10k tokens) per area read.

## N4. The tower specs: the slowest spec, and desktop repeats phone

- **Evidence.**
  - battle-tower.spec is 1,196 s (phone 620, desktop 576) and tower-party.spec is 146 s.
  - A tower PR runs both specs, about 22 min of test time spread over the PR's shards. The PR e2e median went 15.4 → 17.9 min.
  - battle-tower's desktop run is 93% of its phone run. For most specs desktop is 15-35% of phone (recluse 14%, boss-challenge 20%).
  - This is the same L4 pattern open since Nov 16 (boss-side desktop 370 s against phone 172 s).
- **Change.** Run the climb, floor and party flows on phone only. Keep on desktop only the tests about the computer layout: the
  floor title over the right column (#872) and the accordion bar (#871). Tag those tests, the way `@perf` is tagged.
  It's a test-scope change, so it needs the director's call (targeted lane, no gate edit).
- **Saving.** About 450 s of main's suite. About 7 min of test time on every tower PR.
- **Size.** Opus `high`, 1 h (reading which desktop tests assert layout).

## N5. Flakes: game outcomes, not animation phases

- **Evidence.**
  - There were 20 red main runs since Nov 19. 19 of them were red only because a test passed on its retry, and one was a real
    failure (zebra-home:273, Nov 20).
  - 7 of the 20 failures read "play" when "results" was expected, or the reverse: hopper:236 ×2, recluse:951, smudgy:189, xp:376,
    xp:382 and squads-replay:125. In each, a battle ended a move earlier or later than the test assumed.
  - Four more were reads of a missing move or element: dash:577, boss-bar:207, boss-select:874 and battle-tower:723. Two hit their
    time limit: moo:453 (240 s) and xp:341 (300 s).
  - Eleven flake-fix PRs merged in four days: #821, #823, #844, #858, #859, #860, #882, #884, #887, #888 and #892.
  - Two of them went at the cause: #859 (one mate-safe move picker) and #882 (every spec's moves through `pickMove`). But since
    #882, 5 of 15 main runs were red: xp ×2 (the new resume tests), battle-tower ×2 and the zebra-home timing.
- **Common cause.** A spec plays real moves and then assumes how many moves the battle lasts. Any engine or boss-power change can end
  it a move early. Nov 19's N5 (reading phases from state, not frames) is mostly taken care of. This is the next layer.
- **Change.** No new checker. Specs that test a screen *after* a battle should get there through a test hook that ends the battle
  (the way the admin "Win this match" button, #846, ends one). Then they don't play to the end. Only the specs that test playing a
  battle should play one. Put this in `e2e/helpers.ts`' header and in LESSONS. Then the xp, hopper and recluse end-screen tests use
  it.
- **Saving.** Most of the 7 "play/results" flakes, and their fix PRs, about one a day. Also some e2e time: the xp tests play full
  battles to reach the end screen.
- **Size.** Opus `high`, 1.5 h, targeted lane (it touches the shared e2e helper, so it runs everything).

## Still open from Nov 19

- **Rerun-failed-jobs returns 403** for the director's token. Eric needs to grant it. A flaky red still costs a full new run.
- **`ci-timings.json`** hasn't changed since Nov 17. It's only the fallback now, so it's low priority, but a spec it doesn't know
  (battle-tower on a run with no green predecessor) is packed blind.
