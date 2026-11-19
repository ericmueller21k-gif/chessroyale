# Pipeline audit, bloat sweep (Nov 19, 2026)

Read-only. Code at `origin/main` ceab372 (#814). Compared against Nov 16 (notes/pipeline-audit-2026-11-16.md, base d82aafc = #740).
74 PRs merged since (#741-#814). The features since then were the Battle Tower (PRs 6-11 and its layer work, a feature reason
from Nov 18 on), the Crowd 50 v 50 rework (C1-C5), the Chandy rounds, the Ginger Super Freeze, Big Boy's tower, Dash's stall,
the star ride, payments design and the bundle split.

Sources:
- GitHub API: 74 completed main e2e runs since d82aafc (Nov 16 05:31 to Nov 19 07:11 UTC); 65 PR `check` runs and 50 PR e2e
  runs (the API's last 100 of each go back to Nov 17 19:00); the 74 merged PR bodies.
- Per-spec e2e times: all 15 `e2e-summary` artifacts of today's green full run 44477650358 (ceab372). One run only this time, so
  read about ±5% as noise.
- `check` timings: the jobs of runs 44580260707 and 44576839914 (today, Battle Tower PRs 10 and 11).
- Chess unit-test files: a local `npx vitest run packages/chess/test` of ceab372 (4 cores, JSON reporter).
- Bundle: local `vite build` of ceab372, then a bisect over the first-parent merges since #759 (the split).
- Intermittent failures: spec:line mentions added to notes/STATUS.md and CHANGELOG.md since Nov 16 05:40 (the same method).
- Line counts made the same way as before (src = .ts/.tsx/.css), both revisions measured today.

## What landed since Nov 16

- **T1 (town taps), mostly done.** #751 "faster town taps" shipped. The e2e total fell 24,230 → 21,838 s (−10%). town-chat fell
  934 → 733 s and boss-challenge 951 → 672 s, while shop stayed at 1,123 s.
- **T2 (music), done (#754, 128 kbps).** Music is now 34 files and 45 MB, down from 33 files and 63.8 MB. Tracked files went 358 → 341 MB.
- **T4 (docs volume), half done (#758).** PR bodies are much shorter. The decision-note warning went down to 200 words. The total words
  in notes went up anyway (see N3).
- **L6 (bundle split, #759), done and then undone.** On Nov 16 the main chunk was 1,290 kB. #775 pulled it back up the next day
  (see N1).

## Trend (Nov 16 → Nov 19)

| Metric | Nov 16 | Nov 19 | Change | Flag |
| --- | --- | --- | --- | --- |
| LOC app src / test | 251,998 / 38,020 | 259,856 / 39,768 | +3.1% / +4.6% | |
| LOC chess src / test | 25,194 / 24,417 | 28,485 / 28,396 | **+13% / +16%** | Feature: Chandy kit (+1,287 / +1,001), tower board layer and twins, several bosses, runner +781 |
| LOC server src / test | 26,951 / 31,841 | 28,277 / 33,717 | +4.9% / +5.9% | |
| LOC core src / test | 11,626 / 4,468 | 12,769 / 5,244 | +9.8% / **+17%** | Feature: crowd-rework (+429 test lines), settings |
| settings.ts | 4,966 | 5,408 | +8.9% | |
| scripts/ lines | 14,015 | 14,158 | +1% | |
| `frames-*` scripts | 36 | 36 | flat | |
| e2e lines / spec files | 45,147 / 127 | 46,634 / 128 | +3.3% / +1 | |
| Unit tests (static `it(`/`test(`) | 4,888 cases in 368 files | 5,239 cases in 388 files | +7.2% | |
| Unit time, CI | unit 288 s; chess 54 s typecheck + 195 s tests | **unit 306-310 s; chess 53-62 s typecheck + 440-497 s tests** | unit +7%; **chess tests +126-155%** | **Feature (tower), but now the critical path. N2** |
| `check` PR wall | median 6.7 min (p75 6.9) | **7.4 (n=65; p25 6.7, p75 8.6)**; today's two: 8.8 and 9.8 | +10% (today +31-46%) | N2 |
| E2e test time, full run | 24,230 s (phone 16,568, desktop 7,662) | **21,838 s (phone 14,764, desktop 7,081)** | **−10%** | T1 |
| Slowest 10 specs (s, phone/desktop) | shop 1,158; town 1,095; boss-challenge 951; town-chat 934; recluse 840; town-afk 643; boss-bar-same 626; boss-side 590; king-attack 507; boss-smoke 445 | shop 1,123 (823/301); town 846 (564/282); town-chat 733 (539/195); recluse 729 (633/96); boss-challenge 672 (565/107); boss-bar-same 567; dash 555 (342/214); boss-side 545 (188/357); town-street 525 (322/202); king-attack 488 | town −23%, town-chat −22%, boss-challenge −29%; town-afk 643 → 347; **dash new on the list (was under 445)**; shop flat | shop is still untouched by T1. Dash grew from the stall skit (feature) |
| Shards | 673-1,004 s | 543-973 s | slowest −3% | **The spread is wider: 430 s between the fastest and slowest. N4** |
| CI wall, full main run | median 19.9 (green 19.3; p75 23.2) | **median 19.3 (n=74 non-cancelled; green 19.6; p25 18.0, p75 21.4)**. Today: 18.9, 17.8, 19.0, 20.1, 20.2, 38.3*, 18.4 | −3% | *38.3 waited on the run before it (15 of 74 runs over 24 min, all merge bursts) |
| CI wall, PR e2e | median 16.7 (p25 13.4, p75 18.4) | **15.4 (n=50; p25 9.3, p75 19.1)** | −8% (p25 −31%) | |
| Red main runs | 30 of 54 (56%) | **19 of 74 (26%)**; since Nov 18 05:00, 4 of 26 | **−30 pts** | Nearly all are retry-pass flakes |
| Intermittent failures on main since Nov 16 (STATUS mentions) | fairplay:65 ×16; town-chat ×15; town-leave ×9; … | hopper:212 ×7 (last seen Nov 17); dash:241 ×4 (last seen Nov 16, fixed by #775's spec); chat:80 ×3 (fixed, helper OK'd); bigboy:144 ×3 (fixed by the director, Nov 18); town:221 ×2 (SW activation, #814); town-chat:1384 ×2; multiplayer:18 ×2; global-chat:142 ×2; chandy:297/298, alfil:247 (#813/#814); shop:1454 (`/api/locker` 15 s timeout, Nov 19) | volume down about 60% | **New center: specs for new bosses' moments (chandy, bigboy, alfil, dash). N5** |
| `waitForTimeout` | 359 in 86 files; 115 ≥ 1 s (231.7 s) | 371 in 88 files; 119 ≥ 1 s (243.2 s) | +3.3% (+5% by seconds) | |
| Repo: remote branches | 149 | **197** | **+32%** | No feature reason; cleanup is behind. Quick win Q3 |
| docs/ images | 475 files, 182 MB | 475 files, 182 MB | flat | The gate holds |
| Tracked files, total | 358 MB | 341 MB | −4.7% | T2. Pack on disk is 590 MiB (history keeps the old music) |
| `packages/app/public` | 93.9 MB (music 33 files, 63.8 MB) | 75.1 MB (music 34 files, 45.0 MB) | −20% / −29% | T2 |
| Bundle, main chunk (min / gzip) | 1,999 / 705 kB (split #759 that evening: 1,290 / 458) | **2,214 / 790 kB** | **+11% / +12% on Nov 16; +72% on the split** | **No feature reason: one import. N1** |
| Other chunks (min kB) | you-look 405; openings 351; game-screens 293; Town 193; ShopRoom 138; Faq 123; AutoChess 105; Colosseum 94; CSS 472 | you-look 406; openings 351; game-screens 300; Town 192; ShopRoom 138; Faq 129; AutoChess 105; Colosseum 94; sound-worker 86; CSS 490 | all under +5% | The per-boss `*-art` chunks (29-36 kB each) are new since the split |
| Vite build | 14.1 s (local) | 14.7 s (local) | +4% | |
| PR bodies | n=74: median 37 lines, 492 words; 32 over 40 lines (43%) | **n=74: median 21 lines, 338 words; 7 over 40 lines (9%), 2 over 60**; longest #808 949 words (tower PR 6), #787 793, #812 792 | **lines −43%, words −31%** | T4 worked |
| Decision notes | 61 in 3.5 days, 22,570 words; median 274 words / 14 lines | **81 in 3 days, 36,841 words**; median 214 words / 13 lines; 44 over 200 words; longest battle-tower-design 6,625, payments-design 3,901, battle-tower-audit-1 3,466, several-bosses 2,161 | median −22%; **total words +63%, per day +90%** | **Four design docs make up 44% of the words. N3** |
| Area pages | 7,547 lines | 7,950 | +5.3% | |

**Grew more than 10% with no feature reason:**
- the main bundle chunk: +11% against Nov 16 and +72% against the split that landed that day (N1);
- the total words in decision notes, +63% (N3). Most of that is design text, but it isn't in the right place;
- remote branches, +32% (Q3).

**Grew more than 10% with a feature reason, but worth acting on:**
- the chess unit-test job, +126-155%, which is now `check`'s critical path (N2);
- chess and core LOC, both from the tower and the Crowd rework.

**Fell:** the e2e total, PR e2e wall time, the red rate, music size and PR bodies.

## Quick wins (under an hour each)

- **Q1. Put the bosses' code back off the first load: one import (N1).** Director-sized, 20 min, targeted lane. Saves 920 kB of
  script (330 kB gzip) on every cold home load.
- **Q2. Retarget the PR-body warning's hint.** Today it says "detail goes in the decision note or the area page". Make it say
  "the area page". It is steering the PR text into the notes (N3). 5 min, director, light lane.
- **Q3. Branch cleanup.** There are 197 remote branches, against 149 three days ago. Run the daily cleanup and check that it
  deletes merged `claude/*` branches older than a day. 15 min, director.

## N1. One static import undid the bundle split

- **Evidence.** The bisect over first-parent merges since #759 put the main chunk at 1,290 kB at #759 and 1,301 kB at
  4e35f105. It reached 2,140 kB at be0435e1, the merge of #775 (claude/dash-tap-slow, Nov 17), and is 2,214 kB / 790 kB gzip
  today. #775 added `import { DashTap } from "./components/DashStall.tsx"` to `packages/app/src/App.tsx`. DashStall imports
  `characters/kits.ts` (`bossKit`, every boss's kit), Dash's drawings, `BossCharacter.tsx` and `speech.tsx`. That pulls the whole match chunk back into the entry.
  The #759 note's own measurement, home on a phone at 1,690 → 1,209 ms, is lost again.
- **Cause, not a checker.** Nothing in the code says "App.tsx and home load only through `lazy-game.ts`". The split relies on
  every author knowing it, and an overlay that has to show outside the match screen is the natural place to slip.
- **Change.**
  - Load `DashTap` through `game` (lazy-game.ts) like the other match pieces, or move the small overlay into its own file that
    imports no drawing.
  - Then make the boundary structural, so it isn't left to memory. App-level overlays that belong to a boss mount from the match
    chunk's own root (the way #759 moved BossStage), so App.tsx has no reason to import a boss component at all.
  - A size check would be another checker. Only add one if the structural fix can't be made.
- **Saving.** About 330 kB gzip and about 0.5 s on a phone's cold home load (#759's numbers). No CI time.
- **Size.** Director or an Opus helper (rendering path), `high`, 30-60 min, targeted lane. Re-measure with `vite build`.

## N2. The chess unit tests doubled and now set `check`'s time

- **Evidence.**
  - The `chess` job's test step: 195 s on Nov 16, 440 s and 497 s on today's two runs. With typecheck and setup the job takes
    8.6-9.6 min, against `unit`'s 5.4. So `check` now waits on `chess`.
  - Locally (4 cores) the files sum to 1,116 s of CPU. The slowest:
    - boss-kit-side 233 s (new Nov 18: "the kit over every pair and a sample of threes");
    - square-layer-twin 87, held-layer-twin 44, edge-layer-twin 43, shield-layer-twin 31 (new Nov 18, "today's rules frozen"
      twins for the board-layer move);
    - boss-kit 83 and several-bosses 29.
  - The tower files are about 470 s, 42% of the chess total.
- **Why it matters beyond today.** The pair sweep grows with the square of the roster: one more boss adds a full row of pairs.
  The twin tests guard a migration. Once the board layer is the only path (the tower's last layer PR), they freeze rules that
  no longer exist apart from the layer.
- **Change.**
  - Split `packages/chess/test` across two `chess` jobs (vitest `--shard=1/2`, `2/2`). That brings `check` back to about 6 min,
    with no coverage lost. This is a `.github/workflows/check.yml` change, so it needs Eric's OK as a quality-gate edit.
  - In boss-kit-side, run every pair on main's push and a fixed sample of pairs on PRs, plus the pairs of the bosses the PR
    touches. This is the same "targeted on PR, full on main" rule the e2e uses.
  - Retire the four `*-layer-twin` tests when the layer migration closes, and note that in the tower's decision note now, so the
    retirement isn't forgotten.
- **Saving.** 3-4 min per PR on `check`. Every helper and the director wait on `check` before merging.
- **Size.** The shard: director, 20 min (gate edit, Eric's OK). The pair sample: Opus `high`, 1 h, boss lane. Retiring the twins:
  part of the tower's last PR.

## N3. Decision notes: shorter median, but design docs went into docs/decisions

- **Evidence.** 81 new notes in 3 days, 36,841 words, against 22,570 in 3.5 days. The median fell to 214 words, so the warning
  works on ordinary notes. But four files carry 16,153 words:
  - `2026-11-18-battle-tower-design.md` 6,625 (438 lines);
  - `2026-11-17-payments-design.md` 3,901;
  - `2026-11-19-battle-tower-audit-1.md` 3,466;
  - `2026-11-18-several-bosses.md` 2,161.
  The warning only warns, and a design doc reads as "the decision". Also, the new PR-body warning (Nov 16, T4) tells authors to
  put detail "in the decision note or the area page". PR bodies did shrink 31-43%, and some of that text moved into notes.
- **Change.**
  - Q2 above.
  - Give design docs a home: `docs/ideas/` while a design is open, and its area page (`docs/areas/tower.md`, `payments`) once it
    ships. The decision note then keeps Eric's words and the calls, about 150 words, and links to the design.
  - Move the four files' design text now: Haiku, `medium`, 1 h, light lane.
  - No new check. The cause is that there's no named place for a design, not that authors miss the warning.
- **Saving.** Fewer tokens re-read by every tower helper. CLAUDE.md asks helpers to read the area's decisions, and the tower
  design alone is about 9k tokens.

## N4. The shard spread widened: 543 to 973 s

- **Evidence.** Today's full run had shards from 543 to 973 s, where Nov 16's ran 673-1,004 s. The total fell 10% but the
  slowest shard only 3%, so the T1 savings went mostly to shards that weren't the bottleneck. `e2e/ci-timings.json` hasn't been refreshed since #751
  (its only change since was one deleted entry, Nov 17), so it still holds the pre-T1 times.
- **Change.** Refresh `ci-timings.json` from today's summary artifacts. That's the existing script, a data-only change. Check
  whether shop (1,123 s, one file) needs splitting so the packer has smaller pieces.
- **Saving.** About 3-5 min of main's wall time if the slowest shard drops to about 750 s.
- **Size.** Director, 20 min (data). Splitting shop: Haiku, 1 h.

## N5. Flakes moved from the town to new bosses' moments

- **Evidence.** STATUS mentions are down about 60%. The town specs are mostly quiet: town:221 is a service-worker activation
  issue, not a town tap. The new ones are timing reads of short animations: chandy:297 ("rAF sampler missed the short slide
  phase"), chandy:298 (vote tap not stable), alfil:247, bigboy:144 (counted `.pw-tower`), dash:241 (get-up vs lie). Each was
  fixed one at a time (#813, #814, the director's Nov 18 fix).
- **Common cause.** A spec samples the screen to catch a phase lasting a few hundred milliseconds, instead of reading the phase
  from state. That is LESSONS' "watch frame by frame" being turned into a test that races the frames.
- **Change.** No new checker. The boss kit's e2e smoke (`e2e/boss-smoke.spec.ts`) could expose each moment's phase as a test
  hook (the way `phase(page)` works for play/results). New boss specs then assert the phase sequence from state, and the frames
  script stays the visual check. Put this in the boss template's README so new bosses start that way.
- **Size.** Opus `high`, 2 h, boss lane. It mostly pays off for the next bosses.
- Also open: shop:1454 (`GET /api/locker` hit its 15 s timeout and failed its retry, Nov 19 02:35). It's a slow server answer
  under load rather than a timing race. Watch it once more before acting.

## Still open from Nov 16

- **T1 remainder: shop (1,123 s).** It didn't move, and it is the slowest spec and the slowest-shard driver. Same trace work as
  T1: the shop room's entry and tap waits.
- **L4 (desktop repeats).** boss-side desktop is 357 s against 188 s on phone, and town-street desktop 202 s. Unchanged.
- **Rerun-failed-jobs returns 403** for the director's token (Nov 19 02:35), so a flaky red costs a full new run instead of one
  shard. Worth a look at the token's Actions scope: Eric's to grant.
