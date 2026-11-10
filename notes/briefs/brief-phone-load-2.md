# Phone load, part 2: home starts fast (Nov 10; Eric: "especially six", he notices games loading slowly)

Read `notes/fable-audit-findings-2.md`, "Phone performance", on branch claude/director-notes. Measured on a 4x-throttled
desktop: first content on home 7.6-8.7 s; main script 2.4 MB (836 kB compressed) in one chunk; home 287 MB memory. A second
helper is making the **boss art** lazy right now (`packages/app/src/characters/`, claude/lazy-boss-art-2): don't touch the
boss art or its registration; everything else on the list is yours.

## The changes, biggest first
1. **One engine warm on home, not 3-4** (`App.tsx` ~:530, `engine.ts` ~:48; ~56 MB each): start the rest when a match that
   judges begins (or on the queue screen, so the match itself doesn't wait). Check solo, raid and crowd still judge on time.
2. **Load on entry what home doesn't show** (all imported up front in `App.tsx`): FAQ (~:43) and Legal (~:49), AutoChess
   (~:38), Squads (~:59-60), solo with the runner, chess.js and the boss rules (~:16), the match screens (~:22-25), as Town
   and Colosseum already are. Preload the likely next one on the queue screen so entering a match doesn't add a wait.
3. **A static shell in index.html** (logo, the PLAY area's outline): something shows at ~0.3 s. Eric's rule: nothing
   shifts. The shell must sit exactly where home's real parts land (phone and desktop, light and dark), so the swap is
   invisible: check it frame by frame (`npm run frames:boss` or a short trace).
4. **One video format** in the offline cache (`vite.config.ts` ~:82); lazy art cached on first use, not precached.
5. **Town: sidekick sheets cut on first appearance**, not all 14 into 875 canvases on entry (`town/render.ts` ~:305-320).
6. Small: home's art timers stop in a hidden tab (`home-art/Pic.tsx` ~:45-51); boss sprites redraw only when their frame
   changes, not 60 times a second (`BossCharacter.tsx` ~:369, `GodKing.tsx` ~:83).
7. **Not now:** the town's every-frame redraw (confirm on a real phone with `@perf` first; note it in the PR).

**Measure before and after** (4x CPU throttle, phone viewport; desktop too): first content, home interactive, main-chunk
size, memory on home. A table in the PR body. Lane: targeted (shared app modules; the drawing changes, so `@perf` too:
`npx playwright test --grep @perf --project phone`). Effort high. Decision note docs/decisions/2026-11-10-phone-load-2.md
(≤ 120 words); update docs/areas/ (hub, engine, town-square as touched). One still per platform of home at first paint
(shell) and after (stills/phone-load-2 orphan branch). Push to claude/phone-load-2 at each real step; when done write
.pr-body.md and push. Don't open the PR. Read CLAUDE.md, .claude/LESSONS.md and notes/briefs/rules-common.md first.
