# Boss art: arena-birdie-fall

- Model claude-opus-5-5, effort high, adaptive thinking. 25 turns, 15 renders.
- Spend: **$1.76** of the $6 cap (52 input, 97,298 cache-write, 1,620,568 cache-read, 47,665 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-birdie-fall/arena-birdie-fall.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.23.5
. Each look it took: scripts/boss-art/out/arena-birdie-fall/looks/.

## Its notes

Third pass on Birdie's fall. I only changed the locomotive's front, the camera so the shot is head-on, and Birdie's path in `approach`. The sky, rain and wind lines, his tumble, the cap, the colours, the frame counts, the ids and the cues are as before. `fall` re-rendered the same as the second pass, and frame 0 of `approach` still matches frame 0 of `fall` (the far ground and a tiny train below y 218, as before).

**Checks:** I rendered `fall` and `approach` whole. Scale 4 doesn't render bigger: a single frame still came back at 1x. To check the nose, headlights, pilot and frame-0 lamp dots up close, I used a temporary 3x zoom animation, then deleted it.

**The new nose (a curved, streamlined "bulldog" front):** it's one curved shape, not boxes, shaded from its real surface so it reads as rounded, light from the top left. The chin tucks under, the nose bulges forward and curves back to a near-flat top, then the windscreen slopes back. The whole front rounds back toward the sides, and the roof has rounded shoulders.
- Keys: yellow `u v y Y` in bands. `Y` is the highlight band across the top of the nose and the lit left shoulder; `u` is under the chin and on the shaded right.
- Windscreen: two panes in `z`/`Z` with a glint and a dark `m` frame, the centre post in body yellow. A charcoal roof cap (`m n N`) sits above it.
- The red stripe `q` (`T` where it's in shade) runs right round the nose at one height, so it curves with the body.
- The pilot (cowcatcher) is a raked, rounded silver apron (`j l J`, slats, a `J` top edge, `m` bottom edge) with a small coupler.
- Headlights: `W` (right) and `V` (left), still `#fff3b8` and round, with a silver rim. The hot core `w` grows each frame, from a single pixel in frame 0 to 70% of the lamp in frame 8, and the pale light spills further down the rails in front each frame. They sit 0.98 m either side of the middle and 1.72 m up.
- Outlined in `k` as before, with ink where the nose stands in front of the pilot.

**Timings (unchanged):** `fall` is 5 × 120 ms, looping. `approach` is 9 × 390 ms, plays once and holds its last frame. Cues: "approach" on frame 0, "hit" on frame 8.

**Track and camera:**
- The camera now sits on the track's middle line (`CX` 0), 2.5 m up (`CH`). The vanishing point moved from x 184 to x 100, the centre of the horizon.
- The horizon still rises from y 218 in frame 0 to y 120 in frame 8.
- The rails run up the middle: at the bottom of frame 8 they're about x 54 and x 146, and they converge on x 100.
- The train comes straight down the rails, centred, from about 70 m away (two lamp dots, x 98 and 101, in the haze) to 2.95 m. In frame 8 its front spans about x 34–166 and y 78–225, inside the safe area.

**Birdie's column and middle, frames 0–8:** x 102, 102, 102, 101, 101, 101, 101, 100, 100; y 94, 97, 101, 106, 111, 116, 122, 127, 133. In frame 8 his centre (x 100) and the nose's centre (x 100) are on the same column. He covers the nose's middle, with the windscreen visible above him and the two lamps blazing either side of him at lamp height.

**Choices you might want to change:**
- **How close the train gets:** `Z_NEAR` 2.95 m, which is about two-thirds of the frame's width. The growth from frame 7 to 8 is a big jump (true perspective at close range).
- **Camera height:** `CH` 2.5 m, so we look slightly up at the cab and the roof's top isn't seen, only its charcoal cap.
- **Nose and hood size:** about 1.1 m of nose before the windscreen; the hood behind is unchanged.
- **Headlights:** in frame 7 the right lamp is hidden behind Birdie's tail. `LAMP_X`, `LAMP_Y` and the lamp size (`LAMP_R` 0.25) are one-number tweaks.
- **Wheels:** head-on and close, the pilot hides the wheels, so the train reads as sitting on the rails through its pilot rather than showing its wheels.
- **The lines:** speed and wind line speeds are unchanged.
