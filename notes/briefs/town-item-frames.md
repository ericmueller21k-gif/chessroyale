# Animated items play in Chess Town (Eric, Nov 27 ~15:50 UTC). Opus high, town lane, targeted (the drawing changes: frame rate measured)

Eric, after reading that the Gift-Wrap Tube's twist (#1012) stays still in town: "it needs to be playing in the town. That's how people
like to show off. So it should be just drawn at the start as a few frames or like a few different drawings that loop... those items are
really rare... we can at least test it with the tube first and the candy cane... that's why we have those animations built like that
anyway, because they're supposed to be simple animations that can be built into a loop and loaded."

Today no item animation plays in town (every `ia-` animation runs only under `.ia-live`; the town paints each figure once into its atlas,
`town/paint.ts`, `paint-gl.ts`). Rides already animate in town by drawing their frames once and cycling them (`town/rides.ts` `Rider`):
reuse that, don't invent a new path ("simple beats flashy").
1. **The tube's twist and the Candy Cane's strand first.** When a figure wears an animated item, paint N loop frames of it once (when
   its picture is made: at load, or when a player arrives or changes look) into the atlas, and pick the frame from one shared clock each
   draw. No picture painted or uploaded per frame; nothing per frame but choosing a texture. Pick N per item from its loop (the twist is
   one turn every 1.5 s; the strand's own period): the fewest frames that read smoothly at the town's size (say 6-12), in settings.ts.
2. Keep pictures (`keep-pictures.ts`) and the atlas budget: say what the frames add (pages, MB) with, say, 50 players wearing them.
   If it would overflow, share frames between identical looks (same item and colors) before anything else.
3. Built so the other animated items (crown flames, parrot, tommy gun, the tube's confetti) can follow with a table entry each; don't
   add them in this PR unless they come for free; list them in the PR as next.
4. **Frame rate:** the `@perf` town spec before/after, plus the 50+ players check (`town-hitches-2` adds it: rebase on it if it has
   landed, else reuse its driver) with many of them wearing the tube and the cane: the same frame budget as without. `/town?report`'s
   uploads must not grow while walking.
5. One focused e2e check (a pawn wearing the tube in town: the picture drawn changes over time; uploads flat). A GIF or a few stills
   of your pawn in town with the tube and cane twisting (stills on an orphan `stills/town-item-frames` branch only).
Decision note (short), `docs/areas/town-square.md` and `docs/areas/shop.md` (the "everywhere but Chess Town" lines). `.pr-body.md`
(lane, changed checks), `.done`. Read `notes/briefs/rules-common.md` first. Commits end only with the Claude-Session line.
**Starts after `town-hitches-2` has merged** (same files).
