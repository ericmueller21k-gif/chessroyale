# Wrangler: his lasso throw and his pulls, redrawn so he looks at what he ropes (Eric, Nov 18)

Eric: "if you watch when he does it, he kind of looks the wrong way and pulls. It just looks weird. We want it to look actually
normal when he does his wrangle and he pulls. … also when he does his startup animation, when he wrangles the chessboard, it still
looks weird the way he does it."

**This is not a new boss.** Your file `scripts/boss-art/out/pig-redraw/pig-redraw.ts` is already Wrangler, the finished game drawing
(a copy of `packages/app/src/characters/pig.ts`, his king attack left out, plus two of his town intro's moves, `introThrow` and
`introYank`, copied from `pig-intro.ts` so you can see them). **Read your file first, all of it.** Everything is rigged: a pose is
a few numbers (`PigPose`: fists, elbows, lean, bob, feet, the loop's ellipse, the line's bow) and `pigLayers` stacks his parts. Ignore
the warning about a boss's other animations (entrance, thinking, …) missing: he doesn't have them. Keep the export `PIG`, its id
"pig-redraw".

## What's wrong (look at the reference pictures)
His drawing faces our LEFT: his head is turned to our left (snout left of the head's middle, the near ear sticking out on our right,
pupils to our left). But he throws his lasso to our RIGHT (`CATCH` is right of his feet), so:
1. **The throw and the tug** (`lasso` f8 to f19): the loop flies out to our right while his face looks away to our left. When he
   tugs, only his lasso fist (on our left) holds the rope, low on the far side of him, so the rope runs across his whole belly from
   that fist to the loop on our right; his other arm just holds the coil. In the game the board mirrors this whole pose when the piece
   is on his left (picture 5): same problem, mirrored.
2. **The big double lasso** (`windup` f28 to f37): the same: both loops thrown to our right, his face to our left, both ropes across
   his body when he yanks.
3. **The showdown haul** (`haul`, loops): the board draws ropes from his two fists (`HAUL_FISTS`) out to pieces on the side he faces
   (our LEFT, as drawn). He leans to our left (`lean: -2`): INTO the ropes, as if pushed, not pulling.
4. **His town intro** (`introYank`): the board on its hay bale starts in the barn's corner up and to our left of him (behind him); he
   yanks it, and it slides down past him to the middle of the ring, which is to our RIGHT of him. His yank leans back to our right with
   both fists low on our left, which reads for the start; but for the second half the bale is on his right and he is leaning toward
   it, his back to it, the rope across his body (picture 6).

## What to draw
The rule everywhere: **he looks at the rope's end (the loop, the piece, the bale) while he swings, throws and pulls, and he pulls by
leaning back AWAY from it, feet planted, both hands on the rope, the rope taut from his front hand straight toward what he pulls, not
across his body.**

- **A head that looks to our right.** Add one pose field, `look?: "right"` (left out: as now). With it, his head and hat face our
  right: the simplest way that keeps him exactly himself is his own head and hat parts drawn mirrored (a Layer's `flipX`) and moved so
  they still sit centered on his neck where they sit now; check it at 4x (the hat's band and star, the ears, the eyes all read right
  and nothing comes apart at the neck). Use it in every frame where what he looks at is on our right.
- **`lasso`**: from the throw frame (f8) to the end of the tug (f18): `look: "right"`, eyes on the loop. The tug and the hauls (f15 to
  f18): both fists on the rope, the coil arm's fist (on our right) in front at about hip height reaching toward the loop, his lasso
  fist behind it close to his body; he leans back to our left (as now), boots planted, the rope a straight taut line from the front
  fist to the loop. The coil may hang from his belt or be tucked away (coil: null) while both hands pull. The flick home (f19 on) may
  turn his head back (no `look`) as the loop comes back over him.
- **`windup`**: the same for its throw and its yank (f28 to f36): `look: "right"`; both ropes from his fists in front of him on our
  right, leaning back to our left.
- **`haul`** (the showdown; he faces our left, the ropes go out to our left): keep his head as drawn (it already faces our left); lean
  back to our RIGHT (`lean` positive), heels dug in (`feet` a little apart as in `introYank`), both fists low in front of him on our
  left, as if each hand hauls a rope toward him. **`HAUL_FISTS` must stay exactly the two fists' points in the haul's frames** (each
  fist + [OX, OY], the lean and bob included: work it out from the pose constants, so the board's ropes start in his hands). Keep its
  8 frames, their ms and cues.
- **`introYank`**: keep it for the first half (the bale up behind him to our left: his head as drawn, he may look up at it). Add a new
  animation **`introReel`** (loops, 4 frames, the same ms and cues as `introYank`: `yank` on f0 and f2, the shakes, dust off his
  heels): the bale now on his RIGHT: `look: "right"`, leaning back to our LEFT, heels dug in, both fists low on our right with the rope
  running off to our right from his front fist (the game will draw it from his front fist's grip, 2 px above the fist: say which fist
  in your notes).

## Don't change
- His palette, frame (115 x 77), OX, OY, GROUND, `foot`, `CATCH`, `CATCH2`, `LOOP_REST`, the parts' drawings.
- **Every frame of `idle`, `taunt`, `leap` and `ready` pixel for pixel**, and `introThrow`.
- In `lasso`, `windup` and `haul`: the number of frames, each frame's ms, cue and shake, and every thrown loop's ellipse (where it flies
  and lands, the drag's dx). Only his body, arms, head and the line from his fist to the loop change. The loop still lands on `CATCH`.
- No new colors, no text.

## Checks before `done`
- Render `lasso` (all frames, in two looks of 8: 8-15 and 15-22), `windup` 27-36, `haul` and `introYank`/`introReel` at 4x on dark and
  light, and at phone size. In every pulling frame: his eyes on the rope's end, his lean away from it, the rope from his front fist to
  the loop not crossing his body.
- Your notes (summary): each changed animation beat by beat; the `look` field and how it places the head; `HAUL_FISTS`'s values;
  for `introReel`, which fist holds the rope's line and its grip point per frame (frame pixels).
