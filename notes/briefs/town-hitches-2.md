# Town hitches again: long gaps outside our code while walking (Eric, Nov 27 ~08:10 UTC). Opus high, town lane, targeted

Eric: "town feel shorrible again ugh..." with his `/town?report` (live 3c56bcf; transcribed):
- Edge 158 · Windows · ratio 1 (drawn 1) · 1360×948 px · WebGL · ~60 Hz · timer 100 µs.
- **60 fps median, 30 at the 5th %, 20 at the 1st %; 15% of frames over 20 ms, 5% over 33 ms** (Nov 25's report: 6% and 3%).
- 886 frames in 17.5 s. "Most time: Outside our code 14 of 20 ms (ours: Ground 2.4)". No turning. **1 painted, 58 uploads, 0 atlas
  resets** (Nov 25: 1,063 uploads: that fix held). Uploads by source: other 247×206 34 · other 36×29 23 · bubble 1.
- Means (all): Ground 2.4 (worst 12), Camera 0.2 (worst 8.4), Placing & sorting 0.7 (4.9), Buildings 0.6 (6.5), Texture uploads 1.5
  (worst 96; Load column 72), Outside our code 14 (worst 203), Whole frame 20 (worst 217).
- Worst 10: 217 ms at 9.0 s (outside 203, 1 upload, gap); 100 (outside 89, walking, gap); 100 (outside 71, 1 upload, gap); 67 (outside 39,
  walking, 1 upload, gap); 67 (outside 64, walking, gap); 50s: outside 35-48, walking, gap; one 50 ms "Uploads 28, walking, 1 upload".
So the frames that hurt are long GAPS outside our code while walking, most with no upload. Suspects to rule in or out, with evidence:
garbage collection (per-frame allocations in the walk path, the chat or presence code), work outside the frame loop on the main thread
(WebSocket handlers for town presence and chat: 23 residents were online at 07:35 UTC vs 4 at 06:00; Preact re-renders of the town's
DOM: chat, chips, tags, the minimap; timers), the two "other" uploads (247×206 ×34 and 36×29 ×23: what are they, and why re-uploaded?),
and Edge's own efficiency mode on battery (say how to tell from the report, e.g. a rAF cadence that halves).
1. Reproduce on a computer-sized headless page with real traffic if you can (the town on a local wrangler with residents-like presence,
   or a driver that walks and sends presence/chat at the live rate); record long tasks (PerformanceObserver 'longtask'), GC (a heap
   sample before/after, `--js-flags=--trace-gc` in Chromium), and the frame report's gaps. Find what the gaps are.
2. Fix the cause (CLAUDE.md "fix the cause"; Eric: "less lag over all else"). If a gap source can't be ours (the browser's own GC of
   something unavoidable), say so with numbers and make our part as small as possible.
3. The frame report: if "Outside our code" lumps idle time waiting for the next vsync together with real stalls, split them (idle vs
   busy) so the next report tells them apart. Keep it cheap.
4. `@perf` town specs before/after (`npx playwright test --grep @perf --project phone`). Decision note (short), the area page.
`.pr-body.md` (lane: targeted; changed checks), `.done`. Read rules-common.md first. Commits end only with the Claude-Session line.
