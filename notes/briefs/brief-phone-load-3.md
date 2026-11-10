# Phone load, part 3: Chess Town opens fast and runs light (Nov 10; Eric: games load slowly on his phone)

Parts 1-2 (#598 lazy boss art, #599 home's shell, one engine, lazy screens) made home fast. The town is next. Seen while
merging #599: the town's first frame paints every house and every boss's frames up front (about 1 s of main thread on a
4x-slowed phone), and the town redraws every animation frame. Read docs/areas/town-square.md, `docs/decisions/2026-11-10-phone-load-2.md`
("Not done") and `town/render.ts` first.

## The changes, biggest first
1. **Measure first** (4x CPU throttle, phone viewport, cold; desktop too): time from tapping Chess Town to the first drawn
   frame and to the town taking taps; long tasks over 50 ms in the first 3 s; memory in the town. The same after.
2. **The first frame draws only what's on screen.** Houses, sidekicks and bosses off camera are cut or painted when they
   first come into view (or in idle time after the first frame), not all before it. Nothing pops in visibly: anything
   that scrolls into view is ready by then (Eric's rule: nothing shifts).
3. **The redraw only when something changed** (a walker moved, an animation frame ticked, the camera moved), not every
   animation frame. Check the town's `@perf` spec before and after (`npx playwright test --grep @perf --project phone`).
4. **The boss sprite's 60 Hz check** (`BossCharacter.tsx`: per-frame moves, sound cues) if it shows in the measurements;
   skip it if it doesn't.

Watch it frame by frame with real taps (`npm run frames:boss` is stuck on the welcome tour on main: dismiss the tour in
the script, or use a short Playwright trace instead). Lane: targeted (the drawing and frame loop change, so `@perf` too).
Effort high. Table of before/after numbers in the PR body. Decision note docs/decisions/2026-11-10-phone-load-3.md
(≤ 120 words); update docs/areas/town-square.md. One still per platform of the town after (stills/phone-load-3 orphan
branch). Push to claude/phone-load-3 at each real step; when done write .pr-body.md and push. Don't open the PR. Read
CLAUDE.md, .claude/LESSONS.md and notes/briefs/rules-common.md first.
