# Review: `claude/wrangler-redraw` (boss lane, one quick pass)

Read-only review of `git diff origin/main...origin/claude/wrangler-redraw` (5 commits, tip `2dae6ed`). No code changed.

## Findings (most severe first)

### 1. The showdown's two ropes still cross often, a little more than before (pre-existing, made slightly worse)

- **Where:** `packages/app/src/components/Pig.tsx:211-212` (`fistsAt`) and `:241-248` (the crowd's rope always gets `FISTS[0]`, the boss's `FISTS[1]`); the new fists are at `packages/app/src/characters/pig.ts:895-896` (`HAUL_FRONT`/`HAUL_BACK`, so `HAUL_FISTS` goes from [21,51]/[55,53] to [17,53]/[27,55]).
- **What goes wrong:** fists are handed out by x order, not by where each rope goes. The comment above `fistsAt` says this keeps the ropes from crossing, but it doesn't. He always hauls from `CORNER` (7, 3), facing the board, so he is always drawn mirrored and both ropes run down and to the right. Two ropes from fists side by side cross whenever the left fist's target lies at a shallower angle than the right fist's target. That depends on the squares, not on which side is the crowd.
- **Measured** (fists exactly as `fistsAt` places them, every ordered pair of from-squares, white below):

  | fists | all square pairs | crowd's piece in ranks 1-4, his in 5-8 |
  |---|---|---|
  | main ([21,51], [55,53]) | 46.8% cross | 20.3% cross |
  | this branch ([17,53], [27,55]) | 49.4% cross | 27.6% cross |

  With the fists now 10 frame px apart (about 4% of the board, down from 14%), the crossing sits right at his hands as an X.
- **Scenario:** a showdown where the crowd's rook comes from h1 and his bishop from a7: the crowd's rope leaves his left (back) fist at a shallow angle toward h1, his rope leaves the right (front) fist steeply toward a7, and the two cross just past his fists.
- **Suggested fix** (a few lines, no art change): give each pair's ropes their fists by direction, not by a fixed order. For each pair, take the from-squares `a` of both ends and the fists' midpoint `m`. Give `FISTS[0]` (the leftmost) the end with the larger `atan2(a.y - m.y, a.x - m.x)` (the steeper one) and `FISTS[1]` the other. Simulated over all 4,032 square pairs: 0% crossing at rope-out. Fix it once per pair, from the from-squares, so a rope never jumps fists mid-yank. Add one check to the existing showdown test in `pig.test.ts`. This is Pig.tsx logic, so the targeted lane, not this PR's boss lane, unless the director folds it in.

### 2. No other bugs found

Everything else the brief asked about checked out. What I checked, with numbers:

- **Ropes start at his fists, every frame.** I ran a script over every frame of every animation of `PIG`, `PIG` drawn mirrored, and `BOSS_PIG_INTRO`. Every `line:` part starts within 3 px of a drawn fist. Every `PIG_INTRO_HANDS` and `PIG_INTRO_HANDS2` grip, including the new `reel` (`h1: "R"`), is within 3 px of a fist. No two ropes in one frame cross: the hold's `between`/`tail`/`line` touch only at the shared fist, and the double lasso's yank ropes (fists at 47 and 64) don't cross either. Mirroring flips the whole frame (`sprite.ts:268`) after the `flipX` head and hat are placed, and Wrangler has no `reads` parts, so the head's double flip comes out right.
- **Timing, cues and sounds.** Frame by frame against main: `lasso` (12 frames' layers changed), `windup` (9) and `haul` (8) keep every frame's count, `ms`, `cue` and `shake`. Only the haul's dust moved, to his new heels. `idle`, `taunt`, `leap`, `ready` and the intro's `spin`, `throw`, `yank`, `crossThrow`, `doubleYank` and `brag` have identical layers. The intro's sounds come from `M.yank` over the whole drag (`challenge.ts:2112`). `reel` has the yank's exact ms/cue list (the test checks this), so the yank→reel switch adds or drops no heave.
- **The yank→reel switch.** `slid()` (`challenge.ts:1850-1852`) is the same eased `u` as `bale.u` (both start at `at("drag") + yankLeadMs`). `me(..., t - at("drag"), true)` keeps the 4 × 120 ms beat across the switch. The switch depends only on time and the room's squares, never on screen size. Wrangler is `seated`, and the test's `seatedMarks(marksOf(..., marksFeel(null, ...)))` gives the same column as ShopRoom's `marksFeel(ci.anims, ...)`, which ignores its anims. The camera's perspective (`camera.ts proj`: the bale is about 1.5 rows further back than his feet when it passes) moves the on-screen crossing by a fraction of a square, which no one will see. It always switches to the side the bale is on: east of him, the side `reel` faces.
- **After the drag ("land", move `null`).** The line reels in to the reel's last grip, [68,52], while he's drawn in the intro idle, whose coil fist is at (64,49): about 5 px off. On main it reeled to the yank's grip, about 12.6 px from the idle's lasso fist. So this is better, not a regression.
- **Placement.** `PIG.foot` [43,73], `w`/`h`, `CATCH`, `CATCH_AT`, `ATTACK_REACH` and the leap are unchanged. The diff touches no `SIDE_REACH`, `barShift` or `foot`. `feet` offsets only move the boots and legs, not the anchor.
- **Shared code and other bosses.** `pigLayers`, `placedPart` and `PigPose` are Wrangler's alone. `ROPE_MOVES`/`RopeMove` are used only by `challenge.ts` and `intro.ts`, which now build 4 more intro canvases at load. `CHALLENGE_FEEL.rope.reelAt` is a new key that only `ropeAt` reads. Nothing in another boss's path changed.
- **Phone performance.** Every new part (mirrored heads and hats, `between`, `tail`) is built once per name (`placedCache`) and drawn from cached frame canvases. `placed()` caches the flip per part, so nothing new runs per frame.
- **Tests run:** `packages/app` `vitest run test/pig.test.ts test/shop-wrangler.test.ts`: 40/40 pass. `frameKeys` over all 393 frames (intro, board, board mirrored): no missing part, nothing throws. I didn't run e2e (review only).

## Small notes (not bugs)

- `pigLayers` draws `between` and `tail` only through `ahead()`. A future pose with `hold: true` but no `front` would lose them without any error. Every current `hold` pose sets `front: true`.
- `fR0` (`pig.ts:622`) falls back to `FIST_R` while `fR` falls back to the spinning circle when `loop2 === "spin"`. They differ only for a `hold` pose with a spinning second loop, which no pose has.
