# Moo & Moon's close-up, second pass: make it read as Moo

The first brief (`scripts/boss-art/briefs/arena-moo-closeup.md`) still holds, except where this one changes it. Your drawing
exists: **read it first** (`scripts/boss-art/out/arena-moo-closeup/arena-moo-closeup.ts`) and revise it with `edit_drawing`
(rewrite a function where you must, but keep the rig, the frames, the animations and their timings, the sky, the light shafts
and the white-eye effect, which are good). Look at the references (`moo-idle.png`, `moo-power.png`) again before you start.

## What works (keep it)
- The composition: head lifted up to the upper left, the ear swept back, the Moon held by his chin looking up too.
- The eye (brown iris, lashes, glint, the brown patch round it) and the `whiten` effect (the glowing white eyes, the sparkles).
- The night sky, the stars, the diagonal light shafts and the bright rim light on the side toward the light.

## What reads badly (fix it)
1. **The snout reads as a separate pink balloon** stuck on his face. In profile a calf's muzzle is the front end of the head:
   the cream of his face flows forward and down into a rounded pink muzzle (as on his sprite), no outline cutting it off from
   the head, a nostril on its front, the mouth line under it, a little chin. Make it a bit smaller in proportion to the head.
2. **The head and throat have no clear shape**: under the eye it turns into flat blocky bands. Give the profile a clear form:
   the forehead's slope up to the tuft and horns, the brow over the eye, the cheek and jaw line curving down and back under the
   eye to the throat. Shade with clean bands that follow the curves of the form (lit cream on the light side, cool lilac shade
   away from it); **no stair-step blocks** of shade.
3. **The body's patches read as black holes.** Holstein patches are his dark brown (`b`, `c`, with `a` only for the darkest
   edge), irregular rounded shapes that wrap round the form and are lit and shaded like the cream, fewer and smaller than now.
4. **His hold on the Moon:** show his front leg coming up from his chest and his hoof (dark, two-toed, as on his sprite)
   curled round the Moon's lower horn, so he's plainly hugging it. Right now a hoof floats off on its own lower right.
5. Overall it should look **soft, round and cute** like his sprite (he's a sweet calf), just big and cinematic.

## How to check
Render `idle` frame 0 at scale 3 and compare it with `moo-idle.png`: it must read at a glance as the same calf. Then `whiten`'s
last frame. Pace yourself: a few renders. Call `done` with notes on what changed.
