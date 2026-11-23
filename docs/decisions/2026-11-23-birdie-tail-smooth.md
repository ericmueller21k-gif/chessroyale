# Birdie: no tail on Armored Birdie; his train smooth (Nov 23, 2026)

Eric: "birds don't have tails like this ... send that back to get removed"; the train's ride "really like choppy ... at least it needs to feel smoother".

- The `tail` layer is gone from Armored Birdie's figure (every animation) and his armored cutscene (re-baked); nothing behind it shows a hole (his violet rim follows his outline). The plain dove's town sprite and his fall cutscene keep theirs (the director asks Eric).
- The choppiness, measured every display frame on a phone: his board layer redraws every frame and set the train's `animation-delay` from each frame's `now`, retiming the running animation, so it crossed in 0.65 s in 12 px jumps, then stood still past the board's edge for 38 frames. Now the delay is fixed as the element is first drawn (`Timed` in Birdie.tsx; the stepping pieces too): 5.9 px every frame for the whole 1.3 s.
- Calls: the train moves by `translate` (composited: it kept moving with the page's thread blocked 250 ms) and stays linear, so the smash still lands as its nose reaches the piece (`trainReaches`). Its wheel/smoke loop is the art's own code sampled at 12 steps of 65 ms (town ride: 10 of 65 ms) instead of 4 of 105 ms: no new drawing; the wheels' tread is a 4-pixel pattern, so a richer turning wheel would be a paid art run.
- Other bosses' layers set `animationDelay` from `now` the same way (Timber, Gardener, Tiger, PowerParts' Flight); they're only wrong if their layer redraws during the animation. Not changed here.
