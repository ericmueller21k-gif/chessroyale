# Dash's lying-down clock tap: 3x bigger over the board, and redrawn (Nov 26). Opus high. Characters lane.
Branch `claude/dash-tap-bigger` from main (after #dash-hang-on merges if it touches the same files: check `git log origin/main`).

You are the `characters` delegate (`.claude/agents/characters.md`). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`,
`docs/areas/bosses.md` (Dash), `DASH_TAP` / `DASH_STALL` in `packages/core/src/settings.ts`, `packages/app/src/components/DashStall.tsx`,
his art `packages/app/src/characters/boss-blitz.ts`.

**Eric, Nov 26:** "for the cheetah ... when if you don't move for 10 seconds, like the first time he comes down next to your clock, it's
obviously like he's really small ... could we scale him up maybe like 3 times where he's actually hanging over the board a bit. Like you
can still click on your own tiles that he's blocking ... he should still stay there while you're clicking those. Like he shouldn't move,
because he'll never be covering an entire square." And the pose: "the way he's drawn now when he's like laying down, he is kind of like
wonky. Like it should sort of be just like ... that classic ... you're kind of down with your legs kind of up behind, or ... your feet are
up in the air ... your hands are on your chin ... although he's tapping his clock, so like he can have one hand on, like resting one hand
on his head or whatever, kind of like lackadaisically ... the current drawing, I think it was just sloppy because of how small it had to be."

**Build:**
1. Redraw his lying-down tap pose at the larger size, in his style and palette: on his belly, lower legs up behind him (feet in the air,
   a lazy kick loop is fine), chin or head resting on one hand, the other hand tapping his clock (the existing tap rhythm and sounds).
   Preview with `npm run preview:characters -- <dir>` (GIF + sheet).
2. Show him about 3x his current size, still anchored by your clock, overhanging the board's edge (a setting for the scale). Taps and
   drags pass through him to the board (`pointer-events: none` on his layer, or the board's own hit-testing): your pieces under him stay
   selectable and movable; he never moves or hides while you do. Nothing else on the screen moves (eric.md: nothing shifts). Phone and
   computer; he must never cover the whole of any square (check the geometry at 320, 390 px and 1280x800, 1536x730).
3. Checks: one focused check in Dash's existing e2e spec that a piece under him can be tapped and moved while he's there and that he
   stays; the pose renders in his palette (characters test). Frame-check once with real taps (`npm run frames:character`).
Push the new pose sheet, a GIF and two in-game stills (phone and computer, him over the board) to `stills/dash-tap-bigger` (never under
docs/). `.pr-body.md` (what, player-visible, checks changed old → new), a 5-line decision note. Light/characters lane plus Dash's spec.
About 1.5 hours. At the end commit and push `.pr-body.md` and an empty `.done`, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
