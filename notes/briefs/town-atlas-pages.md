# Town repeat visits: upload the kept atlas pages whole (Nov 25). Opus high, town lane, targeted ("C")

From the town-hitches helper's measurements (Nov 25): a repeat visit to Chess Town (kept pictures) is 2.5 s at 1x / 7.0 s at 4x slowed from
tap to first frame; of that, cutting 1,912 pictures back out of the kept PNG pages is 0.9 / 3.3 s, uploading them 0.3 / 0.55 s. The pages are
already packed atlas pages in IndexedDB. Plan: keep them exactly as packed and upload them whole into the atlas layers on a repeat visit,
instead of cutting and re-uploading each picture. Estimate 7.0 → ~4 s slowed. Files: `town/keep-pictures.ts`, `paint-gl.ts` (kept pages),
`render.ts` (warm's restore path). Guard: the existing kept-pictures perf spec and its pixel hash (pictures identical), plus #937's zero-
uploads-while-walking check stays green on both visits. Start from main. Measure before/after (1x and 4x, 2 runs each). Not done: prefetching
the chunk (A: measured, saves nothing, costs home a long task) and painting from home (B: rejected). `.pr-body.md`, `.done`, push, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort high. ~half a day.
