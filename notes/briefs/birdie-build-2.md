# Birdie, the build, part 2: the approved cutscene art, his music and the ultimate's timing. Opus, high

Branch `claude/birdie` (part 1 is done: read its `.pr-body.md`, its decision notes `docs/decisions/2026-11-23-birdie-*.md`, and
`notes/designs-birdie.md` on `claude/director-notes`, all of it, above all "His music and the ultimate's timing"). Start:
`git fetch origin claude/birdie main && git checkout -B claude/birdie origin/claude/birdie && git log --oneline -1`. Push at each
real step. Three jobs:
1. **Stills out of `docs/`** (the repo never keeps images under docs/): move `docs/birdie/*.png` to an orphan branch
   `stills/birdie-build` and delete them from `claude/birdie`. Fix any link to them.
2. **The approved cutscene art.** Part 1 baked the FIRST pass of the fall scene (`arena-birdie-fall` at b6d604fe). Eric approved the
   THIRD pass: `scripts/boss-art/out/arena-birdie-fall/` at `fd5cad0ec` on `claude/boss-art` (a rounded locomotive nose, a head-on hit;
   the last `approach` frame is the impact). Copy it in and re-bake (`scripts/bake-birdie-cutscene.ts`), keeping the timings. The armored
   scene (`arena-birdie-armored`) is unchanged.
3. **His music and the ultimate's timing** (Eric's words, via the music helper, in the design's music section):
   - The files are on `stills/trailer-v2` at `6981fcee`, folder `boss-music-stereo-192/`: `birdie-loop` and `birdie-ult-intro`.
     Re-encode both to 128 kbps as every theme (`ffmpeg -c:a libmp3lame -b:a 128k -ar 48000 -ac 2`), checked to line up with the
     originals at pad, 30 s and the loop point. Add the `themes.json` entries: `birdie` (one loop, 136.296292 s, no intro) and
     `birdie-ult` (intro `birdie-ult-intro`, `introSeconds` 14.814813, loop `birdie-loop`), and a README section.
   - **The ultimate's timing:** the crowd's capture that crosses his threshold switches the battle's music to `birdie-ult` with
     `switchPlan`'s `dropAt` at the train's impact (the piece starts 14.814813 s before it). His reply waits for the drop (about
     15 s from the capture); he says a line before it; the cutscene starts at dropAt minus its time to the impact frame, so the
     impact, his transformation and his theme's first hit land together. Once a battle. The crowd's clock doesn't run while he waits.
     Online the same (the lobby holds his turn for that time; a device without the music still sees the same timing). Numbers in
     `settings.ts`. Keep before show (`.claude/LESSONS.md`): a reload during the wait or the cutscene resumes it correctly.
Prove it with typecheck, the unit tests you touch, `e2e/birdie.spec.ts` (add a check that his reply comes at the drop, not before)
and the boss kit; watch the cutscene frame by frame once (`npm run frames:boss`). Update `.pr-body.md` (what changed in part 2,
changed checks old → new) and the stills (new: the cutscene at impact). Write `.done`, push and stop. Don't open PRs or wait on CI.
Commits end with the `Claude-Session:` line only.
