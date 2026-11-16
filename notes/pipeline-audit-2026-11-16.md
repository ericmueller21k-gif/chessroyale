# Pipeline audit, bloat sweep (Nov 16, 2026)

Read-only. Code at `origin/main` d82aafc (#740). Compared against Nov 12 (notes/pipeline-audit-2026-11-12.md, base f7b7b30 = #665).
74 PRs merged since (#666-#740). Today's features, for context: Chandy (art, home, rules), the Hidden Boss's final form,
the phase 2 computer layout.

Sources:
- GitHub API: the last 60 completed main e2e runs (Nov 13 18:52 to Nov 16 05:30 UTC); 82 PR `check` runs and 64 PR e2e runs
  (Nov 13 23:55 on); the 74 merged PR bodies.
- Per-spec e2e times: all 15 `e2e-summary` artifacts of two green full runs, 43810719063 (today, #740) and 43759604689
  (Nov 15 20:42, #735), to separate a trend from run-to-run noise.
- `check` timings: the jobs of run 43812817429 (today). Bundle: a local `vite build` of d82aafc.
- Intermittent failures: lines added to notes/STATUS.md since Nov 12 17:35 (mentions, the same method as Nov 12).
- Line counts made the same way as Nov 12 (src = .ts/.tsx/.css). Unit-test counts are static this time (`it(`/`test(` calls),
  because the job log's tail no longer carries vitest's summary.

## What landed since Nov 12

- **All five quick wins are done.** Q1 was withdrawn. Q2: `check` warns on a new decision note over 250 words. Q3: the result
  title says "red: flaky only (N)" or "red: N failed" (`e2e/ci-summary-merge.mjs:27`). Q4: `scripts/boss-art/out/` is
  gitignored (scripts/ lines down 11%). Q5: PauseMenu.tsx and `TIMER_BAR_BELOW` are gone.
- **L1/L5.** Flaky batches went on (#698, #705, #715, #732, #734). Tests with a timeout of 400 s or more: 7 by this sweep's
  grep (max 900 s), down from 23.
- **Unit tests got faster.** `unit` 339 → 288 s; chess tests 303 → 195 s.

## Trend (Nov 12 → Nov 16)

| Metric | Nov 12 | Nov 16 | Change | Flag |
| --- | --- | --- | --- | --- |
| LOC app src / test | 238,969 / 34,885 | 251,998 / 38,020 | +5.5% / +9.0% | |
| LOC chess src / test | 24,910 / 24,087 | 25,194 / 24,417 | +1.1% / +1.4% | |
| LOC server src / test | 24,643 / 29,441 | 26,951 / 31,841 | +9.4% / +8.2% | Feature: Chandy, final form online, bans |
| LOC core src / test | 11,273 / 4,446 | 11,626 / 4,468 | +3.1% / +0.5% | |
| settings.ts | 4,663 | 4,966 | +6.5% | |
| scripts/ lines | 15,775 | 14,015 | −11% | Q4 |
| `frames-*` scripts | 35 | 36 | +1 | |
| e2e lines / spec files | 44,515 / 125 | 45,147 / 127 | +1.4% / +2 | |
| Unit tests | `unit` 3,952 in 289 files (log) | 4,888 cases in 368 files, static (base: 4,609 in 351) | +6.1% cases | |
| Unit time | unit 339 s; chess 61 s typecheck + 303 s tests | **unit 288 s; chess 54 s + 195 s** | −15% / −36% | |
| `check` PR wall | median 6.4 min | 6.7 (n=82, p75 6.9) | +5% | 2 failures |
| E2e test time, full run | 20,756 s (phone 14,062, desktop 6,694) | **24,230 s (phone 16,568, desktop 7,662)**; Nov 15: 22,751 | **+16.7%** | **No feature reason for most of it. T1** |
| Slowest 10 specs (s, phone/desktop) | recluse 689; shop 677; boss-bar-same 636; boss-challenge 608; boss-side 546; town-chat 488; king-attack 486; town-controls 474; formats 422; dash 404 | **shop 1,158 (855/303); town 1,095 (739/356); boss-challenge 951 (791/160); town-chat 934 (703/231)**; recluse 840 (677/163); town-afk 643 (369/274); boss-bar-same 626; boss-side 590 (188/402); king-attack 507; boss-smoke 445 | shop +71%, town-chat +91%, boss-challenge +56%; town and town-afk new to the list | **T1.** recluse +22% has a reason (14 → 22 tests) |
| Shards | 632-847 s | 673-1,004 s (Nov 15: 704-850) | slowest +19% | Setup still about 65 s a shard |
| CI wall, full main run | median 15.9 min (green 16.4) | **median 19.9 (n=54 non-cancelled; green 19.3; p75 23.2)**. Today: 18.6 (…5121457), 19.3 (…7290543), 18.8 (…0719063), 21.4 (…3508160) | **+25%** | T1, plus the Nov 13-14 merge bursts (25-44 min while a run waited on the one before) |
| CI wall, PR e2e | median 14.1 (p25 9.3, p75 15.4) | **16.7 (n=64; p25 13.4, p75 18.4)** | **+18% (p25 +44%)** | T1: targeted PRs touch the town-entry specs |
| Red main runs | 33 of 55 (60%) | 30 of 54 (56%); since Nov 15 17:38, 2 of 8 | −4 pts | Today's one red (#738) is a flaky-only result |
| Intermittent failures on main since Nov 12 (STATUS mentions) | colosseum:42 ×4; boss-bar:204 ×4; … | fairplay:65 ×16 (fixed #732); town-chat:1367/1370 ×10 + 1054 ×5; town-leave:148 ×9; shop:238 ×8; town-street:155 ×7, 528 ×5, 226 ×5, 294 ×4 (fixed #734); alfil:247 ×7; sound:61 ×5; town-afk:116 ×4; search-home:61, lobby-chat:28, hopper:212, dash:241 ×3 each; xp-rewards:44 (fixed #731) | | **dash:241 open since Nov 9.** Town specs are 9 of the top 15. T3 |
| `waitForTimeout` | 343 in 85 files; 108 ≥ 1 s (199.5 s) | 359 in 86 files; 115 ≥ 1 s (231.7 s) | +4.7% (+16% by seconds) | |
| Repo: remote branches | 110 | 149 | +35% | Cleanup runs daily; 74 merges in 3.5 days |
| docs/ images | 475 files, 182 MB | 475 files, 182 MB | flat | The gate holds |
| Tracked files, total | 298 MB | **358 MB** | **+20%** | T2 |
| `packages/app/public` | 34.8 MB (music: 11 files, 5.0 MB) | **93.9 MB (music: 33 files, 63.8 MB)** | **+170% (music ×13)** | Feature (boss themes, town music), but the bitrate isn't. T2 |
| Bundle, main chunk (min / gzip) | 1,879 / 659 kB | 1,999 / 705 kB | +6.4% / +7% | |
| Other chunks (min kB) | you-look 396; openings 350; game-screens 279; Town 177; ShopRoom 132; Faq 122; AutoChess 105; Colosseum 94; CSS 467 | you-look 405; openings 351; game-screens 293; Town 193; ShopRoom 138; Faq 123; AutoChess 105; Colosseum 94; CSS 472 | all under +10% (Town +8.8%) | |
| Vite build | 12.3 s (CI) | 14.1 s (local) | | |
| PR bodies | n=90: median 27 lines, 440 words; 19 over 40 lines (21%) | **n=74: median 37 lines, 492 words; 32 over 40 lines (43%)**; longest #707 1,508 words, #712 1,313, #673 1,232 / 106 lines | **lines +37%, words +12%** | **No feature reason. T4** |
| Decision notes | 116 in 3.5 days, 34,331 words; median 10 lines / 174 words; 55 over 10 lines | 61 dated Nov 13-16, 22,570 words; **median 14 lines / 274 words**; 40 over 10 lines; longest recluse-server-only 2,301, ban-blocks-sign-in 1,847, recluse-online-phase2 1,230, recluse-phase1-pause 1,229 | count −47%, words −34%, **median words +57%** | **The median note is over the 250-word warning. T4** |
| Area pages | 7,061 lines | 7,547 | +6.9% | |
| PRs with `full-e2e` | 11 of 90 | 7 of 74 | | |

**Over 10% without a feature reason:**
- e2e test time +17%, which carries main's wall time (+25%) and PR e2e (+18%);
- PR body length (+37% lines);
- the median decision note (+57% words).

The tracked size (+20%) has a feature reason, but how the music is encoded doesn't. Everything else is flat, down or under 10%.

## T1. The e2e suite got 3,500 s slower, mostly in specs that didn't gain tests

- **Evidence.**
  - shop: 677 → 1,158 s with the same 24 tests, and its file shrank by 64 lines. town-chat: 488 → 934 s, 27 tests both times.
  - boss-challenge: 608 → 951 s, 13 tests both times. town-afk: under 404 → 643 s, 7 tests, the file unchanged.
  - Nov 15's run shows the same picture (shop 947, town-chat 1,023, town 903), so it's a trend, not one slow runner.
  - What these specs share: they enter or walk the street town. Since Nov 13, `e2e/helpers.ts` taps the town through
    `townTap` / `tapInTown`. Each tap waits for the view to hold still (`still = 3` frames), polls until you stop moving
    (up to 30 s), and retries with a 20 s wait. Uses went from 0 to 5 in shop, 0 to 3 in boss-challenge and 0 to 28 in town.
- **Likely cause.** The Nov 13-14 town flake fixes ("fix the cause", `docs/decisions/2026-11-14-flaky-causes.md`) bought
  stability with seconds on every town tap. The Town chunk grew 9% and the scene got heavier (Chandy's pond, the sky). Under
  CI's software WebGL, "hold still for 3 frames" costs more with every frame that gets slower.
- **Change.** Profile one shop and one town-chat test from a trace. Measure how long `townTapPoint`'s hold and the "not
  moving" poll take per call. Then:
  - shorten what's safe: one still frame where the point is read from a held frame, and poll "moving" only after a glide;
  - or give these specs a test switch that freezes the town's idle motion. The game's own wait is what's being tested, not
    the idle sway.
  - Keep `docs/rules/eric.md`'s guards untouched; any guard-test edit needs Eric's OK.
- **Saving.** About 1,500-2,500 s a full run (2-3 min of main's wall time), and 2-4 min on most town-touching PRs.
- **Size.** Opus high, 2-3 h, targeted lane.

## T2. Music at 192 kbps is now two-thirds of the app's static files

- **Evidence.**
  - `public/music` holds 33 files and 63.8 MB, against 11 files and 5.0 MB on Nov 12. The biggest are town-loop 4.3 MB
    (180 s at 192 kbps), tiger-loop 4.0, dash-loop 3.9, pig-loop 3.7 and gardener-loop 3.6.
  - 16 music commits since Nov 12. Babur's loop was committed twice in one hour, and each re-render keeps a full copy in
    git history for good.
  - Players download these files too: a 4 MB loop is about 4 s on a slow phone link before the theme can start, unless it
    streams.
- **Change.** Have the music helper's export step write about 128 kbps (or 96 kbps VBR for the loops), check how it sounds
  on a phone, and re-export once. Batch re-renders into one commit per theme.
- **Saving.** About 20-30 MB tracked now, a third off each theme's download, and less history growth per new theme.
- **Size.** Haiku or the music helper, 1 h. Light lane (data).
- **Ask Eric first:** "a little smaller music files, same sound on a phone." The quality call is his.

## T3. Town specs are now the flake center

- **Evidence.** 9 of the 15 most-mentioned intermittent failures since Nov 12 are town specs: town-chat, town-leave,
  town-street ×4 lines, town-afk and town. shop:238 is still open with a "reading-window" proposal. dash:241 has been open
  since Nov 9.
- **Change.** No new checker. The common cause looks like timing in the WebGL town under software rendering. T1's trace
  work is the same investigation, so fold the open town flakes into T1's helper and close dash:241 separately (30 min).
- **Size.** Folds into T1.

## T4. Docs volume: fewer notes, but each note and PR body is longer

- **Evidence.**
  - Decision notes: the median is 274 words, above the 250-word warning. 40 of 61 notes are over 10 lines.
  - The four longest are Hidden Boss and ban design notes of 1,200-2,300 words, which belong on the area page or in
    `docs/ideas/`.
  - PR bodies: 43% are over 40 lines (21% on Nov 12).
  - The warning doesn't bite. It's a warning, and it runs only on new notes.
- **Change (director, 15 min).** Lower the warning to 200 words and add the same warning for PR bodies over 60 lines (the
  e2e `plan` job can read the event's body). Move the four longest notes' design text to `docs/areas/bosses.md` and
  `docs/areas/fairplay.md`, keeping each note at about 150 words.
- **Saving.** Helpers re-read fewer tokens. No CI time.
- **Size.** Director 15 min, plus Haiku 1 h for the moves.

## Still open from Nov 12

- **L3 (server test fixtures).** Server tests grew 8% against code 9%: no longer outgrowing the code. Low priority.
- **L4 (desktop repeats).** boss-side desktop is 402 s against 188 s on phone, still twice. shop desktop 303 s, town 356 s.
  Fold into T1, since the desktop time comes from the same town taps.
- **L6 (bundle).** Main chunk +6%, gzip 705 kB. The per-boss split is still the big win. Not urgent.
