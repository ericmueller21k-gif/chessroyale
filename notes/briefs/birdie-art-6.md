# Birdie's cutscene, scene A third pass: the train's nose and a head-on hit (Nov 23). Art session, paid runner only

Read `notes/designs-birdie.md` on `claude/director-notes`, the three "The cutscene" sections (Eric's notes on each pass). The drawing to
fix is `scripts/boss-art/out/arena-birdie-fall/` on `claude/boss-art` (second pass, 07b1d04; its brief `arena-birdie-fall-2.md`).
Eric pre-approved Birdie's spend, but ask him ONCE here for this run and wait for his own yes. Follow `notes/RULES.md` on art (the paid
API draws; never by hand; never print the key). Start: `git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`.
Other art sessions may push to `claude/boss-art`: `git pull --rebase` right before you push; never force-push.

Write `scripts/boss-art/briefs/arena-birdie-fall-3.md`, an edit of the current drawing. Its text:

**Keep exactly as drawn:** the sky, rain and wind lines, Birdie's tumble frames (his pose and drawing), the cap, the frame counts and
timings, the train's length, its cars behind and its colors, the ids and export.

**Fix two things in `approach`** (Eric: "The front of the train is too blocky now. It doesn't even look like a real head of how a
train looks. And it also should be actually looking like it hits him. It's to the side of him."):
1. **The locomotive's nose, a real train's front.** Like Eric's toy (a classic streamlined diesel, a rounded "bulldog" nose): the
   front is a smooth, rounded, sloping nose, not a box. The cab's windscreen sits up high and set back on the slope (two panes, a
   center post); below it the nose curves down and forward to a rounded front with the headlights (`W`, `V`: keep these keys and round
   shapes) set in it, and a pilot (cowcatcher) at the bottom; the red stripe sweeps around the nose. Shaded to read as a curved 3D
   surface (light from the top left: a highlight band across the top of the nose, darker under its chin).
2. **A head-on hit.** The camera looks straight down the track: the rails run up the middle of the frame to a vanishing point near
   the center of the horizon, and **the train comes straight at the camera along them, centered**, not from the side. **Birdie falls
   straight down into its path**, centered above the track: through the frames he drops toward the track as the train grows toward
   him, so in the **last frame the train's nose meets him dead center** (him right in front of the headlights, about to be hit), which
   is the moment of impact. If Birdie's horizontal place in the earlier frames must move to line up, move him (keep his drawing).
Run it as the second pass was run, `BOSS_ART_EFFORT=high BOSS_ART_CAP_USD=6`. Ask Eric once: "Birdie's cutscene: the train's front
redrawn as a real locomotive nose and the hit made head-on (sky, rain and Birdie kept): one run, about $6 at most".
Commit on `claude/boss-art`. Stills on an orphan branch `stills/birdie-6`: the `approach` sheet, its GIF, and the whole cutscene GIF
again, as `stills/birdie-5`. `NOTE.md` with the spend. `.done`, push, stop.
