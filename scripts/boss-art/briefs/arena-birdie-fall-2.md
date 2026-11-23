# Birdie's cutscene, the fall: the train and the track redrawn (second pass, Nov 23)

This is an **edit of the existing drawing, not a new one**. The first pass is already in your file:
`scripts/boss-art/out/arena-birdie-fall/arena-birdie-fall.ts` (the file you write to). Read it first, in full, and start from it.
Change only the train and the track in `approach`. Everything else stays as it was drawn.

This is the cutscene's picture only (Birdie falling, then his train coming up the track at him): not the arena. Ignore the
Colosseum. No letters or numbers anywhere in the picture: shapes only.

## Keep exactly as drawn (Eric likes these)
- **The sky**: its bands, its dithered edges, its palette keys, the clouds far below.
- **The rain and wind lines**: the long vertical speed lines streaming up, and the dashed diagonal wind streaks, with their
  steps and their loop.
- **Birdie's tumble** in `fall` and in `approach`: his pose, wings, beak, eye, feathers, his tie streaming, and his sink in
  `approach` (from about (102, 94) to about (94, 112)).
- **The cap flying off** above him, circling and spinning, staying inside y 22.
- **The frame counts and timings**: `fall` is 5 frames at 120 ms, looping; `approach` is 9 frames at 390 ms, plays once and holds
  its last frame. Frame 0 of `approach` matches frame 0 of `fall` (the cut stays seamless).
- **The export and the ids**: `ARENA_BIRDIE_FALL`, id `arena-birdie-fall`, name "Birdie's fall", `w` 200, `h` 260,
  `foot` [100, 255]. The cues stay: "approach" on frame 0, "hit" on frame 8.
- The frame is 200 x 260 and fully opaque, edge to edge, as before.

## Change only the train and the track in `approach` (Eric: "the train is way too short. It looks like a limo. It does not look like an actual train. ... the scaling is off ... the track ... the ratios are wrong")

**The train: a real locomotive, long.** The first pass drew a short yellow car. Redraw it as a full-size diesel engine like a
toy diesel's shape: a raised cab with its windscreen at the front, and a long engine hood stretching back behind the cab.
- Seen from the front three-quarter, the body is at least 3 to 4 times as long as it is tall (the hood reads as running back
  toward the vanishing point, not as a squat box).
- Side vents and handrails along the hood and cab.
- The dark charcoal roof, the thin **red stripe** running the whole length of the body.
- **Round headlights** on the nose: the two lamps are the keys `W` (the near lamp) and `V` (the far lamp), both `#fff3b8`, as
  round shapes, so the game adds its glow over them. Keep them round.
- A **pilot** (cowcatcher) under the nose.
- **Big wheel trucks** under the long body: the wheels sit on the rails.
- The yellow is `u v y Y` (its shadow `u`), the roof `m n N`, the red stripe `q`, the silver trucks and wheels `j l J`, the dark
  windows `z Z`, as before. It should read instantly as a train engine, not a car.

**The track: the right scale and true perspective.**
- Two rails exactly the train's wheel gauge apart. The train sits **on** them: its wheels on the rails.
- Sleepers (ties) evenly spaced along the track, getting closer together and smaller with distance, the way a real track
  recedes.
- Sleepers about as long as the train is wide, plus a little.
- The rails converge toward a single vanishing point on the horizon, in the haze. The horizon rises from about y 218 in frame 0
  to about y 120 in the last frame, as before. Gravel between the sleepers, as before.
- The rails fade in from the haze in the early frames and are sharp and near in the last frames (you can see the rivets on the
  nearest rail by the last frame).

**The approach.**
- The train comes along that track from the vanishing point toward the camera, growing frame by frame from a small, far shape in
  the haze (its two headlights just two dots in frame 0, as before) to filling the **bottom third** of the frame by the last
  frames (about y 173 to 238, roughly x 26 to 190).
- Its headlights get **brighter each frame**: more of the lamp's core `w` at the centre, a soft `W` ring round it, a little
  bloom of pale light on the rails in front of them. The last frame has the two lamps at full brightness.
- Birdie stays the same size and keeps falling toward it, as now: he sinks in the frame as before, and in the last frame the
  train's roof is just under him, so it's about to hit him at the centre.
- Keep the two round headlights clean and bright, and the nearest rail and sleepers close and sharp in the final frame.

## Rules you must keep
- The picture stays inside the readable area: keep Birdie, the headlights, the train's front and the track's nearest rails inside
  **x 4 to 196, y 22 to 238**. On a computer the top and bottom 20 rows are cut off; on a phone a few pixels at each side are cut.
- Style: chunky, clean pixel art, banded shading, a limited palette (about 24 to 30 colors). Outlines (`k`, dark) on Birdie and
  on the train's shapes; none on the sky or the track's haze. It must read at a glance on a phone.
- The train must read as the same yellow toy diesel as his ride, now as a real long locomotive.

## Reading and checks
- The source of the train and of Birdie is in `scripts/boss-art/out/birdie-train/birdie-train.ts` and
  `scripts/boss-art/out/boss-birdie/boss-birdie.ts` (read only; the run allows them). Read them for the palette and the shapes.
- Render `fall` and `approach` at scale 2 and look at them whole. Then render frame 0 and the last frame of `approach` at scale 4
  to check the headlights, the rails and the wheels.
- Check that `fall` is unchanged: the sky, the rain and Birdie's tumble should look as they did in the first pass. Only the
  `approach` train and track differ.

## Done
Call `done` with notes: the palette keys used for the new train (the keys `W` and `V` for the headlights), the frame timings
(unchanged), where the rails sit, the track's vanishing point, and any choice the owner might change (how far the train grows,
how fast the lines move, the length of the hood).
