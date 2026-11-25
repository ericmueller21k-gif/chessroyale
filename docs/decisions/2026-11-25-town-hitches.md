# Town hitches: the labels made on the loading screen (Nov 25, 2026)

Eric, Nov 25: "the town is slow as fuck on my laptop with nothing else open". His `/town?report`: 60 fps median but 20 at the 1st
percentile, "1063 uploads" in 15.6 s of walking, every one of the worst 10 frames with uploads, the time "outside our code" (the GPU).

- **Cause:** the labels were made, and uploaded, as they first showed at each size: home names (9 sizes), signs (each scale), tags (5
  sizes), clouds, a table clock's every second, a board's cached picture each time the camera came to rest; and the speech bubble was
  drawn into a new picture every frame its speaker glided a fraction of a pixel (its key was its shape to a quarter pixel).
- **Fix:** the loading screen makes them all and keeps them (render.ts `makeLabels`); the bubble is one picture a line on whole device
  pixels; WebGL skips the board cache; a font loading no longer redraws what was drawn in its own font. Headless, 15 s of walking and
  zooming: 116 uploads before, 0 after (a boss's new line: 1).
- **Calls (mine):** signs are one picture at their font's own pixels drawn `s` times over with nearest sampling (the same pixels as
  before when level; a front at a slant now has unsmoothed letter edges). The cost: about 55 ms of loading, and one more 16 MB atlas page
  at 1.25x (two at 3x). Buildings' 111 ms and Placing & sorting's 34 ms spikes: these parts time the GL calls a stall lands in, so they
  are most likely the same uploads; Eric's next `?report` will say (not measurable headless, where WebGL is software).
