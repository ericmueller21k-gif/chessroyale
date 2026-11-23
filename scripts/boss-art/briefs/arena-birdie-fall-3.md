# Birdie's cutscene, the fall: the train's nose and a head-on hit (third pass, Nov 23)

This is an **edit of the existing drawing, not a new one**. The second pass is already in your file:
`scripts/boss-art/out/arena-birdie-fall/arena-birdie-fall.ts` (the file you write to). Read it first, in full, and start from it.
Change only the locomotive's front and the way the train meets Birdie in `approach`. Everything else stays as it was drawn.

This is the cutscene's picture only (Birdie falling, then his train coming down the track at him): not the arena. Ignore the
Colosseum. No letters or numbers anywhere in the picture: shapes only.

## Keep exactly as drawn (Eric likes these)
- **The sky**: its bands, its dithered edges, its palette keys, the clouds far below.
- **The rain and wind lines**: the long vertical speed lines streaming up, and the dashed diagonal wind streaks, with their
  steps and their loop.
- **Birdie's tumble** in `fall` and in `approach`: his pose, wings, beak, eye, feathers, his tie streaming. (If his horizontal
  place in `approach` must move to line up under the nose, move him, not his drawing.)
- **The cap flying off** above him, circling and spinning, staying inside y 22.
- **The train's length, its cars behind and its colors**: the long yellow diesel as drawn in the second pass (the yellow `u v y Y`
  with its shadow `u`, the roof `m n N`, the red stripe `q`, the silver `j l J`, the dark windows `z Z`).
- **The frame counts and timings**: `fall` is 5 frames at 120 ms, looping; `approach` is 9 frames at 390 ms, plays once and holds
  its last frame. Frame 0 of `approach` matches frame 0 of `fall` (the cut stays seamless).
- **The export and the ids**: `ARENA_BIRDIE_FALL`, id `arena-birdie-fall`, name "Birdie's fall", `w` 200, `h` 260,
  `foot` [100, 255]. The cues stay: "approach" on frame 0, "hit" on frame 8.
- The frame is 200 x 260 and fully opaque, edge to edge, as before.

## Fix two things in `approach` (Eric: "The front of the train is too blocky now. It doesn't even look like a real head of how a train looks. And it also should be actually looking like it hits him. It's to the side of him.")

**1. The locomotive's nose: a real train's front.** Like Eric's toy: a classic streamlined diesel with a rounded "bulldog" nose,
not a box.
- The front is a smooth, rounded, sloping nose. The cab's windscreen sits up high and set back on the slope: two panes with a
  center post. Below the windscreen the nose curves down and forward to a rounded front.
- The two headlights are the keys `W` and `V` (keep these keys; `#fff3b8`; keep them **round** shapes so the game adds its glow),
  set into the nose.
- A **pilot** (cowcatcher) at the bottom of the nose.
- The **red stripe** (`q`) sweeps around the nose with the curve of the body.
- Shade it to read as a curved 3D surface: light from the top left, a highlight band across the top of the nose, darker under its
  chin. Outlines (`k`, dark) on the train's shapes, as before.
- It must read at a glance as a real locomotive's front, not a box and not a car.

**2. A head-on hit.** The camera looks straight down the track. Change the geometry so the train comes at the camera, not from
the side.
- The rails run up the middle of the frame to a vanishing point near the center of the horizon. (The second pass had it at x 184
  on the right; move it to the center. The horizon still rises from about y 218 in frame 0 to about y 120 in the last frame.)
- **The train comes straight at the camera along the rails, centered**, not from the side. Its wheels sit on the rails, the way they
  do now.
- **Birdie falls straight down into its path**, centered above the track. Through the frames of `approach` he drops toward the track
  as the train grows toward him, so that in the **last frame the train's nose meets him dead center**: him right in front of the
  headlights, about to be hit. That is the moment of impact.
- The train still grows from a small, far shape in the haze (two lamp dots in frame 0, as before) to filling the bottom third of the
  frame by the last frames. Its headlights get **brighter each frame**, with the same light effect as before (more of the lamp's core
  `w` at the centre, a soft `W` ring round it, a little bloom of pale light on the rails in front), at full brightness in the last
  frame.
- The rails fade in from the haze in the early frames and are sharp and near in the last frames, as before.

## Rules you must keep
- The picture stays inside the readable area: keep Birdie, the headlights, the train's front and the track's nearest rails inside
  **x 4 to 196, y 22 to 238**. On a computer the top and bottom 20 rows are cut off; on a phone a few pixels at each side are cut.
- Style: chunky, clean pixel art, banded shading, a limited palette (about 24 to 30 colors). Outlines (`k`, dark) on Birdie and
  on the train's shapes; none on the sky or the track's haze. It must read at a glance on a phone.
- The train must read as the same yellow toy diesel as his ride, now with a real locomotive's nose.

## Reading and checks
- The source of the train and of Birdie is in `scripts/boss-art/out/birdie-train/birdie-train.ts` and
  `scripts/boss-art/out/boss-birdie/boss-birdie.ts` (read only). Read them for the palette and the shapes.
- Render `fall` and `approach` at scale 2 and look at them whole. Then render frame 0 and the last frame of `approach` at scale 4
  to check the headlights, the nose and the wheels. If scale 4 does not render, say so in the notes and check the geometry instead.
- Check that `fall` is unchanged: the sky, the rain and Birdie's tumble should look as they did in the second pass. Only the
  `approach` train, track and Birdie's horizontal place differ.
- In the last frame of `approach`, check that Birdie's center and the nose's center are on the same column.

## Done
Call `done` with notes: the palette keys used for the new nose (the keys `W` and `V` for the headlights), the frame timings
(unchanged), where the rails sit, the vanishing point's new place, Birdie's column in each frame, and any choice the owner might
change (how far the train grows, how fast the lines move, the length of the nose and the hood).
