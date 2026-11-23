# Birdie's cutscene, scene A second pass: the train and the track (Nov 23). Art session, paid runner only

Read `notes/designs-birdie.md` on `claude/director-notes`, the sections "The cutscene: Eric's notes held for a second pass" and
"The cutscene: Eric on the first pass". The drawing to fix is `scripts/boss-art/out/arena-birdie-fall/` on `claude/boss-art` (its brief
`scripts/boss-art/briefs/arena-birdie-fall.md`). Eric pre-approved Birdie's spend, but ask him ONCE here for this run and wait for his
own yes. Follow `notes/RULES.md` on art (the paid API draws; never by hand; never print the key). Start:
`git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`. Other art sessions may push to `claude/boss-art`:
`git pull --rebase` right before you push; never force-push.

Write `scripts/boss-art/briefs/arena-birdie-fall-2.md`: an edit of the existing drawing, not a new one. Its text:

**Keep exactly as drawn:** the sky (Eric likes it), the rain and wind lines, Birdie's tumble in `fall` and in `approach`, the cap
flying off, the frame counts and timings, the export and ids.

**Change only the train and the track in `approach`** (Eric: "the train is way too short. It looks like a limo. It does not look like an
actual train. ... the scaling is off ... the track ... the ratios are wrong"):
- **A real locomotive, long:** a full-size diesel engine like his toy (the reference `eric-train.jpg`'s shape), seen from the front
  three-quarter: a raised cab with its windscreen at the front, a long engine hood stretching back behind it (at least 3 to 4 times as
  long as it is tall from that view), side vents and handrails, the dark roof, the thin red stripe along its whole length, round
  headlights on the nose, a pilot (cowcatcher) under the nose, and big wheel trucks under the long body. It should read instantly as a
  train engine, not a car.
- **The track at the right scale and in true perspective:** two rails exactly the train's wheel gauge apart (the train sits ON them, its
  wheels on the rails), sleepers (ties) evenly spaced and getting closer together and smaller with distance, the rails converging toward
  a vanishing point on the horizon. Sleepers about as long as the train is wide plus a little.
- **Its approach:** it comes along that track from the vanishing point toward the camera, growing frame by frame, and fills the bottom
  third by the last frames, a 3D barreling feel, its headlights brighter each frame (keep the keys `W` and `V` as round shapes so the
  game adds its glow).
- Birdie stays the same size and keeps falling toward it, as now.
Run it as the first pass was run, `BOSS_ART_EFFORT=high BOSS_ART_CAP_USD=6`. Ask Eric once: "Birdie's cutscene, the fall scene's
train and track redrawn (the sky and rain kept): one run, about $6 at most".
Commit on `claude/boss-art`. Stills on an orphan branch `stills/birdie-5`: the new `approach` frame sheet, its GIF, and the whole
cutscene GIF again (fall, approach, a white frame, reveal, hold), as `stills/birdie-3` made it. `NOTE.md` with the spend. `.done`, push, stop.
