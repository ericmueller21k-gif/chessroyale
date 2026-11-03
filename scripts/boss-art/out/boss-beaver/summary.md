# Boss art: boss-beaver

- Model claude-opus-5-5, effort high, adaptive thinking. 29 turns, 19 renders.
- Spend: **$3.33** of the $5 cap (60 input, 267,304 cache-write, 3,893,792 cache-read, 60,728 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boss-beaver/boss-beaver.ts.
- Previews: scripts/boss-art/out/boss-beaver/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/boss-beaver/looks/.

## Its notes

I've added `BOSS_BEAVER_INTRO` (id `timber-intro`) to boss-beaver.ts, after `BOSS_BEAVER_ATTACK`. It spreads `BOSS_BEAVER` and is drawn with his own rig. I rendered and checked every intro animation frame by frame on both backgrounds, mostly at 2x. Gnaw's 8 frames don't fit at 2x, so I checked them 4 at a time at 3x. His normal idle still renders unchanged beside Big Boy.

**Changes to existing code (outputs unchanged):**
- `head()` takes an optional `puff` (puffed cheeks); at 0 it draws exactly as before.
- `Pose` has a new `puff` field, which only adds to the head part's name when it's set.
- No existing animation or part changed.

**Facing:** he faces our right (toward the middle). His frames are mirrored: each part is flipped and repositioned, and the specks and shake are mirrored too. One side effect is that his light comes from the top right in the intro.

**Frame:** 118 x 98, foot [52, 88]. The palette is his, plus three log colors: `p` #fff0c8 (the pale sapwood), and `-` / `+` (the log's see-through ground shadow).

**The log:** it is the props file's own log. I copied its code (grain, `barkKey`, `ringKey`, `lyingKey`, and `standKey` with no bites) and evaluate it at the same picture pixels in the same 80 x 70 picture, foot [40, 64]. The bark, rings, knots and grain therefore match pixel for pixel, at the same 64 x 30 lying and 32 x 52 standing sizes. The shadows use the same ellipses. During the swing it is the lying log turned 42°.

**Exports:**
- `TIMBER_INTRO_REACH = [34, -2]`: the standing log's foot relative to his foot, in setDown's last frame and in gnaw. The log is centered 34 px to our right and 2 px further back, so code should draw the log piece behind him. His snout and teeth overlap its upper-left front.
- `TIMBER_INTRO_LIFT_AT = [0, 2]`: the lying log's foot relative to his foot in lift's first frame. It lies just in front of his feet, so code should place him with this offset over the lying piece and hide that piece when lift starts.

**Animations:**
- **walk** (6 x 110 ms, loops): a waddle with nothing in his paws.
  - Each foot lifts up to 4 px and steps 3 px forward in turn.
  - His body sways up to 2 px onto the planted foot and bobs up over it.
  - His arms swing against his feet, his tail wags, and he grins.
  - It's drawn facing right. For the walk left to the log, code can mirror it.
- **lift** (600 ms; 100, 100, 90, 90, 110, 110):
  - f0: he bends over the log at his feet, paws on its top. The lying log and its shadow are in his frame.
  - f1: he squats deeper and squeezes, eyes shut, cheeks puffed.
  - f2: `hup`. The log comes 6 px up, mouth open, dust at his feet.
  - f3: 13 px up.
  - f4: 18 px up, wide-eyed.
  - f5: settled in the carry hold, the log across his belly 16 px off the floor. His chin rests on it, his arms hug its front and his paws are on top.
- **carry** (6 x 110 ms, loops): the same waddle under the log, strained (cheeks puffed, eyes squinting and squeezing). The log bobs 0–2 px a beat behind his steps, with a drop of sweat.
- **setDown** (500 ms; 110, 90, 120, 90, 90):
  - f0: he heaves it up and 6 px to our right.
  - f1: it swings down, tilted 42°, its right end dropping.
  - f2: `thump` with a shake. It stands on end at REACH, with sawdust puffs at its foot. His near paw is on its side and his far arm hangs.
  - f3: a pleased beat, paw still on it.
  - f4: no log. His paws are drawing back, and the last puffs drift.
- **gnaw** (8 x 90 ms, loops): he crouches by the log, near paw on it, head leaning in.
  - Open-jaw frames (jaw 4, 3, 5, 3) alternate with teeth-shut frames.
  - On the four shut frames his head bobs down and in, with a 1 px shake and a sawdust puff.
  - Cues: f1 `gnaw`, f3 `chomp`, f5 `gnaw`, f7 `chomp`.
  - Each bite throws a fan of 2–3 px chips (a light face and a dark edge, so they show on the pale top and the bark). The chips fly up and out both ways for 4 frames and wrap round the loop.
  - Only Timber and the chips are drawn; the log is the separate piece.
- **done** (800 ms; 100, 110, 110, 150, 130, 200):
  - f0: he steps back with the near foot raised. He stays 3 px back (to our left) from here on, so his foot ends 3 px left of where it started.
  - f1–f2: he rubs his paws together at his chest, with puffs of sawdust. Cue `pat` on f1.
  - f3: a buck-toothed grin, cue `chitter`.
  - f4: a breath.
  - f5: a wink and a grin.
- **idle**: one frame of him standing, for the preview.

**All cues:** lift f2 `hup`; setDown f2 `thump`; gnaw f1/f5 `gnaw` and f3/f7 `chomp`; done f1 `pat` and f3 `chitter`.

**Choices you might change:**
- The far arm can't reach the standing log, so he sets it down with the near paw on it and the far arm hanging.
- In gnaw his snout overlaps the log's upper-left front. With the log drawn behind him, he looks to be biting into its near side, just under the rim.
- The chip spray is fairly fine at phone size.
- The log hides most of his body while carried. Only his head, paws and feet show.
- The `pat` cue in done is my addition.
- The `REVIEW` flag (false) draws the standing log behind him in gnaw if set true, for checking the two together.
