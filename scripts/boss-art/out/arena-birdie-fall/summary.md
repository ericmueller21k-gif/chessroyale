# Boss art: arena-birdie-fall

- Model claude-opus-5-5, effort high, adaptive thinking. 16 turns, 10 renders.
- Spend: **$2.68** of the $6 cap (36 input, 176,124 cache-write, 1,301,343 cache-read, 77,056 output tokens).
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

Only the train and track in `approach` changed. `fall` was rendered after the edit and is unchanged: sky, rain and wind lines, Birdie's tumble, the cap, the ids, the cues and the size are as before. I couldn't check the scale-4 close-ups the brief asked for: every render came out at 1x whatever scale I asked for. So the rivets, the red stripe, the handrails and the lamp rims weren't checked pixel by pixel; their sizes come from the geometry. At 1x it reads as a long yellow locomotive coming up a track.

The animations:
- `fall`: 5 frames x 120 ms, loops. Unchanged.
- `approach`: 9 frames x 390 ms, plays once and holds the last frame. Cue "approach" on frame 0, "hit" on frame 8. Frame 0 matches `fall` frame 0 except for a tiny train in the haze showing two lamp dots at about (175, 224) and (173, 224), as in the first pass.
  - Frames 1-3: the rails and the gravel bed fade in out of the haze, and the train grows.
  - Frames 4-6: sleepers appear, closing up with distance, and the hood and its vents read.
  - Frames 7-8: the engine fills the bottom third (about x 22-150, y 145-235). The cab roof is just under Birdie and the hood runs under his tail toward the vanishing point. The lamps are at full brightness and pale light runs along the rails ahead.

The train is built as 3D blocks seen through one camera:
- A slatted pilot with a coupler, and a short nose with the lamps and a grille between them.
- A raised cab with a two-pane windscreen, a side window and a charcoal roof.
- Behind it a long, lower hood with five louvred side vents, roof fans and a stack.
- A walkway deck the whole length, with the thin red stripe right round it, plus handrails and posts.
- A fuel tank, and two trucks with three big wheels a side sitting on the rails.
- It is 17.4 m long and 4.45 m tall, about 4 times as long as it is tall.
- A dark outline is drawn where one block stands in front of another.

Palette keys for the train:
- Yellow `u v y Y`, with `u` as the shadow.
- Roof `m n N`, stripe `q`, silver parts `j l J`, windows `z Z`.
- `W` is the near (right) headlight and `V` the far (left) one, both `#fff3b8` and round. Each has a core of `w` that grows from 12% to 70% of the lamp, and a thin silver rim. The light on the rails uses `w` and `Y`, not `W` or `V`.

The track:
- The two rails are 1.6 m apart, centred at X = +/-0.8, exactly under the wheels. Each has a lit head and a dark side, and the nearest show rivets.
- Sleepers are 4.4 m long and 0.72 m apart. They are only drawn where they come out at least 2.4 px apart, so far off they blend into the haze instead of flickering.
- The vanishing point is at x 184 on the horizon. The horizon rises from y 218 in frame 0 to y 120 in frame 8, as before.

Things you might want to change:
- The last frame is smaller than the brief's x 26-190, y 173-238. The far end can't reach x 190 with the vanishing point at x 184, and a longer engine would only add a few pixels. `Z_NEAR` (8.8) sets how close it gets (smaller is bigger), `CX` (9.6) how far to the side the camera sits (more shows more of the side), and `OX` (184) where the vanishing point is.
- The last frame shows little track ahead of the train. Most of the nearest rail is in the bottom 20 rows that a computer cuts off. Raising `Z_NEAR` a little shows more track but makes the train smaller.
- `Z_FAR` (70) sets how far off it starts. The deck and hood blocks (17.0-17.4 m) set the hood length, and `VENTS` sets the vent spacing.
- The light reaches 1.5 + 5 x brightness metres ahead of the train.
- The rain and wind lines move at the same speed as before.
