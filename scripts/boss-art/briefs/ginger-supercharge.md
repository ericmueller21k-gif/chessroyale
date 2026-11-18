# Ginger's Super Freeze: his charge-up and blast (Eric, Nov 18)

Eric: "We're adding another move for him, like another ult meter bar ... now he has a super freeze ... that animation might even take
4 or 5 seconds for him to do a charge up and make an expanding ice block."

**This is not a new boss.** Ginger (the gingerbread Freeze boss, `packages/app/src/characters/gingerbread.ts`, `GINGERBREAD`) is the
finished game drawing, and it's rigged: a pose is a handful of numbers (`GingerPose`: crouch, feet, cane, free arm, glow, mood, head,
dx ...), and `gingerLayers(pose)` stacks his own parts for it. **Read `gingerbread.ts` (his rig: GingerPose, gingerLayers, caneTip, his
palette, `freezeCast` and `blizzard`) and `ginger-intro.ts` (his intro's `charge`, `blast` and `cast`: built on the same rig; read how
`f`, `ring`, `sparkle`, `GLOW_*` and `ICY_EYES` work) first, all of both.** Ignore the warning about a boss's other animations
(entrance, thinking ...) missing.

Your file builds on his rig as `ginger-intro.ts` does: import `GINGERBREAD`, `gingerLayers`, `caneTip` and `type GingerPose` from
`"../../../../packages/app/src/characters/gingerbread.ts"` (that import is allowed here, besides sprite.ts and paint.ts), and copy the
small helpers you need (`f`, `ring`, `sparkle`, the glow palettes) into your file. **Don't change his parts, palette, frame or foot**;
add poses only through `GingerPose`'s fields and specks (frost, sparkles, a gathering ice orb) on top. Same frame and foot as
GINGERBREAD (84 x 93, foot [43, 88]), facing front, the cane in his right hand (on our left), light from the top left, not mirrored.

Export `GINGER_SUPER: Character` = `{ ...GINGERBREAD, id: "ginger-supercharge", name: "Ginger (Super Freeze)", anims: {...} }`.

## When it plays (so the beats fit)
His Super Freeze is a 4 to 5 second moment at the start of his turn: the game plays his intro's `charge` (1.1 s: he lifts the cane, it
glows, frost rings tighten round the hook, cue `charge`), then **your `superCharge` loop** for about 1.3 s (one or two cycles), then
**your `superBlast`**: an ice bolt leaves the cane for one square of the board, where a block of ice grows over the 3 x 3 squares
around it (another drawing). On a phone he does this standing at the board's top-left corner (the board is to his right and below him);
on a computer, standing by the board's bottom-left corner (the board is to his right and above).

## The animations (names exact)
1. **`superCharge`** (loop, 8 frames at about 100 to 130 ms, about 0.9 s a cycle; **no cue**): bigger than the intro's charge, his
   all-out wind-up: feet wide and planted, a deep crouch, the cane held up before him (or high overhead) with his free hand gripping it
   too or clenched beside it, glowing hot ice-blue (his `GLOW_PULSE`/`GLOW_BRIGHT` stripes), his eyes icy (`ICY_EYES`), a growing,
   pulsing **ball of ice light at the hook** (white core, pale blue, a dark blue rim), frost swirling in toward it in rings, sparkles,
   a shiver (`shake` of 1 px now and then), his mood fierce (angry or shout). The first and last frames join so it loops cleanly. Keep
   every pixel inside the frame (no pixel on its edge).
2. **`superBlast`** (one-shot, about 600 to 700 ms): from the charge, he swings the cane down and forward and points it at the board on
   **our right**, a little down (as the intro's `cast` points), and **an ice bolt leaves the hook** (`cue: "blast"` on that frame,
   `shake: [-1, 0]`): a bright shard of frost with a short trail, leaving to our right; a recoil; the glow fading; a fierce laugh; it
   ends on his idle's first frame (`GINGERBREAD.anims.idle.frames[0]`'s pose).
3. **`idle`**: his idle's first frame (`{ loop: true, frames: [GINGERBREAD.anims.idle!.frames[0]!] }`).

Export `SUPER_BLAST_FROM: [number, number]`: where the bolt leaves him in `superBlast`'s cue frame (frame px, the shard's tip), so the
game's bolt (`iceBolt`) flies on from there to the target square.

## Checks before `done`
- Render `superCharge` (all frames) and `superBlast` (all frames) at 4x on dark and light, and the intro's `charge` last frame beside your
  `superCharge` first if you can (they should join: no jump in his feet or the cane's grip).
- At phone size beside another boss (`with: "bigboy"`): the charge reads at a glance (the glowing orb on the cane, the wide stance).
- Your notes (summary): each animation beat by beat with its ms, every cue and its frame, `SUPER_BLAST_FROM`.
