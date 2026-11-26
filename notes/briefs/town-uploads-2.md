# Town: still 1,211 texture uploads while walking (Eric, Nov 26 evening). Opus high, targeted (town). Branch `claude/town-uploads-2`

Eric's `?report` on his laptop (Edge 158, Windows, 1360x948, ratio 1, WebGL, ~60 Hz; League of Legends' client open in a lobby beside it):
849 frames in 16.7 s, median 60 fps, 5th % 30, 1st % 20; over 20 ms 14%, over 33 ms 6%. **1 painted, 1211 uploads, 0 atlas resets.**
Most time: Outside our code 11 of 20 ms (ours: Buildings 3.0). Worst 10: 117 / 83 / 83 / 67 / 67 / 67 / 66 / 66 / 50 / 50 ms, ALL "walking",
most with "N uploads" (3-12) and "gap". Texture uploads' worst frame 72 ms; Placing & sorting worst 41; Buildings worst 87.
#937 (Nov 25) made walking and zooming upload nothing in its test (116 → 0, guarded on the first and second visit); since then #949
(kept atlas pages uploaded whole: 1eebb9bf, 202b88b0, 0a8bbcb6, 3b55a38f) merged. So either uploads came back (a regression, e.g. from #949),
or a source #937's guard doesn't walk into (other players' / bots' labels and bubbles, chips, the minimap, bosses walking in, lights,
pictures made on demand when walking into a new area).
Do:
1. Reproduce on main at 1360x948 (walk the same way: the square with bots around; and a long walk across areas), with `?report`. Add to
   the report a per-source upload count (which texture: label, bubble, chip, atlas page, minimap, ...) if it can't already say; keep it
   cheap and in the report only.
2. Find what uploads while walking and fix the cause (make it at load, reuse, or keep resident), as #937 did; no new checker in place of a
   fix. If #949 is the cause, fix it there.
3. Extend #937's guard to the scenario that reproduces (walk across areas, with other players/bots and their labels), first and second visit:
   uploads while walking = 0 (or a small fixed number you justify).
4. Measure before/after at 4x CPU throttle and unthrottled: uploads while walking, frames over 33 ms, 1st/5th %. Note what "Outside our
   code" means here (GPU/compositor time the browser spends, which other GPU apps like League's client compete for) and whether anything of
   ours (canvas size, devicePixelRatio, layer count, the WebGL context's settings like preserveDrawingBuffer/antialias) inflates it; fix only
   what evidence supports.
5. `@perf` specs for the town (`npx playwright test --grep @perf --project phone` and desktop where they exist) must pass.
`.pr-body.md` (cause, fix, numbers before/after, checks changed old → new), a decision note, `docs/areas/` town page. Push at each step; at
the end COMMIT and push `.pr-body.md` and an empty `.done`, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. Wait with one foreground `timeout 590 bash -c '…'`, never Monitor.
